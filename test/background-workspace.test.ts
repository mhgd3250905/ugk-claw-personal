import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BackgroundWorkspaceManager } from "../src/agent/background-workspace.js";
import type { AssetRecord, AssetStoreLike, ChatAttachment, StoredAssetRecord } from "../src/agent/asset-store.js";
import type { AgentFileArtifact, AgentFileDraft } from "../src/agent/file-artifacts.js";

class FakeAssetStore implements AssetStoreLike {
	constructor(private readonly files: Record<string, StoredAssetRecord>) {}

	async registerAttachments(_conversationId: string, _attachments: readonly ChatAttachment[]): Promise<AssetRecord[]> {
		return [];
	}

	async saveFiles(_conversationId: string, _files: readonly AgentFileDraft[]): Promise<AgentFileArtifact[]> {
		return [];
	}

	async listAssets(): Promise<AssetRecord[]> {
		return Object.values(this.files).map(stripContent);
	}

	async getAsset(assetId: string): Promise<AssetRecord | undefined> {
		const file = this.files[assetId];
		return file ? stripContent(file) : undefined;
	}

	async resolveAssets(assetIds: readonly string[]): Promise<AssetRecord[]> {
		return assetIds.map((assetId) => this.files[assetId]).filter(Boolean).map(stripContent);
	}

	async readText(assetId: string): Promise<string | undefined> {
		const file = this.files[assetId];
		return file?.content?.toString("utf8");
	}

	async getFile(assetId: string): Promise<StoredAssetRecord | undefined> {
		return this.files[assetId];
	}
}

function stripContent(file: StoredAssetRecord): AssetRecord {
	const { content: _content, ...asset } = file;
	return asset;
}

function createStoredAsset(input: {
	assetId: string;
	fileName: string;
	mimeType: string;
	content?: Buffer;
}): StoredAssetRecord {
	return {
		assetId: input.assetId,
		reference: `@asset[${input.assetId}]`,
		fileName: input.fileName,
		mimeType: input.mimeType,
		sizeBytes: input.content?.byteLength ?? 0,
		kind: input.mimeType.startsWith("text/") ? "text" : "binary",
		hasContent: Boolean(input.content),
		source: "user_upload",
		conversationId: "manual:conn",
		createdAt: "2026-04-21T10:00:00.000Z",
		...(input.content ? { content: input.content } : {}),
	};
}

test("BackgroundWorkspaceManager creates run workspace directories and manifest", async () => {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-background-workspace-"));
	const manager = new BackgroundWorkspaceManager({
		backgroundDataDir: root,
		assetStore: new FakeAssetStore({}),
	});

	const workspace = await manager.createRunWorkspace({
		runId: "run-1",
		connId: "conn-1",
		title: "Daily Digest",
		assetRefs: [],
		now: new Date("2026-04-21T10:01:00.000Z"),
	});

	await assert.doesNotReject(() => stat(workspace.inputDir));
	await assert.doesNotReject(() => stat(workspace.workDir));
	await assert.doesNotReject(() => stat(workspace.outputDir));
	await assert.doesNotReject(() => stat(workspace.logsDir));
	await assert.doesNotReject(() => stat(workspace.sessionDir));
	await assert.doesNotReject(() => stat(workspace.sharedDir));
	await assert.doesNotReject(() => stat(workspace.publicDir));
	assert.equal(workspace.sharedDir, join(root, "shared", "conn-1"));
	assert.equal(workspace.publicDir, join(root, "shared", "conn-1", "public"));

	const manifest = JSON.parse(await readFile(workspace.manifestPath, "utf8")) as Record<string, unknown>;
	assert.equal(manifest.runId, "run-1");
	assert.equal(manifest.connId, "conn-1");
	assert.equal(manifest.title, "Daily Digest");
	assert.equal(manifest.createdAt, "2026-04-21T10:01:00.000Z");
	assert.deepEqual(manifest.assetRefs, []);
	assert.deepEqual(manifest.assets, []);
	assert.deepEqual((manifest.directories as Record<string, string>).shared, "../../shared/conn-1");
	assert.deepEqual((manifest.directories as Record<string, string>).public, "../../shared/conn-1/public");
});

