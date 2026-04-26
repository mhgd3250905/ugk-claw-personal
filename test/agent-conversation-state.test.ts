import assert from "node:assert/strict";
import test from "node:test";
import { createActiveRunView } from "../src/agent/agent-active-run-view.js";
import { buildConversationStatePage } from "../src/agent/agent-conversation-state.js";
import type { ConversationHistoryMessage } from "../src/agent/agent-conversation-history.js";

function historyMessage(
	id: string,
	kind: ConversationHistoryMessage["kind"],
	text: string,
): ConversationHistoryMessage {
	return {
		id,
		kind,
		title: kind === "user" ? "manual:state" : "助手",
		text,
		createdAt: `2026-04-26T00:00:0${id.replace(/\D/g, "") || "0"}.000Z`,
	};
}

test("buildConversationStatePage paginates canonical messages and reports older windows", () => {
	const page = buildConversationStatePage({
		conversationId: "manual:state",
		sessionMessages: [
			historyMessage("m1", "user", "one"),
			historyMessage("m2", "assistant", "two"),
			historyMessage("m3", "user", "three"),
		],
		viewLimit: 2,
		defaultLimit: 160,
		hasMoreBeforeWindow: true,
	});

	assert.deepEqual(page.messages.map((message) => message.id), ["m2", "m3"]);
	assert.deepEqual(page.viewMessages.map((message) => message.id), ["m2", "m3"]);
	assert.equal(page.activeRun, null);
	assert.deepEqual(page.historyPage, {
		hasMore: true,
		nextBefore: "m2",
		limit: 2,
	});
});

test("buildConversationStatePage uses persisted turn coverage to avoid duplicating completed active turns", () => {
	const activeRun = createActiveRunView("manual:state", "current question", []);
	activeRun.loading = false;
	activeRun.status = "done";
	activeRun.text = "current answer";

	const page = buildConversationStatePage({
		conversationId: "manual:state",
		sessionMessages: [
			historyMessage("m1", "user", "older"),
			historyMessage("m2", "user", "current question"),
			historyMessage("m3", "assistant", "current answer"),
		],
		activeRunView: activeRun,
		persistedTurnCoverage: {
			inputCovered: true,
			assistantIndex: 2,
		},
		viewLimit: 2,
		defaultLimit: 160,
		hasMoreBeforeWindow: false,
	});

	assert.deepEqual(page.messages.map((message) => message.id), ["m2", "m3"]);
	assert.deepEqual(page.viewMessages.map((message) => message.id), ["m2", "m3"]);
	assert.equal(page.viewMessages[1]?.runId, activeRun.runId);
	assert.equal(page.activeRun?.runId, activeRun.runId);
	assert.notEqual(page.activeRun, activeRun);
});

test("buildConversationStatePage falls back to terminal run view when there is no active run", () => {
	const terminalRun = createActiveRunView("manual:state", "terminal question", []);
	terminalRun.loading = false;
	terminalRun.status = "done";
	terminalRun.text = "terminal answer";

	const page = buildConversationStatePage({
		conversationId: "manual:state",
		sessionMessages: [],
		terminalRunView: terminalRun,
		persistedTurnCoverage: {
			inputCovered: false,
			assistantIndex: -1,
		},
		viewLimit: 10,
		defaultLimit: 160,
		hasMoreBeforeWindow: false,
	});

	assert.deepEqual(page.messages, []);
	assert.deepEqual(page.viewMessages.map((message) => message.id), [
		`active-input-${terminalRun.runId}`,
		terminalRun.assistantMessageId,
	]);
	assert.equal(page.activeRun?.status, "done");
	assert.notEqual(page.activeRun, terminalRun);
});
