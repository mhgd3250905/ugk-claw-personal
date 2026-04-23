export function getPlaygroundAssetBaseStyles(): string {
	return `
		.drop-zone {
			display: grid;
			gap: 8px;
			border: 1px dashed rgba(255, 255, 255, 0.14);
			background: rgba(255, 255, 255, 0.04);
			backdrop-filter: none;
			padding: 12px;
			transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
		}

		.drop-zone-top {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			gap: 12px;
		}

		.composer.drag-active,
		.drop-zone.drag-active {
			border-color: var(--accent);
			background: rgba(201, 210, 255, 0.08);
			box-shadow: inset 0 0 0 1px rgba(201, 210, 255, 0.16);
		}

		.drop-zone-label {
			display: grid;
			gap: 4px;
			color: rgba(238, 244, 255, 0.56);
			font-size: 11px;
			line-height: 1.5;
			text-transform: uppercase;
			letter-spacing: 0.08em;
		}

		.file-input {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}

		.file-downloads,
		.asset-modal-list {
			display: grid;
			gap: 6px;
		}

		.file-download,
		.asset-pill {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 10px;
			align-items: center;
			border: 1px solid var(--line);
			background: rgba(16, 24, 44, 0.5);
			padding: 8px 10px;
			font-size: 11px;
			line-height: 1.5;
			color: var(--muted);
		}

		.file-download strong,
		.asset-pill strong {
			display: block;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			color: var(--fg);
			font-size: 11px;
		}

		.file-list {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			align-items: flex-start;
			max-height: 118px;
			overflow-y: auto;
			overflow-x: hidden;
			padding-right: 2px;
			scrollbar-width: thin;
			scrollbar-color: rgba(201, 210, 255, 0.18) transparent;
		}

		.selected-asset-list {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			align-items: flex-start;
			max-height: 118px;
			overflow-y: auto;
			overflow-x: hidden;
			padding-right: 2px;
			scrollbar-width: thin;
			scrollbar-color: rgba(201, 210, 255, 0.18) transparent;
		}

		.file-chip {
			display: inline-grid;
			grid-template-columns: 22px minmax(0, 1fr) auto;
			align-items: center;
			gap: 10px;
			flex: 0 1 min(180px, 100%);
			min-width: min(132px, 100%);
			max-width: min(220px, 100%);
			padding: 6px 10px 6px 8px;
			border: 1px solid rgba(255, 255, 255, 0.08);
			border-radius: 4px;
			background: rgba(255, 255, 255, 0.035);
			box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
		}

		.file-chip-badge {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 22px;
			height: 22px;
			flex-shrink: 0;
			border: 1px solid rgba(255, 255, 255, 0.08);
			border-radius: 4px;
			background: rgba(255, 255, 255, 0.06);
			color: rgba(238, 244, 255, 0.72);
			font-family: var(--font-mono);
			font-size: 9px;
			line-height: 1;
			letter-spacing: 0.04em;
			text-transform: uppercase;
		}

		.file-chip-label {
			min-width: 0;
			overflow: hidden;
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			white-space: normal;
			overflow-wrap: anywhere;
			color: rgba(238, 244, 255, 0.88);
			font-size: 12px;
			line-height: 1.28;
		}

		.file-chip-remove {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 18px;
			height: 18px;
			flex-shrink: 0;
			padding: 0;
			border: 0;
			border-radius: 4px;
			background: transparent;
			box-shadow: none;
			color: rgba(238, 244, 255, 0.58);
			font-size: 14px;
			line-height: 1;
			transform: none !important;
		}

		.file-chip-remove:hover:not(:disabled) {
			background: rgba(255, 255, 255, 0.08);
			color: rgba(255, 244, 247, 0.92);
			box-shadow: none;
		}

		.file-chip.pending {
			background: rgba(255, 255, 255, 0.04);
		}

		.file-chip.asset {
			background: rgba(255, 255, 255, 0.045);
		}

		.file-chip.asset .file-chip-badge {
			background: rgba(201, 210, 255, 0.08);
			color: rgba(226, 231, 255, 0.82);
		}

		.message-file-strip {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
		}

		.message-body.has-file-chips {
			display: grid;
			gap: 10px;
		}

		.message.user .message-file-strip {
			justify-content: flex-end;
		}

		.file-download-actions {
			display: inline-flex;
			gap: 6px;
			align-items: center;
		}

		.file-download a {
			border: 1px solid var(--accent);
			background: var(--accent-soft);
			color: var(--accent);
			padding: 6px 9px;
			text-decoration: none;
			text-transform: uppercase;
			letter-spacing: 0.08em;
		}

		.selected-assets {
			display: none;
			gap: 8px;
			padding: 0;
			border: 0;
			background: transparent;
			backdrop-filter: none;
		}

		.selected-assets.visible {
			display: grid;
		}

		.asset-modal-head {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 12px;
			color: var(--muted);
			font-size: 11px;
			line-height: 1.5;
			text-transform: uppercase;
			letter-spacing: 0.08em;
		}

		.asset-modal-actions {
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.asset-modal-actions button,
		.asset-pill button {
			padding: 6px 10px;
			font-size: 10px;
		}

		.asset-pill {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.asset-pill.active {
			border-color: rgba(201, 210, 255, 0.18);
			background: rgba(255, 255, 255, 0.08);
			box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
		}

	`;
}

