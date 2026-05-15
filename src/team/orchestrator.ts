import type { TeamRunState, TeamTask, TeamTaskState } from "./types.js";
import { PlanStore } from "./plan-store.js";
import { TeamUnitStore } from "./team-unit-store.js";
import { RunWorkspace } from "./run-workspace.js";
import type { TeamRoleRunner } from "./role-runner.js";
import { writeTimingSpan } from "./timing.js";
import { progressMessages } from "./progress.js";

export interface TeamOrchestratorOptions {
	planStore: PlanStore;
	teamUnitStore: TeamUnitStore;
	workspace: RunWorkspace;
	roleRunner: TeamRoleRunner;
	dataDir: string;
	maxCheckerRevisions: number;
	maxWatcherRevisions: number;
	maxRunDurationMinutes: number;
}

const now = () => new Date().toISOString();

export class TeamOrchestrator {
	private readonly planStore: PlanStore;
	private readonly teamUnitStore: TeamUnitStore;
	private readonly workspace: RunWorkspace;
	private readonly roleRunner: TeamRoleRunner;
	private readonly dataDir: string;
	private readonly maxCheckerRevisions: number;
	private readonly maxWatcherRevisions: number;
	private readonly maxRunDurationMs: number;
	private elapsedOffset = 0;

	constructor(options: TeamOrchestratorOptions) {
		this.planStore = options.planStore;
		this.teamUnitStore = options.teamUnitStore;
		this.workspace = options.workspace;
		this.roleRunner = options.roleRunner;
		this.dataDir = options.dataDir;
		this.maxCheckerRevisions = options.maxCheckerRevisions;
		this.maxWatcherRevisions = options.maxWatcherRevisions;
		this.maxRunDurationMs = options.maxRunDurationMinutes * 60 * 1000;
	}

	async createRun(planId: string): Promise<TeamRunState> {
		const plan = await this.planStore.get(planId);
		if (!plan) throw new Error(`plan not found: ${planId}`);

		const existingStates = await this.workspace.listStates();
		const hasActive = existingStates.some(s => s.status === "queued" || s.status === "running" || s.status === "paused");
		if (hasActive) throw new Error("active run exists");

		const teamUnit = await this.teamUnitStore.get(plan.defaultTeamUnitId);
		if (!teamUnit) throw new Error(`team unit not found: ${plan.defaultTeamUnitId}`);
		if (teamUnit.archived) throw new Error("archived team unit cannot be used");

		const state = await this.workspace.createRun(plan, teamUnit.teamUnitId);
		await this.planStore.incrementRunCount(planId);
		return state;
	}

	async runNextQueued(): Promise<TeamRunState | null> {
		const states = await this.workspace.listStates();
		const queued = states.find(s => s.status === "queued");
		if (!queued) return null;
		return this.runToCompletion(queued.runId);
	}

	async runToCompletion(runId: string): Promise<TeamRunState> {
		let state = await this.workspace.getState(runId);
		if (!state) throw new Error(`run not found: ${runId}`);

		state = await this.transitionToRunning(state);
		this.elapsedOffset = state.activeElapsedMs;

		const plan = await this.planStore.get(state.planId);
		if (!plan) throw new Error(`plan not found: ${state.planId}`);

		for (const task of plan.tasks) {
			state = await this.workspace.getState(runId) as TeamRunState;
			if (state.status !== "running") break;

			if (this.isTimedOut(state)) {
				await this.handleTimeout(state, plan);
				return (await this.workspace.getState(runId))!;
			}

			await this.executeTask(state, task);
		}

		state = (await this.workspace.getState(runId))!;
		if (state.status === "running") {
			await this.runFinalizer(state, plan);
		}

		return (await this.workspace.getState(runId))!;
	}

	async pauseRun(runId: string, reason: string): Promise<TeamRunState> {
		const state = await this.workspace.getState(runId);
		if (!state) throw new Error(`run not found: ${runId}`);
		if (state.status !== "running") throw new Error(`can only pause running run, current: ${state.status}`);

		state.status = "paused";
		state.pauseReason = reason;
		state.lastError = reason;
		state.activeElapsedMs = this.accumulateElapsed(state);
		state.updatedAt = now();

		if (state.currentTaskId) {
			const ts = state.taskStates[state.currentTaskId];
			if (ts) {
				ts.status = "interrupted";
				ts.progress = { phase: "interrupted", message: progressMessages.interrupted, updatedAt: now() };
			}
		}

		await this.workspace.saveState(state);
		return state;
	}

	async resumeRun(runId: string): Promise<TeamRunState> {
		const state = await this.workspace.getState(runId);
		if (!state) throw new Error(`run not found: ${runId}`);
		if (state.status !== "paused") throw new Error(`can only resume paused run, current: ${state.status}`);

		this.elapsedOffset = state.activeElapsedMs;
		state.status = "queued";
		state.pauseReason = null;
		state.updatedAt = now();
		await this.workspace.saveState(state);
		return state;
	}

