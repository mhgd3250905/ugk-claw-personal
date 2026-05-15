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

async function setup(runnerOverrides: Record<string, unknown[]> = {}) {
	const root = await mkdtemp(join(tmpdir(), "team-fail-"));
	const planStore = new PlanStore(root);
	const unitStore = new TeamUnitStore(root);
	const workspace = new RunWorkspace(root);
	const runner = new MockRoleRunner(runnerOverrides);
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
	return { root, plan, orchestrator, workspace };
}

test("first task checker fail, second task succeeds -> completed_with_failures", async () => {
	const { root, plan, orchestrator } = await setup({
		checkerOutputs: [
			{ verdict: "fail", reason: "not good", resultContent: "failed content" },
			{ verdict: "pass", reason: "ok", resultContent: "accepted" },
		],
		watcherOutputs: [
			{ decision: "confirm_failed", reason: "confirmed bad" },
			{ decision: "accept_task", reason: "ok" },
		],
	});
	try {
		const state = await orchestrator.createRun(plan.planId);
		const final = await orchestrator.runToCompletion(state.runId);
		assert.equal(final.status, "completed_with_failures");
		assert.equal(final.summary.succeededTasks, 1);
		assert.equal(final.summary.failedTasks, 1);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("checker revise loop: worker revises then passes", async () => {
	const { root, plan, orchestrator } = await setup({
		checkerOutputs: [
			{ verdict: "revise", reason: "needs work", feedback: "add more detail" },
			{ verdict: "pass", reason: "ok now", resultContent: "accepted after revision" },
			{ verdict: "pass", reason: "ok", resultContent: "accepted" },
		],
		watcherOutputs: [
			{ decision: "accept_task", reason: "ok" },
			{ decision: "accept_task", reason: "ok" },
		],
	});
	try {
		const state = await orchestrator.createRun(plan.planId);
		const final = await orchestrator.runToCompletion(state.runId);
		assert.equal(final.status, "completed");
		assert.equal(final.summary.succeededTasks, 2);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("checker revision limit exceeded -> task fails", async () => {
	const { root, plan, orchestrator } = await setup({
		checkerOutputs: [
			{ verdict: "revise", reason: "still bad" },
			{ verdict: "revise", reason: "still bad" },
			{ verdict: "revise", reason: "still bad" },
			{ verdict: "revise", reason: "still bad" },
		],
		watcherOutputs: [
			{ decision: "confirm_failed", reason: "limit exceeded" },
			{ decision: "accept_task", reason: "ok" },
		],
	});
	try {
		const state = await orchestrator.createRun(plan.planId);
		const final = await orchestrator.runToCompletion(state.runId);
		assert.equal(final.taskStates["task_1"]!.status, "failed");
	} finally {
		await rm(root, { recursive: true });
	}
});

test("watcher requests revision -> new attempt created", async () => {
	const { root, plan, orchestrator, workspace } = await setup({
		checkerOutputs: [
			{ verdict: "pass", reason: "ok", resultContent: "first pass" },
			{ verdict: "pass", reason: "ok", resultContent: "second pass" },
			{ verdict: "pass", reason: "ok", resultContent: "accepted" },
		],
		watcherOutputs: [
			{ decision: "request_revision", reason: "redo it", revisionMode: "redo", feedback: "try again" },
			{ decision: "accept_task", reason: "ok" },
			{ decision: "accept_task", reason: "ok" },
		],
	});
	try {
		const state = await orchestrator.createRun(plan.planId);
		const final = await orchestrator.runToCompletion(state.runId);
		assert.equal(final.status, "completed");
		assert.equal(final.taskStates["task_1"]!.attemptCount, 2);
	} finally {
		await rm(root, { recursive: true });
	}
});
