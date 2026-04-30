import assert from "node:assert/strict";
import test from "node:test";
import { getPlaygroundHistoryPaginationControllerScript } from "../src/ui/playground-history-pagination-controller.js";

test("history pagination controller exposes older history loading helpers", () => {
	const script = getPlaygroundHistoryPaginationControllerScript();

	assert.match(script, /function hasOlderConversationHistory\(\)/);
	assert.match(script, /function syncHistoryAutoLoadStatus\(\)/);
	assert.match(script, /async function fetchOlderConversationHistoryFromServer\(\)/);
	assert.match(script, /async function renderMoreConversationHistory\(\)/);
	assert.match(script, /fetchConversationHistoryPage\(conversationId/);
	assert.match(script, /renderTranscriptEntry\(entry, "prepend"\)/);
	assert.match(script, /transcript\.scrollTop \+= heightDelta/);
	assert.match(script, /state\.historyLoadingMore = false/);
	assert.match(script, /const previousHeight = transcript\.scrollHeight/);
	assert.match(script, /state\.historyHasMore = Boolean\(page\.hasMore\)/);
	assert.match(script, /state\.historyNextBefore = typeof page\.nextBefore === "string" \? page\.nextBefore : ""/);
	assert.match(script, /state\.conversationHistory = olderEntries\.concat\(state\.conversationHistory\)/);
	assert.doesNotMatch(script, /clearRenderedTranscript\(\)/);
});
