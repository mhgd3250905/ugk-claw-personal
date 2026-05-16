import type { TeamRunState, TeamTask, TeamTaskState } from "./types.js";
import { PlanStore } from "./plan-store.js";
import { TeamUnitStore } from "./team-unit-store.js";
import { RunWorkspace } from "./run-workspace.js";
import type { TeamRoleRunner } from "./role-runner.js";
import { writeTimingSpan } from "./timing.js";
import { progressMessages } from "./progress.js";

export interface PhaseTimeouts {
	workerMs: number;
	checkerMs: number;
	watcherMs: number;
	finalizerMs: number;
}

export const DEFAULT_PHASE_TIMEOUTS: PhaseTimeouts = {
	workerMs: 600_000,
	checkerMs: 300_000,
	watcherMs: 300_000,
	finalizerMs: 300_000,
};

export interface TeamOrchestratorOptions {
	planStore: PlanStore;
	teamUnitStore: TeamUnitStore;
	workspace: RunWorkspace;
	roleRunner: TeamRoleRunner;
	dataDir: string;
	maxCheckerRevisions: number;
	maxWatcherRevisions: number;
	maxRunDurationMinutes: number;
	phaseTimeouts?: PhaseTimeouts;
}

const now = () => new Date().toISOString();

const TERMINAL_TASK_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

function isRunExternallyStopped(status: string): boolean {
	return status === "cancelled" || status === "paused";
}

function generateFallbackReport(
	plan: import("./types.js").TeamPlan,
	state: TeamRunState,
	error: unknown,
): string {
	const message = error instanceof Error ? error.message : String(error);
	const lines: string[] = [
		"# 系统汇总报告",
		"",
		"> 注意：这是系统自动生成的 fallback 报告，不是 finalizer Agent 原始输出。",
		`> finalizer 执行失败：${message}`,
		"",
		"## 任务执行结果",
		"",
	];
	for (const task of plan.tasks) {
		const ts = state.taskStates[task.id];
		if (!ts) {
			lines.push(`- ${task.id}（${task.title}）：待执行`);
		} else if (ts.status === "succeeded") {
			lines.push(`- ${task.id}（${task.title}）：成功`);
			if (ts.resultRef) lines.push(`  - 结果：${ts.resultRef}`);
		} else {
			lines.push(`- ${task.id}（${task.title}）：${ts.status}`);
			if (ts.resultRef) lines.push(`  - 结果：${ts.resultRef}`);
			if (ts.errorSummary) lines.push(`  - 错误：${ts.errorSummary}`);
		}
	}
	lines.push("", `生成时间：${now()}`, "");
	return lines.join("\n");
}

async function runWithTimeout<T>(
	phase: string,
	timeoutMs: number,
	parentSignal: AbortSignal,
	fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(new Error(`${phase} timeout`)), timeoutMs);
	let removeParentListener = (): void => {};
	try {
		if (parentSignal.aborted) {
			throw parentSignal.reason instanceof Error ? parentSignal.reason : new Error("aborted");
		}
		const onParentAbort = () => controller.abort(parentSignal.reason instanceof Error ? parentSignal.reason : new Error("aborted"));
		parentSignal.addEventListener("abort", onParentAbort, { once: true });
		removeParentListener = () => parentSignal.removeEventListener("abort", onParentAbort);
		return await fn(controller.signal);
	} finally {
		removeParentListener();
		clearTimeout(timer);
	}
}

export class TeamOrchestrator {
	private readonly planStore: PlanStore;
	private readonly teamUnitStore: TeamUnitStore;
	private readonly workspace: RunWorkspace;
	private readonly roleRunner: TeamRoleRunner;
	private readonly dataDir: string;
	private readonly maxCheckerRevisions: number;
	private readonly maxWatcherRevisions: number;
	private readonly maxRunDurationMs: number;
	private readonly phaseTimeouts: PhaseTimeouts;
	private elapsedOffset = 0;
	private abortController: AbortController | null = null;
	private leaseOwnerId: string | null = null;

