import type { ChatAttachment } from "../../agent/asset-store.js";
import type { AgentService } from "../../agent/agent-service.js";
import type { ConnDeliveryLike } from "../../agent/conn-runner.js";
import { FeishuConversationMapStore } from "./conversation-map-store.js";
import { FeishuClient } from "./client.js";

interface FeishuServiceOptions {
	agentService: AgentService;
	conversationMapStore: FeishuConversationMapStore;
	client: FeishuClient;
	publicBaseUrl?: string;
}

export class FeishuService implements ConnDeliveryLike {
	constructor(private readonly options: FeishuServiceOptions) {}

	async handleWebhook(body: unknown): Promise<{ challenge?: string; accepted: boolean }> {
		const payload = body as Record<string, unknown> | undefined;
		if (payload?.type === "url_verification" && typeof payload.challenge === "string") {
			return {
				challenge: payload.challenge,
				accepted: true,
			};
		}

		const eventType = getEventType(payload);
		if (eventType !== "im.message.receive_v1") {
			return { accepted: true };
		}

		void this.processIncomingEvent(payload).catch((error) => {
			console.error("[feishu] failed to process incoming event:", error);
		});
		return { accepted: true };
	}

	async deliverText(
		target: { type: "conversation"; conversationId: string } | { type: "feishu_chat"; chatId: string } | { type: "feishu_user"; openId: string },
		text: string,
		options?: { files?: Array<{ fileName: string; downloadUrl: string }> },
	): Promise<void> {
		if (target.type === "conversation") {
			return;
		}

		const finalText = buildReplyText(text, options?.files ?? [], this.options.publicBaseUrl);
		if (!this.options.client.isConfigured()) {
			throw new Error("Feishu client is not configured");
		}

		if (target.type === "feishu_chat") {
			await this.options.client.sendTextMessage({
				receiveIdType: "chat_id",
				receiveId: target.chatId,
				text: finalText,
			});
			return;
		}

		await this.options.client.sendTextMessage({
			receiveIdType: "open_id",
			receiveId: target.openId,
			text: finalText,
		});
	}

	private async processIncomingEvent(payload: Record<string, unknown> | undefined): Promise<void> {
		const event = resolveEvent(payload);
		const message = event?.message as Record<string, unknown> | undefined;
		if (!message || typeof message.chat_id !== "string" || typeof message.message_type !== "string") {
			return;
		}

		const incoming = parseIncomingMessage(message);
		if (!incoming.text && incoming.attachments.length === 0) {
			await this.deliverText(
				{
					type: "feishu_chat",
					chatId: message.chat_id,
				},
				"当前开发版只处理文本消息或可识别的附件元数据。",
			);
			return;
		}

		const conversationId = await this.options.conversationMapStore.getOrCreate(`chat:${message.chat_id}`, () => `feishu:chat:${message.chat_id}`);
		if (incoming.text && isInterruptIntent(incoming.text)) {
			const interrupted = await this.options.agentService.interruptChat({
				conversationId,
			});
			await this.deliverText(
				{
					type: "feishu_chat",
					chatId: message.chat_id,
				},
				interrupted.interrupted ? "已打断当前任务。" : "当前没有运行中的任务可打断。",
			);
			return;
		}

		const queueResult = await this.options.agentService.queueMessage({
			conversationId,
			message: incoming.text || "请结合我在飞书发送的附件一起处理",
			mode: "steer",
			attachments: incoming.attachments,
		});

		if (queueResult.queued) {
			await this.deliverText(
				{
					type: "feishu_chat",
					chatId: message.chat_id,
				},
				"已插入当前任务，处理完成后继续回复。",
			);
			return;
		}

		const result = await this.options.agentService.chat({
			conversationId,
			message: incoming.text || "请结合我在飞书发送的附件一起处理",
			attachments: incoming.attachments,
		});

		await this.deliverText(
			{
				type: "feishu_chat",
				chatId: message.chat_id,
			},
			result.text,
			{
				files:
					result.files?.map((file) => ({
						fileName: file.fileName,
						downloadUrl: file.downloadUrl,
					})) ?? [],
			},
		);
	}
}

function isInterruptIntent(text: string): boolean {
	const normalized = text
		.toLowerCase()
		.replace(/[\s，。、“”"'‘’！!？?、,.]/g, "")
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

function getEventType(payload: Record<string, unknown> | undefined): string | undefined {
	const header = payload?.header as Record<string, unknown> | undefined;
	if (typeof header?.event_type === "string") {
		return header.event_type;
	}
	const event = payload?.event as Record<string, unknown> | undefined;
	const eventHeader = event?.header as Record<string, unknown> | undefined;
	if (typeof eventHeader?.event_type === "string") {
		return eventHeader.event_type;
	}
	return undefined;
}

function resolveEvent(payload: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
	if (payload?.event && typeof payload.event === "object") {
		return payload.event as Record<string, unknown>;
	}
	return payload;
}

function parseIncomingMessage(message: Record<string, unknown>): { text?: string; attachments: ChatAttachment[] } {
	const contentText = typeof message.content === "string" ? message.content : "{}";
	let content: Record<string, unknown> = {};
	try {
		content = JSON.parse(contentText) as Record<string, unknown>;
	} catch {
		content = {};
	}

	if (message.message_type === "text" && typeof content.text === "string") {
		return {
			text: content.text,
			attachments: [],
		};
	}

	if (message.message_type === "file") {
		return {
			text: undefined,
			attachments: [
				{
					fileName: typeof content.file_name === "string" ? content.file_name : "feishu-file",
					mimeType: "application/octet-stream",
				},
			],
		};
	}

	if (message.message_type === "image") {
		return {
			text: undefined,
			attachments: [
				{
					fileName: typeof content.image_key === "string" ? `${content.image_key}.png` : "feishu-image.png",
					mimeType: "image/png",
				},
			],
		};
	}

	return {
		text: undefined,
		attachments: [],
	};
}

function buildReplyText(text: string, files: Array<{ fileName: string; downloadUrl: string }>, publicBaseUrl?: string): string {
	if (files.length === 0) {
		return text;
	}

	const fileLines = files.map((file) => {
		const resolvedUrl = publicBaseUrl ? new URL(file.downloadUrl, publicBaseUrl).toString() : file.downloadUrl;
		return `- ${file.fileName}: ${resolvedUrl}`;
	});

	return [text, "", "文件下载:", ...fileLines].join("\n");
}
