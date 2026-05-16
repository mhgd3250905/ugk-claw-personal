import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildServer } from "../src/server.js";
import type { AgentService } from "../src/agent/agent-service.js";

function createAgentServiceStub() {
	return {
		chat: async () => ({ reply: "ok", conversationId: "c1", runId: "r1" }),
		streamChat: async () => {},
		queueMessage: async () => ({ reply: "ok", conversationId: "c1", runId: "r1" }),
		interruptChat: async () => {},
		resetConversation: async () => {},
		getAgentRunStatus: async () => ({ conversationId: "c1", running: false }),
		getRunStatus: async () => ({ conversationId: "c1", running: false, contextUsage: { provider: "p", model: "m", currentTokens: 0, contextWindow: 128000, reserveTokens: 16000, maxResponseTokens: 8000, availableTokens: 112000, percent: 0, status: "safe" as const, mode: "usage" as const } }),
		subscribeRunEvents: () => ({ conversationId: "c1", running: false, unsubscribe: () => {} }),
		getRunEvents: async () => [],
		getConversations: async () => [],
		getConversation: async () => null,
		createConversation: async () => ({ id: "c1", title: "t", createdAt: "", updatedAt: "" }),
		switchConversation: async () => {},
		deleteConversation: async () => {},
	} as unknown as AgentService;
}

async function buildTestServer() {
	const root = await mkdtemp(join(tmpdir(), "team-sse-"));
	const teamDir = join(root, "team");
	process.env.TEAM_RUNTIME_ENABLED = "true";
	process.env.TEAM_DATA_DIR = teamDir;
	const app = await buildServer({ agentService: createAgentServiceStub() });
	return { app, root, teamDir };
}

const unitBody = {
	title: "SSE测试团队",
	description: "测试用",
	watcherProfileId: "main",
	workerProfileId: "main",
	checkerProfileId: "main",
	finalizerProfileId: "main",
};

const planBody = (teamUnitId: string) => ({
	title: "SSE测试计划",
	defaultTeamUnitId: teamUnitId,
	goal: { text: "测试目标" },
	tasks: [{ id: "t1", title: "任务1", input: { text: "做任务1" }, acceptance: { rules: ["规则1"] } }],
	outputContract: { text: "输出" },
});

// ── SSE tests ──

test("GET /v1/team/runs/:runId/events returns 404 for missing run", async () => {
	const { app, root } = await buildTestServer();
	try {
		const res = await app.inject({ method: "GET", url: "/v1/team/runs/run_missing/events" });
		assert.equal(res.statusCode, 404);
		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch { /* concurrent write */ }
	}
});

test("SSE sends initial snapshot and closes for terminal (cancelled) run", async () => {
	const { app, root } = await buildTestServer();
	try {
		const unitRes = await app.inject({ method: "POST", url: "/v1/team/team-units", payload: unitBody });
		const planRes = await app.inject({ method: "POST", url: "/v1/team/plans", payload: planBody(unitRes.json().teamUnitId) });
		const runRes = await app.inject({ method: "POST", url: `/v1/team/plans/${planRes.json().planId}/runs` });
		const runId = runRes.json().runId;

		// Cancel the run to make it terminal
		await app.inject({ method: "POST", url: `/v1/team/runs/${runId}/cancel`, payload: { reason: "test" } });

		const res = await app.inject({ method: "GET", url: `/v1/team/runs/${runId}/events` });
		assert.equal(res.statusCode, 200);
		assert.ok(res.headers["content-type"]?.includes("text/event-stream"));
		const body = res.body.toString();
		assert.match(body, /"status":"cancelled"/);
		assert.match(body, /data:/);

		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch { /* concurrent write */ }
	}
});

