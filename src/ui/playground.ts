import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlaygroundActiveRunNormalizerScript } from "./playground-active-run-normalizer.js";
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
import { getPlaygroundConversationApiControllerScript } from "./playground-conversation-api-controller.js";
import { getPlaygroundConfirmDialogControllerScript } from "./playground-confirm-dialog-controller.js";
import { getPlaygroundConversationControllerScript } from "./playground-conversations-controller.js";
import { getPlaygroundHistoryPaginationControllerScript } from "./playground-history-pagination-controller.js";
import { getPlaygroundLayoutConstantsScript, getPlaygroundLayoutControllerScript } from "./playground-layout-controller.js";
import {
	getPlaygroundMobileShellControllerScript,
	getPlaygroundMobileShellElementRefsScript,
	getPlaygroundMobileShellEventHandlersScript,
} from "./playground-mobile-shell-controller.js";
import { getPlaygroundNotificationControllerScript } from "./playground-notification-controller.js";
import { getPlaygroundPanelFocusControllerScript } from "./playground-panel-focus-controller.js";
import { renderPlaygroundHtml } from "./playground-page-shell.js";
import { getPlaygroundStatusControllerScript } from "./playground-status-controller.js";
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
import { getPlaygroundConversationHistoryStoreScript } from "./playground-conversation-history-store.js";
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
		${getPlaygroundConfirmDialogControllerScript()}

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

		${getPlaygroundStatusControllerScript()}


		${getPlaygroundLayoutControllerScript()}

		${getPlaygroundMobileShellControllerScript()}
		${getPlaygroundThemeControllerScript()}

		${getPlaygroundConversationControllerScript()}

		${getPlaygroundTranscriptRendererScript()}

		${getPlaygroundNotificationControllerScript()}

		${getPlaygroundConversationApiControllerScript()}

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

		${getPlaygroundActiveRunNormalizerScript()}
		${getPlaygroundConversationHistoryStoreScript()}

		${getConnActivityRendererScript()}
		${getPlaygroundTaskInboxControllerScript()}

		${getPlaygroundHistoryPaginationControllerScript()}

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
