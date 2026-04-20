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
	RawAgentSessionEventLike,
} from "../src/agent/agent-session-factory.js";
import type { AssetRecord, ChatAttachment } from "../src/agent/asset-store.js";
import { ConversationStore } from "../src/agent/conversation-store.js";
import { buildPromptWithAssetContext } from "../src/agent/file-artifacts.js";

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
		private readonly events: RawAgentSessionEventLike[],
		private readonly finalAssistantText?: string,
		private readonly finalAssistantError?: string,
	) {}

	subscribe(listener: (event: RawAgentSessionEventLike) => void): () => void {
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

	emit(event: RawAgentSessionEventLike): void {
		this.listener?.(event);
	}

	private listener?: (event: RawAgentSessionEventLike) => void;
}

class DeferredSession extends FakeSession {
	private resolvePrompt?: () => void;
	public promptStarted?: Promise<void>;
	private resolvePromptStarted?: () => void;
	public steerCalls: string[] = [];
	public followUpCalls: string[] = [];

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

	async steer(message: string): Promise<void> {
		this.steerCalls.push(message);
	}

	async followUp(message: string): Promise<void> {
		this.followUpCalls.push(message);
	}
}

class StrictQueueSession extends DeferredSession {
	override async prompt(message: string, options?: PromptOptionsLike): Promise<void> {
		if (options?.streamingBehavior) {
			throw new Error(`queueMessage must use explicit queue APIs, got prompt(${options.streamingBehavior}) for ${message}`);
		}
		await super.prompt(message, options);
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

	getDefaultModelContext() {
		return {
			provider: "dashscope-coding",
			model: "glm-5",
			contextWindow: 128000,
			maxResponseTokens: 16384,
			reserveTokens: 16384,
		};
	}
}

class FakeAssetStore {
	public savedAttachments: Array<{
		conversationId: string;
		attachments: readonly ChatAttachment[];
	}> = [];
	public saved: Array<{
		conversationId: string;
		files: Array<{ fileName: string; mimeType: string; content: string }>;
	}> = [];
	private readonly assets = new Map<string, AssetRecord>();
	private readonly assetTexts = new Map<string, string>();

	async registerAttachments(conversationId: string, attachments: readonly ChatAttachment[]): Promise<AssetRecord[]> {
		this.savedAttachments.push({ conversationId, attachments });
		return attachments.map((attachment, index) => {
			const asset = {
				assetId: `asset-upload-${index + 1}`,
				reference: `@asset[asset-upload-${index + 1}]`,
				fileName: attachment.fileName,
				mimeType: attachment.mimeType ?? "application/octet-stream",
				sizeBytes: attachment.sizeBytes ?? 0,
				kind: typeof attachment.text === "string" ? ("text" as const) : ("metadata" as const),
				hasContent: typeof attachment.text === "string",
				source: "user_upload" as const,
				conversationId,
				createdAt: "2026-04-18T00:00:00.000Z",
				...(typeof attachment.text === "string" ? { textPreview: attachment.text } : {}),
				...(typeof attachment.text === "string" ? { downloadUrl: `/v1/files/asset-upload-${index + 1}` } : {}),
			} satisfies AssetRecord;
			this.assets.set(asset.assetId, asset);
			if (typeof attachment.text === "string") {
				this.assetTexts.set(asset.assetId, attachment.text);
			}
			return asset;
		});
	}

	async saveFiles(
		conversationId: string,
		files: Array<{ fileName: string; mimeType: string; content: string }>,
	): Promise<Array<{ id: string; assetId: string; reference: string; fileName: string; mimeType: string; sizeBytes: number; downloadUrl: string }>> {
		this.saved.push({ conversationId, files });
		return files.map((file, index) => ({
			id: `file-${index + 1}`,
			assetId: `file-${index + 1}`,
			reference: `@asset[file-${index + 1}]`,
			fileName: file.fileName,
			mimeType: file.mimeType,
			sizeBytes: Buffer.byteLength(file.content, "utf8"),
			downloadUrl: `/v1/files/file-${index + 1}`,
		}));
	}

