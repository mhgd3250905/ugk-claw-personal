import { randomUUID } from "node:crypto";
import { ConversationStore } from "./conversation-store.js";
import type { AssetRecord, AssetStoreLike, ChatAttachment } from "./asset-store.js";
import type {
	AgentSessionFactory,
	AgentSessionLike,
	MessageUpdateEventLike,
	QueueUpdateEventLike,
	RawAgentSessionEventLike,
	ToolExecutionEndEventLike,
	ToolExecutionStartEventLike,
	ToolExecutionUpdateEventLike,
	ProjectDefaultModelContext,
} from "./agent-session-factory.js";
import {
	buildContextUsageSnapshot,
	type AgentMessageLike,
} from "./context-usage.js";
import type {
	ChatActiveRunBody,
	ChatContextUsageBody,
	ChatProcessBody,
	ChatProcessEntryBody,
	ChatStreamEvent,
	ConversationStateResponseBody,
	QueueMessageMode,
} from "../types/api.js";
import {
	buildPromptWithAssetContext,
	extractAgentFileDrafts,
	rewriteUserVisibleLocalArtifactLinks,
	stripInternalPromptContext,
	type AgentFileArtifact,
	type PromptAssetContextEntry,
	toPromptAssetFromStoredAsset,
} from "./file-artifacts.js";

export interface ChatInput {
	conversationId?: string;
	message: string;
	userId?: string;
	attachments?: ChatAttachment[];
	assetRefs?: string[];
}

export interface ChatResult {
	conversationId: string;
	text: string;
	sessionFile?: string;
	inputAssets?: AssetRecord[];
	files?: AgentFileArtifact[];
}

export interface QueueMessageInput {
	conversationId: string;
	message: string;
	mode: QueueMessageMode;
	userId?: string;
	attachments?: ChatAttachment[];
	assetRefs?: string[];
}

export interface QueueMessageResult {
	conversationId: string;
	mode: QueueMessageMode;
	queued: boolean;
	reason?: "not_running";
}

export interface InterruptChatInput {
	conversationId: string;
}

export interface InterruptChatResult {
	conversationId: string;
	interrupted: boolean;
	reason?: "not_running" | "abort_not_supported";
}

export interface ResetConversationInput {
	conversationId: string;
}

export interface ResetConversationResult {
	conversationId: string;
	reset: boolean;
	reason?: "running";
}

export interface RunStatusResult {
	conversationId: string;
	running: boolean;
	contextUsage: ChatContextUsageBody;
}

export interface ConversationHistoryMessage {
	id: string;
	kind: "user" | "assistant" | "system" | "error";
	title: string;
	text: string;
	createdAt: string;
}

export interface ConversationHistoryResult {
	conversationId: string;
	messages: ConversationHistoryMessage[];
}

export type ConversationStateResult = ConversationStateResponseBody;

export interface RunEventSubscription {
	conversationId: string;
	running: boolean;
	unsubscribe: () => void;
}

export interface RuntimeSkillInfo {
	name: string;
	path?: string;
}

export interface AgentServiceOptions {
	conversationStore: ConversationStore;
	sessionFactory: AgentSessionFactory;
	assetStore?: AssetStoreLike;
}

type ChatStreamEventSink = (event: ChatStreamEvent) => void;

interface ActiveRunState {
	session: AgentSessionLike;
	interrupted: boolean;
	events: ChatStreamEvent[];
	subscribers: Set<ChatStreamEventSink>;
	view: ChatActiveRunBody;
}

const MAX_BUFFERED_RUN_EVENTS = 300;

export class AgentService {
	private readonly activeRuns = new Map<string, ActiveRunState>();

	constructor(private readonly options: AgentServiceOptions) {}

	async chat(input: ChatInput): Promise<ChatResult> {
		return await this.runChat(input);
	}

	async streamChat(input: ChatInput, onEvent: (event: ChatStreamEvent) => void): Promise<void> {
		await this.runChat(input, onEvent);
	}

