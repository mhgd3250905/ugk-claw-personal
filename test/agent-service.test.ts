import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AgentService } from "../src/agent/agent-service.js";
import type {
	AgentSessionFactory,
	AgentSessionLike,
	MessageUpdateEventLike,
	PromptOptionsLike,
} from "../src/agent/agent-session-factory.js";
import { ConversationStore } from "../src/agent/conversation-store.js";

class FakeSession implements AgentSessionLike {
	public prompts: Array<{ message: string; options?: PromptOptionsLike }> = [];
	public abortCalls = 0;
	public messages: Array<{
		role: string;
		content?: Array<{ type: string; text?: string }>;
		stopReason?: string;
		errorMessage?: string;
	}> = [];

	constructor(
		public sessionFile: string | undefined,
		private readonly events: MessageUpdateEventLike[],
		private readonly finalAssistantText?: string,
		private readonly finalAssistantError?: string,
	) {}

	subscribe(listener: (event: MessageUpdateEventLike) => void): () => void {
		this.listener = listener;
		return () => {
			this.listener = undefined;
		};
	}

	async prompt(message: string, options?: PromptOptionsLike): Promise<void> {
		this.prompts.push({ message, options });
		for (const event of this.events) {
			this.listener?.(event);
		}

		this.messages.push({
			role: "assistant",
			content: this.finalAssistantText
				? [
						{
							type: "text",
							text: this.finalAssistantText,
						},
					]
				: [],
			stopReason: this.finalAssistantError ? "error" : "stop",
			errorMessage: this.finalAssistantError,
		});
	}

	async abort(): Promise<void> {
		this.abortCalls += 1;
	}

	private listener?: (event: MessageUpdateEventLike) => void;
}

class DeferredSession extends FakeSession {
	private resolvePrompt?: () => void;
	public promptStarted?: Promise<void>;
	private resolvePromptStarted?: () => void;

	constructor(sessionFile: string | undefined) {
		super(sessionFile, []);
		this.promptStarted = new Promise((resolve) => {
			this.resolvePromptStarted = resolve;
		});
	}

	override async prompt(message: string, options?: PromptOptionsLike): Promise<void> {
		this.prompts.push({ message, options });
		if (options?.streamingBehavior) {
			return;
		}
		this.resolvePromptStarted?.();
		await new Promise<void>((resolve) => {
			this.resolvePrompt = resolve;
		});
		this.messages.push({
			role: "assistant",
			content: [{ type: "text", text: "done after control" }],
			stopReason: this.abortCalls > 0 ? "aborted" : "stop",
		});
	}

	finish(): void {
		this.resolvePrompt?.();
	}

	override async abort(): Promise<void> {
		this.abortCalls += 1;
		this.finish();
	}
}

class FakeAgentSessionFactory implements AgentSessionFactory {
	public calls: Array<{ conversationId: string; sessionFile?: string }> = [];
	public availableSkills: Array<{ name: string; path?: string }> = [];
	public skillFingerprint?: string;

	constructor(private readonly buildSession: (callIndex: number) => AgentSessionLike) {}

	async createSession(input: { conversationId: string; sessionFile?: string }): Promise<AgentSessionLike> {
		this.calls.push(input);
		return this.buildSession(this.calls.length - 1);
	}

	async getAvailableSkills(): Promise<Array<{ name: string; path?: string }>> {
		return this.availableSkills;
	}

	async getSkillFingerprint(): Promise<string | undefined> {
		return this.skillFingerprint;
	}
}

class FakeFileArtifactStore {
	public saved: Array<{
		conversationId: string;
		files: Array<{ fileName: string; mimeType: string; content: string }>;
	}> = [];

	async saveFiles(
		conversationId: string,
		files: Array<{ fileName: string; mimeType: string; content: string }>,
	): Promise<Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number; downloadUrl: string }>> {
		this.saved.push({ conversationId, files });
		return files.map((file, index) => ({
			id: `file-${index + 1}`,
			fileName: file.fileName,
			mimeType: file.mimeType,
			sizeBytes: Buffer.byteLength(file.content, "utf8"),
			downloadUrl: `/v1/files/file-${index + 1}`,
		}));
	}
}

async function createStore(): Promise<ConversationStore> {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-agent-service-"));
	return new ConversationStore(join(dir, "conversation-index.json"));
}

