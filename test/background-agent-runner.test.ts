import test from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { BackgroundAgentProfileResolver } from "../src/agent/background-agent-profile.js";
import { BackgroundAgentRunner, type BackgroundAgentSessionFactory } from "../src/agent/background-agent-runner.js";
import { BackgroundWorkspaceManager } from "../src/agent/background-workspace.js";
import { ConnDatabase } from "../src/agent/conn-db.js";
import { ConnRunStore } from "../src/agent/conn-run-store.js";
import { ConnSqliteStore } from "../src/agent/conn-sqlite-store.js";
import type { AssetRecord, AssetStoreLike, ChatAttachment, StoredAssetRecord } from "../src/agent/asset-store.js";
import type { AgentSessionLike, RawAgentSessionEventLike } from "../src/agent/agent-session-factory.js";
import type { AgentFileArtifact, AgentFileDraft } from "../src/agent/file-artifacts.js";

class FakeAssetStore implements AssetStoreLike {
	async registerAttachments(_conversationId: string, _attachments: readonly ChatAttachment[]): Promise<AssetRecord[]> {
		return [];
	}
	async saveFiles(_conversationId: string, _files: readonly AgentFileDraft[]): Promise<AgentFileArtifact[]> {
		return [];
	}
	async listAssets(): Promise<AssetRecord[]> {
		return [];
	}
	async getAsset(): Promise<AssetRecord | undefined> {
		return undefined;
	}
	async resolveAssets(): Promise<AssetRecord[]> {
		return [];
	}
	async readText(): Promise<string | undefined> {
		return undefined;
	}
	async getFile(): Promise<StoredAssetRecord | undefined> {
		return undefined;
	}
}

class FakeSession implements AgentSessionLike {
	sessionFile = "background-session.json";
	messages: Array<{ role: string; content?: unknown }> = [];
	private listener?: (event: RawAgentSessionEventLike) => void;

	constructor(private readonly options: { resultText?: string; error?: Error }) {}

	subscribe(listener: (event: RawAgentSessionEventLike) => void): () => void {
		this.listener = listener;
		return () => {
			this.listener = undefined;
		};
	}

	async prompt(message: string): Promise<void> {
		this.messages.push({ role: "user", content: message });
		this.listener?.({
			type: "message_update",
			assistantMessageEvent: {
				type: "text_delta",
				delta: "working...",
			},
		});
		if (this.options.error) {
			throw this.options.error;
		}
		this.messages.push({ role: "assistant", content: this.options.resultText ?? "done" });
	}
}

class ScopeObservingSession extends FakeSession {
	observedScope: string | undefined;

	constructor() {
		super({ resultText: "scoped result" });
	}

	override async prompt(message: string): Promise<void> {
		this.observedScope = process.env.CLAUDE_AGENT_ID;
		await super.prompt(message);
	}
}

class AbortableSession implements AgentSessionLike {
	sessionFile = "background-session.json";
	messages: Array<{ role: string; content?: unknown }> = [];
	abortCalls = 0;
	private listener?: (event: RawAgentSessionEventLike) => void;
	private rejectPrompt?: (error: Error) => void;

	subscribe(listener: (event: RawAgentSessionEventLike) => void): () => void {
		this.listener = listener;
		return () => {
			this.listener = undefined;
		};
	}

	async prompt(message: string): Promise<void> {
		this.messages.push({ role: "user", content: message });
		this.listener?.({
			type: "message_update",
			assistantMessageEvent: {
				type: "text_delta",
				delta: "working...",
			},
		});
		await new Promise<void>((_resolve, reject) => {
			this.rejectPrompt = reject;
		});
	}

	async abort(): Promise<void> {
		this.abortCalls += 1;
		this.rejectPrompt?.(new Error("session aborted"));
	}
}

class FakeSessionFactory implements BackgroundAgentSessionFactory {
	createdInputs: unknown[] = [];

	constructor(private readonly session: AgentSessionLike) {}

	async createSession(input: unknown): Promise<AgentSessionLike> {
		this.createdInputs.push(input);
		return this.session;
	}
}

