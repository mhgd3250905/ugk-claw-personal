import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
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
	publicSiteId?: string;
	now?: Date;
}

export interface RunWorkspace {
	rootPath: string;
	inputDir: string;
	workDir: string;
	outputDir: string;
	logsDir: string;
	sessionDir: string;
	sharedDir: string;
	publicDir: string;
	sitePublicDir?: string;
	artifactPublicDir: string;
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
		shared: string;
		public: string;
		sitePublic?: string;
		artifactPublic: string;
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
		const workspace = this.resolveWorkspace(input.runId, input.connId, input.publicSiteId);
		await Promise.all([
			mkdir(workspace.inputDir, { recursive: true }),
			mkdir(workspace.workDir, { recursive: true }),
			mkdir(workspace.outputDir, { recursive: true }),
			mkdir(workspace.logsDir, { recursive: true }),
			mkdir(workspace.sessionDir, { recursive: true }),
			mkdir(workspace.sharedDir, { recursive: true }),
			mkdir(workspace.publicDir, { recursive: true }),
			mkdir(workspace.artifactPublicDir, { recursive: true }),
			...(workspace.sitePublicDir ? [mkdir(workspace.sitePublicDir, { recursive: true })] : []),
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
				shared: relative(workspace.rootPath, workspace.sharedDir).replace(/\\/g, "/"),
				public: relative(workspace.rootPath, workspace.publicDir).replace(/\\/g, "/"),
				artifactPublic: "artifact-public",
				...(workspace.sitePublicDir ? { sitePublic: relative(workspace.rootPath, workspace.sitePublicDir).replace(/\\/g, "/") } : {}),
			},
		};
		await writeFile(workspace.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
		return workspace;
	}

	private resolveWorkspace(runId: string, connId: string, publicSiteId?: string): RunWorkspace {
		const safeRunId = sanitizeBackgroundPathSegment(runId);
		const safeConnId = sanitizeBackgroundPathSegment(connId);
		const safeSiteId = publicSiteId ? sanitizeBackgroundPathSegment(publicSiteId) : undefined;
		const rootPath = join(this.options.backgroundDataDir, "runs", safeRunId);
		return {
			rootPath,
			inputDir: join(rootPath, "input"),
			workDir: join(rootPath, "work"),
			outputDir: join(rootPath, "output"),
			logsDir: join(rootPath, "logs"),
			sessionDir: join(rootPath, "session"),
			sharedDir: join(this.options.backgroundDataDir, "shared", safeConnId),
			publicDir: join(this.options.backgroundDataDir, "shared", safeConnId, "public"),
			artifactPublicDir: join(rootPath, "artifact-public"),
			...(safeSiteId ? { sitePublicDir: join(this.options.backgroundDataDir, "sites", safeSiteId, "public") } : {}),
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

export function sanitizeBackgroundPathSegment(value: string): string {
	const sanitized = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
	if (!sanitized || sanitized === "." || sanitized === "..") {
		return "run";
	}
	return sanitized.replace(/\.\./g, "__");
}
