export function getPlaygroundThemeStyles(): string {
	return `
		:root[data-theme="light"] {
			--bg: #f5f7fb;
			--bg-panel: #ffffff;
			--bg-panel-2: #eef2f8;
			--bg-panel-3: #e6ebf4;
			--fg: #172033;
			--muted: #667085;
			--line: #d9e0ec;
			--line-strong: #b8c3d6;
			--accent: #2454d6;
			--accent-soft: rgba(36, 84, 214, 0.08);
			--ok: #11864f;
			--danger: #c52945;
			--warn: #9b6a00;
			color-scheme: light;
		}

		:root[data-theme="light"],
		:root[data-theme="light"] body {
			background:
				radial-gradient(circle at 18% 12%, rgba(79, 117, 255, 0.13), transparent 0 20%),
				radial-gradient(circle at 82% 8%, rgba(17, 134, 79, 0.08), transparent 0 15%),
				linear-gradient(180deg, #f7f9fd 0%, #eef3fa 46%, #e7edf6 100%);
			color: var(--fg);
		}

		:root[data-theme="light"] body::before {
			background:
				linear-gradient(rgba(36, 84, 214, 0.035) 1px, transparent 1px),
				linear-gradient(90deg, rgba(36, 84, 214, 0.03) 1px, transparent 1px);
			background-size: 34px 34px;
			opacity: 0.9;
		}

		.theme-toggle-button {
			position: relative;
		}

		.theme-toggle-icon {
			position: absolute;
			top: 10px;
			right: 12px;
			display: inline-flex;
			width: 16px;
			height: 16px;
			color: currentColor;
		}

		.theme-toggle-icon svg {
			width: 16px;
			height: 16px;
			stroke: currentColor;
		}

		:root[data-theme="dark"] .theme-toggle-icon-sun,
		:root[data-theme="light"] .theme-toggle-icon-moon {
			display: none;
		}

		:root[data-theme="light"] .topbar {
			border-bottom-color: rgba(23, 32, 51, 0.1);
		}

		:root[data-theme="light"] .landing-screen,
		:root[data-theme="light"] .chat-stage,
		:root[data-theme="light"] .stream-layout,
		:root[data-theme="light"] .transcript-pane {
			color: var(--fg);
		}

		:root[data-theme="light"] .telemetry-card,
		:root[data-theme="light"] .telemetry-action,
		:root[data-theme="light"] .command-deck,
		:root[data-theme="light"] .composer,
		:root[data-theme="light"] .selected-assets,
		:root[data-theme="light"] .drop-zone-top {
			border-color: transparent;
			background: rgba(255, 255, 255, 0.86);
			color: var(--fg);
			box-shadow:
				0 18px 42px rgba(40, 53, 84, 0.12),
				inset 0 1px 0 rgba(255, 255, 255, 0.76);
		}

		:root[data-theme="light"] .telemetry-card span,
		:root[data-theme="light"] .status-row span,
		:root[data-theme="light"] .message-meta,
		:root[data-theme="light"] .assistant-status-summary,
		:root[data-theme="light"] .mobile-conversation-meta,
		:root[data-theme="light"] .mobile-conversation-preview {
			color: rgba(75, 86, 110, 0.76);
		}

		:root[data-theme="light"] .telemetry-card strong,
		:root[data-theme="light"] .mobile-brand-wordmark,
		:root[data-theme="light"] .mobile-drawer-title strong,
		:root[data-theme="light"] .mobile-conversation-title {
			color: #172033;
		}

		:root[data-theme="light"] button,
		:root[data-theme="light"] .mobile-topbar-button,
		:root[data-theme="light"] .mobile-drawer-close,
		:root[data-theme="light"] .error-banner-close,
		:root[data-theme="light"] .chat-run-log-close,
		:root[data-theme="light"] .context-usage-dialog-close,
		:root[data-theme="light"] .conn-run-details-close {
			border-color: rgba(36, 84, 214, 0.13);
			background: rgba(255, 255, 255, 0.74);
			color: #24324a;
			box-shadow: 0 8px 18px rgba(40, 53, 84, 0.08);
		}

		:root[data-theme="light"] button:hover:not(:disabled),
		:root[data-theme="light"] button:focus-visible {
			border-color: rgba(36, 84, 214, 0.28);
			background: #ffffff;
			color: #123fb7;
			box-shadow: 0 10px 22px rgba(36, 84, 214, 0.12);
		}

		:root[data-theme="light"] #send-button {
			border-color: rgba(36, 84, 214, 0.26);
			background:
				linear-gradient(135deg, rgba(36, 84, 214, 0.14), rgba(255, 255, 255, 0.9)),
				#ffffff;
			color: #173fa6;
			box-shadow: 0 12px 26px rgba(36, 84, 214, 0.14);
		}

		:root[data-theme="light"] #interrupt-button {
			border-color: rgba(197, 41, 69, 0.22);
			background: rgba(255, 255, 255, 0.8);
			color: #9d2439;
		}

		:root[data-theme="light"] input,
		:root[data-theme="light"] select,
		:root[data-theme="light"] textarea,
		:root[data-theme="light"] .composer-input,
		:root[data-theme="light"] .conn-editor-field input,
		:root[data-theme="light"] .conn-editor-field select,
		:root[data-theme="light"] .conn-editor-field textarea,
		:root[data-theme="light"] .asset-modal-search input {
			border-color: transparent;
			background: rgba(255, 255, 255, 0.92);
			color: var(--fg);
			box-shadow: inset 0 1px 0 rgba(23, 32, 51, 0.04);
		}

		:root[data-theme="light"] input::placeholder,
		:root[data-theme="light"] textarea::placeholder {
			color: rgba(102, 112, 133, 0.72);
		}

		:root[data-theme="light"] .message-body,
		:root[data-theme="light"] .message.assistant .message-body,
		:root[data-theme="light"] :is(.task-inbox-result-bubble) {
			background: rgba(255, 255, 255, 0.9);
			color: #172033;
			box-shadow:
				0 14px 30px rgba(40, 53, 84, 0.1),
				inset 0 1px 0 rgba(255, 255, 255, 0.86);
		}

		:root[data-theme="light"] .message.user .message-body {
			background: linear-gradient(180deg, #e9efff 0%, #dce6ff 100%);
			color: #142343;
			box-shadow: 0 12px 28px rgba(36, 84, 214, 0.12);
		}

		:root[data-theme="light"] .message.assistant .message-content,
		:root[data-theme="light"] .message.assistant .message-content .code-block-language,
		:root[data-theme="light"] .message-content,
		:root[data-theme="light"] .task-inbox-result-bubble .message-content {
			color: #1f2937;
		}

		:root[data-theme="light"] .message-content a {
			color: #1b58d8;
		}

		:root[data-theme="light"] .message-content blockquote,
		:root[data-theme="light"] .message-content th {
			background: rgba(36, 84, 214, 0.08);
			color: #172033;
		}

		:root[data-theme="light"] .message-content code,
		:root[data-theme="light"] .message-content pre,
		:root[data-theme="light"] .message-content .code-block,
		:root[data-theme="light"] .message.assistant .message-content pre,
		:root[data-theme="light"] .message.assistant .message-content .code-block,
		:root[data-theme="light"] .message.assistant .message-content .code-block pre {
			background: #eef3fb;
			color: #152238;
		}

		:root[data-theme="light"] .message-copy-button,
		:root[data-theme="light"] .message-image-export-button {
			color: rgba(75, 86, 110, 0.68);
			background: transparent;
			box-shadow: none;
		}

		:root[data-theme="light"] .message-copy-button:hover:not(:disabled),
		:root[data-theme="light"] .message-copy-button:focus-visible,
		:root[data-theme="light"] .message-image-export-button:hover:not(:disabled),
		:root[data-theme="light"] .message-image-export-button:focus-visible {
			background: transparent;
			color: rgba(23, 32, 51, 0.9);
			box-shadow: none;
		}

		:root[data-theme="light"] .message-export-frame {
			background:
				linear-gradient(180deg, #ffffff 0%, #f2f5fa 100%),
				#ffffff;
			color: #172033;
			box-shadow: inset 0 1px 0 rgba(23, 32, 51, 0.05);
		}

		:root[data-theme="light"] .message-export-frame > .message-body {
			background: #ffffff;
		}

		:root[data-theme="light"] .export-signature {
			color: rgba(75, 86, 110, 0.76);
		}

		:root[data-theme="light"] .assistant-loading-bubble,
		:root[data-theme="light"] .assistant-loading-card,
		:root[data-theme="light"] .assistant-status-shell,
		:root[data-theme="light"] .history-load-more,
		:root[data-theme="light"] .scroll-to-bottom-button {
			border-color: transparent;
			background: rgba(255, 255, 255, 0.86);
			color: #26344f;
			box-shadow: 0 12px 24px rgba(40, 53, 84, 0.1);
		}

		:root[data-theme="light"] :is(.context-usage-shell),
		:root[data-theme="light"] :is(.context-usage-dialog-panel),
		:root[data-theme="light"] :is(.chat-run-log-panel),
		:root[data-theme="light"] :is(.confirm-dialog-panel),
		:root[data-theme="light"] :is(.conn-run-details-panel) {
			border-color: transparent;
			background:
				linear-gradient(180deg, #ffffff 0%, #f1f5fb 100%),
				#ffffff;
			color: #172033;
			box-shadow: 0 22px 46px rgba(40, 53, 84, 0.16);
		}

		:root[data-theme="light"] :is(.context-usage-dialog-head),
		:root[data-theme="light"] :is(.chat-run-log-head),
		:root[data-theme="light"] :is(.confirm-dialog-head),
		:root[data-theme="light"] :is(.conn-run-details-head),
		:root[data-theme="light"] :is(.asset-modal-head),
		:root[data-theme="light"] :is(.task-inbox-head) {
			background: #ffffff;
			color: #172033;
			box-shadow: 0 10px 26px rgba(40, 53, 84, 0.08);
		}

		:root[data-theme="light"] .context-usage-metric,
		:root[data-theme="light"] .context-usage-model,
		:root[data-theme="light"] .chat-run-log-item,
		:root[data-theme="light"] .confirm-dialog-body,
		:root[data-theme="light"] .conn-run-section {
			background: #f3f6fb;
			color: #24324a;
			box-shadow: none;
		}

		:root[data-theme="light"] .asset-modal,
		:root[data-theme="light"] .asset-modal-shell,
		:root[data-theme="light"] .conn-manager-dialog,
		:root[data-theme="light"] .conn-editor-dialog,
		:root[data-theme="light"] .task-inbox-view {
			background:
				radial-gradient(circle at 16% 8%, rgba(36, 84, 214, 0.1), transparent 32%),
				linear-gradient(180deg, #f8fafc 0%, #edf2f8 100%);
			color: #172033;
		}

		:root[data-theme="light"] .asset-modal-panel,
		:root[data-theme="light"] .conn-manager-panel,
		:root[data-theme="light"] .conn-editor-panel,
		:root[data-theme="light"] .task-inbox-list,
		:root[data-theme="light"] .task-inbox-item,
		:root[data-theme="light"] .conn-manager-list,
		:root[data-theme="light"] .conn-manager-item,
		:root[data-theme="light"] .conn-editor-form {
			border-color: transparent;
			background: rgba(255, 255, 255, 0.88);
			color: #172033;
			box-shadow: 0 14px 34px rgba(40, 53, 84, 0.1);
		}

		:root[data-theme="light"] :is(.asset-pill),
		:root[data-theme="light"] :is(.asset-empty),
		:root[data-theme="light"] :is(.file-chip),
		:root[data-theme="light"] :is(.conn-manager-toolbar),
		:root[data-theme="light"] :is(.conn-manager-run-item),
		:root[data-theme="light"] :is(.conn-editor-field),
		:root[data-theme="light"] :is(.conn-editor-advanced) {
			border-color: transparent;
			background: #f4f7fb;
			color: #24324a;
			box-shadow: none;
		}

		:root[data-theme="light"] .mobile-overflow-menu,
		:root[data-theme="light"] .mobile-conversation-drawer {
			border-color: transparent;
			background:
				radial-gradient(circle at 22% 12%, rgba(36, 84, 214, 0.1), transparent 34%),
				linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(240, 244, 250, 0.98));
			color: #172033;
			box-shadow: 22px 0 46px rgba(40, 53, 84, 0.16);
		}

		:root[data-theme="light"] .mobile-overflow-menu-item,
		:root[data-theme="light"] .mobile-conversation-item {
			background: #f4f7fb;
			color: #24324a;
			box-shadow: none;
		}

		:root[data-theme="light"] .mobile-overflow-menu-item:hover:not(:disabled),
		:root[data-theme="light"] .mobile-overflow-menu-item:focus-visible,
		:root[data-theme="light"] .mobile-conversation-item:hover:not(:disabled),
		:root[data-theme="light"] .mobile-conversation-item:focus-visible {
			background: #ffffff;
			color: #123fb7;
			box-shadow: 0 8px 18px rgba(40, 53, 84, 0.08);
		}

		:root[data-theme="light"] .mobile-conversation-item.is-active {
			border-color: rgba(36, 84, 214, 0.28);
			background: #e7eeff;
		}

		:root[data-theme="light"] .mobile-conversation-item.is-active::before {
			background: #2454d6;
			box-shadow: 0 0 14px rgba(36, 84, 214, 0.28);
		}

		:root[data-theme="light"] .conversation-item-delete {
			border-color: rgba(197, 41, 69, 0.16);
			background: rgba(197, 41, 69, 0.07);
			color: #9d2439;
		}

		:root[data-theme="light"] .error-banner {
			background: #fff0f2;
			color: #8f2034;
			box-shadow: 0 14px 28px rgba(197, 41, 69, 0.14);
		}

		@media (max-width: 640px) {
			:root[data-theme="light"] .shell,
			:root[data-theme="light"] .chat-stage {
				background: transparent;
			}

			:root[data-theme="light"] .message-body {
				background: rgba(255, 255, 255, 0.92);
			}
		}
	`;
}

