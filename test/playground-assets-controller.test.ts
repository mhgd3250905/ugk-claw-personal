import assert from "node:assert/strict";
import test from "node:test";
import { getPlaygroundAssetControllerScript } from "../src/ui/playground-assets-controller.js";

test("asset library refresh only disables while the asset request is in flight", () => {
	const script = getPlaygroundAssetControllerScript();

	assert.match(script, /refreshAssetsButton\.disabled = true/);
	assert.match(script, /finally \{\s*refreshAssetsButton\.disabled = false;\s*\}/);
	assert.doesNotMatch(script, /refreshAssetsButton\.disabled = state\.loading/);
});
