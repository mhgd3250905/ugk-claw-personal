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
	assert.match(script, /nextTranscriptSignature === state\.renderedConversationStateSignature/);
	assert.match(script, /let shouldRenderTranscript = true/);
	assert.match(script, /shouldRenderTranscript = false/);
	assert.match(script, /const preservedTranscriptScrollTop = shouldPreserveTranscriptViewport \? transcript\.scrollTop : null/);
	assert.match(script, /transcript\.scrollTop = Math\.min\(preservedTranscriptScrollTop, maxScrollTop\)/);
	assert.match(script, /state\.autoFollowTranscript = false/);
	assert.match(script, /syncHistoryAutoLoadStatus\(\);\s*scrollTranscriptToBottom\(\);/);
	assert.doesNotMatch(script, /scrollTranscriptToBottom\(\{\s*force:\s*true\s*\}\)/);
	assert.match(script, /setAssistantLoadingState\("\\\\u5f53\\\\u524d\\\\u6b63\\\\u5728\\\\u8fd0\\\\u884c", "system"\)/);
	assert.doesNotMatch(script, /上一轮仍在运行/);
});
