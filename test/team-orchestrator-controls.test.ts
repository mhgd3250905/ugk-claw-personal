import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TeamOrchestrator } from "../src/team/orchestrator.js";
import { PlanStore } from "../src/team/plan-store.js";
import { TeamUnitStore } from "../src/team/team-unit-store.js";
import { RunWorkspace } from "../src/team/run-workspace.js";
import { MockRoleRunner, type TeamRoleRunner } from "../src/team/role-runner.js";

async function setup() {
	const root = await mkdtemp(join(tmpdir(), "team-ctrl-"));
	const planStore = new PlanStore(root);
	const unitStore = new TeamUnitStore(root);
	const workspace = new RunWorkspace(root);
	const runner = new MockRoleRunner();
	const unit = await unitStore.create({ title: "t", description: "d", watcherProfileId: "w", workerProfileId: "wo", checkerProfileId: "c", finalizerProfileId: "f" });
	const plan = await planStore.create({
		title: "ctrl test",
		defaultTeamUnitId: unit.teamUnitId,
		goal: { text: "test" },
		tasks: [{ id: "task_1", title: "t1", input: { text: "do 1" }, acceptance: { rules: ["r1"] } }],
		outputContract: { text: "output" },
	});
	const orchestrator = new TeamOrchestrator({ planStore, teamUnitStore: unitStore, workspace, roleRunner: runner, dataDir: root, maxCheckerRevisions: 3, maxWatcherRevisions: 1, maxRunDurationMinutes: 60 });
	return { root, plan, orchestrator, workspace };
}

class ThrowingRoleRunner extends MockRoleRunner {
	async runWorker(): ReturnType<TeamRoleRunner["runWorker"]> {
		throw new Error("worker exploded");
	}
}

test("queued -> cancel", async () => {
	const { root, plan, orchestrator } = await setup();
	try {
		const state = await orchestrator.createRun(plan.planId);
		assert.equal(state.status, "queued");
		const cancelled = await orchestrator.cancelRun(state.runId, "user cancel");
		assert.equal(cancelled.status, "cancelled");
	} finally {
		await rm(root, { recursive: true });
	}
});

test("running -> pause", async () => {
	const { root, plan, orchestrator } = await setup();
	try {
		const state = await orchestrator.createRun(plan.planId);
		const run = await orchestrator.runToCompletion(state.runId);
		assert.equal(run.status, "completed");
	} finally {
		await rm(root, { recursive: true });
	}
});

