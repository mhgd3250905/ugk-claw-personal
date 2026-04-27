import { randomUUID } from "node:crypto";
import { ConnDatabase } from "./conn-db.js";
import { computeNextRunAt, type ConnSchedule, type ConnStatus } from "./conn-store.js";

export type ConnRunStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export interface ConnRunRecord {
	runId: string;
	connId: string;
	status: ConnRunStatus;
	scheduledAt: string;
	claimedAt?: string;
	startedAt?: string;
	finishedAt?: string;
	leaseOwner?: string;
	leaseUntil?: string;
	workspacePath: string;
	sessionFile?: string;
	resolvedSnapshot?: Record<string, unknown>;
	resultSummary?: string;
	resultText?: string;
	errorText?: string;
	deliveredAt?: string;
	retryOfRunId?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ConnRunEventRecord {
	eventId: string;
	runId: string;
	seq: number;
	eventType: string;
	event: Record<string, unknown>;
	createdAt: string;
}

export interface ConnRunFileRecord {
	fileId: string;
	runId: string;
	kind: string;
	relativePath: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	createdAt: string;
}

export interface ConnRunStoreOptions {
	database: ConnDatabase;
}

export interface CreateConnRunInput {
	runId?: string;
	connId: string;
	scheduledAt: string;
	workspacePath: string;
	sessionFile?: string;
	resolvedSnapshot?: Record<string, unknown>;
	retryOfRunId?: string;
	now?: Date;
}

export interface ClaimConnRunInput {
	workerId: string;
	now?: Date;
	leaseMs?: number;
}

export interface HeartbeatConnRunInput {
	runId: string;
	workerId: string;
	now?: Date;
	leaseMs?: number;
}

export interface CompleteConnRunInput {
	runId: string;
	leaseOwner?: string;
	summary: string;
	text?: string;
	finishedAt?: Date;
}

export interface FailConnRunInput {
	runId: string;
	leaseOwner?: string;
	summary: string;
	errorText: string;
	finishedAt?: Date;
}

export interface AppendConnRunEventInput {
	runId: string;
	leaseOwner?: string;
	eventType: string;
	event: Record<string, unknown>;
	createdAt?: Date;
}

export interface RecordConnRunFileInput {
	runId: string;
	leaseOwner?: string;
	kind: string;
	relativePath: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	createdAt?: Date;
}

export interface UpdateConnRunRuntimeInput {
	runId: string;
	leaseOwner?: string;
	workspacePath?: string;
	sessionFile?: string;
	resolvedSnapshot?: Record<string, unknown>;
	now?: Date;
}

interface ConnRunRow {
	run_id: string;
	conn_id: string;
	status: ConnRunStatus;
	scheduled_at: string;
	claimed_at?: string | null;
	started_at?: string | null;
	finished_at?: string | null;
	lease_owner?: string | null;
	lease_until?: string | null;
	workspace_path: string;
	session_file?: string | null;
	resolved_snapshot_json?: string | null;
	result_summary?: string | null;
	result_text?: string | null;
	error_text?: string | null;
	delivered_at?: string | null;
	retry_of_run_id?: string | null;
	created_at: string;
	updated_at: string;
}

interface ConnRunEventRow {
	event_id: string;
	run_id: string;
	seq: number;
	event_type: string;
	event_json: string;
	created_at: string;
}

interface ConnRunFileRow {
	file_id: string;
	run_id: string;
	kind: string;
	relative_path: string;
	file_name: string;
	mime_type: string;
	size_bytes: number;
	created_at: string;
}

interface ConnScheduleRow {
	conn_id: string;
	schedule_json: string;
	status: ConnStatus;
}

const DEFAULT_LEASE_MS = 5 * 60_000;

export class ConnRunStore {
	constructor(private readonly options: ConnRunStoreOptions) {}

	async createRun(input: CreateConnRunInput): Promise<ConnRunRecord> {
		const now = input.now ?? new Date();
		const createdAt = now.toISOString();
		const run: ConnRunRecord = {
			runId: input.runId ?? randomUUID(),
			connId: input.connId,
			status: "pending",
			scheduledAt: new Date(input.scheduledAt).toISOString(),
			workspacePath: input.workspacePath,
			...(input.sessionFile ? { sessionFile: input.sessionFile } : {}),
			...(input.resolvedSnapshot ? { resolvedSnapshot: input.resolvedSnapshot } : {}),
			...(input.retryOfRunId ? { retryOfRunId: input.retryOfRunId } : {}),
			createdAt,
			updatedAt: createdAt,
		};

		this.options.database.run(
			[
				"INSERT INTO conn_runs (",
				"run_id, conn_id, status, scheduled_at, workspace_path, session_file, resolved_snapshot_json,",
				"retry_of_run_id, created_at, updated_at",
				") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			].join(" "),
			run.runId,
			run.connId,
			run.status,
			run.scheduledAt,
			run.workspacePath,
			run.sessionFile,
			serializeOptionalJson(run.resolvedSnapshot),
			run.retryOfRunId,
			run.createdAt,
			run.updatedAt,
		);

		return run;
	}

	async getRun(runId: string): Promise<ConnRunRecord | undefined> {
		const row = this.options.database.get<ConnRunRow>(
			"SELECT * FROM conn_runs WHERE run_id = ?",
			runId,
		);
		return row ? rowToRun(row) : undefined;
	}

	async listRunsForConn(connId: string): Promise<ConnRunRecord[]> {
		const rows = this.options.database.all<ConnRunRow>(
			"SELECT * FROM conn_runs WHERE conn_id = ? ORDER BY scheduled_at DESC, created_at DESC, run_id DESC",
			connId,
		);
		return rows.map(rowToRun);
	}

	async listLatestRunsForConns(connIds: readonly string[]): Promise<Record<string, ConnRunRecord | undefined>> {
		const uniqueConnIds = Array.from(
			new Set(connIds.map((connId) => connId.trim()).filter(Boolean)),
		);
		if (uniqueConnIds.length === 0) {
			return {};
		}

		const placeholders = uniqueConnIds.map(() => "?").join(", ");
		const rows = this.options.database.all<ConnRunRow>(
			[
				"SELECT * FROM (",
				"SELECT conn_runs.*,",
				"ROW_NUMBER() OVER (PARTITION BY conn_id ORDER BY scheduled_at DESC, created_at DESC, run_id DESC) AS row_number",
				"FROM conn_runs",
				`WHERE conn_id IN (${placeholders})`,
				") WHERE row_number = 1",
			].join(" "),
			...uniqueConnIds,
		);

		const latestRunsByConnId: Record<string, ConnRunRecord | undefined> = {};
		for (const row of rows) {
			latestRunsByConnId[row.conn_id] = rowToRun(row);
		}
		return latestRunsByConnId;
	}

	async listStaleRuns(now: Date = new Date()): Promise<ConnRunRecord[]> {
		const nowIso = now.toISOString();
		const rows = this.options.database.all<ConnRunRow>(
			[
				"SELECT * FROM conn_runs",
				"WHERE status = 'running' AND lease_until IS NOT NULL AND lease_until <= ?",
				"ORDER BY scheduled_at ASC, created_at ASC, run_id ASC",
			].join(" "),
			nowIso,
		);
		return rows.map(rowToRun);
	}

	async claimNextDue(input: ClaimConnRunInput): Promise<ConnRunRecord | undefined> {
		const now = input.now ?? new Date();
		const nowIso = now.toISOString();
		const leaseUntilIso = new Date(now.getTime() + (input.leaseMs ?? DEFAULT_LEASE_MS)).toISOString();
		let runId: string | undefined;

		try {
			this.options.database.exec("BEGIN IMMEDIATE");
			const due = this.options.database.get<Pick<ConnRunRow, "run_id">>(
				[
					"SELECT run_id FROM conn_runs",
					"WHERE",
					"((status = 'pending' AND scheduled_at <= ?)",
					"OR (status = 'running' AND lease_until IS NOT NULL AND lease_until <= ?))",
					"ORDER BY scheduled_at ASC, created_at ASC, run_id ASC",
					"LIMIT 1",
				].join(" "),
				nowIso,
				nowIso,
			);
			if (!due) {
				this.options.database.exec("COMMIT");
				return undefined;
			}
			runId = due.run_id;
			this.options.database.run(
				[
					"UPDATE conn_runs SET",
					"status = 'running', claimed_at = ?, started_at = COALESCE(started_at, ?),",
					"lease_owner = ?, lease_until = ?, updated_at = ?",
					"WHERE run_id = ?",
				].join(" "),
				nowIso,
				nowIso,
				input.workerId,
				leaseUntilIso,
				nowIso,
				runId,
			);
			this.options.database.exec("COMMIT");
		} catch (error) {
			this.rollbackQuietly();
			throw error;
		}

		return runId ? await this.getRun(runId) : undefined;
	}

	async updateRuntimeInfo(input: UpdateConnRunRuntimeInput): Promise<ConnRunRecord | undefined> {
		const existing = await this.getRun(input.runId);
		if (!existing) {
			return undefined;
		}
		if (!this.isCurrentLeaseOwner(input.runId, input.leaseOwner)) {
			return undefined;
		}

		const updatedAt = (input.now ?? new Date()).toISOString();
		this.options.database.run(
			[
				"UPDATE conn_runs SET",
				"workspace_path = ?, session_file = ?, resolved_snapshot_json = ?, updated_at = ?",
				"WHERE run_id = ?",
			].join(" "),
			input.workspacePath ?? existing.workspacePath,
			input.sessionFile ?? existing.sessionFile,
			serializeOptionalJson(input.resolvedSnapshot ?? existing.resolvedSnapshot),
			updatedAt,
			input.runId,
		);

		return await this.getRun(input.runId);
	}

	async heartbeatRun(input: HeartbeatConnRunInput): Promise<ConnRunRecord | undefined> {
		const now = input.now ?? new Date();
		const nowIso = now.toISOString();
		const leaseUntilIso = new Date(now.getTime() + (input.leaseMs ?? DEFAULT_LEASE_MS)).toISOString();

		this.options.database.run(
			[
				"UPDATE conn_runs SET",
				"lease_until = ?, updated_at = ?",
				"WHERE run_id = ? AND status = 'running' AND lease_owner = ?",
			].join(" "),
			leaseUntilIso,
			nowIso,
			input.runId,
			input.workerId,
		);

		return await this.getRun(input.runId);
	}

	async completeRun(input: CompleteConnRunInput): Promise<ConnRunRecord | undefined> {
		return await this.finishRun({
			runId: input.runId,
			leaseOwner: input.leaseOwner,
			status: "succeeded",
			summary: input.summary,
			resultText: input.text,
			finishedAt: input.finishedAt,
		});
	}

	async failRun(input: FailConnRunInput): Promise<ConnRunRecord | undefined> {
		return await this.finishRun({
			runId: input.runId,
			leaseOwner: input.leaseOwner,
			status: "failed",
			summary: input.summary,
			errorText: input.errorText,
			finishedAt: input.finishedAt,
		});
	}

	async appendEvent(input: AppendConnRunEventInput): Promise<ConnRunEventRecord | undefined> {
		if (!this.isCurrentLeaseOwner(input.runId, input.leaseOwner)) {
			return undefined;
		}
		const createdAt = (input.createdAt ?? new Date()).toISOString();
		const row = this.options.database.get<{ next_seq: number | null }>(
			"SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM conn_run_events WHERE run_id = ?",
			input.runId,
		);
		const event: ConnRunEventRecord = {
			eventId: randomUUID(),
			runId: input.runId,
			seq: row?.next_seq ?? 1,
			eventType: input.eventType,
			event: input.event,
			createdAt,
		};

		this.options.database.run(
			[
				"INSERT INTO conn_run_events (",
				"event_id, run_id, seq, event_type, event_json, created_at",
				") VALUES (?, ?, ?, ?, ?, ?)",
			].join(" "),
			event.eventId,
			event.runId,
			event.seq,
			event.eventType,
			JSON.stringify(event.event),
			event.createdAt,
		);

		return event;
	}

	async listEvents(runId: string): Promise<ConnRunEventRecord[]> {
		const rows = this.options.database.all<ConnRunEventRow>(
			"SELECT * FROM conn_run_events WHERE run_id = ? ORDER BY seq ASC",
			runId,
		);
		return rows.map(rowToEvent);
	}

	async recordFile(input: RecordConnRunFileInput): Promise<ConnRunFileRecord | undefined> {
		if (!this.isCurrentLeaseOwner(input.runId, input.leaseOwner)) {
			return undefined;
		}
		const file: ConnRunFileRecord = {
			fileId: randomUUID(),
			runId: input.runId,
			kind: input.kind,
			relativePath: input.relativePath,
			fileName: input.fileName,
			mimeType: input.mimeType,
			sizeBytes: input.sizeBytes,
			createdAt: (input.createdAt ?? new Date()).toISOString(),
		};

		this.options.database.run(
			[
				"INSERT INTO conn_run_files (",
				"file_id, run_id, kind, relative_path, file_name, mime_type, size_bytes, created_at",
				") VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			].join(" "),
			file.fileId,
			file.runId,
			file.kind,
			file.relativePath,
			file.fileName,
			file.mimeType,
			file.sizeBytes,
			file.createdAt,
		);

		return file;
	}

	async listFiles(runId: string): Promise<ConnRunFileRecord[]> {
		const rows = this.options.database.all<ConnRunFileRow>(
			"SELECT * FROM conn_run_files WHERE run_id = ? ORDER BY created_at ASC, file_name ASC, file_id ASC",
			runId,
		);
		return rows.map(rowToFile);
	}

	private async finishRun(input: {
		runId: string;
		leaseOwner?: string;
		status: "succeeded" | "failed";
		summary: string;
		resultText?: string;
		errorText?: string;
		finishedAt?: Date;
	}): Promise<ConnRunRecord | undefined> {
		const existing = await this.getRun(input.runId);
		if (!existing) {
			return undefined;
		}

		const finishedAt = input.finishedAt ?? new Date();
		const finishedAtIso = finishedAt.toISOString();

		try {
			this.options.database.exec("BEGIN IMMEDIATE");
			if (input.leaseOwner) {
				this.options.database.run(
					[
						"UPDATE conn_runs SET",
						"status = ?, finished_at = ?, lease_owner = NULL, lease_until = NULL,",
						"result_summary = ?, result_text = ?, error_text = ?, updated_at = ?",
						"WHERE run_id = ? AND status = 'running' AND lease_owner = ?",
					].join(" "),
					input.status,
					finishedAtIso,
					input.summary,
					input.resultText,
					input.errorText,
					finishedAtIso,
					input.runId,
					input.leaseOwner,
				);
			} else {
				this.options.database.run(
					[
						"UPDATE conn_runs SET",
						"status = ?, finished_at = ?, lease_owner = NULL, lease_until = NULL,",
						"result_summary = ?, result_text = ?, error_text = ?, updated_at = ?",
						"WHERE run_id = ?",
					].join(" "),
					input.status,
					finishedAtIso,
					input.summary,
					input.resultText,
					input.errorText,
					finishedAtIso,
					input.runId,
				);
			}
			const changes = this.options.database.get<{ changes: number }>("SELECT changes() AS changes")?.changes ?? 0;
			if (changes === 0) {
				this.options.database.exec("COMMIT");
				return undefined;
			}
			this.updateOwningConnAfterRun(existing.connId, input.runId, finishedAt);
			this.options.database.exec("COMMIT");
		} catch (error) {
			this.rollbackQuietly();
			throw error;
		}

		return await this.getRun(input.runId);
	}

	private updateOwningConnAfterRun(connId: string, runId: string, finishedAt: Date): void {
		const conn = this.options.database.get<ConnScheduleRow>(
			"SELECT conn_id, schedule_json, status FROM conns WHERE conn_id = ?",
			connId,
		);
		if (!conn) {
			return;
		}

		const finishedAtIso = finishedAt.toISOString();
		const schedule = parseJsonOrUndefined<ConnSchedule>(conn.schedule_json);
		const nextRunAt = schedule ? computeNextRunAt(schedule, finishedAt, finishedAt) : undefined;
		const nextStatus = conn.status === "active" ? (nextRunAt ? "active" : "completed") : conn.status;
		const nextRunAtIso = conn.status === "active" ? nextRunAt?.toISOString() : undefined;

		this.options.database.run(
			[
				"UPDATE conns SET",
				"status = ?, last_run_at = ?, last_run_id = ?, next_run_at = ?, updated_at = ?",
				"WHERE conn_id = ?",
			].join(" "),
			nextStatus,
			finishedAtIso,
			runId,
			nextRunAtIso,
			finishedAtIso,
			conn.conn_id,
		);
	}

	private rollbackQuietly(): void {
		try {
			this.options.database.exec("ROLLBACK");
		} catch {
			// The transaction may already be closed by SQLite.
		}
	}

	private isCurrentLeaseOwner(runId: string, leaseOwner: string | undefined): boolean {
		if (!leaseOwner) {
			return true;
		}
		const row = this.options.database.get<Pick<ConnRunRow, "status" | "lease_owner">>(
			"SELECT status, lease_owner FROM conn_runs WHERE run_id = ?",
			runId,
		);
		return row?.status === "running" && row.lease_owner === leaseOwner;
	}
}

function rowToRun(row: ConnRunRow): ConnRunRecord {
	const resolvedSnapshot = row.resolved_snapshot_json
		? parseJsonOrUndefined<Record<string, unknown>>(row.resolved_snapshot_json)
		: undefined;
	return {
		runId: row.run_id,
		connId: row.conn_id,
		status: row.status,
		scheduledAt: row.scheduled_at,
		...(row.claimed_at ? { claimedAt: row.claimed_at } : {}),
		...(row.started_at ? { startedAt: row.started_at } : {}),
		...(row.finished_at ? { finishedAt: row.finished_at } : {}),
		...(row.lease_owner ? { leaseOwner: row.lease_owner } : {}),
		...(row.lease_until ? { leaseUntil: row.lease_until } : {}),
		workspacePath: row.workspace_path,
		...(row.session_file ? { sessionFile: row.session_file } : {}),
		...(resolvedSnapshot ? { resolvedSnapshot } : {}),
		...(row.result_summary ? { resultSummary: row.result_summary } : {}),
		...(row.result_text ? { resultText: row.result_text } : {}),
		...(row.error_text ? { errorText: row.error_text } : {}),
		...(row.delivered_at ? { deliveredAt: row.delivered_at } : {}),
		...(row.retry_of_run_id ? { retryOfRunId: row.retry_of_run_id } : {}),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function rowToEvent(row: ConnRunEventRow): ConnRunEventRecord {
	return {
		eventId: row.event_id,
		runId: row.run_id,
		seq: row.seq,
		eventType: row.event_type,
		event: parseJsonOrUndefined<Record<string, unknown>>(row.event_json) ?? {},
		createdAt: row.created_at,
	};
}

function rowToFile(row: ConnRunFileRow): ConnRunFileRecord {
	return {
		fileId: row.file_id,
		runId: row.run_id,
		kind: row.kind,
		relativePath: row.relative_path,
		fileName: row.file_name,
		mimeType: row.mime_type,
		sizeBytes: row.size_bytes,
		createdAt: row.created_at,
	};
}

function serializeOptionalJson(value: Record<string, unknown> | undefined): string | undefined {
	return value ? JSON.stringify(value) : undefined;
}

function parseJson<T>(value: string, fieldName: string): T {
	try {
		return JSON.parse(value) as T;
	} catch {
		throw new Error(`Invalid JSON in conn run database field ${fieldName}`);
	}
}

function parseJsonOrUndefined<T>(value: string): T | undefined {
	try {
		return JSON.parse(value) as T;
	} catch {
		return undefined;
	}
}
