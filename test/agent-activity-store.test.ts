import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AgentActivityStore } from "../src/agent/agent-activity-store.js";
import { ConnDatabase } from "../src/agent/conn-db.js";

async function createStore(): Promise<{ store: AgentActivityStore; database: ConnDatabase }> {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-agent-activity-"));
	const database = new ConnDatabase({ dbPath: join(dir, "conn.sqlite") });
	await database.initialize();
	return {
		database,
		store: new AgentActivityStore({ database }),
	};
}

test("AgentActivityStore creates and lists global activity items", async () => {
	const { store, database } = await createStore();

	const activity = await store.create({
		source: "conn",
		sourceId: "conn-1",
		runId: "run-1",
		conversationId: "manual:conn",
		kind: "conn_result",
		title: "Daily Digest completed",
		text: "result text",
		files: [
			{
				fileName: "report.md",
				downloadUrl: "/v1/files/file-1",
			},
		],
		createdAt: new Date("2026-04-22T10:01:05.000Z"),
	});

	assert.equal(activity.scope, "agent");
	assert.equal(activity.source, "conn");
	assert.equal(activity.sourceId, "conn-1");
	assert.equal(activity.runId, "run-1");
	assert.equal(activity.conversationId, "manual:conn");
	assert.equal(activity.createdAt, "2026-04-22T10:01:05.000Z");
	assert.deepEqual(activity.files, [
		{
			fileName: "report.md",
			downloadUrl: "/v1/files/file-1",
		},
	]);
	assert.deepEqual(await store.get(activity.activityId), activity);
	assert.deepEqual(await store.list(), [activity]);

	database.close();
});

test("AgentActivityStore deduplicates delivery for the same source and run", async () => {
	const { store, database } = await createStore();

	const first = await store.create({
		source: "conn",
		sourceId: "conn-1",
		runId: "run-1",
		conversationId: "manual:conn",
		kind: "conn_result",
		title: "first",
		text: "first text",
		createdAt: new Date("2026-04-22T10:01:05.000Z"),
	});
	const second = await store.create({
		source: "conn",
		sourceId: "conn-1",
		runId: "run-1",
		conversationId: "manual:conn",
		kind: "conn_result",
		title: "second",
		text: "second text",
		createdAt: new Date("2026-04-22T10:02:05.000Z"),
	});

	assert.deepEqual(second, first);
	assert.equal((await store.list()).length, 1);

	database.close();
});

test("AgentActivityStore returns the existing activity when a concurrent insert wins the same source run", async () => {
	const { store, database } = await createStore();
	const originalRun = database.run.bind(database);
	let injectedConcurrentInsert = false;
	database.run = (sql: string, ...params: unknown[]): void => {
		if (!injectedConcurrentInsert && sql.includes("INSERT INTO agent_activity_items")) {
			injectedConcurrentInsert = true;
			originalRun(
				"INSERT INTO agent_activity_items (activity_id, scope, source, source_id, run_id, conversation_id, kind, title, text, files_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				"activity-existing",
				"agent",
				"conn",
				"conn-race",
				"run-race",
				"manual:conn",
				"conn_result",
				"winner",
				"winner text",
				"[]",
				"2026-04-22T10:01:05.000Z",
			);
		}
		originalRun(sql, ...params);
	};

	const activity = await store.create({
		source: "conn",
		sourceId: "conn-race",
		runId: "run-race",
		conversationId: "manual:conn",
		kind: "conn_result",
		title: "late",
		text: "late text",
		createdAt: new Date("2026-04-22T10:02:05.000Z"),
	});

	assert.equal(activity.activityId, "activity-existing");
	assert.equal(activity.title, "winner");
	assert.equal((await store.list()).length, 1);

	database.close();
});

test("AgentActivityStore lists newest-first, filters by conversation, and limits results", async () => {
	const { store, database } = await createStore();

	const older = await store.create({
		source: "conn",
		sourceId: "conn-1",
		runId: "run-1",
		conversationId: "manual:one",
		kind: "conn_result",
		title: "older",
		text: "older text",
		createdAt: new Date("2026-04-22T10:01:05.000Z"),
	});
	const newest = await store.create({
		source: "conn",
		sourceId: "conn-2",
		runId: "run-2",
		conversationId: "manual:two",
		kind: "conn_result",
		title: "newest",
		text: "newest text",
		createdAt: new Date("2026-04-22T10:03:05.000Z"),
	});
	const middle = await store.create({
		source: "conn",
		sourceId: "conn-3",
		runId: "run-3",
		conversationId: "manual:one",
		kind: "conn_result",
		title: "middle",
		text: "middle text",
		createdAt: new Date("2026-04-22T10:02:05.000Z"),
	});

	assert.deepEqual(
		(await store.list()).map((item) => item.activityId),
		[newest.activityId, middle.activityId, older.activityId],
	);
	assert.deepEqual(
		(await store.list({ conversationId: "manual:one" })).map((item) => item.activityId),
		[middle.activityId, older.activityId],
	);
	assert.deepEqual(
		(await store.list({ limit: 2 })).map((item) => item.activityId),
		[newest.activityId, middle.activityId],
	);

	database.close();
});

