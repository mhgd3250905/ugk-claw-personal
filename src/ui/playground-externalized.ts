import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { ReadStream } from "node:fs";
import { getPlaygroundRenderBundle } from "./playground.js";
import { renderPlaygroundHtml } from "./playground-page-shell.js";

export interface PlaygroundExternalizedPaths {
	factoryDir: string;
	runtimeDir: string;
}

export interface PlaygroundRuntimeFile {
	filePath: string;
	contentLength: number;
	contentType: string;
	stream: ReadStream;
}

const REQUIRED_RUNTIME_FILES = [
	"index.html",
	"styles.css",
	"app.js",
	"vendor/marked.umd.js",
	"manifest.json",
] as const;

const CONTENT_TYPES: Record<string, string> = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
};

export function isPlaygroundExternalizedEnabled(): boolean {
	const value = String(process.env.PLAYGROUND_EXTERNALIZED || "").trim().toLowerCase();
	return value === "1" || value === "true" || value === "yes" || value === "runtime";
}

export function resolvePlaygroundExternalizedPaths(projectRoot: string): PlaygroundExternalizedPaths {
	const runtimeRoot = resolve(join(projectRoot, "runtime"));
	return {
		factoryDir: resolve(join(runtimeRoot, "playground-factory")),
		runtimeDir: resolve(join(runtimeRoot, "playground")),
	};
}

export async function ensurePlaygroundRuntimeFiles(projectRoot: string): Promise<PlaygroundExternalizedPaths> {
	const paths = resolvePlaygroundExternalizedPaths(projectRoot);
	await writePlaygroundFactory(paths.factoryDir);
	await initializeRuntimeFromFactory(paths);
	return paths;
}

export async function resetPlaygroundRuntime(projectRoot: string): Promise<PlaygroundExternalizedPaths> {
	const paths = resolvePlaygroundExternalizedPaths(projectRoot);
	await writePlaygroundFactory(paths.factoryDir);
	await rm(paths.runtimeDir, { recursive: true, force: true });
	await copyFactoryToRuntime(paths);
	return paths;
}

export async function openPlaygroundRuntimeFile(
	projectRoot: string,
	relativePath: string,
	allowedExtensions: Set<string>,
): Promise<PlaygroundRuntimeFile | null> {
	const paths = await ensurePlaygroundRuntimeFiles(projectRoot);
	const normalizedRelativePath = relativePath.replace(/\\/g, "/");
	if (
		!normalizedRelativePath ||
		normalizedRelativePath.startsWith("/") ||
		normalizedRelativePath.includes("../") ||
		normalizedRelativePath.split("/").some((part) => !part || part.startsWith("."))
	) {
		return null;
	}
	if (basename(normalizedRelativePath) !== normalizedRelativePath.split("/").at(-1)) {
		return null;
	}

	const filePath = resolve(join(paths.runtimeDir, normalizedRelativePath));
	if (!isPathInside(filePath, paths.runtimeDir) || !allowedExtensions.has(extname(filePath).toLowerCase())) {
		return null;
	}

	try {
		const fileStat = await stat(filePath);
		if (!fileStat.isFile()) {
			return null;
		}
		return {
			filePath,
			contentLength: fileStat.size,
			contentType: CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
			stream: createReadStream(filePath),
		};
	} catch {
		return null;
	}
}

export async function readPlaygroundRuntimeIndex(projectRoot: string): Promise<string> {
	const paths = await ensurePlaygroundRuntimeFiles(projectRoot);
	return await readFile(join(paths.runtimeDir, "index.html"), "utf8");
}

async function writePlaygroundFactory(factoryDir: string): Promise<void> {
	const files = buildPlaygroundFactoryFiles();
	const manifestPath = join(factoryDir, "manifest.json");
	const nextHash = hashFactoryFiles(files);
	const currentManifest = await readJsonFile<{ sourceHash?: string }>(manifestPath);
	if (currentManifest?.sourceHash === nextHash && (await factoryFilesComplete(factoryDir, files))) {
		return;
	}

	for (const [relativePath, content] of Object.entries(files)) {
		const filePath = join(factoryDir, relativePath);
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, content, "utf8");
	}
	await writeFile(
		manifestPath,
		`${JSON.stringify(
			{
				generatedAt: new Date().toISOString(),
				mode: "playground-externalized-factory",
				sourceHash: nextHash,
				files: Object.keys(files).sort(),
			},
			null,
			2,
		)}\n`,
		"utf8",
	);
}

