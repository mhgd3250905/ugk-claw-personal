import { extname, resolve } from "node:path";
import type { ChatAttachment } from "../agent/asset-store.js";

export const DEFAULT_MULTIPART_ASSET_FILE_LIMIT_BYTES = 64 * 1024 * 1024;
export const MAX_ASSET_UPLOAD_FILES = 5;
const TEXT_UPLOAD_PREVIEW_LIMIT_BYTES = 512 * 1024;

export function toMultipartAttachment(fileName: string | undefined, mimeType: string | undefined, content: Buffer): ChatAttachment {
	const normalizedMimeType = typeof mimeType === "string" && mimeType.trim() ? mimeType : "application/octet-stream";
	if (isTextUpload(fileName, normalizedMimeType) && content.byteLength <= TEXT_UPLOAD_PREVIEW_LIMIT_BYTES) {
		return {
			fileName: fileName?.trim() || "attachment",
			mimeType: normalizedMimeType,
			sizeBytes: content.byteLength,
			text: content.toString("utf8"),
		};
	}

	return {
		fileName: fileName?.trim() || "attachment",
		mimeType: normalizedMimeType,
		sizeBytes: content.byteLength,
		base64: content.toString("base64"),
	};
}

export function isMultipartUploadTooLargeError(error: unknown): boolean {
	const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
	const message = error instanceof Error ? error.message : "";
	return code === "FST_REQ_FILE_TOO_LARGE" || /too large|fileSize|limit/i.test(message);
}

export function resolveMultipartAssetFileLimitBytes(): number {
	const configuredLimit = Number(process.env.ASSET_UPLOAD_FILE_LIMIT_BYTES);
	if (Number.isFinite(configuredLimit) && configuredLimit >= 1024) {
		return Math.floor(configuredLimit);
	}
	return DEFAULT_MULTIPART_ASSET_FILE_LIMIT_BYTES;
}

