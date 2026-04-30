import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
	findDockerHostCdpBaseUrl,
	LocalCdpBrowser,
	resolveBrowserInputUrl,
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

test("resolveBrowserInputUrl rewrites container runtime file URLs to the local artifact bridge", () => {
	assert.equal(
		resolveBrowserInputUrl("file:///app/runtime/report-medtrum-v2.html", {
			projectRoot: "/app",
			publicBaseUrl: "http://127.0.0.1:3000",
		}),
		"http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fruntime%2Freport-medtrum-v2.html",
	);
});

test("resolveBrowserInputUrl uses the browser-reachable base URL for sidecar local artifacts", () => {
	assert.equal(
		resolveBrowserInputUrl("file:///app/runtime/report-medtrum-v2.html", {
			projectRoot: "/app",
			publicBaseUrl: "http://127.0.0.1:3000",
			browserPublicBaseUrl: "http://ugk-pi:3000",
		}),
		"http://ugk-pi:3000/v1/local-file?path=%2Fapp%2Fruntime%2Freport-medtrum-v2.html",
	);
});

test("resolveBrowserInputUrl rewrites host-visible app URLs to the sidecar-reachable origin", () => {
	assert.equal(
		resolveBrowserInputUrl(
			"http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fruntime%2Fzhihu-hot-card.html",
			{
				publicBaseUrl: "http://127.0.0.1:3000",
				browserPublicBaseUrl: "http://ugk-pi:3000",
			},
		),
		"http://ugk-pi:3000/v1/local-file?path=%2Fapp%2Fruntime%2Fzhihu-hot-card.html",
	);
});

test("resolveBrowserInputUrl keeps external URLs unchanged when using a sidecar base", () => {
	assert.equal(
		resolveBrowserInputUrl("https://example.com/path", {
			publicBaseUrl: "http://127.0.0.1:3000",
			browserPublicBaseUrl: "http://ugk-pi:3000",
		}),
		"https://example.com/path",
	);
});

test("resolveBrowserInputUrl rewrites workspace public paths to the local artifact bridge", () => {
	assert.equal(
		resolveBrowserInputUrl("/app/public/x-api-report-card.html", {
			projectRoot: "/app",
			publicBaseUrl: "http://127.0.0.1:3000",
		}),
		"http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fpublic%2Fx-api-report-card.html",
	);
});

test("LocalCdpBrowser type action inserts text through CDP Input.insertText", async () => {
	const calls: Array<{ method: string; params: unknown }> = [];
	class TestBrowser extends LocalCdpBrowser {
		async withTarget(
			targetId: string,
			callback: (cdp: { send: (method: string, params?: unknown) => Promise<unknown> }) => Promise<unknown>,
		) {
			assert.equal(targetId, "target-1");
			return await callback({
				send: async (method: string, params?: unknown) => {
					calls.push({ method, params });
					return {};
				},
			});
		}
	}

	const browser = new TestBrowser();
	const result = await browser.handleCommand({
		action: "type",
		targetId: "target-1",
		text: "你好 Draft",
	});

	assert.deepEqual(result, { ok: true, textLength: 8 });
	assert.deepEqual(calls, [
		{ method: "Page.bringToFront", params: undefined },
		{ method: "Input.insertText", params: { text: "你好 Draft" } },
	]);
});

test("LocalCdpBrowser registers new scoped targets so scope cleanup closes them", async () => {
	const closedTargets: string[] = [];
	class TestBrowser extends LocalCdpBrowser {
		async ensureBrowser() {
			return { Browser: "Chrome/Test" };
		}

		async newTarget(url = "about:blank", scope?: string) {
			const target = { id: `target-${url}`, type: "page", url };
			this.registerScopedTarget(scope, target.id);
			return target;
		}

		async closeTarget(targetId: string) {
			closedTargets.push(targetId);
			return { ok: true };
		}
	}

	const browser = new TestBrowser();

	await browser.handleCommand(
		{
			action: "new_target",
			url: "https://example.com",
		},
		{
			meta: { agentScope: "conn-1" },
		},
	);
	await browser.handleCommand(
		{
			action: "close_scope_targets",
		},
		{
			meta: { agentScope: "conn-1" },
		},
	);

	assert.deepEqual(closedTargets, ["target-https://example.com"]);
});

test("LocalCdpBrowser persists scoped targets so a restarted bridge can clean them up", async () => {
	const tempDir = await mkdtemp(path.join(tmpdir(), "ugk-cdp-scope-"));
	const scopeCachePath = path.join(tempDir, "browser-scope-cache.json");
	const closedTargets: string[] = [];

	class TestBrowser extends LocalCdpBrowser {
		constructor(options: ConstructorParameters<typeof LocalCdpBrowser>[0]) {
			super(options);
		}

		async closeTarget(targetId: string) {
			closedTargets.push(targetId);
			return { ok: true };
		}
	}

	try {
		const firstBrowser = new TestBrowser({ scopeCachePath });
		firstBrowser.registerScopedTarget("conn-1", "target-1");
		await firstBrowser.handleCommand(
			{
				action: "set_default_target",
				targetId: "target-default",
			},
			{
				meta: { agentScope: "conn-1" },
			},
		);

		const cache = JSON.parse(await readFile(scopeCachePath, "utf-8"));
		assert.deepEqual(cache.scopedTargets["conn-1"], ["target-1"]);
		assert.equal(cache.defaultTargets["conn-1"], "target-default");

		const restartedBrowser = new TestBrowser({ scopeCachePath });
		await restartedBrowser.handleCommand(
			{
				action: "close_scope_targets",
			},
			{
				meta: { agentScope: "conn-1" },
			},
		);

		assert.deepEqual(closedTargets.sort(), ["target-1", "target-default"].sort());
		const clearedCache = JSON.parse(await readFile(scopeCachePath, "utf-8"));
		assert.equal(clearedCache.scopedTargets["conn-1"], undefined);
		assert.equal(clearedCache.defaultTargets["conn-1"], undefined);
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
});
