import assert from "node:assert/strict";
import test from "node:test";
import { getPlaygroundConversationSyncControllerScript } from "../src/ui/playground-conversation-sync-controller.js";

test("conversation sync controller exposes ownership token helpers", () => {
	const script = getPlaygroundConversationSyncControllerScript();

	assert.match(script, /function abortConversationStateSync\(\)/);
	assert.match(script, /function releaseConversationStateSyncToken\(syncToken\)/);
	assert.match(script, /function isConversationStateAbortError\(error\)/);
	assert.match(script, /function invalidateConversationSyncOwnership\(nextConversationId\)/);
	assert.match(script, /function issueConversationSyncToken\(conversationId\)/);
	assert.match(script, /function isConversationSyncTokenCurrent\(syncToken, conversationId\)/);
	assert.match(script, /function shouldApplyConversationState\(conversationState, syncToken\)/);
	assert.match(script, /function reconcileSyncedConversationState\(payload, conversationId, options\)/);
	assert.match(script, /attachActiveRunEventStream\(nextConversationId\)/);
	assert.match(script, /state\.conversationSyncGeneration/);
});
