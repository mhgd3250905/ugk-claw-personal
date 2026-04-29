import * as lark from "@larksuiteoapi/node-sdk";
import type { FeishuService } from "./service.js";

export interface FeishuWsClientLike {
	start(params: { eventDispatcher: lark.EventDispatcher }): Promise<void>;
	close(params?: { force?: boolean }): void;
}

export interface FeishuWebSocketSubscriptionOptions {
	wsClient: FeishuWsClientLike;
	eventDispatcher: lark.EventDispatcher;
}

export class FeishuWebSocketSubscription {
	constructor(private readonly options: FeishuWebSocketSubscriptionOptions) {}

	async start(): Promise<void> {
		await this.options.wsClient.start({
			eventDispatcher: this.options.eventDispatcher,
		});
	}

	close(): void {
		this.options.wsClient.close();
	}
}

export function createFeishuEventDispatcher(input: {
	service: Pick<FeishuService, "handleWebhook">;
	verificationToken?: string;
	encryptKey?: string;
}): lark.EventDispatcher {
	return new lark.EventDispatcher({
		verificationToken: input.verificationToken,
		encryptKey: input.encryptKey,
		loggerLevel: lark.LoggerLevel.info,
	}).register({
		"im.message.receive_v1": async (event: unknown) => {
			await input.service.handleWebhook({
				header: {
					event_type: "im.message.receive_v1",
				},
				event,
			});
		},
	});
}

export function createFeishuWsClient(input: {
	appId: string;
	appSecret: string;
	onReady?: () => void;
	onError?: (error: Error) => void;
	onReconnecting?: () => void;
	onReconnected?: () => void;
}): FeishuWsClientLike {
	return new lark.WSClient({
		appId: input.appId,
		appSecret: input.appSecret,
		loggerLevel: lark.LoggerLevel.info,
		source: "ugk-pi-feishu-worker",
		onReady: input.onReady,
		onError: input.onError,
		onReconnecting: input.onReconnecting,
		onReconnected: input.onReconnected,
	});
}
