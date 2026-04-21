import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { AssetStoreLike, StoredAssetRecord } from "./asset-store.js";

export interface BackgroundWorkspaceManagerOptions {
	backgroundDataDir: string;
	assetStore: Pick<AssetStoreLike, "getFile">;
}

export interface CreateRunWorkspaceInput {
	runId: string;
	connId: string;
	title: string;
	assetRefs: string[];
	now?: Date;
}

export interface RunWorkspace {
	rootPath: string;
	inputDir: string;
	workDir: string;
	outputDir: string;
	logsDir: string;
	sessionDir: string;
	manifestPath: string;
}

interface WorkspaceManifest {
	runId: string;
	connId: string;
	title: string;
	createdAt: string;
	assetRefs: string[];
	assets: WorkspaceManifestAsset[];
	directories: {
		input: string;
		work: string;
		output: string;
		logs: string;
		session: string;
	};
}

interface WorkspaceManifestAsset {
	assetId: string;
	reference: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	kind: string;
	hasContent: boolean;
	source: string;
	relativePath?: string;
}

export class BackgroundWorkspaceManager {
	constructor(private readonly options: BackgroundWorkspaceManagerOptions) {}

	async createRunWorkspace(input: CreateRunWorkspaceInput): Promise<RunWorkspace> {
		const workspace = this.resolveWorkspace(input.runId);
		await Promise.all([
			mkdir(workspace.inputDir, { recursive: true }),
			mkdir(workspace.workDir, { recursive: true }),
			mkdir(workspace.outputDir, { recursive: true }),
			mkdir(workspace.logsDir, { recursive: true }),
			mkdir(workspace.sessionDir, { recursive: true }),
		]);

		const assets = await this.snapshotInputAssets(workspace, input.assetRefs);
		const manifest: WorkspaceManifest = {
			runId: input.runId,
			connId: input.connId,
			title: input.title,
			createdAt: (input.now ?? new Date()).toISOString(),
			assetRefs: input.assetRefs,
			assets,
			directories: {
				input: "input",
				work: "work",
				output: "output",
				logs: "logs",
				session: "session",
			},
		};
		await writeFile(workspace.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
		return workspace;
	}

	private resolveWorkspace(runId: string): RunWorkspace {
		const safeRunId = sanitizePathSegment(runId);
		const rootPath = join(this.options.backgroundDataDir, "runs", safeRunId);
		return {
			rootPath,
			inputDir: join(rootPath, "input"),
			workDir: join(rootPath, "work"),
			outputDir: join(rootPath, "output"),
			logsDir: join(rootPath, "logs"),
			sessionDir: join(rootPath, "session"),
			manifestPath: join(rootPath, "manifest.json"),
		};
	}

	private async snapshotInputAssets(workspace: RunWorkspace, assetRefs: readonly string[]): Promise<WorkspaceManifestAsset[]> {
		const usedNames = new Set<string>();
		const assets: WorkspaceManifestAsset[] = [];

		for (const assetRef of assetRefs) {
			const asset = await this.options.assetStore.getFile(assetRef);
			if (!asset) {
				continue;
			}

			const fileName = sanitizeFileName(asset.fileName);
			const snapshotFileName = dedupeFileName(fileName, usedNames);
			const relativePath = asset.content ? join("input", snapshotFileName).replace(/\\/g, "/") : undefined;
			if (asset.content) {
				await writeFile(join(workspace.inputDir, snapshotFileName), asset.content);
			}

			assets.push(toManifestAsset(asset, fileName, relativePath));
		}

		return assets;
	}
}

function toManifestAsset(asset: StoredAssetRecord, fileName: string, relativePath: string | undefined): WorkspaceManifestAsset {
	return {
		assetId: asset.assetId,
		reference: asset.reference,
		fileName,
		mimeType: asset.mimeType,
		sizeBytes: asset.sizeBytes,
		kind: asset.kind,
		hasContent: asset.hasContent,
		source: asset.source,
		...(relativePath ? { relativePath } : {}),
	};
}

function dedupeFileName(fileName: string, usedNames: Set<string>): string {
	if (!usedNames.has(fileName)) {
		usedNames.add(fileName);
		return fileName;
	}

	const extension = extname(fileName);
	const stem = extension ? fileName.slice(0, -extension.length) : fileName;
	let index = 2;
	while (true) {
		const candidate = `${stem}-${index}${extension}`;
		if (!usedNames.has(candidate)) {
			usedNames.add(candidate);
			return candidate;
		}
		index += 1;
	}
}

function sanitizeFileName(fileName: string): string {
	const safeBaseName = basename(fileName).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
	return safeBaseName || "asset.bin";
}

function sanitizePathSegment(value: string): string {
	return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim() || "run";
}
