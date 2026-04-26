import { cloneActiveRunView } from "./agent-active-run-view.js";
import {
	shouldExposeTerminalRunSnapshot,
	shouldHideTerminalInputEcho,
	type ConversationHistoryMessage,
	type PersistedTurnCoverage,
} from "./agent-conversation-history.js";
import { cloneChatStreamEvent } from "./agent-run-events.js";
import type { ChatActiveRunBody, ChatStreamEvent } from "../types/api.js";

export interface TerminalRunSnapshot {
	view: ChatActiveRunBody;
	events: ChatStreamEvent[];
	historyCoverage: PersistedTurnCoverage;
}

export interface BuildRenderableTerminalRunInput {
	terminalRun: TerminalRunSnapshot | undefined;
	sessionMessages: readonly ConversationHistoryMessage[];
}

export function shouldPersistTerminalRun(view: ChatActiveRunBody): boolean {
	return view.status === "done" || view.status === "error" || view.status === "interrupted";
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
