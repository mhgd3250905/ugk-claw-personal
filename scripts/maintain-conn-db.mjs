#!/usr/bin/env node
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_KEEP_DAYS = 7;
const DEFAULT_KEEP_LATEST_RUNS_PER_CONN = 3;

function usage(exitCode = 1) {
	console.log(`Usage:
  node scripts/maintain-conn-db.mjs --db <conn.sqlite> [options]

Options:
  --keep-days <days>                    Keep run events newer than this many days. Default: ${DEFAULT_KEEP_DAYS}
  --keep-latest-runs-per-conn <count>   Always keep events for the latest N runs per conn. Default: ${DEFAULT_KEEP_LATEST_RUNS_PER_CONN}
  --now <iso>                           Override current time for deterministic dry-runs.
  --dry-run                             Report what would be deleted without changing the database.
  --no-vacuum                           Skip VACUUM after applying deletes.
  --json                                Print machine-readable JSON.
`);
	process.exit(exitCode);
}

function parseArgs(argv) {
	const options = {
		keepDays: DEFAULT_KEEP_DAYS,
		keepLatestRunsPerConn: DEFAULT_KEEP_LATEST_RUNS_PER_CONN,
		dryRun: false,
		vacuum: true,
		json: false,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--help" || arg === "-h") usage(0);
		if (arg === "--db") {
			options.dbPath = argv[++index];
			continue;
		}
		if (arg === "--keep-days") {
			options.keepDays = parseNonNegativeInteger(argv[++index], "--keep-days");
			continue;
		}
		if (arg === "--keep-latest-runs-per-conn") {
			options.keepLatestRunsPerConn = parseNonNegativeInteger(argv[++index], "--keep-latest-runs-per-conn");
			continue;
		}
		if (arg === "--now") {
			options.now = parseDate(argv[++index], "--now");
			continue;
		}
		if (arg === "--dry-run") {
			options.dryRun = true;
			continue;
		}
		if (arg === "--no-vacuum") {
			options.vacuum = false;
			continue;
		}
		if (arg === "--json") {
			options.json = true;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}
	if (!options.dbPath) {
		throw new Error("--db is required");
	}
	if (!existsSync(options.dbPath)) {
		throw new Error(`Database does not exist: ${options.dbPath}`);
	}
	return options;
}

function parseNonNegativeInteger(value, label) {
	const number = Number(value);
	if (!Number.isInteger(number) || number < 0) {
		throw new Error(`${label} must be a non-negative integer`);
	}
	return number;
}

function parseDate(value, label) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`${label} must be a valid date`);
	}
	return date;
}

function buildCutoff(now, keepDays) {
	return new Date(now.getTime() - keepDays * 24 * 60 * 60 * 1000).toISOString();
}

function findExpiredRunIds(db, options) {
	return db.prepare(
		[
			"SELECT run_id FROM (",
			"SELECT run_id, conn_id, scheduled_at, created_at,",
			"ROW_NUMBER() OVER (PARTITION BY conn_id ORDER BY scheduled_at DESC, created_at DESC, run_id DESC) AS run_rank",
			"FROM conn_runs",
			") ranked",
			"WHERE run_rank > ?",
			"AND COALESCE(scheduled_at, created_at) < ?",
			"ORDER BY COALESCE(scheduled_at, created_at) ASC, run_id ASC",
		].join(" "),
	).all(options.keepLatestRunsPerConn, options.cutoff).map((row) => row.run_id);
}

function countEventsForRuns(db, runIds) {
	if (runIds.length === 0) return 0;
	const placeholders = runIds.map(() => "?").join(", ");
	const row = db.prepare(`SELECT COUNT(*) AS event_count FROM conn_run_events WHERE run_id IN (${placeholders})`).get(...runIds);
	return Number(row?.event_count ?? 0);
}

function deleteEventsForRuns(db, runIds) {
	if (runIds.length === 0) return;
	const placeholders = runIds.map(() => "?").join(", ");
	db.prepare(`DELETE FROM conn_run_events WHERE run_id IN (${placeholders})`).run(...runIds);
}

function runMaintenance(options) {
	const now = options.now ?? new Date();
	const cutoff = buildCutoff(now, options.keepDays);
	const db = new DatabaseSync(options.dbPath);
	try {
		db.exec("PRAGMA busy_timeout = 5000");
		db.exec("PRAGMA foreign_keys = ON");
		const expiredRunIds = findExpiredRunIds(db, {
			cutoff,
			keepLatestRunsPerConn: options.keepLatestRunsPerConn,
		});
		const deletedEventCount = countEventsForRuns(db, expiredRunIds);
		let vacuumed = false;

		if (!options.dryRun && expiredRunIds.length > 0) {
			db.exec("BEGIN IMMEDIATE");
			try {
				deleteEventsForRuns(db, expiredRunIds);
				db.exec("COMMIT");
			} catch (error) {
				try {
					db.exec("ROLLBACK");
				} catch {
					// Ignore rollback failures after a failed write.
				}
				throw error;
			}
			if (options.vacuum) {
				db.exec("VACUUM");
				db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
				vacuumed = true;
			}
		}

		return {
			dbPath: options.dbPath,
			dryRun: options.dryRun,
			cutoff,
			expiredRunCount: expiredRunIds.length,
			deletedEventCount,
			vacuumed,
		};
	} finally {
		db.close();
	}
}

function printResult(result, json) {
	if (json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}
	console.log(`db=${result.dbPath}`);
	console.log(`dryRun=${result.dryRun}`);
	console.log(`cutoff=${result.cutoff}`);
	console.log(`expiredRunCount=${result.expiredRunCount}`);
	console.log(`deletedEventCount=${result.deletedEventCount}`);
	console.log(`vacuumed=${result.vacuumed}`);
}

try {
	const options = parseArgs(process.argv.slice(2));
	printResult(runMaintenance(options), options.json);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	usage(1);
}
