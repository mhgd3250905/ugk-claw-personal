import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AssetStore } from "../src/agent/asset-store.js";

interface AssetStoreTestContext {
	store: AssetStore;
	blobsDir: string;
	indexPath: string;
}

async function createAssetStoreContext(): Promise<AssetStoreTestContext> {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-asset-store-"));
	const blobsDir = join(dir, "assets", "blobs");
	const indexPath = join(dir, "asset-index.json");
	return {
		store: new AssetStore({
			blobsDir,
			indexPath,
		}),
		blobsDir,
		indexPath,
	};
}

async function createAssetStore(): Promise<AssetStore> {
	return (await createAssetStoreContext()).store;
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

test("deleteAsset removes the selected asset without deleting shared blob content still in use", async () => {
	const { store, blobsDir } = await createAssetStoreContext();

	const first = await store.saveFiles("manual:first", [
		{
			fileName: "first.txt",
			mimeType: "text/plain",
			content: "same content",
		},
	]);
	const second = await store.saveFiles("manual:second", [
		{
			fileName: "second.txt",
			mimeType: "text/plain",
			content: "same content",
		},
	]);
	const firstAssetId = first[0]!.assetId;
	const secondAssetId = second[0]!.assetId;
	const secondFile = await store.getFile(secondAssetId);

	assert.equal(await store.deleteAsset(firstAssetId), true);
	assert.equal(await store.getAsset(firstAssetId), undefined);
	assert.equal((await store.getFile(secondAssetId))?.content?.toString("utf8"), "same content");
	assert.deepEqual(
		(await store.listAssets({ limit: 10 })).map((asset) => asset.assetId),
		[secondAssetId],
	);

	assert.equal(await store.deleteAsset(secondAssetId), true);
	assert.equal(await store.deleteAsset("missing-asset"), false);
	assert.equal(await store.getAsset(secondAssetId), undefined);
	if (secondFile?.sha256) {
		await assert.rejects(access(join(blobsDir, secondFile.sha256)));
	}
});

test("registerAttachments preserves every asset across concurrent index writes", async () => {
	const { store, indexPath } = await createAssetStoreContext();

	await Promise.all(
		Array.from({ length: 24 }, async (_, index) =>
			store.registerAttachments(`manual:upload-${index}`, [
				{
					fileName: `notes-${index}.txt`,
					mimeType: "text/plain",
					sizeBytes: 12,
					text: `hello file ${index}`,
				},
			]),
		),
	);

	const listed = await store.listAssets({ limit: 100 });
	assert.equal(listed.length, 24);
	assert.deepEqual(
		new Set(listed.map((asset) => asset.fileName)),
		new Set(Array.from({ length: 24 }, (_, index) => `notes-${index}.txt`)),
	);
	const persisted = JSON.parse(await readFile(indexPath, "utf8")) as Record<string, unknown>;
	assert.equal(Object.keys(persisted).length, 24);
});

test("saveFiles and registerAttachments share one serialized asset index", async () => {
	const { store, indexPath } = await createAssetStoreContext();

	await Promise.all([
		...Array.from({ length: 12 }, async (_, index) =>
			store.registerAttachments(`manual:upload-${index}`, [
				{
					fileName: `upload-${index}.txt`,
					mimeType: "text/plain",
					sizeBytes: 8,
					text: `upload ${index}`,
				},
			]),
		),
		...Array.from({ length: 12 }, async (_, index) =>
			store.saveFiles(`manual:output-${index}`, [
				{
					fileName: `output-${index}.txt`,
					mimeType: "text/plain",
					content: `output ${index}`,
				},
			]),
		),
	]);

	const listed = await store.listAssets({ limit: 100 });
	assert.equal(listed.length, 24);
	assert.equal(listed.filter((asset) => asset.source === "user_upload").length, 12);
	assert.equal(listed.filter((asset) => asset.source === "agent_output").length, 12);

	const persisted = JSON.parse(await readFile(indexPath, "utf8")) as Record<string, unknown>;
	assert.equal(Object.keys(persisted).length, 24);
});

test("listAssets ignores malformed index entries and disables unsafe blob downloads", async () => {
	const { store, indexPath } = await createAssetStoreContext();
	const outsideBlobPath = join(tmpdir(), "ugk-pi-asset-store-outside.txt");
	await writeFile(
		indexPath,
		JSON.stringify(
			{
				"asset-valid": {
					assetId: "asset-valid",
					fileName: "valid.txt",
					mimeType: "text/plain",
					sizeBytes: 12,
					kind: "text",
					hasContent: false,
					source: "user_upload",
					conversationId: "manual:valid",
					createdAt: "2026-04-18T10:00:00.000Z",
				},
				"asset-unsafe": {
					assetId: "asset-unsafe",
					fileName: "unsafe.txt",
					mimeType: "text/plain",
					sizeBytes: 6,
					kind: "text",
					hasContent: true,
					source: "agent_output",
					conversationId: "manual:valid",
					createdAt: "2026-04-19T10:00:00.000Z",
					blobPath: outsideBlobPath,
				},
				"asset-blank": {},
				"asset-null": null,
				"asset-bad-date": {
					assetId: "asset-bad-date",
					fileName: "bad-date.txt",
					mimeType: "text/plain",
					sizeBytes: 2,
					kind: "text",
					hasContent: false,
					source: "user_upload",
					conversationId: "manual:valid",
					createdAt: 123,
				},
			},
			null,
			2,
		),
		"utf8",
	);

	const assets = await store.listAssets({ limit: 10 });

	assert.deepEqual(
		assets.map((asset) => ({
			assetId: asset.assetId,
			downloadUrl: asset.downloadUrl,
			hasContent: asset.hasContent,
		})),
		[
			{
				assetId: "asset-unsafe",
				downloadUrl: undefined,
				hasContent: false,
			},
			{
				assetId: "asset-valid",
				downloadUrl: undefined,
				hasContent: false,
			},
		],
	);
	assert.equal(await store.getAsset("asset-blank"), undefined);
});
