import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
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

// ── Task 5: structured attempt metadata API ──

test("GET attempts returns full lifecycle metadata", async () => {
	const { app, root, teamDir } = await buildTestServer();
	try {
		const unitRes = await app.inject({ method: "POST", url: "/v1/team/team-units", payload: unitBody });
		const planRes = await app.inject({ method: "POST", url: "/v1/team/plans", payload: planBody(unitRes.json().teamUnitId) });
		const runRes = await app.inject({ method: "POST", url: `/v1/team/plans/${planRes.json().planId}/runs` });
		const runId = runRes.json().runId;

		const attemptDir = join(teamDir, "runs", runId, "tasks", "t1", "attempts", "attempt_meta1");
		await mkdir(attemptDir, { recursive: true });
		await writeFile(join(attemptDir, "attempt.json"), JSON.stringify({
			attemptId: "attempt_meta1",
			taskId: "t1",
			status: "succeeded",
			phase: "succeeded",
			createdAt: "2026-05-16T00:00:00.000Z",
			updatedAt: "2026-05-16T00:01:00.000Z",
			finishedAt: "2026-05-16T00:01:00.000Z",
			worker: [{ outputRef: "tasks/t1/attempts/attempt_meta1/worker-output-001.md", outputIndex: 1 }],
			checker: [{ verdict: "pass", reason: "ok", revisionIndex: 1, recordRef: "tasks/t1/attempts/attempt_meta1/checker-verdict-001.json", feedbackRef: null }],
			watcher: { decision: "accept_task", reason: "good", recordRef: "tasks/t1/attempts/attempt_meta1/watcher-review.json" },
			resultRef: "tasks/t1/attempts/attempt_meta1/accepted-result.md",
			errorSummary: null,
		}));
		await writeFile(join(attemptDir, "accepted-result.md"), "result");

		const res = await app.inject({ method: "GET", url: `/v1/team/runs/${runId}/tasks/t1/attempts` });
		assert.equal(res.statusCode, 200);
		const a = res.json().attempts[0];

		// Lifecycle metadata fields
		assert.equal(a.phase, "succeeded");
		assert.equal(a.updatedAt, "2026-05-16T00:01:00.000Z");
		assert.equal(a.finishedAt, "2026-05-16T00:01:00.000Z");
		assert.ok(Array.isArray(a.worker));
		assert.equal(a.worker.length, 1);
		assert.equal(a.worker[0].outputRef, "tasks/t1/attempts/attempt_meta1/worker-output-001.md");
		assert.ok(Array.isArray(a.checker));
		assert.equal(a.checker.length, 1);
		assert.equal(a.checker[0].verdict, "pass");
		assert.ok(a.watcher);
		assert.equal(a.watcher.decision, "accept_task");
		assert.equal(a.resultRef, "tasks/t1/attempts/attempt_meta1/accepted-result.md");
		assert.equal(a.errorSummary, null);
		assert.ok(a.files.includes("accepted-result.md"));

		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch { /* concurrent write */ }
	}
});

test("GET attempts returns defaults for old-format attempt.json", async () => {
	const { app, root, teamDir } = await buildTestServer();
	try {
		const unitRes = await app.inject({ method: "POST", url: "/v1/team/team-units", payload: unitBody });
		const planRes = await app.inject({ method: "POST", url: "/v1/team/plans", payload: planBody(unitRes.json().teamUnitId) });
		const runRes = await app.inject({ method: "POST", url: `/v1/team/plans/${planRes.json().planId}/runs` });
		const runId = runRes.json().runId;

		const attemptDir = join(teamDir, "runs", runId, "tasks", "t1", "attempts", "attempt_oldformat");
		await mkdir(attemptDir, { recursive: true });
		// Old format: only attemptId and status, no lifecycle fields
		await writeFile(join(attemptDir, "attempt.json"), JSON.stringify({
			attemptId: "attempt_oldformat",
			status: "succeeded",
			createdAt: "2026-05-15T00:00:00Z",
		}));

		const res = await app.inject({ method: "GET", url: `/v1/team/runs/${runId}/tasks/t1/attempts` });
		assert.equal(res.statusCode, 200);
		const a = res.json().attempts[0];

		// Should have defaults, not 500
		assert.equal(a.attemptId, "attempt_oldformat");
		assert.equal(a.status, "succeeded");
		assert.equal(a.phase, "succeeded"); // fallback from status
		assert.ok(Array.isArray(a.worker));
		assert.equal(a.worker.length, 0);
		assert.ok(Array.isArray(a.checker));
		assert.equal(a.checker.length, 0);
		assert.equal(a.watcher, null);
		assert.equal(a.resultRef, null);
		assert.equal(a.errorSummary, null);
		assert.equal(a.finishedAt, null);

		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch { /* concurrent write */ }
	}
});

