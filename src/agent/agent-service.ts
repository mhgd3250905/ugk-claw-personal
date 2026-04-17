import { randomUUID } from "node:crypto";
import { ConversationStore } from "./conversation-store.js";
import type {
	AgentSessionEventLike,
	AgentSessionFactory,
	AgentSessionLike,
	MessageUpdateEventLike,
	ToolExecutionEndEventLike,
	ToolExecutionStartEventLike,
	ToolExecutionUpdateEventLike,
} from "./agent-session-factory.js";
import type { ChatStreamEvent } from "../types/api.js";

export interface ChatInput {
	conversationId?: string;
	message: string;
	userId?: string;
}

export interface ChatResult {
	conversationId: string;
	text: string;
	sessionFile?: string;
}

export interface QueueMessageInput {
	conversationId: string;
	message: string;
	mode: "steer" | "followUp";
	userId?: string;
}

export interface QueueMessageResult {
	conversationId: string;
	mode: "steer" | "followUp";
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

export interface RuntimeSkillInfo {
	name: string;
	path?: string;
}

export interface AgentServiceOptions {
	conversationStore: ConversationStore;
	sessionFactory: AgentSessionFactory;
}

export class AgentService {
	private readonly activeRuns = new Map<
		string,
		{
			session: AgentSessionLike;
			interrupted: boolean;
		}
	>();

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

		await activeRun.session.prompt(input.message, {
			streamingBehavior: input.mode,
		});

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

	private async runChat(
		input: ChatInput,
		onEvent?: (event: ChatStreamEvent) => void,
	): Promise<ChatResult> {
		const conversationId = input.conversationId ?? `manual:${randomUUID()}`;
		const { session, skillFingerprint } = await this.openSession(conversationId);
		if (this.activeRuns.has(conversationId)) {
			throw new Error(`Conversation ${conversationId} is already running`);
		}
		const activeRun = {
			session,
			interrupted: false,
		};
		this.activeRuns.set(conversationId, activeRun);

		onEvent?.({
			type: "run_started",
			conversationId,
		});

		let text = "";
		const unsubscribe = session.subscribe((event) => {
			switch (event.type) {
				case "message_update":
					text = this.handleMessageUpdate(event as MessageUpdateEventLike, text, onEvent);
					break;
				case "tool_execution_start":
					onEvent?.(this.handleToolExecutionStart(event as ToolExecutionStartEventLike));
					break;
				case "tool_execution_update":
					onEvent?.(this.handleToolExecutionUpdate(event as ToolExecutionUpdateEventLike));
					break;
				case "tool_execution_end":
					onEvent?.(this.handleToolExecutionEnd(event as ToolExecutionEndEventLike));
					break;
				case "queue_update":
					onEvent?.({
						type: "queue_updated",
						steering: (event as AgentSessionEventLike & { type: "queue_update" }).steering,
						followUp: (event as AgentSessionEventLike & { type: "queue_update" }).followUp,
					});
					break;
				default:
					break;
			}
		});

		try {
			await session.prompt(input.message);
		} finally {
			unsubscribe();
			if (this.activeRuns.get(conversationId) === activeRun) {
				this.activeRuns.delete(conversationId);
			}
		}

		const lastAssistantMessage = [...(session.messages ?? [])].reverse().find((message) => message.role === "assistant");
		if (lastAssistantMessage?.stopReason === "error") {
			throw new Error(lastAssistantMessage.errorMessage ?? "Unknown upstream provider error");
		}

		if (!text) {
			text = this.extractAssistantText(lastAssistantMessage);
		}

		if (session.sessionFile) {
			await this.options.conversationStore.set(conversationId, session.sessionFile, {
				skillFingerprint,
			});
		}

		if (activeRun.interrupted) {
			onEvent?.({
				type: "interrupted",
				conversationId,
			});
		}

		const result: ChatResult = {
			conversationId,
			text,
			sessionFile: session.sessionFile,
		};

		onEvent?.({
			type: "done",
			conversationId: result.conversationId,
			text: result.text,
			sessionFile: result.sessionFile,
		});

		return result;
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
		onEvent?.({
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
