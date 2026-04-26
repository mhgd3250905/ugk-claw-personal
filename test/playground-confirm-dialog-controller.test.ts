import assert from "node:assert/strict";
import test from "node:test";
import { getPlaygroundConfirmDialogControllerScript } from "../src/ui/playground-confirm-dialog-controller.js";

test("confirm dialog controller exposes the shared browser helpers", () => {
	const script = getPlaygroundConfirmDialogControllerScript();

	assert.match(script, /function closeConfirmDialog\(confirmed\)/);
	assert.match(script, /function openConfirmDialog\(options\)/);
	assert.match(script, /releasePanelFocusBeforeHide\(confirmDialog, state\.confirmDialogRestoreFocusElement\)/);
	assert.match(script, /state\.confirmDialogRestoreFocusElement = rememberPanelReturnFocus\(options\?\.restoreFocusElement\)/);
	assert.match(script, /confirmDialog\.dataset\.tone = tone/);
	assert.match(script, /请确认/);
	assert.match(script, /确认/);
	assert.match(script, /取消/);
});
