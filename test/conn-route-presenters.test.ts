import test from "node:test";
import assert from "node:assert/strict";
import {
	sortConnListBodiesByRecentRun,
	toConnListBody,
	toConnRunBody,
	toConnRunEventBody,
	toConnRunFileBody,
} from "../src/routes/conn-route-presenters.js";
import type { ConnDefinition } from "../src/agent/conn-store.js";
import type { ConnRunEventRecord, ConnRunFileRecord, ConnRunRecord } from "../src/agent/conn-run-store.js";

test("conn route presenters map conn latest run and run detail response fields", () => {
	const conn: ConnDefinition = {
		connId: "conn-1",
		title: "Digest",
		prompt: "Summarize",
		target: { type: "task_inbox" },
		schedule: { kind: "once", at: "2026-04-22T10:00:00.000Z" },
		assetRefs: ["asset-1"],
		profileId: "background.default",
		agentSpecId: "agent.default",
		skillSetId: "skills.default",
		modelPolicyId: "model.default",
		upgradePolicy: "latest",
		status: "active",
		createdAt: "2026-04-22T09:00:00.000Z",
		updatedAt: "2026-04-22T09:00:00.000Z",
		nextRunAt: "2026-04-22T10:00:00.000Z",
	};
	const run: ConnRunRecord = {
		runId: "run-1",
		connId: "conn-1",
		status: "succeeded",
		scheduledAt: "2026-04-22T10:00:00.000Z",
		claimedAt: "2026-04-22T10:00:01.000Z",
		startedAt: "2026-04-22T10:00:02.000Z",
		finishedAt: "2026-04-22T10:00:03.000Z",
		leaseOwner: "worker-1",
		leaseUntil: "2026-04-22T10:05:00.000Z",
		workspacePath: "/app/.data/background/runs/run-1",
		sessionFile: "/app/.data/agent/sessions/run-1.jsonl",
		resolvedSnapshot: {
			requestedAgentId: "missing-agent",
			agentId: "main",
			agentName: "主 Agent",
			fallbackUsed: true,
			fallbackReason: "profile_not_found",
			provider: "deepseek",
			model: "deepseek-v4-pro",
		},
		resultSummary: "done",
		resultText: "full result",
		deliveredAt: "2026-04-22T10:00:04.000Z",
		createdAt: "2026-04-22T10:00:00.000Z",
		updatedAt: "2026-04-22T10:00:04.000Z",
	};

	assert.deepEqual(toConnListBody(conn, { "conn-1": run }).latestRun, toConnRunBody(run));
	assert.deepEqual(toConnListBody(conn, {}).latestRun, null);
	assert.equal("latestRun" in toConnListBody(conn, undefined), false);
	assert.deepEqual(toConnRunBody(run), {
		runId: "run-1",
		connId: "conn-1",
		status: "succeeded",
		scheduledAt: "2026-04-22T10:00:00.000Z",
		claimedAt: "2026-04-22T10:00:01.000Z",
		startedAt: "2026-04-22T10:00:02.000Z",
		leaseOwner: "worker-1",
		leaseUntil: "2026-04-22T10:05:00.000Z",
		finishedAt: "2026-04-22T10:00:03.000Z",
		workspacePath: "/app/.data/background/runs/run-1",
		sessionFile: "/app/.data/agent/sessions/run-1.jsonl",
		resolvedSnapshot: {
			requestedAgentId: "missing-agent",
			agentId: "main",
			agentName: "主 Agent",
			fallbackUsed: true,
			fallbackReason: "profile_not_found",
			provider: "deepseek",
			model: "deepseek-v4-pro",
		},
		resultSummary: "done",
		resultText: "full result",
		deliveredAt: "2026-04-22T10:00:04.000Z",
		createdAt: "2026-04-22T10:00:00.000Z",
		updatedAt: "2026-04-22T10:00:04.000Z",
	});
});

test("conn route presenters map run files and events", () => {
	const file: ConnRunFileRecord = {
		fileId: "file-1",
		runId: "run-1",
		kind: "output",
		relativePath: "report.md",
		fileName: "report.md",
		mimeType: "text/markdown",
		sizeBytes: 128,
		createdAt: "2026-04-22T10:00:05.000Z",
	};
	const event: ConnRunEventRecord = {
		eventId: "event-1",
		runId: "run-1",
		seq: 2,
		eventType: "run_succeeded",
		event: { ok: true },
		createdAt: "2026-04-22T10:00:06.000Z",
	};

	assert.deepEqual(toConnRunFileBody(file), file);
	assert.deepEqual(toConnRunEventBody(event), event);
});

test("conn list bodies sort by latest completed run time first", () => {
	const makeConn = (connId: string, title: string, createdAt: string): ConnDefinition => ({
		connId,
		title,
		prompt: "Summarize",
		target: { type: "task_inbox" },
		schedule: { kind: "interval", everyMs: 60000 },
		assetRefs: [],
		status: "active",
		createdAt,
		updatedAt: createdAt,
	});
	const makeRun = (connId: string, runId: string, finishedAt: string): ConnRunRecord => ({
		runId,
		connId,
		status: "succeeded",
		scheduledAt: finishedAt,
		finishedAt,
		workspacePath: "/app/.data/background/runs/" + runId,
		createdAt: finishedAt,
		updatedAt: finishedAt,
	});

	const older = toConnListBody(makeConn("conn-older", "Older", "2026-04-22T08:00:00.000Z"), {
		"conn-older": makeRun("conn-older", "run-older", "2026-04-22T10:00:00.000Z"),
	});
	const newer = toConnListBody(makeConn("conn-newer", "Newer", "2026-04-22T07:00:00.000Z"), {
		"conn-newer": makeRun("conn-newer", "run-newer", "2026-04-22T12:00:00.000Z"),
	});
	const neverRun = toConnListBody(makeConn("conn-never", "Never", "2026-04-22T11:00:00.000Z"), {});

	assert.deepEqual(
		sortConnListBodiesByRecentRun([older, neverRun, newer]).map((conn) => conn.connId),
		["conn-newer", "conn-older", "conn-never"],
	);
});
