import type { ChatAttachment } from "../../agent/asset-store.js";
import type { AgentService } from "../../agent/agent-service.js";
import type { ChatActiveRunBody } from "../../types/api.js";
import { FeishuAttachmentBridge } from "./attachment-bridge.js";
import { FeishuClient } from "./client.js";
import {
	FeishuConversationResolver,
	type FeishuConversationMode,
} from "./conversation-resolver.js";
import { FeishuDeliveryService } from "./delivery.js";
import { getFeishuEventType, parseFeishuInboundMessage } from "./message-parser.js";
import {
	InMemoryFeishuMessageDeduper,
	type FeishuMessageDeduperLike,
} from "./message-deduper.js";
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

export interface FeishuAgentGateway {
	getCurrentConversationId?(): Promise<string>;
	createConversation?(): ReturnType<AgentService["createConversation"]>;
	getConversationState?: AgentService["getConversationState"];
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
	conversationMode?: FeishuConversationMode;
	allowedChatIds?: string[];
	progressUpdates?: {
		enabled?: boolean;
		intervalMs?: number;
		maxUpdates?: number;
	};
	attachmentBridge?: FeishuAttachmentBridgeLike;
	deliveryService?: TextDeliveryLike;
	messageDeduper?: FeishuMessageDeduperLike;
}

