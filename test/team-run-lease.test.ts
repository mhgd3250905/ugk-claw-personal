import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
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
	],
	outputContract: { text: "output" },
	archived: false,
	createdAt: "",
	updatedAt: "",
	runCount: 0,
};

test("claimNextRunnableRun claims a queued run for one owner", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-lease-"));
	try {
		const ws = new RunWorkspace(root);
		const created = await ws.createRun(plan, "team_1");

		const claimed = await ws.claimNextRunnableRun("worker_a", 60_000);
		assert.equal(claimed?.runId, created.runId);
		assert.equal(claimed?.status, "running");
		assert.equal(claimed?.lease?.ownerId, "worker_a");

		const second = await ws.claimNextRunnableRun("worker_b", 60_000);
		assert.equal(second, null);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("heartbeat extends only the owning lease", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-lease-"));
	try {
		const ws = new RunWorkspace(root);
		await ws.createRun(plan, "team_1");
		const claimed = await ws.claimNextRunnableRun("worker_a", 1000);
		assert.ok(claimed);
		const before = claimed.lease!.expiresAt;

		await new Promise(resolve => setTimeout(resolve, 5));
		assert.equal(await ws.heartbeatRunLease(claimed.runId, "worker_b", 1000), false);
		assert.equal(await ws.heartbeatRunLease(claimed.runId, "worker_a", 1000), true);

		const fresh = await ws.getState(claimed.runId);
		assert.ok(fresh?.lease);
		assert.equal(fresh.lease.ownerId, "worker_a");
		assert.ok(fresh.lease.expiresAt > before);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("expired running lease can be reclaimed by another owner", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-lease-"));
	try {
		const ws = new RunWorkspace(root);
		await ws.createRun(plan, "team_1");
		const first = await ws.claimNextRunnableRun("worker_a", 1);
		assert.ok(first);
		await new Promise(resolve => setTimeout(resolve, 5));

		const second = await ws.claimNextRunnableRun("worker_b", 60_000);
		assert.equal(second?.runId, first.runId);
		assert.equal(second?.status, "running");
		assert.equal(second?.lease?.ownerId, "worker_b");
		assert.equal(second?.startedAt, first.startedAt);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("releaseRunLease clears only the owning lease", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-lease-"));
	try {
		const ws = new RunWorkspace(root);
		await ws.createRun(plan, "team_1");
		const claimed = await ws.claimNextRunnableRun("worker_a", 60_000);
		assert.ok(claimed);

		await ws.releaseRunLease(claimed.runId, "worker_b");
		assert.equal((await ws.getState(claimed.runId))?.lease?.ownerId, "worker_a");

		await ws.releaseRunLease(claimed.runId, "worker_a");
		assert.equal((await ws.getState(claimed.runId))?.lease, null);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
