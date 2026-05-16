import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TeamOrchestrator } from "../src/team/orchestrator.js";
import { PlanStore } from "../src/team/plan-store.js";
import { TeamUnitStore } from "../src/team/team-unit-store.js";
import { RunWorkspace } from "../src/team/run-workspace.js";
import { MockRoleRunner } from "../src/team/role-runner.js";

async function setup() {
	const root = await mkdtemp(join(tmpdir(), "team-orch-"));
	const planStore = new PlanStore(root);
	const unitStore = new TeamUnitStore(root);
	const workspace = new RunWorkspace(root);
	const runner = new MockRoleRunner();
	const unit = await unitStore.create({ title: "t", description: "d", watcherProfileId: "w", workerProfileId: "wo", checkerProfileId: "c", finalizerProfileId: "f" });
	const plan = await planStore.create({
		title: "two tasks",
		defaultTeamUnitId: unit.teamUnitId,
		goal: { text: "test" },
		tasks: [
			{ id: "task_1", title: "t1", input: { text: "do 1" }, acceptance: { rules: ["r1"] } },
			{ id: "task_2", title: "t2", input: { text: "do 2" }, acceptance: { rules: ["r2"] } },
		],
		outputContract: { text: "output" },
	});
	const orchestrator = new TeamOrchestrator({ planStore, teamUnitStore: unitStore, workspace, roleRunner: runner, dataDir: root, maxCheckerRevisions: 3, maxWatcherRevisions: 1, maxRunDurationMinutes: 60 });
	return { root, plan, orchestrator, workspace, planStore, unitStore };
}

test("orchestrator: two tasks run sequentially to completed", async () => {
	const { root, plan, orchestrator } = await setup();
	try {
		const state = await orchestrator.createRun(plan.planId);
		assert.equal(state.status, "queued");

		const final = await orchestrator.runToCompletion(state.runId);
		assert.equal(final.status, "completed");
		assert.equal(final.summary.totalTasks, 2);
		assert.equal(final.summary.succeededTasks, 2);
		assert.equal(final.summary.failedTasks, 0);
		assert.ok(final.finishedAt);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("orchestrator: creates attempts for each task", async () => {
	const { root, plan, orchestrator, workspace } = await setup();
	try {
		const state = await orchestrator.createRun(plan.planId);
		await orchestrator.runToCompletion(state.runId);
		const final = await workspace.getState(state.runId);
		assert.equal(final!.taskStates["task_1"]!.attemptCount, 1);
		assert.equal(final!.taskStates["task_2"]!.attemptCount, 1);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("orchestrator: final report written", async () => {
	const { root, plan, orchestrator, workspace } = await setup();
	try {
		const state = await orchestrator.createRun(plan.planId);
		await orchestrator.runToCompletion(state.runId);
		const { readFile } = await import("node:fs/promises");
		const report = await readFile(join(root, "runs", state.runId, "final-report.md"), "utf8");
		assert.match(report, /# 最终汇总/);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("orchestrator: second run fails when active run exists", async () => {
	const { root, plan, orchestrator } = await setup();
	try {
		await orchestrator.createRun(plan.planId);
		await assert.rejects(() => orchestrator.createRun(plan.planId), { message: "active run limit reached" });
	} finally {
		await rm(root, { recursive: true });
	}
});

test("orchestrator: maxConcurrentRuns=2 allows two queued runs", async () => {
	const { root, plan, unitStore, planStore, workspace } = await setup();
	const orchestrator = new TeamOrchestrator({ planStore, teamUnitStore: unitStore, workspace, roleRunner: new MockRoleRunner(), dataDir: root, maxCheckerRevisions: 3, maxWatcherRevisions: 1, maxRunDurationMinutes: 60, maxConcurrentRuns: 2 });
	try {
		const first = await orchestrator.createRun(plan.planId);
		assert.equal(first.status, "queued");

		const second = await orchestrator.createRun(plan.planId);
		assert.equal(second.status, "queued");
		assert.notEqual(second.runId, first.runId);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("orchestrator: maxConcurrentRuns=2, third run rejects", async () => {
	const { root, plan, unitStore, planStore, workspace } = await setup();
	const orchestrator = new TeamOrchestrator({ planStore, teamUnitStore: unitStore, workspace, roleRunner: new MockRoleRunner(), dataDir: root, maxCheckerRevisions: 3, maxWatcherRevisions: 1, maxRunDurationMinutes: 60, maxConcurrentRuns: 2 });
	try {
		await orchestrator.createRun(plan.planId);
		await orchestrator.createRun(plan.planId);

		await assert.rejects(
			() => orchestrator.createRun(plan.planId),
			{ message: "active run limit reached" },
		);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("orchestrator: completed previous run does not block new run", async () => {
	const { root, plan, orchestrator } = await setup();
	try {
		const state = await orchestrator.createRun(plan.planId);
		state.status = "completed";
		state.finishedAt = new Date().toISOString();
		await (await import("node:fs/promises")).writeFile(
			join(root, "runs", state.runId, "state.json"),
			JSON.stringify(state, null, 2),
		);

		const second = await orchestrator.createRun(plan.planId);
		assert.equal(second.status, "queued");
	} finally {
		await rm(root, { recursive: true });
	}
});

test("orchestrator: runNextQueued returns null when nothing queued", async () => {
	const { root, orchestrator } = await setup();
	try {
		const result = await orchestrator.runNextQueued();
		assert.equal(result, null);
	} finally {
		await rm(root, { recursive: true });
	}
});