	async getAvailableSkills(): Promise<RuntimeSkillInfo[]> {
		return (await this.options.sessionFactory.getAvailableSkills?.()) ?? [];
	}

	async queueMessage(input: QueueMessageInput): Promise<QueueMessageResult> {
		const activeRun = this.activeRuns.get(input.conversationId);
		if (!activeRun) {
			return {
				conversationId: input.conversationId,
				mode: input.mode,
				queued: false,
				reason: "not_running",
			};
		}

		const preparedAssets = await this.preparePromptAssets(input.conversationId, input.attachments, input.assetRefs);
		const message = buildPromptWithAssetContext(input.message, preparedAssets.promptAssets);
		if (input.mode === "steer" && activeRun.session.steer) {
			await activeRun.session.steer(message);
		} else if (input.mode === "followUp" && activeRun.session.followUp) {
			await activeRun.session.followUp(message);
		} else {
			await activeRun.session.prompt(message, {
				streamingBehavior: input.mode,
			});
		}

		return {
			conversationId: input.conversationId,
			mode: input.mode,
			queued: true,
		};
	}

	async interruptChat(input: InterruptChatInput): Promise<InterruptChatResult> {
		const activeRun = this.activeRuns.get(input.conversationId);
		if (!activeRun) {
			return {
				conversationId: input.conversationId,
				interrupted: false,
				reason: "not_running",
			};
		}

		if (!activeRun.session.abort) {
			return {
				conversationId: input.conversationId,
				interrupted: false,
				reason: "abort_not_supported",
			};
		}

		activeRun.interrupted = true;
		await activeRun.session.abort();

		return {
			conversationId: input.conversationId,
			interrupted: true,
		};
	}

	async resetConversation(input: ResetConversationInput): Promise<ResetConversationResult> {
		if (this.activeRuns.has(input.conversationId)) {
			return {
				conversationId: input.conversationId,
				reset: false,
				reason: "running",
			};
		}

		await this.options.conversationStore.delete(input.conversationId);
		return {
			conversationId: input.conversationId,
			reset: true,
		};
	}

	async getRunStatus(conversationId: string): Promise<RunStatusResult> {
		const running = this.activeRuns.has(conversationId);
		const session = await this.getContextSession(conversationId);
		const modelContext = this.getDefaultModelContext();
		const contextUsage = buildContextUsageSnapshot(
			modelContext,
			((session?.messages as AgentMessageLike[] | undefined) ?? []),
		);

		return {
			conversationId,
			running,
			contextUsage,
		};
	}

	async getConversationHistory(conversationId: string): Promise<ConversationHistoryResult> {
		const session = await this.getContextSession(conversationId);
		const messages = ((session?.messages as AgentMessageLike[] | undefined) ?? [])
			.map((message, index) => this.toConversationHistoryMessage(message, index))
			.filter((message): message is ConversationHistoryMessage => Boolean(message));

		return {
			conversationId,
			messages,
		};
	}

	async getConversationState(conversationId: string): Promise<ConversationStateResult> {
		const activeRun = this.activeRuns.get(conversationId);
		const session = await this.getContextSession(conversationId);
		const modelContext = this.getDefaultModelContext();
		const contextUsage = buildContextUsageSnapshot(
			modelContext,
			((session?.messages as AgentMessageLike[] | undefined) ?? []),
		);
		const messages = ((session?.messages as AgentMessageLike[] | undefined) ?? [])
			.map((message, index) => this.toConversationHistoryMessage(message, index))
			.filter((message): message is ConversationHistoryMessage => Boolean(message));

		return {
			conversationId,
			running: Boolean(activeRun),
			contextUsage,
			messages,
			activeRun: activeRun ? cloneActiveRunView(activeRun.view) : null,
			updatedAt: activeRun?.view.updatedAt ?? new Date().toISOString(),
		};
	}

