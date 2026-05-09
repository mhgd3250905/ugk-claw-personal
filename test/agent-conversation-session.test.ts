import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import {
	createEmptyConversation,
	ensureCurrentConversationId,
	openConversationSession,
	resolveDefaultModelContext,
} from "../src/agent/agent-conversation-session.js";
import { ConversationStore } from "../src/agent/conversation-store.js";
import type {
	AgentSessionFactory,
	AgentSessionLike,
	ProjectDefaultModelContext,
} from "../src/agent/agent-session-factory.js";

class FakeSessionFactory implements AgentSessionFactory {
	public calls: Array<{ conversationId: string; sessionFile?: string }> = [];
	public skillFingerprint?: string;
	public defaultModelContext?: ProjectDefaultModelContext;

	constructor(private readonly session: AgentSessionLike) {}

	async createSession(input: { conversationId: string; sessionFile?: string }): Promise<AgentSessionLike> {
		this.calls.push(input);
		return this.session;
	}

	async getSkillFingerprint(): Promise<string | undefined> {
		return this.skillFingerprint;
	}

	getDefaultModelContext(): ProjectDefaultModelContext {
		if (!this.defaultModelContext) {
			throw new Error("default model context is not configured");
		}
		return this.defaultModelContext;
	}
}

async function createStore(): Promise<ConversationStore> {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-conversation-session-"));
	return new ConversationStore(join(dir, "conversation-index.json"));
}

function createSession(sessionFile?: string): AgentSessionLike {
	return {
		sessionFile,
		messages: [],
		subscribe: () => () => undefined,
		prompt: async () => undefined,
	};
}

test("ensureCurrentConversationId returns the stored current conversation", async () => {
	const store = await createStore();
	await store.set("manual:current", "E:/sessions/current.jsonl");
	await store.setCurrentConversationId("manual:current");

	const result = await ensureCurrentConversationId({
		conversationStore: store,
		generateConversationId: () => "manual:new",
	});

	assert.equal(result, "manual:current");
	assert.equal(await store.get("manual:new"), undefined);
});

test("ensureCurrentConversationId promotes an existing conversation before creating a new one", async () => {
	const store = await createStore();
	await store.set("manual:existing", "E:/sessions/existing.jsonl");

	const result = await ensureCurrentConversationId({
		conversationStore: store,
		generateConversationId: () => "manual:new",
	});

	assert.equal(result, "manual:existing");
	assert.equal(await store.getCurrentConversationId(), "manual:existing");
	assert.equal(await store.get("manual:new"), undefined);
});

test("createEmptyConversation creates and activates a generated conversation id", async () => {
	const store = await createStore();

	const result = await createEmptyConversation({
		conversationStore: store,
		generateConversationId: () => "manual:created",
	});

	assert.equal(result, "manual:created");
	assert.equal(await store.getCurrentConversationId(), "manual:created");
	const created = await store.get("manual:created");
	assert.equal(created?.title, "新会话");
	assert.equal(created?.messageCount, 0);
});

test("ensureCurrentConversationId creates an empty current conversation when the store is empty", async () => {
	const store = await createStore();

	const result = await ensureCurrentConversationId({
		conversationStore: store,
		generateConversationId: () => "manual:new",
	});

	assert.equal(result, "manual:new");
	assert.equal(await store.getCurrentConversationId(), "manual:new");
	const created = await store.get("manual:new");
	assert.equal(created?.title, "新会话");
	assert.equal(created?.messageCount, 0);
});

test("openConversationSession reuses a stored session file and returns the skill fingerprint", async () => {
	const store = await createStore();
	await store.set("manual:existing", "E:/sessions/existing.jsonl");
	const factory = new FakeSessionFactory(createSession("E:/sessions/existing.jsonl"));
	factory.skillFingerprint = "skills-v2";

	const result = await openConversationSession({
		conversationId: "manual:existing",
		conversationStore: store,
		sessionFactory: factory,
	});

	assert.deepEqual(factory.calls, [
		{ conversationId: "manual:existing", sessionFile: "E:/sessions/existing.jsonl" },
	]);
	assert.equal(result.session.sessionFile, "E:/sessions/existing.jsonl");
	assert.equal(result.skillFingerprint, "skills-v2");
});

test("resolveDefaultModelContext uses the session factory value or the standard fallback", () => {
	const configuredFactory = new FakeSessionFactory(createSession());
	configuredFactory.defaultModelContext = {
		provider: "zhipu-glm",
		model: "glm-5.1",
		contextWindow: 128000,
		maxResponseTokens: 32768,
		reserveTokens: 16384,
	};
	const fallbackFactory: AgentSessionFactory = {
		createSession: async () => createSession(),
	};

	assert.deepEqual(resolveDefaultModelContext(configuredFactory), configuredFactory.defaultModelContext);
	assert.deepEqual(resolveDefaultModelContext(fallbackFactory), {
		provider: "unknown",
		model: "unknown",
		contextWindow: 128000,
		maxResponseTokens: 16384,
		reserveTokens: 16384,
	});
});
