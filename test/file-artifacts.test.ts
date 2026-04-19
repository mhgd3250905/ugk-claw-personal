import assert from "node:assert/strict";
import test from "node:test";
import { buildPromptWithAssetContext } from "../src/agent/file-artifacts.js";

test("buildPromptWithAssetContext instructs the agent to use HTTP URLs for local previews and send_file for delivery", () => {
	const prompt = buildPromptWithAssetContext("请生成报告");

	assert.match(prompt, /send_file/);
	assert.match(prompt, /http:\/\/127\.0\.0\.1:3000\/<fileName>/);
	assert.match(prompt, /http:\/\/127\.0\.0\.1:3000\/runtime\/<fileName>/);
	assert.match(prompt, /file:\/\/\/app\/\.\.\./);
});