	constructor(options: TeamOrchestratorOptions) {
		this.planStore = options.planStore;
		this.teamUnitStore = options.teamUnitStore;
		this.workspace = options.workspace;
		this.roleRunner = options.roleRunner;
		this.dataDir = options.dataDir;
		this.maxCheckerRevisions = options.maxCheckerRevisions;
		this.maxWatcherRevisions = options.maxWatcherRevisions;
		this.maxRunDurationMs = options.maxRunDurationMinutes * 60 * 1000;
		this.phaseTimeouts = options.phaseTimeouts ?? DEFAULT_PHASE_TIMEOUTS;
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

	async runToCompletion(runId: string, options?: { signal?: AbortSignal; leaseOwnerId?: string }): Promise<TeamRunState> {
		let state = await this.workspace.getState(runId);
		if (!state) throw new Error(`run not found: ${runId}`);

		this.leaseOwnerId = options?.leaseOwnerId ?? null;
		this.abortController = new AbortController();
		if (options?.signal) {
			if (options.signal.aborted) {
				this.abortController = null;
				throw options.signal.reason instanceof Error ? options.signal.reason : new Error("aborted before start");
			}
			options.signal.addEventListener("abort", () => {
				this.abortController?.abort(options.signal!.reason);
			}, { once: true });
		}
		const signal = this.abortController.signal;

		const teamUnit = await this.teamUnitStore.get(state.teamUnitId);
		if (teamUnit && "setProfileIds" in this.roleRunner) {
			(this.roleRunner as import("./agent-profile-role-runner.js").AgentProfileRoleRunner).setProfileIds({
				workerProfileId: teamUnit.workerProfileId,
				checkerProfileId: teamUnit.checkerProfileId,
				watcherProfileId: teamUnit.watcherProfileId,
				finalizerProfileId: teamUnit.finalizerProfileId,
			});
		}

		try {
			state = await this.transitionToRunning(state);
			this.elapsedOffset = state.activeElapsedMs;

			const plan = await this.planStore.get(state.planId);
			if (!plan) throw new Error(`plan not found: ${state.planId}`);

			for (const task of plan.tasks) {
				state = (await this.workspace.getState(runId))!;
				if (state.status !== "running" || this.shouldStop(state)) break;

				// Skip tasks that already reached a terminal state (resume safety)
				const taskState = state.taskStates[task.id];
				if (taskState && TERMINAL_TASK_STATUSES.has(taskState.status)) {
					continue;
				}

				if (this.isTimedOut(state)) {
					await this.handleTimeout(state, plan);
					return (await this.workspace.getState(runId))!;
				}

				if (signal.aborted) break;
				await this.executeTask(state, task, signal);
			}

			state = (await this.workspace.getState(runId))!;
			if (state.status === "running" && !this.shouldStop(state)) {
				await this.runFinalizer(state, plan, signal);
			}

			return (await this.workspace.getState(runId))!;
		} catch (error) {
			if (signal.aborted) {
				const current = await this.workspace.getState(runId);
				if (current && this.shouldStop(current)) {
					return current;
				}
			}
			return await this.failRun(runId, error);
		} finally {
			this.abortController = null;
			this.leaseOwnerId = null;
		}
	}

	async pauseRun(runId: string, reason: string): Promise<TeamRunState> {
		const state = await this.workspace.getState(runId);
		if (!state) throw new Error(`run not found: ${runId}`);
		if (state.status !== "running") throw new Error(`can only pause running run, current: ${state.status}`);

		state.status = "paused";
		state.pauseReason = reason;
		state.lastError = reason;
		state.activeElapsedMs = this.accumulateElapsed(state);
		state.lease = null;
		state.updatedAt = now();

		if (state.currentTaskId) {
			const ts = state.taskStates[state.currentTaskId];
			if (ts) {
				ts.status = "interrupted";
				ts.progress = { phase: "interrupted", message: progressMessages.interrupted, updatedAt: now() };
			}
		}

		await this.workspace.saveState(state);

		this.abortController?.abort(new Error(reason));

		return state;
	}

	async resumeRun(runId: string): Promise<TeamRunState> {
		const state = await this.workspace.getState(runId);
		if (!state) throw new Error(`run not found: ${runId}`);
		if (state.status !== "paused") throw new Error(`can only resume paused run, current: ${state.status}`);

		this.elapsedOffset = state.activeElapsedMs;
		state.status = "queued";
		state.lease = null;
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
		state.lease = null;
		state.updatedAt = now();

		for (const [tid, ts] of Object.entries(state.taskStates)) {
			if (ts.status === "running" || ts.status === "pending" || ts.status === "interrupted") {
				ts.status = "cancelled";
				ts.progress = { phase: "cancelled", message: progressMessages.cancelled, updatedAt: now() };
				state.summary.cancelledTasks++;
			}
		}

		await this.workspace.saveState(state);

		this.abortController?.abort(new Error(reason));

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

	private async executeTask(initialState: TeamRunState, task: TeamTask, signal: AbortSignal): Promise<void> {
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
			if (this.shouldStop(state)) return;
			state.taskStates[task.id]!.attemptCount = attemptCount;
			const { attemptId, attemptRoot } = await this.workspace.createAttempt(state.runId, task.id);
			state.taskStates[task.id]!.activeAttemptId = attemptId;
			await this.workspace.saveState(state);

			const workUnitResult = await this.runWorkUnit(state, task, attemptId, attemptRoot, signal);

			state = (await this.workspace.getState(state.runId))!;
			const currentTs = state.taskStates[task.id]!;

			if (currentTs.status === "interrupted" || currentTs.status === "cancelled") return;
			if (this.shouldStop(state)) return;

			const watcherResult = await this.runWatcherPhase(state, task, attemptId, workUnitResult, signal);

			// Re-read state after watcher returns — external cancel may have landed
			state = (await this.workspace.getState(state.runId))!;
			if (this.shouldStop(state)) return;
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

	private async runWorkUnit(state: TeamRunState, task: TeamTask, attemptId: string, attemptRoot: string, signal: AbortSignal): Promise<"passed" | "failed"> {
		const runId = state.runId;
		let checkerRevision = 0;
		let lastFeedback: string | undefined;

		while (true) {
			const freshState = await this.workspace.getState(runId);
			if (!freshState || freshState.status !== "running" || this.shouldStop(freshState)) return "failed";

			const workerStarted = new Date();
			let workerOut: import("./role-runner.js").WorkerOutput;
			try {
				workerOut = await runWithTimeout("worker", this.phaseTimeouts.workerMs, signal, async (localSignal) => {
					return this.roleRunner.runWorker({
						runId, task, attemptId,
						workDir: `${attemptRoot}/work`,
						outputDir: `${attemptRoot}/output`,
						acceptanceRules: task.acceptance.rules,
						feedback: lastFeedback,
						signal: localSignal,
					});
				});
			} catch (error) {
				const workerFinished = new Date();
				await writeTimingSpan(this.dataDir, {
					runId, taskId: task.id, attemptId, phase: "worker",
					startedAt: workerStarted.toISOString(), finishedAt: workerFinished.toISOString(),
					durationMs: workerFinished.getTime() - workerStarted.getTime(),
				});
				if (error instanceof Error && error.message === "worker timeout") {
					const s = (await this.workspace.getState(runId))!;
					if (this.shouldStop(s)) return "failed";
					const failRef = await this.workspace.writeFailedResult(runId, task.id, attemptId, "worker timeout");
					await this.workspace.updateAttemptStatus(runId, task.id, attemptId, "failed");
					s.taskStates[task.id]!.resultRef = failRef;
					s.taskStates[task.id]!.errorSummary = "worker timeout";
					await this.workspace.saveState(s);
					return "failed";
				}
				throw error;
			}

			// Re-read after worker returns — cancel may have landed during execution
			if (this.shouldStop((await this.workspace.getState(runId)))) return "failed";

			const workerOutputIdx = checkerRevision + 1;
			const workerRef = await this.workspace.writeWorkerOutput(runId, task.id, attemptId, workerOutputIdx, workerOut.content);

			const workerFinished = new Date();
			await writeTimingSpan(this.dataDir, {
				runId, taskId: task.id, attemptId, phase: "worker",
				startedAt: workerStarted.toISOString(), finishedAt: workerFinished.toISOString(),
				durationMs: workerFinished.getTime() - workerStarted.getTime(),
			});

			const checkingState = await this.workspace.getState(runId);
			if (checkingState && !this.shouldStop(checkingState)) {
				checkingState.taskStates[task.id]!.progress = { phase: "checker_reviewing", message: progressMessages.checker_reviewing, updatedAt: now() };
				checkingState.updatedAt = now();
				await this.workspace.saveState(checkingState);
			}

			const checkerStarted = new Date();
			let checkerOut: import("./role-runner.js").CheckerOutput;
			try {
				checkerOut = await runWithTimeout("checker", this.phaseTimeouts.checkerMs, signal, async (localSignal) => {
					return this.roleRunner.runChecker({
						runId, task, attemptId,
						workerOutputRef: workerRef,
						acceptanceRules: task.acceptance.rules,
						signal: localSignal,
					});
				});
			} catch (error) {
				const checkerFinished = new Date();
				await writeTimingSpan(this.dataDir, {
					runId, taskId: task.id, attemptId, phase: "checker",
					startedAt: checkerStarted.toISOString(), finishedAt: checkerFinished.toISOString(),
					durationMs: checkerFinished.getTime() - checkerStarted.getTime(),
				});
				if (error instanceof Error && error.message === "checker timeout") {
					const s = (await this.workspace.getState(runId))!;
					if (this.shouldStop(s)) return "failed";
					const failRef = await this.workspace.writeFailedResult(runId, task.id, attemptId, "checker timeout");
					await this.workspace.updateAttemptStatus(runId, task.id, attemptId, "failed");
					s.taskStates[task.id]!.resultRef = failRef;
					s.taskStates[task.id]!.errorSummary = "checker timeout";
					await this.workspace.saveState(s);
					return "failed";
				}
				throw error;
			}

			// Re-read after checker returns — cancel may have landed during execution
			if (this.shouldStop((await this.workspace.getState(runId)))) return "failed";

			await this.workspace.writeCheckerVerdict(runId, task.id, attemptId, checkerRevision + 1, checkerOut);
			if (checkerOut.feedback) {
				await this.workspace.writeCheckerOutput(runId, task.id, attemptId, checkerRevision + 1, checkerOut.feedback);
			}

			const checkerFinished = new Date();
			await writeTimingSpan(this.dataDir, {
				runId, taskId: task.id, attemptId, phase: "checker",
				startedAt: checkerStarted.toISOString(), finishedAt: checkerFinished.toISOString(),
				durationMs: checkerFinished.getTime() - checkerStarted.getTime(),
			});

			if (checkerOut.verdict === "pass") {
				const resultContent = checkerOut.resultContent ?? workerOut.content;
				const s = (await this.workspace.getState(runId))!;
				if (this.shouldStop(s)) return "failed";
				const resultRef = await this.workspace.writeAcceptedResult(runId, task.id, attemptId, resultContent);
				await this.workspace.updateAttemptStatus(runId, task.id, attemptId, "succeeded");
				s.taskStates[task.id]!.resultRef = resultRef;
				await this.workspace.saveState(s);
				return "passed";
			}

			if (checkerOut.verdict === "fail") {
				const failContent = checkerOut.resultContent ?? checkerOut.reason;
				const s = (await this.workspace.getState(runId))!;
				if (this.shouldStop(s)) return "failed";
				const failRef = await this.workspace.writeFailedResult(runId, task.id, attemptId, failContent);
				await this.workspace.updateAttemptStatus(runId, task.id, attemptId, "failed");
				s.taskStates[task.id]!.resultRef = failRef;
				s.taskStates[task.id]!.errorSummary = checkerOut.reason;
				await this.workspace.saveState(s);
				return "failed";
			}

			checkerRevision++;
			lastFeedback = checkerOut.feedback;
			if (checkerRevision >= this.maxCheckerRevisions) {
				const s = (await this.workspace.getState(runId))!;
				if (this.shouldStop(s)) return "failed";
				const failRef = await this.workspace.writeFailedResult(runId, task.id, attemptId, `checker revision limit (${this.maxCheckerRevisions}) exceeded`);
				await this.workspace.updateAttemptStatus(runId, task.id, attemptId, "failed");
				s.taskStates[task.id]!.resultRef = failRef;
				s.taskStates[task.id]!.errorSummary = "checker revision limit exceeded";
				await this.workspace.saveState(s);
				return "failed";
			}
		}
	}

	private async runWatcherPhase(state: TeamRunState, task: TeamTask, attemptId: string, workUnitStatus: "passed" | "failed", signal: AbortSignal) {
		const current = await this.workspace.getState(state.runId);
		if (current && !this.shouldStop(current)) {
			current.taskStates[task.id]!.progress = { phase: "watcher_reviewing", message: progressMessages.watcher_reviewing, updatedAt: now() };
			current.updatedAt = now();
			await this.workspace.saveState(current);
		}
		const ts = state.taskStates[task.id];

		const watcherStarted = new Date();
		let watcherOut: import("./role-runner.js").WatcherOutput;
		try {
			watcherOut = await runWithTimeout("watcher", this.phaseTimeouts.watcherMs, signal, async (localSignal) => {
				return this.roleRunner.runWatcher({
					runId: state.runId,
					task,
					attemptId,
					workUnitStatus,
					resultRef: ts?.resultRef ?? null,
					errorSummary: ts?.errorSummary ?? null,
					signal: localSignal,
				});
			});
		} catch (error) {
			const watcherFinished = new Date();
			await writeTimingSpan(this.dataDir, {
				runId: state.runId, taskId: task.id, attemptId, phase: "watcher",
				startedAt: watcherStarted.toISOString(), finishedAt: watcherFinished.toISOString(),
				durationMs: watcherFinished.getTime() - watcherStarted.getTime(),
			});
			if (error instanceof Error && error.message === "watcher timeout") {
				watcherOut = { decision: "confirm_failed", reason: "watcher timeout" };
				await this.workspace.writeWatcherReview(state.runId, task.id, attemptId, watcherOut);
				return watcherOut;
			}
			throw error;
		}

		await this.workspace.writeWatcherReview(state.runId, task.id, attemptId, watcherOut);
		const watcherFinished = new Date();
		await writeTimingSpan(this.dataDir, {
			runId: state.runId, taskId: task.id, attemptId, phase: "watcher",
			startedAt: watcherStarted.toISOString(), finishedAt: watcherFinished.toISOString(),
			durationMs: watcherFinished.getTime() - watcherStarted.getTime(),
		});

		return watcherOut;
	}

	private async runFinalizer(staleState: TeamRunState, plan: import("./types.js").TeamPlan, signal: AbortSignal): Promise<void> {
		const state = (await this.workspace.getState(staleState.runId))!;
		if (this.shouldStop(state)) return;

		const taskResults = plan.tasks.map(t => {
			const ts = state.taskStates[t.id]!;
			return {
				taskId: t.id,
				status: (ts.status === "succeeded" ? "succeeded" : "failed") as "succeeded" | "failed",
				resultRef: ts.resultRef,
				errorSummary: ts.errorSummary,
			};
		});

		let finalReport: string;
		let finalizerError: string | null = null;
		try {
			const finalizerOut = await runWithTimeout("finalizer", this.phaseTimeouts.finalizerMs, signal, async (localSignal) => {
				return this.roleRunner.runFinalizer({ runId: state.runId, plan, taskResults, signal: localSignal });
			});
			finalReport = finalizerOut.finalReport;
		} catch (error) {
			finalizerError = error instanceof Error ? error.message : String(error);
			finalReport = generateFallbackReport(plan, state, error);
		}

		// Re-read state after finalizer returns — external cancel may have landed
		const freshState = (await this.workspace.getState(staleState.runId))!;
		if (this.shouldStop(freshState)) return;

		await this.workspace.writeFinalReport(freshState.runId, finalReport);

		freshState.currentTaskId = null;
		const hasTaskFailures = taskResults.some(r => r.status === "failed");
		if (finalizerError) {
			freshState.status = "completed_with_failures";
			freshState.lastError = finalizerError;
		} else {
			freshState.status = hasTaskFailures ? "completed_with_failures" : "completed";
		}
		freshState.activeElapsedMs = this.accumulateElapsed(freshState);
		freshState.finishedAt = now();
		freshState.lease = null;
		freshState.updatedAt = now();
		await this.workspace.saveState(freshState);
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
		state.lease = null;
		state.updatedAt = now();
		await this.workspace.saveState(state);
	}

	private async failRun(runId: string, error: unknown): Promise<TeamRunState> {
		const state = await this.workspace.getState(runId);
		if (!state) {
			throw error instanceof Error ? error : new Error("run failed");
		}
		const message = error instanceof Error ? error.message : String(error);
		if (state.status === "completed" || state.status === "completed_with_failures" || state.status === "failed" || state.status === "cancelled") {
			return state;
		}
		for (const taskState of Object.values(state.taskStates)) {
			if (taskState.status === "pending" || taskState.status === "running" || taskState.status === "interrupted") {
				taskState.status = "failed";
				taskState.errorSummary = taskState.errorSummary ?? message;
				taskState.progress = { phase: "failed", message: progressMessages.failed, updatedAt: now() };
			}
		}
		const failedTasks = Object.values(state.taskStates).filter((taskState) => taskState.status === "failed").length;
		const succeededTasks = Object.values(state.taskStates).filter((taskState) => taskState.status === "succeeded").length;
		const cancelledTasks = Object.values(state.taskStates).filter((taskState) => taskState.status === "cancelled").length;
		state.summary = {
			totalTasks: state.summary.totalTasks,
			succeededTasks,
			failedTasks,
			cancelledTasks,
		};
		state.status = succeededTasks > 0 ? "completed_with_failures" : "failed";
		state.lastError = message;
		state.activeElapsedMs = this.accumulateElapsed(state);
		state.finishedAt = now();
		state.lease = null;
		state.updatedAt = now();
		await this.workspace.saveState(state);
		return state;
	}

	private shouldStop(state: TeamRunState | null | undefined): boolean {
		if (!state) return true;
		if (isRunExternallyStopped(state.status)) return true;
		if (this.leaseOwnerId && state.lease?.ownerId !== this.leaseOwnerId) return true;
		return false;
	}

	private accumulateElapsed(state: TeamRunState): number {
		if (!state.startedAt) return this.elapsedOffset;
		const started = new Date(state.startedAt).getTime();
		const current = Date.now();
		return this.elapsedOffset + (current - started);
	}
}
