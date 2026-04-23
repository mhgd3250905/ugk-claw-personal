import type { ChatAttachment } from "../../agent/asset-store.js";
import type { FeishuQueuedReplyPlan } from "./types.js";

export function planFeishuQueuedReply(input: {
	text?: string;
	attachments: readonly ChatAttachment[];
}): FeishuQueuedReplyPlan {
	const normalizedText = String(input.text || "").trim();
	const hasText = normalizedText.length > 0;
	const hasAttachments = input.attachments.length > 0;

	if (hasAttachments) {
		return {
			mode: "followUp",
			text: hasText
				? "已收到你的新消息和文件，当前步骤收尾后会继续处理。"
				: "已收到你刚发的文件，当前步骤收尾后会继续处理。",
		};
	}

	return {
		mode: "steer",
		text: hasText ? "已收到你的补充消息，我会把它接到当前处理流程里。" : "已收到你的补充消息。",
	};
}
