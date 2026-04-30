import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AgentActivityStore } from "../src/agent/agent-activity-store.js";
import { ConnDatabase } from "../src/agent/conn-db.js";
import type { ConnRunRecord } from "../src/agent/conn-run-store.js";
import { ConnRunStore } from "../src/agent/conn-run-store.js";
import { ConnSqliteStore } from "../src/agent/conn-sqlite-store.js";
import type { ConnDefinition } from "../src/agent/conn-store.js";
import type { NotificationBroadcastEvent } from "../src/agent/notification-hub.js";
import { ConnWorker, resolveBackgroundSessionModel } from "../src/workers/conn-worker.js";

class FakeRunner {
	calls: Array<{ conn: ConnDefinition; run: ConnRunRecord }> = [];

	async run(conn: ConnDefinition, run: ConnRunRecord, now: Date): Promise<ConnRunRecord | undefined> {
		this.calls.push({ conn, run });
		return {
			...run,
			status: "succeeded",
			resultSummary: `summary for ${conn.title}`,
			resultText: `result for ${conn.title}`,
			resolvedSnapshot: {
				provider: conn.modelProvider ?? "xiaomi-mimo-cn",
				model: conn.modelId ?? "mimo-v2.5-pro",
			},
			finishedAt: now.toISOString(),
		};
	}
}

class FailingRunner {
	calls = 0;

	async run(_conn: ConnDefinition, run: ConnRunRecord, now: Date): Promise<ConnRunRecord | undefined> {
		this.calls += 1;
		return {
			...run,
			status: "failed",
			resultSummary: "boom",
			errorText: "boom",
			resolvedSnapshot: {
				provider: "xiaomi-mimo-cn",
				model: "mimo-v2.5-pro",
			},
			finishedAt: now.toISOString(),
		};
	}
}

test("resolveBackgroundSessionModel returns the model selected by the background snapshot", () => {
	const expectedModel = {
		provider: "deepseek-anthropic",
		id: "deepseek-v4-pro",
		name: "DeepSeek V4 Pro",
		api: "anthropic",
		baseUrl: "https://example.test",
		reasoning: true,
		contextWindow: 1048576,
		maxTokens: 262144,
		input: ["text"],
		output: ["text"],
	} as const;
	const calls: Array<{ provider: string; model: string }> = [];
	const modelRegistry = {
		find(provider: string, model: string) {
			calls.push({ provider, model });
			return provider === expectedModel.provider && model === expectedModel.id ? expectedModel : undefined;
		},
	};

	const resolved = resolveBackgroundSessionModel(modelRegistry as never, {
		provider: "deepseek-anthropic",
		model: "deepseek-v4-pro",
	});

	assert.equal(resolved, expectedModel);
	assert.deepEqual(calls, [{ provider: "deepseek-anthropic", model: "deepseek-v4-pro" }]);
});

test("resolveBackgroundSessionModel rejects missing background snapshot models instead of falling back", () => {
	const modelRegistry = {
		find() {
			return undefined;
		},
	};

	assert.throws(
		() =>
			resolveBackgroundSessionModel(modelRegistry as never, {
				provider: "missing-provider",
				model: "missing-model",
			}),
		/Background agent model not found: missing-provider\/missing-model/,
	);
});

test("resolveBackgroundSessionModel migrates deprecated DeepSeek Flash snapshots to DeepSeek Pro", () => {
	const replacementModel = {
		provider: "deepseek-anthropic",
		id: "deepseek-v4-pro",
		name: "DeepSeek V4 Pro",
		api: "anthropic",
		baseUrl: "https://example.test",
		reasoning: true,
		contextWindow: 1048576,
		maxTokens: 262144,
		input: ["text"],
		output: ["text"],
	} as const;
	const calls: Array<{ provider: string; model: string }> = [];
	const modelRegistry = {
		find(provider: string, model: string) {
			calls.push({ provider, model });
			return provider === replacementModel.provider && model === replacementModel.id ? replacementModel : undefined;
		},
	};

	const resolved = resolveBackgroundSessionModel(modelRegistry as never, {
		provider: "deepseek-anthropic",
		model: "deepseek-v4-flash",
	});

	assert.equal(resolved, replacementModel);
	assert.deepEqual(calls, [
		{ provider: "deepseek-anthropic", model: "deepseek-v4-flash" },
		{ provider: "deepseek-anthropic", model: "deepseek-v4-pro" },
	]);
});

