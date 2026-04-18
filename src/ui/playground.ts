export function renderPlaygroundMarkdown(source: string): string {
	function escapeHtml(value: string): string {
		return value
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	const normalized = String(source ?? "").replace(/\r\n?/g, "\n").trim();
	if (!normalized) {
		return "<p></p>";
	}

	const codeBlocks: string[] = [];
	const codeTokenized = normalized.replace(/```([a-z0-9_-]+)?\n([\s\S]*?)```/gi, (_match, language, code) => {
		const safeLanguage = typeof language === "string" ? language.replace(/[^a-z0-9_-]/gi, "").toLowerCase() : "";
		const className = safeLanguage ? ` class="language-${safeLanguage}"` : "";
		const html = `<pre><code${className}>${escapeHtml(String(code).replace(/\n$/, ""))}</code></pre>`;
		const token = `\u0000CODEBLOCK${codeBlocks.length}\u0000`;
		codeBlocks.push(html);
		return token;
	});

	function applyInlineMarkdown(text: string): string {
		const inlineCode: string[] = [];
		const inlineTokenized = text.replace(/`([^`\n]+)`/g, (_match, code) => {
			const token = `\u0000INLINECODE${inlineCode.length}\u0000`;
			inlineCode.push(`<code>${escapeHtml(code)}</code>`);
			return token;
		});

		let html = escapeHtml(inlineTokenized);
		html = html.replace(
			/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
			(_match, label, href) =>
				`<a href="${href.replace(/"/g, "&quot;")}" target="_blank" rel="noreferrer noopener">${label}</a>`,
		);
		html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
		html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
		html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
		html = html.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
		return html.replace(/\u0000INLINECODE(\d+)\u0000/g, (_match, index) => inlineCode[Number(index)] ?? "");
	}

	function renderBlock(block: string): string {
		if (/^\u0000CODEBLOCK\d+\u0000$/.test(block)) {
			return block.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (_match, index) => codeBlocks[Number(index)] ?? "");
		}

		const lines = block.split("\n");
		if (lines.length === 1) {
			const heading = lines[0].match(/^(#{1,6})\s+(.+)$/);
			if (heading) {
				const level = heading[1].length;
				return `<h${level}>${applyInlineMarkdown(heading[2])}</h${level}>`;
			}
		}

		if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
			return `<ul>${lines.map((line) => `<li>${applyInlineMarkdown(line.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`;
		}

		if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
			return `<ol>${lines.map((line) => `<li>${applyInlineMarkdown(line.replace(/^\s*\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
		}

		if (lines.every((line) => /^\s*>\s?/.test(line))) {
			const quoted = lines.map((line) => line.replace(/^\s*>\s?/, ""));
			return `<blockquote><p>${quoted.map((line) => applyInlineMarkdown(line)).join("<br />")}</p></blockquote>`;
		}

		return `<p>${lines.map((line) => applyInlineMarkdown(line)).join("<br />")}</p>`;
	}

	return codeTokenized
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter((block) => block.length > 0)
		.map(renderBlock)
		.join("");
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
			--bg: #05070d;
			--bg-panel: #0b1020;
			--bg-panel-2: #10182c;
			--bg-panel-3: #0d1324;
			--fg: #eef4ff;
			--muted: #7f8ca8;
			--line: #1a2540;
			--line-strong: #2a3a63;
			--accent: #5fd1ff;
			--accent-soft: rgba(95, 209, 255, 0.08);
			--ok: #8dffb2;
			--danger: #ff7188;
			--warn: #ffd166;
		}

		* {
			box-sizing: border-box;
		}

		html,
		body {
			margin: 0;
			height: 100%;
			background:
				linear-gradient(90deg, rgba(95, 209, 255, 0.03) 1px, transparent 1px),
				linear-gradient(rgba(95, 209, 255, 0.03) 1px, transparent 1px),
				radial-gradient(circle at top, rgba(95, 209, 255, 0.08), transparent 35%),
				var(--bg);
			background-size: 22px 22px, 22px 22px, auto, auto;
			color: var(--fg);
			font-family: "Agave", Consolas, "Cascadia Mono", "Lucida Console", "SFMono-Regular", monospace;
			overflow: hidden;
		}

		body {
			padding: 20px;
			display: flex;
			justify-content: center;
		}

		.shell {
			width: min(1240px, 100%);
			height: calc(100vh - 40px);
			margin: 0 auto;
			border: 1px solid var(--line-strong);
			background: rgba(5, 7, 13, 0.98);
			display: grid;
			grid-template-rows: auto minmax(0, 1fr);
			overflow: hidden;
		}

		.topbar {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 14px;
			width: min(980px, calc(100% - 36px));
			margin: 0 auto;
			padding: 18px 0 14px;
			border-bottom: 1px solid var(--line-strong);
			align-items: center;
		}

		.topbar-left {
			min-width: 0;
		}

		.brand-lockup {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr);
			gap: 18px;
			align-items: center;
		}

		.corgi-logo {
			margin: 0;
			padding: 10px 12px;
			border: 1px solid var(--accent);
			background: rgba(95, 209, 255, 0.06);
			color: var(--ok);
			font-size: 12px;
			line-height: 1.05;
			white-space: pre;
			box-shadow: inset 0 0 0 1px rgba(141, 255, 178, 0.08);
		}

		.kicker {
			display: inline-block;
			padding: 4px 8px;
			border: 1px solid var(--accent);
			color: var(--accent);
			font-size: 11px;
			letter-spacing: 0.18em;
			text-transform: uppercase;
		}

		h1 {
			margin: 8px 0;
			font-size: clamp(26px, 4vw, 40px);
			line-height: 0.95;
			letter-spacing: -0.06em;
			text-transform: uppercase;
		}

		.topbar p {
			margin: 0;
			color: var(--muted);
			font-size: 12px;
			line-height: 1.6;
			max-width: 60ch;
		}

		.topbar-right {
			display: grid;
			gap: 8px;
			justify-items: end;
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: 0.12em;
			color: var(--muted);
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
			width: min(980px, calc(100% - 36px));
			min-height: 0;
			margin: 0 auto;
			background: linear-gradient(180deg, rgba(16, 24, 44, 0.75), rgba(5, 7, 13, 0.98));
			border-left: 1px solid var(--line);
			border-right: 1px solid var(--line);
			overflow: hidden;
		}

		.chat-meta {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto auto auto;
			gap: 12px;
			padding: 12px 18px;
			border-bottom: 1px solid var(--line);
			background: rgba(11, 16, 32, 0.82);
			align-items: center;
			flex-shrink: 0;
		}

		.meta-chip {
			min-width: 0;
			padding: 10px 12px;
			border: 1px solid var(--line);
			background: rgba(16, 24, 44, 0.58);
			font-size: 11px;
			line-height: 1.5;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--muted);
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
			background: transparent;
			padding: 0;
		}

		button,
		input,
		select,
		textarea {
			font: inherit;
			border-radius: 0;
		}

		button {
			border: 1px solid var(--line-strong);
			background: #0d1425;
			color: var(--fg);
			padding: 10px 14px;
			cursor: pointer;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
		}

		button:hover:not(:disabled) {
			border-color: var(--accent);
			color: var(--accent);
			background: #111c33;
		}

		button:disabled {
			opacity: 0.5;
			cursor: wait;
		}

		#send-button {
			border-color: var(--accent);
			color: var(--accent);
			background: var(--accent-soft);
		}

		.banner-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 12px;
			padding: 10px 18px;
			border-bottom: 1px solid var(--line);
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: 0.12em;
			color: var(--muted);
			flex-shrink: 0;
		}

		.state {
			padding: 6px 10px;
			border: 1px solid var(--line-strong);
			color: var(--ok);
		}

		.error-banner {
			display: none;
			padding: 12px 18px;
			border-bottom: 1px solid rgba(255, 113, 136, 0.32);
			background: rgba(255, 113, 136, 0.08);
			color: #ff9faf;
			font-size: 12px;
			line-height: 1.6;
			flex-shrink: 0;
		}

		.error-banner.visible {
			display: block;
		}

		.stream-layout {
			display: grid;
			grid-template-columns: minmax(0, 1.65fr) minmax(280px, 0.95fr);
			flex: 1 1 auto;
			min-height: 0;
			background:
				linear-gradient(rgba(95, 209, 255, 0.03) 1px, transparent 1px),
				linear-gradient(90deg, rgba(95, 209, 255, 0.03) 1px, transparent 1px),
				rgba(5, 7, 13, 0.16);
			background-size: 22px 22px;
		}

		.transcript-pane,
		.process-panel {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}

		.process-panel {
			border-left: 1px solid var(--line);
			background: rgba(8, 12, 22, 0.95);
		}

		.pane-head {
			padding: 12px 18px;
			border-bottom: 1px solid var(--line);
			background: rgba(11, 16, 32, 0.82);
			flex-shrink: 0;
		}

		.pane-head strong {
			display: block;
			font-size: 11px;
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
			flex: 1 1 auto;
			min-height: 0;
			padding: 0;
			overflow-y: auto;
			overflow-x: hidden;
			overscroll-behavior: contain;
		}

		.process-feed {
			flex: 1 1 auto;
			min-height: 0;
			padding: 0;
			overflow-y: auto;
			overflow-x: hidden;
			overscroll-behavior: contain;
		}

		.message {
			display: grid;
			grid-template-columns: 150px minmax(0, 1fr);
			border-bottom: 1px solid var(--line);
		}

		.message-meta,
		.message-body {
			padding: 16px 18px;
			min-width: 0;
		}

		.message-meta {
			border-right: 1px solid var(--line);
			background: rgba(9, 15, 29, 0.9);
			font-size: 11px;
			line-height: 1.8;
			letter-spacing: 0.12em;
			text-transform: uppercase;
			color: var(--muted);
		}

		.message-meta strong {
			display: block;
			margin-bottom: 6px;
			font-size: 11px;
			color: var(--fg);
		}

		.message-body {
			background: rgba(12, 19, 36, 0.88);
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

		.message-content blockquote {
			margin-left: 0;
			padding: 12px 14px;
			border-left: 3px solid var(--accent);
			background: rgba(95, 209, 255, 0.06);
			color: #d8e7ff;
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
				linear-gradient(90deg, rgba(95, 209, 255, 0.05), transparent 45%),
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
			border-color: rgba(95, 209, 255, 0.28);
			background: rgba(95, 209, 255, 0.06);
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
			border: 1px solid rgba(95, 209, 255, 0.22);
			background: rgba(95, 209, 255, 0.08);
			font-size: 13px;
		}

		.message-content pre code {
			display: block;
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
			color: var(--accent);
		}

		.message.assistant .message-meta strong {
			color: var(--ok);
		}

		.message.system .message-meta strong {
			color: var(--warn);
		}

		.message.error .message-meta strong {
			color: var(--danger);
		}

		.message.error .message-body {
			background: rgba(255, 113, 136, 0.06);
		}

		.process-item {
			padding: 14px 16px;
			border-bottom: 1px solid var(--line);
			background: rgba(10, 16, 30, 0.9);
		}

		.process-item strong {
			display: block;
			font-size: 11px;
			letter-spacing: 0.12em;
			text-transform: uppercase;
			margin-bottom: 6px;
		}

		.process-item time {
			display: block;
			margin: 0 0 8px;
			font-size: 12px;
			line-height: 1.6;
			color: var(--muted);
		}

		.process-summary {
			margin: 0;
			font-size: 12px;
			line-height: 1.7;
			color: var(--muted);
			white-space: pre-wrap;
			word-break: break-word;
		}

		.process-detail-toggle {
			margin-top: 10px;
			padding: 7px 10px;
			font-size: 10px;
			letter-spacing: 0.12em;
			background: rgba(95, 209, 255, 0.06);
			border-color: var(--line);
			color: var(--accent);
		}

		.process-detail-body {
			display: none;
			margin-top: 10px;
			padding: 10px 12px;
			border: 1px solid var(--line);
			background: rgba(4, 8, 18, 0.92);
			color: var(--fg);
			font-size: 12px;
			line-height: 1.65;
			white-space: pre-wrap;
			word-break: break-word;
			max-height: 220px;
			overflow: auto;
		}

		.process-item.expanded .process-detail-body {
			display: block;
		}

		.process-item.tool strong {
			color: var(--accent);
		}

		.process-item.ok strong {
			color: var(--ok);
		}

		.process-item.error strong {
			color: var(--danger);
		}

		.process-item.system strong {
			color: var(--warn);
		}

		.composer {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 220px;
			gap: 12px;
			padding: 14px 18px 18px;
			border-top: 1px solid var(--line-strong);
			background: rgba(8, 12, 22, 0.98);
			align-items: end;
			flex-shrink: 0;
		}

		.composer-main {
			display: grid;
			gap: 10px;
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
			border: 1px solid var(--line-strong);
			background: #040812;
			color: var(--fg);
			padding: 12px 14px;
			outline: none;
			transition: border-color 120ms ease, background 120ms ease;
		}

		.composer textarea {
			min-height: 112px;
			max-height: 28vh;
			resize: vertical;
			line-height: 1.7;
		}

		.composer textarea:focus,
		.composer input:focus,
		.composer select:focus {
			border-color: var(--accent);
			background: #08101d;
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

		.drag-debug {
			display: grid;
			gap: 8px;
			padding: 10px 12px;
			border: 1px solid var(--line);
			background: rgba(4, 8, 18, 0.78);
		}

		.drag-debug-head {
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

		.drag-debug-head button {
			padding: 6px 10px;
			font-size: 10px;
		}

		.drag-debug-log {
			display: grid;
			gap: 6px;
			max-height: 132px;
			overflow-y: auto;
		}

		.drag-debug-empty,
		.drag-debug-entry {
			padding: 8px 10px;
			border: 1px solid var(--line);
			background: rgba(11, 16, 32, 0.74);
			font-size: 11px;
			line-height: 1.6;
			word-break: break-word;
		}

		.drag-debug-empty {
			color: var(--muted);
		}

		.drag-debug-entry strong {
			color: var(--accent);
		}

		.drag-debug-entry span {
			color: var(--muted);
		}

		.drag-overlay {
			position: fixed;
			inset: 16px;
			z-index: 40;
			display: none;
			align-items: center;
			justify-content: center;
			border: 1px dashed rgba(95, 209, 255, 0.7);
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
			box-shadow: inset 0 0 0 1px rgba(95, 209, 255, 0.18);
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
			border: 1px dashed var(--line-strong);
			background: rgba(95, 209, 255, 0.04);
			padding: 10px;
			transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
		}

		.composer.drag-active,
		.drop-zone.drag-active {
			border-color: var(--accent);
			background: rgba(95, 209, 255, 0.1);
			box-shadow: inset 0 0 0 1px rgba(95, 209, 255, 0.22);
		}

		.drop-zone-label {
			display: flex;
			justify-content: space-between;
			gap: 12px;
			color: var(--muted);
			font-size: 11px;
			line-height: 1.5;
			text-transform: uppercase;
			letter-spacing: 0.08em;
		}

		.file-input {
			width: 100%;
			border: 1px solid var(--line);
			background: rgba(4, 8, 18, 0.74);
			color: var(--muted);
			padding: 10px 12px;
			font-size: 11px;
			line-height: 1.5;
		}

		.file-input::file-selector-button {
			margin-right: 10px;
			border: 1px solid var(--accent);
			background: var(--accent-soft);
			color: var(--accent);
			padding: 7px 10px;
			font: inherit;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			cursor: pointer;
		}

		.file-list,
		.file-downloads {
			display: grid;
			gap: 6px;
		}

		.file-pill,
		.file-download {
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

		.file-pill strong,
		.file-download strong {
			display: block;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			color: var(--fg);
			font-size: 11px;
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

		@media (max-width: 960px) {
			.brand-lockup {
				grid-template-columns: 1fr;
			}

			.corgi-logo {
				width: max-content;
			}

			.stream-layout {
				grid-template-columns: 1fr;
			}

			.process-panel {
				border-left: 0;
				border-top: 1px solid var(--line);
				min-height: 220px;
			}

			.chat-meta,
			.composer,
			.topbar {
				grid-template-columns: 1fr;
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
				grid-template-columns: 1fr;
			}

			.message-meta {
				border-right: 0;
				border-bottom: 1px solid var(--line);
			}
		}
	`;
}

function getPlaygroundScript(): string {
	const renderMarkdownFunction = renderPlaygroundMarkdown
		.toString()
		.replace("function renderPlaygroundMarkdown", "function renderMessageMarkdown")
		.replace(/\s*__name\([^)]*\);\n?/g, "\n");

	return `
		${renderMarkdownFunction}

		const state = {
			loading: false,
			conversationId: localStorage.getItem("ugk-pi:conversation-id") || "",
			streamingText: "",
			activeAssistantContent: null,
			receivedDoneEvent: false,
			pendingAttachments: [],
			lastFileIntentMessage: "",
			dragDepth: 0,
			dragDebugEvents: [],
			lastDragDebugKey: "",
			lastDragDebugAt: 0,
		};

		const transcript = document.getElementById("transcript");
		const processFeed = document.getElementById("process-feed");
		const errorBanner = document.getElementById("error-banner");
		const dragOverlay = document.getElementById("drag-overlay");
		const pageRoot = document.documentElement;
		const pageBody = document.body;
		const sessionFile = document.getElementById("session-file");
		const chatStage = document.getElementById("chat-stage");
		const conversationInput = document.getElementById("conversation-id");
		const messageInput = document.getElementById("message");
		const composerDropTarget = document.getElementById("composer-drop-target");
		const dropZone = document.getElementById("drop-zone");
		const fileInput = document.getElementById("file-input");
		const fileList = document.getElementById("file-list");
		const dragDebugLog = document.getElementById("drag-debug-log");
		const clearDragDebugButton = document.getElementById("clear-drag-debug");
		const sendButton = document.getElementById("send-button");
		const interruptButton = document.getElementById("interrupt-button");
		const viewSkillsButton = document.getElementById("view-skills-button");
		const newConversationButton = document.getElementById("new-conversation-button");
		const statusPill = document.getElementById("status-pill");

		function ensureConversationId() {
			if (!conversationInput.value.trim()) {
				conversationInput.value = "manual:web-" + crypto.randomUUID().slice(0, 12);
			}
			state.conversationId = conversationInput.value.trim();
			localStorage.setItem("ugk-pi:conversation-id", state.conversationId);
		}

		function scrollTranscriptToBottom() {
			transcript.scrollTop = transcript.scrollHeight;
		}

		function scrollProcessToBottom() {
			processFeed.scrollTop = processFeed.scrollHeight;
		}

		function setLoading(next) {
			state.loading = next;
			sendButton.disabled = false;
			sendButton.textContent = "发送";
			interruptButton.disabled = !next;
			viewSkillsButton.disabled = next;
			messageInput.disabled = false;
			fileInput.disabled = false;
			conversationInput.disabled = next;
			newConversationButton.disabled = next;
			statusPill.textContent = next ? "运行中" : "就绪";
		}

		function showError(message) {
			errorBanner.textContent = message;
			errorBanner.classList.add("visible");
			statusPill.textContent = "错误";
		}

		function clearError() {
			errorBanner.textContent = "";
			errorBanner.classList.remove("visible");
			if (!state.loading) {
				statusPill.textContent = "就绪";
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
				}
				attachments.push(attachment);
			}

			return attachments;
		}

		function renderAttachmentList() {
			fileList.innerHTML = "";
			for (const attachment of state.pendingAttachments) {
				const item = document.createElement("div");
				item.className = "file-pill";
				const textState = typeof attachment.text === "string" ? "\\u5df2\\u8bfb\\u53d6\\u6587\\u672c" : "\\u4ec5\\u53d1\\u9001\\u5143\\u6570\\u636e";
				item.innerHTML = "<div><strong></strong><span></span></div><span></span>";
				item.querySelector("strong").textContent = attachment.fileName;
				item.querySelector("div span").textContent = (attachment.mimeType || "application/octet-stream") + " / " + formatFileSize(attachment.sizeBytes);
				item.querySelector(":scope > span").textContent = textState;
				fileList.appendChild(item);
			}
		}

		function clearSelectedFiles() {
			state.pendingAttachments = [];
			state.lastFileIntentMessage = "";
			fileInput.value = "";
			renderAttachmentList();
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

		function summarizeDataTransfer(dataTransfer) {
			if (!dataTransfer) {
				return "dataTransfer=none";
			}
			const itemKinds = Array.from(dataTransfer.items || []).map((item) => item.kind + ":" + (item.type || "unknown"));
			const types = Array.from(dataTransfer.types || []);
			const parts = [
				"types=[" + (types.join(",") || "none") + "]",
				"files=" + (dataTransfer.files ? dataTransfer.files.length : 0),
				"items=" + (dataTransfer.items ? dataTransfer.items.length : 0),
				"dropEffect=" + (dataTransfer.dropEffect || "none"),
				"effectAllowed=" + (dataTransfer.effectAllowed || "none"),
			];
			if (itemKinds.length) {
				parts.push("itemKinds=[" + itemKinds.join(",") + "]");
			}
			return parts.join(" | ");
		}

		function renderDragDebugLog() {
			if (!dragDebugLog) {
				return;
			}
			dragDebugLog.innerHTML = "";
			if (!state.dragDebugEvents.length) {
				const empty = document.createElement("div");
				empty.className = "drag-debug-empty";
				empty.textContent = "\\u8fd8\\u6ca1\\u6709\\u62d6\\u653e\\u4e8b\\u4ef6\\u3002\\u76f4\\u63a5\\u628a\\u6587\\u4ef6\\u62d6\\u5230\\u8fd9\\u4e2a\\u9875\\u9762\\uff0c\\u8fd9\\u91cc\\u4f1a\\u663e\\u793a Chrome \\u5230\\u5e95\\u6709\\u6ca1\\u6709\\u628a\\u4e8b\\u4ef6\\u4ea4\\u7ed9\\u9875\\u9762\\u3002";
				dragDebugLog.appendChild(empty);
				return;
			}
			for (const entry of state.dragDebugEvents) {
				const item = document.createElement("div");
				item.className = "drag-debug-entry";
				item.innerHTML = "<strong></strong><br /><span></span>";
				item.querySelector("strong").textContent = entry.label;
				item.querySelector("span").textContent = entry.detail;
				dragDebugLog.appendChild(item);
			}
		}

		function pushDragDebug(scope, event) {
			const detail = [
				"target=" + describeNode(event.target),
				"current=" + describeNode(event.currentTarget),
				summarizeDataTransfer(event.dataTransfer),
			].join(" | ");
			const label = new Date().toLocaleTimeString() + " | " + scope + " | " + event.type;
			const dedupeKey = scope + "|" + event.type + "|" + detail;
			const now = Date.now();
			if (dedupeKey === state.lastDragDebugKey && now - state.lastDragDebugAt < 120) {
				return;
			}
			state.lastDragDebugKey = dedupeKey;
			state.lastDragDebugAt = now;
			state.dragDebugEvents.unshift({ label, detail });
			state.dragDebugEvents = state.dragDebugEvents.slice(0, 10);
			renderDragDebugLog();
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

		function buildFileIntentMessage(attachments, sourceLabel) {
			const source = sourceLabel === "drop" ? "拖入" : "选择";
			return [
				"请结合我" + source + "的 " + attachments.length + " 个文件一起处理：",
				...attachments.map((attachment) => "- " + attachment.fileName + " (" + formatFileSize(attachment.sizeBytes) + ")"),
			].join("\\n");
		}

		function applyFileIntentMessage(attachments, sourceLabel) {
			if (!attachments.length) {
				return;
			}

			const nextIntent = buildFileIntentMessage(attachments, sourceLabel);
			const currentValue = messageInput.value.trim();
			if (!currentValue) {
				messageInput.value = nextIntent;
			} else if (state.lastFileIntentMessage && messageInput.value.includes(state.lastFileIntentMessage)) {
				messageInput.value = messageInput.value.replace(state.lastFileIntentMessage, nextIntent);
			} else {
				messageInput.value = messageInput.value.replace(/\\s*$/, "") + "\\n\\n" + nextIntent;
			}
			state.lastFileIntentMessage = nextIntent;
			messageInput.focus();
		}

		function formatMessageWithAttachments(message, attachments) {
			if (!attachments.length) {
				return message;
			}
			return [
				message,
				"",
				"\\u9644\\u4ef6:",
				...attachments.map((attachment) => "- " + attachment.fileName + " (" + formatFileSize(attachment.sizeBytes) + ")"),
			].join("\\n");
		}

		function appendFileDownloads(files) {
			if (!Array.isArray(files) || files.length === 0) {
				return;
			}
			const content = appendTranscriptMessage("system", "\\u6587\\u4ef6", "\\u52a9\\u624b\\u5df2\\u53d1\\u9001 " + files.length + " \\u4e2a\\u6587\\u4ef6");
			const downloads = document.createElement("div");
			downloads.className = "file-downloads";

			for (const file of files) {
				const item = document.createElement("div");
				item.className = "file-download";
				item.innerHTML = "<div><strong></strong><span></span></div><a></a>";
				item.querySelector("strong").textContent = file.fileName || "download";
				item.querySelector("span").textContent = (file.mimeType || "application/octet-stream") + " / " + formatFileSize(file.sizeBytes);
				const link = item.querySelector("a");
				link.href = file.downloadUrl;
				link.download = file.fileName || "";
				link.textContent = "\\u4e0b\\u8f7d";
				downloads.appendChild(item);
			}

			content.appendChild(downloads);
			scrollTranscriptToBottom();
		}

		function appendTranscriptMessage(kind, title, text) {
			const card = document.createElement("article");
			card.className = "message " + kind;

			const meta = document.createElement("div");
			meta.className = "message-meta";
			meta.innerHTML = "<strong>" + title + "</strong><span>" + new Date().toLocaleTimeString() + "</span>";

			const body = document.createElement("div");
			body.className = "message-body";
			const content = document.createElement("div");
			content.className = "message-content";
			content.innerHTML = renderMessageMarkdown(text);
			hydrateMarkdownContent(content);
			body.appendChild(content);

			card.appendChild(meta);
			card.appendChild(body);
			transcript.appendChild(card);
			scrollTranscriptToBottom();
			return content;
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

		function toggleProcessDetail(button) {
			const entry = button.closest(".process-item");
			if (!entry) {
				return;
			}

			const expanded = entry.classList.toggle("expanded");
			button.textContent = expanded ? "收起详情" : "展开详情";
			button.setAttribute("aria-expanded", String(expanded));
			scrollProcessToBottom();
		}

		function appendProcessEvent(kind, title, detail) {
			const entry = document.createElement("article");
			entry.className = "process-item " + kind;

			const heading = document.createElement("strong");
			heading.textContent = title;

			const timestamp = document.createElement("time");
			timestamp.textContent = new Date().toLocaleTimeString();

			const summaryBlock = summarizeDetail(detail);
			const summary = document.createElement("p");
			summary.className = "process-summary";
			summary.textContent = summaryBlock.summary;

			entry.appendChild(heading);
			entry.appendChild(timestamp);
			entry.appendChild(summary);

			if (summaryBlock.expandable) {
				const toggle = document.createElement("button");
				toggle.type = "button";
				toggle.className = "process-detail-toggle";
				toggle.textContent = "展开详情";
				toggle.setAttribute("aria-expanded", "false");
				toggle.addEventListener("click", () => {
					toggleProcessDetail(toggle);
				});

				const detailBody = document.createElement("pre");
				detailBody.className = "process-detail-body";
				detailBody.textContent = summaryBlock.detail;

				entry.appendChild(toggle);
				entry.appendChild(detailBody);
			}

			processFeed.appendChild(entry);
			scrollProcessToBottom();
		}

		function formatSkillsReport(skills) {
			if (!Array.isArray(skills) || skills.length === 0) {
				return "运行时技能 (0)\\n\\n/v1/debug/skills 未返回技能";
			}

			return [
				"运行时技能 (" + skills.length + ")",
				"",
				...skills.map((skill, index) => {
					const label = skill && typeof skill.name === "string" ? skill.name : "unknown-skill";
					const pathLine =
						skill && typeof skill.path === "string" && skill.path.trim()
							? "  path: " + skill.path.trim()
							: "";
					return (index + 1) + ". " + label + (pathLine ? "\\n" + pathLine : "");
				}),
			].join("\\n");
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
			state.receivedDoneEvent = false;
		}

		function resetConversation() {
			conversationInput.value = "manual:web-" + crypto.randomUUID().slice(0, 12);
			state.conversationId = conversationInput.value;
			localStorage.setItem("ugk-pi:conversation-id", state.conversationId);
			sessionFile.textContent = "尚未分配";
			transcript.innerHTML = "";
			processFeed.innerHTML = "";
			resetStreamingState();
			clearSelectedFiles();
			appendTranscriptMessage("system", "会话", "新会话已就绪");
			appendProcessEvent("system", "会话启动", "等待新的流式任务");
			clearError();
		}

		function describeToolEvent(event, prefix) {
			const payload = event.args || event.partialResult || event.result || "";
			return prefix + " " + event.toolName + (payload ? "\\n" + payload : "");
		}

		function handleStreamEvent(event) {
			switch (event.type) {
				case "run_started":
					appendProcessEvent("system", "任务开始", event.conversationId);
					statusPill.textContent = "运行中";
					break;
				case "tool_started":
					appendProcessEvent("tool", "工具开始", describeToolEvent(event, "调用"));
					break;
				case "tool_updated":
					appendProcessEvent("tool", "工具更新", describeToolEvent(event, "片段"));
					break;
				case "tool_finished":
					appendProcessEvent(
						event.isError ? "error" : "ok",
						"工具结束",
						describeToolEvent(event, event.isError ? "失败" : "完成"),
					);
					break;
				case "queue_updated":
					appendProcessEvent(
						"system",
						"队列更新",
						"转向消息: " + event.steering.length + "\\n追加消息: " + event.followUp.length,
					);
					break;
				case "interrupted":
					appendProcessEvent("system", "任务已打断", event.conversationId);
					statusPill.textContent = "已打断";
					break;
				case "text_delta": {
					state.streamingText += event.textDelta;
					const content = ensureStreamingAssistantMessage();
					content.innerHTML = renderMessageMarkdown(state.streamingText);
					hydrateMarkdownContent(content);
					scrollTranscriptToBottom();
					break;
				}
				case "done": {
					state.receivedDoneEvent = true;
					sessionFile.textContent = event.sessionFile || "不可用";
					if (event.text && event.text !== state.streamingText) {
						const content = ensureStreamingAssistantMessage();
						content.innerHTML = renderMessageMarkdown(event.text);
						hydrateMarkdownContent(content);
						state.streamingText = event.text;
					}
					appendFileDownloads(event.files);
					appendProcessEvent("ok", "任务完成", event.sessionFile || "未返回会话文件");
					statusPill.textContent = "完成";
					break;
				}
				case "error":
					showError(event.message);
					appendProcessEvent("error", "任务错误", event.message);
					break;
				default:
					appendProcessEvent("system", "事件", JSON.stringify(event));
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
			const message = messageInput.value.trim();
			const attachments = [...state.pendingAttachments];
			if (!message && attachments.length === 0) {
				showError("请输入消息");
				return;
			}
			const outboundMessage = message || "\\u8bf7\\u67e5\\u770b\\u6211\\u53d1\\u9001\\u7684\\u9644\\u4ef6";

			ensureConversationId();
			clearError();

			if (state.loading) {
				await queueActiveMessage(outboundMessage, attachments);
				return;
			}

			resetStreamingState();
			appendTranscriptMessage("user", state.conversationId, formatMessageWithAttachments(outboundMessage, attachments));
			appendProcessEvent("system", "请求已发送", formatMessageWithAttachments(outboundMessage, attachments));
			setLoading(true);

			try {
				const payload = {
					conversationId: state.conversationId,
					message: outboundMessage,
					userId: "web-playground",
				};
				if (attachments.length > 0) {
					payload.attachments = attachments;
				}
				const response = await fetch("/v1/chat/stream", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					const body = await response.json().catch(() => ({}));
					const errorMessage = body?.error?.message || body?.message || "未知错误";
					showError(errorMessage);
					appendProcessEvent("error", "请求被拒绝", errorMessage);
					appendTranscriptMessage("error", "服务端", errorMessage);
					return;
				}

				await readEventStream(response, handleStreamEvent);

				if (!state.receivedDoneEvent && !errorBanner.classList.contains("visible")) {
					showError("流已结束，但没有收到完成事件");
					appendProcessEvent("error", "流被中断", "缺少 done 事件");
				}

				if (state.receivedDoneEvent) {
					messageInput.value = "";
					clearSelectedFiles();
					messageInput.focus();
				}
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "请求失败";
				showError(messageText);
				appendProcessEvent("error", "网络错误", messageText);
				appendTranscriptMessage("error", "网络", messageText);
			} finally {
				setLoading(false);
			}
		}

		async function queueActiveMessage(message, attachments) {
			appendTranscriptMessage("user", state.conversationId, formatMessageWithAttachments(message, attachments));
			appendProcessEvent("system", "消息已追加", formatMessageWithAttachments(message, attachments));

			try {
				const payloadBody = {
					conversationId: state.conversationId,
					message,
					mode: "followUp",
					userId: "web-playground",
				};
				if (attachments.length > 0) {
					payloadBody.attachments = attachments;
				}
				const response = await fetch("/v1/chat/queue", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payloadBody),
				});

				const payload = await response.json().catch(() => ({}));
				if (!response.ok || !payload.queued) {
					const errorMessage =
						payload?.error?.message ||
						payload?.reason ||
						"消息无法追加";
					showError(errorMessage);
					appendProcessEvent("error", "追加被拒绝", errorMessage);
					return;
				}

				messageInput.value = "";
				clearSelectedFiles();
				messageInput.focus();
				appendProcessEvent("ok", "消息已追加", payload.conversationId);
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "追加请求失败";
				showError(messageText);
				appendProcessEvent("error", "追加失败", messageText);
			}
		}

		async function interruptRun() {
			if (!state.loading) {
				return;
			}

			ensureConversationId();
			appendProcessEvent("system", "请求打断", state.conversationId);

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
					const errorMessage =
						payload?.error?.message ||
						payload?.reason ||
						"当前任务无法打断";
					showError(errorMessage);
					appendProcessEvent("error", "打断被拒绝", errorMessage);
					return;
				}
				appendProcessEvent("ok", "打断已接受", state.conversationId);
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "打断请求失败";
				showError(messageText);
				appendProcessEvent("error", "打断失败", messageText);
			}
		}

		async function loadSkills() {
			clearError();
			appendProcessEvent("system", "技能清单", "请求 /v1/debug/skills");
			viewSkillsButton.disabled = true;

			try {
				const response = await fetch("/v1/debug/skills", {
					method: "GET",
					headers: { "accept": "application/json" },
				});

				if (!response.ok) {
					const body = await response.json().catch(() => ({}));
					const errorMessage = body?.error?.message || body?.message || "加载运行时技能失败";
					showError(errorMessage);
					appendProcessEvent("error", "技能清单失败", errorMessage);
					appendTranscriptMessage("error", "技能", errorMessage);
					return;
				}

				const payload = await response.json();
				const report = formatSkillsReport(payload?.skills);
				appendTranscriptMessage("system", "技能", report);
				appendProcessEvent("ok", "技能清单已加载", report);
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "加载运行时技能失败";
				showError(messageText);
				appendProcessEvent("error", "技能清单失败", messageText);
				appendTranscriptMessage("error", "技能", messageText);
			} finally {
				viewSkillsButton.disabled = state.loading;
			}
		}

		conversationInput.value = state.conversationId;
		if (!conversationInput.value) {
			resetConversation();
		} else {
			appendTranscriptMessage("system", "会话", "已从本地存储恢复会话");
			appendProcessEvent("system", "会话已恢复", state.conversationId);
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
				applyFileIntentMessage(state.pendingAttachments, sourceLabel);
				appendProcessEvent("system", "文件已载入", formatMessageWithAttachments("待发送附件", state.pendingAttachments));
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
		bindDropTarget(pageRoot);
		bindDropTarget(pageBody);
		bindDropTarget(chatStage);
		bindDropTarget(composerDropTarget);
		bindDropTarget(dropZone);
		renderDragDebugLog();

		clearDragDebugButton.addEventListener("click", () => {
			state.dragDebugEvents = [];
			state.lastDragDebugKey = "";
			state.lastDragDebugAt = 0;
			renderDragDebugLog();
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

		newConversationButton.addEventListener("click", () => {
			resetConversation();
			messageInput.focus();
		});

		messageInput.addEventListener("keydown", (event) => {
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				void sendMessage();
			}
		});
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
		<div class="shell">
			<header class="topbar">
				<div class="topbar-left">
					<div class="brand-lockup">
						<pre class="corgi-logo" aria-label="柯基字符画"> /\\___/\\
(  o o  )
 \\  ^  /
 /|___|\\
  /   \\</pre>
						<div>
							<div class="kicker">柯基控制台</div>
							<h1>UGK Claw</h1>
							<p>左侧看对话，右侧看执行过程。运行中继续发送会追加到后续队列；需要停下当前任务时直接打断。</p>
						</div>
					</div>
				</div>
				<div class="topbar-right">
					<div class="status-row"><span>主题</span><strong>深色 / 极客</strong></div>
					<div class="status-row"><span>传输</span><strong>SSE / 流式</strong></div>
					<div class="status-row"><span>发送</span><strong>Enter</strong></div>
				</div>
			</header>

			<main id="chat-stage" class="chat-stage">
				<section class="chat-meta">
					<div class="meta-chip">
						<strong>会话</strong>
						<input id="conversation-id" name="conversation-id" placeholder="manual:web-xxxx" />
					</div>
					<div class="meta-chip">
						<strong>会话文件</strong>
						<span id="session-file">尚未分配</span>
					</div>
					<button id="view-skills-button" type="button">查看技能</button>
					<button id="new-conversation-button" type="button">新会话</button>
				</section>

				<section class="banner-row">
					<span>接口：POST /v1/chat/stream</span>
					<div id="status-pill" class="state">就绪</div>
				</section>

				<div id="error-banner" class="error-banner" role="alert"></div>

				<section class="stream-layout">
					<div class="transcript-pane">
						<header class="pane-head">
							<strong>对话流</strong>
							<span>对话内容边生成边显示，消息区自动滚到最新位置。</span>
						</header>
						<section id="transcript" class="transcript" aria-live="polite"></section>
					</div>

					<aside class="process-panel">
						<header class="pane-head">
							<strong>过程流</strong>
							<span>右侧默认展示摘要；遇到长工具参数或大结果时，可以点开看完整细节。</span>
						</header>
						<section id="process-feed" class="process-feed" aria-live="polite"></section>
					</aside>
				</section>

				<section id="composer-drop-target" class="composer">
					<div class="composer-main">
						<div class="composer-header">
							<span>消息</span>
							<span>Shift+Enter 换行</span>
						</div>
						<textarea id="message" name="message" placeholder="输入消息，按 Enter 发送"></textarea>
						<div class="file-strip">
							<div id="drop-zone" class="drop-zone">
								<div class="drop-zone-label">
									<span>拖入文件或点击选择</span>
									<span>文本会随消息发送</span>
								</div>
								<input id="file-input" class="file-input" name="files" type="file" multiple />
							</div>
							<div id="file-list" class="file-list" aria-live="polite"></div>
							<section class="drag-debug" aria-live="polite">
								<div class="drag-debug-head">
									<span>drag debug</span>
									<button id="clear-drag-debug" type="button">clear</button>
								</div>
								<div id="drag-debug-log" class="drag-debug-log"></div>
							</section>
						</div>
					</div>
					<div class="composer-side">
						<button id="send-button" type="button">发送</button>
						<button id="interrupt-button" type="button" disabled>打断</button>
					</div>
				</section>
			</main>
		</div>
		<script>${getPlaygroundScript()}</script>
	</body>
</html>`;
}
