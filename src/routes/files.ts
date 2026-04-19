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
		if (!fileId) {
			return reply.status(404).send();
		}

		const asset = await options.assetStore.getFile(fileId);
		if (!asset || !asset.content) {
			return reply.status(404).send();
		}

		reply.type(asset.mimeType);
		reply.header("content-length", asset.sizeBytes);
		reply.header("content-disposition", `attachment; filename="${escapeContentDispositionFileName(asset.fileName)}"`);
		return reply.send(asset.content);
	});
}

function escapeContentDispositionFileName(fileName: string): string {
	return fileName.replace(/["\\\r\n]/g, "_");
}
