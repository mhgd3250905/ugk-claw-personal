import type { FeishuClientLike, FeishuDownloadedResource, FeishuReceiveIdType, FeishuResourceType } from "./types.js";

export interface FeishuClientOptions {
	appId?: string;
	appSecret?: string;
	apiBase?: string;
}

export class FeishuClient implements FeishuClientLike {
	private accessToken?: { value: string; expiresAt: number };

	constructor(private readonly options: FeishuClientOptions) {}

	isConfigured(): boolean {
		return Boolean(this.options.appId && this.options.appSecret);
	}

	async sendTextMessage(input: {
		receiveIdType: FeishuReceiveIdType;
		receiveId: string;
		text: string;
	}): Promise<void> {
		await this.sendMessage({
			receiveIdType: input.receiveIdType,
			receiveId: input.receiveId,
			msgType: "text",
			content: {
				text: input.text,
			},
		});
	}

	async sendFileMessage(input: {
		receiveIdType: FeishuReceiveIdType;
		receiveId: string;
		fileName: string;
		mimeType?: string;
		bytes: Uint8Array;
	}): Promise<void> {
		const fileKey = await this.uploadFile(input);
		await this.sendMessage({
			receiveIdType: input.receiveIdType,
			receiveId: input.receiveId,
			msgType: "file",
			content: {
				file_key: fileKey,
			},
		});
	}

	async downloadMessageResource(input: {
		messageId: string;
		resourceKey: string;
		type: FeishuResourceType;
		fileName?: string;
		mimeType?: string;
	}): Promise<FeishuDownloadedResource> {
		const token = await this.getTenantAccessToken();
		const response = await fetch(
			`${this.getApiBase()}/im/v1/messages/${encodeURIComponent(input.messageId)}/resources/${encodeURIComponent(input.resourceKey)}?type=${encodeURIComponent(input.type)}`,
			{
				method: "GET",
				headers: {
					authorization: `Bearer ${token}`,
				},
			},
		);

		if (!response.ok) {
			throw new Error(`Feishu resource download failed with status ${response.status}`);
		}

		return {
			fileName: input.fileName || parseFileNameFromDisposition(response.headers.get("content-disposition")) || `${input.resourceKey}.bin`,
			mimeType: input.mimeType || response.headers.get("content-type") || "application/octet-stream",
			bytes: new Uint8Array(await response.arrayBuffer()),
		};
	}

	private async sendMessage(input: {
		receiveIdType: FeishuReceiveIdType;
		receiveId: string;
		msgType: "text" | "file";
		content: Record<string, unknown>;
	}): Promise<void> {
		const token = await this.getTenantAccessToken();
		const response = await fetch(
			`${this.getApiBase()}/im/v1/messages?receive_id_type=${encodeURIComponent(input.receiveIdType)}`,
			{
				method: "POST",
				headers: {
					authorization: `Bearer ${token}`,
					"content-type": "application/json; charset=utf-8",
				},
				body: JSON.stringify({
					receive_id: input.receiveId,
					msg_type: input.msgType,
					content: JSON.stringify(input.content),
				}),
			},
		);

		if (!response.ok) {
			throw new Error(`Feishu send message failed with status ${response.status}`);
		}

		const payload = (await response.json().catch(() => ({}))) as { code?: number; msg?: string };
		if (payload.code && payload.code !== 0) {
			throw new Error(`Feishu send message failed: ${payload.msg ?? payload.code}`);
		}
	}

	private async uploadFile(input: {
		fileName: string;
		mimeType?: string;
		bytes: Uint8Array;
	}): Promise<string> {
		const token = await this.getTenantAccessToken();
		const formData = new FormData();
		formData.set(
			"file",
			new Blob([input.bytes], {
				type: input.mimeType || "application/octet-stream",
			}),
			input.fileName,
		);
		formData.set("file_name", input.fileName);
		formData.set("file_type", "stream");

		const response = await fetch(`${this.getApiBase()}/im/v1/files`, {
			method: "POST",
			headers: {
				authorization: `Bearer ${token}`,
			},
			body: formData,
		});

		if (!response.ok) {
			throw new Error(`Feishu upload file failed with status ${response.status}`);
		}

		const payload = (await response.json().catch(() => ({}))) as {
			code?: number;
			msg?: string;
			data?: { file_key?: string };
		};
		if (payload.code && payload.code !== 0) {
			throw new Error(`Feishu upload file failed: ${payload.msg ?? payload.code}`);
		}
		const fileKey = payload.data?.file_key;
		if (!fileKey) {
			throw new Error("Feishu upload file response did not include file_key");
		}
		return fileKey;
	}

	private async getTenantAccessToken(): Promise<string> {
		if (!this.options.appId || !this.options.appSecret) {
			throw new Error("Feishu client is not configured");
		}

		if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) {
			return this.accessToken.value;
		}

		const response = await fetch(`${this.getApiBase()}/auth/v3/tenant_access_token/internal`, {
			method: "POST",
			headers: {
				"content-type": "application/json; charset=utf-8",
			},
			body: JSON.stringify({
				app_id: this.options.appId,
				app_secret: this.options.appSecret,
			}),
		});

		if (!response.ok) {
			throw new Error(`Feishu tenant token request failed with status ${response.status}`);
		}

		const payload = (await response.json()) as {
			code?: number;
			msg?: string;
			tenant_access_token?: string;
			expire?: number;
		};
		if (payload.code && payload.code !== 0) {
			throw new Error(`Feishu tenant token request failed: ${payload.msg ?? payload.code}`);
		}
		if (!payload.tenant_access_token) {
			throw new Error("Feishu tenant token response did not include tenant_access_token");
		}

		this.accessToken = {
			value: payload.tenant_access_token,
			expiresAt: Date.now() + Math.max(60, payload.expire ?? 7200) * 1000,
		};
		return this.accessToken.value;
	}

	private getApiBase(): string {
		return this.options.apiBase?.replace(/\/$/, "") || "https://open.feishu.cn/open-apis";
	}
}

function parseFileNameFromDisposition(disposition: string | null): string | undefined {
	if (!disposition) {
		return undefined;
	}
	const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
	if (encodedMatch?.[1]) {
		return decodeURIComponent(encodedMatch[1]);
	}
	const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
	return plainMatch?.[1];
}
