import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TeamWorkspace } from "../src/team/team-workspace.js";
import { TeamOrchestrator } from "../src/team/team-orchestrator.js";
import { DeterministicMockTeamRoleTaskRunner } from "../src/team/team-role-task-runner.js";
import { createBrandDomainDiscoveryPlan } from "../src/team/team-plan-brand-domain.js";
import type { TeamRoleProfileBindings, TeamRolePromptOverrides, TeamRoleTaskExecutionInput, TeamRoleTaskExecutionResult } from "../src/team/types.js";
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

class BlockingSubmitToolDiscoveryRunner extends DeterministicMockTeamRoleTaskRunner {
	constructor(
		private onSubmitted: () => void,
		private release: Promise<void>,
	) {
		super();
	}

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
				domain: "med-live-submit.com",
				sourceType: "search_query",
				query: "MED official domain",
				matchReason: "Submitted during discovery work",
				confidence: "medium",
				discoveredAt: "2026-05-14T00:00:00.000Z",
			},
			callId: "toolu_live",
		});
		assert.equal(result.ok, true);
		this.onSubmitted();
		await this.release;
		return { status: "success", emits: [], checkpoint: { submitCalls: 1 } };
	}
}

class BlockingDiscoveryThenEvidenceRunner extends DeterministicMockTeamRoleTaskRunner {
	tasks: TeamRoleTaskExecutionInput[] = [];

	constructor(
		private onSubmitted: () => void,
		private release: Promise<void>,
	) {
		super();
	}

	async runTaskWithSubmitToolHandler(
		task: TeamRoleTaskExecutionInput,
		submitToolHandler: (call: TeamSubmitToolCall) => Promise<TeamSubmitToolResult>,
	): Promise<TeamRoleTaskExecutionResult> {
		this.tasks.push(task);
		if (task.roleId !== "discovery") {
			return super.runTask(task);
		}
		const result = await submitToolHandler({
			roleId: "discovery",
			toolName: "submitCandidateDomain",
			streamName: "candidate_domains",
			arguments: {
				domain: "med-pipeline-submit.com",
				sourceType: "search_query",
				query: "MED official domain",
				matchReason: "Submitted while discovery is still running",
				confidence: "medium",
				discoveredAt: "2026-05-14T00:00:00.000Z",
			},
			callId: "toolu_pipeline",
		});
		assert.equal(result.ok, true);
		this.onSubmitted();
		await this.release;
		return { status: "success", emits: [], checkpoint: { submitCalls: 1 } };
	}
}

class FinalizerReportRunner extends DeterministicMockTeamRoleTaskRunner {
	async runTask(task: TeamRoleTaskExecutionInput): Promise<TeamRoleTaskExecutionResult> {
		if (task.roleId === "finalizer") {
			assert.ok(task.inputData.streams);
			assert.ok(task.inputData.streamCounts);
			return {
				status: "success",
				emits: [],
				checkpoint: {},
				finalReportMarkdown: "# Agent 写出的中文报告\n\n## 摘要\n- finalizer 已接管。",
			};
		}
		return super.runTask(task);
	}
}

function makeDir(): string {
	return join(tmpdir(), `team-orch-test-${Date.now()}`);
}

