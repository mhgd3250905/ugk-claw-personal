export function getPlaygroundConversationControllerScript(): string {
	return `
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
				const hasPendingSwitch = Object.keys(state.conversationSwitchPendingById || {}).length > 0;
				const switching = Boolean(state.conversationSwitchPendingById?.[item.conversationId]);
				button.disabled = state.loading || hasPendingSwitch;
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

		function renderConversationListInto(container) {
			if (!container) {
				return;
			}
			container.innerHTML = "";
			const catalog = Array.isArray(state.conversationCatalog) ? state.conversationCatalog : [];
			if (catalog.length === 0) {
				const empty = document.createElement("div");
				empty.className = "mobile-conversation-empty";
				empty.textContent = "\\u8fd8\\u6ca1\\u6709\\u5386\\u53f2\\u4f1a\\u8bdd\\u3002\\u70b9\\u65b0\\u4f1a\\u8bdd\\u540e\\uff0c\\u8fd9\\u91cc\\u4f1a\\u51fa\\u73b0\\u65b0\\u7684\\u4ea7\\u7ebf\\u3002";
				container.appendChild(empty);
				return;
			}

			for (const item of catalog) {
				const shell = document.createElement("div");
				shell.className = "conversation-item-shell";
				const button = document.createElement("button");
				button.type = "button";
				button.className = "mobile-conversation-item";
				button.dataset.conversationId = item.conversationId;
				if (item.conversationId === state.conversationId) {
					button.classList.add("is-active");
				}
				const hasPendingSwitch = Object.keys(state.conversationSwitchPendingById || {}).length > 0;
				const switching = Boolean(state.conversationSwitchPendingById?.[item.conversationId]);
				button.disabled = state.loading || hasPendingSwitch;
				button.innerHTML =
					'<span class="mobile-conversation-title"></span>' +
					'<span class="mobile-conversation-preview"></span>' +
					'<span class="mobile-conversation-meta"><span></span><span></span></span>';
				button.querySelector(".mobile-conversation-title").textContent = item.title || "\\u65b0\\u4f1a\\u8bdd";
				button.querySelector(".mobile-conversation-preview").textContent = item.preview || "\\u6682\\u65e0\\u6458\\u8981";
				const metaNodes = button.querySelectorAll(".mobile-conversation-meta span");
				metaNodes[0].textContent = item.running ? "\\u8fd0\\u884c\\u4e2d" : formatConversationTime(item.updatedAt);
				metaNodes[1].textContent = item.messageCount + " \\u6761";
				button.addEventListener("click", () => {
					void selectConversationFromDrawer(item.conversationId);
				});
				shell.appendChild(button);
				const deleteButton = document.createElement("button");
				deleteButton.type = "button";
				deleteButton.className = "conversation-item-delete";
				deleteButton.textContent = "×";
				deleteButton.disabled = state.loading || item.running || hasPendingSwitch || switching;
				deleteButton.setAttribute("aria-label", "删除会话 " + (item.title || item.conversationId));
				deleteButton.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					void requestDeleteConversation(item, deleteButton);
				});
				button.appendChild(deleteButton);
				container.appendChild(shell);
			}
		}

		function renderConversationDrawer() {
			renderConversationListInto(mobileConversationList);
			renderConversationListInto(desktopConversationList);
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

		const CONVERSATION_CATALOG_FRESH_MS = 1600;

		function getConversationCatalogSnapshot() {
			return {
				currentConversationId: state.conversationId,
				conversations: state.conversationCatalog,
			};
		}

		function markConversationCatalogFresh() {
			state.conversationCatalogSyncedAt = Date.now();
		}

		function abortConversationCatalogSync() {
			const abortController = state.conversationCatalogAbortController;
			state.conversationCatalogAbortController = null;
			state.conversationCatalogSyncPromise = null;
			state.conversationCatalogSyncing = false;
			if (abortController && !abortController.signal.aborted) {
				abortController.abort();
			}
		}

		function releaseConversationCatalogSync(syncPromise, abortController) {
			if (state.conversationCatalogSyncPromise === syncPromise) {
				state.conversationCatalogSyncPromise = null;
				state.conversationCatalogSyncing = false;
			}
			if (abortController && state.conversationCatalogAbortController === abortController) {
				state.conversationCatalogAbortController = null;
			}
		}

		function isConversationCatalogAbortError(error) {
			return (
				error?.name === "AbortError" ||
				error?.code === 20 ||
				(typeof error?.message === "string" && error.message.toLowerCase().includes("abort"))
			);
		}

		function invalidateConversationCatalog() {
			state.conversationCatalogSyncedAt = 0;
			abortConversationCatalogSync();
		}

		async function fetchConversationCatalog(options) {
			const response = await fetch(getAgentApiPath("/chat/conversations"), {
				method: "GET",
				headers: { accept: "application/json" },
				signal: options?.signal,
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
			const response = await fetch(getAgentApiPath("/chat/conversations"), requestOptions);
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
			const response = await fetch(getAgentApiPath("/chat/current"), {
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

		async function deleteConversationOnServer(conversationId) {
			const targetConversationId = String(conversationId || "").trim();
			const response = await fetch(getAgentApiPath("/chat/conversations/" + encodeURIComponent(targetConversationId)), {
				method: "DELETE",
				headers: {
					accept: "application/json",
				},
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法删除会话";
				throw new Error(errorMessage);
			}

			return {
				conversationId: String(payload?.conversationId || targetConversationId).trim(),
				currentConversationId: String(payload?.currentConversationId || "").trim(),
				deleted: payload?.deleted === true,
				reason: typeof payload?.reason === "string" ? payload.reason : undefined,
			};
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
			markConversationCatalogFresh();
			renderConversationDrawer();
			return currentConversationId;
		}

		function upsertConversationCatalogItem(item, options) {
			const normalized = normalizeConversationCatalogItem(item);
			if (!normalized) {
				return "";
			}

			const existingIndex = state.conversationCatalog.findIndex(
				(entry) => entry.conversationId === normalized.conversationId,
			);
			const existingEntry = existingIndex >= 0 ? state.conversationCatalog[existingIndex] : null;
			const merged = {
				conversationId: normalized.conversationId,
				title: normalized.title || existingEntry?.title || "新会话",
				preview: normalized.preview || existingEntry?.preview || "",
				messageCount: normalized.messageCount,
				createdAt: normalized.createdAt || existingEntry?.createdAt || new Date().toISOString(),
				updatedAt: normalized.updatedAt || existingEntry?.updatedAt || new Date().toISOString(),
				running: normalized.running,
			};

			if (existingIndex >= 0) {
				state.conversationCatalog.splice(existingIndex, 1);
			}

			if (options?.isNew || options?.prepend) {
				state.conversationCatalog.unshift(merged);
			} else {
				state.conversationCatalog.push(merged);
			}

			renderConversationDrawer();
			return merged.conversationId;
		}

		function removeConversationCatalogItem(conversationId) {
			state.conversationCatalog = state.conversationCatalog.filter(
				(item) => item?.conversationId !== conversationId,
			);
			renderConversationDrawer();
		}

		async function syncConversationCatalog(options) {
			const hasFreshCatalog =
				!options?.force &&
				state.conversationCatalog.length > 0 &&
				Date.now() - Number(state.conversationCatalogSyncedAt || 0) < CONVERSATION_CATALOG_FRESH_MS;
			if (hasFreshCatalog) {
				return getConversationCatalogSnapshot();
			}

			if (options?.force) {
				abortConversationCatalogSync();
			}

			if (state.conversationCatalogSyncPromise) {
				return await state.conversationCatalogSyncPromise;
			}

			state.conversationCatalogSyncing = true;
			const abortController = typeof AbortController === "function" ? new AbortController() : null;
			state.conversationCatalogAbortController = abortController;
			let syncPromise;
			syncPromise = (async () => {
				try {
					const payload = await fetchConversationCatalog({
						signal: abortController?.signal,
					});
					const currentConversationId = applyConversationCatalog(payload);
					if (
						currentConversationId &&
						options?.activateCurrent !== false &&
						currentConversationId !== state.conversationId
					) {
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
					if (isConversationCatalogAbortError(error)) {
						return getConversationCatalogSnapshot();
					}
					if (!options?.silent) {
						const messageText = error instanceof Error ? error.message : "无法同步会话列表";
						showError(messageText);
					}
					return getConversationCatalogSnapshot();
				} finally {
					releaseConversationCatalogSync(syncPromise, abortController);
				}
			})();
			state.conversationCatalogSyncPromise = syncPromise;
			return await syncPromise;
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
			invalidateConversationSyncOwnership(nextConversationId);
			state.conversationId = nextConversationId;
			conversationInput.value = nextConversationId;
			sessionFile.textContent = "尚未分配";
			state.contextUsage = null;
			state.conversationState = null;
			resetStreamingState();
			clearError();
			renderConversationDrawer();
			markConversationCatalogFresh();
			restoreConversationHistory(nextConversationId);
			void restoreConversationHistoryFromServer(nextConversationId, {
				silent: true,
				clearIfIdle: true,
				attachIfRunning: true,
			});
			if (!options?.skipCatalogSync) {
				void syncConversationCatalog({
					silent: true,
					activateCurrent: false,
				});
			}
			return true;
		}

		function isCurrentConversationBlank() {
			const currentConversationId = String(state.conversationId || "").trim();
			if (!currentConversationId || state.loading || state.conversationState?.activeRun) {
				return false;
			}

			const currentCatalogItem = state.conversationCatalog.find(
				(item) => item?.conversationId === currentConversationId,
			);
			const catalogMessageCount = Number(currentCatalogItem?.messageCount || 0);
			const stateMessages = Array.isArray(state.conversationState?.viewMessages)
				? state.conversationState.viewMessages
				: Array.isArray(state.conversationState?.messages)
					? state.conversationState.messages
					: [];
			const visibleMessageCount = stateMessages.length;
			const hasDraft =
				String(messageInput.value || "").trim().length > 0 ||
				Number(fileInput.files?.length || 0) > 0 ||
				(Array.isArray(state.selectedAssetRefs) && state.selectedAssetRefs.length > 0);

			return (
				!hasDraft &&
				catalogMessageCount === 0 &&
				visibleMessageCount === 0 &&
				renderedMessages.size === 0
			);
		}

		async function selectConversationFromDrawer(conversationId) {
				if (state.workspaceMode !== "chat") {
					closeInactiveWorkspacePanels("chat");
					setWorkspaceMode("chat");
				}
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

			if (Object.keys(state.conversationSwitchPendingById || {}).length > 0) {
				closeMobileConversationDrawer();
				return;
			}

			closeMobileConversationDrawer();
			state.conversationSwitchPendingById = {
				...(state.conversationSwitchPendingById || {}),
				[nextConversationId]: true,
			};
			renderConversationDrawer();
			try {
				const result = await switchConversationOnServer(nextConversationId);
				if (!result.switched) {
					showError(result.reason === "running" ? "当前任务未结束，不能切换产线" : "无法切换到这个会话");
					invalidateConversationCatalog();
					await syncConversationCatalog({ silent: true, activateCurrent: false, force: true });
					return;
				}
				markConversationCatalogFresh();
				await activateConversation(result.currentConversationId || result.conversationId, {
					skipCatalogSync: true,
					skipServerSwitch: true,
				});
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "切换会话失败";
				showError(messageText);
			} finally {
				const nextPending = { ...(state.conversationSwitchPendingById || {}) };
				delete nextPending[nextConversationId];
				state.conversationSwitchPendingById = nextPending;
				renderConversationDrawer();
			}
		}

		async function requestDeleteConversation(item, restoreFocusElement) {
			if (!item?.conversationId) {
				return;
			}
			if (state.loading || item.running) {
				showError("当前任务未结束，不能删除会话");
				return;
			}
			const confirmed = await openConfirmDialog({
				title: "删除会话？",
				description:
					"会话：" +
					(item.title || item.conversationId) +
					"\\n\\n删除后这条历史会话会从列表移除，这个操作不能撤销。",
				confirmText: "删除",
				cancelText: "取消",
				tone: "danger",
				restoreFocusElement,
			});
			if (!confirmed) {
				return;
			}

			try {
				const result = await deleteConversationOnServer(item.conversationId);
				if (!result.deleted) {
					showError(result.reason === "running" ? "当前任务未结束，不能删除会话" : "无法删除这个会话");
					return;
				}
				removeConversationCatalogItem(item.conversationId);
				markConversationCatalogFresh();
				if (state.conversationId === item.conversationId) {
					const nextConversationId = result.currentConversationId;
					if (nextConversationId && !state.conversationCatalog.some((entry) => entry.conversationId === nextConversationId)) {
						const optimisticTimestamp = new Date().toISOString();
						upsertConversationCatalogItem(
							{
								conversationId: nextConversationId,
								title: "新会话",
								preview: "",
								messageCount: 0,
								createdAt: optimisticTimestamp,
								updatedAt: optimisticTimestamp,
								running: false,
							},
							{ prepend: true },
						);
					}
					if (nextConversationId) {
						await activateConversation(nextConversationId, {
							skipCatalogSync: true,
							skipServerSwitch: true,
						});
					}
				}
				invalidateConversationCatalog();
				void syncConversationCatalog({ silent: true, activateCurrent: false, force: true });
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "删除会话失败";
				showError(messageText);
			}
		}

		async function startNewConversation() {
			clearError();
			if (state.loading) {
				showError("当前任务未结束，不能开启新产线");
				return false;
			}

			if (isCurrentConversationBlank()) {
				return true;
			}

			if (state.conversationCreatePending) {
				return false;
			}

			state.conversationCreatePending = true;
			newConversationButton.disabled = true;
			mobileNewConversationButton.disabled = true;
			try {
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
				const optimisticTimestamp = new Date().toISOString();
				upsertConversationCatalogItem(
					{
						conversationId: nextConversationId,
						title: "新会话",
						preview: "",
						messageCount: 0,
						createdAt: optimisticTimestamp,
						updatedAt: optimisticTimestamp,
						running: false,
					},
					{ isNew: true },
				);
				markConversationCatalogFresh();
				clearSelectedFiles();
				clearSelectedAssetRefs();
				setStageMode("landing");
				const activated = await activateConversation(nextConversationId, {
					skipCatalogSync: true,
					skipServerSwitch: true,
				});
				return activated;
			} finally {
				state.conversationCreatePending = false;
				newConversationButton.disabled = state.loading;
				mobileNewConversationButton.disabled = state.loading;
			}
		}
	`;
}