	subscribeRunEvents(conversationId: string, onEvent: ChatStreamEventSink): RunEventSubscription {
		const activeRun = this.activeRuns.get(conversationId);
		if (!activeRun) {
			return {
				conversationId,
				running: false,
				unsubscribe: () => undefined,
			};
		}

		let replayedTerminalEvent = false;
		for (const event of activeRun.events) {
			this.emitEvent(onEvent, event);
			replayedTerminalEvent ||= isTerminalChatStreamEvent(event);
		}
		if (replayedTerminalEvent) {
			return {
				conversationId,
				running: true,
				unsubscribe: () => undefined,
			};
		}
		activeRun.subscribers.add(onEvent);

		return {
			conversationId,
			running: true,
			unsubscribe: () => {
				activeRun.subscribers.delete(onEvent);
			},
		};
	}

	private async runChat(
		input: ChatInput,
		onEvent?: ChatStreamEventSink,
	): Promise<ChatResult> {
		const conversationId = input.conversationId ?? `manual:${randomUUID()}`;
		const { session, skillFingerprint } = await this.openSession(conversationId);
		const preparedAssets = await this.preparePromptAssets(conversationId, input.attachments, input.assetRefs);
		if (this.activeRuns.has(conversationId)) {
			throw new Error(`Conversation ${conversationId} is already running`);
		}
		const activeRun = {
			session,
			interrupted: false,
			events: [],
			subscribers: new Set<ChatStreamEventSink>(),
			view: createActiveRunView(conversationId, input.message, preparedAssets.uploadedAssets),
		};
		this.activeRuns.set(conversationId, activeRun);

		this.emitRunEvent(activeRun, onEvent, {
			type: "run_started",
			conversationId,
		});

		let rawText = "";
		const sentFiles: AgentFileArtifact[] = [];
		const unsubscribe = session.subscribe((event) => {
			switch (event.type) {
				case "message_update":
					if (isMessageUpdateEvent(event)) {
						rawText = this.handleMessageUpdate(event, rawText, (streamEvent) => {
							this.emitRunEvent(activeRun, onEvent, streamEvent);
						});
					}
					break;
				case "tool_execution_start":
					if (isToolExecutionStartEvent(event)) {
						this.emitRunEvent(activeRun, onEvent, this.handleToolExecutionStart(event));
					}
					break;
				case "tool_execution_update":
					if (isToolExecutionUpdateEvent(event)) {
						this.emitRunEvent(activeRun, onEvent, this.handleToolExecutionUpdate(event));
					}
					break;
				case "tool_execution_end":
					if (isToolExecutionEndEvent(event)) {
						const sentFile = extractSendFileArtifact(event);
						if (sentFile) {
							sentFiles.push(sentFile);
						}
						this.emitRunEvent(activeRun, onEvent, this.handleToolExecutionEnd(event));
					}
					break;
				case "queue_update":
					if (isQueueUpdateEvent(event)) {
						this.emitRunEvent(activeRun, onEvent, {
							type: "queue_updated",
							steering: event.steering,
							followUp: event.followUp,
						});
					}
					break;
				default:
					break;
			}
		});

		try {
			await session.prompt(buildPromptWithAssetContext(input.message, preparedAssets.promptAssets));

			const lastAssistantMessage = [...(session.messages ?? [])].reverse().find((message) => message.role === "assistant");
			if (lastAssistantMessage?.stopReason === "error") {
				throw new Error(lastAssistantMessage.errorMessage ?? "Unknown upstream provider error");
			}

			if (!rawText) {
				rawText = this.extractAssistantText(lastAssistantMessage);
			}

			let text = rawText;
			let files: AgentFileArtifact[] | undefined;
			if (this.options.assetStore) {
				const extractedFiles = extractAgentFileDrafts(rawText);
				text = extractedFiles.text;
				files =
					extractedFiles.files.length > 0
						? await this.options.assetStore.saveFiles(conversationId, extractedFiles.files)
						: undefined;
			}
			text = rewriteUserVisibleLocalArtifactLinks(text);
			files = mergeAgentFiles(files, sentFiles);

			if (session.sessionFile) {
				await this.options.conversationStore.set(conversationId, session.sessionFile, {
					skillFingerprint,
				});
			}

			if (activeRun.interrupted) {
				this.emitRunEvent(activeRun, onEvent, {
					type: "interrupted",
					conversationId,
				});
			}

			const result: ChatResult = {
				conversationId,
				text,
				sessionFile: session.sessionFile,
				inputAssets: preparedAssets.uploadedAssets.length > 0 ? preparedAssets.uploadedAssets : undefined,
				files: files && files.length > 0 ? files : undefined,
			};

			const doneEvent: ChatStreamEvent = {
				type: "done",
				conversationId: result.conversationId,
				text: result.text,
				sessionFile: result.sessionFile,
			};
			if (result.files) {
				doneEvent.files = result.files;
			}
			if (result.inputAssets) {
				doneEvent.inputAssets = result.inputAssets;
			}
			this.emitRunEvent(activeRun, onEvent, doneEvent);

			return result;
		} finally {
			unsubscribe();
			if (this.activeRuns.get(conversationId) === activeRun) {
				this.activeRuns.delete(conversationId);
			}
			activeRun.subscribers.clear();
		}
	}

