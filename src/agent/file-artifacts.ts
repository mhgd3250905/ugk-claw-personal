import type { AssetRecord } from "./asset-store.js";

export interface AgentFileDraft {
	fileName: string;
	mimeType: string;
	content: string;
}

export interface AgentFileArtifact {
	id: string;
	assetId: string;
	reference: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	downloadUrl: string;
}

export interface PromptAssetContextEntry {
	assetId: string;
	reference: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	kind: "text" | "binary" | "metadata";
	hasContent: boolean;
	source: "upload" | "reference";
	textContent?: string;
	textPreview?: string;
}

export function buildPromptWithAssetContext(
	message: string,
	assets: readonly PromptAssetContextEntry[] = [],
): string {
	const sections = [message.trim(), buildAssetResponseInstruction(), buildFileResponseInstruction()];
	const assetContext = buildAssetContext(assets);
	if (assetContext) {
		sections.splice(1, 0, assetContext);
	}
	return sections.filter((section) => section.length > 0).join("\n\n");
}

export function toPromptAssetFromStoredAsset(
	asset: AssetRecord,
	options: {
		source: "upload" | "reference";
		textContent?: string;
	},
): PromptAssetContextEntry {
	return {
		assetId: asset.assetId,
		reference: asset.reference,
		fileName: asset.fileName,
		mimeType: asset.mimeType,
		sizeBytes: asset.sizeBytes,
		kind: asset.kind,
		hasContent: asset.hasContent,
		source: options.source,
		...(options.textContent ? { textContent: options.textContent } : {}),
		...(asset.textPreview ? { textPreview: asset.textPreview } : {}),
	};
}

export function extractAgentFileDrafts(text: string): { text: string; files: AgentFileDraft[] } {
	const files: AgentFileDraft[] = [];
	const withoutFiles = text.replace(
		/```ugk-file[^\n]*\n([\s\S]*?)```/gi,
		(match, content: string) => {
			const header = match.split("\n", 1)[0] ?? "";
			const attrs = parseFileAttributes(header);
			files.push({
				fileName: sanitizeFileName(attrs.name ?? "agent-file.txt"),
				mimeType: normalizeMimeType(attrs.mime ?? "text/plain"),
				content: String(content).replace(/\n$/, ""),
			});
			return "";
		},
	);

	return {
		text: normalizeVisibleText(withoutFiles),
		files,
	};
}

function buildAssetContext(assets: readonly PromptAssetContextEntry[]): string {
	if (assets.length === 0) {
		return "";
	}

	const sections = assets.map((asset, index) => {
		const lines = [
			`<asset index="${index + 1}" source="${asset.source}">`,
			`assetId: ${asset.assetId}`,
			`reference: ${asset.reference}`,
			`fileName: ${sanitizeFileName(asset.fileName)}`,
			`mimeType: ${asset.mimeType}`,
			`sizeBytes: ${asset.sizeBytes}`,
			`kind: ${asset.kind}`,
			`hasContent: ${asset.hasContent ? "yes" : "no"}`,
		];

		if (typeof asset.textContent === "string" && asset.textContent.length > 0) {
			lines.push("content:", "```text", limitAttachmentText(asset.textContent), "```");
		} else if (asset.textPreview) {
			lines.push("preview:", "```text", asset.textPreview, "```");
		} else if (asset.hasContent) {
			lines.push("content: stored on server; use asset_store with assetId if full inspection is needed");
		} else {
			lines.push("content: metadata only; no server-side file body is currently available");
		}

		lines.push("</asset>");
		return lines.join("\n");
	});

	return ["<user_assets>", ...sections, "</user_assets>"].join("\n");
}

function buildAssetResponseInstruction(): string {
	return [
		"<asset_reference_protocol>",
		"Uploaded files and reusable server-side artifacts are represented as assets.",
		"Each asset includes an assetId and a reusable reference token like @asset[asset-id].",
		"If you need the full text of a referenced asset and it is not already embedded, use the asset_store tool with that assetId.",
		"</asset_reference_protocol>",
	].join("\n");
}

function buildFileResponseInstruction(): string {
	return [
		"<file_response_protocol>",
		'If you need to send a file back to the user, include a fenced block exactly like: ```ugk-file name="example.txt" mime="text/plain"',
		"file contents",
		"```",
		"Only use this protocol for files the user should download.",
		"</file_response_protocol>",
	].join("\n");
}

function limitAttachmentText(text: string): string {
	const maxLength = 120_000;
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.slice(0, maxLength)}\n\n[Attachment truncated after ${maxLength} characters]`;
}

function parseFileAttributes(header: string): { name?: string; mime?: string } {
	const attrs: { name?: string; mime?: string } = {};
	for (const match of header.matchAll(/\b(name|mime)="([^"]+)"/gi)) {
		if (match[1]?.toLowerCase() === "name") {
			attrs.name = match[2];
		}
		if (match[1]?.toLowerCase() === "mime") {
			attrs.mime = match[2];
		}
	}
	return attrs;
}

function normalizeVisibleText(text: string): string {
	return text
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function normalizeMimeType(mimeType: string): string {
	const normalized = mimeType.trim().toLowerCase();
	return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(normalized) ? normalized : "application/octet-stream";
}

function sanitizeFileName(fileName: string): string {
	const safeBaseName = fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
	return safeBaseName || "agent-file.txt";
}
