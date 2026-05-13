import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TeamLabWorkspace } from "./workspace.js";
import { stripMarkdownFence, normalizeDomain, validateDiscoveryEnvelope, validateReviewEnvelope } from "./brand-domain-gate.js";
import { buildDiscoveryPrompt, buildReviewerPrompt, FIXTURE_SEARCH_CONTEXT } from "./brand-domain-prompts.js";
import type { SpikeState, CandidateDomain, DiscoveryEnvelope, ReviewEnvelope } from "./brand-domain-types.js";

// --- Config loading (shared with probe) ---

function loadConfig(): { apiKey: string; baseUrl: string; model: string } {
  const envKey = process.env.DEEPSEEK_API_KEY;
  if (envKey) return { apiKey: envKey, baseUrl: "https://api.deepseek.com", model: "deepseek-chat" };

  for (const filename of ["deepseek.txt", "deepseek-api.txt"]) {
    const p = join(process.cwd(), filename);
    if (!existsSync(p)) continue;
    const content = readFileSync(p, "utf-8").trim();
    let apiKey: string | undefined;
    let baseUrl = "https://api.deepseek.com";
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const kvMatch = trimmed.match(/^(\S+)\s*[=:]\s*(.+)$/);
      if (kvMatch) {
        const [, key, val] = kvMatch;
        if (/api.key/i.test(key)) apiKey = val.trim();
        if (/base.url/i.test(key)) baseUrl = val.trim();
      }
    }
    if (apiKey) return { apiKey, baseUrl, model: "deepseek-chat" };
  }

  console.error("DEEPSEEK_API_KEY not found. Set env var or create deepseek.txt");
  process.exit(1);
}

