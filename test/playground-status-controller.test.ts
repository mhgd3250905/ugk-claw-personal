import assert from "node:assert/strict";
import test from "node:test";
import { getPlaygroundStatusControllerScript } from "../src/ui/playground-status-controller.js";

test("status controller exposes loading, error, and command status helpers", () => {
	const script = getPlaygroundStatusControllerScript();

	assert.match(script, /function setStageMode\(next\)/);
	assert.match(script, /function setCommandStatus\(next\)/);
	assert.match(script, /function setLoading\(next\)/);
	assert.match(script, /function showError\(message\)/);
	assert.match(script, /function clearError\(\)/);
	assert.match(script, /function formatControlActionReason\(action, reason\)/);
	assert.match(script, /function getControlActionErrorMessage\(action, payload, fallbackMessage\)/);
	assert.match(script, /closeMobileOverflowMenu\(\)/);
	assert.match(script, /renderConversationDrawer\(\)/);
	assert.match(script, /statusPill\.textContent = next \? "运行中" : "就绪"/);
});

test("status controller keeps the asset library available during active runs", () => {
	const script = getPlaygroundStatusControllerScript();

	assert.match(script, /newConversationButton\.disabled = next \|\| state\.conversationCreatePending/);
	assert.match(script, /mobileNewConversationButton\.disabled = next \|\| state\.conversationCreatePending/);
	assert.match(script, /openAssetLibraryButton\.disabled = false/);
	assert.match(script, /mobileMenuLibraryButton\.disabled = false/);
	assert.match(script, /refreshAssetsButton\.disabled = false/);
	assert.doesNotMatch(script, /openAssetLibraryButton\.disabled = next/);
	assert.doesNotMatch(script, /mobileMenuLibraryButton\.disabled = next/);
	assert.doesNotMatch(script, /refreshAssetsButton\.disabled = next/);
});