export function getPlaygroundAssetModalStyles(): string {
	return `
		.asset-pill span {
			display: block;
		}

		.asset-empty {
			padding: 10px;
			border: 1px solid rgba(255, 255, 255, 0.08);
			background: rgba(255, 255, 255, 0.04);
			color: rgba(238, 244, 255, 0.56);
			font-size: 11px;
			line-height: 1.6;
		}

		.asset-modal-shell {
			position: fixed;
			inset: 0;
			z-index: 60;
			display: none;
			align-items: center;
			justify-content: center;
			padding: 24px;
			background: rgba(4, 8, 14, 0.54);
			backdrop-filter: none;
		}

		.asset-modal-shell.open {
			display: flex;
		}

		.asset-modal {
			width: min(760px, 100%);
			max-height: min(72vh, 720px);
			display: grid;
			grid-template-rows: auto minmax(0, 1fr);
			border: 1px solid rgba(255, 255, 255, 0.08);
			background:
				linear-gradient(180deg, rgba(19, 26, 38, 0.86), rgba(13, 18, 28, 0.88));
			box-shadow: 0 20px 80px rgba(0, 0, 0, 0.4);
			backdrop-filter: none;
		}

		.asset-modal-copy {
			display: grid;
			gap: 4px;
		}

		.asset-modal-copy strong {
			display: block;
			color: var(--fg);
			font-size: 13px;
			letter-spacing: 0.12em;
		}

		.asset-modal-copy span {
			display: block;
			color: var(--muted);
			font-size: 11px;
			line-height: 1.6;
			text-transform: none;
			letter-spacing: 0.04em;
		}

		.asset-modal-body {
			min-height: 0;
			padding: 14px;
			overflow-y: auto;
			border-top: 1px solid var(--line);
		}
	`;
}

export function getPlaygroundAssetLandingStyles(): string {
	return `
		.shell[data-stage-mode="landing"] .file-strip {
			display: grid;
			gap: 4px;
		}

		.shell[data-stage-mode="landing"] .drop-zone {
			padding: 0;
			border: 0;
			background: transparent;
			backdrop-filter: none;
		}

		.shell[data-stage-mode="landing"] .drop-zone-top {
			align-items: center;
		}

		.shell[data-stage-mode="landing"] .drop-zone-label {
			font-size: 10px;
			letter-spacing: 0.12em;
			color: rgba(214, 220, 255, 0.22);
		}

		.shell[data-stage-mode="landing"] .drop-zone-label span:last-child {
			display: none;
		}

		.shell[data-stage-mode="landing"] .composer-side {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 8px;
			align-content: center;
		}

		.shell[data-stage-mode="landing"] #send-button,
		.shell[data-stage-mode="landing"] #interrupt-button {
			min-width: 44px;
			min-height: 40px;
			padding: 0 14px;
			border: 0;
			border-radius: 4px;
			box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
		}

		.shell[data-stage-mode="landing"] #interrupt-button {
			order: 1;
			background: rgba(108, 68, 78, 0.88);
			color: rgba(255, 232, 236, 0.94);
		}

		.shell[data-stage-mode="landing"] #send-button {
			order: 2;
			background: rgba(67, 112, 91, 0.9);
			color: rgba(238, 255, 245, 0.96);
		}

		.shell[data-stage-mode="landing"] .selected-assets,
		.shell[data-stage-mode="landing"] .file-list {
			max-height: 126px;
			overflow: auto;
			scrollbar-width: none;
		}
	`;
}

