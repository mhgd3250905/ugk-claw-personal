export function getPlaygroundPanelFocusControllerScript(): string {
	return `
		function isPanelReturnFocusTarget(element) {
			return Boolean(
				element &&
					typeof element.focus === "function" &&
					!element.hidden &&
					!element.disabled &&
					element.getAttribute?.("aria-hidden") !== "true" &&
					!element.closest?.("[hidden], [aria-hidden='true']"),
			);
		}

		function focusPanelReturnTarget(element) {
			const target = isPanelReturnFocusTarget(element) ? element : messageInput;
			try {
				target.focus({ preventScroll: true });
			} catch {
				target.focus();
			}
			return document.activeElement === target;
		}

		function rememberPanelReturnFocus(preferredElement) {
			if (isPanelReturnFocusTarget(preferredElement)) {
				return preferredElement;
			}
			if (isPanelReturnFocusTarget(document.activeElement)) {
				return document.activeElement;
			}
			return messageInput;
		}

		function releasePanelFocusBeforeHide(panelElement, fallbackElement) {
			if (panelElement?.contains(document.activeElement)) {
				const restored = focusPanelReturnTarget(fallbackElement);
				if (!restored && panelElement.contains(document.activeElement)) {
					document.activeElement.blur();
				}
			}
		}

		function restoreFocusAfterPanelClose(panelElement, fallbackElement) {
			releasePanelFocusBeforeHide(panelElement, fallbackElement);
		}
	`;
}
