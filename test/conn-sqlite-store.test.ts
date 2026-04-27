import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConnDatabase } from "../src/agent/conn-db.js";
import { ConnSqliteStore } from "../src/agent/conn-sqlite-store.js";

async function createConnSqliteStore(): Promise<{ store: ConnSqliteStore; database: ConnDatabase }> {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-conn-sqlite-store-"));
	const database = new ConnDatabase({ dbPath: join(dir, "conn.sqlite") });
	await database.initialize();
	return {
		database,
		store: new ConnSqliteStore({ database }),
	};
}

test("ConnSqliteStore creates, gets, and lists conn definitions with runtime profile ids", async () => {
	const { store, database } = await createConnSqliteStore();

	const created = await store.create({
		title: " daily digest ",
		prompt: " Summarize the latest notes ",
		target: {
			type: "conversation",
			conversationId: "manual:conn",
		},
		schedule: {
			kind: "interval",
			everyMs: 60_000,
		},
		assetRefs: [" asset-1 ", "asset-1", "asset-2"],
		now: new Date("2026-04-21T10:00:00.000Z"),
	});

	assert.equal(created.title, "daily digest");
	assert.equal(created.prompt, "Summarize the latest notes");
	assert.deepEqual(created.assetRefs, ["asset-1", "asset-2"]);
	assert.equal(created.profileId, "background.default");
	assert.equal(created.agentSpecId, "agent.default");
	assert.equal(created.skillSetId, "skills.default");
	assert.equal(created.modelPolicyId, "model.default");
	assert.equal(created.upgradePolicy, "latest");
	assert.equal(created.nextRunAt, "2026-04-21T10:01:00.000Z");

	const found = await store.get(created.connId);
	assert.deepEqual(found, created);

	const listed = await store.list();
	assert.deepEqual(listed, [created]);

	database.close();
});

