import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlaygroundActiveRunNormalizerScript } from "./playground-active-run-normalizer.js";
import { getConnActivityDialogs } from "./playground-conn-activity.js";
import {
	getPlaygroundAgentManagerDialogs,
	getPlaygroundAgentManagerScript,
	getPlaygroundAgentManagerStyles,
} from "./playground-agent-manager.js";
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
import { getPlaygroundWorkspaceControllerScript } from "./playground-workspace-controller.js";
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

export interface PlaygroundRenderBundle {
	styles: string;
	markedBrowserScript: string;
	playgroundScript: string;
	taskInboxView: string;
	connActivityDialogs: string;
	agentManagerDialogs: string;
	assetDialogs: string;
}

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
		const AGENT_SELECTION_STORAGE_KEY = "ugk-pi:active-agent-id";
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

		function getCurrentAgentId() {
			return String(state.agentId || "main").trim() || "main";
		}

		function getAgentApiPath(path) {
			const normalizedPath = String(path || "");
			const suffix = normalizedPath.startsWith("/") ? normalizedPath : "/" + normalizedPath;
			return "/v1/agents/" + encodeURIComponent(getCurrentAgentId()) + suffix;
		}

		function normalizeStoredAgentId(agentId) {
			const normalized = String(agentId || "").trim();
			return /^[a-zA-Z0-9_-]+$/.test(normalized) ? normalized : "";
		}

		function readStoredAgentId() {
			try {
				return normalizeStoredAgentId(localStorage.getItem(AGENT_SELECTION_STORAGE_KEY)) || "main";
			} catch {
				return "main";
			}
		}

		function writeStoredAgentId(agentId) {
			const normalized = normalizeStoredAgentId(agentId) || "main";
			try {
				localStorage.setItem(AGENT_SELECTION_STORAGE_KEY, normalized);
			} catch {}
			return normalized;
		}

		const state = {
			loading: false,
			theme: "dark",
			stageMode: "landing",
			workspaceMode: "chat",
			agentId: readStoredAgentId(),
			agentCatalog: [],
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
			agentManagerOpen: false,
			agentManagerLoading: false,
			agentManagerActionAgentId: "",
			agentManagerNotice: "",
			agentManagerSelectedAgentId: "",
			agentManagerSkillsByAgentId: {},
			agentManagerSkillsLoadingByAgentId: {},
			agentManagerRulesByAgentId: {},
			agentManagerRulesLoadingByAgentId: {},
			agentManagerMode: "detail",
			agentManagerAvailableInitialSkills: [],
			agentManagerAvailableInitialSkillsLoading: false,
			agentCreateName: "",
			agentCreateDescription: "",
			agentCreateSelectedSkillNames: [],
			agentEditorOpen: false,
			agentEditorMode: "create",
			agentEditorAgentId: "",
			agentEditorSaving: false,
			agentEditorError: "",
			agentRulesEditorOpen: false,
			agentRulesEditorAgentId: "",
			agentRulesEditorContent: "",
			agentRulesEditorSaving: false,
			agentRulesEditorError: "",
			agentRulesEditorRestoreFocusElement: null,
			connEditorOpen: false,
			connEditorMode: "create",
			connEditorConnId: "",
			connEditorSaving: false,
			connEditorError: "",
			assetModalRestoreFocusElement: null,
			taskInboxRestoreFocusElement: null,
			chatRunLogRestoreFocusElement: null,
			chatRunLogPagination: null,
			connManagerRestoreFocusElement: null,
			agentManagerRestoreFocusElement: null,
			agentEditorRestoreFocusElement: null,
			connEditorRestoreFocusElement: null,
			connRunDetailsRestoreFocusElement: null,
			connRunDetailsPagination: null,
			modelConfigOpen: false,
			modelConfigRestoreFocusElement: null,
			modelConfig: null,
			modelConfigLoading: false,
			modelConfigSaving: false,
			modelConfigTesting: false,
			modelConfigSelectedProvider: "",
			modelConfigSelectedModel: "",
			feishuSettingsOpen: false,
			feishuSettingsRestoreFocusElement: null,
			feishuSettingsLoading: false,
			feishuSettingsSaving: false,
			feishuSettingsTesting: false,
			feishuSettings: null,
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
		const newConversationButton = document.getElementById("new-conversation-button");
		const agentSelector = document.getElementById("agent-selector");
		const agentSelectorStatus = document.getElementById("agent-selector-status");
		const openModelConfigButton = document.getElementById("open-model-config-button");
		const modelConfigDialog = document.getElementById("model-config-dialog");
		const modelConfigClose = document.getElementById("model-config-close");
		const modelConfigCurrent = document.getElementById("model-config-current");
		const modelConfigProvider = document.getElementById("model-config-provider");
		const modelConfigModel = document.getElementById("model-config-model");
		const modelConfigAuth = document.getElementById("model-config-auth");
		const modelConfigStatus = document.getElementById("model-config-status");
		const modelConfigTest = document.getElementById("model-config-test");
		const modelConfigSave = document.getElementById("model-config-save");
		const openFeishuSettingsButton = document.getElementById("open-feishu-settings-button");
		const feishuSettingsDialog = document.getElementById("feishu-settings-dialog");
		const feishuSettingsClose = document.getElementById("feishu-settings-close");
		const feishuSettingsCurrent = document.getElementById("feishu-settings-current");
		const feishuSettingsEnabled = document.getElementById("feishu-settings-enabled");
		const feishuSettingsAppId = document.getElementById("feishu-settings-app-id");
		const feishuSettingsAppSecret = document.getElementById("feishu-settings-app-secret");
		const feishuSettingsApiBase = document.getElementById("feishu-settings-api-base");
		const feishuSettingsAllowedChatIds = document.getElementById("feishu-settings-allowed-chat-ids");
		const feishuSettingsActivityOpenIds = document.getElementById("feishu-settings-activity-open-ids");
		const feishuSettingsActivityChatIds = document.getElementById("feishu-settings-activity-chat-ids");
		const feishuSettingsStatus = document.getElementById("feishu-settings-status");
		const feishuSettingsTest = document.getElementById("feishu-settings-test");
		const feishuSettingsSave = document.getElementById("feishu-settings-save");
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

		function renderAgentSelector() {
			if (!agentSelector) {
				return;
			}
			const knownAgents = Array.isArray(state.agentCatalog) && state.agentCatalog.length > 0
				? state.agentCatalog
				: [
					{ agentId: "main", name: "主 Agent" },
					{ agentId: "search", name: "搜索 Agent" },
				];
			const currentAgentId = getCurrentAgentId();
			agentSelector.innerHTML = "";
			for (const agent of knownAgents) {
				const agentId = String(agent?.agentId || "").trim();
				if (!agentId) {
					continue;
				}
				const option = document.createElement("option");
				option.value = agentId;
				option.textContent = String(agent?.name || agentId);
				agentSelector.appendChild(option);
			}
			agentSelector.value = currentAgentId;
			if (agentSelectorStatus) {
				const current = knownAgents.find((agent) => agent?.agentId === currentAgentId);
				agentSelectorStatus.textContent = String(current?.name || currentAgentId);
			}
		}

		async function loadAgentCatalog() {
			try {
				const response = await fetch("/v1/agents", {
					method: "GET",
					headers: { accept: "application/json" },
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(payload?.message || "无法读取 agent 列表");
				}
				state.agentCatalog = Array.isArray(payload?.agents) ? payload.agents : [];
			} catch {
				state.agentCatalog = [
					{ agentId: "main", name: "主 Agent" },
					{ agentId: "search", name: "搜索 Agent" },
				];
			}
			const knownAgentIds = new Set(state.agentCatalog.map((agent) => String(agent?.agentId || "").trim()).filter(Boolean));
			if (!knownAgentIds.has(getCurrentAgentId())) {
				state.agentId = writeStoredAgentId("main");
			}
			renderAgentSelector();
		}

		async function switchAgent(agentId) {
			const nextAgentId = String(agentId || "").trim();
			if (!nextAgentId || nextAgentId === getCurrentAgentId()) {
				renderAgentSelector();
				return;
			}
			if (state.loading) {
				showError("当前 agent 仍在运行，先别切视窗。");
				renderAgentSelector();
				return;
			}

			stopActiveRunEventStream();
			abortConversationStateSync();
			state.agentId = writeStoredAgentId(nextAgentId);
			state.conversationId = "";
			state.conversationCatalog = [];
			state.conversationCatalogSyncedAt = 0;
			state.conversationCatalogSyncPromise = null;
			state.conversationHistory = [];
			state.conversationState = null;
			state.renderedConversationId = "";
			state.renderedConversationStateSignature = "";
			state.historyHasMore = false;
			state.historyNextBefore = "";
			conversationInput.value = "";
			clearRenderedTranscript();
			resetStreamingState();
			setTranscriptState("idle");
			renderConversationDrawer();
			renderContextUsageBar();
			renderAgentSelector();
			clearError();
			await ensureCurrentConversation({ silent: true });
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
		${getPlaygroundWorkspaceControllerScript()}

		${getPlaygroundAgentManagerScript()}

		${getConnActivityEditorScript()}

		${getPlaygroundStatusControllerScript()}

		function getSelectedModelConfig() {
			return {
				provider: String(modelConfigProvider.value || "").trim(),
				model: String(modelConfigModel.value || "").trim(),
			};
		}

		function findModelConfigProvider(providerId) {
			return state.modelConfig?.providers?.find((provider) => provider.id === providerId) || null;
		}

		function formatModelTokenCount(value) {
			const count = Number(value);
			if (!Number.isFinite(count) || count <= 0) {
				return "";
			}
			if (count >= 1000000) {
				const millions = count / 1000000;
				return (Number.isInteger(millions) ? String(millions) : millions.toFixed(1)) + "M";
			}
			if (count >= 1000) {
				const thousands = count / 1000;
				return (Number.isInteger(thousands) ? String(thousands) : String(Math.round(thousands))) + "K";
			}
			return String(Math.round(count));
		}

		function getModelConfigOptionLabel(model) {
			const baseLabel = model.name ? model.name + " / " + model.id : model.id;
			const contextWindow = formatModelTokenCount(model.contextWindow);
			const maxTokens = formatModelTokenCount(model.maxTokens);
			const meta = [];
			if (contextWindow) {
				meta.push("ctx " + contextWindow);
			}
			if (maxTokens) {
				meta.push("out " + maxTokens);
			}
			return meta.length > 0 ? baseLabel + " · " + meta.join(" · ") : baseLabel;
		}

		function setModelConfigStatus(message, tone = "neutral") {
			modelConfigStatus.textContent = message || "";
			modelConfigStatus.dataset.tone = tone;
		}

		function getModelConfigProviderLabel(provider) {
			const baseLabel = provider.name ? provider.name + " / " + provider.id : provider.id;
			const meta = [];
			if (provider.vendor) {
				meta.push(provider.vendor);
			}
			if (provider.region) {
				meta.push(provider.region);
			}
			return meta.length > 0 ? baseLabel + " · " + meta.join(" · ") : baseLabel;
		}

		function setModelConfigBusy() {
			const busy = state.modelConfigLoading || state.modelConfigSaving || state.modelConfigTesting;
			modelConfigProvider.disabled = busy;
			modelConfigModel.disabled = busy || !modelConfigProvider.value;
			modelConfigTest.disabled = busy || !modelConfigProvider.value || !modelConfigModel.value;
			modelConfigSave.disabled = busy || !modelConfigProvider.value || !modelConfigModel.value;
			modelConfigTest.textContent = state.modelConfigTesting ? "测试中" : "测试连接";
			modelConfigSave.textContent = state.modelConfigSaving ? "验证中" : "验证并保存";
		}

		function renderModelConfigModelOptions() {
			const provider = findModelConfigProvider(modelConfigProvider.value);
			const models = provider?.models || [];
			modelConfigModel.innerHTML = "";
			for (const model of models) {
				const option = document.createElement("option");
				option.value = model.id;
				option.textContent = getModelConfigOptionLabel(model);
				modelConfigModel.appendChild(option);
			}
			if (models.some((model) => model.id === state.modelConfigSelectedModel)) {
				modelConfigModel.value = state.modelConfigSelectedModel;
			}
			if (!modelConfigModel.value && models[0]) {
				modelConfigModel.value = models[0].id;
			}
			renderModelConfigAuth();
			setModelConfigBusy();
		}

		function renderModelConfigAuth() {
			const provider = findModelConfigProvider(modelConfigProvider.value);
			if (!provider) {
				modelConfigAuth.textContent = "未选择 API 源";
				modelConfigAuth.dataset.state = "missing";
				return;
			}
			const auth = provider.auth || {};
			const envText = auth.envVar ? " · " + auth.envVar : "";
			modelConfigAuth.textContent = (auth.configured ? "密钥已配置" : "密钥未配置") + envText;
			modelConfigAuth.dataset.state = auth.configured ? "ready" : "missing";
		}

		function renderModelConfigDialog() {
			const config = state.modelConfig;
			modelConfigProvider.innerHTML = "";
			const providers = config?.providers || [];
			for (const provider of providers) {
				const option = document.createElement("option");
				option.value = provider.id;
				option.textContent = getModelConfigProviderLabel(provider);
				modelConfigProvider.appendChild(option);
			}
			const current = config?.current || { provider: "", model: "" };
			state.modelConfigSelectedProvider = state.modelConfigSelectedProvider || current.provider;
			state.modelConfigSelectedModel = state.modelConfigSelectedModel || current.model;
			if (providers.some((provider) => provider.id === state.modelConfigSelectedProvider)) {
				modelConfigProvider.value = state.modelConfigSelectedProvider;
			}
			modelConfigCurrent.textContent = current.provider && current.model ? "当前：" + current.provider + " / " + current.model : "当前配置未知";
			renderModelConfigModelOptions();
		}

		async function loadModelConfig() {
			state.modelConfigLoading = true;
			setModelConfigBusy();
			setModelConfigStatus("正在读取模型源", "neutral");
			try {
				const response = await fetch("/v1/model-config");
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(payload?.error?.message || "读取模型源失败");
				}
				state.modelConfig = payload;
				state.modelConfigSelectedProvider = payload?.current?.provider || "";
				state.modelConfigSelectedModel = payload?.current?.model || "";
				renderModelConfigDialog();
				setModelConfigStatus("选择模型后可以先测试连接，保存时仍会再次验证。", "neutral");
			} catch (error) {
				setModelConfigStatus(error instanceof Error ? error.message : "读取模型源失败", "error");
			} finally {
				state.modelConfigLoading = false;
				setModelConfigBusy();
			}
		}

		async function openModelConfigDialog(returnFocusElement) {
			state.modelConfigOpen = true;
			state.modelConfigRestoreFocusElement = rememberPanelReturnFocus(returnFocusElement);
			modelConfigDialog.hidden = false;
			modelConfigDialog.inert = false;
			modelConfigDialog.classList.add("open");
			modelConfigDialog.setAttribute("aria-hidden", "false");
			modelConfigProvider.focus();
			await loadModelConfig();
		}

		function closeModelConfigDialog() {
			if (!state.modelConfigOpen) {
				return;
			}
			state.modelConfigOpen = false;
			restoreFocusAfterPanelClose(modelConfigDialog, state.modelConfigRestoreFocusElement);
			modelConfigDialog.classList.remove("open");
			modelConfigDialog.setAttribute("aria-hidden", "true");
			modelConfigDialog.inert = true;
			modelConfigDialog.hidden = true;
			state.modelConfigRestoreFocusElement = null;
		}

		async function testModelConfigSelection() {
			const selection = getSelectedModelConfig();
			state.modelConfigTesting = true;
			setModelConfigBusy();
			setModelConfigStatus("正在测试 " + selection.provider + " / " + selection.model, "neutral");
			try {
				const response = await fetch("/v1/model-config/validate", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(selection),
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok || payload?.ok === false) {
					throw new Error(payload?.error?.message || payload?.message || "模型源验证失败");
				}
				setModelConfigStatus("连接验证通过。", "success");
			} catch (error) {
				setModelConfigStatus(error instanceof Error ? error.message : "模型源验证失败", "error");
			} finally {
				state.modelConfigTesting = false;
				setModelConfigBusy();
			}
		}

		async function saveModelConfigSelection() {
			const selection = getSelectedModelConfig();
			state.modelConfigSaving = true;
			setModelConfigBusy();
			setModelConfigStatus("正在验证并保存", "neutral");
			try {
				const response = await fetch("/v1/model-config/default", {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(selection),
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok || payload?.ok === false) {
					throw new Error(payload?.error?.message || payload?.message || "保存模型源失败");
				}
				if (state.modelConfig) {
					state.modelConfig.current = payload.current;
				}
				state.modelConfigSelectedProvider = payload.current.provider;
				state.modelConfigSelectedModel = payload.current.model;
				renderModelConfigDialog();
				setModelConfigStatus("已保存，新会话生效。", "success");
				void syncContextUsage({ silent: true });
			} catch (error) {
				setModelConfigStatus(error instanceof Error ? error.message : "保存模型源失败", "error");
			} finally {
				state.modelConfigSaving = false;
				setModelConfigBusy();
			}
		}

		function splitFeishuIds(value) {
			return String(value || "")
				.split(",")
				.flatMap((item) => item.split(String.fromCharCode(10)))
				.map((item) => item.trim())
				.filter(Boolean);
		}

		function setFeishuSettingsStatus(message, tone = "neutral") {
			feishuSettingsStatus.textContent = message || "";
			feishuSettingsStatus.dataset.tone = tone;
		}

		function setFeishuSettingsBusy() {
			const busy = state.feishuSettingsLoading || state.feishuSettingsSaving || state.feishuSettingsTesting;
			for (const element of [
				feishuSettingsEnabled,
				feishuSettingsAppId,
				feishuSettingsAppSecret,
				feishuSettingsApiBase,
				feishuSettingsAllowedChatIds,
				feishuSettingsActivityOpenIds,
				feishuSettingsActivityChatIds,
				feishuSettingsTest,
				feishuSettingsSave,
			]) {
				element.disabled = busy;
			}
			feishuSettingsTest.textContent = state.feishuSettingsTesting ? "发送中" : "发送测试消息";
			feishuSettingsSave.textContent = state.feishuSettingsSaving ? "保存中" : "保存并重连";
		}

		function renderFeishuSettingsDialog() {
			const settings = state.feishuSettings || {};
			feishuSettingsEnabled.value = settings.enabled ? "true" : "false";
			feishuSettingsAppId.value = settings.appId || "";
			feishuSettingsAppSecret.value = "";
			feishuSettingsApiBase.value = settings.apiBase || "https://open.feishu.cn/open-apis";
			feishuSettingsAllowedChatIds.value = (settings.allowedChatIds || []).join(String.fromCharCode(10));
			const targets = settings.activityTargets || [];
			feishuSettingsActivityOpenIds.value = targets
				.filter((target) => target.type === "feishu_user")
				.map((target) => target.openId)
				.join(String.fromCharCode(10));
			feishuSettingsActivityChatIds.value = targets
				.filter((target) => target.type === "feishu_chat")
				.map((target) => target.chatId)
				.join(String.fromCharCode(10));
			feishuSettingsCurrent.textContent = settings.enabled
				? (settings.hasAppSecret ? "已配置 App，保存后 worker 自动重连" : "已启用，但缺少 App Secret")
				: "当前停用";
		}

		async function loadFeishuSettings() {
			state.feishuSettingsLoading = true;
			setFeishuSettingsBusy();
			setFeishuSettingsStatus("正在读取飞书配置", "neutral");
			try {
				const response = await fetch("/v1/integrations/feishu/settings");
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(payload?.error?.message || "读取飞书配置失败");
				}
				state.feishuSettings = payload;
				renderFeishuSettingsDialog();
				setFeishuSettingsStatus("先在飞书机器人私聊里发送 /whoami，再把 open_id 或 chat_id 填到这里。", "neutral");
			} catch (error) {
				setFeishuSettingsStatus(error instanceof Error ? error.message : "读取飞书配置失败", "error");
			} finally {
				state.feishuSettingsLoading = false;
				setFeishuSettingsBusy();
			}
		}

		function collectFeishuSettingsPayload() {
			const openIds = splitFeishuIds(feishuSettingsActivityOpenIds.value);
			const chatIds = splitFeishuIds(feishuSettingsActivityChatIds.value);
			const activityTargets = [
				...openIds.map((openId) => ({ type: "feishu_user", openId })),
				...chatIds.map((chatId) => ({ type: "feishu_chat", chatId })),
			];
			const appSecret = String(feishuSettingsAppSecret.value || "").trim();
			return {
				enabled: feishuSettingsEnabled.value === "true",
				appId: String(feishuSettingsAppId.value || "").trim(),
				...(appSecret ? { appSecret } : {}),
				apiBase: String(feishuSettingsApiBase.value || "").trim(),
				allowedChatIds: splitFeishuIds(feishuSettingsAllowedChatIds.value),
				activityTargets,
			};
		}

		async function openFeishuSettingsDialog(returnFocusElement) {
			state.feishuSettingsOpen = true;
			state.feishuSettingsRestoreFocusElement = rememberPanelReturnFocus(returnFocusElement);
			feishuSettingsDialog.hidden = false;
			feishuSettingsDialog.inert = false;
			feishuSettingsDialog.classList.add("open");
			feishuSettingsDialog.setAttribute("aria-hidden", "false");
			feishuSettingsAppId.focus();
			await loadFeishuSettings();
		}

		function closeFeishuSettingsDialog() {
			if (!state.feishuSettingsOpen) {
				return;
			}
			state.feishuSettingsOpen = false;
			restoreFocusAfterPanelClose(feishuSettingsDialog, state.feishuSettingsRestoreFocusElement);
			feishuSettingsDialog.classList.remove("open");
			feishuSettingsDialog.setAttribute("aria-hidden", "true");
			feishuSettingsDialog.inert = true;
			feishuSettingsDialog.hidden = true;
			state.feishuSettingsRestoreFocusElement = null;
		}

		async function saveFeishuSettings() {
			state.feishuSettingsSaving = true;
			setFeishuSettingsBusy();
			setFeishuSettingsStatus("正在保存飞书配置", "neutral");
			try {
				const response = await fetch("/v1/integrations/feishu/settings", {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(collectFeishuSettingsPayload()),
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(payload?.error?.message || "保存飞书配置失败");
				}
				state.feishuSettings = payload;
				renderFeishuSettingsDialog();
				setFeishuSettingsStatus("已保存。飞书 worker 会自动重连，不需要重启容器。", "success");
			} catch (error) {
				setFeishuSettingsStatus(error instanceof Error ? error.message : "保存飞书配置失败", "error");
			} finally {
				state.feishuSettingsSaving = false;
				setFeishuSettingsBusy();
			}
		}

		async function sendFeishuTestMessage() {
			state.feishuSettingsTesting = true;
			setFeishuSettingsBusy();
			setFeishuSettingsStatus("正在发送测试消息", "neutral");
			try {
				const response = await fetch("/v1/integrations/feishu/test-message", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ text: "UGK 飞书配置测试 " + new Date().toISOString() }),
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok || payload.delivered === false) {
					throw new Error(payload?.error?.message || "测试消息发送失败");
				}
				setFeishuSettingsStatus("测试消息已发送。", "success");
			} catch (error) {
				setFeishuSettingsStatus(error instanceof Error ? error.message : "测试消息发送失败", "error");
			} finally {
				state.feishuSettingsTesting = false;
				setFeishuSettingsBusy();
			}
		}

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
			agentSelector?.addEventListener("change", () => {
				void switchAgent(agentSelector.value);
			});

			openModelConfigButton.addEventListener("click", () => {
				void openModelConfigDialog(openModelConfigButton);
			});
			openFeishuSettingsButton.addEventListener("click", () => {
				void openFeishuSettingsDialog(openFeishuSettingsButton);
			});
			modelConfigClose.addEventListener("click", closeModelConfigDialog);
			modelConfigDialog.addEventListener("click", (event) => {
				if (event.target === modelConfigDialog) {
					closeModelConfigDialog();
				}
			});
			modelConfigProvider.addEventListener("change", () => {
				state.modelConfigSelectedProvider = modelConfigProvider.value;
				state.modelConfigSelectedModel = "";
				renderModelConfigModelOptions();
				setModelConfigStatus("选择模型后可以先测试连接，保存时仍会再次验证。", "neutral");
			});
			modelConfigModel.addEventListener("change", () => {
				state.modelConfigSelectedModel = modelConfigModel.value;
				setModelConfigBusy();
				setModelConfigStatus("选择模型后可以先测试连接，保存时仍会再次验证。", "neutral");
			});
			modelConfigTest.addEventListener("click", () => {
				void testModelConfigSelection();
			});
			modelConfigSave.addEventListener("click", () => {
				void saveModelConfigSelection();
			});
			feishuSettingsClose.addEventListener("click", closeFeishuSettingsDialog);
			feishuSettingsDialog.addEventListener("click", (event) => {
				if (event.target === feishuSettingsDialog) {
					closeFeishuSettingsDialog();
				}
			});
			feishuSettingsSave.addEventListener("click", () => {
				void saveFeishuSettings();
			});
			feishuSettingsTest.addEventListener("click", () => {
				void sendFeishuTestMessage();
			});

			${getPlaygroundTaskInboxEventHandlersScript()}
			bindAgentManagerEvents();
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
				if (event.key === "Escape" && state.modelConfigOpen) {
					closeModelConfigDialog();
				}
				if (event.key === "Escape" && state.feishuSettingsOpen) {
					closeFeishuSettingsDialog();
				}
				if (event.key === "Escape" && state.agentRulesEditorOpen) {
					closeAgentRulesEditor();
					return;
				}
				if (event.key === "Escape" && state.agentEditorOpen) {
					closeAgentEditor();
					return;
				}
				if (event.key === "Escape" && state.agentManagerOpen) {
					closeAgentManager();
					return;
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
			void loadAgentCatalog();

			resetStreamingState();
			clearError();
			void ensureCurrentConversation({ silent: true });
			bindPlaygroundLayoutController();
			bindPlaygroundTranscriptRenderer();
			bindPlaygroundStreamController();
			bindPlaygroundWorkspaceController();
			bindPlaygroundAssemblerEvents();
		}

		initializePlaygroundAssembler();
	`;
}

export function getPlaygroundRenderBundle(): PlaygroundRenderBundle {
	return {
		styles: getPlaygroundStyles() + getPlaygroundAgentManagerStyles(),
		markedBrowserScript: getMarkedBrowserScript(),
		playgroundScript: getPlaygroundScript(),
		taskInboxView: getPlaygroundTaskInboxView(),
		connActivityDialogs: getConnActivityDialogs(),
		agentManagerDialogs: getPlaygroundAgentManagerDialogs(),
		assetDialogs: getPlaygroundAssetDialogs(),
	};
}

export function renderPlaygroundPage(): string {
	return renderPlaygroundHtml(getPlaygroundRenderBundle());
}
