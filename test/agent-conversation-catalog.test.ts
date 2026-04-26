import assert from "node:assert/strict";
import test from "node:test";
import {
	buildConversationCatalog,
	buildConversationMetadata,
	buildEmptyConversationMetadata,
} from "../src/agent/agent-conversation-catalog.js";
import { buildPromptWithAssetContext } from "../src/agent/file-artifacts.js";

test("buildConversationCatalog maps entries with stable fallbacks and running flags", () => {
	const catalog = buildConversationCatalog({
		currentConversationId: "manual:newer",
		entries: [
			{
				conversationId: "manual:older",
				updatedAt: "2026-04-25T00:00:00.000Z",
				title: "",
				preview: undefined,
				messageCount: Number.NaN,
			},
			{
				conversationId: "manual:newer",
				updatedAt: "2026-04-26T00:00:00.000Z",
				createdAt: "2026-04-24T00:00:00.000Z",
				title: "Newer",
				preview: "latest",
				messageCount: 2,
			},
		],
		runningConversationIds: new Set(["manual:older"]),
	});

	assert.equal(catalog.currentConversationId, "manual:newer");
	assert.deepEqual(catalog.conversations.map((conversation) => conversation.conversationId), [
		"manual:newer",
		"manual:older",
	]);
	assert.deepEqual(catalog.conversations[0], {
		conversationId: "manual:newer",
		title: "Newer",
		preview: "latest",
		messageCount: 2,
		createdAt: "2026-04-24T00:00:00.000Z",
		updatedAt: "2026-04-26T00:00:00.000Z",
		running: false,
	});
	assert.deepEqual(catalog.conversations[1], {
		conversationId: "manual:older",
		title: "新会话",
		preview: "",
		messageCount: 0,
		createdAt: "2026-04-25T00:00:00.000Z",
		updatedAt: "2026-04-25T00:00:00.000Z",
		running: true,
	});
});

test("buildConversationMetadata summarizes canonical user and latest messages", () => {
	const metadata = buildConversationMetadata([
		{
			role: "user",
			content: buildPromptWithAssetContext("请帮我整理一份很长很长很长很长很长很长的项目计划"),
		},
		{
			role: "assistant",
			content: [{ type: "text", text: "计划已整理" }],
		},
	]);

	assert.equal(metadata.title, "请帮我整理一份很长很长很长很长很长很长的项目计划");
	assert.equal(metadata.preview, "计划已整理");
	assert.equal(metadata.messageCount, 2);
});

test("buildEmptyConversationMetadata returns the standard empty conversation shape", () => {
	assert.deepEqual(buildEmptyConversationMetadata(), {
		title: "新会话",
		preview: "",
		messageCount: 0,
	});
});
