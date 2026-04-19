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
		"http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fruntime%2Freport-medtrum-v2.html",
	);
});

test("resolveBrowserTargetUrl rewrites public report paths to local HTTP URLs", () => {
	assert.equal(
		resolveBrowserTargetUrl("/app/public/x-api-report-card.html", {
			projectRoot: "/app",
			baseUrl: "http://127.0.0.1:3000",
		}),
		"http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fpublic%2Fx-api-report-card.html",
	);
});

test("resolveBrowserTargetUrl keeps HTTP URLs unchanged", () => {
	assert.equal(
		resolveBrowserTargetUrl("http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fruntime%2Freport-medtrum-v2.html", {
			projectRoot: "/app",
			baseUrl: "http://127.0.0.1:3000",
		}),
		"http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fruntime%2Freport-medtrum-v2.html",
	);
});

test("resolveBrowserTargetUrl preserves unknown local file URLs for native browser handling", () => {
	assert.equal(
		resolveBrowserTargetUrl("file:///tmp/custom-report.html", {
			projectRoot: "/app",
			baseUrl: "http://127.0.0.1:3000",
		}),
		"file:///tmp/custom-report.html",
	);
});

test("mobile screenshot script reuses shared HTTP target resolution instead of file URLs", async () => {
	const script = await readFile("runtime/screenshot-mobile.mjs", "utf8");

	assert.match(script, /from "\.\/screenshot\.mjs"|from '\.\/screenshot\.mjs'/);
	assert.doesNotMatch(script, /file:\/\//);
});
