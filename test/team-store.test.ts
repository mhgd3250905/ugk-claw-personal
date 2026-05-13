import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TeamStore } from "../src/team/team-store.js";
import type { TeamRun } from "../src/team/types.js";

function makeRun(overrides?: Partial<TeamRun>): TeamRun {
  return {
    runId: "test-run-001",
    keyword: "MED",
    mode: "fixture",
    status: "pending",
    roles: [],
    candidates: [],
    findings: [],
    queries: ["MED login"],
    completedQueries: [],
    startedAt: "2026-05-14T00:00:00.000Z",
    ...overrides,
  };
}

describe("TeamStore", () => {
  let dir: string;
  let store: TeamStore;

  beforeEach(() => {
    dir = join(tmpdir(), `team-store-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    store = new TeamStore(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("createRun + readRun round-trip", () => {
    const run = makeRun();
    store.createRun(run);
    const loaded = store.readRun("test-run-001");
    assert.equal(loaded.runId, "test-run-001");
    assert.equal(loaded.keyword, "MED");
  });

  it("writeRun updates state", () => {
    const run = makeRun();
    store.createRun(run);
    run.status = "running";
    store.writeRun(run);
    const loaded = store.readRun("test-run-001");
    assert.equal(loaded.status, "running");
  });

  it("appendEvent + events exist", () => {
    const run = makeRun();
    store.createRun(run);
    store.appendEvent("test-run-001", { type: "run_started", _ts: new Date().toISOString() });
    const eventsPath = join(dir, "runs", "test-run-001", "events.jsonl");
    assert.ok(existsSync(eventsPath));
  });

  it("appendCandidate + readCandidates", () => {
    const run = makeRun();
    store.createRun(run);
    store.appendCandidate("test-run-001", {
      domain: "med-example.com",
      normalizedDomain: "med-example.com",
      sourceType: "search_query",
      matchReason: "test",
      confidence: "low",
      discoveredAt: "2026-05-14T00:00:00.000Z",
    });
    const candidates = store.readCandidates("test-run-001");
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].domain, "med-example.com");
  });

  it("readCandidates returns empty for missing file", () => {
    const run = makeRun();
    store.createRun(run);
    // Don't append any candidates
    const candidates = store.readCandidates("test-run-001");
    assert.equal(candidates.length, 0);
  });

  it("writeArtifact + readArtifact", () => {
    const run = makeRun();
    store.createRun(run);
    store.writeArtifact("test-run-001", "test.txt", "hello");
    const content = store.readArtifact("test-run-001", "test.txt");
    assert.equal(content, "hello");
  });

  it("writeArtifact rejects path traversal", () => {
    const run = makeRun();
    store.createRun(run);
    assert.throws(() => store.writeArtifact("test-run-001", "../evil.txt", "x"), /path traversal/);
  });

  it("listRuns returns sorted summaries", () => {
    store.createRun(makeRun({ runId: "run-1", startedAt: "2026-05-14T00:00:00.000Z" }));
    store.createRun(makeRun({ runId: "run-2", startedAt: "2026-05-14T01:00:00.000Z" }));
    const summaries = store.listRuns();
    assert.equal(summaries.length, 2);
    assert.equal(summaries[0].runId, "run-2"); // newest first
  });
});
