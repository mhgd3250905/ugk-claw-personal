import assert from "node:assert/strict";
import test from "node:test";
import { getPlaygroundConversationStateControllerScript } from "../src/ui/playground-conversation-state-controller.js";

test("conversation state controller owns canonical state render and restore helpers", () => {
	const script = getPlaygroundConversationStateControllerScript();

	assert.match(script, /async function syncConversationRunState\(conversationId, options\)/);
	assert.match(script, /function renderConversationState\(conversationState, syncToken\)/);
	assert.match(script, /function findRenderedAssistantForActiveRun\(activeRun\)/);
	assert.match(script, /function restoreConversationHistory\(conversationId\)/);
	assert.match(script, /async function restoreConversationHistoryFromServer\(conversationId, options\)/);
	assert.match(script, /buildConversationStateSignature\(state\.conversationState\)/);
	assert.match(script, /syncRenderedConversationHistory\(state\.conversationHistory\)/);
	assert.match(script, /renderMoreConversationHistory\(\)/);
	assert.match(script, /applyProcessViewToRenderedMessage\(activeRun\.process, rendered/);
});
