import type { FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import type { ConnRunStore } from "../agent/conn-run-store.js";
import type { ConnSqliteStore } from "../agent/conn-sqlite-store.js";
import { sanitizeBackgroundPathSegment } from "../agent/background-workspace.js";
import { buildDefaultArtifactContract } from "../agent/artifact-contract.js";
import { validateArtifactDelivery } from "../agent/artifact-validation.js";

export interface ArtifactRouteOptions {
	connStore: ConnSqliteStore;
	connRunStore: ConnRunStore;
	backgroundDataDir: string;
	publicBaseUrl?: string;
}

const CONTENT_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".csv": "text/csv; charset=utf-8",
	".md": "text/markdown; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".pdf": "application/pdf",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".svg": "image/svg+xml; charset=utf-8",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	".htm": "text/html; charset=utf-8",
};

export function registerArtifactRoutes(
	app: FastifyInstance,
	options: ArtifactRouteOptions,
): void {
	const { connStore, connRunStore, backgroundDataDir } = options;

	app.get<{ Params: { connId: string; runId: string; "*": string } }>(
		"/v1/conns/:connId/runs/:runId/artifacts/*",
		async (request, reply) => {
			const { connId, runId } = request.params;
			const subPath = request.params["*"];
			const artifactDir = resolveArtifactDir(backgroundDataDir, runId);
			if (!artifactDir) {
				return reply.code(404).send({ error: "Not found" });
			}

			const targetFile = subPath
				? resolve(join(artifactDir, subPath))
				: resolve(join(artifactDir, "index.html"));

			return serveArtifactFile(reply, artifactDir, targetFile);
		},
	);

	app.get<{ Params: { connId: string; runId: string } }>(
		"/v1/conns/:connId/runs/:runId/artifacts",
		async (request, reply) => {
			const { runId } = request.params;
			const artifactDir = resolveArtifactDir(backgroundDataDir, runId);
			if (!artifactDir) {
				return reply.code(404).send({ error: "Not found" });
			}
			const indexPath = resolve(join(artifactDir, "index.html"));
			if (existsSync(indexPath)) {
				return serveArtifactFile(reply, artifactDir, indexPath);
			}
			return reply.code(404).send({ error: "Not found" });
		},
	);

	app.get<{ Params: { connId: string; runId: string } }>(
		"/v1/conns/:connId/runs/:runId/artifacts/health",
		async (request, reply) => {
			const { runId } = request.params;
			const artifactDir = resolveArtifactDir(backgroundDataDir, runId);
			if (!artifactDir) {
				return reply.send({ ok: false, error: "Artifact directory not found" });
			}
			if (!existsSync(artifactDir)) {
				return reply.send({ ok: false, error: "Artifact directory does not exist" });
			}
			const files = await listArtifactFiles(artifactDir);
			return reply.send({
				ok: files.length > 0,
				fileCount: files.length,
			});
		},
	);

	app.get<{ Params: { connId: string; "*": string } }>(
		"/v1/conns/:connId/artifacts/latest/*",
		async (request, reply) => {
			const { connId } = request.params;
			const subPath = request.params["*"];

			const runs = await connRunStore.listRunsForConn(connId);
			const latestSucceeded = runs.find((r) => r.status === "succeeded");
			if (!latestSucceeded) {
				return reply.code(404).send({ error: "No succeeded run found" });
			}

			const artifactDir = resolveArtifactDir(
				backgroundDataDir,
				latestSucceeded.runId,
			);
			if (!artifactDir) {
				return reply.code(404).send({ error: "Not found" });
			}

			const targetFile = subPath
				? resolve(join(artifactDir, subPath))
				: resolve(join(artifactDir, "index.html"));

			return serveArtifactFile(reply, artifactDir, targetFile);
		},
	);

	app.get<{ Params: { connId: string } }>(
		"/v1/conns/:connId/artifacts/latest",
		async (request, reply) => {
			const { connId } = request.params;

			const runs = await connRunStore.listRunsForConn(connId);
			const latestSucceeded = runs.find((r) => r.status === "succeeded");
			if (!latestSucceeded) {
				return reply.code(404).send({ error: "No succeeded run found" });
			}

			const artifactDir = resolveArtifactDir(
				backgroundDataDir,
				latestSucceeded.runId,
			);
			if (!artifactDir) {
				return reply.code(404).send({ error: "Not found" });
			}

			const indexPath = resolve(join(artifactDir, "index.html"));
			if (existsSync(indexPath)) {
				return serveArtifactFile(reply, artifactDir, indexPath);
			}
			return reply.code(404).send({ error: "Not found" });
		},
	);

	app.get<{ Params: { connId: string } }>(
		"/v1/conns/:connId/artifacts/latest/health",
		async (request, reply) => {
			const { connId } = request.params;

			const runs = await connRunStore.listRunsForConn(connId);
			const latestSucceeded = runs.find((r) => r.status === "succeeded");
			if (!latestSucceeded) {
				return reply.send({ ok: false, error: "No succeeded run found" });
			}

			const artifactDir = resolveArtifactDir(
				backgroundDataDir,
				latestSucceeded.runId,
			);
			if (!artifactDir || !existsSync(artifactDir)) {
				return reply.send({ ok: false, error: "Artifact directory not found" });
			}

			const files = await listArtifactFiles(artifactDir);
			return reply.send({
				ok: files.length > 0,
				fileCount: files.length,
				runId: latestSucceeded.runId,
			});
		},
	);
}

export function resolveArtifactDir(
	backgroundDataDir: string,
	runId: string,
): string | undefined {
	const safeRunId = sanitizeBackgroundPathSegment(runId);
	if (safeRunId === "run") return undefined;
	return resolve(join(backgroundDataDir, "runs", safeRunId, "artifact-public"));
}

async function serveArtifactFile(
	reply: any,
	artifactDir: string,
	targetFile: string,
): Promise<any> {
	const resolvedTarget = resolve(targetFile);
	const resolvedArtifactDir = resolve(artifactDir);
	if (
		!resolvedTarget.startsWith(resolvedArtifactDir + "/") &&
			!resolvedTarget.startsWith(resolvedArtifactDir + sep) &&
		resolvedTarget !== resolvedArtifactDir
	) {
		return reply.code(404).send({ error: "Not found" });
	}

	const fileName = resolvedTarget.split(/[/\\]/).pop() ?? "";
	if (!fileName || fileName.startsWith(".")) {
		return reply.code(404).send({ error: "Not found" });
	}

	let fileStat;
	try {
		fileStat = await stat(resolvedTarget);
	} catch {
		return reply.code(404).send({ error: "Not found" });
	}
	if (!fileStat.isFile()) {
		return reply.code(404).send({ error: "Not found" });
	}

	const ext = extname(resolvedTarget).toLowerCase();
	const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

	const content = await readFile(resolvedTarget);
	return reply
		.header("Content-Type", contentType)
		.header("Cache-Control", "no-store")
		.send(content);
}

async function listArtifactFiles(dir: string): Promise<string[]> {
	const { readdir, stat } = await import("node:fs/promises");
	const results: string[] = [];

	async function scan(current: string): Promise<void> {
		let entries;
		try {
			entries = await readdir(current, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (!entry.name || entry.name.startsWith(".")) continue;
			const fullPath = join(current, entry.name);
			if (entry.isDirectory()) {
				await scan(fullPath);
			} else if (entry.isFile()) {
				const resolved = resolve(fullPath);
				if (resolved.startsWith(resolve(dir))) {
					results.push(fullPath);
				}
			}
		}
	}

	await scan(dir);
	return results;
}
