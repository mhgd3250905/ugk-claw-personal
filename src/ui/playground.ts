import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Marked, type Tokens } from "marked";

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
	return escapeHtml(value).replace(/`/g, "&#96;");
}

function isSafeHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

const playgroundMarkdownParser = new Marked({
	gfm: true,
	breaks: false,
	async: false,
	renderer: {
		html({ text }: Tokens.HTML | Tokens.Tag): string {
			return escapeHtml(text);
		},
		link({ href, title, text }: Tokens.Link): string {
			if (!isSafeHttpUrl(href)) {
				return escapeHtml(text);
			}
			const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";
			return `<a href="${escapeAttribute(href)}"${titleAttribute} target="_blank" rel="noreferrer noopener">${escapeHtml(text)}</a>`;
		},
	},
});

export function renderPlaygroundMarkdown(source: string): string {
	const normalized = String(source ?? "").replace(/\r\n?/g, "\n").trim();
	if (!normalized) {
		return "<p></p>";
	}

	const rendered = playgroundMarkdownParser.parse(normalized, { async: false });
	return String(rendered).trim() || "<p></p>";
}

function getPlaygroundStyles(): string {
	return `
		@font-face {
			font-family: "Agave";
			src: url("/assets/fonts/Agave-Regular.ttf") format("truetype");
			font-weight: 400;
			font-style: normal;
			font-display: swap;
		}

		@font-face {
			font-family: "Agave";
			src: url("/assets/fonts/Agave-Bold.ttf") format("truetype");
			font-weight: 700;
			font-style: normal;
			font-display: swap;
		}

		:root {
			--bg: #01030a;
			--bg-panel: #060711;
			--bg-panel-2: #0b0c18;
			--bg-panel-3: #090a15;
			--fg: #eef4ff;
			--muted: #8f93ad;
			--line: #1a1b2b;
			--line-strong: #2b2d42;
			--accent: #c9d2ff;
			--accent-soft: rgba(201, 210, 255, 0.08);
			--ok: #8dffb2;
			--danger: #ff7188;
			--warn: #ffd166;
			--conversation-width: 640px;
			--transcript-bottom-scroll-buffer: 96px;
			--font-sans: "OpenAI Sans", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
			--font-mono: "Agave", "SFMono-Regular", "Cascadia Mono", Consolas, "Lucida Console", monospace;
		}

		* {
			box-sizing: border-box;
		}

		.visually-hidden {
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

		html,
		body {
			margin: 0;
			height: 100%;
			background:
				radial-gradient(circle at 18% 14%, rgba(121, 105, 214, 0.14), transparent 0 18%),
				radial-gradient(circle at 78% 10%, rgba(255, 255, 255, 0.05), transparent 0 14%),
				linear-gradient(180deg, #02030a 0%, #04050d 38%, #090611 100%);
			background-size: auto;
			color: var(--fg);
			font-family: var(--font-sans);
			overflow: hidden;
		}

		body {
			padding: 24px;
			display: flex;
			justify-content: center;
		}

		.shell {
			width: min(1180px, 100%);
			height: calc(100vh - 40px);
			margin: 0 auto;
			border: 0;
			background: transparent;
			box-shadow: none;
			backdrop-filter: none;
			display: grid;
			grid-template-rows: auto minmax(0, 1fr);
			overflow: hidden;
		}

		.topbar {
			display: grid;
			grid-template-columns: 1fr;
			gap: 14px;
			width: min(840px, calc(100% - 40px));
			margin: 0 auto;
			padding: 28px 0 16px;
			border-bottom: 1px solid rgba(255, 255, 255, 0.08);
			align-items: center;
			justify-items: center;
		}

		.topbar-right,
		.transcript-pane .pane-head {
			display: none !important;
		}

		.topbar-right {
			display: grid;
			gap: 8px;
			justify-items: end;
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.12em;
			color: rgba(238, 244, 255, 0.42);
		}

		.mobile-topbar {
			display: none;
			position: relative;
			width: 100%;
			align-items: center;
		}

		.mobile-brand {
			display: inline-flex;
			align-items: center;
			gap: 10px;
			min-width: 0;
			padding: 0;
			border: 0;
			background: transparent;
			box-shadow: none;
			text-align: left;
		}

		.mobile-brand:hover:not(:disabled),
		.mobile-brand:focus-visible {
			border-color: transparent;
			background: transparent;
			box-shadow: none;
			transform: none;
		}

		.mobile-brand-logo {
			display: block;
			width: 28px;
			height: 28px;
			flex: 0 0 auto;
			filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.26));
		}

		.mobile-brand-copy {
			display: grid;
			min-width: 0;
		}

		.mobile-brand-wordmark {
			display: block;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			color: rgba(242, 246, 255, 0.94);
			font-size: 13px;
			font-weight: 600;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		.mobile-topbar-button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 36px;
			height: 36px;
			padding: 0;
			border: 1px solid rgba(201, 210, 255, 0.12);
			background: rgba(255, 255, 255, 0.04);
			box-shadow:
				inset 0 1px 0 rgba(255, 255, 255, 0.05),
				0 10px 20px rgba(0, 0, 0, 0.16);
		}

		.mobile-topbar-button svg {
			width: 18px;
			height: 18px;
			stroke: currentColor;
		}

		.mobile-topbar-button:hover:not(:disabled),
		.mobile-topbar-button:focus-visible {
			border-color: rgba(201, 210, 255, 0.24);
			background: rgba(255, 255, 255, 0.08);
			color: #f7f9ff;
			transform: none;
			box-shadow:
				inset 0 1px 0 rgba(255, 255, 255, 0.08),
				0 12px 24px rgba(0, 0, 0, 0.2);
		}

		.mobile-overflow-menu {
			position: absolute;
			top: calc(100% + 8px);
			right: 0;
			z-index: 8;
			display: grid;
			gap: 4px;
			min-width: 156px;
			padding: 8px;
			border: 1px solid rgba(201, 210, 255, 0.14);
			border-radius: 12px;
			background:
				linear-gradient(180deg, rgba(12, 16, 28, 0.98), rgba(7, 10, 18, 0.98)),
				rgba(7, 10, 18, 0.98);
			box-shadow:
				0 18px 34px rgba(0, 0, 0, 0.28),
				inset 0 1px 0 rgba(255, 255, 255, 0.04);
			backdrop-filter: none;
		}

		.mobile-overflow-menu[hidden] {
			display: none !important;
		}

		.mobile-overflow-menu-item {
			display: grid;
			grid-template-columns: 18px minmax(0, 1fr);
			align-items: center;
			gap: 10px;
			width: 100%;
			padding: 10px 12px;
			border: 0;
			background: transparent;
			box-shadow: none;
			color: rgba(238, 244, 255, 0.9);
			font-size: 12px;
			font-weight: 500;
			letter-spacing: 0.04em;
			text-transform: none;
			text-align: left;
		}

		.mobile-overflow-menu-item:hover:not(:disabled),
		.mobile-overflow-menu-item:focus-visible {
			background: rgba(201, 210, 255, 0.08);
			border-color: transparent;
			box-shadow: none;
			transform: none;
		}

		.mobile-overflow-menu-item-icon {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 18px;
			height: 18px;
			color: rgba(212, 221, 255, 0.84);
		}

		.mobile-overflow-menu-item-icon svg {
			width: 18px;
			height: 18px;
			stroke: currentColor;
		}

		.mobile-drawer-backdrop {
			position: fixed;
			inset: 0;
			z-index: 30;
			background: transparent;
			backdrop-filter: none;
		}

		.mobile-drawer-backdrop[hidden],
		.mobile-conversation-drawer[hidden] {
			display: none !important;
		}

		.mobile-conversation-drawer {
			position: fixed;
			top: 0;
			left: 0;
			z-index: 31;
			display: grid;
			grid-template-rows: auto minmax(0, 1fr);
			width: min(82vw, 320px);
			height: 100dvh;
			padding: calc(18px + env(safe-area-inset-top)) 14px calc(16px + env(safe-area-inset-bottom));
			border-right: 1px solid rgba(201, 210, 255, 0.14);
			background:
				radial-gradient(circle at 22% 12%, rgba(116, 179, 255, 0.16), transparent 34%),
				linear-gradient(180deg, rgba(11, 15, 27, 0.98), rgba(5, 7, 13, 0.99));
			box-shadow: 22px 0 46px rgba(0, 0, 0, 0.42);
		}

		.mobile-drawer-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			padding-bottom: 14px;
		}

		.mobile-drawer-title {
			display: grid;
			gap: 3px;
		}

		.mobile-drawer-title strong {
			color: #f5f8ff;
			font-size: 15px;
			letter-spacing: 0.04em;
		}

		.mobile-drawer-title span {
			color: rgba(222, 230, 255, 0.58);
			font-size: 11px;
		}

		.mobile-drawer-close {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 34px;
			height: 34px;
			padding: 0;
		}

		.mobile-conversation-list {
			display: grid;
			align-content: start;
			gap: 8px;
			min-height: 0;
			overflow-y: auto;
			overflow-x: hidden;
			padding-right: 0;
			scrollbar-width: none;
			-ms-overflow-style: none;
		}

		.mobile-conversation-list::-webkit-scrollbar {
			width: 0;
			height: 0;
			display: none;
		}

		.mobile-conversation-empty {
			padding: 14px;
			border: 1px dashed rgba(201, 210, 255, 0.16);
			border-radius: 14px;
			color: rgba(226, 234, 255, 0.58);
			font-size: 12px;
			line-height: 1.6;
		}

		.mobile-conversation-item {
			display: grid;
			gap: 5px;
			width: 100%;
			padding: 11px 12px;
			border: 1px solid rgba(201, 210, 255, 0.1);
			border-radius: 4px;
			background: rgba(255, 255, 255, 0.035);
			box-shadow: none;
			text-align: left;
		}

		.mobile-conversation-item:hover:not(:disabled),
		.mobile-conversation-item:focus-visible {
			border-color: rgba(201, 210, 255, 0.2);
			background: rgba(255, 255, 255, 0.07);
			transform: none;
		}

		.mobile-conversation-item.is-active {
			border-color: rgba(101, 209, 255, 0.36);
			background: rgba(101, 209, 255, 0.1);
		}

		.mobile-conversation-item:disabled {
			cursor: not-allowed;
			opacity: 0.58;
		}

		.mobile-conversation-title {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			color: rgba(246, 249, 255, 0.94);
			font-size: 13px;
			font-weight: 650;
		}

		.mobile-conversation-preview {
			display: -webkit-box;
			overflow: hidden;
			color: rgba(226, 234, 255, 0.58);
			font-size: 11px;
			line-height: 1.35;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
		}

		.mobile-conversation-meta {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
			color: rgba(226, 234, 255, 0.42);
			font-size: 10px;
		}

		.status-row {
			display: flex;
			gap: 10px;
			align-items: center;
		}

		.status-row strong {
			color: var(--ok);
		}

		.chat-stage {
			display: flex;
			flex-direction: column;
			position: relative;
			width: min(840px, calc(100% - 40px));
			min-height: 0;
			margin: 0 auto;
			background: transparent;
			border-left: 0;
			border-right: 0;
			overflow: hidden;
		}

		.chat-meta {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto;
			gap: 12px;
			padding: 12px 0 10px;
			border-bottom: 0;
			background: transparent;
			align-items: center;
			flex-shrink: 0;
		}

		.chat-meta,
		.banner-row,
		.process-panel {
			display: none !important;
		}

		.meta-chip {
			min-width: 0;
			padding: 10px 12px;
			border: 1px solid rgba(255, 255, 255, 0.08);
			background: rgba(255, 255, 255, 0.035);
			backdrop-filter: none;
			font-size: 10px;
			line-height: 1.5;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: rgba(238, 244, 255, 0.54);
		}

		.meta-chip strong {
			display: block;
			margin-bottom: 4px;
			color: var(--fg);
			font-size: 11px;
		}

		.meta-chip span,
		.meta-chip code {
			display: block;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		code {
			color: var(--accent);
			font-family: var(--font-mono);
			background: transparent;
			padding: 0;
		}

		button,
		input,
		select,
		textarea {
			font: inherit;
			border-radius: 4px;
		}

		button {
			border: 1px solid rgba(255, 255, 255, 0.12);
			background: rgba(255, 255, 255, 0.04);
			color: var(--fg);
			padding: 10px 14px;
			cursor: pointer;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			transition:
				transform 120ms ease,
				border-color 120ms ease,
				color 120ms ease,
				background 120ms ease,
				box-shadow 120ms ease;
		}

		button:hover:not(:disabled) {
			border-color: var(--accent);
			color: var(--accent);
			background: rgba(255, 255, 255, 0.08);
			transform: translateY(-1px);
			box-shadow: 0 8px 18px rgba(201, 210, 255, 0.08);
		}

		button:disabled {
			opacity: 0.5;
			cursor: wait;
		}

		#send-button {
			border-color: rgba(201, 210, 255, 0.28);
			color: #f3fbff;
			background:
				linear-gradient(135deg, rgba(201, 210, 255, 0.14), rgba(145, 125, 214, 0.08)),
				rgba(255, 255, 255, 0.05);
		}

		.banner-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 12px;
			padding: 0 0 8px;
			border-bottom: 0;
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.12em;
			color: rgba(238, 244, 255, 0.46);
			flex-shrink: 0;
		}

		.state {
			padding: 6px 10px;
			border: 1px solid rgba(141, 255, 178, 0.24);
			background: rgba(141, 255, 178, 0.05);
			color: var(--ok);
		}

		.error-banner {
			display: none;
			position: absolute;
			top: 0;
			left: 50%;
			transform: translateX(-50%);
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: start;
			gap: 12px;
			width: min(var(--conversation-width), calc(100% - 40px));
			padding: 12px 18px;
			border: 0;
			border-radius: 4px;
			background: rgba(255, 113, 136, 0.12);
			color: #ff9faf;
			font-size: 12px;
			line-height: 1.6;
			flex-shrink: 0;
			z-index: 6;
			box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
			pointer-events: auto;
		}

		.error-banner.visible {
			display: grid;
		}

		.error-banner[hidden] {
			display: none !important;
		}

		.error-banner-message {
			min-width: 0;
			word-break: break-word;
		}

		.error-banner-close {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 24px;
			height: 24px;
			padding: 0;
			border: 0;
			border-radius: 4px;
			background: transparent;
			box-shadow: none;
			color: rgba(255, 189, 199, 0.9);
			font-size: 16px;
			line-height: 1;
			cursor: pointer;
		}

		.error-banner-close:hover:not(:disabled),
		.error-banner-close:focus-visible {
			background: rgba(255, 255, 255, 0.08);
			color: #ffd7de;
			box-shadow: none;
			transform: none;
		}

		.notification-live-region {
			position: fixed;
			top: 18px;
			right: 18px;
			z-index: 90;
			display: grid;
			justify-items: end;
			gap: 10px;
			width: min(360px, calc(100vw - 28px));
			pointer-events: none;
		}

		.notification-live-region[hidden] {
			display: none !important;
		}

		.notification-toast-stack {
			display: grid;
			justify-items: stretch;
			gap: 10px;
			width: 100%;
		}

		.notification-toast {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: start;
			gap: 12px;
			width: 100%;
			padding: 12px 14px;
			border: 1px solid rgba(141, 255, 178, 0.18);
			border-radius: 4px;
			background:
				linear-gradient(180deg, rgba(8, 14, 24, 0.96), rgba(6, 10, 18, 0.96)),
				rgba(6, 10, 18, 0.96);
			box-shadow:
				0 18px 40px rgba(0, 0, 0, 0.32),
				inset 0 1px 0 rgba(255, 255, 255, 0.04);
			backdrop-filter: none;
			pointer-events: auto;
		}

		.notification-toast-copy {
			display: grid;
			gap: 5px;
			min-width: 0;
		}

		.notification-toast-title {
			color: rgba(243, 248, 255, 0.96);
			font-size: 12px;
			font-weight: 600;
			line-height: 1.45;
			word-break: break-word;
		}

		.notification-toast-meta {
			color: rgba(214, 221, 255, 0.62);
			font-size: 10px;
			line-height: 1.5;
			letter-spacing: 0.06em;
			text-transform: uppercase;
		}

		.notification-toast-dismiss {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 24px;
			height: 24px;
			padding: 0;
			border: 0;
			border-radius: 4px;
			background: transparent;
			box-shadow: none;
			color: rgba(228, 235, 255, 0.68);
			font-size: 15px;
			line-height: 1;
			cursor: pointer;
		}

		.notification-toast-dismiss:hover:not(:disabled),
		.notification-toast-dismiss:focus-visible {
			background: rgba(255, 255, 255, 0.08);
			color: #f5f8ff;
			box-shadow: none;
			transform: none;
		}

		.stream-layout {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 14px;
			flex: 1 1 auto;
			min-height: 0;
			background: transparent;
		}

		.transcript-pane {
			display: flex;
			flex-direction: column;
			align-items: stretch;
			position: relative;
			width: min(var(--conversation-width), 100%);
			margin: 0 auto;
			min-height: 0;
		}

		.pane-head {
			padding: 12px 18px;
			border-bottom: 0;
			background: transparent;
			flex-shrink: 0;
		}

		.transcript-pane .pane-head {
			padding: 8px 12px 4px;
			background: transparent;
		}

		.pane-head strong {
			display: block;
			font-size: 10px;
			letter-spacing: 0.14em;
			text-transform: uppercase;
			margin-bottom: 4px;
		}

		.pane-head span {
			display: block;
			color: var(--muted);
			font-size: 11px;
			line-height: 1.5;
		}

		.transcript {
			display: grid;
			align-content: start;
			justify-items: stretch;
			width: 100%;
			flex: 1 1 auto;
			min-height: 0;
			padding: 0 0 8px;
			overflow-y: auto;
			overflow-x: hidden;
			overscroll-behavior: contain;
			scroll-padding-bottom: var(--transcript-bottom-scroll-buffer);
			scrollbar-width: none;
			-ms-overflow-style: none;
		}

		.transcript::-webkit-scrollbar {
			width: 0;
			height: 0;
			display: none;
		}

		.scroll-to-bottom-button {
			display: none;
			position: absolute;
			right: 14px;
			bottom: 16px;
			z-index: 5;
			align-items: center;
			justify-content: center;
			min-height: 34px;
			padding: 8px 12px;
			border: 1px solid rgba(201, 210, 255, 0.2);
			border-radius: 4px;
			background: rgba(9, 13, 22, 0.92);
			color: rgba(238, 244, 255, 0.92);
			font-size: 11px;
			line-height: 1;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			box-shadow: 0 12px 26px rgba(0, 0, 0, 0.24);
			backdrop-filter: none;
		}

		.scroll-to-bottom-button.visible {
			display: inline-flex;
		}

		.scroll-to-bottom-button:hover:not(:disabled),
		.scroll-to-bottom-button:focus-visible {
			border-color: rgba(201, 210, 255, 0.36);
			background: rgba(14, 18, 31, 0.96);
			color: #f3fbff;
			transform: none;
			box-shadow: 0 14px 30px rgba(0, 0, 0, 0.3);
		}

		.transcript-archive,
		.transcript-current {
			display: grid;
			align-content: start;
			justify-items: stretch;
			width: 100%;
		}

		.shell[data-transcript-state="active"] .transcript-current {
			padding-bottom: var(--transcript-bottom-scroll-buffer);
		}

		.transcript-archive {
			gap: 12px;
			padding-bottom: 8px;
		}

		.archived-conversation {
			display: grid;
			gap: 10px;
			width: 100%;
			padding: 12px 0 0;
			border-top: 1px solid rgba(201, 210, 255, 0.08);
		}

		.archived-conversation-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			padding: 0 18px;
			color: rgba(214, 220, 255, 0.46);
			font-size: 10px;
			letter-spacing: 0.16em;
			text-transform: uppercase;
		}

		.archived-conversation-head strong {
			color: rgba(238, 244, 255, 0.72);
			font-weight: 400;
			letter-spacing: 0.08em;
		}

		.archived-conversation-body {
			display: grid;
			gap: 0;
			opacity: 0.8;
		}

		.archived-conversation-body .message-actions {
			opacity: 0.82;
		}

		.history-load-more {
			align-self: center;
			margin: 0 0 10px;
			padding: 7px 12px;
			border: 1px solid rgba(201, 210, 255, 0.18);
			background: rgba(201, 210, 255, 0.05);
			color: rgba(236, 240, 255, 0.88);
			font-size: 10px;
			letter-spacing: 0.12em;
		}

		.history-load-more[hidden] {
			display: none !important;
		}

		.message {
			display: grid;
			grid-template-columns: 1fr;
			justify-items: stretch;
			gap: 8px;
			width: 100%;
			padding: 14px 0 0;
			border-bottom: 0;
		}

		.message-meta,
		.message-body {
			padding: 0;
			min-width: 0;
			width: 100%;
		}

		.message-meta {
			display: flex;
			align-items: center;
			gap: 8px;
			background: transparent;
			font-size: 10px;
			line-height: 1.6;
			letter-spacing: 0.14em;
			text-transform: uppercase;
			color: rgba(238, 244, 255, 0.42);
		}

		.message-meta strong {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			margin-bottom: 0;
			padding: 6px 10px;
			font-size: 10px;
			border: 1px solid rgba(255, 255, 255, 0.1);
			border-radius: 4px;
			background: rgba(255, 255, 255, 0.06);
			color: var(--fg);
		}

		.message-body {
			padding: 16px 18px;
			border: 0;
			border-radius: 4px;
			background: rgba(34, 38, 46, 0.72);
			box-shadow: none;
			backdrop-filter: none;
		}

		.message-content {
			font-size: 14px;
			line-height: 1.85;
			word-break: break-word;
		}

		.message-content > :first-child {
			margin-top: 0;
		}

		.message-content > :last-child {
			margin-bottom: 0;
		}

		.message-content p,
		.message-content ul,
		.message-content ol,
		.message-content .markdown-table-scroll,
		.message-content .code-block,
		.message-content pre,
		.message-content blockquote,
		.message-content h1,
		.message-content h2,
		.message-content h3,
		.message-content h4,
		.message-content h5,
		.message-content h6 {
			margin: 0 0 14px;
		}

		.message-content h1,
		.message-content h2,
		.message-content h3,
		.message-content h4,
		.message-content h5,
		.message-content h6 {
			line-height: 1.2;
			letter-spacing: -0.04em;
			text-transform: none;
		}

		.message-content h1 {
			font-size: 28px;
		}

		.message-content h2 {
			font-size: 24px;
		}

		.message-content h3 {
			font-size: 20px;
		}

		.message-content ul,
		.message-content ol {
			padding-left: 22px;
		}

		.message-content li + li {
			margin-top: 6px;
		}

		.message-content .markdown-table-scroll {
			display: block;
			width: fit-content;
			max-width: 100%;
			overflow-x: auto;
			border: 1px solid rgba(201, 210, 255, 0.16);
			background: rgba(6, 7, 17, 0.42);
		}

		.message-content table {
			width: max-content;
			border-collapse: collapse;
		}

		.message-content th,
		.message-content td {
			padding: 9px 11px;
			border-right: 1px solid rgba(201, 210, 255, 0.12);
			border-bottom: 1px solid rgba(201, 210, 255, 0.12);
			text-align: left;
			vertical-align: top;
			white-space: nowrap;
		}

		.message-content th:last-child,
		.message-content td:last-child {
			border-right: 0;
		}

		.message-content tbody tr:last-child td {
			border-bottom: 0;
		}

		.message-content th {
			background: rgba(201, 210, 255, 0.09);
			color: var(--fg);
			font-size: 12px;
			font-weight: 700;
		}

		.message-content td {
			color: rgba(238, 244, 255, 0.86);
		}

		.message-content blockquote {
			margin-left: 0;
			padding: 12px 14px;
			border-left: 3px solid var(--accent);
			background: rgba(201, 210, 255, 0.06);
			color: #e6e9ff;
		}

		.message-content pre {
			padding: 14px;
			border: 1px solid var(--line);
			background: rgba(4, 8, 18, 0.95);
			overflow-x: auto;
		}

		.message-content .code-block {
			border: 1px solid var(--line);
			background:
				linear-gradient(90deg, rgba(201, 210, 255, 0.05), transparent 45%),
				rgba(4, 8, 18, 0.95);
		}

		.message-content .code-block-toolbar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 12px;
			padding: 8px 10px;
			border-bottom: 1px solid var(--line);
			background: rgba(13, 20, 37, 0.86);
		}

		.message-content .code-block-language {
			color: var(--muted);
			font-size: 10px;
			letter-spacing: 0.12em;
			text-transform: uppercase;
		}

		.message-content .copy-code-button {
			padding: 5px 8px;
			border-color: rgba(201, 210, 255, 0.22);
			background: rgba(201, 210, 255, 0.05);
			color: var(--accent);
			font-size: 10px;
			letter-spacing: 0.12em;
		}

		.message-content .copy-code-button:disabled {
			cursor: default;
		}

		.message-content .code-block pre {
			margin: 0;
			border: 0;
			background: transparent;
		}

		.message-content code {
			display: inline-block;
			padding: 1px 6px;
			border: 1px solid rgba(201, 210, 255, 0.18);
			background: rgba(201, 210, 255, 0.08);
			font-size: 13px;
		}

		.message-content pre code {
			display: block;
			font-family: var(--font-mono);
			padding: 0;
			border: 0;
			background: transparent;
			font-size: 12px;
			line-height: 1.7;
			white-space: pre;
		}

		.message-content a {
			color: var(--accent);
			text-decoration: underline;
			text-decoration-thickness: 1px;
			text-underline-offset: 3px;
		}

		.message.user .message-meta strong {
			border-color: rgba(168, 212, 255, 0.16);
			background: rgba(255, 255, 255, 0.08);
			color: #dff7ff;
		}

		.message.assistant .message-meta strong {
			border-color: rgba(255, 255, 255, 0.16);
			background: rgba(255, 255, 255, 0.08);
			color: #f3fbff;
		}

		.message.user {
			justify-items: end;
		}

		.message.user .message-meta {
			width: fit-content;
			justify-self: end;
			justify-content: flex-end;
		}

		.message.user .message-body {
			width: fit-content;
			max-width: min(100%, 75%);
			justify-self: end;
			background: rgba(34, 38, 46, 0.72);
			color: #eef6ff;
		}

		.message.user .message-content {
			text-align: left;
		}

		.message.assistant {
			justify-items: stretch;
		}

		.message.assistant .message-body {
			background: rgba(34, 38, 46, 0.72);
			color: #edf5ff;
		}

		.message.assistant .message-content,
		.message.assistant .message-content a,
		.message.assistant .message-content code,
		.message.assistant .message-content .code-block-language {
			color: #edf5ff;
		}

		.message.assistant .message-content code {
			border-color: rgba(255, 255, 255, 0.12);
			background: rgba(255, 255, 255, 0.12);
		}

		.message.assistant .message-content blockquote {
			border-left-color: rgba(201, 210, 255, 0.32);
			background: rgba(255, 255, 255, 0.08);
			color: #edf5ff;
		}

		.message.assistant .message-content pre,
		.message.assistant .message-content .code-block {
			border-color: rgba(255, 255, 255, 0.1);
			background: rgba(255, 255, 255, 0.08);
		}

		.message.assistant .copy-code-button {
			border-color: rgba(255, 255, 255, 0.12);
			background: rgba(255, 255, 255, 0.12);
			color: #edf5ff;
		}

		.process-note {
			display: grid;
			width: 100%;
			padding: 4px 0 0;
		}

		.process-note-text {
			width: 100%;
			max-width: none;
			padding: 0 18px;
			color: rgba(238, 244, 255, 0.54);
			font-size: 11px;
			line-height: 1.5;
			text-align: left;
			word-break: break-word;
		}

		.process-note.tool .process-note-text {
			color: rgba(212, 218, 255, 0.7);
		}

		.process-note.ok .process-note-text {
			color: rgba(141, 255, 178, 0.78);
		}

		.process-note.error .process-note-text {
			color: rgba(255, 153, 170, 0.82);
		}

		.message-content.is-empty {
			display: none;
		}

		.assistant-loading-shell {
			display: flex;
			justify-content: flex-start;
			margin-top: 10px;
		}

		.assistant-loading-bubble {
			display: inline-flex;
			align-items: center;
			gap: 10px;
			max-width: 100%;
			padding: 8px 12px;
			border: 1px solid rgba(201, 210, 255, 0.14);
			border-radius: 999px;
			background: rgba(201, 210, 255, 0.06);
			color: rgba(233, 238, 255, 0.88);
			font-size: 10px;
			letter-spacing: 0.12em;
			text-transform: uppercase;
			box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
		}

		.assistant-loading-label {
			min-width: 0;
			white-space: nowrap;
		}

		.assistant-loading-dots {
			display: inline-flex;
			align-items: center;
			gap: 5px;
		}

		.assistant-loading-dots[hidden] {
			display: none !important;
		}

		.assistant-loading-dot {
			width: 5px;
			height: 5px;
			border-radius: 999px;
			background: currentColor;
			opacity: 0.24;
			animation: assistant-loading-pulse 1.15s ease-in-out infinite;
		}

		.assistant-loading-dot:nth-child(2) {
			animation-delay: 0.16s;
		}

		.assistant-loading-dot:nth-child(3) {
			animation-delay: 0.32s;
		}

		.assistant-loading-shell.tool .assistant-loading-bubble {
			border-color: rgba(201, 210, 255, 0.2);
			background: rgba(201, 210, 255, 0.08);
		}

		.assistant-loading-shell.ok .assistant-loading-bubble {
			border-color: rgba(141, 255, 178, 0.22);
			background: rgba(141, 255, 178, 0.07);
			color: rgba(201, 255, 220, 0.92);
		}

		.assistant-loading-shell.warn .assistant-loading-bubble {
			border-color: rgba(255, 209, 102, 0.2);
			background: rgba(255, 209, 102, 0.07);
			color: rgba(255, 230, 178, 0.94);
		}

		.assistant-loading-shell.error .assistant-loading-bubble {
			border-color: rgba(255, 113, 136, 0.2);
			background: rgba(255, 113, 136, 0.08);
			color: rgba(255, 210, 220, 0.94);
		}

		.assistant-loading-shell.is-complete .assistant-loading-bubble {
			box-shadow: none;
		}

		@keyframes assistant-loading-pulse {
			0%,
			80%,
			100% {
				opacity: 0.22;
				transform: scale(0.82);
			}

			40% {
				opacity: 1;
				transform: scale(1);
			}
		}

		.message-actions {
			display: flex;
			justify-content: flex-end;
			gap: 8px;
			margin-top: 4px;
		}

		.message-copy-button {
			position: relative;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 26px;
			height: 26px;
			padding: 0;
			border: 0;
			background: transparent;
			color: rgba(226, 234, 255, 0.52);
			box-shadow: none;
			font-size: 0;
			line-height: 0;
			letter-spacing: 0;
		}

		.message-copy-button:hover:not(:disabled),
		.message-copy-button:focus-visible {
			border-color: transparent;
			background: transparent;
			color: rgba(242, 246, 255, 0.78);
			box-shadow: none;
			transform: none;
		}

		.message-copy-button::before,
		.message-copy-button::after {
			content: "";
			position: absolute;
			width: 9px;
			height: 11px;
			border: 1px solid currentColor;
			border-radius: 2px;
		}

		.message-copy-button::before {
			top: 6px;
			left: 7px;
			opacity: 0.46;
		}

		.message-copy-button::after {
			top: 9px;
			left: 10px;
			background: transparent;
		}

		.message-copy-button:disabled {
			cursor: default;
			opacity: 0.45;
		}

		.message.assistant .message-body {
			display: grid;
			gap: 14px;
		}

		.assistant-process-shell {
			display: grid;
			gap: 12px;
			padding: 12px 14px;
			border: 0;
			border-radius: 4px;
			background: rgba(9, 13, 22, 0.92);
		}

		.assistant-process-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
		}

		.assistant-process-head strong {
			color: rgba(238, 244, 255, 0.7);
			font-size: 10px;
			letter-spacing: 0.12em;
			text-transform: uppercase;
		}

		.assistant-process-shell[data-process-expanded="false"] .assistant-process-head {
			justify-content: flex-end;
		}

		.assistant-process-shell[data-process-expanded="false"] .assistant-process-head strong {
			display: none;
		}

		.assistant-process-toggle {
			padding: 6px 8px;
			border: 0;
			background: rgba(20, 28, 44, 0.94);
			color: rgba(238, 244, 255, 0.7);
			font-size: 10px;
			letter-spacing: 0.12em;
		}

		.assistant-process-body {
			display: grid;
			gap: 10px;
			overflow: visible;
			min-width: 0;
		}

		.assistant-process-narration {
			display: grid;
			gap: 8px;
			max-height: calc(1.6em * 5 + 8px * 4);
			overflow: auto;
			padding-right: 4px;
			scrollbar-width: thin;
			scrollbar-color: rgba(201, 210, 255, 0.2) transparent;
		}

		.assistant-process-narration::-webkit-scrollbar {
			width: 4px;
		}

		.assistant-process-narration::-webkit-scrollbar-thumb {
			background: rgba(201, 210, 255, 0.2);
		}

		.assistant-process-shell[data-process-expanded="false"] .assistant-process-narration {
			display: none;
		}

		.assistant-process-line {
			margin: 0;
			color: rgba(238, 244, 255, 0.56);
			font-size: 11px;
			line-height: 1.6;
			text-align: left;
			word-break: break-word;
		}

		.assistant-process-line::before {
			content: "· ";
			color: rgba(212, 218, 255, 0.56);
		}

		.assistant-process-current {
			display: grid;
			gap: 6px;
			padding-top: 10px;
			border-top: 1px solid rgba(255, 255, 255, 0.08);
			min-width: 0;
		}

		.assistant-process-shell[data-process-expanded="false"] .assistant-process-current {
			padding-top: 0;
			border-top: 0;
		}

		.assistant-process-current-label {
			color: rgba(238, 244, 255, 0.4);
			font-size: 9px;
			letter-spacing: 0.14em;
			text-transform: uppercase;
		}

		.assistant-process-current-action {
			margin: 0;
			padding: 0;
			border: 0;
			background: transparent;
			color: rgba(241, 247, 255, 0.64);
			font-family: var(--font-sans);
			font-size: 11px;
			line-height: 1.6;
			text-align: left;
			white-space: pre-wrap;
			word-break: break-word;
			min-height: calc(1.6em * 2);
			max-height: calc(1.6em * 2);
			overflow: hidden;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
		}

		.assistant-process-shell.tool {
			border-color: rgba(201, 210, 255, 0.14);
		}

		.assistant-process-shell.ok {
			border-color: rgba(141, 255, 178, 0.18);
		}

		.assistant-process-shell.error {
			border-color: rgba(255, 113, 136, 0.22);
		}

		.composer {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 168px;
			gap: 10px;
			padding: 12px 0 14px;
			border: 0;
			border-radius: 4px;
			background: rgba(102, 93, 138, 0.16);
			box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
			align-items: end;
			flex-shrink: 0;
		}

		.composer-main {
			display: grid;
			gap: 8px;
		}

		.composer-header {
			display: flex;
			justify-content: space-between;
			gap: 12px;
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: 0.12em;
			color: var(--muted);
		}

		.composer textarea,
		.composer input,
		.composer select {
			width: 100%;
			border: 1px solid rgba(255, 255, 255, 0.12);
			background: rgba(255, 255, 255, 0.045);
			color: var(--fg);
			padding: 12px 14px;
			outline: none;
			transition:
				border-color 120ms ease,
				background 120ms ease,
				box-shadow 120ms ease;
		}

		.composer textarea {
			--composer-line-height: 22px;
			--composer-textarea-max-lines: 10;
			min-height: 72px;
			max-height: calc(var(--composer-line-height) * var(--composer-textarea-max-lines) + 24px);
			resize: none;
			line-height: var(--composer-line-height);
			overflow-y: auto;
			box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
		}

		.composer textarea:focus,
		.composer input:focus,
		.composer select:focus {
			border-color: var(--accent);
			background: rgba(255, 255, 255, 0.07);
			box-shadow: 0 0 0 4px rgba(201, 210, 255, 0.07);
		}

		.composer-side {
			display: grid;
			gap: 10px;
		}

		.hint {
			padding: 10px 12px;
			border: 1px solid var(--line);
			color: var(--muted);
			background: rgba(16, 24, 44, 0.4);
			font-size: 11px;
			line-height: 1.6;
			text-transform: uppercase;
			letter-spacing: 0.08em;
		}

		.file-strip {
			display: grid;
			gap: 8px;
		}

		.context-usage-row {
			display: flex;
			justify-content: flex-end;
			align-items: center;
			min-height: 26px;
			margin: -2px 0 -4px;
		}

		.context-usage-shell {
			position: relative;
			display: inline-grid;
			place-items: center;
			width: 36px;
			height: 36px;
			padding: 0;
			border: 1px solid rgba(201, 210, 255, 0.1);
			border-radius: 50%;
			background: rgba(9, 12, 22, 0.72);
			color: rgba(247, 249, 255, 0.9);
			box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
		}

		.context-usage-shell:hover,
		.context-usage-shell:focus-visible,
		.context-usage-shell[data-expanded="true"] {
			border-color: rgba(201, 210, 255, 0.28);
			background: rgba(14, 18, 31, 0.96);
		}

		.context-usage-ring {
			position: absolute;
			inset: 3px;
			width: 28px;
			height: 28px;
			transform: rotate(-90deg);
		}

		.context-usage-track {
			fill: none;
			stroke: rgba(255, 255, 255, 0.12);
			stroke-width: 3;
		}

		.context-usage-progress {
			fill: none;
			stroke: rgba(143, 255, 199, 0.94);
			stroke-linecap: round;
			stroke-width: 3;
			stroke-dasharray: 0 100;
			transition: stroke-dasharray 160ms ease, stroke 160ms ease;
		}

		.context-usage-summary {
			position: relative;
			z-index: 1;
			font-size: 9px;
			font-weight: 700;
			letter-spacing: -0.03em;
		}

		.context-usage-toggle {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
		}

		.context-usage-meta {
			position: absolute;
			right: 0;
			bottom: calc(100% + 10px);
			z-index: 20;
			width: 286px;
			padding: 10px 12px;
			border: 1px solid rgba(201, 210, 255, 0.14);
			background: rgba(7, 10, 18, 0.96);
			box-shadow: 0 14px 34px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.04);
			color: rgba(225, 232, 247, 0.72);
			font-size: 11px;
			line-height: 1.75;
			text-align: left;
			white-space: pre-line;
			opacity: 0;
			pointer-events: none;
			transform: translateY(4px);
			transition: opacity 120ms ease, transform 120ms ease;
		}

		.context-usage-shell:hover .context-usage-meta,
		.context-usage-shell:focus-visible .context-usage-meta,
		.context-usage-shell[data-expanded="true"] .context-usage-meta {
			opacity: 1;
			transform: translateY(0);
		}

		.context-usage-shell[data-status="caution"] .context-usage-progress {
			stroke: rgba(255, 214, 125, 0.96);
		}

		.context-usage-shell[data-status="warning"] .context-usage-progress {
			stroke: rgba(255, 156, 92, 0.98);
		}

		.context-usage-shell[data-status="danger"] .context-usage-progress {
			stroke: rgba(255, 113, 136, 1);
		}

		.context-usage-dialog[hidden] {
			display: none !important;
		}

		.context-usage-dialog {
			position: fixed;
			inset: 0;
			z-index: 70;
			display: none;
			align-items: flex-end;
			justify-content: center;
			padding: 18px;
			background: rgba(3, 5, 10, 0.58);
			backdrop-filter: none;
		}

		.context-usage-dialog.open {
			display: flex;
		}

		.context-usage-dialog-panel {
			width: min(420px, 100%);
			padding: 16px;
			border: 1px solid rgba(201, 210, 255, 0.14);
			border-radius: 18px;
			background: rgba(8, 11, 20, 0.98);
			box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
		}

		.context-usage-dialog-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			margin-bottom: 12px;
		}

		.context-usage-dialog-head strong {
			color: rgba(247, 249, 255, 0.92);
			font-size: 13px;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		.context-usage-dialog-close {
			width: 32px;
			height: 32px;
			padding: 0;
			border: 1px solid rgba(201, 210, 255, 0.12);
			border-radius: 50%;
			background: rgba(255, 255, 255, 0.05);
			color: rgba(238, 244, 255, 0.76);
		}

		.context-usage-dialog-body {
			color: rgba(225, 232, 247, 0.76);
			font-size: 12px;
			line-height: 1.8;
			white-space: pre-line;
		}

		.conn-run-details-dialog[hidden] {
			display: none !important;
		}

		.conn-run-details-dialog {
			position: fixed;
			inset: 0;
			z-index: 72;
			display: none;
			align-items: flex-end;
			justify-content: center;
			padding: 18px;
			background: rgba(3, 5, 10, 0.58);
			backdrop-filter: none;
		}

		.conn-run-details-dialog.open {
			display: flex;
		}

		.conn-run-details-panel {
			width: min(720px, 100%);
			max-height: min(78vh, 640px);
			padding: 16px;
			border: 1px solid rgba(201, 210, 255, 0.14);
			border-radius: 18px;
			background: rgba(8, 11, 20, 0.98);
			box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
			overflow: hidden;
		}

		.conn-run-details-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			margin-bottom: 12px;
		}

		.conn-run-details-head strong {
			color: rgba(247, 249, 255, 0.92);
			font-size: 13px;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		.conn-run-details-close {
			width: 32px;
			height: 32px;
			padding: 0;
			border: 1px solid rgba(201, 210, 255, 0.12);
			border-radius: 50%;
			background: rgba(255, 255, 255, 0.05);
			color: rgba(238, 244, 255, 0.76);
		}

		.conn-run-details-body {
			display: grid;
			gap: 12px;
			max-height: calc(min(78vh, 640px) - 76px);
			overflow: auto;
			color: rgba(225, 232, 247, 0.76);
			font-size: 12px;
			line-height: 1.7;
		}

		.conn-run-section {
			display: grid;
			gap: 8px;
			padding: 12px;
			border: 1px solid rgba(201, 210, 255, 0.1);
			border-radius: 6px;
			background: rgba(255, 255, 255, 0.035);
		}

		.conn-run-section code {
			overflow-wrap: anywhere;
			color: rgba(223, 230, 255, 0.78);
			font-family: var(--font-mono);
			font-size: 11px;
		}

		.conn-run-event-list {
			display: grid;
			gap: 8px;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		.conn-run-event {
			display: grid;
			gap: 4px;
			padding: 8px 0;
			border-top: 1px solid rgba(255, 255, 255, 0.06);
		}

		.conn-run-event:first-child {
			border-top: 0;
			padding-top: 0;
		}

		.conn-run-event span {
			color: rgba(226, 234, 255, 0.5);
			font-size: 10px;
		}

		.conn-run-open-button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 28px;
			height: 28px;
			padding: 0;
			border: 0;
			background: transparent;
			box-shadow: none;
			color: rgba(226, 234, 255, 0.58);
		}

		.conn-run-open-button:hover:not(:disabled),
		.conn-run-open-button:focus-visible {
			background: transparent;
			box-shadow: none;
			color: rgba(247, 249, 255, 0.92);
			transform: none;
		}

		.drag-overlay {
			position: fixed;
			inset: 16px;
			z-index: 40;
			display: none;
			align-items: center;
			justify-content: center;
			border: 1px dashed rgba(201, 210, 255, 0.5);
			background: rgba(5, 7, 13, 0.78);
			pointer-events: none;
		}

		.drag-overlay.active {
			display: flex;
		}

		.drag-overlay-panel {
			min-width: min(520px, calc(100vw - 64px));
			padding: 24px 28px;
			border: 1px solid var(--accent);
			background: rgba(11, 16, 32, 0.94);
			box-shadow: inset 0 0 0 1px rgba(201, 210, 255, 0.14);
			text-align: center;
		}

		.drag-overlay-panel strong {
			display: block;
			margin-bottom: 8px;
			color: var(--accent);
			font-size: 14px;
			letter-spacing: 0.12em;
			text-transform: uppercase;
		}

		.drag-overlay-panel span {
			display: block;
			color: var(--muted);
			font-size: 12px;
			line-height: 1.7;
			text-transform: uppercase;
			letter-spacing: 0.08em;
		}

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
		.asset-modal-list,
		.agent-activity-list,
		.conn-manager-list,
		.conn-manager-run-list {
			display: grid;
			gap: 6px;
		}

		.file-download,
		.asset-pill,
		.agent-activity-item,
		.conn-manager-item,
		.conn-manager-run-item {
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
		.asset-pill button,
		.agent-activity-actions button,
		.conn-manager-actions button,
		.conn-manager-bulk-actions button,
		.conn-manager-run-actions button {
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

		.conn-manager-item {
			grid-template-columns: auto minmax(0, 1fr);
			align-items: stretch;
			gap: 12px;
		}

		.conn-manager-select {
			display: inline-flex;
			align-items: flex-start;
			justify-content: center;
			padding-top: 2px;
		}

		.conn-manager-select input {
			width: 16px;
			height: 16px;
			accent-color: var(--accent);
		}

		.conn-manager-item.is-highlighted {
			border-color: rgba(141, 255, 178, 0.28);
			background: rgba(141, 255, 178, 0.055);
			box-shadow: inset 3px 0 0 rgba(141, 255, 178, 0.42);
		}

		.conn-manager-notice {
			padding: 8px 10px;
			border: 1px solid rgba(141, 255, 178, 0.18);
			background: rgba(141, 255, 178, 0.06);
			color: rgba(218, 255, 230, 0.86);
			font-size: 11px;
			line-height: 1.55;
		}

		.conn-manager-notice[hidden] {
			display: none !important;
		}

		.conn-manager-toolbar {
			display: grid;
			grid-template-columns: minmax(150px, 1fr) auto auto;
			gap: 8px;
			align-items: center;
			padding: 8px 10px;
			border: 1px solid rgba(201, 210, 255, 0.1);
			background: rgba(255, 255, 255, 0.035);
		}

		.conn-manager-filter-field {
			display: inline-grid;
			grid-template-columns: auto minmax(0, 1fr);
			gap: 8px;
			align-items: center;
			min-width: 0;
			color: rgba(226, 234, 255, 0.62);
			font-size: 11px;
		}

		.conn-manager-filter-field select {
			min-width: 0;
			min-height: 30px;
			border: 1px solid rgba(201, 210, 255, 0.14);
			border-radius: 4px;
			background: rgba(5, 7, 13, 0.92);
			color: rgba(244, 248, 255, 0.92);
			font: inherit;
			font-size: 11px;
			line-height: 1.4;
		}

		.conn-manager-selected-count {
			color: rgba(226, 234, 255, 0.56);
			font-family: var(--font-mono);
			font-size: 10px;
			white-space: nowrap;
		}

		.conn-manager-bulk-actions {
			display: flex;
			flex-wrap: wrap;
			justify-content: flex-end;
			gap: 6px;
		}

		.conn-manager-main {
			display: grid;
			gap: 8px;
			min-width: 0;
		}

		.conn-manager-title-row,
		.conn-manager-actions,
		.conn-manager-run-actions {
			display: flex;
			align-items: center;
			gap: 8px;
			flex-wrap: wrap;
		}

		.conn-manager-title-row strong {
			min-width: 0;
			overflow: hidden;
			color: rgba(246, 249, 255, 0.94);
			font-size: 13px;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.conn-manager-status {
			display: inline-flex;
			align-items: center;
			min-height: 20px;
			padding: 3px 7px;
			border: 1px solid rgba(201, 210, 255, 0.14);
			color: rgba(226, 234, 255, 0.72);
			font-family: var(--font-mono);
			font-size: 10px;
			line-height: 1;
			text-transform: uppercase;
		}

		.conn-manager-status.active {
			border-color: rgba(141, 255, 178, 0.3);
			color: rgba(141, 255, 178, 0.9);
		}

		.conn-manager-status.paused {
			border-color: rgba(255, 209, 102, 0.3);
			color: rgba(255, 209, 102, 0.92);
		}

		.conn-manager-meta {
			display: grid;
			gap: 5px;
			color: rgba(226, 234, 255, 0.58);
			font-size: 11px;
			line-height: 1.55;
		}

		.conn-manager-meta code,
		.conn-manager-run-item code {
			overflow-wrap: anywhere;
			color: rgba(223, 230, 255, 0.72);
			font-family: var(--font-mono);
			font-size: 10px;
		}

		.conn-manager-actions {
			grid-column: 2;
			justify-content: flex-end;
		}

		.conn-manager-actions .danger-action,
		.conn-manager-bulk-actions .danger-action {
			border-color: rgba(255, 113, 136, 0.18);
			color: rgba(255, 190, 202, 0.9);
		}

		.conn-manager-actions .danger-action:hover:not(:disabled),
		.conn-manager-actions .danger-action:focus-visible,
		.conn-manager-bulk-actions .danger-action:hover:not(:disabled),
		.conn-manager-bulk-actions .danger-action:focus-visible {
			border-color: rgba(255, 113, 136, 0.36);
			background: rgba(255, 113, 136, 0.08);
			color: rgba(255, 220, 226, 0.96);
		}

		.conn-manager-run-details {
			padding-top: 8px;
			border-top: 1px solid rgba(255, 255, 255, 0.06);
		}

		.conn-manager-run-summary {
			cursor: pointer;
			color: rgba(226, 234, 255, 0.66);
			font-size: 11px;
			line-height: 1.5;
			list-style-position: inside;
		}

		.conn-manager-run-details[open] .conn-manager-run-summary {
			margin-bottom: 8px;
		}

		.conn-manager-run-list {
			display: grid;
			gap: 6px;
		}

		.conn-manager-run-item {
			grid-template-columns: minmax(0, 1fr) auto;
			background: rgba(255, 255, 255, 0.025);
			padding: 7px 8px;
		}

		.conn-manager-run-copy {
			display: grid;
			gap: 3px;
			min-width: 0;
		}

		.conn-manager-run-copy span {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.conn-editor-panel {
			width: min(720px, calc(100vw - 28px));
		}

		.conn-editor-form {
			display: grid;
			min-height: 0;
		}

		.conn-editor-body {
			display: grid;
			gap: 12px;
		}

		.conn-editor-grid {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 10px;
		}

		.conn-editor-field {
			display: grid;
			gap: 6px;
			min-width: 0;
			color: rgba(226, 234, 255, 0.62);
			font-size: 11px;
		}

		.conn-editor-field[hidden],
		.conn-editor-field.is-hidden,
		.conn-editor-current-target[hidden],
		.conn-editor-error[hidden] {
			display: none !important;
		}

		.conn-editor-field span,
		.conn-editor-advanced summary {
			color: rgba(240, 245, 255, 0.78);
			font-size: 11px;
			font-weight: 600;
		}

		.conn-editor-field-hint,
		.conn-editor-section-hint {
			color: rgba(201, 210, 255, 0.56);
			font-size: 11px;
			line-height: 1.45;
		}

		.conn-editor-section-hint {
			margin: 0;
		}

		.conn-editor-field input,
		.conn-editor-field select,
		.conn-editor-field textarea {
			width: 100%;
			min-width: 0;
			border: 1px solid rgba(201, 210, 255, 0.14);
			border-radius: 4px;
			background: rgba(5, 7, 13, 0.92);
			color: rgba(244, 248, 255, 0.92);
			font: inherit;
			font-size: 12px;
			line-height: 1.45;
		}

		.conn-editor-field input,
		.conn-editor-field select {
			min-height: 36px;
			padding: 7px 9px;
		}

		.conn-editor-field textarea {
			resize: vertical;
			padding: 9px;
		}

		.conn-editor-current-target {
			display: block;
			overflow-wrap: anywhere;
			padding: 8px 10px;
			border: 1px solid rgba(201, 210, 255, 0.1);
			border-radius: 4px;
			background: rgba(255, 255, 255, 0.035);
			color: rgba(223, 230, 255, 0.72);
			font-family: var(--font-mono);
			font-size: 10px;
		}

		.conn-editor-target-preview {
			display: grid;
			gap: 5px;
			padding: 10px 12px;
			border: 1px solid rgba(201, 210, 255, 0.12);
			border-radius: 4px;
			background: rgba(201, 210, 255, 0.055);
			color: rgba(226, 234, 255, 0.7);
			font-size: 11px;
			line-height: 1.55;
		}

		.conn-editor-target-preview strong {
			color: rgba(246, 249, 255, 0.94);
			font-size: 12px;
		}

		.conn-editor-target-preview code {
			overflow-wrap: anywhere;
			color: rgba(201, 210, 255, 0.82);
			font-family: var(--font-mono);
			font-size: 10px;
		}

		.conn-editor-target-note {
			color: rgba(255, 209, 102, 0.78);
		}

		.conn-editor-error {
			padding: 9px 10px;
			border: 1px solid rgba(255, 113, 136, 0.32);
			border-radius: 4px;
			background: rgba(255, 113, 136, 0.1);
			color: rgba(255, 190, 202, 0.96);
			font-size: 12px;
		}

		.conn-editor-advanced {
			display: grid;
			gap: 10px;
			padding-top: 4px;
		}

		.conn-editor-advanced summary {
			cursor: pointer;
			list-style-position: inside;
		}

		.agent-activity-item {
			grid-template-columns: minmax(0, 1fr);
			align-items: stretch;
			gap: 10px;
		}

		.agent-activity-copy {
			display: grid;
			gap: 7px;
			min-width: 0;
		}

		.agent-activity-title-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			min-width: 0;
		}

		.agent-activity-title-row strong {
			min-width: 0;
			overflow: hidden;
			color: rgba(246, 249, 255, 0.94);
			font-size: 13px;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.agent-activity-source {
			flex: 0 0 auto;
			color: rgba(201, 210, 255, 0.68);
			font-family: var(--font-mono);
			font-size: 10px;
			text-transform: uppercase;
		}

		.agent-activity-text {
			display: -webkit-box;
			overflow: hidden;
			color: rgba(226, 234, 255, 0.7);
			font-size: 12px;
			line-height: 1.55;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 3;
		}

		.agent-activity-meta {
			display: flex;
			flex-wrap: wrap;
			gap: 6px 10px;
			color: rgba(226, 234, 255, 0.46);
			font-size: 10px;
			line-height: 1.5;
		}

		.agent-activity-meta code {
			overflow-wrap: anywhere;
			color: rgba(223, 230, 255, 0.68);
			font-family: var(--font-mono);
			font-size: 10px;
		}

		.agent-activity-actions {
			display: flex;
			flex-wrap: wrap;
			justify-content: flex-end;
			gap: 8px;
		}

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

		@media (max-width: 960px) {
			.stream-layout {
				gap: 12px;
			}

			.chat-meta,
			.composer,
			.topbar {
				grid-template-columns: 1fr;
			}

			.composer-side {
				grid-template-columns: repeat(2, minmax(0, 1fr));
			}

			.drop-zone-top,
			.asset-modal-head {
				flex-direction: column;
				align-items: stretch;
			}

			.topbar-right {
				justify-items: start;
			}
		}

		@media (max-width: 640px) {
			body {
				padding: 0;
			}

			.shell {
				height: 100vh;
				border-left: 0;
				border-right: 0;
			}

			.chat-stage {
				width: 100%;
				margin: 0;
				border-left: 0;
				border-right: 0;
			}

			.topbar {
				width: 100%;
				padding: 16px 18px 12px;
			}

			.message {
				padding-left: 12px;
				padding-right: 12px;
			}

			.message.user,
			.message.assistant {
				padding-left: 12px;
				padding-right: 12px;
			}

			.asset-modal-shell {
				padding: 0;
			}

			.asset-modal {
				width: 100%;
				height: 100%;
				max-height: none;
				border-left: 0;
				border-right: 0;
			}
		}

		body {
			position: relative;
			padding: 0;
			align-items: center;
		}

		body::before {
			content: "";
			position: fixed;
			inset: 0;
			background:
				linear-gradient(rgba(201, 210, 255, 0.022) 1px, transparent 1px),
				linear-gradient(90deg, rgba(201, 210, 255, 0.018) 1px, transparent 1px),
				linear-gradient(180deg, rgba(8, 8, 18, 0.1), rgba(3, 3, 9, 0.42));
			background-size: 40px 40px, 40px 40px, auto;
			opacity: 0.38;
			pointer-events: none;
		}

		.shell {
			position: relative;
			width: 100vw;
			height: 100vh;
			margin: 0;
			border: 0;
			border-radius: 4px;
			background: transparent;
			box-shadow: none;
			backdrop-filter: none;
			isolation: isolate;
		}

		.topbar {
			position: relative;
			z-index: 2;
			width: 100%;
			min-height: 44px;
			margin: 0;
			padding: 0 24px;
			grid-template-columns: 1fr;
			align-items: center;
			justify-items: center;
			border-bottom: 1px solid rgba(201, 210, 255, 0.06);
		}

		.topbar-signal,
		.hero-wordmark {
			font-family: var(--font-mono);
			font-weight: 700;
			text-transform: uppercase;
			font-smooth: never;
			-webkit-font-smoothing: none;
			text-rendering: optimizeSpeed;
		}

		.topbar-signal {
			justify-self: center;
			color: #35cfff;
			font-size: 13px;
			letter-spacing: 0.22em;
			text-shadow:
				2px 0 0 rgba(8, 14, 24, 0.95),
				0 2px 0 rgba(8, 14, 24, 0.95),
				0 0 12px rgba(53, 207, 255, 0.22);
		}

		.chat-stage {
			position: relative;
			width: 100%;
			margin: 0;
			padding: 0 28px 22px;
		}

		.landing-screen {
			display: none;
			position: relative;
			flex: 1 1 auto;
			min-height: 0;
			z-index: 1;
		}

		.shell[data-stage-mode="landing"] .landing-screen {
			display: grid;
		}

		.landing-grid {
			position: relative;
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto minmax(180px, 220px);
			align-items: center;
			width: 100%;
			height: 100%;
		}

		.hero-core {
			position: absolute;
			left: 50%;
			top: 50%;
			z-index: 1;
			display: grid;
			gap: 16px;
			text-align: center;
			transform: translate(-50%, -50%);
			animation: hero-core-drift 8s ease-in-out infinite;
		}

		.hero-mark {
			display: none;
		}

		.hero-wordmark {
			color: rgba(53, 207, 255, 0.3);
			font-size: clamp(54px, 8.4vw, 84px);
			line-height: 0.88;
			letter-spacing: 0.18em;
			text-indent: 0.18em;
			text-shadow:
				4px 0 0 rgba(8, 14, 24, 0.92),
				0 4px 0 rgba(8, 14, 24, 0.92),
				0 0 30px rgba(53, 207, 255, 0.12);
		}

		.hero-divider {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 14px;
		}

		.hero-divider span {
			width: 90px;
			height: 1px;
			background: linear-gradient(90deg, transparent, rgba(201, 210, 255, 0.24), transparent);
		}

		.hero-divider em {
			color: rgba(214, 220, 255, 0.34);
			font-size: 11px;
			font-style: normal;
			letter-spacing: 0.28em;
		}

		.landing-side-right {
			position: absolute;
			right: 50%;
			top: 72px;
			z-index: 3;
			display: flex;
			gap: 6px;
			align-items: center;
			max-width: min(720px, calc(100% - 48px));
			padding: 5px;
			border: 1px solid rgba(201, 210, 255, 0.08);
			border-radius: 4px;
			background: rgba(5, 7, 13, 0.78);
			box-shadow: 0 12px 26px rgba(0, 0, 0, 0.18);
			transform: translateX(50%);
		}

		.telemetry-card {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 72px;
			min-height: 32px;
			text-align: center;
			opacity: 0.86;
		}

		.telemetry-card span {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
		}

		.telemetry-card strong {
			color: rgba(228, 235, 255, 0.78);
			font-size: 11px;
			letter-spacing: 0.02em;
			font-weight: 600;
		}

		.telemetry-action {
			font: inherit;
			color: inherit;
			cursor: pointer;
			padding: 0 10px;
			border: 1px solid transparent;
			border-radius: 4px;
			background: transparent;
			box-shadow: none;
			text-align: center;
		}

		.telemetry-action:hover:not(:disabled),
		.telemetry-action:focus-visible {
			border-color: rgba(201, 210, 255, 0.2);
			background: rgba(201, 210, 255, 0.08);
			box-shadow: none;
			transform: translateY(0);
		}

		.telemetry-action:hover:not(:disabled) strong,
		.telemetry-action:focus-visible strong {
			color: rgba(246, 249, 255, 0.96);
			text-shadow: none;
		}

		.telemetry-action:disabled {
			cursor: wait;
		}

		.command-deck {
			position: relative;
			z-index: 2;
			flex-shrink: 0;
		}

		.shell[data-stage-mode="landing"] .stream-layout {
			position: absolute;
			inset: 86px 34px var(--command-deck-offset, 176px) 34px;
			display: flex;
			align-items: center;
			overflow: hidden;
			z-index: 3;
			pointer-events: none;
		}

		.shell[data-stage-mode="landing"][data-transcript-state="idle"] .stream-layout {
			justify-content: center;
		}

		.shell[data-stage-mode="landing"][data-transcript-state="active"] .stream-layout {
			justify-content: flex-end;
		}

		.shell[data-stage-mode="landing"] .transcript-pane,
		.shell[data-stage-mode="landing"] .transcript {
			pointer-events: auto;
		}

		.shell[data-stage-mode="landing"] .transcript-pane {
			flex: 1 1 auto;
			width: min(var(--conversation-width), 100%);
			height: 100%;
			max-height: 100%;
			margin: 0 auto;
		}

		.shell[data-stage-mode="landing"] .transcript {
			padding: 0 0 12px;
		}

		.shell[data-stage-mode="landing"] .command-deck {
			display: grid;
			grid-auto-rows: max-content;
			align-self: end;
			align-content: end;
			gap: 4px;
			width: min(var(--conversation-width), 100%);
			margin: 0 auto 12px;
			z-index: 4;
		}

		.shell[data-stage-mode="landing"] .context-usage-row {
			min-height: 22px;
			margin: -6px 0 -3px;
		}

		.shell[data-stage-mode="landing"] .composer {
			grid-template-columns: minmax(0, 1fr) auto;
			align-self: end;
			align-items: center;
			height: fit-content;
			min-height: 0;
			max-height: none;
			gap: 8px;
			padding: 6px 8px 6px 10px;
			border: 0;
			border-radius: 4px;
			background: rgba(90, 82, 122, 0.22);
			box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
			backdrop-filter: none;
		}

		.shell[data-stage-mode="landing"] .composer-header {
			display: none;
		}

		.shell[data-stage-mode="landing"] .composer-main {
			gap: 4px;
		}

		.shell[data-stage-mode="landing"] .composer textarea {
			--composer-line-height: 20px;
			min-height: 40px;
			max-height: calc(var(--composer-line-height) * var(--composer-textarea-max-lines) + 20px);
			padding: 10px 8px;
			border: 0;
			background: transparent;
			box-shadow: none;
			color: rgba(238, 244, 255, 0.84);
			line-height: var(--composer-line-height);
			resize: none;
			overflow-y: auto;
		}

		.shell[data-stage-mode="landing"] .composer textarea::placeholder {
			color: rgba(214, 220, 255, 0.28);
		}

		.shell[data-stage-mode="landing"] .composer textarea:focus {
			background: transparent;
			box-shadow: none;
		}

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

		@keyframes hero-core-drift {
			0%,
			100% {
				transform: translate(-50%, -50%) scale(1);
				opacity: 0.92;
			}
			50% {
				transform: translate(-50%, calc(-50% - 6px)) scale(1.015);
				opacity: 1;
			}
		}

		@media (max-width: 900px) {
			.chat-stage {
				padding: 0 18px 18px;
			}

			.landing-grid {
				grid-template-columns: 1fr;
			}

			.hero-core {
				left: 50%;
				top: 50%;
			}

			.landing-side-right {
				right: 50%;
				top: 66px;
				gap: 5px;
				max-width: calc(100% - 32px);
				transform: translateX(50%);
			}

			.telemetry-card {
				min-width: 64px;
			}

			.shell[data-stage-mode="landing"] .stream-layout {
				inset: 78px 18px var(--command-deck-offset, 190px) 18px;
			}
		}

		@media (max-width: 640px) {
			body {
				padding: 0;
			}

			.shell {
				width: 100vw;
				height: 100vh;
				border-radius: 0;
				--transcript-bottom-scroll-buffer: calc(112px + env(safe-area-inset-bottom));
			}

			.topbar {
				grid-template-columns: 1fr;
				width: 100%;
				padding: max(8px, env(safe-area-inset-top)) 12px 6px;
				min-height: 48px;
				gap: 0;
				border-bottom: 0;
				background: linear-gradient(180deg, rgba(6, 8, 15, 0.96), rgba(6, 8, 15, 0.64));
				backdrop-filter: none;
			}

			.topbar-signal {
				display: none;
			}

			.mobile-topbar {
				display: grid;
				grid-template-columns: auto minmax(0, 1fr) auto auto;
				gap: 8px;
				min-height: 48px;
			}

			.mobile-brand-logo {
				width: 26px;
				height: 26px;
			}

			.mobile-brand-wordmark {
				font-size: 12px;
				letter-spacing: 0.06em;
			}

			.landing-screen {
				display: none !important;
			}

			.landing-side-right {
				display: none;
			}

			.chat-stage {
				display: grid;
				grid-template-rows: auto minmax(0, 1fr) auto;
				gap: 8px;
				padding: 0 8px calc(8px + env(safe-area-inset-bottom));
				overflow: hidden;
			}

			.error-banner {
				top: 6px;
				width: calc(100% - 16px);
				padding: 10px 12px;
			}

			.notification-live-region {
				top: calc(10px + env(safe-area-inset-top));
				right: 12px;
				left: 12px;
				width: auto;
			}

			.transcript-pane {
				width: 100%;
				height: 100%;
				min-height: 0;
				border: 0;
				border-radius: 14px;
				background: transparent;
				box-shadow: none;
			}

			.transcript {
				padding: 8px 0 10px;
			}

			.archived-conversation-head {
				padding: 0 12px;
			}

			.stream-layout {
				gap: 0;
				flex: 1 1 auto;
				min-height: 0;
			}

			.shell[data-stage-mode="landing"] .stream-layout {
				position: relative;
				inset: auto;
				display: flex;
				align-items: stretch;
				justify-content: flex-start;
				overflow: hidden;
				z-index: 1;
				pointer-events: auto;
			}

			.shell[data-stage-mode="landing"][data-transcript-state="idle"] .stream-layout,
			.shell[data-stage-mode="landing"][data-transcript-state="active"] .stream-layout {
				justify-content: flex-start;
			}

			.shell[data-stage-mode="landing"] .transcript-pane {
				width: 100%;
				margin: 0;
			}

			.shell[data-stage-mode="landing"] .command-deck {
				grid-auto-rows: max-content;
				align-self: end;
				align-content: end;
				width: 100%;
				margin-bottom: 0;
			}

			.shell[data-transcript-state="idle"] .transcript-current:empty::before {
				content: "■   ■  ■■■  ■  ■\\A■   ■ ■     ■ ■ \\A■   ■ ■  ■■ ■■  \\A■   ■ ■   ■ ■ ■ \\A ■■■   ■■■  ■  ■";
				display: block;
				margin: 16vh auto 0;
				width: max-content;
				max-width: calc(100% - 32px);
				padding: 0;
				border: 0;
				border-radius: 0;
				background: transparent;
				color: rgba(231, 236, 255, 0.58);
				font-family: var(--font-mono);
				font-size: 14px;
				line-height: 1.08;
				letter-spacing: 0.08em;
				white-space: pre;
				text-align: center;
				text-shadow:
					0 0 12px rgba(201, 210, 255, 0.18),
					0 0 24px rgba(121, 105, 214, 0.12);
			}

			.file-strip {
				gap: 6px;
			}

			.context-usage-row {
				min-height: 24px;
				margin: -2px 0 -5px;
			}

			.context-usage-shell {
				width: 32px;
				height: 32px;
			}

			.context-usage-ring {
				inset: 3px;
				width: 24px;
				height: 24px;
			}

			.context-usage-summary {
				font-size: 8px;
			}

			.context-usage-meta {
				display: none;
			}

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

			.composer {
				grid-template-columns: minmax(0, 1fr) auto;
				gap: 8px;
				padding: 8px 8px 8px 10px;
				border: 1px solid rgba(201, 210, 255, 0.08);
				border-radius: 4px;
				background: rgba(8, 10, 19, 0.98);
				box-shadow:
					0 -8px 30px rgba(0, 0, 0, 0.18),
					inset 0 1px 0 rgba(255, 255, 255, 0.05);
			}

			.composer-main {
				gap: 4px;
				min-width: 0;
			}

			.composer-header {
				display: none;
			}

			.composer textarea {
				--composer-line-height: 20px;
				min-height: 44px;
				max-height: calc(var(--composer-line-height) * var(--composer-textarea-max-lines) + 24px);
				padding: 12px 0;
				border: 0;
				background: transparent;
				box-shadow: none;
				color: rgba(242, 246, 255, 0.92);
				font-size: 14px;
				line-height: var(--composer-line-height);
				resize: none;
				overflow-y: auto;
			}

			.composer textarea:focus {
				background: transparent;
				box-shadow: none;
			}

			.composer-side {
				display: grid;
				grid-auto-flow: column;
				grid-auto-columns: 46px;
				gap: 8px;
				align-content: end;
				align-items: end;
			}

			.shell[data-stage-mode="landing"] .composer {
				grid-template-columns: minmax(0, 1fr) auto;
				align-self: end;
				align-items: center;
				height: fit-content;
				min-height: 0;
				max-height: none;
				gap: 8px;
				padding: 6px 8px 6px 10px;
				border: 1px solid rgba(201, 210, 255, 0.08);
				border-radius: 4px;
				background: rgba(8, 10, 19, 0.98);
				box-shadow:
					0 -8px 30px rgba(0, 0, 0, 0.18),
					inset 0 1px 0 rgba(255, 255, 255, 0.05);
			}

			.shell[data-stage-mode="landing"] .composer-side {
				display: grid;
				grid-auto-flow: column;
				grid-auto-columns: 46px;
				gap: 8px;
				align-content: end;
				align-items: end;
			}

			.shell[data-stage-mode="landing"] .composer textarea {
				--composer-line-height: 20px;
				min-height: 40px;
				max-height: calc(var(--composer-line-height) * var(--composer-textarea-max-lines) + 20px);
				padding: 10px 0;
				font-size: 14px;
				line-height: var(--composer-line-height);
				color: rgba(242, 246, 255, 0.92);
			}

			#send-button,
			#interrupt-button {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 46px;
				min-height: 46px;
				padding: 0;
				border: 0;
				border-radius: 0;
				background: transparent;
				box-shadow: none;
				appearance: none;
				-webkit-appearance: none;
				color: transparent;
				font-size: 0;
				line-height: 0;
				letter-spacing: 0;
				text-indent: -9999px;
				overflow: hidden;
			}

			#send-button:hover:not(:disabled),
			#send-button:focus-visible,
			#interrupt-button:hover:not(:disabled),
			#interrupt-button:focus-visible {
				border: 0;
				background: transparent;
				box-shadow: none;
				transform: none;
			}

			#send-button::before {
				content: "";
				display: block;
				width: 28px;
				height: 28px;
				background-repeat: no-repeat;
				background-position: center;
				background-size: 28px 28px;
				background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M8 13V4' stroke='rgba(242,246,255,0.9)' stroke-width='1.6' stroke-linecap='round'/%3E%3Cpath d='M4.75 7.25L8 4L11.25 7.25' stroke='rgba(242,246,255,0.9)' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
			}

			#interrupt-button::before {
				content: "";
				display: block;
				width: 28px;
				height: 28px;
				background-repeat: no-repeat;
				background-position: center;
				background-size: 28px 28px;
				background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Crect x='4' y='4' width='8' height='8' rx='1.2' fill='rgba(255,255,255,0.96)'/%3E%3C/svg%3E");
			}

			#interrupt-button:disabled {
				display: inline-flex;
				opacity: 0.38;
				background: transparent;
				box-shadow: none;
				cursor: default;
			}

			.message {
				padding-top: 10px;
			}

			.message.user .message-body {
				max-width: min(100%, 90%);
			}

			.message-body {
				padding: 14px 14px 15px;
				border-radius: 14px;
				background: rgba(24, 28, 39, 0.82);
			}

			.message-content {
				font-size: 14px;
				line-height: 1.75;
				min-width: 0;
			}

			.message-meta {
				padding: 0 2px;
				font-size: 9px;
			}

			.message-actions {
				padding: 0 2px 0 0;
			}

			.message-copy-button {
				width: 24px;
				height: 24px;
			}

			.message,
			.message-body,
			.message-content,
			.message-content .code-block,
			.message-content pre {
				min-width: 0;
				max-width: 100%;
				box-sizing: border-box;
			}

			.message-content .code-block {
				border: 0;
				border-radius: 0;
				background: transparent;
				box-shadow: none;
				position: relative;
				overflow: hidden;
			}

			.message-content .code-block-toolbar {
				position: absolute;
				top: 8px;
				right: 8px;
				display: flex;
				align-items: center;
				justify-content: flex-end;
				padding: 0;
				border: 0;
				background: transparent;
				pointer-events: none;
				z-index: 1;
			}

			.message-content .code-block-language {
				display: none;
			}

			.message-content .copy-code-button {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 24px;
				height: 24px;
				padding: 0;
				border: 0;
				border-radius: 0;
				background: transparent;
				color: transparent;
				font-size: 0;
				line-height: 0;
				text-indent: -9999px;
				overflow: hidden;
				pointer-events: auto;
				box-shadow: none;
				opacity: 0.82;
			}

			.message-content .copy-code-button::before {
				content: "";
				width: 14px;
				height: 14px;
				display: block;
				background-repeat: no-repeat;
				background-position: center;
				background-size: 14px 14px;
				background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Crect x='5' y='3' width='8' height='10' rx='1.5' stroke='rgba(242,246,255,0.82)' stroke-width='1.4'/%3E%3Cpath d='M3.5 10.5V5.5C3.5 4.4 4.4 3.5 5.5 3.5' stroke='rgba(242,246,255,0.62)' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E");
			}

			.message-content .copy-code-button:disabled {
				opacity: 0.5;
			}

			.message-content .copy-code-button:disabled::before {
				opacity: 0.72;
			}

			.message-content pre,
			.message-content .code-block pre {
				margin: 0;
				padding: 14px 12px 10px;
				border: 1px solid rgba(255, 255, 255, 0);
				border-radius: 12px;
				background: transparent;
				box-shadow: none;
				overflow-x: auto;
				overflow-y: hidden;
			}

			.message.assistant .message-content pre,
			.message.assistant .message-content .code-block,
			.message.assistant .message-content .code-block pre {
				background: transparent;
			}

			.message.assistant .message-content code {
				background: transparent;
			}

			.message-content pre code {
				font-size: 11px;
				line-height: 1.6;
				white-space: pre-wrap;
				overflow-wrap: anywhere;
				word-break: break-word;
			}

			.transcript-pane,
			.mobile-topbar-button,
			.mobile-overflow-menu,
			.mobile-overflow-menu-item,
			.shell[data-transcript-state="idle"] .transcript-current:empty::before,
			.shell[data-stage-mode="landing"] .composer,
			#send-button,
			#interrupt-button,
			.message-body,
			.message-copy-button,
			.message-content .code-block,
			.message-content .copy-code-button,
			.message-content pre,
			.message-content .code-block pre,
			.file-chip,
			.file-chip-badge,
			.file-chip-remove,
			.selected-assets,
			.asset-pill,
			.asset-empty,
			.asset-modal-panel,
			.conn-editor-panel,
			.conn-editor-field input,
			.conn-editor-field select,
			.conn-editor-field textarea,
			.asset-modal-search input,
			.error-banner,
			.error-banner-close,
			.assistant-loading-card,
			.assistant-process-shell,
			.history-load-more {
				border-radius: 4px !important;
			}

			.conn-editor-grid {
				grid-template-columns: minmax(0, 1fr);
			}
		}
	`;
}

let markedBrowserScriptCache: string | undefined;

function getMarkedBrowserScript(): string {
	if (!markedBrowserScriptCache) {
		markedBrowserScriptCache = readFileSync(join(process.cwd(), "node_modules", "marked", "lib", "marked.umd.js"), "utf8")
			.replace(/\/\/# sourceMappingURL=.*$/gm, "")
			.replace(/<\/script/gi, "<\\/script");
	}
	return markedBrowserScriptCache;
}

function getBrowserMarkdownRendererScript(): string {
	return `
		function renderMessageMarkdown(source) {
			function escapeHtml(value) {
				return String(value || "")
					.replace(/&/g, "&amp;")
					.replace(/</g, "&lt;")
					.replace(/>/g, "&gt;")
					.replace(/"/g, "&quot;")
					.replace(/'/g, "&#39;");
			}

			function escapeAttribute(value) {
				return escapeHtml(value).replace(/\`/g, "&#96;");
			}

			function isSafeHttpUrl(value) {
				try {
					const url = new URL(value);
					return url.protocol === "http:" || url.protocol === "https:";
				} catch (_error) {
					return false;
				}
			}

			const normalized = String(source || "").replace(/\\r\\n?/g, "\\n").trim();
			if (!normalized) {
				return "<p></p>";
			}

			const markedApi = globalThis.marked;
			if (!markedApi || typeof markedApi.Marked !== "function") {
				return "<p>" + escapeHtml(normalized).replace(/\\n/g, "<br />") + "</p>";
			}

			if (!globalThis.__ugkPlaygroundMarkdownParser) {
				globalThis.__ugkPlaygroundMarkdownParser = new markedApi.Marked({
					gfm: true,
					breaks: false,
					async: false,
					renderer: {
						html: function html(token) {
							return escapeHtml(token && token.text ? token.text : "");
						},
						link: function link(token) {
							const href = token && token.href ? token.href : "";
							const text = token && token.text ? token.text : "";
							if (!isSafeHttpUrl(href)) {
								return escapeHtml(text);
							}
							const title = token && token.title ? ' title="' + escapeAttribute(token.title) + '"' : "";
							return '<a href="' + escapeAttribute(href) + '"' + title + ' target="_blank" rel="noreferrer noopener">' + escapeHtml(text) + "</a>";
						},
					},
				});
			}

			const rendered = globalThis.__ugkPlaygroundMarkdownParser.parse(normalized, { async: false });
			return String(rendered || "").trim() || "<p></p>";
		}
	`;
}

function getPlaygroundScript(): string {
	return `
		${getBrowserMarkdownRendererScript()}

		const CONVERSATION_HISTORY_INDEX_KEY = "ugk-pi:conversation-history-index";
		const TRANSCRIPT_FOLLOW_THRESHOLD_PX = 120;
		const MAX_STORED_CONVERSATIONS = 12;
		const MAX_STORED_MESSAGES_PER_CONVERSATION = 160;
		const MAX_ARCHIVED_TRANSCRIPTS = 4;
		const FALLBACK_CONTEXT_WINDOW = 128000;
		const FALLBACK_RESPONSE_TOKENS = 16384;
		const FALLBACK_RESERVE_TOKENS = 16384;
		const LAYOUT_SYNC_DELAY_MS = 80;
		const RESUME_SYNC_COOLDOWN_MS = 900;
		const TRANSCRIPT_BOTTOM_SYNC_COOLDOWN_MS = 160;
		const CONTEXT_STATUS_LABELS = {
			safe: "上下文充足",
			caution: "接近提醒线",
			warning: "接近上限",
			danger: "建议新会话",
		};

		const CONN_STATUS_LABELS = {
			active: "运行中",
			paused: "已暂停",
			completed: "已完成",
		};
		const CONN_RUN_STATUS_LABELS = {
			pending: "待执行",
			running: "执行中",
			succeeded: "成功",
			failed: "失败",
			cancelled: "已取消",
		};
		const ACTIVITY_SOURCE_LABELS = {
			conn: "后台任务",
			feishu: "飞书",
			notification: "通知",
			agent: "助手",
		};

		function debounce(fn, delay) {
			let timer = null;
			return function debounced(...args) {
				if (timer !== null) {
					window.clearTimeout(timer);
				}
				timer = window.setTimeout(() => {
					timer = null;
					fn.apply(this, args);
				}, delay);
			};
		}

		const state = {
			loading: false,
			stageMode: "landing",
			conversationId: "",
			streamingText: "",
			activeAssistantContent: null,
			activeLoadingShell: null,
			activeLoadingLabel: null,
			activeLoadingDots: null,
			activeProcessShell: null,
			activeProcessNarration: null,
			activeProcessAction: null,
			lastProcessNarration: "",
			receivedDoneEvent: false,
			pendingAttachments: [],
			recentAssets: [],
			selectedAssetRefs: [],
			contextUsage: null,
			contextUsageExpanded: false,
			contextUsageSyncToken: 0,
			dragDepth: 0,
			assetModalOpen: false,
			agentActivityOpen: false,
			agentActivityItems: [],
			agentActivityLoading: false,
			agentActivityError: "",
			connManagerOpen: false,
			connManagerItems: [],
			connManagerRunsByConnId: {},
			connManagerActionConnId: "",
			connManagerNotice: "",
			connManagerHighlightedConnId: "",
			connManagerFilter: "all",
			connManagerSelectedConnIds: [],
			connEditorOpen: false,
			connEditorMode: "create",
			connEditorConnId: "",
			connEditorSaving: false,
			connEditorError: "",
			mobileOverflowMenuOpen: false,
			mobileConversationDrawerOpen: false,
			conversationCatalog: [],
			conversationCatalogSyncing: false,
			conversationState: null,
			conversationHistory: [],
			renderedHistoryCount: 0,
			historyPageSize: 12,
			historyLoadingMore: false,
			activeRunEventController: null,
			notificationEventSource: null,
			notificationReconnectTimer: null,
			notificationReconnectDelayMs: 0,
			pageUnloading: false,
			primaryStreamActive: false,
			autoFollowTranscript: true,
			layoutSyncRaf: 0,
			layoutSyncTimer: null,
			resumeSyncPromise: null,
			resumeSyncTimer: null,
			lastResumeSyncAt: 0,
			transcriptScrollRaf: 0,
			transcriptScrollTimer: null,
			lastTranscriptScrollAt: 0,
			historyPersistTimer: null,
			historyPersistConversationId: "",
		};

		const renderedMessages = new Map();

		const transcript = document.getElementById("transcript");
		const transcriptArchive = document.getElementById("transcript-archive");
		const transcriptCurrent = document.getElementById("transcript-current");
		const historyLoadMoreButton = document.getElementById("history-load-more-button");
		const scrollToBottomButton = document.getElementById("scroll-to-bottom-button");
		const errorBanner = document.getElementById("error-banner");
		const errorBannerMessage = document.getElementById("error-banner-message");
		const errorBannerClose = document.getElementById("error-banner-close");
		const notificationLiveRegion = document.getElementById("notification-live-region");
		const notificationToastStack = document.getElementById("notification-toast-stack");
		const dragOverlay = document.getElementById("drag-overlay");
		const pageRoot = document.documentElement;
		const pageBody = document.body;
		const shell = document.getElementById("shell");
		const landingScreen = document.getElementById("landing-screen");
		const sessionFile = document.getElementById("session-file");
		const chatStage = document.getElementById("chat-stage");
		const conversationInput = document.getElementById("conversation-id");
		const messageInput = document.getElementById("message");
		const commandDeck = document.getElementById("command-deck");
		const composerDropTarget = document.getElementById("composer-drop-target");
		const dropZone = document.getElementById("drop-zone");
		const fileInput = document.getElementById("file-input");
		const filePickerAction = document.getElementById("file-picker-action");
		const fileList = document.getElementById("file-list");
		const selectedAssetsSection = document.getElementById("selected-assets");
		const selectedAssetList = document.getElementById("selected-asset-list");
		const contextUsageShell = document.getElementById("context-usage-shell");
		const contextUsageProgress = document.getElementById("context-usage-progress");
		const contextUsageSummary = document.getElementById("context-usage-summary");
		const contextUsageMeta = document.getElementById("context-usage-meta");
		const contextUsageToggle = document.getElementById("context-usage-toggle");
		const contextUsageDialog = document.getElementById("context-usage-dialog");
		const contextUsageDialogBody = document.getElementById("context-usage-dialog-body");
		const contextUsageDialogClose = document.getElementById("context-usage-dialog-close");
		const connRunDetailsDialog = document.getElementById("conn-run-details-dialog");
		const connRunDetailsBody = document.getElementById("conn-run-details-body");
		const connRunDetailsClose = document.getElementById("conn-run-details-close");
		const openAgentActivityButton = document.getElementById("open-agent-activity-button");
		const agentActivityDialog = document.getElementById("agent-activity-dialog");
		const agentActivityList = document.getElementById("agent-activity-list");
		const closeAgentActivityButton = document.getElementById("close-agent-activity-button");
		const refreshAgentActivityButton = document.getElementById("refresh-agent-activity-button");
		const openConnManagerButton = document.getElementById("open-conn-manager-button");
		const connManagerDialog = document.getElementById("conn-manager-dialog");
		const connManagerNotice = document.getElementById("conn-manager-notice");
		const connManagerFilter = document.getElementById("conn-manager-filter");
		const connManagerSelectedCount = document.getElementById("conn-manager-selected-count");
		const selectVisibleConnsButton = document.getElementById("select-visible-conns-button");
		const clearSelectedConnsButton = document.getElementById("clear-selected-conns-button");
		const deleteSelectedConnsButton = document.getElementById("delete-selected-conns-button");
		const connManagerList = document.getElementById("conn-manager-list");
		const closeConnManagerButton = document.getElementById("close-conn-manager-button");
		const refreshConnManagerButton = document.getElementById("refresh-conn-manager-button");
		const openConnEditorButton = document.getElementById("open-conn-editor-button");
		const connEditorDialog = document.getElementById("conn-editor-dialog");
		const connEditorForm = document.getElementById("conn-editor-form");
		const connEditorTitle = document.getElementById("conn-editor-title");
		const connEditorError = document.getElementById("conn-editor-error");
		const connEditorTitleInput = document.getElementById("conn-editor-title-input");
		const connEditorPrompt = document.getElementById("conn-editor-prompt");
		const connEditorTargetType = document.getElementById("conn-editor-target-type");
		const connEditorTargetId = document.getElementById("conn-editor-target-id");
		const connEditorTargetIdLabel = document.getElementById("conn-editor-target-id-label");
		const connEditorTargetIdHint = document.getElementById("conn-editor-target-id-hint");
		const connEditorTargetCurrent = document.getElementById("conn-editor-target-current");
		const connEditorTargetPreview = document.getElementById("conn-editor-target-preview");
		const connEditorScheduleKind = document.getElementById("conn-editor-schedule-kind");
		const connEditorOnceAt = document.getElementById("conn-editor-once-at");
		const connEditorIntervalMinutes = document.getElementById("conn-editor-interval-minutes");
		const connEditorIntervalStart = document.getElementById("conn-editor-interval-start");
		const connEditorTimeOfDay = document.getElementById("conn-editor-time-of-day");
		const connEditorProfileId = document.getElementById("conn-editor-profile-id");
		const connEditorAgentSpecId = document.getElementById("conn-editor-agent-spec-id");
		const connEditorSkillSetId = document.getElementById("conn-editor-skill-set-id");
		const connEditorModelPolicyId = document.getElementById("conn-editor-model-policy-id");
		const connEditorUpgradePolicy = document.getElementById("conn-editor-upgrade-policy");
		const connEditorMaxRunSeconds = document.getElementById("conn-editor-max-run-seconds");
		const connEditorAssetRefs = document.getElementById("conn-editor-asset-refs");
		const saveConnEditorButton = document.getElementById("save-conn-editor-button");
		const cancelConnEditorButton = document.getElementById("cancel-conn-editor-button");
		const closeConnEditorButton = document.getElementById("close-conn-editor-button");
		const openAssetLibraryButton = document.getElementById("open-asset-library-button");
		const assetModal = document.getElementById("asset-modal");
		const assetModalList = document.getElementById("asset-modal-list");
		const closeAssetModalButton = document.getElementById("close-asset-modal-button");
		const refreshAssetsButton = document.getElementById("refresh-assets-button");
		const sendButton = document.getElementById("send-button");
		const interruptButton = document.getElementById("interrupt-button");
		const viewSkillsButton = document.getElementById("view-skills-button");
		const newConversationButton = document.getElementById("new-conversation-button");
		const mobileTopbar = document.getElementById("mobile-topbar");
		const mobileBrandButton = document.getElementById("mobile-brand-button");
		const mobileNewConversationButton = document.getElementById("mobile-new-conversation-button");
		const mobileOverflowMenuButton = document.getElementById("mobile-overflow-menu-button");
		const mobileOverflowMenu = document.getElementById("mobile-overflow-menu");
		const mobileMenuSkillsButton = document.getElementById("mobile-menu-skills-button");
		const mobileMenuFileButton = document.getElementById("mobile-menu-file-button");
		const mobileMenuLibraryButton = document.getElementById("mobile-menu-library-button");
		const mobileMenuActivityButton = document.getElementById("mobile-menu-activity-button");
		const mobileMenuConnButton = document.getElementById("mobile-menu-conn-button");
		const mobileDrawerBackdrop = document.getElementById("mobile-drawer-backdrop");
		const mobileConversationDrawer = document.getElementById("mobile-conversation-drawer");
		const mobileConversationList = document.getElementById("mobile-conversation-list");
		const mobileDrawerCloseButton = document.getElementById("mobile-drawer-close-button");
		const statusPill = document.getElementById("status-pill");
		const commandStatus = document.getElementById("command-status");

		messageInput.placeholder = "和我聊聊吧";

		function createBrowserId() {
			const cryptoApi = globalThis.crypto;
			if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
				return cryptoApi.randomUUID();
			}
			if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
				const bytes = new Uint8Array(16);
				cryptoApi.getRandomValues(bytes);
				return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
			}
			return Date.now().toString(36) + Math.random().toString(36).slice(2);
		}

		function formatTokenCount(value) {
			const normalized = Math.max(0, Math.round(Number(value) || 0));
			return normalized.toLocaleString("en-US");
		}

		function estimateTextTokenCount(text) {
			return Math.ceil(String(text || "").length / 4);
		}

		function estimateBinaryTokenCount(mimeType, sizeBytes) {
			const normalizedMimeType = String(mimeType || "").toLowerCase();
			if (normalizedMimeType.startsWith("image/")) {
				return 1200;
			}
			const normalizedSize = Math.max(0, Number.isFinite(sizeBytes) ? Number(sizeBytes) : 0);
			if (normalizedSize === 0) {
				return 128;
			}
			return Math.max(128, Math.ceil(normalizedSize / 16));
		}

		function estimateAttachmentTokenCount(attachment) {
			if (typeof attachment?.text === "string" && attachment.text.length > 0) {
				return estimateTextTokenCount(attachment.text);
			}
			if (typeof attachment?.base64 === "string" && attachment.base64.length > 0) {
				const approxBytes = Math.ceil((attachment.base64.length * 3) / 4);
				return estimateBinaryTokenCount(attachment.mimeType, approxBytes);
			}
			return estimateBinaryTokenCount(attachment?.mimeType, attachment?.sizeBytes);
		}

		function estimatePromptAssetTokenCount(asset) {
			if (typeof asset?.textContent === "string" && asset.textContent.length > 0) {
				return estimateTextTokenCount(asset.textContent);
			}
			if (typeof asset?.textPreview === "string" && asset.textPreview.length > 0) {
				return estimateTextTokenCount(asset.textPreview);
			}
			if (asset?.kind === "text" || asset?.hasContent) {
				return estimateBinaryTokenCount(asset?.mimeType, asset?.sizeBytes);
			}
			return Math.max(32, estimateTextTokenCount((asset?.fileName || "") + " " + (asset?.mimeType || "")));
		}

		function resolveContextUsageStatus(currentTokens, contextWindow, reserveTokens) {
			const usableWindow = Math.max(1, contextWindow - reserveTokens);
			const ratio = currentTokens / usableWindow;
			if (ratio >= 1) {
				return "danger";
			}
			if (ratio >= 0.9) {
				return "warning";
			}
			if (ratio >= 0.72) {
				return "caution";
			}
			return "safe";
		}

		function createFallbackContextUsage() {
			return {
				provider: "dashscope-coding",
				model: "glm-5",
				currentTokens: 0,
				contextWindow: FALLBACK_CONTEXT_WINDOW,
				reserveTokens: FALLBACK_RESERVE_TOKENS,
				maxResponseTokens: FALLBACK_RESPONSE_TOKENS,
				availableTokens: Math.max(0, FALLBACK_CONTEXT_WINDOW - FALLBACK_RESERVE_TOKENS),
				percent: 0,
				status: "safe",
				mode: "estimate",
			};
		}

		function normalizeContextUsage(rawUsage) {
			const fallback = createFallbackContextUsage();
			if (!rawUsage || typeof rawUsage !== "object") {
				return fallback;
			}

			const contextWindow = Number(rawUsage.contextWindow);
			const reserveTokens = Number(rawUsage.reserveTokens);
			const maxResponseTokens = Number(rawUsage.maxResponseTokens);
			const currentTokens = Math.max(0, Number(rawUsage.currentTokens) || 0);
			const normalizedWindow = Number.isFinite(contextWindow) && contextWindow > 0 ? contextWindow : fallback.contextWindow;
			const normalizedReserve = Number.isFinite(reserveTokens) && reserveTokens >= 0 ? reserveTokens : fallback.reserveTokens;
			const normalizedResponse =
				Number.isFinite(maxResponseTokens) && maxResponseTokens >= 0 ? maxResponseTokens : fallback.maxResponseTokens;
			const percent = Math.max(0, Math.min(100, Math.round((currentTokens / normalizedWindow) * 100)));
			const status = ["safe", "caution", "warning", "danger"].includes(rawUsage.status)
				? rawUsage.status
				: resolveContextUsageStatus(currentTokens, normalizedWindow, normalizedReserve);

			return {
				provider: String(rawUsage.provider || fallback.provider),
				model: String(rawUsage.model || fallback.model),
				currentTokens,
				contextWindow: normalizedWindow,
				reserveTokens: normalizedReserve,
				maxResponseTokens: normalizedResponse,
				availableTokens: Math.max(0, normalizedWindow - normalizedReserve - currentTokens),
				percent,
				status,
				mode: rawUsage.mode === "usage" ? "usage" : "estimate",
			};
		}

		function estimateDraftContextTokens() {
			const selectedAssets = getSelectedAssets();
			const messageTokens = estimateTextTokenCount(messageInput.value);
			const attachmentTokens = state.pendingAttachments.reduce(
				(sum, attachment) => sum + estimateAttachmentTokenCount(attachment),
				0,
			);
			const assetTokens = selectedAssets.reduce((sum, asset) => sum + estimatePromptAssetTokenCount(asset), 0);

			return {
				messageTokens,
				attachmentTokens,
				assetTokens,
				totalTokens: messageTokens + attachmentTokens + assetTokens,
			};
		}

		function buildProjectedContextUsage(baseUsage, draftUsage) {
			const normalizedBase = normalizeContextUsage(baseUsage);
			const draftTokens = Math.max(0, Number(draftUsage?.totalTokens) || 0);
			const currentTokens = normalizedBase.currentTokens + draftTokens;
			const percent = Math.max(
				0,
				Math.min(100, Math.round((currentTokens / Math.max(1, normalizedBase.contextWindow)) * 100)),
			);

			return {
				...normalizedBase,
				currentTokens,
				availableTokens: Math.max(0, normalizedBase.contextWindow - normalizedBase.reserveTokens - currentTokens),
				percent,
				status: resolveContextUsageStatus(
					currentTokens,
					normalizedBase.contextWindow,
					normalizedBase.reserveTokens,
				),
				mode: draftTokens > 0 ? "estimate" : normalizedBase.mode,
				baseTokens: normalizedBase.currentTokens,
				draftTokens,
				messageTokens: Math.max(0, Number(draftUsage?.messageTokens) || 0),
				attachmentTokens: Math.max(0, Number(draftUsage?.attachmentTokens) || 0),
				assetTokens: Math.max(0, Number(draftUsage?.assetTokens) || 0),
			};
		}

		function renderContextUsageBar() {
			const draftUsage = estimateDraftContextTokens();
			const projectedUsage = buildProjectedContextUsage(state.contextUsage, draftUsage);
			const hasDraft = draftUsage.totalTokens > 0;
			const summaryPrefix = hasDraft ? "预计发送后" : "当前上下文";
			const baseLabel = "会话 " + formatTokenCount(projectedUsage.baseTokens);
			const draftLabel = "待发 " + formatTokenCount(projectedUsage.draftTokens);
			const reserveLabel = "预留 " + formatTokenCount(projectedUsage.reserveTokens);
			const statusLabel = CONTEXT_STATUS_LABELS[projectedUsage.status] || CONTEXT_STATUS_LABELS.safe;
			const modeLabel = projectedUsage.mode === "usage" ? "基于最近一次 usage" : "按当前输入估算";
			const summaryLine =
				summaryPrefix +
				" " +
				formatTokenCount(projectedUsage.currentTokens) +
				" / " +
				formatTokenCount(projectedUsage.contextWindow) +
				" tokens (" +
				projectedUsage.percent +
				"%)";
			const breakdownLine = baseLabel + " · " + draftLabel + " · " + reserveLabel;
			const detailLine =
				"模型 " +
				projectedUsage.model +
				" · " +
				projectedUsage.provider +
				" · " +
				modeLabel +
				" · " +
				statusLabel +
				" · 可用 " +
				formatTokenCount(projectedUsage.availableTokens);
			const detailText = summaryLine + "\\n" + breakdownLine + "\\n" + detailLine;

			contextUsageShell.dataset.status = projectedUsage.status;
			contextUsageShell.dataset.expanded = state.contextUsageExpanded ? "true" : "false";
			contextUsageSummary.textContent = projectedUsage.percent + "%";
			contextUsageShell.setAttribute("aria-label", "上下文使用 " + projectedUsage.percent + "%，" + statusLabel);
			contextUsageMeta.textContent = detailText;
			contextUsageDialogBody.textContent = detailText;
			contextUsageProgress.style.strokeDasharray = projectedUsage.percent + " 100";
			contextUsageProgress.setAttribute("stroke-dasharray", projectedUsage.percent + " 100");
			contextUsageProgress.setAttribute("aria-valuenow", String(projectedUsage.percent));
			contextUsageToggle.textContent = "上下文详情";
			contextUsageToggle.setAttribute("aria-expanded", state.contextUsageExpanded ? "true" : "false");
			scheduleConversationLayoutSync();
		}

		function isMobileContextUsageSurface() {
			return window.matchMedia("(max-width: 640px)").matches;
		}

		function openContextUsageDialog() {
			contextUsageDialog.hidden = false;
			contextUsageDialog.classList.add("open");
			contextUsageDialog.setAttribute("aria-hidden", "false");
		}

		function closeContextUsageDialog() {
			contextUsageDialog.classList.remove("open");
			contextUsageDialog.hidden = true;
			contextUsageDialog.setAttribute("aria-hidden", "true");
		}

		function closeConnRunDetailsDialog() {
			connRunDetailsDialog.classList.remove("open");
			connRunDetailsDialog.hidden = true;
			connRunDetailsDialog.setAttribute("aria-hidden", "true");
			connRunDetailsBody.innerHTML = "";
		}

		function openAgentActivity() {
			state.agentActivityOpen = true;
			agentActivityDialog.hidden = false;
			agentActivityDialog.classList.add("open");
			agentActivityDialog.setAttribute("aria-hidden", "false");
			renderAgentActivity();
			void loadAgentActivity({ silent: false });
		}

		function closeAgentActivity() {
			state.agentActivityOpen = false;
			agentActivityDialog.classList.remove("open");
			agentActivityDialog.hidden = true;
			agentActivityDialog.setAttribute("aria-hidden", "true");
		}

		function openConnManager() {
			state.connManagerOpen = true;
			connManagerDialog.hidden = false;
			connManagerDialog.classList.add("open");
			connManagerDialog.setAttribute("aria-hidden", "false");
			renderConnManager();
			void loadConnManager({ silent: false });
		}

		function closeConnManager() {
			state.connManagerOpen = false;
			connManagerDialog.classList.remove("open");
			connManagerDialog.hidden = true;
			connManagerDialog.setAttribute("aria-hidden", "true");
		}

		function openConnEditor(mode, conn) {
			const editing = mode === "edit" && conn?.connId;
			state.connEditorOpen = true;
			state.connEditorMode = editing ? "edit" : "create";
			state.connEditorConnId = editing ? conn.connId : "";
			state.connEditorSaving = false;
			state.connEditorError = "";
			fillConnEditor(buildConnEditorDraft(editing ? conn : null));
			renderConnEditor();
			connEditorDialog.hidden = false;
			connEditorDialog.classList.add("open");
			connEditorDialog.setAttribute("aria-hidden", "false");
			connEditorTitleInput.focus();
		}

		function closeConnEditor() {
			state.connEditorOpen = false;
			state.connEditorSaving = false;
			state.connEditorError = "";
			connEditorDialog.classList.remove("open");
			connEditorDialog.hidden = true;
			connEditorDialog.setAttribute("aria-hidden", "true");
		}

		function padDatePart(value) {
			return String(value).padStart(2, "0");
		}

		function formatConnDateTimeLocal(value) {
			const date = value ? new Date(value) : new Date(Date.now() + 5 * 60 * 1000);
			if (Number.isNaN(date.getTime())) {
				return "";
			}
			return [
				date.getFullYear(),
				"-",
				padDatePart(date.getMonth() + 1),
				"-",
				padDatePart(date.getDate()),
				"T",
				padDatePart(date.getHours()),
				":",
				padDatePart(date.getMinutes()),
			].join("");
		}

		function parseConnDateTimeLocal(value) {
			const text = String(value || "").trim();
			if (!text) {
				return "";
			}
			const date = new Date(text);
			if (Number.isNaN(date.getTime())) {
				return "";
			}
			return date.toISOString();
		}

		function normalizeConnAssetRefsText(value) {
			return String(value || "")
				.split(/\\r?\\n|,/)
				.map((entry) => entry.trim())
				.filter(Boolean);
		}

		function getLocalTimezone() {
			try {
				return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
			} catch {
				return "UTC";
			}
		}

		function buildConnEditorDraft(conn) {
			const target = conn?.target || {};
			const schedule = conn?.schedule || {};
			const targetType =
				target.type === "feishu_chat" || target.type === "feishu_user"
					? target.type
					: target.type === "conversation" && target.conversationId && target.conversationId !== state.conversationId
						? "conversation"
						: "current_conversation";
			const targetId =
				targetType === "feishu_chat"
					? target.chatId || ""
					: targetType === "feishu_user"
						? target.openId || ""
						: targetType === "conversation"
							? target.conversationId || ""
							: "";
			return {
				title: conn?.title || "",
				prompt: conn?.prompt || "",
				targetType,
				targetId,
				scheduleKind: inferConnScheduleMode(schedule),
				onceAt: formatConnDateTimeLocal(schedule.kind === "once" ? schedule.at : undefined),
				intervalMinutes:
					schedule.kind === "interval" && Number.isFinite(Number(schedule.everyMs))
						? String(Math.max(1, Math.round(Number(schedule.everyMs) / 60000)))
						: "60",
				intervalStart: formatConnDateTimeLocal(schedule.kind === "interval" ? schedule.startAt : undefined),
				timeOfDay: inferConnScheduleTimeOfDay(schedule),
				profileId: conn?.profileId || "",
				agentSpecId: conn?.agentSpecId || "",
				skillSetId: conn?.skillSetId || "",
				modelPolicyId: conn?.modelPolicyId || "",
				upgradePolicy: conn?.upgradePolicy || "latest",
				maxRunSeconds: conn?.maxRunMs ? String(Math.round(Number(conn.maxRunMs) / 1000)) : "",
				assetRefs: Array.isArray(conn?.assetRefs) ? conn.assetRefs.join("\\n") : "",
			};
		}

		function fillConnEditor(draft) {
			connEditorTitleInput.value = draft.title;
			connEditorPrompt.value = draft.prompt;
			connEditorTargetType.value = draft.targetType;
			connEditorTargetId.value = draft.targetId;
			connEditorScheduleKind.value = draft.scheduleKind;
			connEditorOnceAt.value = draft.onceAt;
			connEditorIntervalMinutes.value = draft.intervalMinutes;
			connEditorIntervalStart.value = draft.intervalStart;
			connEditorTimeOfDay.value = draft.timeOfDay;
			connEditorProfileId.value = draft.profileId;
			connEditorAgentSpecId.value = draft.agentSpecId;
			connEditorSkillSetId.value = draft.skillSetId;
			connEditorModelPolicyId.value = draft.modelPolicyId;
			connEditorUpgradePolicy.value = draft.upgradePolicy;
			connEditorMaxRunSeconds.value = draft.maxRunSeconds;
			connEditorAssetRefs.value = draft.assetRefs;
		}

		function parseConnCronExpression(expression) {
			const parts = String(expression || "")
				.trim()
				.split(/\\s+/)
				.filter(Boolean);
			if (parts.length !== 5) {
				return null;
			}
			const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
			if (!/^\\d+$/.test(minute) || !/^\\d+$/.test(hour)) {
				return null;
			}
			return {
				minute: Number(minute),
				hour: Number(hour),
				dayOfMonth,
				month,
				dayOfWeek,
			};
		}

		function formatConnTimeOfDay(hours, minutes) {
			if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
				return "";
			}
			return padDatePart(hours) + ":" + padDatePart(minutes);
		}

		function parseConnTimeOfDay(value) {
			const match = String(value || "")
				.trim()
				.match(/^(\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.\\d+)?)?$/);
			if (!match) {
				return null;
			}
			const hours = Number(match[1]);
			const minutes = Number(match[2]);
			const seconds = match[3] === undefined ? 0 : Number(match[3]);
			if (
				!Number.isFinite(hours) ||
				!Number.isFinite(minutes) ||
				!Number.isFinite(seconds) ||
				hours < 0 ||
				hours > 23 ||
				minutes < 0 ||
				minutes > 59 ||
				seconds < 0 ||
				seconds > 59
			) {
				return null;
			}
			return { hours, minutes };
		}

		function inferConnScheduleMode(schedule) {
			if (!schedule || typeof schedule !== "object") {
				return "once";
			}
			if (schedule.kind === "interval") {
				return "interval";
			}
			if (schedule.kind === "once" || !schedule.kind) {
				return "once";
			}
			return "daily";
		}

		function inferConnScheduleTimeOfDay(schedule) {
			if (!schedule || schedule.kind !== "cron") {
				return "09:00";
			}
			const parsed = parseConnCronExpression(schedule.expression);
			if (!parsed) {
				return "09:00";
			}
			return formatConnTimeOfDay(parsed.hour, parsed.minute) || "09:00";
		}

		function buildConnDailyCronExpression() {
			const timeOfDay = parseConnTimeOfDay(connEditorTimeOfDay.value);
			if (!timeOfDay) {
				return "";
			}
			return String(timeOfDay.minutes) + " " + String(timeOfDay.hours) + " * * *";
		}

		function describeConnTargetInput(targetType) {
			if (targetType === "feishu_chat") {
				return {
					label: "飞书群编号",
					placeholder: "oc_xxx / chat id",
					hint: "填飞书群的 chat id。",
				};
			}
			if (targetType === "feishu_user") {
				return {
					label: "飞书用户编号",
					placeholder: "ou_xxx / open id",
					hint: "填飞书用户的 open id。",
				};
			}
			return {
				label: "会话编号",
				placeholder: "conversation id",
				hint: "填要接收结果的会话编号；保存后不会跟着当前页面自动切换。",
			};
		}

		function setConnEditorSectionVisibility() {
			const targetType = connEditorTargetType.value;
			connEditorTargetCurrent.hidden = targetType !== "current_conversation";
			connEditorTargetId.parentElement.hidden = targetType === "current_conversation";
			const targetInput = describeConnTargetInput(targetType);
			connEditorTargetIdLabel.textContent = targetInput.label;
			connEditorTargetId.placeholder = targetInput.placeholder;
			connEditorTargetIdHint.textContent = targetInput.hint;
			renderConnEditorTargetPreview();

			const scheduleKind = String(connEditorScheduleKind.value || "once").trim();
			for (const panel of connEditorForm.querySelectorAll("[data-schedule-panel]")) {
				panel.classList.toggle(
					"is-hidden",
					String(panel.dataset.schedulePanel || "").trim() !== scheduleKind,
				);
			}
		}

		function findConversationCatalogItem(conversationId) {
			const targetConversationId = String(conversationId || "").trim();
			if (!targetConversationId) {
				return null;
			}
			return state.conversationCatalog.find((item) => item.conversationId === targetConversationId) || null;
		}

		function describeConversationTarget(conversationId, fallbackLabel) {
			const targetConversationId = String(conversationId || "").trim();
			const catalogItem = findConversationCatalogItem(targetConversationId);
			const title = catalogItem?.title || fallbackLabel || "会话";
			const preview = catalogItem?.preview || "";
			return {
				title,
				id: targetConversationId,
				preview,
				active: targetConversationId && targetConversationId === state.conversationId,
				known: Boolean(catalogItem),
			};
		}

		function renderConnEditorTargetPreview() {
			const targetType = String(connEditorTargetType.value || "").trim();
			const targetId =
				targetType === "current_conversation"
					? state.conversationId
					: String(connEditorTargetId.value || "").trim();
			connEditorTargetPreview.innerHTML = "";

			const label = document.createElement("strong");
			const detail = document.createElement("span");
			const id = document.createElement("code");
			const footnote = document.createElement("span");
			footnote.className = "conn-editor-target-note";

			if (targetType === "feishu_chat") {
				label.textContent = "投递到飞书群";
				detail.textContent = "后台 run 结束后由飞书 adapter 发送；全局活动仍保留追溯记录。";
				id.textContent = targetId || "等待填写 chat id";
			} else if (targetType === "feishu_user") {
				label.textContent = "投递到飞书用户";
				detail.textContent = "后台 run 结束后由飞书 adapter 发送；全局活动仍保留追溯记录。";
				id.textContent = targetId || "等待填写 open id";
			} else {
				const conversation = describeConversationTarget(
					targetId,
					targetType === "current_conversation" ? "当前会话" : "指定会话",
				);
				label.textContent =
					"投递到 " +
					(conversation.active ? "当前会话" : conversation.known ? conversation.title : "指定会话");
				detail.textContent = conversation.preview || "保存后，conn 结果气泡只进入这个目标会话。";
				id.textContent = conversation.id || "当前会话尚未同步";
				footnote.textContent = "切到新会话不会改写已保存 conn 的目标；跨会话观察请看全局活动。";
			}

			connEditorTargetPreview.appendChild(label);
			connEditorTargetPreview.appendChild(detail);
			connEditorTargetPreview.appendChild(id);
			if (footnote.textContent) {
				connEditorTargetPreview.appendChild(footnote);
			}
		}

		function renderConnEditorError(message) {
			state.connEditorError = String(message || "").trim();
			connEditorError.textContent = state.connEditorError;
			connEditorError.hidden = !state.connEditorError;
		}

		function renderConnEditor() {
			connEditorTitle.textContent = state.connEditorMode === "edit" ? "编辑后台任务" : "新建后台任务";
			connEditorTargetCurrent.textContent = state.conversationId || "当前会话尚未同步";
			saveConnEditorButton.disabled = state.connEditorSaving;
			saveConnEditorButton.textContent = state.connEditorSaving ? "保存中" : "保存";
			renderConnEditorError(state.connEditorError);
			setConnEditorSectionVisibility();
		}

		function buildConnTargetPayload() {
			const targetType = String(connEditorTargetType.value || "").trim();
			if (targetType === "current_conversation") {
				if (!state.conversationId) {
					throw new Error("无法确认当前会话");
				}
				return { type: "conversation", conversationId: state.conversationId };
			}
			const targetId = String(connEditorTargetId.value || "").trim();
			if (!targetId) {
				throw new Error("请填写目标 ID");
			}
			if (targetType === "feishu_chat") {
				return { type: "feishu_chat", chatId: targetId };
			}
			if (targetType === "feishu_user") {
				return { type: "feishu_user", openId: targetId };
			}
			return { type: "conversation", conversationId: targetId };
		}

		function buildConnSchedulePayload() {
			const kind = String(connEditorScheduleKind.value || "once").trim();
			if (kind === "interval") {
				const minutes = Number.parseInt(String(connEditorIntervalMinutes.value || ""), 10);
				if (!Number.isFinite(minutes) || minutes < 1) {
					throw new Error("间隔分钟必须大于 0");
				}
				const startAt = parseConnDateTimeLocal(connEditorIntervalStart.value);
				if (!startAt) {
					throw new Error("请填写首次执行时间");
				}
				return { kind: "interval", everyMs: minutes * 60 * 1000, startAt };
			}
			if (kind === "daily") {
				const expression = buildConnDailyCronExpression();
				if (!expression) {
					throw new Error("请填写每日执行时间");
				}
				return { kind: "cron", expression, timezone: getLocalTimezone() };
			}
			const at = parseConnDateTimeLocal(connEditorOnceAt.value);
			if (!at) {
				throw new Error("请填写执行时间");
			}
			return { kind: "once", at };
		}

		function readConnEditorPayload() {
			const title = String(connEditorTitleInput.value || "").trim();
			const prompt = String(connEditorPrompt.value || "").trim();
			if (!title) {
				throw new Error("请填写标题");
			}
			if (!prompt) {
				throw new Error("请填写让它做什么");
			}
			const payload = {
				title,
				prompt,
				target: buildConnTargetPayload(),
				schedule: buildConnSchedulePayload(),
			};
			const assetRefs = normalizeConnAssetRefsText(connEditorAssetRefs.value);
			if (assetRefs.length > 0 || state.connEditorMode === "edit") {
				payload.assetRefs = assetRefs;
			}
			const maxRunSeconds = String(connEditorMaxRunSeconds.value || "").trim();
			if (maxRunSeconds) {
				const seconds = Number(maxRunSeconds);
				if (!Number.isFinite(seconds) || seconds <= 0) {
					throw new Error("最长运行秒数必须大于 0");
				}
				payload.maxRunMs = Math.round(seconds * 1000);
			}
			for (const [field, node] of [
				["profileId", connEditorProfileId],
				["agentSpecId", connEditorAgentSpecId],
				["skillSetId", connEditorSkillSetId],
				["modelPolicyId", connEditorModelPolicyId],
			]) {
				const value = String(node.value || "").trim();
				if (value) {
					payload[field] = value;
				}
			}
			const upgradePolicy = String(connEditorUpgradePolicy.value || "").trim();
			if (upgradePolicy) {
				payload.upgradePolicy = upgradePolicy;
			}
			return payload;
		}

		async function submitConnEditor() {
			if (state.connEditorSaving) {
				return;
			}
			let payload;
			try {
				payload = readConnEditorPayload();
			} catch (error) {
				renderConnEditorError(error instanceof Error ? error.message : "表单校验失败");
				return;
			}

			state.connEditorSaving = true;
			renderConnEditor();
			try {
				const isEditing = state.connEditorMode === "edit" && state.connEditorConnId;
				const response = await fetch(
					isEditing ? "/v1/conns/" + encodeURIComponent(state.connEditorConnId) : "/v1/conns",
					{
						method: isEditing ? "PATCH" : "POST",
						headers: {
							accept: "application/json",
							"content-type": "application/json",
						},
						body: JSON.stringify(payload),
					},
				);
				const responsePayload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(responsePayload?.error?.message || responsePayload?.message || "保存后台任务失败");
				}
				const savedConn = responsePayload?.conn || null;
				if (savedConn) {
					updateConnManagerConn(savedConn);
				}
				const targetLabel = describeConnTargetSummary(savedConn?.target || payload.target);
				setConnManagerNotice(
					(isEditing ? "已更新" : "已创建") +
						"：" +
						(savedConn?.title || payload.title) +
						"。结果会投递到 " +
						targetLabel +
						"，全局活动同步可见。",
					savedConn?.connId || state.connEditorConnId,
				);
				closeConnEditor();
				await loadConnManager({ silent: true });
			} catch (error) {
				renderConnEditorError(error instanceof Error ? error.message : "保存后台任务失败");
			} finally {
				state.connEditorSaving = false;
				if (state.connEditorOpen) {
					renderConnEditor();
				}
			}
		}

		function toggleContextUsageDetails() {
			if (isMobileContextUsageSurface()) {
				openContextUsageDialog();
				return;
			}
			state.contextUsageExpanded = !state.contextUsageExpanded;
			renderContextUsageBar();
		}

		async function syncContextUsage(conversationId, options) {
			const nextConversationId = String(conversationId || state.conversationId || "").trim();
			if (!nextConversationId) {
				state.contextUsage = null;
				renderContextUsageBar();
				return createFallbackContextUsage();
			}

			const requestToken = state.contextUsageSyncToken + 1;
			state.contextUsageSyncToken = requestToken;

			try {
				const payload = await fetchConversationRunStatus(nextConversationId);
				if (state.contextUsageSyncToken !== requestToken) {
					return payload.contextUsage;
				}
				state.contextUsage = normalizeContextUsage(payload.contextUsage);
				renderContextUsageBar();
				return state.contextUsage;
			} catch (error) {
				if (!options?.silent) {
					const messageText = error instanceof Error ? error.message : "无法同步上下文使用情况";
					showError(messageText);
				}
				if (state.contextUsageSyncToken === requestToken) {
					renderContextUsageBar();
				}
				return normalizeContextUsage(state.contextUsage);
			}
		}

		function setStageMode(next) {
			state.stageMode = next;
			shell.dataset.stageMode = next;
			landingScreen.setAttribute("aria-hidden", next === "landing" ? "false" : "true");
		}

		function syncConversationLayout() {
			const composerWidth = Math.round(composerDropTarget.getBoundingClientRect().width || 0);
			if (composerWidth > 0) {
				shell.style.setProperty("--conversation-width", composerWidth + "px");
			}
			const chatStageRect = chatStage.getBoundingClientRect();
			const commandDeckRect = commandDeck.getBoundingClientRect();
			const commandDeckOffset = Math.ceil(chatStageRect.bottom - commandDeckRect.top || 0);
			if (commandDeckOffset > 0) {
				shell.style.setProperty("--command-deck-offset", commandDeckOffset + "px");
			}
		}

		function scheduleConversationLayoutSync(options) {
			if (state.layoutSyncRaf) {
				return;
			}
			const delay = options?.immediate ? 0 : LAYOUT_SYNC_DELAY_MS;
			if (state.layoutSyncTimer !== null) {
				window.clearTimeout(state.layoutSyncTimer);
				state.layoutSyncTimer = null;
			}
			const queueFrame = () => {
				state.layoutSyncRaf = window.requestAnimationFrame(() => {
					state.layoutSyncRaf = 0;
					syncConversationLayout();
				});
			};
			if (delay <= 0) {
				queueFrame();
				return;
			}
			state.layoutSyncTimer = window.setTimeout(() => {
				state.layoutSyncTimer = null;
				queueFrame();
			}, delay);
		}

		function syncConversationWidth() {
			scheduleConversationLayoutSync({ immediate: true });
		}

		function syncComposerTextareaHeight() {
			const style = window.getComputedStyle(messageInput);
			const lineHeight = Number.parseFloat(style.lineHeight) || 20;
			const paddingTop = Number.parseFloat(style.paddingTop) || 0;
			const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
			const maxLines = 10;
			const maxHeight = Math.ceil(lineHeight * maxLines + paddingTop + paddingBottom);
			messageInput.style.height = "auto";
			const nextHeight = Math.min(messageInput.scrollHeight, maxHeight);
			messageInput.style.height = nextHeight + "px";
			messageInput.style.overflowY = messageInput.scrollHeight > maxHeight ? "auto" : "hidden";
			scheduleConversationLayoutSync();
		}

		function setTranscriptState(next) {
			shell.dataset.transcriptState = next === "active" ? "active" : "idle";
			scheduleConversationLayoutSync();
		}

		function setCommandStatus(next) {
			shell.dataset.commandState = String(next || "standby").toLowerCase();
			newConversationButton.dataset.state = shell.dataset.commandState;
		}

		function ensureConversationId() {
			const previousConversationId = state.conversationId;
			if (!state.conversationId) {
				const currentCatalogItem = state.conversationCatalog.find((item) => item.conversationId);
				state.conversationId = currentCatalogItem?.conversationId || "";
			}
			conversationInput.value = state.conversationId;
			if (state.conversationId && state.conversationId !== previousConversationId) {
				void syncContextUsage(state.conversationId, { silent: true });
			}
		}

		function isTranscriptNearBottom() {
			const remaining = transcript.scrollHeight - transcript.clientHeight - transcript.scrollTop;
			return remaining <= TRANSCRIPT_FOLLOW_THRESHOLD_PX;
		}

		function updateScrollToBottomButton() {
			const shouldShow =
				!state.autoFollowTranscript &&
				transcript.scrollHeight > transcript.clientHeight + TRANSCRIPT_FOLLOW_THRESHOLD_PX;
			scrollToBottomButton.hidden = !shouldShow;
			scrollToBottomButton.classList.toggle("visible", shouldShow);
		}

		function syncTranscriptFollowState() {
			state.autoFollowTranscript = isTranscriptNearBottom();
			updateScrollToBottomButton();
		}

		function scrollTranscriptToBottom(options) {
			if (!(options?.force || state.autoFollowTranscript || isTranscriptNearBottom())) {
				updateScrollToBottomButton();
				return;
			}

			const applyScroll = () => {
				state.transcriptScrollRaf = 0;
				transcript.scrollTop = transcript.scrollHeight;
				state.lastTranscriptScrollAt = Date.now();
				state.autoFollowTranscript = true;
				updateScrollToBottomButton();
			};

			if (options?.force) {
				if (state.transcriptScrollTimer !== null) {
					window.clearTimeout(state.transcriptScrollTimer);
					state.transcriptScrollTimer = null;
				}
				if (state.transcriptScrollRaf) {
					window.cancelAnimationFrame(state.transcriptScrollRaf);
					state.transcriptScrollRaf = 0;
				}
				applyScroll();
				return;
			}

			if (state.transcriptScrollRaf || state.transcriptScrollTimer !== null) {
				return;
			}

			const elapsed = Date.now() - state.lastTranscriptScrollAt;
			const delay = Math.max(0, TRANSCRIPT_BOTTOM_SYNC_COOLDOWN_MS - elapsed);
			const queueScroll = () => {
				state.transcriptScrollTimer = null;
				state.transcriptScrollRaf = window.requestAnimationFrame(applyScroll);
			};
			if (delay > 0) {
				state.transcriptScrollTimer = window.setTimeout(queueScroll, delay);
			} else {
				queueScroll();
			}
		}

		function setMobileOverflowMenuOpen(next) {
			state.mobileOverflowMenuOpen = Boolean(next);
			mobileOverflowMenu.hidden = !state.mobileOverflowMenuOpen;
			mobileOverflowMenuButton.setAttribute("aria-expanded", state.mobileOverflowMenuOpen ? "true" : "false");
		}

		function closeMobileOverflowMenu() {
			setMobileOverflowMenuOpen(false);
		}

		function setMobileConversationDrawerOpen(next) {
			state.mobileConversationDrawerOpen = Boolean(next);
			mobileDrawerBackdrop.hidden = !state.mobileConversationDrawerOpen;
			mobileConversationDrawer.hidden = !state.mobileConversationDrawerOpen;
			mobileBrandButton.setAttribute("aria-expanded", state.mobileConversationDrawerOpen ? "true" : "false");
			if (state.mobileConversationDrawerOpen) {
				closeMobileOverflowMenu();
				renderConversationDrawer();
			}
		}

		function closeMobileConversationDrawer() {
			setMobileConversationDrawerOpen(false);
		}

		function formatConversationTime(value) {
			const date = new Date(value || 0);
			if (!Number.isFinite(date.getTime())) {
				return "未知";
			}
			return date.toLocaleString("zh-CN", {
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
			});
		}

		function renderConversationDrawer() {
			mobileConversationList.innerHTML = "";
			const catalog = Array.isArray(state.conversationCatalog) ? state.conversationCatalog : [];
			if (catalog.length === 0) {
				const empty = document.createElement("div");
				empty.className = "mobile-conversation-empty";
				empty.textContent = "还没有历史会话。点右上角新会话后，这里会出现新的产线。";
				mobileConversationList.appendChild(empty);
				return;
			}

			for (const item of catalog) {
				const button = document.createElement("button");
				button.type = "button";
				button.className = "mobile-conversation-item";
				button.dataset.conversationId = item.conversationId;
				if (item.conversationId === state.conversationId) {
					button.classList.add("is-active");
				}
				button.disabled = state.loading || item.conversationId === state.conversationId;
				button.innerHTML =
					'<span class="mobile-conversation-title"></span>' +
					'<span class="mobile-conversation-preview"></span>' +
					'<span class="mobile-conversation-meta"><span></span><span></span></span>';
				button.querySelector(".mobile-conversation-title").textContent = item.title || "新会话";
				button.querySelector(".mobile-conversation-preview").textContent = item.preview || "暂无摘要";
				const metaNodes = button.querySelectorAll(".mobile-conversation-meta span");
				metaNodes[0].textContent = item.running ? "运行中" : formatConversationTime(item.updatedAt);
				metaNodes[1].textContent = item.messageCount + " 条";
				button.addEventListener("click", () => {
					void selectConversationFromDrawer(item.conversationId);
				});
				mobileConversationList.appendChild(button);
			}
		}

		function setLoading(next) {
			state.loading = next;
			sendButton.disabled = false;
			sendButton.textContent = "发送";
			interruptButton.disabled = !next;
			viewSkillsButton.disabled = next;
			filePickerAction.disabled = false;
			messageInput.disabled = false;
			fileInput.disabled = false;
			conversationInput.disabled = next;
			newConversationButton.disabled = next;
			mobileNewConversationButton.disabled = next;
			mobileOverflowMenuButton.disabled = false;
			mobileMenuSkillsButton.disabled = next;
			mobileMenuFileButton.disabled = false;
			mobileMenuLibraryButton.disabled = next;
			mobileMenuActivityButton.disabled = false;
			mobileMenuConnButton.disabled = false;
			openAssetLibraryButton.disabled = next;
			openAgentActivityButton.disabled = false;
			openConnManagerButton.disabled = false;
			refreshAssetsButton.disabled = next;
			if (next) {
				closeMobileOverflowMenu();
				renderConversationDrawer();
			}
			setCommandStatus(next ? "RUNNING" : "STANDBY");
			statusPill.textContent = next ? "运行中" : "就绪";
		}

		function showError(message) {
			errorBannerMessage.textContent = message;
			errorBanner.hidden = false;
			errorBanner.classList.add("visible");
			setCommandStatus("ERROR");
			statusPill.textContent = "错误";
		}

		function formatControlActionReason(action, reason) {
			if (reason === "not_running") {
				return action === "interrupt"
					? "当前没有可打断的运行任务，请从顶部提示确认状态。"
					: "当前没有可追加的运行任务，请直接重新发送消息。";
			}
			if (reason === "abort_not_supported") {
				return "当前运行任务暂不支持打断，请等待它自然结束。";
			}
			return "";
		}

		function getControlActionErrorMessage(action, payload, fallbackMessage) {
			return (
				payload?.error?.message ||
				formatControlActionReason(action, payload?.reason) ||
				payload?.reason ||
				fallbackMessage
			);
		}

		function clearError() {
			errorBannerMessage.textContent = "";
			errorBanner.classList.remove("visible");
			errorBanner.hidden = true;
			if (!state.loading) {
				setCommandStatus("STANDBY");
			}
			if (!state.loading) {
				statusPill.textContent = "就绪";
			}
		}

		function clearNotificationReconnectTimer() {
			if (state.notificationReconnectTimer !== null) {
				window.clearTimeout(state.notificationReconnectTimer);
				state.notificationReconnectTimer = null;
			}
		}

		function hideNotificationLiveRegionIfIdle() {
			if (!notificationToastStack.children.length) {
				notificationLiveRegion.hidden = true;
			}
		}

		function removeNotificationToast(toast) {
			if (!toast || !toast.parentNode) {
				hideNotificationLiveRegionIfIdle();
				return;
			}
			toast.parentNode.removeChild(toast);
			hideNotificationLiveRegionIfIdle();
		}

		function formatNotificationTimestamp(value) {
			const date = new Date(value || 0);
			if (!Number.isFinite(date.getTime())) {
				return "JUST NOW";
			}
			return date.toLocaleString("zh-CN", {
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
			});
		}

		function normalizeNotificationBroadcastEvent(rawEvent) {
			if (!rawEvent || typeof rawEvent !== "object") {
				return null;
			}
			const notificationId = typeof rawEvent.notificationId === "string" ? rawEvent.notificationId.trim() : "";
			const conversationId = typeof rawEvent.conversationId === "string" ? rawEvent.conversationId.trim() : "";
			const source = typeof rawEvent.source === "string" ? rawEvent.source.trim() : "";
			const sourceId = typeof rawEvent.sourceId === "string" ? rawEvent.sourceId.trim() : "";
			const kind = typeof rawEvent.kind === "string" ? rawEvent.kind.trim() : "";
			const title = typeof rawEvent.title === "string" ? rawEvent.title.trim() : "";
			const createdAt = typeof rawEvent.createdAt === "string" ? rawEvent.createdAt.trim() : "";
			const runId = typeof rawEvent.runId === "string" ? rawEvent.runId.trim() : "";
			if (!notificationId || !conversationId || !source || !sourceId || !kind || !title || !createdAt) {
				return null;
			}
			return {
				notificationId,
				conversationId,
				source,
				sourceId,
				runId: runId || undefined,
				kind,
				title,
				createdAt,
			};
		}

		function showNotificationToast(event) {
			const notification = normalizeNotificationBroadcastEvent(event);
			if (!notification) {
				return;
			}
			notificationLiveRegion.hidden = false;
			const toast = document.createElement("article");
			toast.className = "notification-toast";
			toast.dataset.notificationId = notification.notificationId;
			const copy = document.createElement("div");
			copy.className = "notification-toast-copy";
			const title = document.createElement("strong");
			title.className = "notification-toast-title";
			title.textContent = notification.title;
			const meta = document.createElement("span");
			meta.className = "notification-toast-meta";
			meta.textContent =
				(notification.conversationId === state.conversationId ? "当前会话" : notification.conversationId) +
				" · " +
				formatNotificationTimestamp(notification.createdAt);
			copy.appendChild(title);
			copy.appendChild(meta);
			const dismissButton = document.createElement("button");
			dismissButton.type = "button";
			dismissButton.className = "notification-toast-dismiss";
			dismissButton.setAttribute("aria-label", "关闭实时通知");
			dismissButton.textContent = "×";
			dismissButton.addEventListener("click", () => {
				removeNotificationToast(toast);
			});
			toast.appendChild(copy);
			toast.appendChild(dismissButton);
			notificationToastStack.prepend(toast);
			while (notificationToastStack.children.length > 4) {
				removeNotificationToast(notificationToastStack.lastElementChild);
			}
			window.setTimeout(() => {
				removeNotificationToast(toast);
			}, 6000);
		}

		function scheduleNotificationStreamReconnect() {
			if (
				state.pageUnloading ||
				state.notificationEventSource ||
				state.notificationReconnectTimer !== null ||
				typeof EventSource !== "function"
			) {
				return;
			}
			const nextDelay = state.notificationReconnectDelayMs > 0 ? Math.min(state.notificationReconnectDelayMs * 2, 30000) : 1500;
			state.notificationReconnectDelayMs = nextDelay;
			state.notificationReconnectTimer = window.setTimeout(() => {
				state.notificationReconnectTimer = null;
				connectNotificationStream();
			}, nextDelay);
		}

		function disconnectNotificationStream() {
			clearNotificationReconnectTimer();
			const eventSource = state.notificationEventSource;
			state.notificationEventSource = null;
			if (eventSource) {
				eventSource.onopen = null;
				eventSource.onmessage = null;
				eventSource.onerror = null;
				eventSource.close();
			}
		}

		function handleNotificationBroadcastEvent(rawEvent) {
			const event = normalizeNotificationBroadcastEvent(rawEvent);
			if (!event) {
				return;
			}
			showNotificationToast(event);
			void loadAgentActivity({ silent: true });
			void syncConversationCatalog({
				silent: true,
				activateCurrent: false,
			});
			if (event.conversationId === state.conversationId) {
				void syncConversationRunState(event.conversationId, {
					silent: true,
					clearIfIdle: true,
				});
				void restoreConversationHistoryFromServer(event.conversationId);
			}
		}

		function connectNotificationStream() {
			if (state.pageUnloading || state.notificationEventSource || typeof EventSource !== "function") {
				return;
			}
			clearNotificationReconnectTimer();
			const stream = new EventSource("/v1/notifications/stream");
			state.notificationEventSource = stream;
			stream.onopen = () => {
				state.notificationReconnectDelayMs = 0;
			};
			stream.onmessage = (messageEvent) => {
				let payload;
				try {
					payload = JSON.parse(String(messageEvent.data || ""));
				} catch {
					return;
				}
				handleNotificationBroadcastEvent(payload);
			};
			stream.onerror = () => {
				if (state.notificationEventSource !== stream) {
					return;
				}
				state.notificationEventSource = null;
				stream.close();
				scheduleNotificationStreamReconnect();
			};
		}

		function scheduleResumeConversationSync(reason, options) {
			connectNotificationStream();
			if (state.resumeSyncPromise) {
				return state.resumeSyncPromise;
			}
			if (state.resumeSyncTimer !== null) {
				return Promise.resolve();
			}
			const elapsed = Date.now() - state.lastResumeSyncAt;
			const delay = Math.max(0, RESUME_SYNC_COOLDOWN_MS - elapsed);
			state.resumeSyncTimer = window.setTimeout(() => {
				state.resumeSyncTimer = null;
				state.lastResumeSyncAt = Date.now();
				state.resumeSyncPromise = (async () => {
					await ensureCurrentConversation({ silent: true });
					if (!state.conversationId) {
						return;
					}
					await syncConversationRunState(state.conversationId, {
						silent: true,
						clearIfIdle: state.loading,
					});
					if (options?.restoreHistory !== false) {
						await restoreConversationHistoryFromServer(state.conversationId);
					}
				})()
					.catch(() => undefined)
					.finally(() => {
						state.resumeSyncPromise = null;
					});
			}, delay);
			return Promise.resolve();
		}

		async function fetchConversationRunStatus(conversationId) {
			if (!conversationId) {
				return { conversationId: "", running: false, contextUsage: createFallbackContextUsage() };
			}

			const response = await fetch("/v1/chat/status?conversationId=" + encodeURIComponent(conversationId), {
				method: "GET",
				headers: { accept: "application/json" },
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法获取当前会话状态";
				throw new Error(errorMessage);
			}

			return {
				conversationId: payload?.conversationId || conversationId,
				running: Boolean(payload?.running),
				contextUsage: normalizeContextUsage(payload?.contextUsage),
			};
		}

		async function fetchConversationState(conversationId) {
			const nextConversationId = String(conversationId || "").trim();
			if (!nextConversationId) {
				return {
					conversationId: "",
					running: false,
					contextUsage: createFallbackContextUsage(),
					messages: [],
					activeRun: null,
				};
			}

			const response = await fetch("/v1/chat/state?conversationId=" + encodeURIComponent(nextConversationId), {
				method: "GET",
				headers: { accept: "application/json" },
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法获取当前会话状态";
				throw new Error(errorMessage);
			}

			return {
				conversationId: payload?.conversationId || nextConversationId,
				running: Boolean(payload?.running),
				contextUsage: normalizeContextUsage(payload?.contextUsage),
				messages: Array.isArray(payload?.messages) ? payload.messages : [],
				activeRun: normalizeActiveRun(payload?.activeRun),
				updatedAt: typeof payload?.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
			};
		}

		async function fetchConnRunDetail(entry) {
			const response = await fetch(
				"/v1/conns/" + encodeURIComponent(entry.sourceId) + "/runs/" + encodeURIComponent(entry.runId),
				{
					method: "GET",
					headers: { accept: "application/json" },
				},
			);
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "鏃犳硶鑾峰彇鍚庡彴浠诲姟璇︽儏";
				throw new Error(errorMessage);
			}
			return payload;
		}

		async function fetchConnRunEvents(entry) {
			const response = await fetch(
				"/v1/conns/" + encodeURIComponent(entry.sourceId) + "/runs/" + encodeURIComponent(entry.runId) + "/events",
				{
					method: "GET",
					headers: { accept: "application/json" },
				},
			);
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "鏃犳硶鑾峰彇鍚庡彴浠诲姟浜嬩欢";
				throw new Error(errorMessage);
			}
			return payload;
		}

		async function fetchConnRunsForConn(conn) {
			const response = await fetch("/v1/conns/" + encodeURIComponent(conn.connId) + "/runs", {
				method: "GET",
				headers: { accept: "application/json" },
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法读取后台任务运行历史";
				throw new Error(errorMessage);
			}
			return Array.isArray(payload?.runs) ? payload.runs : [];
		}

		async function fetchConnList() {
			const response = await fetch("/v1/conns", {
				method: "GET",
				headers: { accept: "application/json" },
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法读取后台任务列表";
				throw new Error(errorMessage);
			}
			return Array.isArray(payload?.conns) ? payload.conns : [];
		}

		async function bulkDeleteConns(connIds) {
			const response = await fetch("/v1/conns/bulk-delete", {
				method: "POST",
				headers: {
					accept: "application/json",
					"content-type": "application/json",
				},
				body: JSON.stringify({ connIds }),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法批量删除后台任务";
				throw new Error(errorMessage);
			}
			return {
				deletedConnIds: Array.isArray(payload?.deletedConnIds) ? payload.deletedConnIds : [],
				missingConnIds: Array.isArray(payload?.missingConnIds) ? payload.missingConnIds : [],
			};
		}

		function normalizeAgentActivityItem(item) {
			const activityId = String(item?.activityId || "").trim();
			if (!activityId) {
				return null;
			}
			return {
				activityId,
				scope: String(item?.scope || "agent").trim() || "agent",
				source: String(item?.source || "").trim() || "unknown",
				sourceId: typeof item?.sourceId === "string" ? item.sourceId : undefined,
				runId: typeof item?.runId === "string" ? item.runId : undefined,
				conversationId: typeof item?.conversationId === "string" ? item.conversationId : undefined,
				kind: String(item?.kind || "activity").trim() || "activity",
				title: String(item?.title || "活动").trim() || "活动",
				text: String(item?.text || "").trim(),
				files: Array.isArray(item?.files) ? item.files : [],
				createdAt: typeof item?.createdAt === "string" ? item.createdAt : new Date(0).toISOString(),
				readAt: typeof item?.readAt === "string" ? item.readAt : undefined,
			};
		}

		async function fetchAgentActivity() {
			const response = await fetch("/v1/activity?limit=50", {
				method: "GET",
				headers: { accept: "application/json" },
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法读取全局活动";
				throw new Error(errorMessage);
			}
			return Array.isArray(payload?.activities)
				? payload.activities.map(normalizeAgentActivityItem).filter(Boolean)
				: [];
		}

		async function loadAgentActivity(options) {
			if (!options?.silent) {
				clearError();
			}
			state.agentActivityLoading = true;
			state.agentActivityError = "";
			refreshAgentActivityButton.disabled = true;
			agentActivityList.setAttribute("aria-busy", "true");
			if (state.agentActivityOpen) {
				renderAgentActivity();
			}
			try {
				state.agentActivityItems = await fetchAgentActivity();
				state.agentActivityError = "";
				if (state.agentActivityOpen) {
					renderAgentActivity();
				}
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "无法读取全局活动";
				state.agentActivityError = messageText;
				if (!options?.silent) {
					showError(messageText);
				}
				if (state.agentActivityOpen) {
					renderAgentActivity();
				}
			} finally {
				state.agentActivityLoading = false;
				refreshAgentActivityButton.disabled = false;
				agentActivityList.removeAttribute("aria-busy");
				if (state.agentActivityOpen) {
					renderAgentActivity();
				}
			}
		}

		async function loadConnManager(options) {
			if (!options?.silent) {
				clearError();
			}
			refreshConnManagerButton.disabled = true;
			connManagerList.setAttribute("aria-busy", "true");
			try {
				const conns = await fetchConnList();
				const runsByConnId = {};
				await Promise.all(
					conns.map(async (conn) => {
						try {
							runsByConnId[conn.connId] = await fetchConnRunsForConn(conn);
						} catch {
							runsByConnId[conn.connId] = [];
						}
					}),
				);
				state.connManagerItems = conns;
				state.connManagerRunsByConnId = runsByConnId;
				syncConnManagerSelectionWithItems();
				renderConnManager();
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "无法读取后台任务列表";
				showError(messageText);
				connManagerList.innerHTML = "";
				const empty = document.createElement("div");
				empty.className = "asset-empty";
				empty.textContent = messageText;
				connManagerList.appendChild(empty);
			} finally {
				refreshConnManagerButton.disabled = false;
				connManagerList.removeAttribute("aria-busy");
			}
		}

		function normalizeConversationCatalogItem(item) {
			const conversationId = String(item?.conversationId || "").trim();
			if (!conversationId) {
				return null;
			}

			return {
				conversationId,
				title: String(item?.title || "新会话").trim() || "新会话",
				preview: String(item?.preview || "").trim(),
				messageCount: Number.isFinite(item?.messageCount) ? Math.max(0, Number(item.messageCount)) : 0,
				createdAt: typeof item?.createdAt === "string" ? item.createdAt : new Date(0).toISOString(),
				updatedAt: typeof item?.updatedAt === "string" ? item.updatedAt : new Date(0).toISOString(),
				running: Boolean(item?.running),
			};
		}

		async function fetchConversationCatalog() {
			const response = await fetch("/v1/chat/conversations", {
				method: "GET",
				headers: { accept: "application/json" },
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法获取会话列表";
				throw new Error(errorMessage);
			}

			return {
				currentConversationId: String(payload?.currentConversationId || "").trim(),
				conversations: Array.isArray(payload?.conversations)
					? payload.conversations.map(normalizeConversationCatalogItem).filter(Boolean)
					: [],
			};
		}

		async function createConversationOnServer() {
			const requestOptions = {
				method: "POST",
				headers: {
					"content-type": "application/json",
					accept: "application/json",
				},
				body: JSON.stringify({}),
			};
			const response = await fetch("/v1/chat/conversations", requestOptions);
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法开启新会话";
				throw new Error(errorMessage);
			}

			return {
				conversationId: String(payload?.conversationId || "").trim(),
				currentConversationId: String(payload?.currentConversationId || payload?.conversationId || "").trim(),
				created: payload?.created === true,
				reason: typeof payload?.reason === "string" ? payload.reason : undefined,
			};
		}

		async function switchConversationOnServer(conversationId) {
			const nextConversationId = String(conversationId || "").trim();
			const response = await fetch("/v1/chat/current", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					accept: "application/json",
				},
				body: JSON.stringify({
					conversationId: nextConversationId,
				}),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法切换会话";
				throw new Error(errorMessage);
			}

			return {
				conversationId: String(payload?.conversationId || nextConversationId).trim(),
				currentConversationId: String(payload?.currentConversationId || payload?.conversationId || nextConversationId).trim(),
				switched: payload?.switched === true,
				reason: typeof payload?.reason === "string" ? payload.reason : undefined,
			};
		}

		async function fetchConversationHistory(conversationId) {
			const nextConversationId = String(conversationId || "").trim();
			if (!nextConversationId) {
				return { conversationId: "", messages: [] };
			}

			const response = await fetch("/v1/chat/history?conversationId=" + encodeURIComponent(nextConversationId), {
				method: "GET",
				headers: { accept: "application/json" },
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法获取全局对话历史";
				throw new Error(errorMessage);
			}

			return {
				conversationId: payload?.conversationId || nextConversationId,
				messages: Array.isArray(payload?.messages) ? payload.messages : [],
			};
		}

		function stopActiveRunEventStream() {
			const controller = state.activeRunEventController;
			state.activeRunEventController = null;
			if (controller && !controller.signal.aborted) {
				controller.abort();
			}
		}

		function isAbortError(error) {
			return error instanceof DOMException && error.name === "AbortError";
		}

		async function attachActiveRunEventStream(conversationId) {
			const nextConversationId = String(conversationId || "").trim();
			if (!nextConversationId) {
				return;
			}
			if (
				state.activeRunEventController &&
				state.activeRunEventController.conversationId === nextConversationId &&
				!state.activeRunEventController.signal.aborted
			) {
				return;
			}

			stopActiveRunEventStream();
			const controller = new AbortController();
			controller.conversationId = nextConversationId;
			state.activeRunEventController = controller;

			try {
				const query = new URLSearchParams({ conversationId: nextConversationId });
				const response = await fetch("/v1/chat/events?" + query.toString(), {
					method: "GET",
					headers: { accept: "text/event-stream" },
					signal: controller.signal,
				});
				if (!response.ok) {
					throw new Error("无法重新连接当前运行任务");
				}

				await readEventStream(response, handleStreamEvent);
			} catch (error) {
				if (controller.signal.aborted || isAbortError(error) || isPageUnloadStreamError(error)) {
					return;
				}

				const messageText = error instanceof Error ? error.message : "无法重新连接当前运行任务";
				showError(messageText);
				updateStreamingProcess("error", "运行状态重连失败", messageText);
			} finally {
				if (state.activeRunEventController === controller) {
					state.activeRunEventController = null;
				}
			}
		}

		async function syncConversationRunState(conversationId, options) {
			const nextConversationId = String(conversationId || "").trim();
			if (!nextConversationId) {
				state.contextUsage = null;
				renderContextUsageBar();
				return { conversationId: "", running: false, contextUsage: createFallbackContextUsage() };
			}

			try {
				const payload = await fetchConversationState(nextConversationId);
				renderConversationState(payload);
				if (payload.running && !state.primaryStreamActive) {
					void attachActiveRunEventStream(nextConversationId);
				} else if (!payload.running && state.loading && options?.clearIfIdle) {
					stopActiveRunEventStream();
					setLoading(false);
				}
				return payload;
			} catch (error) {
				renderContextUsageBar();
				if (!options?.silent) {
					const messageText = error instanceof Error ? error.message : "无法获取当前会话状态";
					showError(messageText);
				}

				return {
					conversationId: nextConversationId,
					running: Boolean(state.loading),
					contextUsage: normalizeContextUsage(state.contextUsage),
				};
			}
		}

		function renderConversationState(conversationState) {
			const nextConversationId = String(conversationState?.conversationId || state.conversationId || "").trim();
			const activeRun = normalizeActiveRun(conversationState?.activeRun);
			state.conversationState = {
				...(conversationState || {}),
				conversationId: nextConversationId,
				activeRun,
			};
			state.contextUsage = normalizeContextUsage(conversationState?.contextUsage);
			state.conversationHistory = Array.isArray(conversationState?.messages)
				? conversationState.messages.map(normalizeHistoryEntry).filter(Boolean).slice(-MAX_STORED_MESSAGES_PER_CONVERSATION)
				: [];
			state.renderedHistoryCount = 0;
			clearRenderedTranscript();
			resetStreamingState();
			renderContextUsageBar();

			if (state.conversationHistory.length > 0) {
				setTranscriptState("active");
				renderMoreConversationHistory();
			}

			if (!activeRun) {
				if (state.conversationHistory.length === 0) {
					setTranscriptState("idle");
				}
				syncHistoryLoadMoreButton();
				if (state.loading) {
					setLoading(false);
				}
				return;
			}

			setTranscriptState("active");
			mergeRecentAssets(activeRun.input?.inputAssets || []);
			const inputMessage = String(activeRun.input?.message || "").trim();
			const lastHistoryEntry = state.conversationHistory.at(-1);
			if (
				inputMessage &&
				!(lastHistoryEntry?.kind === "user" && String(lastHistoryEntry.text || "").trim() === inputMessage)
			) {
				renderTranscriptEntry(
					buildTranscriptEntry("user", state.conversationId, inputMessage, {
						id: "active-input-" + activeRun.runId,
						createdAt: activeRun.startedAt,
						assetRefs: (activeRun.input?.inputAssets || []).map((asset) => asset.assetId),
					}),
				);
			}

			const assistantEntry = buildTranscriptEntry("assistant", "助手", activeRun.text || "", {
				id: activeRun.assistantMessageId,
				createdAt: activeRun.startedAt,
			});
			const rendered = renderTranscriptEntry(assistantEntry);
			state.activeAssistantContent = rendered.content;
			state.streamingText = activeRun.text || "";
			state.receivedDoneEvent = activeRun.status === "done";
			applyProcessViewToRenderedMessage(activeRun.process, rendered, {
				activate: true,
				running: activeRun.loading,
			});
			if (activeRun.loading) {
				setLoading(true);
				setAssistantLoadingState("当前正在运行", "system");
				statusPill.textContent = "运行中";
			} else {
				setLoading(false);
				statusPill.textContent =
					activeRun.status === "error"
						? "错误"
						: activeRun.status === "interrupted"
							? "已打断"
							: "已结束";
			}
			syncHistoryLoadMoreButton();
			scrollTranscriptToBottom({ force: true });
		}

		function applyConversationCatalog(payload) {
			const currentConversationId = String(payload?.currentConversationId || "").trim();
			state.conversationCatalog = Array.isArray(payload?.conversations)
				? payload.conversations.map(normalizeConversationCatalogItem).filter(Boolean)
				: [];
			if (currentConversationId && !state.conversationCatalog.some((item) => item.conversationId === currentConversationId)) {
				state.conversationCatalog.unshift({
					conversationId: currentConversationId,
					title: "新会话",
					preview: "",
					messageCount: 0,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					running: false,
				});
			}
			renderConversationDrawer();
			return currentConversationId;
		}

		async function syncConversationCatalog(options) {
			if (state.conversationCatalogSyncing) {
				return {
					currentConversationId: state.conversationId,
					conversations: state.conversationCatalog,
				};
			}

			state.conversationCatalogSyncing = true;
			try {
				const payload = await fetchConversationCatalog();
				const currentConversationId = applyConversationCatalog(payload);
				if (currentConversationId && options?.activateCurrent !== false && currentConversationId !== state.conversationId) {
					await activateConversation(currentConversationId, {
						silent: options?.silent,
						skipCatalogSync: true,
						skipServerSwitch: true,
					});
				}
				return {
					currentConversationId: currentConversationId || state.conversationId,
					conversations: state.conversationCatalog,
				};
			} catch (error) {
				if (!options?.silent) {
					const messageText = error instanceof Error ? error.message : "无法同步会话列表";
					showError(messageText);
				}
				return {
					currentConversationId: state.conversationId,
					conversations: state.conversationCatalog,
				};
			} finally {
				state.conversationCatalogSyncing = false;
			}
		}

		async function ensureCurrentConversation(options) {
			const catalog = await syncConversationCatalog({
				silent: options?.silent,
				activateCurrent: false,
			});
			const currentConversationId = String(catalog.currentConversationId || state.conversationId || "").trim();
			if (!currentConversationId) {
				return "";
			}
			if (options?.activate !== false && currentConversationId !== state.conversationId) {
				await activateConversation(currentConversationId, {
					silent: options?.silent,
					skipCatalogSync: true,
					skipServerSwitch: true,
				});
			}
			return currentConversationId;
		}

		async function activateConversation(conversationId, options) {
			const nextConversationId = String(conversationId || "").trim();
			if (!nextConversationId) {
				return false;
			}
			if (state.loading && nextConversationId !== state.conversationId) {
				if (!options?.silent) {
					showError("当前任务未结束，不能切换产线");
				}
				return false;
			}

			stopActiveRunEventStream();
			state.conversationId = nextConversationId;
			conversationInput.value = nextConversationId;
			sessionFile.textContent = "尚未分配";
			state.contextUsage = null;
			state.conversationState = null;
			resetStreamingState();
			clearError();
			restoreConversationHistory(nextConversationId);
			await restoreConversationHistoryFromServer(nextConversationId);
			await syncConversationRunState(nextConversationId, {
				silent: true,
				clearIfIdle: true,
			});
			if (!options?.skipCatalogSync) {
				void syncConversationCatalog({
					silent: true,
					activateCurrent: false,
				});
			}
			closeMobileConversationDrawer();
			return true;
		}

		async function selectConversationFromDrawer(conversationId) {
			const nextConversationId = String(conversationId || "").trim();
			if (!nextConversationId || nextConversationId === state.conversationId) {
				closeMobileConversationDrawer();
				return;
			}
			if (state.loading) {
				showError("当前任务未结束，不能切换产线");
				renderConversationDrawer();
				return;
			}

			try {
				const result = await switchConversationOnServer(nextConversationId);
				if (!result.switched) {
					showError(result.reason === "running" ? "当前任务未结束，不能切换产线" : "无法切换到这个会话");
					await syncConversationCatalog({ silent: true, activateCurrent: false });
					return;
				}
				await activateConversation(result.currentConversationId || result.conversationId, {
					skipCatalogSync: false,
					skipServerSwitch: true,
				});
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "切换会话失败";
				showError(messageText);
			}
		}

		function getConversationHistoryStorageKey(conversationId) {
			return "ugk-pi:conversation-history:" + conversationId;
		}

		function readConversationHistoryIndex() {
			try {
				const raw = localStorage.getItem(CONVERSATION_HISTORY_INDEX_KEY);
				const parsed = JSON.parse(raw || "[]");
				return Array.isArray(parsed) ? parsed : [];
			} catch {
				return [];
			}
		}

		function writeConversationHistoryIndex(index) {
			try {
				localStorage.setItem(CONVERSATION_HISTORY_INDEX_KEY, JSON.stringify(index));
			} catch {}
		}

		function cloneHistoryAttachments(attachments) {
			if (!Array.isArray(attachments) || attachments.length === 0) {
				return [];
			}

			return attachments.map((attachment) => ({
				fileName: attachment.fileName || "attachment",
				mimeType: attachment.mimeType || "application/octet-stream",
				sizeBytes: Number.isFinite(attachment.sizeBytes) ? attachment.sizeBytes : 0,
			}));
		}

		function cloneHistoryAssetRefs(assetRefs) {
			if (!Array.isArray(assetRefs) || assetRefs.length === 0) {
				return [];
			}

			return assetRefs
				.map((assetId) => state.recentAssets.find((asset) => asset.assetId === assetId))
				.filter(Boolean)
				.map((asset) => ({
					assetId: asset.assetId,
					fileName: asset.fileName || asset.assetId,
					mimeType: asset.mimeType || "application/octet-stream",
					sizeBytes: Number.isFinite(asset.sizeBytes) ? asset.sizeBytes : 0,
					kind: asset.kind || "metadata",
				}));
		}

		function cloneHistoryFiles(files) {
			if (!Array.isArray(files) || files.length === 0) {
				return [];
			}

			return files.map((file) => ({
				id: file.id || file.assetId || createBrowserId(),
				assetId: file.assetId || file.id || "",
				reference: file.reference || "",
				fileName: file.fileName || "download",
				mimeType: file.mimeType || "application/octet-stream",
				sizeBytes: Number.isFinite(file.sizeBytes) ? file.sizeBytes : 0,
				downloadUrl: file.downloadUrl || "",
			}));
		}

		function normalizeHistoryEntry(rawEntry) {
			if (!rawEntry || typeof rawEntry !== "object") {
				return null;
			}

			return {
				id: typeof rawEntry.id === "string" && rawEntry.id ? rawEntry.id : createBrowserId(),
				kind: typeof rawEntry.kind === "string" ? rawEntry.kind : "assistant",
				title: typeof rawEntry.title === "string" ? rawEntry.title : "助手",
				text: typeof rawEntry.text === "string" ? rawEntry.text : "",
				createdAt:
					typeof rawEntry.createdAt === "string" && rawEntry.createdAt
						? rawEntry.createdAt
						: new Date().toISOString(),
				source: typeof rawEntry.source === "string" ? rawEntry.source : undefined,
				sourceId: typeof rawEntry.sourceId === "string" ? rawEntry.sourceId : undefined,
				runId: typeof rawEntry.runId === "string" ? rawEntry.runId : undefined,
				attachments: cloneHistoryAttachments(rawEntry.attachments),
				assetRefs: Array.isArray(rawEntry.assetRefs)
					? rawEntry.assetRefs
							.filter((asset) => asset && typeof asset === "object")
							.map((asset) => ({
								assetId: typeof asset.assetId === "string" ? asset.assetId : "",
								fileName: typeof asset.fileName === "string" ? asset.fileName : "asset",
								mimeType: typeof asset.mimeType === "string" ? asset.mimeType : "application/octet-stream",
								sizeBytes: Number.isFinite(asset.sizeBytes) ? asset.sizeBytes : 0,
								kind: typeof asset.kind === "string" ? asset.kind : "metadata",
							}))
							.filter((asset) => asset.assetId)
					: [],
				files: cloneHistoryFiles(rawEntry.files),
			};
		}

		function normalizeActiveRun(rawRun) {
			if (!rawRun || typeof rawRun !== "object") {
				return null;
			}

			const status = ["running", "interrupted", "done", "error"].includes(rawRun.status)
				? rawRun.status
				: "running";
			const input = rawRun.input && typeof rawRun.input === "object" ? rawRun.input : {};
			const queue = rawRun.queue && typeof rawRun.queue === "object"
				? {
						steering: Array.isArray(rawRun.queue.steering) ? rawRun.queue.steering.map(String) : [],
						followUp: Array.isArray(rawRun.queue.followUp) ? rawRun.queue.followUp.map(String) : [],
					}
				: null;

			return {
				runId: typeof rawRun.runId === "string" && rawRun.runId ? rawRun.runId : createBrowserId(),
				status,
				assistantMessageId:
					typeof rawRun.assistantMessageId === "string" && rawRun.assistantMessageId
						? rawRun.assistantMessageId
						: "active-run-" + createBrowserId(),
				input: {
					message: typeof input.message === "string" ? input.message : "",
					inputAssets: Array.isArray(input.inputAssets)
						? input.inputAssets
								.filter((asset) => asset && typeof asset === "object")
								.map((asset) => ({
									assetId: typeof asset.assetId === "string" ? asset.assetId : "",
									fileName: typeof asset.fileName === "string" ? asset.fileName : "asset",
									mimeType: typeof asset.mimeType === "string" ? asset.mimeType : "application/octet-stream",
									sizeBytes: Number.isFinite(asset.sizeBytes) ? asset.sizeBytes : 0,
									kind: typeof asset.kind === "string" ? asset.kind : "metadata",
								}))
								.filter((asset) => asset.assetId)
						: [],
				},
				text: typeof rawRun.text === "string" ? rawRun.text : "",
				process: normalizeProcessView(rawRun.process),
				queue,
				loading: rawRun.loading !== false && status === "running",
				startedAt: typeof rawRun.startedAt === "string" ? rawRun.startedAt : new Date().toISOString(),
				updatedAt: typeof rawRun.updatedAt === "string" ? rawRun.updatedAt : new Date().toISOString(),
			};
		}

		function normalizeProcessView(rawProcess) {
			if (!rawProcess || typeof rawProcess !== "object") {
				return null;
			}

			const allowedKinds = new Set(["system", "tool", "ok", "error", "warn"]);
			const entries = Array.isArray(rawProcess.entries)
				? rawProcess.entries
						.filter((entry) => entry && typeof entry === "object")
						.map((entry, index) => ({
							id: typeof entry.id === "string" && entry.id ? entry.id : "process-" + (index + 1),
							kind: allowedKinds.has(entry.kind) ? entry.kind : "system",
							title: typeof entry.title === "string" ? entry.title : "过程更新",
							detail: typeof entry.detail === "string" ? entry.detail : "",
							createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
							toolCallId: typeof entry.toolCallId === "string" ? entry.toolCallId : "",
							toolName: typeof entry.toolName === "string" ? entry.toolName : "",
							isError: Boolean(entry.isError),
						}))
				: [];
			const narration = Array.isArray(rawProcess.narration)
				? rawProcess.narration.map((line) => String(line || "").trim()).filter(Boolean)
				: entries.map(formatProcessViewEntry);
			const currentAction = String(rawProcess.currentAction || "").trim();
			const kind = allowedKinds.has(rawProcess.kind) ? rawProcess.kind : (entries.at(-1)?.kind || "system");
			if (!narration.length && !currentAction) {
				return null;
			}

			return {
				title: typeof rawProcess.title === "string" ? rawProcess.title : "思考过程",
				narration,
				currentAction: currentAction || entries.at(-1)?.title || "等待动作",
				kind,
				isComplete: Boolean(rawProcess.isComplete),
				entries,
			};
		}

		function buildConversationStateSignature(conversationState) {
			const source = conversationState && typeof conversationState === "object" ? conversationState : {};
			const messages = Array.isArray(source.messages) ? source.messages : [];
			const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
			const activeRun = normalizeActiveRun(source.activeRun);
			return JSON.stringify({
				updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
				running: Boolean(source.running),
				messageCount: messages.length,
				lastMessageId: lastMessage && typeof lastMessage.id === "string" ? lastMessage.id : "",
				lastMessageText: lastMessage && typeof lastMessage.text === "string" ? lastMessage.text : "",
				activeRunStatus: activeRun ? activeRun.status : "",
				activeRunText: activeRun ? activeRun.text : "",
			});
		}

		function formatProcessViewEntry(entry) {
			const subject = entry.toolName ? entry.title + " · " + entry.toolName : entry.title;
			return entry.detail ? subject + "\\n" + entry.detail : subject;
		}

		function isNetworkErrorText(text) {
			const normalized = String(text || "").trim().toLowerCase();
			return (
				normalized === "network error" ||
				normalized.includes("failed to fetch") ||
				normalized.includes("networkerror") ||
				normalized.includes("abort") ||
				normalized.includes("cancel")
			);
		}

		function isTransientNetworkHistoryEntry(entry) {
			if (!entry || entry.kind !== "error") {
				return false;
			}

			const title = String(entry.title || "").trim().toLowerCase();
			const isNetworkTitle = title === "network" || entry.title === "网络";
			return isNetworkTitle && isNetworkErrorText(entry.text);
		}

		function isPageUnloadStreamError(error) {
			const messageText = error instanceof Error ? error.message : String(error || "");
			return state.pageUnloading && !state.receivedDoneEvent && isNetworkErrorText(messageText);
		}

		async function recoverRunningStreamAfterDisconnect(reason) {
			if (state.receivedDoneEvent || !state.conversationId) {
				return false;
			}

			const previousSignature = buildConversationStateSignature(state.conversationState);
			const payload = await syncConversationRunState(state.conversationId, {
				silent: true,
				clearIfIdle: false,
			});
			if (!payload.running) {
				const nextSignature = buildConversationStateSignature(state.conversationState);
				const canonicalStateSettled =
					nextSignature !== previousSignature || Boolean(state.conversationState?.activeRun);
				if (!canonicalStateSettled) {
					return false;
				}

				clearError();
				setLoading(false);
				return true;
			}

			clearError();
			setLoading(true);
			setAssistantLoadingState("当前正在运行", "system");
			updateStreamingProcess(
				"warn",
				"页面连接已恢复",
				reason === "missing_done"
					? "主连接结束但后端任务仍在运行，已切换到运行态事件流继续接收。"
					: "浏览器网络连接短暂断开，已重新订阅当前运行任务。",
			);
			return true;
		}

		function loadConversationHistoryEntries(conversationId) {
			if (!conversationId) {
				return [];
			}

			try {
				const raw = localStorage.getItem(getConversationHistoryStorageKey(conversationId));
				const parsed = JSON.parse(raw || "[]");
				if (!Array.isArray(parsed)) {
					return [];
				}
				return parsed
					.map(normalizeHistoryEntry)
					.filter(Boolean)
					.filter((entry) => !isTransientNetworkHistoryEntry(entry));
			} catch {
				return [];
			}
		}

		function persistConversationHistory(conversationId) {
			if (!conversationId) {
				return;
			}

			state.conversationHistory = state.conversationHistory.slice(-MAX_STORED_MESSAGES_PER_CONVERSATION);

			try {
				localStorage.setItem(
					getConversationHistoryStorageKey(conversationId),
					JSON.stringify(state.conversationHistory),
				);
			} catch {
				return;
			}

			const nextIndex = readConversationHistoryIndex()
				.filter((entry) => entry && typeof entry === "object" && entry.conversationId !== conversationId)
				.map((entry) => ({
					conversationId: entry.conversationId,
					updatedAt: entry.updatedAt,
					messageCount: Number.isFinite(entry.messageCount) ? entry.messageCount : 0,
				}));
			nextIndex.unshift({
				conversationId,
				updatedAt: new Date().toISOString(),
				messageCount: state.conversationHistory.length,
			});

			while (nextIndex.length > MAX_STORED_CONVERSATIONS) {
				const removed = nextIndex.pop();
				if (removed?.conversationId) {
					localStorage.removeItem(getConversationHistoryStorageKey(removed.conversationId));
				}
			}

			writeConversationHistoryIndex(nextIndex);
		}

		function scheduleConversationHistoryPersist(conversationId) {
			const nextConversationId = String(conversationId || "").trim();
			if (!nextConversationId) {
				return;
			}
			state.historyPersistConversationId = nextConversationId;
			if (state.historyPersistTimer !== null) {
				window.clearTimeout(state.historyPersistTimer);
			}
			state.historyPersistTimer = window.setTimeout(() => {
				state.historyPersistTimer = null;
				persistConversationHistory(state.historyPersistConversationId);
			}, 1200);
		}

		function flushConversationHistoryPersist() {
			if (state.historyPersistTimer !== null) {
				window.clearTimeout(state.historyPersistTimer);
				state.historyPersistTimer = null;
			}
			if (state.historyPersistConversationId) {
				persistConversationHistory(state.historyPersistConversationId);
			}
		}

		function buildTranscriptEntry(kind, title, text, options) {
			return {
				id: options?.id || createBrowserId(),
				kind,
				title,
				text: String(text || ""),
				createdAt: options?.createdAt || new Date().toISOString(),
				source: typeof options?.source === "string" ? options.source : undefined,
				sourceId: typeof options?.sourceId === "string" ? options.sourceId : undefined,
				runId: typeof options?.runId === "string" ? options.runId : undefined,
				attachments: cloneHistoryAttachments(options?.attachments),
				assetRefs: cloneHistoryAssetRefs(options?.assetRefs),
				files: cloneHistoryFiles(options?.files),
			};
		}

		function rememberConversationMessage(entry) {
			const index = state.conversationHistory.findIndex((current) => current.id === entry.id);
			if (index >= 0) {
				state.conversationHistory.splice(index, 1, entry);
			} else {
				state.conversationHistory.push(entry);
			}
			scheduleConversationHistoryPersist(state.conversationId);
		}

		function archiveCurrentTranscript(conversationId) {
			if (!transcriptCurrent.firstChild) {
				return;
			}

			const archive = document.createElement("section");
			archive.className = "archived-conversation";

			const head = document.createElement("div");
			head.className = "archived-conversation-head";
			head.innerHTML = "<span>历史会话</span><strong></strong>";
			head.querySelector("strong").textContent = String(conversationId || "").trim() || "untitled";

			const body = document.createElement("div");
			body.className = "archived-conversation-body";
			while (transcriptCurrent.firstChild) {
				body.appendChild(transcriptCurrent.firstChild);
			}

			archive.appendChild(head);
			archive.appendChild(body);
			if (transcriptArchive.firstChild) {
				transcriptArchive.insertBefore(archive, transcriptArchive.firstChild);
			} else {
				transcriptArchive.appendChild(archive);
			}

			while (transcriptArchive.childElementCount > MAX_ARCHIVED_TRANSCRIPTS) {
				transcriptArchive.lastElementChild?.remove();
			}

			renderedMessages.clear();
		}

		function clearRenderedTranscript() {
			transcriptCurrent.innerHTML = "";
			renderedMessages.clear();
		}

		function syncMessageCopyButton(entry) {
			const rendered = renderedMessages.get(entry.id);
			if (!rendered?.copyButton) {
				return;
			}

			rendered.copyButton.disabled = !String(entry.text || "").trim();
		}

		function buildAssistantLoadingBubble() {
			const shell = document.createElement("div");
			shell.className = "assistant-loading-shell is-running system";

			const bubble = document.createElement("div");
			bubble.className = "assistant-loading-bubble";

			const label = document.createElement("span");
			label.className = "assistant-loading-label";
			label.textContent = "正在等待响应";

			const dots = document.createElement("span");
			dots.className = "assistant-loading-dots";
			dots.setAttribute("aria-hidden", "true");

			for (let index = 0; index < 3; index += 1) {
				const dot = document.createElement("span");
				dot.className = "assistant-loading-dot";
				dots.appendChild(dot);
			}

			bubble.appendChild(label);
			bubble.appendChild(dots);
			shell.appendChild(bubble);

			return { shell, label, dots };
		}

		function attachAssistantLoadingBubble(body, content) {
			const stream = buildAssistantLoadingBubble();
			if (content.parentElement === body && content.nextSibling) {
				body.insertBefore(stream.shell, content.nextSibling);
			} else {
				body.appendChild(stream.shell);
			}

			state.activeLoadingShell = stream.shell;
			state.activeLoadingLabel = stream.label;
			state.activeLoadingDots = stream.dots;
			return stream;
		}

		function ensureAssistantLoadingBubble() {
			if (
				state.activeLoadingShell?.isConnected &&
				state.activeLoadingLabel?.isConnected &&
				state.activeLoadingDots?.isConnected
			) {
				return {
					shell: state.activeLoadingShell,
					label: state.activeLoadingLabel,
					dots: state.activeLoadingDots,
				};
			}

			const content = ensureStreamingAssistantMessage();
			const body = content.parentElement;
			if (!body) {
				throw new Error("assistant message body is unavailable");
			}

			return attachAssistantLoadingBubble(body, content);
		}

		function setAssistantLoadingState(text, kind) {
			const labelText = String(text || "").trim() || "正在等待响应";
			const stream = ensureAssistantLoadingBubble();
			stream.label.textContent = labelText;
			stream.dots.hidden = false;
			stream.shell.classList.remove("tool", "ok", "warn", "error", "system");
			stream.shell.classList.add(kind || "system");
			stream.shell.classList.add("is-running");
			stream.shell.classList.remove("is-complete");
			scrollTranscriptToBottom();
		}

		function completeAssistantLoadingBubble(kind, text) {
			if (!state.activeLoadingShell || !state.activeLoadingLabel || !state.activeLoadingDots) {
				return;
			}

			if (text) {
				state.activeLoadingLabel.textContent = text;
			}
			state.activeLoadingDots.hidden = true;
			state.activeLoadingShell.classList.remove("tool", "ok", "warn", "error", "system");
			state.activeLoadingShell.classList.add(kind || "ok");
			state.activeLoadingShell.classList.remove("is-running");
			state.activeLoadingShell.classList.add("is-complete");
			scrollTranscriptToBottom();
		}

		function canOpenConnRunDetails(entry) {
			return entry?.source === "conn" && Boolean(entry.sourceId) && Boolean(entry.runId);
		}

		function formatConnRunTimestamp(value) {
			if (!value) {
				return "";
			}
			const date = new Date(value);
			return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
		}

		function isConnRunTimedOut(run, events) {
			const hasTimeoutEvent = Array.isArray(events) && events.some((event) => event?.eventType === "run_timed_out");
			const errorText = String(run?.errorText || run?.resultSummary || "");
			return hasTimeoutEvent || /exceeded maxRunMs/i.test(errorText);
		}

		function resolveConnRunHealthLabel(run, events) {
			if (!run || typeof run !== "object") {
				return "unknown";
			}
			if (run.status === "failed" && isConnRunTimedOut(run, events)) {
				return "failed / timed out";
			}
			if (run.status !== "running") {
				return run.status || "unknown";
			}
			if (!run.leaseUntil) {
				return "running / lease unknown";
			}
			const leaseUntil = new Date(run.leaseUntil);
			if (Number.isNaN(leaseUntil.getTime())) {
				return "running / lease unreadable";
			}
			return leaseUntil.getTime() <= Date.now() ? "running / stale suspected" : "running / lease active";
		}

		function describeConnStatusLabel(status) {
			return CONN_STATUS_LABELS[String(status || "").trim()] || String(status || "未知状态");
		}

		function describeConnRunStatusLabel(status) {
			return CONN_RUN_STATUS_LABELS[String(status || "").trim()] || String(status || "未知结果");
		}

		function describeActivitySourceLabel(source, kind) {
			const normalizedSource = String(source || "").trim();
			if (normalizedSource && ACTIVITY_SOURCE_LABELS[normalizedSource]) {
				return ACTIVITY_SOURCE_LABELS[normalizedSource];
			}
			return String(kind || source || "活动").trim() || "活动";
		}

		function formatConnIntervalLabel(everyMs) {
			const minutes = Math.round(Number(everyMs) / 60000);
			if (!Number.isFinite(minutes) || minutes <= 0) {
				return "按间隔重复";
			}
			if (minutes % (24 * 60) === 0) {
				return "每 " + minutes / (24 * 60) + " 天";
			}
			if (minutes % 60 === 0) {
				return "每 " + minutes / 60 + " 小时";
			}
			return "每 " + minutes + " 分钟";
		}

		function formatConnMaxRunLabel(maxRunMs) {
			const seconds = Math.round(Number(maxRunMs) / 1000);
			if (!Number.isFinite(seconds) || seconds <= 0) {
				return "";
			}
			if (seconds % 60 === 0) {
				return seconds / 60 + " 分钟";
			}
			return seconds + " 秒";
		}

		function describeConnScheduleSummary(schedule) {
			if (!schedule || typeof schedule !== "object") {
				return "执行方式未配置";
			}
			if (schedule.kind === "cron") {
				const parsed = parseConnCronExpression(schedule.expression);
				if (
					parsed &&
					parsed.dayOfMonth === "*" &&
					parsed.month === "*" &&
					parsed.dayOfWeek === "*"
				) {
					return "每日执行 · " + (formatConnTimeOfDay(parsed.hour, parsed.minute) || "时间待定");
				}
				return "按规则执行 · " + (schedule.expression || "未配置");
			}
			if (schedule.kind === "interval") {
				const parts = ["间隔执行 · " + formatConnIntervalLabel(schedule.everyMs)];
				if (schedule.startAt) {
					parts.push("首次 " + formatConnRunTimestamp(schedule.startAt));
				}
				return parts.join(" · ");
			}
			if (schedule.kind === "once") {
				return "定时执行 · " + formatConnRunTimestamp(schedule.at);
			}
			return String(schedule.kind || "执行方式未配置");
		}

		function describeConnTargetSummary(target) {
			if (!target || typeof target !== "object") {
				return "结果去向未配置";
			}
			if (target.type === "conversation") {
				const conversation = describeConversationTarget(target.conversationId, "会话");
				const parts = [conversation.active ? "当前会话" : conversation.title || "指定会话"];
				if (conversation.id && !conversation.active) {
					parts.push(conversation.id);
				}
				return parts.join(" · ");
			}
			if (target.type === "feishu_chat") {
				return "飞书群 · " + (target.chatId || "待填写");
			}
			if (target.type === "feishu_user") {
				return "飞书用户 · " + (target.openId || "待填写");
			}
			return String(target.type || "结果去向未配置");
		}

		function describeConnTimingSummary(conn) {
			const parts = [];
			if (conn?.nextRunAt) {
				parts.push("下次 " + formatConnRunTimestamp(conn.nextRunAt));
			} else if (conn?.status === "completed") {
				parts.push("已完成，不再自动执行");
			} else {
				parts.push("下次执行待定");
			}
			if (conn?.lastRunAt) {
				parts.push("最近 " + formatConnRunTimestamp(conn.lastRunAt));
			}
			if (conn?.maxRunMs) {
				const maxRunLabel = formatConnMaxRunLabel(conn.maxRunMs);
				if (maxRunLabel) {
					parts.push("最长等待 " + maxRunLabel);
				}
			}
			return parts.join(" · ");
		}

		function createConnActionButton(text, onClick, options) {
			const button = document.createElement("button");
			button.type = "button";
			button.textContent = text;
			button.disabled = Boolean(options?.disabled);
			if (options?.className) {
				button.className = options.className;
			}
			button.addEventListener("click", onClick);
			return button;
		}

		function setConnManagerNotice(message, connId) {
			state.connManagerNotice = String(message || "").trim();
			state.connManagerHighlightedConnId = String(connId || "").trim();
			if (connManagerNotice) {
				connManagerNotice.textContent = state.connManagerNotice;
				connManagerNotice.hidden = !state.connManagerNotice;
			}
		}

		function getConnManagerSelectedSet() {
			return new Set(
				(Array.isArray(state.connManagerSelectedConnIds) ? state.connManagerSelectedConnIds : [])
					.map((connId) => String(connId || "").trim())
					.filter(Boolean),
			);
		}

		function setConnManagerSelectedIds(connIds) {
			state.connManagerSelectedConnIds = Array.from(
				new Set(
					(Array.isArray(connIds) ? connIds : [])
						.map((connId) => String(connId || "").trim())
						.filter(Boolean),
				),
			);
		}

		function syncConnManagerSelectionWithItems() {
			const existingConnIds = new Set(
				(Array.isArray(state.connManagerItems) ? state.connManagerItems : [])
					.map((conn) => String(conn?.connId || "").trim())
					.filter(Boolean),
			);
			setConnManagerSelectedIds(state.connManagerSelectedConnIds.filter((connId) => existingConnIds.has(connId)));
		}

		function getVisibleConnManagerItems() {
			const filter = String(state.connManagerFilter || "all");
			const conns = Array.isArray(state.connManagerItems) ? state.connManagerItems : [];
			if (filter === "all") {
				return conns;
			}
			return conns.filter((conn) => conn?.status === filter);
		}

		function updateConnManagerToolbar() {
			syncConnManagerSelectionWithItems();
			const selectedCount = state.connManagerSelectedConnIds.length;
			const visibleCount = getVisibleConnManagerItems().length;
			if (connManagerFilter && connManagerFilter.value !== state.connManagerFilter) {
				connManagerFilter.value = state.connManagerFilter;
			}
			if (connManagerSelectedCount) {
				connManagerSelectedCount.textContent = "已选 " + selectedCount;
			}
			if (selectVisibleConnsButton) {
				selectVisibleConnsButton.disabled = visibleCount === 0 || Boolean(state.connManagerActionConnId);
			}
			if (clearSelectedConnsButton) {
				clearSelectedConnsButton.disabled = selectedCount === 0 || Boolean(state.connManagerActionConnId);
			}
			if (deleteSelectedConnsButton) {
				deleteSelectedConnsButton.disabled = selectedCount === 0 || Boolean(state.connManagerActionConnId);
			}
		}

		function selectVisibleConns() {
			setConnManagerSelectedIds(getVisibleConnManagerItems().map((conn) => conn.connId));
			renderConnManager();
		}

		function clearSelectedConns() {
			setConnManagerSelectedIds([]);
			renderConnManager();
		}

		function toggleConnManagerSelection(conn, checked) {
			if (!conn?.connId || state.connManagerActionConnId) {
				return;
			}
			const selected = getConnManagerSelectedSet();
			if (checked) {
				selected.add(conn.connId);
			} else {
				selected.delete(conn.connId);
			}
			setConnManagerSelectedIds(Array.from(selected));
			renderConnManager();
		}

		function updateConnManagerConn(nextConn) {
			if (!nextConn?.connId) {
				return;
			}
			let replaced = false;
			state.connManagerItems = state.connManagerItems.map((conn) => {
				if (conn?.connId !== nextConn.connId) {
					return conn;
				}
				replaced = true;
				return nextConn;
			});
			if (!replaced) {
				state.connManagerItems = [nextConn, ...state.connManagerItems];
			}
		}

		function prependConnManagerRun(connId, run) {
			if (!run || !connId) {
				return;
			}
			const currentRuns = Array.isArray(state.connManagerRunsByConnId[connId])
				? state.connManagerRunsByConnId[connId]
				: [];
			state.connManagerRunsByConnId = {
				...state.connManagerRunsByConnId,
				[connId]: [run, ...currentRuns.filter((current) => current?.runId !== run.runId)],
			};
		}

		function buildConnRunManagerEntry(conn, run) {
			return {
				kind: "notification",
				source: "conn",
				sourceId: conn.connId,
				runId: run.runId,
				title: (conn.title || "Conn") + " · " + describeConnRunStatusLabel(run.status),
			};
		}

		function renderAgentActivity() {
			agentActivityList.innerHTML = "";
			if (state.agentActivityLoading && state.agentActivityItems.length === 0) {
				const loading = document.createElement("div");
				loading.className = "asset-empty";
				loading.textContent = "正在读取全局活动。";
				agentActivityList.appendChild(loading);
				return;
			}
			if (state.agentActivityError && state.agentActivityItems.length === 0) {
				const empty = document.createElement("div");
				empty.className = "asset-empty";
				empty.textContent = state.agentActivityError;
				agentActivityList.appendChild(empty);
				return;
			}
			const activities = Array.isArray(state.agentActivityItems) ? state.agentActivityItems : [];
			if (activities.length === 0) {
				const empty = document.createElement("div");
				empty.className = "asset-empty";
				empty.textContent = "暂时没有全局活动。conn 跑完以后，这里会跨会话留痕。";
				agentActivityList.appendChild(empty);
				return;
			}
			for (const activity of activities) {
				const item = document.createElement("article");
				item.className = "agent-activity-item";

				const copy = document.createElement("div");
				copy.className = "agent-activity-copy";
				const titleRow = document.createElement("div");
				titleRow.className = "agent-activity-title-row";
				const title = document.createElement("strong");
				title.textContent = activity.title || "活动";
				const source = document.createElement("span");
				source.className = "agent-activity-source";
				source.textContent = describeActivitySourceLabel(activity.source, activity.kind);
				titleRow.appendChild(title);
				titleRow.appendChild(source);

				const text = document.createElement("div");
				text.className = "agent-activity-text";
				text.textContent = activity.text || "没有正文摘要。";

				const meta = document.createElement("div");
				meta.className = "agent-activity-meta";
				const created = document.createElement("span");
				created.textContent = formatConnRunTimestamp(activity.createdAt) || activity.createdAt || "";
				meta.appendChild(created);
				if (activity.conversationId) {
					const targetConversation = describeConversationTarget(activity.conversationId, "会话");
					const conversation = document.createElement("span");
					conversation.textContent =
						"来自 " + (targetConversation.active ? "当前会话 " : (targetConversation.title || "会话") + " ");
					const code = document.createElement("code");
					code.textContent = activity.conversationId;
					conversation.appendChild(code);
					meta.appendChild(conversation);
				}
				if (activity.runId) {
					const run = document.createElement("span");
					run.textContent = "运行 ";
					const code = document.createElement("code");
					code.textContent = activity.runId;
					run.appendChild(code);
					meta.appendChild(run);
				}
				if (activity.files.length > 0) {
					const files = document.createElement("span");
					files.textContent = "附 " + activity.files.length + " 个文件";
					meta.appendChild(files);
				}

				copy.appendChild(titleRow);
				copy.appendChild(text);
				copy.appendChild(meta);
				item.appendChild(copy);

				if (canOpenConnRunDetails(activity)) {
					const actions = document.createElement("div");
					actions.className = "agent-activity-actions";
					const openButton = document.createElement("button");
					openButton.type = "button";
					openButton.textContent = "查看执行过程";
					openButton.addEventListener("click", () => {
						closeAgentActivity();
						void openConnRunDetails(activity);
					});
					actions.appendChild(openButton);
					item.appendChild(actions);
				}

				agentActivityList.appendChild(item);
			}
		}

		function renderConnManagerRunList(conn, container) {
			const runs = Array.isArray(state.connManagerRunsByConnId[conn.connId])
				? state.connManagerRunsByConnId[conn.connId].slice(0, 3)
				: [];
			const details = document.createElement("details");
			details.className = "conn-manager-run-details";
			const summary = document.createElement("summary");
			summary.className = "conn-manager-run-summary";
			if (runs.length === 0) {
				summary.textContent = "暂无运行记录";
				details.appendChild(summary);
				container.appendChild(details);
				return;
			}

			const latestRun = runs[0];
			summary.textContent =
				"最近执行：" +
				describeConnRunStatusLabel(latestRun.status) +
				" · " +
				formatConnRunTimestamp(latestRun.finishedAt || latestRun.startedAt || latestRun.scheduledAt || "");
			details.appendChild(summary);

			const list = document.createElement("div");
			list.className = "conn-manager-run-list";
			for (const run of runs) {
				const item = document.createElement("div");
				item.className = "conn-manager-run-item";
				const copy = document.createElement("div");
				copy.className = "conn-manager-run-copy";
				const title = document.createElement("code");
				title.textContent = describeConnRunStatusLabel(run.status) + " / " + (run.runId || "");
				const meta = document.createElement("span");
				meta.textContent =
					"计划 " +
					formatConnRunTimestamp(run.scheduledAt) +
					(run.finishedAt ? " · 完成 " + formatConnRunTimestamp(run.finishedAt) : "");
				copy.appendChild(title);
				copy.appendChild(meta);
				const actions = document.createElement("div");
				actions.className = "conn-manager-run-actions";
				const openButton = document.createElement("button");
				openButton.type = "button";
				openButton.textContent = "查看执行过程";
				openButton.addEventListener("click", () => {
					closeConnManager();
					void openConnRunDetails(buildConnRunManagerEntry(conn, run));
				});
				actions.appendChild(openButton);
				item.appendChild(copy);
				item.appendChild(actions);
				list.appendChild(item);
			}
			details.appendChild(list);
			container.appendChild(details);
		}

		function renderConnManager() {
			connManagerList.innerHTML = "";
			setConnManagerNotice(state.connManagerNotice, state.connManagerHighlightedConnId);
			updateConnManagerToolbar();
			const conns = Array.isArray(state.connManagerItems) ? state.connManagerItems : [];
			const visibleConns = getVisibleConnManagerItems();
			if (conns.length === 0) {
				const empty = document.createElement("div");
				empty.className = "asset-empty";
				empty.textContent = "暂无后台任务。点击新建创建一个 conn。";
				connManagerList.appendChild(empty);
				return;
			}
			if (visibleConns.length === 0) {
				const empty = document.createElement("div");
				empty.className = "asset-empty";
				empty.textContent = "当前筛选下没有后台任务。";
				connManagerList.appendChild(empty);
				return;
			}
			const selected = getConnManagerSelectedSet();
			const isBulkAction = state.connManagerActionConnId === "__bulk_delete__";
			for (const conn of visibleConns) {
				const item = document.createElement("article");
				item.className = "conn-manager-item";
				if (state.connManagerHighlightedConnId && conn.connId === state.connManagerHighlightedConnId) {
					item.classList.add("is-highlighted");
				}
				const selectLabel = document.createElement("label");
				selectLabel.className = "conn-manager-select";
				const selectInput = document.createElement("input");
				selectInput.type = "checkbox";
				selectInput.checked = selected.has(conn.connId);
				selectInput.disabled = Boolean(state.connManagerActionConnId);
				selectInput.setAttribute("aria-label", "选择后台任务 " + (conn.title || conn.connId));
				selectInput.addEventListener("change", () => {
					toggleConnManagerSelection(conn, selectInput.checked);
				});
				selectLabel.appendChild(selectInput);
				const main = document.createElement("div");
				main.className = "conn-manager-main";
				const titleRow = document.createElement("div");
				titleRow.className = "conn-manager-title-row";
				const title = document.createElement("strong");
				title.textContent = conn.title || conn.connId || "Conn";
				const status = document.createElement("span");
				status.className = "conn-manager-status " + (conn.status || "unknown");
				status.textContent = describeConnStatusLabel(conn.status);
				titleRow.appendChild(title);
				titleRow.appendChild(status);
				const meta = document.createElement("div");
				meta.className = "conn-manager-meta";
				const targetLine = document.createElement("span");
				targetLine.textContent = "结果发到：";
				const targetCode = document.createElement("code");
				targetCode.textContent = describeConnTargetSummary(conn.target);
				targetLine.appendChild(targetCode);
				const scheduleLine = document.createElement("span");
				scheduleLine.textContent = "执行方式：";
				const scheduleCode = document.createElement("code");
				scheduleCode.textContent = describeConnScheduleSummary(conn.schedule);
				scheduleLine.appendChild(scheduleCode);
				const timeLine = document.createElement("span");
				timeLine.textContent = "运行节奏：" + describeConnTimingSummary(conn);
				meta.appendChild(targetLine);
				meta.appendChild(scheduleLine);
				meta.appendChild(timeLine);
				main.appendChild(titleRow);
				main.appendChild(meta);
				renderConnManagerRunList(conn, main);
				const actions = document.createElement("div");
				actions.className = "conn-manager-actions";
				const isActing = isBulkAction || state.connManagerActionConnId === conn.connId;
				const runButton = createConnActionButton(
					"立即执行",
					() => {
						void runConnNow(conn);
					},
					{ disabled: isActing },
				);
				const editButton = createConnActionButton(
					"编辑",
					() => {
						openConnEditor("edit", conn);
					},
					{ disabled: isActing },
				);
				const toggleButton = createConnActionButton(
					conn.status === "paused" ? "恢复" : "暂停",
					() => {
						void toggleConnPaused(conn);
					},
					{ disabled: isActing || conn.status === "completed" },
				);
				const deleteButton = createConnActionButton(
					"删除",
					() => {
						void deleteConn(conn);
					},
					{ disabled: isActing, className: "danger-action" },
				);
				actions.appendChild(runButton);
				actions.appendChild(editButton);
				actions.appendChild(toggleButton);
				actions.appendChild(deleteButton);
				item.appendChild(selectLabel);
				item.appendChild(main);
				item.appendChild(actions);
				connManagerList.appendChild(item);
			}
		}

		async function runConnNow(conn) {
			if (!conn?.connId || state.connManagerActionConnId) {
				return;
			}
			state.connManagerActionConnId = conn.connId;
			renderConnManager();
			try {
				const response = await fetch("/v1/conns/" + encodeURIComponent(conn.connId) + "/run", {
					method: "POST",
					headers: { accept: "application/json" },
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(payload?.error?.message || payload?.message || "无法创建后台运行");
				}
				prependConnManagerRun(conn.connId, payload?.run);
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "无法创建后台运行";
				showError(messageText);
			} finally {
				state.connManagerActionConnId = "";
				renderConnManager();
			}
		}

		async function toggleConnPaused(conn) {
			if (!conn?.connId || state.connManagerActionConnId || conn.status === "completed") {
				return;
			}
			state.connManagerActionConnId = conn.connId;
			renderConnManager();
			try {
				const response = await fetch(
					"/v1/conns/" + encodeURIComponent(conn.connId) + (conn.status === "paused" ? "/resume" : "/pause"),
					{
						method: "POST",
						headers: { accept: "application/json" },
					},
				);
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(payload?.error?.message || payload?.message || "无法更新后台任务状态");
				}
				if (payload?.conn) {
					updateConnManagerConn(payload.conn);
				}
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "无法更新后台任务状态";
				showError(messageText);
			} finally {
				state.connManagerActionConnId = "";
				renderConnManager();
			}
		}

		async function deleteConn(conn) {
			if (!conn?.connId || state.connManagerActionConnId) {
				return;
			}
			const confirmed = window.confirm(
				"删除会移除这个 conn 和它的 run 历史。\\n\\n" +
					"任务：" +
					(conn.title || conn.connId) +
					"\\n\\n这个操作不能撤销。",
			);
			if (!confirmed) {
				return;
			}
			state.connManagerActionConnId = conn.connId;
			renderConnManager();
			try {
				const response = await fetch("/v1/conns/" + encodeURIComponent(conn.connId), {
					method: "DELETE",
					headers: { accept: "application/json" },
				});
				if (!response.ok && response.status !== 204) {
					const payload = await response.json().catch(() => ({}));
					throw new Error(payload?.error?.message || payload?.message || "无法删除后台任务");
				}
				state.connManagerItems = state.connManagerItems.filter((item) => item?.connId !== conn.connId);
				setConnManagerSelectedIds(state.connManagerSelectedConnIds.filter((connId) => connId !== conn.connId));
				const nextRunsByConnId = { ...state.connManagerRunsByConnId };
				delete nextRunsByConnId[conn.connId];
				state.connManagerRunsByConnId = nextRunsByConnId;
				setConnManagerNotice("已删除：" + (conn.title || conn.connId), "");
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "无法删除后台任务";
				showError(messageText);
			} finally {
				state.connManagerActionConnId = "";
				renderConnManager();
			}
		}

		async function deleteSelectedConns() {
			if (state.connManagerActionConnId) {
				return;
			}
			const selectedIds = Array.isArray(state.connManagerSelectedConnIds)
				? state.connManagerSelectedConnIds.slice()
				: [];
			if (selectedIds.length === 0) {
				return;
			}
			const selectedTitles = state.connManagerItems
				.filter((conn) => selectedIds.includes(conn?.connId))
				.map((conn) => conn.title || conn.connId)
				.slice(0, 6);
			const confirmed = window.confirm(
				"删除会移除所选 conn 和它们的 run 历史。\\n\\n" +
					"数量：" +
					selectedIds.length +
					(selectedTitles.length > 0 ? "\\n任务：" + selectedTitles.join("、") : "") +
					(selectedIds.length > selectedTitles.length ? "\\n另有 " + (selectedIds.length - selectedTitles.length) + " 个任务" : "") +
					"\\n\\n这个操作不能撤销。",
			);
			if (!confirmed) {
				return;
			}
			state.connManagerActionConnId = "__bulk_delete__";
			renderConnManager();
			try {
				const result = await bulkDeleteConns(selectedIds);
				const deletedIds = new Set(result.deletedConnIds);
				state.connManagerItems = state.connManagerItems.filter((conn) => !deletedIds.has(conn?.connId));
				const nextRunsByConnId = { ...state.connManagerRunsByConnId };
				for (const connId of deletedIds) {
					delete nextRunsByConnId[connId];
				}
				state.connManagerRunsByConnId = nextRunsByConnId;
				setConnManagerSelectedIds(state.connManagerSelectedConnIds.filter((connId) => !deletedIds.has(connId)));
				const missingText = result.missingConnIds.length > 0 ? "，" + result.missingConnIds.length + " 个已不存在" : "";
				setConnManagerNotice("已删除 " + result.deletedConnIds.length + " 个后台任务" + missingText, "");
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "无法批量删除后台任务";
				showError(messageText);
			} finally {
				state.connManagerActionConnId = "";
				renderConnManager();
			}
		}

		function appendConnRunDetailRow(section, label, value, options) {
			if (!value) {
				return;
			}
			const row = document.createElement("span");
			row.textContent = label + ": ";
			const node = document.createElement(options?.asCode ? "code" : "strong");
			node.textContent = value;
			row.appendChild(node);
			section.appendChild(row);
		}

		function renderConnRunDetails(entry, detailPayload, eventsPayload) {
			connRunDetailsBody.innerHTML = "";
			const run = detailPayload?.run || {};
			const files = Array.isArray(detailPayload?.files) ? detailPayload.files : [];
			const events = Array.isArray(eventsPayload?.events) ? eventsPayload.events : [];

			const summary = document.createElement("section");
			summary.className = "conn-run-section";
			summary.innerHTML = "<strong></strong><code></code><span></span>";
			summary.querySelector("strong").textContent = entry.title || "Conn run";
			summary.querySelector("code").textContent =
				"conn=" + (entry.sourceId || run.connId || "") + " / run=" + (entry.runId || run.runId || "");
			summary.querySelector("span").textContent =
				"status: " +
				(run.status || "unknown") +
				(run.scheduledAt ? " / scheduled: " + new Date(run.scheduledAt).toLocaleString() : "") +
				(run.finishedAt ? " / finished: " + new Date(run.finishedAt).toLocaleString() : "");
			connRunDetailsBody.appendChild(summary);

			const lifecycle = document.createElement("section");
			lifecycle.className = "conn-run-section";
			const lifecycleHeading = document.createElement("strong");
			lifecycleHeading.textContent = "Lifecycle";
			lifecycle.appendChild(lifecycleHeading);
			appendConnRunDetailRow(lifecycle, "health", resolveConnRunHealthLabel(run, events), { asCode: true });
			appendConnRunDetailRow(lifecycle, "claimed", formatConnRunTimestamp(run.claimedAt));
			appendConnRunDetailRow(lifecycle, "started", formatConnRunTimestamp(run.startedAt));
			appendConnRunDetailRow(lifecycle, "updated", formatConnRunTimestamp(run.updatedAt));
			appendConnRunDetailRow(lifecycle, "lease owner", run.leaseOwner, { asCode: true });
			appendConnRunDetailRow(lifecycle, "lease until", formatConnRunTimestamp(run.leaseUntil));
			if (lifecycle.childElementCount > 1) {
				connRunDetailsBody.appendChild(lifecycle);
			}

			if (run.workspacePath || run.resultSummary || run.errorText) {
				const result = document.createElement("section");
				result.className = "conn-run-section";
				result.innerHTML = "<strong>Result</strong><span></span><code></code>";
				result.querySelector("span").textContent = run.errorText || run.resultSummary || "No result summary yet";
				result.querySelector("code").textContent = run.workspacePath || "";
				connRunDetailsBody.appendChild(result);
			}

			if (files.length > 0) {
				const fileSection = document.createElement("section");
				fileSection.className = "conn-run-section";
				const heading = document.createElement("strong");
				heading.textContent = "Files";
				fileSection.appendChild(heading);
				for (const file of files) {
					const line = document.createElement("code");
					line.textContent = (file.kind || "file") + " / " + (file.relativePath || file.fileName || "");
					fileSection.appendChild(line);
				}
				connRunDetailsBody.appendChild(fileSection);
			}

			const eventSection = document.createElement("section");
			eventSection.className = "conn-run-section";
			const heading = document.createElement("strong");
			heading.textContent = "Events";
			eventSection.appendChild(heading);
			const list = document.createElement("ul");
			list.className = "conn-run-event-list";
			for (const event of events) {
				const item = document.createElement("li");
				item.className = "conn-run-event";
				const title = document.createElement("code");
				title.textContent = "#" + event.seq + " " + event.eventType;
				const meta = document.createElement("span");
				meta.textContent = event.createdAt ? new Date(event.createdAt).toLocaleString() : "";
				const body = document.createElement("span");
				body.textContent = JSON.stringify(event.event || {});
				item.appendChild(title);
				item.appendChild(meta);
				item.appendChild(body);
				list.appendChild(item);
			}
			if (events.length === 0) {
				const empty = document.createElement("span");
				empty.textContent = "No events recorded yet";
				eventSection.appendChild(empty);
			} else {
				eventSection.appendChild(list);
			}
			connRunDetailsBody.appendChild(eventSection);
		}

		async function openConnRunDetails(entry) {
			if (!canOpenConnRunDetails(entry)) {
				return;
			}
			connRunDetailsBody.textContent = "Loading conn run details...";
			connRunDetailsDialog.hidden = false;
			connRunDetailsDialog.classList.add("open");
			connRunDetailsDialog.setAttribute("aria-hidden", "false");
			try {
				const [detailPayload, eventsPayload] = await Promise.all([
					fetchConnRunDetail(entry),
					fetchConnRunEvents(entry),
				]);
				renderConnRunDetails(entry, detailPayload, eventsPayload);
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "Failed to load conn run details";
				connRunDetailsBody.textContent = messageText;
			}
		}

		function createMessageActions(entry, content) {
			const actions = document.createElement("div");
			actions.className = "message-actions";

			const copyButton = document.createElement("button");
			copyButton.type = "button";
			copyButton.className = "message-copy-button";
			copyButton.setAttribute("aria-label", "复制正文");
			copyButton.title = "复制正文";
			const copyLabel = document.createElement("span");
			copyLabel.className = "visually-hidden";
			copyLabel.textContent = "复制正文";
			copyButton.appendChild(copyLabel);
			copyButton.addEventListener("click", async () => {
				const original = copyButton.getAttribute("aria-label") || "复制正文";
				copyButton.disabled = true;
				try {
					await copyTextToClipboard(entry.text || "");
					copyButton.setAttribute("aria-label", "已复制");
					copyButton.title = "已复制";
					copyLabel.textContent = "已复制";
				} catch {
					copyButton.setAttribute("aria-label", "复制失败");
					copyButton.title = "复制失败";
					copyLabel.textContent = "复制失败";
				} finally {
					window.setTimeout(() => {
						copyButton.setAttribute("aria-label", original);
						copyButton.title = original;
						copyLabel.textContent = original;
						syncMessageCopyButton(entry);
					}, 1200);
				}
			});

			actions.appendChild(copyButton);
			if (canOpenConnRunDetails(entry)) {
				const runButton = document.createElement("button");
				runButton.type = "button";
				runButton.className = "conn-run-open-button";
				runButton.setAttribute("aria-label", "查看后台任务过程");
				runButton.title = "查看后台任务过程";
				runButton.textContent = "⌁";
				runButton.addEventListener("click", () => {
					void openConnRunDetails(entry);
				});
				actions.appendChild(runButton);
			}
			return { actions, copyButton };
		}

		function renderTranscriptEntry(entry, insertMode) {
			const card = document.createElement("article");
			const kind = entry.kind;
			const visualKind = kind === "user" ? "user" : "assistant";
			card.className = "message " + visualKind;
			card.dataset.messageKind = kind;
			card.dataset.entryId = entry.id;

			const meta = document.createElement("div");
			meta.className = "message-meta";
			const metaTime = new Date(entry.createdAt || Date.now()).toLocaleTimeString();
			if (kind === "user") {
				meta.innerHTML = "<span>" + metaTime + "</span>";
			} else {
				meta.innerHTML = "<strong>" + entry.title + "</strong><span>" + metaTime + "</span>";
			}

			const body = document.createElement("div");
			body.className = "message-body";

			const content = document.createElement("div");
			content.className = "message-content";
			content.dataset.entryId = entry.id;
			setMessageContent(content, entry.text);
			body.appendChild(content);

			if (entry.attachments?.length || entry.assetRefs?.length) {
				appendMessageFileChips(body, entry.attachments || [], entry.assetRefs || []);
			}
			if (entry.files?.length) {
				appendFileDownloadList(body, entry.files);
			}

			const messageActions = createMessageActions(entry, content);
			card.appendChild(meta);
			card.appendChild(body);
			card.appendChild(messageActions.actions);

			if (insertMode === "prepend" && transcriptCurrent.firstChild) {
				transcriptCurrent.insertBefore(card, transcriptCurrent.firstChild);
			} else {
				transcriptCurrent.appendChild(card);
			}

			const rendered = {
				card,
				body,
				content,
				copyButton: messageActions.copyButton,
				processShell: null,
				processNarration: null,
				processAction: null,
			};
			renderedMessages.set(entry.id, rendered);
			syncMessageCopyButton(entry);
			return rendered;
		}

		function applyProcessViewToRenderedMessage(processView, rendered, options) {
			const process = normalizeProcessView(processView);
			if (!process || !rendered?.body || !rendered?.content) {
				return null;
			}

			let stream;
			if (rendered.processShell?.isConnected && rendered.processNarration && rendered.processAction) {
				stream = {
					shell: rendered.processShell,
					narration: rendered.processNarration,
					action: rendered.processAction,
				};
			} else {
				stream = buildAssistantProcessShell();
				rendered.body.insertBefore(stream.shell, rendered.content);
				rendered.processShell = stream.shell;
				rendered.processNarration = stream.narration;
				rendered.processAction = stream.action;
			}

			stream.narration.innerHTML = "";
			for (const lineText of process.narration) {
				const line = document.createElement("p");
				line.className = "assistant-process-line";
				line.textContent = lineText;
				stream.narration.appendChild(line);
			}
			stream.narration.scrollTop = stream.narration.scrollHeight;
			stream.action.textContent = process.currentAction || "等待动作";
			stream.shell.classList.remove("tool", "ok", "error", "warn", "system", "is-running", "is-complete");
			stream.shell.classList.add(process.kind || "system");
			stream.shell.classList.add(options?.running || !process.isComplete ? "is-running" : "is-complete");

			if (options?.activate) {
				state.activeProcessShell = stream.shell;
				state.activeProcessNarration = stream.narration;
				state.activeProcessAction = stream.action;
				state.lastProcessNarration = process.narration.at(-1) || "";
			}

			return stream;
		}

		function syncHistoryLoadMoreButton() {
			const hasMore = state.renderedHistoryCount < state.conversationHistory.length;
			historyLoadMoreButton.hidden = !hasMore;
			historyLoadMoreButton.disabled = state.historyLoadingMore;
		}

		function renderMoreConversationHistory() {
			if (state.historyLoadingMore) {
				return;
			}

			const remaining = state.conversationHistory.length - state.renderedHistoryCount;
			if (remaining <= 0) {
				syncHistoryLoadMoreButton();
				return;
			}

			state.historyLoadingMore = true;
			const previousHeight = transcript.scrollHeight;
			const nextCount = Math.min(state.historyPageSize, remaining);
			const startIndex = Math.max(0, state.conversationHistory.length - state.renderedHistoryCount - nextCount);
			const slice = state.conversationHistory.slice(startIndex, startIndex + nextCount);

			for (const entry of slice.slice().reverse()) {
				renderTranscriptEntry(entry, "prepend");
			}

			state.renderedHistoryCount += slice.length;
			const heightDelta = transcript.scrollHeight - previousHeight;
			if (heightDelta > 0) {
				transcript.scrollTop += heightDelta;
			}
			state.historyLoadingMore = false;
			syncHistoryLoadMoreButton();
		}

		function restoreConversationHistory(conversationId) {
			state.conversationHistory = loadConversationHistoryEntries(conversationId);
			state.renderedHistoryCount = 0;
			clearRenderedTranscript();

			if (state.conversationHistory.length === 0) {
				setTranscriptState("idle");
				syncHistoryLoadMoreButton();
				return;
			}

			setTranscriptState("active");
			renderMoreConversationHistory();
			scrollTranscriptToBottom({ force: true });
		}

		async function restoreConversationHistoryFromServer(conversationId) {
			const nextConversationId = String(conversationId || "").trim();
			if (!nextConversationId) {
				return;
			}

			try {
				const payload = await fetchConversationState(nextConversationId);
				renderConversationState(payload);
				scheduleConversationHistoryPersist(nextConversationId);
			} catch (error) {
				if (state.conversationHistory.length === 0) {
					const messageText = error instanceof Error ? error.message : "无法获取全局对话历史";
					showError(messageText);
				}
			}
		}

		function handleTranscriptScroll() {
			syncTranscriptFollowState();
			if (transcript.scrollTop <= 5 && !state.historyLoadingMore) {
				renderMoreConversationHistory();
			}
		}

		function formatFileSize(size) {
			if (!Number.isFinite(size)) {
				return "unknown";
			}
			if (size < 1024) {
				return size + " B";
			}
			if (size < 1024 * 1024) {
				return (size / 1024).toFixed(1) + " KB";
			}
			return (size / (1024 * 1024)).toFixed(1) + " MB";
		}

		function isTextLikeFile(file) {
			return (
				file.type.startsWith("text/") ||
				/\\.(txt|md|markdown|json|csv|tsv|log|xml|html|css|js|ts|tsx|jsx|py|java|go|rs|c|cpp|h|hpp|cs|php|rb|yml|yaml|toml|ini|sql)$/i.test(file.name)
			);
		}

		function readFileAsText(file) {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
				reader.onerror = () => reject(reader.error || new Error("file read failed"));
				reader.readAsText(file);
			});
		}

		function readFileAsArrayBuffer(file) {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result instanceof ArrayBuffer ? reader.result : new ArrayBuffer(0));
				reader.onerror = () => reject(reader.error || new Error("file read failed"));
				reader.readAsArrayBuffer(file);
			});
		}

		function arrayBufferToBase64(buffer) {
			const bytes = new Uint8Array(buffer);
			let binary = "";
			for (let index = 0; index < bytes.length; index += 1) {
				binary += String.fromCharCode(bytes[index]);
			}
			return btoa(binary);
		}

		async function collectAttachments(files) {
			const selected = Array.from(files || []).slice(0, 5);
			const attachments = [];

			for (const file of selected) {
				const attachment = {
					fileName: file.name,
					mimeType: file.type || "application/octet-stream",
					sizeBytes: file.size,
				};
				if (isTextLikeFile(file) && file.size <= 512 * 1024) {
					attachment.text = await readFileAsText(file);
				} else if (file.size <= 2 * 1024 * 1024) {
					attachment.base64 = arrayBufferToBase64(await readFileAsArrayBuffer(file));
				}
				attachments.push(attachment);
			}

			return attachments;
		}

		function renderAttachmentList() {
			fileList.innerHTML = "";
			for (const [index, attachment] of state.pendingAttachments.entries()) {
				const item = createFileChip({
					tone: "pending",
					fileName: attachment.fileName,
					meta:
						(attachment.mimeType || "application/octet-stream") +
						" / " +
						formatFileSize(attachment.sizeBytes),
					onRemove: () => {
						removePendingAttachment(index);
					},
				});
				fileList.appendChild(item);
			}
			renderContextUsageBar();
		}

		function getSelectedAssets() {
			return state.selectedAssetRefs
				.map((assetId) => state.recentAssets.find((asset) => asset.assetId === assetId))
				.filter(Boolean);
		}

		function renderSelectedAssets() {
			selectedAssetList.innerHTML = "";
			const selectedAssets = getSelectedAssets();
			selectedAssetsSection.classList.toggle("visible", selectedAssets.length > 0);
			if (selectedAssets.length === 0) {
				renderContextUsageBar();
				return;
			}

			for (const asset of selectedAssets) {
				const item = createFileChip({
					tone: "asset",
					fileName: asset.fileName,
					meta:
						(asset.kind || "metadata") +
						" / " +
						(asset.mimeType || "application/octet-stream") +
						" / " +
						formatFileSize(asset.sizeBytes),
					onRemove: () => {
						removeSelectedAsset(asset.assetId);
					},
				});
				selectedAssetList.appendChild(item);
			}
			renderContextUsageBar();
		}

		function deriveFileBadge(fileName, fallback) {
			const label = String(fileName || "").trim();
			const extensionMatch = label.match(/\.([a-z0-9]{1,5})$/i);
			if (extensionMatch) {
				return extensionMatch[1].slice(0, 3).toUpperCase();
			}

			const fallbackText = String(fallback || "").trim().toLowerCase();
			if (fallbackText.startsWith("text/")) {
				return "TXT";
			}
			if (fallbackText.includes("markdown")) {
				return "MD";
			}
			if (fallbackText.includes("json")) {
				return "JSN";
			}
			if (fallbackText.includes("image/")) {
				return "IMG";
			}

			return "FILE";
		}

		function createFileChip({ tone, fileName, meta, onRemove }) {
			const item = document.createElement("div");
			item.className = "file-chip " + (tone || "pending");
			item.title = String(meta || "");

			const badge = document.createElement("span");
			badge.className = "file-chip-badge";
			badge.textContent = deriveFileBadge(fileName, meta);

			const label = document.createElement("span");
			label.className = "file-chip-label";
			label.textContent = fileName || "untitled";

			item.appendChild(badge);
			item.appendChild(label);
			if (typeof onRemove === "function") {
				const removeButton = document.createElement("button");
				removeButton.type = "button";
				removeButton.className = "file-chip-remove";
				removeButton.textContent = "×";
				removeButton.setAttribute("aria-label", "移除 " + (fileName || "文件"));
				removeButton.addEventListener("click", () => {
					onRemove();
				});
				item.appendChild(removeButton);
			}
			return item;
		}

		function getReferencedAssets(assetRefs) {
			return assetRefs
				.map((asset) =>
					typeof asset === "string" ? state.recentAssets.find((current) => current.assetId === asset) : asset,
				)
				.filter(Boolean);
		}

		function appendMessageFileChips(body, attachments, assetRefs) {
			const normalizedAttachments = Array.isArray(attachments) ? attachments : [];
			const referencedAssets = getReferencedAssets(Array.isArray(assetRefs) ? assetRefs : []);
			if (normalizedAttachments.length === 0 && referencedAssets.length === 0) {
				return;
			}

			const strip = document.createElement("div");
			strip.className = "message-file-strip";

			for (const attachment of normalizedAttachments) {
				strip.appendChild(
					createFileChip({
						tone: "pending",
						fileName: attachment.fileName,
						meta:
							(attachment.mimeType || "application/octet-stream") +
							" / " +
							formatFileSize(attachment.sizeBytes),
					}),
				);
			}

			for (const asset of referencedAssets) {
				strip.appendChild(
					createFileChip({
						tone: "asset",
						fileName: asset.fileName,
						meta:
							(asset.kind || "metadata") +
							" / " +
							(asset.mimeType || "application/octet-stream") +
							" / " +
							formatFileSize(asset.sizeBytes),
					}),
				);
			}

			body.classList.add("has-file-chips");
			body.appendChild(strip);
		}

		function appendUserTranscriptMessage(message, attachments, assetRefs) {
			return appendTranscriptMessage("user", state.conversationId, message, {
				attachments,
				assetRefs,
				forceScroll: true,
			});
		}

		function appendFileDownloadList(container, files) {
			if (!Array.isArray(files) || files.length === 0) {
				return;
			}

			const downloads = document.createElement("div");
			downloads.className = "file-downloads";

			for (const file of files) {
				const item = document.createElement("div");
				item.className = "file-download";
				item.innerHTML = "<div><strong></strong><span></span></div><div class=\\"file-download-actions\\"></div>";
				item.querySelector("strong").textContent = file.fileName || "download";
				item.querySelector("span").textContent =
					(file.mimeType || "application/octet-stream") + " / " + formatFileSize(file.sizeBytes);
				const actions = item.querySelector(".file-download-actions");
				if (canPreviewFile(file.mimeType)) {
					const openLink = document.createElement("a");
					openLink.href = file.downloadUrl;
					openLink.target = "_blank";
					openLink.rel = "noreferrer noopener";
					openLink.textContent = "打开";
					actions.appendChild(openLink);
				}

				const link = document.createElement("a");
				link.href = buildDownloadUrl(file.downloadUrl);
				link.download = file.fileName || "";
				link.textContent = "下载";
				actions.appendChild(link);
				downloads.appendChild(item);
			}

			container.appendChild(downloads);
		}

		function canPreviewFile(mimeType) {
			const normalized = String(mimeType || "").trim().toLowerCase();
			return (
				normalized.startsWith("image/png") ||
				normalized.startsWith("image/jpeg") ||
				normalized.startsWith("image/gif") ||
				normalized.startsWith("image/webp") ||
				normalized === "application/pdf" ||
				normalized === "text/plain" ||
				normalized === "text/markdown" ||
				normalized === "application/json" ||
				normalized === "text/csv"
			);
		}

		function buildDownloadUrl(downloadUrl) {
			const normalized = String(downloadUrl || "");
			if (!normalized) {
				return "";
			}
			return normalized.includes("?") ? normalized + "&download=1" : normalized + "?download=1";
		}

		function renderAssetPickerList() {
			assetModalList.innerHTML = "";
			if (!Array.isArray(state.recentAssets) || state.recentAssets.length === 0) {
				const empty = document.createElement("div");
				empty.className = "asset-empty";
				empty.textContent = "暂无可复用资产，先上传文件或让助手生成文件。";
				assetModalList.appendChild(empty);
				return;
			}

			for (const asset of state.recentAssets) {
				const item = document.createElement("div");
				item.className = "asset-pill" + (state.selectedAssetRefs.includes(asset.assetId) ? " active" : "");
				item.innerHTML = "<div><strong></strong><span></span></div><button type=\\"button\\"></button>";
				item.querySelector("strong").textContent = asset.fileName;
				item.querySelector("span").textContent =
					(asset.kind || "metadata") +
					" / " +
					(asset.mimeType || "application/octet-stream") +
					" / " +
					formatFileSize(asset.sizeBytes) +
					" / " +
					asset.assetId.slice(0, 12);
				const toggleButton = item.querySelector("button");
				toggleButton.textContent = state.selectedAssetRefs.includes(asset.assetId) ? "已选" : "复用";
				toggleButton.disabled = state.selectedAssetRefs.includes(asset.assetId);
				toggleButton.addEventListener("click", () => {
					selectAssetForReuse(asset.assetId);
				});
				assetModalList.appendChild(item);
			}
		}

		function clearSelectedFiles() {
			state.pendingAttachments = [];
			fileInput.value = "";
			renderAttachmentList();
		}

		function removePendingAttachment(indexToRemove) {
			state.pendingAttachments = state.pendingAttachments.filter((_, index) => index !== indexToRemove);
			if (state.pendingAttachments.length === 0) {
				fileInput.value = "";
			}
			renderAttachmentList();
		}

		function openAssetLibrary() {
			state.assetModalOpen = true;
			assetModal.hidden = false;
			assetModal.classList.add("open");
			assetModal.setAttribute("aria-hidden", "false");
			renderAssetPickerList();
		}

		function closeAssetLibrary() {
			state.assetModalOpen = false;
			assetModal.classList.remove("open");
			assetModal.hidden = true;
			assetModal.setAttribute("aria-hidden", "true");
		}

		function selectAssetForReuse(assetId) {
			if (!state.selectedAssetRefs.includes(assetId)) {
				state.selectedAssetRefs = [...state.selectedAssetRefs, assetId];
			}
			renderSelectedAssets();
			renderAssetPickerList();
			closeAssetLibrary();
		}

		function clearSelectedAssetRefs() {
			state.selectedAssetRefs = [];
			renderSelectedAssets();
			renderAssetPickerList();
		}

		function createComposerDraft() {
			return {
				message: messageInput.value,
				attachments: [...state.pendingAttachments],
				assetRefs: [...state.selectedAssetRefs],
			};
		}

		function clearComposerDraft() {
			messageInput.value = "";
			syncComposerTextareaHeight();
			clearSelectedFiles();
			clearSelectedAssetRefs();
		}

		function restoreComposerDraft(draft) {
			messageInput.value = String(draft?.message || "");
			syncComposerTextareaHeight();
			state.pendingAttachments = Array.isArray(draft?.attachments) ? [...draft.attachments] : [];
			state.selectedAssetRefs = Array.isArray(draft?.assetRefs) ? [...draft.assetRefs] : [];
			renderAttachmentList();
			renderSelectedAssets();
			renderAssetPickerList();
			messageInput.focus();
		}

		function removeSelectedAsset(assetId) {
			state.selectedAssetRefs = state.selectedAssetRefs.filter((currentId) => currentId !== assetId);
			renderSelectedAssets();
			renderAssetPickerList();
		}

		function isInterruptIntentMessage(message) {
			const normalized = String(message || "")
				.toLowerCase()
				.replace(/[\\s，。、“”"'‘’！!？?、,.]/g, "")
				.trim();
			return [
				"停",
				"停止",
				"先停",
				"停下",
				"别做了",
				"不要做了",
				"先不要做了",
				"取消",
				"中止",
				"打断",
				"stop",
				"cancel",
				"abort",
			].includes(normalized);
		}

		function describeNode(node) {
			if (!(node instanceof Element)) {
				return "unknown";
			}
			if (node.id) {
				return "#" + node.id;
			}
			if (typeof node.className === "string" && node.className.trim()) {
				return node.tagName.toLowerCase() + "." + node.className.trim().replace(/\\s+/g, ".");
			}
			return node.tagName.toLowerCase();
		}

		function pushDragDebug() {
			return;
		}

		function showGlobalDropHint() {
			dragOverlay.classList.add("active");
			chatStage.classList.add("drag-active");
			composerDropTarget.classList.add("drag-active");
			dropZone.classList.add("drag-active");
		}

		function hideGlobalDropHint() {
			dragOverlay.classList.remove("active");
			chatStage.classList.remove("drag-active");
			composerDropTarget.classList.remove("drag-active");
			dropZone.classList.remove("drag-active");
			state.dragDepth = 0;
		}

		function formatMessageWithContext(message, attachments, assetRefs) {
			const sections = [message];
			if (attachments.length) {
				sections.push("", "\\u9644\\u4ef6:", ...attachments.map((attachment) => "- " + attachment.fileName + " (" + formatFileSize(attachment.sizeBytes) + ")"));
			}
			if (assetRefs.length) {
				sections.push(
					"",
					"\\u5f15\\u7528\\u8d44\\u4ea7:",
					...assetRefs
						.map((assetId) => state.recentAssets.find((asset) => asset.assetId === assetId))
						.filter(Boolean)
						.map((asset) => "- " + asset.fileName + " [" + asset.assetId.slice(0, 12) + "]"),
				);
			}
			return sections.join("\\n");
		}

		function formatOutboundSummary(message, attachments, assetRefs) {
			const sections = [];
			const normalizedMessage = String(message || "").trim();
			if (normalizedMessage) {
				sections.push(normalizedMessage);
			}
			if (attachments.length) {
				sections.push("附件 " + attachments.length + " 个");
			}
			if (assetRefs.length) {
				sections.push("引用资产 " + assetRefs.length + " 个");
			}
			return sections.join("\\n");
		}

		function mergeRecentAssets(nextAssets) {
			if (!Array.isArray(nextAssets) || nextAssets.length === 0) {
				return;
			}
			const byId = new Map();
			for (const asset of [...nextAssets, ...state.recentAssets]) {
				if (asset && typeof asset.assetId === "string" && !byId.has(asset.assetId)) {
					byId.set(asset.assetId, asset);
				}
			}
			state.recentAssets = [...byId.values()];
			renderSelectedAssets();
			renderAssetPickerList();
		}

		async function loadAssets(silent) {
			if (!silent) {
				clearError();
				appendProcessEvent("system", "\\u8d44\\u4ea7\\u6e05\\u5355", "请求 /v1/assets");
			}
			refreshAssetsButton.disabled = true;

			try {
				const response = await fetch("/v1/assets?limit=40", {
					method: "GET",
					headers: { "accept": "application/json" },
				});
				if (!response.ok) {
					const body = await response.json().catch(() => ({}));
					const errorMessage = body?.error?.message || body?.message || "\\u52a0\\u8f7d\\u8d44\\u4ea7\\u5931\\u8d25";
					if (!silent) {
						showError(errorMessage);
						appendProcessEvent("error", "\\u8d44\\u4ea7\\u6e05\\u5355\\u5931\\u8d25", errorMessage);
					}
					return;
				}

				const payload = await response.json();
				state.recentAssets = Array.isArray(payload?.assets) ? payload.assets : [];
				state.selectedAssetRefs = state.selectedAssetRefs.filter((assetId) =>
					state.recentAssets.some((asset) => asset.assetId === assetId),
				);
				renderSelectedAssets();
				renderAssetPickerList();
				if (!silent) {
					appendProcessEvent("ok", "\\u8d44\\u4ea7\\u6e05\\u5355\\u5df2\\u52a0\\u8f7d", String(state.recentAssets.length));
				}
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "\\u52a0\\u8f7d\\u8d44\\u4ea7\\u5931\\u8d25";
				if (!silent) {
					showError(messageText);
					appendProcessEvent("error", "\\u8d44\\u4ea7\\u6e05\\u5355\\u5931\\u8d25", messageText);
				}
			} finally {
				refreshAssetsButton.disabled = state.loading;
			}
		}

		function appendFileDownloads(files) {
			if (!Array.isArray(files) || files.length === 0) {
				return;
			}
			appendTranscriptMessage("system", "\\u6587\\u4ef6", "\\u52a9\\u624b\\u5df2\\u53d1\\u9001 " + files.length + " \\u4e2a\\u6587\\u4ef6", {
				files,
			});
		}

		function appendTranscriptMessage(kind, title, text, options) {
			setTranscriptState("active");
			const entry = buildTranscriptEntry(kind, title, text, options);
			rememberConversationMessage(entry);
			const rendered = renderTranscriptEntry(entry, options?.insertMode);
			state.renderedHistoryCount = Math.min(state.conversationHistory.length, state.renderedHistoryCount + 1);
			syncHistoryLoadMoreButton();
			scrollTranscriptToBottom({ force: options?.forceScroll === true });
			return rendered.content;
		}

		function setMessageContent(content, text) {
			const nextText = String(text || "");
			const entryId = content.dataset.entryId;
			if (entryId) {
				const historyEntry = state.conversationHistory.find((entry) => entry.id === entryId);
				if (historyEntry) {
					historyEntry.text = nextText;
					rememberConversationMessage(historyEntry);
					syncMessageCopyButton(historyEntry);
				}
			}
			if (nextText.trim()) {
				content.innerHTML = renderMessageMarkdown(nextText);
				content.classList.remove("is-empty");
				hydrateMarkdownContent(content);
				return;
			}

			content.innerHTML = "";
			content.classList.add("is-empty");
		}

		function appendAssistantProcessMessage(title, text) {
			setTranscriptState("active");
			const entry = buildTranscriptEntry("assistant", title, text);
			rememberConversationMessage(entry);
			const rendered = renderTranscriptEntry(entry);
			state.renderedHistoryCount = Math.min(state.conversationHistory.length, state.renderedHistoryCount + 1);
			syncHistoryLoadMoreButton();
			const stream = buildAssistantProcessShell();
			rendered.body.insertBefore(stream.shell, rendered.content);
			attachAssistantLoadingBubble(rendered.body, rendered.content);
			scrollTranscriptToBottom();

			return {
				entry,
				content: rendered.content,
				shell: stream.shell,
				narration: stream.narration,
				action: stream.action,
			};
		}

		function buildAssistantProcessShell() {
			const shell = document.createElement("section");
			shell.className = "assistant-process-shell is-running system";
			shell.dataset.processExpanded = "true";

			const head = document.createElement("div");
			head.className = "assistant-process-head";

			const title = document.createElement("strong");
			title.textContent = "思考过程";

			const toggle = document.createElement("button");
			toggle.type = "button";
			toggle.className = "assistant-process-toggle";
			toggle.textContent = "收起";
			toggle.setAttribute("aria-expanded", "true");

			const body = document.createElement("div");
			body.className = "assistant-process-body";

			const narration = document.createElement("div");
			narration.className = "assistant-process-narration";

			const current = document.createElement("div");
			current.className = "assistant-process-current";

			const label = document.createElement("span");
			label.className = "assistant-process-current-label";
			label.textContent = "当前动作";

			const action = document.createElement("pre");
			action.className = "assistant-process-current-action";
			action.textContent = "等待动作";

			toggle.addEventListener("click", () => {
				const nextExpanded = shell.dataset.processExpanded !== "true";
				shell.dataset.processExpanded = nextExpanded ? "true" : "false";
				toggle.textContent = nextExpanded ? "收起" : "展开";
				toggle.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
				if (nextExpanded) {
					narration.scrollTop = narration.scrollHeight;
				}
				scrollTranscriptToBottom();
			});

			current.appendChild(label);
			current.appendChild(action);
			head.appendChild(title);
			head.appendChild(toggle);
			body.appendChild(narration);
			body.appendChild(current);
			shell.appendChild(head);
			shell.appendChild(body);

			return { shell, narration, action };
		}

		function attachAssistantProcessShell(body, content) {
			const stream = buildAssistantProcessShell();
			const processShell = stream.shell;
			if (content.parentElement === body) {
				body.insertBefore(processShell, content);
			} else {
				body.appendChild(processShell);
			}

			state.activeProcessShell = processShell;
			state.activeProcessNarration = stream.narration;
			state.activeProcessAction = stream.action;
			state.lastProcessNarration = "";

			return stream;
		}

		function ensureProcessStreamCard() {
			if (state.activeProcessNarration && state.activeProcessAction && state.activeProcessShell) {
				return {
					shell: state.activeProcessShell,
					narration: state.activeProcessNarration,
					action: state.activeProcessAction,
				};
			}

			const content = ensureStreamingAssistantMessage();
			const body = content.parentElement;
			if (!body) {
				throw new Error("assistant message body is unavailable");
			}

			return attachAssistantProcessShell(body, content);
		}

		function completeProcessStream() {
			if (!state.activeProcessShell) {
				return;
			}
			completeAssistantProcessShell({
				shell: state.activeProcessShell,
				narration: state.activeProcessNarration,
				action: state.activeProcessAction,
			});
		}

		function appendProcessNarrationLine(text) {
			const lineText = String(text || "").trim();
			if (!lineText || lineText === state.lastProcessNarration) {
				return;
			}

			const stream = ensureProcessStreamCard();
			appendNarrationToAssistantProcess(stream, lineText);
			state.lastProcessNarration = lineText;
		}

		function setProcessCurrentAction(text, kind) {
			const actionText = String(text || "").trim() || "等待动作";
			const stream = ensureProcessStreamCard();
			setAssistantProcessAction(stream, actionText, kind);
		}

		function appendNarrationToAssistantProcess(stream, text) {
			if (!stream?.narration) {
				return;
			}

			const line = document.createElement("p");
			line.className = "assistant-process-line";
			line.textContent = text;
			stream.narration.appendChild(line);
			stream.narration.scrollTop = stream.narration.scrollHeight;
			scrollTranscriptToBottom();
		}

		function setAssistantProcessAction(stream, text, kind) {
			if (!stream?.shell || !stream?.action) {
				return;
			}

			stream.action.textContent = String(text || "").trim() || "等待动作";
			stream.shell.classList.remove("tool", "ok", "error", "warn", "system");
			stream.shell.classList.add(kind || "system");
			scrollTranscriptToBottom();
		}

		function completeAssistantProcessShell(stream, kind) {
			if (!stream?.shell) {
				return;
			}

			if (kind) {
				stream.shell.classList.remove("tool", "ok", "error", "warn", "system");
				stream.shell.classList.add(kind);
			}
			stream.shell.classList.remove("is-running");
			stream.shell.classList.add("is-complete");
			scrollTranscriptToBottom();
		}

		async function copyTextToClipboard(text) {
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(text);
				return;
			}

			const textarea = document.createElement("textarea");
			textarea.value = text;
			textarea.setAttribute("readonly", "");
			textarea.style.position = "fixed";
			textarea.style.left = "-9999px";
			document.body.appendChild(textarea);
			textarea.select();

			try {
				document.execCommand("copy");
			} finally {
				textarea.remove();
			}
		}

		function hydrateMarkdownContent(root) {
			root.querySelectorAll("table").forEach((table) => {
				if (table.closest(".markdown-table-scroll")) {
					return;
				}

				const wrapper = document.createElement("div");
				wrapper.className = "markdown-table-scroll";
				table.parentNode?.insertBefore(wrapper, table);
				wrapper.appendChild(table);
			});

			root.querySelectorAll("pre").forEach((pre) => {
				if (pre.closest(".code-block")) {
					return;
				}

				const code = pre.querySelector("code");
				const languageClass = code
					? Array.from(code.classList).find((className) => className.startsWith("language-"))
					: "";
				const language = languageClass ? languageClass.replace("language-", "") : "code";

				const wrapper = document.createElement("div");
				wrapper.className = "code-block";

				const toolbar = document.createElement("div");
				toolbar.className = "code-block-toolbar";

				const label = document.createElement("span");
				label.className = "code-block-language";
				label.textContent = language || "代码";

				const copyButton = document.createElement("button");
				copyButton.type = "button";
				copyButton.className = "copy-code-button";
				copyButton.textContent = "复制";
				copyButton.addEventListener("click", async () => {
					const original = copyButton.textContent || "复制";
					copyButton.disabled = true;

					try {
						await copyTextToClipboard(code?.textContent || pre.textContent || "");
						copyButton.textContent = "已复制";
					} catch {
						copyButton.textContent = "失败";
					} finally {
						window.setTimeout(() => {
							copyButton.textContent = original;
							copyButton.disabled = false;
						}, 1200);
					}
				});

				toolbar.appendChild(label);
				toolbar.appendChild(copyButton);
				pre.parentNode?.insertBefore(wrapper, pre);
				wrapper.appendChild(toolbar);
				wrapper.appendChild(pre);
			});
		}

		function summarizeDetail(detail) {
			const normalized = String(detail || "").trim();
			if (!normalized) {
				return {
					summary: "无详情",
					detail: "",
					expandable: false,
				};
			}

			const compact = normalized.replace(/\\s+/g, " ");
			const expandable = normalized.includes("\\n") || compact.length > 140;
			const summary = expandable ? compact.slice(0, 140) + "..." : normalized;

			return {
				summary,
				detail: normalized,
				expandable,
			};
		}

		function formatProcessAction(title, detail) {
			const normalized = String(detail || "").trim();
			return normalized ? title + " · " + normalized : title;
		}

		function formatSkillsReply(skills) {
			const skillList = Array.isArray(skills) ? skills : [];
			const skillCount = skillList.length;
			if (skillCount === 0) {
				return [
					"我查过运行时技能接口了。",
					"",
					"当前没有拿到可用技能。",
					"接口 /v1/debug/skills 已返回，但结果为空。",
				].join("\\n");
			}

			return [
				"我已经查到当前运行时技能状态。",
				"",
				"当前共加载 " + skillCount + " 个技能。",
				"接口 /v1/debug/skills 返回正常。",
				"",
				...skillList.map((skill, index) => {
					const label = skill && typeof skill.name === "string" ? skill.name : "unknown-skill";
					return (index + 1) + ". " + label;
				}),
			].join("\\n");
		}

		function describeProcessNarration(kind, title, detail) {
			const normalized = String(detail || "").trim();
			const detailSummary = summarizeDetail(detail).summary;
			if (title === "请求已发送") {
				return "我先理解这条请求，再决定接下来用什么方式处理。";
			}
			if (title === "消息已追加") {
				return "我已经收到你的补充要求，会在当前步骤结束后按新方向继续。";
			}
			if (title === "请求打断") {
				return "我收到停止信号，正在尝试中断当前任务。";
			}
			if (title === "检测到停止意图") {
				return "我识别到你要停下当前任务，所以先发起打断。";
			}
			if (title === "任务开始") {
				return "我开始处理这条请求，先确认上下文和可用工具。";
			}
			if (title === "工具开始") {
				const toolName = normalized.split(/\\s+/)[1] || "工具";
				return "我现在尝试调用 " + toolName + "，看看能不能拿到需要的信息。";
			}
			if (title === "工具更新") {
				return detailSummary && detailSummary !== "无详情"
					? "我拿到了新的执行片段，当前看到的是：" + detailSummary
					: "我拿到了新的执行片段，继续沿着这条线往下推进。";
			}
			if (title === "工具结束") {
				return kind === "error"
					? "这一步没有完全走通，我换个角度继续。"
					: detailSummary && detailSummary !== "无详情"
						? "这一步已经完成，当前结果是：" + detailSummary
						: "这一步已经完成，我开始整理下一步。";
			}
			if (title === "队列更新") {
				return normalized.includes("转向消息: 0")
					? "我收到了一条排队补充，等当前步骤结束后继续处理。"
					: "我收到新的转向要求，当前步骤结束后就会切过去。";
			}
			if (title === "任务完成") {
				return "过程已经走完，下面开始整理最终答复。";
			}
			if (title === "任务已打断") {
				return "当前任务已经停下来了，我先把执行状态收住。";
			}
			if (title === "任务错误") {
				return "这次执行遇到了问题，我把错误保留下来方便你判断。";
			}
			if (title === "请求被拒绝" || title === "网络错误" || title === "流被中断") {
				return "这次请求没有顺利走完，我先把失败原因告诉你。";
			}

			return detailSummary && detailSummary !== "无详情" ? title + "，" + detailSummary : title;
		}

		function appendProcessEvent(kind, title, detail) {
			const summaryBlock = summarizeDetail(detail);
			setTranscriptState("active");
			const note = document.createElement("div");
			note.className = "process-note " + kind;

			const text = document.createElement("p");
			text.className = "process-note-text";
			text.textContent = summaryBlock.summary && summaryBlock.summary !== "无详情" ? title + " · " + summaryBlock.summary : title;
			if (summaryBlock.detail && summaryBlock.detail !== summaryBlock.summary) {
				text.title = summaryBlock.detail;
			}

			note.appendChild(text);
			transcript.appendChild(note);
			scrollTranscriptToBottom();
		}

		function updateStreamingProcess(kind, title, detail) {
			appendProcessNarrationLine(describeProcessNarration(kind, title, detail));
			setProcessCurrentAction(formatProcessAction(title, detail), kind);
		}

		function ensureStreamingAssistantMessage() {
			if (!state.activeAssistantContent) {
				state.activeAssistantContent = appendTranscriptMessage("assistant", "助手", "");
			}
			return state.activeAssistantContent;
		}

		function resetStreamingState() {
			state.streamingText = "";
			state.activeAssistantContent = null;
			state.activeLoadingShell = null;
			state.activeLoadingLabel = null;
			state.activeLoadingDots = null;
			state.activeProcessShell = null;
			state.activeProcessNarration = null;
			state.activeProcessAction = null;
			state.lastProcessNarration = "";
			state.receivedDoneEvent = false;
		}

		async function startNewConversation() {
			clearError();
			if (state.loading) {
				showError("当前任务未结束，不能开启新产线");
				return false;
			}

			let createResult;
			try {
				createResult = await createConversationOnServer();
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "无法开启新会话";
				showError(messageText);
				return false;
			}

			if (!createResult?.created) {
				if (createResult?.reason === "running") {
					showError("当前任务未结束，不能开启新产线");
				} else {
					showError("无法开启新会话");
				}
				return false;
			}

			const nextConversationId = createResult.currentConversationId || createResult.conversationId;
			clearSelectedFiles();
			clearSelectedAssetRefs();
			setStageMode("landing");
			await syncConversationCatalog({
				silent: true,
				activateCurrent: false,
			});
			await activateConversation(nextConversationId, {
				skipCatalogSync: true,
				skipServerSwitch: true,
			});
			return true;
		}

		function describeToolEvent(event, prefix) {
			const payload = event.args || event.partialResult || event.result || "";
			return prefix + " " + event.toolName + (payload ? "\\n" + payload : "");
		}

		function handleStreamEvent(event) {
			switch (event.type) {
				case "run_started":
					ensureStreamingAssistantMessage();
					setAssistantLoadingState("正在接手任务", "system");
					updateStreamingProcess("system", "任务开始", event.conversationId);
					statusPill.textContent = "运行中";
					void syncContextUsage(event.conversationId, { silent: true });
					break;
				case "tool_started":
					setAssistantLoadingState("正在调用工具", "tool");
					updateStreamingProcess("tool", "工具开始", describeToolEvent(event, "调用"));
					break;
				case "tool_updated":
					setAssistantLoadingState("正在等待工具返回", "tool");
					updateStreamingProcess("tool", "工具更新", describeToolEvent(event, "片段"));
					break;
				case "tool_finished":
					setAssistantLoadingState(event.isError ? "工具步骤失败" : "工具步骤已完成", event.isError ? "error" : "system");
					updateStreamingProcess(
						event.isError ? "error" : "ok",
						"工具结束",
						describeToolEvent(event, event.isError ? "失败" : "完成"),
					);
					break;
				case "queue_updated":
					setAssistantLoadingState("正在等待当前步骤收尾", "system");
					updateStreamingProcess(
						"system",
						"队列更新",
						"转向消息: " + event.steering.length + "\\n追加消息: " + event.followUp.length,
					);
					break;
				case "interrupted":
					updateStreamingProcess("system", "任务已打断", event.conversationId);
					completeAssistantLoadingBubble("warn", "本轮已中断");
					completeProcessStream();
					setLoading(false);
					statusPill.textContent = "已打断";
					void syncContextUsage(event.conversationId, { silent: true });
					void restoreConversationHistoryFromServer(event.conversationId);
					break;
				case "text_delta": {
					state.streamingText += event.textDelta;
					const content = ensureStreamingAssistantMessage();
					setAssistantLoadingState("正在生成回复", "system");
					setMessageContent(content, state.streamingText);
					scrollTranscriptToBottom();
					break;
				}
				case "done": {
					state.receivedDoneEvent = true;
					sessionFile.textContent = event.sessionFile || "不可用";
					if (typeof event.text === "string" && event.text !== state.streamingText) {
						const content = ensureStreamingAssistantMessage();
						setMessageContent(content, event.text);
						state.streamingText = event.text;
					}
					mergeRecentAssets(event.inputAssets);
					appendFileDownloads(event.files);
					void loadAssets(true);
					updateStreamingProcess("ok", "任务完成", event.sessionFile || "未返回会话文件");
					completeAssistantLoadingBubble("ok", "本轮已完成");
					completeProcessStream();
					setLoading(false);
					statusPill.textContent = "完成";
					void syncContextUsage(event.conversationId, { silent: true });
					void restoreConversationHistoryFromServer(event.conversationId);
					break;
				}
				case "error":
					showError(event.message);
					updateStreamingProcess("error", "任务错误", event.message);
					completeAssistantLoadingBubble("error", "本轮执行失败");
					completeProcessStream();
					setLoading(false);
					void syncContextUsage(event.conversationId, { silent: true });
					void restoreConversationHistoryFromServer(event.conversationId);
					break;
				default:
					updateStreamingProcess("system", "事件", JSON.stringify(event));
					break;
			}
		}

		async function readEventStream(response, onEvent) {
			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error("流式读取器不可用");
			}

			const decoder = new TextDecoder();
			let buffer = "";

			while (true) {
				const { value, done } = await reader.read();
				buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\\r/g, "");

				let boundaryIndex = buffer.indexOf("\\n\\n");
				while (boundaryIndex !== -1) {
					const chunk = buffer.slice(0, boundaryIndex);
					buffer = buffer.slice(boundaryIndex + 2);

					const data = chunk
						.split("\\n")
						.filter((line) => line.startsWith("data:"))
						.map((line) => line.slice(5).trimStart())
						.join("\\n");

					if (data) {
						onEvent(JSON.parse(data));
					}

					boundaryIndex = buffer.indexOf("\\n\\n");
				}

				if (done) {
					break;
				}
			}
		}

		async function sendMessage() {
			const composerDraft = createComposerDraft();
			const message = messageInput.value.trim();
			const attachments = [...state.pendingAttachments];
			const assetRefs = [...state.selectedAssetRefs];
			if (!message && attachments.length === 0 && assetRefs.length === 0) {
				showError("请输入消息");
				return;
			}
			const outboundMessage =
				message ||
				(assetRefs.length > 0
					? "\\u8bf7\\u7ed3\\u5408\\u6211\\u5f15\\u7528\\u7684\\u8d44\\u4ea7\\u4e00\\u8d77\\u5904\\u7406"
					: "\\u8bf7\\u67e5\\u770b\\u6211\\u53d1\\u9001\\u7684\\u9644\\u4ef6");

			if (!state.conversationId) {
				await ensureCurrentConversation({ silent: false });
			} else {
				void syncConversationCatalog({
					silent: true,
					activateCurrent: false,
				});
			}
			ensureConversationId();
			if (!state.conversationId) {
				showError("无法确认当前会话");
				return;
			}
			clearError();

			if (state.loading) {
				if (isInterruptIntentMessage(outboundMessage) && attachments.length === 0 && assetRefs.length === 0) {
					appendTranscriptMessage("user", state.conversationId, outboundMessage, { forceScroll: true });
					updateStreamingProcess("system", "检测到停止意图", "本次发送改为直接打断当前任务");
					messageInput.value = "";
					await interruptRun();
					return;
				}
				await queueActiveMessage(outboundMessage, attachments, assetRefs, { composerDraft });
				return;
			}

			setTranscriptState("active");
			stopActiveRunEventStream();
			resetStreamingState();
			appendUserTranscriptMessage(message, attachments, assetRefs);
			updateStreamingProcess("system", "请求已发送", formatOutboundSummary(message, attachments, assetRefs));
			clearComposerDraft();
			setLoading(true);
			ensureStreamingAssistantMessage();
			setAssistantLoadingState("正在等待 Agent 开始处理", "system");

			let handoffToRunEvents = false;
			try {
				const payload = {
					conversationId: state.conversationId,
					message: outboundMessage,
					userId: "web-playground",
				};
				if (attachments.length > 0) {
					payload.attachments = attachments;
				}
				if (assetRefs.length > 0) {
					payload.assetRefs = assetRefs;
				}
				const response = await fetch("/v1/chat/stream", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					const body = await response.json().catch(() => ({}));
					const errorMessage = body?.error?.message || body?.message || "未知错误";
					restoreComposerDraft(composerDraft);
					showError(errorMessage);
					updateStreamingProcess("error", "请求被拒绝", errorMessage);
					completeAssistantLoadingBubble("error", "本轮执行失败");
					completeProcessStream();
					return;
				}

				state.primaryStreamActive = true;
				try {
					await readEventStream(response, handleStreamEvent);
				} finally {
					state.primaryStreamActive = false;
				}

				if (!state.receivedDoneEvent && !errorBanner.classList.contains("visible")) {
					const streamWasRecovered = await recoverRunningStreamAfterDisconnect("missing_done");
					if (streamWasRecovered) {
						handoffToRunEvents = true;
						return;
					}
					showError("流已结束，但没有收到完成事件");
					updateStreamingProcess("error", "流被中断", "缺少 done 事件");
					completeAssistantLoadingBubble("error", "本轮异常结束");
					completeProcessStream();
				}

				if (state.receivedDoneEvent) {
					messageInput.focus();
				}
			} catch (error) {
				if (isPageUnloadStreamError(error)) {
					return;
				}

				const streamWasRecovered = await recoverRunningStreamAfterDisconnect("network_error");
				if (streamWasRecovered) {
					handoffToRunEvents = true;
					return;
				}

				if (!String(state.streamingText || "").trim() && !state.receivedDoneEvent) {
					restoreComposerDraft(composerDraft);
				}
				const messageText = error instanceof Error ? error.message : "请求失败";
				showError(messageText);
				updateStreamingProcess("error", "网络错误", messageText);
				completeAssistantLoadingBubble("error", "本轮执行失败");
				completeProcessStream();
			} finally {
				state.primaryStreamActive = false;
				if (!state.pageUnloading && !handoffToRunEvents) {
					setLoading(false);
				}
			}
		}

		async function queueActiveMessage(message, attachments, assetRefs, options) {
			const composerDraft = options?.composerDraft || createComposerDraft();
			if (options?.appendTranscript !== false) {
				appendUserTranscriptMessage(message, attachments, assetRefs);
			}
			clearComposerDraft();

			try {
				const payloadBody = {
					conversationId: state.conversationId,
					message,
					mode: "steer",
					userId: "web-playground",
				};
				if (attachments.length > 0) {
					payloadBody.attachments = attachments;
				}
				if (assetRefs.length > 0) {
					payloadBody.assetRefs = assetRefs;
				}
				const response = await fetch("/v1/chat/queue", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payloadBody),
				});

				const payload = await response.json().catch(() => ({}));
				if (!response.ok || !payload.queued) {
					const errorMessage = getControlActionErrorMessage("queue", payload, "消息无法追加");
					restoreComposerDraft(composerDraft);
					showError(errorMessage);
					return;
				}

				messageInput.focus();
				updateStreamingProcess("ok", "消息已加入队列", payload.conversationId);
			} catch (error) {
				restoreComposerDraft(composerDraft);
				const messageText = error instanceof Error ? error.message : "追加请求失败";
				showError(messageText);
			}
		}

		async function interruptRun() {
			if (!state.loading) {
				return;
			}

			await ensureCurrentConversation({ silent: true });
			ensureConversationId();
			if (!state.conversationId) {
				showError("无法确认当前会话");
				return;
			}

			try {
				const response = await fetch("/v1/chat/interrupt", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						conversationId: state.conversationId,
					}),
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok || !payload.interrupted) {
					if (payload?.reason === "not_running") {
						updateStreamingProcess("ok", "任务状态已同步", "后端没有正在运行的任务");
						stopActiveRunEventStream();
						completeAssistantLoadingBubble("ok", "当前任务已结束");
						completeProcessStream();
						setLoading(false);
						statusPill.textContent = "已结束";
						return;
					}
					const errorMessage = getControlActionErrorMessage("interrupt", payload, "当前任务无法打断");
					showError(errorMessage);
					return;
				}
				updateStreamingProcess("ok", "打断请求已接受", state.conversationId);
				completeAssistantLoadingBubble("warn", "本轮已中断");
				completeProcessStream();
				setLoading(false);
				statusPill.textContent = "已打断";
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "打断请求失败";
				showError(messageText);
			}
		}

		async function loadSkills() {
			clearError();
			const skillReply = appendAssistantProcessMessage("助手", "");
			setAssistantLoadingState("正在检查技能状态", "system");
			appendNarrationToAssistantProcess(skillReply, "我接收到查看技能的指令，先确认运行时技能接口。");
			setAssistantProcessAction(skillReply, "接收指令 · 查看技能", "system");
			viewSkillsButton.disabled = true;

			try {
				appendNarrationToAssistantProcess(skillReply, "我开始请求 /v1/debug/skills，读取当前运行时技能。");
				setAssistantLoadingState("正在查询技能接口", "tool");
				setAssistantProcessAction(skillReply, "查询接口 · GET /v1/debug/skills", "tool");
				const response = await fetch("/v1/debug/skills", {
					method: "GET",
					headers: { "accept": "application/json" },
				});

				if (!response.ok) {
					const body = await response.json().catch(() => ({}));
					const errorMessage = body?.error?.message || body?.message || "加载运行时技能失败";
					showError(errorMessage);
					appendNarrationToAssistantProcess(skillReply, "技能接口返回了错误，我先把失败状态告诉你。");
					setMessageContent(skillReply.content, "我这次没查到技能清单，接口返回了错误：\\n\\n" + errorMessage);
					setAssistantProcessAction(skillReply, "返回结果 · 技能查询失败", "error");
					completeAssistantLoadingBubble("error", "本轮执行失败");
					completeAssistantProcessShell(skillReply, "error");
					return;
				}

				const payload = await response.json().catch(() => ({}));
				const skillCount = Array.isArray(payload?.skills) ? payload.skills.length : 0;
				appendNarrationToAssistantProcess(skillReply, "接口已经返回，我正在整理技能结果。");
				setAssistantProcessAction(skillReply, "整理结果 · 共 " + skillCount + " 个技能", "system");
				setMessageContent(skillReply.content, formatSkillsReply(payload?.skills));
				appendNarrationToAssistantProcess(skillReply, "结果已经整理好了，现在给你一条简洁结论。");
				setAssistantProcessAction(skillReply, "返回结果 · 技能状态已更新", "ok");
				completeAssistantLoadingBubble("ok", "本轮已完成");
				completeAssistantProcessShell(skillReply, "ok");
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "加载运行时技能失败";
				showError(messageText);
				appendNarrationToAssistantProcess(skillReply, "这次请求没走通，我先把错误原因保留下来。");
				setMessageContent(skillReply.content, "我这次没查到技能清单，请求失败：\\n\\n" + messageText);
				setAssistantProcessAction(skillReply, "返回结果 · 请求失败", "error");
				completeAssistantLoadingBubble("error", "本轮执行失败");
				completeAssistantProcessShell(skillReply, "error");
			} finally {
				viewSkillsButton.disabled = state.loading;
			}
		}

		conversationInput.value = state.conversationId;
		setStageMode("landing");
		setTranscriptState("idle");
		setCommandStatus("STANDBY");
		renderContextUsageBar();
		renderSelectedAssets();
		renderAssetPickerList();
		renderConnManager();
		void loadAssets(true);

		resetStreamingState();
		clearError();
		void ensureCurrentConversation({ silent: true });

		function hasDragPayload(event) {
			return Boolean(event.dataTransfer);
		}

		function hasDroppedFiles(event) {
			const dataTransfer = event.dataTransfer;
			if (!dataTransfer) {
				return false;
			}

			if (dataTransfer.files && dataTransfer.files.length > 0) {
				return true;
			}

			if (Array.from(dataTransfer.items || []).some((item) => item.kind === "file")) {
				return true;
			}

			const dragTypes = Array.from(dataTransfer.types || []);
			if (dragTypes.some((type) => /files|application\\/x-moz-file/i.test(type))) {
				return true;
			}

			return false;
		}

		function preventWindowFileDrop(event) {
			pushDragDebug("window-guard", event);
			if (!hasDragPayload(event)) {
				return;
			}
			event.preventDefault();
			setCopyDropEffect(event);
		}

		function setCopyDropEffect(event) {
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = "copy";
			}
		}

		async function handleDroppedFiles(files, sourceLabel) {
			clearError();
			try {
				state.pendingAttachments = await collectAttachments(files);
				renderAttachmentList();
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "\\u6587\\u4ef6\\u8bfb\\u53d6\\u5931\\u8d25";
				showError(messageText);
				state.pendingAttachments = [];
				renderAttachmentList();
			}
		}

		function bindDropTarget(target) {
			const scope = target.id ? "#" + target.id : describeNode(target);
			target.addEventListener("dragenter", (event) => {
				pushDragDebug(scope, event);
				if (!hasDragPayload(event)) {
					return;
				}
				event.preventDefault();
				setCopyDropEffect(event);
				showGlobalDropHint();
			});

			target.addEventListener("dragover", (event) => {
				pushDragDebug(scope, event);
				if (!hasDragPayload(event)) {
					return;
				}
				event.preventDefault();
				setCopyDropEffect(event);
				showGlobalDropHint();
			});

			target.addEventListener("dragleave", (event) => {
				pushDragDebug(scope, event);
				const nextTarget = event.relatedTarget;
				if (!(nextTarget instanceof Node) || !target.contains(nextTarget)) {
					target.classList.remove("drag-active");
				}
			});

			target.addEventListener("drop", (event) => {
				pushDragDebug(scope, event);
				if (!hasDragPayload(event)) {
					return;
				}
				event.preventDefault();
				hideGlobalDropHint();
				if (hasDroppedFiles(event)) {
					void handleDroppedFiles(event.dataTransfer.files, "drop");
				}
			});
		}

		document.addEventListener("dragenter", (event) => {
			pushDragDebug("document", event);
			if (!hasDragPayload(event)) {
				return;
			}
			event.preventDefault();
			setCopyDropEffect(event);
			state.dragDepth += 1;
			showGlobalDropHint();
		}, true);

		document.addEventListener("dragover", (event) => {
			pushDragDebug("document", event);
			if (!hasDragPayload(event)) {
				return;
			}
			event.preventDefault();
			setCopyDropEffect(event);
			showGlobalDropHint();
		}, true);

		document.addEventListener("dragleave", (event) => {
			pushDragDebug("document", event);
			if (!hasDragPayload(event)) {
				return;
			}
			event.preventDefault();
			state.dragDepth = Math.max(0, state.dragDepth - 1);
			if (state.dragDepth === 0) {
				hideGlobalDropHint();
			}
		}, true);

		document.addEventListener("drop", (event) => {
			pushDragDebug("document", event);
			if (!hasDragPayload(event)) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			hideGlobalDropHint();
			if (hasDroppedFiles(event)) {
				void handleDroppedFiles(event.dataTransfer.files, "drop");
			}
		}, true);

		window.addEventListener("dragenter", preventWindowFileDrop);
		window.addEventListener("dragover", preventWindowFileDrop);
		window.addEventListener("drop", preventWindowFileDrop);
		window.addEventListener("resize", syncConversationWidth);
		window.addEventListener("beforeunload", () => {
			state.pageUnloading = true;
			flushConversationHistoryPersist();
			disconnectNotificationStream();
		});
		window.addEventListener("pagehide", () => {
			state.pageUnloading = true;
			flushConversationHistoryPersist();
			disconnectNotificationStream();
		});
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible") {
				void scheduleResumeConversationSync("visibilitychange", { restoreHistory: true });
			}
		});
		window.addEventListener("pageshow", () => {
			state.pageUnloading = false;
			void scheduleResumeConversationSync("pageshow", { restoreHistory: true });
		});
		window.addEventListener("online", () => {
			void scheduleResumeConversationSync("online", { restoreHistory: false });
		});
		const layoutObserver = new ResizeObserver(() => {
			scheduleConversationLayoutSync();
		});
		layoutObserver.observe(composerDropTarget);
		syncComposerTextareaHeight();
		bindDropTarget(pageRoot);
		bindDropTarget(pageBody);
		bindDropTarget(chatStage);
		bindDropTarget(composerDropTarget);
		bindDropTarget(dropZone);

		filePickerAction.addEventListener("click", () => {
			fileInput.click();
		});

		fileInput.addEventListener("change", async () => {
			await handleDroppedFiles(fileInput.files, "pick");
			if (fileInput.files && fileInput.files.length > 5) {
				appendProcessEvent("system", "\\u6587\\u4ef6\\u5df2\\u622a\\u65ad", "\\u4e00\\u6b21\\u6700\\u591a\\u53d1\\u9001 5 \\u4e2a\\u6587\\u4ef6");
			}
		});

		sendButton.addEventListener("click", () => {
			void sendMessage();
		});

		interruptButton.addEventListener("click", () => {
			void interruptRun();
		});

		viewSkillsButton.addEventListener("click", () => {
			void loadSkills();
		});

		refreshAssetsButton.addEventListener("click", () => {
			void loadAssets(false);
		});

		refreshConnManagerButton.addEventListener("click", () => {
			void loadConnManager({ silent: false });
		});

		connManagerFilter.addEventListener("change", () => {
			state.connManagerFilter = connManagerFilter.value || "all";
			renderConnManager();
		});

		selectVisibleConnsButton.addEventListener("click", selectVisibleConns);
		clearSelectedConnsButton.addEventListener("click", clearSelectedConns);
		deleteSelectedConnsButton.addEventListener("click", () => {
			void deleteSelectedConns();
		});

		openConnManagerButton.addEventListener("click", () => {
			openConnManager();
		});

		openConnEditorButton.addEventListener("click", () => {
			openConnEditor("create");
		});

		closeConnManagerButton.addEventListener("click", () => {
			closeConnManager();
		});

		connManagerDialog.addEventListener("click", (event) => {
			if (event.target === connManagerDialog) {
				closeConnManager();
			}
		});

		connEditorTargetType.addEventListener("change", renderConnEditor);
		connEditorTargetId.addEventListener("input", renderConnEditorTargetPreview);
		connEditorScheduleKind.addEventListener("change", renderConnEditor);
		connEditorForm.addEventListener("submit", (event) => {
			event.preventDefault();
			void submitConnEditor();
		});
		cancelConnEditorButton.addEventListener("click", closeConnEditor);
		closeConnEditorButton.addEventListener("click", closeConnEditor);
		connEditorDialog.addEventListener("click", (event) => {
			if (event.target === connEditorDialog) {
				closeConnEditor();
			}
		});

		openAssetLibraryButton.addEventListener("click", () => {
			openAssetLibrary();
		});

		closeAssetModalButton.addEventListener("click", () => {
			closeAssetLibrary();
		});

		assetModal.addEventListener("click", (event) => {
			if (event.target === assetModal) {
				closeAssetLibrary();
			}
		});

		newConversationButton.addEventListener("click", () => {
			void startNewConversation().then((created) => {
				if (created) {
					messageInput.focus();
				}
			});
		});
		mobileNewConversationButton.addEventListener("click", () => {
			closeMobileOverflowMenu();
			void startNewConversation().then((created) => {
				if (created) {
					messageInput.focus();
				}
			});
		});
		mobileBrandButton.addEventListener("click", (event) => {
			event.stopPropagation();
			setMobileConversationDrawerOpen(!state.mobileConversationDrawerOpen);
			void syncConversationCatalog({
				silent: true,
				activateCurrent: false,
			});
		});
		mobileDrawerBackdrop.addEventListener("click", closeMobileConversationDrawer);
		mobileDrawerCloseButton.addEventListener("click", closeMobileConversationDrawer);
		mobileOverflowMenuButton.addEventListener("click", (event) => {
			event.stopPropagation();
			setMobileOverflowMenuOpen(!state.mobileOverflowMenuOpen);
		});
		mobileMenuSkillsButton.addEventListener("click", () => {
			closeMobileOverflowMenu();
			void loadSkills();
		});
		mobileMenuFileButton.addEventListener("click", () => {
			closeMobileOverflowMenu();
			fileInput.click();
		});
		mobileMenuLibraryButton.addEventListener("click", () => {
			closeMobileOverflowMenu();
			openAssetLibrary();
		});
		mobileMenuActivityButton.addEventListener("click", () => {
			closeMobileOverflowMenu();
			openAgentActivity();
		});
		mobileMenuConnButton.addEventListener("click", () => {
			closeMobileOverflowMenu();
			openConnManager();
		});
		historyLoadMoreButton.addEventListener("click", () => {
			renderMoreConversationHistory();
		});
		scrollToBottomButton.addEventListener("click", () => {
			scrollTranscriptToBottom({ force: true });
		});
		transcript.addEventListener("scroll", handleTranscriptScroll);
		errorBannerClose.addEventListener("click", () => {
			clearError();
		});
		contextUsageShell.addEventListener("click", () => {
			toggleContextUsageDetails();
		});
		contextUsageDialogClose.addEventListener("click", () => {
			closeContextUsageDialog();
		});
		contextUsageDialog.addEventListener("click", (event) => {
			if (event.target === contextUsageDialog) {
				closeContextUsageDialog();
			}
		});
		connRunDetailsClose.addEventListener("click", () => {
			closeConnRunDetailsDialog();
		});
		connRunDetailsDialog.addEventListener("click", (event) => {
			if (event.target === connRunDetailsDialog) {
				closeConnRunDetailsDialog();
			}
		});
		openAgentActivityButton.addEventListener("click", () => {
			openAgentActivity();
		});
		closeAgentActivityButton.addEventListener("click", () => {
			closeAgentActivity();
		});
		refreshAgentActivityButton.addEventListener("click", () => {
			void loadAgentActivity({ silent: false });
		});
		agentActivityDialog.addEventListener("click", (event) => {
			if (event.target === agentActivityDialog) {
				closeAgentActivity();
			}
		});

		conversationInput.addEventListener("change", () => {
			const nextConversationId = String(conversationInput.value || "").trim();
			if (nextConversationId === state.conversationId) {
				renderContextUsageBar();
				return;
			}
			void switchConversationOnServer(nextConversationId)
				.then((result) => {
					if (!result.switched) {
						showError(result.reason === "running" ? "当前任务未结束，不能切换产线" : "无法切换会话");
						conversationInput.value = state.conversationId;
						return;
					}
					return activateConversation(result.currentConversationId || result.conversationId, {
						skipServerSwitch: true,
					});
				})
				.catch((error) => {
					conversationInput.value = state.conversationId;
					const messageText = error instanceof Error ? error.message : "切换会话失败";
					showError(messageText);
				});
		});

		messageInput.addEventListener("keydown", (event) => {
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				void sendMessage();
			}
		});
		const debouncedRenderContextUsage = debounce(renderContextUsageBar, 150);
		messageInput.addEventListener("input", () => {
			syncComposerTextareaHeight();
			debouncedRenderContextUsage();
		});

		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && state.assetModalOpen) {
				closeAssetLibrary();
			}
			if (event.key === "Escape" && state.connEditorOpen) {
				closeConnEditor();
				return;
			}
			if (event.key === "Escape" && state.connManagerOpen) {
				closeConnManager();
			}
			if (event.key === "Escape" && state.agentActivityOpen) {
				closeAgentActivity();
			}
			if (event.key === "Escape" && !contextUsageDialog.hidden) {
				closeContextUsageDialog();
			}
			if (event.key === "Escape" && !connRunDetailsDialog.hidden) {
				closeConnRunDetailsDialog();
			}
			if (event.key === "Escape" && state.mobileOverflowMenuOpen) {
				closeMobileOverflowMenu();
			}
			if (event.key === "Escape" && state.mobileConversationDrawerOpen) {
				closeMobileConversationDrawer();
			}
		});

		document.addEventListener("click", (event) => {
			if (!state.mobileOverflowMenuOpen) {
				return;
			}
			if (!mobileTopbar.contains(event.target)) {
				closeMobileOverflowMenu();
			}
		});

		connectNotificationStream();
		scheduleConversationLayoutSync({ immediate: true });
	`;
}

export function renderPlaygroundPage(): string {
	return `<!doctype html>
<html lang="zh-CN">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>UGK Claw</title>
		<link rel="icon" href="/ugk-claw-mobile-logo.png" />
		<style>${getPlaygroundStyles()}</style>
	</head>
	<body>
		<div id="drag-overlay" class="drag-overlay" aria-hidden="true">
			<div class="drag-overlay-panel">
				<strong>释放文件</strong>
				<span>文件会进入当前消息，并自动补充文件处理描述</span>
			</div>
		</div>
		<div id="shell" class="shell" data-stage-mode="landing" data-transcript-state="idle">
			<header class="topbar">
				<div class="topbar-signal" aria-hidden="true">UGK CLAW</div>
				<section id="mobile-topbar" class="mobile-topbar" aria-label="手机状态栏">
					<button
						id="mobile-brand-button"
						class="mobile-brand"
						type="button"
						aria-haspopup="dialog"
						aria-expanded="false"
						aria-controls="mobile-conversation-drawer"
						title="历史会话"
					>
						<img class="mobile-brand-logo" src="/ugk-claw-mobile-logo.png" alt="UGK Claw logo" />
						<div class="mobile-brand-copy">
							<span class="mobile-brand-wordmark">UGK Claw</span>
						</div>
					</button>
					<div></div>
					<button
						id="mobile-new-conversation-button"
						class="mobile-topbar-button"
						type="button"
						aria-label="新会话"
						title="新会话"
					>
						<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path d="M12 5v14M5 12h14" stroke-width="1.8" stroke-linecap="round" />
						</svg>
					</button>
					<button
						id="mobile-overflow-menu-button"
						class="mobile-topbar-button"
						type="button"
						aria-haspopup="menu"
						aria-expanded="false"
						aria-controls="mobile-overflow-menu"
						aria-label="更多操作"
						title="更多操作"
					>
						<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<circle cx="12" cy="5" r="1.8"></circle>
							<circle cx="12" cy="12" r="1.8"></circle>
							<circle cx="12" cy="19" r="1.8"></circle>
						</svg>
					</button>
					<div id="mobile-overflow-menu" class="mobile-overflow-menu" role="menu" hidden>
						<button id="mobile-menu-skills-button" class="mobile-overflow-menu-item" type="button" role="menuitem">
							<span class="mobile-overflow-menu-item-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none">
									<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" stroke-width="1.8" stroke-linejoin="round" />
								</svg>
							</span>
							<span>技能</span>
						</button>
						<button id="mobile-menu-file-button" class="mobile-overflow-menu-item" type="button" role="menuitem">
							<span class="mobile-overflow-menu-item-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none">
									<path d="M7 4h7l4 4v12H7V4Z" stroke-width="1.8" stroke-linejoin="round" />
									<path d="M14 4v4h4" stroke-width="1.8" stroke-linejoin="round" />
								</svg>
							</span>
							<span>文件</span>
						</button>
						<button id="mobile-menu-library-button" class="mobile-overflow-menu-item" type="button" role="menuitem">
							<span class="mobile-overflow-menu-item-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none">
									<path d="M4 7h5l2 2h9v9H4V7Z" stroke-width="1.8" stroke-linejoin="round" />
								</svg>
							</span>
							<span>文件库</span>
						</button>
						<button id="mobile-menu-conn-button" class="mobile-overflow-menu-item" type="button" role="menuitem">
							<span class="mobile-overflow-menu-item-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none">
									<path d="M6 7h12M6 12h12M6 17h8" stroke-width="1.8" stroke-linecap="round" />
									<path d="M4 5v14M20 5v14" stroke-width="1.8" stroke-linecap="round" />
								</svg>
							</span>
							<span>后台任务</span>
						</button>
						<button id="mobile-menu-activity-button" class="mobile-overflow-menu-item" type="button" role="menuitem">
							<span class="mobile-overflow-menu-item-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none">
									<path d="M5 7h14M5 12h14M5 17h9" stroke-width="1.8" stroke-linecap="round" />
									<path d="M4 4v16" stroke-width="1.8" stroke-linecap="round" />
								</svg>
							</span>
							<span>全局活动</span>
						</button>
					</div>
				</section>
				<div class="topbar-right">
					<div class="status-row"><span>主题</span><strong>深色 / 极客</strong></div>
					<div class="status-row"><span>传输</span><strong>SSE / 流式</strong></div>
					<div class="status-row"><span>发送</span><strong>Enter</strong></div>
				</div>
			</header>

			<div id="mobile-drawer-backdrop" class="mobile-drawer-backdrop" hidden></div>
			<aside
				id="mobile-conversation-drawer"
				class="mobile-conversation-drawer"
				aria-label="历史会话"
				hidden
			>
				<div class="mobile-drawer-head">
					<div class="mobile-drawer-title">
						<strong>历史会话</strong>
						<span>单工人，多产线；运行中不能切换</span>
					</div>
					<button id="mobile-drawer-close-button" class="mobile-drawer-close" type="button" aria-label="关闭历史会话">
						×
					</button>
				</div>
				<div id="mobile-conversation-list" class="mobile-conversation-list"></div>
			</aside>

			<main id="chat-stage" class="chat-stage">
				<div hidden>
					<div class="meta-chip">
						<strong>会话</strong>
						<input id="conversation-id" name="conversation-id" placeholder="manual:web-xxxx" />
					</div>
					<div class="meta-chip">
						<strong>会话文件</strong>
						<span id="session-file">尚未分配</span>
					</div>
				</div>

				<div hidden>
					<span>接口：POST /v1/chat/stream</span>
					<div id="status-pill" class="state">就绪</div>
				</div>

				<section id="landing-screen" class="landing-screen" aria-hidden="false">
					<div class="landing-grid">
						<section id="hero-core" class="hero-core">
							<div class="hero-wordmark">UGK CLAW</div>
							<div class="hero-divider">
								<span></span>
								<em id="hero-version">v4.0.21.STABLE</em>
								<span></span>
							</div>
						</section>
						<aside class="landing-side landing-side-right">
							<button id="new-conversation-button" class="telemetry-card telemetry-action" type="button">
								<span>全新的记忆</span>
								<strong id="command-status">新会话</strong>
							</button>
							<button id="view-skills-button" class="telemetry-card telemetry-action" type="button">
								<span>技能越多，能力越强？</span>
								<strong>查看技能</strong>
							</button>
							<button id="file-picker-action" class="telemetry-card telemetry-action" type="button">
								<span>文件或许更稳定</span>
								<strong>选择文件</strong>
							</button>
							<button id="open-asset-library-button" class="telemetry-card telemetry-action" type="button">
								<span>这里不是垃圾堆</span>
								<strong>项目文件夹</strong>
							</button>
							<button id="open-conn-manager-button" class="telemetry-card telemetry-action" type="button">
								<span>后台自己干，前台别被绑架</span>
								<strong>后台任务</strong>
							</button>
							<button id="open-agent-activity-button" class="telemetry-card telemetry-action" type="button">
								<span>跨会话收结果，别让消息失踪</span>
								<strong>全局活动</strong>
							</button>
						</aside>
					</div>
				</section>

				<div id="error-banner" class="error-banner" role="alert" hidden>
					<span id="error-banner-message" class="error-banner-message"></span>
					<button id="error-banner-close" class="error-banner-close" type="button" aria-label="关闭错误提示">×</button>
				</div>

				<div id="notification-live-region" class="notification-live-region" aria-live="polite" aria-atomic="false" hidden>
					<div id="notification-toast-stack" class="notification-toast-stack"></div>
				</div>

				<section class="stream-layout">
					<div class="transcript-pane">
						<header class="pane-head">
							<strong>对话流</strong>
							<span>单列会话舞台会把用户与 Agent 的回应自然分层，焦点始终落在当前内容。</span>
						</header>
						<button id="history-load-more-button" class="history-load-more" type="button" hidden>加载更多历史</button>
						<section id="transcript" class="transcript" aria-live="polite">
							<div id="transcript-archive" class="transcript-archive"></div>
							<div id="transcript-current" class="transcript-current"></div>
						</section>
						<button id="scroll-to-bottom-button" class="scroll-to-bottom-button" type="button" hidden>回到底部</button>
					</div>
				</section>

				<div id="command-deck" class="command-deck">
					<div class="file-strip">
						<div id="drop-zone" class="drop-zone">
							<input id="file-input" class="file-input" name="files" type="file" multiple />
						</div>
						<div id="file-list" class="file-list" aria-live="polite"></div>
						<section id="selected-assets" class="selected-assets" aria-live="polite">
							<div id="selected-asset-list" class="selected-asset-list"></div>
						</section>
					</div>
					<div class="context-usage-row">
						<button id="context-usage-shell" class="context-usage-shell" type="button" data-status="safe" data-expanded="false" aria-label="上下文使用 0%" aria-describedby="context-usage-meta">
							<svg class="context-usage-ring" viewBox="0 0 36 36" aria-hidden="true">
								<circle class="context-usage-track" cx="18" cy="18" r="15.5" pathLength="100"></circle>
								<circle id="context-usage-progress" class="context-usage-progress" cx="18" cy="18" r="15.5" pathLength="100"></circle>
							</svg>
							<span id="context-usage-summary" class="context-usage-summary">0%</span>
							<span id="context-usage-toggle" class="context-usage-toggle">上下文详情</span>
							<span id="context-usage-meta" class="context-usage-meta" role="tooltip">当前上下文 0 / 128,000 tokens (0%)</span>
						</button>
					</div>
					<section id="composer-drop-target" class="composer">
						<div class="composer-main">
							<div class="composer-header">
								<span>消息</span>
								<span>Shift+Enter 换行</span>
							</div>
							<textarea id="message" name="message" placeholder="和我聊聊吧"></textarea>
						</div>
						<div class="composer-side">
							<button id="interrupt-button" type="button" disabled>打断</button>
							<button id="send-button" type="button">发送</button>
						</div>
					</section>
				</div>
			</main>
		</div>
		<div id="context-usage-dialog" class="context-usage-dialog" aria-hidden="true" hidden>
			<section class="context-usage-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="context-usage-dialog-title">
				<div class="context-usage-dialog-head">
					<strong id="context-usage-dialog-title">上下文使用情况</strong>
					<button id="context-usage-dialog-close" class="context-usage-dialog-close" type="button" aria-label="关闭上下文详情">×</button>
				</div>
				<div id="context-usage-dialog-body" class="context-usage-dialog-body">当前上下文 0 / 128,000 tokens (0%)</div>
			</section>
		</div>
		<div id="conn-run-details-dialog" class="conn-run-details-dialog" aria-hidden="true" hidden>
			<section class="conn-run-details-panel" role="dialog" aria-modal="true" aria-labelledby="conn-run-details-title">
				<div class="conn-run-details-head">
					<strong id="conn-run-details-title">后台任务过程</strong>
					<button id="conn-run-details-close" class="conn-run-details-close" type="button" aria-label="关闭后台任务过程">×</button>
				</div>
				<div id="conn-run-details-body" class="conn-run-details-body"></div>
			</section>
		</div>
		<div id="agent-activity-dialog" class="asset-modal-shell agent-activity-dialog" aria-hidden="true" hidden>
			<section class="asset-modal agent-activity-panel" role="dialog" aria-modal="true" aria-labelledby="agent-activity-title">
				<div class="asset-modal-head">
					<div class="asset-modal-copy">
						<strong id="agent-activity-title">全局活动</strong>
						<span>跨会话查看 conn 结果、运行摘要和可追溯的后台任务过程。</span>
					</div>
					<div class="asset-modal-actions">
						<button id="refresh-agent-activity-button" type="button">刷新</button>
						<button id="close-agent-activity-button" type="button">关闭</button>
					</div>
				</div>
				<div class="asset-modal-body">
					<div id="agent-activity-list" class="agent-activity-list" aria-live="polite"></div>
				</div>
			</section>
		</div>
		<div id="conn-manager-dialog" class="asset-modal-shell conn-manager-dialog" aria-hidden="true" hidden>
			<section class="asset-modal conn-manager-panel" role="dialog" aria-modal="true" aria-labelledby="conn-manager-title">
				<div class="asset-modal-head">
					<div class="asset-modal-copy">
						<strong id="conn-manager-title">后台任务</strong>
						<span>查看 conn、暂停或恢复调度、立即入队一次运行，并追溯最近 run。</span>
					</div>
					<div class="asset-modal-actions">
						<button id="open-conn-editor-button" type="button">新建</button>
						<button id="refresh-conn-manager-button" type="button">刷新</button>
						<button id="close-conn-manager-button" type="button">关闭</button>
					</div>
				</div>
				<div class="asset-modal-body">
					<div class="conn-manager-toolbar">
						<label class="conn-manager-filter-field">
							<span>状态</span>
							<select id="conn-manager-filter">
								<option value="all">全部</option>
								<option value="active">运行中</option>
								<option value="paused">已暂停</option>
								<option value="completed">已完成</option>
							</select>
						</label>
						<span id="conn-manager-selected-count" class="conn-manager-selected-count">已选 0</span>
						<div class="conn-manager-bulk-actions">
							<button id="select-visible-conns-button" type="button">选择当前</button>
							<button id="clear-selected-conns-button" type="button">清空选择</button>
							<button id="delete-selected-conns-button" class="danger-action" type="button">删除所选</button>
						</div>
					</div>
					<div id="conn-manager-notice" class="conn-manager-notice" role="status" hidden></div>
					<div id="conn-manager-list" class="conn-manager-list" aria-live="polite"></div>
				</div>
			</section>
		</div>
		<div id="conn-editor-dialog" class="asset-modal-shell conn-editor-dialog" aria-hidden="true" hidden>
			<section class="asset-modal conn-editor-panel" role="dialog" aria-modal="true" aria-labelledby="conn-editor-title">
				<form id="conn-editor-form" class="conn-editor-form">
					<div class="asset-modal-head">
						<div class="asset-modal-copy">
							<strong id="conn-editor-title">新建后台任务</strong>
							<span>设置结果发到哪里、什么时候执行；高级项按需展开。</span>
						</div>
						<div class="asset-modal-actions">
							<button id="save-conn-editor-button" type="submit">保存</button>
							<button id="cancel-conn-editor-button" type="button">取消</button>
							<button id="close-conn-editor-button" type="button">关闭</button>
						</div>
					</div>
					<div class="asset-modal-body conn-editor-body">
						<div id="conn-editor-error" class="conn-editor-error" role="alert" hidden></div>
						<label class="conn-editor-field">
							<span>标题</span>
							<input id="conn-editor-title-input" name="title" autocomplete="off" required />
						</label>
						<label class="conn-editor-field">
							<span>让它做什么</span>
							<textarea id="conn-editor-prompt" name="prompt" rows="5" required></textarea>
						</label>
						<div class="conn-editor-grid conn-editor-target-row">
							<label class="conn-editor-field">
								<span>结果发到哪里</span>
								<select id="conn-editor-target-type" name="targetType">
									<option value="current_conversation">当前会话</option>
									<option value="conversation">指定会话</option>
									<option value="feishu_chat">飞书群</option>
									<option value="feishu_user">飞书用户</option>
								</select>
							</label>
							<label class="conn-editor-field">
								<span id="conn-editor-target-id-label">会话编号</span>
								<input id="conn-editor-target-id" name="targetId" autocomplete="off" />
								<small id="conn-editor-target-id-hint" class="conn-editor-field-hint">填要接收结果的会话编号；保存后不会跟着当前页面自动切换。</small>
							</label>
						</div>
						<code id="conn-editor-target-current" class="conn-editor-current-target"></code>
						<div id="conn-editor-target-preview" class="conn-editor-target-preview" aria-live="polite"></div>
						<label class="conn-editor-field">
							<span>执行方式</span>
							<select id="conn-editor-schedule-kind" name="scheduleKind">
								<option value="once">定时执行</option>
								<option value="interval">间隔执行</option>
								<option value="daily">每日执行</option>
							</select>
							<small class="conn-editor-field-hint">就三种：定时一次、按间隔重复、每天固定时间。</small>
						</label>
						<div class="conn-editor-grid conn-editor-schedule-grid">
							<label class="conn-editor-field conn-editor-schedule-panel" data-schedule-panel="once">
								<span>执行时间</span>
								<input id="conn-editor-once-at" name="onceAt" type="datetime-local" />
							</label>
							<label class="conn-editor-field conn-editor-schedule-panel" data-schedule-panel="interval">
								<span>首次执行时间</span>
								<input id="conn-editor-interval-start" name="intervalStart" type="datetime-local" />
							</label>
							<label class="conn-editor-field conn-editor-schedule-panel" data-schedule-panel="interval">
								<span>间隔（分钟）</span>
								<input id="conn-editor-interval-minutes" name="intervalMinutes" type="number" min="1" step="1" />
							</label>
							<label class="conn-editor-field conn-editor-schedule-panel" data-schedule-panel="daily">
								<span>每日执行时间</span>
								<input id="conn-editor-time-of-day" name="timeOfDay" type="time" />
							</label>
						</div>
						<details class="conn-editor-advanced">
							<summary>高级设置</summary>
							<p class="conn-editor-section-hint">下面这些主要给进阶场景用。不填就走默认，不会影响普通创建。</p>
							<div class="conn-editor-grid">
								<label class="conn-editor-field">
									<span>任务身份</span>
									<input id="conn-editor-profile-id" autocomplete="off" placeholder="background.default" />
									<small class="conn-editor-field-hint">决定它以哪套后台身份运行。</small>
								</label>
								<label class="conn-editor-field">
									<span>执行模板</span>
									<input id="conn-editor-agent-spec-id" autocomplete="off" placeholder="agent.default" />
									<small class="conn-editor-field-hint">决定底层 agent 形态。</small>
								</label>
								<label class="conn-editor-field">
									<span>能力包</span>
									<input id="conn-editor-skill-set-id" autocomplete="off" placeholder="skills.default" />
									<small class="conn-editor-field-hint">限制它能调用哪些 skills。</small>
								</label>
								<label class="conn-editor-field">
									<span>模型策略</span>
									<input id="conn-editor-model-policy-id" autocomplete="off" placeholder="model.default" />
									<small class="conn-editor-field-hint">决定优先使用哪类模型。</small>
								</label>
								<label class="conn-editor-field">
									<span>版本跟随方式</span>
									<select id="conn-editor-upgrade-policy">
										<option value="latest">跟随默认</option>
										<option value="pinned">固定当前</option>
										<option value="manual">手动控制</option>
									</select>
									<small class="conn-editor-field-hint">控制它是自动跟随，还是固定在当前版本。</small>
								</label>
								<label class="conn-editor-field">
									<span>最长等待时长（秒）</span>
									<input id="conn-editor-max-run-seconds" type="number" min="1" step="1" />
									<small class="conn-editor-field-hint">超时后，这次任务会按失败处理。</small>
								</label>
							</div>
							<label class="conn-editor-field">
								<span>附加资料</span>
								<textarea id="conn-editor-asset-refs" rows="3" spellcheck="false"></textarea>
								<small class="conn-editor-field-hint">填资产 ID，一行一个；让任务运行时顺带带上这些资料。</small>
							</label>
						</details>
					</div>
				</form>
			</section>
		</div>
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
		<script>${getMarkedBrowserScript()}
${getPlaygroundScript()}</script>
	</body>
</html>`;
}
