import assert from "node:assert/strict";
import test from "node:test";
import { getPlaygroundWorkspaceControllerScript } from "../src/ui/playground-workspace-controller.js";

test("workspace controller enables the back-to-chat button during active runs", () => {
	const script = getPlaygroundWorkspaceControllerScript();

	assert.match(script, /function syncBackToChatButton\(\)/);
	assert.match(script, /const inWorkspace = state\.workspaceMode !== "chat"/);
	assert.match(script, /newConversationButton\.disabled = false/);
	assert.match(
		script,
		/newConversationButton\.disabled = state\.loading \|\| state\.conversationCreatePending/,
	);
});
