import assert from "node:assert/strict";
import test from "node:test";
import { getPlaygroundContextUsageControllerScript } from "../src/ui/playground-context-usage-controller.js";

test("context usage controller owns toggle and sync helpers", () => {
	const script = getPlaygroundContextUsageControllerScript();

	assert.match(script, /function toggleContextUsageDetails\(\)/);
	assert.match(script, /async function syncContextUsage\(conversationId, options\)/);
	assert.match(script, /fetchConversationRunStatus\(nextConversationId\)/);
	assert.match(script, /normalizeContextUsage\(payload\.contextUsage\)/);
	assert.match(script, /renderContextUsageBar\(\)/);
	assert.match(script, /openContextUsageDialog\(\)/);
});

test("context usage click only opens the persistent dialog on mobile surfaces", () => {
	const script = getPlaygroundContextUsageControllerScript();

	assert.match(
		script,
		/function toggleContextUsageDetails\(\)\s*\{[\s\S]*if \(isMobileContextUsageSurface\(\)\) \{[\s\S]*openContextUsageDialog\(\);[\s\S]*return;[\s\S]*\}/,
	);
	assert.match(script, /state\.contextUsageExpanded = false/);
	assert.doesNotMatch(script, /state\.contextUsageExpanded = !state\.contextUsageExpanded/);
});
