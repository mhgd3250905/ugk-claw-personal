import assert from "node:assert/strict";
import test from "node:test";
import { getPlaygroundActiveRunNormalizerScript } from "../src/ui/playground-active-run-normalizer.js";

test("active run normalizer exposes active run and process view helpers", () => {
	const script = getPlaygroundActiveRunNormalizerScript();

	assert.match(script, /function normalizeActiveRun\(rawRun\)/);
	assert.match(script, /function normalizeProcessView\(rawProcess\)/);
	assert.match(script, /function formatProcessViewEntry\(entry\)/);
	assert.match(script, /\["running", "interrupted", "done", "error"\]/);
	assert.match(script, /assistantMessageId/);
	assert.match(script, /inputAssets/);
	assert.match(script, /allowedKinds = new Set\(\["system", "tool", "ok", "error", "warn"\]\)/);
	assert.match(script, /entries\.map\(formatProcessViewEntry\)/);
});
