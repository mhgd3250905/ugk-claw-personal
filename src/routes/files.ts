import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import type { AssetStoreLike } from "../agent/asset-store.js";
import type { AssetDetailResponseBody, AssetListResponseBody } from "../types/api.js";

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
	const normalizedInput = String(inputPath || "").trim();
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
