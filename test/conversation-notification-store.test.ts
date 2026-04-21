import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConnDatabase } from "../src/agent/conn-db.js";
import { ConversationNotificationStore } from "../src/agent/conversation-notification-store.js";

async function createStore(): Promise<{ store: ConversationNotificationStore; database: ConnDatabase }> {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-conversation-notification-"));
	const database = new ConnDatabase({ dbPath: join(dir, "conn.sqlite") });
	await database.initialize();
	return {
		database,
		store: new ConversationNotificationStore({ database }),
	};
}

test("ConversationNotificationStore creates and lists notifications by conversation", async () => {
	const { store, database } = await createStore();

	const notification = await store.create({
		conversationId: "manual:conn",
		source: "conn",
		sourceId: "conn-1",
		runId: "run-1",
		kind: "conn_result",
		title: "Daily Digest completed",
		text: "result text",
		files: [
			{
				fileName: "report.md",
				downloadUrl: "/v1/files/file-1",
			},
		],
		createdAt: new Date("2026-04-21T10:01:05.000Z"),
	});

	assert.equal(notification.conversationId, "manual:conn");
	assert.equal(notification.source, "conn");
	assert.equal(notification.runId, "run-1");
	assert.equal(notification.createdAt, "2026-04-21T10:01:05.000Z");
	assert.deepEqual(notification.files, [
		{
			fileName: "report.md",
			downloadUrl: "/v1/files/file-1",
		},
	]);
	assert.deepEqual(await store.list("manual:conn"), [notification]);
	assert.deepEqual(await store.list("manual:other"), []);

	database.close();
});

test("ConversationNotificationStore deduplicates delivery for the same source and run", async () => {
	const { store, database } = await createStore();

	const first = await store.create({
		conversationId: "manual:conn",
		source: "conn",
		sourceId: "conn-1",
		runId: "run-1",
		kind: "conn_result",
		title: "first",
		text: "first text",
		createdAt: new Date("2026-04-21T10:01:05.000Z"),
	});
	const second = await store.create({
		conversationId: "manual:conn",
		source: "conn",
		sourceId: "conn-1",
		runId: "run-1",
		kind: "conn_result",
		title: "second",
		text: "second text",
		createdAt: new Date("2026-04-21T10:02:05.000Z"),
	});

	assert.deepEqual(second, first);
	assert.equal((await store.list("manual:conn")).length, 1);

	database.close();
});

test("ConversationNotificationStore marks notifications as read", async () => {
	const { store, database } = await createStore();
	const notification = await store.create({
		conversationId: "manual:conn",
		source: "conn",
		sourceId: "conn-1",
		runId: "run-1",
		kind: "conn_result",
		title: "Daily Digest completed",
		text: "result text",
		createdAt: new Date("2026-04-21T10:01:05.000Z"),
	});

	assert.equal(await store.markRead(notification.notificationId, new Date("2026-04-21T10:03:00.000Z")), true);
	assert.equal(await store.markRead("missing", new Date("2026-04-21T10:03:00.000Z")), false);
	assert.equal((await store.list("manual:conn"))[0].readAt, "2026-04-21T10:03:00.000Z");

	database.close();
});
