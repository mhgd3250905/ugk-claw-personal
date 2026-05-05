import test from "node:test";
import assert from "node:assert/strict";
import { getConnActivityEditorScript } from "../src/ui/playground-conn-activity-controller.js";

test("conn editor asset uploads use conn-scoped asset ownership instead of current conversation", () => {
	const script = getConnActivityEditorScript();

	assert.match(script, /connAssetConversationId/);
	assert.match(script, /"conn:" \+ state\.connEditorConnId/);
	assert.match(script, /"conn:draft"/);
	assert.doesNotMatch(script, /conversationId: state\.conversationId/);
});
