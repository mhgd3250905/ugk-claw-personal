export function getBrowserMarkdownRendererScript(): string {
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

export function getPlaygroundTranscriptRendererScript(): string {
	return `
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
			head.innerHTML = "<span>鍘嗗彶浼氳瘽</span><strong></strong>";
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
				runButton.textContent = "⌕";
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

		function ensureStreamingAssistantMessage() {
			if (!state.activeAssistantContent) {
				state.activeAssistantContent = appendTranscriptMessage("assistant", "助手", "");
			}
			return state.activeAssistantContent;
		}

		function bindPlaygroundTranscriptRenderer() {
			transcriptCurrent.querySelectorAll(".message-content").forEach((content) => {
				hydrateMarkdownContent(content);
			});
		}
	`;
}
