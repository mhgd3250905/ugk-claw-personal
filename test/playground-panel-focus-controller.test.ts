import assert from "node:assert/strict";
import test from "node:test";
import { renderPlaygroundPage } from "../src/ui/playground.js";
import { getPlaygroundPanelFocusControllerScript } from "../src/ui/playground-panel-focus-controller.js";

test("panel focus controller script exposes the shared panel focus helpers", () => {
	const script = getPlaygroundPanelFocusControllerScript();

	assert.match(script, /function isPanelReturnFocusTarget/);
	assert.match(script, /function focusPanelReturnTarget/);
	assert.match(script, /function rememberPanelReturnFocus/);
	assert.match(script, /function releasePanelFocusBeforeHide/);
	assert.match(script, /function restoreFocusAfterPanelClose/);
	assert.match(script, /messageInput/);
});

test("playground page injects panel focus helpers before confirm dialog logic", () => {
	const html = renderPlaygroundPage();

	const focusHelperIndex = html.indexOf("function rememberPanelReturnFocus");
	const confirmDialogIndex = html.indexOf("function closeConfirmDialog");
	assert.ok(focusHelperIndex > -1);
	assert.ok(confirmDialogIndex > -1);
	assert.ok(focusHelperIndex < confirmDialogIndex);
});
