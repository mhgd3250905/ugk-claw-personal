import assert from "node:assert/strict";
import test from "node:test";
import { buildPromptWithAssetContext, rewriteUserVisibleLocalArtifactLinks } from "../src/agent/file-artifacts.js";

test("buildPromptWithAssetContext allows local artifact paths internally while keeping send_file for direct delivery", () => {
	const prompt = buildPromptWithAssetContext("请生成报告");

	assert.match(prompt, /send_file/);
	assert.match(prompt, /file:\/\/\/app\/\.\.\./);
	assert.match(prompt, /host-reachable HTTP URL/i);
	assert.match(prompt, /valid internal references for tools and browser automation/i);
});

test("rewriteUserVisibleLocalArtifactLinks converts supported container file paths for host-visible text", () => {
	const rewritten = rewriteUserVisibleLocalArtifactLinks(
		"打开 file:///app/public/zhihu-hot-share.html，然后看 /app/runtime/report-medtrum-v2.html。",
	);

	assert.equal(
		rewritten,
		"打开 http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fpublic%2Fzhihu-hot-share.html，然后看 http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fruntime%2Freport-medtrum-v2.html。",
	);
});
