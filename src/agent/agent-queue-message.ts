import { preparePromptAssets } from "./agent-prompt-assets.js";
import type { AssetStoreLike, ChatAttachment } from "./asset-store.js";
import type { AgentSessionLike } from "./agent-session-factory.js";
import {
	buildPromptWithAssetContext,
	prependCurrentTimeContext,
} from "./file-artifacts.js";
import type { QueueMessageMode } from "../types/api.js";

export interface QueueActiveMessageInput {
	conversationId: string;
	message: string;
	mode: QueueMessageMode;
	session: AgentSessionLike;
	attachments?: ChatAttachment[];
	assetRefs?: string[];
	assetStore?: AssetStoreLike;
}

export async function queueActiveMessage(input: QueueActiveMessageInput): Promise<void> {
	const preparedAssets = await preparePromptAssets({
		conversationId: input.conversationId,
		attachments: input.attachments,
		assetRefs: input.assetRefs,
		assetStore: input.assetStore,
	});
	const message = buildPromptWithAssetContext(prependCurrentTimeContext(input.message), preparedAssets.promptAssets);
	if (input.mode === "steer" && input.session.steer) {
		await input.session.steer(message);
		return;
	}
	if (input.mode === "followUp" && input.session.followUp) {
		await input.session.followUp(message);
		return;
	}
	await input.session.prompt(message, {
		streamingBehavior: input.mode,
	});
}