export class FeishuService implements TextDeliveryLike {
	private readonly attachmentBridge: FeishuAttachmentBridgeLike;
	private readonly deliveryService: TextDeliveryLike;
	private readonly conversationResolver: FeishuConversationResolver;
	private readonly messageDeduper: FeishuMessageDeduperLike;

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
		this.conversationResolver = new FeishuConversationResolver({
			mode: options.conversationMode,
			conversationMapStore: options.conversationMapStore,
			currentConversationProvider: options.agentService,
		});
		this.messageDeduper = options.messageDeduper ?? new InMemoryFeishuMessageDeduper();
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
		if (this.options.allowedChatIds?.length && !this.options.allowedChatIds.includes(incoming.chatId)) {
			return;
		}
		if (!(await this.messageDeduper.accept(incoming.messageId))) {
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

		const conversationId = await this.conversationResolver.resolve(incoming);
		if (incoming.text?.trim() === "/status") {
			await this.handleStatusCommand(incoming.chatId, conversationId);
			return;
		}
		if (incoming.text?.trim() === "/new") {
			await this.handleNewConversationCommand(incoming.chatId);
			return;
		}
		if (incoming.text?.trim() === "/whoami") {
			await this.handleWhoamiCommand(incoming.chatId, incoming.senderOpenId);
			return;
		}
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

		const result = await this.runChatWithProgress({
			target: {
				type: "feishu_chat",
				chatId: incoming.chatId,
			},
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

	private async runChatWithProgress(input: {
		target: FeishuDeliveryTarget;
		conversationId: string;
		message: string;
		attachments?: ChatAttachment[];
	}): ReturnType<FeishuAgentGateway["chat"]> {
		const progressOptions = this.options.progressUpdates ?? {};
		if (progressOptions.enabled === false || !this.options.agentService.getConversationState) {
			return await this.options.agentService.chat({
				conversationId: input.conversationId,
				message: input.message,
				attachments: input.attachments,
			});
		}

		await this.deliverText(input.target, "收到，正在处理...");
		const progress = this.startProgressUpdates({
			target: input.target,
			conversationId: input.conversationId,
			intervalMs: progressOptions.intervalMs ?? 4_000,
			maxUpdates: progressOptions.maxUpdates ?? 8,
		});
		try {
			return await this.options.agentService.chat({
				conversationId: input.conversationId,
				message: input.message,
				attachments: input.attachments,
			});
		} finally {
			progress.stop();
		}
	}

	private startProgressUpdates(input: {
		target: FeishuDeliveryTarget;
		conversationId: string;
		intervalMs: number;
		maxUpdates: number;
	}): { stop(): void } {
		let stopped = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let lastText = "";
		let sent = 0;
		const intervalMs = Math.max(1, input.intervalMs);
		const maxUpdates = Math.max(0, input.maxUpdates);

		const tick = async (): Promise<void> => {
			if (stopped || sent >= maxUpdates) {
				return;
			}
			try {
				const state = await this.options.agentService.getConversationState?.(input.conversationId, { viewLimit: 4 });
				const text = formatFeishuProgressText(state?.activeRun);
				if (text && text !== lastText) {
					lastText = text;
					sent += 1;
					await this.deliverText(input.target, text);
				}
			} catch (error) {
				console.warn("[feishu] progress update failed:", error);
			}
			if (!stopped && sent < maxUpdates) {
				timer = setTimeout(() => {
					void tick();
				}, intervalMs);
			}
		};

		timer = setTimeout(() => {
			void tick();
		}, intervalMs);

		return {
			stop() {
				stopped = true;
				if (timer) {
					clearTimeout(timer);
				}
			},
		};
	}

	private async handleStatusCommand(chatId: string, conversationId: string): Promise<void> {
		const state = await this.options.agentService.getConversationState?.(conversationId, { viewLimit: 8 });
		const status = state ?? await this.options.agentService.getRunStatus(conversationId);
		const lines = [
			`当前 Web 会话：${conversationId}`,
			`状态：${status.running ? "正在运行" : "空闲"}`,
		];
		if ("contextUsage" in status) {
			lines.push(`上下文：${status.contextUsage.percent}% (${status.contextUsage.status})`);
		}
		if (state?.activeRun) {
			lines.push(`当前输入：${truncateStatusText(state.activeRun.input.message)}`);
			const currentText = state.activeRun.text || state.activeRun.process?.currentAction || "";
			if (currentText) {
				lines.push(`当前输出：${truncateStatusText(currentText)}`);
			}
		} else if (state?.viewMessages?.length) {
			const latest = state.viewMessages[state.viewMessages.length - 1];
			lines.push(`最近消息：${latest.kind} - ${truncateStatusText(latest.text)}`);
		}

		await this.deliverText(
			{
				type: "feishu_chat",
				chatId,
			},
			lines.join("\n"),
		);
	}

	private async handleNewConversationCommand(chatId: string): Promise<void> {
		if (!this.options.agentService.createConversation) {
			await this.deliverText(
				{
					type: "feishu_chat",
					chatId,
				},
				"当前运行环境不支持从飞书新建 Web 会话。",
			);
			return;
		}

		const result = await this.options.agentService.createConversation();
		if (!result.created) {
			await this.deliverText(
				{
					type: "feishu_chat",
					chatId,
				},
				result.reason === "running"
					? "当前 Web 会话正在运行，暂时不能新建会话。发送 /status 可以查看当前任务。"
					: "新建 Web 会话失败。",
			);
			return;
		}

		await this.deliverText(
			{
				type: "feishu_chat",
				chatId,
			},
			`已新建并切换 Web 当前会话：${result.currentConversationId}`,
		);
	}

	private async handleWhoamiCommand(chatId: string, senderOpenId: string | undefined): Promise<void> {
		await this.deliverText(
			{
				type: "feishu_chat",
				chatId,
			},
			[
				`chat_id：${chatId}`,
				`open_id：${senderOpenId ?? "当前事件没有返回 open_id"}`,
				"",
				"后台任务通知发到这个私聊：把 chat_id 填到 FEISHU_ACTIVITY_CHAT_IDS，或把 open_id 填到 FEISHU_ACTIVITY_OPEN_IDS。",
			].join("\n"),
		);
	}
}

function truncateStatusText(text: string, maxLength: number = 180): string {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}
	return `${normalized.slice(0, maxLength - 1)}…`;
}

function formatFeishuProgressText(activeRun: ChatActiveRunBody | null | undefined): string {
	if (!activeRun || activeRun.status !== "running") {
		return "";
	}
	const currentText = activeRun.process?.currentAction || activeRun.text;
	const summary = truncateStatusText(currentText, 120);
	return summary ? `正在处理：${summary}` : "";
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
