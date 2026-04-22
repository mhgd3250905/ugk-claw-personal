import type { ChatAttachment } from "./asset-store.js";
import type { ProjectDefaultModelContext } from "./agent-session-factory.js";

export interface UsageLike {
	totalTokens?: number;
	input?: number;
	output?: number;
	cacheRead?: number;
	cacheWrite?: number;
}

export interface AgentMessageLike {
	role: string;
	content?: unknown;
	stopReason?: string;
	timestamp?: number | string;
	usage?: UsageLike;
	command?: string;
	output?: string;
	summary?: string;
}

export interface ContextUsageSnapshot extends ProjectDefaultModelContext {
	currentTokens: number;
	availableTokens: number;
	percent: number;
	status: "safe" | "caution" | "warning" | "danger";
	mode: "usage" | "estimate";
}

export interface PromptAssetLike {
	fileName?: string;
	mimeType?: string;
	sizeBytes?: number;
	kind?: "text" | "binary" | "metadata";
	textPreview?: string;
	textContent?: string;
	hasContent?: boolean;
}

export function buildContextUsageSnapshot(
	modelContext: ProjectDefaultModelContext,
	messages: readonly AgentMessageLike[],
): ContextUsageSnapshot {
	const estimated = estimateContextTokens(messages);
	const percent = clampPercent(estimated.tokens, modelContext.contextWindow);
	return {
		...modelContext,
		currentTokens: estimated.tokens,
		availableTokens: Math.max(0, modelContext.contextWindow - modelContext.reserveTokens - estimated.tokens),
		percent,
		status: resolveContextUsageStatus(estimated.tokens, modelContext.contextWindow, modelContext.reserveTokens),
		mode: estimated.usageTokens > 0 ? "usage" : "estimate",
	};
}

export function estimateContextTokens(messages: readonly AgentMessageLike[]): {
	tokens: number;
	usageTokens: number;
	trailingTokens: number;
} {
	const usageInfo = findLastAssistantUsage(messages);
	if (!usageInfo) {
		const trailingTokens = messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0);
		return {
			tokens: trailingTokens,
			usageTokens: 0,
			trailingTokens,
		};
	}

	const usageTokens = calculateContextTokens(usageInfo.usage);
	const trailingTokens = messages
		.slice(usageInfo.index + 1)
		.reduce((sum, message) => sum + estimateMessageTokens(message), 0);

	return {
		tokens: usageTokens + trailingTokens,
		usageTokens,
		trailingTokens,
	};
}

export function calculateContextTokens(usage: UsageLike): number {
	return usage.totalTokens || (usage.input ?? 0) + (usage.output ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
}

export function resolveContextUsageStatus(
	currentTokens: number,
	contextWindow: number,
	reserveTokens: number,
): "safe" | "caution" | "warning" | "danger" {
	const usableWindow = Math.max(1, contextWindow - reserveTokens);
	const ratio = currentTokens / usableWindow;
	if (ratio >= 1) {
		return "danger";
	}
	if (ratio >= 0.9) {
		return "warning";
	}
	if (ratio >= 0.72) {
		return "caution";
	}
	return "safe";
}

export function estimateTextTokens(text: string | undefined): number {
	return Math.ceil(String(text || "").length / 4);
}

export function estimateAttachmentTokens(attachment: Pick<ChatAttachment, "text" | "base64" | "mimeType" | "sizeBytes">): number {
	if (typeof attachment.text === "string" && attachment.text.length > 0) {
		return estimateTextTokens(attachment.text);
	}
	if (typeof attachment.base64 === "string" && attachment.base64.length > 0) {
		const approxBytes = Math.ceil((attachment.base64.length * 3) / 4);
		return estimateBinaryTokens(attachment.mimeType, approxBytes);
	}
	return estimateBinaryTokens(attachment.mimeType, attachment.sizeBytes);
}

export function estimatePromptAssetTokens(asset: PromptAssetLike): number {
	if (typeof asset.textContent === "string" && asset.textContent.length > 0) {
		return estimateTextTokens(asset.textContent);
	}
	if (typeof asset.textPreview === "string" && asset.textPreview.length > 0) {
		return estimateTextTokens(asset.textPreview);
	}
	if (asset.kind === "text" || asset.hasContent) {
		return estimateBinaryTokens(asset.mimeType, asset.sizeBytes);
	}
	return Math.max(32, estimateTextTokens(`${asset.fileName || ""} ${asset.mimeType || ""}`));
}

function clampPercent(tokens: number, contextWindow: number): number {
	if (!Number.isFinite(contextWindow) || contextWindow <= 0) {
		return 0;
	}
	return Math.max(0, Math.min(100, Math.round((tokens / contextWindow) * 100)));
}

function estimateMessageTokens(message: AgentMessageLike): number {
	switch (message.role) {
		case "user":
			return estimateContentTokens(message.content);
		case "assistant":
			return estimateAssistantContentTokens(message.content);
		case "custom":
		case "toolResult":
			return estimateContentTokens(message.content);
		case "bashExecution":
			return estimateTextTokens(`${message.command || ""}${message.output || ""}`);
		case "branchSummary":
		case "compactionSummary":
			return estimateTextTokens(message.summary);
		default:
			return estimateContentTokens(message.content);
	}
}

function estimateContentTokens(content: unknown): number {
	if (typeof content === "string") {
		return estimateTextTokens(content);
	}
	if (!Array.isArray(content)) {
		return 0;
	}

	let chars = 0;
	for (const block of content) {
		if (!block || typeof block !== "object") {
			continue;
		}
		const candidate = block as { type?: string; text?: string };
		if (candidate.type === "text" && typeof candidate.text === "string") {
			chars += candidate.text.length;
			continue;
		}
		if (candidate.type === "image") {
			chars += 4800;
		}
	}
	return Math.ceil(chars / 4);
}

function estimateAssistantContentTokens(content: unknown): number {
	if (!Array.isArray(content)) {
		return estimateContentTokens(content);
	}

	let chars = 0;
	for (const block of content) {
		if (!block || typeof block !== "object") {
			continue;
		}
		const candidate = block as {
			type?: string;
			text?: string;
			thinking?: string;
			name?: string;
			arguments?: unknown;
		};
		if (candidate.type === "text" && typeof candidate.text === "string") {
			chars += candidate.text.length;
			continue;
		}
		if (candidate.type === "thinking" && typeof candidate.thinking === "string") {
			chars += candidate.thinking.length;
			continue;
		}
		if (candidate.type === "toolCall") {
			chars += String(candidate.name || "").length + JSON.stringify(candidate.arguments || {}).length;
		}
	}
	return Math.ceil(chars / 4);
}

function estimateBinaryTokens(mimeType: string | undefined, sizeBytes: number | undefined): number {
	const normalizedMimeType = String(mimeType || "").toLowerCase();
	if (normalizedMimeType.startsWith("image/")) {
		return 1200;
	}
	const normalizedSize = Math.max(0, Number.isFinite(sizeBytes) ? Number(sizeBytes) : 0);
	if (normalizedSize === 0) {
		return 128;
	}
	return Math.max(128, Math.ceil(normalizedSize / 16));
}

function findLastAssistantUsage(messages: readonly AgentMessageLike[]): { usage: UsageLike; index: number } | undefined {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role !== "assistant" || !message.usage) {
			continue;
		}
		if (message.stopReason === "aborted" || message.stopReason === "error") {
			continue;
		}
		return {
			usage: message.usage,
			index,
		};
	}
	return undefined;
}
