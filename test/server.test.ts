import test from "node:test";
import assert from "node:assert/strict";
import { NotificationHub } from "../src/agent/notification-hub.js";
import { buildServer } from "../src/server.js";
import type { AgentService } from "../src/agent/agent-service.js";
import { renderPlaygroundMarkdown } from "../src/ui/playground.js";

type StreamEvent = Record<string, unknown>;

function createAgentServiceStub(overrides?: {
	chat?: AgentService["chat"];
	streamChat?: (
		input: { conversationId?: string; message: string; userId?: string; attachments?: unknown[]; assetRefs?: string[] },
		onEvent: (event: StreamEvent) => void,
	) => Promise<void>;
	queueMessage?: AgentService["queueMessage"];
	interruptChat?: AgentService["interruptChat"];
	resetConversation?: AgentService["resetConversation"];
	getRunStatus?: (
		conversationId: string,
	) => Promise<{
			conversationId: string;
			running: boolean;
			contextUsage: {
				provider: string;
				model: string;
				currentTokens: number;
				contextWindow: number;
				reserveTokens: number;
				maxResponseTokens: number;
				availableTokens: number;
				percent: number;
				status: "safe" | "caution" | "warning" | "danger";
				mode: "usage" | "estimate";
			};
		}>;
	subscribeRunEvents?: (
		conversationId: string,
		onEvent: (event: StreamEvent) => void,
	) => {
		conversationId: string;
		running: boolean;
		unsubscribe: () => void;
	};
	getConversationHistory?: (
		conversationId: string,
	) => Promise<{
		conversationId: string;
		messages: Array<{
			id: string;
			kind: "user" | "assistant" | "system" | "error";
			title: string;
			text: string;
			createdAt: string;
		}>;
	}>;
	getConversationState?: (conversationId: string) => Promise<Record<string, unknown>>;
	getConversationCatalog?: () => Promise<{
		currentConversationId: string;
		conversations: Array<{
			conversationId: string;
			title: string;
			preview: string;
			messageCount: number;
			createdAt: string;
			updatedAt: string;
			running: boolean;
		}>;
	}>;
	createConversation?: () => Promise<{
		conversationId: string;
		currentConversationId: string;
		created: boolean;
		reason?: "running";
	}>;
	switchConversation?: (
		conversationId: string,
	) => Promise<{
		conversationId: string;
		currentConversationId: string;
		switched: boolean;
		reason?: "running" | "not_found";
	}>;
	getAvailableSkills?: () => Promise<Array<{ name: string; path?: string }>>;
}): AgentService {
	return {
		chat:
			overrides?.chat ??
			(async (input) => ({
				conversationId: input.conversationId ?? "manual:test-1",
				text: `echo:${input.message}`,
				sessionFile: "E:/sessions/test.jsonl",
			})),
		streamChat:
			overrides?.streamChat ??
			(async (input, onEvent) => {
				onEvent({
					type: "run_started",
					conversationId: input.conversationId ?? "manual:test-1",
				});
				onEvent({
					type: "tool_started",
					toolCallId: "tool-1",
					toolName: "read",
					args: '{"path":"README.md"}',
				});
				onEvent({
					type: "text_delta",
					textDelta: `echo:${input.message}`,
				});
				onEvent({
					type: "done",
					conversationId: input.conversationId ?? "manual:test-1",
					text: `echo:${input.message}`,
					sessionFile: "E:/sessions/test.jsonl",
				});
			}),
		queueMessage:
			overrides?.queueMessage ??
			(async (input) => ({
				conversationId: input.conversationId,
				mode: input.mode,
				queued: true,
			})),
		interruptChat:
			overrides?.interruptChat ??
			(async (input) => ({
				conversationId: input.conversationId,
				interrupted: true,
			})),
		resetConversation:
			overrides?.resetConversation ??
			(async (input) => ({
				conversationId: input.conversationId,
				reset: true,
			})),
		getRunStatus:
			overrides?.getRunStatus ??
			(async (conversationId) => ({
				conversationId,
				running: false,
				contextUsage: {
					provider: "dashscope-coding",
					model: "glm-5",
					currentTokens: 45231,
					contextWindow: 128000,
					reserveTokens: 16384,
					maxResponseTokens: 16384,
					availableTokens: 66385,
					percent: 35,
					status: "safe",
					mode: "estimate",
				},
			})),
		subscribeRunEvents:
			overrides?.subscribeRunEvents ??
			((conversationId) => ({
				conversationId,
				running: false,
				unsubscribe: () => undefined,
			})),
		getConversationHistory:
			overrides?.getConversationHistory ??
			(async (conversationId) => ({
				conversationId,
				messages: [],
			})),
		getConversationState:
			overrides?.getConversationState ??
			(async (conversationId) => ({
				conversationId,
				running: false,
				contextUsage: {
					provider: "dashscope-coding",
					model: "glm-5",
					currentTokens: 45231,
					contextWindow: 128000,
					reserveTokens: 16384,
					maxResponseTokens: 16384,
					availableTokens: 66385,
					percent: 35,
					status: "safe",
					mode: "estimate",
				},
				messages: [],
				activeRun: null,
				updatedAt: "2026-04-20T00:00:00.000Z",
			})),
		getConversationCatalog:
			overrides?.getConversationCatalog ??
			(async () => ({
				currentConversationId: "manual:catalog-1",
				conversations: [
					{
						conversationId: "manual:catalog-1",
						title: "当前产线",
						preview: "从这里继续当前对话",
						messageCount: 0,
						createdAt: "2026-04-20T00:00:00.000Z",
						updatedAt: "2026-04-20T00:00:00.000Z",
						running: false,
					},
				],
			})),
		createConversation:
			overrides?.createConversation ??
			(async () => ({
				conversationId: "manual:new-1",
				currentConversationId: "manual:new-1",
				created: true,
			})),
		switchConversation:
			overrides?.switchConversation ??
			(async (conversationId) => ({
				conversationId,
				currentConversationId: conversationId,
				switched: true,
			})),
		getAvailableSkills:
			overrides?.getAvailableSkills ??
			(async () => [
				{ name: "using-superpowers", path: "E:/AII/ugk-pi/.pi/skills/superpowers/using-superpowers/SKILL.md" },
				{ name: "web-access", path: "E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md" },
			]),
	} as unknown as AgentService;
}

test("GET /healthz returns ok", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/healthz",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), { ok: true });
	await app.close();
});

