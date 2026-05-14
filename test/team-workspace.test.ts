import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TeamWorkspace } from "../src/team/team-workspace.js";
import type { TeamRunState, TeamPlan, TeamStreamName, TeamStreamItem, TeamStreamCursor } from "../src/team/types.js";
import type { TeamEvent } from "../src/team/team-events.js";

function makeDir(): string {
	return join(tmpdir(), `team-ws-test-${Date.now()}`);
}

function makePlan(keyword: string): TeamPlan {
	return {
		templateId: "brand_domain_discovery",
		goal: `Discover ${keyword} related domains`,
		keyword,
		roles: [],
		streams: ["candidate_domains", "domain_evidence", "domain_classifications", "review_findings"],
		discoveryPlan: {
			searchQueries: [`${keyword} official domain`],
			certificatePatterns: [],
			githubOrDocsQueries: [],
			similarDomainPatterns: [],
			knownSiteLinks: [],
		},
		stopConditions: ["maxRounds reached"],
		deliverables: ["final_report.md"],
	};
}

function makeState(teamRunId: string, keyword: string): TeamRunState {
	return {
		teamRunId,
		templateId: "brand_domain_discovery",
		status: "queued",
		goal: `Discover ${keyword} related domains`,
		keyword,
		companyHints: { officialDomains: [], companyNames: [], excludedGenericMeanings: [] },
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		currentRound: 0,
		budgets: { maxRounds: 5, maxCandidates: 100, maxMinutes: 60, roleTaskTimeoutMs: 180000, roleTaskMaxRetries: 1 },
		counters: { candidateDomains: 0, domainEvidence: 0, classifications: 0, reviewFindings: 0, failedRoleTasks: 0 },
		stopSignals: [],
	};
}