test("resolveBackgroundSessionModel rejects deprecated aliases when the replacement is missing", () => {
	const modelRegistry = {
		find() {
			return undefined;
		},
	};

	assert.throws(
		() =>
			resolveBackgroundSessionModel(modelRegistry as never, {
				provider: "deepseek-anthropic",
				model: "deepseek-v4-flash",
			}),
		/Background agent model not found: deepseek-anthropic\/deepseek-v4-flash; deprecated alias replacement missing: deepseek-anthropic\/deepseek-v4-pro/,
	);
});

async function createWorker(runner: FakeRunner | FailingRunner): Promise<{
	database: ConnDatabase;
	connStore: ConnSqliteStore;
	runStore: ConnRunStore;
	activityStore: AgentActivityStore;
	broadcasts: NotificationBroadcastEvent[];
	worker: ConnWorker;
}> {
	return await createWorkerWithOptions(runner, {});
}

async function createWorkerWithOptions(
	runner: FakeRunner | FailingRunner | { run(conn: ConnDefinition, run: ConnRunRecord, now: Date): Promise<ConnRunRecord | undefined> },
	options: {
		maxConcurrency?: number;
		leaseMs?: number;
		heartbeatMs?: number;
		activityNotifications?: string[];
	},
): Promise<{
	database: ConnDatabase;
	connStore: ConnSqliteStore;
	runStore: ConnRunStore;
	activityStore: AgentActivityStore;
	broadcasts: NotificationBroadcastEvent[];
	worker: ConnWorker;
}> {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-conn-worker-"));
	const database = new ConnDatabase({ dbPath: join(root, "conn.sqlite") });
	await database.initialize();
	const connStore = new ConnSqliteStore({ database });
	const runStore = new ConnRunStore({ database });
	const activityStore = new AgentActivityStore({ database });
	const broadcasts: NotificationBroadcastEvent[] = [];
	return {
		database,
		connStore,
		runStore,
		activityStore,
		broadcasts,
		worker: new ConnWorker({
			workerId: "worker-a",
			backgroundDataDir: join(root, "background"),
			connStore,
			runStore,
			activityStore,
			notificationBroadcaster: {
				broadcast: async (event) => {
					broadcasts.push(event);
				},
			},
			activityNotifier: options.activityNotifications
				? {
						notify: async (activity) => {
							options.activityNotifications?.push(`${activity.title}\n${activity.text}`);
						},
					}
				: undefined,
			runner,
			leaseMs: options.leaseMs ?? 30_000,
			heartbeatMs: options.heartbeatMs,
			maxConcurrency: options.maxConcurrency ?? 1,
		}),
	};
}

test("ConnWorker enqueues due conn runs, executes one claim, and creates a task inbox activity", async () => {
	const runner = new FakeRunner();
	const { database, connStore, runStore, activityStore, broadcasts, worker } = await createWorker(runner);
	const conn = await connStore.create({
		title: "Daily Digest",
		prompt: "Summarize",
		target: {
			type: "task_inbox",
		},
		schedule: {
			kind: "once",
			at: "2026-04-21T10:01:00.000Z",
		},
		now: new Date("2026-04-21T10:00:00.000Z"),
	});

	await worker.tick(new Date("2026-04-21T10:01:05.000Z"));

	assert.equal(runner.calls.length, 1);
	assert.equal(runner.calls[0].conn.connId, conn.connId);
	const runs = await runStore.listRunsForConn(conn.connId);
	assert.equal(runs.length, 1);
	assert.equal(runs[0].status, "running");
	assert.ok(runs[0].workspacePath.endsWith(join("background", "runs", runs[0].runId)));
	const activities = await activityStore.list();
	assert.deepEqual(broadcasts, [
		{
			activityId: activities[0]?.activityId,
			source: "conn",
			sourceId: conn.connId,
			runId: runs[0].runId,
			kind: "conn_result",
			title: "Daily Digest completed",
			createdAt: "2026-04-21T10:01:05.000Z",
		},
	]);
	assert.deepEqual(
		activities.map((activity) => ({
			source: activity.source,
			sourceId: activity.sourceId,
			runId: activity.runId,
			conversationId: activity.conversationId,
			title: activity.title,
			text: activity.text,
		})),
		[
			{
				source: "conn",
				sourceId: conn.connId,
				runId: runs[0].runId,
				conversationId: undefined,
				title: "Daily Digest completed",
				text: "执行模型：xiaomi-mimo-cn / mimo-v2.5-pro\n\nresult for Daily Digest",
			},
		],
	);

	database.close();
});

