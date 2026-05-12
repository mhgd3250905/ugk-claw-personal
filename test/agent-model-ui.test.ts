import test from "node:test";
import assert from "node:assert/strict";
import { renderAgentsPage } from "../src/ui/agents-page.js";
import { renderPlaygroundPage } from "../src/ui/playground.js";
import { getPlaygroundAgentManagerScript } from "../src/ui/playground-agent-manager.js";

test("embedded agent editor does not clear model fields when model controls are unavailable", () => {
	const script = getPlaygroundAgentManagerScript();

	assert.doesNotMatch(
		script,
		/: editing \? \{ defaultModelProvider: null, defaultModelId: null \} : \{\}/,
	);
	assert.match(script, /const modelSelectionPatch = buildAgentEditorModelSelectionPatch\(\);/);
});

test("standalone agents page binds model provider changes for both create and edit forms", () => {
	const page = renderAgentsPage();

	assert.match(page, /function bindEditorModelProviderSelect\(\)/);
	assert.match(page, /bindEditorModelProviderSelect\(\);/);
	assert.doesNotMatch(
		page,
		/if \(!isEdit\) \{[\s\S]*providerSel\.addEventListener\("change"[\s\S]*\n\t\t\t\}\n\t\t\}/,
	);
});

test("playground model settings follow the active agent default model outside main", () => {
	const page = renderPlaygroundPage();

	assert.match(page, /function getCurrentAgentModelConfigSelection\(\)/);
	assert.match(page, /if \(getCurrentAgentId\(\) === "main"\)/);
	assert.match(page, /const effectiveSelection = getEffectiveModelConfigSelection\(\);/);
	assert.match(page, /当前 Agent：/);
	assert.match(page, /fetch\(isMainAgent \? "\/v1\/model-config\/default" : "\/v1\/agents\/" \+ encodeURIComponent\(currentAgentId\)/);
	assert.match(page, /method: isMainAgent \? "PUT" : "PATCH"/);
	assert.match(page, /defaultModelProvider: selection\.provider/);
	assert.match(page, /已保存到当前 Agent，新会话生效。/);
});
