import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getAppConfig } from "../src/config.js";
import { FeishuSettingsStore } from "../src/integrations/feishu/settings-store.js";
import {
	FeishuWebSocketSubscription,
	createFeishuEventDispatcher,
	type FeishuWsClientLike,
} from "../src/integrations/feishu/ws-subscription.js";
import { FeishuWorkerManager } from "../src/workers/feishu-worker.js";

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

test("FeishuWorkerManager stays idle when settings are disabled or missing credentials", async () => {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-feishu-worker-"));
	const manager = new FeishuWorkerManager({
		settingsStore: new FeishuSettingsStore({
			settingsPath: join(root, "settings.json"),
			env: { FEISHU_ENABLED: "false" },
		}),
		config: getAppConfig(),
		env: { FEISHU_ENABLED: "false" },
	});

	await manager.reload();
	manager.close();
});

test("FeishuWorkerManager rejects legacy webhook subscription mode on reload", async () => {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-feishu-worker-webhook-"));
	const manager = new FeishuWorkerManager({
		settingsStore: new FeishuSettingsStore({
			settingsPath: join(root, "settings.json"),
			env: {},
		}),
		config: getAppConfig(),
		env: {
			FEISHU_SUBSCRIPTION_MODE: "webhook",
		},
	});
	await assert.rejects(
		() => manager.reload(),
		/Only FEISHU_SUBSCRIPTION_MODE=ws is supported/,
	);
	manager.close();
});
