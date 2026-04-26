import { cloneActiveRunView } from "./agent-active-run-view.js";
import {
	buildConversationViewMessages,
	paginateConversationHistoryMessages,
	shiftPersistedTurnCoverageToPage,
	type ConversationHistoryMessage,
	type PersistedTurnCoverage,
} from "./agent-conversation-history.js";
import type { ChatActiveRunBody, ConversationStateResponseBody } from "../types/api.js";

export interface ConversationStatePageInput {
	conversationId: string;
	sessionMessages: readonly ConversationHistoryMessage[];
	activeRunView?: ChatActiveRunBody | null;
	terminalRunView?: ChatActiveRunBody | null;
	persistedTurnCoverage?: PersistedTurnCoverage | null;
	viewLimit?: number;
	defaultLimit: number;
	hasMoreBeforeWindow: boolean;
}

export interface ConversationStatePageResult {
	messages: ConversationHistoryMessage[];
	viewMessages: ConversationHistoryMessage[];
	activeRun: ChatActiveRunBody | null;
	historyPage: ConversationStateResponseBody["historyPage"];
}

export function buildConversationStatePage(input: ConversationStatePageInput): ConversationStatePageResult {
	const historyPage = paginateConversationHistoryMessages(input.sessionMessages, {
		limit: input.viewLimit,
		defaultLimit: input.defaultLimit,
	});
	const activeRunView = input.activeRunView
		? cloneActiveRunView(input.activeRunView)
		: input.terminalRunView
			? cloneActiveRunView(input.terminalRunView)
			: null;
	const persistedTurnCoverage = shiftPersistedTurnCoverageToPage(
		input.persistedTurnCoverage,
		historyPage.startIndex,
		historyPage.messages.length,
	);
	const hasMoreHistory = historyPage.hasMore || input.hasMoreBeforeWindow;
	const viewMessages = buildConversationViewMessages(
		input.conversationId,
		historyPage.messages,
		activeRunView,
		persistedTurnCoverage,
	);

	return {
		messages: historyPage.messages,
		viewMessages,
		activeRun: activeRunView,
		historyPage: {
			hasMore: hasMoreHistory,
			nextBefore: hasMoreHistory ? historyPage.messages[0]?.id : undefined,
			limit: historyPage.limit,
		},
	};
}
