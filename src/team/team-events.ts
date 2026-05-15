// v0.1 §16 — Team Event Types

export type TeamEventType =
	| "team_run_created"
	| "team_run_started"
	| "team_run_completed"
	| "team_run_failed"
	| "team_run_blocked"
	| "role_task_started"
	| "role_task_completed"
	| "role_task_failed"
	| "role_task_retrying"
	| "role_task_timeout"
	| "role_task_watchdog"
	| "stream_item_accepted"
	| "stream_item_rejected"
	| "stream_item_duplicate_skipped"
	| "team_run_cancelled"
	| "final_report_created";

export interface TeamEvent {
	eventId: string;
	teamRunId: string;
	eventType: TeamEventType;
	createdAt: string;
	data: unknown;
}
