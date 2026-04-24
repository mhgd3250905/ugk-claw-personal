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
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
			gap: 12px;
			background: transparent;
			color: var(--muted);
			font-size: 11px;
			line-height: 1.5;
			text-transform: uppercase;
			letter-spacing: 0.08em;
		}

		.asset-modal-head.topbar,
		.task-inbox-head.topbar {
			grid-column: auto;
			width: 100%;
			margin: 0;
		}

		.asset-modal-actions {
			display: flex;
			align-items: center;
			gap: 8px;
			flex-wrap: nowrap;
			min-width: 0;
			overflow-x: auto;
			overflow-y: hidden;
			scrollbar-width: none;
			-ms-overflow-style: none;
		}

		.asset-modal-actions::-webkit-scrollbar {
			display: none;
		}

		.asset-modal-actions button,
		.asset-pill button {
			flex: 0 0 auto;
			white-space: nowrap;
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
				align-items: stretch;
				justify-content: stretch;
				padding: 0;
				background: #01030a;
			}

			.asset-modal {
				position: relative;
				width: 100%;
				height: 100dvh;
				max-height: 100dvh;
				border: 0;
				border-radius: 0;
				background:
					radial-gradient(circle at 24% 0%, rgba(101, 209, 255, 0.1), transparent 32%),
					linear-gradient(180deg, #060711 0%, #01030a 42%, #01030a 100%);
				box-shadow: none;
				overflow: hidden;
			}

			.asset-modal::before {
				display: none;
			}

			.asset-modal-head {
				position: sticky;
				top: 0;
				z-index: 2;
				display: flex;
				flex-direction: row;
				align-items: center;
				justify-content: space-between;
				gap: 10px;
				padding: calc(10px + env(safe-area-inset-top)) 12px 10px;
				border-bottom: 0;
				background: #101421;
				box-shadow:
					0 14px 32px rgba(0, 0, 0, 0.3),
					inset 0 1px 0 rgba(255, 255, 255, 0.04);
			}

			.mobile-work-topbar {
				display: grid;
				grid-template-columns: minmax(0, 1fr) auto;
				width: 100%;
				min-height: 48px;
				margin: 0;
				justify-items: stretch;
			}

			.mobile-work-title-row {
				display: grid;
				grid-template-columns: 36px minmax(0, 1fr);
				align-items: center;
				gap: 10px;
				min-width: 0;
			}

			.mobile-work-back-button {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 36px;
				height: 36px;
				min-width: 36px;
				padding: 0;
				border: 0;
				border-radius: 4px;
				background: #171a28;
				color: rgba(242, 246, 255, 0.92);
				font-size: 17px;
				line-height: 1;
				box-shadow: none;
				text-transform: none;
				letter-spacing: 0;
			}

			.mobile-work-topbar .asset-modal-actions,
			.mobile-work-topbar .task-inbox-head-actions {
				min-width: 0;
				justify-content: flex-end;
				overflow-x: auto;
				scrollbar-width: none;
				-ms-overflow-style: none;
			}

			.mobile-work-topbar .asset-modal-actions::-webkit-scrollbar,
			.mobile-work-topbar .task-inbox-head-actions::-webkit-scrollbar {
				display: none;
			}

			.mobile-work-topbar .asset-modal-actions button,
			.mobile-work-topbar .task-inbox-head-button {
				min-height: 36px;
				padding: 0 12px;
				border-radius: 4px;
				text-transform: none;
				letter-spacing: 0.02em;
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
				display: flex;
				gap: 6px;
				justify-content: flex-end;
				overflow-x: auto;
			}

			.asset-modal-actions button {
				min-height: 38px;
				padding: 0 12px;
				border-radius: 4px;
				border: 0;
				background: #171a28;
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
				padding: 12px 10px calc(18px + env(safe-area-inset-bottom));
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
				min-height: 72px;
				padding: 12px;
				border: 0;
				border-radius: 4px;
				background: #0b0e19;
				box-shadow:
					0 10px 24px rgba(0, 0, 0, 0.18),
					inset 0 1px 0 rgba(255, 255, 255, 0.035);
			}

			.asset-pill {
				grid-template-columns: minmax(0, 1fr) auto;
				gap: 12px;
			}

			.asset-pill > div {
				display: grid;
				gap: 6px;
				min-width: 0;
			}

			.asset-pill strong {
				font-size: 13px;
			}

			.asset-pill span {
				color: rgba(226, 234, 255, 0.54);
				font-family: var(--font-mono);
				font-size: 10px;
				line-height: 1.55;
				overflow-wrap: anywhere;
				white-space: normal;
			}

			.asset-pill button {
				min-height: 38px;
				border-radius: 4px;
				text-transform: none;
				letter-spacing: 0.02em;
			}

			.asset-pill.active {
				border: 0;
				background: #0b1616;
				box-shadow: inset 3px 0 0 rgba(141, 255, 178, 0.44);
			}

			.conn-manager-dialog.open,
			.conn-editor-dialog.open {
				align-items: stretch;
				justify-content: stretch;
				padding: 0;
				background: #01030a;
			}

			.conn-manager-panel,
			.conn-editor-panel {
				width: 100%;
				height: 100dvh;
				max-height: 100dvh;
				border: 0;
				border-radius: 0;
				background: #01030a;
				box-shadow: none;
			}

			.conn-editor-form {
				display: grid;
				grid-template-rows: auto minmax(0, 1fr);
				height: 100%;
				min-height: 0;
			}

			.conn-manager-toolbar {
				position: sticky;
				top: 0;
				z-index: 1;
				grid-template-columns: 1fr;
				gap: 10px;
				padding: 10px;
				border: 0;
				border-radius: 4px;
				background: #0b0e19;
				box-shadow:
					0 10px 24px rgba(0, 0, 0, 0.2),
					inset 0 1px 0 rgba(255, 255, 255, 0.035);
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

			.conn-manager-bulk-actions {
				grid-template-columns: repeat(3, minmax(0, 1fr));
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

			.conn-manager-title-row {
				align-items: flex-start;
				justify-content: space-between;
			}

			.conn-manager-status {
				background: rgba(255, 255, 255, 0.04);
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
				border: 0;
				border-radius: 4px;
				background: #080a13;
			}

			.conn-editor-body {
				gap: 14px;
				overflow-y: auto;
				padding-bottom: calc(24px + env(safe-area-inset-bottom));
			}

			.conn-editor-field {
				gap: 8px;
				padding: 12px;
				border: 0;
				border-radius: 4px;
				background: #0b0e19;
				box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
			}

			.conn-editor-advanced {
				padding: 12px;
				border: 0;
				border-radius: 4px;
				background: #0b0e19;
				box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
			}

			.conn-editor-field input,
			.conn-editor-field select,
			.conn-editor-field textarea {
				min-height: 42px;
				background: #050711;
			}

			.conn-editor-field textarea {
				min-height: 138px;
			}

			.conn-run-details-dialog.open {
				align-items: flex-end;
				padding: 0 8px;
			}

			.conn-run-details-panel {
				width: 100%;
				max-height: min(86dvh, calc(100dvh - 56px));
				border: 0;
				border-radius: 4px;
				background:
					radial-gradient(circle at 24% 0%, rgba(101, 209, 255, 0.12), transparent 34%),
					#060711;
			}

			.mobile-drawer-backdrop {
				background: rgba(1, 3, 10, 0.42);
			}

			.mobile-conversation-drawer {
				width: min(88vw, 360px);
				max-width: calc(100vw - 8px);
				padding: calc(12px + env(safe-area-inset-top)) 10px calc(12px + env(safe-area-inset-bottom));
				overflow: hidden;
				border-right: 0;
				background:
					linear-gradient(180deg, #121522 0%, #070914 34%, #04050d 100%),
					#060711;
				box-shadow:
					22px 0 56px rgba(0, 0, 0, 0.58),
					inset 1px 0 0 rgba(255, 255, 255, 0.04);
			}

			.mobile-drawer-head {
				position: sticky;
				top: 0;
				z-index: 2;
				display: grid;
				grid-template-columns: minmax(0, 1fr) 40px;
				align-items: center;
				gap: 10px;
				margin-bottom: 10px;
				padding: 12px;
				border-bottom: 0;
				border-radius: 8px;
				background: #101421;
				box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
			}

			.mobile-drawer-title {
				min-width: 0;
				gap: 4px;
			}

			.mobile-drawer-title strong {
				font-size: 14px;
				letter-spacing: 0.02em;
			}

			.mobile-drawer-title span {
				display: block;
				max-width: 22ch;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				color: rgba(226, 234, 255, 0.48);
			}

			.mobile-drawer-close {
				width: 40px;
				height: 40px;
				border: 0;
				border-radius: 6px;
				background: #171a28;
				box-shadow: none;
			}

			.mobile-drawer-close:hover:not(:disabled),
			.mobile-drawer-close:focus-visible {
				background: #202438;
				box-shadow: none;
				transform: none;
			}

			.mobile-conversation-list {
				gap: 8px;
				padding: 0 0 2px;
			}

			.mobile-conversation-empty {
				border: 0;
				border-radius: 8px;
				background: #0b0e19;
				box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
			}

			.conversation-item-shell {
				display: block;
			}

			.conversation-item-delete {
				position: absolute;
				top: 8px;
				right: 8px;
				z-index: 2;
				width: 28px;
				min-width: 28px;
				height: 28px;
				padding: 0;
				border: 0;
				border-radius: 6px;
				background: #171a28;
				color: rgba(255, 184, 198, 0.74);
				font-size: 16px;
				box-shadow: none;
			}

			.conversation-item-delete:hover:not(:disabled),
			.conversation-item-delete:focus-visible {
				border: 0;
				background: rgba(255, 113, 136, 0.16);
				color: rgba(255, 226, 232, 0.96);
				box-shadow: none;
				transform: none;
			}

			.mobile-conversation-item {
				position: relative;
				grid-template-rows: auto minmax(0, 1fr) auto;
				gap: 6px;
				min-height: 92px;
				padding: 11px 46px 10px 14px;
				border: 0;
				border-radius: 8px;
				background: #0b0e19;
				align-content: start;
				line-height: normal;
				letter-spacing: 0;
				text-transform: none;
				overflow: hidden;
				opacity: 1;
				box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
			}

			.mobile-conversation-item > * {
				position: relative;
				z-index: 1;
				min-width: 0;
			}

			.mobile-conversation-item > .conversation-item-delete {
				position: absolute;
				top: 8px;
				right: 8px;
				z-index: 2;
			}

			.mobile-conversation-item:disabled {
				opacity: 1;
				cursor: default;
			}

			.mobile-conversation-item:hover:not(:disabled),
			.mobile-conversation-item:focus-visible {
				border: 0;
				background: #111625;
				box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
				transform: none;
			}

			.mobile-conversation-item.is-active {
				border: 0;
				background: #151a2b;
				box-shadow:
					inset 0 1px 0 rgba(255, 255, 255, 0.05),
					0 12px 28px rgba(0, 0, 0, 0.22);
			}

			.mobile-conversation-item.is-active::before {
				content: "";
				position: absolute;
				left: 0;
				top: 10px;
				bottom: 10px;
				width: 3px;
				border-radius: 999px;
				background: linear-gradient(180deg, #c9d2ff, #8dffb2);
				box-shadow: 0 0 18px rgba(201, 210, 255, 0.22);
				z-index: 0;
			}

			.mobile-conversation-title {
				color: rgba(248, 251, 255, 0.98);
				font-size: 13px;
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
				justify-content: flex-start;
				gap: 6px;
				color: rgba(226, 234, 255, 0.5);
				font-size: 11px;
				line-height: 1.4;
				letter-spacing: 0.02em;
			}

			.mobile-conversation-meta span {
				display: inline-flex;
				align-items: center;
				min-height: 20px;
				padding: 0 7px;
				border-radius: 4px;
				background: rgba(238, 244, 255, 0.055);
			}

			.mobile-conversation-meta span:first-child {
				max-width: 150px;
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
				<header class="topbar asset-modal-head mobile-work-topbar">
					<div class="mobile-work-title-row">
						<button id="close-asset-modal-button" class="mobile-work-back-button" type="button" aria-label="返回对话">
							<span aria-hidden="true">&larr;</span>
						</button>
						<div class="asset-modal-copy">
							<strong id="asset-modal-title">可复用资产</strong>
						</div>
					</div>
					<div class="asset-modal-actions mobile-work-topbar-actions">
						<button id="refresh-assets-button" type="button">刷新文件库</button>
					</div>
				</header>
				<div class="asset-modal-body">
					<div id="asset-modal-list" class="asset-modal-list"></div>
				</div>
			</section>
		</div>
	`;
}
