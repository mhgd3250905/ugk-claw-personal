import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { extname, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import type { AssetStoreLike } from "../agent/asset-store.js";
import type {
	AssetDetailResponseBody,
	AssetListResponseBody,
	CreateAssetRequestBody,
	CreateAssetResponseBody,
	ErrorResponseBody,
} from "../types/api.js";

export interface FileRouteOptions {
	assetStore: AssetStoreLike;
	projectRoot: string;
}

export function registerFileRoutes(app: FastifyInstance, options: FileRouteOptions): void {
	app.get(
		"/v1/assets",
		async (request): Promise<AssetListResponseBody> => {
			const query = request.query as { conversationId?: string; limit?: string | number } | undefined;
			const limitValue =
				typeof query?.limit === "string" ? Number(query.limit) : typeof query?.limit === "number" ? query.limit : undefined;

			return {
				assets: await options.assetStore.listAssets({
					conversationId: query?.conversationId,
					limit: Number.isFinite(limitValue) ? limitValue : undefined,
				}),
			};
		},
	);

	app.get(
		"/v1/assets/:assetId",
		async (request, reply): Promise<AssetDetailResponseBody | ReturnType<typeof reply.status>> => {
			const { assetId } = request.params as { assetId: string };
			if (!assetId) {
				return reply.status(404).send();
			}

			const asset = await options.assetStore.getAsset(assetId);
			if (!asset) {
				return reply.status(404).send();
			}

			return {
				asset,
			};
		},
	);

	app.post(
		"/v1/assets",
		async (request, reply): Promise<CreateAssetResponseBody | ReturnType<typeof reply.status>> => {
			const body = (request.body ?? {}) as Partial<CreateAssetRequestBody>;
			const parsedAttachments = parseAttachments(body.attachments);
			if (parsedAttachments.error) {
				return reply.status(400).send({
					error: {
						code: "BAD_REQUEST",
						message: parsedAttachments.error,
					},
				} satisfies ErrorResponseBody);
			}

			const conversationId = String(body.conversationId || "").trim() || `manual:asset-upload:${randomUUID()}`;
			return {
				assets: await options.assetStore.registerAttachments(conversationId, parsedAttachments.attachments ?? []),
			};
		},
	);

	app.get("/v1/files/:fileId", async (request, reply) => {
		const { fileId } = request.params as { fileId: string };
		const query = request.query as { download?: string | number | boolean } | undefined;
		if (!fileId) {
			return reply.status(404).send();
		}

		const asset = await options.assetStore.getFile(fileId);
		if (!asset || !asset.content) {
			return reply.status(404).send();
		}

		reply.type(asset.mimeType);
		reply.header("content-length", asset.sizeBytes);
		const disposition = shouldForceDownload(query?.download) || !supportsInlinePreview(asset.mimeType) ? "attachment" : "inline";
		reply.header("content-disposition", buildContentDispositionHeader(disposition, asset.fileName));
		return reply.send(asset.content);
	});

	app.get("/v1/local-file", async (request, reply) => {
		const query = request.query as { path?: string } | undefined;
		const filePath = resolveLocalArtifactPath(query?.path, options.projectRoot);
		if (!filePath) {
			return reply.status(404).send();
		}

		try {
			const fileStat = await stat(filePath);
			if (!fileStat.isFile()) {
				return reply.status(404).send();
			}

			reply.type(resolveContentType(filePath));
			reply.header("content-length", fileStat.size);
			reply.header("cache-control", "no-store, no-cache, must-revalidate");
			return reply.send(createReadStream(filePath));
		} catch {
			return reply.status(404).send();
		}
	});
}

function parseAttachments(
	value: unknown,
): { attachments?: Array<Parameters<AssetStoreLike["registerAttachments"]>[1][number]>; error?: string } {
	if (!Array.isArray(value) || value.length === 0) {
		return { error: 'Field "attachments" must be a non-empty array' };
	}
	if (value.length > 5) {
		return { error: 'Field "attachments" supports at most 5 files' };
	}

	const attachments: Array<Parameters<AssetStoreLike["registerAttachments"]>[1][number]> = [];
	for (const [index, rawAttachment] of value.entries()) {
		if (!rawAttachment || typeof rawAttachment !== "object") {
			return { error: `attachments[${index}] must be an object` };
		}
		const attachment = rawAttachment as Record<string, unknown>;
		if (typeof attachment.fileName !== "string" || attachment.fileName.trim().length === 0) {
			return { error: `attachments[${index}].fileName must be a non-empty string` };
		}
		if (attachment.mimeType !== undefined && typeof attachment.mimeType !== "string") {
			return { error: `attachments[${index}].mimeType must be a string when provided` };
		}
		if (attachment.sizeBytes !== undefined && (typeof attachment.sizeBytes !== "number" || !Number.isFinite(attachment.sizeBytes) || attachment.sizeBytes < 0)) {
			return { error: `attachments[${index}].sizeBytes must be a non-negative number when provided` };
		}
		if (attachment.text !== undefined && typeof attachment.text !== "string") {
			return { error: `attachments[${index}].text must be a string when provided` };
		}
		if (attachment.base64 !== undefined && typeof attachment.base64 !== "string") {
			return { error: `attachments[${index}].base64 must be a string when provided` };
		}
		if (attachment.text !== undefined && attachment.base64 !== undefined) {
			return { error: `attachments[${index}] cannot provide both text and base64` };
		}

		attachments.push({
			fileName: attachment.fileName,
			mimeType: typeof attachment.mimeType === "string" ? attachment.mimeType : undefined,
			sizeBytes: typeof attachment.sizeBytes === "number" ? attachment.sizeBytes : undefined,
			text: typeof attachment.text === "string" ? attachment.text : undefined,
			base64: typeof attachment.base64 === "string" ? attachment.base64 : undefined,
		});
	}

	return { attachments };
}

function escapeContentDispositionFileName(fileName: string): string {
	return fileName.replace(/["\\\r\n]/g, "_");
}

function buildContentDispositionHeader(disposition: "inline" | "attachment", fileName: string): string {
	const safeFileName = escapeContentDispositionFileName(fileName);
	const asciiFallback = safeFileName.replace(/[^\x20-\x7e]/g, "_") || "download";
	return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeRFC5987ValueChars(safeFileName)}`;
}

function encodeRFC5987ValueChars(value: string): string {
	return encodeURIComponent(value).replace(/['()*]/g, (char) =>
		`%${char.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}

function resolveLocalArtifactPath(inputPath: string | undefined, projectRoot: string): string | undefined {
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

function resolveContentType(filePath: string): string {
	return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
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

function shouldForceDownload(value: string | number | boolean | undefined): boolean {
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

function supportsInlinePreview(mimeType: string): boolean {
	const normalized = String(mimeType ?? "").trim().toLowerCase();
	return (
		normalized.startsWith("image/png") ||
		normalized.startsWith("image/jpeg") ||
		normalized.startsWith("image/gif") ||
		normalized.startsWith("image/webp") ||
		normalized === "application/pdf" ||
		normalized === "text/plain" ||
		normalized === "text/markdown" ||
		normalized === "application/json" ||
		normalized === "text/csv"
	);
}