	private emitRunEvent(
		activeRun: ActiveRunState,
		primarySink: ChatStreamEventSink | undefined,
		event: ChatStreamEvent,
	): void {
		this.applyEventToActiveRunView(activeRun, event);
		activeRun.events.push(event);
		if (activeRun.events.length > MAX_BUFFERED_RUN_EVENTS) {
			activeRun.events.shift();
		}

		this.emitEvent(primarySink, event);
		for (const subscriber of activeRun.subscribers) {
			this.emitEvent(subscriber, event);
		}
	}

	private applyEventToActiveRunView(activeRun: ActiveRunState, event: ChatStreamEvent): void {
		const view = activeRun.view;
		view.updatedAt = new Date().toISOString();
		switch (event.type) {
			case "run_started":
				appendProcessEntry(view, {
					kind: "system",
					title: "任务开始",
					detail: event.conversationId,
				});
				break;
			case "text_delta":
				view.text += event.textDelta;
				break;
			case "tool_started":
				appendProcessEntry(view, {
					kind: "tool",
					title: "工具开始",
					detail: event.args,
					toolCallId: event.toolCallId,
					toolName: event.toolName,
				});
				break;
			case "tool_updated":
				appendProcessEntry(view, {
					kind: "tool",
					title: "工具更新",
					detail: event.partialResult,
					toolCallId: event.toolCallId,
					toolName: event.toolName,
				});
				break;
			case "tool_finished":
				appendProcessEntry(view, {
					kind: event.isError ? "error" : "ok",
					title: "工具结束",
					detail: event.result,
					toolCallId: event.toolCallId,
					toolName: event.toolName,
					isError: event.isError,
				});
				break;
			case "queue_updated":
				view.queue = {
					steering: [...event.steering],
					followUp: [...event.followUp],
				};
				break;
			case "interrupted":
				view.status = "interrupted";
				view.loading = false;
				completeProcess(view, "system", "任务已打断", event.conversationId);
				break;
			case "done":
				view.status = "done";
				view.loading = false;
				view.text = event.text;
				completeProcess(view, "ok", "任务完成", event.sessionFile ?? "");
				break;
			case "error":
				view.status = "error";
				view.loading = false;
				completeProcess(view, "error", "任务错误", event.message);
				break;
			default:
				break;
		}
	}

	private emitEvent(onEvent: ChatStreamEventSink | undefined, event: ChatStreamEvent): void {
		if (!onEvent) {
			return;
		}

		try {
			onEvent(event);
		} catch {
			// Event delivery is best-effort; a dead SSE client must not cancel the agent run.
		}
	}

