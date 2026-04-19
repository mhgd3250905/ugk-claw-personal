import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { AssetStore } from "../../src/agent/asset-store.js";
import { getAppConfig } from "../../src/config.js";

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

function createProjectAssetStore(projectRoot: string): AssetStore {
	const config = getAppConfig(projectRoot);
	return new AssetStore({
		blobsDir: config.agentAssetBlobsDir,
		indexPath: config.assetIndexPath,
	});
}

function summarizeAsset(asset: {
	assetId: string;
	reference: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	kind: string;
	hasContent: boolean;
	source: string;
	conversationId: string;
	createdAt: string;
}): string {
	return [
		`assetId: ${asset.assetId}`,
		`reference: ${asset.reference}`,
		`fileName: ${asset.fileName}`,
		`mimeType: ${asset.mimeType}`,
		`sizeBytes: ${asset.sizeBytes}`,
		`kind: ${asset.kind}`,
		`hasContent: ${asset.hasContent ? "yes" : "no"}`,
		`source: ${asset.source}`,
		`conversationId: ${asset.conversationId}`,
		`createdAt: ${asset.createdAt}`,
	].join("\n");
}

const AssetStoreParams = Type.Object({
	action: Type.Union([Type.Literal("list"), Type.Literal("get"), Type.Literal("read_text")]),
	assetId: Type.Optional(Type.String({ description: "Required for get/read_text actions" })),
	conversationId: Type.Optional(Type.String({ description: "Optional conversation filter for list" })),
	limit: Type.Optional(Type.Number({ description: "List limit, default 20" })),
	maxChars: Type.Optional(Type.Number({ description: "Maximum number of text characters to return" })),
});

export default function assetStoreExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "asset_store",
		label: "Asset Store",
		description: "List reusable assets, inspect asset metadata, or read text asset contents by assetId.",
		parameters: AssetStoreParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const projectRoot = findProjectRoot(ctx.cwd);
			const assetStore = createProjectAssetStore(projectRoot);

			if (params.action === "list") {
				const assets = await assetStore.listAssets({
					conversationId: params.conversationId,
					limit: params.limit,
				});
				const text =
					assets.length > 0 ? assets.map((asset) => summarizeAsset(asset)).join("\n\n---\n\n") : "No matching assets found.";

				return {
					content: [{ type: "text", text }],
					details: {
						action: "list",
						count: assets.length,
						assets,
					},
				};
			}

			if (!params.assetId || params.assetId.trim().length === 0) {
				return {
					content: [{ type: "text", text: "assetId is required for this action." }],
					details: { action: params.action },
					isError: true,
				};
			}

			if (params.action === "get") {
				const asset = await assetStore.getAsset(params.assetId);
				if (!asset) {
					return {
						content: [{ type: "text", text: `Asset not found: ${params.assetId}` }],
						details: { action: "get", assetId: params.assetId },
						isError: true,
					};
				}

				return {
					content: [{ type: "text", text: summarizeAsset(asset) }],
					details: {
						action: "get",
						asset,
					},
				};
			}

			const text = await assetStore.readText(params.assetId, params.maxChars);
			if (typeof text !== "string") {
				return {
					content: [{ type: "text", text: `Text content is unavailable for asset ${params.assetId}.` }],
					details: { action: "read_text", assetId: params.assetId },
					isError: true,
				};
			}

			return {
				content: [{ type: "text", text }],
				details: {
					action: "read_text",
					assetId: params.assetId,
					textLength: text.length,
				},
			};
		},
	});
}
