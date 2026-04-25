export function getPlaygroundThemeStyles(): string {
	return `
		:root[data-theme="light"] {
			--bg: #e8edf6;
			--bg-panel: #ffffff;
			--bg-panel-2: #f3f6fb;
			--bg-panel-3: #dfe7f2;
			--fg: #142033;
			--muted: #5c687c;
			--line: #c8d2e2;
			--line-strong: #9eabc0;
			--accent: #1f5fc8;
			--accent-soft: rgba(31, 95, 200, 0.1);
			--ok: #08784b;
			--danger: #c52945;
			--warn: #8a5a00;
			color-scheme: light;
		}

		:root[data-theme="light"],
		:root[data-theme="light"] body {
			background:
				linear-gradient(rgba(31, 95, 200, 0.035) 1px, transparent 1px),
				linear-gradient(90deg, rgba(31, 95, 200, 0.028) 1px, transparent 1px),
				radial-gradient(circle at 18% 10%, rgba(31, 95, 200, 0.12), transparent 0 24%),
				radial-gradient(circle at 82% 6%, rgba(8, 120, 75, 0.08), transparent 0 18%),
				linear-gradient(180deg, #f7f9fd 0%, #e9eff7 48%, #dde5f0 100%);
			background-size: 34px 34px, 34px 34px, auto, auto, auto;
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
			border-bottom-color: transparent;
			background:
				linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(232, 238, 248, 0.94)),
				#f4f7fb;
			color: var(--fg);
			box-shadow: 0 10px 28px rgba(40, 53, 84, 0.12);
		}

		:root[data-theme="light"] .shell,
		:root[data-theme="light"] .chat-stage,
		:root[data-theme="light"] .stream-layout,
		:root[data-theme="light"] .transcript-pane,
		:root[data-theme="light"] .transcript-current,
		:root[data-theme="light"] .transcript-archive {
			background: transparent;
			color: var(--fg);
		}

		:root[data-theme="light"] .landing-screen,
		:root[data-theme="light"] .chat-stage,
		:root[data-theme="light"] .stream-layout,
		:root[data-theme="light"] .transcript-pane {
			color: var(--fg);
		}

		:root[data-theme="light"] .mobile-topbar {
			border-bottom-color: transparent;
			background:
				linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(229, 236, 248, 0.94)),
				#f4f7fb;
			color: var(--fg);
			box-shadow: 0 12px 30px rgba(40, 53, 84, 0.14);
		}

		:root[data-theme="light"] .mobile-brand {
			background: rgba(255, 255, 255, 0.64);
			color: #142033;
			box-shadow: 0 8px 18px rgba(40, 53, 84, 0.1);
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

		:root[data-theme="light"] .topbar-kicker,
		:root[data-theme="light"] .archived-conversation-head,
		:root[data-theme="light"] .archived-conversation-head strong,
		:root[data-theme="light"] .message-role,
		:root[data-theme="light"] .message.user .message-meta strong,
		:root[data-theme="light"] .message.assistant .message-meta strong {
			border-color: rgba(31, 95, 200, 0.14);
			background: rgba(255, 255, 255, 0.72);
			color: #4d5a70;
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

		:root[data-theme="light"] #send-button::before {
			background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M8 13V4' stroke='%231d4f9a' stroke-width='1.6' stroke-linecap='round'/%3E%3Cpath d='M4.75 7.25L8 4L11.25 7.25' stroke='%231d4f9a' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		}

		:root[data-theme="light"] #interrupt-button::before {
			background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Crect x='4' y='4' width='8' height='8' rx='1.2' fill='%239d2439'/%3E%3C/svg%3E");
		}

		:root[data-theme="light"] #send-button:disabled,
		:root[data-theme="light"] #interrupt-button:disabled,
		:root[data-theme="light"] .composer button:disabled {
			border-color: rgba(158, 171, 192, 0.16);
			background: #edf3fb;
			color: #8d9ab0;
			opacity: 1;
			box-shadow: none;
		}

		:root[data-theme="light"] #send-button:disabled::before {
			background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M8 13V4' stroke='%238d9ab0' stroke-width='1.6' stroke-linecap='round'/%3E%3Cpath d='M4.75 7.25L8 4L11.25 7.25' stroke='%238d9ab0' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		}

		:root[data-theme="light"] #interrupt-button:disabled::before {
			background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Crect x='4' y='4' width='8' height='8' rx='1.2' fill='%238d9ab0'/%3E%3C/svg%3E");
		}

		:root[data-theme="light"] input,
		:root[data-theme="light"] select,
		:root[data-theme="light"] textarea,
		:root[data-theme="light"] #message,
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

		:root[data-theme="light"] #message {
			background: transparent;
			color: #172033;
			box-shadow: none;
		}

		:root[data-theme="light"] input::placeholder,
		:root[data-theme="light"] textarea::placeholder,
		:root[data-theme="light"] #message::placeholder {
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

		:root[data-theme="light"] .message.assistant .message-content h1,
		:root[data-theme="light"] .task-inbox-result-bubble .message-content h1,
		:root[data-theme="light"] .conn-run-result-bubble .message-content h1 {
			color: #142033;
		}

		:root[data-theme="light"] .message.assistant .message-content h2,
		:root[data-theme="light"] .task-inbox-result-bubble .message-content h2,
		:root[data-theme="light"] .conn-run-result-bubble .message-content h2 {
			color: #1d4f9a;
		}

		:root[data-theme="light"] .message.assistant .message-content h3,
		:root[data-theme="light"] .task-inbox-result-bubble .message-content h3,
		:root[data-theme="light"] .conn-run-result-bubble .message-content h3 {
			color: #0f766e;
		}

		:root[data-theme="light"] .message.assistant .message-content h4,
		:root[data-theme="light"] .message.assistant .message-content h5,
		:root[data-theme="light"] .message.assistant .message-content h6,
		:root[data-theme="light"] .task-inbox-result-bubble .message-content h4,
		:root[data-theme="light"] .task-inbox-result-bubble .message-content h5,
		:root[data-theme="light"] .task-inbox-result-bubble .message-content h6,
		:root[data-theme="light"] .conn-run-result-bubble .message-content h4,
		:root[data-theme="light"] .conn-run-result-bubble .message-content h5,
		:root[data-theme="light"] .conn-run-result-bubble .message-content h6,
		:root[data-theme="light"] .message.assistant .message-content strong,
		:root[data-theme="light"] .task-inbox-result-bubble .message-content strong,
		:root[data-theme="light"] .conn-run-result-bubble .message-content strong {
			color: #8a5a00;
		}

		:root[data-theme="light"] .message-content a {
			color: #1b58d8;
		}

		:root[data-theme="light"] .message-content blockquote,
		:root[data-theme="light"] .task-inbox-result-bubble .message-content blockquote,
		:root[data-theme="light"] .conn-run-result-bubble .message-content blockquote {
			border-left-color: rgba(31, 95, 200, 0.34);
			background: #eaf2ff;
			color: #2d405e;
		}

		:root[data-theme="light"] .message-content th,
		:root[data-theme="light"] .task-inbox-result-bubble .message-content th,
		:root[data-theme="light"] .conn-run-result-bubble .message-content th {
			background: #dce8f8;
			color: #1d365c;
		}

		:root[data-theme="light"] .message-content td,
		:root[data-theme="light"] .task-inbox-result-bubble .message-content td,
		:root[data-theme="light"] .conn-run-result-bubble .message-content td {
			color: #26344f;
		}

		:root[data-theme="light"] .message-content code,
		:root[data-theme="light"] .message-content pre,
		:root[data-theme="light"] .message-content .code-block,
		:root[data-theme="light"] .message.assistant .message-content pre,
		:root[data-theme="light"] .message.assistant .message-content .code-block,
		:root[data-theme="light"] .message.assistant .message-content .code-block pre,
		:root[data-theme="light"] .task-inbox-result-bubble .message-content code,
		:root[data-theme="light"] .task-inbox-result-bubble .message-content pre,
		:root[data-theme="light"] .task-inbox-result-bubble .message-content .code-block,
		:root[data-theme="light"] .conn-run-result-bubble .message-content code,
		:root[data-theme="light"] .conn-run-result-bubble .message-content pre,
		:root[data-theme="light"] .conn-run-result-bubble .message-content .code-block {
			background: #eef3fb;
			color: #152238;
		}

		:root[data-theme="light"] .message-content .code-block-header,
		:root[data-theme="light"] .message-content .code-block-language,
		:root[data-theme="light"] .task-inbox-result-bubble .message-content .code-block-language,
		:root[data-theme="light"] .conn-run-result-bubble .message-content .code-block-language {
			background: #e1eaf6;
			color: #4d5a70;
		}

		:root[data-theme="light"] .copy-code-button,
		:root[data-theme="light"] .conn-run-result-bubble .copy-code-button {
			border-color: rgba(31, 95, 200, 0.16);
			background: #f7faff;
			color: #365174;
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
		:root[data-theme="light"] .history-auto-load-status,
		:root[data-theme="light"] .scroll-to-bottom-button {
			border-color: transparent;
			background: rgba(255, 255, 255, 0.86);
			color: #26344f;
			box-shadow: 0 12px 24px rgba(40, 53, 84, 0.1);
		}

		:root[data-theme="light"] .assistant-run-log-trigger.ok {
			border-color: rgba(8, 120, 75, 0.2);
			background: #e7f6ef;
			color: #08784b;
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
			background: rgba(255, 255, 255, 0.96);
			color: #172033;
			box-shadow: 0 10px 24px rgba(40, 53, 84, 0.08);
		}

		:root[data-theme="light"] .asset-modal-copy span {
			color: #667085;
		}

		:root[data-theme="light"] .context-usage-metric,
		:root[data-theme="light"] .context-usage-model,
		:root[data-theme="light"] .context-usage-dialog-hero,
		:root[data-theme="light"] .context-usage-dialog-metric,
		:root[data-theme="light"] .context-usage-dialog-model,
		:root[data-theme="light"] .chat-run-log-item,
		:root[data-theme="light"] .confirm-dialog-body,
		:root[data-theme="light"] .conn-run-section {
			background: #f3f6fb;
			color: #24324a;
			box-shadow: none;
		}

		:root[data-theme="light"] .context-usage-dialog-hero {
			background:
				linear-gradient(180deg, #ffffff 0%, #eaf1fb 100%),
				#ffffff;
			box-shadow: 0 12px 26px rgba(40, 53, 84, 0.1);
		}

		:root[data-theme="light"] .context-usage-dialog-head strong,
		:root[data-theme="light"] .context-usage-dialog-kicker,
		:root[data-theme="light"] .context-usage-dialog-hero p,
		:root[data-theme="light"] .context-usage-dialog-metric span,
		:root[data-theme="light"] .context-usage-dialog-metric em,
		:root[data-theme="light"] .context-usage-dialog-model span {
			color: #596579;
		}

		:root[data-theme="light"] .context-usage-dialog-main strong,
		:root[data-theme="light"] .context-usage-dialog-metric strong {
			color: #142033;
		}

		:root[data-theme="light"] .context-usage-dialog {
			background: rgba(232, 238, 248, 0.72);
		}

		:root[data-theme="light"] .context-usage-dialog-meter {
			background: #dce6f4;
			box-shadow: inset 0 1px 0 rgba(23, 32, 51, 0.05);
		}

		:root[data-theme="light"] .context-usage-dialog-meter span {
			background: linear-gradient(90deg, #08784b, #1f5fc8);
			box-shadow: 0 0 16px rgba(31, 95, 200, 0.18);
		}

		:root[data-theme="light"] .context-usage-dialog-main span {
			background: #e8f0ff;
			color: #1d4f9a;
		}

		:root[data-theme="light"] .context-usage-dialog-model span {
			background: transparent;
		}

		:root[data-theme="light"] .context-usage-dialog[data-status="caution"] .context-usage-dialog-main span {
			background: #fff4dc;
			color: #8a5a00;
		}

		:root[data-theme="light"] .context-usage-dialog[data-status="warning"] .context-usage-dialog-main span {
			background: #fff0e6;
			color: #9a4b12;
		}

		:root[data-theme="light"] .context-usage-dialog[data-status="danger"] .context-usage-dialog-main span {
			background: #fff0f3;
			color: #9d2439;
		}

		:root[data-theme="light"] .chat-run-log-item code,
		:root[data-theme="light"] .context-usage-model code,
		:root[data-theme="light"] .context-usage-dialog-model code,
		:root[data-theme="light"] .conn-run-meta code,
		:root[data-theme="light"] .conn-manager-meta code,
		:root[data-theme="light"] .task-inbox-source,
		:root[data-theme="light"] .task-inbox-time,
		:root[data-theme="light"] .task-inbox-meta,
		:root[data-theme="light"] .task-inbox-item-meta,
		:root[data-theme="light"] .task-inbox-item-meta span,
		:root[data-theme="light"] .task-inbox-item-meta code,
		:root[data-theme="light"] .asset-pill span,
		:root[data-theme="light"] .asset-pill small,
		:root[data-theme="light"] .asset-meta,
		:root[data-theme="light"] .file-chip span,
		:root[data-theme="light"] .file-chip-label,
		:root[data-theme="light"] .conn-run-event span,
		:root[data-theme="light"] .conn-manager-meta,
		:root[data-theme="light"] .conn-manager-run-summary,
		:root[data-theme="light"] .conn-manager-run-item,
		:root[data-theme="light"] .conn-manager-filter-field span,
		:root[data-theme="light"] .conn-manager-selected-count,
		:root[data-theme="light"] .conn-editor-field,
		:root[data-theme="light"] .conn-editor-field-hint,
		:root[data-theme="light"] .conn-editor-section-hint,
		:root[data-theme="light"] .conn-editor-target-preview code {
			color: #596579;
		}

		:root[data-theme="light"] .conn-editor-field span,
		:root[data-theme="light"] .conn-editor-advanced summary {
			color: #24324a;
		}

		:root[data-theme="light"] .task-inbox-item-kind {
			background: #e8f0ff;
			color: #1d4f9a;
		}

		:root[data-theme="light"] .task-inbox-item-title-row strong {
			color: #596579;
		}

		:root[data-theme="light"] .asset-modal,
		:root[data-theme="light"] .asset-modal-shell,
		:root[data-theme="light"] .conn-manager-dialog,
		:root[data-theme="light"] .conn-editor-dialog,
		:root[data-theme="light"] .task-inbox-view {
			background:
				linear-gradient(rgba(36, 84, 214, 0.032) 1px, transparent 1px),
				linear-gradient(90deg, rgba(36, 84, 214, 0.024) 1px, transparent 1px),
				linear-gradient(180deg, #f7f9fc 0%, #edf2f8 100%);
			background-size: 34px 34px, 34px 34px, auto;
			color: #172033;
		}

		:root[data-theme="light"] .asset-modal-panel,
		:root[data-theme="light"] .task-inbox-pane,
		:root[data-theme="light"] .conn-manager-panel,
		:root[data-theme="light"] .conn-editor-panel {
			border-color: transparent;
			background:
				linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 250, 253, 0.98) 100%),
				#ffffff;
			color: #172033;
			box-shadow: 0 20px 46px rgba(40, 53, 84, 0.12);
		}

		:root[data-theme="light"] .task-inbox-list,
		:root[data-theme="light"] .task-inbox-item,
		:root[data-theme="light"] .conn-manager-list,
		:root[data-theme="light"] .conn-editor-form {
			border-color: transparent;
			background: transparent;
			color: #172033;
			box-shadow: none;
		}

		:root[data-theme="light"] :is(.asset-pill),
		:root[data-theme="light"] :is(.asset-empty),
		:root[data-theme="light"] :is(.file-chip),
		:root[data-theme="light"] :is(.conn-manager-item),
		:root[data-theme="light"] :is(.conn-manager-run-item) {
			border-color: transparent;
			background: rgba(255, 255, 255, 0.9);
			color: #24324a;
			box-shadow:
				0 10px 24px rgba(40, 53, 84, 0.08),
				inset 0 1px 0 rgba(255, 255, 255, 0.9);
		}

		:root[data-theme="light"] :is(.conn-manager-toolbar, .conn-editor-field, .conn-editor-advanced) {
			border-color: transparent;
			background: transparent;
			color: #596579;
			box-shadow: none;
		}

		:root[data-theme="light"] .conn-manager-filter-field select,
		:root[data-theme="light"] .conn-editor-field input,
		:root[data-theme="light"] .conn-editor-field select,
		:root[data-theme="light"] .conn-editor-field textarea {
			border-color: transparent;
			background: #ffffff;
			color: #172033;
			box-shadow:
				inset 0 0 0 1px rgba(36, 84, 214, 0.08),
				0 8px 18px rgba(40, 53, 84, 0.06);
		}

		:root[data-theme="light"] .conn-editor-time-input + .flatpickr-input {
			border-color: transparent;
			background: #ffffff;
			color: #172033;
			box-shadow:
				inset 0 0 0 1px rgba(36, 84, 214, 0.12),
				0 8px 18px rgba(40, 53, 84, 0.07);
		}

		:root[data-theme="light"] .conn-editor-time-input + .flatpickr-input::placeholder {
			color: #8a95a8;
		}

		:root[data-theme="light"] .conn-editor-field input:focus,
		:root[data-theme="light"] .conn-editor-field select:focus,
		:root[data-theme="light"] .conn-editor-field textarea:focus {
			outline: none;
			box-shadow:
				inset 0 0 0 1px rgba(31, 95, 200, 0.32),
				0 10px 22px rgba(31, 95, 200, 0.12);
		}

		:root[data-theme="light"] .conn-editor-current-target,
		:root[data-theme="light"] .conn-editor-target-preview {
			border-color: transparent;
			background: rgba(232, 240, 255, 0.72);
			color: #40516d;
			box-shadow: inset 3px 0 0 rgba(31, 95, 200, 0.26);
		}

		:root[data-theme="light"] .conn-editor-target-preview {
			background: rgba(232, 240, 255, 0.72);
		}

		:root[data-theme="light"] .conn-editor-target-preview strong {
			color: #172033;
		}

		:root[data-theme="light"] .conn-editor-target-note {
			color: #8a5a00;
		}

		:root[data-theme="light"] .conn-editor-form .asset-modal-actions button:first-child {
			border-color: transparent;
			background: #1f5fc8;
			color: #ffffff;
			box-shadow: 0 10px 22px rgba(31, 95, 200, 0.2);
		}

		:root[data-theme="light"] :is(.asset-pill.active) {
			background: #e8f6ef;
			color: #172033;
			box-shadow: inset 3px 0 0 rgba(8, 120, 75, 0.42);
		}

		:root[data-theme="light"] .asset-pill strong,
		:root[data-theme="light"] .file-chip strong {
			color: #172033;
		}

		:root[data-theme="light"] .file-chip-badge {
			background: #e8f0ff;
			color: #1d4f9a;
		}

		:root[data-theme="light"] .file-chip-remove {
			background: rgba(197, 41, 69, 0.07);
			color: #9d2439;
		}

		:root[data-theme="light"] .task-inbox-result-bubble,
		:root[data-theme="light"] .conn-run-result-bubble {
			background: #ffffff;
			color: #172033;
			box-shadow:
				0 12px 26px rgba(40, 53, 84, 0.1),
				inset 0 1px 0 rgba(255, 255, 255, 0.88);
		}

		:root[data-theme="light"] .task-inbox-result-bubble > strong,
		:root[data-theme="light"] .conn-run-result-bubble > strong {
			color: #596579;
		}

		:root[data-theme="light"] .conn-manager-item.is-highlighted {
			background: #e8f6ef;
			box-shadow: inset 3px 0 0 rgba(8, 120, 75, 0.44);
		}

		:root[data-theme="light"] .conn-manager-title-row strong {
			color: #142033;
		}

		:root[data-theme="light"] .conn-manager-status.active {
			border-color: rgba(8, 120, 75, 0.24);
			background: #e8f6ef;
			color: #08784b;
		}

		:root[data-theme="light"] .conn-manager-status.completed {
			border-color: rgba(31, 95, 200, 0.18);
			background: #e8f0ff;
			color: #1d4f9a;
		}

		:root[data-theme="light"] .conn-manager-status.paused {
			border-color: rgba(138, 90, 0, 0.24);
			background: #fff4dc;
			color: #8a5a00;
		}

		:root[data-theme="light"] .conn-manager-bulk-actions .danger-action,
		:root[data-theme="light"] .task-inbox-read-dot,
		:root[data-theme="light"] .conn-editor-error {
			border-color: rgba(197, 41, 69, 0.22);
			background: #fff0f3;
			color: #9d2439;
		}

		:root[data-theme="light"] .conn-time-picker-calendar {
			background:
				linear-gradient(180deg, #ffffff 0%, #eef3fa 100%),
				#ffffff;
			color: #172033;
			box-shadow: 0 22px 48px rgba(40, 53, 84, 0.18);
		}

		:root[data-theme="light"] .conn-time-picker-calendar::after {
			border-bottom-color: #ffffff;
		}

		:root[data-theme="light"] .conn-time-picker-calendar.arrowBottom::after {
			border-top-color: #eef3fa;
		}

		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-month,
		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-current-month,
		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-monthDropdown-months,
		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-weekday,
		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-day,
		:root[data-theme="light"] .conn-time-picker-calendar .numInput {
			color: #172033;
			fill: #172033;
		}

		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-prev-month,
		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-next-month {
			color: #40516d;
			fill: #40516d;
		}

		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-prev-month:hover,
		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-next-month:hover {
			color: #1f5fc8;
			fill: #1f5fc8;
		}

		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-time {
			border-top-color: rgba(36, 84, 214, 0.12);
		}

		:root[data-theme="light"] .conn-time-picker-calendar input,
		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-am-pm {
			color: #172033;
		}

		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-day.today {
			border-color: rgba(31, 95, 200, 0.38);
		}

		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-day:hover,
		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-day:focus {
			border-color: rgba(31, 95, 200, 0.18);
			background: #e8f0ff;
			color: #1d4f9a;
		}

		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-day.selected,
		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-day.startRange,
		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-day.endRange {
			border-color: #1f5fc8;
			background: #1f5fc8;
			color: #ffffff;
		}

		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-day.flatpickr-disabled,
		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-day.prevMonthDay,
		:root[data-theme="light"] .conn-time-picker-calendar .flatpickr-day.nextMonthDay {
			color: #9aa6b8;
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

		:root[data-theme="light"] .mobile-drawer-head {
			background: #ffffff;
			color: #172033;
			box-shadow: 0 12px 28px rgba(40, 53, 84, 0.1);
		}

		:root[data-theme="light"] .mobile-drawer-title span {
			color: #596579;
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
