export type RunStatus = "queued" | "running" | "paused" | "completed" | "completed_with_failures" | "failed" | "cancelled";
export type TaskStatus = "pending" | "running" | "interrupted" | "succeeded" | "failed" | "cancelled";
export type AttemptStatus = "running" | "succeeded" | "failed" | "interrupted" | "cancelled";
export type CheckerVerdict = "pass" | "revise" | "fail";
export type WatcherDecision = "accept_task" | "confirm_failed" | "request_revision";
export type WatcherRevisionMode = "amend" | "redo";
export type ProgressPhase =
	| "pending"
	| "creating_workunit"
	| "creating_worker_session"
	| "worker_running"
	| "checker_reviewing"
	| "worker_revising"
	| "watcher_reviewing"
	| "finalizer_running"
	| "writing_result"
	| "succeeded"
	| "failed"
	| "interrupted"
	| "cancelled";

export interface TeamUnit {
	schemaVersion: "team/team-unit-1";
	teamUnitId: string;
	title: string;
	description: string;
	watcherProfileId: string;
	workerProfileId: string;
	checkerProfileId: string;
	finalizerProfileId: string;
	archived: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface TeamTask {
	id: string;
	title: string;
	input: { text: string; payload?: Record<string, unknown> };
	acceptance: { rules: string[] };
}

export interface TeamPlan {
	schemaVersion: "team/plan-1";
	planId: string;
	title: string;
	defaultTeamUnitId: string;
	goal: { text: string };
	tasks: TeamTask[];
	outputContract: { text: string };
	archived: boolean;
	createdAt: string;
	updatedAt: string;
	runCount: number;
}

export interface TeamProgress {
	phase: ProgressPhase;
	message: string;
	updatedAt: string;
}

export interface TeamTaskState {
	status: TaskStatus;
	attemptCount: number;
	activeAttemptId: string | null;
	resultRef: string | null;
	errorSummary: string | null;
	progress: TeamProgress;
}

export interface TeamRunState {
	schemaVersion: "team/state-1";
	runId: string;
	planId: string;
	teamUnitId: string;
	status: RunStatus;
	createdAt: string;
	queuedAt: string;
	startedAt: string | null;
	finishedAt: string | null;
	activeElapsedMs: number;
	currentTaskId: string | null;
	taskStates: Record<string, TeamTaskState>;
	summary: { totalTasks: number; succeededTasks: number; failedTasks: number; cancelledTasks: number };
	pauseReason: string | null;
	lastError: string | null;
	lease?: TeamRunLease | null;
	updatedAt: string;
}

export interface TeamRunLease {
	ownerId: string;
	acquiredAt: string;
	heartbeatAt: string;
	expiresAt: string;
}
