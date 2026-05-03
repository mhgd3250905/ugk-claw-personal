export function getPlaygroundWorkspaceControllerScript(): string {
	return `
		const WORKSPACE_MODES = new Set(["chat", "assets", "conn", "agents", "task"]);
		const workspaceDesktopMediaQuery = window.matchMedia("(min-width: 641px)");

		function normalizeWorkspaceMode(mode) {
			const normalized = String(mode || "chat").trim();
			return WORKSPACE_MODES.has(normalized) ? normalized : "chat";
		}

		function isDesktopWorkspaceMode() {
			return Boolean(workspaceDesktopMediaQuery.matches);
		}

		function getWorkspacePanel(mode) {
			if (mode === "assets") {
				return assetModal;
			}
			if (mode === "conn") {
				return connManagerDialog;
			}
			if (mode === "agents") {
				return agentManagerDialog;
			}
			if (mode === "task") {
				return taskInboxView;
			}
			return null;
		}

		function setWorkspaceButtonActive(button, active) {
			if (!button) {
				return;
			}
			button.dataset.active = active ? "true" : "false";
			if (button.hasAttribute("aria-pressed")) {
				button.setAttribute("aria-pressed", active ? "true" : "false");
			}
		}

		function renderWorkspaceModeControls() {
			setWorkspaceButtonActive(openAssetLibraryButton, state.workspaceMode === "assets");
			setWorkspaceButtonActive(openConnManagerButton, state.workspaceMode === "conn");
			setWorkspaceButtonActive(agentSelectorStatus, state.workspaceMode === "agents");
			setWorkspaceButtonActive(openTaskInboxButton, state.workspaceMode === "task");
		}

		function setWorkspaceMode(mode, options) {
			const nextMode = normalizeWorkspaceMode(mode);
			state.workspaceMode = nextMode;
			chatStage.dataset.workspaceMode = state.workspaceMode;
			renderWorkspaceModeControls();
			if (!options?.skipLayoutSync) {
				scheduleConversationLayoutSync();
			}
		}

		function restoreWorkspacePanelToBody(panel) {
			if (!panel || panel.parentElement === document.body) {
				return;
			}
			document.body.appendChild(panel);
		}

		function placeWorkspacePanel(mode, panel) {
			if (!panel) {
				return;
			}
			panel.dataset.workspacePanel = mode;
			const contained = isDesktopWorkspaceMode() && state.workspaceMode === mode;
			panel.classList.toggle("workspace-contained", contained);
			if (contained) {
				if (panel.parentElement !== chatStage) {
					chatStage.appendChild(panel);
				}
				return;
			}
			restoreWorkspacePanelToBody(panel);
		}

		function syncWorkspacePanelPlacement() {
			for (const mode of ["assets", "conn", "agents", "task"]) {
				placeWorkspacePanel(mode, getWorkspacePanel(mode));
			}
		}

		function closeInactiveWorkspacePanels(activeMode) {
			if (activeMode !== "assets" && state.assetModalOpen) {
				closeAssetLibrary();
			}
			if (activeMode !== "conn" && state.connManagerOpen) {
				closeConnManager();
			}
			if (activeMode !== "agents" && state.agentManagerOpen) {
				closeAgentManager();
			}
			if (activeMode !== "task" && state.taskInboxOpen) {
				closeTaskInbox();
			}
		}

		function openWorkspacePanel(mode, panel, options) {
			const nextMode = normalizeWorkspaceMode(mode);
			closeInactiveWorkspacePanels(nextMode);
			if (!isDesktopWorkspaceMode() || options?.forceOverlay) {
				setWorkspaceMode("chat");
				placeWorkspacePanel(nextMode, panel);
				return false;
			}
			setWorkspaceMode(nextMode);
			placeWorkspacePanel(nextMode, panel);
			return true;
		}

		function closeWorkspacePanel(mode, panel) {
			const normalizedMode = normalizeWorkspaceMode(mode);
			if (state.workspaceMode === normalizedMode) {
				setWorkspaceMode("chat");
			}
			placeWorkspacePanel(normalizedMode, panel);
		}

		function toggleWorkspacePanel(mode, openPanel, closePanel) {
			const normalizedMode = normalizeWorkspaceMode(mode);
			if (isDesktopWorkspaceMode() && state.workspaceMode === normalizedMode) {
				closePanel();
				return;
			}
			openPanel();
		}

		function bindPlaygroundWorkspaceController() {
			chatStage.dataset.workspaceMode = state.workspaceMode;
			workspaceDesktopMediaQuery.addEventListener("change", () => {
				if (!isDesktopWorkspaceMode()) {
					setWorkspaceMode("chat", { skipLayoutSync: true });
				}
				syncWorkspacePanelPlacement();
				renderWorkspaceModeControls();
				scheduleConversationLayoutSync();
			});
		}
	`;
}
