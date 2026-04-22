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
	`;
}