export function getPlaygroundThemeControllerScript(): string {
	return `
		const PLAYGROUND_THEME_STORAGE_KEY = "ugk-pi:playground-theme";
		const themeToggleButton = document.getElementById("theme-toggle-button");
		const themeToggleLabel = document.getElementById("theme-toggle-label");
		const mobileMenuThemeButton = document.getElementById("mobile-menu-theme-button");
		const mobileThemeToggleLabel = document.getElementById("mobile-theme-toggle-label");

		function normalizePlaygroundTheme(value) {
			return value === "light" ? "light" : "dark";
		}

		function readStoredPlaygroundTheme() {
			try {
				return normalizePlaygroundTheme(localStorage.getItem(PLAYGROUND_THEME_STORAGE_KEY));
			} catch {
				return "dark";
			}
		}

		function updateThemeToggleControls(theme) {
			const isLight = theme === "light";
			const nextLabel = isLight ? "浅色模式" : "深色模式";
			const nextAction = isLight ? "切换深色主题" : "切换浅色主题";
			if (themeToggleButton) {
				themeToggleButton.setAttribute("aria-pressed", isLight ? "true" : "false");
				themeToggleButton.setAttribute("aria-label", nextAction);
				themeToggleButton.title = nextAction;
			}
			if (themeToggleLabel) {
				themeToggleLabel.textContent = nextLabel;
			}
			if (mobileMenuThemeButton) {
				mobileMenuThemeButton.setAttribute("aria-pressed", isLight ? "true" : "false");
				mobileMenuThemeButton.setAttribute("aria-label", nextAction);
				mobileMenuThemeButton.title = nextAction;
			}
			if (mobileThemeToggleLabel) {
				mobileThemeToggleLabel.textContent = nextLabel;
			}
		}

		function applyPlaygroundTheme(nextTheme) {
			const normalized = normalizePlaygroundTheme(nextTheme);
			state.theme = normalized;
			pageRoot.dataset.theme = normalized;
			pageRoot.style.colorScheme = normalized;
			updateThemeToggleControls(normalized);
			try {
				localStorage.setItem(PLAYGROUND_THEME_STORAGE_KEY, normalized);
			} catch {}
			return normalized;
		}

		function togglePlaygroundTheme() {
			const nextTheme = pageRoot.dataset.theme === "light" ? "dark" : "light";
			return applyPlaygroundTheme(nextTheme);
		}

		applyPlaygroundTheme(readStoredPlaygroundTheme());
		if (themeToggleButton) {
			themeToggleButton.addEventListener("click", () => {
				togglePlaygroundTheme();
			});
		}
		if (mobileMenuThemeButton) {
			mobileMenuThemeButton.addEventListener("click", () => {
				togglePlaygroundTheme();
				closeMobileOverflowMenu();
			});
		}
	`;
}
