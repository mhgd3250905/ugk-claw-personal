import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConversationStore } from "../src/agent/conversation-store.js";
import {
	createConversationCommand,
	deleteConversationCommand,
	resetConversationCommand,
	switchConversationCommand,
} from "../src/agent/agent-conversation-commands.js";

async function createStore(): Promise<ConversationStore> {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-conversation-commands-"));
	return new ConversationStore(join(dir, "conversation-index.json"));
}

test("createConversationCommand creates and activates a new conversation while idle", async () => {
	const store = await createStore();

	const result = await createConversationCommand({
		conversationStore: store,
		hasActiveRun: false,
		generateConversationId: () => "manual:new",
	});

	assert.deepEqual(result, {
		conversationId: "manual:new",
		currentConversationId: "manual:new",
		created: true,
	});
	assert.equal(await store.getCurrentConversationId(), "manual:new");
	assert.notEqual(await store.get("manual:new"), undefined);
});

test("createConversationCommand refuses to create while any run is active", async () => {
	const store = await createStore();
	await store.set("manual:busy", "E:/sessions/busy.jsonl");
	await store.setCurrentConversationId("manual:busy");

	const result = await createConversationCommand({
		conversationStore: store,
		hasActiveRun: true,
	});

	assert.deepEqual(result, {
		conversationId: "manual:busy",
		currentConversationId: "manual:busy",
		created: false,
		reason: "running",
	});
	assert.equal(await store.getCurrentConversationId(), "manual:busy");
});

test("switchConversationCommand activates an existing conversation and rejects missing ones", async () => {
	const store = await createStore();
	await store.set("manual:older", "E:/sessions/older.jsonl");
	await store.set("manual:newer", "E:/sessions/newer.jsonl");
	await store.setCurrentConversationId("manual:newer");

	assert.deepEqual(await switchConversationCommand({
		conversationStore: store,
		conversationId: "manual:older",
		hasActiveRun: false,
	}), {
		conversationId: "manual:older",
		currentConversationId: "manual:older",
		switched: true,
	});
	assert.equal(await store.getCurrentConversationId(), "manual:older");

	assert.deepEqual(await switchConversationCommand({
		conversationStore: store,
		conversationId: "manual:missing",
		hasActiveRun: false,
	}), {
		conversationId: "manual:missing",
		currentConversationId: "manual:older",
		switched: false,
		reason: "not_found",
	});
	assert.equal(await store.getCurrentConversationId(), "manual:older");
});

test("deleteConversationCommand removes conversations and requests terminal run cleanup", async () => {
	const store = await createStore();
	await store.set("manual:older", "E:/sessions/older.jsonl");
	await store.set("manual:newer", "E:/sessions/newer.jsonl");
	await store.setCurrentConversationId("manual:newer");
	const deletedTerminalRuns: string[] = [];

	const result = await deleteConversationCommand({
		conversationStore: store,
		conversationId: "manual:newer",
		hasActiveRun: false,
		deleteTerminalRun: (conversationId) => {
			deletedTerminalRuns.push(conversationId);
		},
	});

	assert.deepEqual(result, {
		conversationId: "manual:newer",
		currentConversationId: "manual:older",
		deleted: true,
	});
	assert.equal(await store.get("manual:newer"), undefined);
	assert.equal(await store.getCurrentConversationId(), "manual:older");
	assert.deepEqual(deletedTerminalRuns, ["manual:newer"]);
});

test("resetConversationCommand refuses active runs and clears idle conversation state", async () => {
	const store = await createStore();
	await store.set("manual:reset", "E:/sessions/reset.jsonl");
	const deletedTerminalRuns: string[] = [];

	assert.deepEqual(await resetConversationCommand({
		conversationStore: store,
		conversationId: "manual:reset",
		hasActiveRun: true,
		deleteTerminalRun: (conversationId) => {
			deletedTerminalRuns.push(conversationId);
		},
	}), {
		conversationId: "manual:reset",
		reset: false,
		reason: "running",
	});
	assert.notEqual(await store.get("manual:reset"), undefined);
	assert.equal(deletedTerminalRuns.length, 0);

	assert.deepEqual(await resetConversationCommand({
		conversationStore: store,
		conversationId: "manual:reset",
		hasActiveRun: false,
		deleteTerminalRun: (conversationId) => {
			deletedTerminalRuns.push(conversationId);
		},
	}), {
		conversationId: "manual:reset",
		reset: true,
	});
	assert.equal(await store.get("manual:reset"), undefined);
	assert.deepEqual(deletedTerminalRuns, ["manual:reset"]);
});
