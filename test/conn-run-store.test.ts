import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConnDatabase } from "../src/agent/conn-db.js";
import { ConnRunStore } from "../src/agent/conn-run-store.js";
import { ConnSqliteStore } from "../src/agent/conn-sqlite-store.js";

async function createStores(): Promise<{
	connStore: ConnSqliteStore;
	runStore: ConnRunStore;
	database: ConnDatabase;
}> {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-conn-run-store-"));
	const database = new ConnDatabase({ dbPath: join(dir, "conn.sqlite") });
	await database.initialize();
	return {
		database,
		connStore: new ConnSqliteStore({ database }),
		runStore: new ConnRunStore({ database }),
	};
}

test("ConnRunStore creates due runs and leases them to one worker at a time", async () => {
	const { connStore, runStore, database } = await createStores();
	const conn = await connStore.create({
		title: "daily digest",
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
	const run = await runStore.createRun({
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: "/tmp/conn/run-1",
		resolvedSnapshot: {
			profileId: "background.default",
			skillSetId: "skills.default",
		},
		now: new Date("2026-04-21T10:00:59.000Z"),
	});

	assert.equal(run.status, "pending");

	const firstClaim = await runStore.claimNextDue({
		workerId: "worker-a",
		now: new Date("2026-04-21T10:01:00.000Z"),
		leaseMs: 30_000,
	});
	assert.equal(firstClaim?.runId, run.runId);
	assert.equal(firstClaim?.status, "running");
	assert.equal(firstClaim?.leaseOwner, "worker-a");
	assert.equal(firstClaim?.leaseUntil, "2026-04-21T10:01:30.000Z");
	assert.deepEqual(firstClaim?.resolvedSnapshot, {
		profileId: "background.default",
		skillSetId: "skills.default",
	});

	const secondClaim = await runStore.claimNextDue({
		workerId: "worker-b",
		now: new Date("2026-04-21T10:01:15.000Z"),
		leaseMs: 30_000,
	});
	assert.equal(secondClaim, undefined);

	const recoveredClaim = await runStore.claimNextDue({
		workerId: "worker-b",
		now: new Date("2026-04-21T10:01:31.000Z"),
		leaseMs: 30_000,
	});
	assert.equal(recoveredClaim?.runId, run.runId);
	assert.equal(recoveredClaim?.leaseOwner, "worker-b");
	assert.equal(recoveredClaim?.leaseUntil, "2026-04-21T10:02:01.000Z");

	database.close();
});

test("ConnRunStore heartbeatRun refreshes updatedAt and leaseUntil for the owning worker", async () => {
	const { connStore, runStore, database } = await createStores();
	const conn = await connStore.create({
		title: "daily digest",
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
	await runStore.createRun({
		runId: "run-heartbeat",
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: "/tmp/conn/run-heartbeat",
		now: new Date("2026-04-21T10:00:59.000Z"),
	});

	const claimed = await runStore.claimNextDue({
		workerId: "worker-a",
		now: new Date("2026-04-21T10:01:00.000Z"),
		leaseMs: 30_000,
	});
	assert.equal(claimed?.leaseUntil, "2026-04-21T10:01:30.000Z");

	const heartbeated = await runStore.heartbeatRun({
		runId: "run-heartbeat",
		workerId: "worker-a",
		now: new Date("2026-04-21T10:01:20.000Z"),
		leaseMs: 30_000,
	});
	assert.equal(heartbeated?.updatedAt, "2026-04-21T10:01:20.000Z");
	assert.equal(heartbeated?.leaseUntil, "2026-04-21T10:01:50.000Z");

	const rejectedHeartbeat = await runStore.heartbeatRun({
		runId: "run-heartbeat",
		workerId: "worker-b",
		now: new Date("2026-04-21T10:01:25.000Z"),
		leaseMs: 30_000,
	});
	assert.equal(rejectedHeartbeat?.updatedAt, "2026-04-21T10:01:20.000Z");
	assert.equal(rejectedHeartbeat?.leaseUntil, "2026-04-21T10:01:50.000Z");

	database.close();
});

test("ConnRunStore appends ordered run events and output file records", async () => {
	const { connStore, runStore, database } = await createStores();
	const conn = await connStore.create({
		title: "daily digest",
		prompt: "summarize",
		target: {
			type: "conversation",
			conversationId: "manual:conn",
		},
		schedule: {
			kind: "once",
			at: "2026-04-21T10:01:00.000Z",
		},
		now: new Date("2026-04-21T10:00:00.000Z"),
	});
	const run = await runStore.createRun({
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: "/tmp/conn/run-2",
		now: new Date("2026-04-21T10:00:59.000Z"),
	});

	const started = await runStore.appendEvent({
		runId: run.runId,
		eventType: "log",
		event: { message: "started" },
		createdAt: new Date("2026-04-21T10:01:00.000Z"),
	});
	const finished = await runStore.appendEvent({
		runId: run.runId,
		eventType: "log",
		event: { message: "finished" },
		createdAt: new Date("2026-04-21T10:01:05.000Z"),
	});
	assert.equal(started.seq, 1);
	assert.equal(finished.seq, 2);
	assert.deepEqual(await runStore.listEvents(run.runId), [started, finished]);

	const file = await runStore.recordFile({
		runId: run.runId,
		kind: "output",
		relativePath: "output/report.md",
		fileName: "report.md",
		mimeType: "text/markdown",
		sizeBytes: 123,
		createdAt: new Date("2026-04-21T10:01:05.000Z"),
	});
	assert.deepEqual(await runStore.listFiles(run.runId), [file]);

	database.close();
});

test("ConnRunStore completing a run updates the owning conn schedule state", async () => {
	const { connStore, runStore, database } = await createStores();
	const conn = await connStore.create({
		title: "daily digest",
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
	const run = await runStore.createRun({
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: "/tmp/conn/run-3",
		now: new Date("2026-04-21T10:00:59.000Z"),
	});
	await runStore.claimNextDue({
		workerId: "worker-a",
		now: new Date("2026-04-21T10:01:00.000Z"),
		leaseMs: 30_000,
	});

	const completed = await runStore.completeRun({
		runId: run.runId,
		summary: "done",
		text: "full result",
		finishedAt: new Date("2026-04-21T10:01:05.000Z"),
	});
	assert.equal(completed?.status, "succeeded");
	assert.equal(completed?.resultSummary, "done");
	assert.equal(completed?.resultText, "full result");
	assert.equal(completed?.leaseOwner, undefined);

	const updatedConn = await connStore.get(conn.connId);
	assert.equal(updatedConn?.lastRunAt, "2026-04-21T10:01:05.000Z");
	assert.equal(updatedConn?.lastRunId, run.runId);
	assert.equal(updatedConn?.nextRunAt, "2026-04-21T10:02:05.000Z");
	assert.equal(updatedConn?.status, "active");

	database.close();
});

test("ConnRunStore failing a once run marks the owning conn completed", async () => {
	const { connStore, runStore, database } = await createStores();
	const conn = await connStore.create({
		title: "one shot",
		prompt: "run once",
		target: {
			type: "conversation",
			conversationId: "manual:conn",
		},
		schedule: {
			kind: "once",
			at: "2026-04-21T10:01:00.000Z",
		},
		now: new Date("2026-04-21T10:00:00.000Z"),
	});
	const run = await runStore.createRun({
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: "/tmp/conn/run-4",
		now: new Date("2026-04-21T10:00:59.000Z"),
	});

	const failed = await runStore.failRun({
		runId: run.runId,
		summary: "boom",
		errorText: "background worker failed",
		finishedAt: new Date("2026-04-21T10:01:05.000Z"),
	});
	assert.equal(failed?.status, "failed");
	assert.equal(failed?.errorText, "background worker failed");

	const updatedConn = await connStore.get(conn.connId);
	assert.equal(updatedConn?.lastRunAt, "2026-04-21T10:01:05.000Z");
	assert.equal(updatedConn?.lastRunId, run.runId);
	assert.equal(updatedConn?.nextRunAt, undefined);
	assert.equal(updatedConn?.status, "completed");

	database.close();
});
