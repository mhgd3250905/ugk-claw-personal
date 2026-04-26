import assert from "node:assert/strict";
import test from "node:test";
import { preparePromptAssets } from "../src/agent/agent-prompt-assets.js";
import type { AssetRecord, AssetStoreLike, ChatAttachment, StoredAssetRecord } from "../src/agent/asset-store.js";
import type { AgentFileArtifact } from "../src/agent/file-artifacts.js";

class FakeAssetStore implements AssetStoreLike {
	public registered: Array<{ conversationId: string; attachments: readonly ChatAttachment[] }> = [];
	private readonly assets = new Map<string, AssetRecord>();
	private readonly texts = new Map<string, string>();

	constructor(seedAssets: ReadonlyArray<{ asset: AssetRecord; text?: string }> = []) {
		for (const { asset, text } of seedAssets) {
			this.assets.set(asset.assetId, asset);
			if (text !== undefined) {
				this.texts.set(asset.assetId, text);
			}
		}
	}

	async registerAttachments(conversationId: string, attachments: readonly ChatAttachment[]): Promise<AssetRecord[]> {
		this.registered.push({ conversationId, attachments });
		return attachments.map((attachment, index) => {
			const asset: AssetRecord = {
				assetId: `upload-${index + 1}`,
				reference: `@asset[upload-${index + 1}]`,
				fileName: attachment.fileName,
				mimeType: attachment.mimeType ?? "application/octet-stream",
				sizeBytes: attachment.sizeBytes ?? 0,
				kind: typeof attachment.text === "string" ? "text" : "metadata",
				hasContent: typeof attachment.text === "string",
				source: "user_upload",
				conversationId,
				createdAt: "2026-04-26T00:00:00.000Z",
				...(typeof attachment.text === "string" ? { textPreview: attachment.text } : {}),
			};
			this.assets.set(asset.assetId, asset);
			if (typeof attachment.text === "string") {
				this.texts.set(asset.assetId, attachment.text);
			}
			return asset;
		});
	}

	async saveFiles(): Promise<AgentFileArtifact[]> {
		return [];
	}

	async listAssets(): Promise<AssetRecord[]> {
		return [...this.assets.values()];
	}

	async getAsset(assetId: string): Promise<AssetRecord | undefined> {
		return this.assets.get(assetId);
	}

	async resolveAssets(assetIds: readonly string[]): Promise<AssetRecord[]> {
		return assetIds.map((assetId) => this.assets.get(assetId)).filter((asset): asset is AssetRecord => Boolean(asset));
	}

	async readText(assetId: string): Promise<string | undefined> {
		return this.texts.get(assetId);
	}

	async getFile(): Promise<StoredAssetRecord | undefined> {
		return undefined;
	}
}

test("preparePromptAssets builds inline prompt assets when no asset store is configured", async () => {
	const result = await preparePromptAssets({
		conversationId: "manual:inline",
		attachments: [
			{
				fileName: "note.txt",
				mimeType: "text/plain",
				sizeBytes: 4,
				text: "note",
			},
			{
				fileName: "binary.bin",
			},
		],
	});

	assert.deepEqual(result.uploadedAssets, []);
	assert.deepEqual(
		result.promptAssets.map((asset) => ({
			assetId: asset.assetId,
			source: asset.source,
			kind: asset.kind,
			hasContent: asset.hasContent,
			textContent: asset.textContent,
			mimeType: asset.mimeType,
			sizeBytes: asset.sizeBytes,
		})),
		[
			{
				assetId: "inline-upload-1",
				source: "upload",
				kind: "text",
				hasContent: true,
				textContent: "note",
				mimeType: "text/plain",
				sizeBytes: 4,
			},
			{
				assetId: "inline-upload-2",
				source: "upload",
				kind: "metadata",
				hasContent: false,
				textContent: undefined,
				mimeType: "application/octet-stream",
				sizeBytes: 0,
			},
		],
	);
});

test("preparePromptAssets registers uploads and appends referenced asset text", async () => {
	const referencedAsset: AssetRecord = {
		assetId: "asset-existing",
		reference: "@asset[asset-existing]",
		fileName: "plan.md",
		mimeType: "text/markdown",
		sizeBytes: 12,
		kind: "text",
		hasContent: true,
		source: "user_upload",
		conversationId: "manual:old",
		createdAt: "2026-04-26T00:00:00.000Z",
		textPreview: "preview",
	};
	const assetStore = new FakeAssetStore([{ asset: referencedAsset, text: "full text" }]);

	const result = await preparePromptAssets({
		conversationId: "manual:assets",
		attachments: [{ fileName: "upload.txt", text: "upload text" }],
		assetRefs: ["asset-existing", "missing"],
		assetStore,
	});

	assert.equal(assetStore.registered.length, 1);
	assert.deepEqual(result.uploadedAssets.map((asset) => asset.assetId), ["upload-1"]);
	assert.deepEqual(
		result.promptAssets.map((asset) => ({
			assetId: asset.assetId,
			source: asset.source,
			textContent: asset.textContent,
		})),
		[
			{
				assetId: "upload-1",
				source: "upload",
				textContent: "upload text",
			},
			{
				assetId: "asset-existing",
				source: "reference",
				textContent: "full text",
			},
		],
	);
});
