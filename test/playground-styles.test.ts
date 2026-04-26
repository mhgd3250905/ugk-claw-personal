import test from "node:test";
import assert from "node:assert/strict";
import { getPlaygroundStyles } from "../src/ui/playground-styles.js";

test("playground styles expose the mobile active transcript rail reset", () => {
	const styles = getPlaygroundStyles();

	assert.match(
		styles,
		/\.shell\[data-stage-mode="landing"\]\[data-transcript-state="active"\] \.stream-layout\s*\{[\s\S]*inset:\s*auto;/,
	);
});