	async listAssets(): Promise<AssetRecord[]> {
		return [...this.assets.values()];
	}

	async getAsset(assetId: string): Promise<AssetRecord | undefined> {
		return this.assets.get(assetId);
	}

	async resolveAssets(assetIds: readonly string[]): Promise<AssetRecord[]> {
		return assetIds.map((assetId) => this.assets.get(assetId)).filter((asset): asset is AssetRecord => Boolean(asset));
	}

	async readText(assetId: string): Promise<string | undefined> {
		return this.assetTexts.get(assetId);
	}

	async getFile(assetId: string): Promise<
		| {
				assetId: string;
				reference: string;
				fileName: string;
				mimeType: string;
				sizeBytes: number;
				kind: "text";
				hasContent: true;
				source: "agent_output";
				conversationId: string;
				createdAt: string;
				downloadUrl: string;
				content: Buffer;
		  }
		| undefined
	> {
		if (assetId !== "file-1") {
			return undefined;
		}
		return {
			assetId: "file-1",
			reference: "@asset[file-1]",
			fileName: "hello.txt",
			mimeType: "text/plain",
			sizeBytes: 16,
			kind: "text",
			hasContent: true,
			source: "agent_output",
			conversationId: "manual:file-output",
			createdAt: "2026-04-18T00:00:00.000Z",
			downloadUrl: "/v1/files/file-1",
			content: Buffer.from("hello from agent", "utf8"),
		};
	}