test("SSE snapshot for cancelled run contains expected fields", async () => {
	const { app, root } = await buildTestServer();
	try {
		const unitRes = await app.inject({ method: "POST", url: "/v1/team/team-units", payload: unitBody });
		const planRes = await app.inject({ method: "POST", url: "/v1/team/plans", payload: planBody(unitRes.json().teamUnitId) });
		const runRes = await app.inject({ method: "POST", url: `/v1/team/plans/${planRes.json().planId}/runs` });
		const runId = runRes.json().runId;

		await app.inject({ method: "POST", url: `/v1/team/runs/${runId}/cancel`, payload: { reason: "test" } });

		const res = await app.inject({ method: "GET", url: `/v1/team/runs/${runId}/events` });
		const body = res.body.toString();
		const dataMatch = body.match(/data:\s*(\{.*\})\n/);
		assert.ok(dataMatch, "should have SSE data line");
		const parsed = JSON.parse(dataMatch[1]);
		assert.equal(parsed.type, "snapshot");
		assert.ok(parsed.data);
		assert.equal(parsed.data.runId, runId);
		assert.equal(parsed.data.status, "cancelled");
		assert.ok(parsed.data.taskStates);
		assert.ok(parsed.data.summary);
		assert.equal(parsed.data.summary.totalTasks, 1);

		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch { /* concurrent write */ }
	}
});

// ── Attempt API tests ──

test("GET attempts returns empty for run without attempts", async () => {
	const { app, root } = await buildTestServer();
	try {
		const unitRes = await app.inject({ method: "POST", url: "/v1/team/team-units", payload: unitBody });
		const planRes = await app.inject({ method: "POST", url: "/v1/team/plans", payload: planBody(unitRes.json().teamUnitId) });
		const runRes = await app.inject({ method: "POST", url: `/v1/team/plans/${planRes.json().planId}/runs` });
		const runId = runRes.json().runId;

		const res = await app.inject({ method: "GET", url: `/v1/team/runs/${runId}/tasks/t1/attempts` });
		assert.equal(res.statusCode, 200);
		assert.deepEqual(res.json().attempts, []);

		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch { /* concurrent write */ }
	}
});

test("GET attempts returns 404 for missing run", async () => {
	const { app, root } = await buildTestServer();
	try {
		const res = await app.inject({ method: "GET", url: "/v1/team/runs/run_missing/tasks/t1/attempts" });
		assert.equal(res.statusCode, 404);
		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch { /* concurrent write */ }
	}
});

test("GET attempts returns 404 for missing task", async () => {
	const { app, root } = await buildTestServer();
	try {
		const unitRes = await app.inject({ method: "POST", url: "/v1/team/team-units", payload: unitBody });
		const planRes = await app.inject({ method: "POST", url: "/v1/team/plans", payload: planBody(unitRes.json().teamUnitId) });
		const runRes = await app.inject({ method: "POST", url: `/v1/team/plans/${planRes.json().planId}/runs` });
		const runId = runRes.json().runId;

		const res = await app.inject({ method: "GET", url: `/v1/team/runs/${runId}/tasks/nonexistent_task/attempts` });
		assert.equal(res.statusCode, 404);

		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch { /* concurrent write */ }
	}
});

test("GET attempts returns attempt data when files exist", async () => {
	const { app, root, teamDir } = await buildTestServer();
	try {
		const unitRes = await app.inject({ method: "POST", url: "/v1/team/team-units", payload: unitBody });
		const planRes = await app.inject({ method: "POST", url: "/v1/team/plans", payload: planBody(unitRes.json().teamUnitId) });
		const runRes = await app.inject({ method: "POST", url: `/v1/team/plans/${planRes.json().planId}/runs` });
		const runId = runRes.json().runId;

		const attemptDir = join(teamDir, "runs", runId, "tasks", "t1", "attempts", "attempt_test123");
		await mkdir(attemptDir, { recursive: true });
		await writeFile(join(attemptDir, "attempt.json"), JSON.stringify({ attemptId: "attempt_test123", status: "succeeded", createdAt: "2026-05-16T00:00:00Z" }));
		await writeFile(join(attemptDir, "accepted-result.md"), "result content");

		const res = await app.inject({ method: "GET", url: `/v1/team/runs/${runId}/tasks/t1/attempts` });
		assert.equal(res.statusCode, 200);
		const attempts = res.json().attempts;
		assert.equal(attempts.length, 1);
		assert.equal(attempts[0].attemptId, "attempt_test123");
		assert.equal(attempts[0].status, "succeeded");
		assert.ok(attempts[0].files.includes("accepted-result.md"));

		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch { /* concurrent write */ }
	}
});

