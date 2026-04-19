export type FeishuReceiveIdType = "chat_id" | "open_id";

export interface FeishuClientOptions {
	appId?: string;
	appSecret?: string;
	apiBase?: string;
}

export class FeishuClient {
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
					msg_type: "text",
					content: JSON.stringify({
						text: input.text,
					}),
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
