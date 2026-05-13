import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildServer } from "../src/server.js";
import { ConnDatabase } from "../src/agent/conn-db.js";
import { ConnSqliteStore } from "../src/agent/conn-sqlite-store.js";
import { ConnRunStore } from "../src/agent/conn-run-store.js";
import { AgentActivityStore } from "../src/agent/agent-activity-store.js";

async function createTestEnv() {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-artifact-route-"));
	const database = new ConnDatabase({ dbPath: join(dir, "conn.sqlite") });
	await database.initialize();
	const connStore = new ConnSqliteStore({ database });
	const connRunStore = new ConnRunStore({ database });
	const activityStore = new AgentActivityStore({ database });
	const app = buildServer({
		connStore,
		connRunStore,
		activityStore,
		backgroundDataDir: dir,
		agentService: {} as never,
	});
	return { dir, database, connStore, connRunStore, app };
}

async function createConnRun(
	env: Awaited<ReturnType<typeof createTestEnv>>,
	runId: string,
) {
	const conn = await env.connStore.create({
		title: "test",
		prompt: "test",
		target: { type: "task_inbox" },
		schedule: { kind: "interval", everyMs: 86400000 },
		assetRefs: [],
	});
	const run = await env.connRunStore.createRun({
		runId,
		connId: conn.connId,
		scheduledAt: new Date().toISOString(),
		workspacePath: join(env.dir, "runs", runId),
	});
	return {
		conn,
		run,
		artifactDir: join(env.dir, "runs", run.runId, "artifact-public"),
	};
}

test("GET /v1/conns/:connId/runs/:runId/artifacts/index.html returns HTML", async () => {
	const env = await createTestEnv();
	const { database, app } = env;
	try {
		const { conn, run, artifactDir } = await createConnRun(env, "test-run-001");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "index.html"),
			"<html><body>hello</body></html>",
		);

		const response = await app.inject({
			method: "GET",
			url: `/v1/conns/${conn.connId}/runs/${run.runId}/artifacts/index.html`,
		});
		assert.equal(response.statusCode, 200);
		assert.ok(response.headers["content-type"]?.includes("text/html"));
		assert.equal(response.body, "<html><body>hello</body></html>");
	} finally {
		await app.close();
		database.close();
	}
});

test("GET artifact with subpath serves CSS with correct content-type", async () => {
	const env = await createTestEnv();
	const { database, app } = env;
	try {
		const { conn, run, artifactDir } = await createConnRun(env, "test-run-002");
		await mkdir(join(artifactDir, "assets"), { recursive: true });
		await writeFile(join(artifactDir, "assets", "style.css"), "body{color:red}");

		const response = await app.inject({
			method: "GET",
			url: `/v1/conns/${conn.connId}/runs/${run.runId}/artifacts/assets/style.css`,
		});
		assert.equal(response.statusCode, 200);
		assert.ok(response.headers["content-type"]?.includes("text/css"));
		assert.equal(response.body, "body{color:red}");
	} finally {
		await app.close();
		database.close();
	}
});

test("path traversal returns 404", async () => {
	const env = await createTestEnv();
	const { database, app } = env;
	try {
		const { conn, run, artifactDir } = await createConnRun(env, "test-run-003");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(join(artifactDir, "safe.txt"), "ok");

		const response = await app.inject({
			method: "GET",
			url: `/v1/conns/${conn.connId}/runs/${run.runId}/artifacts/../../conn.sqlite`,
		});
		assert.equal(response.statusCode, 404);
	} finally {
		await app.close();
		database.close();
	}
});

test("hidden file returns 404", async () => {
	const env = await createTestEnv();
	const { database, app } = env;
	try {
		const { conn, run, artifactDir } = await createConnRun(env, "test-run-004");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(join(artifactDir, ".env"), "SECRET=value");

		const response = await app.inject({
			method: "GET",
			url: `/v1/conns/${conn.connId}/runs/${run.runId}/artifacts/.env`,
		});
		assert.equal(response.statusCode, 404);
	} finally {
		await app.close();
		database.close();
	}
});

test("unknown run returns 404", async () => {
	const { database, app } = await createTestEnv();
	try {
		const response = await app.inject({
			method: "GET",
			url: "/v1/conns/conn-1/runs/nonexistent/artifacts/index.html",
		});
		assert.equal(response.statusCode, 404);
	} finally {
		await app.close();
		database.close();
	}
});

