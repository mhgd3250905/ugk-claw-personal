import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConnDatabase, CONN_DATABASE_TABLES } from "../src/agent/conn-db.js";

async function createTempDbPath(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-conn-db-"));
	return join(dir, "nested", "conn.sqlite");
}

test("ConnDatabase initializes the sqlite schema and creates missing parent directories", async () => {
	const dbPath = await createTempDbPath();
	const database = new ConnDatabase({ dbPath });

	await database.initialize();

	assert.deepEqual(database.listTableNames(), CONN_DATABASE_TABLES);
	assert.equal(database.getUserVersion(), 3);
	assert.equal(
		database.all<{ name: string }>("PRAGMA table_info(conns)").some((column) => column.name === "max_run_ms"),
		true,
	);

	database.close();
});

test("ConnDatabase initialization is idempotent and preserves existing rows", async () => {
	const dbPath = await createTempDbPath();
	const database = new ConnDatabase({ dbPath });

	await database.initialize();
	database.exec("INSERT INTO conns (conn_id, title, prompt, target_json, schedule_json, asset_refs_json, profile_id, agent_spec_id, skill_set_id, model_policy_id, upgrade_policy, status, created_at, updated_at) VALUES ('conn-1', 'Digest', 'Summarize', '{}', '{}', '[]', 'background.default', 'agent.default', 'skills.default', 'model.default', 'latest', 'active', '2026-04-21T00:00:00.000Z', '2026-04-21T00:00:00.000Z')");
	await database.initialize();

	const row = database.get<{ title: string }>("SELECT title FROM conns WHERE conn_id = ?", "conn-1");
	assert.deepEqual(row, { title: "Digest" });
	assert.deepEqual(database.listTableNames(), CONN_DATABASE_TABLES);

	database.close();
});

test("ConnDatabase enables WAL mode and busy timeout for worker-safe multi-process writes", async () => {
	const dbPath = await createTempDbPath();
	const database = new ConnDatabase({ dbPath });

	await database.initialize();

	const journalMode = database.get<{ journal_mode: string }>("PRAGMA journal_mode");
	const busyTimeout = database.get<{ timeout: number }>("PRAGMA busy_timeout");

	assert.equal(journalMode?.journal_mode?.toLowerCase(), "wal");
	assert.equal(busyTimeout?.timeout, 5000);

	database.close();
});

test("ConnDatabase initializes the agent activity timeline schema", async () => {
	const dbPath = await createTempDbPath();
	const database = new ConnDatabase({ dbPath });

	await database.initialize();

	assert.equal(database.listTableNames().includes("agent_activity_items"), true);
	assert.equal(database.listTableNames().includes("conversation_notifications"), true);

	const activityColumns = database.all<{ name: string }>("PRAGMA table_info(agent_activity_items)");
	assert.deepEqual(
		activityColumns.map((column) => column.name),
		[
			"activity_id",
			"scope",
			"source",
			"source_id",
			"run_id",
			"conversation_id",
			"kind",
			"title",
			"text",
			"files_json",
			"created_at",
			"read_at",
		],
	);

	const indexes = database.all<{ name: string }>("PRAGMA index_list(agent_activity_items)");
	assert.equal(indexes.some((index) => index.name === "idx_agent_activity_created_at"), true);
	assert.equal(indexes.some((index) => index.name === "idx_agent_activity_conversation_id"), true);
	assert.equal(indexes.some((index) => index.name === "idx_agent_activity_source_run"), true);
	assert.equal(indexes.some((index) => index.name === "idx_agent_activity_source_run_unique"), true);

	database.close();
});

test("ConnDatabase enforces one agent activity item per source run", async () => {
	const dbPath = await createTempDbPath();
	const database = new ConnDatabase({ dbPath });

	await database.initialize();
	database.run(
		"INSERT INTO agent_activity_items (activity_id, scope, source, source_id, run_id, conversation_id, kind, title, text, files_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		"activity-1",
		"agent",
		"conn",
		"conn-1",
		"run-1",
		undefined,
		"conn_result",
		"first",
		"first text",
		"[]",
		"2026-04-22T10:01:05.000Z",
	);

	assert.throws(
		() =>
			database.run(
				"INSERT INTO agent_activity_items (activity_id, scope, source, source_id, run_id, conversation_id, kind, title, text, files_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				"activity-2",
				"agent",
				"conn",
				"conn-1",
				"run-1",
				undefined,
				"conn_result",
				"second",
				"second text",
				"[]",
				"2026-04-22T10:02:05.000Z",
			),
		/UNIQUE constraint failed/,
	);

	database.close();
});

test("ConnDatabase migrates an existing legacy database into a new runtime path when configured", async () => {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-conn-db-migrate-"));
	const legacyDbPath = join(root, "legacy", "conn.sqlite");
	const runtimeDbPath = join(root, "runtime", "conn.sqlite");
	const legacyDatabase = new ConnDatabase({ dbPath: legacyDbPath });

	await legacyDatabase.initialize();
	legacyDatabase.exec(
		"INSERT INTO conns (conn_id, title, prompt, target_json, schedule_json, asset_refs_json, profile_id, agent_spec_id, skill_set_id, model_policy_id, upgrade_policy, status, created_at, updated_at) VALUES ('conn-legacy', 'Digest', 'Summarize', '{}', '{}', '[]', 'background.default', 'agent.default', 'skills.default', 'model.default', 'latest', 'active', '2026-04-21T00:00:00.000Z', '2026-04-21T00:00:00.000Z')",
	);
	legacyDatabase.close();
	await writeFile(`${legacyDbPath}-wal`, "legacy-wal", "utf8");

	const runtimeDatabase = new ConnDatabase({
		dbPath: runtimeDbPath,
		legacyDbPath,
	});

	await runtimeDatabase.initialize();

	const row = runtimeDatabase.get<{ title: string }>("SELECT title FROM conns WHERE conn_id = ?", "conn-legacy");
	assert.deepEqual(row, { title: "Digest" });
	assert.equal(runtimeDatabase.listTableNames().includes("conns"), true);
	assert.equal(
		runtimeDatabase.all<{ name: string }>("PRAGMA table_info(conns)").some((column) => column.name === "max_run_ms"),
		true,
	);
	runtimeDatabase.close();
});
