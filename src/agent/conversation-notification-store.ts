import { randomUUID } from "node:crypto";
import type { ActivityFile } from "./activity-file.js";
import type { ConnDatabase } from "./conn-db.js";

export interface ConversationNotification {
	notificationId: string;
	conversationId: string;
	source: string;
	sourceId: string;
	runId?: string;
	kind: string;
	title: string;
	text: string;
	files: ActivityFile[];
	createdAt: string;
	readAt?: string;
}

export interface ConversationNotificationStoreOptions {
	database: ConnDatabase;
}

export interface CreateConversationNotificationInput {
	conversationId: string;
	source: string;
	sourceId: string;
	runId?: string;
	kind: string;
	title: string;
	text: string;
	files?: ActivityFile[];
	createdAt?: Date;
}

export interface ConversationNotificationSummary {
	count: number;
	latest?: ConversationNotification;
}

interface ConversationNotificationRow {
	notification_id: string;
	conversation_id: string;
	source: string;
	source_id: string;
	run_id?: string | null;
	kind: string;
	title: string;
	text: string;
	files_json: string;
	created_at: string;
	read_at?: string | null;
}

/**
 * @deprecated Legacy conversation-scoped notification store.
 * Current conn results are delivered through AgentActivityStore and
 * agent_activity_items; keep this store only for old data compatibility.
 */
export class ConversationNotificationStore {
	constructor(private readonly options: ConversationNotificationStoreOptions) {}

	async create(input: CreateConversationNotificationInput): Promise<ConversationNotification> {
		const existing = input.runId
			? this.options.database.get<ConversationNotificationRow>(
					"SELECT * FROM conversation_notifications WHERE source = ? AND source_id = ? AND run_id = ?",
					input.source,
					input.sourceId,
					input.runId,
				)
			: undefined;
		if (existing) {
			return rowToNotification(existing);
		}

		const notification: ConversationNotification = {
			notificationId: randomUUID(),
			conversationId: input.conversationId,
			source: input.source,
			sourceId: input.sourceId,
			...(input.runId ? { runId: input.runId } : {}),
			kind: input.kind,
			title: input.title,
			text: input.text,
			files: input.files ?? [],
			createdAt: (input.createdAt ?? new Date()).toISOString(),
		};

		try {
			this.options.database.run(
				[
					"INSERT INTO conversation_notifications (",
					"notification_id, conversation_id, source, source_id, run_id, kind, title, text, files_json, created_at",
					") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				].join(" "),
				notification.notificationId,
				notification.conversationId,
				notification.source,
				notification.sourceId,
				notification.runId,
				notification.kind,
				notification.title,
				notification.text,
				JSON.stringify(notification.files),
				notification.createdAt,
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

		return notification;
	}

	async list(conversationId: string): Promise<ConversationNotification[]> {
		const rows = this.options.database.all<ConversationNotificationRow>(
			"SELECT * FROM conversation_notifications WHERE conversation_id = ? ORDER BY created_at ASC, notification_id ASC",
			conversationId,
		);
		return rows.map(rowToNotification);
	}

	async summarize(conversationIds: readonly string[]): Promise<Map<string, ConversationNotificationSummary>> {
		const normalizedConversationIds = [...new Set(conversationIds.map((conversationId) => conversationId.trim()).filter(Boolean))];
		if (normalizedConversationIds.length === 0) {
			return new Map();
		}

		const placeholders = normalizedConversationIds.map(() => "?").join(", ");
		const countRows = this.options.database.all<Array<{ conversation_id: string; notification_count: number }>[number]>(
			[
				"SELECT conversation_id, COUNT(*) AS notification_count",
				"FROM conversation_notifications",
				`WHERE conversation_id IN (${placeholders})`,
				"GROUP BY conversation_id",
			].join(" "),
			...normalizedConversationIds,
		);
		const latestRows = this.options.database.all<ConversationNotificationRow>(
			[
				"SELECT * FROM conversation_notifications",
				`WHERE conversation_id IN (${placeholders})`,
				"ORDER BY conversation_id ASC, created_at DESC, notification_id DESC",
			].join(" "),
			...normalizedConversationIds,
		);

		const summaries = new Map<string, ConversationNotificationSummary>();
		for (const row of countRows) {
			summaries.set(row.conversation_id, {
				count: row.notification_count,
			});
		}
		for (const row of latestRows) {
			if (summaries.get(row.conversation_id)?.latest) {
				continue;
			}
			const summary = summaries.get(row.conversation_id) ?? { count: 0 };
			summary.latest = rowToNotification(row);
			summaries.set(row.conversation_id, summary);
		}

		return summaries;
	}

	async deleteConversation(conversationId: string): Promise<void> {
		this.options.database.run(
			"DELETE FROM conversation_notifications WHERE conversation_id = ?",
			conversationId,
		);
	}

	async markRead(notificationId: string, now: Date = new Date()): Promise<boolean> {
		const existing = this.options.database.get<ConversationNotificationRow>(
			"SELECT * FROM conversation_notifications WHERE notification_id = ?",
			notificationId,
		);
		if (!existing) {
			return false;
		}
		this.options.database.run(
			"UPDATE conversation_notifications SET read_at = ? WHERE notification_id = ?",
			now.toISOString(),
			notificationId,
		);
		return true;
	}

	private findBySourceRun(source: string, sourceId: string, runId: string): ConversationNotification | undefined {
		const row = this.options.database.get<ConversationNotificationRow>(
			"SELECT * FROM conversation_notifications WHERE source = ? AND source_id = ? AND run_id = ?",
			source,
			sourceId,
			runId,
		);
		return row ? rowToNotification(row) : undefined;
	}
}

function rowToNotification(row: ConversationNotificationRow): ConversationNotification {
	return {
		notificationId: row.notification_id,
		conversationId: row.conversation_id,
		source: row.source,
		sourceId: row.source_id,
		...(row.run_id ? { runId: row.run_id } : {}),
		kind: row.kind,
		title: row.title,
		text: row.text,
		files: parseFiles(row.files_json),
		createdAt: row.created_at,
		...(row.read_at ? { readAt: row.read_at } : {}),
	};
}

function parseFiles(value: string): ActivityFile[] {
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed) ? (parsed as ActivityFile[]) : [];
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