	private async openSession(
		conversationId: string,
	): Promise<{ session: AgentSessionLike; skillFingerprint?: string }> {
		const existingConversation = await this.options.conversationStore.get(conversationId);
		const skillFingerprint = await this.options.sessionFactory.getSkillFingerprint?.();
		const shouldReuseExistingSession =
			existingConversation?.sessionFile !== undefined &&
			(skillFingerprint === undefined || existingConversation.skillFingerprint === skillFingerprint);

		const session = await this.options.sessionFactory.createSession({
			conversationId,
			sessionFile: shouldReuseExistingSession ? existingConversation?.sessionFile : undefined,
		});

		return {
			session,
			skillFingerprint,
		};
	}

	private async getContextSession(conversationId: string): Promise<AgentSessionLike | undefined> {
		const activeRun = this.activeRuns.get(conversationId);
		if (activeRun) {
			return activeRun.session;
		}

		const existingConversation = await this.options.conversationStore.get(conversationId);
		if (!existingConversation?.sessionFile) {
			return undefined;
		}

		return await this.options.sessionFactory.createSession({
			conversationId,
			sessionFile: existingConversation.sessionFile,
		});
	}

	private getDefaultModelContext(): ProjectDefaultModelContext {
		return (
			this.options.sessionFactory.getDefaultModelContext?.() ?? {
				provider: "unknown",
				model: "unknown",
				contextWindow: 128000,
				maxResponseTokens: 16384,
				reserveTokens: 16384,
			}
		);
	}

	private async preparePromptAssets(
		conversationId: string,
		attachments?: readonly ChatAttachment[],
		assetRefs?: readonly string[],
	): Promise<{
		uploadedAssets: AssetRecord[];
		promptAssets: PromptAssetContextEntry[];
	}> {
		if (!this.options.assetStore) {
			return {
				uploadedAssets: [],
				promptAssets:
					attachments?.map((attachment, index) => ({
						assetId: `inline-upload-${index + 1}`,
						reference: `@asset[inline-upload-${index + 1}]`,
						fileName: attachment.fileName,
						mimeType: attachment.mimeType?.trim() || "application/octet-stream",
						sizeBytes: Number.isFinite(attachment.sizeBytes) ? attachment.sizeBytes ?? 0 : 0,
						kind: typeof attachment.text === "string" ? "text" : "metadata",
						hasContent: typeof attachment.text === "string",
						source: "upload",
						...(typeof attachment.text === "string" ? { textContent: attachment.text } : {}),
					})) ?? [],
			};
		}

		const uploadedAssets =
			attachments && attachments.length > 0
				? await this.options.assetStore.registerAttachments(conversationId, attachments)
				: [];
		const referencedAssets =
			assetRefs && assetRefs.length > 0 ? await this.options.assetStore.resolveAssets(assetRefs) : [];

		const uploadedPromptAssets = uploadedAssets.map((asset, index) =>
			toPromptAssetFromStoredAsset(asset, {
				source: "upload",
				textContent: attachments?.[index]?.text,
			}),
		);

		const referencedPromptAssets = await Promise.all(
			referencedAssets.map(async (asset) =>
				toPromptAssetFromStoredAsset(asset, {
					source: "reference",
					textContent: await this.options.assetStore?.readText(asset.assetId),
				}),
			),
		);

		return {
			uploadedAssets,
			promptAssets: [...uploadedPromptAssets, ...referencedPromptAssets],
		};
	}

	private handleMessageUpdate(
		event: MessageUpdateEventLike,
		currentText: string,
		onEvent?: (event: ChatStreamEvent) => void,
	): string {
		if (event.assistantMessageEvent.type !== "text_delta" || typeof event.assistantMessageEvent.delta !== "string") {
			return currentText;
		}

		const delta = event.assistantMessageEvent.delta;
		const nextText = currentText + delta;
		this.emitEvent(onEvent, {
			type: "text_delta",
			textDelta: rewriteUserVisibleLocalArtifactLinks(delta),
		});
		return nextText;
	}

