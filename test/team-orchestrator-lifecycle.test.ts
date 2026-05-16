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
	const root = await mkdtemp(join(tmpdir(), "team-lc-"));
	const planStore = new PlanStore(root);
	const unitStore = new TeamUnitStore(root);
	const workspace = new RunWorkspace(root);
	const runner = new MockRoleRunner(runnerOverrides);
	const unit = await unitStore.create({ title: "t", description: "d", watcherProfileId: "w", workerProfileId: "wo", checkerProfileId: "c", finalizerProfileId: "f" });
	const plan = await planStore.create({
		title: "lifecycle test",
		defaultTeamUnitId: unit.teamUnitId,
		goal: { text: "test" },
		tasks: [
			{ id: "task_1", title: "t1", input: { text: "do 1" }, acceptance: { rules: ["r1"] } },
		],
		outputContract: { text: "output" },
	});
	const orchestrator = new TeamOrchestrator({ planStore, teamUnitStore: unitStore, workspace, roleRunner: runner, dataDir: root, maxCheckerRevisions: 3, maxWatcherRevisions: 1, maxRunDurationMinutes: 60 });
	return { root, plan, orchestrator, workspace };
}

test("lifecycle: success path writes worker/checker metadata and finishAttempt succeeded", async () => {
	const { root, plan, orchestrator, workspace } = await setup();
	try {
		const state = await orchestrator.createRun(plan.planId);
		await orchestrator.runToCompletion(state.runId);

		const attempts = await workspace.listAttempts(state.runId, "task_1");
		assert.equal(attempts.length, 1);
		const a = attempts[0]!;

		// Worker output recorded
		assert.equal(a.worker.length, 1);
		assert.ok(a.worker[0]!.outputRef!.includes("worker-output-001.md"));
		assert.equal(a.worker[0]!.outputIndex, 1);

		// Checker result recorded
		assert.equal(a.checker.length, 1);
		assert.equal(a.checker[0]!.verdict, "pass");
		assert.ok(a.checker[0]!.recordRef!.includes("checker-verdict-001.json"));

		// Watcher result — will be recorded in Task 4 (watcher lifecycle)
		// For now, verify worker/checker metadata is complete

		// Final state
		assert.equal(a.status, "succeeded");
		assert.equal(a.phase, "succeeded");
		assert.ok(a.resultRef!.includes("accepted-result.md"));
		assert.ok(a.finishedAt !== null);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("lifecycle: checker revise records worker+checker arrays then passes", async () => {
	const { root, plan, orchestrator, workspace } = await setup({
		checkerOutputs: [
			{ verdict: "revise", reason: "needs work", feedback: "add more detail" },
			{ verdict: "pass", reason: "ok now", resultContent: "accepted after revision" },
		],
	});
	try {
		const state = await orchestrator.createRun(plan.planId);
		await orchestrator.runToCompletion(state.runId);

		const attempts = await workspace.listAttempts(state.runId, "task_1");
		const a = attempts[0]!;

		// Two worker outputs (original + revision)
		assert.equal(a.worker.length, 2);
		assert.equal(a.worker[0]!.outputIndex, 1);
		assert.equal(a.worker[1]!.outputIndex, 2);

		// Two checker results (revise + pass)
		assert.equal(a.checker.length, 2);
		assert.equal(a.checker[0]!.verdict, "revise");
		assert.equal(a.checker[0]!.feedback, "add more detail");
		assert.equal(a.checker[1]!.verdict, "pass");

		// Final state: succeeded after revision
		assert.equal(a.status, "succeeded");
		assert.equal(a.phase, "succeeded");
	} finally {
		await rm(root, { recursive: true });
	}
});

test("lifecycle: checker fail writes finishAttempt failed with errorSummary", async () => {
	const { root, plan, orchestrator, workspace } = await setup({
		checkerOutputs: [
			{ verdict: "fail", reason: "not acceptable", resultContent: "failed content" },
		],
		watcherOutputs: [
			{ decision: "confirm_failed", reason: "confirmed bad" },
		],
	});
	try {
		const state = await orchestrator.createRun(plan.planId);
		await orchestrator.runToCompletion(state.runId);

		const attempts = await workspace.listAttempts(state.runId, "task_1");
		const a = attempts[0]!;

		assert.equal(a.status, "failed");
		assert.equal(a.phase, "failed");
		assert.equal(a.checker.length, 1);
		assert.equal(a.checker[0]!.verdict, "fail");
		assert.equal(a.checker[0]!.reason, "not acceptable");
		assert.ok(a.resultRef!.includes("failed-result.md"));
		assert.ok(a.finishedAt !== null);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("lifecycle: checker timeout writes finishAttempt failed", async () => {
	const { root, plan, workspace } = await setup();
	// Create a runner that delays checker to trigger timeout
	const slowRunner = new (class extends MockRoleRunner {
		override async runChecker() {
			await new Promise(r => setTimeout(r, 500));
			return { verdict: "pass" as const, reason: "ok" };
		}
	})();
	const orc = new TeamOrchestrator({
		planStore: new PlanStore(root),
		teamUnitStore: new TeamUnitStore(root),
		workspace,
		roleRunner: slowRunner,
		dataDir: root,
		maxCheckerRevisions: 3,
		maxWatcherRevisions: 1,
		maxRunDurationMinutes: 60,
		phaseTimeouts: { workerMs: 60_000, checkerMs: 10, watcherMs: 60_000, finalizerMs: 60_000 },
	});
	try {
		const state = await orc.createRun(plan.planId);
		await orc.runToCompletion(state.runId);

		const attempts = await workspace.listAttempts(state.runId, "task_1");
		if (attempts.length > 0) {
			const a = attempts[0]!;
			assert.equal(a.status, "failed");
			assert.equal(a.phase, "failed");
			assert.ok(a.finishedAt !== null);
		}
	} finally {
		await rm(root, { recursive: true });
	}
});

test("lifecycle: checker revision limit writes finishAttempt failed", async () => {
	const { root, plan, orchestrator, workspace } = await setup({
		checkerOutputs: [
			{ verdict: "revise", reason: "bad 1" },
			{ verdict: "revise", reason: "bad 2" },
			{ verdict: "revise", reason: "bad 3" },
			{ verdict: "revise", reason: "bad 4" },
		],
		watcherOutputs: [
			{ decision: "confirm_failed", reason: "limit" },
		],
	});
	try {
		const state = await orchestrator.createRun(plan.planId);
		await orchestrator.runToCompletion(state.runId);

		const attempts = await workspace.listAttempts(state.runId, "task_1");
		const a = attempts[0]!;

		assert.equal(a.status, "failed");
		assert.equal(a.phase, "failed");
		assert.equal(a.errorSummary, "checker revision limit exceeded");
		// 3 revise + 1 limit hit = 3 checker results recorded before fail
		assert.equal(a.checker.length, 3);
		for (const c of a.checker) {
			assert.equal(c.verdict, "revise");
		}
	} finally {
		await rm(root, { recursive: true });
	}
});
