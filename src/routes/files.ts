import type { FastifyInstance } from "fastify";
import type { AssetStoreLike } from "../agent/asset-store.js";
import type { AssetDetailResponseBody, AssetListResponseBody } from "../types/api.js";

export interface FileRouteOptions {
	assetStore: AssetStoreLike;
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
		reply.header("content-disposition", `${disposition}; filename="${escapeContentDispositionFileName(asset.fileName)}"`);
		return reply.send(asset.content);
	});
}

function escapeContentDispositionFileName(fileName: string): string {
	return fileName.replace(/["\\\r\n]/g, "_");
}

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
