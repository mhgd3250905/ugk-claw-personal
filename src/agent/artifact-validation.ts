import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import type { RunWorkspace } from "./background-workspace.js";
import type {
	ArtifactCheck,
	ArtifactCheckType,
	ArtifactContract,
	ArtifactExpectedKind,
} from "./artifact-contract.js";

export interface ArtifactValidationInput {
	workspace: RunWorkspace;
	contract: ArtifactContract;
	resultText: string;
}

export interface ArtifactValidationIssue {
	severity: "error" | "warning";
	code: string;
	message: string;
	path?: string;
	suggestion?: string;
}

export interface ArtifactCandidate {
	kind: "file" | "web";
	path: string;
	entryPath?: string;
	fileName?: string;
	sizeBytes?: number;
}

export interface ArtifactValidationResult {
	ok: boolean;
	issues: ArtifactValidationIssue[];
	warnings: ArtifactValidationIssue[];
	candidates: ArtifactCandidate[];
	summary: string;
}

const MAX_FILES = 200;
const MAX_FILE_SIZE = 64 * 1024 * 1024;

const SENSITIVE_PATTERNS: RegExp[] = [
	/\.env$/i,
	/\.env\./i,
	/id_rsa$/i,
	/id_dsa$/i,
	/id_ed25519$/i,
	/\.pem$/i,
	/\.key$/i,
	/\.p12$/i,
	/\.pfx$/i,
	/token.*\.(json|txt|env)$/i,
	/secret.*\.(json|txt|env)$/i,
	/cookie.*\.(json|txt|env)$/i,
	/\.sqlite$/i,
	/\.sqlite3$/i,
	/\.db$/i,
];

export async function validateArtifactDelivery(
	input: ArtifactValidationInput,
): Promise<ArtifactValidationResult> {
	const { workspace, contract, resultText } = input;
	const issues: ArtifactValidationIssue[] = [];
	const warnings: ArtifactValidationIssue[] = [];
	const candidates: ArtifactCandidate[] = [];

	const artifactDir = workspace.artifactPublicDir;
	const files = await scanDirectory(artifactDir);

	for (const check of contract.checks) {
		const checkIssues = await runCheck(check, artifactDir, files, resultText, contract.expectedKind);
		for (const issue of checkIssues) {
			if (issue.severity === "error") {
				issues.push(issue);
			} else {
				warnings.push(issue);
			}
		}
	}

	if (files.length === 0) {
		await discoverCandidates(candidates, workspace);
	}

	const summary =
		issues.length === 0
			? `Artifact validation passed (${files.length} file(s), ${warnings.length} warning(s))`
			: `Artifact validation failed: ${issues.map((i) => i.message).join("; ")}`;

	return {
		ok: issues.length === 0,
		issues,
		warnings,
		candidates,
		summary,
	};
}

async function scanDirectory(dir: string): Promise<string[]> {
	const results: string[] = [];
	await scanDirRecursive(dir, dir, results);
	return results;
}

