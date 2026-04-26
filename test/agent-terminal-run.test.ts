import assert from "node:assert/strict";
import test from "node:test";
import {
	buildTerminalRunSnapshot,
	buildRenderableTerminalRun,
	shouldPersistTerminalRun,
	type TerminalRunSnapshot,
} from "../src/agent/agent-terminal-run.js";
import { createActiveRunView } from "../src/agent/agent-active-run-view.js";
import type { ConversationHistoryMessage } from "../src/agent/agent-conversation-history.js";

function historyMessage(
	id: string,
	kind: ConversationHistoryMessage["kind"],
	text: string,
): ConversationHistoryMessage {
	return {
		id,
		kind,
		title: kind === "user" ? "agent:global" : "助手",
		text,
		createdAt: "2026-04-26T00:00:00.000Z",
	};
}

test("shouldPersistTerminalRun keeps only terminal active run statuses", () => {
	const view = createActiveRunView("manual:terminal", "hello", []);
	assert.equal(shouldPersistTerminalRun(view), false);

	view.status = "done";
	assert.equal(shouldPersistTerminalRun(view), true);
	view.status = "error";
	assert.equal(shouldPersistTerminalRun(view), true);
	view.status = "interrupted";
	assert.equal(shouldPersistTerminalRun(view), true);
});

test("buildTerminalRunSnapshot skips non-terminal active run views", () => {
	const view = createActiveRunView("manual:terminal", "hello", []);

	const snapshot = buildTerminalRunSnapshot({
		view,
		events: [],
		sessionMessages: [],
		historyMessageCountBeforeRun: 0,
		persistedTurnCoverage: null,
	});

	assert.equal(snapshot, undefined);
});

test("buildTerminalRunSnapshot clones terminal view and events with existing coverage", () => {
	const view = createActiveRunView("manual:terminal", "hello", []);
	view.loading = false;
	view.status = "done";
	view.text = "answer";
	const event = { type: "done" as const, conversationId: "manual:terminal", runId: view.runId, text: "answer" };
	const coverage = { inputCovered: true, assistantIndex: 3 };

	const snapshot = buildTerminalRunSnapshot({
		view,
		events: [event],
		sessionMessages: [],
		historyMessageCountBeforeRun: 0,
		persistedTurnCoverage: coverage,
	});

	assert.ok(snapshot);
	assert.notEqual(snapshot.view, view);
	assert.notEqual(snapshot.events[0], event);
	assert.deepEqual(snapshot.historyCoverage, coverage);
});

test("buildTerminalRunSnapshot derives fallback coverage from the run tail", () => {
	const view = createActiveRunView("manual:terminal", "hello", []);
	view.loading = false;
	view.status = "done";
	view.text = "answer";

	const snapshot = buildTerminalRunSnapshot({
		view,
		events: [],
		sessionMessages: [
			{ role: "user", content: "hello" },
			{ role: "assistant", content: "answer" },
		],
		historyMessageCountBeforeRun: 0,
		persistedTurnCoverage: null,
	});

	assert.deepEqual(snapshot?.historyCoverage, { inputCovered: true, assistantIndex: 1 });
});

test("buildRenderableTerminalRun hides repeated input echo and clones mutable data", () => {
	const view = createActiveRunView("manual:terminal", "hello", []);
	view.loading = false;
	view.status = "interrupted";
	view.text = "";
	const terminalRun: TerminalRunSnapshot = {
		view,
		events: [{ type: "interrupted", conversationId: "manual:terminal", runId: view.runId }],
		historyCoverage: { inputCovered: true, assistantIndex: -1 },
	};

	const renderable = buildRenderableTerminalRun({
		terminalRun,
		sessionMessages: [historyMessage("m1", "user", "hello")],
	});

	assert.ok(renderable);
	assert.equal(renderable.view.input.message, "");
	assert.notEqual(renderable.view, terminalRun.view);
	assert.notEqual(renderable.events, terminalRun.events);
	assert.notEqual(renderable.historyCoverage, terminalRun.historyCoverage);
});

test("buildRenderableTerminalRun skips terminal snapshots already covered by history", () => {
	const view = createActiveRunView("manual:terminal", "hello", []);
	view.loading = false;
	view.status = "done";
	view.text = "answer";

	const renderable = buildRenderableTerminalRun({
		terminalRun: {
			view,
			events: [{ type: "done", conversationId: "manual:terminal", runId: view.runId, text: "answer" }],
			historyCoverage: { inputCovered: true, assistantIndex: 1 },
		},
		sessionMessages: [
			historyMessage("m1", "user", "hello"),
			historyMessage("m2", "assistant", "answer"),
		],
	});

	assert.equal(renderable, undefined);
});
