export function getPlaygroundAssetElementRefsScript(): string {
	return `
		const dropZone = document.getElementById("drop-zone");
		const fileInput = document.getElementById("file-input");
		const filePickerAction = document.getElementById("file-picker-action");
		const fileList = document.getElementById("file-list");
		const selectedAssetsSection = document.getElementById("selected-assets");
		const selectedAssetList = document.getElementById("selected-asset-list");
	`;
}

export function getPlaygroundAssetControllerScript(): string {
	return `
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

		const MAX_COMPOSER_ATTACHMENTS = 5;

		async function collectAttachments(files) {
			const selected = Array.from(files || []).slice(0, MAX_COMPOSER_ATTACHMENTS);
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

		function appendComposerSystemNotice(message) {
			const text = String(message || "").trim();
			if (!text) {
				return;
			}
			if (!state.conversationId) {
				ensureConversationId();
			}
			appendTranscriptMessage("notification", "\\u7cfb\\u7edf\\u63d0\\u793a", text, {
				forceScroll: true,
			});
		}

		function isAttachmentLimitProcessNote(title, detail) {
			const text = (String(title || "") + " " + String(detail || "")).toLowerCase();
			return (
				text.includes("\\u6587\\u4ef6\\u5df2\\u622a\\u65ad") ||
				text.includes("\\u4e00\\u6b21\\u6700\\u591a\\u53d1\\u9001 5 \\u4e2a\\u6587\\u4ef6") ||
				text.includes("max 5 files")
			);
		}

		function notifyAttachmentLimitIfNeeded(files) {
			const totalCount = Array.from(files || []).length;
			if (totalCount <= MAX_COMPOSER_ATTACHMENTS) {
				return;
			}
			appendComposerSystemNotice(
				"\\u4e00\\u6b21\\u6700\\u591a\\u53d1\\u9001 " +
					MAX_COMPOSER_ATTACHMENTS +
					" \\u4e2a\\u6587\\u4ef6\\uff0c\\u5df2\\u4fdd\\u7559\\u524d " +
					MAX_COMPOSER_ATTACHMENTS +
					" \\u4e2a\\u3002\\u591a\\u51fa\\u7684 " +
					(totalCount - MAX_COMPOSER_ATTACHMENTS) +
					" \\u4e2a\\u8bf7\\u5206\\u6279\\u53d1\\u9001\\u3002",
			);
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

		function getAssetPickerTarget() {
			return state.assetPickerTarget === "connEditor" ? "connEditor" : "composer";
		}

		function getSelectedAssetRefsForTarget(target) {
			return target === "connEditor" ? state.connEditorSelectedAssetRefs : state.selectedAssetRefs;
		}

		function setSelectedAssetRefsForTarget(target, assetRefs) {
			const normalized = Array.isArray(assetRefs)
				? Array.from(new Set(assetRefs.map((assetId) => String(assetId || "").trim()).filter(Boolean)))
				: [];
			if (target === "connEditor") {
				state.connEditorSelectedAssetRefs = normalized;
				if (typeof renderConnEditorSelectedAssets === "function") {
					renderConnEditorSelectedAssets();
				}
				return;
			}
			state.selectedAssetRefs = normalized;
			renderSelectedAssets();
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
			const selectedAssetRefs = getSelectedAssetRefsForTarget(getAssetPickerTarget());
			if (!Array.isArray(state.recentAssets) || state.recentAssets.length === 0) {
				const empty = document.createElement("div");
				empty.className = "asset-empty";
				empty.textContent = "暂无可复用资产，先上传文件或让助手生成文件。";
				assetModalList.appendChild(empty);
				return;
			}

			for (const asset of state.recentAssets) {
				const item = document.createElement("div");
				item.className = "asset-pill" + (selectedAssetRefs.includes(asset.assetId) ? " active" : "");
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
				toggleButton.textContent = selectedAssetRefs.includes(asset.assetId) ? "已选" : "复用";
				toggleButton.disabled = selectedAssetRefs.includes(asset.assetId);
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

		function openAssetLibrary(restoreFocusElement, options) {
			state.assetModalOpen = true;
			state.assetPickerTarget = options?.target === "connEditor" ? "connEditor" : "composer";
			state.assetModalRestoreFocusElement = rememberPanelReturnFocus(
				restoreFocusElement || openAssetLibraryButton,
			);
			assetModal.hidden = false;
			assetModal.classList.add("open");
			assetModal.setAttribute("aria-hidden", "false");
			renderAssetPickerList();
		}

		function closeAssetLibrary() {
			state.assetModalOpen = false;
			state.assetPickerTarget = "composer";
			restoreFocusAfterPanelClose(assetModal, state.assetModalRestoreFocusElement);
			state.assetModalRestoreFocusElement = null;
			assetModal.classList.remove("open");
			assetModal.hidden = true;
			assetModal.setAttribute("aria-hidden", "true");
		}

		function selectAssetForReuse(assetId) {
			const target = getAssetPickerTarget();
			const selectedAssetRefs = getSelectedAssetRefsForTarget(target);
			if (!selectedAssetRefs.includes(assetId)) {
				setSelectedAssetRefsForTarget(target, [...selectedAssetRefs, assetId]);
			}
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
				notifyAttachmentLimitIfNeeded(files);
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
			if (typeof renderConnEditorSelectedAssets === "function") {
				renderConnEditorSelectedAssets();
			}
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
				state.connEditorSelectedAssetRefs = state.connEditorSelectedAssetRefs.filter((assetId) =>
					state.recentAssets.some((asset) => asset.assetId === assetId),
				);
				renderSelectedAssets();
				if (typeof renderConnEditorSelectedAssets === "function") {
					renderConnEditorSelectedAssets();
				}
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

	`;
}

export function getPlaygroundAssetEventHandlersScript(): string {
	return `
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

		filePickerAction.addEventListener("click", () => {
			fileInput.click();
		});

		fileInput.addEventListener("change", async () => {
			await handleDroppedFiles(fileInput.files, "pick");
			if (fileInput.files && fileInput.files.length > 5) {
				appendProcessEvent("system", "\\u6587\\u4ef6\\u5df2\\u622a\\u65ad", "\\u4e00\\u6b21\\u6700\\u591a\\u53d1\\u9001 5 \\u4e2a\\u6587\\u4ef6");
			}
		});


		refreshAssetsButton.addEventListener("click", () => {
			void loadAssets(false);
		});

		openAssetLibraryButton.addEventListener("click", () => {
			openAssetLibrary(openAssetLibraryButton);
		});

		closeAssetModalButton.addEventListener("click", () => {
			closeAssetLibrary();
		});

		assetModal.addEventListener("click", (event) => {
			if (event.target === assetModal) {
				closeAssetLibrary();
			}
		});
	`;
}
