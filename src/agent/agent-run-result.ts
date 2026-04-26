import { mergeAgentFiles } from "./agent-file-history.js";
import { extractAssistantText } from "./agent-process-text.js";
import type { AssetRecord, AssetStoreLike } from "./asset-store.js";
import type { AgentMessageLike } from "./context-usage.js";
import {
	extractAgentFileDrafts,
	rewriteUserVisibleLocalArtifactLinks,
	type AgentFileArtifact,
} from "./file-artifacts.js";
import type { ChatStreamEvent } from "../types/api.js";

export interface AgentRunResultInput {
	conversationId: string;
	rawText: string;
	lastAssistantMessage?: AgentMessageLike;
	sessionFile?: string;
	inputAssets: AssetRecord[];
	sentFiles: AgentFileArtifact[];
	assetStore?: AssetStoreLike;
}

export interface AgentRunResult {
	conversationId: string;
	text: string;
	sessionFile?: string;
	inputAssets?: AssetRecord[];
	files?: AgentFileArtifact[];
}

export interface AssistantRunStatusMessage {
	role: string;
	stopReason?: string;
	errorMessage?: string;
}

export async function buildAgentRunResult(input: AgentRunResultInput): Promise<AgentRunResult> {
	const rawText = input.rawText || extractAssistantText(input.lastAssistantMessage);
	const extracted = input.assetStore ? extractAgentFileDrafts(rawText) : { text: rawText, files: [] };
	const savedFiles =
		input.assetStore && extracted.files.length > 0
			? await input.assetStore.saveFiles(input.conversationId, extracted.files)
			: undefined;
	const text = rewriteUserVisibleLocalArtifactLinks(extracted.text);
	const files = mergeAgentFiles(savedFiles, input.sentFiles);

	return {
		conversationId: input.conversationId,
		text,
		sessionFile: input.sessionFile,
		inputAssets: input.inputAssets.length > 0 ? input.inputAssets : undefined,
		files: files && files.length > 0 ? files : undefined,
	};
}

export function findLastAssistantMessage<T extends { role: string }>(messages: readonly T[] | undefined): T | undefined {
	return [...(messages ?? [])].reverse().find((message) => message.role === "assistant");
}

export function assertAssistantMessageSucceeded(message: AssistantRunStatusMessage | undefined): void {
	if (message?.stopReason !== "error") {
		return;
	}
	throw new Error(message.errorMessage ?? "Unknown upstream provider error");
}

export function buildDoneChatStreamEvent(result: AgentRunResult, runId: string): ChatStreamEvent {
	const event: ChatStreamEvent = {
		type: "done",
		conversationId: result.conversationId,
		runId,
		text: result.text,
		sessionFile: result.sessionFile,
	};
	if (result.files) {
		event.files = result.files;
	}
	if (result.inputAssets) {
		event.inputAssets = result.inputAssets;
	}
	return event;
}
