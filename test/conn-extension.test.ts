import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import connExtension from "../.pi/extensions/conn/index.js";

interface RegisteredTool {
	name: string;
	execute(
		toolCallId: string,
		params: Record<string, unknown>,
		signal: AbortSignal,
		onUpdate: (payload: unknown) => void,
		ctx: { cwd: string },
	): Promise<{
		content?: Array<{ type: string; text?: string }>;
		details?: Record<string, unknown>;
		isError?: boolean;
	}>;
}

function registerConnTool(): RegisteredTool {
	let registeredTool: RegisteredTool | undefined;
	connExtension({
		registerTool(tool: RegisteredTool) {
			registeredTool = tool;
		},
	} as never);
	assert.ok(registeredTool);
	return registeredTool;
}

async function createProjectRoot(): Promise<string> {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-conn-extension-"));
	await mkdir(join(projectRoot, ".pi"), { recursive: true });
	return projectRoot;
}

test("conn extension creates cron tasks with timezone and asset refs", async () => {
	const tool = registerConnTool();
	const projectRoot = await createProjectRoot();

	const result = await tool.execute(
		"call-1",
		{
			action: "create",
			title: "每日摘要",
			prompt: "每天 07:00 整理一份摘要",
			target: { type: "conversation", conversationId: "manual:digest" },
			schedule: { kind: "cron", expression: "0 7 * * *", timezone: "Asia/Shanghai" },
			assetRefs: ["asset-a", "asset-b"],
		},
		new AbortController().signal,
		() => {},
		{ cwd: projectRoot },
	);

	assert.equal(result.isError, undefined);
	assert.equal(result.details?.action, "create");
	const conn = result.details?.conn as { schedule: { kind: string; expression: string; timezone?: string }; assetRefs: string[] };
	assert.equal(conn.schedule.kind, "cron");
	assert.equal(conn.schedule.expression, "0 7 * * *");
	assert.equal(conn.schedule.timezone, "Asia/Shanghai");
	assert.deepEqual(conn.assetRefs, ["asset-a", "asset-b"]);
});

test("conn extension treats one-time wall-clock schedules as the provided timezone", async () => {
	const previousTz = process.env.TZ;
	process.env.TZ = "UTC";
	const tool = registerConnTool();
	const projectRoot = await createProjectRoot();
	try {
		const result = await tool.execute(
			"call-local-once",
			{
				action: "create",
				title: "下午提醒",
				prompt: "北京时间下午 1 点提醒我",
				target: { type: "conversation", conversationId: "manual:reminder" },
				schedule: { kind: "once", at: "2099-04-23T13:00:00", timezone: "Asia/Shanghai" },
			},
			new AbortController().signal,
			() => {},
			{ cwd: projectRoot },
		);

		assert.equal(result.isError, undefined);
		const conn = result.details?.conn as { schedule: { kind: string; at: string; timezone?: string }; nextRunAt?: string };
		assert.equal(conn.schedule.kind, "once");
		assert.equal(conn.schedule.at, "2099-04-23T05:00:00.000Z");
		assert.equal(conn.schedule.timezone, "Asia/Shanghai");
		assert.equal(conn.nextRunAt, "2099-04-23T05:00:00.000Z");
	} finally {
		if (previousTz === undefined) {
			delete process.env.TZ;
		} else {
			process.env.TZ = previousTz;
		}
	}
});

test("conn extension lists and reads queued runs for a task", async () => {
	const tool = registerConnTool();
	const projectRoot = await createProjectRoot();

	const createResult = await tool.execute(
		"call-create",
		{
			action: "create",
			title: "定时巡检",
			prompt: "每 10 分钟巡检一次",
			target: { type: "conversation", conversationId: "manual:ops" },
			schedule: { kind: "interval", everyMs: 600000 },
		},
		new AbortController().signal,
		() => {},
		{ cwd: projectRoot },
	);
	const conn = createResult.details?.conn as { connId: string };
	assert.ok(conn?.connId);

	const runNowResult = await tool.execute(
		"call-run-now",
		{
			action: "run_now",
			connId: conn.connId,
		},
		new AbortController().signal,
		() => {},
		{ cwd: projectRoot },
	);
	assert.equal(runNowResult.isError, undefined);
	assert.equal(runNowResult.details?.action, "run_now");
	const run = runNowResult.details?.run as { runId: string; connId: string; status: string };
	assert.equal(run.connId, conn.connId);
	assert.equal(run.status, "pending");

	const listRunsResult = await tool.execute(
		"call-list-runs",
		{
			action: "list_runs",
			connId: conn.connId,
		},
		new AbortController().signal,
		() => {},
		{ cwd: projectRoot },
	);
	assert.equal(listRunsResult.isError, undefined);
	const runs = listRunsResult.details?.runs as Array<{ runId: string }>;
	assert.equal(runs.length, 1);
	assert.equal(runs[0]?.runId, run.runId);

	const getRunResult = await tool.execute(
		"call-get-run",
		{
			action: "get_run",
			connId: conn.connId,
			runId: run.runId,
		},
		new AbortController().signal,
		() => {},
		{ cwd: projectRoot },
	);
	assert.equal(getRunResult.isError, undefined);
	assert.equal((getRunResult.details?.run as { runId: string }).runId, run.runId);
	assert.deepEqual(getRunResult.details?.events, []);
	assert.deepEqual(getRunResult.details?.files, []);
});
