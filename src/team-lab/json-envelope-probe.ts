import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildDiscoveryPrompt, FIXTURE_SEARCH_CONTEXT } from "./brand-domain-prompts.js";
import { stripMarkdownFence, validateDiscoveryEnvelope } from "./brand-domain-gate.js";
import type { ProbeResult } from "./brand-domain-types.js";

const PROBE_RUNS = 10;
const QUERIES = ["MED official domain", "MED login"];

function loadConfig(): { apiKey: string; baseUrl: string; model: string } {
  // Env var takes priority
  const envKey = process.env.DEEPSEEK_API_KEY;
  if (envKey) {
    return { apiKey: envKey, baseUrl: "https://api.deepseek.com", model: "deepseek-chat" };
  }

  // Try deepseek.txt and deepseek-api.txt
  for (const filename of ["deepseek.txt", "deepseek-api.txt"]) {
    const p = resolve(filename);
    if (!existsSync(p)) continue;
    const content = readFileSync(p, "utf-8").trim();

    let apiKey: string | undefined;
    let baseUrl = "https://api.deepseek.com";

    // Key-value format: "api-key = xxx" or "api-key: xxx"
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

    if (!apiKey) {
      // Fallback: first non-empty non-comment line is the key
      const keyLine = content.split("\n").find((l) => l.trim() && !l.trim().startsWith("#") && !l.includes("="));
      if (keyLine) apiKey = keyLine.trim();
    }

    if (apiKey) {
      // Detect API format from base URL
      const isAnthropic = baseUrl.includes("/anthropic");
      const model = "deepseek-chat";
      return { apiKey, baseUrl, model: isAnthropic ? model : model };
    }
  }

  console.error("DEEPSEEK_API_KEY not found. Set env var or create deepseek.txt");
  process.exit(1);
}

async function callLLM(config: { apiKey: string; baseUrl: string; model: string }, prompt: string): Promise<string> {
  const isAnthropic = config.baseUrl.includes("/anthropic");

  if (isAnthropic) {
    return callAnthropicFormat(config, prompt);
  }
  return callOpenAIFormat(config, prompt);
}

async function callAnthropicFormat(config: { apiKey: string; baseUrl: string; model: string }, prompt: string): Promise<string> {
  const url = `${config.baseUrl}/v1/messages`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`DeepSeek Anthropic API ${resp.status}: ${body.slice(0, 300)}`);
  }

  const data = (await resp.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  // Extract text from content blocks, skip thinking blocks
  return data.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!)
    .join("\n");
}

async function callOpenAIFormat(config: { apiKey: string; baseUrl: string; model: string }, prompt: string): Promise<string> {
  const url = `${config.baseUrl}/chat/completions`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`DeepSeek OpenAI API ${resp.status}: ${body.slice(0, 300)}`);
  }

  const data = (await resp.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

async function main() {
  const config = loadConfig();
  const probeId = `probe-${Date.now()}`;
  const outputDir = join(".data", "team-lab", "probes", probeId);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const prompt = buildDiscoveryPrompt(QUERIES, FIXTURE_SEARCH_CONTEXT);
  writeFileSync(join(outputDir, "prompt.txt"), prompt);

  const apiFormat = config.baseUrl.includes("/anthropic") ? "anthropic" : "openai";
  console.log(`[team-lab] JSON envelope probe starting`);
  console.log(`[team-lab] model: ${config.model} (${apiFormat} format)`);
  console.log(`[team-lab] endpoint: ${config.baseUrl}`);
  console.log(`[team-lab] runs: ${PROBE_RUNS}`);
  console.log(`[team-lab] output: ${outputDir}`);
  console.log();

  const result: ProbeResult = {
    probeId,
    totalRuns: PROBE_RUNS,
    passed: 0,
    failed: 0,
    errors: [],
    runDetails: [],
  };

  for (let i = 1; i <= PROBE_RUNS; i++) {
    process.stdout.write(`[team-lab] run ${i}/${PROBE_RUNS} ... `);
    try {
      const raw = await callLLM(config, prompt);
      writeFileSync(join(outputDir, `run-${i}.raw.txt`), raw);

      const stripped = stripMarkdownFence(raw);
      let parsed: unknown;
      try {
        parsed = JSON.parse(stripped);
      } catch (parseErr) {
        result.failed++;
        const error = `JSON parse failed: ${(parseErr as Error).message}`;
        result.errors.push({ run: i, error });
        result.runDetails.push({ run: i, passed: false, candidateCount: 0, error });
        console.log(`FAIL (parse error)`);
        continue;
      }

      const validation = validateDiscoveryEnvelope(parsed);
      if (!validation.ok) {
        result.failed++;
        const error = `Gate rejected: ${validation.errors.join("; ")}`;
        result.errors.push({ run: i, error });
        result.runDetails.push({ run: i, passed: false, candidateCount: 0, error });
        console.log(`FAIL (gate: ${validation.errors.join(", ")})`);
        continue;
      }

      result.passed++;
      const count = validation.value.emits.length;
      result.runDetails.push({ run: i, passed: true, candidateCount: count });
      writeFileSync(join(outputDir, `run-${i}.parsed.json`), JSON.stringify(validation.value, null, 2));
      console.log(`PASS (${count} candidates)`);
    } catch (err) {
      result.failed++;
      const error = `API error: ${(err as Error).message}`;
      result.errors.push({ run: i, error });
      result.runDetails.push({ run: i, passed: false, candidateCount: 0, error });
      console.log(`FAIL (${(err as Error).message.slice(0, 80)})`);
    }
  }

  writeFileSync(join(outputDir, "result.json"), JSON.stringify(result, null, 2));

  console.log();
  console.log(`--- JSON Envelope Probe Result ---`);
  console.log(`model:    ${config.model}`);
  console.log(`passed:   ${result.passed}/${result.totalRuns}`);
  console.log(`failed:   ${result.failed}/${result.totalRuns}`);

  if (result.errors.length > 0) {
    console.log(`common errors:`);
    const errorCounts = new Map<string, number>();
    for (const e of result.errors) {
      const key = e.error.split(":")[0];
      errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of errorCounts) {
      console.log(`  - ${key}: ${count}`);
    }
  }

  console.log();
  if (result.passed >= 8) {
    console.log(`VERDICT: PASS (>= 8/10). JSON envelope approach is viable.`);
  } else if (result.passed >= 5) {
    console.log(`VERDICT: MARGINAL (5-7/10). Needs repair/retry before proceeding.`);
  } else {
    console.log(`VERDICT: FAIL (< 5/10). JSON envelope approach is NOT viable. Switch to tool call / structured output.`);
  }

  console.log(`raw outputs saved to ${outputDir}`);
}

main().catch((err) => {
  console.error("[team-lab] probe failed:", err);
  process.exit(1);
});
