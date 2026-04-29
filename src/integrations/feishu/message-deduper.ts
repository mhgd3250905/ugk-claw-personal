export interface FeishuMessageDeduperLike {
	accept(messageId: string): Promise<boolean>;
}

export class InMemoryFeishuMessageDeduper implements FeishuMessageDeduperLike {
	private readonly seenMessageIds = new Set<string>();

	async accept(messageId: string): Promise<boolean> {
		if (this.seenMessageIds.has(messageId)) {
			return false;
		}
		this.seenMessageIds.add(messageId);
		return true;
	}
}