async function callLLM(config: { apiKey: string; baseUrl: string; model: string }, prompt: string): Promise<string> {
  const isAnthropic = config.baseUrl.includes("/anthropic");
  if (isAnthropic) {
    const url = `${config.baseUrl}/v1/messages`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: config.model, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok) throw new Error(`API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    const data = (await resp.json()) as { content: Array<{ type: string; text?: string }> };
    return data.content.filter((b) => b.type === "text" && b.text).map((b) => b.text!).join("\n");
  }
  const url = `${config.baseUrl}/chat/completions`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: prompt }], temperature: 0.3, max_tokens: 4000 }),
  });
  if (!resp.ok) throw new Error(`API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = (await resp.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? "";
}

// --- Args ---

function parseArgs(): { keyword: string; maxRounds: number; maxCandidates: number } {
  const args = process.argv.slice(2);
  let keyword = "MED";
  let maxRounds = 2;
  let maxCandidates = 10;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--keyword" && args[i + 1]) { keyword = args[++i]; }
    else if (args[i] === "--max-rounds" && args[i + 1]) { maxRounds = parseInt(args[++i], 10); }
    else if (args[i] === "--max-candidates" && args[i + 1]) { maxCandidates = parseInt(args[++i], 10); }
  }
  return { keyword, maxRounds, maxCandidates };
}

// --- Helpers ---

function generateRunId(): string {
  return `tlr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function parseJsonOutput(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const stripped = stripMarkdownFence(raw);
  try {
    return { ok: true, value: JSON.parse(stripped) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function generateFinalReport(state: SpikeState, candidates: CandidateDomain[], review: ReviewEnvelope | null): string {
  const lines: string[] = [];
  lines.push(`# ${state.keyword} Domain Discovery Spike Report`);
  lines.push("");
  lines.push("## 1. Summary");
  lines.push(`- Accepted candidates: ${candidates.length}`);
  lines.push(`- Rejected candidates: ${state.rejectedCandidates}`);
  lines.push(`- Duplicate candidates: ${state.duplicateCandidates}`);
  lines.push(`- Review findings: ${review?.findings.length ?? 0}`);
  lines.push(`- Rounds executed: ${state.currentRound}`);
  lines.push("");

  lines.push("## 2. Coverage");
  lines.push(`- Keyword: ${state.keyword}`);
  lines.push(`- Queries: ${state.queries.join(", ")}`);
  lines.push(`- Max rounds: ${state.maxRounds}`);
  lines.push(`- Max candidates: ${state.maxCandidates}`);
  lines.push(`- Completed queries: ${state.completedQueries.join(", ")}`);
  lines.push("- Source: fixture search context (not real web search)");
  lines.push("");

  lines.push("## 3. Candidate Domains");
  lines.push("| Domain | Source | Confidence | Match Reason |");
  lines.push("|--------|--------|------------|--------------|");
  for (const c of candidates) {
    lines.push(`| ${c.domain} | ${c.sourceType} | ${c.confidence} | ${c.matchReason.slice(0, 60)} |`);
  }
  lines.push("");

  if (review) {
    lines.push("## 4. Reviewer Findings");
    for (const f of review.findings) {
      const target = f.targetDomain ? ` (${f.targetDomain})` : "";
      lines.push(`- **${f.verdict}**${target}: ${f.message}`);
      if (f.recommendedChange) lines.push(`  - Recommended: ${f.recommendedChange}`);
    }
    if (review.summary) {
      lines.push("");
      lines.push(`Summary: ${review.summary}`);
    }
    lines.push("");
  }

  lines.push("## 5. Limitations");
  lines.push("- This is NOT a comprehensive search of the entire internet.");
  lines.push(`- This does NOT represent all ${state.keyword}-related domains.`);
  lines.push("- Domain ownership was NOT verified via WHOIS, DNS, or certificates.");
  lines.push("- No official domain whitelist was provided; ownership claims are preliminary at best.");
  lines.push("- Results are based on fixture search context, not real web search.");
  lines.push("");
  lines.push(`Generated at ${new Date().toISOString()}`);

  return lines.join("\n");
}

// --- Main Pipeline ---

async function main() {
  const { keyword, maxRounds, maxCandidates } = parseArgs();
  const config = loadConfig();
  const runId = generateRunId();
  const rootDir = join(".data", "team-lab");
  const ws = new TeamLabWorkspace({ rootDir });

  const queries = [
    `${keyword} official domain`,
    `${keyword} login`,
    `${keyword} portal`,
  ];

  const state: SpikeState = {
    runId,
    keyword,
    status: "running",
    currentRound: 0,
    maxRounds,
    maxCandidates,
    queries,
    completedQueries: [],
    acceptedCandidates: 0,
    rejectedCandidates: 0,
    duplicateCandidates: 0,
    startedAt: new Date().toISOString(),
  };

  await ws.createRun({ runId, state });
  console.log(`[team-lab] run created: ${runId}`);

  const seenDomains = new Set<string>();
  const allCandidates: CandidateDomain[] = [];

  // Split queries into rounds: round 1 gets first 2, round 2 gets remaining
  const queryBatches: string[][] = [];
  for (let i = 0; i < queries.length; i += 2) {
    queryBatches.push(queries.slice(i, i + 2));
  }

  // --- Discovery rounds ---
  for (let round = 0; round < Math.min(queryBatches.length, maxRounds); round++) {
    if (allCandidates.length >= maxCandidates) {
      console.log(`[team-lab] max candidates reached (${maxCandidates}), skipping remaining rounds`);
      break;
    }

    const batch = queryBatches[round];
    state.currentRound = round + 1;
    console.log(`[team-lab] discovery round ${state.currentRound} started (queries: ${batch.join(", ")})`);

    const prompt = buildDiscoveryPrompt(batch, FIXTURE_SEARCH_CONTEXT);
    let raw: string;
    try {
      raw = await callLLM(config, prompt);
    } catch (err) {
      console.log(`[team-lab] discovery round ${state.currentRound} API error: ${(err as Error).message}`);
      state.lastError = (err as Error).message;
      await ws.writeState(runId, state);
      await ws.writeText(runId, `discovery-round-${state.currentRound}.raw.txt`, `API ERROR: ${(err as Error).message}`);
      continue;
    }

    await ws.writeText(runId, `discovery-round-${state.currentRound}.raw.txt`, raw);

    const parsed = parseJsonOutput(raw);
    if (!parsed.ok) {
      console.log(`[team-lab] discovery round ${state.currentRound} JSON parse failed: ${parsed.error}`);
      state.rejectedCandidates++;
      await ws.appendEvent(runId, { type: "discovery_parse_failed", round: state.currentRound, error: parsed.error });
      await ws.writeState(runId, state);
      continue;
    }

    const validation = validateDiscoveryEnvelope(parsed.value);
    if (!validation.ok) {
      console.log(`[team-lab] discovery round ${state.currentRound} gate rejected: ${validation.errors.join(", ")}`);
      state.rejectedCandidates++;
      await ws.appendEvent(runId, { type: "discovery_gate_rejected", round: state.currentRound, errors: validation.errors });
      await ws.writeState(runId, state);
      continue;
    }

    const envelope: DiscoveryEnvelope = validation.value;
    await ws.writeJson(runId, `discovery-round-${state.currentRound}.output.json`, envelope);

    let accepted = 0;
    let rejected = 0;
    let duplicates = 0;

    for (const emit of envelope.emits) {
      const norm = normalizeDomain(emit.payload.domain);
      if (!norm) { rejected++; continue; }

      if (seenDomains.has(norm)) {
        duplicates++;
        await ws.appendEvent(runId, { type: "duplicate_candidate_skipped", domain: norm });
        continue;
      }

      seenDomains.add(norm);
      const candidate: CandidateDomain = {
        ...emit.payload,
        normalizedDomain: norm,
      };
      await ws.appendCandidate(runId, candidate);
      allCandidates.push(candidate);
      accepted++;
    }

    state.completedQueries.push(...envelope.checkpoint.completedQueries);
    state.acceptedCandidates += accepted;
    state.rejectedCandidates += rejected;
    state.duplicateCandidates += duplicates;
    await ws.writeState(runId, state);
    await ws.appendEvent(runId, { type: "discovery_round_completed", round: state.currentRound, accepted, rejected, duplicates });

    console.log(`[team-lab] discovery round ${state.currentRound} accepted ${accepted}, rejected ${rejected}, duplicate ${duplicates}`);
  }

  // --- Reviewer ---
  let review: ReviewEnvelope | null = null;
  if (allCandidates.length > 0) {
    console.log(`[team-lab] reviewer started with ${allCandidates.length} candidates`);
    const candidatesText = allCandidates.map((c) =>
      `- domain: ${c.domain}\n  sourceType: ${c.sourceType}\n  matchReason: ${c.matchReason}\n  confidence: ${c.confidence}`
    ).join("\n\n");

    const reviewPrompt = buildReviewerPrompt(candidatesText, keyword);
    let reviewRaw: string;
    try {
      reviewRaw = await callLLM(config, reviewPrompt);
    } catch (err) {
      console.log(`[team-lab] reviewer API error: ${(err as Error).message}`);
      state.lastError = (err as Error).message;
      await ws.writeText(runId, "review.raw.txt", `API ERROR: ${(err as Error).message}`);
    }

    if (reviewRaw!) {
      await ws.writeText(runId, "review.raw.txt", reviewRaw);
      const reviewParsed = parseJsonOutput(reviewRaw);
      if (reviewParsed.ok) {
        const reviewValidation = validateReviewEnvelope(reviewParsed.value);
        if (reviewValidation.ok) {
          review = reviewValidation.value;
          await ws.writeJson(runId, "review.json", review);
          console.log(`[team-lab] reviewer completed (${review.findings.length} findings)`);
        } else {
          console.log(`[team-lab] reviewer gate rejected: ${reviewValidation.errors.join(", ")}`);
          await ws.appendEvent(runId, { type: "review_gate_rejected", errors: reviewValidation.errors });
        }
      } else {
        console.log(`[team-lab] reviewer JSON parse failed: ${reviewParsed.error}`);
        await ws.appendEvent(runId, { type: "review_parse_failed", error: reviewParsed.error });
      }
    }
  } else {
    console.log(`[team-lab] no candidates found, skipping reviewer`);
  }

  // --- Final Report (program-generated) ---
  const report = generateFinalReport(state, allCandidates, review);
  await ws.writeText(runId, "final_report.md", report);

  state.status = "completed";
  state.finishedAt = new Date().toISOString();
  await ws.writeState(runId, state);
  await ws.appendEvent(runId, { type: "spike_completed", candidates: allCandidates.length });

  console.log(`[team-lab] final report written`);
  console.log(`[team-lab] run completed: ${runId}`);
  console.log(`[team-lab] output: ${join(rootDir, "runs", runId)}`);
}

main().catch((err) => {
  console.error("[team-lab] spike failed:", err);
  process.exit(1);
});
