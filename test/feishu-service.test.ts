import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FeishuConversationMapStore } from "../src/integrations/feishu/conversation-map-store.js";
import { FeishuDeliveryService } from "../src/integrations/feishu/delivery.js";
import { FeishuService } from "../src/integrations/feishu/service.js";
import type { FeishuClientLike, FeishuDeliveryTarget } from "../src/integrations/feishu/types.js";

async function createConversationMapStore(): Promise<FeishuConversationMapStore> {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-feishu-"));
	await mkdir(join(root, ".data", "agent", "feishu"), { recursive: true });
	return new FeishuConversationMapStore({
		indexPath: join(root, ".data", "agent", "feishu", "conversation-map.json"),
	});
}

async function waitForAsyncWebhookSideEffects(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 20));
}

test("FeishuService queues incoming text onto the active run with steer mode", async () => {
	const queueCalls: Array<Record<string, unknown>> = [];
	const deliveries: Array<{ target: FeishuDeliveryTarget; text: string }> = [];
	const mapStore = await createConversationMapStore();

	const service = new FeishuService({
		agentService: {
			async getRunStatus(conversationId) {
				return {
					conversationId,
					running: true,
					contextUsage: {
						provider: "dashscope-coding",
						model: "glm-5",
						currentTokens: 0,
						contextWindow: 128000,
						reserveTokens: 16384,
						maxResponseTokens: 16384,
						availableTokens: 111616,
						percent: 0,
						status: "safe",
						mode: "estimate",
					},
				};
			},
			async queueMessage(input) {
				queueCalls.push(input as Record<string, unknown>);
				return { conversationId: input.conversationId, mode: input.mode, queued: true };
			},
			async chat() {
				throw new Error("chat should not run while the conversation is active");
			},
		},
		conversationMapStore: mapStore,
		client: {
			isConfigured() {
				return true;
			},
			async sendTextMessage() {},
			async sendFileMessage() {},
			async downloadMessageResource() {
				throw new Error("download should not run for pure text");
			},
		},
		deliveryService: {
			async deliverText(target, text) {
				deliveries.push({ target, text });
			},
		},
	});

	const response = await service.handleWebhook({
		header: { event_type: "im.message.receive_v1" },
		event: {
			message: {
				chat_id: "chat-1",
				message_id: "msg-1",
				message_type: "text",
				content: JSON.stringify({ text: "继续做这个任务" }),
			},
		},
	});
	assert.equal(response.accepted, true);
	await waitForAsyncWebhookSideEffects();

	assert.equal(queueCalls.length, 1);
	assert.equal(queueCalls[0]?.mode, "steer");
	assert.equal(queueCalls[0]?.message, "继续做这个任务");
	assert.equal(deliveries.length, 1);
	assert.equal(deliveries[0]?.text, "已收到你的补充消息，我会把它接到当前处理流程里。");
});

test("FeishuService downloads incoming file resources and passes them to the agent", async () => {
	const chatCalls: Array<Record<string, unknown>> = [];
	const deliveries: Array<{ target: FeishuDeliveryTarget; text: string; files?: Array<{ fileName: string; downloadUrl: string; mimeType?: string }> }> = [];
	const mapStore = await createConversationMapStore();

	const service = new FeishuService({
		agentService: {
			async getRunStatus(conversationId) {
				return {
					conversationId,
					running: false,
					contextUsage: {
						provider: "dashscope-coding",
						model: "glm-5",
						currentTokens: 0,
						contextWindow: 128000,
						reserveTokens: 16384,
						maxResponseTokens: 16384,
						availableTokens: 111616,
						percent: 0,
						status: "safe",
						mode: "estimate",
					},
				};
			},
			async queueMessage(input) {
				return { conversationId: input.conversationId, mode: input.mode, queued: false };
			},
			async chat(input) {
				chatCalls.push(input as Record<string, unknown>);
				return {
					conversationId: input.conversationId,
					text: "文件处理完成",
					files: [
						{
							id: "file-1",
							assetId: "asset-file-1",
							reference: "result.txt",
							fileName: "result.txt",
							downloadUrl: "/v1/files/file-1",
							mimeType: "text/plain",
							sizeBytes: 16,
						},
					],
				};
			},
		},
		conversationMapStore: mapStore,
		client: {
			isConfigured() {
				return true;
			},
			async sendTextMessage() {},
			async sendFileMessage() {},
			async downloadMessageResource() {
				return {
					fileName: "source.txt",
					mimeType: "text/plain",
					bytes: new TextEncoder().encode("hello from feishu"),
				};
			},
		},
		deliveryService: {
			async deliverText(target, text, options) {
				deliveries.push({ target, text, files: options?.files });
			},
		},
	});

	await service.handleWebhook({
		header: { event_type: "im.message.receive_v1" },
		event: {
			message: {
				chat_id: "chat-2",
				message_id: "msg-file-1",
				message_type: "file",
				content: JSON.stringify({
					file_key: "file-key-1",
					file_name: "source.txt",
				}),
			},
		},
	});
	await waitForAsyncWebhookSideEffects();

	assert.equal(chatCalls.length, 1);
	assert.equal(chatCalls[0]?.message, "请结合我通过飞书发送的附件一起处理。");
	const attachments = chatCalls[0]?.attachments as Array<{ fileName: string; mimeType: string; base64?: string }>;
	assert.equal(attachments.length, 1);
	assert.equal(attachments[0]?.fileName, "source.txt");
	assert.equal(Buffer.from(String(attachments[0]?.base64), "base64").toString("utf8"), "hello from feishu");
	assert.equal(deliveries.length, 1);
	assert.equal(deliveries[0]?.text, "文件处理完成");
	assert.deepEqual(deliveries[0]?.files, [
		{
			fileName: "result.txt",
			downloadUrl: "/v1/files/file-1",
			mimeType: "text/plain",
		},
	]);
});

test("FeishuDeliveryService sends text first and uploads result files back to Feishu", async () => {
	const sentTexts: string[] = [];
	const sentFiles: Array<{ fileName: string; mimeType?: string; bytes: Uint8Array }> = [];
	const client: FeishuClientLike = {
		isConfigured() {
			return true;
		},
		async sendTextMessage(input) {
			sentTexts.push(input.text);
		},
		async sendFileMessage(input) {
			sentFiles.push({
				fileName: input.fileName,
				mimeType: input.mimeType,
				bytes: input.bytes,
			});
		},
		async downloadMessageResource() {
			throw new Error("not used");
		},
	};

	const delivery = new FeishuDeliveryService({
		client,
		publicBaseUrl: "http://127.0.0.1:3000",
		fetchImpl: async () =>
			new Response(new TextEncoder().encode("downloaded result"), {
				status: 200,
				headers: {
					"content-type": "text/plain",
				},
			}),
	});

	await delivery.deliver(
		{
			type: "feishu_chat",
			chatId: "chat-3",
		},
		"处理完成",
		{
			files: [
				{
					fileName: "result.txt",
					downloadUrl: "/v1/files/file-2",
					mimeType: "text/plain",
				},
			],
		},
	);

	assert.deepEqual(sentTexts, ["处理完成"]);
	assert.equal(sentFiles.length, 1);
	assert.equal(sentFiles[0]?.fileName, "result.txt");
	assert.equal(Buffer.from(sentFiles[0]?.bytes ?? new Uint8Array()).toString("utf8"), "downloaded result");
});
