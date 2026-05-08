import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
	getBrowserScopeRouteCachePath,
	readBrowserScopeRoute,
	setBrowserScopeRoute,
} from "../src/browser/browser-scope-routes.js";

test("browser scope routes persist scope to browserId mappings", async () => {
	const tempDir = await mkdtemp(join(tmpdir(), "ugk-browser-routes-"));
	const cachePath = join(tempDir, "routes.json");

	try {
		await setBrowserScopeRoute("manual-alpha", "chrome-01", {
			cachePath,
			now: () => new Date("2026-05-08T00:00:00.000Z"),
		});

		assert.deepEqual(await readBrowserScopeRoute("manual-alpha", { cachePath }), {
			browserId: "chrome-01",
			updatedAt: "2026-05-08T00:00:00.000Z",
		});
		assert.deepEqual(JSON.parse(await readFile(cachePath, "utf8")), {
			routes: {
				"manual-alpha": {
					browserId: "chrome-01",
					updatedAt: "2026-05-08T00:00:00.000Z",
				},
			},
		});

		await setBrowserScopeRoute("manual-alpha", undefined, { cachePath });
		assert.equal(await readBrowserScopeRoute("manual-alpha", { cachePath }), undefined);
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
});

test("browser scope route writes keep independent scopes in the same process", async () => {
	const tempDir = await mkdtemp(join(tmpdir(), "ugk-browser-routes-"));
	const cachePath = join(tempDir, "routes.json");

	try {
		await Promise.all([
			setBrowserScopeRoute("manual-alpha", "chrome-01", { cachePath }),
			setBrowserScopeRoute("manual-beta", "chrome-02", { cachePath }),
		]);

		assert.equal((await readBrowserScopeRoute("manual-alpha", { cachePath }))?.browserId, "chrome-01");
		assert.equal((await readBrowserScopeRoute("manual-beta", { cachePath }))?.browserId, "chrome-02");
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
});

test("browser scope route cache defaults to the workspace data dir on Windows", () => {
	if (process.platform !== "win32") {
		return;
	}

	assert.equal(
		getBrowserScopeRouteCachePath({}),
		join(process.cwd(), ".data", "browser-scope-routes.json"),
	);
});