test("ConnWorker mirrors global activity notifications to the optional activity notifier", async () => {
	const runner = new FakeRunner();
	const activityNotifications: string[] = [];
	const { database, connStore, activityStore, worker } = await createWorkerWithOptions(runner, {
		activityNotifications,
	});
	const conn = await connStore.create({
		title: "Feishu Mirror",
		prompt: "Summarize",
		target: {
			type: "task_inbox",
		},
		schedule: {
			kind: "once",
			at: "2026-04-21T10:00:00.000Z",
		},
		now: new Date("2026-04-21T09:59:00.000Z"),
	});

	await worker.tick(new Date("2026-04-21T10:01:05.000Z"));

	const activities = await activityStore.list();
	assert.equal(activities.length, 1);
	assert.deepEqual(activityNotifications, [
		"Feishu Mirror completed\n执行模型：xiaomi-mimo-cn / mimo-v2.5-pro\n\nresult for Feishu Mirror",
	]);

	database.close();
});

test("ConnWorker creates global activity for feishu targets too", async () => {
	const runner = new FakeRunner();
	const { database, connStore, runStore, activityStore, broadcasts, worker } = await createWorker(runner);
	const conn = await connStore.create({
		title: "Feishu Digest",
		prompt: "Summarize",
		target: {
			type: "feishu_chat",
			chatId: "chat-1",
		},
		schedule: {
			kind: "once",
			at: "2026-04-21T10:01:00.000Z",
		},
		now: new Date("2026-04-21T10:00:00.000Z"),
	});

	await worker.tick(new Date("2026-04-21T10:01:05.000Z"));

	const runs = await runStore.listRunsForConn(conn.connId);
	assert.equal(runs.length, 1);
	assert.equal(runs[0].status, "running");
	const activities = await activityStore.list();
	assert.deepEqual(broadcasts, [
		{
			activityId: activities[0]?.activityId,
			source: "conn",
			sourceId: conn.connId,
			runId: runs[0].runId,
			kind: "conn_result",
			title: "Feishu Digest completed",
			createdAt: "2026-04-21T10:01:05.000Z",
		},
	]);
	assert.deepEqual(
		activities.map((activity) => ({
			source: activity.source,
			sourceId: activity.sourceId,
			runId: activity.runId,
			conversationId: activity.conversationId,
			title: activity.title,
			text: activity.text,
		})),
		[
			{
				source: "conn",
				sourceId: conn.connId,
				runId: runs[0].runId,
				conversationId: undefined,
				title: "Feishu Digest completed",
				text: "执行模型：xiaomi-mimo-cn / mimo-v2.5-pro\n\nresult for Feishu Digest",
			},
		],
	);

	database.close();
});

test("ConnWorker failure does not abort the tick loop and creates a failure activity", async () => {
	const runner = new FailingRunner();
	const { database, connStore, activityStore, broadcasts, worker } = await createWorker(runner);
	const conn = await connStore.create({
		title: "Daily Digest",
		prompt: "Summarize",
		target: {
			type: "task_inbox",
		},
		schedule: {
			kind: "once",
			at: "2026-04-21T10:01:00.000Z",
		},
		now: new Date("2026-04-21T10:00:00.000Z"),
	});

	await worker.tick(new Date("2026-04-21T10:01:05.000Z"));

	assert.equal(runner.calls, 1);
	const activities = await activityStore.list();
	assert.deepEqual(
		activities.map((activity) => ({
			source: activity.source,
			sourceId: activity.sourceId,
			runId: activity.runId,
			title: activity.title,
			text: activity.text,
		})),
		[
			{
				source: "conn",
				sourceId: conn.connId,
				runId: activities[0]?.runId,
				title: "Daily Digest failed",
				text: "执行模型：xiaomi-mimo-cn / mimo-v2.5-pro\n\nboom",
			},
		],
	);
	assert.deepEqual(broadcasts, [
		{
			activityId: activities[0]?.activityId,
			source: "conn",
			sourceId: conn.connId,
			runId: activities[0]?.runId,
			kind: "conn_result",
			title: "Daily Digest failed",
			createdAt: "2026-04-21T10:01:05.000Z",
		},
	]);
	assert.deepEqual(
		activities.map((activity) => ({
			source: activity.source,
			sourceId: activity.sourceId,
			runId: activity.runId,
			conversationId: activity.conversationId,
			title: activity.title,
			text: activity.text,
		})),
		[
			{
				source: "conn",
				sourceId: conn.connId,
				runId: activities[0]?.runId,
				conversationId: undefined,
				title: "Daily Digest failed",
				text: "执行模型：xiaomi-mimo-cn / mimo-v2.5-pro\n\nboom",
			},
		],
	);

	database.close();
});