	seedAsset(asset: AssetRecord, text?: string): void {
		this.assets.set(asset.assetId, asset);
		if (typeof text === "string") {
			this.assetTexts.set(asset.assetId, text);
		}
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

function sendFileToolFinished(file: {
	assetId: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	downloadUrl: string;
}): RawAgentSessionEventLike {
	return {
		type: "tool_execution_end",
		toolCallId: "tool-send-file",
		toolName: "send_file",
		isError: false,
		result: {
			content: [{ type: "text", text: `File ready: ${file.fileName}` }],
			details: {
				action: "send",
				file: {
					id: file.assetId,
					assetId: file.assetId,
					reference: `@asset[${file.assetId}]`,
					fileName: file.fileName,
					mimeType: file.mimeType,
					sizeBytes: file.sizeBytes,
					downloadUrl: file.downloadUrl,
				},
			},
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
	const assetStore = new FakeAssetStore();
	const service = new AgentService({ conversationStore: store, sessionFactory: factory, assetStore });

	const result = await service.chat({
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
	assert.match(session.prompts[0]?.message ?? "", /<user_assets>/);
	assert.match(session.prompts[0]?.message ?? "", /assetId: asset-upload-1/);
	assert.match(session.prompts[0]?.message ?? "", /reference: @asset\[asset-upload-1\]/);
	assert.match(session.prompts[0]?.message ?? "", /fileName: notes\.txt/);
	assert.match(session.prompts[0]?.message ?? "", /mimeType: text\/plain/);
	assert.match(session.prompts[0]?.message ?? "", /alpha\nbeta/);
	assert.match(session.prompts[0]?.message ?? "", /```ugk-file name="example\.txt"/);
	assert.deepEqual(result.inputAssets, [
		{
			assetId: "asset-upload-1",
			reference: "@asset[asset-upload-1]",
			fileName: "notes.txt",
			mimeType: "text/plain",
			sizeBytes: 18,
			kind: "text",
			hasContent: true,
			source: "user_upload",
			conversationId: "manual:attachments",
			createdAt: "2026-04-18T00:00:00.000Z",
			textPreview: "alpha\nbeta",
			downloadUrl: "/v1/files/asset-upload-1",
		},
	]);
});

test("chat converts ugk-file blocks from the assistant into downloadable files", async () => {
	const store = await createStore();
	const assetStore = new FakeAssetStore();
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
		assetStore,
	});

	const result = await service.chat({
		conversationId: "manual:file-output",
		message: "send me a file",
	});

	assert.equal(result.text, "Here is the file.\n\nUse it well.");
	assert.deepEqual(assetStore.saved, [
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
			assetId: "file-1",
			reference: "@asset[file-1]",
			fileName: "hello.txt",
			mimeType: "text/plain",
			sizeBytes: 16,
			downloadUrl: "/v1/files/file-1",
		},
	]);
});

test("chat returns empty visible text when the assistant only sends a ugk-file block", async () => {
	const store = await createStore();
	const assetStore = new FakeAssetStore();
	const factory = new FakeAgentSessionFactory(
		() =>
			new FakeSession(
				"E:/sessions/file-only.jsonl",
				[],
				['```ugk-file name="report.png" mime="image/png"', "iVBORw0KGgo=", "```"].join("\n"),
			),
	);
	const service = new AgentService({
		conversationStore: store,
		sessionFactory: factory,
		assetStore,
	});

	const events: Array<Record<string, unknown>> = [];
	const result = await service.streamChat(
		{
			conversationId: "manual:file-only",
			message: "send only the image",
		},
		(event) => {
			events.push(event as unknown as Record<string, unknown>);
		},
	);

	assert.equal(result, undefined);
	const doneEvent = events.find((event) => event.type === "done");
	assert.deepEqual(doneEvent, {
		type: "done",
		conversationId: "manual:file-only",
		text: "",
		sessionFile: "E:/sessions/file-only.jsonl",
		files: [
			{
				id: "file-1",
				assetId: "file-1",
				reference: "@asset[file-1]",
				fileName: "report.png",
				mimeType: "image/png",
				sizeBytes: 12,
				downloadUrl: "/v1/files/file-1",
			},
		],
	});
});

test("chat includes files returned by the send_file tool in the final done event", async () => {
	const store = await createStore();
	const factory = new FakeAgentSessionFactory(
		() =>
			new FakeSession(
				"E:/sessions/send-file-tool.jsonl",
				[
					sendFileToolFinished({
						assetId: "file-tool-1",
						fileName: "report.png",
						mimeType: "image/png",
						sizeBytes: 8,
						downloadUrl: "/v1/files/file-tool-1",
					}),
				],
				"文件已发送。",
			),
	);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });
	const events: Array<Record<string, unknown>> = [];

	const result = await service.chat({
		conversationId: "manual:send-file-tool",
		message: "send the report",
	});
	await service.streamChat(
		{
			conversationId: "manual:send-file-tool-stream",
			message: "send the report",
		},
		(event) => {
			events.push(event as unknown as Record<string, unknown>);
		},
	);

	const expectedFiles = [
		{
			id: "file-tool-1",
			assetId: "file-tool-1",
			reference: "@asset[file-tool-1]",
			fileName: "report.png",
			mimeType: "image/png",
			sizeBytes: 8,
			downloadUrl: "/v1/files/file-tool-1",
		},
	];
	assert.deepEqual(result.files, expectedFiles);
	assert.deepEqual(events.find((event) => event.type === "done")?.files, expectedFiles);
});

test("chat can reference previously stored assets without re-uploading them", async () => {
	const store = await createStore();
	const session = new FakeSession("E:/sessions/reuse.jsonl", [textDelta("reused asset")]);
	const factory = new FakeAgentSessionFactory(() => session);
	const assetStore = new FakeAssetStore();
	assetStore.seedAsset(
		{
			assetId: "asset-existing",
			reference: "@asset[asset-existing]",
			fileName: "plan.md",
			mimeType: "text/markdown",
			sizeBytes: 12,
			kind: "text",
			hasContent: true,
			source: "user_upload",
			conversationId: "manual:seed",
			createdAt: "2026-04-18T00:00:00.000Z",
			textPreview: "hello plan",
			downloadUrl: "/v1/files/asset-existing",
		},
		"hello plan",
	);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory, assetStore });

	await service.chat({
		conversationId: "manual:reuse",
		message: "Reuse that plan",
		assetRefs: ["asset-existing"],
	});

	assert.match(session.prompts[0]?.message ?? "", /assetId: asset-existing/);
	assert.match(session.prompts[0]?.message ?? "", /reference: @asset\[asset-existing\]/);
	assert.match(session.prompts[0]?.message ?? "", /hello plan/);
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
	assert.equal(activeSession.prompts.length, 1);
	assert.equal(activeSession.steerCalls.length, 1);
	assert.match(activeSession.steerCalls[0] ?? "", /插嘴/);
	assert.deepEqual(activeSession.followUpCalls, []);

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
	assert.equal(activeSession.prompts.length, 1);
	assert.deepEqual(activeSession.steerCalls, []);
	assert.equal(activeSession.followUpCalls.length, 1);
	assert.equal(activeSession.followUpCalls[0]?.startsWith("等会继续"), true);

	activeSession.finish();
	await run;
});

test("getRunStatus reports whether a conversation is actively streaming", async () => {
	const store = await createStore();
	const activeSession = new DeferredSession("E:/sessions/status.jsonl");
	activeSession.messages.push({
		role: "assistant",
		content: [{ type: "text", text: "已有上下文" }],
		usage: { totalTokens: 45231 },
		stopReason: "stop",
	} as never);
	const factory = new FakeAgentSessionFactory(() => activeSession);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	const run = service.streamChat(
		{
			conversationId: "manual:status",
			message: "start",
		},
		() => undefined,
	);
	await activeSession.promptStarted;

	assert.deepEqual(await service.getRunStatus("manual:status"), {
		conversationId: "manual:status",
		running: true,
		contextUsage: {
			provider: "dashscope-coding",
			model: "glm-5",
			currentTokens: 45231,
			contextWindow: 128000,
			reserveTokens: 16384,
			maxResponseTokens: 16384,
			availableTokens: 66385,
			percent: 35,
			status: "safe",
			mode: "usage",
		},
	});

	activeSession.finish();
	await run;

	assert.deepEqual(await service.getRunStatus("manual:status"), {
		conversationId: "manual:status",
		running: false,
		contextUsage: {
			provider: "dashscope-coding",
			model: "glm-5",
			currentTokens: 45236,
			contextWindow: 128000,
			reserveTokens: 16384,
			maxResponseTokens: 16384,
			availableTokens: 66380,
			percent: 35,
			status: "safe",
			mode: "usage",
		},
	});
});

test("getConversationState exposes the active run snapshot for refresh observers", async () => {
	const store = await createStore();
	const activeSession = new DeferredSession("E:/sessions/state.jsonl");
	activeSession.messages.push(
		{
			role: "user",
			content: buildPromptWithAssetContext("previous user"),
		} as never,
		{
			role: "assistant",
			content: [{ type: "text", text: "previous assistant" }],
			stopReason: "stop",
		},
	);
	const factory = new FakeAgentSessionFactory(() => activeSession);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	const run = service.streamChat(
		{
			conversationId: "manual:state",
			message: "current task",
		},
		() => undefined,
	);
	await activeSession.promptStarted;
	activeSession.emit({
		type: "tool_execution_start",
		toolCallId: "tool-state",
		toolName: "bash",
		args: { command: "echo state" },
	});
	activeSession.emit(textDelta("partial answer"));
	activeSession.emit({
		type: "queue_update",
		steering: ["queued steer"],
		followUp: ["queued follow-up"],
	});

	const state = await (
		service as AgentService & {
			getConversationState(conversationId: string): Promise<Record<string, unknown>>;
		}
	).getConversationState("manual:state");

	assert.equal(state.conversationId, "manual:state");
	assert.equal(state.running, true);
	assert.deepEqual(
		state.messages.map((message) => ({
			kind: message.kind,
			text: message.text,
		})),
		[
			{ kind: "user", text: "previous user" },
			{ kind: "assistant", text: "previous assistant" },
		],
	);
	assert.ok(state.activeRun);
	const activeRun = state.activeRun;
	assert.equal(activeRun.status, "running");
	assert.equal(activeRun.text, "partial answer");
	assert.deepEqual(activeRun.input, {
		message: "current task",
		inputAssets: [],
	});
	assert.deepEqual(activeRun.queue, {
		steering: ["queued steer"],
		followUp: ["queued follow-up"],
	});
	assert.match(
		activeRun.assistantMessageId,
		/^active-run-manual-state-/,
	);
	assert.ok(activeRun.process);
	const process = activeRun.process;
	assert.equal(process.isComplete, false);
	assert.equal(process.currentAction, "工具开始 · bash");
	assert.equal(
		process.entries.find((entry) => entry.toolName === "bash")?.toolName,
		"bash",
	);

	activeSession.finish();
	await run;
	const finishedState = await (
		service as AgentService & {
			getConversationState(conversationId: string): Promise<Record<string, unknown>>;
		}
	).getConversationState("manual:state");
	assert.equal(finishedState.running, false);
	assert.equal(finishedState.activeRun, null);
});

test("getConversationHistory returns the original user text without internal prompt protocols", async () => {
	const store = await createStore();
	await store.set("manual:history-clean", "E:/sessions/history-clean.jsonl");
	const session = new FakeSession("E:/sessions/history-clean.jsonl", [], "讨论的是第一条热点");
	session.messages.push(
		{
			role: "user",
			content: buildPromptWithAssetContext("帮我查询一下第一条大家都在讨论什么"),
		} as never,
		{
			role: "assistant",
			content: [{ type: "text", text: "讨论的是第一条热点" }],
			stopReason: "stop",
		},
	);
	const factory = new FakeAgentSessionFactory(() => session);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	const history = await service.getConversationHistory("manual:history-clean");

	assert.deepEqual(history.messages[0], {
		id: "session-message-1",
		kind: "user",
		title: "agent:global",
		text: "帮我查询一下第一条大家都在讨论什么",
		createdAt: new Date(0).toISOString(),
	});
	assert.equal(history.messages[1]?.text, "讨论的是第一条热点");
	assert.equal(history.messages.some((message) => message.text.includes("<asset_reference_protocol>")), false);
	assert.equal(history.messages.some((message) => message.text.includes("<file_response_protocol>")), false);
});

test("subscribeRunEvents replays buffered events and keeps streaming live active run updates", async () => {
	const store = await createStore();
	const activeSession = new DeferredSession("E:/sessions/reattach.jsonl");
	const factory = new FakeAgentSessionFactory(() => activeSession);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });
	const originalEvents: Array<Record<string, unknown>> = [];
	const reattachedEvents: Array<Record<string, unknown>> = [];