test("ConnSqliteStore skips malformed JSON conn rows instead of breaking list and detail reads", async () => {
	const { store, database } = await createConnSqliteStore();
	const healthy = await store.create({
		title: "healthy",
		prompt: "run",
		target: {
			type: "conversation",
			conversationId: "manual:healthy",
		},
		schedule: {
			kind: "interval",
			everyMs: 60_000,
		},
		now: new Date("2026-04-21T10:00:00.000Z"),
	});
	database.run(
		[
			"INSERT INTO conns (",
			"conn_id, title, prompt, target_json, schedule_json, asset_refs_json,",
			"profile_id, agent_spec_id, skill_set_id, model_policy_id, upgrade_policy,",
			"status, created_at, updated_at",
			") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		].join(" "),
		"conn-bad-json",
		"bad",
		"run",
		"{not-json",
		JSON.stringify({ kind: "interval", everyMs: 60_000 }),
		"[]",
		"background.default",
		"agent.default",
		"skills.default",
		"model.default",
		"latest",
		"active",
		"2026-04-21T10:01:00.000Z",
		"2026-04-21T10:01:00.000Z",
	);

	assert.deepEqual(await store.list(), [healthy]);
	assert.equal(await store.get("conn-bad-json"), undefined);

	database.close();
});

test("ConnSqliteStore lists same-timestamp conn definitions with a stable id tie-breaker", async () => {
	const { store, database } = await createConnSqliteStore();
	for (const connId of ["conn-a", "conn-b", "conn-c"]) {
		database.run(
			[
				"INSERT INTO conns (",
				"conn_id, title, prompt, target_json, schedule_json, asset_refs_json,",
				"profile_id, agent_spec_id, skill_set_id, model_policy_id, upgrade_policy,",
				"status, created_at, updated_at",
				") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			].join(" "),
			connId,
			connId,
			"run",
			JSON.stringify({ type: "conversation", conversationId: `manual:${connId}` }),
			JSON.stringify({ kind: "interval", everyMs: 60_000 }),
			"[]",
			"background.default",
			"agent.default",
			"skills.default",
			"model.default",
			"latest",
			"active",
			"2026-04-21T10:00:00.000Z",
			"2026-04-21T10:00:00.000Z",
		);
	}

	assert.deepEqual(
		(await store.list()).map((conn) => conn.connId),
		["conn-c", "conn-b", "conn-a"],
	);

	database.close();
});

test("ConnSqliteStore updates, pauses, resumes, and deletes conn definitions", async () => {
	const { store, database } = await createConnSqliteStore();
	const created = await store.create({
		title: "digest",
		prompt: "summarize",
		target: {
			type: "conversation",
			conversationId: "manual:conn",
		},
		schedule: {
			kind: "interval",
			everyMs: 60_000,
		},
		now: new Date("2026-04-21T10:00:00.000Z"),
	});

	const updated = await store.update(created.connId, {
		title: "weekly digest",
		assetRefs: ["asset-3"],
		schedule: {
			kind: "once",
			at: "2026-04-22T09:00:00.000Z",
		},
		now: new Date("2026-04-21T10:05:00.000Z"),
	});
	assert.equal(updated?.title, "weekly digest");
	assert.deepEqual(updated?.assetRefs, ["asset-3"]);
	assert.equal(updated?.nextRunAt, "2026-04-22T09:00:00.000Z");

	const paused = await store.pause(created.connId, new Date("2026-04-21T10:06:00.000Z"));
	assert.equal(paused?.status, "paused");
	assert.equal(paused?.nextRunAt, undefined);

	const resumed = await store.resume(created.connId, new Date("2026-04-21T10:07:00.000Z"));
	assert.equal(resumed?.status, "active");
	assert.equal(resumed?.nextRunAt, "2026-04-22T09:00:00.000Z");

	assert.equal(await store.delete(created.connId), true);
	assert.equal(await store.get(created.connId), undefined);

	database.close();
});

test("ConnSqliteStore hard delete removes stale conn notifications and activity items", async () => {
	const { store, database } = await createConnSqliteStore();
	const created = await store.create({
		title: "test cleanup",
		prompt: "summarize",
		target: {
			type: "conversation",
			conversationId: "manual:conn",
		},
		schedule: {
			kind: "interval",
			everyMs: 60_000,
		},
		now: new Date("2026-04-21T10:00:00.000Z"),
	});

	database.run(
		"INSERT INTO conversation_notifications (notification_id, conversation_id, source, source_id, run_id, kind, title, text, files_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		"notice-1",
		"manual:conn",
		"conn",
		created.connId,
		"run-1",
		"conn_result",
		"done",
		"ok",
		"[]",
		"2026-04-21T10:01:00.000Z",
	);
	database.run(
		"INSERT INTO agent_activity_items (activity_id, scope, source, source_id, run_id, conversation_id, kind, title, text, files_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		"activity-1",
		"agent",
		"conn",
		created.connId,
		"run-1",
		"manual:conn",
		"conn_result",
		"done",
		"ok",
		"[]",
		"2026-04-21T10:01:00.000Z",
	);

	assert.equal(await store.delete(created.connId), true);
	assert.equal(
		database.get<{ notification_id: string }>("SELECT notification_id FROM conversation_notifications WHERE source_id = ?", created.connId),
		undefined,
	);
	assert.equal(
		database.get<{ activity_id: string }>("SELECT activity_id FROM agent_activity_items WHERE source_id = ?", created.connId),
		undefined,
	);

	database.close();
});

test("ConnSqliteStore bulk delete reports deleted and missing conn ids", async () => {
	const { store, database } = await createConnSqliteStore();
	const first = await store.create({
		title: "first",
		prompt: "run",
		target: {
			type: "conversation",
			conversationId: "manual:first",
		},
		schedule: {
			kind: "interval",
			everyMs: 60_000,
		},
	});
	const second = await store.create({
		title: "second",
		prompt: "run",
		target: {
			type: "conversation",
			conversationId: "manual:second",
		},
		schedule: {
			kind: "interval",
			everyMs: 60_000,
		},
	});

	const result = await store.deleteMany([first.connId, "missing", first.connId, second.connId]);

	assert.deepEqual(result, {
		deletedConnIds: [first.connId, second.connId],
		missingConnIds: ["missing"],
	});
	assert.equal(await store.get(first.connId), undefined);
	assert.equal(await store.get(second.connId), undefined);

	database.close();
});

test("ConnSqliteStore rejects invalid schedules with a clear validation error", async () => {
	const { store, database } = await createConnSqliteStore();

	await assert.rejects(
		() =>
			store.create({
				title: "bad schedule",
				prompt: "run",
				target: {
					type: "conversation",
					conversationId: "manual:conn",
				},
				schedule: {
					kind: "once",
					at: "not-a-date",
				},
			}),
		/Invalid conn schedule/,
	);

	database.close();
});

test("ConnSqliteStore rejects once schedules that are already in the past", async () => {
	const { store, database } = await createConnSqliteStore();

	await assert.rejects(
		() =>
			store.create({
				title: "past schedule",
				prompt: "run",
				target: {
					type: "conversation",
					conversationId: "manual:conn",
				},
				schedule: {
					kind: "once",
					at: "2026-04-21T09:59:00.000Z",
				},
				now: new Date("2026-04-21T10:00:00.000Z"),
			}),
		/once\.at .*past|past/i,
	);

	database.close();
});

test("ConnSqliteStore persists cron timezone and explicit runtime ids", async () => {
	const { store, database } = await createConnSqliteStore();

	const created = await store.create({
		title: "morning digest",
		prompt: "run every morning",
		target: {
			type: "conversation",
			conversationId: "manual:conn",
		},
		schedule: {
			kind: "cron",
			expression: "0 9 * * *",
			timezone: "Asia/Shanghai",
		},
		profileId: "background.zh",
		agentSpecId: "agent.daily",
		skillSetId: "skills.research",
		modelPolicyId: "model.stable",
		upgradePolicy: "pinned",
		maxRunMs: 120_000,
		now: new Date("2026-04-21T00:30:00.000Z"),
	});

	assert.deepEqual(created.schedule, {
		kind: "cron",
		expression: "0 9 * * *",
		timezone: "Asia/Shanghai",
	});
	assert.equal(created.profileId, "background.zh");
	assert.equal(created.agentSpecId, "agent.daily");
	assert.equal(created.skillSetId, "skills.research");
	assert.equal(created.modelPolicyId, "model.stable");
	assert.equal(created.upgradePolicy, "pinned");
	assert.equal(created.maxRunMs, 120_000);
	assert.equal(created.nextRunAt, "2026-04-21T01:00:00.000Z");

	database.close();
});

test("ConnSqliteStore defaults cron schedules to the user timezone instead of the host timezone", async () => {
	const previousTz = process.env.TZ;
	process.env.TZ = "UTC";
	const { store, database } = await createConnSqliteStore();
	try {
		const created = await store.create({
			title: "下午提醒",
			prompt: "北京时间下午 1 点提醒我",
			target: {
				type: "conversation",
				conversationId: "manual:conn",
			},
			schedule: {
				kind: "cron",
				expression: "0 13 * * *",
			},
			now: new Date("2026-04-23T04:30:00.000Z"),
		});

		assert.deepEqual(created.schedule, {
			kind: "cron",
			expression: "0 13 * * *",
			timezone: "Asia/Shanghai",
		});
		assert.equal(created.nextRunAt, "2026-04-23T05:00:00.000Z");
	} finally {
		database.close();
		if (previousTz === undefined) {
			delete process.env.TZ;
		} else {
			process.env.TZ = previousTz;
		}
	}
});

test("ConnSqliteStore interprets one-time wall-clock schedules in the provided timezone", async () => {
	const previousTz = process.env.TZ;
	process.env.TZ = "UTC";
	const { store, database } = await createConnSqliteStore();
	try {
		const created = await store.create({
			title: "一次性提醒",
			prompt: "北京时间下午 1 点提醒我",
			target: {
				type: "conversation",
				conversationId: "manual:conn",
			},
			schedule: {
				kind: "once",
				at: "2099-04-23T13:00:00",
				timezone: "Asia/Shanghai",
			} as never,
			now: new Date("2099-04-23T04:30:00.000Z"),
		});

		assert.equal(created.schedule.kind, "once");
		assert.equal(created.schedule.at, "2099-04-23T05:00:00.000Z");
		assert.equal(created.nextRunAt, "2099-04-23T05:00:00.000Z");
	} finally {
		database.close();
		if (previousTz === undefined) {
			delete process.env.TZ;
		} else {
			process.env.TZ = previousTz;
		}
	}
});

test("ConnSqliteStore rejects invalid maxRunMs values with a clear validation error", async () => {
	const { store, database } = await createConnSqliteStore();

	await assert.rejects(
		() =>
			store.create({
				title: "bad maxRunMs",
				prompt: "run",
				target: {
					type: "conversation",
					conversationId: "manual:conn",
				},
				schedule: {
					kind: "once",
					at: "2026-04-25T10:31:00.000Z",
				},
				maxRunMs: 0,
				now: new Date("2026-04-25T10:30:00.000Z"),
			}),
		/Invalid conn maxRunMs/,
	);

	database.close();
});

test("ConnSqliteStore rejects invalid cron timezones with a clear validation error", async () => {
	const { store, database } = await createConnSqliteStore();

	await assert.rejects(
		() =>
			store.create({
				title: "bad timezone",
				prompt: "run",
				target: {
					type: "conversation",
					conversationId: "manual:conn",
				},
				schedule: {
					kind: "cron",
					expression: "0 9 * * *",
					timezone: "Mars/Olympus",
				},
			}),
		/Invalid conn schedule: cron.timezone is invalid/,
	);

	database.close();
});
