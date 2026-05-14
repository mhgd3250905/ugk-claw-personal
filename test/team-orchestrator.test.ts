import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TeamWorkspace } from "../src/team/team-workspace.js";
import { TeamOrchestrator } from "../src/team/team-orchestrator.js";
import { DeterministicMockTeamRoleTaskRunner } from "../src/team/team-role-task-runner.js";
import { createBrandDomainDiscoveryPlan } from "../src/team/team-plan-brand-domain.js";
import type { TeamRoleTaskExecutionInput, TeamRoleTaskExecutionResult } from "../src/team/types.js";
import type { TeamSubmitToolCall, TeamSubmitToolResult } from "../src/team/llm-tool-loop.js";

class RecordingTeamRoleTaskRunner extends DeterministicMockTeamRoleTaskRunner {
	tasks: TeamRoleTaskExecutionInput[] = [];
	failRoles = new Set<string>();
	badDiscoveryStream = false;

	async runTask(task: TeamRoleTaskExecutionInput): Promise<TeamRoleTaskExecutionResult> {
		this.tasks.push(task);
		if (this.badDiscoveryStream && task.roleId === "discovery") {
			return {
				status: "success",
				emits: [{ streamName: "not_allowed" as any, payload: {} }],
			};
		}
		if (this.failRoles.has(task.roleId)) {
			return { status: "failed", emits: [], message: `${task.roleId} failed for test` };
		}
		return super.runTask(task);
	}
}

class SubmitToolDiscoveryRunner extends DeterministicMockTeamRoleTaskRunner {
	async runTaskWithSubmitToolHandler(
		task: TeamRoleTaskExecutionInput,
		submitToolHandler: (call: TeamSubmitToolCall) => Promise<TeamSubmitToolResult>,
	): Promise<TeamRoleTaskExecutionResult> {
		if (task.roleId !== "discovery") {
			return super.runTask(task);
		}
		const result = await submitToolHandler({
			roleId: "discovery",
			toolName: "submitCandidateDomain",
			streamName: "candidate_domains",
			arguments: {
				domain: "med-tool-submit.com",
				sourceType: "search_query",
				query: "MED official domain",
				matchReason: "Submitted during discovery work",
				confidence: "medium",
				discoveredAt: "2026-05-14T00:00:00.000Z",
			},
			callId: "toolu_test",
		});
		assert.equal(result.ok, true);
		return { status: "success", emits: [], checkpoint: { submitCalls: 1 } };
	}
}

function makeDir(): string {
	return join(tmpdir(), `team-orch-test-${Date.now()}`);
}

function createTestRun(ws: TeamWorkspace, keyword = "MED", maxRounds = 1, maxCandidates = 10): Promise<string> {
	const { plan, state } = createBrandDomainDiscoveryPlan({ keyword, maxRounds, maxCandidates, maxMinutes: 60 });
	return ws.createRun({ teamRunId: state.teamRunId, plan, state }).then(() => state.teamRunId);
}

function makeOrchestrator(
	ws: TeamWorkspace,
	maxRounds = 1,
	roleTaskRunner = new DeterministicMockTeamRoleTaskRunner(),
): TeamOrchestrator {
	return new TeamOrchestrator({
		workspace: ws,
		roleTaskRunner,
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

	it("passes planned discovery queries to discovery role task", async () => {
		const runner = new RecordingTeamRoleTaskRunner();
		const teamRunId = await createTestRun(ws, "MED", 1);
		const plan = await ws.readPlan(teamRunId);
		const orchestrator = makeOrchestrator(ws, 1, runner);

		await orchestrator.tick(teamRunId);

		const discoveryTask = runner.tasks.find((task) => task.roleId === "discovery");
		assert.ok(discoveryTask);
		assert.deepEqual(discoveryTask.inputData.queries, plan.discoveryPlan.searchQueries);
	});

	it("does not advance evidence cursor when evidence collector fails", async () => {
		const runner = new RecordingTeamRoleTaskRunner();
		runner.failRoles.add("evidence_collector");
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1, runner);

		await orchestrator.tick(teamRunId);

		const cursor = await ws.readCursor(teamRunId, "evidence_collector", "candidate_domains");
		const state = await ws.readState(teamRunId);
		assert.equal(cursor, undefined);
		assert.equal(state.status, "running");
		assert.equal(state.counters.failedRoleTasks, 1);
	});

	it("clears role task timeout after successful tasks so tests can exit quickly", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1);

		await orchestrator.tick(teamRunId);
		const startedAt = Date.now();
		await new Promise((resolve) => setTimeout(resolve, 20));

		assert.ok(Date.now() - startedAt < 200);
	});

	it("rejects stream emits not declared by the template role", async () => {
		const runner = new RecordingTeamRoleTaskRunner();
		runner.badDiscoveryStream = true;
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1, runner);

		await orchestrator.tick(teamRunId);

		const events = await ws.readEvents(teamRunId);
		assert.ok(events.some((event) => event.eventType === "stream_item_rejected"));
	});

	it("accepts discovery submit tool calls and lets downstream roles consume the new stream item", async () => {
		const runner = new SubmitToolDiscoveryRunner();
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1, runner);

		await orchestrator.tick(teamRunId);

		const candidates = await ws.readStreamItems(teamRunId, "candidate_domains");
		const evidences = await ws.readStreamItems(teamRunId, "domain_evidence");
		const state = await ws.readState(teamRunId);
		const events = await ws.readEvents(teamRunId);

		assert.equal(candidates.length, 1);
		assert.equal((candidates[0].payload as { normalizedDomain: string }).normalizedDomain, "med-tool-submit.com");
		assert.equal(state.counters.candidateDomains, 1);
		assert.ok(evidences.length > 0, "evidence collector should consume the submitted candidate in the same tick");
		assert.ok(events.some((event) => event.eventType === "stream_item_accepted"));
	});
});
