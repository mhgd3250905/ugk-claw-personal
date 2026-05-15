import type { FastifyInstance, FastifyReply } from "fastify";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import type { ConnRunStore } from "../agent/conn-run-store.js";
import type { ConnSqliteStore } from "../agent/conn-sqlite-store.js";
import { isPathInside, resolveContentType } from "./file-route-utils.js";
import { sendNotFound } from "./http-errors.js";

export interface ArtifactRouteOptions {
	connStore: ConnSqliteStore;
	connRunStore: ConnRunStore;
	backgroundDataDir: string;
	publicBaseUrl?: string;
}


export function registerArtifactRoutes(
	app: FastifyInstance,
	options: ArtifactRouteOptions,
): void {
	const { connRunStore, backgroundDataDir } = options;

	async function resolveRunArtifactDir(connId: string, runId: string): Promise<string | undefined> {
		const run = await connRunStore.getRun(runId);
		if (!run || run.connId !== connId) {
			return undefined;
		}
		return resolveArtifactDir(backgroundDataDir, run.workspacePath);
	}

	app.get<{ Params: { connId: string; runId: string; "*": string } }>(
		"/v1/conns/:connId/runs/:runId/artifacts/*",
		async (request, reply) => {
			const { connId, runId } = request.params;
			const subPath = request.params["*"];
			const artifactDir = await resolveRunArtifactDir(connId, runId);
			if (!artifactDir) {
				return sendNotFound(reply, "Not found");
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
			const { connId, runId } = request.params;
			const artifactDir = await resolveRunArtifactDir(connId, runId);
			if (!artifactDir) {
				return sendNotFound(reply, "Not found");
			}
			const indexPath = resolve(join(artifactDir, "index.html"));
			if (existsSync(indexPath)) {
				return serveArtifactFile(reply, artifactDir, indexPath);
			}
			return sendNotFound(reply, "Not found");
		},
	);

	app.get<{ Params: { connId: string; runId: string } }>(
		"/v1/conns/:connId/runs/:runId/artifacts/health",
		async (request, reply) => {
			const { connId, runId } = request.params;
			const artifactDir = await resolveRunArtifactDir(connId, runId);
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
				return sendNotFound(reply, "No succeeded run found");
			}

			const artifactDir = resolveArtifactDir(
				backgroundDataDir,
				latestSucceeded.workspacePath,
			);
			if (!artifactDir) {
				return sendNotFound(reply, "Not found");
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
				return sendNotFound(reply, "No succeeded run found");
			}

			const artifactDir = resolveArtifactDir(
				backgroundDataDir,
				latestSucceeded.workspacePath,
			);
			if (!artifactDir) {
				return sendNotFound(reply, "Not found");
			}

			const indexPath = resolve(join(artifactDir, "index.html"));
			if (existsSync(indexPath)) {
				return serveArtifactFile(reply, artifactDir, indexPath);
			}
			return sendNotFound(reply, "Not found");
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
				latestSucceeded.workspacePath,
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
	workspacePath: string,
): string | undefined {
	const resolvedBackgroundDir = resolve(backgroundDataDir);
	const resolvedWorkspacePath = resolve(workspacePath);
	if (resolvedWorkspacePath === resolvedBackgroundDir || !isPathInside(resolvedWorkspacePath, resolvedBackgroundDir)) {
		return undefined;
	}
	return resolve(join(resolvedWorkspacePath, "artifact-public"));
}
async function serveArtifactFile(
	reply: FastifyReply,
	artifactDir: string,
	targetFile: string,
): Promise<FastifyReply> {
	const resolvedTarget = resolve(targetFile);
	const resolvedArtifactDir = resolve(artifactDir);
	if (!isPathInside(resolvedTarget, resolvedArtifactDir)) {
		return sendNotFound(reply, "Not found");
	}

	const fileName = resolvedTarget.split(/[/\\]/).pop() ?? "";
	if (!fileName || fileName.startsWith(".")) {
		return sendNotFound(reply, "Not found");
	}

	let fileStat;
	try {
		fileStat = await stat(resolvedTarget);
	} catch {
		return sendNotFound(reply, "Not found");
	}
	if (!fileStat.isFile()) {
		return sendNotFound(reply, "Not found");
	}

	const ext = extname(resolvedTarget).toLowerCase();
	const contentType = resolveContentType(resolvedTarget);

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
				if (isPathInside(resolved, dir)) {
					results.push(fullPath);
				}
			}
		}
	}

	await scan(dir);
	return results;
}
