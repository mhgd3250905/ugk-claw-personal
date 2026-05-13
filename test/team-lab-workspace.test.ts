import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TeamLabWorkspace } from "../src/team-lab/workspace.js";
import type { SpikeState, CandidateDomain } from "../src/team-lab/brand-domain-types.js";

function makeState(runId: string): SpikeState {
  return {
    runId,
    keyword: "MED",
    status: "running",
    currentRound: 0,
    maxRounds: 2,
    maxCandidates: 10,
    queries: ["MED official domain", "MED login"],
    completedQueries: [],
    acceptedCandidates: 0,
    rejectedCandidates: 0,
    duplicateCandidates: 0,
    startedAt: new Date().toISOString(),
  };
}

function makeCandidate(domain: string): CandidateDomain {
  return {
    domain,
    normalizedDomain: domain.toLowerCase(),
    sourceType: "search_query",
    query: "MED login",
    matchReason: `Domain ${domain} contains MED keyword`,
    confidence: "medium",
    discoveredAt: new Date().toISOString(),
  };
}

describe("TeamLabWorkspace", () => {
  let testDir: string;
  let ws: TeamLabWorkspace;

  beforeEach(() => {
    testDir = join(tmpdir(), `team-lab-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    ws = new TeamLabWorkspace({ rootDir: testDir });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("createRun creates directory structure", async () => {
    const dir = await ws.createRun({ runId: "run-1", state: makeState("run-1") });
    assert.ok(existsSync(dir));
    assert.ok(existsSync(join(dir, "state.json")));
    assert.ok(existsSync(join(dir, "events.jsonl")));
    assert.ok(existsSync(join(dir, "candidates.jsonl")));
  });

  it("writeState / readState round-trip", async () => {
    const state = makeState("run-2");
    await ws.createRun({ runId: "run-2", state });
    state.acceptedCandidates = 5;
    await ws.writeState("run-2", state);
    const loaded = await ws.readState("run-2");
    assert.equal(loaded.acceptedCandidates, 5);
  });

  it("writeState uses atomic rename (no half-written JSON)", async () => {
    const state = makeState("run-3");
    await ws.createRun({ runId: "run-3", state });
    state.acceptedCandidates = 99;
    await ws.writeState("run-3", state);
    // Verify the .tmp file is gone
    const tmpPath = join(testDir, "runs", "run-3", "state.json.tmp");
    assert.ok(!existsSync(tmpPath));
    // Verify content is valid JSON
    const content = readFileSync(join(testDir, "runs", "run-3", "state.json"), "utf-8");
    const parsed = JSON.parse(content);
    assert.equal(parsed.acceptedCandidates, 99);
  });

  it("appendCandidate and readCandidates", async () => {
    await ws.createRun({ runId: "run-4", state: makeState("run-4") });
    const c1 = makeCandidate("med-example.com");
    const c2 = makeCandidate("med-portal.com");
    await ws.appendCandidate("run-4", c1);
    await ws.appendCandidate("run-4", c2);
    const candidates = await ws.readCandidates("run-4");
    assert.equal(candidates.length, 2);
    assert.equal(candidates[0].domain, "med-example.com");
    assert.equal(candidates[1].domain, "med-portal.com");
  });

  it("readCandidates returns empty array for empty file", async () => {
    await ws.createRun({ runId: "run-5", state: makeState("run-5") });
    const candidates = await ws.readCandidates("run-5");
    assert.deepEqual(candidates, []);
  });

  it("appendEvent writes to events.jsonl", async () => {
    await ws.createRun({ runId: "run-6", state: makeState("run-6") });
    await ws.appendEvent("run-6", { type: "test_event", message: "hello" });
    await ws.appendEvent("run-6", { type: "test_event", message: "world" });
    const content = readFileSync(join(testDir, "runs", "run-6", "events.jsonl"), "utf-8").trim();
    const lines = content.split("\n");
    assert.equal(lines.length, 2);
    assert.ok(lines[0].includes("hello"));
    assert.ok(lines[1].includes("world"));
  });

  it("writeText rejects ../ path traversal", async () => {
    await ws.createRun({ runId: "run-7", state: makeState("run-7") });
    await assert.rejects(
      () => ws.writeText("run-7", "../etc/passwd", "hacked"),
      /path traversal/
    );
  });

  it("writeText rejects absolute paths", async () => {
    await ws.createRun({ runId: "run-8", state: makeState("run-8") });
    await assert.rejects(
      () => ws.writeText("run-8", "/etc/passwd", "hacked"),
      /absolute path/
    );
  });

  it("writeJson writes valid JSON", async () => {
    await ws.createRun({ runId: "run-9", state: makeState("run-9") });
    await ws.writeJson("run-9", "data.json", { foo: "bar", count: 42 });
    const content = readFileSync(join(testDir, "runs", "run-9", "data.json"), "utf-8");
    const parsed = JSON.parse(content);
    assert.equal(parsed.foo, "bar");
    assert.equal(parsed.count, 42);
  });

  it("writeJson rejects path traversal", async () => {
    await ws.createRun({ runId: "run-10", state: makeState("run-10") });
    await assert.rejects(
      () => ws.writeJson("run-10", "../../evil.json", {}),
      /path traversal/
    );
  });
});
