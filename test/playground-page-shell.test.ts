import test from "node:test";
import assert from "node:assert/strict";
import { renderPlaygroundHtml } from "../src/ui/playground-page-shell.js";

test("renderPlaygroundHtml assembles the playground shell from injected fragments", () => {
	const html = renderPlaygroundHtml({
		styles: ".sentinel-style{}",
		markedBrowserScript: "window.__markedLoaded = true;",
		playgroundScript: "window.__playgroundLoaded = true;",
		taskInboxView: '<section id="task-sentinel"></section>',
		connActivityDialogs: '<dialog id="conn-sentinel"></dialog>',
		assetDialogs: '<dialog id="asset-sentinel"></dialog>',
	});

	assert.match(html, /<style>\.sentinel-style\{\}<\/style>/);
	assert.match(html, /<section id="task-sentinel"><\/section>/);
	assert.match(html, /<dialog id="conn-sentinel"><\/dialog>/);
	assert.match(html, /<dialog id="asset-sentinel"><\/dialog>/);
	assert.match(html, /window\.__markedLoaded = true;\s*window\.__playgroundLoaded = true;/);
});