class StructuredAssistantSession extends FakeSession {
	constructor() {
		super({});
	}

	override async prompt(message: string): Promise<void> {
		this.messages.push({ role: "user", content: message });
		this.messages.push({
			role: "assistant",
			content: [
				{
					type: "thinking",
					thinking: "internal reasoning",
					thinkingSignature: "reasoning_content",
				},
				{
					type: "toolCall",
					id: "tool-1",
					name: "bash",
					arguments: {
						command: "echo hi",
					},
				},
				{
					type: "text",
					text: "visible answer",
				},
			],
		});
	}
}

class TrailingOutputSummarySession extends FakeSession {
	constructor() {
		super({});
	}

	override async prompt(message: string): Promise<void> {
		this.messages.push({ role: "user", content: message });
		this.messages.push({
			role: "assistant",
			content: [
				{
					type: "text",
					text: "任务名字是：**2min**",
				},
				{
					type: "toolCall",
					id: "tool-write",
					name: "write",
					arguments: {
						path: "output/result.txt",
					},
				},
			],
		});
		this.messages.push({
			role: "toolResult",
			content: [
				{
					type: "text",
					text: "Successfully wrote 10 bytes to output/result.txt",
				},
			],
		});
		this.messages.push({
			role: "assistant",
			content: [
				{
					type: "text",
					text: "任务完成。输出文件已写入 `output/result.txt`。",
				},
			],
		});
	}
}

class OutputWritingSession extends FakeSession {
	constructor() {
		super({ resultText: "任务完成。输出文件已写入 `output/result.txt`。" });
	}

	override async prompt(message: string): Promise<void> {
		const outputDir = extractPromptPath(message, "- Write final deliverables to:");
		await writeFile(join(outputDir, "result.txt"), "任务名字: 2min", "utf8");
		await super.prompt(message);
	}
}

class DelayedSession extends FakeSession {
	constructor() {
		super({ resultText: "delayed result" });
	}

	override async prompt(message: string): Promise<void> {
		await delay(20);
		await super.prompt(message);
	}
}

function extractPromptPath(message: string, prefix: string): string {
	const line = message.split(/\r?\n/).find((entry) => entry.startsWith(prefix));
	assert.ok(line, `expected prompt to include ${prefix}`);
	return line.slice(prefix.length).trim();
}

async function createRunner(options?: {
	session?: AgentSessionLike;
	closeBrowserTargetsForScope?: (scope: string) => Promise<void>;
	runStore?: ConnRunStore;
}) {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-background-runner-"));
	const database = new ConnDatabase({ dbPath: join(root, "conn.sqlite") });
	await database.initialize();
	const connStore = new ConnSqliteStore({ database });
	const realRunStore = new ConnRunStore({ database });
	const runStore = options?.runStore ?? realRunStore;
	const assetStore = new FakeAssetStore();
	const session = options?.session ?? new FakeSession({ resultText: "final answer" });
	const sessionFactory = new FakeSessionFactory(session as FakeSession);
	const runner = new BackgroundAgentRunner({
		runStore,
		profileResolver: new BackgroundAgentProfileResolver({ projectRoot: root }),
		workspaceManager: new BackgroundWorkspaceManager({
			backgroundDataDir: join(root, "background"),
			assetStore,
		}),
		sessionFactory,
		closeBrowserTargetsForScope: options?.closeBrowserTargetsForScope ?? (async () => undefined),
	});
	return { root, database, connStore, runStore, realRunStore, sessionFactory, runner, session };
}

