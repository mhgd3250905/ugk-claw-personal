import { cloneActiveRunView } from "./agent-active-run-view.js";
import {
	buildConversationHistoryMessages,
	derivePersistedTurnCoverageFromRunTail,
	shouldExposeTerminalRunSnapshot,
	shouldHideTerminalInputEcho,
	type ConversationHistoryMessage,
	type PersistedTurnCoverage,
} from "./agent-conversation-history.js";
import { cloneChatStreamEvent } from "./agent-run-events.js";
import type { ChatActiveRunBody, ChatStreamEvent } from "../types/api.js";
import type { AgentMessageLike } from "./context-usage.js";

export interface TerminalRunSnapshot {
	view: ChatActiveRunBody;
	events: ChatStreamEvent[];
	historyCoverage: PersistedTurnCoverage;
}

export interface BuildRenderableTerminalRunInput {
	terminalRun: TerminalRunSnapshot | undefined;
	sessionMessages: readonly ConversationHistoryMessage[];
}

export interface BuildTerminalRunSnapshotInput {
	view: ChatActiveRunBody;
	events: readonly ChatStreamEvent[];
	sessionMessages: readonly AgentMessageLike[];
	historyMessageCountBeforeRun: number;
	persistedTurnCoverage: PersistedTurnCoverage | null;
}

export function shouldPersistTerminalRun(view: ChatActiveRunBody): boolean {
	return view.status === "done" || view.status === "error" || view.status === "interrupted";
}

export function buildTerminalRunSnapshot(
	input: BuildTerminalRunSnapshotInput,
): TerminalRunSnapshot | undefined {
	if (!shouldPersistTerminalRun(input.view)) {
		return undefined;
	}

	const finalSessionMessages = buildConversationHistoryMessages(input.sessionMessages);
	return {
		view: cloneActiveRunView(input.view),
		events: input.events.map(cloneChatStreamEvent),
		historyCoverage:
			input.persistedTurnCoverage ??
			derivePersistedTurnCoverageFromRunTail(
				finalSessionMessages,
				input.historyMessageCountBeforeRun,
				input.view,
			),
	};
}

export function buildRenderableTerminalRun(
	input: BuildRenderableTerminalRunInput,
): TerminalRunSnapshot | undefined {
	if (!input.terminalRun) {
		return undefined;
	}

	if (!shouldExposeTerminalRunSnapshot(input.sessionMessages, input.terminalRun.view)) {
		return undefined;
	}

	const view = cloneActiveRunView(input.terminalRun.view);
	if (shouldHideTerminalInputEcho(input.sessionMessages, view.input.message)) {
		view.input.message = "";
	}

	return {
		view,
		events: input.terminalRun.events.map(cloneChatStreamEvent),
		historyCoverage: { ...input.terminalRun.historyCoverage },
	};
}
