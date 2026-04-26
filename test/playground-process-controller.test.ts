import assert from "node:assert/strict";
import test from "node:test";
import { getPlaygroundProcessControllerScript } from "../src/ui/playground-process-controller.js";

test("process controller exposes streaming process and skills helpers", () => {
	const script = getPlaygroundProcessControllerScript();

	assert.match(script, /function isInterruptIntentMessage\(message\)/);
	assert.match(script, /function summarizeDetail\(detail\)/);
	assert.match(script, /function formatProcessAction\(title, detail\)/);
	assert.match(script, /function formatSkillsReply\(skills\)/);
	assert.match(script, /function describeProcessNarration\(kind, title, detail\)/);
	assert.match(script, /function appendProcessEvent\(kind, title, detail\)/);
	assert.match(script, /function updateStreamingProcess\(kind, title, detail\)/);
	assert.match(script, /function resetStreamingState\(\)/);
	assert.match(script, /async function loadSkills\(\)/);
	assert.match(script, /setMessageContent\(skillReply\.content, formatSkillsReply\(payload\?\.skills\)\)/);
});