	async cancelRun(runId: string, reason: string): Promise<TeamRunState> {
		const state = await this.workspace.getState(runId);
		if (!state) throw new Error(`run not found: ${runId}`);
		if (state.status === "completed" || state.status === "failed" || state.status === "cancelled" || state.status === "completed_with_failures") {
			throw new Error(`cannot cancel terminal run: ${state.status}`);
		}

		state.status = "cancelled";
		state.lastError = reason;
		state.activeElapsedMs = this.accumulateElapsed(state);
		state.finishedAt = now();
		state.updatedAt = now();

		for (const [tid, ts] of Object.entries(state.taskStates)) {
			if (ts.status === "running" || ts.status === "pending" || ts.status === "interrupted") {
				ts.status = "cancelled";
				ts.progress = { phase: "cancelled", message: progressMessages.cancelled, updatedAt: now() };
				state.summary.cancelledTasks++;
			}
		}

		await this.workspace.saveState(state);
		return state;
	}

	async deleteTerminalRun(runId: string): Promise<void> {
		const state = await this.workspace.getState(runId);
		if (!state) throw new Error(`run not found: ${runId}`);
		const terminal = ["completed", "completed_with_failures", "failed", "cancelled"] as const;
		if (!terminal.includes(state.status as (typeof terminal)[number])) {
			throw new Error("non-terminal run cannot be deleted");
		}
		await this.workspace.deleteRun(runId);
	}

	private async transitionToRunning(state: TeamRunState): Promise<TeamRunState> {
		if (state.status === "running") return state;
		state.status = "running";
		state.startedAt = state.startedAt ?? now();
		state.updatedAt = now();
		await this.workspace.saveState(state);
		return state;
	}

	private async executeTask(initialState: TeamRunState, task: TeamTask): Promise<void> {
		let state = initialState;
		state.currentTaskId = task.id;
		state.taskStates[task.id]!.status = "running";
		state.taskStates[task.id]!.progress = { phase: "worker_running", message: progressMessages.worker_running, updatedAt: now() };
		state.updatedAt = now();
		await this.workspace.saveState(state);

		let attemptCount = state.taskStates[task.id]!.attemptCount;
		let watcherRevisions = 0;
		let taskDone = false;

		while (!taskDone && watcherRevisions <= this.maxWatcherRevisions) {
			attemptCount++;
			state = (await this.workspace.getState(state.runId))!;
			state.taskStates[task.id]!.attemptCount = attemptCount;
			const { attemptId, attemptRoot } = await this.workspace.createAttempt(state.runId, task.id);
			state.taskStates[task.id]!.activeAttemptId = attemptId;
			await this.workspace.saveState(state);

			const workUnitResult = await this.runWorkUnit(state, task, attemptId, attemptRoot);

			state = (await this.workspace.getState(state.runId))!;
			const currentTs = state.taskStates[task.id]!;

			if (currentTs.status === "interrupted" || currentTs.status === "cancelled") return;

			const watcherResult = await this.runWatcherPhase(state, task, attemptId, workUnitResult);

			state = (await this.workspace.getState(state.runId))!;
			const ts = state.taskStates[task.id]!;

			if (watcherResult.decision === "accept_task") {
				if (workUnitResult === "passed") {
					ts.status = "succeeded";
					ts.progress = { phase: "succeeded", message: progressMessages.succeeded, updatedAt: now() };
					state.summary.succeededTasks++;
				} else {
					ts.status = "failed";
					ts.progress = { phase: "failed", message: progressMessages.failed, updatedAt: now() };
					state.summary.failedTasks++;
				}
				taskDone = true;
			} else if (watcherResult.decision === "confirm_failed") {
				ts.status = "failed";
				ts.progress = { phase: "failed", message: progressMessages.failed, updatedAt: now() };
				state.summary.failedTasks++;
				taskDone = true;
			} else if (watcherResult.decision === "request_revision") {
				watcherRevisions++;
				if (watcherRevisions > this.maxWatcherRevisions) {
					ts.status = "failed";
					ts.errorSummary = "exceeded max watcher revisions";
					ts.progress = { phase: "failed", message: progressMessages.failed, updatedAt: now() };
					state.summary.failedTasks++;
					taskDone = true;
				}
			}

			state.updatedAt = now();
			await this.workspace.saveState(state);
		}
	}

