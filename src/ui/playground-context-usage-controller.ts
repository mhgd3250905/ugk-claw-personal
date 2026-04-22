export function getPlaygroundContextUsageConstantsScript(): string {
	return `
		const FALLBACK_CONTEXT_WINDOW = 128000;
		const FALLBACK_RESPONSE_TOKENS = 16384;
		const FALLBACK_RESERVE_TOKENS = 16384;
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
