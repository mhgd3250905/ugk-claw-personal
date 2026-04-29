import type { FeishuInboundMessage, FeishuInboundResource } from "./types.js";

export function getFeishuEventType(payload: Record<string, unknown> | undefined): string | undefined {
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

export function resolveFeishuEvent(payload: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
	if (payload?.event && typeof payload.event === "object") {
		return payload.event as Record<string, unknown>;
	}
	return payload;
}

export function parseFeishuInboundMessage(payload: Record<string, unknown> | undefined): FeishuInboundMessage | undefined {
	const event = resolveFeishuEvent(payload);
	const message = event?.message as Record<string, unknown> | undefined;
	if (!message || typeof message.chat_id !== "string" || typeof message.message_id !== "string") {
		return undefined;
	}

	const contentText = typeof message.content === "string" ? message.content : "{}";
	let content: Record<string, unknown> = {};
	try {
		content = JSON.parse(contentText) as Record<string, unknown>;
	} catch {
		content = {};
	}

	const messageType = typeof message.message_type === "string" ? message.message_type : "unknown";
	const sender = event?.sender as Record<string, unknown> | undefined;
	const senderId = sender?.sender_id as Record<string, unknown> | undefined;
	return {
		chatId: message.chat_id,
		messageId: message.message_id,
		messageType,
		...(typeof senderId?.open_id === "string" ? { senderOpenId: senderId.open_id } : {}),
		...(messageType === "text" && typeof content.text === "string" ? { text: content.text } : {}),
		resources: parseFeishuResources(messageType, content),
	};
}

function parseFeishuResources(messageType: string, content: Record<string, unknown>): FeishuInboundResource[] {
	if (messageType === "file" && typeof content.file_key === "string") {
		return [
			{
				type: "file",
				resourceKey: content.file_key,
				fileName: typeof content.file_name === "string" ? content.file_name : "feishu-file",
				mimeType: "application/octet-stream",
			},
		];
	}

	if (messageType === "image" && typeof content.image_key === "string") {
		return [
			{
				type: "image",
				resourceKey: content.image_key,
				fileName: typeof content.image_key === "string" ? `${content.image_key}.png` : "feishu-image.png",
				mimeType: "image/png",
			},
		];
	}

	return [];
}
