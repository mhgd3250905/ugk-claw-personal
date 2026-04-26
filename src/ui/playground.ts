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
import { getPlaygroundConversationStateControllerScript } from "./playground-conversation-state-controller.js";
import { getPlaygroundConversationSyncControllerScript } from "./playground-conversation-sync-controller.js";
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
import { getPlaygroundProcessControllerScript } from "./playground-process-controller.js";
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

		${getPlaygroundStatusControllerScript()}


		${getPlaygroundLayoutControllerScript()}

		${getPlaygroundMobileShellControllerScript()}
		${getPlaygroundThemeControllerScript()}

		${getPlaygroundConversationControllerScript()}

		${getPlaygroundTranscriptRendererScript()}

		${getPlaygroundNotificationControllerScript()}

		${getPlaygroundConversationApiControllerScript()}

		${getPlaygroundConversationSyncControllerScript()}

		${getConnActivityApiScript()}


		${getPlaygroundConversationStateControllerScript()}

		${getPlaygroundStreamControllerScript()}

		${getPlaygroundAssetControllerScript()}

		${getPlaygroundActiveRunNormalizerScript()}
		${getPlaygroundConversationHistoryStoreScript()}

		${getConnActivityRendererScript()}
		${getPlaygroundTaskInboxControllerScript()}

		${getPlaygroundHistoryPaginationControllerScript()}

		${getPlaygroundProcessControllerScript()}

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
