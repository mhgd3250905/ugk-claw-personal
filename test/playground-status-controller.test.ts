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
