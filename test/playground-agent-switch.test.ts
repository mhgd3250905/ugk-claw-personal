import test from "node:test";
import assert from "node:assert/strict";
import { renderPlaygroundPage } from "../src/ui/playground.js";

test("playground renders an agent selector for switching operation windows", () => {
	const html = renderPlaygroundPage();
	const settingsStart = html.indexOf('class="desktop-rail-settings"');
	const contextSlotStart = html.indexOf('class="topbar-context-slot"');

	assert.ok(settingsStart >= 0);
	assert.ok(contextSlotStart >= 0);
	assert.match(html, /id="agent-selector"/);
	assert.match(html, /value="main"/);
	assert.match(html, /value="search"/);
	assert.match(html, /id="agent-selector-status"/);
	assert.ok(html.indexOf('id="agent-selector"') > settingsStart);
	assert.ok(html.indexOf('id="agent-selector-status"') > contextSlotStart);
	assert.match(html, /class="topbar-agent-label"/);
	assert.match(html, /const AGENT_SELECTION_STORAGE_KEY = "ugk-pi:active-agent-id"/);
	assert.match(html, /agentId:\s*readStoredAgentId\(\)/);
	assert.match(html, /localStorage\.setItem\(AGENT_SELECTION_STORAGE_KEY, normalized\)/);
});
