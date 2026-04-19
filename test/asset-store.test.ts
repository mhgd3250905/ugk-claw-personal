import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AssetStore } from "../src/agent/asset-store.js";

async function createAssetStore(): Promise<AssetStore> {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-asset-store-"));
	return new AssetStore({
		blobsDir: join(dir, "assets", "blobs"),
		indexPath: join(dir, "asset-index.json"),
	});
}

test("registerAttachments stores a reusable text asset and reads it back", async () => {
	const store = await createAssetStore();

	const assets = await store.registerAttachments("manual:asset-1", [
		{
			fileName: "notes.txt",
			mimeType: "text/plain",
			sizeBytes: 10,
			text: "hello file",
		},
	]);

	assert.equal(assets.length, 1);
	assert.equal(assets[0]?.fileName, "notes.txt");
	assert.equal(assets[0]?.kind, "text");
	assert.equal(assets[0]?.hasContent, true);
	assert.match(assets[0]?.downloadUrl ?? "", /^\/v1\/files\//);
	assert.equal(await store.readText(assets[0]!.assetId), "hello file");

	const listed = await store.listAssets();
	assert.equal(listed.length, 1);
	assert.equal(listed[0]?.assetId, assets[0]?.assetId);
});

test("saveFiles reuses the same blob content while keeping separate asset records", async () => {
	const store = await createAssetStore();

	const first = await store.saveFiles("manual:first", [
		{
			fileName: "report.txt",
			mimeType: "text/plain",
			content: "same content",
		},
	]);
	const second = await store.saveFiles("manual:second", [
		{
			fileName: "report.txt",
			mimeType: "text/plain",
			content: "same content",
		},
	]);

	assert.equal(first.length, 1);
	assert.equal(second.length, 1);
	assert.notEqual(first[0]?.assetId, second[0]?.assetId);

	const firstMeta = await store.getAsset(first[0]!.assetId);
	const secondMeta = await store.getAsset(second[0]!.assetId);
	assert.equal(firstMeta?.sha256, secondMeta?.sha256);
});
