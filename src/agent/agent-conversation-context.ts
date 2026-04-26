import {
	normalizeConversationHistoryLimit,
} from "./agent-conversation-history.js";
import type {
	AgentSessionFactory,
	AgentSessionLike,
	AgentSessionMessageLike,
} from "./agent-session-factory.js";
import type { AgentMessageLike } from "./context-usage.js";

export interface ResolveConversationContextMessagesInput {
	conversationId: string;
	activeSession?: AgentSessionLike;
	sessionFile?: string;
	sessionFactory: AgentSessionFactory;
}

export interface ResolveConversationStateContextInput extends ResolveConversationContextMessagesInput {
	forceFullContext?: boolean;
	viewLimit?: number;
	defaultViewLimit: number;
}

export interface ConversationStateContextMessages {
	historyMessages: AgentMessageLike[];
	contextUsageMessages: AgentMessageLike[];
	messageIndexOffset: number;
	hasMoreBeforeWindow: boolean;
}

export async function resolveConversationContextMessages(
	input: ResolveConversationContextMessagesInput,
): Promise<AgentMessageLike[]> {
	if (input.activeSession) {
		return toAgentMessages(input.activeSession.messages);
	}

	if (!input.sessionFile) {
		return [];
	}

	const persistedMessages = await input.sessionFactory.readSessionMessages?.(input.sessionFile);
	if (persistedMessages) {
		return toAgentMessages(persistedMessages);
	}

	const session = await input.sessionFactory.createSession({
		conversationId: input.conversationId,
		sessionFile: input.sessionFile,
	});
	return toAgentMessages(session.messages);
}

export async function resolveConversationStateContext(
	input: ResolveConversationStateContextInput,
): Promise<ConversationStateContextMessages> {
	if (input.activeSession || input.forceFullContext) {
		const messages = await resolveConversationContextMessages(input);
		return buildFullStateContext(messages);
	}

	if (!input.sessionFile) {
		return buildFullStateContext([]);
	}

	if (input.sessionFactory.readRecentSessionMessages) {
		const limit = normalizeConversationHistoryLimit(input.viewLimit, input.defaultViewLimit);
		const recentMessages = await input.sessionFactory.readRecentSessionMessages(input.sessionFile, {
			limit,
			includeContextUsageAnchor: true,
		});
		if (recentMessages) {
			return {
				historyMessages: toAgentMessages(recentMessages.messages),
				contextUsageMessages: toAgentMessages(recentMessages.contextMessages),
				messageIndexOffset: recentMessages.messageIndexOffset,
				hasMoreBeforeWindow: !recentMessages.reachedStart,
			};
		}
	}

	const messages = await resolveConversationContextMessages(input);
	return buildFullStateContext(messages);
}

function buildFullStateContext(messages: AgentMessageLike[]): ConversationStateContextMessages {
	return {
		historyMessages: messages,
		contextUsageMessages: messages,
		messageIndexOffset: 0,
		hasMoreBeforeWindow: false,
	};
}

function toAgentMessages(messages: readonly AgentSessionMessageLike[] | undefined): AgentMessageLike[] {
	return ((messages as AgentMessageLike[] | undefined) ?? []);
}