	const run = service.streamChat(
		{
			conversationId: "manual:reattach",
			message: "start",
		},
		(event) => {
			originalEvents.push(event as unknown as Record<string, unknown>);
		},
	);
	await activeSession.promptStarted;

	const subscription = service.subscribeRunEvents("manual:reattach", (event) => {
		reattachedEvents.push(event as unknown as Record<string, unknown>);
	});

	assert.equal(subscription.running, true);
	assert.deepEqual(reattachedEvents[0], {
		type: "run_started",
		conversationId: "manual:reattach",
	});

	activeSession.emit(textDelta("after refresh"));
	assert.deepEqual(reattachedEvents.at(-1), {
		type: "text_delta",
		textDelta: "after refresh",
	});
	assert.deepEqual(originalEvents.at(-1), {
		type: "text_delta",
		textDelta: "after refresh",
	});

	subscription.unsubscribe();
	activeSession.emit(textDelta("after unsubscribe"));
	assert.equal(
		reattachedEvents.some((event) => event.textDelta === "after unsubscribe"),
		false,
	);

	activeSession.finish();
	await run;
});

test("queueMessage uses explicit steer API instead of prompt(streamingBehavior)", async () => {
	const store = await createStore();
	const activeSession = new StrictQueueSession("E:/sessions/strict-steer.jsonl");
	const factory = new FakeAgentSessionFactory(() => activeSession);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	const run = service.streamChat(
		{
			conversationId: "manual:strict-steer",
			message: "start",
		},
		() => undefined,
	);
	await activeSession.promptStarted;

	await assert.doesNotReject(() =>
		service.queueMessage({
			conversationId: "manual:strict-steer",
			message: "steer now",
			mode: "steer",
		}),
	);
	assert.equal(activeSession.steerCalls.length, 1);
	assert.match(activeSession.steerCalls[0] ?? "", /steer now/);
	assert.deepEqual(activeSession.followUpCalls, []);

	activeSession.finish();
	await run;
});

