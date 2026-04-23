import type { FeishuClientLike, FeishuDeliveryTarget, FeishuReceiveIdType } from "./types.js";

interface FeishuDeliveryOptions {
	client: FeishuClientLike;
	publicBaseUrl?: string;
	fetchImpl?: typeof fetch;
}

export class FeishuDeliveryService {
	private readonly fetchImpl: typeof fetch;

	constructor(private readonly options: FeishuDeliveryOptions) {
		this.fetchImpl = options.fetchImpl ?? fetch;
	}

	async deliver(
		target: FeishuDeliveryTarget,
		text: string,
		options?: { files?: Array<{ fileName: string; downloadUrl: string; mimeType?: string }> },
	): Promise<void> {
		if (target.type === "conversation") {
			return;
		}

		if (!this.options.client.isConfigured()) {
			throw new Error("Feishu client is not configured");
		}

		const receiveIdType: FeishuReceiveIdType = target.type === "feishu_chat" ? "chat_id" : "open_id";
		const receiveId = target.type === "feishu_chat" ? target.chatId : target.openId;

		await this.options.client.sendTextMessage({
			receiveIdType,
			receiveId,
			text: text || "处理完成。",
		});

		const fallbackFileLines: string[] = [];
		for (const file of options?.files ?? []) {
			try {
				const resource = await this.fetchFileForDelivery(file);
				await this.options.client.sendFileMessage({
					receiveIdType,
					receiveId,
					fileName: resource.fileName,
					mimeType: resource.mimeType,
					bytes: resource.bytes,
				});
			} catch (error) {
				console.warn("[feishu] failed to deliver file, falling back to url:", error);
				const resolvedUrl = this.resolvePublicUrl(file.downloadUrl);
				fallbackFileLines.push(`- ${file.fileName}: ${resolvedUrl}`);
			}
		}

		if (fallbackFileLines.length > 0) {
			await this.options.client.sendTextMessage({
				receiveIdType,
				receiveId,
				text: ["文件下载：", ...fallbackFileLines].join("\n"),
			});
		}
	}

	async deliverText(
		target: FeishuDeliveryTarget,
		text: string,
		options?: { files?: Array<{ fileName: string; downloadUrl: string; mimeType?: string }> },
	): Promise<void> {
		await this.deliver(target, text, options);
	}

	private async fetchFileForDelivery(file: {
		fileName: string;
		downloadUrl: string;
		mimeType?: string;
	}): Promise<{ fileName: string; mimeType: string; bytes: Uint8Array }> {
		const resolvedUrl = this.resolvePublicUrl(file.downloadUrl);
		const response = await this.fetchImpl(resolvedUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch file for Feishu delivery: ${response.status}`);
		}
		return {
			fileName: file.fileName,
			mimeType: file.mimeType || response.headers.get("content-type") || "application/octet-stream",
			bytes: new Uint8Array(await response.arrayBuffer()),
		};
	}

	private resolvePublicUrl(downloadUrl: string): string {
		if (/^https?:\/\//i.test(downloadUrl)) {
			return downloadUrl;
		}
		if (!this.options.publicBaseUrl) {
			throw new Error("PUBLIC_BASE_URL is required for Feishu file delivery");
		}
		return new URL(downloadUrl, this.options.publicBaseUrl).toString();
	}
}
