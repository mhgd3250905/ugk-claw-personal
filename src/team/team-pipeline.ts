import { stripMarkdownFence, normalizeDomain, validateDiscoveryEnvelope, validateReviewEnvelope, repairJson } from "../team-lab/brand-domain-gate.js";
import { buildDiscoveryPrompt, buildReviewerPrompt, FIXTURE_SEARCH_CONTEXT } from "../team-lab/brand-domain-prompts.js";
import { searchAndFormat } from "../team-lab/search.js";
import { TeamStore } from "./team-store.js";
import { loadLLMConfig, callLLM } from "./llm.js";
import type { TeamRun, RoleTask, CreateTeamRunInput } from "./types.js";
import type { CandidateDomain, DiscoveryEnvelope, ReviewEnvelope } from "../team-lab/brand-domain-types.js";

function generateRunId(): string {
  return `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function parseJsonOutput(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const stripped = stripMarkdownFence(raw);
  try {
    return { ok: true, value: JSON.parse(stripped) };
  } catch { /* try repair */ }
  try {
    return { ok: true, value: repairJson(stripped) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function makeRole(role: RoleTask["role"], inputSummary: string): RoleTask {
  return { role, status: "pending", inputSummary };
}

function startRole(role: RoleTask): void {
  role.status = "running";
  role.startedAt = new Date().toISOString();
}

function completeRole(role: RoleTask, outputSummary: string): void {
  role.status = "completed";
  role.finishedAt = new Date().toISOString();
  role.outputSummary = outputSummary;
}

function failRole(role: RoleTask, error: string): void {
  role.status = "failed";
  role.finishedAt = new Date().toISOString();
  role.error = error;
}

export interface PipelineResult {
  run: TeamRun;
}

export class TeamPipeline {
  private store: TeamStore;
  private config: ReturnType<typeof loadLLMConfig>;

  constructor(store: TeamStore) {
    this.store = store;
    this.config = loadLLMConfig();
  }

  async execute(input: CreateTeamRunInput): Promise<PipelineResult> {
    const runId = generateRunId();
    const mode = input.mode ?? "real";
    const maxRounds = input.maxRounds ?? 2;
    const maxCandidates = input.maxCandidates ?? 10;
    const keyword = input.keyword;
    const now = new Date().toISOString();

    const queries = [
      `${keyword} official domain`,
      `${keyword} login`,
      `${keyword} portal`,
    ];

    const run: TeamRun = {
      runId,
      keyword,
      mode,
      status: "running",
      roles: [
        makeRole("discovery", `queries: ${queries.join(", ")}`),
        makeRole("reviewer", `candidates from discovery`),
        makeRole("finalizer", `report generation`),
      ],
      candidates: [],
      findings: [],
      queries,
      completedQueries: [],
      startedAt: now,
    };

    this.store.createRun(run);
    this.store.appendEvent(runId, { type: "run_started", _ts: now });

    // --- Discovery ---
    const discoveryRole = run.roles[0];
    startRole(discoveryRole);
    this.store.appendEvent(runId, { type: "role_started", _ts: new Date().toISOString(), role: "discovery" });

    const seenDomains = new Set<string>();
    const queryBatches: string[][] = [];
    for (let i = 0; i < queries.length; i += 2) {
      queryBatches.push(queries.slice(i, i + 2));
    }

    let discoveryErrors = 0;
    for (let round = 0; round < Math.min(queryBatches.length, maxRounds); round++) {
      if (run.candidates.length >= maxCandidates) break;

      const batch = queryBatches[round];
      const searchContext = mode === "real"
        ? await searchAndFormat(batch)
        : FIXTURE_SEARCH_CONTEXT;
      this.store.writeArtifact(runId, `discovery-round-${round + 1}.search-context.txt`, searchContext);

      const prompt = buildDiscoveryPrompt(batch, searchContext);
      let raw: string;
      try {
        raw = await callLLM(this.config, prompt);
      } catch (err) {
        discoveryErrors++;
        this.store.appendEvent(runId, { type: "role_failed", _ts: new Date().toISOString(), role: "discovery", round: round + 1, error: (err as Error).message });
        continue;
      }

      this.store.writeArtifact(runId, `discovery-round-${round + 1}.raw.txt`, raw);

      const parsed = parseJsonOutput(raw);
      if (!parsed.ok) {
        discoveryErrors++;
        this.store.appendEvent(runId, { type: "gate_rejected", _ts: new Date().toISOString(), role: "discovery", round: round + 1, error: parsed.error });
        continue;
      }

      const validation = validateDiscoveryEnvelope(parsed.value);
      if (!validation.ok) {
        discoveryErrors++;
        this.store.appendEvent(runId, { type: "gate_rejected", _ts: new Date().toISOString(), role: "discovery", round: round + 1, errors: validation.errors });
        continue;
      }

      const envelope: DiscoveryEnvelope = validation.value;
      let accepted = 0;
      for (const emit of envelope.emits) {
        const norm = normalizeDomain(emit.payload.domain);
        if (!norm) { continue; }
        if (seenDomains.has(norm)) { continue; }
        seenDomains.add(norm);
        const candidate: CandidateDomain = { ...emit.payload, normalizedDomain: norm };
        run.candidates.push(candidate);
        this.store.appendCandidate(runId, candidate);
        accepted++;
      }

      run.completedQueries.push(...envelope.checkpoint.completedQueries);
      this.store.appendEvent(runId, { type: "candidates_accepted", _ts: new Date().toISOString(), round: round + 1, accepted });
    }

    if (discoveryErrors > 0 && run.candidates.length === 0) {
      failRole(discoveryRole, `${discoveryErrors} rounds failed, 0 candidates`);
      run.status = "failed";
      run.error = "Discovery produced no candidates";
      run.finishedAt = new Date().toISOString();
      this.store.writeRun(run);
      this.store.appendEvent(runId, { type: "run_failed", _ts: new Date().toISOString(), error: run.error });
      return { run };
    }

    completeRole(discoveryRole, `${run.candidates.length} candidates from ${queryBatches.length} rounds (${discoveryErrors} errors)`);
    this.store.appendEvent(runId, { type: "role_completed", _ts: new Date().toISOString(), role: "discovery", candidateCount: run.candidates.length });

    // --- Reviewer ---
    const reviewerRole = run.roles[1];
    if (run.candidates.length === 0) {
      reviewerRole.status = "skipped";
      reviewerRole.inputSummary = "no candidates to review";
    } else {
      startRole(reviewerRole);
      this.store.appendEvent(runId, { type: "role_started", _ts: new Date().toISOString(), role: "reviewer" });

      const candidatesText = run.candidates.map((c) =>
        `- domain: ${c.domain}\n  sourceType: ${c.sourceType}\n  matchReason: ${c.matchReason}\n  confidence: ${c.confidence}`
      ).join("\n\n");

      const reviewPrompt = buildReviewerPrompt(candidatesText, keyword);
      let reviewRaw: string;
      try {
        reviewRaw = await callLLM(this.config, reviewPrompt);
      } catch (err) {
        failRole(reviewerRole, (err as Error).message);
        this.store.writeRun(run);
      }

      if (reviewRaw!) {
        this.store.writeArtifact(runId, "review.raw.txt", reviewRaw);
        const reviewParsed = parseJsonOutput(reviewRaw);
        if (reviewParsed.ok) {
          const reviewValidation = validateReviewEnvelope(reviewParsed.value);
          if (reviewValidation.ok) {
            const review: ReviewEnvelope = reviewValidation.value;
            run.findings = review.findings;
            completeRole(reviewerRole, `${review.findings.length} findings, summary: ${review.summary.slice(0, 80)}`);
            this.store.appendEvent(runId, { type: "role_completed", _ts: new Date().toISOString(), role: "reviewer", findingCount: review.findings.length });
          } else {
            failRole(reviewerRole, `gate rejected: ${reviewValidation.errors.join(", ")}`);
            this.store.appendEvent(runId, { type: "gate_rejected", _ts: new Date().toISOString(), role: "reviewer", errors: reviewValidation.errors });
          }
        } else {
          failRole(reviewerRole, `JSON parse failed: ${reviewParsed.error}`);
        }
      }
    }

    // --- Finalizer (programmatic) ---
    const finalizerRole = run.roles[2];
    startRole(finalizerRole);
    const report = this.generateReport(run);
    this.store.writeArtifact(runId, "final_report.md", report);
    completeRole(finalizerRole, `report written`);
    this.store.appendEvent(runId, { type: "role_completed", _ts: new Date().toISOString(), role: "finalizer" });

    run.status = "completed";
    run.finishedAt = new Date().toISOString();
    this.store.writeRun(run);
    this.store.appendEvent(runId, { type: "run_completed", _ts: run.finishedAt });

    return { run };
  }

  private generateReport(run: TeamRun): string {
    const lines: string[] = [];
    lines.push(`# ${run.keyword} Domain Discovery Report`);
    lines.push("");
    lines.push("## 1. Summary");
    lines.push(`- Candidates: ${run.candidates.length}`);
    lines.push(`- Findings: ${run.findings.length}`);
    lines.push(`- Queries: ${run.completedQueries.join(", ")}`);
    lines.push(`- Source: ${run.mode === "real" ? "SearXNG live search" : "fixture"}`);
    lines.push("");

    lines.push("## 2. Candidate Domains");
    lines.push("| Domain | Source | Confidence | Match Reason |");
    lines.push("|--------|--------|------------|--------------|");
    for (const c of run.candidates) {
      lines.push(`| ${c.domain} | ${c.sourceType} | ${c.confidence} | ${c.matchReason.slice(0, 60)} |`);
    }
    lines.push("");

    if (run.findings.length > 0) {
      lines.push("## 3. Review Findings");
      for (const f of run.findings) {
        const target = f.targetDomain ? ` (${f.targetDomain})` : "";
        lines.push(`- **${f.verdict}**${target}: ${f.message}`);
        if (f.recommendedChange) lines.push(`  - Recommended: ${f.recommendedChange}`);
      }
      lines.push("");
    }

    lines.push("## 4. Limitations");
    lines.push("- NOT a comprehensive search of the entire internet.");
    lines.push(`- Does NOT represent all ${run.keyword}-related domains.`);
    lines.push("- Domain ownership was NOT verified.");
    lines.push("");
    lines.push(`Generated at ${new Date().toISOString()}`);
    return lines.join("\n");
  }
}