	private handleToolExecutionStart(event: ToolExecutionStartEventLike): ChatStreamEvent {
		return {
			type: "tool_started",
			toolCallId: event.toolCallId,
			toolName: event.toolName,
			args: this.formatProcessPayload(event.args),
		};
	}

	private handleToolExecutionUpdate(event: ToolExecutionUpdateEventLike): ChatStreamEvent {
		return {
			type: "tool_updated",
			toolCallId: event.toolCallId,
			toolName: event.toolName,
			partialResult: this.formatProcessPayload(event.partialResult),
		};
	}

	private handleToolExecutionEnd(event: ToolExecutionEndEventLike): ChatStreamEvent {
		return {
			type: "tool_finished",
			toolCallId: event.toolCallId,
			toolName: event.toolName,
			isError: event.isError,
			result: this.formatProcessPayload(event.result),
		};
	}

	private formatProcessPayload(value: unknown): string {
		if (value === undefined) {
			return "";
		}

		if (typeof value === "string") {
			return this.normalizeProcessText(value);
		}
		if (typeof value === "number" || typeof value === "boolean") {
			return String(value);
		}
		if (Array.isArray(value)) {
			return value
				.map((entry) => this.formatProcessPayload(entry))
				.filter((entry) => entry.length > 0)
				.join("\n\n");
		}
		if (value !== null && typeof value === "object") {
			const textContent = this.extractTextContent(value);
			if (textContent) {
				return textContent;
			}

			try {
				return rewriteUserVisibleLocalArtifactLinks(JSON.stringify(value, null, 2));
			} catch {
				return rewriteUserVisibleLocalArtifactLinks(this.normalizeProcessText(String(value)));
			}
		}

		return rewriteUserVisibleLocalArtifactLinks(this.normalizeProcessText(String(value)));
	}

	private extractTextContent(value: object): string {
		if ("text" in value && typeof value.text === "string") {
			return rewriteUserVisibleLocalArtifactLinks(this.normalizeProcessText(value.text));
		}
		if ("message" in value && typeof value.message === "string") {
			return rewriteUserVisibleLocalArtifactLinks(this.normalizeProcessText(value.message));
		}
		if ("content" in value && Array.isArray(value.content)) {
			return value.content
				.map((entry) => {
					if (typeof entry === "string") {
						return rewriteUserVisibleLocalArtifactLinks(this.normalizeProcessText(entry));
					}
					if (entry && typeof entry === "object" && "text" in entry && typeof entry.text === "string") {
						return rewriteUserVisibleLocalArtifactLinks(this.normalizeProcessText(entry.text));
					}
					return "";
				})
				.filter((entry) => entry.length > 0)
				.join("\n");
		}

		return "";
	}

	private normalizeProcessText(text: string): string {
		const withoutNulls = text.includes("\u0000") ? text.replace(/\u0000/g, "") : text;
		return withoutNulls.replace(/\r\n/g, "\n").trim();
	}

	private extractAssistantText(
		message:
			| {
					content?: unknown;
			  }
			| undefined,
	): string {
		if (!message?.content) {
			return "";
		}
		const { content } = message;
		if (typeof content === "string") {
			return content;
		}
		if (!Array.isArray(content)) {
			return "";
		}

		return content
			.filter((item): item is { type: "text"; text: string } =>
				Boolean(item && typeof item === "object" && "type" in item && item.type === "text" && "text" in item && typeof item.text === "string"),
			)
			.map((item) => item.text)
			.join("");
	}