function textDelta(delta: string): MessageUpdateEventLike {
	return {
		type: "message_update",
		assistantMessageEvent: {
			type: "text_delta",
			delta,
		},
	};
}

test("creates a new conversation, prompts the session, and persists the session file", async () => {
	const store = await createStore();
	const factory = new FakeAgentSessionFactory(
		() => new FakeSession("E:/sessions/new.jsonl", [textDelta("你好"), textDelta("，世界")]),
	);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	const result = await service.chat({
		message: "你好",
	});

	assert.match(result.conversationId, /^manual:/);
	assert.equal(result.text, "你好，世界");
	assert.equal(result.sessionFile, "E:/sessions/new.jsonl");
	assert.deepEqual(factory.calls, [{ conversationId: result.conversationId, sessionFile: undefined }]);
	assert.deepEqual(factory.calls.length, 1);
	assert.deepEqual(await store.get(result.conversationId), {
		sessionFile: "E:/sessions/new.jsonl",
		updatedAt: (await store.get(result.conversationId))?.updatedAt,
	});
});

test("chat includes uploaded file attachments in the session prompt", async () => {
	const store = await createStore();
	const session = new FakeSession("E:/sessions/attachments.jsonl", [textDelta("read file")]);
	const factory = new FakeAgentSessionFactory(() => session);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	await service.chat({
		conversationId: "manual:attachments",
		message: "Please inspect this file",
		attachments: [
			{
				fileName: "notes.txt",
				mimeType: "text/plain",
				sizeBytes: 18,
				text: "alpha\nbeta",
			},
		],
	});

	assert.equal(session.prompts.length, 1);
	assert.match(session.prompts[0]?.message ?? "", /Please inspect this file/);
	assert.match(session.prompts[0]?.message ?? "", /<user_files>/);
	assert.match(session.prompts[0]?.message ?? "", /fileName: notes\.txt/);
	assert.match(session.prompts[0]?.message ?? "", /mimeType: text\/plain/);
	assert.match(session.prompts[0]?.message ?? "", /alpha\nbeta/);
	assert.match(session.prompts[0]?.message ?? "", /```ugk-file name="example\.txt"/);
});

test("chat converts ugk-file blocks from the assistant into downloadable files", async () => {
	const store = await createStore();
	const fileStore = new FakeFileArtifactStore();
	const factory = new FakeAgentSessionFactory(
		() =>
			new FakeSession(
				"E:/sessions/files.jsonl",
				[],
				[
					"Here is the file.",
					"",
					'```ugk-file name="hello.txt" mime="text/plain"',
					"hello from agent",
					"```",
					"",
					"Use it well.",
				].join("\n"),
			),
	);
	const service = new AgentService({
		conversationStore: store,
		sessionFactory: factory,
		fileArtifactStore: fileStore,
	});

	const result = await service.chat({
		conversationId: "manual:file-output",
		message: "send me a file",
	});

	assert.equal(result.text, "Here is the file.\n\nUse it well.");
	assert.deepEqual(fileStore.saved, [
		{
			conversationId: "manual:file-output",
			files: [
				{
					fileName: "hello.txt",
					mimeType: "text/plain",
					content: "hello from agent",
				},
			],
		},
	]);
	assert.deepEqual(result.files, [
		{
			id: "file-1",
			fileName: "hello.txt",
			mimeType: "text/plain",
			sizeBytes: 16,
			downloadUrl: "/v1/files/file-1",
		},
	]);
});

test("queueMessage steers into the active session while a run is streaming", async () => {
	const store = await createStore();
	const activeSession = new DeferredSession("E:/sessions/active.jsonl");
	const factory = new FakeAgentSessionFactory(() => activeSession);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });
	const events: Array<Record<string, unknown>> = [];

	const run = service.streamChat(
		{
			conversationId: "manual:active",
			message: "start",
		},
		(event) => events.push(event as unknown as Record<string, unknown>),
	);
	await activeSession.promptStarted;

	const queued = await service.queueMessage({
		conversationId: "manual:active",
		message: "插嘴",
		mode: "steer",
	});

	assert.deepEqual(queued, {
		conversationId: "manual:active",
		mode: "steer",
		queued: true,
	});
	assert.deepEqual(activeSession.prompts[1], {
		message: "插嘴",
		options: {
			streamingBehavior: "steer",
		},
	});

	activeSession.finish();
	await run;
	assert.equal(events.at(-1)?.type, "done");
});