function createTestRun(
	ws: TeamWorkspace,
	keyword = "MED",
	maxRounds = 1,
	maxCandidates = 10,
	roleProfileIds?: TeamRoleProfileBindings,
	rolePromptOverrides?: TeamRolePromptOverrides,
): Promise<string> {
	const { plan, state } = createBrandDomainDiscoveryPlan({ keyword, maxRounds, maxCandidates, maxMinutes: 60, roleProfileIds, rolePromptOverrides });
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

async function tickUntilCompleted(
	ws: TeamWorkspace,
	orchestrator: TeamOrchestrator,
	teamRunId: string,
	maxTicks = 10,
) {
	for (let i = 0; i < maxTicks; i++) {
		await orchestrator.tick(teamRunId);
		const state = await ws.readState(teamRunId);
		if (state.status === "completed") {
			return state;
		}
	}
	return ws.readState(teamRunId);
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

		const state = await tickUntilCompleted(ws, orchestrator, teamRunId);
		assert.equal(state.status, "completed");
		assert.ok(state.startedAt);
	});

	it("produces candidate_domains from discovery", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1);

		await tickUntilCompleted(ws, orchestrator, teamRunId);
		const candidates = await ws.readStreamItems(teamRunId, "candidate_domains");
		assert.ok(candidates.length > 0);
	});

	it("runs full pipeline to completed with final report", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1);

		const state = await tickUntilCompleted(ws, orchestrator, teamRunId);
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
		assert.ok(report.includes("摘要"));
	});

	it("does not run more discovery after maxRounds", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1);

		await orchestrator.tick(teamRunId);
		const state = await ws.readState(teamRunId);
		assert.equal(state.currentRound, 1);

		await tickUntilCompleted(ws, orchestrator, teamRunId);
		const state2 = await ws.readState(teamRunId);
		assert.equal(state2.currentRound, 1);
		assert.equal(state2.status, "completed");
	});

	it("already completed run is a no-op", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1);

		const state1 = await tickUntilCompleted(ws, orchestrator, teamRunId);
		assert.equal(state1.status, "completed");

		await orchestrator.tick(teamRunId);
		const state2 = await ws.readState(teamRunId);
		assert.equal(state2.status, "completed");
		assert.equal(state2.finishedAt, state1.finishedAt);
	});

	it("events are recorded for each phase", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1);

		await tickUntilCompleted(ws, orchestrator, teamRunId);
		const events = await ws.readEvents(teamRunId);
		const types = events.map((e) => e.eventType);

		assert.ok(types.includes("team_run_started"), "should have team_run_started");
		assert.ok(types.includes("role_task_started"), "should have role_task_started");
		assert.ok(types.includes("stream_item_accepted"), "should have stream_item_accepted");
		assert.ok(types.includes("team_run_completed"), "should have team_run_completed");
		assert.ok(types.includes("final_report_created"), "should have final_report_created");
		assert.ok(events.some((event) =>
			event.eventType === "role_task_started" &&
			(event.data as { roleId?: string; consumes?: { itemCount?: number; domains?: string[] } }).roleId === "evidence_collector" &&
			(event.data as { consumes?: { itemCount?: number; domains?: string[] } }).consumes?.itemCount === 1 &&
			((event.data as { consumes?: { domains?: string[] } }).consumes?.domains ?? []).length === 1,
		));
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

		state = await tickUntilCompleted(ws, orchestrator, teamRunId);
		assert.equal(state.status, "completed");
		assert.equal(state.currentRound, 2);
	});

	it("passes planned discovery queries to discovery role task", async () => {
		const runner = new RecordingTeamRoleTaskRunner();
		const teamRunId = await createTestRun(ws, "MED", 1);
		const plan = await ws.readPlan(teamRunId);
		const orchestrator = makeOrchestrator(ws, 1, runner);

		await tickUntilCompleted(ws, orchestrator, teamRunId);

		const discoveryTask = runner.tasks.find((task) => task.roleId === "discovery");
		assert.ok(discoveryTask);
		assert.deepEqual(discoveryTask.inputData.queries, plan.discoveryPlan.searchQueries);
	});

	it("passes role profile bindings into role task inputs", async () => {
		const runner = new RecordingTeamRoleTaskRunner();
		const roleProfileIds: TeamRoleProfileBindings = {
			discovery: "DiscoveryAgent",
			evidence_collector: "EvidenceAgent",
			classifier: "ClassifierAgent",
			reviewer: "ReviewerAgent",
			finalizer: "FinalizerAgent",
		};
		const teamRunId = await createTestRun(ws, "MED", 1, 10, roleProfileIds);
		const orchestrator = makeOrchestrator(ws, 1, runner);

		await tickUntilCompleted(ws, orchestrator, teamRunId);

		const discoveryTask = runner.tasks.find((task) => task.roleId === "discovery");
		const evidenceTask = runner.tasks.find((task) => task.roleId === "evidence_collector");
		const classifierTask = runner.tasks.find((task) => task.roleId === "classifier");
		const reviewerTask = runner.tasks.find((task) => task.roleId === "reviewer");
		const finalizerTask = runner.tasks.find((task) => task.roleId === "finalizer");
		const events = await ws.readEvents(teamRunId);
		assert.ok(discoveryTask);
		assert.equal(discoveryTask.profileId, "DiscoveryAgent");
		assert.equal(discoveryTask.inputData.roleProfileId, "DiscoveryAgent");
		assert.equal(evidenceTask?.profileId, "EvidenceAgent");
		assert.equal(classifierTask?.profileId, "ClassifierAgent");
		assert.equal(reviewerTask?.profileId, "ReviewerAgent");
		assert.equal(finalizerTask?.profileId, "FinalizerAgent");
		assert.ok(events.some((event) =>
			event.eventType === "role_task_started" &&
			(event.data as { profileId?: string }).profileId === "DiscoveryAgent",
		));
		assert.ok(events.some((event) =>
			event.eventType === "role_task_started" &&
			(event.data as { profileId?: string }).profileId === "FinalizerAgent",
		));
	});

	it("passes editable role prompt overrides into role task inputs", async () => {
		const runner = new RecordingTeamRoleTaskRunner();
		const rolePromptOverrides: TeamRolePromptOverrides = {
			discovery: "自定义 discovery prompt",
			classifier: "自定义 classifier prompt",
			finalizer: "自定义 finalizer prompt",
		};
		const teamRunId = await createTestRun(ws, "MED", 1, 10, undefined, rolePromptOverrides);
		const orchestrator = makeOrchestrator(ws, 1, runner);

		await tickUntilCompleted(ws, orchestrator, teamRunId);

		const discoveryTask = runner.tasks.find((task) => task.roleId === "discovery");
		const classifierTask = runner.tasks.find((task) => task.roleId === "classifier");
		const finalizerTask = runner.tasks.find((task) => task.roleId === "finalizer");
		assert.equal(discoveryTask?.inputData.rolePromptOverride, "自定义 discovery prompt");
		assert.equal(classifierTask?.inputData.rolePromptOverride, "自定义 classifier prompt");
		assert.equal(finalizerTask?.inputData.rolePromptOverride, "自定义 finalizer prompt");
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

	it("persists running status and counters while a submit-tool role task is still active", async () => {
		let resolveSubmitted!: () => void;
		let resolveRelease!: () => void;
		const submitted = new Promise<void>((resolve) => { resolveSubmitted = resolve; });
		const release = new Promise<void>((resolve) => { resolveRelease = resolve; });
		const runner = new BlockingSubmitToolDiscoveryRunner(resolveSubmitted, release);
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1, runner);

		const tickPromise = orchestrator.tick(teamRunId);
		await submitted;

		const state = await ws.readState(teamRunId);
		assert.equal(state.status, "running");
		assert.equal(state.currentRound, 1);
		assert.equal(state.counters.candidateDomains, 1);

		resolveRelease();
		await tickPromise;
	});

	it("lets evidence consume submitted candidates while discovery is still running", async () => {
		let resolveSubmitted!: () => void;
		let resolveRelease!: () => void;
		const submitted = new Promise<void>((resolve) => { resolveSubmitted = resolve; });
		const release = new Promise<void>((resolve) => { resolveRelease = resolve; });
		const runner = new BlockingDiscoveryThenEvidenceRunner(resolveSubmitted, release);
		const teamRunId = await createTestRun(ws, "MED", 1, 10, { discovery: "DiscoveryAgent" });
		const orchestrator = makeOrchestrator(ws, 1, runner);

		await orchestrator.tick(teamRunId);
		await submitted;
		await orchestrator.tick(teamRunId);

		const evidences = await ws.readStreamItems(teamRunId, "domain_evidence");
		const state = await ws.readState(teamRunId);
		assert.equal(evidences.length, 1);
		assert.equal(state.activeRoleTasks?.discovery?.status, "running");
		assert.ok(runner.tasks.some((task) => task.roleId === "evidence_collector"));

		resolveRelease();
		await new Promise((resolve) => setTimeout(resolve, 0));
		await orchestrator.tick(teamRunId);
	});

	it("watchdog marks an active role stale only when its heartbeat is older than the idle timeout", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const state = await ws.readState(teamRunId);
		state.status = "running";
		state.startedAt = new Date().toISOString();
		state.activeRoleTasks = {
			discovery: {
				roleTaskId: "rt_stale",
				roleId: "discovery",
				status: "running",
				startedAt: new Date(Date.now() - 10_000).toISOString(),
				updatedAt: new Date(Date.now() - 10_000).toISOString(),
				lastHeartbeatAt: new Date(Date.now() - 10_000).toISOString(),
				profileId: "DiscoveryAgent",
				outputCount: 2,
			},
		};
		await ws.writeState(state);
		const orchestrator = new TeamOrchestrator({
			workspace: ws,
			roleTaskRunner: new DeterministicMockTeamRoleTaskRunner(),
			maxRounds: 1,
			maxCandidates: 10,
			maxMinutes: 60,
			roleTaskTimeoutMs: 1,
			roleTaskMaxRetries: 0,
		});

		await orchestrator.tick(teamRunId);

		const updatedState = await ws.readState(teamRunId);
		const events = await ws.readEvents(teamRunId);
		assert.equal(updatedState.activeRoleTasks, undefined);
		assert.equal(updatedState.counters.failedRoleTasks, 1);
		assert.ok(events.some((event) =>
			event.eventType === "role_task_watchdog" &&
			(event.data as { reason?: string }).reason === "no heartbeat for 1ms",
		));
	});

	it("watchdog treats active session writes as role heartbeat", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const state = await ws.readState(teamRunId);
		state.status = "running";
		state.startedAt = new Date().toISOString();
		state.activeRoleTasks = {
			discovery: {
				roleTaskId: "rt_session_alive",
				roleId: "discovery",
				status: "running",
				startedAt: new Date(Date.now() - 10_000).toISOString(),
				updatedAt: new Date(Date.now() - 10_000).toISOString(),
				lastHeartbeatAt: new Date(Date.now() - 10_000).toISOString(),
				profileId: "DiscoveryAgent",
				outputCount: 0,
			},
		};
		await ws.writeState(state);
		const sessionDir = join(ws.getRunDir(teamRunId), "agent-workspaces", "rt_session_alive", "session");
		mkdirSync(sessionDir, { recursive: true });
		writeFileSync(join(sessionDir, "alive.jsonl"), JSON.stringify({ type: "message" }) + "\n");
		const orchestrator = new TeamOrchestrator({
			workspace: ws,
			roleTaskRunner: new DeterministicMockTeamRoleTaskRunner(),
			maxRounds: 1,
			maxCandidates: 10,
			maxMinutes: 60,
			roleTaskTimeoutMs: 60_000,
			roleTaskMaxRetries: 0,
		});

		await orchestrator.tick(teamRunId);

		const updatedState = await ws.readState(teamRunId);
		assert.equal(updatedState.activeRoleTasks?.discovery?.status, "running");
	});

	it("writes the finalizer agent markdown as final_report.md", async () => {
		const teamRunId = await createTestRun(ws, "MED", 1);
		const orchestrator = makeOrchestrator(ws, 1, new FinalizerReportRunner());

		await tickUntilCompleted(ws, orchestrator, teamRunId);

		const report = await ws.readArtifactText(teamRunId, "final_report.md");
		assert.equal(report, "# Agent 写出的中文报告\n\n## 摘要\n- finalizer 已接管。");
	});
});