test("BackgroundWorkspaceManager reuses a conn-scoped shared directory across runs", async () => {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-background-workspace-"));
	const manager = new BackgroundWorkspaceManager({
		backgroundDataDir: root,
		assetStore: new FakeAssetStore({}),
	});

	const first = await manager.createRunWorkspace({
		runId: "run-a",
		connId: "conn/shared:daily",
		title: "Daily Digest",
		assetRefs: [],
	});
	const second = await manager.createRunWorkspace({
		runId: "run-b",
		connId: "conn/shared:daily",
		title: "Daily Digest",
		assetRefs: [],
	});

	assert.equal(first.sharedDir, second.sharedDir);
	assert.equal(first.sharedDir, join(root, "shared", "conn_shared_daily"));
	await assert.doesNotReject(() => stat(first.sharedDir));
});

test("BackgroundWorkspaceManager sanitizes public site ids before creating site directories", async () => {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-background-workspace-"));
	const manager = new BackgroundWorkspaceManager({
		backgroundDataDir: root,
		assetStore: new FakeAssetStore({}),
	});

	const workspace = await manager.createRunWorkspace({
		runId: "run-site",
		connId: "conn-1",
		title: "Site Builder",
		assetRefs: [],
		publicSiteId: "../team-site",
	});

	assert.equal(workspace.sitePublicDir, join(root, "sites", "___team-site", "public"));
	await assert.doesNotReject(() => stat(workspace.sitePublicDir!));
});

test("BackgroundWorkspaceManager snapshots input assets and deduplicates filenames", async () => {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-background-workspace-"));
	const assetStore = new FakeAssetStore({
		"asset-1": createStoredAsset({
			assetId: "asset-1",
			fileName: "notes.md",
			mimeType: "text/markdown",
			content: Buffer.from("# first", "utf8"),
		}),
		"asset-2": createStoredAsset({
			assetId: "asset-2",
			fileName: "notes.md",
			mimeType: "text/markdown",
			content: Buffer.from("# second", "utf8"),
		}),
		"asset-3": createStoredAsset({
			assetId: "asset-3",
			fileName: "../unsafe?.txt",
			mimeType: "text/plain",
			content: Buffer.from("safe name", "utf8"),
		}),
	});
	const manager = new BackgroundWorkspaceManager({
		backgroundDataDir: root,
		assetStore,
	});

	const workspace = await manager.createRunWorkspace({
		runId: "run-2",
		connId: "conn-1",
		title: "Daily Digest",
		assetRefs: ["asset-1", "asset-2", "asset-3"],
		now: new Date("2026-04-21T10:01:00.000Z"),
	});

	assert.equal(await readFile(join(workspace.inputDir, "notes.md"), "utf8"), "# first");
	assert.equal(await readFile(join(workspace.inputDir, "notes-2.md"), "utf8"), "# second");
	assert.equal(await readFile(join(workspace.inputDir, "unsafe_.txt"), "utf8"), "safe name");

	const manifest = JSON.parse(await readFile(workspace.manifestPath, "utf8")) as {
		assets: Array<{ assetId: string; fileName: string; relativePath: string }>;
	};
	assert.deepEqual(
		manifest.assets.map((asset) => ({
			assetId: asset.assetId,
			fileName: asset.fileName,
			relativePath: asset.relativePath,
		})),
		[
			{ assetId: "asset-1", fileName: "notes.md", relativePath: "input/notes.md" },
			{ assetId: "asset-2", fileName: "notes.md", relativePath: "input/notes-2.md" },
			{ assetId: "asset-3", fileName: "unsafe_.txt", relativePath: "input/unsafe_.txt" },
		],
	);
});