async function scanDirRecursive(
	currentDir: string,
	rootDir: string,
	results: string[],
): Promise<void> {
	if (results.length >= MAX_FILES) return;

	let entries;
	try {
		entries = await readdir(currentDir, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		if (results.length >= MAX_FILES) return;
		const name = entry.name;
		if (!name) continue;

		const fullPath = join(currentDir, name);
		const resolved = resolve(fullPath);
		if (!resolved.startsWith(resolve(rootDir))) continue;

		if (entry.isDirectory()) {
			await scanDirRecursive(fullPath, rootDir, results);
		} else if (entry.isFile()) {
			try {
				const fileStat = await stat(fullPath);
				if (fileStat.size <= MAX_FILE_SIZE) {
					results.push(fullPath);
				}
			} catch {
				continue;
			}
		}
	}
}

async function runCheck(
	check: ArtifactCheck,
	artifactDir: string,
	files: string[],
	resultText: string,
	expectedKind: ArtifactExpectedKind,
): Promise<ArtifactValidationIssue[]> {
	switch (check.type) {
		case "artifact_public_not_empty":
			return checkNotEmpty(artifactDir, files);
		case "file_not_empty":
			return checkFilesNotEmpty(artifactDir, files);
		case "format_matches":
			return checkFormatMatches(artifactDir, files, expectedKind);
		case "xlsx_can_open":
			return checkXlsxCanOpen(artifactDir, files);
		case "pdf_header_valid":
			return checkPdfHeader(artifactDir, files);
		case "web_entry_exists":
			return checkWebEntryExists(artifactDir, files);
		case "html_local_assets_exist":
			return checkHtmlLocalAssets(artifactDir, files);
		case "no_container_paths":
			return checkNoContainerPaths(resultText);
		case "no_file_url":
			return checkNoFileUrl(resultText);
		case "no_sensitive_files":
			return checkNoSensitiveFiles(artifactDir, files);
		case "file_exists":
			return [];
		default:
			return [];
	}
}

function checkNotEmpty(
	artifactDir: string,
	files: string[],
): ArtifactValidationIssue[] {
	if (files.length === 0) {
		return [
			{
				severity: "error",
				code: "artifact_public_empty",
				message: "Official artifact delivery directory is empty",
				path: artifactDir,
				suggestion:
					"Put all user-facing files into ARTIFACT_PUBLIC_DIR",
			},
		];
	}
	return [];
}

async function checkFilesNotEmpty(
	artifactDir: string,
	files: string[],
): Promise<ArtifactValidationIssue[]> {
	const issues: ArtifactValidationIssue[] = [];
	for (const filePath of files) {
		try {
			const fileStat = await stat(filePath);
			if (fileStat.size === 0) {
				issues.push({
					severity: "error",
					code: "file_empty",
					message: `File is empty: ${relative(artifactDir, filePath)}`,
					path: filePath,
					suggestion: "Remove or replace empty file",
				});
			}
		} catch {
			continue;
		}
	}
	return issues;
}

async function checkFormatMatches(
	artifactDir: string,
	files: string[],
	expectedKind: ArtifactExpectedKind,
): Promise<ArtifactValidationIssue[]> {
	const issues: ArtifactValidationIssue[] = [];
	const extensionMap: Record<string, string[]> = {
		xlsx: [".xlsx"],
		pdf: [".pdf"],
		csv: [".csv"],
		markdown: [".md", ".markdown"],
		web: [".html", ".htm"],
	};

	const expectedExtensions = extensionMap[expectedKind];
	if (!expectedExtensions) return [];

	const matchingFiles = files.filter((f) => {
		const ext = extname(f).toLowerCase();
		return expectedExtensions.includes(ext);
	});

	if (matchingFiles.length === 0 && files.length > 0) {
		issues.push({
			severity: "error",
			code: "format_mismatch",
			message: `Expected ${expectedKind} file(s) (${expectedExtensions.join("/")}) but found: ${files.map((f) => relative(artifactDir, f)).join(", ")}`,
			suggestion: `Add a ${expectedExtensions[0]} file to ARTIFACT_PUBLIC_DIR`,
		});
	}

	return issues;
}

async function checkXlsxCanOpen(
	artifactDir: string,
	files: string[],
): Promise<ArtifactValidationIssue[]> {
	const issues: ArtifactValidationIssue[] = [];
	const xlsxFiles = files.filter((f) =>
		extname(f).toLowerCase() === ".xlsx",
	);

	for (const filePath of xlsxFiles) {
		try {
			const fd = await import("node:fs/promises").then((m) =>
				m.open(filePath, "r"),
			);
			const buffer = Buffer.alloc(4);
			await fd.read(buffer, 0, 4, 0);
			await fd.close();
			const header = buffer.toString("ascii");
			if (!header.startsWith("PK")) {
				issues.push({
					severity: "error",
					code: "xlsx_invalid_header",
					message: `File has .xlsx extension but is not a valid ZIP/XLSX: ${relative(artifactDir, filePath)}`,
					path: filePath,
					suggestion: "Replace with a valid .xlsx file",
				});
			}
		} catch {
			continue;
		}
	}
	return issues;
}

async function checkPdfHeader(
	artifactDir: string,
	files: string[],
): Promise<ArtifactValidationIssue[]> {
	const issues: ArtifactValidationIssue[] = [];
	const pdfFiles = files.filter((f) =>
		extname(f).toLowerCase() === ".pdf",
	);

	for (const filePath of pdfFiles) {
		try {
			const fd = await import("node:fs/promises").then((m) =>
				m.open(filePath, "r"),
			);
			const buffer = Buffer.alloc(5);
			await fd.read(buffer, 0, 5, 0);
			await fd.close();
			const header = buffer.toString("ascii");
			if (!header.startsWith("%PDF-")) {
				issues.push({
					severity: "error",
					code: "pdf_invalid_header",
					message: `File has .pdf extension but header is not %PDF-: ${relative(artifactDir, filePath)}`,
					path: filePath,
					suggestion: "Replace with a valid PDF file",
				});
			}
		} catch {
			continue;
		}
	}
	return issues;
}

function checkWebEntryExists(
	artifactDir: string,
	files: string[],
): ArtifactValidationIssue[] {
	const indexFiles = files.filter((f) => {
		const rel = relative(artifactDir, f).replace(/\\/g, "/");
		return (
			rel === "index.html" ||
			/^[^/]+\/index\.html$/.test(rel)
		);
	});

	if (indexFiles.length === 0) {
		return [
			{
				severity: "error",
				code: "web_entry_missing",
				message:
					"No index.html found in artifact directory or immediate subdirectories",
				path: artifactDir,
				suggestion:
					"Create index.html in ARTIFACT_PUBLIC_DIR or a subdirectory",
			},
		];
	}
	return [];
}

async function checkHtmlLocalAssets(
	artifactDir: string,
	files: string[],
): Promise<ArtifactValidationIssue[]> {
	const issues: ArtifactValidationIssue[] = [];
	const htmlFiles = files.filter((f) => {
		const ext = extname(f).toLowerCase();
		return ext === ".html" || ext === ".htm";
	});

	for (const htmlPath of htmlFiles) {
		try {
			const content = await readFile(htmlPath, "utf-8");
			const htmlDir = resolve(htmlPath, "..");
			const localRefs = extractLocalAssetRefs(content);

			for (const ref of localRefs) {
				if (ref.startsWith("/")) {
					if (ref.startsWith("/app/") || ref.startsWith("/tmp/")) {
						issues.push({
							severity: "error",
							code: "html_container_path",
							message: `HTML references container path "${ref}" in ${relative(artifactDir, htmlPath)}`,
							path: htmlPath,
							suggestion:
								"Use relative paths instead of absolute container paths",
						});
					} else {
						issues.push({
							severity: "warning",
							code: "html_absolute_path",
							message: `HTML references absolute path "${ref}" in ${relative(artifactDir, htmlPath)}`,
							path: htmlPath,
							suggestion:
								"Consider using a relative path instead",
						});
					}
					continue;
				}
				if (ref.startsWith("file://")) {
					issues.push({
						severity: "error",
						code: "html_file_url",
						message: `HTML references file:// URL "${ref}" in ${relative(artifactDir, htmlPath)}`,
						path: htmlPath,
						suggestion: "Use a relative path instead of file://",
					});
					continue;
				}

				const assetPath = resolve(htmlDir, ref);
				if (!assetPath.startsWith(resolve(artifactDir))) continue;

				const assetFile = files.find(
					(f) => resolve(f) === assetPath,
				);
				if (!assetFile) {
					try {
						const s = await stat(assetPath);
						if (!s.isFile()) {
							issues.push({
								severity: "error",
								code: "html_asset_missing",
								message: `HTML references missing local asset "${ref}" in ${relative(artifactDir, htmlPath)}`,
								path: htmlPath,
								suggestion: `Create the file at ${relative(artifactDir, assetPath)}`,
							});
						}
					} catch {
						issues.push({
							severity: "error",
							code: "html_asset_missing",
							message: `HTML references missing local asset "${ref}" in ${relative(artifactDir, htmlPath)}`,
							path: htmlPath,
							suggestion: `Create the file at ${relative(artifactDir, assetPath)}`,
						});
					}
				}
			}
		} catch {
			continue;
		}
	}
	return issues;
}

function extractLocalAssetRefs(html: string): string[] {
	const refs = new Set<string>();
	const patterns = [
		/<link[^>]+href=["']([^"']+)["']/gi,
		/<script[^>]+src=["']([^"']+)["']/gi,
		/<img[^>]+src=["']([^"']+)["']/gi,
		/<source[^>]+src=["']([^"']+)["']/gi,
		/<video[^>]+src=["']([^"']+)["']/gi,
		/<audio[^>]+src=["']([^"']+)["']/gi,
	];

	for (const pattern of patterns) {
		for (const match of html.matchAll(pattern)) {
			const ref = match[1];
			if (
				ref.startsWith("http://") ||
				ref.startsWith("https://") ||
				ref.startsWith("data:") ||
				ref.startsWith("mailto:")
			) {
				continue;
			}
			refs.add(ref.split(/[?#]/, 1)[0]);
		}
	}
	return Array.from(refs);
}

function checkNoContainerPaths(
	resultText: string,
): ArtifactValidationIssue[] {
	const issues: ArtifactValidationIssue[] = [];
	const decodedResultText = decodeRepeatedly(resultText);
	const searchableText = `${resultText}\n${decodedResultText}`;
	if (/\/app\//.test(searchableText)) {
		issues.push({
			severity: "error",
			code: "container_path_in_result",
			message:
				'Result text contains container path "/app/". Do not use container paths as user-facing links.',
			suggestion:
				"Only ARTIFACT_PUBLIC_DIR files get official system-generated links",
		});
	}
	if (/\/tmp\//.test(searchableText)) {
		issues.push({
			severity: "error",
			code: "tmp_path_in_result",
			message:
				'Result text contains "/tmp/" path. Do not use tmp paths as user-facing links.',
			suggestion:
				"Only ARTIFACT_PUBLIC_DIR files get official system-generated links",
		});
	}
	return issues;
}

function decodeRepeatedly(value: string): string {
	let current = value;
	for (let index = 0; index < 2; index += 1) {
		try {
			const decoded = decodeURIComponent(current);
			if (decoded === current) break;
			current = decoded;
		} catch {
			break;
		}
	}
	return current;
}

function checkNoFileUrl(
	resultText: string,
): ArtifactValidationIssue[] {
	if (/file:\/\//.test(resultText)) {
		return [
			{
				severity: "error",
				code: "file_url_in_result",
				message:
					'Result text contains "file://" URL. Do not use file:// URLs as user-facing links.',
				suggestion:
					"Only ARTIFACT_PUBLIC_DIR files get official system-generated links",
			},
		];
	}
	return [];
}

function checkNoSensitiveFiles(
	artifactDir: string,
	files: string[],
): ArtifactValidationIssue[] {
	const issues: ArtifactValidationIssue[] = [];
	for (const filePath of files) {
		const rel = relative(artifactDir, filePath).replace(/\\/g, "/");
		for (const pattern of SENSITIVE_PATTERNS) {
			if (pattern.test(rel) || pattern.test(filePath)) {
				issues.push({
					severity: "error",
					code: "sensitive_file",
					message: `Sensitive file detected: ${rel}`,
					path: filePath,
					suggestion: "Remove sensitive files from ARTIFACT_PUBLIC_DIR",
				});
				break;
			}
		}
	}
	return issues;
}

async function discoverCandidates(
	candidates: ArtifactCandidate[],
	workspace: RunWorkspace,
): Promise<void> {
	const scanDirs = [workspace.workDir, workspace.outputDir];

	for (const scanDir of scanDirs) {
		const files = await scanDirectory(scanDir);
		for (const filePath of files) {
			const ext = extname(filePath).toLowerCase();
			const rel = relative(scanDir, filePath).replace(/\\/g, "/");

			if (ext === ".html" || ext === ".htm") {
				const dir = filePath.replace(/[/\\][^/\\]+$/, "");
				const indexPath = join(dir, "index.html");
				if (
					filePath.endsWith("index.html") ||
					(await fileExists(indexPath))
				) {
					candidates.push({
						kind: "web",
						path: relative(workspace.rootPath, filePath.endsWith("index.html") ? dir : filePath).replace(/\\/g, "/"),
						entryPath: "index.html",
						fileName: "index.html",
					});
				}
			} else if (
				ext === ".xlsx" ||
				ext === ".pdf" ||
				ext === ".csv" ||
				ext === ".md" ||
				ext === ".markdown"
			) {
				try {
					const s = await stat(filePath);
					if (s.size > 0) {
						candidates.push({
							kind: "file",
							path: relative(workspace.rootPath, filePath).replace(/\\/g, "/"),
							fileName: filePath.split(/[/\\]/).pop(),
							sizeBytes: s.size,
						});
					}
				} catch {
					continue;
				}
			} else {
				try {
					const s = await stat(filePath);
					if (s.size > 0) {
						candidates.push({
							kind: "file",
							path: relative(workspace.rootPath, filePath).replace(/\\/g, "/"),
							fileName: filePath.split(/[/\\]/).pop(),
							sizeBytes: s.size,
						});
					}
				} catch {
					continue;
				}
			}
		}
	}
}

async function fileExists(path: string): Promise<boolean> {
	try {
		const s = await stat(path);
		return s.isFile();
	} catch {
		return false;
	}
}
