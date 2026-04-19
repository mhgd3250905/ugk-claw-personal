import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AssetStore } from "../src/agent/asset-store.js";
import { createSendFileAsset, inferMimeType } from "../.pi/extensions/send-file.js";

test("createSendFileAsset registers a project file as an agent output asset", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-send-file-"));
	const dataDir = join(projectRoot, ".data", "agent");
	const outputDir = join(projectRoot, "output");
	await mkdir(outputDir, { recursive: true });

	const filePath = join(outputDir, "report.png");
	const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	await writeFile(filePath, pngBytes);

	const assetStore = new AssetStore({
		blobsDir: join(dataDir, "assets", "blobs"),
		indexPath: join(dataDir, "asset-index.json"),
	});

	const file = await createSendFileAsset({
		projectRoot,
		assetStore,
		conversationId: "manual:send-file",
		path: filePath,
	});

	assert.equal(file.fileName, "report.png");
	assert.equal(file.mimeType, "image/png");
	assert.equal(file.sizeBytes, pngBytes.byteLength);
	assert.match(file.downloadUrl, /^\/v1\/files\//);

	const stored = await assetStore.getFile(file.assetId);
	assert.equal(stored?.source, "agent_output");
	assert.deepEqual(stored?.content, pngBytes);
});

test("createSendFileAsset refuses paths outside the project root", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-send-file-root-"));
	const outsideDir = await mkdtemp(join(tmpdir(), "ugk-pi-send-file-outside-"));
	const outsideFile = join(outsideDir, "secret.txt");
	await writeFile(outsideFile, "nope", "utf8");

	const assetStore = new AssetStore({
		blobsDir: join(projectRoot, ".data", "agent", "assets", "blobs"),
		indexPath: join(projectRoot, ".data", "agent", "asset-index.json"),
	});

	await assert.rejects(
		createSendFileAsset({
			projectRoot,
			assetStore,
			conversationId: "manual:send-file",
			path: outsideFile,
		}),
		/inside the project root/,
	);
});

test("inferMimeType recognizes common report image and document formats", () => {
	assert.equal(inferMimeType("report.png"), "image/png");
	assert.equal(inferMimeType("report.html"), "text/html");
	assert.equal(inferMimeType("report.md"), "text/markdown");
	assert.equal(inferMimeType("archive.bin"), "application/octet-stream");
});