test("ConnWorker claims and starts multiple due runs before waiting for the first one to finish", async () => {
	const pending = new Map<
		string,
		{
			resolve: () => void;
		}
	>();
	const started: string[] = [];
	const runner = {
		run: async (conn: ConnDefinition, run: ConnRunRecord, now: Date): Promise<ConnRunRecord | undefined> => {
			started.push(conn.title);
			return await new Promise<ConnRunRecord>((resolve) => {
				pending.set(conn.title, {
					resolve: () =>
						resolve({
							...run,
							status: "succeeded",
							resultSummary: `summary for ${conn.title}`,
							resultText: `result for ${conn.title}`,
							finishedAt: now.toISOString(),
						}),
				});
			});
		},
	};
	const { database, connStore, worker } = await createWorkerWithOptions(runner, {
		maxConcurrency: 2,
	});

	await connStore.create({
		title: "Parallel A",
		prompt: "Summarize A",
		target: {
			type: "conversation",
			conversationId: "manual:parallel",
		},
		schedule: {
			kind: "once",
			at: "2026-04-21T10:01:00.000Z",
		},
		now: new Date("2026-04-21T10:00:00.000Z"),
	});
	await connStore.create({
		title: "Parallel B",
		prompt: "Summarize B",
		target: {
			type: "conversation",
			conversationId: "manual:parallel",
		},
		schedule: {
			kind: "once",
			at: "2026-04-21T10:01:00.000Z",
		},
		now: new Date("2026-04-21T10:00:00.000Z"),
	});

	const tickPromise = worker.tick(new Date("2026-04-21T10:01:05.000Z"));
	await new Promise((resolve) => setImmediate(resolve));

	assert.deepEqual(started.sort(), ["Parallel A", "Parallel B"]);

	pending.get("Parallel A")?.resolve();
	pending.get("Parallel B")?.resolve();

	await tickPromise;
	database.close();
});

test("ConnWorker refreshes lease heartbeat while a claimed run is still executing", async () => {
	const pending = new Map<
		string,
		{
			resolve: () => void;
		}
	>();
	const runner = {
		run: async (conn: ConnDefinition, run: ConnRunRecord, now: Date): Promise<ConnRunRecord | undefined> =>
			await new Promise<ConnRunRecord>((resolve) => {
				pending.set(conn.title, {
					resolve: () =>
						resolve({
							...run,
							status: "succeeded",
							resultSummary: `summary for ${conn.title}`,
							resultText: `result for ${conn.title}`,
							finishedAt: now.toISOString(),
						}),
				});
			}),
	};
	const { database, connStore, runStore, worker } = await createWorkerWithOptions(runner, {
		leaseMs: 60,
		heartbeatMs: 20,
	});

	const conn = await connStore.create({
		title: "Heartbeat Run",
		prompt: "Summarize",
		target: {
			type: "conversation",
			conversationId: "manual:heartbeat",
		},
		schedule: {
			kind: "once",
			at: "2026-04-21T10:01:00.000Z",
		},
		now: new Date("2026-04-21T10:00:00.000Z"),
	});

	const tickPromise = worker.tick(new Date("2026-04-21T10:01:05.000Z"));
	await new Promise((resolve) => setTimeout(resolve, 90));

	const runs = await runStore.listRunsForConn(conn.connId);
	assert.equal(runs.length, 1);
	assert.equal(runs[0].status, "running");
	assert.ok(runs[0].leaseUntil);
	assert.notEqual(runs[0].updatedAt, "2026-04-21T10:01:05.000Z");

	pending.get("Heartbeat Run")?.resolve();
	await tickPromise;

	database.close();
});

