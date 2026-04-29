import { pathToFileURL } from "node:url";
import { getAppConfig } from "../config.js";
import { FeishuClient } from "../integrations/feishu/client.js";
import { FeishuConversationMapStore } from "../integrations/feishu/conversation-map-store.js";
import { FeishuHttpAgentGateway } from "../integrations/feishu/http-agent-gateway.js";
import { FeishuService } from "../integrations/feishu/service.js";
import { FeishuSettingsStore, type FeishuRuntimeSettings } from "../integrations/feishu/settings-store.js";
import {
	FeishuWebSocketSubscription,
	createFeishuEventDispatcher,
	createFeishuWsClient,
} from "../integrations/feishu/ws-subscription.js";

type FeishuWorkerSubscription = Pick<FeishuWebSocketSubscription, "start" | "close">;

export class FeishuWorkerManager {
	private active: FeishuWorkerSubscription | undefined;
	private activeSignature = "";
	private pollTimer: ReturnType<typeof setInterval> | undefined;
	private closed = false;

	constructor(private readonly options: {
		settingsStore: FeishuSettingsStore;
		config: ReturnType<typeof getAppConfig>;
		env?: NodeJS.ProcessEnv;
		pollIntervalMs?: number;
		createSubscription?: (input: {
			settings: FeishuRuntimeSettings;
			config: ReturnType<typeof getAppConfig>;
			env: NodeJS.ProcessEnv;
		}) => FeishuWorkerSubscription;
	}) {}

	async start(): Promise<void> {
		await this.reload();
		this.pollTimer = setInterval(() => {
			void this.reload().catch((error) => {
				console.error("[feishu-worker] reload failed:", error);
			});
		}, Math.max(1_000, this.options.pollIntervalMs ?? 3_000));
	}

	close(): void {
		this.closed = true;
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
		}
		this.active?.close();
		this.active = undefined;
	}

	async reload(): Promise<void> {
		if (this.closed) {
			return;
		}
		const env = this.options.env ?? process.env;
		const mode = env.FEISHU_SUBSCRIPTION_MODE?.trim() || "ws";
		if (mode !== "ws") {
			throw new Error("Only FEISHU_SUBSCRIPTION_MODE=ws is supported; HTTP webhook is not registered by ugk-pi");
		}
		const settings = await this.options.settingsStore.getRuntimeSettings();
		const signature = buildWorkerSignature(settings);
		if (signature === this.activeSignature) {
			return;
		}
		this.active?.close();
		this.active = undefined;

		if (!settings.enabled) {
			this.activeSignature = signature;
			console.log("[feishu-worker] disabled by settings");
			return;
		}
		if (!settings.appId || !settings.appSecret) {
			this.activeSignature = signature;
			console.warn("[feishu-worker] enabled but appId/appSecret is not configured");
			return;
		}

		const next = (this.options.createSubscription ?? createFeishuWorkerSubscription)({
			settings,
			config: this.options.config,
			env,
		});
		try {
			await next.start();
		} catch (error) {
			next.close();
			throw error;
		}
		this.active = next;
		this.activeSignature = signature;
		console.log("[feishu-worker] started");
	}
}

export function createFeishuWorkerFromEnv(env: NodeJS.ProcessEnv = process.env): FeishuWorkerManager | undefined {
	const config = getAppConfig();
	const settingsStore = new FeishuSettingsStore({
		settingsPath: config.feishuSettingsPath,
		env,
	});
	return new FeishuWorkerManager({
		settingsStore,
		config,
		env,
	});
}

function createFeishuWorkerSubscription(input: {
	settings: FeishuRuntimeSettings;
	config: ReturnType<typeof getAppConfig>;
	env: NodeJS.ProcessEnv;
}): FeishuWebSocketSubscription {
	const client = new FeishuClient({
		appId: input.settings.appId,
		appSecret: input.settings.appSecret,
		apiBase: input.settings.apiBase,
	});
	const service = new FeishuService({
		agentService: new FeishuHttpAgentGateway({
			baseUrl: input.env.FEISHU_AGENT_BASE_URL?.trim() || `http://127.0.0.1:${input.config.port}`,
		}),
		conversationMapStore: new FeishuConversationMapStore({
			indexPath: input.config.feishuConversationMapPath,
		}),
		client,
		publicBaseUrl: input.config.publicBaseUrl,
		allowedChatIds: input.settings.allowedChatIds,
	});
	return new FeishuWebSocketSubscription({
		wsClient: createFeishuWsClient({
			appId: input.settings.appId!,
			appSecret: input.settings.appSecret!,
			onReady: () => {
				console.log("[feishu-worker] websocket ready");
			},
			onError: (error) => {
				console.error("[feishu-worker] websocket error:", error);
			},
			onReconnecting: () => {
				console.warn("[feishu-worker] websocket reconnecting");
			},
			onReconnected: () => {
				console.log("[feishu-worker] websocket reconnected");
			},
		}),
		eventDispatcher: createFeishuEventDispatcher({
			service,
			verificationToken: input.env.FEISHU_VERIFICATION_TOKEN,
			encryptKey: input.env.FEISHU_ENCRYPT_KEY,
		}),
	});
}

function buildWorkerSignature(settings: FeishuRuntimeSettings): string {
	return JSON.stringify({
		enabled: settings.enabled,
		appId: settings.appId,
		appSecret: settings.appSecret,
		apiBase: settings.apiBase,
		allowedChatIds: settings.allowedChatIds,
	});
}

async function waitUntilShutdown(): Promise<void> {
	await new Promise<void>((resolve) => {
		process.once("SIGINT", resolve);
		process.once("SIGTERM", resolve);
	});
}

async function main(): Promise<void> {
	const worker = createFeishuWorkerFromEnv();
	if (!worker) {
		console.log("[feishu-worker] disabled");
		await waitUntilShutdown();
		return;
	}

	await worker.start();
	await waitUntilShutdown();
	worker.close();
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entrypoint && import.meta.url === entrypoint) {
	await main();
}
