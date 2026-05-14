import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TeamStore } from "../src/team/team-store.js";
import { TeamPipeline } from "../src/team/team-pipeline.js";
import type { DiscoveryEnvelope, ReviewEnvelope } from "../src/team-lab/brand-domain-types.js";

function makeDir(): string {
  return join(tmpdir(), `team-pipeline-test-${Date.now()}`);
}

const FIXTURE_DISCOVERY: DiscoveryEnvelope = {
  status: "success",
  emits: [
    {
      type: "candidate_domain",
      payload: {
        domain: "med-example.com",
        normalizedDomain: "med-example.com",
        sourceType: "search_query",
        sourceUrl: "https://example.com",
        matchReason: "Domain contains MED keyword",
        confidence: "medium",
        discoveredAt: "2026-05-14T00:00:00.000Z",
      },
    },
  ],
  checkpoint: { completedQueries: ["MED login"], remainingQueries: [], notes: [] },
};

const FIXTURE_REVIEW: ReviewEnvelope = {
  status: "success",
  findings: [
    {
      targetDomain: "med-example.com",
      verdict: "pass_with_warning",
      issueType: "coverage_limitation",
      message: "Keyword match alone is insufficient",
      recommendedChange: "Keep as candidate only",
      createdAt: "2026-05-14T00:00:00.000Z",
    },
  ],
  summary: "Candidates require further evidence",
};

