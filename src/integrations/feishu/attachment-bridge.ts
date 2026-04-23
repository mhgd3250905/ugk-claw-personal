import type { ChatAttachment } from "../../agent/asset-store.js";
import type { FeishuAttachmentBridgeLike, FeishuClientLike, FeishuInboundMessage } from "./types.js";

export class FeishuAttachmentBridge implements FeishuAttachmentBridgeLike {
	constructor(private readonly options: { client: FeishuClientLike }) {}

	async collectAttachments(message: FeishuInboundMessage): Promise<ChatAttachment[]> {
		if (!message.resources.length) {
			return [];
		}

		return await Promise.all(
			message.resources.map(async (resource) => {
				if (!this.options.client.isConfigured()) {
					return {
						fileName: resource.fileName,
						mimeType: resource.mimeType,
					} satisfies ChatAttachment;
				}

				try {
					const downloaded = await this.options.client.downloadMessageResource({
						messageId: message.messageId,
						resourceKey: resource.resourceKey,
						type: resource.type,
						fileName: resource.fileName,
						mimeType: resource.mimeType,
					});
					return {
						fileName: downloaded.fileName,
						mimeType: downloaded.mimeType,
						base64: Buffer.from(downloaded.bytes).toString("base64"),
						sizeBytes: downloaded.bytes.byteLength,
					} satisfies ChatAttachment;
				} catch (error) {
					console.warn("[feishu] failed to download attachment, falling back to metadata only:", error);
					return {
						fileName: resource.fileName,
						mimeType: resource.mimeType,
					} satisfies ChatAttachment;
				}
			}),
		);
	}
}
