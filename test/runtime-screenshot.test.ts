import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveBrowserTargetUrl } from "../runtime/screenshot.mjs";

test("resolveBrowserTargetUrl rewrites runtime report paths to local HTTP URLs", () => {
	assert.equal(
		resolveBrowserTargetUrl("/app/runtime/report-medtrum-v2.html", {
			projectRoot: "/app",
			baseUrl: "http://127.0.0.1:3000",
		}),
		"http://127.0.0.1:3000/runtime/report-medtrum-v2.html",
	);
});

test("resolveBrowserTargetUrl rewrites public report paths to local HTTP URLs", () => {
	assert.equal(
		resolveBrowserTargetUrl("/app/public/x-api-report-card.html", {
			projectRoot: "/app",
			baseUrl: "http://127.0.0.1:3000",
		}),
		"http://127.0.0.1:3000/x-api-report-card.html",
	);
});

test("resolveBrowserTargetUrl keeps HTTP URLs unchanged", () => {
	assert.equal(
		resolveBrowserTargetUrl("http://127.0.0.1:3000/runtime/report-medtrum-v2.html", {
			projectRoot: "/app",
			baseUrl: "http://127.0.0.1:3000",
		}),
		"http://127.0.0.1:3000/runtime/report-medtrum-v2.html",
	);
});

test("resolveBrowserTargetUrl rejects paths outside public and runtime", () => {
	assert.throws(
		() =>
			resolveBrowserTargetUrl("/app/.data/agent/asset-index.json", {
				projectRoot: "/app",
				baseUrl: "http://127.0.0.1:3000",
			}),
		/report path must be under runtime or public/i,
	);
});

test("mobile screenshot script reuses shared HTTP target resolution instead of file URLs", async () => {
	const script = await readFile("runtime/screenshot-mobile.mjs", "utf8");

	assert.match(script, /from "\.\/screenshot\.mjs"|from '\.\/screenshot\.mjs'/);
	assert.doesNotMatch(script, /file:\/\//);
});