describe("TeamPipeline", () => {
  let dir: string;
  let store: TeamStore;

  beforeEach(() => {
    dir = makeDir();
    mkdirSync(dir, { recursive: true });
    store = new TeamStore(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("happy path: discovery → reviewer → finalizer", async () => {
    const pipeline = new TeamPipeline(store, {
      callLLM: async (_cfg, prompt) => {
        if (prompt.includes("Discovery Agent")) return JSON.stringify(FIXTURE_DISCOVERY);
        if (prompt.includes("Reviewer")) return JSON.stringify(FIXTURE_REVIEW);
        return "";
      },
      searchAndFormat: async () => "fixture context",
    });

    const { run } = await pipeline.execute({ keyword: "MED", mode: "fixture" });
    assert.equal(run.status, "completed");
    assert.equal(run.candidates.length, 1);
    assert.equal(run.candidates[0].domain, "med-example.com");
    assert.equal(run.findings.length, 1);
    assert.equal(run.roles[0].status, "completed");
    assert.equal(run.roles[1].status, "completed");
    assert.equal(run.roles[2].status, "completed");
  });

  it("discovery API error → continues, pipeline fails if 0 candidates", async () => {
    const pipeline = new TeamPipeline(store, {
      callLLM: async () => { throw new Error("API timeout"); },
      searchAndFormat: async () => "fixture",
    });

    const { run } = await pipeline.execute({ keyword: "MED", mode: "fixture" });
    assert.equal(run.status, "failed");
    assert.equal(run.candidates.length, 0);
    assert.equal(run.roles[0].status, "failed");
  });

  it("discovery JSON parse failure → continues to next round", async () => {
    let callCount = 0;
    const pipeline = new TeamPipeline(store, {
      callLLM: async () => {
        callCount++;
        if (callCount === 1) return "not valid json {{{{";
        return JSON.stringify(FIXTURE_DISCOVERY);
      },
      searchAndFormat: async () => "fixture",
    });

    const { run } = await pipeline.execute({ keyword: "MED", mode: "fixture", maxRounds: 2 });
    assert.equal(run.status, "completed");
    assert.equal(run.candidates.length, 1);
  });

  it("discovery gate rejection → continues", async () => {
    const badEnvelope = { status: "success", emits: "not-array", checkpoint: null };
    let callCount = 0;
    const pipeline = new TeamPipeline(store, {
      callLLM: async () => {
        callCount++;
        if (callCount === 1) return JSON.stringify(badEnvelope);
        return JSON.stringify(FIXTURE_DISCOVERY);
      },
      searchAndFormat: async () => "fixture",
    });

    const { run } = await pipeline.execute({ keyword: "MED", mode: "fixture", maxRounds: 2 });
    assert.equal(run.candidates.length, 1);
  });

  it("no candidates → reviewer skipped, pipeline completes", async () => {
    const emptyEnvelope: DiscoveryEnvelope = {
      status: "success",
      emits: [],
      checkpoint: { completedQueries: ["MED login"], remainingQueries: [], notes: [] },
    };
    const pipeline = new TeamPipeline(store, {
      callLLM: async () => JSON.stringify(emptyEnvelope),
      searchAndFormat: async () => "fixture",
    });

    const { run } = await pipeline.execute({ keyword: "MED", mode: "fixture" });
    assert.equal(run.status, "completed");
    assert.equal(run.candidates.length, 0);
    assert.equal(run.roles[1].status, "skipped");
  });

  it("deduplicates domains across rounds", async () => {
    const pipeline = new TeamPipeline(store, {
      callLLM: async () => JSON.stringify(FIXTURE_DISCOVERY),
      searchAndFormat: async () => "fixture",
    });

    const { run } = await pipeline.execute({ keyword: "MED", mode: "fixture", maxRounds: 2 });
    assert.equal(run.candidates.length, 1);
  });

  it("respects maxCandidates cap", async () => {
    const multiEnvelope: DiscoveryEnvelope = {
      status: "success",
      emits: [
        { type: "candidate_domain", payload: { domain: "a.com", normalizedDomain: "a.com", sourceType: "search_query", matchReason: "r", confidence: "low", discoveredAt: "2026-05-14T00:00:00.000Z" } },
        { type: "candidate_domain", payload: { domain: "b.com", normalizedDomain: "b.com", sourceType: "search_query", matchReason: "r", confidence: "low", discoveredAt: "2026-05-14T00:00:00.000Z" } },
      ],
      checkpoint: { completedQueries: ["q"], remainingQueries: [], notes: [] },
    };
    const pipeline = new TeamPipeline(store, {
      callLLM: async () => JSON.stringify(multiEnvelope),
      searchAndFormat: async () => "fixture",
    });

    const { run } = await pipeline.execute({ keyword: "MED", mode: "fixture", maxCandidates: 1, maxRounds: 2 });
    assert.ok(run.candidates.length <= 1);
  });

  it("reviewer API error → role fails, pipeline still completes", async () => {
    let callCount = 0;
    const pipeline = new TeamPipeline(store, {
      callLLM: async () => {
        callCount++;
        if (callCount === 1) return JSON.stringify(FIXTURE_DISCOVERY);
        throw new Error("Reviewer API error");
      },
      searchAndFormat: async () => "fixture",
    });

    const { run } = await pipeline.execute({ keyword: "MED", mode: "fixture" });
    assert.equal(run.status, "completed");
    assert.equal(run.candidates.length, 1);
    assert.equal(run.roles[1].status, "failed");
    assert.ok(run.roles[1].error?.includes("Reviewer API error"));
  });

  it("reviewer gate rejection → role fails", async () => {
    const badReview = { status: "success", findings: "not-array" };
    let callCount = 0;
    const pipeline = new TeamPipeline(store, {
      callLLM: async () => {
        callCount++;
        if (callCount === 1) return JSON.stringify(FIXTURE_DISCOVERY);
        return JSON.stringify(badReview);
      },
      searchAndFormat: async () => "fixture",
    });

    const { run } = await pipeline.execute({ keyword: "MED", mode: "fixture" });
    assert.equal(run.roles[1].status, "failed");
    assert.equal(run.findings.length, 0);
  });

  it("onCompleted callback fires on success", async () => {
    let callbackRun = false;
    const pipeline = new TeamPipeline(store, {
      callLLM: async () => JSON.stringify(FIXTURE_DISCOVERY),
      searchAndFormat: async () => "fixture",
      onCompleted: () => { callbackRun = true; },
    });

    await pipeline.execute({ keyword: "MED", mode: "fixture" });
    assert.ok(callbackRun);
  });

  it("onCompleted callback does NOT fire on failure", async () => {
    let callbackRun = false;
    const pipeline = new TeamPipeline(store, {
      callLLM: async () => { throw new Error("fail"); },
      searchAndFormat: async () => "fixture",
      onCompleted: () => { callbackRun = true; },
    });

    await pipeline.execute({ keyword: "MED", mode: "fixture" });
    assert.ok(!callbackRun);
  });

  it("writes final_report.md artifact", async () => {
    const pipeline = new TeamPipeline(store, {
      callLLM: async () => JSON.stringify(FIXTURE_DISCOVERY),
      searchAndFormat: async () => "fixture",
    });

    const { run } = await pipeline.execute({ keyword: "MED", mode: "fixture" });
    const report = store.readArtifact(run.runId, "final_report.md");
    assert.ok(report.includes("MED"));
    assert.ok(report.includes("med-example.com"));
  });

  it("writes events.jsonl with role lifecycle", async () => {
    const pipeline = new TeamPipeline(store, {
      callLLM: async () => JSON.stringify(FIXTURE_DISCOVERY),
      searchAndFormat: async () => "fixture",
    });

    const { run } = await pipeline.execute({ keyword: "MED", mode: "fixture" });
    const events = store.readArtifact(run.runId, "events.jsonl");
    const eventTypes = events.trim().split("\n").map((l) => JSON.parse(l).type);
    assert.ok(eventTypes.includes("run_started"));
    assert.ok(eventTypes.includes("role_completed"));
    assert.ok(eventTypes.includes("run_completed"));
  });

  it("writes candidates to candidates.jsonl", async () => {
    const pipeline = new TeamPipeline(store, {
      callLLM: async () => JSON.stringify(FIXTURE_DISCOVERY),
      searchAndFormat: async () => "fixture",
    });

    const { run } = await pipeline.execute({ keyword: "MED", mode: "fixture" });
    const candidates = store.readCandidates(run.runId);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].domain, "med-example.com");
  });

  it("handles LLM returning markdown-fenced JSON", async () => {
    const pipeline = new TeamPipeline(store, {
      callLLM: async () => "```json\n" + JSON.stringify(FIXTURE_DISCOVERY) + "\n```",
      searchAndFormat: async () => "fixture",
    });

    const { run } = await pipeline.execute({ keyword: "MED", mode: "fixture" });
    assert.equal(run.candidates.length, 1);
  });
});