test("queueMessage can enqueue a follow-up after the active turn", async () => {
	const store = await createStore();
	const activeSession = new DeferredSession("E:/sessions/active-follow-up.jsonl");
	const factory = new FakeAgentSessionFactory(() => activeSession);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	const run = service.streamChat(
		{
			conversationId: "manual:active-follow-up",
			message: "start",
		},
		() => undefined,
	);
	await activeSession.promptStarted;

	const queued = await service.queueMessage({
		conversationId: "manual:active-follow-up",
		message: "等会继续",
		mode: "followUp",
	});

	assert.equal(queued.queued, true);
	assert.deepEqual(activeSession.prompts[1], {
		message: "等会继续",
		options: {
			streamingBehavior: "followUp",
		},
	});

	activeSession.finish();
	await run;
});

test("interruptChat aborts the active session and reports interruption to the stream", async () => {
	const store = await createStore();
	const activeSession = new DeferredSession("E:/sessions/interrupt.jsonl");
	const factory = new FakeAgentSessionFactory(() => activeSession);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });
	const events: Array<Record<string, unknown>> = [];

	const run = service.streamChat(
		{
			conversationId: "manual:interrupt",
			message: "start",
		},
		(event) => events.push(event as unknown as Record<string, unknown>),
	);
	await activeSession.promptStarted;

	const interrupted = await service.interruptChat({
		conversationId: "manual:interrupt",
	});

	assert.deepEqual(interrupted, {
		conversationId: "manual:interrupt",
		interrupted: true,
	});
	assert.equal(activeSession.abortCalls, 1);
	await run;
	assert.equal(events.some((event) => event.type === "interrupted"), true);
	assert.equal(events.at(-1)?.type, "done");
});

test("queueMessage reports inactive conversations without creating a session", async () => {
	const store = await createStore();
	const factory = new FakeAgentSessionFactory(() => new FakeSession("E:/sessions/unused.jsonl", []));
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	const queued = await service.queueMessage({
		conversationId: "manual:inactive",
		message: "nobody is running",
		mode: "steer",
	});

	assert.deepEqual(queued, {
		conversationId: "manual:inactive",
		mode: "steer",
		queued: false,
		reason: "not_running",
	});
	assert.equal(factory.calls.length, 0);
});

test("reuses the stored session file for an existing conversation", async () => {
	const store = await createStore();
	await store.set("manual:existing", "E:/sessions/existing.jsonl");

	const factory = new FakeAgentSessionFactory(
		() => new FakeSession("E:/sessions/existing.jsonl", [textDelta("继续对话")]),
	);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	const result = await service.chat({
		conversationId: "manual:existing",
		message: "继续",
	});

	assert.equal(result.conversationId, "manual:existing");
	assert.equal(result.text, "继续对话");
	assert.deepEqual(factory.calls, [{ conversationId: "manual:existing", sessionFile: "E:/sessions/existing.jsonl" }]);
});

test("returns empty text when the agent produces no text deltas", async () => {
	const store = await createStore();
	const factory = new FakeAgentSessionFactory(() => new FakeSession("E:/sessions/empty.jsonl", []));
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	const result = await service.chat({
		conversationId: "manual:empty",
		message: "没有输出也别炸",
	});

	assert.equal(result.text, "");
	assert.equal(result.sessionFile, "E:/sessions/empty.jsonl");
});

test("falls back to the final assistant message text when no deltas were emitted", async () => {
	const store = await createStore();
	const factory = new FakeAgentSessionFactory(
		() => new FakeSession("E:/sessions/final.jsonl", [], "FINAL_TEXT"),
	);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	const result = await service.chat({
		conversationId: "manual:final-text",
		message: "给我最终文本",
	});

	assert.equal(result.text, "FINAL_TEXT");
});

test("throws when the final assistant message indicates an upstream provider error", async () => {
	const store = await createStore();
	const factory = new FakeAgentSessionFactory(
		() => new FakeSession("E:/sessions/error.jsonl", [], undefined, "401 invalid access token"),
	);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	await assert.rejects(
		() =>
			service.chat({
				conversationId: "manual:error",
				message: "触发 provider 错误",
			}),
		/401 invalid access token/,
	);
});