// ── Event-driven SSE tests ──

function connectSSE(port: number, path: string): Promise<{
	nextEvent: (timeoutMs?: number) => Promise<string>;
	close: () => void;
}> {
	return new Promise((resolve, reject) => {
		const events: string[] = [];
		let buffer = "";
		let settled = false;

		const req = http.request({
			hostname: "127.0.0.1",
			port,
			path,
			method: "GET",
			headers: { Accept: "text/event-stream" },
		});

		req.on("response", (res) => {
			res.on("data", (chunk: Buffer) => {
				buffer += chunk.toString();
				while (true) {
					const idx = buffer.indexOf("\n\n");
					if (idx === -1) break;
					const raw = buffer.substring(0, idx);
					buffer = buffer.substring(idx + 2);
					const lines = raw.split("\n").filter(l => !l.startsWith(":"));
					if (lines.some(l => l.startsWith("data:"))) {
						events.push(lines.join("\n"));
					}
				}
			});
			if (!settled) {
				settled = true;
				resolve({
					nextEvent: (timeoutMs = 5000) => new Promise<string>((resolve, reject) => {
						const timer = setTimeout(() => reject(new Error(`SSE timeout after ${timeoutMs}ms`)), timeoutMs);
						const check = () => {
							if (events.length > 0) {
								clearTimeout(timer);
								resolve(events.shift()!);
							} else {
								setTimeout(check, 5);
							}
						};
						check();
					}),
					close: () => req.destroy(),
				});
			}
		});

		req.on("error", (err) => {
			if (!settled) { settled = true; reject(err); }
		});
		req.end();
	});
}

test("SSE receives cancelled snapshot within 300ms via event notification", async () => {
	const { app, root } = await buildTestServer();
	try {
		const unitRes = await app.inject({ method: "POST", url: "/v1/team/team-units", payload: unitBody });
		const planRes = await app.inject({ method: "POST", url: "/v1/team/plans", payload: planBody(unitRes.json().teamUnitId) });
		const runRes = await app.inject({ method: "POST", url: `/v1/team/plans/${planRes.json().planId}/runs` });
		const runId = runRes.json().runId;

		await app.listen({ port: 0, host: "127.0.0.1" });
		const port = (app.server.address() as { port: number }).port;

		const sse = await connectSSE(port, `/v1/team/runs/${runId}/events`);
		const initial = await sse.nextEvent();
		assert.ok(initial.includes("queued"), "initial snapshot should show queued status");

		const start = Date.now();
		await app.inject({ method: "POST", url: `/v1/team/runs/${runId}/cancel`, payload: { reason: "event test" } });

		const event = await sse.nextEvent(300);
		const elapsed = Date.now() - start;
		assert.ok(elapsed < 300, `expected update within 300ms, got ${elapsed}ms`);
		assert.ok(event.includes("cancelled"), "should contain cancelled status");

		sse.close();
		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch {}
	}
});

test("SSE client disconnect unsubscribes and server remains stable", async () => {
	const { app, root } = await buildTestServer();
	try {
		const unitRes = await app.inject({ method: "POST", url: "/v1/team/team-units", payload: unitBody });
		const planRes = await app.inject({ method: "POST", url: "/v1/team/plans", payload: planBody(unitRes.json().teamUnitId) });
		const runRes = await app.inject({ method: "POST", url: `/v1/team/plans/${planRes.json().planId}/runs` });
		const runId = runRes.json().runId;

		await app.listen({ port: 0, host: "127.0.0.1" });
		const port = (app.server.address() as { port: number }).port;

		const sse = await connectSSE(port, `/v1/team/runs/${runId}/events`);
		await sse.nextEvent(); // consume initial snapshot

		sse.close();
		await new Promise(resolve => setTimeout(resolve, 20));

		await app.inject({ method: "POST", url: `/v1/team/runs/${runId}/cancel`, payload: { reason: "after disconnect" } });

		const healthz = await app.inject({ method: "GET", url: "/v1/team/healthz" });
		assert.equal(healthz.statusCode, 200);

		await app.close();
	} finally {
		try { await rm(root, { recursive: true, force: true }); } catch {}
	}
});