test("BackgroundAgentRunner executes a conn run in an isolated workspace and records events", async () => {
	const { database, connStore, runStore, sessionFactory, runner, session } = await createRunner();
	const conn = await connStore.create({
		title: "Daily Digest",
		prompt: "Summarize the uploaded file",
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
		runId: "run-success",
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: join(databasePathSafeRoot(), "placeholder"),
		now: new Date("2026-04-21T10:00:59.000Z"),
	});

	const completed = await runner.run(conn, run, new Date("2026-04-21T10:01:05.000Z"));

	assert.equal(completed?.status, "succeeded");
	assert.equal(completed?.resultText, "final answer");
	assert.equal(completed?.resultSummary, "final answer");
	assert.ok(completed?.workspacePath.endsWith(join("background", "runs", "run-success")));
	assert.deepEqual(
		(await runStore.listEvents(run.runId)).map((event) => event.eventType),
		["workspace_created", "snapshot_resolved", "message_update", "run_succeeded"],
	);
	const refreshed = await runStore.getRun(run.runId);
	assert.equal(refreshed?.sessionFile, "background-session.json");
	assert.equal(refreshed?.resolvedSnapshot?.profileId, "background.default");

	const [sessionInput] = sessionFactory.createdInputs as Array<{ workspace: { sessionDir: string }; snapshot: { profileId: string } }>;
	assert.ok(sessionInput.workspace.sessionDir.endsWith(join("background", "runs", "run-success", "session")));
	assert.equal(sessionInput.snapshot.profileId, "background.default");
	assert.match(
		String((session.messages?.[0] as { content?: unknown } | undefined)?.content ?? ""),
		/\[当前时间：[^\]]+\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/,
	);

	database.close();
});

test("BackgroundAgentRunner records finishedAt when the session actually completes", async () => {
	const { database, connStore, runStore, runner } = await createRunner({
		session: new DelayedSession(),
	});
	const conn = await connStore.create({
		title: "Delayed Task",
		prompt: "Summarize slowly",
		target: {
			type: "task_inbox",
		},
		schedule: {
			kind: "once",
			at: "2026-04-21T10:01:00.000Z",
		},
		now: new Date("2026-04-21T10:00:00.000Z"),
	});
	const run = await runStore.createRun({
		runId: "run-delayed-finish",
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: databasePathSafeRoot(),
		now: new Date("2026-04-21T10:00:59.000Z"),
	});
	const startedAt = new Date("2026-04-21T10:01:05.000Z");

	const completed = await runner.run(conn, run, startedAt);

	assert.equal(completed?.status, "succeeded");
	assert.ok(completed?.finishedAt, "expected finishedAt to be set");
	assert.notEqual(completed?.finishedAt, startedAt.toISOString());
	assert.ok(Date.parse(completed.finishedAt) > startedAt.getTime());

	database.close();
});

test("BackgroundAgentRunner prompt tells background tasks to use tools and output for durable files", async () => {
	const session = new FakeSession({ resultText: "done" });
	const { database, connStore, runStore, runner } = await createRunner({ session });
	const conn = await connStore.create({
		title: "Script Task",
		prompt: "Run the script",
		target: {
			type: "task_inbox",
		},
		schedule: {
			kind: "once",
			at: "2026-04-21T10:01:00.000Z",
		},
		now: new Date("2026-04-21T10:00:00.000Z"),
	});
	const run = await runStore.createRun({
		runId: "run-contract",
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: databasePathSafeRoot(),
		now: new Date("2026-04-21T10:00:59.000Z"),
	});

	await runner.run(conn, run, new Date("2026-04-21T10:01:05.000Z"));

	const prompt = String(session.messages[0]?.content ?? "");
	assert.match(prompt, /If this task requires commands, file operations, or browser automation, call the available tools/);
	assert.match(prompt, /Only files written under the final deliverables directory are indexed and durable conn outputs/);
	assert.match(prompt, /Do not report execution success unless the required tool calls actually completed/);

	database.close();
});

