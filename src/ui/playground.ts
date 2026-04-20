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
				radial-gradient(circle at 78% 10%, rgba(255, 255, 255, 0.06), transparent 0 14%),
				radial-gradient(circle at 50% -12%, rgba(255, 255, 255, 0.08), transparent 0 20%),
				radial-gradient(circle at 22% 72%, rgba(186, 142, 255, 0.1), transparent 0 20%),
				radial-gradient(circle at 14% 28%, rgba(255, 255, 255, 0.16) 0 1px, transparent 1.5px),
				radial-gradient(circle at 31% 78%, rgba(255, 255, 255, 0.14) 0 1px, transparent 1.6px),
				radial-gradient(circle at 57% 46%, rgba(203, 217, 255, 0.14) 0 1.1px, transparent 1.8px),
				radial-gradient(circle at 76% 60%, rgba(255, 255, 255, 0.12) 0 1px, transparent 1.6px),
				radial-gradient(circle at 87% 36%, rgba(198, 166, 255, 0.12) 0 1.1px, transparent 1.8px),
				linear-gradient(180deg, #02030a 0%, #04050d 38%, #090611 100%);
			background-size: auto, auto, auto, 240px 240px, 260px 260px, 320px 320px, 280px 280px, 360px 360px, auto;
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

		.mobile-action-strip {
			display: none;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 8px;
			width: min(var(--conversation-width), 100%);
			margin: 0 auto 10px;
		}

		.mobile-action-button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-height: 40px;
			padding: 8px 6px;
			border: 1px solid rgba(201, 210, 255, 0.14);
			background:
				linear-gradient(180deg, rgba(14, 18, 31, 0.92), rgba(8, 11, 20, 0.94)),
				rgba(8, 11, 20, 0.94);
			color: rgba(238, 244, 255, 0.9);
			font-size: 11px;
			line-height: 1;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
		}

		.mobile-action-button:hover:not(:disabled),
		.mobile-action-button:focus-visible {
			border-color: rgba(201, 210, 255, 0.28);
			background:
				linear-gradient(180deg, rgba(20, 26, 42, 0.96), rgba(10, 14, 24, 0.98)),
				rgba(10, 14, 24, 0.98);
			color: #f2f6ff;
			transform: none;
			box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
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
			backdrop-filter: blur(14px);
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
			backdrop-filter: blur(10px);
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
			margin-top: 10px;
		}

		.message-copy-button {
			padding: 6px 10px;
			border-color: rgba(201, 210, 255, 0.2);
			background: rgba(201, 210, 255, 0.05);
			color: var(--accent);
			font-size: 10px;
			letter-spacing: 0.12em;
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
			gap: 14px;
			padding: 18px 0 20px;
			border: 0;
			border-radius: 4px;
			background: rgba(102, 93, 138, 0.16);
			box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
			align-items: end;
			flex-shrink: 0;
		}

		.composer-main {
			display: grid;
			gap: 12px;
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
			min-height: 128px;
			max-height: 28vh;
			resize: vertical;
			line-height: 1.7;
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
			backdrop-filter: blur(10px);
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
			backdrop-filter: blur(14px);
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
			backdrop-filter: blur(10px);
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
			backdrop-filter: blur(18px);
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
			right: 34px;
			top: 50%;
			z-index: 3;
			display: grid;
			gap: 18px;
			transform: translateY(-50%);
		}

		.telemetry-card {
			display: grid;
			gap: 10px;
			text-align: right;
			opacity: 0.62;
		}

		.telemetry-card span {
			color: rgba(214, 220, 255, 0.18);
			font-size: 10px;
			letter-spacing: 0.18em;
			text-transform: uppercase;
		}

		.telemetry-card strong {
			color: rgba(214, 220, 255, 0.34);
			font-size: 12px;
			letter-spacing: 0.08em;
			font-weight: 400;
		}

		.telemetry-action {
			font: inherit;
			color: inherit;
			cursor: pointer;
			padding: 0;
			border: 0;
			background: transparent;
			box-shadow: none;
			text-align: right;
		}

		.telemetry-action:hover:not(:disabled),
		.telemetry-action:focus-visible {
			border-color: transparent;
			background: transparent;
			box-shadow: none;
			transform: translateY(0);
		}

		.telemetry-action:hover:not(:disabled) span,
		.telemetry-action:focus-visible span,
		.telemetry-action:hover:not(:disabled) strong,
		.telemetry-action:focus-visible strong {
			color: rgba(224, 228, 255, 0.9);
			text-shadow: 0 0 18px rgba(167, 151, 231, 0.18);
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
			gap: 6px;
			width: min(var(--conversation-width), 100%);
			margin: 0 auto 18px;
			z-index: 4;
		}

		.shell[data-stage-mode="landing"] .context-usage-row {
			min-height: 26px;
			margin: -4px 0 -2px;
		}

		.shell[data-stage-mode="landing"] .composer {
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 12px;
			padding: 12px;
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
			gap: 8px;
		}

		.shell[data-stage-mode="landing"] .composer textarea {
			min-height: 56px;
			max-height: 56px;
			padding: 15px 10px 12px;
			border: 0;
			background: transparent;
			box-shadow: none;
			color: rgba(238, 244, 255, 0.84);
			line-height: 1.45;
			resize: none;
			overflow: hidden;
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
			gap: 12px;
			align-content: center;
		}

		.shell[data-stage-mode="landing"] #send-button,
		.shell[data-stage-mode="landing"] #interrupt-button {
			min-width: 56px;
			min-height: 56px;
			padding: 0 18px;
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
				right: 18px;
				top: 110px;
				grid-auto-flow: row;
				gap: 16px;
				transform: none;
			}

			.telemetry-card {
				text-align: left;
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
			}

			.topbar {
				grid-template-columns: 1fr;
				width: 100%;
				padding: max(8px, env(safe-area-inset-top)) 12px 8px;
				min-height: 0;
				border-bottom: 0;
				background: linear-gradient(180deg, rgba(6, 8, 15, 0.96), rgba(6, 8, 15, 0.64));
				backdrop-filter: blur(18px);
			}

			.topbar-signal {
				justify-self: center;
				font-size: 11px;
				letter-spacing: 0.22em;
				color: rgba(231, 237, 255, 0.74);
				text-shadow: none;
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

			.mobile-action-strip {
				display: grid;
				position: relative;
				z-index: 2;
				grid-template-columns: repeat(4, minmax(0, 1fr));
				gap: 6px;
				width: 100%;
				margin: 0;
			}

			.archived-conversation-head {
				padding: 0 12px;
			}

			.mobile-action-button {
				min-height: 38px;
				padding: 8px 4px;
				border-radius: 12px;
				font-size: 10px;
				letter-spacing: 0.06em;
				background:
					linear-gradient(180deg, rgba(18, 23, 38, 0.94), rgba(10, 13, 22, 0.98)),
					rgba(10, 13, 22, 0.98);
				box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
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
				width: 100%;
				margin-bottom: 0;
			}

			.shell[data-transcript-state="idle"] .transcript-current:empty::before {
				content: "开始一轮对话，或先从上方选择文件与资产。";
				display: block;
				margin: 16vh auto 0;
				width: min(240px, calc(100% - 32px));
				padding: 14px 16px;
				border: 1px solid rgba(201, 210, 255, 0.08);
				border-radius: 14px;
				background: rgba(255, 255, 255, 0.03);
				color: rgba(231, 236, 255, 0.46);
				font-size: 13px;
				line-height: 1.65;
				text-align: center;
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

			.shell[data-stage-mode="landing"] .composer {
				grid-template-columns: minmax(0, 1fr) auto;
				gap: 8px;
				padding: 10px 10px 10px 12px;
				border: 1px solid rgba(201, 210, 255, 0.08);
				border-radius: 16px;
				background:
					linear-gradient(180deg, rgba(13, 17, 29, 0.96), rgba(8, 10, 19, 0.98)),
					rgba(8, 10, 19, 0.98);
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
				min-height: 44px;
				max-height: 112px;
				padding: 11px 0 8px;
				font-size: 14px;
				line-height: 1.55;
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
				font-size: 10px;
				padding: 5px 8px;
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
			.mobile-action-button,
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
			.asset-modal-search input,
			.error-banner,
			.error-banner-close,
			.assistant-loading-card,
			.assistant-process-shell,
			.history-load-more {
				border-radius: 4px !important;
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
		const GLOBAL_CONVERSATION_ID = "agent:global";
		const TRANSCRIPT_FOLLOW_THRESHOLD_PX = 120;
		const MAX_STORED_CONVERSATIONS = 12;
		const MAX_STORED_MESSAGES_PER_CONVERSATION = 160;
		const MAX_ARCHIVED_TRANSCRIPTS = 4;
		const FALLBACK_CONTEXT_WINDOW = 128000;
		const FALLBACK_RESPONSE_TOKENS = 16384;
		const FALLBACK_RESERVE_TOKENS = 16384;
		const CONTEXT_STATUS_LABELS = {
			safe: "上下文充足",
			caution: "接近提醒线",
			warning: "接近上限",
			danger: "建议新会话",
		};

		const state = {
			loading: false,
			stageMode: "landing",
			conversationId: GLOBAL_CONVERSATION_ID,
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
			conversationHistory: [],
			renderedHistoryCount: 0,
			historyPageSize: 12,
			historyLoadingMore: false,
			activeRunEventController: null,
			pageUnloading: false,
			primaryStreamActive: false,
			autoFollowTranscript: true,
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
		const openAssetLibraryButton = document.getElementById("open-asset-library-button");
		const assetModal = document.getElementById("asset-modal");
		const assetModalList = document.getElementById("asset-modal-list");
		const closeAssetModalButton = document.getElementById("close-asset-modal-button");
		const refreshAssetsButton = document.getElementById("refresh-assets-button");
		const sendButton = document.getElementById("send-button");
		const interruptButton = document.getElementById("interrupt-button");
		const viewSkillsButton = document.getElementById("view-skills-button");
		const newConversationButton = document.getElementById("new-conversation-button");
		const mobileNewConversationButton = document.getElementById("mobile-new-conversation-button");
		const mobileViewSkillsButton = document.getElementById("mobile-view-skills-button");
		const mobileFilePickerAction = document.getElementById("mobile-file-picker-action");
		const mobileAssetLibraryButton = document.getElementById("mobile-asset-library-button");
		const statusPill = document.getElementById("status-pill");
		const commandStatus = document.getElementById("command-status");

		messageInput.placeholder = "Enter terminal command or query neural core...";

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

		function createConversationId() {
			return GLOBAL_CONVERSATION_ID;
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
			window.requestAnimationFrame(syncConversationLayout);
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

		function syncConversationWidth() {
			syncConversationLayout();
		}

		function setTranscriptState(next) {
			shell.dataset.transcriptState = next === "active" ? "active" : "idle";
			window.requestAnimationFrame(syncConversationLayout);
		}

		function setCommandStatus(next) {
			shell.dataset.commandState = String(next || "standby").toLowerCase();
			newConversationButton.dataset.state = shell.dataset.commandState;
		}

		function ensureConversationId() {
			const previousConversationId = state.conversationId;
			conversationInput.value = GLOBAL_CONVERSATION_ID;
			state.conversationId = GLOBAL_CONVERSATION_ID;
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
			if (options?.force || state.autoFollowTranscript || isTranscriptNearBottom()) {
				transcript.scrollTop = transcript.scrollHeight;
				state.autoFollowTranscript = true;
				updateScrollToBottomButton();
				return;
			}
			updateScrollToBottomButton();
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
			openAssetLibraryButton.disabled = next;
			refreshAssetsButton.disabled = next;
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

		function findLatestUserHistoryEntry() {
			for (let index = state.conversationHistory.length - 1; index >= 0; index -= 1) {
				const entry = state.conversationHistory[index];
				if (entry?.kind === "user" && String(entry.text || "").trim()) {
					return entry;
				}
			}
			return null;
		}

		function findLatestAssistantHistoryEntry() {
			for (let index = state.conversationHistory.length - 1; index >= 0; index -= 1) {
				const entry = state.conversationHistory[index];
				if (entry?.kind === "assistant") {
					return entry;
				}
			}
			return null;
		}

		function ensureRecoveredStreamingAssistantMessage() {
			const latestAssistantEntry = findLatestAssistantHistoryEntry();
			const rendered = latestAssistantEntry ? renderedMessages.get(latestAssistantEntry.id) : null;
			if (latestAssistantEntry && rendered?.content?.isConnected) {
				state.activeAssistantContent = rendered.content;
				restoreProcessSnapshot(latestAssistantEntry, rendered, {
					activate: true,
					running: true,
				});
				return rendered.content;
			}

			return ensureStreamingAssistantMessage();
		}

		function formatRecoveredRunMessage() {
			const latestUserEntry = findLatestUserHistoryEntry();
			if (!latestUserEntry) {
				return "当前任务正在运行。\\n\\n刷新只断开了页面连接，后端任务还在继续。";
			}

			const taskText = String(latestUserEntry.text || "").trim();
			const taskSummary = taskText.length > 800 ? taskText.slice(0, 800) + "..." : taskText;
			return "当前任务正在运行。\\n\\n当前任务：\\n> " + taskSummary;
		}

		async function syncConversationRunState(conversationId, options) {
			const nextConversationId = String(conversationId || "").trim();
			if (!nextConversationId) {
				state.contextUsage = null;
				renderContextUsageBar();
				return { conversationId: "", running: false, contextUsage: createFallbackContextUsage() };
			}

			try {
				const payload = await fetchConversationRunStatus(nextConversationId);
				state.contextUsage = normalizeContextUsage(payload.contextUsage);
				renderContextUsageBar();
				if (payload.running) {
					setTranscriptState("active");
					setLoading(true);
					const content = ensureRecoveredStreamingAssistantMessage();
					if (!String(content.textContent || "").trim()) {
						setMessageContent(content, formatRecoveredRunMessage());
					}
					setAssistantLoadingState("当前正在运行", "system");
					if (!state.primaryStreamActive) {
						void attachActiveRunEventStream(nextConversationId);
					}
					return payload;
				}

				if (state.loading && options?.clearIfIdle) {
					stopActiveRunEventStream();
					completeAssistantLoadingBubble("ok", "当前任务已结束");
					completeProcessStream();
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
				process: normalizeProcessSnapshot(rawEntry.process),
			};
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

			const payload = await syncConversationRunState(state.conversationId, {
				silent: true,
				clearIfIdle: false,
			});
			if (!payload.running) {
				return false;
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

		function normalizeProcessSnapshot(rawProcess) {
			if (!rawProcess || typeof rawProcess !== "object") {
				return null;
			}

			const allowedKinds = new Set(["system", "tool", "ok", "error", "warn"]);
			const narration = Array.isArray(rawProcess.narration)
				? rawProcess.narration
						.map((line) => String(line || "").trim())
						.filter(Boolean)
						.slice(-80)
				: [];
			const action = String(rawProcess.action || "").trim();
			const kind = allowedKinds.has(rawProcess.kind) ? rawProcess.kind : "system";
			if (!narration.length && !action) {
				return null;
			}

			return {
				narration,
				action: action || "等待动作",
				kind,
				isComplete: Boolean(rawProcess.isComplete),
			};
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

		function buildTranscriptEntry(kind, title, text, options) {
			return {
				id: options?.id || createBrowserId(),
				kind,
				title,
				text: String(text || ""),
				createdAt: options?.createdAt || new Date().toISOString(),
				attachments: cloneHistoryAttachments(options?.attachments),
				assetRefs: cloneHistoryAssetRefs(options?.assetRefs),
				files: cloneHistoryFiles(options?.files),
				process: normalizeProcessSnapshot(options?.process),
			};
		}

		function rememberConversationMessage(entry) {
			const index = state.conversationHistory.findIndex((current) => current.id === entry.id);
			if (index >= 0) {
				state.conversationHistory.splice(index, 1, entry);
			} else {
				state.conversationHistory.push(entry);
			}
			persistConversationHistory(state.conversationId);
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

		function createMessageActions(entry, content) {
			const actions = document.createElement("div");
			actions.className = "message-actions";

			const copyButton = document.createElement("button");
			copyButton.type = "button";
			copyButton.className = "message-copy-button";
			copyButton.textContent = "复制正文";
			copyButton.addEventListener("click", async () => {
				const original = copyButton.textContent || "复制正文";
				copyButton.disabled = true;
				try {
					await copyTextToClipboard(entry.text || "");
					copyButton.textContent = "已复制";
				} catch {
					copyButton.textContent = "失败";
				} finally {
					window.setTimeout(() => {
						copyButton.textContent = original;
						syncMessageCopyButton(entry);
					}, 1200);
				}
			});

			actions.appendChild(copyButton);
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
			restoreProcessSnapshot(entry, rendered);
			syncMessageCopyButton(entry);
			return rendered;
		}

		function restoreProcessSnapshot(entry, rendered, options) {
			const snapshot = normalizeProcessSnapshot(entry?.process);
			if (!snapshot || !rendered?.body || !rendered?.content) {
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
			for (const lineText of snapshot.narration) {
				const line = document.createElement("p");
				line.className = "assistant-process-line";
				line.textContent = lineText;
				stream.narration.appendChild(line);
			}
			stream.narration.scrollTop = stream.narration.scrollHeight;
			stream.action.textContent = snapshot.action || "等待动作";
			stream.shell.classList.remove("tool", "ok", "error", "warn", "system", "is-running", "is-complete");
			stream.shell.classList.add(snapshot.kind || "system");
			stream.shell.classList.add(options?.running || !snapshot.isComplete ? "is-running" : "is-complete");

			if (options?.activate) {
				state.activeProcessShell = stream.shell;
				state.activeProcessNarration = stream.narration;
				state.activeProcessAction = stream.action;
				state.lastProcessNarration = snapshot.narration.at(-1) || "";
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
				const payload = await fetchConversationHistory(nextConversationId);
				const serverEntries = payload.messages.map(normalizeHistoryEntry).filter(Boolean);
				if (serverEntries.length === 0) {
					return;
				}
				state.conversationHistory = serverEntries.slice(-MAX_STORED_MESSAGES_PER_CONVERSATION);
				state.renderedHistoryCount = 0;
				clearRenderedTranscript();
				persistConversationHistory(nextConversationId);
				setTranscriptState("active");
				renderMoreConversationHistory();
				scrollTranscriptToBottom({ force: true });
			} catch (error) {
				if (state.conversationHistory.length === 0) {
					const messageText = error instanceof Error ? error.message : "无法获取全局对话历史";
					showError(messageText);
				}
			}
		}

		function handleTranscriptScroll() {
			syncTranscriptFollowState();
			if (transcript.scrollTop <= 48) {
				renderMoreConversationHistory();
			}
		}

		function announceFreshConversation(conversationId) {
			appendTranscriptMessage("assistant", "助手", "当前启用新会话。\\n\\n新会话 ID: \`" + conversationId + "\`");
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
			clearSelectedFiles();
			clearSelectedAssetRefs();
		}

		function restoreComposerDraft(draft) {
			messageInput.value = String(draft?.message || "");
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
				return node.tagName.toLowerCase() + "." + node.className.trim().replace(/\s+/g, ".");
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
			persistActiveProcessSnapshot();
		}

		function persistActiveProcessSnapshot() {
			const entryId = state.activeAssistantContent?.dataset.entryId;
			if (!entryId) {
				return;
			}

			const historyEntry = state.conversationHistory.find((entry) => entry.id === entryId);
			if (!historyEntry) {
				return;
			}

			const narration = state.activeProcessNarration
				? Array.from(state.activeProcessNarration.querySelectorAll(".assistant-process-line")).map((line) => line.textContent || "")
				: [];
			const shell = state.activeProcessShell;
			const kind =
				["tool", "ok", "error", "warn", "system"].find((className) => shell?.classList.contains(className)) || "system";
			const process = normalizeProcessSnapshot({
				narration,
				action: state.activeProcessAction?.textContent || "",
				kind,
				isComplete: Boolean(shell?.classList.contains("is-complete")),
			});

			if (process) {
				historyEntry.process = process;
			} else {
				delete historyEntry.process;
			}
			rememberConversationMessage(historyEntry);
		}

		function appendProcessNarrationLine(text) {
			const lineText = String(text || "").trim();
			if (!lineText || lineText === state.lastProcessNarration) {
				return;
			}

			const stream = ensureProcessStreamCard();
			appendNarrationToAssistantProcess(stream, lineText);
			state.lastProcessNarration = lineText;
			persistActiveProcessSnapshot();
		}

		function setProcessCurrentAction(text, kind) {
			const actionText = String(text || "").trim() || "等待动作";
			const stream = ensureProcessStreamCard();
			setAssistantProcessAction(stream, actionText, kind);
			persistActiveProcessSnapshot();
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
				const toolName = normalized.split(/\s+/)[1] || "工具";
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

		function resetConversation(options) {
			const previousConversationId = state.conversationId;
			stopActiveRunEventStream();
			archiveCurrentTranscript(previousConversationId);
			setStageMode("landing");
			setTranscriptState("idle");
			conversationInput.value = createConversationId();
			state.conversationId = conversationInput.value;
			sessionFile.textContent = "尚未分配";
			state.conversationHistory = [];
			state.renderedHistoryCount = 0;
			state.contextUsage = null;
			clearRenderedTranscript();
			resetStreamingState();
			clearSelectedFiles();
			clearSelectedAssetRefs();
			clearError();
			syncHistoryLoadMoreButton();
			renderContextUsageBar();
			void syncContextUsage(state.conversationId, { silent: true });
			void restoreConversationHistoryFromServer(state.conversationId);
			if (options?.announce !== false) {
				announceFreshConversation(state.conversationId);
			}
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
					break;
				}
				case "error":
					showError(event.message);
					updateStreamingProcess("error", "任务错误", event.message);
					completeAssistantLoadingBubble("error", "本轮执行失败");
					completeProcessStream();
					setLoading(false);
					void syncContextUsage(state.conversationId, { silent: true });
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

			ensureConversationId();
			clearError();

			const liveRunState = await syncConversationRunState(state.conversationId, {
				silent: true,
				clearIfIdle: state.loading,
			});

			if (liveRunState.running) {
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

			ensureConversationId();

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
		conversationInput.readOnly = true;
		setStageMode("landing");
		setTranscriptState("idle");
		setCommandStatus("STANDBY");
		renderContextUsageBar();
		renderSelectedAssets();
		renderAssetPickerList();
		void loadAssets(true);
		if (!conversationInput.value) {
			resetConversation({ announce: false });
		} else {
			restoreConversationHistory(state.conversationId);
			void restoreConversationHistoryFromServer(state.conversationId);
		}

		resetStreamingState();
		clearError();
		if (state.conversationId) {
			void syncConversationRunState(state.conversationId, {
				silent: true,
				clearIfIdle: true,
			});
		}

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
		});
		window.addEventListener("pagehide", () => {
			state.pageUnloading = true;
		});
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible") {
				void syncConversationRunState(state.conversationId, {
					silent: true,
					clearIfIdle: state.loading,
				});
				void restoreConversationHistoryFromServer(state.conversationId);
			}
		});
		window.addEventListener("pageshow", () => {
			state.pageUnloading = false;
			void syncConversationRunState(state.conversationId, {
				silent: true,
				clearIfIdle: state.loading,
			});
			void restoreConversationHistoryFromServer(state.conversationId);
		});
		window.addEventListener("online", () => {
			void syncConversationRunState(state.conversationId, {
				silent: true,
				clearIfIdle: state.loading,
			});
		});
		const layoutObserver = new ResizeObserver(() => {
			window.requestAnimationFrame(syncConversationWidth);
		});
		layoutObserver.observe(chatStage);
		layoutObserver.observe(commandDeck);
		layoutObserver.observe(composerDropTarget);
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
			resetConversation();
			messageInput.focus();
		});
		mobileNewConversationButton.addEventListener("click", () => {
			resetConversation();
			messageInput.focus();
		});
		mobileViewSkillsButton.addEventListener("click", () => {
			void loadSkills();
		});
		mobileFilePickerAction.addEventListener("click", () => {
			fileInput.click();
		});
		mobileAssetLibraryButton.addEventListener("click", () => {
			openAssetLibrary();
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

		conversationInput.addEventListener("change", () => {
			const nextConversationId = GLOBAL_CONVERSATION_ID;
			conversationInput.value = nextConversationId;
			if (nextConversationId === state.conversationId) {
				renderContextUsageBar();
				return;
			}
			state.conversationId = nextConversationId;
			restoreConversationHistory(state.conversationId);
			void restoreConversationHistoryFromServer(state.conversationId);
			resetStreamingState();
			clearError();
			void syncConversationRunState(state.conversationId, {
				silent: true,
				clearIfIdle: true,
			});
		});

		messageInput.addEventListener("keydown", (event) => {
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				void sendMessage();
			}
		});
		messageInput.addEventListener("input", () => {
			renderContextUsageBar();
		});

		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && state.assetModalOpen) {
				closeAssetLibrary();
			}
			if (event.key === "Escape" && !contextUsageDialog.hidden) {
				closeContextUsageDialog();
			}
		});

		window.requestAnimationFrame(syncConversationWidth);
	`;
}

export function renderPlaygroundPage(): string {
	return `<!doctype html>
<html lang="zh-CN">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>UGK Claw</title>
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
				<div class="topbar-right">
					<div class="status-row"><span>主题</span><strong>深色 / 极客</strong></div>
					<div class="status-row"><span>传输</span><strong>SSE / 流式</strong></div>
					<div class="status-row"><span>发送</span><strong>Enter</strong></div>
				</div>
			</header>

			<main id="chat-stage" class="chat-stage">
				<section class="mobile-action-strip" aria-label="手机快捷操作">
					<button id="mobile-new-conversation-button" class="mobile-action-button" type="button">新会话</button>
					<button id="mobile-view-skills-button" class="mobile-action-button" type="button">技能</button>
					<button id="mobile-file-picker-action" class="mobile-action-button" type="button">文件</button>
					<button id="mobile-asset-library-button" class="mobile-action-button" type="button">文件库</button>
				</section>
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
						</aside>
					</div>
				</section>

				<div id="error-banner" class="error-banner" role="alert" hidden>
					<span id="error-banner-message" class="error-banner-message"></span>
					<button id="error-banner-close" class="error-banner-close" type="button" aria-label="关闭错误提示">×</button>
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
							<textarea id="message" name="message" placeholder="输入消息，按 Enter 发送"></textarea>
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