test("AgentActivityStore can list unread items even when newer read items fill the latest page", async () => {
	const { store, database } = await createStore();

	const olderUnread = await store.create({
		source: "conn",
		sourceId: "conn-unread",
		runId: "run-unread",
		conversationId: "manual:conn",
		kind: "conn_result",
		title: "older unread",
		text: "older unread text",
		createdAt: new Date("2026-04-22T10:01:00.000Z"),
	});
	for (let index = 0; index < 3; index += 1) {
		const activity = await store.create({
			source: "conn",
			sourceId: `conn-read-${index}`,
			runId: `run-read-${index}`,
			conversationId: "manual:conn",
			kind: "conn_result",
			title: `newer read ${index}`,
			text: `newer read text ${index}`,
			createdAt: new Date(`2026-04-22T10:0${index + 2}:00.000Z`),
		});
		await store.markRead(activity.activityId, new Date("2026-04-22T10:10:00.000Z"));
	}

	assert.deepEqual(
		(await store.list({ limit: 2, unreadOnly: true })).map((item) => item.activityId),
		[olderUnread.activityId],
	);

	database.close();
});

test("AgentActivityStore paginates unread activity items with a before cursor", async () => {
	const { store, database } = await createStore();

	const oldest = await store.create({
		source: "conn",
		sourceId: "conn-1",
		runId: "run-1",
		conversationId: "manual:conn",
		kind: "conn_result",
		title: "oldest",
		text: "oldest text",
		createdAt: new Date("2026-04-22T10:01:00.000Z"),
	});
	const middle = await store.create({
		source: "conn",
		sourceId: "conn-2",
		runId: "run-2",
		conversationId: "manual:conn",
		kind: "conn_result",
		title: "middle",
		text: "middle text",
		createdAt: new Date("2026-04-22T10:02:00.000Z"),
	});
	const newest = await store.create({
		source: "conn",
		sourceId: "conn-3",
		runId: "run-3",
		conversationId: "manual:conn",
		kind: "conn_result",
		title: "newest",
		text: "newest text",
		createdAt: new Date("2026-04-22T10:03:00.000Z"),
	});

	const firstPage = await store.list({ limit: 2, unreadOnly: true });
	const secondPage = await store.list({ limit: 2, unreadOnly: true, before: middle.createdAt });

	assert.deepEqual(
		firstPage.map((item) => item.activityId),
		[newest.activityId, middle.activityId],
	);
	assert.deepEqual(
		secondPage.map((item) => item.activityId),
		[oldest.activityId],
	);

	database.close();
});

test("AgentActivityStore paginates activity items with a stable id tie-breaker", async () => {
	const { store, database } = await createStore();
	for (const activityId of ["activity-a", "activity-b", "activity-c"]) {
		database.run(
			"INSERT INTO agent_activity_items (activity_id, scope, source, source_id, run_id, conversation_id, kind, title, text, files_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			activityId,
			"agent",
			"conn",
			activityId,
			`run-${activityId}`,
			"manual:conn",
			"conn_result",
			activityId,
			`${activityId} text`,
			"[]",
			"2026-04-22T10:01:00.000Z",
		);
	}

	const firstPage = await store.list({ limit: 2 });
	const secondPage = await store.list({
		limit: 2,
		before: `${firstPage[1].createdAt}|${firstPage[1].activityId}`,
	});

	assert.deepEqual(firstPage.map((item) => item.activityId), ["activity-c", "activity-b"]);
	assert.deepEqual(secondPage.map((item) => item.activityId), ["activity-a"]);

	database.close();
});

test("AgentActivityStore marks activity items as read", async () => {
	const { store, database } = await createStore();
	const activity = await store.create({
		source: "conn",
		sourceId: "conn-1",
		runId: "run-1",
		conversationId: "manual:conn",
		kind: "conn_result",
		title: "Daily Digest completed",
		text: "result text",
		createdAt: new Date("2026-04-22T10:01:05.000Z"),
	});

	assert.equal(await store.markRead(activity.activityId, new Date("2026-04-22T10:03:00.000Z")), true);
	assert.equal(await store.markRead("missing", new Date("2026-04-22T10:03:00.000Z")), false);
	assert.equal((await store.list())[0].readAt, "2026-04-22T10:03:00.000Z");

	database.close();
});

test("AgentActivityStore marks all activity items as read", async () => {
	const { store, database } = await createStore();
	await store.create({
		source: "conn",
		sourceId: "conn-1",
		runId: "run-1",
		conversationId: "manual:conn",
		kind: "conn_result",
		title: "First",
		text: "first",
		createdAt: new Date("2026-04-22T10:01:05.000Z"),
	});
	await store.create({
		source: "conn",
		sourceId: "conn-2",
		runId: "run-2",
		conversationId: "manual:conn",
		kind: "conn_result",
		title: "Second",
		text: "second",
		createdAt: new Date("2026-04-22T10:02:05.000Z"),
	});

	assert.equal(await store.getUnreadCount(), 2);
	assert.equal(await store.markAllRead(new Date("2026-04-22T10:03:00.000Z")), 2);
	assert.equal(await store.getUnreadCount(), 0);
	assert.deepEqual(
		(await store.list()).map((item) => item.readAt),
		["2026-04-22T10:03:00.000Z", "2026-04-22T10:03:00.000Z"],
	);

	database.close();
});
