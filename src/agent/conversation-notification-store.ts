import { randomUUID } from "node:crypto";
import type { ConnDatabase } from "./conn-db.js";

export interface ConversationNotificationFile {
	fileName: string;
	downloadUrl: string;
	mimeType?: string;
	sizeBytes?: number;
}

export interface ConversationNotification {
	notificationId: string;
	conversationId: string;
	source: string;
	sourceId: string;
	runId?: string;
	kind: string;
	title: string;
	text: string;
	files: ConversationNotificationFile[];
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
	files?: ConversationNotificationFile[];
	createdAt?: Date;
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

		return notification;
	}

	async list(conversationId: string): Promise<ConversationNotification[]> {
		const rows = this.options.database.all<ConversationNotificationRow>(
			"SELECT * FROM conversation_notifications WHERE conversation_id = ? ORDER BY created_at ASC",
			conversationId,
		);
		return rows.map(rowToNotification);
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

function parseFiles(value: string): ConversationNotificationFile[] {
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed) ? (parsed as ConversationNotificationFile[]) : [];
	} catch {
		return [];
	}
}
