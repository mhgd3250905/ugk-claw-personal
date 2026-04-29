import type { ChatAttachment } from "../../agent/asset-store.js";

export type FeishuDeliveryTarget =
	| { type: "conversation"; conversationId: string }
	| { type: "feishu_chat"; chatId: string }
	| { type: "feishu_user"; openId: string };

export type FeishuReceiveIdType = "chat_id" | "open_id";

export type FeishuResourceType = "file" | "image";

export interface FeishuInboundResource {
	type: FeishuResourceType;
	resourceKey: string;
	fileName: string;
	mimeType: string;
}

export interface FeishuInboundMessage {
	chatId: string;
	messageId: string;
	messageType: string;
	text?: string;
	senderOpenId?: string;
	resources: FeishuInboundResource[];
}

export interface FeishuDownloadedResource {
	fileName: string;
	mimeType: string;
	bytes: Uint8Array;
}

export interface FeishuQueuedReplyPlan {
	mode: "steer" | "followUp";
	text: string;
}

export interface FeishuClientLike {
	isConfigured(): boolean;
	sendTextMessage(input: {
		receiveIdType: FeishuReceiveIdType;
		receiveId: string;
		text: string;
	}): Promise<void>;
	sendFileMessage(input: {
		receiveIdType: FeishuReceiveIdType;
		receiveId: string;
		fileName: string;
		mimeType?: string;
		bytes: Uint8Array;
	}): Promise<void>;
	downloadMessageResource(input: {
		messageId: string;
		resourceKey: string;
		type: FeishuResourceType;
		fileName?: string;
		mimeType?: string;
	}): Promise<FeishuDownloadedResource>;
}

export interface FeishuAttachmentBridgeLike {
	collectAttachments(message: FeishuInboundMessage): Promise<ChatAttachment[]>;
}
