import assert from "node:assert/strict";
import test from "node:test";
import { getPlaygroundConversationApiControllerScript } from "../src/ui/playground-conversation-api-controller.js";

test("conversation api controller exposes state, status, and history fetch helpers", () => {
	const script = getPlaygroundConversationApiControllerScript();

	assert.match(script, /async function fetchConversationRunStatus\(conversationId\)/);
	assert.match(script, /async function fetchConversationState\(conversationId, options\)/);
	assert.match(script, /async function fetchConversationHistoryPage\(conversationId, options\)/);
	assert.match(script, /\/v1\/chat\/status\?conversationId=/);
	assert.match(script, /\/v1\/chat\/state\?conversationId=/);
	assert.match(script, /\/v1\/chat\/history\?/);
	assert.match(script, /MAX_STORED_MESSAGES_PER_CONVERSATION/);
	assert.match(script, /normalizeContextUsage\(payload\?\.contextUsage\)/);
	assert.match(script, /normalizeActiveRun\(payload\?\.activeRun\)/);
});
