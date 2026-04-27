import { randomUUID } from "node:crypto";
import type { ConnDatabase } from "./conn-db.js";
import type { ConversationNotificationFile } from "./conversation-notification-store.js";

export interface AgentActivityItem {
	activityId: string;
	scope: "agent";
	source: string;
	sourceId: string;
	runId?: string;
	conversationId?: string;
	kind: string;
	title: string;
	text: string;
	files: ConversationNotificationFile[];
	createdAt: string;
	readAt?: string;
}

export interface CreateAgentActivityInput {
	source: string;
	sourceId: string;
	runId?: string;
	conversationId?: string;
	kind: string;
	title: string;
	text: string;
	files?: ConversationNotificationFile[];
	createdAt?: Date;
}

export interface AgentActivityListOptions {
	limit?: number;
	before?: string;
	conversationId?: string;
	unreadOnly?: boolean;
}

export interface AgentActivityStoreOptions {
	database: ConnDatabase;
}

interface AgentActivityRow {
	activity_id: string;
	scope: string;
	source: string;
	source_id: string;
	run_id?: string | null;
	conversation_id?: string | null;
	kind: string;
	title: string;
	text: string;
	files_json: string;
	created_at: string;
	read_at?: string | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export class AgentActivityStore {
	constructor(private readonly options: AgentActivityStoreOptions) {}

	async create(input: CreateAgentActivityInput): Promise<AgentActivityItem> {
		const existing = input.runId
			? this.options.database.get<AgentActivityRow>(
					"SELECT * FROM agent_activity_items WHERE source = ? AND source_id = ? AND run_id = ?",
					input.source,
					input.sourceId,
					input.runId,
				)
			: undefined;
		if (existing) {
			return rowToActivity(existing);
		}

		const activity: AgentActivityItem = {
			activityId: randomUUID(),
			scope: "agent",
			source: input.source,
			sourceId: input.sourceId,
			...(input.runId ? { runId: input.runId } : {}),
			...(input.conversationId ? { conversationId: input.conversationId } : {}),
			kind: input.kind,
			title: input.title,
			text: input.text,
			files: input.files ?? [],
			createdAt: (input.createdAt ?? new Date()).toISOString(),
		};

		try {
			this.options.database.run(
				[
					"INSERT INTO agent_activity_items (",
					"activity_id, scope, source, source_id, run_id, conversation_id, kind, title, text, files_json, created_at",
					") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				].join(" "),
				activity.activityId,
				activity.scope,
				activity.source,
				activity.sourceId,
				activity.runId,
				activity.conversationId,
				activity.kind,
				activity.title,
				activity.text,
				JSON.stringify(activity.files),
				activity.createdAt,
			);
		} catch (error) {
			const concurrentExisting = input.runId && isSqliteUniqueConstraintError(error)
				? this.findBySourceRun(input.source, input.sourceId, input.runId)
				: undefined;
			if (concurrentExisting) {
				return concurrentExisting;
			}
			throw error;
		}

		return activity;
	}

	async get(activityId: string): Promise<AgentActivityItem | undefined> {
		const row = this.options.database.get<AgentActivityRow>(
			"SELECT * FROM agent_activity_items WHERE activity_id = ?",
			activityId,
		);
		return row ? rowToActivity(row) : undefined;
	}

	async list(options: AgentActivityListOptions = {}): Promise<AgentActivityItem[]> {
		const limit = clampLimit(options.limit);
		const conditions: string[] = [];
		const params: unknown[] = [];

		if (options.conversationId) {
			conditions.push("conversation_id = ?");
			params.push(options.conversationId);
		}
		if (options.unreadOnly) {
			conditions.push("read_at IS NULL");
		}
		if (options.before) {
			const cursor = parseActivityCursor(options.before);
			if (cursor.activityId) {
				conditions.push("(created_at < ? OR (created_at = ? AND activity_id < ?))");
				params.push(cursor.createdAt, cursor.createdAt, cursor.activityId);
			} else {
				conditions.push("created_at < ?");
				params.push(cursor.createdAt);
			}
		}

		const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
		const rows = this.options.database.all<AgentActivityRow>(
			[
				"SELECT * FROM agent_activity_items",
				whereClause,
				"ORDER BY created_at DESC, activity_id DESC",
				"LIMIT ?",
			].join(" "),
			...params,
			limit,
		);
		return rows.map(rowToActivity);
	}

	async markRead(activityId: string, now: Date = new Date()): Promise<boolean> {
		const existing = this.options.database.get<AgentActivityRow>(
			"SELECT * FROM agent_activity_items WHERE activity_id = ?",
			activityId,
		);
		if (!existing) {
			return false;
		}
		this.options.database.run(
			"UPDATE agent_activity_items SET read_at = ? WHERE activity_id = ?",
			now.toISOString(),
			activityId,
		);
		return true;
	}

	async markAllRead(now: Date = new Date()): Promise<number> {
		const timestamp = now.toISOString();
		const existing = this.options.database.get<{ unread_count: number }>(
			"SELECT COUNT(*) AS unread_count FROM agent_activity_items WHERE read_at IS NULL",
		);
		const unreadCount = Number(existing?.unread_count ?? 0);
		if (unreadCount < 1) {
			return 0;
		}
		this.options.database.run(
			"UPDATE agent_activity_items SET read_at = ? WHERE read_at IS NULL",
			timestamp,
		);
		return unreadCount;
	}

	async getUnreadCount(): Promise<number> {
		const row = this.options.database.get<{ unread_count: number }>(
			"SELECT COUNT(*) AS unread_count FROM agent_activity_items WHERE read_at IS NULL",
		);
		const unreadCount = row?.unread_count;
		return Number.isFinite(unreadCount) ? Number(unreadCount) : 0;
	}

	private findBySourceRun(source: string, sourceId: string, runId: string): AgentActivityItem | undefined {
		const row = this.options.database.get<AgentActivityRow>(
			"SELECT * FROM agent_activity_items WHERE source = ? AND source_id = ? AND run_id = ?",
			source,
			sourceId,
			runId,
		);
		return row ? rowToActivity(row) : undefined;
	}
}

function parseActivityCursor(value: string): { createdAt: string; activityId?: string } {
	const separatorIndex = value.lastIndexOf("|");
	if (separatorIndex <= 0 || separatorIndex >= value.length - 1) {
		return { createdAt: value };
	}
	return {
		createdAt: value.slice(0, separatorIndex),
		activityId: value.slice(separatorIndex + 1),
	};
}

function clampLimit(value: number | undefined): number {
	if (!Number.isFinite(value)) {
		return DEFAULT_LIMIT;
	}
	return Math.max(1, Math.min(Math.trunc(Number(value)), MAX_LIMIT));
}

function rowToActivity(row: AgentActivityRow): AgentActivityItem {
	return {
		activityId: row.activity_id,
		scope: "agent",
		source: row.source,
		sourceId: row.source_id,
		...(row.run_id ? { runId: row.run_id } : {}),
		...(row.conversation_id ? { conversationId: row.conversation_id } : {}),
		kind: row.kind,
		title: row.title,
		text: row.text,
		files: parseFiles(row.files_json),
		createdAt: row.created_at,
		...(row.read_at ? { readAt: row.read_at } : {}),
	};
}

function parseFiles(value: string): ConversationNotificationFile[] {
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed) ? (parsed as ConversationNotificationFile[]) : [];
	} catch {
		return [];
	}
}

function isSqliteUniqueConstraintError(error: unknown): boolean {
	return error instanceof Error && (
		"code" in error && (error as NodeJS.ErrnoException).code === "ERR_SQLITE_ERROR" ||
		/UNIQUE constraint failed/i.test(error.message)
	);
}
