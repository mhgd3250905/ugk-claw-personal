import assert from "node:assert/strict";
import test from "node:test";
import { getPlaygroundConversationHistoryStoreScript } from "../src/ui/playground-conversation-history-store.js";

test("conversation history store exposes local history clone and persistence helpers", () => {
	const script = getPlaygroundConversationHistoryStoreScript();

	assert.match(script, /function getConversationHistoryStorageKey\(conversationId\)/);
	assert.match(script, /function readConversationHistoryIndex\(\)/);
	assert.match(script, /function writeConversationHistoryIndex\(index\)/);
	assert.match(script, /function cloneHistoryAttachments\(attachments\)/);
	assert.match(script, /function cloneHistoryAssetRefs\(assetRefs\)/);
	assert.match(script, /function cloneHistoryFiles\(files\)/);
	assert.match(script, /function loadConversationHistoryEntries\(conversationId\)/);
	assert.match(script, /function persistConversationHistory\(conversationId\)/);
	assert.match(script, /function scheduleConversationHistoryPersist\(conversationId\)/);
	assert.match(script, /function flushConversationHistoryPersist\(\)/);
	assert.match(script, /MAX_STORED_MESSAGES_PER_CONVERSATION/);
	assert.match(script, /MAX_STORED_CONVERSATIONS/);
	assert.match(script, /normalizeHistoryEntry/);
	assert.match(script, /isTransientNetworkHistoryEntry/);
});
