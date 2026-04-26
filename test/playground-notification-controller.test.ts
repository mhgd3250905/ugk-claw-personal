import assert from "node:assert/strict";
import test from "node:test";
import { getPlaygroundNotificationControllerScript } from "../src/ui/playground-notification-controller.js";

test("notification controller exposes toast and event normalization helpers", () => {
	const script = getPlaygroundNotificationControllerScript();

	assert.match(script, /function clearNotificationReconnectTimer\(\)/);
	assert.match(script, /function normalizeNotificationBroadcastEvent\(rawEvent\)/);
	assert.match(script, /function showNotificationToast\(event\)/);
	assert.match(script, /function removeNotificationToast\(toast\)/);
	assert.match(script, /notificationToastStack\.prepend\(toast\)/);
	assert.match(script, /notificationLiveRegion\.hidden = false/);
	assert.match(script, /notification\.conversationId === state\.conversationId/);
	assert.match(script, /window\.setTimeout\(\(\) => \{/);
});
