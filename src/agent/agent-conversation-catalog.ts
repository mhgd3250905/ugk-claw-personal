import {
	buildConversationHistoryMessages,
	summarizeConversationText,
} from "./agent-conversation-history.js";
import type { ConversationListEntry } from "./conversation-store.js";
import type { AgentMessageLike } from "./context-usage.js";

export interface ConversationCatalogItemView {
	conversationId: string;
	title: string;
	preview: string;
	messageCount: number;
	createdAt: string;
	updatedAt: string;
	running: boolean;
	pinned: boolean;
	backgroundColor: string;
}

export interface ConversationCatalogView {
	currentConversationId: string;
	conversations: ConversationCatalogItemView[];
}

export interface BuildConversationCatalogInput {
	currentConversationId: string;
	entries: readonly ConversationListEntry[];
	runningConversationIds: ReadonlySet<string>;
}

export interface ConversationMetadata {
	title: string;
	preview: string;
	messageCount: number;
}

const EMPTY_CONVERSATION_TITLE = "新会话";

export function buildConversationCatalog(input: BuildConversationCatalogInput): ConversationCatalogView {
	const conversations = input.entries.map((entry) => ({
		conversationId: entry.conversationId,
		title: entry.title || EMPTY_CONVERSATION_TITLE,
		preview: entry.preview || "",
		messageCount: Number.isFinite(entry.messageCount) ? entry.messageCount ?? 0 : 0,
		createdAt: entry.createdAt ?? entry.updatedAt,
		updatedAt: entry.updatedAt,
		running: input.runningConversationIds.has(entry.conversationId),
		pinned: entry.pinned === true,
		backgroundColor: entry.backgroundColor || "",
	}));
	conversations.sort((left, right) => {
		if (left.pinned !== right.pinned) {
			return left.pinned ? -1 : 1;
		}
		return right.updatedAt.localeCompare(left.updatedAt);
	});

	return {
		currentConversationId: input.currentConversationId,
		conversations,
	};
}

export function buildConversationMetadata(messages: readonly AgentMessageLike[] | undefined): ConversationMetadata {
	const history = buildConversationHistoryMessages(messages ?? []);
	const firstUserMessage = history.find((message) => message.kind === "user");
	const lastMessage = history.at(-1);
	return {
		title: summarizeConversationText(firstUserMessage?.text, EMPTY_CONVERSATION_TITLE),
		preview: summarizeConversationText(lastMessage?.text, ""),
		messageCount: history.length,
	};
}

export function buildEmptyConversationMetadata(): ConversationMetadata {
	return {
		title: EMPTY_CONVERSATION_TITLE,
		preview: "",
		messageCount: 0,
	};
}
