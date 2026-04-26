import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getConnActivityDialogs } from "./playground-conn-activity.js";
import { getPlaygroundAssetDialogs } from "./playground-assets.js";
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
import { getPlaygroundPanelFocusControllerScript } from "./playground-panel-focus-controller.js";
import { renderPlaygroundHtml } from "./playground-page-shell.js";
import {
	getPlaygroundTaskInboxControllerScript,
	getPlaygroundTaskInboxElementRefsScript,
	getPlaygroundTaskInboxEventHandlersScript,
	getPlaygroundTaskInboxView,
} from "./playground-task-inbox.js";
import { getPlaygroundThemeControllerScript } from "./playground-theme-controller.js";
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

import { getPlaygroundStyles } from "./playground-styles.js";

export { renderPlaygroundMarkdown } from "./playground-markdown.js";

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

		${getPlaygroundPanelFocusControllerScript()}

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
	return renderPlaygroundHtml({
		styles: getPlaygroundStyles(),
		markedBrowserScript: getMarkedBrowserScript(),
		playgroundScript: getPlaygroundScript(),
		taskInboxView: getPlaygroundTaskInboxView(),
		connActivityDialogs: getConnActivityDialogs(),
		assetDialogs: getPlaygroundAssetDialogs(),
	});
}
