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
		}

		.selected-asset-list {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			align-items: flex-start;
		}

		.file-chip {
			display: inline-flex;
			align-items: center;
			gap: 10px;
			min-width: 0;
			max-width: 100%;
			padding: 6px 10px 6px 8px;
			border: 1px solid rgba(255, 255, 255, 0.08);
			border-radius: 14px;
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
			border-radius: 7px;
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
			text-overflow: ellipsis;
			white-space: nowrap;
			color: rgba(238, 244, 255, 0.88);
			font-size: 12px;
			line-height: 1.5;
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
			border-radius: 999px;
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
			.drop-zone {
				display: none;
			}

			.file-list,
			.selected-asset-list {
				flex-wrap: nowrap;
				overflow-x: auto;
				overflow-y: hidden;
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