export function formatByteLimit(bytes: number): string {
	if (bytes >= 1024 * 1024) {
		return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MiB`;
	}
	if (bytes >= 1024) {
		return `${Math.round((bytes / 1024) * 10) / 10}KiB`;
	}
	return `${bytes}B`;
}

export function buildContentDispositionHeader(disposition: "inline" | "attachment", fileName: string): string {
	const safeFileName = escapeContentDispositionFileName(fileName);
	const asciiFallback = safeFileName.replace(/[^\x20-\x7e]/g, "_") || "download";
	return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeRFC5987ValueChars(safeFileName)}`;
}

export function resolveLocalArtifactPath(inputPath: string | undefined, projectRoot: string): string | undefined {
	const normalizedInput = unwrapLocalFileUrlPath(String(inputPath || "").trim());
	if (!normalizedInput) {
		return undefined;
	}

	const decodedInput = normalizedInput.startsWith("file://") ? decodeFileUrlPath(normalizedInput) ?? normalizedInput : normalizedInput;
	const absolutePath = resolveProjectArtifactPath(decodedInput, projectRoot);
	if (!absolutePath) {
		return undefined;
	}

	const allowedRoots = [
		resolve(projectRoot, "public"),
		resolve(projectRoot, "runtime"),
	];
	return allowedRoots.some((allowedRoot) => isPathInside(absolutePath, allowedRoot)) ? absolutePath : undefined;
}

export function resolveContentType(filePath: string): string {
	return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export function shouldForceDownload(value: string | number | boolean | undefined): boolean {
	if (typeof value === "boolean") {
		return value;
	}
	if (typeof value === "number") {
		return value !== 0;
	}
	if (typeof value !== "string") {
		return false;
	}
	const normalized = value.trim().toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function resolveFileResponseContentType(mimeType: string): string {
	const normalized = String(mimeType ?? "").trim().toLowerCase();
	if (!normalized) {
		return "application/octet-stream";
	}
	if (/\bcharset\s*=/.test(normalized)) {
		return normalized;
	}
	const baseMimeType = stripMimeParameters(normalized);
	if (baseMimeType.startsWith("text/") || UTF8_TEXT_MIME_TYPES.has(baseMimeType)) {
		return `${baseMimeType}; charset=utf-8`;
	}
	return normalized;
}

export function supportsInlinePreview(mimeType: string): boolean {
	const normalized = stripMimeParameters(String(mimeType ?? "").trim().toLowerCase());
	return (
		normalized.startsWith("image/png") ||
		normalized.startsWith("image/jpeg") ||
		normalized.startsWith("image/gif") ||
		normalized.startsWith("image/webp") ||
		normalized === "application/pdf" ||
		normalized === "text/html" ||
		normalized === "text/plain" ||
		normalized === "text/markdown" ||
		normalized === "application/json" ||
		normalized === "text/csv"
	);
}

function isTextUpload(fileName: string | undefined, mimeType: string): boolean {
	return (
		mimeType.startsWith("text/") ||
		/\.(txt|md|markdown|json|csv|tsv|log|xml|html|css|js|ts|tsx|jsx|py|java|go|rs|c|cpp|h|hpp|cs|php|rb|yml|yaml|toml|ini|sql)$/i.test(
			fileName || "",
		)
	);
}

function escapeContentDispositionFileName(fileName: string): string {
	return fileName.replace(/["\\\r\n]/g, "_");
}

function encodeRFC5987ValueChars(value: string): string {
	return encodeURIComponent(value).replace(/['()*]/g, (char) =>
		`%${char.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}

function unwrapLocalFileUrlPath(inputPath: string): string {
	let current = inputPath;
	for (let index = 0; index < 3; index += 1) {
		const nestedPath = extractLocalFileUrlPath(current);
		if (!nestedPath || nestedPath === current) {
			return current;
		}
		current = nestedPath;
	}
	return current;
}

function extractLocalFileUrlPath(inputPath: string): string | undefined {
	try {
		const url = inputPath.startsWith("/v1/local-file")
			? new URL(inputPath, "http://localhost")
			: new URL(inputPath);
		if (url.pathname !== "/v1/local-file") {
			return undefined;
		}
		return url.searchParams.get("path") ?? undefined;
	} catch {
		return undefined;
	}
}

function resolveProjectArtifactPath(inputPath: string, projectRoot: string): string | undefined {
	const slashInput = inputPath.replace(/\\/g, "/");
	if (!slashInput) {
		return undefined;
	}
	if (slashInput === "/app") {
		return resolve(projectRoot);
	}
	if (slashInput.startsWith("/app/")) {
		return resolve(projectRoot, `.${slashInput.slice("/app".length)}`);
	}
	if (/^(public|runtime)(\/|$)/.test(slashInput)) {
		return resolve(projectRoot, slashInput);
	}
	return resolve(inputPath);
}

function decodeFileUrlPath(fileUrl: string): string | undefined {
	try {
		const url = new URL(fileUrl);
		if (url.protocol !== "file:") {
			return undefined;
		}
		return decodeURIComponent(url.pathname || "");
	} catch {
		return undefined;
	}
}

function isPathInside(filePath: string, parentDir: string): boolean {
	const normalizedFilePath = resolve(filePath);
	const normalizedParentDir = resolve(parentDir);
	return (
		normalizedFilePath === normalizedParentDir ||
		normalizedFilePath.startsWith(`${normalizedParentDir}\\`) ||
		normalizedFilePath.startsWith(`${normalizedParentDir}/`)
	);
}

function stripMimeParameters(mimeType: string): string {
	return mimeType.split(";", 1)[0]?.trim() ?? "";
}

const CONTENT_TYPES: Record<string, string> = {
	".csv": "text/csv; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".gif": "image/gif",
	".html": "text/html; charset=utf-8",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".md": "text/markdown; charset=utf-8",
	".pdf": "application/pdf",
	".png": "image/png",
	".svg": "image/svg+xml; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".webp": "image/webp",
};

const UTF8_TEXT_MIME_TYPES = new Set([
	"application/javascript",
	"application/json",
	"application/x-yaml",
	"application/xml",
	"image/svg+xml",
]);