test("BackgroundAgentRunner records fallback events when the requested agent is unavailable", async () => {
	const { database, connStore, runStore, runner } = await createRunner();
	const conn = await connStore.create({
		title: "Missing Agent Task",
		prompt: "Summarize",
		target: {
			type: "task_inbox",
		},
		schedule: {
			kind: "once",
			at: "2026-04-21T10:01:00.000Z",
		},
		profileId: "missing-agent",
		now: new Date("2026-04-21T10:00:00.000Z"),
	});
	const run = await runStore.createRun({
		runId: "run-agent-fallback",
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: databasePathSafeRoot(),
		now: new Date("2026-04-21T10:00:59.000Z"),
	});

	const completed = await runner.run(conn, run, new Date("2026-04-21T10:01:05.000Z"));
	const events = await runStore.listEvents(run.runId);

	assert.equal(completed?.status, "succeeded");
	assert.deepEqual(
		events.map((event) => event.eventType),
		["workspace_created", "snapshot_resolved", "agent_profile_fallback", "message_update", "run_succeeded"],
	);
	assert.deepEqual(events.find((event) => event.eventType === "agent_profile_fallback")?.event, {
		requestedProfileId: "missing-agent",
		fallbackProfileId: "main",
		reason: "profile_not_found",
	});

	database.close();
});

test("BackgroundAgentRunner scopes browser cleanup around background conn runs", async () => {
	const cleanupScopes: string[] = [];
	const session = new ScopeObservingSession();
	const { database, connStore, runStore, runner } = await createRunner({
		session,
		closeBrowserTargetsForScope: async (scope) => {
			cleanupScopes.push(scope);
		},
	});
	const conn = await connStore.create({
		title: "Browser Task",
		prompt: "Use a browser",
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
		runId: "run-browser-scope",
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: databasePathSafeRoot(),
		now: new Date("2026-04-21T10:00:59.000Z"),
	});

	await runner.run(conn, run, new Date("2026-04-21T10:01:05.000Z"));
	database.close();

	assert.equal(session.observedScope, conn.connId);
	assert.equal(process.env.CLAUDE_AGENT_ID, undefined);
	assert.deepEqual(cleanupScopes, [conn.connId, conn.connId]);
});

test("BackgroundAgentRunner records failed runs without throwing into the foreground service", async () => {
	const { database, connStore, runStore, runner } = await createRunner({
		session: new FakeSession({ error: new Error("model failed") }),
	});
	const conn = await connStore.create({
		title: "Daily Digest",
		prompt: "Summarize",
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
		runId: "run-failed",
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: databasePathSafeRoot(),
		now: new Date("2026-04-21T10:00:59.000Z"),
	});

	const failed = await runner.run(conn, run, new Date("2026-04-21T10:01:05.000Z"));

	assert.equal(failed?.status, "failed");
	assert.equal(failed?.errorText, "model failed");
	assert.deepEqual(
		(await runStore.listEvents(run.runId)).map((event) => event.eventType),
		["workspace_created", "snapshot_resolved", "message_update", "run_failed"],
	);

	database.close();
});

