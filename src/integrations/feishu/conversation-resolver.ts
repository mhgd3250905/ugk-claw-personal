import type { FeishuConversationMapStore } from "./conversation-map-store.js";
import type { FeishuInboundMessage } from "./types.js";

export type FeishuConversationMode = "current" | "mapped";

export interface FeishuCurrentConversationProvider {
	getCurrentConversationId?(): Promise<string>;
}

export interface FeishuConversationResolverOptions {
	mode?: FeishuConversationMode;
	conversationMapStore: FeishuConversationMapStore;
	currentConversationProvider: FeishuCurrentConversationProvider;
}

export class FeishuConversationResolver {
	constructor(private readonly options: FeishuConversationResolverOptions) {}

	async resolve(incoming: FeishuInboundMessage): Promise<string> {
		if ((this.options.mode ?? "current") === "current") {
			const currentConversationId = await this.options.currentConversationProvider.getCurrentConversationId?.();
			if (!currentConversationId) {
				throw new Error("Feishu current conversation mode requires getCurrentConversationId");
			}
			return currentConversationId;
		}

		return await this.options.conversationMapStore.getOrCreate(
			`chat:${incoming.chatId}`,
			() => `feishu:chat:${incoming.chatId}`,
		);
	}
}
