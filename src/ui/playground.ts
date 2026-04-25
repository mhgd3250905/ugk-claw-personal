import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Marked, type Tokens } from "marked";
import { getConnActivityDialogs, getConnManagerActivityStyles, getConnRunDetailsStyles } from "./playground-conn-activity.js";
import {
	getPlaygroundAssetBaseStyles,
	getPlaygroundAssetDialogs,
	getPlaygroundAssetLandingStyles,
	getPlaygroundAssetMobileStyles,
	getPlaygroundAssetModalStyles,
} from "./playground-assets.js";
import {
	getPlaygroundAssetControllerScript,
	getPlaygroundAssetElementRefsScript,
	getPlaygroundAssetEventHandlersScript,
} from "./playground-assets-controller.js";
import {
	getPlaygroundContextUsageConstantsScript,
	getPlaygroundContextUsageControllerScript,
	getPlaygroundContextUsageElementRefsScript,
	getPlaygroundContextUsageEventHandlersScript,
} from "./playground-context-usage-controller.js";
import { getPlaygroundConversationControllerScript } from "./playground-conversations-controller.js";
import { getPlaygroundLayoutConstantsScript, getPlaygroundLayoutControllerScript } from "./playground-layout-controller.js";
import {
	getPlaygroundMobileShellControllerScript,
	getPlaygroundMobileShellElementRefsScript,
	getPlaygroundMobileShellEventHandlersScript,
} from "./playground-mobile-shell-controller.js";
import {
	getPlaygroundTaskInboxControllerScript,
	getPlaygroundTaskInboxElementRefsScript,
	getPlaygroundTaskInboxEventHandlersScript,
	getPlaygroundTaskInboxStyles,
	getPlaygroundTaskInboxView,
} from "./playground-task-inbox.js";
import { getPlaygroundThemeControllerScript, getPlaygroundThemeStyles } from "./playground-theme-controller.js";
import {
	getBrowserMarkdownRendererScript,
	getPlaygroundTranscriptRendererScript,
} from "./playground-transcript-renderer.js";
import { getPlaygroundStreamControllerScript } from "./playground-stream-controller.js";
import {
	getConnActivityApiScript,
	getConnActivityConstantsScript,
	getConnActivityEditorScript,
	getConnActivityElementRefsScript,
	getConnActivityEventHandlersScript,
	getConnActivityRendererScript,
} from "./playground-conn-activity-controller.js";

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
			grid-template-columns: 238px minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr);
			column-gap: 18px;
			overflow: hidden;
		}

		.topbar {
			position: relative;
			grid-column: 1 / -1;
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
			background: transparent;
			box-shadow: none;
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
			filter: none;
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
			border: 1px solid transparent;
			background: transparent;
			box-shadow: none;
		}

		.mobile-topbar-button svg {
			width: 18px;
			height: 18px;
			stroke: currentColor;
		}

		.mobile-topbar-button:hover:not(:disabled),
		.mobile-topbar-button:focus-visible {
			border-color: transparent;
			background: transparent;
			color: #f7f9ff;
			transform: none;
			box-shadow: none;
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
			box-shadow: none;
			backdrop-filter: none;
		}

		.mobile-overflow-menu[hidden] {
			display: none !important;
		}

		.mobile-overflow-menu-item {
			display: grid;
			grid-template-columns: 18px minmax(0, 1fr) auto;
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
			box-shadow: none;
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
			position: relative;
			display: grid;
			gap: 5px;
			width: 100%;
			padding: 11px 46px 11px 12px;
			border: 1px solid rgba(201, 210, 255, 0.1);
			border-radius: 4px;
			background: rgba(255, 255, 255, 0.035);
			box-shadow: none;
			text-align: left;
		}

		.conversation-item-shell {
			display: block;
		}

		.conversation-item-shell .mobile-conversation-item {
			min-width: 0;
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
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border: 1px solid rgba(255, 120, 140, 0.16);
			background: rgba(255, 120, 140, 0.06);
			color: rgba(255, 184, 198, 0.82);
			font-size: 16px;
			box-shadow: none;
		}

		.conversation-item-delete:hover:not(:disabled),
		.conversation-item-delete:focus-visible {
			border-color: rgba(255, 138, 157, 0.34);
			background: rgba(255, 120, 140, 0.12);
			color: rgba(255, 214, 223, 0.96);
			transform: none;
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
			grid-column: 2;
			grid-row: 2;
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
				background 120ms ease;
		}

		button:hover:not(:disabled) {
			border-color: var(--accent);
			color: var(--accent);
			background: rgba(255, 255, 255, 0.08);
			transform: translateY(-1px);
			box-shadow: none;
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
			background: #2f1119;
			color: #ffdbe2;
			font-size: 12px;
			line-height: 1.6;
			flex-shrink: 0;
			z-index: 6;
			box-shadow: none;
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
			background: #421823;
			box-shadow: none;
			color: #ffe8ed;
			font-size: 16px;
			line-height: 1;
			cursor: pointer;
		}

		.error-banner-close:hover:not(:disabled),
		.error-banner-close:focus-visible {
			background: #5a2230;
			color: #ffffff;
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
			box-shadow: none;
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
			box-shadow: none;
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
			box-shadow: none;
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

		.history-auto-load-status {
			align-self: center;
			margin: 0 0 10px;
			padding: 7px 12px;
			border: 0;
			background: rgba(201, 210, 255, 0.06);
			color: rgba(236, 240, 255, 0.64);
			font-size: 10px;
			letter-spacing: 0.12em;
			pointer-events: none;
		}

		.history-auto-load-status[hidden] {
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

		.message.assistant .message-body:has(> .message-content.is-empty:only-child) {
			display: none;
		}

		.message.assistant .message-content,
		.message.assistant .message-content .code-block-language {
			color: #edf5ff;
		}

		.message.assistant .message-content {
			font-size: 12px;
			line-height: 1.75;
		}

		.message.assistant .message-content h1 {
			color: #ffffff;
			font-size: 18px;
			line-height: 1.35;
		}

		.message.assistant .message-content h2 {
			color: #d7e5ff;
			font-size: 16px;
			line-height: 1.38;
		}

		.message.assistant .message-content h3 {
			color: #bdf0df;
			font-size: 14px;
			line-height: 1.42;
		}

		.message.assistant .message-content h4,
		.message.assistant .message-content h5,
		.message.assistant .message-content h6 {
			color: #ffdca8;
			font-size: 13px;
			line-height: 1.45;
		}

		.message.assistant .message-content a {
			color: #8fd6ff;
			text-decoration-color: rgba(143, 214, 255, 0.42);
		}

		.message.assistant .message-content strong {
			color: #fff4c7;
		}

		.message.assistant .message-content code {
			color: #ffe6ad;
			border-color: rgba(255, 255, 255, 0.12);
			background: rgba(255, 220, 168, 0.12);
		}

		.message.assistant .message-content blockquote {
			border-left-color: rgba(128, 232, 198, 0.46);
			background: rgba(128, 232, 198, 0.08);
			color: rgba(223, 255, 244, 0.9);
		}

		.message.assistant .message-content pre,
		.message.assistant .message-content .code-block {
			border-color: rgba(255, 220, 168, 0.16);
			background: rgba(7, 10, 18, 0.5);
		}

		.message.assistant .message-content th {
			color: #d7e5ff;
			background: rgba(143, 214, 255, 0.1);
		}

		.message.assistant .message-content td {
			color: rgba(237, 245, 255, 0.84);
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

		.assistant-loading-bubble {
			display: inline-flex;
			align-items: center;
			gap: 10px;
			width: fit-content;
			max-width: fit-content;
			padding: 8px 12px;
			border: 1px solid rgba(201, 210, 255, 0.14);
			border-radius: 999px;
			background: rgba(201, 210, 255, 0.06);
			color: rgba(233, 238, 255, 0.88);
			font-size: 11px;
			letter-spacing: 0.04em;
			text-transform: none;
			box-shadow: none;
			justify-self: flex-start;
		}

		.assistant-run-log-trigger {
			cursor: pointer;
		}

		.assistant-run-log-trigger:disabled {
			cursor: default;
			opacity: 0.64;
		}

		.assistant-run-log-hint {
			color: rgba(233, 238, 255, 0.52);
			font-size: 10px;
		}

		.assistant-loading-dots {
			display: inline-flex;
			flex: 0 0 auto;
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

		.assistant-status-shell.tool .assistant-loading-bubble,
		.assistant-loading-bubble.tool {
			border-color: rgba(201, 210, 255, 0.2);
			background: rgba(201, 210, 255, 0.08);
		}

		.assistant-status-shell.ok .assistant-loading-bubble,
		.assistant-loading-bubble.ok {
			border-color: rgba(141, 255, 178, 0.22);
			background: rgba(141, 255, 178, 0.07);
			color: rgba(201, 255, 220, 0.92);
		}

		.assistant-status-shell.warn .assistant-loading-bubble,
		.assistant-loading-bubble.warn {
			border-color: rgba(255, 209, 102, 0.2);
			background: rgba(255, 209, 102, 0.07);
			color: rgba(255, 230, 178, 0.94);
		}

		.assistant-status-shell.error .assistant-loading-bubble,
		.assistant-loading-bubble.error {
			border-color: rgba(255, 113, 136, 0.2);
			background: rgba(255, 113, 136, 0.08);
			color: rgba(255, 210, 220, 0.94);
		}

		.assistant-status-shell.is-complete .assistant-loading-bubble {
			box-shadow: none;
		}

		.assistant-status-shell {
			display: grid;
			gap: 10px;
			padding: 0 0 2px;
		}

		.message-meta .assistant-loading-bubble {
			margin-left: 2px;
		}

		.assistant-status-summary {
			margin: 0;
			max-width: min(100%, 560px);
			color: rgba(233, 238, 255, 0.72);
			font-size: 12px;
			line-height: 1.4;
			text-align: left;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.chat-run-log-dialog[hidden] {
			display: none !important;
		}

		.chat-run-log-dialog {
			position: fixed;
			inset: 0;
			z-index: 40;
			display: grid;
			place-items: center;
			padding: 18px;
			background: rgba(1, 3, 10, 0.82);
		}

		.chat-run-log-dialog.open {
			display: grid;
		}

		.chat-run-log-panel {
			display: grid;
			grid-template-rows: auto minmax(0, 1fr);
			width: min(780px, 100%);
			max-height: min(78vh, 860px);
			border: 0;
			border-radius: 8px;
			background:
				linear-gradient(180deg, #121522 0%, #070914 42%, #04050d 100%),
				#060711;
			box-shadow: none;
		}

		.chat-run-log-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			padding: 14px 16px;
			border-bottom: 0;
			background: #101421;
			box-shadow: none;
		}

		.chat-run-log-head strong {
			font-size: 14px;
			letter-spacing: 0.04em;
		}

		.chat-run-log-close {
			width: 32px;
			height: 32px;
			padding: 0;
			border: 0;
			border-radius: 4px;
			background: #171a28;
			box-shadow: none;
			color: rgba(238, 244, 255, 0.72);
			font-size: 18px;
		}

		.chat-run-log-body {
			display: grid;
			align-content: start;
			gap: 12px;
			min-height: 0;
			overflow: auto;
			padding: 16px;
		}

		.chat-run-log-meta {
			color: rgba(233, 238, 255, 0.48);
			font-size: 11px;
			line-height: 1.6;
			word-break: break-word;
		}

		.chat-run-log-list {
			display: grid;
			gap: 10px;
		}

		.chat-run-log-item {
			display: grid;
			gap: 6px;
			padding: 12px;
			border: 0;
			border-radius: 4px;
			background: #0b0e19;
			box-shadow: none;
		}

		.chat-run-log-item-title {
			color: rgba(242, 246, 255, 0.92);
			font-size: 12px;
			line-height: 1.5;
		}

		.chat-run-log-item-detail {
			margin: 0;
			color: rgba(226, 234, 255, 0.66);
			font-family: var(--font-mono);
			font-size: 11px;
			line-height: 1.6;
			white-space: pre-wrap;
			word-break: break-word;
		}

		.chat-run-log-empty {
			padding: 14px;
			border: 0;
			border-radius: 4px;
			background: #0b0e19;
			color: rgba(226, 234, 255, 0.58);
			font-size: 12px;
			line-height: 1.6;
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

		.message-body > .message-actions {
			display: flex;
			justify-content: flex-end;
			gap: 8px;
			margin-top: 8px;
		}

		.message-copy-button,
		.message-image-export-button {
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
		.message-copy-button:focus-visible,
		.message-image-export-button:hover:not(:disabled),
		.message-image-export-button:focus-visible {
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

		.message-image-export-button svg {
			width: 14px;
			height: 14px;
			stroke: currentColor;
		}

		.message-export-scratch {
			position: fixed;
			left: -10000px;
			top: 0;
			z-index: -1;
			pointer-events: none;
		}

		.message-export-frame {
			display: grid;
			gap: 10px;
			padding: 14px;
			border-radius: 8px;
			background:
				linear-gradient(180deg, #121522 0%, #070914 42%, #04050d 100%),
				#060711;
			color: var(--fg);
			box-shadow: none;
		}

		.message-export-frame > .message-body {
			background: #0b0e19;
			box-shadow: none;
		}

		.message-export-frame .message-actions {
			display: none !important;
		}

		.export-signature {
			justify-self: end;
			padding: 5px 7px;
			border-radius: 4px;
			background: #101421;
			color: rgba(238, 244, 255, 0.62);
			font-size: 10px;
			font-weight: 700;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		.message-export-media-placeholder {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			max-width: 100%;
			min-height: 38px;
			padding: 8px 10px;
			border-radius: 4px;
			background: rgba(201, 210, 255, 0.08);
			color: rgba(226, 234, 255, 0.68);
			font-size: 11px;
			line-height: 1.4;
		}

		.message.assistant .message-body {
			display: grid;
			gap: 14px;
		}


		.composer {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 168px;
			gap: 10px;
			padding: 12px 0 14px;
			border: 0;
			border-radius: 4px;
			background: rgba(102, 93, 138, 0.16);
			outline: 1px solid transparent;
			outline-offset: 2px;
			box-shadow: none;
			align-items: end;
			flex-shrink: 0;
			transition:
				background 120ms ease,
				border-color 120ms ease,
				outline-color 120ms ease;
		}

		.composer:focus-within {
			border-color: rgba(201, 210, 255, 0.34);
			background: rgba(102, 93, 138, 0.2);
			outline: 1px solid var(--accent);
			outline-offset: 2px;
			box-shadow: none;
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
				background 120ms ease;
		}

		.composer textarea {
			--composer-line-height: 22px;
			--composer-textarea-max-lines: 10;
			min-height: 52px;
			max-height: calc(var(--composer-line-height) * var(--composer-textarea-max-lines) + 30px);
			resize: none;
			line-height: var(--composer-line-height);
			overflow-y: auto;
			padding-top: 14px;
			padding-bottom: 14px;
			box-shadow: none;
		}

		.composer textarea::placeholder {
			line-height: var(--composer-line-height);
		}

		.composer textarea:focus,
		.composer input:focus,
		.composer select:focus {
			outline: none;
			border-color: rgba(255, 255, 255, 0.12);
			background: rgba(255, 255, 255, 0.045);
			box-shadow: none;
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
			display: none;
		}

		.context-usage-shell {
			position: relative;
			display: inline-grid;
			grid-template-columns: 48px auto;
			align-items: center;
			gap: 7px;
			width: 82px;
			height: 28px;
			padding: 5px 7px;
			border: 1px solid rgba(201, 210, 255, 0.1);
			border-radius: 4px;
			background: rgba(9, 12, 22, 0.72);
			color: rgba(247, 249, 255, 0.9);
			box-shadow: none;
		}

		.context-usage-shell:hover,
		.context-usage-shell:focus-visible,
		.context-usage-shell[data-expanded="true"] {
			border-color: rgba(201, 210, 255, 0.28);
			background: rgba(14, 18, 31, 0.96);
		}

		.context-usage-battery {
			position: relative;
			display: block;
			width: 48px;
			height: 13px;
			padding: 2px;
			border: 1px solid rgba(201, 210, 255, 0.22);
			border-radius: 4px;
			background: rgba(255, 255, 255, 0.035);
			overflow: hidden;
		}

		.context-usage-battery::after {
			content: "";
			position: absolute;
			top: 3px;
			right: 2px;
			bottom: 3px;
			width: 2px;
			border-radius: 1px;
			background: rgba(201, 210, 255, 0.22);
		}

		.context-usage-progress {
			--context-usage-percent: 0%;
			display: block;
			width: var(--context-usage-percent);
			height: 100%;
			max-width: 100%;
			border-radius: 2px;
			background:
				repeating-linear-gradient(
					90deg,
					rgba(143, 255, 199, 0.96) 0 5px,
					transparent 5px 7px
				);
			transition: width 160ms ease, background 160ms ease;
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
			box-shadow: none;
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
			background:
				repeating-linear-gradient(
					90deg,
					rgba(255, 214, 125, 0.96) 0 5px,
					transparent 5px 7px
				);
		}

		.context-usage-shell[data-status="warning"] .context-usage-progress {
			background:
				repeating-linear-gradient(
					90deg,
					rgba(255, 156, 92, 0.98) 0 5px,
					transparent 5px 7px
				);
		}

		.context-usage-shell[data-status="danger"] .context-usage-progress {
			background:
				repeating-linear-gradient(
					90deg,
					rgba(255, 113, 136, 1) 0 5px,
					transparent 5px 7px
				);
		}

		.context-usage-dialog[hidden] {
			display: none !important;
		}

		.context-usage-dialog {
			position: fixed;
			inset: 0;
			z-index: 70;
			display: none;
			align-items: flex-start;
			justify-content: center;
			padding: 70px 18px 18px;
			background: rgba(1, 3, 10, 0.72);
			backdrop-filter: none;
		}

		.context-usage-dialog.open {
			display: flex;
		}

		.context-usage-dialog-panel {
			width: min(430px, 100%);
			padding: 10px;
			border: 0;
			border-radius: 8px;
			background:
				linear-gradient(180deg, #121522 0%, #070914 38%, #04050d 100%),
				#060711;
			box-shadow: none;
		}

		.context-usage-dialog-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			margin: 0;
			padding: 6px 6px 10px 8px;
			border-radius: 0;
			background: transparent;
		}

		.context-usage-dialog-head strong {
			color: rgba(219, 226, 246, 0.66);
			font-size: 10px;
			letter-spacing: 0.18em;
			text-transform: uppercase;
		}

		.context-usage-dialog-close {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 34px;
			height: 34px;
			padding: 0;
			border: 0;
			border-radius: 6px;
			background: #171a28;
			box-shadow: none;
			color: rgba(238, 244, 255, 0.72);
			font-size: 18px;
			line-height: 1;
		}

		.context-usage-dialog-close:hover:not(:disabled),
		.context-usage-dialog-close:focus-visible {
			background: #202438;
			color: #f7f9ff;
			box-shadow: none;
			transform: none;
		}

		.context-usage-dialog-body {
			display: grid;
			gap: 10px;
			padding: 0;
			border: 0;
			border-radius: 0;
			background: transparent;
			color: rgba(225, 232, 247, 0.78);
			font-size: 12px;
			line-height: 1.55;
			white-space: normal;
		}

		.context-usage-dialog-hero {
			display: grid;
			gap: 10px;
			padding: 14px;
			border-radius: 8px;
			background:
				linear-gradient(180deg, #151a2b 0%, #0d1220 100%),
				#101421;
			box-shadow: none;
		}

		.context-usage-dialog-kicker {
			color: rgba(222, 230, 255, 0.46);
			font-size: 10px;
			font-weight: 700;
			letter-spacing: 0.16em;
			text-transform: uppercase;
		}

		.context-usage-dialog-main {
			display: flex;
			align-items: flex-end;
			justify-content: space-between;
			gap: 12px;
		}

		.context-usage-dialog-main strong {
			color: #f6f8ff;
			font-family: var(--font-mono);
			font-size: 44px;
			font-weight: 700;
			line-height: 0.9;
			letter-spacing: 0;
		}

		.context-usage-dialog-main span {
			margin-bottom: 2px;
			padding: 6px 8px;
			border-radius: 6px;
			background: rgba(141, 255, 178, 0.1);
			color: rgba(173, 255, 201, 0.92);
			font-size: 11px;
			font-weight: 700;
			letter-spacing: 0.04em;
		}

		.context-usage-dialog[data-status="caution"] .context-usage-dialog-main span {
			background: rgba(255, 209, 102, 0.12);
			color: rgba(255, 222, 145, 0.96);
		}

		.context-usage-dialog[data-status="warning"] .context-usage-dialog-main span {
			background: rgba(255, 156, 92, 0.13);
			color: rgba(255, 190, 147, 0.96);
		}

		.context-usage-dialog[data-status="danger"] .context-usage-dialog-main span {
			background: rgba(255, 113, 136, 0.14);
			color: rgba(255, 190, 202, 0.96);
		}

		.context-usage-dialog-meter {
			position: relative;
			height: 8px;
			overflow: hidden;
			border-radius: 999px;
			background: #050710;
		}

		.context-usage-dialog-meter span {
			display: block;
			height: 100%;
			max-width: 100%;
			border-radius: inherit;
			background: linear-gradient(90deg, #8dffb2, #c9d2ff);
			box-shadow: none;
		}

		.context-usage-dialog[data-status="caution"] .context-usage-dialog-meter span {
			background: linear-gradient(90deg, #ffd166, #fff0b8);
			box-shadow: none;
		}

		.context-usage-dialog[data-status="warning"] .context-usage-dialog-meter span {
			background: linear-gradient(90deg, #ff9c5c, #ffd166);
			box-shadow: none;
		}

		.context-usage-dialog[data-status="danger"] .context-usage-dialog-meter span {
			background: linear-gradient(90deg, #ff7188, #ffb1bf);
			box-shadow: none;
		}

		.context-usage-dialog-hero p {
			margin: 0;
			color: rgba(222, 230, 255, 0.58);
			font-family: var(--font-mono);
			font-size: 11px;
			letter-spacing: 0;
		}

		.context-usage-dialog-metrics {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 8px;
		}

		.context-usage-dialog-metric {
			display: grid;
			gap: 5px;
			min-width: 0;
			padding: 10px;
			border-radius: 8px;
			background: #0b0e19;
			box-shadow: none;
		}

		.context-usage-dialog-metric span {
			color: rgba(222, 230, 255, 0.44);
			font-size: 10px;
			letter-spacing: 0.1em;
			text-transform: uppercase;
		}

		.context-usage-dialog-metric strong {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			color: rgba(246, 249, 255, 0.94);
			font-family: var(--font-mono);
			font-size: 17px;
			letter-spacing: 0;
		}

		.context-usage-dialog-metric em {
			color: rgba(222, 230, 255, 0.42);
			font-size: 10px;
			font-style: normal;
		}

		.context-usage-dialog-model {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			padding: 8px;
			border-radius: 8px;
			background: #080a13;
		}

		.context-usage-dialog-model span {
			min-width: 0;
			max-width: 100%;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			padding: 6px 8px;
			border-radius: 6px;
			background: #121522;
			color: rgba(222, 230, 255, 0.64);
			font-size: 10px;
			line-height: 1.2;
		}

		.confirm-dialog[hidden] {
			display: none !important;
		}

		.confirm-dialog {
			position: fixed;
			inset: 0;
			z-index: 88;
			display: none;
			align-items: center;
			justify-content: center;
			padding: 18px;
			background: rgba(3, 5, 10, 0.72);
		}

		.confirm-dialog.open {
			display: flex;
		}

		.confirm-dialog-panel {
			width: min(420px, 100%);
			display: grid;
			gap: 14px;
			padding: 16px;
			border: 0;
			border-radius: 8px;
			background:
				linear-gradient(180deg, #121522 0%, #070914 42%, #04050d 100%),
				#060711;
			box-shadow: none;
		}

		.confirm-dialog-head strong {
			display: block;
			color: rgba(247, 249, 255, 0.94);
			font-size: 13px;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		.confirm-dialog-body {
			color: rgba(225, 232, 247, 0.76);
			font-size: 12px;
			line-height: 1.8;
			white-space: pre-line;
		}

		.confirm-dialog-actions {
			display: flex;
			justify-content: flex-end;
			gap: 10px;
		}

		${getConnRunDetailsStyles()}
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
			box-shadow: none;
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

		${getPlaygroundAssetBaseStyles()}
		${getConnManagerActivityStyles()}
		${getPlaygroundTaskInboxStyles()}

		${getPlaygroundAssetModalStyles()}

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

		.hero-wordmark {
			font-family: var(--font-mono);
			font-weight: 700;
			text-transform: uppercase;
			font-smooth: never;
			-webkit-font-smoothing: none;
			text-rendering: optimizeSpeed;
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
			grid-template-columns: 1fr;
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
			text-shadow: none;
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
			position: relative;
			right: auto;
			top: auto;
			z-index: 1;
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			align-items: center;
			justify-content: center;
			justify-self: center;
			width: min(720px, 100%);
			max-width: min(720px, calc(100% - 48px));
			margin: 0 auto;
			padding: 5px 92px;
			border: 1px solid rgba(201, 210, 255, 0.08);
			border-radius: 4px;
			background: rgba(5, 7, 13, 0.78);
			box-shadow: none;
			transform: none;
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

		.topbar-context-slot {
			position: absolute;
			top: 50%;
			right: 5px;
			z-index: 5;
			display: flex;
			align-items: center;
			justify-content: flex-end;
			flex: 0 0 auto;
			margin-left: 0;
			transform: translateY(-50%);
			background: transparent;
			box-shadow: none;
		}

		.desktop-conversation-rail {
			grid-column: 1;
			grid-row: 2;
			display: grid;
			grid-template-rows: auto minmax(0, 1fr);
			min-height: 0;
			margin: 0 0 12px;
			padding: 12px;
			border: 1px solid rgba(201, 210, 255, 0.1);
			border-radius: 4px;
			background:
				radial-gradient(circle at 20% 0%, rgba(101, 209, 255, 0.08), transparent 32%),
				rgba(5, 7, 13, 0.72);
			box-shadow: none;
			overflow: hidden;
		}

		.desktop-conversation-rail-head {
			display: flex;
			align-items: flex-end;
			justify-content: space-between;
			gap: 10px;
			padding: 2px 2px 10px;
			border-bottom: 1px solid rgba(201, 210, 255, 0.08);
		}

		.desktop-conversation-rail-head strong {
			color: rgba(246, 249, 255, 0.94);
			font-size: 12px;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		.desktop-conversation-rail-head span {
			color: rgba(226, 234, 255, 0.44);
			font-size: 10px;
			white-space: nowrap;
		}

		.desktop-conversation-list {
			display: grid;
			align-content: start;
			gap: 8px;
			min-height: 0;
			padding: 10px 0 0;
			overflow-y: auto;
			overflow-x: hidden;
			scrollbar-width: thin;
			scrollbar-color: rgba(201, 210, 255, 0.18) transparent;
		}

		.desktop-conversation-list::-webkit-scrollbar {
			width: 4px;
		}

		.desktop-conversation-list::-webkit-scrollbar-thumb {
			background: rgba(201, 210, 255, 0.18);
		}

		.desktop-conversation-list .mobile-conversation-empty,
		.desktop-conversation-list .mobile-conversation-item {
			border-radius: 4px;
		}

		.desktop-conversation-list .mobile-conversation-item {
			min-height: 86px;
			background: rgba(8, 11, 20, 0.72);
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
			display: none;
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
			box-shadow: none;
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

		${getPlaygroundAssetLandingStyles()}

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
				gap: 5px;
				max-width: calc(100% - 32px);
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
				grid-template-columns: minmax(0, 1fr);
				--transcript-bottom-scroll-buffer: calc(112px + env(safe-area-inset-bottom));
			}

			.topbar {
				grid-template-columns: 1fr;
				width: 100%;
				padding: max(8px, env(safe-area-inset-top)) 12px 6px;
				min-height: 48px;
				gap: 0;
				border-bottom: 0;
				background: transparent;
				box-shadow: none;
				backdrop-filter: none;
			}

			.mobile-topbar {
				display: grid;
				grid-template-columns: auto minmax(0, 1fr) auto auto;
				gap: 8px;
				min-height: 48px;
			}

			.topbar-context-slot {
				position: absolute;
				top: max(15px, calc(env(safe-area-inset-top) + 15px));
				right: 100px;
				margin-left: 0;
				transform: none;
			}

			.topbar-context-slot .context-usage-shell,
			.topbar-context-slot .context-usage-shell:hover,
			.topbar-context-slot .context-usage-shell:focus-visible,
			.topbar-context-slot .context-usage-shell[data-expanded="true"] {
				border-color: transparent;
				background: transparent;
				box-shadow: none;
			}

			.context-usage-shell {
				width: 72px;
				height: 34px;
				grid-template-columns: 38px auto;
				gap: 5px;
				padding: 6px 7px;
			}

			.context-usage-battery {
				width: 38px;
				height: 12px;
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
				display: contents;
			}

			.landing-side-right > .telemetry-action {
				display: none;
			}

			.desktop-conversation-rail {
				display: none;
			}

			.chat-stage {
				grid-column: auto;
				grid-row: auto;
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
				text-shadow: none;
			}

			.file-strip {
				gap: 6px;
			}

			.context-usage-summary {
				font-size: 8px;
			}

			.context-usage-meta {
				display: none;
			}

			.context-usage-dialog {
				align-items: flex-start;
				padding: calc(58px + env(safe-area-inset-top)) 8px 10px;
				background: rgba(1, 3, 10, 0.86);
			}

			.context-usage-dialog-panel {
				width: 100%;
				padding: 10px;
				border: 0;
				border-radius: 8px;
				background:
					linear-gradient(180deg, #121522 0%, #070914 38%, #04050d 100%),
					#060711;
				box-shadow: none;
			}

			.context-usage-dialog-head {
				margin-bottom: 0;
				padding: 6px 6px 10px 8px;
				border-bottom: 0;
			}

			.context-usage-dialog-body {
				gap: 10px;
				padding: 0;
				border: 0;
				border-radius: 0;
				background: transparent;
				color: rgba(238, 244, 255, 0.78);
			}

			.context-usage-dialog-hero,
			.context-usage-dialog-metric,
			.context-usage-dialog-model {
				border-radius: 8px;
			}

			.context-usage-dialog-main strong {
				font-size: 42px;
			}

			${getPlaygroundAssetMobileStyles()}

			.composer {
				grid-template-columns: minmax(0, 1fr) auto;
				gap: 8px;
				padding: 8px 8px 8px 10px;
				border: 1px solid rgba(201, 210, 255, 0.08);
				border-radius: 4px;
				background: rgba(8, 10, 19, 0.98);
				box-shadow: none;
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
				box-shadow: none;
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

			.message.assistant .message-meta {
				gap: 6px;
			}

			.message.assistant .assistant-status-shell {
				padding: 0 2px;
				gap: 0;
			}

			.message.assistant .assistant-status-summary {
				max-width: 100%;
				color: rgba(238, 244, 255, 0.52);
				font-size: 11px;
				line-height: 1.45;
			}

			.message.assistant .message-meta .assistant-loading-bubble {
				height: 24px;
				min-width: 24px;
				padding: 0 7px;
				gap: 5px;
				border: 0;
				background: transparent;
				box-shadow: none;
			}

			.message.assistant .message-meta .assistant-run-log-hint {
				display: none;
			}

			.message.assistant .message-meta .assistant-loading-dot {
				width: 4px;
				height: 4px;
			}

			.message-body > .message-actions {
				padding: 0 2px 0 0;
			}

			.message-copy-button,
			.message-image-export-button {
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
			.conn-editor-field input,
			.conn-editor-field select,
			.conn-editor-field textarea,
			.asset-modal-search input,
			.error-banner,
			.error-banner-close,
			.assistant-loading-card,
			.assistant-status-shell,
			.history-auto-load-status {
				border-radius: 4px !important;
			}

			.conn-editor-grid {
				grid-template-columns: minmax(0, 1fr);
			}
		}

		${getPlaygroundThemeStyles()}
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

function getPlaygroundScript(): string {
	return `
		${getBrowserMarkdownRendererScript()}

		const CONVERSATION_HISTORY_INDEX_KEY = "ugk-pi:conversation-history-index";
		const TRANSCRIPT_FOLLOW_THRESHOLD_PX = 120;
		const MAX_STORED_CONVERSATIONS = 12;
		const MAX_STORED_MESSAGES_PER_CONVERSATION = 160;
		const MAX_ARCHIVED_TRANSCRIPTS = 4;
		${getPlaygroundContextUsageConstantsScript()}
		${getPlaygroundLayoutConstantsScript()}
		const CONTEXT_STATUS_LABELS = {
			safe: "上下文充足",
			caution: "接近提醒线",
			warning: "接近上限",
			danger: "建议新会话",
		};

		${getConnActivityConstantsScript()}

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
			theme: "dark",
			stageMode: "landing",
			conversationId: "",
			streamingText: "",
			activeAssistantContent: null,
			activeStatusShell: null,
			activeStatusSummary: null,
			activeLoadingShell: null,
			activeLoadingDots: null,
			activeRunLogTrigger: null,
			activeRunId: "",
			lastProcessNarration: "",
			receivedDoneEvent: false,
			composerUploadingAssets: false,
			recentAssets: [],
			assetDetailQueue: [],
			assetDetailInFlightById: new Map(),
			assetDetailActiveCount: 0,
			selectedAssetRefs: [],
			connEditorSelectedAssetRefs: [],
			connEditorUploadingAssets: false,
			assetPickerTarget: "composer",
			contextUsage: null,
			contextUsageExpanded: false,
			contextUsageSyncToken: 0,
			dragDepth: 0,
			assetModalOpen: false,
			taskInboxItems: [],
			taskInboxOpen: false,
			taskInboxLoading: false,
			taskInboxError: "",
			taskInboxUnreadCount: 0,
			taskInboxMarkingRead: false,
			taskInboxFilter: "unread",
			taskInboxHasMore: false,
			taskInboxNextBefore: "",
			taskInboxLoadingMore: false,
			connManagerOpen: false,
			connManagerItems: [],
			connManagerRunsByConnId: {},
			connManagerRunsLoadedByConnId: {},
			connManagerRunsLoadingByConnId: {},
			connManagerExpandedRunConnIds: [],
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
			assetModalRestoreFocusElement: null,
			taskInboxRestoreFocusElement: null,
			chatRunLogRestoreFocusElement: null,
			connManagerRestoreFocusElement: null,
			connEditorRestoreFocusElement: null,
			connRunDetailsRestoreFocusElement: null,
			mobileOverflowMenuOpen: false,
			mobileConversationDrawerOpen: false,
			conversationCatalog: [],
			conversationCatalogSyncing: false,
			conversationCatalogSyncPromise: null,
			conversationCatalogAbortController: null,
			conversationCatalogSyncedAt: 0,
			conversationCreatePending: false,
			conversationSwitchPendingById: {},
			conversationSyncGeneration: 0,
			conversationSyncRequestId: 0,
			conversationAppliedSyncRequestId: 0,
			conversationStateAbortController: null,
			conversationState: null,
			conversationHistory: [],
			renderedConversationId: "",
			renderedConversationStateSignature: "",
			renderedHistoryCount: 0,
			historyPageSize: 12,
			historyLoadingMore: false,
			historyHasMore: false,
			historyNextBefore: "",
			activeRunEventController: null,
			notificationEventSource: null,
			notificationReconnectTimer: null,
			notificationReconnectDelayMs: 0,
			pageUnloading: false,
			skipNextPageShowResumeSync: true,
			primaryStreamActive: false,
			autoFollowTranscript: true,
			layoutSyncRaf: 0,
			layoutSyncTimer: null,
			resumeSyncPromise: null,
			resumeSyncTimer: null,
			resumeSyncPendingOptions: null,
			lastResumeSyncAt: 0,
			lastConversationStateSyncAt: 0,
			transcriptScrollRaf: 0,
			transcriptScrollTimer: null,
			lastTranscriptScrollAt: 0,
			historyPersistTimer: null,
			historyPersistConversationId: "",
			confirmDialogResolve: null,
			confirmDialogRestoreFocusElement: null,
		};

		const renderedMessages = new Map();

		const transcript = document.getElementById("transcript");
		const transcriptArchive = document.getElementById("transcript-archive");
		const transcriptCurrent = document.getElementById("transcript-current");
		const historyAutoLoadStatus = document.getElementById("history-auto-load-status");
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
		${getPlaygroundAssetElementRefsScript()}
		${getPlaygroundContextUsageElementRefsScript()}
		${getPlaygroundTaskInboxElementRefsScript()}
		${getConnActivityElementRefsScript()}
		const chatRunLogDialog = document.getElementById("chat-run-log-dialog");
		const chatRunLogTitle = document.getElementById("chat-run-log-title");
		const chatRunLogBody = document.getElementById("chat-run-log-body");
		const chatRunLogClose = document.getElementById("chat-run-log-close");
		const confirmDialog = document.getElementById("confirm-dialog");
		const confirmDialogTitle = document.getElementById("confirm-dialog-title");
		const confirmDialogBody = document.getElementById("confirm-dialog-body");
		const confirmDialogConfirm = document.getElementById("confirm-dialog-confirm");
		const confirmDialogCancel = document.getElementById("confirm-dialog-cancel");
		const openAssetLibraryButton = document.getElementById("open-asset-library-button");
		const assetModal = document.getElementById("asset-modal");
		const assetModalList = document.getElementById("asset-modal-list");
		const closeAssetModalButton = document.getElementById("close-asset-modal-button");
		const refreshAssetsButton = document.getElementById("refresh-assets-button");
		const sendButton = document.getElementById("send-button");
		const interruptButton = document.getElementById("interrupt-button");
		const viewSkillsButton = document.getElementById("view-skills-button");
		const newConversationButton = document.getElementById("new-conversation-button");
		${getPlaygroundMobileShellElementRefsScript()}
		const topbarContextSlot = document.querySelector(".topbar-context-slot");
		if (topbarContextSlot?.parentElement === mobileTopbar) {
			mobileTopbar.after(topbarContextSlot);
		}
		const statusPill = document.getElementById("status-pill");
		const commandStatus = document.getElementById("command-status");

		messageInput.placeholder = "和我聊聊吧";

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

		confirmDialogConfirm.addEventListener("click", () => {
			closeConfirmDialog(true);
		});
		confirmDialogCancel.addEventListener("click", () => {
			closeConfirmDialog(false);
		});
		confirmDialog.addEventListener("click", (event) => {
			if (event.target === confirmDialog) {
				closeConfirmDialog(false);
			}
		});
		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && confirmDialog.classList.contains("open")) {
				event.preventDefault();
				closeConfirmDialog(false);
			}
		});

		${getPlaygroundContextUsageControllerScript()}

		${getConnActivityEditorScript()}

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


		${getPlaygroundLayoutControllerScript()}

		function setCommandStatus(next) {
			shell.dataset.commandState = String(next || "standby").toLowerCase();
			newConversationButton.dataset.state = shell.dataset.commandState;
		}

		${getPlaygroundMobileShellControllerScript()}
		${getPlaygroundThemeControllerScript()}

		${getPlaygroundConversationControllerScript()}

		${getPlaygroundTranscriptRendererScript()}

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
			newConversationButton.disabled = next || state.conversationCreatePending;
			mobileNewConversationButton.disabled = next || state.conversationCreatePending;
			mobileOverflowMenuButton.disabled = false;
			mobileMenuSkillsButton.disabled = next;
			mobileMenuFileButton.disabled = false;
			mobileMenuLibraryButton.disabled = next;
			mobileMenuTaskInboxButton.disabled = false;
			mobileMenuConnButton.disabled = false;
			openAssetLibraryButton.disabled = next;
			openTaskInboxButton.disabled = false;
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
			const notificationId =
				typeof rawEvent.notificationId === "string"
					? rawEvent.notificationId.trim()
					: typeof rawEvent.activityId === "string"
						? rawEvent.activityId.trim()
						: "";
			const conversationId = typeof rawEvent.conversationId === "string" ? rawEvent.conversationId.trim() : "";
			const source = typeof rawEvent.source === "string" ? rawEvent.source.trim() : "";
			const sourceId = typeof rawEvent.sourceId === "string" ? rawEvent.sourceId.trim() : "";
			const kind = typeof rawEvent.kind === "string" ? rawEvent.kind.trim() : "";
			const title = typeof rawEvent.title === "string" ? rawEvent.title.trim() : "";
			const createdAt = typeof rawEvent.createdAt === "string" ? rawEvent.createdAt.trim() : "";
			const runId = typeof rawEvent.runId === "string" ? rawEvent.runId.trim() : "";
			if (!notificationId || !source || !sourceId || !kind || !title || !createdAt) {
				return null;
			}
			return {
				notificationId,
				conversationId: conversationId || undefined,
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

		async function fetchConversationState(conversationId, options) {
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

			const stateUrl =
				"/v1/chat/state?conversationId=" +
				encodeURIComponent(nextConversationId) +
				"&viewLimit=" +
				encodeURIComponent(String(MAX_STORED_MESSAGES_PER_CONVERSATION));
			const response = await fetch(stateUrl, {
				method: "GET",
				headers: { accept: "application/json" },
				signal: options?.signal,
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
				viewMessages: Array.isArray(payload?.viewMessages) ? payload.viewMessages : [],
				activeRun: normalizeActiveRun(payload?.activeRun),
				historyPage:
					payload?.historyPage && typeof payload.historyPage === "object"
						? {
								hasMore: Boolean(payload.historyPage.hasMore),
								nextBefore:
									typeof payload.historyPage.nextBefore === "string"
										? payload.historyPage.nextBefore
										: "",
								limit: Number.isFinite(payload.historyPage.limit)
									? payload.historyPage.limit
									: MAX_STORED_MESSAGES_PER_CONVERSATION,
							}
						: {
								hasMore: false,
								nextBefore: "",
								limit: MAX_STORED_MESSAGES_PER_CONVERSATION,
							},
				updatedAt: typeof payload?.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
			};
		}

		async function fetchConversationHistoryPage(conversationId, options) {
			const nextConversationId = String(conversationId || "").trim();
			if (!nextConversationId) {
				return {
					conversationId: "",
					messages: [],
					hasMore: false,
					nextBefore: "",
					limit: MAX_STORED_MESSAGES_PER_CONVERSATION,
				};
			}

			const params = new URLSearchParams();
			params.set("conversationId", nextConversationId);
			params.set("limit", String(options?.limit || MAX_STORED_MESSAGES_PER_CONVERSATION));
			const before = String(options?.before || "").trim();
			if (before) {
				params.set("before", before);
			}

			const response = await fetch("/v1/chat/history?" + params.toString(), {
				method: "GET",
				headers: { accept: "application/json" },
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法获取更早的对话历史";
				throw new Error(errorMessage);
			}

			return {
				conversationId: payload?.conversationId || nextConversationId,
				messages: Array.isArray(payload?.messages) ? payload.messages : [],
				hasMore: Boolean(payload?.hasMore),
				nextBefore: typeof payload?.nextBefore === "string" ? payload.nextBefore : "",
				limit: Number.isFinite(payload?.limit) ? payload.limit : MAX_STORED_MESSAGES_PER_CONVERSATION,
			};
		}

		function abortConversationStateSync() {
			const abortController = state.conversationStateAbortController;
			state.conversationStateAbortController = null;
			if (abortController && !abortController.signal.aborted) {
				abortController.abort();
			}
		}

		function releaseConversationStateSyncToken(syncToken) {
			if (syncToken?.abortController && state.conversationStateAbortController === syncToken.abortController) {
				state.conversationStateAbortController = null;
			}
		}

		function isConversationStateAbortError(error) {
			return (
				error?.name === "AbortError" ||
				error?.code === 20 ||
				(typeof error?.message === "string" && error.message.toLowerCase().includes("abort"))
			);
		}

		function invalidateConversationSyncOwnership(nextConversationId) {
			const normalizedConversationId = String(nextConversationId || "").trim();
			if (normalizedConversationId && normalizedConversationId === String(state.conversationId || "").trim()) {
				return;
			}
			abortConversationStateSync();
			state.conversationSyncGeneration += 1;
			state.conversationAppliedSyncRequestId = 0;
		}

		function issueConversationSyncToken(conversationId) {
			const nextConversationId = String(conversationId || "").trim();
			abortConversationStateSync();
			const abortController = typeof AbortController === "function" ? new AbortController() : null;
			state.conversationStateAbortController = abortController;
			const requestId = state.conversationSyncRequestId + 1;
			state.conversationSyncRequestId = requestId;
			return {
				requestId,
				generation: state.conversationSyncGeneration,
				conversationId: nextConversationId,
				abortController,
			};
		}

		function isConversationSyncTokenCurrent(syncToken, conversationId) {
			if (!syncToken || typeof syncToken !== "object") {
				return false;
			}
			const nextConversationId = String(conversationId || syncToken.conversationId || "").trim();
			if (!nextConversationId) {
				return false;
			}
			return (
				syncToken.generation === state.conversationSyncGeneration &&
				nextConversationId === String(state.conversationId || "").trim() &&
				syncToken.requestId >= state.conversationAppliedSyncRequestId
			);
		}

		function shouldApplyConversationState(conversationState, syncToken) {
			const nextConversationId = String(
				conversationState?.conversationId || syncToken?.conversationId || state.conversationId || "",
			).trim();
			if (!nextConversationId) {
				return false;
			}
			if (!state.conversationId) {
				return true;
			}
			if (nextConversationId !== state.conversationId) {
				return false;
			}
			if (!syncToken) {
				return true;
			}
			return isConversationSyncTokenCurrent(syncToken, nextConversationId);
		}

		function reconcileSyncedConversationState(payload, conversationId, options) {
			const nextConversationId = String(conversationId || payload?.conversationId || "").trim();
			if (!nextConversationId) {
				return payload;
			}

			if (payload?.running) {
				if (options?.attachIfRunning !== false && !state.primaryStreamActive) {
					void attachActiveRunEventStream(nextConversationId);
				}
				return payload;
			}

			if (state.loading && options?.clearIfIdle) {
				stopActiveRunEventStream();
				setLoading(false);
			}
			return payload;
		}

		${getConnActivityApiScript()}


		async function syncConversationRunState(conversationId, options) {
			const nextConversationId = String(conversationId || "").trim();
			if (!nextConversationId) {
				state.contextUsage = null;
				renderContextUsageBar();
				return { conversationId: "", running: false, contextUsage: createFallbackContextUsage() };
			}

			const syncToken = issueConversationSyncToken(nextConversationId);
			try {
				const payload = await fetchConversationState(nextConversationId, {
					signal: syncToken.abortController?.signal,
				});
				if (!renderConversationState(payload, syncToken)) {
					return payload;
				}
				return reconcileSyncedConversationState(payload, nextConversationId, options);
			} catch (error) {
				if (isConversationStateAbortError(error)) {
					return {
						conversationId: nextConversationId,
						running: Boolean(state.loading),
						contextUsage: normalizeContextUsage(state.contextUsage),
					};
				}
				if (!isConversationSyncTokenCurrent(syncToken, nextConversationId)) {
					return {
						conversationId: nextConversationId,
						running: Boolean(state.loading),
						contextUsage: normalizeContextUsage(state.contextUsage),
					};
				}
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
			} finally {
				releaseConversationStateSyncToken(syncToken);
			}
		}

		function renderConversationState(conversationState, syncToken) {
			if (!shouldApplyConversationState(conversationState, syncToken)) {
				return false;
			}
			state.lastConversationStateSyncAt = Date.now();
			const nextConversationId = String(conversationState?.conversationId || state.conversationId || "").trim();
			const previousRenderedConversationId = state.renderedConversationId;
			const shouldPreserveTranscriptViewport =
				!state.autoFollowTranscript &&
				transcript.scrollHeight > transcript.clientHeight + TRANSCRIPT_FOLLOW_THRESHOLD_PX;
			const preservedTranscriptScrollTop = shouldPreserveTranscriptViewport ? transcript.scrollTop : null;
			if (syncToken?.requestId) {
				state.conversationAppliedSyncRequestId = Math.max(
					state.conversationAppliedSyncRequestId,
					syncToken.requestId,
				);
			}
			const activeRun = normalizeActiveRun(conversationState?.activeRun);
			state.conversationState = {
				...(conversationState || {}),
				conversationId: nextConversationId,
				activeRun,
			};
			const nextTranscriptSignature = buildConversationStateSignature(state.conversationState);
			state.activeRunId = activeRun?.runId || "";
			state.contextUsage = normalizeContextUsage(conversationState?.contextUsage);
			const rawViewMessages = Array.isArray(conversationState?.viewMessages)
				? conversationState.viewMessages
				: conversationState?.messages;
			state.conversationHistory = Array.isArray(rawViewMessages)
				? rawViewMessages.map(normalizeHistoryEntry).filter(Boolean)
				: [];
			state.historyHasMore = Boolean(conversationState?.historyPage?.hasMore);
			state.historyNextBefore =
				typeof conversationState?.historyPage?.nextBefore === "string"
					? conversationState.historyPage.nextBefore
					: "";
			let shouldRenderTranscript = true;
			if (nextTranscriptSignature === state.renderedConversationStateSignature && nextConversationId === state.renderedConversationId) {
				shouldRenderTranscript = false;
			}
			if (nextConversationId !== previousRenderedConversationId) {
				clearRenderedTranscript();
			}
			if (shouldRenderTranscript) {
				resetStreamingState();
				syncRenderedConversationHistory(state.conversationHistory);
				state.renderedConversationId = nextConversationId;
				state.renderedConversationStateSignature = nextTranscriptSignature;
			}
			state.activeRunId = activeRun?.runId || "";
			renderContextUsageBar();

			if (state.conversationHistory.length > 0) {
				setTranscriptState("active");
			}
			if (typeof preservedTranscriptScrollTop === "number") {
				const maxScrollTop = Math.max(0, transcript.scrollHeight - transcript.clientHeight);
				transcript.scrollTop = Math.min(preservedTranscriptScrollTop, maxScrollTop);
				state.lastTranscriptScrollAt = Date.now();
				state.autoFollowTranscript = false;
				updateScrollToBottomButton();
			}

			if (!activeRun) {
				if (state.conversationHistory.length === 0) {
					setTranscriptState("idle");
				}
				syncHistoryAutoLoadStatus();
				if (state.loading) {
					setLoading(false);
				}
				return true;
			}

			setTranscriptState("active");
			mergeRecentAssets(activeRun.input?.inputAssets || []);
			let rendered = findRenderedAssistantForActiveRun(activeRun);
			if (!rendered) {
				const knownEntry = state.conversationHistory.find((entry) => entry.id === activeRun.assistantMessageId);
				if (!knownEntry) {
					appendTranscriptMessage("assistant", "助手", activeRun.text || "", {
						id: activeRun.assistantMessageId,
						createdAt: activeRun.startedAt,
						runId: activeRun.runId,
					});
				}
				rendered = renderedMessages.get(activeRun.assistantMessageId);
			}
			if (rendered) {
				state.activeAssistantContent = rendered.content;
				applyProcessViewToRenderedMessage(activeRun.process, rendered, {
					activate: true,
					running: activeRun.loading,
				});
			}
			state.streamingText = activeRun.text || "";
			state.receivedDoneEvent = activeRun.status === "done";
			if (activeRun.loading) {
				setLoading(true);
				setAssistantLoadingState("\\u5f53\\u524d\\u6b63\\u5728\\u8fd0\\u884c", "system");
				statusPill.textContent = "\\u8fd0\\u884c\\u4e2d";
			} else {
				setLoading(false);
				statusPill.textContent =
					activeRun.status === "error"
						? "\\u9519\\u8bef"
						: activeRun.status === "interrupted"
							? "\\u5df2\\u6253\\u65ad"
							: "\\u5df2\\u7ed3\\u675f";
			}
			syncHistoryAutoLoadStatus();
			scrollTranscriptToBottom();
			return true;
		}

		function findRenderedAssistantForActiveRun(activeRun) {
			if (!activeRun) {
				return null;
			}

			const directRendered = renderedMessages.get(activeRun.assistantMessageId);
			if (directRendered) {
				return directRendered;
			}

			const runId = String(activeRun.runId || "").trim();
			if (runId) {
				const runEntry = state.conversationHistory.find(
					(entry) => entry.kind === "assistant" && String(entry.runId || "").trim() === runId,
				);
				if (runEntry) {
					const renderedByRunId = renderedMessages.get(runEntry.id);
					if (renderedByRunId) {
						return renderedByRunId;
					}
				}
			}

			const assistantText = String(activeRun.text || "").trim();
			if (assistantText) {
				const normalizedAssistantText = assistantText.replace(/\s+/g, " ");
				const textEntry = [...state.conversationHistory]
					.reverse()
					.find((entry) => {
						if (entry.kind !== "assistant") {
							return false;
						}
						const normalizedEntryText = String(entry.text || "")
							.trim()
							.replace(/\s+/g, " ");
						return (
							normalizedEntryText === normalizedAssistantText ||
							normalizedEntryText.includes(normalizedAssistantText)
						);
					});
				if (textEntry) {
					const renderedByText = renderedMessages.get(textEntry.id);
					if (renderedByText) {
						return renderedByText;
					}
				}
			}

			return null;
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



		function formatProcessViewEntry(entry) {
			const subject = entry.toolName ? entry.title + " 路 " + entry.toolName : entry.title;
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

			const storedHistory = state.conversationHistory.slice(-MAX_STORED_MESSAGES_PER_CONVERSATION);

			try {
				localStorage.setItem(
					getConversationHistoryStorageKey(conversationId),
					JSON.stringify(storedHistory),
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
				messageCount: storedHistory.length,
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

		${getConnActivityRendererScript()}
		${getPlaygroundTaskInboxControllerScript()}

		function hasOlderConversationHistory() {
			return state.renderedHistoryCount < state.conversationHistory.length || state.historyHasMore;
		}

		function syncHistoryAutoLoadStatus() {
			historyAutoLoadStatus.hidden = !state.historyLoadingMore;
			historyAutoLoadStatus.textContent = state.historyLoadingMore
				? "正在加载更早历史"
				: "";
		}

		async function fetchOlderConversationHistoryFromServer() {
			if (!state.historyHasMore || !state.historyNextBefore) {
				return false;
			}

			const conversationId = String(state.conversationId || "").trim();
			const before = state.historyNextBefore;
			const page = await fetchConversationHistoryPage(conversationId, {
				before,
				limit: MAX_STORED_MESSAGES_PER_CONVERSATION,
			});
			if (conversationId !== String(state.conversationId || "").trim()) {
				return false;
			}

			const existingIds = new Set(state.conversationHistory.map((entry) => entry.id));
			const olderEntries = page.messages
				.map(normalizeHistoryEntry)
				.filter(Boolean)
				.filter((entry) => !existingIds.has(entry.id));
			if (olderEntries.length > 0) {
				state.conversationHistory = olderEntries.concat(state.conversationHistory);
			}
			state.historyHasMore = Boolean(page.hasMore);
			state.historyNextBefore = typeof page.nextBefore === "string" ? page.nextBefore : "";
			return olderEntries.length > 0;
		}

		async function renderMoreConversationHistory() {
			if (state.historyLoadingMore) {
				return;
			}

			state.historyLoadingMore = true;
			syncHistoryAutoLoadStatus();
			try {
				let remaining = state.conversationHistory.length - state.renderedHistoryCount;
				if (remaining <= 0 && state.historyHasMore) {
					await fetchOlderConversationHistoryFromServer();
					remaining = state.conversationHistory.length - state.renderedHistoryCount;
				}
				if (remaining <= 0) {
					return;
				}

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
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "无法获取更早的对话历史";
				showError(messageText);
			} finally {
				state.historyLoadingMore = false;
				syncHistoryAutoLoadStatus();
			}
		}

		function restoreConversationHistory(conversationId) {
			state.conversationHistory = loadConversationHistoryEntries(conversationId);
			state.historyHasMore = false;
			state.historyNextBefore = "";
			state.renderedHistoryCount = 0;
			clearRenderedTranscript();

			if (state.conversationHistory.length === 0) {
				setTranscriptState("idle");
				syncHistoryAutoLoadStatus();
				return;
			}

			setTranscriptState("active");
			void renderMoreConversationHistory();
			scrollTranscriptToBottom();
		}

		async function restoreConversationHistoryFromServer(conversationId, options) {
			const nextConversationId = String(conversationId || "").trim();
			if (!nextConversationId) {
				return;
			}

			const syncToken = issueConversationSyncToken(nextConversationId);
			try {
				const payload = await fetchConversationState(nextConversationId, {
					signal: syncToken.abortController?.signal,
				});
				if (!renderConversationState(payload, syncToken)) {
					return payload;
				}
				reconcileSyncedConversationState(payload, nextConversationId, options);
				scheduleConversationHistoryPersist(nextConversationId);
				return payload;
			} catch (error) {
				if (isConversationStateAbortError(error)) {
					return;
				}
				if (!isConversationSyncTokenCurrent(syncToken, nextConversationId)) {
					return;
				}
				if (state.conversationHistory.length === 0 && !options?.silent) {
					const messageText = error instanceof Error ? error.message : "无法获取全局对话历史";
					showError(messageText);
				}
			} finally {
				releaseConversationStateSyncToken(syncToken);
			}
		}

		${getPlaygroundStreamControllerScript()}

		${getPlaygroundAssetControllerScript()}

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
			const detailSummary = summarizeDetail(detail).summary;
			return detailSummary && detailSummary !== "无详情" ? title + " · " + detailSummary : title;
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
				return "结果已经准备好了。";
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
			if (typeof isAttachmentLimitProcessNote === "function" && isAttachmentLimitProcessNote(title, detail)) {
				appendComposerSystemNotice("\\u4e00\\u6b21\\u6700\\u591a\\u53d1\\u9001 5 \\u4e2a\\u6587\\u4ef6\\uff0c\\u8d85\\u51fa\\u7684\\u6587\\u4ef6\\u8bf7\\u5206\\u6279\\u53d1\\u9001\\u3002");
				return;
			}
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

		function resetStreamingState() {
			state.streamingText = "";
			state.activeAssistantContent = null;
			state.activeStatusShell = null;
			state.activeStatusSummary = null;
			state.activeLoadingShell = null;
			state.activeLoadingDots = null;
			state.activeRunLogTrigger = null;
			state.activeRunId = "";
			state.lastProcessNarration = "";
			state.receivedDoneEvent = false;
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

		function bindPlaygroundAssemblerEvents() {
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
			${getPlaygroundAssetEventHandlersScript()}

			sendButton.addEventListener("click", () => {
				void sendMessage();
			});

			interruptButton.addEventListener("click", () => {
				void interruptRun();
			});

			viewSkillsButton.addEventListener("click", () => {
				void loadSkills();
			});


			${getPlaygroundTaskInboxEventHandlersScript()}
			${getConnActivityEventHandlersScript()}


			newConversationButton.addEventListener("click", () => {
				void startNewConversation().then((created) => {
					if (created) {
						messageInput.focus();
					}
				});
			});
			${getPlaygroundMobileShellEventHandlersScript()}

			errorBannerClose.addEventListener("click", () => {
				clearError();
			});
			${getPlaygroundContextUsageEventHandlersScript()}

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
							skipCatalogSync: true,
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
			document.addEventListener("keydown", (event) => {
				if (event.key === "Escape" && state.assetModalOpen) {
					closeAssetLibrary();
				}
				if (event.key === "Escape" && state.taskInboxOpen) {
					closeTaskInbox();
				}
				if (handleConnActivityPanelEscapeKey(event)) {
					return;
				}

				if (event.key === "Escape" && !contextUsageDialog.hidden) {
					closeContextUsageDialog();
				}
				handleConnRunDetailsEscapeKey(event);

				if (event.key === "Escape" && state.mobileOverflowMenuOpen) {
					closeMobileOverflowMenu();
				}
				if (event.key === "Escape" && state.mobileConversationDrawerOpen) {
					closeMobileConversationDrawer();
				}
			});

		}

		function initializePlaygroundAssembler() {
			conversationInput.value = state.conversationId;
			setStageMode("landing");
			setTranscriptState("idle");
			setCommandStatus("STANDBY");
			renderContextUsageBar();
			renderSelectedAssets();
			renderAssetPickerList();
			renderTaskInbox();
			renderTaskInboxToggleState();
			renderConnManager();
			void loadAssets(true);
			void syncTaskInboxSummary({ silent: true });

			resetStreamingState();
			clearError();
			void ensureCurrentConversation({ silent: true });
			bindPlaygroundLayoutController();
			bindPlaygroundTranscriptRenderer();
			bindPlaygroundStreamController();
			bindPlaygroundAssemblerEvents();
		}

		initializePlaygroundAssembler();
	`;
}

export function renderPlaygroundPage(): string {
	return `<!doctype html>
<html lang="zh-CN" data-theme="dark">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>UGK Claw</title>
		<link rel="icon" href="/ugk-claw-mobile-logo.png" />
		<link rel="stylesheet" href="/vendor/flatpickr/flatpickr.min.css" />
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
					<button id="open-task-inbox-button" class="telemetry-card telemetry-action telemetry-action-with-badge" type="button" aria-pressed="false">
						<span>&#21518;&#21488;&#20219;&#21153;&#32467;&#26524;&#32479;&#19968;&#25910;&#20214;&#31665;</span>
						<strong>&#20219;&#21153;&#28040;&#24687;</strong>
						<span id="task-inbox-unread-badge" class="telemetry-action-badge" hidden>0</span>
					</button>
					<button id="theme-toggle-button" class="telemetry-card telemetry-action theme-toggle-button" type="button" aria-pressed="false" aria-label="切换浅色主题" title="切换浅色主题">
						<span>界面别太死板</span>
						<strong id="theme-toggle-label">深色模式</strong>
						<span class="theme-toggle-icon theme-toggle-icon-sun" aria-hidden="true">
							<svg viewBox="0 0 24 24" fill="none">
								<circle cx="12" cy="12" r="4" stroke-width="1.8" />
								<path d="M12 2.8v2.4M12 18.8v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" stroke-width="1.8" stroke-linecap="round" />
							</svg>
						</span>
						<span class="theme-toggle-icon theme-toggle-icon-moon" aria-hidden="true">
							<svg viewBox="0 0 24 24" fill="none">
								<path d="M20 14.2A7.3 7.3 0 0 1 9.8 4a8.1 8.1 0 1 0 10.2 10.2Z" stroke-width="1.8" stroke-linejoin="round" />
							</svg>
						</span>
					</button>
					<div class="topbar-context-slot">
						<button id="context-usage-shell" class="context-usage-shell" type="button" data-status="safe" data-expanded="false" aria-label="&#19978;&#19979;&#25991;&#20351;&#29992; 0%" aria-describedby="context-usage-meta">
							<span class="context-usage-battery" aria-hidden="true">
								<span id="context-usage-progress" class="context-usage-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></span>
							</span>
							<span id="context-usage-summary" class="context-usage-summary">0%</span>
							<span id="context-usage-toggle" class="context-usage-toggle">&#19978;&#19979;&#25991;&#35814;&#24773;</span>
							<span id="context-usage-meta" class="context-usage-meta" role="tooltip">&#24403;&#21069;&#19978;&#19979;&#25991; 0 / 128,000 tokens (0%)</span>
						</button>
					</div>
				</aside>
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
					<template hidden>
					<div class="topbar-context-slot">
						<button id="context-usage-shell" class="context-usage-shell" type="button" data-status="safe" data-expanded="false" aria-label="涓婁笅鏂囦娇鐢?0%" aria-describedby="context-usage-meta">
							<span class="context-usage-battery" aria-hidden="true">
								<span id="context-usage-progress" class="context-usage-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></span>
							</span>
							<span id="context-usage-summary" class="context-usage-summary">0%</span>
							<span id="context-usage-toggle" class="context-usage-toggle">涓婁笅鏂囪鎯?/span>
							<span id="context-usage-meta" class="context-usage-meta" role="tooltip">褰撳墠涓婁笅鏂?0 / 128,000 tokens (0%)</span>
						</button>
					</div>
					</template>
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
						class="mobile-topbar-button mobile-topbar-button-with-badge"
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
						<span id="mobile-overflow-task-inbox-badge" class="mobile-topbar-notification-badge" hidden>0</span>
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
						<button id="mobile-menu-task-inbox-button" class="mobile-overflow-menu-item" type="button" role="menuitem" aria-pressed="false">
							<span class="mobile-overflow-menu-item-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none">
									<path d="M5 7h14M5 12h14M5 17h9" stroke-width="1.8" stroke-linecap="round" />
									<path d="M4 4v16" stroke-width="1.8" stroke-linecap="round" />
								</svg>
							</span>
							<span>&#20219;&#21153;&#28040;&#24687;</span>
							<span id="mobile-task-inbox-unread-badge" class="mobile-overflow-menu-item-badge" hidden>0</span>
						</button>
						<button id="mobile-menu-theme-button" class="mobile-overflow-menu-item" type="button" role="menuitem" aria-pressed="false" aria-label="切换浅色主题" title="切换浅色主题">
							<span class="mobile-overflow-menu-item-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none">
									<path d="M12 3a9 9 0 1 0 9 9 6.5 6.5 0 0 1-9-9Z" stroke-width="1.8" stroke-linejoin="round" />
								</svg>
							</span>
							<span id="mobile-theme-toggle-label">深色模式</span>
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
						<span>运行中不能切换</span>
					</div>
					<button id="mobile-drawer-close-button" class="mobile-drawer-close" type="button" aria-label="关闭历史会话">
						×
					</button>
				</div>
				<div id="mobile-conversation-list" class="mobile-conversation-list"></div>
			</aside>

			<aside id="desktop-conversation-rail" class="desktop-conversation-rail" aria-label="&#21382;&#21490;&#20250;&#35805;">
				<div class="desktop-conversation-rail-head">
					<strong>&#21382;&#21490;&#20250;&#35805;</strong>
					<span>&#24120;&#39547;</span>
				</div>
				<div id="desktop-conversation-list" class="desktop-conversation-list"></div>
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
						<div id="history-auto-load-status" class="history-auto-load-status" aria-live="polite" hidden></div>
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
					<section id="composer-drop-target" class="composer">
						<div class="composer-main">
							<div class="composer-header">
								<span>消息</span>
								<span>Shift+Enter 换行</span>
							</div>
							<textarea id="message" name="message" rows="1" placeholder="和我聊聊吧"></textarea>
						</div>
						<div class="composer-side">
							<button id="interrupt-button" type="button" disabled>打断</button>
							<button id="send-button" type="button">发送</button>
						</div>
					</section>
				</div>
			</main>
		</div>
		${getPlaygroundTaskInboxView()}
		<div id="context-usage-dialog" class="context-usage-dialog" aria-hidden="true" inert hidden>
			<section class="context-usage-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="context-usage-dialog-title">
				<div class="context-usage-dialog-head">
					<strong id="context-usage-dialog-title">上下文使用情况</strong>
					<button id="context-usage-dialog-close" class="context-usage-dialog-close" type="button" aria-label="关闭上下文详情">×</button>
				</div>
				<div id="context-usage-dialog-body" class="context-usage-dialog-body">当前上下文 0 / 128,000 tokens (0%)</div>
			</section>
		</div>
		<div id="chat-run-log-dialog" class="chat-run-log-dialog" aria-hidden="true" hidden>
			<section class="chat-run-log-panel" role="dialog" aria-modal="true" aria-labelledby="chat-run-log-title">
				<div class="chat-run-log-head">
					<strong id="chat-run-log-title">运行日志</strong>
					<button id="chat-run-log-close" class="chat-run-log-close" type="button" aria-label="关闭运行日志">×</button>
				</div>
				<div id="chat-run-log-body" class="chat-run-log-body"></div>
			</section>
		</div>
		<div id="confirm-dialog" class="confirm-dialog" aria-hidden="true" hidden>
			<section class="confirm-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
				<div class="confirm-dialog-head">
					<strong id="confirm-dialog-title">请确认</strong>
				</div>
				<div id="confirm-dialog-body" class="confirm-dialog-body"></div>
				<div class="confirm-dialog-actions">
					<button id="confirm-dialog-cancel" type="button">取消</button>
					<button id="confirm-dialog-confirm" class="danger-action" type="button">确认</button>
				</div>
			</section>
		</div>
		${getConnActivityDialogs()}
		${getPlaygroundAssetDialogs()}
		<script src="/vendor/flatpickr/flatpickr.min.js"></script>
		<script src="/vendor/flatpickr/l10n/zh.js"></script>
		<script>${getMarkedBrowserScript()}
${getPlaygroundScript()}</script>
	</body>
</html>`;
}