test("GET /playground returns the test UI html", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.headers["content-type"] ?? "", /^text\/html/);
	assert.equal(response.headers["cache-control"], "no-store, no-cache, must-revalidate");
	assert.equal(response.headers.pragma, "no-cache");
	assert.equal(response.headers.expires, "0");
	assert.match(response.body, /UGK CLAW/);
	assert.match(response.body, /--font-sans: "OpenAI Sans"/);
	assert.match(response.body, /font-family: var\(--font-sans\)/);
	assert.match(response.body, /--font-mono: "Agave"/);
	assert.match(response.body, /\/assets\/fonts\/Agave-Regular\.ttf/);
	assert.match(response.body, /conversation-id/);
	assert.match(response.body, /file-input/);
	assert.match(response.body, /file-list/);
	assert.match(response.body, /selected-asset-list/);
	assert.match(response.body, /open-asset-library-button/);
	assert.match(response.body, /file-picker-action/);
	assert.match(response.body, /asset-modal-list/);
	assert.match(response.body, /close-asset-modal-button/);
	assert.match(response.body, /drop-zone/);
	assert.match(response.body, /composer-drop-target/);
	assert.match(response.body, /const chatStage = document.getElementById\("chat-stage"\)/);
	assert.match(response.body, /bindDropTarget\(chatStage\)/);
	assert.match(response.body, /bindDropTarget/);
	assert.match(response.body, /preventWindowFileDrop/);
	assert.match(response.body, /drag-overlay/);
	assert.match(response.body, /showGlobalDropHint/);
	assert.match(response.body, /document\.addEventListener\("dragenter"/);
	assert.match(response.body, /window\.addEventListener\("dragenter"/);
	assert.match(response.body, /function hasDragPayload/);
	assert.match(response.body, /function hasDroppedFiles/);
	assert.match(response.body, /function setCopyDropEffect/);
	assert.match(response.body, /function pushDragDebug/);
	assert.match(response.body, /function openAssetLibrary/);
	assert.match(response.body, /function closeAssetLibrary/);
	assert.match(response.body, /function selectAssetForReuse/);
	assert.match(response.body, /function renderSelectedAssets/);
	assert.match(response.body, /const pageRoot = document\.documentElement/);
	assert.match(response.body, /const pageBody = document\.body/);
	assert.match(response.body, /bindDropTarget\(pageRoot\)/);
	assert.match(response.body, /bindDropTarget\(pageBody\)/);
	assert.match(response.body, /dataTransfer\.items/);
	assert.match(response.body, /dataTransfer\.files/);
	assert.match(response.body, /dataTransfer\.types/);
	assert.match(response.body, /handleDroppedFiles/);
	assert.doesNotMatch(response.body, /applyFileIntentMessage/);
	assert.doesNotMatch(response.body, /文件已载入/);
	assert.doesNotMatch(response.body, /待发送附件/);
	assert.match(response.body, /dragover/);
	assert.match(response.body, /drop/);
	assert.match(response.body, /send-button/);
	assert.match(response.body, /interrupt-button/);
	assert.match(response.body, /error-banner/);
	assert.match(response.body, /error-banner-message/);
	assert.match(response.body, /error-banner-close/);
	assert.match(response.body, /notification-live-region/);
	assert.match(response.body, /notification-toast-stack/);
	assert.match(response.body, /function connectNotificationStream\(/);
	assert.match(response.body, /new EventSource\("\/v1\/notifications\/stream"\)/);
	assert.match(response.body, /function showNotificationToast\(/);
	assert.match(response.body, /function handleNotificationBroadcastEvent\(/);
	assert.doesNotMatch(response.body, /queue-mode/);
	assert.doesNotMatch(response.body, /interrupt \/ steer/);
	assert.doesNotMatch(response.body, /wait \/ follow-up/);
	assert.doesNotMatch(response.body, /Watch The Agent Run/);
	assert.doesNotMatch(response.body, />message</);
	assert.doesNotMatch(response.body, />send</);
	assert.doesNotMatch(response.body, />interrupt</);
	assert.match(response.body, /view-skills-button/);
	assert.match(response.body, /chat-stage/);
	assert.match(response.body, /process-note/);
	assert.match(response.body, /appendProcessEvent/);
	assert.match(response.body, /updateStreamingProcess/);
	assert.match(response.body, /transcript\.appendChild\(note\)/);
	assert.match(response.body, /\/v1\/debug\/skills/);
	assert.match(response.body, /\/v1\/chat\/stream/);
	assert.match(response.body, /\/v1\/chat\/queue/);
	assert.match(response.body, /\/v1\/chat\/interrupt/);
	assert.match(response.body, /attachments/);
	assert.match(response.body, /file-download/);
	assert.match(response.body, /selected-assets/);
	assert.match(response.body, /asset-modal-shell/);
	assert.match(response.body, /context-usage-shell/);
	assert.match(response.body, /context-usage-progress/);
	assert.match(response.body, /context-usage-summary/);
	assert.match(response.body, /context-usage-meta/);
	assert.match(response.body, /context-usage-toggle/);
	assert.match(response.body, /context-usage-ring/);
	assert.match(response.body, /context-usage-dialog/);
	assert.match(response.body, /context-usage-dialog-body/);
	assert.match(response.body, /selected-assets[\s\S]*context-usage-row[\s\S]*composer-drop-target/);
	assert.match(response.body, /\.context-usage-row\s*\{\s*display:\s*flex;/);
	assert.match(response.body, /\.context-usage-row\s*\{[\s\S]*justify-content:\s*flex-end;/);
	assert.match(response.body, /function renderContextUsageBar\(/);
	assert.match(response.body, /function syncContextUsage\(/);
	assert.match(response.body, /function estimateDraftContextTokens\(/);
	assert.match(response.body, /function buildProjectedContextUsage\(/);
	assert.match(response.body, /function openContextUsageDialog\(/);
	assert.match(response.body, /function closeContextUsageDialog\(/);
	assert.match(response.body, /function toggleContextUsageDetails\(/);
	assert.match(response.body, /__ugkPlaygroundMarkdownParser/);
	assert.match(response.body, /globalThis\.marked/);
	assert.doesNotMatch(response.body, /CODEBLOCK/);
	assert.match(
		response.body,
		/\.message-content \.markdown-table-scroll\s*\{\s*display:\s*block;\s*width:\s*fit-content;\s*max-width:\s*100%;\s*overflow-x:\s*auto;/,
	);
	assert.match(response.body, /\.message-content table\s*\{\s*width:\s*max-content;\s*border-collapse:\s*collapse;/);
	assert.match(response.body, /wrapper\.className = "markdown-table-scroll";/);
	assert.match(response.body, /matchMedia\("\(max-width: 640px\)"\)/);
	assert.match(response.body, /\/v1\/chat\/status\?conversationId=/);
	assert.match(response.body, /mode:\s*"steer"/);
	assert.match(response.body, /height: calc\(100vh - 40px\)/);
	assert.match(response.body, /\.chat-stage\s*\{[\s\S]*display: flex;/);
	assert.match(response.body, /\.chat-stage\s*\{[\s\S]*flex-direction: column;/);
	assert.match(response.body, /\.transcript\s*\{[\s\S]*flex: 1 1 auto;/);
	assert.match(response.body, /\.transcript\s*\{[\s\S]*display: grid;/);
	assert.match(response.body, /\.transcript-pane\s*\{[\s\S]*align-items: stretch;/);
	assert.match(response.body, /--conversation-width: 640px;/);
	assert.match(response.body, /\.transcript-pane\s*\{[\s\S]*width: min\(var\(--conversation-width\), 100%\);/);
	assert.match(response.body, /\.transcript\s*\{[\s\S]*justify-items: stretch;/);
	assert.match(response.body, /\.transcript\s*\{[\s\S]*width: 100%;/);
	assert.match(response.body, /\.message\s*\{[\s\S]*justify-items: stretch;/);
	assert.match(response.body, /\.message\s*\{[\s\S]*width: 100%;/);
	assert.match(response.body, /\.message\s*\{[\s\S]*padding: 14px 0 0;/);
	assert.match(response.body, /\.message-meta,\s*\.message-body\s*\{[\s\S]*width: 100%;/);
	assert.match(response.body, /\.message-body\s*\{[\s\S]*border-radius: 4px;/);
	assert.match(response.body, /\.message-body\s*\{[\s\S]*background: rgba\(34, 38, 46, 0\.72\);/);
	assert.match(response.body, /\.message-body\s*\{[\s\S]*border: 0;/);
	assert.match(response.body, /\.message-body\s*\{[\s\S]*box-shadow: none;/);
	assert.match(response.body, /\.message-body\s*\{[\s\S]*backdrop-filter: none;/);
	assert.match(response.body, /\.chat-stage\s*\{[\s\S]*position:\s*relative;/);
	assert.match(response.body, /\.error-banner\s*\{[\s\S]*position:\s*absolute;/);
	assert.match(response.body, /\.error-banner\s*\{[\s\S]*display:\s*none;/);
	assert.match(response.body, /\.error-banner\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/);
	assert.match(response.body, /\.error-banner\s*\{[\s\S]*top:\s*0;/);
	assert.match(response.body, /\.error-banner\s*\{[\s\S]*left:\s*50%;/);
	assert.match(response.body, /\.error-banner\s*\{[\s\S]*transform:\s*translateX\(-50%\);/);
	assert.match(response.body, /\.error-banner\s*\{[\s\S]*border:\s*0;/);
	assert.match(response.body, /\.error-banner\s*\{[\s\S]*border-radius:\s*4px;/);
	assert.match(response.body, /\.error-banner\s*\{[\s\S]*z-index:\s*6;/);
	assert.match(response.body, /\.error-banner\s*\{[\s\S]*pointer-events:\s*auto;/);
	assert.match(response.body, /\.error-banner\.visible\s*\{[\s\S]*display:\s*grid;/);
	assert.match(response.body, /\.error-banner\[hidden\]\s*\{[\s\S]*display:\s*none !important;/);
	assert.match(response.body, /\.error-banner-close\s*\{[\s\S]*border-radius:\s*4px;/);
	assert.match(response.body, /\.error-banner-close\s*\{[\s\S]*border:\s*0;/);
	assert.match(response.body, /\.error-banner-close\s*\{[\s\S]*background:\s*transparent;/);
	assert.match(response.body, /<div id="error-banner" class="error-banner" role="alert" hidden>/);
	assert.match(response.body, /errorBanner\.hidden = false;/);
	assert.match(response.body, /errorBanner\.hidden = true;/);
	assert.match(response.body, /errorBannerClose\.addEventListener\("click", \(\) => \{\s*clearError\(\);\s*\}\);/);
	assert.doesNotMatch(response.body, /\.shell\[data-stage-mode="landing"\] \.error-banner\s*\{/);
	assert.match(response.body, /\.message\.user \.message-content\s*\{[\s\S]*text-align:\s*left;/);
	assert.doesNotMatch(response.body, /\.message\.user \.message-content\s*\{[^}]*text-align:\s*right;/);
	assert.match(response.body, /function formatControlActionReason\(action, reason\)\s*\{/);
	assert.match(response.body, /function getControlActionErrorMessage\(action, payload, fallbackMessage\)\s*\{/);
	assert.match(response.body, /当前没有可追加的运行任务，请直接重新发送消息。/);
	assert.match(response.body, /当前没有可打断的运行任务，请从顶部提示确认状态。/);
	assert.match(response.body, /当前运行任务暂不支持打断，请等待它自然结束。/);
	assert.match(response.body, /updateStreamingProcess\("ok", "消息已加入队列", payload\.conversationId\)/);
	assert.match(response.body, /updateStreamingProcess\("ok", "打断请求已接受", state\.conversationId\)/);
	assert.doesNotMatch(response.body, /updateStreamingProcess\("error", "追加被拒绝", errorMessage\)/);
	assert.doesNotMatch(response.body, /updateStreamingProcess\("error", "打断被拒绝", errorMessage\)/);
	assert.match(response.body, /const visualKind = kind === "user" \? "user" : "assistant";/);
	assert.match(response.body, /card\.className = "message " \+ visualKind;/);
	assert.match(response.body, /card\.dataset\.messageKind = kind;/);
	assert.match(response.body, /function canOpenConnRunDetails\(entry\)/);
	assert.match(response.body, /function openConnRunDetails\(entry\)/);
	assert.match(response.body, /open-conn-manager-button/);
	assert.match(response.body, /conn-manager-dialog/);
	assert.match(response.body, /conn-manager-list/);
	assert.match(response.body, /function openConnManager\(/);
	assert.match(response.body, /function loadConnManager\(/);
	assert.match(response.body, /function renderConnManager\(/);
	assert.match(response.body, /function runConnNow\(/);
	assert.match(response.body, /function toggleConnPaused\(/);
	assert.match(response.body, /\/v1\/conns"\s*,\s*\{\s*method:\s*"GET"/);
	assert.match(response.body, /\/v1\/conns\/"\s*\+\s*encodeURIComponent\(conn\.connId\)\s*\+\s*"\/run"/);
	assert.match(response.body, /\/v1\/conns\/"\s*\+\s*encodeURIComponent\(conn\.connId\)\s*\+\s*\(conn\.status === "paused" \? "\/resume" : "\/pause"\)/);
	assert.match(response.body, /conn-run-details-dialog/);
	assert.match(response.body, /conn-run-details-body/);
	assert.match(response.body, /source:\s*typeof rawEntry\.source === "string" \? rawEntry\.source : undefined/);
	assert.match(response.body, /sourceId:\s*typeof rawEntry\.sourceId === "string" \? rawEntry\.sourceId : undefined/);
	assert.match(response.body, /runId:\s*typeof rawEntry\.runId === "string" \? rawEntry\.runId : undefined/);
	assert.match(response.body, /source:\s*typeof options\?\.source === "string" \? options\.source : undefined/);
	assert.match(response.body, /sourceId:\s*typeof options\?\.sourceId === "string" \? options\.sourceId : undefined/);
	assert.match(response.body, /runId:\s*typeof options\?\.runId === "string" \? options\.runId : undefined/);
	assert.match(response.body, /\/v1\/conns\/"\s*\+\s*encodeURIComponent\(entry\.sourceId\)\s*\+\s*"\/runs\/"\s*\+\s*encodeURIComponent\(entry\.runId\)/);
	assert.match(response.body, /\/v1\/conns\/"\s*\+\s*encodeURIComponent\(entry\.sourceId\)\s*\+\s*"\/runs\/"\s*\+\s*encodeURIComponent\(entry\.runId\)\s*\+\s*"\/events"/);
	assert.match(response.body, /conn-run-open-button/);
	assert.doesNotMatch(response.body, /appendTranscriptMessage\("error"/);
	assert.doesNotMatch(response.body, /\.message\.error/);
	assert.match(response.body, /\.process-note\s*\{[\s\S]*width: 100%;/);
	assert.match(response.body, /\.process-note-text\s*\{[\s\S]*padding: 0 18px;/);
	assert.match(response.body, /\.process-note-text\s*\{[\s\S]*text-align: left;/);
	assert.match(response.body, /assistant-process-shell/);
	assert.match(response.body, /assistant-process-toggle/);
	assert.match(response.body, /assistant-process-body/);
	assert.match(response.body, /assistant-process-current-action/);
	assert.match(response.body, /\.assistant-process-shell\s*\{[\s\S]*border:\s*0;/);
	assert.match(response.body, /\.assistant-process-shell\s*\{[\s\S]*background:\s*rgba\(9, 13, 22, 0\.92\);/);
	assert.match(response.body, /\.assistant-process-shell\[data-process-expanded="false"\] \.assistant-process-head\s*\{[\s\S]*justify-content:\s*flex-end;/);
	assert.match(response.body, /\.assistant-process-shell\[data-process-expanded="false"\] \.assistant-process-head strong\s*\{[\s\S]*display:\s*none;/);
	assert.match(response.body, /\.assistant-process-narration\s*\{[\s\S]*max-height:\s*calc\(1\.6em \* 5 \+ 8px \* 4\);/);
	assert.match(response.body, /\.assistant-process-narration\s*\{[\s\S]*overflow:\s*auto;/);
	assert.match(response.body, /\.assistant-process-shell\[data-process-expanded="false"\] \.assistant-process-narration\s*\{[\s\S]*display:\s*none;/);
	assert.match(response.body, /\.assistant-process-current\s*\{[^}]*border-top:\s*1px solid rgba\(255, 255, 255, 0\.08\);/);
	assert.match(response.body, /\.assistant-process-current\s*\{[^}]*padding-top:\s*10px;/);
	assert.doesNotMatch(response.body, /\.assistant-process-current\s*\{[^}]*background:\s*rgba\(14, 20, 33, 0\.96\);/);
	assert.doesNotMatch(response.body, /\.assistant-process-current\s*\{[^}]*border-radius:\s*4px;/);
	assert.match(response.body, /\.assistant-process-shell\[data-process-expanded="false"\] \.assistant-process-current\s*\{[^}]*border-top:\s*0;/);
	assert.match(response.body, /\.assistant-process-shell\[data-process-expanded="false"\] \.assistant-process-current\s*\{[^}]*padding-top:\s*0;/);
	assert.match(response.body, /\.assistant-process-current-action\s*\{[\s\S]*min-height:\s*calc\(1\.6em \* 2\);/);
	assert.match(response.body, /\.assistant-process-current-action\s*\{[\s\S]*max-height:\s*calc\(1\.6em \* 2\);/);
	assert.match(response.body, /\.assistant-process-current-action\s*\{[\s\S]*-webkit-line-clamp:\s*2;/);
	assert.match(response.body, /function updateStreamingProcess\(kind, title, detail\)\s*\{\s*appendProcessNarrationLine\(describeProcessNarration\(kind, title, detail\)\);\s*setProcessCurrentAction\(formatProcessAction\(title, detail\), kind\);\s*\}/);
	assert.match(response.body, /function ensureStreamingAssistantMessage\(\)\s*\{[\s\S]*appendTranscriptMessage\("assistant", "助手", ""\)/);
	assert.doesNotMatch(response.body, /withProcess:\s*true/);
	assert.match(response.body, /function attachAssistantProcessShell\(body, content\)/);
	assert.match(response.body, /shell\.dataset\.processExpanded = "true"/);
	assert.match(response.body, /toggle\.setAttribute\("aria-expanded", "true"\)/);
	assert.match(response.body, /narration\.scrollTop = narration\.scrollHeight/);
	assert.match(response.body, /stream\.narration\.scrollTop = stream\.narration\.scrollHeight/);
	assert.match(response.body, /function setTranscriptState\(next\)\s*\{/);
	assert.match(response.body, /function syncConversationWidth\(\)\s*\{/);
	assert.match(response.body, /composerDropTarget\.getBoundingClientRect\(\)\.width/);
	assert.match(response.body, /async function sendMessage\(\)\s*\{[\s\S]*setTranscriptState\("active"\);[\s\S]*resetStreamingState\(\);/);
	assert.match(response.body, /const composerDraft = createComposerDraft\(\);/);
	assert.match(response.body, /updateStreamingProcess\("system", "请求已发送", formatOutboundSummary\(message, attachments, assetRefs\)\);[\s\S]*clearComposerDraft\(\);/);
	assert.match(response.body, /if \(!response\.ok\) \{[\s\S]*restoreComposerDraft\(composerDraft\);/);
	assert.match(response.body, /async function queueActiveMessage\(message, attachments, assetRefs, options\) \{[\s\S]*const composerDraft = options\?\.composerDraft \|\| createComposerDraft\(\);[\s\S]*clearComposerDraft\(\);/);
	assert.match(response.body, /window\.addEventListener\("resize", syncConversationWidth\)/);
	assert.match(response.body, /window\.requestAnimationFrame\(syncConversationWidth\)/);
	assert.match(response.body, /\.composer\s*\{[\s\S]*flex-shrink: 0;/);
	assert.match(response.body, /text\.className = "process-note-text"/);
	assert.doesNotMatch(response.body, /process-feed/);
	assert.doesNotMatch(response.body, /card\.className = "message system process-stream is-running"/);
	assert.doesNotMatch(response.body, /\.message\.process-stream\s*\{/);
	assert.match(response.body, /overflow-y: auto/);
	assert.match(response.body, /message-content/);
	assert.match(response.body, /renderMessageMarkdown/);
	assert.match(response.body, /hydrateMarkdownContent/);
	assert.match(response.body, /copy-code-button/);
	assert.doesNotMatch(response.body, /\.message\.system \.message-meta strong\s*\{/);
	assert.doesNotMatch(response.body, /\.message\.assistant,\s*\.message\.system,\s*\.message\.error\s*\{/);
	assert.match(response.body, /function appendAssistantProcessMessage\(title, text\)\s*\{/);
	assert.match(response.body, /function formatSkillsReply\(skills\)\s*\{/);
	assert.match(response.body, /\.\.\.skillList\.map\(\(skill, index\) => \{/);
	assert.match(response.body, /appendNarrationToAssistantProcess\(skillReply, "我接收到查看技能的指令，先确认运行时技能接口。"\)/);
	assert.match(response.body, /setAssistantProcessAction\(skillReply, "查询接口 · GET \/v1\/debug\/skills", "tool"\)/);
	assert.match(response.body, /setMessageContent\(skillReply\.content, formatSkillsReply\(payload\?\.skills\)\)/);
	assert.match(response.body, /completeAssistantProcessShell\(skillReply, "ok"\)/);
	assert.doesNotMatch(response.body, /appendProcessEvent\("system", "技能清单", "请求 \/v1\/debug\/skills"\)/);
	assert.doesNotMatch(response.body, /appendTranscriptMessage\("system", "技能", report\)/);
	assert.match(response.body, /code-block-toolbar/);
	assert.doesNotMatch(response.body, /drag-debug-log/);
	assert.doesNotMatch(response.body, /clear-drag-debug/);
	assert.doesNotMatch(response.body, /asset-library-head/);
	assert.doesNotMatch(response.body, /__name/);
	await app.close();
});

test("GET /playground defaults runtime append behavior to steer", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body, /mode:\s*"steer"/);
	await app.close();
});

test("GET /playground renders immersive landing home shell", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body, /id="landing-screen"/);
	assert.match(response.body, /id="hero-core"/);
	assert.match(response.body, /class="topbar-signal" aria-hidden="true">UGK CLAW</);
	assert.match(response.body, /class="hero-wordmark">UGK CLAW</);
	assert.match(response.body, /全新的记忆/);
	assert.match(response.body, /技能越多，能力越强/);
	assert.match(response.body, /id="hero-version"/);
	assert.match(response.body, /id="shell" class="shell" data-stage-mode="landing" data-transcript-state="idle"/);
	assert.match(response.body, /id="command-deck"/);
	assert.match(response.body, /id="command-status">新会话</);
	assert.match(response.body, /id="new-conversation-button"/);
	assert.match(response.body, /id="view-skills-button"/);
	assert.match(response.body, /id="file-picker-action"/);
	assert.match(response.body, /id="open-asset-library-button" class="telemetry-card telemetry-action"/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.stream-layout\s*\{[\s\S]*align-items: center;/);
	assert.match(
		response.body,
		/\.shell\[data-stage-mode="landing"\] \.stream-layout\s*\{[\s\S]*inset:\s*86px 34px var\(--command-deck-offset, 176px\) 34px;/
	);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.stream-layout\s*\{[\s\S]*overflow:\s*hidden;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.transcript-pane\s*\{[\s\S]*width: min\(var\(--conversation-width\), 100%\);/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.transcript-pane\s*\{[\s\S]*flex:\s*1 1 auto;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.transcript-pane\s*\{[\s\S]*height:\s*100%;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.transcript-pane\s*\{[\s\S]*max-height:\s*100%;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.composer\s*\{[\s\S]*border: 0;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.composer\s*\{[\s\S]*border-radius: 4px;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.composer\s*\{[\s\S]*background: rgba\(90, 82, 122, 0\.22\);/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.composer\s*\{[\s\S]*padding:\s*6px 8px 6px 10px;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.composer\s*\{[\s\S]*align-self:\s*end;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.composer\s*\{[\s\S]*height:\s*fit-content;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.composer\s*\{[\s\S]*max-height:\s*none;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.composer textarea\s*\{[\s\S]*min-height:\s*40px;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.composer textarea\s*\{[\s\S]*max-height:\s*calc\(var\(--composer-line-height\) \* var\(--composer-textarea-max-lines\) \+ 20px\);/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.composer textarea\s*\{[\s\S]*padding:\s*10px 8px;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] #send-button,[\s\S]*#interrupt-button\s*\{[\s\S]*min-height:\s*40px;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] \.command-deck\s*\{[\s\S]*width: min\(var\(--conversation-width\), 100%\);/);
	assert.match(response.body, /const commandDeck = document\.getElementById\("command-deck"\);/);
	assert.match(response.body, /function syncConversationLayout\(\) \{/);
	assert.match(response.body, /const chatStageRect = chatStage\.getBoundingClientRect\(\);/);
	assert.match(response.body, /const commandDeckRect = commandDeck\.getBoundingClientRect\(\);/);
	assert.match(response.body, /const commandDeckOffset = Math\.ceil\(chatStageRect\.bottom - commandDeckRect\.top \|\| 0\);/);
	assert.match(response.body, /shell\.style\.setProperty\("--command-deck-offset", commandDeckOffset \+ "px"\);/);
	assert.match(response.body, /const layoutObserver = new ResizeObserver\(\(\) => \{/);
	assert.match(response.body, /layoutObserver\.observe\(commandDeck\);/);
	assert.match(response.body, /layoutObserver\.observe\(chatStage\);/);
	assert.match(response.body, /function syncComposerTextareaHeight\(\)\s*\{/);
	assert.match(response.body, /const maxLines = 10;/);
	assert.match(response.body, /messageInput\.style\.height = "auto";/);
	assert.match(response.body, /messageInput\.style\.overflowY = messageInput\.scrollHeight > maxHeight \? "auto" : "hidden";/);
	assert.match(response.body, /<textarea id="message" name="message" placeholder="和我聊聊吧"><\/textarea>/);
	assert.match(response.body, /messageInput\.placeholder = "和我聊聊吧";/);
	assert.doesNotMatch(response.body, /Enter terminal command or query neural core/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] #send-button,[\s\S]*#interrupt-button\s*\{[\s\S]*border: 0;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] #send-button,[\s\S]*#interrupt-button\s*\{[\s\S]*border-radius: 4px;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\] #send-button,[\s\S]*#interrupt-button\s*\{[\s\S]*box-shadow: 0 8px 18px rgba\(0, 0, 0, 0\.22\);/);
	const asideIndex = response.body.indexOf('<aside class="landing-side landing-side-right">');
	const filePickerActionIndex = response.body.indexOf('id="file-picker-action"');
	const assetActionIndex = response.body.indexOf('id="open-asset-library-button"');
	const fileStripIndex = response.body.indexOf('<div class="file-strip">');
	const selectedAssetsIndex = response.body.indexOf('id="selected-assets"');
	const composerIndex = response.body.indexOf('<section id="composer-drop-target" class="composer">');
	const messageInputIndex = response.body.indexOf('<textarea id="message"');
	assert.ok(asideIndex >= 0);
	assert.ok(filePickerActionIndex > asideIndex);
	assert.ok(assetActionIndex > asideIndex);
	assert.ok(fileStripIndex >= 0);
	assert.ok(selectedAssetsIndex >= 0);
	assert.ok(composerIndex >= 0);
	assert.ok(messageInputIndex >= 0);
	assert.ok(filePickerActionIndex < fileStripIndex);
	assert.ok(assetActionIndex < fileStripIndex);
	assert.ok(fileStripIndex < composerIndex);
	assert.ok(selectedAssetsIndex < composerIndex);
	assert.ok(composerIndex < messageInputIndex);
	assert.match(response.body, /function createFileChip\(\{ tone, fileName, meta, onRemove \}\)\s*\{/);
	assert.match(response.body, /item\.className = "file-chip " \+ \(tone \|\| "pending"\)/);
	assert.match(response.body, /badge\.className = "file-chip-badge"/);
	assert.match(response.body, /label\.className = "file-chip-label"/);
	assert.match(response.body, /removeButton\.className = "file-chip-remove"/);
	assert.match(response.body, /function appendUserTranscriptMessage\(message, attachments, assetRefs\)\s*\{/);
	assert.match(response.body, /function appendMessageFileChips\(body, attachments, assetRefs\)\s*\{/);
	assert.match(response.body, /body\.classList\.add\("has-file-chips"\)/);
	assert.match(response.body, /asset\.fileName/);
	assert.match(response.body, /removeSelectedAsset\(asset\.assetId\)/);
	assert.match(response.body, /removePendingAttachment\(index\)/);
	assert.match(response.body, /\.file-chip\s*\{[\s\S]*display:\s*inline-flex;/);
	assert.match(response.body, /\.file-chip-badge\s*\{[\s\S]*font-family:\s*var\(--font-mono\);/);
	assert.match(response.body, /\.file-chip-remove\s*\{[\s\S]*border-radius:\s*999px;/);
	assert.match(response.body, /\.message-file-strip\s*\{[\s\S]*display:\s*flex;/);
	assert.match(response.body, /\.message\.user \.message-file-strip\s*\{[\s\S]*justify-content:\s*flex-end;/);
	assert.match(response.body, /appendUserTranscriptMessage\(message, attachments, assetRefs\)/);
	assert.doesNotMatch(response.body, /appendTranscriptMessage\("user", state\.conversationId, formatMessageWithContext\(outboundMessage, attachments, assetRefs\)\)/);
	assert.doesNotMatch(response.body, /selected-assets-head/);
	assert.doesNotMatch(response.body, /drop-zone-actions/);
	assert.doesNotMatch(response.body, /file-picker-button/);
	assert.doesNotMatch(response.body, /\.shell\[data-stage-mode="workspace"\]/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\]\[data-transcript-state="idle"\] \.stream-layout\s*\{[\s\S]*justify-content: center;/);
	assert.match(response.body, /\.shell\[data-stage-mode="landing"\]\[data-transcript-state="active"\] \.stream-layout\s*\{[\s\S]*justify-content: flex-end;/);
	assert.doesNotMatch(response.body, /\.shell::before/);
	assert.doesNotMatch(response.body, /\.shell\s*\{[\s\S]*border:\s*1px solid rgba\(95, 209, 255, 0\.12\)/);
	assert.doesNotMatch(response.body, /\.hero-core\s*\{[\s\S]*translateY\(-8%\)/);
	assert.doesNotMatch(response.body, /class="brand-logo"/);
	assert.doesNotMatch(response.body, /class="hero-logo"/);
	assert.doesNotMatch(response.body, /开始一轮对话，或先从上方选择文件与资产。/);
	assert.match(response.body, /\.shell\[data-transcript-state="idle"\] \.transcript-current:empty::before\s*\{[\s\S]*content:\s*"■   ■  ■■■  ■  ■\\A/);
	assert.match(response.body, /\.shell\[data-transcript-state="idle"\] \.transcript-current:empty::before\s*\{[\s\S]*font-family:\s*var\(--font-mono\);/);
	assert.match(response.body, /\.shell\[data-transcript-state="idle"\] \.transcript-current:empty::before\s*\{[\s\S]*white-space:\s*pre;/);
	await app.close();
});

test("GET /playground embeds syntactically valid browser script", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	const scriptMatch = response.body.match(/<script>([\s\S]*)<\/script>/);
	assert.ok(scriptMatch, "expected inline playground script");
	assert.doesNotThrow(() => {
		new Function(scriptMatch[1]);
	});
	await app.close();
});

test("POST /v1/conns accepts cron timezone and runtime profile ids", async () => {
	const createdInputs: unknown[] = [];
	const app = buildServer({
		agentService: createAgentServiceStub(),
		connStore: {
			list: async () => [],
			get: async () => undefined,
			create: async (input: {
				title: string;
				prompt: string;
				target: { type: "conversation"; conversationId: string };
				schedule: { kind: "cron"; expression: string; timezone?: string };
				assetRefs?: string[];
				profileId?: string;
				agentSpecId?: string;
				skillSetId?: string;
				modelPolicyId?: string;
				upgradePolicy?: "latest" | "pinned" | "manual";
				maxRunMs?: number;
			}) => {
				createdInputs.push(input);
				return {
					connId: "conn-1",
					title: input.title,
					prompt: input.prompt,
					target: input.target,
					schedule: input.schedule,
					assetRefs: input.assetRefs ?? [],
					profileId: input.profileId,
					agentSpecId: input.agentSpecId,
					skillSetId: input.skillSetId,
					modelPolicyId: input.modelPolicyId,
					upgradePolicy: input.upgradePolicy,
					maxRunMs: input.maxRunMs,
					status: "active",
					createdAt: "2026-04-21T00:00:00.000Z",
					updatedAt: "2026-04-21T00:00:00.000Z",
				};
			},
			update: async () => undefined,
			delete: async () => false,
			pause: async () => undefined,
			resume: async () => undefined,
		} as never,
		connRunStore: {
			createRun: async () => {
				throw new Error("not used");
			},
			listRunsForConn: async () => [],
			getRun: async () => undefined,
			listEvents: async () => [],
			listFiles: async () => [],
		} as never,
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/conns",
		payload: {
			title: " morning digest ",
			prompt: " run every day ",
			target: { type: "conversation", conversationId: "manual:digest" },
			schedule: { kind: "cron", expression: "0 9 * * *", timezone: "Asia/Shanghai" },
			assetRefs: ["asset-1", " asset-2 "],
			profileId: "background.zh",
			agentSpecId: "agent.daily",
			skillSetId: "skills.research",
			modelPolicyId: "model.stable",
			upgradePolicy: "pinned",
			maxRunMs: 120000,
		},
	});

	assert.equal(response.statusCode, 201);
	assert.deepEqual(createdInputs, [
		{
			title: "morning digest",
			prompt: "run every day",
			target: { type: "conversation", conversationId: "manual:digest" },
			schedule: { kind: "cron", expression: "0 9 * * *", timezone: "Asia/Shanghai" },
			assetRefs: ["asset-1", "asset-2"],
			profileId: "background.zh",
			agentSpecId: "agent.daily",
			skillSetId: "skills.research",
			modelPolicyId: "model.stable",
			upgradePolicy: "pinned",
			maxRunMs: 120000,
		},
	]);
	assert.deepEqual(response.json(), {
		conn: {
			connId: "conn-1",
			title: "morning digest",
			prompt: "run every day",
			target: { type: "conversation", conversationId: "manual:digest" },
			schedule: { kind: "cron", expression: "0 9 * * *", timezone: "Asia/Shanghai" },
			assetRefs: ["asset-1", "asset-2"],
			profileId: "background.zh",
			agentSpecId: "agent.daily",
			skillSetId: "skills.research",
			modelPolicyId: "model.stable",
			upgradePolicy: "pinned",
			maxRunMs: 120000,
			status: "active",
			createdAt: "2026-04-21T00:00:00.000Z",
			updatedAt: "2026-04-21T00:00:00.000Z",
		},
	});
	await app.close();
});

test("POST /v1/conns defaults target to the current conversation when target is omitted", async () => {
	const createdInputs: unknown[] = [];
	const app = buildServer({
		agentService: createAgentServiceStub({
			getConversationCatalog: async () => ({
				currentConversationId: "manual:current-thread",
				conversations: [
					{
						conversationId: "manual:current-thread",
						title: "当前会话",
						preview: "",
						messageCount: 3,
						createdAt: "2026-04-21T00:00:00.000Z",
						updatedAt: "2026-04-21T00:00:00.000Z",
						running: false,
					},
				],
			}),
		}),
		connStore: {
			list: async () => [],
			get: async () => undefined,
			create: async (input: {
				title: string;
				prompt: string;
				target: { type: "conversation"; conversationId: string };
				schedule: { kind: "cron"; expression: string; timezone?: string };
				assetRefs?: string[];
				profileId?: string;
				agentSpecId?: string;
				skillSetId?: string;
				modelPolicyId?: string;
				upgradePolicy?: "latest" | "pinned" | "manual";
			}) => {
				createdInputs.push(input);
				return {
					connId: "conn-default-target",
					title: input.title,
					prompt: input.prompt,
					target: input.target,
					schedule: input.schedule,
					assetRefs: input.assetRefs ?? [],
					profileId: input.profileId,
					agentSpecId: input.agentSpecId,
					skillSetId: input.skillSetId,
					modelPolicyId: input.modelPolicyId,
					upgradePolicy: input.upgradePolicy,
					status: "active",
					createdAt: "2026-04-21T00:00:00.000Z",
					updatedAt: "2026-04-21T00:00:00.000Z",
				};
			},
			update: async () => undefined,
			delete: async () => false,
			pause: async () => undefined,
			resume: async () => undefined,
		} as never,
		connRunStore: {
			createRun: async () => {
				throw new Error("not used");
			},
			listRunsForConn: async () => [],
			getRun: async () => undefined,
			listEvents: async () => [],
			listFiles: async () => [],
		} as never,
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/conns",
		payload: {
			title: " current digest ",
			prompt: " follow current conversation ",
			schedule: { kind: "cron", expression: "0 9 * * *", timezone: "Asia/Shanghai" },
		},
	});

	assert.equal(response.statusCode, 201);
	assert.deepEqual(createdInputs, [
		{
			title: "current digest",
			prompt: "follow current conversation",
			target: { type: "conversation", conversationId: "manual:current-thread" },
			schedule: { kind: "cron", expression: "0 9 * * *", timezone: "Asia/Shanghai" },
			assetRefs: undefined,
			profileId: undefined,
			agentSpecId: undefined,
			skillSetId: undefined,
			modelPolicyId: undefined,
			upgradePolicy: undefined,
		},
	]);
	assert.deepEqual(response.json(), {
		conn: {
			connId: "conn-default-target",
			title: "current digest",
			prompt: "follow current conversation",
			target: { type: "conversation", conversationId: "manual:current-thread" },
			schedule: { kind: "cron", expression: "0 9 * * *", timezone: "Asia/Shanghai" },
			assetRefs: [],
			status: "active",
			createdAt: "2026-04-21T00:00:00.000Z",
			updatedAt: "2026-04-21T00:00:00.000Z",
		},
	});
	await app.close();
});

test("GET /playground does not require crypto.randomUUID in non-HTTPS browsers", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body, /function createBrowserId\(\)\s*\{/);
	assert.match(response.body, /typeof cryptoApi\.randomUUID === "function"/);
	assert.match(response.body, /cryptoApi\.getRandomValues/);
	assert.doesNotMatch(response.body, /crypto\.randomUUID\(\)/);
	await app.close();
});

test("GET /playground embeds conversation history restore and message copy controls", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body, /ugk-pi:conversation-history-index/);
	assert.match(response.body, /function getConversationHistoryStorageKey\(conversationId\)\s*\{/);
	assert.match(response.body, /function restoreConversationHistory\(conversationId\)\s*\{/);
	assert.match(response.body, /function renderMoreConversationHistory\(\)\s*\{/);
	assert.match(response.body, /function handleTranscriptScroll\(\)\s*\{/);
	assert.match(response.body, /transcript\.addEventListener\("scroll", handleTranscriptScroll\)/);
	assert.match(response.body, /id="transcript-archive"/);
	assert.match(response.body, /id="transcript-current"/);
	assert.match(response.body, /function archiveCurrentTranscript\(conversationId\)\s*\{/);
	assert.match(response.body, /const MAX_ARCHIVED_TRANSCRIPTS = 4;/);
	assert.match(response.body, /id="history-load-more-button"/);
	assert.match(response.body, /async function createConversationOnServer\(\)\s*\{/);
	assert.match(response.body, /\/v1\/chat\/conversations/);
	assert.match(response.body, /function createMessageActions\(entry, content\)\s*\{/);
	assert.match(response.body, /message-actions/);
	assert.match(response.body, /message-copy-button/);
	assert.match(response.body, /\.message-actions\s*\{[\s\S]*margin-top:\s*4px;/);
	assert.match(response.body, /\.message-copy-button\s*\{[\s\S]*width:\s*26px;/);
	assert.match(response.body, /\.message-copy-button\s*\{[\s\S]*height:\s*26px;/);
	const messageCopyButtonBlock = response.body.match(/\.message-copy-button\s*\{([\s\S]*?)\n\s*\}/);
	assert.ok(messageCopyButtonBlock);
	assert.match(messageCopyButtonBlock[1], /border:\s*0;/);
	assert.match(messageCopyButtonBlock[1], /background:\s*transparent;/);
	assert.match(messageCopyButtonBlock[1], /box-shadow:\s*none;/);
	assert.match(messageCopyButtonBlock[1], /color:\s*rgba\(226,\s*234,\s*255,\s*0\.52\);/);
	assert.doesNotMatch(messageCopyButtonBlock[1], /border-color:\s*rgba\(201,\s*210,\s*255,\s*0\.2\);/);
	assert.doesNotMatch(messageCopyButtonBlock[1], /background:\s*rgba\(201,\s*210,\s*255,\s*0\.05\);/);
	assert.match(response.body, /\.message-copy-button:hover:not\(:disabled\),[\s\S]*\.message-copy-button:focus-visible\s*\{[\s\S]*background:\s*transparent;/);
	assert.match(response.body, /\.message-copy-button::before,[\s\S]*\.message-copy-button::after\s*\{[\s\S]*content:\s*"";/);
	assert.match(response.body, /copyButton\.setAttribute\("aria-label", "复制正文"\)/);
	assert.match(response.body, /copyLabel\.className = "visually-hidden"/);
	assert.doesNotMatch(response.body, /copyButton\.textContent = "复制正文"/);
	assert.match(response.body, /await copyTextToClipboard\(entry\.text \|\| ""\)/);
	assert.match(response.body, /function canPreviewFile\(mimeType\)\s*\{/);
	assert.match(response.body, /function buildDownloadUrl\(downloadUrl\)\s*\{/);
	assert.match(response.body, /openLink\.textContent = "打开"/);
	assert.match(response.body, /link\.textContent = "下载"/);
	await app.close();
});

test("GET /playground syncs the current conversation from the server catalog", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body, /async function fetchConversationCatalog\(\)\s*\{/);
	assert.match(response.body, /\/v1\/chat\/conversations/);
	assert.match(response.body, /async function createConversationOnServer\(\)\s*\{/);
	assert.match(response.body, /POST",\s*headers:[\s\S]*\/v1\/chat\/conversations/);
	assert.match(response.body, /body: JSON\.stringify\(\{\}\),/);
	assert.match(response.body, /async function switchConversationOnServer\(conversationId\)\s*\{/);
	assert.match(response.body, /\/v1\/chat\/current/);
	assert.match(response.body, /async function syncConversationCatalog\(options\)\s*\{/);
	assert.match(response.body, /async function ensureCurrentConversation\(options\)\s*\{/);
	assert.doesNotMatch(response.body, /const GLOBAL_CONVERSATION_ID = "agent:global";/);
	assert.doesNotMatch(response.body, /conversationInput\.readOnly = true;/);
	await app.close();
});

test("GET /playground uses a compact mobile topbar with overflow actions", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body, /class="mobile-topbar"/);
	assert.match(response.body, /class="mobile-brand-logo"[^>]*src="\/ugk-claw-mobile-logo\.png"/);
	assert.match(response.body, /class="mobile-brand-wordmark">UGK Claw</);
	assert.match(response.body, /id="mobile-new-conversation-button"/);
	assert.match(response.body, /id="mobile-overflow-menu-button"/);
	assert.match(response.body, /id="mobile-overflow-menu"/);
	assert.match(response.body, /class="mobile-overflow-menu"/);
	assert.match(response.body, /id="mobile-overflow-menu"[^>]*hidden|hidden[^>]*id="mobile-overflow-menu"/);
	assert.match(response.body, /id="mobile-menu-skills-button"/);
	assert.match(response.body, /id="mobile-menu-file-button"/);
	assert.match(response.body, /id="mobile-menu-library-button"/);
	assert.match(response.body, /\.mobile-topbar\s*\{[\s\S]*display:\s*none;/);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\.mobile-topbar\s*\{[\s\S]*display:\s*grid;/);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\.landing-side-right\s*\{[\s\S]*display:\s*none;/);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\.mobile-topbar\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto auto;/);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\.mobile-topbar\s*\{[\s\S]*min-height:\s*48px;/);
	assert.match(response.body, /\.mobile-topbar-button\s*\{[\s\S]*width:\s*36px;/);
	assert.match(response.body, /\.mobile-overflow-menu-item\s*\{[\s\S]*grid-template-columns:\s*18px minmax\(0, 1fr\);/);
	const mobileDrawerBackdropBlock = response.body.match(/\.mobile-drawer-backdrop\s*\{([\s\S]*?)\n\s*\}/);
	assert.ok(mobileDrawerBackdropBlock);
	assert.match(mobileDrawerBackdropBlock[1], /background:\s*transparent;/);
	assert.match(mobileDrawerBackdropBlock[1], /backdrop-filter:\s*none;/);
	assert.doesNotMatch(mobileDrawerBackdropBlock[1], /blur\(10px\)/);
	const mobileConversationListBlock = response.body.match(/\.mobile-conversation-list\s*\{([\s\S]*?)\n\s*\}/);
	assert.ok(mobileConversationListBlock);
	assert.match(mobileConversationListBlock[1], /scrollbar-width:\s*none;/);
	assert.match(mobileConversationListBlock[1], /-ms-overflow-style:\s*none;/);
	assert.match(response.body, /\.mobile-conversation-list::-webkit-scrollbar\s*\{[\s\S]*display:\s*none;/);
	const mobileConversationItemBlock = response.body.match(/\.mobile-conversation-item\s*\{([\s\S]*?)\n\s*\}/);
	assert.ok(mobileConversationItemBlock);
	assert.match(mobileConversationItemBlock[1], /border-radius:\s*4px;/);
	assert.doesNotMatch(mobileConversationItemBlock[1], /border-radius:\s*14px;/);
	assert.match(response.body, /mobileNewConversationButton\.addEventListener\("click", \(\) => \{/);
	assert.match(response.body, /mobileOverflowMenuButton\.addEventListener\("click", \(event\) => \{/);
	assert.match(response.body, /function setMobileOverflowMenuOpen\(next\)\s*\{/);
	assert.match(response.body, /function closeMobileOverflowMenu\(\)\s*\{/);
	assert.match(response.body, /mobileMenuSkillsButton\.addEventListener\("click", \(\) => \{/);
	assert.match(response.body, /mobileMenuFileButton\.addEventListener\("click", \(\) => \{/);
	assert.match(response.body, /mobileMenuLibraryButton\.addEventListener\("click", \(\) => \{/);
	assert.doesNotMatch(response.body, /class="mobile-action-strip"/);
	await app.close();
});

test("GET /playground keeps code blocks compact inside the mobile layout only", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body, /\.transcript-pane,[\s\S]*\.history-load-more\s*\{[\s\S]*border-radius: 4px !important;/);
	assert.match(response.body, /\.transcript-pane\s*\{[\s\S]*border: 0;/);
	assert.match(response.body, /\.transcript-pane\s*\{[\s\S]*background: transparent;/);
	assert.match(response.body, /\.transcript-pane\s*\{[\s\S]*box-shadow: none;/);
	assert.match(response.body, /\.message-content \.code-block-toolbar\s*\{[\s\S]*position: absolute;/);
	assert.match(response.body, /\.message-content \.code-block-language\s*\{\s*display: none;/);
	assert.match(response.body, /\.message-content \.copy-code-button\s*\{[\s\S]*display: inline-flex;/);
	assert.match(response.body, /\.message-content \.copy-code-button\s*\{[\s\S]*background: transparent;/);
	assert.match(response.body, /\.message-content \.copy-code-button\s*\{[\s\S]*border-radius: 0;/);
	assert.match(response.body, /\.message-content \.copy-code-button\s*\{[\s\S]*font-size: 0;/);
	assert.match(response.body, /\.message-content \.copy-code-button\s*\{[\s\S]*text-indent: -9999px;/);
	assert.match(response.body, /\.message-content \.copy-code-button::before\s*\{[\s\S]*content: "";/);
	assert.match(response.body, /\.message-content \.copy-code-button::before\s*\{[\s\S]*background-image: url\("data:image\/svg\+xml,/);
	assert.match(response.body, /\.message-content \.code-block\s*\{[\s\S]*background: transparent;/);
	assert.match(response.body, /\.message-content pre code\s*\{[\s\S]*white-space: pre-wrap;/);
	assert.match(response.body, /\.message-content pre code\s*\{[\s\S]*overflow-wrap: anywhere;/);
	assert.match(response.body, /\.message-content \.code-block pre\s*\{[\s\S]*padding: 14px 12px 10px;/);
	assert.match(response.body, /\.message-content \.code-block pre\s*\{[\s\S]*border-radius: 12px;/);
	assert.match(response.body, /\.message-content \.code-block pre\s*\{[\s\S]*border: 1px solid rgba\(255, 255, 255, 0\);/);
	assert.match(response.body, /\.message-content \.code-block pre\s*\{[\s\S]*background: transparent;/);
	assert.match(response.body, /\.message\.assistant \.message-content pre,\s*\.message\.assistant \.message-content \.code-block,\s*\.message\.assistant \.message-content \.code-block pre\s*\{[\s\S]*background: transparent;/);
	assert.match(response.body, /\.message\.assistant \.message-content code\s*\{[\s\S]*background: transparent;/);
	await app.close();
});

test("GET /playground uses icon-only mobile send and interrupt controls", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body, /#send-button,\s*#interrupt-button\s*\{[\s\S]*display: inline-flex;/);
	assert.match(response.body, /#send-button,\s*#interrupt-button\s*\{[\s\S]*background: transparent;/);
	assert.match(response.body, /#send-button,\s*#interrupt-button\s*\{[\s\S]*box-shadow: none;/);
	assert.match(response.body, /#send-button,\s*#interrupt-button\s*\{[\s\S]*text-indent: -9999px;/);
	assert.match(response.body, /#send-button::before\s*\{[\s\S]*width: 28px;/);
	assert.match(response.body, /#interrupt-button::before\s*\{[\s\S]*width: 28px;/);
	assert.match(response.body, /#send-button::before\s*\{[\s\S]*background-image: url\("data:image\/svg\+xml,/);
	assert.match(response.body, /#interrupt-button::before\s*\{[\s\S]*background-image: url\("data:image\/svg\+xml,/);
	assert.match(response.body, /#interrupt-button:disabled\s*\{[\s\S]*display: inline-flex;/);
	assert.match(response.body, /#interrupt-button:disabled\s*\{[\s\S]*opacity: 0\.38;/);
	await app.close();
});

test("GET /playground keeps the mobile active composer compact", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	const mobileComposerBlock = [...response.body.matchAll(/\n\s*\.composer\s*\{([\s\S]*?)\n\s*\}/g)].find((match) =>
		match[1].includes("background: rgba(8, 10, 19, 0.98);"),
	);
	const mobileLandingComposerBlock = [
		...response.body.matchAll(/\.shell\[data-stage-mode="landing"\] \.composer\s*\{([\s\S]*?)\n\s*\}/g),
	].find((match) => match[1].includes("background: rgba(8, 10, 19, 0.98);"));
	assert.ok(mobileComposerBlock);
	assert.ok(mobileLandingComposerBlock);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\n\s*\.composer\s*\{[\s\S]*padding:\s*8px 8px 8px 10px;/);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\n\s*\.composer\s*\{[\s\S]*background:\s*rgba\(8, 10, 19, 0\.98\);/);
	assert.doesNotMatch(mobileComposerBlock[1], /linear-gradient/);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\n\s*\.composer-main\s*\{[\s\S]*gap:\s*4px;/);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\n\s*\.composer-header\s*\{[\s\S]*display:\s*none;/);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\n\s*\.composer textarea\s*\{[\s\S]*min-height:\s*44px;/);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\n\s*\.composer textarea\s*\{[\s\S]*max-height:\s*calc\(var\(--composer-line-height\) \* var\(--composer-textarea-max-lines\) \+ 24px\);/);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\n\s*\.composer textarea\s*\{[\s\S]*padding:\s*12px 0;/);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\n\s*\.composer textarea\s*\{[\s\S]*resize:\s*none;/);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\.shell\[data-stage-mode="landing"\] \.composer\s*\{[\s\S]*height:\s*fit-content;/);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\.shell\[data-stage-mode="landing"\] \.composer\s*\{[\s\S]*background:\s*rgba\(8, 10, 19, 0\.98\);/);
	assert.doesNotMatch(mobileLandingComposerBlock[1], /linear-gradient/);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\.shell\[data-stage-mode="landing"\] \.composer textarea\s*\{[\s\S]*max-height:\s*calc\(var\(--composer-line-height\) \* var\(--composer-textarea-max-lines\) \+ 20px\);/);
	assert.match(response.body, /@media \(max-width: 640px\) \{[\s\S]*\.shell\[data-stage-mode="landing"\] \.composer textarea\s*\{[\s\S]*padding:\s*10px 0;/);
	await app.close();
});

test("GET /playground keeps the default active composer compact before mobile overrides", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body, /\.composer\s*\{[\s\S]*padding:\s*12px 0 14px;/);
	assert.match(response.body, /\.composer-main\s*\{[\s\S]*gap:\s*8px;/);
	assert.match(response.body, /\.composer textarea\s*\{[\s\S]*min-height:\s*72px;/);
	assert.match(response.body, /\.composer textarea\s*\{[\s\S]*--composer-textarea-max-lines:\s*10;/);
	assert.match(response.body, /\.composer textarea\s*\{[\s\S]*max-height:\s*calc\(var\(--composer-line-height\) \* var\(--composer-textarea-max-lines\) \+ 24px\);/);
	assert.match(response.body, /\.composer textarea\s*\{[\s\S]*resize:\s*none;/);
	assert.match(response.body, /\.composer textarea\s*\{[\s\S]*overflow-y:\s*auto;/);
	assert.match(response.body, /@media \(max-width: 960px\) \{[\s\S]*\.composer-side\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
	await app.close();
});

test("GET /playground uses the deeper cosmic palette instead of bright blue neon", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body, /--bg:\s*#01030a;/);
	assert.match(response.body, /--bg-panel:\s*#060711;/);
	assert.match(response.body, /--accent:\s*#c9d2ff;/);
	assert.match(response.body, /radial-gradient\(circle at 18% 14%, rgba\(121, 105, 214, 0\.14\), transparent 0 18%\)/);
	assert.match(response.body, /linear-gradient\(180deg, #02030a 0%, #04050d 38%, #090611 100%\)/);
	assert.doesNotMatch(response.body, /--accent:\s*#5fd1ff;/);
	assert.doesNotMatch(response.body, /radial-gradient\(circle at 18% 16%, rgba\(123, 178, 255, 0\.14\), transparent 0 18%\)/);
	await app.close();
});

test("GET /playground shows an explicit assistant loading bubble while a run is in flight", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body, /assistant-loading-shell/);
	assert.match(response.body, /assistant-loading-label/);
	assert.match(response.body, /assistant-loading-dots/);
	assert.match(response.body, /function ensureAssistantLoadingBubble\(\)\s*\{/);
	assert.match(response.body, /function setAssistantLoadingState\(text, kind\)\s*\{/);
	assert.match(response.body, /function completeAssistantLoadingBubble\(kind, text\)\s*\{/);
	assert.match(response.body, /case "run_started":[\s\S]*ensureStreamingAssistantMessage\(\);[\s\S]*setAssistantLoadingState\(/);
	assert.match(response.body, /case "text_delta":[\s\S]*setAssistantLoadingState\("正在生成回复", "system"\)/);
	assert.match(response.body, /case "done":[\s\S]*completeAssistantLoadingBubble\("ok", "本轮已完成"\)/);
	assert.match(response.body, /typeof event\.text === "string" && event\.text !== state\.streamingText/);
	assert.doesNotMatch(response.body, /event\.text && event\.text !== state\.streamingText/);
	await app.close();
});

test("GET /playground does not force-scroll when the user is reading history", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body, /id="scroll-to-bottom-button"/);
	assert.match(response.body, /\.scroll-to-bottom-button\s*\{[\s\S]*position:\s*absolute;/);
	assert.match(response.body, /\.scroll-to-bottom-button\.visible\s*\{[\s\S]*display:\s*inline-flex;/);
	assert.match(response.body, /const TRANSCRIPT_FOLLOW_THRESHOLD_PX = 120;/);
	assert.match(response.body, /autoFollowTranscript: true,/);
	assert.match(response.body, /function isTranscriptNearBottom\(\)\s*\{/);
	assert.match(response.body, /function syncTranscriptFollowState\(\)\s*\{/);
	assert.match(response.body, /function updateScrollToBottomButton\(\)\s*\{/);
	assert.match(response.body, /function scrollTranscriptToBottom\(options\)\s*\{/);
	assert.match(response.body, /if \(options\?\.force \|\| state\.autoFollowTranscript \|\| isTranscriptNearBottom\(\)\) \{/);
	assert.match(response.body, /scrollToBottomButton\.addEventListener\("click", \(\) => \{/);
	assert.match(response.body, /transcript\.addEventListener\("scroll", handleTranscriptScroll\)/);
	assert.match(response.body, /syncTranscriptFollowState\(\);/);
	assert.match(response.body, /scrollTranscriptToBottom\(\{ force: true \}\);/);
	await app.close();
});

test("GET /playground keeps bottom scroll room above the active composer", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body, /--transcript-bottom-scroll-buffer:\s*96px;/);
	assert.match(
		response.body,
		/\.transcript\s*\{[\s\S]*scroll-padding-bottom:\s*var\(--transcript-bottom-scroll-buffer\);/,
	);
	assert.match(
		response.body,
		/\.shell\[data-transcript-state="active"\] \.transcript-current\s*\{[\s\S]*padding-bottom:\s*var\(--transcript-bottom-scroll-buffer\);/,
	);
	assert.match(
		response.body,
		/@media \(max-width: 640px\) \{[\s\S]*\.shell\s*\{[\s\S]*--transcript-bottom-scroll-buffer:\s*calc\(112px \+ env\(safe-area-inset-bottom\)\);/,
	);
	await app.close();
});

test("GET /playground restores running conversations after refresh and avoids reopening the same stream", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body, /\/v1\/chat\/status\?/);
	assert.match(response.body, /\/v1\/chat\/state\?/);
	assert.match(response.body, /\/v1\/chat\/events\?/);
	assert.match(response.body, /async function fetchConversationState\(conversationId\)\s*\{/);
	assert.match(response.body, /function renderConversationState\(conversationState\)\s*\{/);
	assert.match(response.body, /async function fetchConversationRunStatus\(conversationId\)\s*\{/);
	assert.match(response.body, /function stopActiveRunEventStream\(\)\s*\{/);
	assert.match(response.body, /async function attachActiveRunEventStream\(conversationId\)\s*\{/);
	assert.match(response.body, /async function syncConversationRunState\(conversationId, options\)\s*\{/);
	assert.match(response.body, /async function recoverRunningStreamAfterDisconnect\(reason\)\s*\{/);
	assert.match(response.body, /function buildConversationStateSignature\(conversationState\)\s*\{/);
	assert.doesNotMatch(response.body, /function formatRecoveredRunMessage\(\)\s*\{/);
	assert.doesNotMatch(response.body, /function normalizeProcessSnapshot\(rawProcess\)\s*\{/);
	assert.doesNotMatch(response.body, /function restoreProcessSnapshot\(entry, rendered, options\)\s*\{/);
	assert.doesNotMatch(response.body, /function persistActiveProcessSnapshot\(\)\s*\{/);
	assert.match(response.body, /function isPageUnloadStreamError\(error\)\s*\{/);
	assert.match(response.body, /if \(isPageUnloadStreamError\(error\)\) \{/);
	assert.match(response.body, /function isTransientNetworkHistoryEntry\(entry\)\s*\{/);
	assert.match(response.body, /filter\(\(entry\) => !isTransientNetworkHistoryEntry\(entry\)\)/);
	assert.match(response.body, /setAssistantLoadingState\("当前正在运行", "system"\)/);
	assert.match(response.body, /void attachActiveRunEventStream\(nextConversationId\)/);
	assert.doesNotMatch(response.body, /上一轮/);
	assert.match(response.body, /const liveRunState = await syncConversationRunState\(state\.conversationId, \{/);
	assert.match(response.body, /const streamWasRecovered = await recoverRunningStreamAfterDisconnect\("missing_done"\);/);
	assert.match(response.body, /const streamWasRecovered = await recoverRunningStreamAfterDisconnect\("network_error"\);/);
	assert.match(response.body, /const previousSignature = buildConversationStateSignature\(state\.conversationState\);/);
	assert.match(response.body, /const nextSignature = buildConversationStateSignature\(state\.conversationState\);/);
	assert.match(response.body, /nextSignature !== previousSignature \|\| Boolean\(state\.conversationState\?\.activeRun\)/);
	assert.match(response.body, /if \(!state\.pageUnloading && !handoffToRunEvents\) \{/);
	assert.match(response.body, /document\.addEventListener\("visibilitychange"/);
	assert.match(response.body, /window\.addEventListener\("pageshow"/);
	assert.match(
		response.body,
		/if \(liveRunState\.running\) \{[\s\S]*await queueActiveMessage\(outboundMessage, attachments, assetRefs, \{ composerDraft \}\);/,
	);
	assert.match(response.body, /activeRun\.status === "interrupted"[\s\S]*"已打断"/);
	assert.match(response.body, /case "interrupted":[\s\S]*restoreConversationHistoryFromServer\(event\.conversationId\)/);
	assert.match(response.body, /case "error":[\s\S]*restoreConversationHistoryFromServer\(event\.conversationId\)/);
	assert.match(response.body, /async function interruptRun\(\)\s*\{[\s\S]*completeAssistantLoadingBubble\("warn", "本轮已中断"\);[\s\S]*setLoading\(false\);/);
	await app.close();
});

test("GET /playground labels timed-out conn runs distinctly in the detail dialog", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body, /function isConnRunTimedOut\(/);
	assert.match(response.body, /failed \/ timed out/);
	assert.match(response.body, /run_timed_out/);
	await app.close();
});

test("GET /v1/chat/history returns the requested conversation transcript", async () => {
	const calls: string[] = [];
	const app = buildServer({
		agentService: createAgentServiceStub({
			getConversationHistory: async (conversationId) => {
				calls.push(conversationId);
				return {
					conversationId,
					messages: [
						{
							id: "history-1",
							kind: "user",
							title: "manual:thread-1",
							text: "跨设备任务",
							createdAt: "2026-04-20T00:00:00.000Z",
						},
						{
							id: "history-2",
							kind: "assistant",
							title: "助手",
							text: "跨设备回复",
							createdAt: "2026-04-20T00:00:01.000Z",
						},
					],
				};
			},
		}),
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/chat/history?conversationId=manual%3Athread-1",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		conversationId: "manual:thread-1",
		messages: [
			{
				id: "history-1",
				kind: "user",
				title: "manual:thread-1",
				text: "跨设备任务",
				createdAt: "2026-04-20T00:00:00.000Z",
			},
			{
				id: "history-2",
				kind: "assistant",
				title: "助手",
				text: "跨设备回复",
				createdAt: "2026-04-20T00:00:01.000Z",
			},
		],
	});
	assert.deepEqual(calls, ["manual:thread-1"]);
	await app.close();
});

test("GET /v1/chat/state returns the canonical conversation state", async () => {
	const calls: string[] = [];
	const app = buildServer({
		agentService: createAgentServiceStub({
			getConversationState: async (conversationId) => {
				calls.push(conversationId);
				return {
					conversationId,
					running: true,
					contextUsage: {
						provider: "dashscope-coding",
						model: "glm-5",
						currentTokens: 128,
						contextWindow: 128000,
						reserveTokens: 16384,
						maxResponseTokens: 16384,
						availableTokens: 111104,
						percent: 1,
						status: "safe",
						mode: "estimate",
					},
					messages: [
						{
							id: "history-1",
							kind: "user",
							title: "manual:thread-2",
							text: "old task",
							createdAt: "2026-04-20T00:00:00.000Z",
						},
					],
					activeRun: {
						runId: "run-agent-global-1",
						status: "running",
						assistantMessageId: "active-run-agent-global-1",
						input: {
							message: "current task",
							inputAssets: [],
						},
						text: "partial",
						process: {
							title: "思考过程",
							narration: ["任务开始"],
							currentAction: "工具开始 · bash",
							kind: "tool",
							isComplete: false,
							entries: [],
						},
						queue: {
							steering: [],
							followUp: [],
						},
						loading: true,
						startedAt: "2026-04-20T00:00:01.000Z",
						updatedAt: "2026-04-20T00:00:02.000Z",
					},
					updatedAt: "2026-04-20T00:00:02.000Z",
				};
			},
		}),
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/chat/state?conversationId=manual%3Athread-2",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		conversationId: "manual:thread-2",
		running: true,
		contextUsage: {
			provider: "dashscope-coding",
			model: "glm-5",
			currentTokens: 128,
			contextWindow: 128000,
			reserveTokens: 16384,
			maxResponseTokens: 16384,
			availableTokens: 111104,
			percent: 1,
			status: "safe",
			mode: "estimate",
		},
		messages: [
			{
				id: "history-1",
				kind: "user",
				title: "manual:thread-2",
				text: "old task",
				createdAt: "2026-04-20T00:00:00.000Z",
			},
		],
		activeRun: {
			runId: "run-agent-global-1",
			status: "running",
			assistantMessageId: "active-run-agent-global-1",
			input: {
				message: "current task",
				inputAssets: [],
			},
			text: "partial",
			process: {
				title: "思考过程",
				narration: ["任务开始"],
				currentAction: "工具开始 · bash",
				kind: "tool",
				isComplete: false,
				entries: [],
			},
			queue: {
				steering: [],
				followUp: [],
			},
			loading: true,
			startedAt: "2026-04-20T00:00:01.000Z",
			updatedAt: "2026-04-20T00:00:02.000Z",
		},
		updatedAt: "2026-04-20T00:00:02.000Z",
	});
	assert.deepEqual(calls, ["manual:thread-2"]);
	await app.close();
});

test("GET /v1/chat/conversations returns the server-synced current conversation catalog", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub({
			getConversationCatalog: async () => ({
				currentConversationId: "manual:thread-2",
				conversations: [
					{
						conversationId: "manual:thread-2",
						title: "当前产线",
						preview: "继续当前任务",
						messageCount: 6,
						createdAt: "2026-04-20T00:00:00.000Z",
						updatedAt: "2026-04-20T00:02:00.000Z",
						running: false,
					},
					{
						conversationId: "manual:thread-1",
						title: "上一条产线",
						preview: "已完成的方案讨论",
						messageCount: 12,
						createdAt: "2026-04-19T23:50:00.000Z",
						updatedAt: "2026-04-19T23:59:00.000Z",
						running: false,
					},
				],
			}),
		}),
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/chat/conversations",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		currentConversationId: "manual:thread-2",
		conversations: [
			{
				conversationId: "manual:thread-2",
				title: "当前产线",
				preview: "继续当前任务",
				messageCount: 6,
				createdAt: "2026-04-20T00:00:00.000Z",
				updatedAt: "2026-04-20T00:02:00.000Z",
				running: false,
			},
			{
				conversationId: "manual:thread-1",
				title: "上一条产线",
				preview: "已完成的方案讨论",
				messageCount: 12,
				createdAt: "2026-04-19T23:50:00.000Z",
				updatedAt: "2026-04-19T23:59:00.000Z",
				running: false,
			},
		],
	});
	await app.close();
});

test("POST /v1/chat/conversations creates and activates a new conversation", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub({
			createConversation: async () => ({
				conversationId: "manual:new-2",
				currentConversationId: "manual:new-2",
				created: true,
			}),
		}),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat/conversations",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		conversationId: "manual:new-2",
		currentConversationId: "manual:new-2",
		created: true,
	});
	await app.close();
});

test("POST /v1/chat/current switches the globally active conversation", async () => {
	const calls: string[] = [];
	const app = buildServer({
		agentService: createAgentServiceStub({
			switchConversation: async (conversationId) => {
				calls.push(conversationId);
				return {
					conversationId,
					currentConversationId: conversationId,
					switched: true,
				};
			},
		}),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat/current",
		payload: {
			conversationId: "manual:thread-1",
		},
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		conversationId: "manual:thread-1",
		currentConversationId: "manual:thread-1",
		switched: true,
	});
	assert.deepEqual(calls, ["manual:thread-1"]);
	await app.close();
});

test("GET /assets/fonts/Agave-Regular.ttf returns the bundled Agave font", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/assets/fonts/Agave-Regular.ttf",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.headers["content-type"] ?? "", /font\/ttf|application\/octet-stream/);
	assert.ok(response.rawPayload.length > 1000);
	await app.close();
});

test("GET /x-api-report-full.png serves public root files over HTTP", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/x-api-report-full.png",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.headers["content-type"] ?? "", /^image\/png/);
	assert.ok(response.rawPayload.length > 1000);
	await app.close();
});

test("GET /runtime/report-medtrum-v2.html serves runtime report files over HTTP", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/runtime/report-medtrum-v2.html",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.headers["content-type"] ?? "", /^text\/html/);
	assert.match(response.body, /<html/i);
	await app.close();
});

test("GET /v1/local-file opens runtime artifacts from container-style paths", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/local-file?path=%2Fapp%2Fruntime%2Freport-medtrum-v2.html",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.headers["content-type"] ?? "", /^text\/html/);
	assert.match(response.body, /<html/i);
	await app.close();
});

test("GET /v1/local-file accepts file URLs for runtime artifacts", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/local-file?path=file%3A%2F%2F%2Fapp%2Fruntime%2Freport-medtrum-v2.html",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.headers["content-type"] ?? "", /^text\/html/);
	await app.close();
});

test("GET /v1/local-file unwraps accidentally nested local-file urls", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/local-file?path=http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fruntime%2Freport-medtrum-v2.html",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.headers["content-type"] ?? "", /^text\/html/);
	await app.close();
});

test("GET /runtime/../package.json does not expose files outside runtime", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/runtime/../package.json",
	});

	assert.equal(response.statusCode, 404);
	await app.close();
});

test("GET /v1/local-file does not expose files outside public and runtime", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/local-file?path=%2Fapp%2F.data%2Fagent%2Fasset-index.json",
	});

	assert.equal(response.statusCode, 404);
	await app.close();
});

test("GET /package.json does not expose files outside public", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/package.json",
	});

	assert.equal(response.statusCode, 404);
	await app.close();
});

test("GET /v1/files/:fileId downloads a stored agent file", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
		assetStore: {
			registerAttachments: async () => [],
			saveFiles: async () => [],
			listAssets: async () => [],
			getAsset: async () => undefined,
			resolveAssets: async () => [],
			readText: async () => undefined,
			getFile: async (fileId: string) =>
				fileId === "file-123"
					? {
							assetId: "file-123",
							reference: "@asset[file-123]",
							fileName: "hello.txt",
							mimeType: "text/plain",
							sizeBytes: 11,
							kind: "text",
							hasContent: true,
							source: "agent_output",
							conversationId: "manual:file",
							createdAt: "2026-04-18T00:00:00.000Z",
							downloadUrl: "/v1/files/file-123",
							content: Buffer.from("hello world", "utf8"),
						}
					: undefined,
		},
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/files/file-123",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.headers["content-type"] ?? "", /^text\/plain/);
	assert.match(response.headers["content-disposition"] ?? "", /filename="hello\.txt"/);
	assert.equal(response.body, "hello world");
	await app.close();
});

test("GET /v1/files/:fileId serves previewable images inline and still supports forced download", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
		assetStore: {
			registerAttachments: async () => [],
			saveFiles: async () => [],
			listAssets: async () => [],
			getAsset: async () => undefined,
			resolveAssets: async () => [],
			readText: async () => undefined,
			getFile: async (fileId: string) =>
				fileId === "image-1"
					? {
							assetId: "image-1",
							reference: "@asset[image-1]",
							fileName: "report.png",
							mimeType: "image/png",
							sizeBytes: 8,
							kind: "binary",
							hasContent: true,
							source: "agent_output",
							conversationId: "manual:image",
							createdAt: "2026-04-19T00:00:00.000Z",
							downloadUrl: "/v1/files/image-1",
							content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
						}
					: undefined,
		},
	});

	const previewResponse = await app.inject({
		method: "GET",
		url: "/v1/files/image-1",
	});
	assert.equal(previewResponse.statusCode, 200);
	assert.match(
		previewResponse.headers["content-disposition"] ?? "",
		/^inline;\s*filename="report\.png";\s*filename\*=UTF-8''report\.png$/,
	);

	const downloadResponse = await app.inject({
		method: "GET",
		url: "/v1/files/image-1?download=1",
	});
	assert.equal(downloadResponse.statusCode, 200);
	assert.match(
		downloadResponse.headers["content-disposition"] ?? "",
		/^attachment;\s*filename="report\.png";\s*filename\*=UTF-8''report\.png$/,
	);
	await app.close();
});

test("GET /v1/files/:fileId supports non-ascii filenames without invalid header errors", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
		assetStore: {
			registerAttachments: async () => [],
			saveFiles: async () => [],
			listAssets: async () => [],
			getAsset: async () => undefined,
			resolveAssets: async () => [],
			readText: async () => undefined,
			getFile: async (fileId: string) =>
				fileId === "image-zh"
					? {
							assetId: "image-zh",
							reference: "@asset[image-zh]",
							fileName: "知乎热榜Top3_20260419.png",
							mimeType: "image/png",
							sizeBytes: 8,
							kind: "binary",
							hasContent: true,
							source: "agent_output",
							conversationId: "manual:image-zh",
							createdAt: "2026-04-19T00:00:00.000Z",
							downloadUrl: "/v1/files/image-zh",
							content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
						}
					: undefined,
		},
	});

	const previewResponse = await app.inject({
		method: "GET",
		url: "/v1/files/image-zh",
	});
	assert.equal(previewResponse.statusCode, 200);
	assert.match(previewResponse.headers["content-disposition"] ?? "", /^inline;\s*filename="[^"]+";\s*filename\*=UTF-8''/);

	const downloadResponse = await app.inject({
		method: "GET",
		url: "/v1/files/image-zh?download=1",
	});
	assert.equal(downloadResponse.statusCode, 200);
	assert.match(downloadResponse.headers["content-disposition"] ?? "", /^attachment;\s*filename="[^"]+";\s*filename\*=UTF-8''/);
	await app.close();
});

test("GET /v1/assets returns reusable asset metadata", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
		assetStore: {
			registerAttachments: async () => [],
			saveFiles: async () => [],
			listAssets: async () => [
				{
					assetId: "asset-1",
					reference: "@asset[asset-1]",
					fileName: "notes.txt",
					mimeType: "text/plain",
					sizeBytes: 11,
					kind: "text",
					hasContent: true,
					source: "user_upload",
					conversationId: "manual:test",
					createdAt: "2026-04-18T00:00:00.000Z",
					textPreview: "hello file",
					downloadUrl: "/v1/files/asset-1",
				},
			],
			getAsset: async () => undefined,
			resolveAssets: async () => [],
			readText: async () => undefined,
			getFile: async () => undefined,
		},
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/assets?limit=20",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		assets: [
			{
				assetId: "asset-1",
				reference: "@asset[asset-1]",
				fileName: "notes.txt",
				mimeType: "text/plain",
				sizeBytes: 11,
				kind: "text",
				hasContent: true,
				source: "user_upload",
				conversationId: "manual:test",
				createdAt: "2026-04-18T00:00:00.000Z",
				textPreview: "hello file",
				downloadUrl: "/v1/files/asset-1",
			},
		],
	});
	await app.close();
});

test("GET /v1/conns returns scheduled conn tasks", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
		connStore: {
			list: async () => [
				{
					connId: "conn-1",
					title: "digest",
					prompt: "summarize",
					target: { type: "conversation", conversationId: "manual:digest" },
					schedule: { kind: "interval", everyMs: 60000 },
					assetRefs: ["asset-1"],
					status: "active",
					createdAt: "2026-04-18T00:00:00.000Z",
					updatedAt: "2026-04-18T00:00:00.000Z",
					nextRunAt: "2026-04-18T00:01:00.000Z",
				},
			],
			get: async () => undefined,
			create: async () => {
				throw new Error("not used");
			},
			update: async () => undefined,
			delete: async () => false,
			pause: async () => undefined,
			resume: async () => undefined,
		} as never,
		connRunStore: {
			createRun: async () => {
				throw new Error("not used");
			},
			listRunsForConn: async () => [],
			getRun: async () => undefined,
			listEvents: async () => [],
			listFiles: async () => [],
		} as never,
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/conns",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		conns: [
			{
				connId: "conn-1",
				title: "digest",
				prompt: "summarize",
				target: { type: "conversation", conversationId: "manual:digest" },
				schedule: { kind: "interval", everyMs: 60000 },
				assetRefs: ["asset-1"],
				status: "active",
				createdAt: "2026-04-18T00:00:00.000Z",
				updatedAt: "2026-04-18T00:00:00.000Z",
				nextRunAt: "2026-04-18T00:01:00.000Z",
			},
		],
	});
	await app.close();
});

test("POST /v1/conns/:connId/run enqueues a background run without invoking the foreground agent", async () => {
	const createdRuns: unknown[] = [];
	const app = buildServer({
		agentService: createAgentServiceStub({
			chat: async () => {
				throw new Error("foreground agent should not be called");
			},
		}),
		connStore: {
			list: async () => [],
			get: async (connId: string) =>
				connId === "conn-1"
					? {
							connId: "conn-1",
							title: "digest",
							prompt: "summarize",
							target: { type: "conversation", conversationId: "manual:digest" },
							schedule: { kind: "interval", everyMs: 60000 },
							assetRefs: ["asset-1"],
							status: "active",
							createdAt: "2026-04-18T00:00:00.000Z",
							updatedAt: "2026-04-18T00:00:00.000Z",
							nextRunAt: "2026-04-18T00:01:00.000Z",
						}
					: undefined,
			create: async () => {
				throw new Error("not used");
			},
			update: async () => undefined,
			delete: async () => false,
			pause: async () => undefined,
			resume: async () => undefined,
		} as never,
		connRunStore: {
			createRun: async (input: { runId?: string; connId: string; scheduledAt: string; workspacePath: string }) => {
				createdRuns.push(input);
				return {
					runId: input.runId ?? "run-1",
					connId: input.connId,
					status: "pending",
					scheduledAt: input.scheduledAt,
					workspacePath: input.workspacePath,
					createdAt: "2026-04-21T00:00:00.000Z",
					updatedAt: "2026-04-21T00:00:00.000Z",
				};
			},
			listRunsForConn: async () => [],
			getRun: async () => undefined,
			listEvents: async () => [],
			listFiles: async () => [],
		} as never,
		backgroundDataDir: "E:/AII/ugk-pi/.data/agent/background",
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/conns/conn-1/run",
	});

	assert.equal(response.statusCode, 202);
	const body = response.json();
	assert.equal(body.run.connId, "conn-1");
	assert.equal(body.run.status, "pending");
	assert.equal(body.run.scheduledAt <= new Date().toISOString(), true);
	assert.match(body.run.workspacePath, /[\\/]background[\\/]runs[\\/][0-9a-f-]+$/);
	assert.deepEqual(createdRuns, [
		{
			runId: body.run.runId,
			connId: "conn-1",
			scheduledAt: body.run.scheduledAt,
			workspacePath: body.run.workspacePath,
		},
	]);
	await app.close();
});

test("GET /v1/conns/:connId/runs returns background run history for the conn", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
		connStore: {
			list: async () => [],
			get: async (connId: string) =>
				connId === "conn-1"
					? {
							connId: "conn-1",
							title: "digest",
							prompt: "summarize",
							target: { type: "conversation", conversationId: "manual:digest" },
							schedule: { kind: "interval", everyMs: 60000 },
							assetRefs: [],
							status: "active",
							createdAt: "2026-04-18T00:00:00.000Z",
							updatedAt: "2026-04-18T00:00:00.000Z",
						}
					: undefined,
			create: async () => {
				throw new Error("not used");
			},
			update: async () => undefined,
			delete: async () => false,
			pause: async () => undefined,
			resume: async () => undefined,
		} as never,
		connRunStore: {
			createRun: async () => {
				throw new Error("not used");
			},
			listRunsForConn: async (connId: string) =>
				connId === "conn-1"
					? [
							{
								runId: "run-2",
								connId: "conn-1",
								status: "succeeded",
								scheduledAt: "2026-04-21T09:00:00.000Z",
								startedAt: "2026-04-21T09:00:01.000Z",
								finishedAt: "2026-04-21T09:00:30.000Z",
								workspacePath: "E:/AII/ugk-pi/.data/agent/background/runs/run-2",
								resultSummary: "done",
								resultText: "daily result",
								createdAt: "2026-04-21T09:00:00.000Z",
								updatedAt: "2026-04-21T09:00:30.000Z",
							},
						]
					: [],
			getRun: async () => undefined,
			listEvents: async () => [],
			listFiles: async () => [],
		} as never,
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/conns/conn-1/runs",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		runs: [
			{
				runId: "run-2",
				connId: "conn-1",
				status: "succeeded",
				scheduledAt: "2026-04-21T09:00:00.000Z",
				startedAt: "2026-04-21T09:00:01.000Z",
				finishedAt: "2026-04-21T09:00:30.000Z",
				workspacePath: "E:/AII/ugk-pi/.data/agent/background/runs/run-2",
				resultSummary: "done",
				resultText: "daily result",
				createdAt: "2026-04-21T09:00:00.000Z",
				updatedAt: "2026-04-21T09:00:30.000Z",
			},
		],
	});
	await app.close();
});

test("GET /v1/conns/:connId/runs/:runId returns run detail with output files", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
		connStore: {
			list: async () => [],
			get: async (connId: string) =>
				connId === "conn-1"
					? {
							connId: "conn-1",
							title: "digest",
							prompt: "summarize",
							target: { type: "conversation", conversationId: "manual:digest" },
							schedule: { kind: "interval", everyMs: 60000 },
							assetRefs: [],
							status: "active",
							createdAt: "2026-04-18T00:00:00.000Z",
							updatedAt: "2026-04-18T00:00:00.000Z",
						}
					: undefined,
			create: async () => {
				throw new Error("not used");
			},
			update: async () => undefined,
			delete: async () => false,
			pause: async () => undefined,
			resume: async () => undefined,
		} as never,
		connRunStore: {
			createRun: async () => {
				throw new Error("not used");
			},
			listRunsForConn: async () => [],
			getRun: async (runId: string) =>
				runId === "run-2"
					? {
							runId: "run-2",
							connId: "conn-1",
							status: "succeeded",
							scheduledAt: "2026-04-21T09:00:00.000Z",
							claimedAt: "2026-04-21T09:00:01.000Z",
							startedAt: "2026-04-21T09:00:02.000Z",
							leaseOwner: "worker-a",
							leaseUntil: "2026-04-21T09:05:00.000Z",
							workspacePath: "E:/AII/ugk-pi/.data/agent/background/runs/run-2",
							resultSummary: "done",
							createdAt: "2026-04-21T09:00:00.000Z",
							updatedAt: "2026-04-21T09:00:30.000Z",
						}
					: runId === "run-other"
						? {
								runId: "run-other",
								connId: "conn-other",
								status: "succeeded",
								scheduledAt: "2026-04-21T09:00:00.000Z",
								workspacePath: "E:/AII/ugk-pi/.data/agent/background/runs/run-other",
								createdAt: "2026-04-21T09:00:00.000Z",
								updatedAt: "2026-04-21T09:00:30.000Z",
							}
						: undefined,
			listEvents: async () => [],
			listFiles: async (runId: string) =>
				runId === "run-2"
					? [
							{
								fileId: "file-1",
								runId: "run-2",
								kind: "output",
								relativePath: "output/report.md",
								fileName: "report.md",
								mimeType: "text/markdown",
								sizeBytes: 42,
								createdAt: "2026-04-21T09:00:30.000Z",
							},
						]
					: [],
		} as never,
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/conns/conn-1/runs/run-2",
	});
	const wrongConnResponse = await app.inject({
		method: "GET",
		url: "/v1/conns/conn-1/runs/run-other",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		run: {
			runId: "run-2",
			connId: "conn-1",
			status: "succeeded",
			scheduledAt: "2026-04-21T09:00:00.000Z",
			claimedAt: "2026-04-21T09:00:01.000Z",
			startedAt: "2026-04-21T09:00:02.000Z",
			leaseOwner: "worker-a",
			leaseUntil: "2026-04-21T09:05:00.000Z",
			workspacePath: "E:/AII/ugk-pi/.data/agent/background/runs/run-2",
			resultSummary: "done",
			createdAt: "2026-04-21T09:00:00.000Z",
			updatedAt: "2026-04-21T09:00:30.000Z",
		},
		files: [
			{
				fileId: "file-1",
				runId: "run-2",
				kind: "output",
				relativePath: "output/report.md",
				fileName: "report.md",
				mimeType: "text/markdown",
				sizeBytes: 42,
				createdAt: "2026-04-21T09:00:30.000Z",
			},
		],
	});
	assert.equal(wrongConnResponse.statusCode, 404);
	await app.close();
});

test("GET /v1/conns/:connId/runs/:runId/events returns ordered run events", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
		connStore: {
			list: async () => [],
			get: async (connId: string) =>
				connId === "conn-1"
					? {
							connId: "conn-1",
							title: "digest",
							prompt: "summarize",
							target: { type: "conversation", conversationId: "manual:digest" },
							schedule: { kind: "interval", everyMs: 60000 },
							assetRefs: [],
							status: "active",
							createdAt: "2026-04-18T00:00:00.000Z",
							updatedAt: "2026-04-18T00:00:00.000Z",
						}
					: undefined,
			create: async () => {
				throw new Error("not used");
			},
			update: async () => undefined,
			delete: async () => false,
			pause: async () => undefined,
			resume: async () => undefined,
		} as never,
		connRunStore: {
			createRun: async () => {
				throw new Error("not used");
			},
			listRunsForConn: async () => [],
			getRun: async (runId: string) =>
				runId === "run-2"
					? {
							runId: "run-2",
							connId: "conn-1",
							status: "running",
							scheduledAt: "2026-04-21T09:00:00.000Z",
							workspacePath: "E:/AII/ugk-pi/.data/agent/background/runs/run-2",
							createdAt: "2026-04-21T09:00:00.000Z",
							updatedAt: "2026-04-21T09:00:01.000Z",
						}
					: undefined,
			listEvents: async (runId: string) =>
				runId === "run-2"
					? [
							{
								eventId: "event-1",
								runId: "run-2",
								seq: 1,
								eventType: "workspace_created",
								event: { rootPath: "E:/AII/ugk-pi/.data/agent/background/runs/run-2" },
								createdAt: "2026-04-21T09:00:01.000Z",
							},
						]
					: [],
			listFiles: async () => [],
		} as never,
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/conns/conn-1/runs/run-2/events",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		events: [
			{
				eventId: "event-1",
				runId: "run-2",
				seq: 1,
				eventType: "workspace_created",
				event: { rootPath: "E:/AII/ugk-pi/.data/agent/background/runs/run-2" },
				createdAt: "2026-04-21T09:00:01.000Z",
			},
		],
	});
	await app.close();
});

test("POST /v1/integrations/feishu/events answers url verification challenge", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
		feishuService: {
			handleWebhook: async () => ({
				challenge: "challenge-token",
				accepted: true,
			}),
			deliverText: async () => undefined,
		} as never,
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/integrations/feishu/events",
		payload: {
			type: "url_verification",
			challenge: "challenge-token",
		},
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		challenge: "challenge-token",
	});
	await app.close();
});

test("renderPlaygroundMarkdown renders safe markdown html for transcript messages", () => {
	const html = renderPlaygroundMarkdown(
		[
			"# Title",
			"",
			"- one",
			"- two",
			"",
			"**bold** and `code` and [link](https://example.com)",
			"",
			"> quote",
			"",
			"```ts",
			"const value = 1 < 2;",
			"```",
			"",
			"<script>alert(1)</script>",
		].join("\n"),
	);

	assert.match(html, /<h1>Title<\/h1>/);
	assert.match(html, /<ul>\s*<li>one<\/li>\s*<li>two<\/li>\s*<\/ul>/);
	assert.match(html, /<strong>bold<\/strong>/);
	assert.match(html, /<code>code<\/code>/);
	assert.match(html, /<a href="https:\/\/example\.com" target="_blank" rel="noreferrer noopener">link<\/a>/);
	assert.match(html, /<blockquote>\s*<p>quote<\/p>\s*<\/blockquote>/);
	assert.match(html, /<pre><code class="language-ts">const value = 1 &lt; 2;\s*<\/code><\/pre>/);
	assert.doesNotMatch(html, /<script>/);
	assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("renderPlaygroundMarkdown keeps fenced code blocks visible when preceded by plain text", () => {
	const html = renderPlaygroundMarkdown(["技能结构：", "```json", '{ "name": "web-access" }', "```"].join("\n"));

	assert.match(html, /<p>技能结构：<\/p>/);
	assert.match(html, /<pre><code class="language-json">\{ &quot;name&quot;: &quot;web-access&quot; \}\s*<\/code><\/pre>/);
	assert.doesNotMatch(html, /CODEBLOCK0/);
});

test("renderPlaygroundMarkdown renders pipe tables as html tables", () => {
	const html = renderPlaygroundMarkdown(
		[
			"这是一个 Markdown 表格示例：",
			"",
			"| 写法 | 能抓 NoSuchMethodError？ |",
			"|------|------------------------|",
			"| catch (Exception e) | ❌ 不能 |",
			"| catch (Error e) | ✅ 能，但不推荐单独用 |",
			"| catch (Throwable t) | ✅ 能，推荐 |",
			"| catch (NoSuchMethodError e) | ✅ 能，但太具体 |",
			"",
			"---",
		].join("\n"),
	);

	assert.match(html, /<p>这是一个 Markdown 表格示例：<\/p>/);
	assert.match(html, /<table>/);
	assert.match(html, /<thead>\s*<tr>\s*<th>写法<\/th>\s*<th>能抓 NoSuchMethodError？<\/th>\s*<\/tr>\s*<\/thead>/);
	assert.match(html, /<tbody>/);
	assert.match(html, /<td>catch \(Throwable t\)<\/td>\s*<td>✅ 能，推荐<\/td>/);
	assert.match(html, /<hr>/);
	assert.doesNotMatch(html, /\|------\|/);
});

test("POST /v1/chat returns aggregated chat response", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat",
		payload: {
			conversationId: "manual:test-2",
			message: "你好",
			userId: "u-001",
		},
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		conversationId: "manual:test-2",
		text: "echo:你好",
		sessionFile: "E:/sessions/test.jsonl",
	});
	await app.close();
});

test("POST /v1/chat passes uploaded file attachments to the agent service", async () => {
	const calls: unknown[] = [];
	const app = buildServer({
		agentService: createAgentServiceStub({
			chat: async (input) => {
				calls.push(input);
				return {
					conversationId: input.conversationId ?? "manual:file-input",
					text: "ok",
					sessionFile: "E:/sessions/test.jsonl",
				};
			},
		}),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat",
		payload: {
			conversationId: "manual:file-input",
			message: "inspect attached file",
			attachments: [
				{
					fileName: "brief.txt",
					mimeType: "text/plain",
					sizeBytes: 11,
					text: "hello file",
				},
			],
		},
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(calls, [
		{
			conversationId: "manual:file-input",
			message: "inspect attached file",
			userId: undefined,
			attachments: [
				{
					base64: undefined,
					fileName: "brief.txt",
					mimeType: "text/plain",
					sizeBytes: 11,
					text: "hello file",
				},
			],
		},
	]);
	await app.close();
});

test("POST /v1/chat passes reusable asset references to the agent service", async () => {
	const calls: unknown[] = [];
	const app = buildServer({
		agentService: createAgentServiceStub({
			chat: async (input) => {
				calls.push(input);
				return {
					conversationId: input.conversationId ?? "manual:asset-ref",
					text: "ok",
					sessionFile: "E:/sessions/test.jsonl",
				};
			},
		}),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat",
		payload: {
			conversationId: "manual:asset-ref",
			message: "reuse it",
			assetRefs: ["asset-1", "asset-2"],
		},
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(calls, [
		{
			conversationId: "manual:asset-ref",
			message: "reuse it",
			userId: undefined,
			assetRefs: ["asset-1", "asset-2"],
		},
	]);
	await app.close();
});

test("GET /v1/debug/skills returns the runtime skill registry", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/debug/skills",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		skills: [
			{ name: "using-superpowers", path: "E:/AII/ugk-pi/.pi/skills/superpowers/using-superpowers/SKILL.md" },
			{ name: "web-access", path: "E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md" },
		],
	});
	await app.close();
});

test("GET /v1/chat/status returns whether the conversation is currently running", async () => {
	const calls: string[] = [];
	const app = buildServer({
		agentService: createAgentServiceStub({
			getRunStatus: async (conversationId) => {
				calls.push(conversationId);
				return {
					conversationId,
					running: true,
					contextUsage: {
						provider: "dashscope-coding",
						model: "glm-5",
						currentTokens: 45231,
						contextWindow: 128000,
						reserveTokens: 16384,
						maxResponseTokens: 16384,
						availableTokens: 66385,
						percent: 35,
						status: "safe",
						mode: "estimate",
					},
				};
			},
		}),
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/chat/status?conversationId=manual:refresh-run",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		conversationId: "manual:refresh-run",
		running: true,
		contextUsage: {
			provider: "dashscope-coding",
			model: "glm-5",
			currentTokens: 45231,
			contextWindow: 128000,
			reserveTokens: 16384,
			maxResponseTokens: 16384,
			availableTokens: 66385,
			percent: 35,
			status: "safe",
			mode: "estimate",
		},
	});
	assert.deepEqual(calls, ["manual:refresh-run"]);
	await app.close();
});

test("GET /v1/chat/events attaches to the current active run event stream", async () => {
	const calls: string[] = [];
	const app = buildServer({
		agentService: createAgentServiceStub({
			subscribeRunEvents: (conversationId, onEvent) => {
				calls.push(conversationId);
				onEvent({
					type: "run_started",
					conversationId,
				});
				onEvent({
					type: "text_delta",
					textDelta: "after refresh",
				});
				onEvent({
					type: "done",
					conversationId,
					text: "after refresh",
					sessionFile: "E:/sessions/events.jsonl",
				});
				return {
					conversationId,
					running: true,
					unsubscribe: () => {
						calls.push("unsubscribed");
					},
				};
			},
		}),
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/chat/events?conversationId=manual:events",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.headers["content-type"] ?? "", /^text\/event-stream/);
	assert.match(response.body, /"type":"run_started"/);
	assert.match(response.body, /"type":"text_delta"/);
	assert.match(response.body, /"type":"done"/);
	assert.deepEqual(calls, ["manual:events", "unsubscribed"]);
	await app.close();
});

test("POST /v1/internal/notifications/broadcast publishes a notification event to the hub", async () => {
	const hub = new NotificationHub();
	const events: unknown[] = [];
	const subscription = hub.subscribe((event) => {
		events.push(event);
	});
	const app = buildServer({
		agentService: createAgentServiceStub(),
		notificationHub: hub,
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/internal/notifications/broadcast",
		payload: {
			notificationId: "notice-1",
			conversationId: "manual:notice",
			source: "conn",
			sourceId: "conn-1",
			runId: "run-1",
			kind: "conn_result",
			title: "Daily Digest completed",
			createdAt: "2026-04-21T10:01:05.000Z",
		},
	});

	assert.equal(response.statusCode, 202);
	assert.deepEqual(response.json(), { ok: true });
	assert.deepEqual(events, [
		{
			notificationId: "notice-1",
			conversationId: "manual:notice",
			source: "conn",
			sourceId: "conn-1",
			runId: "run-1",
			kind: "conn_result",
			title: "Daily Digest completed",
			createdAt: "2026-04-21T10:01:05.000Z",
		},
	]);

	subscription.unsubscribe();
	await app.close();
});

test("POST /v1/chat/stream returns server-sent events for the agent run", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat/stream",
		payload: {
			conversationId: "manual:test-stream",
			message: "直播一下",
			userId: "u-002",
		},
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.headers["content-type"] ?? "", /^text\/event-stream/);
	assert.match(response.body, /"type":"run_started"/);
	assert.match(response.body, /"type":"tool_started"/);
	assert.match(response.body, /"type":"text_delta"/);
	assert.match(response.body, /"type":"done"/);
	await app.close();
});

test("POST /v1/chat/queue queues a steer message for an active run", async () => {
	const calls: unknown[] = [];
	const app = buildServer({
		agentService: createAgentServiceStub({
			queueMessage: async (input) => {
				calls.push(input);
				return {
					conversationId: input.conversationId,
					mode: input.mode,
					queued: true,
				};
			},
		}),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat/queue",
		payload: {
			conversationId: "manual:queue",
			message: "插嘴",
			mode: "steer",
			userId: "u-queue",
		},
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		conversationId: "manual:queue",
		mode: "steer",
		queued: true,
	});
	assert.deepEqual(calls, [
		{
			conversationId: "manual:queue",
			message: "插嘴",
			mode: "steer",
			userId: "u-queue",
		},
	]);
	await app.close();
});

test("POST /v1/chat/interrupt interrupts an active run", async () => {
	const calls: unknown[] = [];
	const app = buildServer({
		agentService: createAgentServiceStub({
			interruptChat: async (input) => {
				calls.push(input);
				return {
					conversationId: input.conversationId,
					interrupted: true,
				};
			},
		}),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat/interrupt",
		payload: {
			conversationId: "manual:interrupt",
		},
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		conversationId: "manual:interrupt",
		interrupted: true,
	});
	assert.deepEqual(calls, [{ conversationId: "manual:interrupt" }]);
	await app.close();
});

test("POST /v1/chat/reset clears the canonical conversation state", async () => {
	const calls: unknown[] = [];
	const app = buildServer({
		agentService: createAgentServiceStub({
			resetConversation: async (input) => {
				calls.push(input);
				return {
					conversationId: input.conversationId,
					reset: true,
				};
			},
		}),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat/reset",
		payload: {
			conversationId: "agent:global",
		},
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		conversationId: "agent:global",
		reset: true,
	});
	assert.deepEqual(calls, [{ conversationId: "agent:global" }]);
	await app.close();
});

test("POST /v1/chat returns 400 when message is missing", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat",
		payload: {
			conversationId: "manual:test-3",
		},
	});

	assert.equal(response.statusCode, 400);
	assert.deepEqual(response.json(), {
		error: {
			code: "BAD_REQUEST",
			message: "Field \"message\" must be a non-empty string",
		},
	});
	await app.close();
});

test("POST /v1/chat/stream returns 400 when message is missing", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat/stream",
		payload: {
			conversationId: "manual:test-stream-400",
		},
	});

	assert.equal(response.statusCode, 400);
	assert.deepEqual(response.json(), {
		error: {
			code: "BAD_REQUEST",
			message: "Field \"message\" must be a non-empty string",
		},
	});
	await app.close();
});

test("POST /v1/chat returns 500 when agent service throws", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub({
			chat: async () => {
				throw new Error("boom");
			},
		}),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat",
		payload: {
			conversationId: "manual:test-4",
			message: "触发异常",
		},
	});

	assert.equal(response.statusCode, 500);
	assert.deepEqual(response.json(), {
		error: {
			code: "INTERNAL_ERROR",
			message: "boom",
		},
	});
	await app.close();
});
