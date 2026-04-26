import type { AssetRecord, AssetStoreLike, ChatAttachment } from "./asset-store.js";
import {
	toPromptAssetFromStoredAsset,
	type PromptAssetContextEntry,
} from "./file-artifacts.js";

export interface PreparePromptAssetsInput {
	conversationId: string;
	attachments?: readonly ChatAttachment[];
	assetRefs?: readonly string[];
	assetStore?: AssetStoreLike;
}

export interface PreparedPromptAssets {
	uploadedAssets: AssetRecord[];
	promptAssets: PromptAssetContextEntry[];
}

export async function preparePromptAssets(input: PreparePromptAssetsInput): Promise<PreparedPromptAssets> {
	if (!input.assetStore) {
		return {
			uploadedAssets: [],
			promptAssets: buildInlinePromptAssets(input.attachments),
		};
	}

	const uploadedAssets =
		input.attachments && input.attachments.length > 0
			? await input.assetStore.registerAttachments(input.conversationId, input.attachments)
			: [];
	const referencedAssets =
		input.assetRefs && input.assetRefs.length > 0 ? await input.assetStore.resolveAssets(input.assetRefs) : [];

	const uploadedPromptAssets = uploadedAssets.map((asset, index) =>
		toPromptAssetFromStoredAsset(asset, {
			source: "upload",
			textContent: input.attachments?.[index]?.text,
		}),
	);

	const referencedPromptAssets = await Promise.all(
		referencedAssets.map(async (asset) =>
			toPromptAssetFromStoredAsset(asset, {
				source: "reference",
				textContent: await input.assetStore?.readText(asset.assetId),
			}),
		),
	);

	return {
		uploadedAssets,
		promptAssets: [...uploadedPromptAssets, ...referencedPromptAssets],
	};
}

function buildInlinePromptAssets(
	attachments: readonly ChatAttachment[] | undefined,
): PromptAssetContextEntry[] {
	return (
		attachments?.map((attachment, index) => ({
			assetId: `inline-upload-${index + 1}`,
			reference: `@asset[inline-upload-${index + 1}]`,
			fileName: attachment.fileName,
			mimeType: attachment.mimeType?.trim() || "application/octet-stream",
			sizeBytes: Number.isFinite(attachment.sizeBytes) ? attachment.sizeBytes ?? 0 : 0,
			kind: typeof attachment.text === "string" ? "text" : "metadata",
			hasContent: typeof attachment.text === "string",
			source: "upload",
			...(typeof attachment.text === "string" ? { textContent: attachment.text } : {}),
		})) ?? []
	);
}