function buildPlaygroundFactoryFiles(): Record<string, string> {
	const bundle = getPlaygroundRenderBundle();
	const indexHtml = renderPlaygroundHtml({
		...bundle,
		stylesHref: "/playground/styles.css",
		markedBrowserScriptSrc: "/playground/vendor/marked.umd.js",
		playgroundScriptSrc: "/playground/app.js",
		extensionStylesHref: "/playground/extensions/custom-styles.css",
		extensionScriptSrc: "/playground/extensions/custom-scripts.js",
	});

	return {
		"index.html": indexHtml,
		"styles.css": bundle.styles,
		"app.js": bundle.playgroundScript,
		"vendor/marked.umd.js": bundle.markedBrowserScript,
		"extensions/custom-styles.css": "/* Runtime playground style overrides live here. */\n",
		"extensions/custom-scripts.js": "/* Runtime playground script overrides live here. */\n",
	};
}

async function initializeRuntimeFromFactory(paths: PlaygroundExternalizedPaths): Promise<void> {
	const factoryManifest = await readJsonFile<{ sourceHash?: string }>(join(paths.factoryDir, "manifest.json"));
	const runtimeManifest = await readJsonFile<{ sourceHash?: string }>(join(paths.runtimeDir, "manifest.json"));
	if (factoryManifest?.sourceHash && runtimeManifest?.sourceHash !== factoryManifest.sourceHash) {
		await copyFactoryRequiredFilesToRuntime(paths);
		await ensureRuntimeExtensionFiles(paths);
		return;
	}

	for (const relativePath of REQUIRED_RUNTIME_FILES) {
		try {
			const fileStat = await stat(join(paths.runtimeDir, relativePath));
			if (!fileStat.isFile()) {
				await copyFactoryToRuntime(paths);
				return;
			}
		} catch {
			await copyFactoryToRuntime(paths);
			return;
		}
	}
}

async function factoryFilesComplete(factoryDir: string, files: Record<string, string>): Promise<boolean> {
	for (const relativePath of [...Object.keys(files), "manifest.json"]) {
		try {
			const fileStat = await stat(join(factoryDir, relativePath));
			if (!fileStat.isFile()) {
				return false;
			}
		} catch {
			return false;
		}
	}
	return true;
}

async function copyFactoryToRuntime(paths: PlaygroundExternalizedPaths): Promise<void> {
	await copyFactoryPathsToRuntime(paths, [
		...REQUIRED_RUNTIME_FILES,
		"extensions/custom-styles.css",
		"extensions/custom-scripts.js",
	]);
}

async function copyFactoryRequiredFilesToRuntime(paths: PlaygroundExternalizedPaths): Promise<void> {
	await copyFactoryPathsToRuntime(paths, [...REQUIRED_RUNTIME_FILES]);
}

async function ensureRuntimeExtensionFiles(paths: PlaygroundExternalizedPaths): Promise<void> {
	for (const relativePath of ["extensions/custom-styles.css", "extensions/custom-scripts.js"]) {
		try {
			const fileStat = await stat(join(paths.runtimeDir, relativePath));
			if (fileStat.isFile()) {
				continue;
			}
		} catch {
			// Missing extension files are restored from the factory, but existing runtime overrides are preserved.
		}
		await copyFactoryPathsToRuntime(paths, [relativePath]);
	}
}

async function copyFactoryPathsToRuntime(paths: PlaygroundExternalizedPaths, relativePaths: readonly string[]): Promise<void> {
	for (const relativePath of relativePaths) {
		const sourcePath = join(paths.factoryDir, relativePath);
		const targetPath = join(paths.runtimeDir, relativePath);
		await mkdir(dirname(targetPath), { recursive: true });
		await copyFile(sourcePath, targetPath);
	}
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
	try {
		return JSON.parse(await readFile(filePath, "utf8")) as T;
	} catch {
		return null;
	}
}

function hashFactoryFiles(files: Record<string, string>): string {
	const hash = createHash("sha256");
	for (const key of Object.keys(files).sort()) {
		hash.update(key);
		hash.update("\0");
		hash.update(files[key] ?? "");
		hash.update("\0");
	}
	return hash.digest("hex");
}

function isPathInside(filePath: string, parentDir: string): boolean {
	const normalizedFilePath = resolve(filePath);
	const normalizedParentDir = resolve(parentDir);
	return (
		normalizedFilePath === normalizedParentDir ||
		normalizedFilePath.startsWith(`${normalizedParentDir}\\`) ||
		normalizedFilePath.startsWith(`${normalizedParentDir}/`)
	);
}
