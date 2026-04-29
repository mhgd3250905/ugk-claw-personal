import { pathToFileURL } from "node:url";
import { getAppConfig } from "../config.js";
import { FeishuClient } from "../integrations/feishu/client.js";
import { FeishuConversationMapStore } from "../integrations/feishu/conversation-map-store.js";
import { FeishuHttpAgentGateway } from "../integrations/feishu/http-agent-gateway.js";
import { FeishuService } from "../integrations/feishu/service.js";
import {
	FeishuWebSocketSubscription,
	createFeishuEventDispatcher,
	createFeishuWsClient,
} from "../integrations/feishu/ws-subscription.js";

export function parseCommaSeparatedEnv(value: string | undefined): string[] | undefined {
	const values = value
		?.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
	return values?.length ? values : undefined;
}

export function createFeishuWorkerFromEnv(env: NodeJS.ProcessEnv = process.env): FeishuWebSocketSubscription | undefined {
	if (env.FEISHU_ENABLED !== "true") {
		return undefined;
	}
	const subscriptionMode = env.FEISHU_SUBSCRIPTION_MODE?.trim() || "ws";
	if (subscriptionMode !== "ws") {
		throw new Error("Only FEISHU_SUBSCRIPTION_MODE=ws is supported; HTTP webhook is not registered by ugk-pi");
	}
	const appId = env.FEISHU_APP_ID?.trim();
	const appSecret = env.FEISHU_APP_SECRET?.trim();
	if (!appId || !appSecret) {
		throw new Error("FEISHU_APP_ID and FEISHU_APP_SECRET are required when FEISHU_ENABLED=true");
	}

	const config = getAppConfig();
	const client = new FeishuClient({
		appId,
		appSecret,
		apiBase: env.FEISHU_API_BASE,
	});
	const service = new FeishuService({
		agentService: new FeishuHttpAgentGateway({
			baseUrl: env.FEISHU_AGENT_BASE_URL?.trim() || `http://127.0.0.1:${config.port}`,
		}),
		conversationMapStore: new FeishuConversationMapStore({
			indexPath: config.feishuConversationMapPath,
		}),
		client,
		publicBaseUrl: config.publicBaseUrl,
		allowedChatIds: parseCommaSeparatedEnv(env.FEISHU_ALLOWED_CHAT_IDS),
	});
	return new FeishuWebSocketSubscription({
		wsClient: createFeishuWsClient({
			appId,
			appSecret,
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
			verificationToken: env.FEISHU_VERIFICATION_TOKEN,
			encryptKey: env.FEISHU_ENCRYPT_KEY,
		}),
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
		console.log("[feishu-worker] disabled because FEISHU_ENABLED is not true");
		await waitUntilShutdown();
		return;
	}

	await worker.start();
	console.log("[feishu-worker] started");
	await waitUntilShutdown();
	worker.close();
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entrypoint && import.meta.url === entrypoint) {
	await main();
}
