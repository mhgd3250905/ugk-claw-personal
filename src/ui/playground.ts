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

		@media (max-width: 960px) {
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
		};

		const transcript = document.getElementById("transcript");
		const processFeed = document.getElementById("process-feed");
		const errorBanner = document.getElementById("error-banner");
		const sessionFile = document.getElementById("session-file");
		const conversationInput = document.getElementById("conversation-id");
		const messageInput = document.getElementById("message");
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
			sendButton.textContent = "send";
			interruptButton.disabled = !next;
			viewSkillsButton.disabled = next;
			messageInput.disabled = false;
			conversationInput.disabled = next;
			newConversationButton.disabled = next;
			statusPill.textContent = next ? "streaming" : "ready";
		}

		function showError(message) {
			errorBanner.textContent = message;
			errorBanner.classList.add("visible");
			statusPill.textContent = "error";
		}

		function clearError() {
			errorBanner.textContent = "";
			errorBanner.classList.remove("visible");
			if (!state.loading) {
				statusPill.textContent = "ready";
			}
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
				label.textContent = language || "code";

				const copyButton = document.createElement("button");
				copyButton.type = "button";
				copyButton.className = "copy-code-button";
				copyButton.textContent = "copy";
				copyButton.addEventListener("click", async () => {
					const original = copyButton.textContent || "copy";
					copyButton.disabled = true;

					try {
						await copyTextToClipboard(code?.textContent || pre.textContent || "");
						copyButton.textContent = "copied";
					} catch {
						copyButton.textContent = "failed";
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
					summary: "no detail",
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
			button.textContent = expanded ? "collapse details" : "expand details";
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
				toggle.textContent = "expand details";
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
				return "runtime skills (0)\\n\\nno skills reported by /v1/debug/skills";
			}

			return [
				"runtime skills (" + skills.length + ")",
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
				state.activeAssistantContent = appendTranscriptMessage("assistant", "agent", "");
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
			sessionFile.textContent = "not assigned yet";
			transcript.innerHTML = "";
			processFeed.innerHTML = "";
			resetStreamingState();
			appendTranscriptMessage("system", "session", "new conversation ready");
			appendProcessEvent("system", "session boot", "waiting for a fresh streamed run");
			clearError();
		}

		function describeToolEvent(event, prefix) {
			const payload = event.args || event.partialResult || event.result || "";
			return prefix + " " + event.toolName + (payload ? "\\n" + payload : "");
		}

		function handleStreamEvent(event) {
			switch (event.type) {
				case "run_started":
					appendProcessEvent("system", "run started", event.conversationId);
					statusPill.textContent = "running";
					break;
				case "tool_started":
					appendProcessEvent("tool", "tool start", describeToolEvent(event, "calling"));
					break;
				case "tool_updated":
					appendProcessEvent("tool", "tool update", describeToolEvent(event, "partial"));
					break;
				case "tool_finished":
					appendProcessEvent(
						event.isError ? "error" : "ok",
						"tool end",
						describeToolEvent(event, event.isError ? "failed" : "completed"),
					);
					break;
				case "queue_updated":
					appendProcessEvent(
						"system",
						"queue update",
						"steer: " + event.steering.length + "\\nfollow-up: " + event.followUp.length,
					);
					break;
				case "interrupted":
					appendProcessEvent("system", "run interrupted", event.conversationId);
					statusPill.textContent = "interrupted";
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
					sessionFile.textContent = event.sessionFile || "not available";
					if (!state.streamingText && event.text) {
						const content = ensureStreamingAssistantMessage();
						content.innerHTML = renderMessageMarkdown(event.text);
						hydrateMarkdownContent(content);
						state.streamingText = event.text;
					}
					appendProcessEvent("ok", "run complete", event.sessionFile || "session file not returned");
					statusPill.textContent = "ok";
					break;
				}
				case "error":
					showError(event.message);
					appendProcessEvent("error", "run error", event.message);
					break;
				default:
					appendProcessEvent("system", "event", JSON.stringify(event));
					break;
			}
		}

		async function readEventStream(response, onEvent) {
			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error("streaming reader is not available");
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
			if (!message) {
				showError("message is required");
				return;
			}

			ensureConversationId();
			clearError();

			if (state.loading) {
				await queueActiveMessage(message);
				return;
			}

			resetStreamingState();
			appendTranscriptMessage("user", state.conversationId, message);
			appendProcessEvent("system", "request queued", message);
			setLoading(true);

			try {
				const response = await fetch("/v1/chat/stream", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						conversationId: state.conversationId,
						message,
						userId: "web-playground",
					}),
				});

				if (!response.ok) {
					const body = await response.json().catch(() => ({}));
					const errorMessage = body?.error?.message || body?.message || "unknown error";
					showError(errorMessage);
					appendProcessEvent("error", "request rejected", errorMessage);
					appendTranscriptMessage("error", "server", errorMessage);
					return;
				}

				await readEventStream(response, handleStreamEvent);

				if (!state.receivedDoneEvent && !errorBanner.classList.contains("visible")) {
					showError("stream ended before a completion event was received");
					appendProcessEvent("error", "stream interrupted", "done event missing");
				}

				if (state.receivedDoneEvent) {
					messageInput.value = "";
					messageInput.focus();
				}
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "request failed";
				showError(messageText);
				appendProcessEvent("error", "network", messageText);
				appendTranscriptMessage("error", "network", messageText);
			} finally {
				setLoading(false);
			}
		}

		async function queueActiveMessage(message) {
			appendTranscriptMessage("user", state.conversationId, message);
			appendProcessEvent("system", "message queued", message);

			try {
				const response = await fetch("/v1/chat/queue", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						conversationId: state.conversationId,
						message,
						mode: "followUp",
						userId: "web-playground",
					}),
				});

				const payload = await response.json().catch(() => ({}));
				if (!response.ok || !payload.queued) {
					const errorMessage =
						payload?.error?.message ||
						payload?.reason ||
						"message could not be queued";
					showError(errorMessage);
					appendProcessEvent("error", "queue rejected", errorMessage);
					return;
				}

				messageInput.value = "";
				messageInput.focus();
				appendProcessEvent("ok", "message queued", payload.conversationId);
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "queue request failed";
				showError(messageText);
				appendProcessEvent("error", "queue failed", messageText);
			}
		}

		async function interruptRun() {
			if (!state.loading) {
				return;
			}

			ensureConversationId();
			appendProcessEvent("system", "interrupt requested", state.conversationId);

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
						"active run could not be interrupted";
					showError(errorMessage);
					appendProcessEvent("error", "interrupt rejected", errorMessage);
					return;
				}
				appendProcessEvent("ok", "interrupt accepted", state.conversationId);
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "interrupt request failed";
				showError(messageText);
				appendProcessEvent("error", "interrupt failed", messageText);
			}
		}

		async function loadSkills() {
			clearError();
			appendProcessEvent("system", "skill registry", "requesting /v1/debug/skills");
			viewSkillsButton.disabled = true;

			try {
				const response = await fetch("/v1/debug/skills", {
					method: "GET",
					headers: { "accept": "application/json" },
				});

				if (!response.ok) {
					const body = await response.json().catch(() => ({}));
					const errorMessage = body?.error?.message || body?.message || "failed to load runtime skills";
					showError(errorMessage);
					appendProcessEvent("error", "skill registry failed", errorMessage);
					appendTranscriptMessage("error", "skills", errorMessage);
					return;
				}

				const payload = await response.json();
				const report = formatSkillsReport(payload?.skills);
				appendTranscriptMessage("system", "skills", report);
				appendProcessEvent("ok", "skill registry loaded", report);
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "failed to load runtime skills";
				showError(messageText);
				appendProcessEvent("error", "skill registry failed", messageText);
				appendTranscriptMessage("error", "skills", messageText);
			} finally {
				viewSkillsButton.disabled = state.loading;
			}
		}

		conversationInput.value = state.conversationId;
		if (!conversationInput.value) {
			resetConversation();
		} else {
			appendTranscriptMessage("system", "session", "conversation restored from localStorage");
			appendProcessEvent("system", "session restored", state.conversationId);
		}

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
		<title>UGK PI Test Console</title>
		<style>${getPlaygroundStyles()}</style>
	</head>
	<body>
		<div class="shell">
			<header class="topbar">
				<div class="topbar-left">
					<div class="kicker">UGK PI Test Console</div>
					<h1>Watch The Agent Run</h1>
					<p>左边是对话流，右边是 agent 实时过程。默认只看摘要，长参数和大结果按需展开，终于不用被日志瀑布淹死。</p>
				</div>
				<div class="topbar-right">
					<div class="status-row"><span>theme</span><strong>dark / geek</strong></div>
					<div class="status-row"><span>transport</span><strong>sse / stream</strong></div>
					<div class="status-row"><span>send</span><strong>enter</strong></div>
				</div>
			</header>

			<main id="chat-stage" class="chat-stage">
				<section class="chat-meta">
					<div class="meta-chip">
						<strong>conversation</strong>
						<input id="conversation-id" name="conversation-id" placeholder="manual:web-xxxx" />
					</div>
					<div class="meta-chip">
						<strong>session file</strong>
						<span id="session-file">not assigned yet</span>
					</div>
					<button id="view-skills-button" type="button">view skills</button>
					<button id="new-conversation-button" type="button">new conversation</button>
				</section>

				<section class="banner-row">
					<span>route: POST /v1/chat/stream</span>
					<div id="status-pill" class="state">ready</div>
				</section>

				<div id="error-banner" class="error-banner" role="alert"></div>

				<section class="stream-layout">
					<div class="transcript-pane">
						<header class="pane-head">
							<strong>conversation stream</strong>
							<span>对话内容边生成边显示，消息区自动滚到最新位置。</span>
						</header>
						<section id="transcript" class="transcript" aria-live="polite"></section>
					</div>

					<aside class="process-panel">
						<header class="pane-head">
							<strong>process feed</strong>
							<span>右侧默认展示摘要；遇到长工具参数或大结果时，可以点开看完整细节。</span>
						</header>
						<section id="process-feed" class="process-feed" aria-live="polite"></section>
					</aside>
				</section>

				<section class="composer">
					<div class="composer-main">
						<div class="composer-header">
							<span>message</span>
							<span>shift+enter = newline</span>
						</div>
						<textarea id="message" name="message" placeholder="type a prompt and hit enter"></textarea>
					</div>
					<div class="composer-side">
						<button id="send-button" type="button">send</button>
						<button id="interrupt-button" type="button" disabled>interrupt</button>
					</div>
				</section>
			</main>
		</div>
		<script>${getPlaygroundScript()}</script>
	</body>
</html>`;
}
