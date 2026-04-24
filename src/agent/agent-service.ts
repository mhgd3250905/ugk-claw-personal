import { randomUUID } from "node:crypto";
import { closeBrowserTargetsForScope } from "./browser-cleanup.js";
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
	type RuntimeSkillInfo,
	type RuntimeSkillListResult,
} from "./agent-session-factory.js";
import {
	buildContextUsageSnapshot,
	type AgentMessageLike,
} from "./context-usage.js";
import type {
	ChatActiveRunBody,
	ChatAssetBody,
	ChatContextUsageBody,
	ChatHistoryFileBody,
	ChatProcessBody,
	ChatProcessEntryBody,
	ChatStreamEvent,
	ConversationStateResponseBody,
	QueueMessageMode,
} from "../types/api.js";
import {
	buildPromptWithAssetContext,
	extractAgentFileDrafts,
	prependCurrentTimeContext,
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

export interface ConversationCatalogItem {
	conversationId: string;
	title: string;
	preview: string;
	messageCount: number;
	createdAt: string;
	updatedAt: string;
	running: boolean;
}

export interface ConversationCatalogResult {
	currentConversationId: string;
	conversations: ConversationCatalogItem[];
}

export interface CreateConversationResult {
	conversationId: string;
	currentConversationId: string;
	created: boolean;
	reason?: "running";
}

export interface DeleteConversationResult {
	conversationId: string;
	currentConversationId: string;
	deleted: boolean;
	reason?: "running" | "not_found";
}

export interface SwitchConversationResult {
	conversationId: string;
	currentConversationId: string;
	switched: boolean;
	reason?: "running" | "not_found";
}

export interface ConversationHistoryMessage {
	id: string;
	kind: "user" | "assistant" | "system" | "error" | "notification";
	title: string;
	text: string;
	createdAt: string;
	source?: string;
	sourceId?: string;
	runId?: string;
	assetRefs?: ChatAssetBody[];
	files?: ChatHistoryFileBody[];
}

export interface ConversationHistoryResult {
	conversationId: string;
	messages: ConversationHistoryMessage[];
	hasMore: boolean;
	nextBefore?: string;
	limit: number;
}

export type ConversationStateResult = ConversationStateResponseBody;

export interface ConversationHistoryPageOptions {
	limit?: number;
	before?: string;
}

export interface ConversationStateOptions {
	viewLimit?: number;
}

export interface RunEventSubscription {
	conversationId: string;
	running: boolean;
	unsubscribe: () => void;
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
	historyMessageCountBeforeRun: number;
	persistedTurnCoverage: PersistedTurnCoverage | null;
}

interface PersistedTurnCoverage {
	inputCovered: boolean;
	assistantIndex: number;
}

interface TerminalRunState {
	view: ChatActiveRunBody;
	events: ChatStreamEvent[];
	historyCoverage: PersistedTurnCoverage;
}

const MAX_BUFFERED_RUN_EVENTS = 300;
const DEFAULT_CONVERSATION_STATE_VIEW_LIMIT = 160;
const DEFAULT_CONVERSATION_HISTORY_LIMIT = 80;
const MAX_CONVERSATION_HISTORY_PAGE_LIMIT = 500;

export class AgentService {
	private readonly activeRuns = new Map<string, ActiveRunState>();
	private readonly terminalRuns = new Map<string, TerminalRunState>();

	constructor(private readonly options: AgentServiceOptions) {}

	async chat(input: ChatInput): Promise<ChatResult> {
		return await this.runChat(input);
	}

	async streamChat(input: ChatInput, onEvent: (event: ChatStreamEvent) => void): Promise<void> {
		await this.runChat(input, onEvent);
	}

	async getAvailableSkills(): Promise<RuntimeSkillListResult> {
		const result = await this.options.sessionFactory.getAvailableSkills?.();
		if (result) {
			return {
				skills: result.skills.map((skill: RuntimeSkillInfo) => ({ ...skill })),
				source: result.source,
				cachedAt: result.cachedAt,
			};
		}

		return {
			skills: [],
			source: "fresh",
			cachedAt: new Date(0).toISOString(),
		};
	}

	async getConversationCatalog(): Promise<ConversationCatalogResult> {
		const currentConversationId = await this.ensureCurrentConversationId();
		const conversationEntries = await this.options.conversationStore.list();
		const conversations = conversationEntries.map((entry) => ({
			conversationId: entry.conversationId,
			title: entry.title || "?????",
			preview: entry.preview || "",
			messageCount: Number.isFinite(entry.messageCount) ? entry.messageCount ?? 0 : 0,
			createdAt: entry.createdAt ?? entry.updatedAt,
			updatedAt: entry.updatedAt,
			running: this.activeRuns.has(entry.conversationId),
		}));
		conversations.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

		return {
			currentConversationId,
			conversations,
		};
	}

	async createConversation(): Promise<CreateConversationResult> {
		const currentConversationId = await this.ensureCurrentConversationId();
		if (this.activeRuns.size > 0) {
			return {
				conversationId: currentConversationId,
				currentConversationId,
				created: false,
				reason: "running",
			};
		}

		const conversationId = `manual:${randomUUID()}`;
		await this.options.conversationStore.set(conversationId, undefined, {
			title: "新会话",
			preview: "",
			messageCount: 0,
		});
		await this.options.conversationStore.setCurrentConversationId(conversationId);
		return {
			conversationId,
			currentConversationId: conversationId,
			created: true,
		};
	}

	async deleteConversation(conversationId: string): Promise<DeleteConversationResult> {
		const currentConversationId = await this.ensureCurrentConversationId();
		if (this.activeRuns.size > 0) {
			return {
				conversationId: currentConversationId,
				currentConversationId,
				deleted: false,
				reason: "running",
			};
		}

		const existingConversation = await this.options.conversationStore.get(conversationId);
		if (!existingConversation) {
			return {
				conversationId,
				currentConversationId,
				deleted: false,
				reason: "not_found",
			};
		}

		await this.options.conversationStore.delete(conversationId);
		this.terminalRuns.delete(conversationId);
		const nextCurrentConversationId = await this.ensureCurrentConversationId();
		return {
			conversationId,
			currentConversationId: nextCurrentConversationId,
			deleted: true,
		};
	}

	async switchConversation(conversationId: string): Promise<SwitchConversationResult> {
		const currentConversationId = await this.ensureCurrentConversationId();
		if (this.activeRuns.size > 0) {
			return {
				conversationId: currentConversationId,
				currentConversationId,
				switched: false,
				reason: "running",
			};
		}

		const existingConversation = await this.options.conversationStore.get(conversationId);
		if (!existingConversation) {
			return {
				conversationId,
				currentConversationId,
				switched: false,
				reason: "not_found",
			};
		}

		await this.options.conversationStore.setCurrentConversationId(conversationId);
		return {
			conversationId,
			currentConversationId: conversationId,
			switched: true,
		};
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
		const message = buildPromptWithAssetContext(prependCurrentTimeContext(input.message), preparedAssets.promptAssets);
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

		this.terminalRuns.delete(input.conversationId);
		await this.options.conversationStore.delete(input.conversationId);
		return {
			conversationId: input.conversationId,
			reset: true,
		};
	}

	async getRunStatus(conversationId: string): Promise<RunStatusResult> {
		const running = this.activeRuns.has(conversationId);
		const messages = await this.getContextMessages(conversationId);
		const modelContext = this.getDefaultModelContext();
		const contextUsage = buildContextUsageSnapshot(modelContext, messages);

		return {
			conversationId,
			running,
			contextUsage,
		};
	}

	async getConversationHistory(
		conversationId: string,
		options?: ConversationHistoryPageOptions,
	): Promise<ConversationHistoryResult> {
		const messages = this.buildConversationHistoryMessages(await this.getContextMessages(conversationId));
		const page = paginateConversationHistoryMessages(messages, {
			limit: options?.limit,
			before: options?.before,
			defaultLimit: DEFAULT_CONVERSATION_HISTORY_LIMIT,
		});

		return {
			conversationId,
			messages: page.messages,
			hasMore: page.hasMore,
			nextBefore: page.nextBefore,
			limit: page.limit,
		};
	}

	async getConversationState(
		conversationId: string,
		options?: ConversationStateOptions,
	): Promise<ConversationStateResult> {
		const activeRun = this.activeRuns.get(conversationId);
		const existingConversation = await this.options.conversationStore.get(conversationId);
		const contextMessages = await this.getContextMessages(conversationId);
		const modelContext = this.getDefaultModelContext();
		const contextUsage = buildContextUsageSnapshot(modelContext, contextMessages);
		const sessionMessages = this.buildConversationHistoryMessages(
			contextMessages,
			activeRun?.view,
		);
		const terminalRun = activeRun ? undefined : this.getRenderableTerminalRun(conversationId, sessionMessages);
		const historyPage = paginateConversationHistoryMessages(sessionMessages, {
			limit: options?.viewLimit,
			defaultLimit: DEFAULT_CONVERSATION_STATE_VIEW_LIMIT,
		});
		const activeRunView = activeRun
			? cloneActiveRunView(activeRun.view)
			: terminalRun
				? cloneActiveRunView(terminalRun.view)
				: null;
		const persistedTurnCoverage = shiftPersistedTurnCoverageToPage(
			activeRun?.persistedTurnCoverage ?? terminalRun?.historyCoverage,
			historyPage.startIndex,
			historyPage.messages.length,
		);
		const viewMessages = buildConversationViewMessages(
			conversationId,
			historyPage.messages,
			activeRunView,
			persistedTurnCoverage,
		);

		return {
			conversationId,
			running: Boolean(activeRun),
			contextUsage,
			messages: historyPage.messages,
			viewMessages,
			activeRun: activeRunView,
			historyPage: {
				hasMore: historyPage.hasMore,
				nextBefore: historyPage.nextBefore,
				limit: historyPage.limit,
			},
			updatedAt:
				activeRun?.view.updatedAt ??
				terminalRun?.view.updatedAt ??
				existingConversation?.updatedAt ??
				new Date(0).toISOString(),
		};
	}

	private getRenderableTerminalRun(
		conversationId: string,
		sessionMessages: readonly ConversationHistoryMessage[],
	): TerminalRunState | undefined {
		const terminalRun = this.terminalRuns.get(conversationId);
		if (!terminalRun) {
			return undefined;
		}

		if (!shouldExposeTerminalRunSnapshot(sessionMessages, terminalRun.view)) {
			return undefined;
		}

		const view = cloneActiveRunView(terminalRun.view);
		if (shouldHideTerminalInputEcho(sessionMessages, view.input.message)) {
			view.input.message = "";
		}

		return {
			view,
			events: terminalRun.events.map(cloneChatStreamEvent),
			historyCoverage: { ...terminalRun.historyCoverage },
		};
	}

	async getRunEvents(conversationId: string, runId: string): Promise<ChatStreamEvent[]> {
		const activeRun = this.activeRuns.get(conversationId);
		if (activeRun?.view.runId === runId) {
			return activeRun.events.map(cloneChatStreamEvent);
		}

		const terminalRun = this.terminalRuns.get(conversationId);
		if (terminalRun?.view.runId === runId) {
			return terminalRun.events.map(cloneChatStreamEvent);
		}

		return [];
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
		const browserCleanupScope = createBrowserCleanupScope(conversationId);
		if (this.activeRuns.has(conversationId)) {
			throw new Error(`Conversation ${conversationId} is already running`);
		}
		if (this.activeRuns.size > 0) {
			throw new Error("Another conversation is already running");
		}
		const { session, skillFingerprint } = await this.openSession(conversationId);
		const preparedAssets = await this.preparePromptAssets(conversationId, input.attachments, input.assetRefs);
		const historyMessageCountBeforeRun = this.buildConversationHistoryMessages(
			((session.messages as AgentMessageLike[] | undefined) ?? []),
		).length;
		this.terminalRuns.delete(conversationId);
		await this.options.conversationStore.setCurrentConversationId(conversationId);
		const activeRun = {
			session,
			interrupted: false,
			events: [],
			subscribers: new Set<ChatStreamEventSink>(),
			view: createActiveRunView(conversationId, input.message, preparedAssets.uploadedAssets),
			historyMessageCountBeforeRun,
			persistedTurnCoverage: null,
		};
		this.activeRuns.set(conversationId, activeRun);

		this.emitRunEvent(activeRun, onEvent, {
			type: "run_started",
			conversationId,
			runId: activeRun.view.runId,
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
			await closeBrowserTargetsForScope(browserCleanupScope);
			await runWithScopedAgentEnvironment(browserCleanupScope, async () => {
				await session.prompt(
					buildPromptWithAssetContext(prependCurrentTimeContext(input.message), preparedAssets.promptAssets),
				);
			});

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
					...this.buildConversationMetadata(session.messages),
				});
			}

			if (activeRun.interrupted) {
				this.refreshPersistedTurnCoverage(activeRun);
				this.emitRunEvent(activeRun, onEvent, {
					type: "interrupted",
					conversationId,
					runId: activeRun.view.runId,
				});
				return {
					conversationId,
					text,
					sessionFile: session.sessionFile,
					inputAssets: preparedAssets.uploadedAssets.length > 0 ? preparedAssets.uploadedAssets : undefined,
					files: files && files.length > 0 ? files : undefined,
				};
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
				runId: activeRun.view.runId,
				text: result.text,
				sessionFile: result.sessionFile,
			};
			if (result.files) {
				doneEvent.files = result.files;
			}
			if (result.inputAssets) {
				doneEvent.inputAssets = result.inputAssets;
			}
			this.refreshPersistedTurnCoverage(activeRun);
			this.emitRunEvent(activeRun, onEvent, doneEvent);

			return result;
		} catch (error) {
			const normalizedError = toError(error);
			this.refreshPersistedTurnCoverage(activeRun);
			this.emitRunEvent(activeRun, onEvent, {
				type: "error",
				conversationId,
				runId: activeRun.view.runId,
				message: normalizedError.message,
			});
			(normalizedError as Error & { chatStreamEventEmitted?: boolean }).chatStreamEventEmitted = true;
			throw normalizedError;
		} finally {
			unsubscribe();
			if (session.sessionFile) {
				await this.options.conversationStore.set(conversationId, session.sessionFile, {
					skillFingerprint,
					...this.buildConversationMetadata(session.messages),
				});
			}
			if (this.activeRuns.get(conversationId) === activeRun) {
				this.activeRuns.delete(conversationId);
			}
			if (shouldPersistTerminalRun(activeRun.view)) {
				const finalSessionMessages = this.buildConversationHistoryMessages(
					((session.messages as AgentMessageLike[] | undefined) ?? []),
				);
				this.terminalRuns.set(conversationId, {
					view: cloneActiveRunView(activeRun.view),
					events: activeRun.events.map(cloneChatStreamEvent),
					historyCoverage:
						activeRun.persistedTurnCoverage ??
						derivePersistedTurnCoverageFromRunTail(
							finalSessionMessages,
							activeRun.historyMessageCountBeforeRun,
							activeRun.view,
						),
				});
			} else {
				this.terminalRuns.delete(conversationId);
			}
			activeRun.subscribers.clear();
			await closeBrowserTargetsForScope(browserCleanupScope);
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

	private buildConversationMetadata(messages: readonly AgentMessageLike[] | undefined): {
		title: string;
		preview: string;
		messageCount: number;
	} {
		const history = this.buildConversationHistoryMessages(messages ?? []);
		const firstUserMessage = history.find((message) => message.kind === "user");
		const lastMessage = history.at(-1);
		return {
			title: summarizeConversationText(firstUserMessage?.text, "新会话"),
			preview: summarizeConversationText(lastMessage?.text, ""),
			messageCount: history.length,
		};
	}

	private async ensureCurrentConversationId(): Promise<string> {
		const currentConversationId = await this.options.conversationStore.getCurrentConversationId();
		if (currentConversationId) {
			return currentConversationId;
		}

		const existingConversation = (await this.options.conversationStore.list()).at(0);
		if (existingConversation) {
			await this.options.conversationStore.setCurrentConversationId(existingConversation.conversationId);
			return existingConversation.conversationId;
		}

		const conversationId = `manual:${randomUUID()}`;
		await this.options.conversationStore.set(conversationId, undefined, {
			title: "新会话",
			preview: "",
			messageCount: 0,
		});
		await this.options.conversationStore.setCurrentConversationId(conversationId);
		return conversationId;
	}

	private async openSession(
		conversationId: string,
	): Promise<{ session: AgentSessionLike; skillFingerprint?: string }> {
		const existingConversation = await this.options.conversationStore.get(conversationId);
		const skillFingerprint = await this.options.sessionFactory.getSkillFingerprint?.();
		const shouldReuseExistingSession = existingConversation?.sessionFile !== undefined;

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

	private async getContextMessages(conversationId: string): Promise<AgentMessageLike[]> {
		const activeRun = this.activeRuns.get(conversationId);
		if (activeRun) {
			return ((activeRun.session.messages as AgentMessageLike[] | undefined) ?? []);
		}

		const existingConversation = await this.options.conversationStore.get(conversationId);
		if (!existingConversation?.sessionFile) {
			return [];
		}

		const persistedMessages = await this.options.sessionFactory.readSessionMessages?.(existingConversation.sessionFile);
		if (persistedMessages) {
			return persistedMessages as AgentMessageLike[];
		}

		const session = await this.getContextSession(conversationId);
		return ((session?.messages as AgentMessageLike[] | undefined) ?? []);
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

	private buildConversationHistoryMessages(
		messages: readonly AgentMessageLike[],
		activeRunView?: ChatActiveRunBody,
	): ConversationHistoryMessage[] {
		const coalescedMessages: ConversationHistoryMessage[] = [];
		messages.forEach((message, index) => {
			const normalizedMessage = this.toConversationHistoryMessage(message, index);
			if (normalizedMessage) {
				appendConversationHistoryMessage(coalescedMessages, normalizedMessage);
			}

			const files = extractConversationHistoryFiles(message);
			if (files) {
				attachConversationHistoryFiles(coalescedMessages, files, resolveConversationMessageCreatedAt(message), index + 1);
			}
		});

		if (!activeRunView?.loading) {
			return coalescedMessages;
		}

		return omitTrailingActiveUserMessage(coalescedMessages, activeRunView.input.message);
	}

	private refreshPersistedTurnCoverage(activeRun: ActiveRunState): void {
		activeRun.persistedTurnCoverage = derivePersistedTurnCoverageFromRunTail(
			this.buildConversationHistoryMessages(((activeRun.session.messages as AgentMessageLike[] | undefined) ?? [])),
			activeRun.historyMessageCountBeforeRun,
			activeRun.view,
		);
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
			createdAt: resolveConversationMessageCreatedAt(message),
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

function cloneChatStreamEvent(event: ChatStreamEvent): ChatStreamEvent {
	switch (event.type) {
		case "run_started":
			return {
				type: "run_started",
				conversationId: event.conversationId,
				runId: event.runId,
			};
		case "text_delta":
			return {
				type: "text_delta",
				textDelta: event.textDelta,
			};
		case "tool_started":
			return {
				type: "tool_started",
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				args: event.args,
			};
		case "tool_updated":
			return {
				type: "tool_updated",
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				partialResult: event.partialResult,
			};
		case "tool_finished":
			return {
				type: "tool_finished",
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				isError: event.isError,
				result: event.result,
			};
		case "queue_updated":
			return {
				type: "queue_updated",
				steering: [...event.steering],
				followUp: [...event.followUp],
			};
		case "interrupted":
			return {
				type: "interrupted",
				conversationId: event.conversationId,
				runId: event.runId,
			};
		case "done":
			return {
				type: "done",
				conversationId: event.conversationId,
				runId: event.runId,
				text: event.text,
				...(event.sessionFile ? { sessionFile: event.sessionFile } : {}),
				...(event.inputAssets ? { inputAssets: event.inputAssets.map((asset) => ({ ...asset })) } : {}),
				...(event.files ? { files: event.files.map((file) => ({ ...file })) } : {}),
			};
		case "error":
			return {
				type: "error",
				conversationId: event.conversationId,
				runId: event.runId,
				message: event.message,
			};
		default:
			return event;
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

function extractConversationHistoryFiles(message: AgentMessageLike): ChatHistoryFileBody[] | undefined {
	if (message.role !== "toolResult") {
		return undefined;
	}

	const candidate = message as AgentMessageLike & {
		toolName?: string;
		details?: unknown;
		isError?: boolean;
	};
	if (candidate.toolName !== "send_file" || candidate.isError === true) {
		return undefined;
	}

	const details = candidate.details;
	if (!details || typeof details !== "object") {
		return undefined;
	}

	const file = "file" in details ? (details as { file?: unknown }).file : undefined;
	const normalized = normalizeAgentFileArtifact(file);
	if (!normalized) {
		return undefined;
	}

	return [
		{
			fileName: normalized.fileName,
			downloadUrl: normalized.downloadUrl,
			mimeType: normalized.mimeType,
			sizeBytes: normalized.sizeBytes,
		},
	];
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

function mergeConversationHistoryFiles(
	existingFiles: ChatHistoryFileBody[] | undefined,
	incomingFiles: readonly ChatHistoryFileBody[],
): ChatHistoryFileBody[] | undefined {
	const merged = new Map<string, ChatHistoryFileBody>();
	for (const file of [...(existingFiles ?? []), ...incomingFiles]) {
		const key = `${file.downloadUrl}|${file.fileName}`;
		if (merged.has(key)) {
			continue;
		}
		merged.set(key, { ...file });
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

function shouldPersistTerminalRun(view: ChatActiveRunBody): boolean {
	return view.status === "done" || view.status === "error" || view.status === "interrupted";
}

function shouldExposeTerminalRunSnapshot(
	messages: readonly ConversationHistoryMessage[],
	view: ChatActiveRunBody,
): boolean {
	const terminalText = normalizeComparableMessageText(view.text);
	if (!terminalText) {
		return true;
	}

	return !messages.some((message) => {
		if (message.kind !== "assistant") {
			return false;
		}

		const messageText = normalizeComparableMessageText(message.text);
		return messageText === terminalText || messageText.includes(terminalText);
	});
}

function buildConversationViewMessages(
	conversationId: string,
	messages: readonly ConversationHistoryMessage[],
	activeRun: ChatActiveRunBody | null,
	persistedTurnCoverage?: PersistedTurnCoverage,
): ConversationHistoryMessage[] {
	const viewMessages = messages.map(cloneConversationHistoryMessage);
	if (!activeRun) {
		return viewMessages;
	}

	const effectivePersistedTurnCoverage =
		activeRun.loading ? null : persistedTurnCoverage ?? findPersistedActiveRunTurnCoverage(viewMessages, activeRun);
	const assistantIndex =
		activeRun.loading
			? -1
			: effectivePersistedTurnCoverage?.assistantIndex ?? findActiveRunAssistantIndex(viewMessages, activeRun);
	const assistantCovered = assistantIndex >= 0;
	const inputCovered =
		activeRun.loading
			? false
			: effectivePersistedTurnCoverage?.inputCovered ?? historyHasActiveRunInput(viewMessages, activeRun, assistantIndex);
	if (assistantCovered) {
		viewMessages[assistantIndex] = {
			...viewMessages[assistantIndex],
			runId: activeRun.runId,
		};
	}
	if (!activeRun.loading && inputCovered && assistantCovered) {
		return viewMessages;
	}

	if (!inputCovered && activeRun.input.message.trim()) {
		viewMessages.push({
			id: `active-input-${activeRun.runId}`,
			kind: "user",
			title: conversationId,
			text: activeRun.input.message,
			createdAt: activeRun.startedAt,
			assetRefs: activeRun.input.inputAssets.map((asset) => ({ ...asset })),
		});
	}

	if (!assistantCovered) {
		viewMessages.push({
			id: activeRun.assistantMessageId,
			kind: "assistant",
			title: conversationTitleFromRole("assistant"),
			text: activeRun.text,
			createdAt: activeRun.startedAt,
			runId: activeRun.runId,
		});
	}

	return viewMessages;
}

function cloneConversationHistoryMessage(message: ConversationHistoryMessage): ConversationHistoryMessage {
	return {
		...message,
		...(message.assetRefs ? { assetRefs: message.assetRefs.map((asset) => ({ ...asset })) } : {}),
		...(message.files ? { files: message.files.map((file) => ({ ...file })) } : {}),
	};
}

interface ConversationHistoryPaginationInput {
	limit?: number;
	before?: string;
	defaultLimit: number;
}

interface ConversationHistoryPage {
	messages: ConversationHistoryMessage[];
	startIndex: number;
	hasMore: boolean;
	nextBefore?: string;
	limit: number;
}

function paginateConversationHistoryMessages(
	messages: readonly ConversationHistoryMessage[],
	input: ConversationHistoryPaginationInput,
): ConversationHistoryPage {
	const limit = normalizeConversationHistoryLimit(input.limit, input.defaultLimit);
	const before = typeof input.before === "string" ? input.before.trim() : "";
	const beforeIndex = before ? messages.findIndex((message) => message.id === before) : -1;
	const endIndex = beforeIndex >= 0 ? beforeIndex : messages.length;
	const startIndex = Math.max(0, endIndex - limit);
	const pageMessages = messages.slice(startIndex, endIndex).map(cloneConversationHistoryMessage);
	const hasMore = startIndex > 0;

	return {
		messages: pageMessages,
		startIndex,
		hasMore,
		nextBefore: hasMore ? pageMessages[0]?.id : undefined,
		limit,
	};
}

function normalizeConversationHistoryLimit(limit: number | undefined, defaultLimit: number): number {
	if (typeof limit !== "number" || !Number.isFinite(limit)) {
		return defaultLimit;
	}

	return Math.min(MAX_CONVERSATION_HISTORY_PAGE_LIMIT, Math.max(1, Math.floor(limit)));
}

function shiftPersistedTurnCoverageToPage(
	coverage: PersistedTurnCoverage | null | undefined,
	pageStartIndex: number,
	pageLength: number,
): PersistedTurnCoverage | undefined {
	if (!coverage) {
		return undefined;
	}
	if (coverage.assistantIndex < 0) {
		return {
			inputCovered: coverage.inputCovered,
			assistantIndex: -1,
		};
	}

	const assistantIndex = coverage.assistantIndex - pageStartIndex;
	if (assistantIndex < 0 || assistantIndex >= pageLength) {
		return undefined;
	}

	return {
		inputCovered: coverage.inputCovered,
		assistantIndex,
	};
}

function historyHasActiveRunInput(
	messages: readonly ConversationHistoryMessage[],
	activeRun: ChatActiveRunBody,
	assistantIndex: number,
): boolean {
	const inputText = normalizeComparableMessageText(activeRun.input.message);
	if (!inputText) {
		return true;
	}

	const endIndex = assistantIndex >= 0 ? assistantIndex - 1 : messages.length - 1;
	const startIndex = Math.max(0, endIndex - 8);
	for (let index = endIndex; index >= startIndex; index -= 1) {
		const message = messages[index];
		if (message.kind === "assistant" || message.kind === "system" || message.kind === "error") {
			return false;
		}
		if (message.kind === "user" && normalizeComparableMessageText(message.text) === inputText) {
			return true;
		}
	}

	return false;
}

function findPersistedActiveRunTurnCoverage(
	messages: readonly ConversationHistoryMessage[],
	activeRun: ChatActiveRunBody,
): PersistedTurnCoverage | null {
	const inputText = normalizeComparableMessageText(activeRun.input.message);
	if (!inputText) {
		return null;
	}

	const startIndex = Math.max(0, messages.length - 12);
	for (let index = messages.length - 1; index >= startIndex; index -= 1) {
		const message = messages[index];
		if (message.kind !== "user") {
			continue;
		}
		if (normalizeComparableMessageText(message.text) !== inputText) {
			continue;
		}

		for (let nextIndex = index + 1; nextIndex < messages.length; nextIndex += 1) {
			const nextMessage = messages[nextIndex];
			if (nextMessage.kind === "assistant") {
				return {
					inputCovered: true,
					assistantIndex: nextIndex,
				};
			}
			if (nextMessage.kind === "user") {
				return {
					inputCovered: true,
					assistantIndex: -1,
				};
			}
		}

		return {
			inputCovered: true,
			assistantIndex: -1,
		};
	}

	return null;
}

function derivePersistedTurnCoverageFromRunTail(
	messages: readonly ConversationHistoryMessage[],
	historyMessageCountBeforeRun: number,
	activeRun: ChatActiveRunBody,
): PersistedTurnCoverage {
	const inputText = normalizeComparableMessageText(activeRun.input.message);
	const startIndex = Math.max(0, Math.min(historyMessageCountBeforeRun, messages.length));
	let inputCovered = false;

	for (let index = startIndex; index < messages.length; index += 1) {
		const message = messages[index];
		if (!inputCovered) {
			if (message.kind !== "user") {
				continue;
			}
			if (inputText && normalizeComparableMessageText(message.text) !== inputText) {
				continue;
			}
			inputCovered = true;
			continue;
		}

		if (message.kind === "assistant") {
			return {
				inputCovered: true,
				assistantIndex: index,
			};
		}
		if (message.kind === "user") {
			break;
		}
	}

	return {
		inputCovered,
		assistantIndex: -1,
	};
}

function findActiveRunAssistantIndex(
	messages: readonly ConversationHistoryMessage[],
	activeRun: ChatActiveRunBody,
): number {
	const assistantText = normalizeComparableMessageText(activeRun.text);
	if (!activeRun.assistantMessageId && !assistantText) {
		return -1;
	}

	const startIndex = Math.max(0, messages.length - 8);
	for (let index = messages.length - 1; index >= startIndex; index -= 1) {
		const message = messages[index];
		if (message.kind !== "assistant") {
			continue;
		}
		if (message.id === activeRun.assistantMessageId) {
			return index;
		}
		const messageText = normalizeComparableMessageText(message.text);
		if (assistantText && (messageText === assistantText || messageText.includes(assistantText))) {
			return index;
		}
	}

	return -1;
}

function normalizeComparableMessageText(value: string | undefined): string {
	return String(value ?? "")
		.replace(/\s+/g, " ")
		.trim();
}

function resolveConversationMessageCreatedAt(message: AgentMessageLike): string {
	const rawTimestamp = message.timestamp;
	if (typeof rawTimestamp === "number" && Number.isFinite(rawTimestamp)) {
		return new Date(rawTimestamp).toISOString();
	}
	if (typeof rawTimestamp === "string" && rawTimestamp.trim()) {
		const normalized = new Date(rawTimestamp);
		if (!Number.isNaN(normalized.getTime())) {
			return normalized.toISOString();
		}
	}
	return new Date(0).toISOString();
}

function shouldHideTerminalInputEcho(
	messages: readonly ConversationHistoryMessage[],
	inputMessage: string,
): boolean {
	const normalizedInput = normalizeComparableMessageText(inputMessage);
	if (!normalizedInput) {
		return false;
	}

	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.kind === "assistant" || message.kind === "system" || message.kind === "error") {
			break;
		}
		if (message.kind === "user" && normalizeComparableMessageText(message.text) === normalizedInput) {
			return true;
		}
	}

	return false;
}

function summarizeConversationText(value: string | undefined, fallback: string): string {
	const compact = String(value ?? "")
		.replace(/\s+/g, " ")
		.trim();
	if (!compact) {
		return fallback;
	}

	return compact.length > 48 ? compact.slice(0, 48).trimEnd() + "..." : compact;
}

function omitTrailingActiveUserMessage(
	messages: ConversationHistoryMessage[],
	activeInputMessage: string,
): ConversationHistoryMessage[] {
	const normalizedInput = activeInputMessage.trim();
	if (!normalizedInput) {
		return messages;
	}

	const lastMessage = messages.at(-1);
	if (lastMessage?.kind !== "user") {
		return messages;
	}

	return lastMessage.text.trim() === normalizedInput ? messages.slice(0, -1) : messages;
}

function appendConversationHistoryMessage(
	messages: ConversationHistoryMessage[],
	message: ConversationHistoryMessage,
): void {
	const previous = messages.at(-1);
	if (previous?.kind === "assistant" && message.kind === "assistant") {
		previous.text = [previous.text, message.text].filter((text) => text.trim().length > 0).join("\n\n");
		previous.files = mergeConversationHistoryFiles(previous.files, message.files ?? []);
		return;
	}

	messages.push({ ...message });
}

function attachConversationHistoryFiles(
	messages: ConversationHistoryMessage[],
	files: readonly ChatHistoryFileBody[],
	createdAt: string,
	messageIndex: number,
): void {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.kind !== "assistant") {
			continue;
		}
		message.files = mergeConversationHistoryFiles(message.files, files);
		return;
	}

	messages.push({
		id: `session-message-file-${messageIndex}`,
		kind: "assistant",
		title: conversationTitleFromRole("assistant"),
		text: "",
		createdAt,
		files: mergeConversationHistoryFiles(undefined, files),
	});
}

function createBrowserCleanupScope(conversationId: string): string {
	return sanitizeStateId(conversationId);
}

async function runWithScopedAgentEnvironment<T>(scope: string, operation: () => Promise<T>): Promise<T> {
	const previousValues = {
		CLAUDE_AGENT_ID: process.env.CLAUDE_AGENT_ID,
		CLAUDE_HOOK_AGENT_ID: process.env.CLAUDE_HOOK_AGENT_ID,
		agent_id: process.env.agent_id,
	};
	process.env.CLAUDE_AGENT_ID = scope;
	process.env.CLAUDE_HOOK_AGENT_ID = scope;
	process.env.agent_id = scope;

	try {
		return await operation();
	} finally {
		restoreScopedAgentEnvironment("CLAUDE_AGENT_ID", previousValues.CLAUDE_AGENT_ID);
		restoreScopedAgentEnvironment("CLAUDE_HOOK_AGENT_ID", previousValues.CLAUDE_HOOK_AGENT_ID);
		restoreScopedAgentEnvironment("agent_id", previousValues.agent_id);
	}
}

function restoreScopedAgentEnvironment(
	key: "CLAUDE_AGENT_ID" | "CLAUDE_HOOK_AGENT_ID" | "agent_id",
	value: string | undefined,
): void {
	if (value === undefined) {
		delete process.env[key];
		return;
	}
	process.env[key] = value;
}

function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error("Unknown internal error");
}
