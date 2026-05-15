import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
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
