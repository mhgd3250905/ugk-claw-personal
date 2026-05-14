import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TeamWorkspace } from "../src/team/team-workspace.js";
import { TeamOrchestrator } from "../src/team/team-orchestrator.js";
import { DeterministicMockTeamRoleTaskRunner } from "../src/team/team-role-task-runner.js";
import { createBrandDomainDiscoveryPlan } from "../src/team/team-plan-brand-domain.js";


function makeDir(): string {
	return join(tmpdir(), `team-orch-test-${Date.now()}`);
}

function createTestRun(ws: TeamWorkspace, keyword = "MED", maxRounds = 1): Promise<string> {
	const { plan, state } = createBrandDomainDiscoveryPlan({ keyword, maxRounds, maxCandidates: 10, maxMinutes: 60 });
	return ws.createRun({ teamRunId: state.teamRunId, plan, state }).then(() => state.teamRunId);
}

function makeOrchestrator(ws: TeamWorkspace, maxRounds = 1): TeamOrchestrator {
	return new TeamOrchestrator({
		workspace: ws,
		roleTaskRunner: new DeterministicMockTeamRoleTaskRunner(),
		maxRounds,
		maxCandidates: 10,
		maxMinutes: 60,
		roleTaskTimeoutMs: 180000,
		roleTaskMaxRetries: 1,
	});
}

describe("TeamOrchestrator", () => {
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

	it("queued run becomes running then completed with maxRounds=1", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1);

		await orchestrator.tick(teamRunId);
		const state = await ws.readState(teamRunId);
		assert.equal(state.status, "completed");
		assert.ok(state.startedAt);
	});

	it("produces candidate_domains from discovery", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1);

		await orchestrator.tick(teamRunId);
		const candidates = await ws.readStreamItems(teamRunId, "candidate_domains");
		assert.ok(candidates.length > 0);
	});

	it("runs full pipeline to completed with final report", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1);

		await orchestrator.tick(teamRunId);

		const state = await ws.readState(teamRunId);
		assert.equal(state.status, "completed");
		assert.ok(state.finishedAt);

		const candidates = await ws.readStreamItems(teamRunId, "candidate_domains");
		const evidences = await ws.readStreamItems(teamRunId, "domain_evidence");
		const classifications = await ws.readStreamItems(teamRunId, "domain_classifications");
		const reviews = await ws.readStreamItems(teamRunId, "review_findings");

		assert.ok(candidates.length > 0, "should have candidates");
		assert.ok(evidences.length > 0, "should have evidences");
		assert.ok(classifications.length > 0, "should have classifications");
		assert.ok(reviews.length > 0, "should have reviews");

		const report = await ws.readArtifactText(teamRunId, "final_report.md");
		assert.ok(report.includes("MED"));
		assert.ok(report.includes("Summary"));
	});

	it("does not run more discovery after maxRounds", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1);

		await orchestrator.tick(teamRunId);
		const state = await ws.readState(teamRunId);
		assert.equal(state.currentRound, 1);

		// Second tick should be no-op
		await orchestrator.tick(teamRunId);
		const state2 = await ws.readState(teamRunId);
		assert.equal(state2.currentRound, 1);
		assert.equal(state2.status, "completed");
	});

	it("already completed run is a no-op", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1);

		await orchestrator.tick(teamRunId);
		const state1 = await ws.readState(teamRunId);
		assert.equal(state1.status, "completed");

		await orchestrator.tick(teamRunId);
		const state2 = await ws.readState(teamRunId);
		assert.equal(state2.status, "completed");
		assert.equal(state2.finishedAt, state1.finishedAt);
	});

	it("events are recorded for each phase", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1);

		await orchestrator.tick(teamRunId);
		const events = await ws.readEvents(teamRunId);
		const types = events.map((e) => e.eventType);

		assert.ok(types.includes("team_run_started"), "should have team_run_started");
		assert.ok(types.includes("role_task_started"), "should have role_task_started");
		assert.ok(types.includes("stream_item_accepted"), "should have stream_item_accepted");
		assert.ok(types.includes("team_run_completed"), "should have team_run_completed");
		assert.ok(types.includes("final_report_created"), "should have final_report_created");
	});

	it("counters are updated correctly", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1);

		await orchestrator.tick(teamRunId);
		const state = await ws.readState(teamRunId);

		assert.ok(state.counters.candidateDomains > 0);
		assert.ok(state.counters.domainEvidence > 0);
		assert.ok(state.counters.classifications > 0);
		assert.ok(state.counters.reviewFindings > 0);
	});

	it("multi-round run progresses across ticks", async () => {
		const teamRunId = await createTestRun(ws, "MED", 2);
		const orchestrator = makeOrchestrator(ws, 2);

		// First tick: run discovery round 1, downstream may not all fire yet
		await orchestrator.tick(teamRunId);
		let state = await ws.readState(teamRunId);
		assert.equal(state.status, "running");
		assert.equal(state.currentRound, 1);

		// Second tick: run discovery round 2, then finalize
		await orchestrator.tick(teamRunId);
		state = await ws.readState(teamRunId);
		assert.equal(state.status, "completed");
		assert.equal(state.currentRound, 2);
	});
});