test("queueMessage uses explicit followUp API instead of prompt(streamingBehavior)", async () => {
	const store = await createStore();
	const activeSession = new StrictQueueSession("E:/sessions/strict-follow-up.jsonl");
	const factory = new FakeAgentSessionFactory(() => activeSession);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	const run = service.streamChat(
		{
			conversationId: "manual:strict-follow-up",
			message: "start",
		},
		() => undefined,
	);
	await activeSession.promptStarted;

	await assert.doesNotReject(() =>
		service.queueMessage({
			conversationId: "manual:strict-follow-up",
			message: "follow up later",
			mode: "followUp",
		}),
	);
	assert.deepEqual(activeSession.steerCalls, []);
	assert.equal(activeSession.followUpCalls.length, 1);
	assert.equal(activeSession.followUpCalls[0]?.startsWith("follow up later"), true);

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

test("rewrites supported local artifact paths before returning assistant text to the user", async () => {
	const store = await createStore();
	const factory = new FakeAgentSessionFactory(
		() =>
			new FakeSession(
				"E:/sessions/final-local-artifact.jsonl",
				[],
				"请打开 file:///app/public/zhihu-hot-share.html",
			),
	);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	const result = await service.chat({
		conversationId: "manual:final-local-artifact",
		message: "把地址给我",
	});

	assert.equal(
		result.text,
		"请打开 http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fpublic%2Fzhihu-hot-share.html",
	);
});

test("rewrites supported local artifact paths in streamed tool output and final done text", async () => {
	const store = await createStore();
	const factory = new FakeAgentSessionFactory(
		() =>
			new FakeSession(
				"E:/sessions/stream-local-artifact.jsonl",
				[
					{
						type: "tool_execution_end",
						toolCallId: "tool-open-local",
						toolName: "browser_open",
						result: {
							message: "准备打开 file:///app/public/zhihu-hot-share.html",
						},
						isError: false,
					} as unknown as MessageUpdateEventLike,
					textDelta("现在给你 file:///app/public/zhihu-hot-share.html"),
				],
				"现在给你 file:///app/public/zhihu-hot-share.html",
			),
	);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });
	const events: Array<Record<string, unknown>> = [];

	await service.streamChat(
		{
			conversationId: "manual:stream-local-artifact",
			message: "把地址给我",
		},
		(event) => {
			events.push(event as unknown as Record<string, unknown>);
		},
	);

	assert.deepEqual(events[1], {
		type: "tool_finished",
		toolCallId: "tool-open-local",
		toolName: "browser_open",
		isError: false,
		result: "准备打开 http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fpublic%2Fzhihu-hot-share.html",
	});
	assert.deepEqual(events[2], {
		type: "text_delta",
		textDelta: "现在给你 http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fpublic%2Fzhihu-hot-share.html",
	});
	assert.deepEqual(events[3], {
		type: "done",
		conversationId: "manual:stream-local-artifact",
		text: "现在给你 http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fpublic%2Fzhihu-hot-share.html",
		sessionFile: "E:/sessions/stream-local-artifact.jsonl",
	});
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

test("streamChat ignores event sink failures so disconnected clients do not kill the run", async () => {
	const store = await createStore();
	const factory = new FakeAgentSessionFactory(
		() =>
			new FakeSession(
				"E:/sessions/disconnected.jsonl",
				[
					{
						type: "message_update",
						assistantMessageEvent: {
							type: "text_delta",
							delta: "still running",
						},
					},
				],
				"still running",
			),
	);
	const service = new AgentService({ conversationStore: store, sessionFactory: factory });

	await assert.doesNotReject(() =>
		service.streamChat(
			{
				conversationId: "manual:disconnected",
				message: "start",
			},
			(event) => {
				if (event.type === "text_delta") {
					throw new Error("client closed");
				}
			},
		),
	);

	assert.deepEqual(await store.get("manual:disconnected"), {
		sessionFile: "E:/sessions/disconnected.jsonl",
		updatedAt: (await store.get("manual:disconnected"))?.updatedAt,
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
