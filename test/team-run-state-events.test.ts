import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RunWorkspace } from "../src/team/run-workspace.js";
import type { TeamPlan, TeamRunState } from "../src/team/types.js";

const plan: TeamPlan = {
	schemaVersion: "team/plan-1",
	planId: "plan_ev",
	title: "events test",
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

test("subscriber receives state after saveState", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-events-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRun(plan, "team_1");

		const received: TeamRunState[] = [];
		ws.events.subscribe(state.runId, (s) => received.push(s));

		state.status = "running";
		state.startedAt = new Date().toISOString();
		await ws.saveState(state);

		assert.equal(received.length, 1);
		assert.equal(received[0]!.status, "running");
		assert.equal(received[0]!.runId, state.runId);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("subscriber for another runId does not receive notification", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-events-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRun(plan, "team_1");

		const received: TeamRunState[] = [];
		ws.events.subscribe("other_run_id", (s) => received.push(s));

		state.status = "running";
		await ws.saveState(state);

		assert.equal(received.length, 0);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("unsubscribe prevents future notifications", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-events-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRun(plan, "team_1");

		const received: TeamRunState[] = [];
		const sub = ws.events.subscribe(state.runId, (s) => received.push(s));

		state.status = "running";
		await ws.saveState(state);
		assert.equal(received.length, 1);

		sub.unsubscribe();
		state.status = "paused";
		await ws.saveState(state);
		assert.equal(received.length, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("listener throw does not make saveState fail", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-events-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRun(plan, "team_1");

		ws.events.subscribe(state.runId, () => { throw new Error("boom"); });

		state.status = "running";
		await ws.saveState(state);

		const fresh = await ws.getState(state.runId);
		assert.equal(fresh?.status, "running");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("notification happens after state is readable from disk", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-events-"));
	try {
		const ws = new RunWorkspace(root);
		const state = await ws.createRun(plan, "team_1");

		let readDuringNotification: TeamRunState | null = null;
		const notificationDone = new Promise<void>((resolve) => {
			ws.events.subscribe(state.runId, (s) => {
				ws.getState(s.runId).then((fresh) => {
					readDuringNotification = fresh;
					resolve();
				});
			});
		});

		state.status = "running";
		state.startedAt = new Date().toISOString();
		await ws.saveState(state);
		await notificationDone;

		assert.ok(readDuringNotification);
		assert.equal((readDuringNotification as TeamRunState).status, "running");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
