import type { ChatAttachment } from "../../agent/asset-store.js";
import type { AgentService } from "../../agent/agent-service.js";
import { FeishuAttachmentBridge } from "./attachment-bridge.js";
import { FeishuClient } from "./client.js";
import { FeishuDeliveryService } from "./delivery.js";
import { getFeishuEventType, parseFeishuInboundMessage } from "./message-parser.js";
import { planFeishuQueuedReply } from "./queue-policy.js";
import { FeishuConversationMapStore } from "./conversation-map-store.js";
import type { FeishuAttachmentBridgeLike, FeishuClientLike, FeishuDeliveryTarget } from "./types.js";

export interface TextDeliveryLike {
	deliverText(
		target: FeishuDeliveryTarget,
		text: string,
		options?: { files?: Array<{ fileName: string; downloadUrl: string; mimeType?: string }> },
	): Promise<void>;
}

interface FeishuAgentGateway {
	chat(input: { conversationId: string; message: string; attachments?: ChatAttachment[] }): ReturnType<AgentService["chat"]>;
	queueMessage(input: {
		conversationId: string;
		message: string;
		mode: "steer" | "followUp";
		attachments?: ChatAttachment[];
	}): ReturnType<AgentService["queueMessage"]>;
	getRunStatus(conversationId: string): ReturnType<AgentService["getRunStatus"]>;
}

interface FeishuServiceOptions {
	agentService: FeishuAgentGateway;
	conversationMapStore: FeishuConversationMapStore;
	client: FeishuClientLike;
	publicBaseUrl?: string;
	attachmentBridge?: FeishuAttachmentBridgeLike;
	deliveryService?: TextDeliveryLike;
}

export class FeishuService implements TextDeliveryLike {
	private readonly attachmentBridge: FeishuAttachmentBridgeLike;
	private readonly deliveryService: TextDeliveryLike;

	constructor(private readonly options: FeishuServiceOptions) {
		this.attachmentBridge =
			options.attachmentBridge ??
			new FeishuAttachmentBridge({
				client: options.client,
			});
		this.deliveryService =
			options.deliveryService ??
			new FeishuDeliveryService({
				client: options.client,
				publicBaseUrl: options.publicBaseUrl,
			});
	}

	async handleWebhook(body: unknown): Promise<{ challenge?: string; accepted: boolean }> {
		const payload = body as Record<string, unknown> | undefined;
		if (payload?.type === "url_verification" && typeof payload.challenge === "string") {
			return {
				challenge: payload.challenge,
				accepted: true,
			};
		}

		const eventType = getFeishuEventType(payload);
		if (eventType !== "im.message.receive_v1") {
			return { accepted: true };
		}

		void this.processIncomingEvent(payload).catch((error) => {
			console.error("[feishu] failed to process incoming event:", error);
		});
		return { accepted: true };
	}

	async deliverText(
		target: FeishuDeliveryTarget,
		text: string,
		options?: { files?: Array<{ fileName: string; downloadUrl: string; mimeType?: string }> },
	): Promise<void> {
		await this.deliveryService.deliverText(target, text, options);
	}

	private async processIncomingEvent(payload: Record<string, unknown> | undefined): Promise<void> {
		const incoming = parseFeishuInboundMessage(payload);
		if (!incoming) {
			return;
		}

		const attachments = await this.attachmentBridge.collectAttachments(incoming);
		if (!incoming.text && attachments.length === 0) {
			await this.deliverText(
				{
					type: "feishu_chat",
					chatId: incoming.chatId,
				},
				"当前消息类型还不能直接处理，请发送文本，或发送机器人可读取的文件。",
			);
			return;
		}

		const conversationId = await this.options.conversationMapStore.getOrCreate(
			`chat:${incoming.chatId}`,
			() => `feishu:chat:${incoming.chatId}`,
		);
		const outboundMessage = incoming.text || "请结合我通过飞书发送的附件一起处理。";
		const status = await this.options.agentService.getRunStatus(conversationId);
		if (status.running) {
			const plan = planFeishuQueuedReply({
				text: incoming.text,
				attachments,
			});
			const queued = await this.options.agentService.queueMessage({
				conversationId,
				message: outboundMessage,
				mode: plan.mode,
				attachments,
			});
			if (queued.queued) {
				await this.deliverText(
					{
						type: "feishu_chat",
						chatId: incoming.chatId,
					},
					plan.text,
				);
				return;
			}
		}

		const result = await this.options.agentService.chat({
			conversationId,
			message: outboundMessage,
			attachments,
		});

		await this.deliverText(
			{
				type: "feishu_chat",
				chatId: incoming.chatId,
			},
			result.text,
			{
				files:
					result.files?.map((file) => ({
						fileName: file.fileName,
						downloadUrl: file.downloadUrl,
						...(file.mimeType ? { mimeType: file.mimeType } : {}),
					})) ?? [],
			},
		);
	}
}

export function createFeishuService(input: {
	agentService: AgentService;
	conversationMapStore: FeishuConversationMapStore;
	client: FeishuClient;
	publicBaseUrl?: string;
}): FeishuService {
	return new FeishuService({
		agentService: input.agentService,
		conversationMapStore: input.conversationMapStore,
		client: input.client,
		publicBaseUrl: input.publicBaseUrl,
	});
}
