import { existsSync } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { AssetStore, type AgentFileBufferDraft } from "../../src/agent/asset-store.js";
import type { AgentFileArtifact } from "../../src/agent/file-artifacts.js";
import { getAppConfig } from "../../src/config.js";

const SendFileParams = Type.Object({
	path: Type.String({ description: "Path to an existing file inside the current project." }),
	fileName: Type.Optional(Type.String({ description: "Optional download file name. Defaults to the source basename." })),
	mimeType: Type.Optional(Type.String({ description: "Optional MIME type. Defaults to an extension-based guess." })),
	conversationId: Type.Optional(Type.String({ description: "Optional internal conversation id for asset indexing." })),
});

export interface SendFileInput {
	projectRoot: string;
	assetStore: AssetStore;
	conversationId?: string;
	path: string;
	fileName?: string;
	mimeType?: string;
}

export function inferMimeType(filePath: string): string {
	const extension = extname(filePath).toLowerCase();
	const mimeTypes: Record<string, string> = {
		".txt": "text/plain",
		".md": "text/markdown",
		".markdown": "text/markdown",
		".json": "application/json",
		".csv": "text/csv",
		".html": "text/html",
		".htm": "text/html",
		".css": "text/css",
		".js": "application/javascript",
		".mjs": "application/javascript",
		".xml": "application/xml",
		".yaml": "application/x-yaml",
		".yml": "application/x-yaml",
		".png": "image/png",
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".gif": "image/gif",
		".webp": "image/webp",
		".svg": "image/svg+xml",
		".pdf": "application/pdf",
		".zip": "application/zip",
	};
	return mimeTypes[extension] ?? "application/octet-stream";
}

export async function createSendFileAsset(input: SendFileInput): Promise<AgentFileArtifact> {
	const projectRoot = await realpath(resolve(input.projectRoot));
	const requestedPath = resolve(projectRoot, input.path);
	if (!isPathInside(requestedPath, projectRoot)) {
		throw new Error(`send_file path must be inside the project root: ${input.path}`);
	}
	if (!existsSync(requestedPath)) {
		throw new Error(`send_file path does not exist: ${input.path}`);
	}

	const filePath = await realpath(requestedPath);
	if (!isPathInside(filePath, projectRoot)) {
		throw new Error(`send_file path must be inside the project root: ${input.path}`);
	}

	const fileStat = await stat(filePath);
	if (!fileStat.isFile()) {
		throw new Error(`send_file path must point to a file: ${input.path}`);
	}

	const content = await readFile(filePath);
	const mimeType = normalizeMimeType(input.mimeType ?? inferMimeType(filePath));
	const draft: AgentFileBufferDraft = {
		fileName: sanitizeFileName(input.fileName ?? basename(filePath)),
		mimeType,
		content,
		...(isTextMimeType(mimeType) ? { textPreview: content.toString("utf8", 0, 4000) } : {}),
	};

	const [file] = await input.assetStore.saveFileBuffers(input.conversationId ?? "manual:pi-send-file", [draft]);
	if (!file) {
		throw new Error(`send_file failed to store file: ${input.path}`);
	}
	return file;
}

export default function sendFileExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "send_file",
		label: "Send File",
		description: "Send an existing project file to the user as a downloadable attachment. Use this instead of printing base64 or ugk-file blocks.",
		promptSnippet: "Send an existing project file to the user as a download",
		promptGuidelines: [
			"Use send_file when the user asks you to send, attach, or deliver a generated local file.",
			"Do not print base64 file contents in the chat when send_file can send the file.",
		],
		parameters: SendFileParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			try {
				const projectRoot = findProjectRoot(ctx.cwd);
				const config = getAppConfig(projectRoot);
				const assetStore = new AssetStore({
					blobsDir: config.agentAssetBlobsDir,
					indexPath: config.assetIndexPath,
				});
				const file = await createSendFileAsset({
					projectRoot,
					assetStore,
					conversationId: params.conversationId || `manual:pi-session-${ctx.sessionManager.getSessionId()}`,
					path: params.path,
					fileName: params.fileName,
					mimeType: params.mimeType,
				});

				return {
					content: [
						{
							type: "text",
							text: [
								`File sent: ${file.fileName}`,
								`downloadUrl: ${file.downloadUrl}`,
								`assetId: ${file.assetId}`,
							].join("\n"),
						},
					],
					details: {
						action: "send",
						file,
					},
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : "send_file failed";
				return {
					content: [{ type: "text", text: message }],
					details: {
						action: "send",
						error: message,
					},
					isError: true,
				};
			}
		},
	});
}

function findProjectRoot(startPath: string): string {
	let current = resolve(startPath);

	while (true) {
		if (existsSync(join(current, ".pi"))) {
			return current;
		}

		const parent = dirname(current);
		if (parent === current) {
			return resolve(startPath);
		}
		current = parent;
	}
}

function sanitizeFileName(fileName: string): string {
	const safeBaseName = basename(fileName).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
	return safeBaseName || "download.bin";
}

function normalizeMimeType(mimeType: string): string {
	const normalized = mimeType.trim().toLowerCase();
	return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(normalized) ? normalized : "application/octet-stream";
}

function isTextMimeType(mimeType: string): boolean {
	const normalized = normalizeMimeType(mimeType);
	return (
		normalized.startsWith("text/") ||
		normalized === "application/json" ||
		normalized === "application/xml" ||
		normalized === "application/javascript" ||
		normalized === "application/x-yaml"
	);
}

function isPathInside(filePath: string, parentDir: string): boolean {
	const normalizedFilePath = resolve(filePath);
	const normalizedParentDir = resolve(parentDir);
	const relativePath = relative(normalizedParentDir, normalizedFilePath);
	return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}