	private toConversationHistoryMessage(
		message: AgentMessageLike,
		index: number,
	): ConversationHistoryMessage | undefined {
		const role = typeof message.role === "string" ? message.role : "";
		if (role !== "user" && role !== "assistant" && role !== "system") {
			return undefined;
		}

		const extractedText = this.extractMessageText(message);
		const text = role === "user" ? stripInternalPromptContext(extractedText) : extractedText;
		if (!text.trim()) {
			return undefined;
		}

		const kind = role === "user" ? "user" : role === "system" ? "system" : "assistant";
		return {
			id: `session-message-${index + 1}`,
			kind,
			title: kind === "user" ? conversationTitleFromRole(kind) : "助手",
			text: rewriteUserVisibleLocalArtifactLinks(text),
			createdAt: new Date(0).toISOString(),
		};
	}

	private extractMessageText(message: AgentMessageLike): string {
		if (message.role === "assistant") {
			return this.extractAssistantText(message);
		}
		const { content } = message;
		if (typeof content === "string") {
			return content;
		}
		if (!Array.isArray(content)) {
			return "";
		}

		return content
			.map((item) => {
				if (typeof item === "string") {
					return item;
				}
				if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
					return item.text;
				}
				return "";
			})
			.filter((text) => text.length > 0)
			.join("");
	}
}

function conversationTitleFromRole(kind: "user" | "assistant" | "system" | "error"): string {
	return kind === "user" ? "agent:global" : "助手";
}

function createActiveRunView(
	conversationId: string,
	message: string,
	inputAssets: AssetRecord[],
): ChatActiveRunBody {
	const now = new Date().toISOString();
	const runId = `run-${sanitizeStateId(conversationId)}-${randomUUID()}`;
	return {
		runId,
		status: "running",
		assistantMessageId: `active-run-${sanitizeStateId(conversationId)}-${randomUUID()}`,
		input: {
			message,
			inputAssets: inputAssets.map((asset) => ({ ...asset })),
		},
		text: "",
		process: createEmptyProcess(),
		queue: null,
		loading: true,
		startedAt: now,
		updatedAt: now,
	};
}

function sanitizeStateId(value: string): string {
	return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "conversation";
}

function createEmptyProcess(): ChatProcessBody {
	return {
		title: "思考过程",
		narration: [],
		isComplete: false,
		entries: [],
	};
}

function appendProcessEntry(
	view: ChatActiveRunBody,
	input: Omit<ChatProcessEntryBody, "id" | "createdAt">,
): void {
	const process = view.process ?? createEmptyProcess();
	const entry: ChatProcessEntryBody = {
		id: `process-${process.entries.length + 1}`,
		createdAt: new Date().toISOString(),
		...input,
	};
	process.entries.push(entry);
	process.kind = entry.kind;
	process.currentAction = formatProcessCurrentAction(entry.title, entry.toolName);
	process.narration.push(formatProcessNarration(entry));
	process.isComplete = false;
	view.process = process;
}

function completeProcess(
	view: ChatActiveRunBody,
	kind: ChatProcessEntryBody["kind"],
	title: string,
	detail: string,
): void {
	appendProcessEntry(view, {
		kind,
		title,
		detail,
	});
	if (view.process) {
		view.process.isComplete = true;
	}
}

function formatProcessCurrentAction(title: string, toolName?: string): string {
	return toolName ? `${title} · ${toolName}` : title;
}

function formatProcessNarration(entry: ChatProcessEntryBody): string {
	const subject = entry.toolName ? `${entry.title} · ${entry.toolName}` : entry.title;
	return entry.detail ? `${subject}\n${entry.detail}` : subject;
}

function cloneActiveRunView(view: ChatActiveRunBody): ChatActiveRunBody {
	return {
		...view,
		input: {
			message: view.input.message,
			inputAssets: view.input.inputAssets.map((asset) => ({ ...asset })),
		},
		process: view.process
			? {
					...view.process,
					narration: [...view.process.narration],
					entries: view.process.entries.map((entry) => ({ ...entry })),
				}
			: null,
		queue: view.queue
			? {
					steering: [...view.queue.steering],
					followUp: [...view.queue.followUp],
				}
			: null,
	};
}

function hasStringProperty(value: object, propertyName: string): boolean {
	return propertyName in value && typeof value[propertyName as keyof typeof value] === "string";
}

