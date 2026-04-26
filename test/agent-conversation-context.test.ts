import assert from "node:assert/strict";
import test from "node:test";
import {
	resolveConversationContextMessages,
	resolveConversationStateContext,
} from "../src/agent/agent-conversation-context.js";
import type {
	AgentSessionFactory,
	AgentSessionLike,
	RecentSessionMessagesInput,
	RecentSessionMessagesResult,
} from "../src/agent/agent-session-factory.js";

class FakeSessionFactory implements AgentSessionFactory {
	public createCalls: Array<{ conversationId: string; sessionFile?: string }> = [];
	public readCalls: string[] = [];
	public readRecentCalls: Array<{ sessionFile: string; input: RecentSessionMessagesInput }> = [];
	public persistedMessages = new Map<string, AgentSessionLike["messages"]>();
	public recentMessages = new Map<string, RecentSessionMessagesResult | undefined>();

	constructor(private readonly fallbackSession?: AgentSessionLike) {}

	async createSession(input: { conversationId: string; sessionFile?: string }): Promise<AgentSessionLike> {
		this.createCalls.push(input);
		return this.fallbackSession ?? {
			sessionFile: input.sessionFile,
			messages: [],
			subscribe: () => () => undefined,
			prompt: async () => undefined,
		};
	}

	async readSessionMessages(sessionFile: string): Promise<AgentSessionLike["messages"] | undefined> {
		this.readCalls.push(sessionFile);
		return this.persistedMessages.get(sessionFile);
	}

	async readRecentSessionMessages(
		sessionFile: string,
		input: RecentSessionMessagesInput,
	): Promise<RecentSessionMessagesResult | undefined> {
		this.readRecentCalls.push({ sessionFile, input });
		return this.recentMessages.get(sessionFile);
	}
}

test("resolveConversationContextMessages prefers active session messages", async () => {
	const factory = new FakeSessionFactory();
	const messages = [{ role: "user", content: "active" }];

	const result = await resolveConversationContextMessages({
		conversationId: "manual:active",
		activeSession: {
			messages,
			subscribe: () => () => undefined,
			prompt: async () => undefined,
		},
		sessionFactory: factory,
	});

	assert.deepEqual(result, messages);
	assert.deepEqual(factory.readCalls, []);
	assert.deepEqual(factory.createCalls, []);
});

test("resolveConversationContextMessages reads persisted messages before opening a session", async () => {
	const factory = new FakeSessionFactory();
	factory.persistedMessages.set("E:/sessions/idle.jsonl", [{ role: "assistant", content: "persisted" }]);

	const result = await resolveConversationContextMessages({
		conversationId: "manual:idle",
		sessionFile: "E:/sessions/idle.jsonl",
		sessionFactory: factory,
	});

	assert.deepEqual(result, [{ role: "assistant", content: "persisted" }]);
	assert.deepEqual(factory.readCalls, ["E:/sessions/idle.jsonl"]);
	assert.deepEqual(factory.createCalls, []);
});

test("resolveConversationStateContext uses recent idle windows with a context usage anchor", async () => {
	const factory = new FakeSessionFactory();
	factory.recentMessages.set("E:/sessions/recent.jsonl", {
		messages: [{ role: "user", content: "recent" }],
		contextMessages: [
			{ role: "system", content: "anchor" },
			{ role: "user", content: "recent" },
		],
		messageIndexOffset: 40,
		reachedStart: false,
	});

	const result = await resolveConversationStateContext({
		conversationId: "manual:recent",
		sessionFile: "E:/sessions/recent.jsonl",
		sessionFactory: factory,
		viewLimit: 2000,
		defaultViewLimit: 160,
	});

	assert.deepEqual(result.historyMessages, [{ role: "user", content: "recent" }]);
	assert.deepEqual(result.contextUsageMessages, [
		{ role: "system", content: "anchor" },
		{ role: "user", content: "recent" },
	]);
	assert.equal(result.messageIndexOffset, 40);
	assert.equal(result.hasMoreBeforeWindow, true);
	assert.equal(factory.readRecentCalls[0]?.input.limit, 500);
	assert.equal(factory.readRecentCalls[0]?.input.includeContextUsageAnchor, true);
	assert.deepEqual(factory.readCalls, []);
});