	private async runWorkUnit(state: TeamRunState, task: TeamTask, attemptId: string, attemptRoot: string): Promise<"passed" | "failed"> {
		const runId = state.runId;
		let checkerRevision = 0;
		let lastFeedback: string | undefined;

		while (true) {
			const freshState = await this.workspace.getState(runId);
			if (!freshState || freshState.status !== "running") return "failed";

			const workerOut = await this.roleRunner.runWorker({
				runId,
				task,
				attemptId,
				workDir: `${attemptRoot}/work`,
				outputDir: `${attemptRoot}/output`,
				acceptanceRules: task.acceptance.rules,
				feedback: lastFeedback,
			});

			const workerOutputIdx = checkerRevision + 1;
			const workerRef = await this.workspace.writeWorkerOutput(runId, task.id, attemptId, workerOutputIdx, workerOut.content);

			await writeTimingSpan(this.dataDir, {
				runId, taskId: task.id, attemptId, phase: "worker",
				startedAt: now(), finishedAt: now(), durationMs: 0,
			});

			const checkerOut = await this.roleRunner.runChecker({
				runId,
				task,
				attemptId,
				workerOutputRef: workerRef,
				acceptanceRules: task.acceptance.rules,
			});

			await this.workspace.writeCheckerVerdict(runId, task.id, attemptId, checkerRevision + 1, checkerOut);
			if (checkerOut.feedback) {
				await this.workspace.writeCheckerOutput(runId, task.id, attemptId, checkerRevision + 1, checkerOut.feedback);
			}

			await writeTimingSpan(this.dataDir, {
				runId, taskId: task.id, attemptId, phase: "checker",
				startedAt: now(), finishedAt: now(), durationMs: 0,
			});

			if (checkerOut.verdict === "pass") {
				const resultContent = checkerOut.resultContent ?? workerOut.content;
				const resultRef = await this.workspace.writeAcceptedResult(runId, task.id, attemptId, resultContent);
				const s = (await this.workspace.getState(runId))!;
				s.taskStates[task.id]!.resultRef = resultRef;
				await this.workspace.saveState(s);
				return "passed";
			}

			if (checkerOut.verdict === "fail") {
				const failContent = checkerOut.resultContent ?? checkerOut.reason;
				const failRef = await this.workspace.writeFailedResult(runId, task.id, attemptId, failContent);
				const s = (await this.workspace.getState(runId))!;
				s.taskStates[task.id]!.resultRef = failRef;
				s.taskStates[task.id]!.errorSummary = checkerOut.reason;
				await this.workspace.saveState(s);
				return "failed";
			}

			checkerRevision++;
			lastFeedback = checkerOut.feedback;
			if (checkerRevision >= this.maxCheckerRevisions) {
				const failRef = await this.workspace.writeFailedResult(runId, task.id, attemptId, `checker revision limit (${this.maxCheckerRevisions}) exceeded`);
				const s = (await this.workspace.getState(runId))!;
				s.taskStates[task.id]!.resultRef = failRef;
				s.taskStates[task.id]!.errorSummary = "checker revision limit exceeded";
				await this.workspace.saveState(s);
				return "failed";
			}
		}
	}

	private async runWatcherPhase(state: TeamRunState, task: TeamTask, attemptId: string, workUnitStatus: "passed" | "failed") {
		const ts = state.taskStates[task.id];
		const watcherOut = await this.roleRunner.runWatcher({
			runId: state.runId,
			task,
			attemptId,
			workUnitStatus,
			resultRef: ts?.resultRef ?? null,
			errorSummary: ts?.errorSummary ?? null,
		});

		await this.workspace.writeWatcherReview(state.runId, task.id, attemptId, watcherOut);
		await writeTimingSpan(this.dataDir, {
			runId: state.runId, taskId: task.id, attemptId, phase: "watcher",
			startedAt: now(), finishedAt: now(), durationMs: 0,
		});

		return watcherOut;
	}

	private async runFinalizer(staleState: TeamRunState, plan: import("./types.js").TeamPlan): Promise<void> {
		const state = (await this.workspace.getState(staleState.runId))!;
		const taskResults = plan.tasks.map(t => {
			const ts = state.taskStates[t.id]!;
			return {
				taskId: t.id,
				status: (ts.status === "succeeded" ? "succeeded" : "failed") as "succeeded" | "failed",
				resultRef: ts.resultRef,
				errorSummary: ts.errorSummary,
			};
		});

		const finalizerOut = await this.roleRunner.runFinalizer({ runId: state.runId, plan, taskResults });
		await this.workspace.writeFinalReport(state.runId, finalizerOut.finalReport);

		state.currentTaskId = null;
		const hasFailures = taskResults.some(r => r.status === "failed");
		state.status = hasFailures ? "completed_with_failures" : "completed";
		state.activeElapsedMs = this.accumulateElapsed(state);
		state.finishedAt = now();
		state.updatedAt = now();
		await this.workspace.saveState(state);
	}

	private isTimedOut(state: TeamRunState): boolean {
		const elapsed = this.accumulateElapsed(state);
		return elapsed >= this.maxRunDurationMs;
	}

	private async handleTimeout(state: TeamRunState, plan: import("./types.js").TeamPlan): Promise<void> {
		for (const task of plan.tasks) {
			const ts = state.taskStates[task.id]!;
			if (ts.status === "running" || ts.status === "pending") {
				ts.status = "failed";
				ts.errorSummary = "run timeout";
				ts.progress = { phase: "failed", message: progressMessages.failed, updatedAt: now() };
				state.summary.failedTasks++;
			}
		}
		state.status = "failed";
		state.lastError = "run timeout";
		state.activeElapsedMs = this.accumulateElapsed(state);
		state.finishedAt = now();
		state.updatedAt = now();
		await this.workspace.saveState(state);
	}

	private accumulateElapsed(state: TeamRunState): number {
		if (!state.startedAt) return this.elapsedOffset;
		const started = new Date(state.startedAt).getTime();
		const current = Date.now();
		return this.elapsedOffset + (current - started);
	}
}
