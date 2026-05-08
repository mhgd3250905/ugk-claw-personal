import assert from "node:assert/strict";
import test from "node:test";

import { createBrowserRegistryFromEnv } from "../src/browser/browser-registry.js";
import { buildServer } from "../src/server.js";

test("GET /v1/browsers returns configured browser instances", async () => {
	const app = buildServer({
		browserRegistry: createBrowserRegistryFromEnv({
			UGK_DEFAULT_BROWSER_ID: "work-01",
			UGK_BROWSER_INSTANCES_JSON: JSON.stringify([
				{ browserId: "default", name: "Default", cdpHost: "172.31.250.10", cdpPort: 9223 },
				{
					browserId: "work-01",
					name: "我的浏览器",
					cdpHost: "172.31.250.11",
					cdpPort: 9223,
					guiUrl: "https://127.0.0.1:3902/",
					profileLabel: "user-managed",
				},
			]),
		}),
	});

	try {
		const response = await app.inject({ method: "GET", url: "/v1/browsers" });
		assert.equal(response.statusCode, 200);
		assert.deepEqual(response.json(), {
			defaultBrowserId: "work-01",
			browsers: [
				{
					browserId: "default",
					name: "Default",
					cdpHost: "172.31.250.10",
					cdpPort: 9223,
					isDefault: false,
				},
				{
					browserId: "work-01",
					name: "我的浏览器",
					cdpHost: "172.31.250.11",
					cdpPort: 9223,
					guiUrl: "https://127.0.0.1:3902/",
					profileLabel: "user-managed",
					isDefault: true,
				},
			],
		});
	} finally {
		await app.close();
	}
});

test("GET /v1/browsers/:browserId returns one browser or 404", async () => {
	const app = buildServer({
		browserRegistry: createBrowserRegistryFromEnv({
			WEB_ACCESS_CDP_HOST: "172.31.250.10",
			WEB_ACCESS_CDP_PORT: "9223",
		}),
	});

	try {
		const found = await app.inject({ method: "GET", url: "/v1/browsers/default" });
		assert.equal(found.statusCode, 200);
		assert.equal(found.json().browser.browserId, "default");

		const missing = await app.inject({ method: "GET", url: "/v1/browsers/missing" });
		assert.equal(missing.statusCode, 404);
		assert.deepEqual(missing.json(), {
			error: "NOT_FOUND",
			message: "Unknown browserId: missing",
		});
	} finally {
		await app.close();
	}
});

