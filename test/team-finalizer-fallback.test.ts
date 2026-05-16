import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TeamOrchestrator } from "../src/team/orchestrator.js";
import { PlanStore } from "../src/team/plan-store.js";
import { TeamUnitStore } from "../src/team/team-unit-store.js";
import { RunWorkspace } from "../src/team/run-workspace.js";
import { MockRoleRunner, type TeamRoleRunner } from "../src/team/role-runner.js";

class ThrowingFinalizerRunner extends MockRoleRunner {
	override async runFinalizer(): Promise<import("../src/team/role-runner.js").FinalizerOutput> {
		throw new Error("finalizer agent crashed");
	}
}

test("finalizer failure writes fallback final-report.md", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-fallback-"));
	try {
		const planStore = new PlanStore(root);
		const unitStore = new TeamUnitStore(root);
		const workspace = new RunWorkspace(root);
		const unit = await unitStore.create({ title: "t", description: "d", watcherProfileId: "w", workerProfileId: "wo", checkerProfileId: "c", finalizerProfileId: "f" });
		const plan = await planStore.create({
			title: "fallback test",
			defaultTeamUnitId: unit.teamUnitId,
			goal: { text: "test" },
			tasks: [{ id: "task_1", title: "t1", input: { text: "do" }, acceptance: { rules: ["r1"] } }],
			outputContract: { text: "output" },
		});
		const runner: TeamRoleRunner = new ThrowingFinalizerRunner();
		const orchestrator = new TeamOrchestrator({ planStore, teamUnitStore: unitStore, workspace, roleRunner: runner, dataDir: root, maxCheckerRevisions: 3, maxWatcherRevisions: 1, maxRunDurationMinutes: 60 });
		const state = await orchestrator.createRun(plan.planId);

		const final = await orchestrator.runToCompletion(state.runId);

		assert.equal(final.status, "completed_with_failures");
		assert.match(final.lastError ?? "", /finalizer agent crashed/);
		assert.equal(final.finalizerRuntimeContext, null);

		const report = await readFile(join(root, "runs", state.runId, "final-report.md"), "utf8");
		assert.match(report, /系统自动生成的 fallback 报告/);
		assert.match(report, /finalizer agent crashed/);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("fallback report contains task resultRef and errorSummary", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-fallback-"));
	try {
		const planStore = new PlanStore(root);
		const unitStore = new TeamUnitStore(root);
		const workspace = new RunWorkspace(root);
		const unit = await unitStore.create({ title: "t", description: "d", watcherProfileId: "w", workerProfileId: "wo", checkerProfileId: "c", finalizerProfileId: "f" });
		const plan = await planStore.create({
			title: "fallback content test",
			defaultTeamUnitId: unit.teamUnitId,
			goal: { text: "test" },
			tasks: [
				{ id: "task_1", title: "成功任务", input: { text: "do 1" }, acceptance: { rules: ["r1"] } },
				{ id: "task_2", title: "失败任务", input: { text: "do 2" }, acceptance: { rules: ["r2"] } },
			],
			outputContract: { text: "output" },
		});

		class FailTask2Runner extends MockRoleRunner {
			private callIndex = 0;
			override async runWorker(input: import("../src/team/role-runner.js").WorkerInput) {
				this.callIndex++;
				if (input.task.id === "task_2") {
					return { content: "failed output for task 2", artifactRefs: [] };
				}
				return super.runWorker(input);
			}
			override async runChecker(input: import("../src/team/role-runner.js").CheckerInput) {
				if (input.task.id === "task_2") {
					return { verdict: "fail" as const, reason: "task 2 did not meet criteria", resultContent: undefined, feedback: undefined };
				}
				return super.runChecker(input);
			}
			override async runFinalizer(): Promise<import("../src/team/role-runner.js").FinalizerOutput> {
				throw new Error("finalizer exploded");
			}
		}

		const runner: TeamRoleRunner = new FailTask2Runner();
		const orchestrator = new TeamOrchestrator({ planStore, teamUnitStore: unitStore, workspace, roleRunner: runner, dataDir: root, maxCheckerRevisions: 3, maxWatcherRevisions: 1, maxRunDurationMinutes: 60 });
		const state = await orchestrator.createRun(plan.planId);

		const final = await orchestrator.runToCompletion(state.runId);

		assert.equal(final.status, "completed_with_failures");

		const report = await readFile(join(root, "runs", state.runId, "final-report.md"), "utf8");
		// Should contain task titles
		assert.match(report, /成功任务/);
		assert.match(report, /失败任务/);
		// Should contain resultRef or task status info
		assert.match(report, /task_1/);
		assert.match(report, /task_2/);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("cancelled run does not write fallback report", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-fallback-"));
	try {
		let finalizerStarted = false;
		let finalizerResolve: () => void;
		const finalizerStartedPromise = new Promise<void>(r => { finalizerResolve = r; });

		class HangingFinalizerRunner extends MockRoleRunner {
			override async runFinalizer(input: import("../src/team/role-runner.js").FinalizerInput): Promise<import("../src/team/role-runner.js").FinalizerOutput> {
				finalizerStarted = true;
				finalizerResolve!();
				if (input.signal) {
					await new Promise<never>((_, reject) => {
						if (input.signal!.aborted) { reject(new Error("already aborted")); return; }
						input.signal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
					});
				}
				return { finalReport: "report" };
			}
		}

		const planStore = new PlanStore(root);
		const unitStore = new TeamUnitStore(root);
		const workspace = new RunWorkspace(root);
		const unit = await unitStore.create({ title: "t", description: "d", watcherProfileId: "w", workerProfileId: "wo", checkerProfileId: "c", finalizerProfileId: "f" });
		const plan = await planStore.create({
			title: "cancel fallback test",
			defaultTeamUnitId: unit.teamUnitId,
			goal: { text: "test" },
			tasks: [{ id: "task_1", title: "t1", input: { text: "do" }, acceptance: { rules: ["r1"] } }],
			outputContract: { text: "output" },
		});
		const runner: TeamRoleRunner = new HangingFinalizerRunner();
		const orchestrator = new TeamOrchestrator({ planStore, teamUnitStore: unitStore, workspace, roleRunner: runner, dataDir: root, maxCheckerRevisions: 3, maxWatcherRevisions: 1, maxRunDurationMinutes: 60 });
		const state = await orchestrator.createRun(plan.planId);

		const runPromise = orchestrator.runToCompletion(state.runId);
		await finalizerStartedPromise;
		await orchestrator.cancelRun(state.runId, "user cancel");
		const final = await runPromise;

		assert.equal(final.status, "cancelled");
		assert.equal(final.finalizerRuntimeContext, null);

		// No final-report.md should exist
		const reportExists = await readFile(join(root, "runs", state.runId, "final-report.md"), "utf8").then(() => true).catch(() => false);
		assert.equal(reportExists, false, "cancelled run should not have a fallback report");
	} finally {
		await rm(root, { recursive: true });
	}
});

test("lastError preserves finalizer error message", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-fallback-"));
	try {
		const planStore = new PlanStore(root);
		const unitStore = new TeamUnitStore(root);
		const workspace = new RunWorkspace(root);
		const unit = await unitStore.create({ title: "t", description: "d", watcherProfileId: "w", workerProfileId: "wo", checkerProfileId: "c", finalizerProfileId: "f" });
		const plan = await planStore.create({
			title: "lastError test",
			defaultTeamUnitId: unit.teamUnitId,
			goal: { text: "test" },
			tasks: [{ id: "task_1", title: "t1", input: { text: "do" }, acceptance: { rules: ["r1"] } }],
			outputContract: { text: "output" },
		});

		class SpecificErrorRunner extends MockRoleRunner {
			override async runFinalizer(): Promise<import("../src/team/role-runner.js").FinalizerOutput> {
				throw new Error("OOM: finalizer ran out of memory");
			}
		}

		const runner: TeamRoleRunner = new SpecificErrorRunner();
		const orchestrator = new TeamOrchestrator({ planStore, teamUnitStore: unitStore, workspace, roleRunner: runner, dataDir: root, maxCheckerRevisions: 3, maxWatcherRevisions: 1, maxRunDurationMinutes: 60 });
		const state = await orchestrator.createRun(plan.planId);

		const final = await orchestrator.runToCompletion(state.runId);

		assert.equal(final.status, "completed_with_failures");
		assert.match(final.lastError ?? "", /OOM: finalizer ran out of memory/);
	} finally {
		await rm(root, { recursive: true });
	}
});