test("paused -> resume -> queued", async () => {
	const { root, plan, orchestrator } = await setup();
	try {
		const state = await orchestrator.createRun(plan.planId);
		await orchestrator.cancelRun(state.runId, "done");
		const canResume = await orchestrator.resumeRun(state.runId).catch(e => e.message);
		assert.match(canResume, /can only resume paused run/);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("cancel during run prevents finalizer", async () => {
	const { root, plan, orchestrator, workspace } = await setup();
	try {
		const state = await orchestrator.createRun(plan.planId);
		const cancelled = await orchestrator.cancelRun(state.runId, "user cancel");
		assert.equal(cancelled.status, "cancelled");
		assert.equal(cancelled.summary.cancelledTasks, 1);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("terminal run can be deleted", async () => {
	const { root, plan, orchestrator, workspace } = await setup();
	try {
		const state = await orchestrator.createRun(plan.planId);
		await orchestrator.runToCompletion(state.runId);
		await orchestrator.deleteTerminalRun(state.runId);
		const got = await workspace.getState(state.runId);
		assert.equal(got, null);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("non-terminal run cannot be deleted", async () => {
	const { root, plan, orchestrator } = await setup();
	try {
		const state = await orchestrator.createRun(plan.planId);
		await assert.rejects(() => orchestrator.deleteTerminalRun(state.runId), { message: /non-terminal run cannot be deleted/ });
	} finally {
		await rm(root, { recursive: true });
	}
});

test("cancel terminal run throws", async () => {
	const { root, plan, orchestrator } = await setup();
	try {
		const state = await orchestrator.createRun(plan.planId);
		await orchestrator.runToCompletion(state.runId);
		await assert.rejects(() => orchestrator.cancelRun(state.runId, "nope"), { message: /cannot cancel terminal run/ });
	} finally {
		await rm(root, { recursive: true });
	}
});

test("role runner errors mark the run failed instead of leaving it running", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ctrl-"));
	try {
		const planStore = new PlanStore(root);
		const unitStore = new TeamUnitStore(root);
		const workspace = new RunWorkspace(root);
		const unit = await unitStore.create({ title: "t", description: "d", watcherProfileId: "w", workerProfileId: "wo", checkerProfileId: "c", finalizerProfileId: "f" });
		const plan = await planStore.create({
			title: "ctrl test",
			defaultTeamUnitId: unit.teamUnitId,
			goal: { text: "test" },
			tasks: [{ id: "task_1", title: "t1", input: { text: "do 1" }, acceptance: { rules: ["r1"] } }],
			outputContract: { text: "output" },
		});
		const orchestrator = new TeamOrchestrator({
			planStore,
			teamUnitStore: unitStore,
			workspace,
			roleRunner: new ThrowingRoleRunner(),
			dataDir: root,
			maxCheckerRevisions: 3,
			maxWatcherRevisions: 1,
			maxRunDurationMinutes: 60,
		});
		const state = await orchestrator.createRun(plan.planId);

		const final = await orchestrator.runToCompletion(state.runId);

		assert.equal(final.status, "failed");
		assert.match(final.lastError ?? "", /worker exploded/);
		assert.equal(final.taskStates.task_1?.status, "failed");
	} finally {
		await rm(root, { recursive: true });
	}
});

test("cancelRun triggers abort on active runner", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ctrl-"));
	try {
		let abortRequested = false;
		class HangingRunner extends MockRoleRunner {
			override async runWorker(input: import("../src/team/role-runner.js").WorkerInput) {
				if (!input.signal) return super.runWorker(input);
				return await new Promise<never>((_, reject) => {
					input.signal!.addEventListener("abort", () => {
						abortRequested = true;
						reject(new Error("aborted"));
					}, { once: true });
				});
			}
		}
		const planStore = new PlanStore(root);
		const unitStore = new TeamUnitStore(root);
		const workspace = new RunWorkspace(root);
		const unit = await unitStore.create({ title: "t", description: "d", watcherProfileId: "w", workerProfileId: "wo", checkerProfileId: "c", finalizerProfileId: "f" });
		const plan = await planStore.create({
			title: "cancel abort test",
			defaultTeamUnitId: unit.teamUnitId,
			goal: { text: "test" },
			tasks: [{ id: "task_1", title: "t1", input: { text: "do 1" }, acceptance: { rules: ["r1"] } }],
			outputContract: { text: "output" },
		});
		const runner = new HangingRunner();
		const orchestrator = new TeamOrchestrator({ planStore, teamUnitStore: unitStore, workspace, roleRunner: runner, dataDir: root, maxCheckerRevisions: 3, maxWatcherRevisions: 1, maxRunDurationMinutes: 60 });

		const state = await orchestrator.createRun(plan.planId);
		const runPromise = orchestrator.runToCompletion(state.runId);

		await new Promise(r => setTimeout(r, 50));
		await orchestrator.cancelRun(state.runId, "user cancel");

		const final = await runPromise;
		assert.equal(final.status, "cancelled");
		assert.equal(abortRequested, true);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("external AbortSignal aborts in-flight run", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ctrl-"));
	try {
		let workerSignal: AbortSignal | undefined;
		class SignalCapturingRunner extends MockRoleRunner {
			override async runWorker(input: import("../src/team/role-runner.js").WorkerInput) {
				workerSignal = input.signal;
				return super.runWorker(input);
			}
		}
		const planStore = new PlanStore(root);
		const unitStore = new TeamUnitStore(root);
		const workspace = new RunWorkspace(root);
		const unit = await unitStore.create({ title: "t", description: "d", watcherProfileId: "w", workerProfileId: "wo", checkerProfileId: "c", finalizerProfileId: "f" });
		const plan = await planStore.create({
			title: "external cancel test",
			defaultTeamUnitId: unit.teamUnitId,
			goal: { text: "test" },
			tasks: [{ id: "task_1", title: "t1", input: { text: "do 1" }, acceptance: { rules: ["r1"] } }],
			outputContract: { text: "output" },
		});
		const runner = new SignalCapturingRunner();
		const orchestrator = new TeamOrchestrator({ planStore, teamUnitStore: unitStore, workspace, roleRunner: runner, dataDir: root, maxCheckerRevisions: 3, maxWatcherRevisions: 1, maxRunDurationMinutes: 60 });

		const state = await orchestrator.createRun(plan.planId);

		const externalAbort = new AbortController();
		const runPromise = orchestrator.runToCompletion(state.runId, { signal: externalAbort.signal });

		await new Promise(r => setTimeout(r, 50));
		externalAbort.abort(new Error("external cancel"));

		const final = await runPromise;
		assert.equal(final.status, "completed");
		assert.ok(workerSignal, "worker should have received a signal");
	} finally {
		await rm(root, { recursive: true });
	}
});

test("pauseRun triggers abort on active runner", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ctrl-"));
	try {
		let abortRequested = false;
		class HangingRunner extends MockRoleRunner {
			override async runWorker(input: import("../src/team/role-runner.js").WorkerInput) {
				if (!input.signal) return super.runWorker(input);
				return await new Promise<never>((_, reject) => {
					input.signal!.addEventListener("abort", () => {
						abortRequested = true;
						reject(new Error("aborted"));
					}, { once: true });
				});
			}
		}
		const planStore = new PlanStore(root);
		const unitStore = new TeamUnitStore(root);
		const workspace = new RunWorkspace(root);
		const unit = await unitStore.create({ title: "t", description: "d", watcherProfileId: "w", workerProfileId: "wo", checkerProfileId: "c", finalizerProfileId: "f" });
		const plan = await planStore.create({
			title: "pause abort test",
			defaultTeamUnitId: unit.teamUnitId,
			goal: { text: "test" },
			tasks: [{ id: "task_1", title: "t1", input: { text: "do 1" }, acceptance: { rules: ["r1"] } }],
			outputContract: { text: "output" },
		});
		const runner = new HangingRunner();
		const orchestrator = new TeamOrchestrator({ planStore, teamUnitStore: unitStore, workspace, roleRunner: runner, dataDir: root, maxCheckerRevisions: 3, maxWatcherRevisions: 1, maxRunDurationMinutes: 60 });

		const state = await orchestrator.createRun(plan.planId);
		const runPromise = orchestrator.runToCompletion(state.runId);

		await new Promise(r => setTimeout(r, 50));
		await orchestrator.pauseRun(state.runId, "user pause");

		const final = await runPromise;
		assert.equal(final.status, "paused");
		assert.equal(abortRequested, true);
	} finally {
		await rm(root, { recursive: true });
	}
});
