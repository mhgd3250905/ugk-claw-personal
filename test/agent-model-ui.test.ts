import test from "node:test";
import assert from "node:assert/strict";
import { renderAgentsPage } from "../src/ui/agents-page.js";
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
