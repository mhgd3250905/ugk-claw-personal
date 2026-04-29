import type {
	ChatRequestBody,
	ChatResponseBody,
	ChatStatusResponseBody,
	ConversationCatalogResponseBody,
	ConversationStateResponseBody,
	CreateConversationResponseBody,
	InterruptChatRequestBody,
	InterruptChatResponseBody,
	QueueMessageRequestBody,
	QueueMessageResponseBody,
} from "../../types/api.js";
import type { FeishuAgentGateway } from "./service.js";

export interface FeishuHttpAgentGatewayOptions {
	baseUrl: string;
	fetchImpl?: typeof fetch;
}

export class FeishuHttpAgentGateway implements FeishuAgentGateway {
	private readonly baseUrl: URL;
	private readonly fetchImpl: typeof fetch;

	constructor(options: FeishuHttpAgentGatewayOptions) {
		this.baseUrl = new URL(options.baseUrl);
		this.fetchImpl = options.fetchImpl ?? fetch;
	}

	async getCurrentConversationId(): Promise<string> {
		const catalog = await this.requestJson<ConversationCatalogResponseBody>("GET", "/v1/chat/conversations");
		if (typeof catalog.currentConversationId !== "string" || catalog.currentConversationId.trim().length === 0) {
			throw new Error("UGK server returned an invalid currentConversationId");
		}
		return catalog.currentConversationId;
	}

	async getRunStatus(conversationId: string): Promise<ChatStatusResponseBody> {
		const path = `/v1/chat/status?conversationId=${encodeURIComponent(conversationId)}`;
		return await this.requestJson<ChatStatusResponseBody>("GET", path);
	}

	async getConversationState(conversationId: string, options?: { viewLimit?: number }): Promise<ConversationStateResponseBody> {
		const viewLimit = options?.viewLimit ? `&viewLimit=${encodeURIComponent(String(options.viewLimit))}` : "";
		const path = `/v1/chat/state?conversationId=${encodeURIComponent(conversationId)}${viewLimit}`;
		return await this.requestJson<ConversationStateResponseBody>("GET", path);
	}

	async createConversation(): Promise<CreateConversationResponseBody> {
		return await this.requestJson<CreateConversationResponseBody>("POST", "/v1/chat/conversations");
	}

	async interruptChat(input: InterruptChatRequestBody): Promise<InterruptChatResponseBody> {
		return await this.requestJson<InterruptChatResponseBody>("POST", "/v1/chat/interrupt", input);
	}

	async chat(input: ChatRequestBody): Promise<ChatResponseBody> {
		return await this.requestJson<ChatResponseBody>("POST", "/v1/chat", input);
	}

	async queueMessage(input: QueueMessageRequestBody): Promise<QueueMessageResponseBody> {
		return await this.requestJson<QueueMessageResponseBody>("POST", "/v1/chat/queue", input);
	}

	private async requestJson<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
		const response = await this.fetchImpl(new URL(path, this.baseUrl), {
			method,
			headers: body === undefined ? undefined : { "content-type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		if (!response.ok) {
			throw new Error(`UGK server request failed: ${method} ${path.split("?")[0]} returned ${response.status}`);
		}
		return (await response.json()) as T;
	}
}
