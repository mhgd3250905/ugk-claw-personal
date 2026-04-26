import assert from "node:assert/strict";
import test from "node:test";
import {
	appendConversationHistoryMessage,
	attachConversationHistoryFiles,
	buildConversationViewMessages,
	derivePersistedTurnCoverageFromRunTail,
	paginateConversationHistoryMessages,
	shouldHideTerminalInputEcho,
	type ConversationHistoryMessage,
} from "../src/agent/agent-conversation-history.js";
import { createActiveRunView } from "../src/agent/agent-active-run-view.js";
import type { ChatAssetBody, ChatHistoryFileBody } from "../src/types/api.js";

function message(
	id: string,
	kind: ConversationHistoryMessage["kind"],
	text: string,
	overrides: Partial<ConversationHistoryMessage> = {},
): ConversationHistoryMessage {
	return {
		id,
		kind,
		title: kind === "user" ? "manual:thread" : "助手",
		text,
		createdAt: `2026-04-26T00:00:0${id.replace(/\D/g, "") || "0"}.000Z`,
		...overrides,
	};
}

function asset(overrides: Partial<ChatAssetBody> = {}): ChatAssetBody {
	return {
		assetId: "asset-1",
		reference: "@asset[asset-1]",
		fileName: "note.txt",
		mimeType: "text/plain",
		sizeBytes: 12,
		kind: "text",
		hasContent: true,
		source: "user_upload",
		conversationId: "manual:thread",
		createdAt: "2026-04-26T00:00:00.000Z",
		...overrides,
	};
}

function file(overrides: Partial<ChatHistoryFileBody> = {}): ChatHistoryFileBody {
	return {
		fileName: "report.md",
		downloadUrl: "/v1/files/file-1",
		mimeType: "text/markdown",
		sizeBytes: 24,
		...overrides,
	};
}

test("paginateConversationHistoryMessages returns a cloned bounded page", () => {
	const messages = [
		message("m1", "user", "one"),
		message("m2", "assistant", "two", { files: [file()] }),
		message("m3", "user", "three", { assetRefs: [asset()] }),
	];

	const page = paginateConversationHistoryMessages(messages, {
		before: "m3",
		limit: 1,
		defaultLimit: 80,
	});
	page.messages[0]!.files![0]!.fileName = "changed.md";

	assert.equal(page.startIndex, 1);
	assert.equal(page.hasMore, true);
	assert.equal(page.nextBefore, "m2");
	assert.deepEqual(page.messages.map((entry) => entry.id), ["m2"]);
	assert.equal(messages[1]!.files![0]!.fileName, "report.md");
});

test("buildConversationViewMessages reuses persisted active assistant instead of duplicating it", () => {
	const activeRun = createActiveRunView("manual:thread", "hello", []);
	activeRun.loading = false;
	activeRun.status = "done";
	activeRun.text = "answer";

	const viewMessages = buildConversationViewMessages("manual:thread", [
		message("m1", "user", "hello"),
		message("m2", "assistant", "answer"),
	], activeRun);

	assert.equal(viewMessages.length, 2);
	assert.equal(viewMessages[1]?.runId, activeRun.runId);
});

test("buildConversationViewMessages appends in-flight input and assistant snapshots", () => {
	const activeRun = createActiveRunView("manual:thread", "hello", [asset()]);
	activeRun.text = "partial";

	const viewMessages = buildConversationViewMessages("manual:thread", [], activeRun);

	assert.equal(viewMessages.length, 2);
	assert.equal(viewMessages[0]?.kind, "user");
	assert.deepEqual(viewMessages[0]?.assetRefs, [asset()]);
	assert.equal(viewMessages[1]?.id, activeRun.assistantMessageId);
	assert.equal(viewMessages[1]?.text, "partial");
});

test("appendConversationHistoryMessage coalesces consecutive assistant messages and files", () => {
	const messages = [message("m1", "assistant", "first", { files: [file()] })];

	appendConversationHistoryMessage(messages, message("m2", "assistant", "second", {
		files: [file({ fileName: "chart.png", downloadUrl: "/v1/files/file-2" })],
	}));

	assert.equal(messages.length, 1);
	assert.equal(messages[0]?.text, "first\n\nsecond");
	assert.deepEqual(messages[0]?.files?.map((entry) => entry.fileName), ["report.md", "chart.png"]);
});

test("attachConversationHistoryFiles attaches to the last assistant or creates a synthetic assistant", () => {
	const messages = [message("m1", "user", "hello")];
	attachConversationHistoryFiles(messages, [file()], "2026-04-26T00:00:00.000Z", 1);

	assert.equal(messages.length, 2);
	assert.equal(messages[1]?.kind, "assistant");
	assert.deepEqual(messages[1]?.files, [file()]);

	attachConversationHistoryFiles(messages, [file({ fileName: "extra.md", downloadUrl: "/v1/files/file-2" })], "ignored", 2);
	assert.deepEqual(messages[1]?.files?.map((entry) => entry.fileName), ["report.md", "extra.md"]);
});

test("derivePersistedTurnCoverageFromRunTail and echo hiding detect persisted active turns", () => {
	const activeRun = createActiveRunView("manual:thread", "hello", []);
	const messages = [
		message("m1", "system", "older"),
		message("m2", "user", "hello"),
		message("m3", "assistant", "answer"),
	];

	assert.deepEqual(derivePersistedTurnCoverageFromRunTail(messages, 1, activeRun), {
		inputCovered: true,
		assistantIndex: 2,
	});
	assert.equal(shouldHideTerminalInputEcho([message("m4", "user", "hello")], "hello"), true);
});