test("BackgroundAgentRunner tolerates failed session event persistence", async () => {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-background-runner-events-"));
	const database = new ConnDatabase({ dbPath: join(root, "conn.sqlite") });
	await database.initialize();
	const connStore = new ConnSqliteStore({ database });
	const realRunStore = new ConnRunStore({ database });
	const runStore = Object.create(realRunStore) as ConnRunStore;
	runStore.appendEvent = async (input: Parameters<ConnRunStore["appendEvent"]>[0]) => {
			if (input.eventType === "message_update") {
				throw new Error("event database disappeared");
			}
			return await realRunStore.appendEvent(input);
	};
	const assetStore = new FakeAssetStore();
	const runner = new BackgroundAgentRunner({
		runStore,
		profileResolver: new BackgroundAgentProfileResolver({ projectRoot: root }),
		workspaceManager: new BackgroundWorkspaceManager({
			backgroundDataDir: join(root, "background"),
			assetStore,
		}),
		sessionFactory: new FakeSessionFactory(new FakeSession({ resultText: "final answer" })),
		closeBrowserTargetsForScope: async () => undefined,
	});
	const conn = await connStore.create({
		title: "Daily Digest",
		prompt: "Summarize",
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
	const run = await realRunStore.createRun({
		runId: "run-event-write-failed",
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: databasePathSafeRoot(),
		now: new Date("2026-04-21T10:00:59.000Z"),
	});

	const completed = await runner.run(conn, run, new Date("2026-04-21T10:01:05.000Z"));

	assert.equal(completed?.status, "succeeded");
	assert.deepEqual(
		(await realRunStore.listEvents(run.runId)).map((event) => event.eventType),
		["workspace_created", "snapshot_resolved", "run_succeeded"],
	);

	database.close();
});

test("BackgroundAgentRunner only persists visible assistant text into conn run results", async () => {
	const { database, connStore, runStore, runner } = await createRunner({
		session: new StructuredAssistantSession(),
	});
	const conn = await connStore.create({
		title: "Daily Digest",
		prompt: "Summarize",
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
		runId: "run-visible-only",
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: databasePathSafeRoot(),
		now: new Date("2026-04-21T10:00:59.000Z"),
	});

	const completed = await runner.run(conn, run, new Date("2026-04-21T10:01:05.000Z"));

	assert.equal(completed?.status, "succeeded");
	assert.equal(completed?.resultText, "visible answer");
	assert.equal(completed?.resultSummary, "visible answer");

	database.close();
});

test("BackgroundAgentRunner keeps the useful answer when the final assistant message only mentions output files", async () => {
	const { database, connStore, runStore, runner } = await createRunner({
		session: new TrailingOutputSummarySession(),
	});
	const conn = await connStore.create({
		title: "2min",
		prompt: "告诉我任务名字",
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
		runId: "run-useful-answer",
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: databasePathSafeRoot(),
		now: new Date("2026-04-21T10:00:59.000Z"),
	});

	const completed = await runner.run(conn, run, new Date("2026-04-21T10:01:05.000Z"));

	assert.equal(completed?.status, "succeeded");
	assert.equal(completed?.resultText, "任务名字是：**2min**");
	assert.equal(completed?.resultSummary, "任务名字是：**2min**");

	database.close();
});

test("BackgroundAgentRunner records files written to the run output directory", async () => {
	const { database, connStore, runStore, runner } = await createRunner({
		session: new OutputWritingSession(),
	});
	const conn = await connStore.create({
		title: "2min",
		prompt: "告诉我任务名字",
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
		runId: "run-output-file",
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: databasePathSafeRoot(),
		now: new Date("2026-04-21T10:00:59.000Z"),
	});

	const completed = await runner.run(conn, run, new Date("2026-04-21T10:01:05.000Z"));
	const files = await runStore.listFiles(run.runId);

	assert.equal(completed?.status, "succeeded");
	assert.deepEqual(
		files.map((file) => ({
			kind: file.kind,
			relativePath: file.relativePath,
			fileName: file.fileName,
			mimeType: file.mimeType,
			sizeBytes: file.sizeBytes,
		})),
		[
			{
				kind: "output",
				relativePath: "output/result.txt",
				fileName: "result.txt",
				mimeType: "text/plain; charset=utf-8",
				sizeBytes: 18,
			},
		],
	);

	database.close();
});

test("BackgroundAgentRunner aborts and fails the run when the abort signal fires", async () => {
	const session = new AbortableSession();
	const { database, connStore, runStore, runner } = await createRunner({
		session: session as unknown as FakeSession,
	});
	const conn = await connStore.create({
		title: "Daily Digest",
		prompt: "Summarize",
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
		runId: "run-aborted",
		connId: conn.connId,
		scheduledAt: "2026-04-21T10:01:00.000Z",
		workspacePath: databasePathSafeRoot(),
		now: new Date("2026-04-21T10:00:59.000Z"),
	});
	const controller = new AbortController();
	setImmediate(() => controller.abort(new Error("Conn run exceeded maxRunMs (25ms)")));

	const failed = await runner.run(conn, run, new Date("2026-04-21T10:01:05.000Z"), controller.signal);

	assert.equal(session.abortCalls, 1);
	assert.equal(failed?.status, "failed");
	assert.equal(failed?.errorText, "Conn run exceeded maxRunMs (25ms)");
	assert.deepEqual(
		(await runStore.listEvents(run.runId)).map((event) => event.eventType),
		["workspace_created", "snapshot_resolved", "run_failed"],
	);

	database.close();
});

function databasePathSafeRoot(): string {
	return join(tmpdir(), "ugk-pi-background-runner-placeholder");
}
