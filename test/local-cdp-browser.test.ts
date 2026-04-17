import assert from "node:assert/strict";
import test from "node:test";

import {
	findDockerHostCdpBaseUrl,
	rewriteCdpTargetForBaseUrl,
} from "../runtime/skills-user/web-access/scripts/local-cdp-browser.mjs";

test("rewriteCdpTargetForBaseUrl rewrites localhost websocket URLs to the reachable CDP host", () => {
	const target = rewriteCdpTargetForBaseUrl(
		{
			id: "target-1",
			type: "page",
			title: "Example",
			url: "https://example.com/",
			webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/target-1",
		},
		"http://192.168.65.254:9222",
	);

	assert.equal(
		target.webSocketDebuggerUrl,
		"ws://192.168.65.254:9222/devtools/page/target-1",
	);
});

test("findDockerHostCdpBaseUrl resolves host.docker.internal to an IP before probing Chrome CDP", async () => {
	const probedUrls: string[] = [];
	const baseUrl = await findDockerHostCdpBaseUrl({
		lookup: async () => ({ address: "192.168.65.254" }),
		fetchImpl: async (url: string) => {
			probedUrls.push(url);
			return {
				ok: true,
				json: async () => ({ Browser: "Chrome/Test" }),
			};
		},
	});

	assert.equal(baseUrl, "http://192.168.65.254:9222");
	assert.deepEqual(probedUrls, ["http://192.168.65.254:9222/json/version"]);
});
