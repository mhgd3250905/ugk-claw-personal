import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RunWorkspace } from "../src/team/run-workspace.js";
import type { TeamPlan } from "../src/team/types.js";

const plan: TeamPlan = {
	schemaVersion: "team/plan-1",
	planId: "plan_test",
	title: "test",
	defaultTeamUnitId: "team_1",
	goal: { text: "test goal" },
	tasks: [
		{ id: "task_1", title: "t1", input: { text: "do t1" }, acceptance: { rules: ["rule1"] } },
		{ id: "task_2", title: "t2", input: { text: "do t2" }, acceptance: { rules: ["rule2"] } },
	],
	outputContract: { text: "output" },
	archived: false,
	createdAt: "",
	updatedAt: "",
	runCount: 0,
};

test("createRun copies plan.json and initializes state", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ws-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRun(plan, "team_1");
		assert.ok(state.runId.startsWith("run_"));
		assert.equal(state.status, "queued");
		assert.equal(state.planId, "plan_test");
		assert.equal(state.teamUnitId, "team_1");
		assert.equal(state.summary.totalTasks, 2);
		assert.equal(state.taskStates["task_1"]?.status, "pending");
		assert.equal(state.taskStates["task_2"]?.status, "pending");

		const planData = await readFile(join(root, "runs", state.runId, "plan.json"), "utf8");
		assert.ok(planData.includes("plan_test"));
	} finally {
		await rm(root, { recursive: true });
	}
});

test("createAttempt creates work and output dirs", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ws-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRun(plan, "team_1");
		const { attemptId, attemptRoot } = await ws.createAttempt(state.runId, "task_1");
		assert.ok(attemptId.startsWith("attempt_"));
		assert.ok(attemptRoot.includes("task_1"));
		assert.ok(attemptRoot.includes(attemptId));

		const { stat } = await import("node:fs/promises");
		await stat(join(attemptRoot, "work"));
		await stat(join(attemptRoot, "output"));
	} finally {
		await rm(root, { recursive: true });
	}
});

test("writeWorkerOutput returns run-relative ref", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ws-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRun(plan, "team_1");
		const { attemptId } = await ws.createAttempt(state.runId, "task_1");
		const ref = await ws.writeWorkerOutput(state.runId, "task_1", attemptId, 1, "worker result");
		assert.equal(ref, `tasks/task_1/attempts/${attemptId}/worker-output-001.md`);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("writeAcceptedResult and writeFailedResult", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ws-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRun(plan, "team_1");
		const { attemptId } = await ws.createAttempt(state.runId, "task_1");
		const accRef = await ws.writeAcceptedResult(state.runId, "task_1", attemptId, "accepted!");
		assert.ok(accRef.endsWith("accepted-result.md"));
		const failRef = await ws.writeFailedResult(state.runId, "task_1", attemptId, "failed!");
		assert.ok(failRef.endsWith("failed-result.md"));
	} finally {
		await rm(root, { recursive: true });
	}
});

test("writeFinalReport writes to run root", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ws-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRun(plan, "team_1");
		const ref = await ws.writeFinalReport(state.runId, "# Final");
		assert.equal(ref, "final-report.md");
		const content = await readFile(join(root, "runs", state.runId, "final-report.md"), "utf8");
		assert.equal(content, "# Final");
	} finally {
		await rm(root, { recursive: true });
	}
});

test("deleteRun removes run directory", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ws-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRun(plan, "team_1");
		await ws.deleteRun(state.runId);
		const got = await ws.getState(state.runId);
		assert.equal(got, null);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("listStates returns created runs", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ws-"));
	try {
		const ws = new RunWorkspace(root);
		await ws.createRun(plan, "team_1");
		await ws.createRun(plan, "team_1");
		const list = await ws.listStates();
		assert.equal(list.length, 2);
	} finally {
		await rm(root, { recursive: true });
	}
});

// ── P5: attempt metadata tests ──

test("createAttempt writes full metadata defaults", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ws-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRun(plan, "team_1");
		const { attemptId } = await ws.createAttempt(state.runId, "task_1");
		const attempts = await ws.listAttempts(state.runId, "task_1");
		assert.equal(attempts.length, 1);
		const a = attempts[0]!;
		assert.equal(a.attemptId, attemptId);
		assert.equal(a.taskId, "task_1");
		assert.equal(a.status, "running");
		assert.equal(a.phase, "created");
		assert.equal(a.finishedAt, null);
		assert.deepEqual(a.worker, []);
		assert.deepEqual(a.checker, []);
		assert.equal(a.watcher, null);
		assert.equal(a.resultRef, null);
		assert.equal(a.errorSummary, null);
		assert.ok(a.updatedAt.length > 0);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("listAttempts reads old format attempt.json with defaults", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ws-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRun(plan, "team_1");
		// Manually create old-format attempt
		const attemptDir = join(root, "runs", state.runId, "tasks", "task_1", "attempts", "attempt_old123");
		await mkdir(attemptDir, { recursive: true });
		await writeFile(join(attemptDir, "attempt.json"), JSON.stringify({
			attemptId: "attempt_old123",
			taskId: "task_1",
			status: "succeeded",
			createdAt: "2026-05-15T00:00:00.000Z",
		}), "utf8");
		const attempts = await ws.listAttempts(state.runId, "task_1");
		assert.equal(attempts.length, 1);
		const a = attempts[0]!;
		assert.equal(a.attemptId, "attempt_old123");
		assert.equal(a.status, "succeeded");
		assert.equal(a.phase, "succeeded"); // fallback from status
		assert.equal(a.finishedAt, null);
		assert.deepEqual(a.worker, []);
		assert.deepEqual(a.checker, []);
		assert.equal(a.watcher, null);
		assert.equal(a.resultRef, null);
		assert.equal(a.errorSummary, null);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("updateAttemptStatus preserves metadata fields", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ws-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRun(plan, "team_1");
		const { attemptId } = await ws.createAttempt(state.runId, "task_1");
		await ws.updateAttemptStatus(state.runId, "task_1", attemptId, "succeeded");
		const attempts = await ws.listAttempts(state.runId, "task_1");
		const a = attempts[0]!;
		assert.equal(a.status, "succeeded");
		// Metadata fields preserved
		assert.deepEqual(a.worker, []);
		assert.deepEqual(a.checker, []);
		assert.equal(a.watcher, null);
		assert.equal(a.resultRef, null);
		assert.equal(a.errorSummary, null);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("listAttempts handles missing attempt.json with fallback", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ws-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRun(plan, "team_1");
		// Create directory without attempt.json
		const attemptDir = join(root, "runs", state.runId, "tasks", "task_1", "attempts", "attempt_nofile");
		await mkdir(attemptDir, { recursive: true });
		const attempts = await ws.listAttempts(state.runId, "task_1");
		assert.equal(attempts.length, 1);
		const a = attempts[0]!;
		assert.equal(a.attemptId, "attempt_nofile");
		assert.equal(a.status, "running"); // default
	} finally {
		await rm(root, { recursive: true });
	}
});