export function getPlaygroundAssetMobileStyles(): string {
	return `
			.asset-modal-shell.open {
				align-items: flex-end;
				justify-content: center;
				padding: 0 8px;
				background:
					linear-gradient(180deg, rgba(1, 3, 10, 0.18), rgba(1, 3, 10, 0.82)),
					rgba(1, 3, 10, 0.58);
			}

			.asset-modal {
				position: relative;
				width: 100%;
				height: min(88dvh, calc(100dvh - 48px));
				max-height: min(88dvh, calc(100dvh - 48px));
				border: 1px solid rgba(201, 210, 255, 0.14);
				border-bottom: 0;
				border-radius: 4px;
				background:
					radial-gradient(circle at 22% 0%, rgba(101, 209, 255, 0.12), transparent 34%),
					linear-gradient(180deg, rgba(12, 16, 28, 0.98), rgba(5, 7, 13, 0.99));
				box-shadow:
					0 -24px 70px rgba(0, 0, 0, 0.48),
					inset 0 1px 0 rgba(255, 255, 255, 0.05);
				overflow: hidden;
			}

			.asset-modal::before {
				content: "";
				position: absolute;
				top: 9px;
				left: 50%;
				width: 42px;
				height: 4px;
				border-radius: 4px;
				background: rgba(226, 234, 255, 0.22);
				transform: translateX(-50%);
			}

			.asset-modal-head {
				position: sticky;
				top: 0;
				z-index: 2;
				display: grid;
				grid-template-columns: minmax(0, 1fr);
				gap: 12px;
				padding: 24px 16px 12px;
				border-bottom: 1px solid rgba(201, 210, 255, 0.1);
				background:
					linear-gradient(180deg, rgba(12, 16, 28, 0.99), rgba(12, 16, 28, 0.92));
			}

			.asset-modal-copy {
				gap: 5px;
			}

			.asset-modal-copy strong {
				font-size: 14px;
				letter-spacing: 0.08em;
			}

			.asset-modal-copy span {
				max-width: 28em;
				color: rgba(226, 234, 255, 0.56);
				font-size: 11px;
				line-height: 1.55;
			}

			.asset-modal-actions {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 8px;
			}

			.asset-modal-actions button {
				min-height: 42px;
				padding: 0 12px;
				border-radius: 4px;
				background: rgba(255, 255, 255, 0.055);
				text-transform: none;
				letter-spacing: 0.02em;
			}

			.conn-editor-form .asset-modal-actions button:first-child {
				grid-column: 1 / -1;
				border-color: rgba(141, 255, 178, 0.22);
				background: rgba(141, 255, 178, 0.08);
				color: rgba(218, 255, 230, 0.94);
			}

			.asset-modal-body {
				padding: 12px 12px calc(18px + env(safe-area-inset-bottom));
				overflow-y: auto;
				overscroll-behavior: contain;
				border-top: 0;
			}

			.asset-modal-list,
			.conn-manager-list,
			.conn-manager-run-list {
				gap: 10px;
			}

			.asset-pill,
			.conn-manager-item {
				min-height: 64px;
				padding: 12px;
				border-color: rgba(201, 210, 255, 0.11);
				border-radius: 4px;
				background:
					linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03)),
					rgba(8, 11, 20, 0.86);
				box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
			}

			.asset-pill {
				grid-template-columns: minmax(0, 1fr);
			}

			.asset-pill button {
				min-height: 38px;
				border-radius: 4px;
				text-transform: none;
				letter-spacing: 0.02em;
			}

			.conn-manager-toolbar {
				position: sticky;
				top: 0;
				z-index: 1;
				grid-template-columns: 1fr;
				gap: 10px;
				padding: 10px;
				border-radius: 4px;
				background: rgba(255, 255, 255, 0.045);
			}

			.conn-manager-filter-field {
				grid-template-columns: 1fr;
			}

			.conn-manager-filter-field select {
				min-height: 42px;
				border-radius: 4px;
			}

			.conn-manager-bulk-actions,
			.conn-manager-actions {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 8px;
				justify-content: stretch;
			}

			.conn-manager-actions button,
			.conn-manager-bulk-actions button,
			.conn-manager-run-actions button {
				min-height: 40px;
				border-radius: 4px;
				text-transform: none;
				letter-spacing: 0.02em;
			}

			.conn-manager-item {
				grid-template-columns: minmax(0, 1fr);
			}

			.conn-manager-select {
				justify-content: flex-start;
				padding-top: 0;
			}

			.conn-manager-select input {
				width: 22px;
				height: 22px;
			}

			.conn-manager-actions {
				grid-column: auto;
			}

			.conn-manager-meta {
				font-size: 11px;
				line-height: 1.6;
			}

			.conn-manager-run-item {
				border-radius: 4px;
			}

			.conn-run-details-dialog.open {
				align-items: flex-end;
				padding: 0 8px;
			}

			.conn-run-details-panel {
				width: 100%;
				max-height: min(86dvh, calc(100dvh - 56px));
				border-bottom: 0;
				border-radius: 4px;
				background:
					radial-gradient(circle at 24% 0%, rgba(101, 209, 255, 0.12), transparent 34%),
					rgba(8, 11, 20, 0.98);
			}

			.mobile-drawer-backdrop {
				background: rgba(1, 3, 10, 0.42);
			}

			.mobile-conversation-drawer {
				width: min(94vw, 380px);
				max-width: calc(100vw - 10px);
				padding: calc(16px + env(safe-area-inset-top)) 14px calc(16px + env(safe-area-inset-bottom));
				overflow: hidden;
				border-right-color: rgba(201, 210, 255, 0.18);
				background:
					radial-gradient(circle at 18% 6%, rgba(101, 209, 255, 0.18), transparent 34%),
					radial-gradient(circle at 88% 32%, rgba(201, 210, 255, 0.06), transparent 28%),
					linear-gradient(180deg, rgba(10, 14, 26, 0.995), rgba(4, 6, 12, 0.998));
				box-shadow:
					28px 0 70px rgba(0, 0, 0, 0.62),
					inset -1px 0 0 rgba(255, 255, 255, 0.04);
			}

			.mobile-drawer-head {
				position: sticky;
				top: 0;
				z-index: 2;
				padding: 6px 2px 14px;
				border-bottom: 1px solid rgba(201, 210, 255, 0.1);
				background: transparent;
			}

			.mobile-drawer-close {
				width: 40px;
				height: 40px;
				border-radius: 4px;
			}

			.mobile-conversation-list {
				gap: 8px;
				padding: 12px 0 2px;
			}

			.mobile-conversation-empty {
				border-radius: 4px;
			}

			.mobile-conversation-item {
				position: relative;
				grid-template-rows: auto auto auto;
				gap: 7px;
				min-height: 108px;
				padding: 13px 14px 12px 18px;
				border-radius: 4px;
				border-color: rgba(201, 210, 255, 0.1);
				background: rgba(8, 11, 20, 0.82);
				align-content: start;
				line-height: normal;
				letter-spacing: 0;
				text-transform: none;
				overflow: hidden;
				opacity: 1;
			}

			.mobile-conversation-item > * {
				position: relative;
				z-index: 1;
				min-width: 0;
			}

			.mobile-conversation-item:disabled {
				opacity: 1;
				cursor: default;
			}

			.mobile-conversation-item.is-active {
				border-color: rgba(101, 209, 255, 0.48);
				background: rgba(8, 11, 20, 0.82);
				box-shadow:
					inset 0 0 0 1px rgba(101, 209, 255, 0.08),
					0 12px 28px rgba(0, 0, 0, 0.16);
			}

			.mobile-conversation-item.is-active::before {
				content: "";
				position: absolute;
				left: 8px;
				top: 12px;
				bottom: 12px;
				width: 3px;
				border-radius: 4px;
				background: rgba(101, 209, 255, 0.9);
				box-shadow: none;
				z-index: 0;
			}

			.mobile-conversation-title {
				color: rgba(248, 251, 255, 0.98);
				font-size: 14px;
				line-height: 1.35;
				letter-spacing: 0.01em;
			}

			.mobile-conversation-preview {
				display: -webkit-box;
				font-size: 12px;
				line-height: 1.45;
				color: rgba(226, 234, 255, 0.66);
				white-space: normal;
				overflow-wrap: anywhere;
				word-break: break-word;
				-webkit-box-orient: vertical;
				-webkit-line-clamp: 2;
			}

			.mobile-conversation-meta {
				color: rgba(226, 234, 255, 0.5);
				font-size: 11px;
				line-height: 1.4;
				letter-spacing: 0.02em;
			}

			.mobile-conversation-meta span:first-child {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.mobile-conversation-meta span:last-child {
				flex: 0 0 auto;
			}

			.drop-zone {
				display: none;
			}

			.file-list,
			.selected-asset-list {
				flex-wrap: wrap;
				max-height: 96px;
				overflow-x: hidden;
				overflow-y: auto;
				padding-bottom: 2px;
				scrollbar-width: none;
			}

			.file-list::-webkit-scrollbar,
			.selected-asset-list::-webkit-scrollbar {
				display: none;
			}

			.selected-assets.visible {
				padding: 0;
			}
	`;
}

export function getPlaygroundAssetDialogs(): string {
	return `
		<div id="asset-modal" class="asset-modal-shell" aria-hidden="true" hidden>
			<section class="asset-modal" role="dialog" aria-modal="true" aria-labelledby="asset-modal-title">
				<div class="asset-modal-head">
					<div class="asset-modal-copy">
						<strong id="asset-modal-title">可复用资产</strong>
						<span>选中后会立刻回到当前输入区，并在文件区域显示为已复用资产。</span>
					</div>
					<div class="asset-modal-actions">
						<button id="refresh-assets-button" type="button">刷新</button>
						<button id="close-asset-modal-button" type="button">关闭</button>
					</div>
				</div>
				<div class="asset-modal-body">
					<div id="asset-modal-list" class="asset-modal-list"></div>
				</div>
			</section>
		</div>
	`;
}