test("streamChat emits process events and final result while persisting the session file", async () => {
	const store = await createStore();
	const factory = new FakeAgentSessionFactory(
		() =>
			new FakeSession("E:/sessions/stream.jsonl", [
				{
					type: "tool_execution_start",
					toolCallId: "tool-1",
					toolName: "read",
					args: {
						path: "README.md",
					},
				} as unknown as MessageUpdateEventLike,
				textDelta("STREAM_TEXT"),
				{
					type: "tool_execution_end",
					toolCallId: "tool-1",
					toolName: "read",
					result: {
						ok: true,
					},
					isError: false,
				} as unknown as MessageUpdateEventLike,
			]),
	);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });
	const streamChat = (
		service as AgentService & {
			streamChat?: (
				input: { conversationId?: string; message: string; userId?: string },
				onEvent: (event: Record<string, unknown>) => void,
			) => Promise<void>;
		}
	).streamChat;

	assert.equal(typeof streamChat, "function");

	const events: Array<Record<string, unknown>> = [];
	await streamChat!.call(
		service,
		{
			conversationId: "manual:stream",
			message: "stream it",
		},
		(event) => {
			events.push(event);
		},
	);

	assert.deepEqual(
		events.map((event) => event.type),
		["run_started", "tool_started", "text_delta", "tool_finished", "done"],
	);
	assert.deepEqual(events[1], {
		type: "tool_started",
		toolCallId: "tool-1",
		toolName: "read",
		args: '{\n  "path": "README.md"\n}',
	});
	assert.deepEqual(events[2], {
		type: "text_delta",
		textDelta: "STREAM_TEXT",
	});
	assert.deepEqual(events[3], {
		type: "tool_finished",
		toolCallId: "tool-1",
		toolName: "read",
		isError: false,
		result: '{\n  "ok": true\n}',
	});
	assert.deepEqual(events[4], {
		type: "done",
		conversationId: "manual:stream",
		text: "STREAM_TEXT",
		sessionFile: "E:/sessions/stream.jsonl",
	});
	assert.deepEqual(await store.get("manual:stream"), {
		sessionFile: "E:/sessions/stream.jsonl",
		updatedAt: (await store.get("manual:stream"))?.updatedAt,
	});
});

test("streamChat strips null characters and extracts readable text from tool results", async () => {
	const store = await createStore();
	const factory = new FakeAgentSessionFactory(
		() =>
			new FakeSession("E:/sessions/wsl.jsonl", [
				{
					type: "tool_execution_end",
					toolCallId: "tool-wsl",
					toolName: "bash",
					result: {
						content: [
							{
								type: "text",
								text: "w\u0000s\u0000l\u0000:\u0000 \u0000localhost\r\n<3>WSL error",
							},
						],
					},
					isError: true,
				} as unknown as MessageUpdateEventLike,
			]),
	);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });
	const events: Array<Record<string, unknown>> = [];

	await service.streamChat(
		{
			conversationId: "manual:wsl",
			message: "run bash",
		},
		(event) => {
			events.push(event as unknown as Record<string, unknown>);
		},
	);

	assert.deepEqual(events[1], {
		type: "tool_finished",
		toolCallId: "tool-wsl",
		toolName: "bash",
		isError: true,
		result: "wsl: localhost\n<3>WSL error",
	});
});

test("does not reuse an existing session when the skill fingerprint changes", async () => {
	const store = await createStore();
	await store.set("manual:existing", "E:/sessions/existing.jsonl", {
		skillFingerprint: "skills-v1",
	});

	const factory = new FakeAgentSessionFactory(
		() => new FakeSession("E:/sessions/new-after-skill-change.jsonl", [textDelta("新的技能集")]),
	);
	factory.skillFingerprint = "skills-v2";
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	const result = await service.chat({
		conversationId: "manual:existing",
		message: "继续",
	});

	assert.equal(result.sessionFile, "E:/sessions/new-after-skill-change.jsonl");
	assert.deepEqual(factory.calls, [{ conversationId: "manual:existing", sessionFile: undefined }]);
	assert.deepEqual(await store.get("manual:existing"), {
		sessionFile: "E:/sessions/new-after-skill-change.jsonl",
		updatedAt: (await store.get("manual:existing"))?.updatedAt,
		skillFingerprint: "skills-v2",
	});
});
