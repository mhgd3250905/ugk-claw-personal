import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RunWorkspace } from "../src/team/run-workspace.js";
import type { TeamPlan } from "../src/team/types.js";

const plan: TeamPlan = {
	schemaVersion: "team/plan-1",
	planId: "plan_admission",
	title: "admission test",
	defaultTeamUnitId: "team_1",
	goal: { text: "test admission" },
	tasks: [
		{ id: "task_1", title: "t1", input: { text: "do t1" }, acceptance: { rules: ["rule1"] } },
	],
	outputContract: { text: "output" },
	archived: false,
	createdAt: "",
	updatedAt: "",
	runCount: 0,
};

const planB: TeamPlan = {
	...plan,
	planId: "plan_admission_b",
	title: "admission test B",
};

test("createRunWithAdmission(..., 1) creates the first queued run", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-admit-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRunWithAdmission(plan, "team_1", 1);
		assert.equal(state.status, "queued");
		assert.equal(state.planId, "plan_admission");

		const states = await ws.listStates();
		assert.equal(states.length, 1);
		assert.equal(states[0].runId, state.runId);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("second active run with limit 1 rejects with 'active run limit reached'", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-admit-"));
	try {
		const ws = new RunWorkspace(root);
		await ws.createRunWithAdmission(plan, "team_1", 1);

		await assert.rejects(
			() => ws.createRunWithAdmission(planB, "team_1", 1),
			{ message: "active run limit reached" },
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("terminal runs do not count toward the limit", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-admit-"));
	try {
		const ws = new RunWorkspace(root);
		const first = await ws.createRunWithAdmission(plan, "team_1", 1);
		first.status = "completed";
		first.finishedAt = new Date().toISOString();
		await ws.saveState(first);

		const second = await ws.createRunWithAdmission(planB, "team_1", 1);
		assert.equal(second.status, "queued");
		assert.equal(second.planId, "plan_admission_b");

		const states = await ws.listStates();
		assert.equal(states.length, 2);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("with limit 2, two active runs created, third rejects", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-admit-"));
	try {
		const ws = new RunWorkspace(root);
		const first = await ws.createRunWithAdmission(plan, "team_1", 2);
		assert.equal(first.status, "queued");

		const second = await ws.createRunWithAdmission(planB, "team_1", 2);
		assert.equal(second.status, "queued");
		assert.notEqual(second.runId, first.runId);

		await assert.rejects(
			() => ws.createRunWithAdmission(plan, "team_1", 2),
			{ message: "active run limit reached" },
		);

		const states = await ws.listStates();
		assert.equal(states.length, 2);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("concurrent Promise.allSettled admission with limit 1 produces exactly one success", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-admit-"));
	try {
		const ws = new RunWorkspace(root);
		const attempts = await Promise.allSettled(
			Array.from({ length: 5 }, (_, i) =>
				ws.createRunWithAdmission(
					{ ...plan, planId: `plan_concurrent_${i}` },
					"team_1",
					1,
				),
			),
		);

		const succeeded = attempts.filter(r => r.status === "fulfilled");
		const rejected = attempts.filter(r => r.status === "rejected");

		assert.equal(succeeded.length, 1, "exactly one admission should succeed");
		assert.equal(rejected.length, 4, "four admissions should reject");
		assert.equal(succeeded[0].status, "fulfilled");
		if (rejected[0].status === "rejected") {
			assert.match(rejected[0].reason.message, /active run limit reached/);
		}

		const states = await ws.listStates();
		assert.equal(states.length, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("concurrent admission with limit 2 produces exactly two successes", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-admit-"));
	try {
		const ws = new RunWorkspace(root);
		const attempts = await Promise.allSettled(
			Array.from({ length: 5 }, (_, i) =>
				ws.createRunWithAdmission(
					{ ...plan, planId: `plan_concurrent2_${i}` },
					"team_1",
					2,
				),
			),
		);

		const succeeded = attempts.filter(r => r.status === "fulfilled");
		const rejected = attempts.filter(r => r.status === "rejected");

		assert.equal(succeeded.length, 2, "exactly two admissions should succeed");
		assert.equal(rejected.length, 3, "three admissions should reject");

		const states = await ws.listStates();
		assert.equal(states.length, 2);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("concurrent admission does not reject while capacity remains available", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-admit-"));
	try {
		const ws = new RunWorkspace(root);
		const limit = 80;
		const attempts = await Promise.allSettled(
			Array.from({ length: limit }, (_, i) =>
				ws.createRunWithAdmission(
					{ ...plan, planId: `plan_capacity_${i}` },
					"team_1",
					limit,
				),
			),
		);

		const rejected = attempts.filter(r => r.status === "rejected");
		assert.deepEqual(rejected, []);

		const states = await ws.listStates();
		assert.equal(states.length, limit);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("queued, running, and paused all count as active for admission", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-admit-"));
	try {
		const ws = new RunWorkspace(root);
		const run = await ws.createRunWithAdmission(plan, "team_1", 1);

		// running
		run.status = "running";
		run.startedAt = new Date().toISOString();
		await ws.saveState(run);
		await assert.rejects(
			() => ws.createRunWithAdmission(planB, "team_1", 1),
			{ message: "active run limit reached" },
		);

		// paused
		run.status = "paused";
		await ws.saveState(run);
		await assert.rejects(
			() => ws.createRunWithAdmission(planB, "team_1", 1),
			{ message: "active run limit reached" },
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("createRunWithAdmission clamps invalid limits to 1", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-admit-"));
	try {
		const ws = new RunWorkspace(root);
		// limit 0 should still allow 1 run (clamped)
		const state = await ws.createRunWithAdmission(plan, "team_1", 0);
		assert.equal(state.status, "queued");

		// second should fail since effective limit is 1
		await assert.rejects(
			() => ws.createRunWithAdmission(planB, "team_1", 0),
			{ message: "active run limit reached" },
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