// ── Attempt file read API tests ──

test("GET attempt file returns file content", async () => {
	const { app, root, teamDir } = await buildTestServer();
	try {
		const unitRes = await app.inject({ method: "POST", url: "/v1/team/team-units", payload: unitBody });
		const planRes = await app.inject({ method: "POST", url: "/v1/team/plans", payload: planBody(unitRes.json().teamUnitId) });
		const runRes = await app.inject({ method: "POST", url: `/v1/team/plans/${planRes.json().planId}/runs` });
		const runId = runRes.json().runId;

		const attemptDir = join(teamDir, "runs", runId, "tasks", "t1", "attempts", "attempt_abc");
		await mkdir(attemptDir, { recursive: true });
		await writeFile(join(attemptDir, "accepted-result.md"), "test result content");

		const res = await app.inject({ method: "GET", url: `/v1/team/runs/${runId}/tasks/t1/attempts/attempt_abc/files/accepted-result.md` });
		assert.equal(res.statusCode, 200);
		assert.equal(res.body.toString(), "test result content");

		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch { /* concurrent write */ }
	}
});

test("GET attempt file rejects path traversal in fileName", async () => {
	const { app, root } = await buildTestServer();
	try {
		const unitRes = await app.inject({ method: "POST", url: "/v1/team/team-units", payload: unitBody });
		const planRes = await app.inject({ method: "POST", url: "/v1/team/plans", payload: planBody(unitRes.json().teamUnitId) });
		const runRes = await app.inject({ method: "POST", url: `/v1/team/plans/${planRes.json().planId}/runs` });
		const runId = runRes.json().runId;

		const res = await app.inject({ method: "GET", url: `/v1/team/runs/${runId}/tasks/t1/attempts/attempt_abc/files/..%2Fstate.json` });
		assert.equal(res.statusCode, 400);

		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch { /* concurrent write */ }
	}
});

test("GET attempt file rejects fileName with special characters", async () => {
	const { app, root } = await buildTestServer();
	try {
		const unitRes = await app.inject({ method: "POST", url: "/v1/team/team-units", payload: unitBody });
		const planRes = await app.inject({ method: "POST", url: "/v1/team/plans", payload: planBody(unitRes.json().teamUnitId) });
		const runRes = await app.inject({ method: "POST", url: `/v1/team/plans/${planRes.json().planId}/runs` });
		const runId = runRes.json().runId;

		const res = await app.inject({ method: "GET", url: `/v1/team/runs/${runId}/tasks/t1/attempts/attempt_abc/files/bad%20file` });
		assert.equal(res.statusCode, 400);

		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch { /* concurrent write */ }
	}
});

test("GET attempt file returns 404 for missing file", async () => {
	const { app, root } = await buildTestServer();
	try {
		const unitRes = await app.inject({ method: "POST", url: "/v1/team/team-units", payload: unitBody });
		const planRes = await app.inject({ method: "POST", url: "/v1/team/plans", payload: planBody(unitRes.json().teamUnitId) });
		const runRes = await app.inject({ method: "POST", url: `/v1/team/plans/${planRes.json().planId}/runs` });
		const runId = runRes.json().runId;

		const res = await app.inject({ method: "GET", url: `/v1/team/runs/${runId}/tasks/t1/attempts/attempt_abc/files/nonexistent.md` });
		assert.equal(res.statusCode, 404);

		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch { /* concurrent write */ }
	}
});

test("GET attempt file returns 404 for missing run", async () => {
	const { app, root } = await buildTestServer();
	try {
		const res = await app.inject({ method: "GET", url: "/v1/team/runs/run_missing/tasks/t1/attempts/attempt_abc/files/test.md" });
		assert.equal(res.statusCode, 404);

		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch { /* concurrent write */ }
	}
});
