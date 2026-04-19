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
} from "./agent-session-factory.js";
import type { ChatStreamEvent, QueueMessageMode } from "../types/api.js";
import {
	buildPromptWithAssetContext,
	extractAgentFileDrafts,
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

export interface RunStatusResult {
	conversationId: string;
	running: boolean;
}

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

	async getRunStatus(conversationId: string): Promise<RunStatusResult> {
		return {
			conversationId,
			running: this.activeRuns.has(conversationId),
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
		};
		this.activeRuns.set(conversationId, activeRun);

		this.emitRunEvent(activeRun, onEvent, {
			type: "run_started",
			conversationId,
		});

		let text = "";
		const sentFiles: AgentFileArtifact[] = [];
		const unsubscribe = session.subscribe((event) => {
			switch (event.type) {
				case "message_update":
					if (isMessageUpdateEvent(event)) {
						text = this.handleMessageUpdate(event, text, (streamEvent) => {
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

			if (!text) {
				text = this.extractAssistantText(lastAssistantMessage);
			}

			let files: AgentFileArtifact[] | undefined;
			if (this.options.assetStore) {
				const extractedFiles = extractAgentFileDrafts(text);
				text = extractedFiles.text;
				files =
					extractedFiles.files.length > 0
						? await this.options.assetStore.saveFiles(conversationId, extractedFiles.files)
						: undefined;
			}
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
		activeRun.events.push(event);
		if (activeRun.events.length > MAX_BUFFERED_RUN_EVENTS) {
			activeRun.events.shift();
		}

		this.emitEvent(primarySink, event);
		for (const subscriber of activeRun.subscribers) {
			this.emitEvent(subscriber, event);
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
			textDelta: delta,
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
				return JSON.stringify(value, null, 2);
			} catch {
				return this.normalizeProcessText(String(value));
			}
		}

		return this.normalizeProcessText(String(value));
	}

	private extractTextContent(value: object): string {
		if ("text" in value && typeof value.text === "string") {
			return this.normalizeProcessText(value.text);
		}
		if ("message" in value && typeof value.message === "string") {
			return this.normalizeProcessText(value.message);
		}
		if ("content" in value && Array.isArray(value.content)) {
			return value.content
				.map((entry) => {
					if (typeof entry === "string") {
						return this.normalizeProcessText(entry);
					}
					if (entry && typeof entry === "object" && "text" in entry && typeof entry.text === "string") {
						return this.normalizeProcessText(entry.text);
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