test("run artifact route rejects a run that belongs to another conn", async () => {
	const env = await createTestEnv();
	const { database, app } = env;
	try {
		const { run, artifactDir } = await createConnRun(env, "test-run-wrong-conn");
		const otherConn = await env.connStore.create({
			title: "other",
			prompt: "other",
			target: { type: "task_inbox" },
			schedule: { kind: "interval", everyMs: 86400000 },
			assetRefs: [],
		});
		await mkdir(artifactDir, { recursive: true });
		await writeFile(join(artifactDir, "index.html"), "<html>private</html>");

		const response = await app.inject({
			method: "GET",
			url: `/v1/conns/${otherConn.connId}/runs/${run.runId}/artifacts/index.html`,
		});
		assert.equal(response.statusCode, 404);
	} finally {
		await app.close();
		database.close();
	}
});

test("run artifact route rejects workspace paths outside background data dir", async () => {
	const env = await createTestEnv();
	const { database, app } = env;
	try {
		const outsideDir = await mkdtemp(join(tmpdir(), "ugk-pi-artifact-outside-"));
		const conn = await env.connStore.create({
			title: "outside",
			prompt: "outside",
			target: { type: "task_inbox" },
			schedule: { kind: "interval", everyMs: 86400000 },
			assetRefs: [],
		});
		const run = await env.connRunStore.createRun({
			runId: "test-run-outside-workspace",
			connId: conn.connId,
			scheduledAt: new Date().toISOString(),
			workspacePath: outsideDir,
		});
		await mkdir(join(outsideDir, "artifact-public"), { recursive: true });
		await writeFile(join(outsideDir, "artifact-public", "index.html"), "<html>outside</html>");

		const response = await app.inject({
			method: "GET",
			url: `/v1/conns/${conn.connId}/runs/${run.runId}/artifacts/index.html`,
		});
		assert.equal(response.statusCode, 404);
	} finally {
		await app.close();
		database.close();
	}
});

test("health endpoint returns ok when files exist", async () => {
	const env = await createTestEnv();
	const { database, app } = env;
	try {
		const { conn, run, artifactDir } = await createConnRun(env, "test-run-005");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(join(artifactDir, "report.txt"), "hello");

		const response = await app.inject({
			method: "GET",
			url: `/v1/conns/${conn.connId}/runs/${run.runId}/artifacts/health`,
		});
		assert.equal(response.statusCode, 200);
		const body = response.json();
		assert.equal(body.ok, true);
		assert.equal(body.fileCount, 1);
	} finally {
		await app.close();
		database.close();
	}
});

test("health endpoint returns ok=false when no files", async () => {
	const env = await createTestEnv();
	const { database, app } = env;
	try {
		const { conn, run, artifactDir } = await createConnRun(env, "test-run-006");
		await mkdir(artifactDir, { recursive: true });

		const response = await app.inject({
			method: "GET",
			url: `/v1/conns/${conn.connId}/runs/${run.runId}/artifacts/health`,
		});
		assert.equal(response.statusCode, 200);
		assert.equal(response.json().ok, false);
	} finally {
		await app.close();
		database.close();
	}
});

test("latest route points to latest succeeded run", async () => {
	const { dir, database, connStore, connRunStore, app } = await createTestEnv();
	try {
		const conn = await connStore.create({
			title: "test",
			prompt: "test",
			target: { type: "task_inbox" },
			schedule: { kind: "interval", everyMs: 86400000 },
			assetRefs: [],
		});

		const run1 = await connRunStore.createRun({
			connId: conn.connId,
			scheduledAt: new Date(Date.now() - 60000).toISOString(),
			workspacePath: join(dir, "runs", "run-1"),
		});
		await connRunStore.completeRun({
			runId: run1.runId,
			summary: "old",
			text: "old",
		});

		const run2 = await connRunStore.createRun({
			connId: conn.connId,
			scheduledAt: new Date().toISOString(),
			workspacePath: join(dir, "runs", "run-2"),
		});
		await mkdir(join(run2.workspacePath, "artifact-public"), { recursive: true });
		await writeFile(
			join(run2.workspacePath, "artifact-public", "report.txt"),
			"latest content",
		);
		await connRunStore.completeRun({
			runId: run2.runId,
			summary: "new",
			text: "new",
		});

		const response = await app.inject({
			method: "GET",
			url: "/v1/conns/" + conn.connId + "/artifacts/latest/report.txt",
		});
		assert.equal(response.statusCode, 200);
		assert.equal(response.body, "latest content");
	} finally {
		await app.close();
		database.close();
	}
});