function extractSendFileArtifact(event: ToolExecutionEndEventLike): AgentFileArtifact | undefined {
	if (event.isError || event.toolName !== "send_file") {
		return undefined;
	}
	if (!event.result || typeof event.result !== "object") {
		return undefined;
	}

	const details = "details" in event.result ? (event.result as { details?: unknown }).details : undefined;
	if (!details || typeof details !== "object") {
		return undefined;
	}

	const file = "file" in details ? (details as { file?: unknown }).file : undefined;
	return normalizeAgentFileArtifact(file);
}

function normalizeAgentFileArtifact(value: unknown): AgentFileArtifact | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}

	const candidate = value as Record<string, unknown>;
	const assetId = readRequiredString(candidate, "assetId") ?? readRequiredString(candidate, "id");
	const fileName = readRequiredString(candidate, "fileName");
	const mimeType = readRequiredString(candidate, "mimeType");
	const downloadUrl = readRequiredString(candidate, "downloadUrl");
	const sizeBytes = readRequiredNumber(candidate, "sizeBytes");
	if (!assetId || !fileName || !mimeType || !downloadUrl || sizeBytes === undefined) {
		return undefined;
	}

	return {
		id: readRequiredString(candidate, "id") ?? assetId,
		assetId,
		reference: readRequiredString(candidate, "reference") ?? `@asset[${assetId}]`,
		fileName,
		mimeType,
		sizeBytes,
		downloadUrl,
	};
}

function mergeAgentFiles(existingFiles: AgentFileArtifact[] | undefined, sentFiles: AgentFileArtifact[]): AgentFileArtifact[] | undefined {
	const merged = new Map<string, AgentFileArtifact>();
	for (const file of [...(existingFiles ?? []), ...sentFiles]) {
		const key = file.assetId || file.id || file.downloadUrl;
		if (!key || merged.has(key)) {
			continue;
		}
		merged.set(key, file);
	}

	const files = [...merged.values()];
	return files.length > 0 ? files : undefined;
}

function readRequiredString(value: Record<string, unknown>, propertyName: string): string | undefined {
	const propertyValue = value[propertyName];
	return typeof propertyValue === "string" && propertyValue.trim().length > 0 ? propertyValue : undefined;
}

function readRequiredNumber(value: Record<string, unknown>, propertyName: string): number | undefined {
	const propertyValue = value[propertyName];
	return typeof propertyValue === "number" && Number.isFinite(propertyValue) && propertyValue >= 0 ? propertyValue : undefined;
}

function isMessageUpdateEvent(event: RawAgentSessionEventLike): event is MessageUpdateEventLike {
	return event.type === "message_update" && "assistantMessageEvent" in event;
}

function isToolExecutionStartEvent(event: RawAgentSessionEventLike): event is ToolExecutionStartEventLike {
	return event.type === "tool_execution_start" && hasStringProperty(event, "toolCallId") && hasStringProperty(event, "toolName");
}

function isToolExecutionUpdateEvent(event: RawAgentSessionEventLike): event is ToolExecutionUpdateEventLike {
	return event.type === "tool_execution_update" && hasStringProperty(event, "toolCallId") && hasStringProperty(event, "toolName");
}

function isToolExecutionEndEvent(event: RawAgentSessionEventLike): event is ToolExecutionEndEventLike {
	return (
		event.type === "tool_execution_end" &&
		hasStringProperty(event, "toolCallId") &&
		hasStringProperty(event, "toolName") &&
		"isError" in event &&
		typeof event.isError === "boolean"
	);
}

function isQueueUpdateEvent(event: RawAgentSessionEventLike): event is QueueUpdateEventLike {
	return event.type === "queue_update" && Array.isArray(event.steering) && Array.isArray(event.followUp);
}

function isTerminalChatStreamEvent(event: ChatStreamEvent): boolean {
	return event.type === "done" || event.type === "interrupted" || event.type === "error";
}
