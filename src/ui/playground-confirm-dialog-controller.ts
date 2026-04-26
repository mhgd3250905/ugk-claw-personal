export function getPlaygroundConfirmDialogControllerScript(): string {
	return `
		function closeConfirmDialog(confirmed) {
			const resolve = typeof state.confirmDialogResolve === "function" ? state.confirmDialogResolve : null;
			state.confirmDialogResolve = null;
			releasePanelFocusBeforeHide(confirmDialog, state.confirmDialogRestoreFocusElement);
			confirmDialog.classList.remove("open");
			confirmDialog.hidden = true;
			confirmDialog.setAttribute("aria-hidden", "true");
			state.confirmDialogRestoreFocusElement = null;
			if (resolve) {
				resolve(Boolean(confirmed));
			}
		}

		function openConfirmDialog(options) {
			const title = String(options?.title || "请确认").trim() || "请确认";
			const description = String(options?.description || "").trim();
			const confirmText = String(options?.confirmText || "确认").trim() || "确认";
			const cancelText = String(options?.cancelText || "取消").trim() || "取消";
			const tone = String(options?.tone || "danger").trim() || "danger";
			if (typeof state.confirmDialogResolve === "function") {
				closeConfirmDialog(false);
			}
			state.confirmDialogRestoreFocusElement = rememberPanelReturnFocus(options?.restoreFocusElement);
			confirmDialog.dataset.tone = tone;
			confirmDialogTitle.textContent = title;
			confirmDialogBody.textContent = description;
			confirmDialogConfirm.textContent = confirmText;
			confirmDialogCancel.textContent = cancelText;
			confirmDialog.hidden = false;
			confirmDialog.classList.add("open");
			confirmDialog.setAttribute("aria-hidden", "false");
			window.setTimeout(() => {
				try {
					confirmDialogConfirm.focus({ preventScroll: true });
				} catch {
					confirmDialogConfirm.focus();
				}
			}, 0);
			return new Promise((resolve) => {
				state.confirmDialogResolve = resolve;
			});
		}
	`;
}
