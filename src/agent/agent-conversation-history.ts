import type { ChatActiveRunBody, ChatAssetBody, ChatHistoryFileBody } from "../types/api.js";
import type { AgentMessageLike } from "./context-usage.js";
import {
	extractConversationHistoryFiles,
	mergeConversationHistoryFiles,
} from "./agent-file-history.js";
import { extractAssistantText } from "./agent-process-text.js";
import {
	rewriteUserVisibleLocalArtifactLinks,
	stripInternalPromptContext,
} from "./file-artifacts.js";

const MAX_CONVERSATION_HISTORY_PAGE_LIMIT = 500;

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

export interface PersistedTurnCoverage {
	inputCovered: boolean;
	assistantIndex: number;
}

export interface ConversationHistoryPaginationInput {
	limit?: number;
	before?: string;
	defaultLimit: number;
}

export interface ConversationHistoryPage {
	messages: ConversationHistoryMessage[];
	startIndex: number;
	hasMore: boolean;
	nextBefore?: string;
	limit: number;
}

export function conversationTitleFromRole(kind: "user" | "assistant" | "system" | "error"): string {
	return kind === "user" ? "agent:global" : "助手";
}

export function shouldExposeTerminalRunSnapshot(
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

export function buildConversationHistoryMessages(
	messages: readonly AgentMessageLike[],
	activeRunView?: ChatActiveRunBody,
	messageIndexOffset = 0,
): ConversationHistoryMessage[] {
	const coalescedMessages: ConversationHistoryMessage[] = [];
	messages.forEach((message, index) => {
		const messageIndex = messageIndexOffset + index;
		const normalizedMessage = toConversationHistoryMessage(message, messageIndex);
		if (normalizedMessage) {
			appendConversationHistoryMessage(coalescedMessages, normalizedMessage);
		}

		const files = extractConversationHistoryFiles(message);
		if (files) {
			attachConversationHistoryFiles(coalescedMessages, files, resolveConversationMessageCreatedAt(message), messageIndex + 1);
		}
	});

	if (!activeRunView?.loading) {
		return coalescedMessages;
	}

	return omitTrailingActiveUserMessage(coalescedMessages, activeRunView.input.message);
}

export function buildConversationViewMessages(
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

export function cloneConversationHistoryMessage(message: ConversationHistoryMessage): ConversationHistoryMessage {
	return {
		...message,
		...(message.assetRefs ? { assetRefs: message.assetRefs.map((asset) => ({ ...asset })) } : {}),
		...(message.files ? { files: message.files.map((file) => ({ ...file })) } : {}),
	};
}

export function paginateConversationHistoryMessages(
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

export function normalizeConversationHistoryLimit(limit: number | undefined, defaultLimit: number): number {
	if (typeof limit !== "number" || !Number.isFinite(limit)) {
		return defaultLimit;
	}

	return Math.min(MAX_CONVERSATION_HISTORY_PAGE_LIMIT, Math.max(1, Math.floor(limit)));
}

export function shiftPersistedTurnCoverageToPage(
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

export function derivePersistedTurnCoverageFromRunTail(
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

export function resolveConversationMessageCreatedAt(message: AgentMessageLike): string {
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

export function shouldHideTerminalInputEcho(
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

export function summarizeConversationText(value: string | undefined, fallback: string): string {
	const compact = String(value ?? "")
		.replace(/\s+/g, " ")
		.trim();
	if (!compact) {
		return fallback;
	}

	return compact.length > 48 ? compact.slice(0, 48).trimEnd() + "..." : compact;
}

export function omitTrailingActiveUserMessage(
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

export function appendConversationHistoryMessage(
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

export function attachConversationHistoryFiles(
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

function toConversationHistoryMessage(
	message: AgentMessageLike,
	index: number,
): ConversationHistoryMessage | undefined {
	const role = typeof message.role === "string" ? message.role : "";
	if (role !== "user" && role !== "assistant" && role !== "system") {
		return undefined;
	}

	const extractedText = extractMessageText(message);
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

function extractMessageText(message: AgentMessageLike): string {
	if (message.role === "assistant") {
		return extractAssistantText(message);
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

function normalizeComparableMessageText(value: string | undefined): string {
	return String(value ?? "")
		.replace(/\s+/g, " ")
		.trim();
}
