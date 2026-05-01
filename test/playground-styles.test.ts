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

test("playground styles keep desktop rail full height and reset it on phones", () => {
	const styles = getPlaygroundStyles();

	assert.match(styles, /\.shell\s*\{[\s\S]*grid-template-columns:\s*260px minmax\(0, 1fr\);/);
	assert.match(styles, /\.shell\s*\{[\s\S]*column-gap:\s*0;/);
	assert.match(styles, /\.topbar\s*\{[\s\S]*grid-column:\s*2;[\s\S]*grid-row:\s*1;/);
	assert.match(styles, /\.topbar-context-slot\s*\{[\s\S]*display:\s*flex;/);
	assert.match(styles, /\.desktop-conversation-rail\s*\{[\s\S]*grid-row:\s*1 \/ -1;/);
	assert.match(
		styles,
		/@media \(max-width: 640px\) \{[\s\S]*\.topbar\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*1;/,
	);
	assert.match(
		styles,
		/@media \(max-width: 640px\) \{[\s\S]*\.landing-side-right\s*\{[\s\S]*display:\s*contents;/,
	);
	assert.match(
		styles,
		/@media \(max-width: 640px\) \{[\s\S]*\.landing-side-right > \.telemetry-action\s*\{[\s\S]*display:\s*none;/,
	);
	assert.doesNotMatch(styles, /\.landing-side-right > \.topbar-context-slot\s*\{[\s\S]*display:\s*none;/);
});
