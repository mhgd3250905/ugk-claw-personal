import type { ToolExecutionEndEventLike } from "./agent-session-factory.js";
import type { AgentMessageLike } from "./context-usage.js";
import type { AgentFileArtifact } from "./file-artifacts.js";
import type { ChatHistoryFileBody } from "../types/api.js";

export function extractSendFileArtifact(event: ToolExecutionEndEventLike): AgentFileArtifact | undefined {
	if (event.isError || event.toolName !== "send_file") {
		return undefined;
	}
	if (!event.result || typeof event.result !== "object") {
		return undefined;
	}

	const details = "details" in event.result ? (event.result as { details?: unknown }).details : undefined;
	if (!details || typeof details !== "object") {
		return undefined;
	}

	const file = "file" in details ? (details as { file?: unknown }).file : undefined;
	return normalizeAgentFileArtifact(file);
}

export function extractConversationHistoryFiles(message: AgentMessageLike): ChatHistoryFileBody[] | undefined {
	if (message.role !== "toolResult") {
		return undefined;
	}

	const candidate = message as AgentMessageLike & {
		toolName?: string;
		details?: unknown;
		isError?: boolean;
	};
	if (candidate.toolName !== "send_file" || candidate.isError === true) {
		return undefined;
	}

	const details = candidate.details;
	if (!details || typeof details !== "object") {
		return undefined;
	}

	const file = "file" in details ? (details as { file?: unknown }).file : undefined;
	const normalized = normalizeAgentFileArtifact(file);
	if (!normalized) {
		return undefined;
	}

	return [
		{
			fileName: normalized.fileName,
			downloadUrl: normalized.downloadUrl,
			mimeType: normalized.mimeType,
			sizeBytes: normalized.sizeBytes,
		},
	];
}

export function mergeAgentFiles(existingFiles: AgentFileArtifact[] | undefined, sentFiles: AgentFileArtifact[]): AgentFileArtifact[] | undefined {
	const merged = new Map<string, AgentFileArtifact>();
	for (const file of [...(existingFiles ?? []), ...sentFiles]) {
		const key = file.assetId || file.id || file.downloadUrl;
		if (!key || merged.has(key)) {
			continue;
		}
		merged.set(key, file);
	}

	const files = [...merged.values()];
	return files.length > 0 ? files : undefined;
}

export function mergeConversationHistoryFiles(
	existingFiles: ChatHistoryFileBody[] | undefined,
	incomingFiles: readonly ChatHistoryFileBody[],
): ChatHistoryFileBody[] | undefined {
	const merged = new Map<string, ChatHistoryFileBody>();
	for (const file of [...(existingFiles ?? []), ...incomingFiles]) {
		const key = `${file.downloadUrl}|${file.fileName}`;
		if (merged.has(key)) {
			continue;
		}
		merged.set(key, { ...file });
	}

	const files = [...merged.values()];
	return files.length > 0 ? files : undefined;
}

function normalizeAgentFileArtifact(value: unknown): AgentFileArtifact | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}

	const candidate = value as Record<string, unknown>;
	const assetId = readRequiredString(candidate, "assetId") ?? readRequiredString(candidate, "id");
	const fileName = readRequiredString(candidate, "fileName");
	const mimeType = readRequiredString(candidate, "mimeType");
	const downloadUrl = readRequiredString(candidate, "downloadUrl");
	const sizeBytes = readRequiredNumber(candidate, "sizeBytes");
	if (!assetId || !fileName || !mimeType || !downloadUrl || sizeBytes === undefined) {
		return undefined;
	}

	return {
		id: readRequiredString(candidate, "id") ?? assetId,
		assetId,
		reference: readRequiredString(candidate, "reference") ?? `@asset[${assetId}]`,
		fileName,
		mimeType,
		sizeBytes,
		downloadUrl,
	};
}

function readRequiredString(value: Record<string, unknown>, propertyName: string): string | undefined {
	const propertyValue = value[propertyName];
	return typeof propertyValue === "string" && propertyValue.trim().length > 0 ? propertyValue : undefined;
}

function readRequiredNumber(value: Record<string, unknown>, propertyName: string): number | undefined {
	const propertyValue = value[propertyName];
	return typeof propertyValue === "number" && Number.isFinite(propertyValue) && propertyValue >= 0 ? propertyValue : undefined;
}
