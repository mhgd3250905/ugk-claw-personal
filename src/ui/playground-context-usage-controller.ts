export function getPlaygroundContextUsageConstantsScript(): string {
	return `
		const FALLBACK_CONTEXT_WINDOW = 128000;
		const FALLBACK_RESPONSE_TOKENS = 16384;
		const FALLBACK_RESERVE_TOKENS = 16384;
		const PROMPT_TEXT_ASSET_FALLBACK_CHARS = 24000;
	`;
}

export function getPlaygroundContextUsageElementRefsScript(): string {
	return `
		const contextUsageShell = document.getElementById("context-usage-shell");
		const contextUsageProgress = document.getElementById("context-usage-progress");
		const contextUsageSummary = document.getElementById("context-usage-summary");
		const contextUsageMeta = document.getElementById("context-usage-meta");
		const contextUsageToggle = document.getElementById("context-usage-toggle");
		const contextUsageDialog = document.getElementById("context-usage-dialog");
		const contextUsageDialogBody = document.getElementById("context-usage-dialog-body");
		const contextUsageDialogClose = document.getElementById("context-usage-dialog-close");
	`;
}

export function getPlaygroundContextUsageControllerScript(): string {
	return `
		function formatTokenCount(value) {
			const normalized = Math.max(0, Math.round(Number(value) || 0));
			return normalized.toLocaleString("en-US");
		}

		function escapeContextUsageHtml(value) {
			return String(value || "")
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#39;");
		}

		function renderContextUsageMetric(label, value, note) {
			return (
				'<section class="context-usage-dialog-metric">' +
				'<span>' + escapeContextUsageHtml(label) + '</span>' +
				'<strong>' + escapeContextUsageHtml(value) + '</strong>' +
				'<em>' + escapeContextUsageHtml(note) + '</em>' +
				'</section>'
			);
		}

		function renderContextUsageDialog(projectedUsage, statusLabel, modeLabel) {
			const percent = Math.max(0, Math.min(100, Math.round(Number(projectedUsage.percent) || 0)));
			const availableTokens = formatTokenCount(projectedUsage.availableTokens);
			const currentTokens = formatTokenCount(projectedUsage.currentTokens);
			const contextWindow = formatTokenCount(projectedUsage.contextWindow);
			const draftTokens = formatTokenCount(projectedUsage.draftTokens);
			const reserveTokens = formatTokenCount(projectedUsage.reserveTokens);
			const responseTokens = formatTokenCount(projectedUsage.maxResponseTokens);
			const model = escapeContextUsageHtml(projectedUsage.model);
			const provider = escapeContextUsageHtml(projectedUsage.provider);
			const status = escapeContextUsageHtml(statusLabel);
			const mode = escapeContextUsageHtml(modeLabel);

			contextUsageDialog.dataset.status = projectedUsage.status;
			contextUsageDialogBody.innerHTML =
				'<div class="context-usage-dialog-hero">' +
				'<div class="context-usage-dialog-kicker">Context Window</div>' +
				'<div class="context-usage-dialog-main">' +
				'<strong>' + percent + '%</strong>' +
				'<span>' + status + '</span>' +
				'</div>' +
				'<div class="context-usage-dialog-meter" aria-hidden="true">' +
				'<span style="width: ' + percent + '%"></span>' +
				'</div>' +
				'<p>' + currentTokens + ' / ' + contextWindow + ' tokens</p>' +
				'</div>' +
				'<div class="context-usage-dialog-metrics">' +
				renderContextUsageMetric("已用", currentTokens, "当前会话") +
				renderContextUsageMetric("可用", availableTokens, "扣除预留后") +
				renderContextUsageMetric("待发", draftTokens, "输入与附件") +
				renderContextUsageMetric("预留", reserveTokens, "回复预算") +
				'</div>' +
				'<div class="context-usage-dialog-model">' +
				'<span>' + model + '</span>' +
				'<span>' + provider + '</span>' +
				'<span>' + mode + '</span>' +
				'<span>max ' + responseTokens + '</span>' +
				'</div>';
		}

		function renderContextUsageTooltip(projectedUsage, statusLabel, modeLabel, summaryPrefix) {
			const percent = Math.max(0, Math.min(100, Math.round(Number(projectedUsage.percent) || 0)));
			const currentTokens = formatTokenCount(projectedUsage.currentTokens);
			const contextWindow = formatTokenCount(projectedUsage.contextWindow);
			const baseTokens = formatTokenCount(projectedUsage.baseTokens);
			const draftTokens = formatTokenCount(projectedUsage.draftTokens);
			const availableTokens = formatTokenCount(projectedUsage.availableTokens);
			const model = escapeContextUsageHtml(projectedUsage.model);
			const provider = escapeContextUsageHtml(projectedUsage.provider);

			contextUsageMeta.innerHTML =
				'<span class="context-usage-meta-head">' +
				'<span class="context-usage-meta-kicker">' + escapeContextUsageHtml(summaryPrefix) + '</span>' +
				'<span class="context-usage-meta-status">' + escapeContextUsageHtml(statusLabel) + '</span>' +
				'</span>' +
				'<span class="context-usage-meta-main">' +
				'<strong>' + percent + '%</strong>' +
				'<em>' + currentTokens + ' / ' + contextWindow + ' tokens</em>' +
				'</span>' +
				'<span class="context-usage-meta-grid">' +
				'<span class="context-usage-meta-item"><span>会话</span><strong>' + baseTokens + '</strong></span>' +
				'<span class="context-usage-meta-item"><span>待发</span><strong>' + draftTokens + '</strong></span>' +
				'<span class="context-usage-meta-item"><span>可用</span><strong>' + availableTokens + '</strong></span>' +
				'</span>' +
				'<span class="context-usage-meta-model">' +
				'<span>' + model + '</span>' +
				'<span>' + provider + '</span>' +
				'<span>' + escapeContextUsageHtml(modeLabel) + '</span>' +
				'</span>';
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

		function estimateStoredTextAssetTokenCount(sizeBytes) {
			const normalizedSize = Math.max(0, Number.isFinite(sizeBytes) ? Number(sizeBytes) : 0);
			if (normalizedSize === 0) {
				return estimateTextTokenCount("");
			}
			return Math.ceil(Math.min(normalizedSize, PROMPT_TEXT_ASSET_FALLBACK_CHARS) / 4);
		}

		function estimateMetadataAssetTokenCount(asset) {
			return Math.max(
				64,
				estimateTextTokenCount(
					[
						String(asset?.fileName || ""),
						String(asset?.mimeType || ""),
						String(asset?.kind || ""),
						typeof asset?.hasContent === "boolean" ? (asset.hasContent ? "stored content" : "metadata only") : "",
					]
						.filter(Boolean)
						.join(" "),
				),
			);
		}

		function estimatePromptAssetTokenCount(asset) {
			if (typeof asset?.textContent === "string" && asset.textContent.length > 0) {
				return estimateTextTokenCount(asset.textContent);
			}
			if (typeof asset?.textPreview === "string" && asset.textPreview.length > 0) {
				return estimateTextTokenCount(asset.textPreview);
			}
			if (asset?.kind === "text" && asset?.hasContent) {
				return estimateStoredTextAssetTokenCount(asset?.sizeBytes);
			}
			return estimateMetadataAssetTokenCount(asset);
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
			const assetTokens = selectedAssets.reduce((sum, asset) => sum + estimatePromptAssetTokenCount(asset), 0);

			return {
				messageTokens,
				assetTokens,
				totalTokens: messageTokens + assetTokens,
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
				assetTokens: Math.max(0, Number(draftUsage?.assetTokens) || 0),
			};
		}

		function renderContextUsageBar() {
			const draftUsage = estimateDraftContextTokens();
			const projectedUsage = buildProjectedContextUsage(state.contextUsage, draftUsage);
			const hasDraft = draftUsage.totalTokens > 0;
			const summaryPrefix = hasDraft ? "预计发送后" : "当前上下文";
			const statusLabel = CONTEXT_STATUS_LABELS[projectedUsage.status] || CONTEXT_STATUS_LABELS.safe;
			const modeLabel = projectedUsage.mode === "usage" ? "基于最近一次 usage" : "按当前输入估算";

			contextUsageShell.dataset.status = projectedUsage.status;
			contextUsageShell.dataset.expanded = state.contextUsageExpanded ? "true" : "false";
			contextUsageSummary.textContent = projectedUsage.percent + "%";
			contextUsageShell.setAttribute("aria-label", "上下文使用 " + projectedUsage.percent + "%，" + statusLabel);
			renderContextUsageTooltip(projectedUsage, statusLabel, modeLabel, summaryPrefix);
			renderContextUsageDialog(projectedUsage, statusLabel, modeLabel);
			contextUsageProgress.style.setProperty("--context-usage-percent", projectedUsage.percent + "%");
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
			contextUsageDialog.inert = false;
			contextUsageDialog.removeAttribute("inert");
			contextUsageDialog.classList.add("open");
			contextUsageDialog.setAttribute("aria-hidden", "false");
			contextUsageDialogClose.focus({ preventScroll: true });
		}

		function closeContextUsageDialog() {
			releasePanelFocusBeforeHide(contextUsageDialog, contextUsageShell);
			contextUsageDialog.classList.remove("open");
			contextUsageDialog.hidden = true;
			contextUsageDialog.inert = true;
			contextUsageDialog.setAttribute("inert", "");
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

	`;
}

export function getPlaygroundContextUsageEventHandlersScript(): string {
	return `
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



		const debouncedRenderContextUsage = debounce(renderContextUsageBar, 150);
		messageInput.addEventListener("input", () => {
			syncComposerTextareaHeight();
			debouncedRenderContextUsage();
		});

	`;
}