describe("TeamWorkspace", () => {
	let dir: string;
	let ws: TeamWorkspace;

	beforeEach(() => {
		dir = makeDir();
		mkdirSync(dir, { recursive: true });
		ws = new TeamWorkspace({ teamDataDir: dir });
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("createRun creates plan.json, state.json, events.jsonl and subdirectories", async () => {
		const plan = makePlan("MED");
		const state = makeState("run1", "MED");
		await ws.createRun({ teamRunId: "run1", plan, state });

		const runDir = join(dir, "runs", "run1");
		assert.ok(existsSync(join(runDir, "plan.json")));
		assert.ok(existsSync(join(runDir, "state.json")));
		assert.ok(existsSync(join(runDir, "events.jsonl")));
		assert.ok(existsSync(join(runDir, "streams")));
		assert.ok(existsSync(join(runDir, "cursors")));
		assert.ok(existsSync(join(runDir, "role-tasks")));
		assert.ok(existsSync(join(runDir, "artifacts")));
	});

	it("appendStreamItem appends JSONL and readStreamItems reads them back", async () => {
		await ws.createRun({ teamRunId: "run1", plan: makePlan("MED"), state: makeState("run1", "MED") });

		const item1: TeamStreamItem = {
			itemId: "si_1",
			teamRunId: "run1",
			streamName: "candidate_domains",
			producerRoleId: "discovery",
			producerTaskId: "rt_1",
			payload: { domain: "med-example.com", normalizedDomain: "med-example.com" },
			createdAt: new Date().toISOString(),
		};
		const item2: TeamStreamItem = {
			itemId: "si_2",
			teamRunId: "run1",
			streamName: "candidate_domains",
			producerRoleId: "discovery",
			producerTaskId: "rt_1",
			payload: { domain: "med-test.com", normalizedDomain: "med-test.com" },
			createdAt: new Date().toISOString(),
		};

		await ws.appendStreamItem("run1", "candidate_domains", item1);
		await ws.appendStreamItem("run1", "candidate_domains", item2);

		const items = await ws.readStreamItems("run1", "candidate_domains");
		assert.equal(items.length, 2);
		assert.equal(items[0].itemId, "si_1");
		assert.equal(items[1].itemId, "si_2");
	});

	it("readStreamItems returns [] for empty stream", async () => {
		await ws.createRun({ teamRunId: "run1", plan: makePlan("MED"), state: makeState("run1", "MED") });
		const items = await ws.readStreamItems("run1", "candidate_domains");
		assert.deepEqual(items, []);
	});

	it("writeState uses atomic replacement", async () => {
		await ws.createRun({ teamRunId: "run1", plan: makePlan("MED"), state: makeState("run1", "MED") });

		const state = await ws.readState("run1");
		state.status = "running";
		state.startedAt = new Date().toISOString();
		await ws.writeState(state);

		const readBack = await ws.readState("run1");
		assert.equal(readBack.status, "running");
		assert.ok(readBack.startedAt);
		// no .tmp file left behind
		assert.ok(!existsSync(join(dir, "runs", "run1", "state.json.tmp")));
	});

	it("appendEvent and readEvents work", async () => {
		await ws.createRun({ teamRunId: "run1", plan: makePlan("MED"), state: makeState("run1", "MED") });

		const evt: TeamEvent = {
			eventId: "evt_1",
			teamRunId: "run1",
			eventType: "team_run_started",
			createdAt: new Date().toISOString(),
			data: {},
		};
		await ws.appendEvent("run1", evt);

		const events = await ws.readEvents("run1");
		assert.equal(events.length, 1);
		assert.equal(events[0].eventType, "team_run_started");
	});

	it("writeArtifactText writes and readArtifactText reads back", async () => {
		await ws.createRun({ teamRunId: "run1", plan: makePlan("MED"), state: makeState("run1", "MED") });

		await ws.writeArtifactText("run1", "final_report.md", "# Report\nHello");
		const text = await ws.readArtifactText("run1", "final_report.md");
		assert.equal(text, "# Report\nHello");
	});

	it("writeArtifactText rejects ../ path traversal", async () => {
		await ws.createRun({ teamRunId: "run1", plan: makePlan("MED"), state: makeState("run1", "MED") });
		await assert.rejects(
			() => ws.writeArtifactText("run1", "../etc/passwd", "hack"),
			/path traversal/,
		);
	});

	it("writeArtifactText rejects absolute paths", async () => {
		await ws.createRun({ teamRunId: "run1", plan: makePlan("MED"), state: makeState("run1", "MED") });
		await assert.rejects(
			() => ws.writeArtifactText("run1", "/etc/passwd", "hack"),
			/absolute path/,
		);
	});

	it("cursor read/write works", async () => {
		await ws.createRun({ teamRunId: "run1", plan: makePlan("MED"), state: makeState("run1", "MED") });

		const cursor: TeamStreamCursor = {
			roleId: "evidence_collector",
			streamName: "candidate_domains",
			lastConsumedItemId: "si_5",
			updatedAt: new Date().toISOString(),
		};
		await ws.writeCursor("run1", cursor);

		const read = await ws.readCursor("run1", "evidence_collector", "candidate_domains");
		assert.ok(read);
		assert.equal(read.lastConsumedItemId, "si_5");
	});

	it("readCursor returns undefined when cursor does not exist", async () => {
		await ws.createRun({ teamRunId: "run1", plan: makePlan("MED"), state: makeState("run1", "MED") });
		const read = await ws.readCursor("run1", "evidence_collector", "candidate_domains");
		assert.equal(read, undefined);
	});

	it("listRunnableRunIds returns only queued and running runs", async () => {
		const plan = makePlan("MED");
		const s1 = makeState("run1", "MED");
		s1.status = "queued";
		await ws.createRun({ teamRunId: "run1", plan, state: s1 });

		const s2 = makeState("run2", "MED");
		s2.status = "running";
		s2.startedAt = new Date().toISOString();
		await ws.createRun({ teamRunId: "run2", plan, state: s2 });

		const s3 = makeState("run3", "MED");
		s3.status = "completed";
		s3.finishedAt = new Date().toISOString();
		await ws.createRun({ teamRunId: "run3", plan, state: s3 });

		const ids = await ws.listRunnableRunIds();
		assert.deepEqual(ids.sort(), ["run1", "run2"]);
	});

	it("readState throws clear error for corrupt JSON", async () => {
		await ws.createRun({ teamRunId: "run1", plan: makePlan("MED"), state: makeState("run1", "MED") });
		const statePath = join(dir, "runs", "run1", "state.json");
		writeFileSync(statePath, "NOT JSON");

		await assert.rejects(
			() => ws.readState("run1"),
			/Failed to parse JSON/,
		);
	});
});