test("ConnWorker fails stale leased runs before claiming fresh due work", async () => {
	const runner = new FakeRunner();
	const { database, connStore, runStore, activityStore, broadcasts, worker } = await createWorkerWithOptions(runner, {
		maxConcurrency: 1,
	});

	const staleConn = await connStore.create({
		title: "Stale Run",
		prompt: "Summarize stale",
		target: {
			type: "conversation",
			conversationId: "manual:stale",
		},
		schedule: {
			kind: "once",
			at: "2026-04-21T10:01:00.000Z",
		},
		now: new Date("2026-04-21T10:00:00.000Z"),
	});
	await runStore.createRun({
		runId: "run-stale",
		connId: staleConn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: "/tmp/conn/run-stale",
		now: new Date("2026-04-21T10:00:59.000Z"),
	});
	await runStore.claimNextDue({
		workerId: "worker-old",
		now: new Date("2026-04-21T10:01:00.000Z"),
		leaseMs: 30_000,
	});

	const freshConn = await connStore.create({
		title: "Fresh Run",
		prompt: "Summarize fresh",
		target: {
			type: "conversation",
			conversationId: "manual:fresh",
		},
		schedule: {
			kind: "once",
			at: "2026-04-21T10:01:00.000Z",
		},
		now: new Date("2026-04-21T10:00:00.000Z"),
	});

	await worker.tick(new Date("2026-04-21T10:01:40.000Z"));

	const staleRun = await runStore.getRun("run-stale");
	assert.equal(staleRun?.status, "failed");
	assert.match(staleRun?.errorText ?? "", /lease expired/i);
	assert.deepEqual(
		(await runStore.listEvents("run-stale")).map((event) => event.eventType),
		["run_stale"],
	);

	const freshRuns = await runStore.listRunsForConn(freshConn.connId);
	assert.equal(freshRuns.length, 1);
	assert.equal(freshRuns[0].status, "running");
	assert.equal(runner.calls.length, 1);
	assert.equal(runner.calls[0].conn.connId, freshConn.connId);
	const activities = await activityStore.list();
	assert.deepEqual(activities.map((activity) => activity.title).sort(), ["Fresh Run completed", "Stale Run failed"].sort());
	assert.deepEqual(
		broadcasts.map((event) => event.title).sort(),
		["Fresh Run completed", "Stale Run failed"].sort(),
	);

	database.close();
});

test("ConnWorker fails runs that exceed conn maxRunMs and delivers a failure activity", async () => {
	const runner = {
		run: async (_conn: ConnDefinition, _run: ConnRunRecord, _now: Date, signal?: AbortSignal): Promise<ConnRunRecord | undefined> =>
			await new Promise<ConnRunRecord>((_resolve, reject) => {
				signal?.addEventListener(
					"abort",
					() => {
						reject(signal.reason instanceof Error ? signal.reason : new Error(String(signal?.reason ?? "aborted")));
					},
					{ once: true },
				);
			}),
	};
	const { database, connStore, runStore, activityStore, broadcasts, worker } = await createWorkerWithOptions(runner, {
		maxConcurrency: 1,
	});

	const conn = await connStore.create({
		title: "Timed Run",
		prompt: "Summarize forever",
		target: {
			type: "conversation",
			conversationId: "manual:timeout",
		},
		schedule: {
			kind: "once",
			at: "2026-04-21T10:01:00.000Z",
		},
		maxRunMs: 25,
		now: new Date("2026-04-21T10:00:00.000Z"),
	});

	await worker.tick(new Date("2026-04-21T10:01:05.000Z"));

	const runs = await runStore.listRunsForConn(conn.connId);
	assert.equal(runs.length, 1);
	assert.equal(runs[0].status, "failed");
	assert.match(runs[0].errorText ?? "", /exceeded maxRunMs/i);
	assert.deepEqual(
		(await runStore.listEvents(runs[0].runId)).map((event) => event.eventType),
		["run_timed_out"],
	);
	const activities = await activityStore.list();
	assert.deepEqual(
		activities.map((activity) => ({
			source: activity.source,
			sourceId: activity.sourceId,
			runId: activity.runId,
			title: activity.title,
			text: activity.text,
		})),
		[
			{
				source: "conn",
				sourceId: conn.connId,
				runId: runs[0].runId,
				title: "Timed Run failed",
				text: "Conn run exceeded maxRunMs (25ms)",
			},
		],
	);
	assert.deepEqual(broadcasts, [
		{
			activityId: activities[0]?.activityId,
			source: "conn",
			sourceId: conn.connId,
			runId: runs[0].runId,
			kind: "conn_result",
			title: "Timed Run failed",
			createdAt: "2026-04-21T10:01:05.000Z",
		},
	]);
	assert.deepEqual(
		activities.map((activity) => ({
			source: activity.source,
			sourceId: activity.sourceId,
			runId: activity.runId,
			conversationId: activity.conversationId,
			title: activity.title,
			text: activity.text,
		})),
		[
			{
				source: "conn",
				sourceId: conn.connId,
				runId: runs[0].runId,
				conversationId: undefined,
				title: "Timed Run failed",
				text: "Conn run exceeded maxRunMs (25ms)",
			},
		],
	);

	database.close();
});
