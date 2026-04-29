import test from "node:test";
import assert from "node:assert/strict";
import {
	FeishuWebSocketSubscription,
	createFeishuEventDispatcher,
	type FeishuWsClientLike,
} from "../src/integrations/feishu/ws-subscription.js";
import { createFeishuWorkerFromEnv } from "../src/workers/feishu-worker.js";

test("FeishuWebSocketSubscription starts the SDK client with the event dispatcher", async () => {
	const calls: unknown[] = [];
	const wsClient: FeishuWsClientLike = {
		async start(params) {
			calls.push(params.eventDispatcher);
		},
		close() {
			calls.push("closed");
		},
	};
	const dispatcher = {} as never;
	const subscription = new FeishuWebSocketSubscription({ wsClient, eventDispatcher: dispatcher });

	await subscription.start();
	subscription.close();

	assert.deepEqual(calls, [dispatcher, "closed"]);
});

test("createFeishuEventDispatcher registers im.message.receive_v1 and hands it to FeishuService asynchronously", async () => {
	const payloads: unknown[] = [];
	const dispatcher = createFeishuEventDispatcher({
		verificationToken: "token",
		encryptKey: "encrypt",
		service: {
			async handleWebhook(payload) {
				payloads.push(payload);
				return { accepted: true };
			},
		},
	});

	const handler = dispatcher.handles.get("im.message.receive_v1");
	assert.equal(typeof handler, "function");
	await handler?.({
		message: {
			chat_id: "chat-1",
			message_id: "msg-1",
			message_type: "text",
			content: JSON.stringify({ text: "hello" }),
		},
	});

	assert.deepEqual(payloads, [
		{
			header: { event_type: "im.message.receive_v1" },
			event: {
				message: {
					chat_id: "chat-1",
					message_id: "msg-1",
					message_type: "text",
					content: JSON.stringify({ text: "hello" }),
				},
			},
		},
	]);
});

test("createFeishuWorkerFromEnv stays disabled unless FEISHU_ENABLED is true", () => {
	assert.equal(createFeishuWorkerFromEnv({ FEISHU_ENABLED: "false" }), undefined);
});

test("createFeishuWorkerFromEnv rejects legacy webhook subscription mode", () => {
	assert.throws(
		() =>
			createFeishuWorkerFromEnv({
				FEISHU_ENABLED: "true",
				FEISHU_SUBSCRIPTION_MODE: "webhook",
				FEISHU_APP_ID: "app-id",
				FEISHU_APP_SECRET: "secret",
			}),
		/Only FEISHU_SUBSCRIPTION_MODE=ws is supported/,
	);
});
