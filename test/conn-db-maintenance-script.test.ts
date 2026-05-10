import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { ConnDatabase } from "../src/agent/conn-db.js";

async function createMaintenanceDb(): Promise<{ database: ConnDatabase; dbPath: string }> {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-conn-maintenance-"));
	const dbPath = join(dir, "conn.sqlite");
	const database = new ConnDatabase({ dbPath });
	await database.initialize();
	return { database, dbPath };
}

function insertConn(database: ConnDatabase, connId: string): void {
	database.run(
		[
			"INSERT INTO conns (",
			"conn_id, title, prompt, target_json, schedule_json, asset_refs_json, profile_id,",
			"agent_spec_id, skill_set_id, model_policy_id, upgrade_policy, status, created_at, updated_at",
			") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		].join(" "),
		connId,
		connId,
		"summarize",
		JSON.stringify({ type: "task_inbox" }),
		JSON.stringify({ kind: "interval", everyMs: 60_000 }),
		"[]",
		"main",
		"agent.default",
		"skills.default",
		"model.default",
		"latest",
		"active",
		"2026-05-01T00:00:00.000Z",
		"2026-05-01T00:00:00.000Z",
	);
}

function insertRun(database: ConnDatabase, connId: string, runId: string, scheduledAt: string): void {
	database.run(
		[
			"INSERT INTO conn_runs (",
			"run_id, conn_id, status, scheduled_at, workspace_path, created_at, updated_at",
			") VALUES (?, ?, ?, ?, ?, ?, ?)",
		].join(" "),
		runId,
		connId,
		"succeeded",
		scheduledAt,
		`/tmp/${runId}`,
		scheduledAt,
		scheduledAt,
	);
	for (let seq = 1; seq <= 2; seq += 1) {
		database.run(
			"INSERT INTO conn_run_events (event_id, run_id, seq, event_type, event_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			`${runId}-event-${seq}`,
			runId,
			seq,
			"log",
			JSON.stringify({ message: `${runId}-${seq}` }),
			scheduledAt,
		);
	}
}

test("conn db maintenance script deletes only expired non-latest run events", async () => {
	const { database, dbPath } = await createMaintenanceDb();
	insertConn(database, "conn-a");
	insertConn(database, "conn-b");
	insertRun(database, "conn-a", "run-a-old", "2026-05-01T00:00:00.000Z");
	insertRun(database, "conn-a", "run-a-new", "2026-05-09T00:00:00.000Z");
	insertRun(database, "conn-b", "run-b-old-but-latest", "2026-05-01T00:00:00.000Z");
	database.close();

	const scriptPath = resolve("scripts", "maintain-conn-db.mjs");
	const baseArgs = [
		scriptPath,
		"--db",
		dbPath,
		"--now",
		"2026-05-10T00:00:00.000Z",
		"--keep-days",
		"7",
		"--keep-latest-runs-per-conn",
		"1",
		"--json",
	];
	const dryRun = spawnSync(process.execPath, [...baseArgs, "--dry-run"], {
		encoding: "utf8",
	});

	assert.equal(dryRun.status, 0, dryRun.stderr);
	assert.deepEqual(JSON.parse(dryRun.stdout), {
		dbPath,
		dryRun: true,
		cutoff: "2026-05-03T00:00:00.000Z",
		expiredRunCount: 1,
		deletedEventCount: 2,
		vacuumed: false,
	});

	const applied = spawnSync(process.execPath, [...baseArgs, "--no-vacuum"], {
		encoding: "utf8",
	});
	assert.equal(applied.status, 0, applied.stderr);

	const verifyDatabase = new ConnDatabase({ dbPath });
	await verifyDatabase.initialize();
	assert.deepEqual(
		verifyDatabase.all<{ run_id: string; event_count: number }>(
			[
				"SELECT run_id, COUNT(*) AS event_count",
				"FROM conn_run_events",
				"GROUP BY run_id",
				"ORDER BY run_id",
			].join(" "),
		),
		[
			{ run_id: "run-a-new", event_count: 2 },
			{ run_id: "run-b-old-but-latest", event_count: 2 },
		],
	);
	verifyDatabase.close();
});
