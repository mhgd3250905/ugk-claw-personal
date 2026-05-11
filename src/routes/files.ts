import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import type { AssetStoreLike, ChatAttachment } from "../agent/asset-store.js";
import {
	buildContentDispositionHeader,
	formatByteLimit,
	MAX_ASSET_UPLOAD_FILES,
	resolveContentType,
	resolveFileResponseContentType,
	resolveLocalArtifactPath,
	resolveMultipartAssetFileLimitBytes,
	shouldForceDownload,
	supportsInlinePreview,
	toMultipartAttachment,
	isMultipartUploadTooLargeError,
} from "./file-route-utils.js";
import { sendBadRequest, sendPayloadTooLarge } from "./http-errors.js";
import type {
	AssetDetailResponseBody,
	AssetListResponseBody,
	CreateAssetResponseBody,
	DeleteAssetResponseBody,
} from "../types/api.js";

export interface FileRouteOptions {
	assetStore: AssetStoreLike;
	projectRoot: string;
}

export function registerFileRoutes(app: FastifyInstance, options: FileRouteOptions): void {
	const multipartAssetFileLimitBytes = resolveMultipartAssetFileLimitBytes();
	app.register(multipart, {
		limits: {
			files: MAX_ASSET_UPLOAD_FILES,
			fileSize: multipartAssetFileLimitBytes,
			fields: 4,
			parts: MAX_ASSET_UPLOAD_FILES + 4,
		},
	});

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

	app.delete(
		"/v1/assets/:assetId",
		async (request, reply): Promise<DeleteAssetResponseBody | ReturnType<typeof reply.status>> => {
			const { assetId } = request.params as { assetId: string };
			if (!assetId || typeof options.assetStore.deleteAsset !== "function") {
				return reply.status(404).send();
			}

			const deleted = await options.assetStore.deleteAsset(assetId);
			if (!deleted) {
				return reply.status(404).send();
			}

			return {
				assetId,
				deleted: true,
			};
		},
	);

	app.post("/v1/assets/upload", async (request, reply): Promise<CreateAssetResponseBody | ReturnType<typeof reply.status>> => {
		const attachments: ChatAttachment[] = [];
		let conversationId = "";

		try {
			for await (const part of request.parts()) {
				if (part.type === "field") {
					if (part.fieldname === "conversationId") {
						conversationId = String(part.value || "").trim();
					}
					continue;
				}

				if (attachments.length >= MAX_ASSET_UPLOAD_FILES) {
					return sendBadRequest(reply, `Field "files" supports at most ${MAX_ASSET_UPLOAD_FILES} files`);
				}

				const content = await part.toBuffer();
				attachments.push(toMultipartAttachment(part.filename, part.mimetype, content));
			}
		} catch (error) {
			const statusCode = isMultipartUploadTooLargeError(error) ? 413 : 400;
			const message =
				statusCode === 413
					? `Uploaded files must be ${formatByteLimit(multipartAssetFileLimitBytes)} or smaller`
					: error instanceof Error
						? error.message
						: "Invalid multipart upload";
			return statusCode === 413 ? sendPayloadTooLarge(reply, message) : sendBadRequest(reply, message);
		}

		if (attachments.length === 0) {
			return sendBadRequest(reply, 'Field "files" must include at least one file');
		}

		return {
			assets: await options.assetStore.registerAttachments(
				conversationId || `manual:asset-upload:${randomUUID()}`,
				attachments,
			),
		};
	});

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

		const contentType = resolveFileResponseContentType(asset.mimeType);
		reply.header("content-type", contentType);
		reply.header("content-length", asset.sizeBytes);
		const disposition = shouldForceDownload(query?.download) || !supportsInlinePreview(contentType) ? "attachment" : "inline";
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
