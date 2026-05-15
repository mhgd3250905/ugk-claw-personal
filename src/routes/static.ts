import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import { isPathInside, resolveContentType } from "./file-route-utils.js";

export interface StaticRouteOptions {
	projectRoot: string;
	publicDir?: string;
	runtimeDir?: string;
}


export function registerStaticRoutes(app: FastifyInstance, options: StaticRouteOptions): void {
	const publicDir = resolve(options.publicDir ?? join(options.projectRoot, "public"));
	const runtimeDir = resolve(options.runtimeDir ?? join(options.projectRoot, "runtime"));
	const flatpickrDir = resolve(join(options.projectRoot, "node_modules", "flatpickr", "dist"));
	const flatpickrLocaleDir = resolve(join(flatpickrDir, "l10n"));

	app.get("/:fileName", async (request, reply) => {
		const { fileName } = request.params as { fileName: string };
		return await sendStaticFile(reply, {
			rootDir: publicDir,
			fileName,
		});
	});

	app.get("/runtime/:fileName", async (request, reply) => {
		const { fileName } = request.params as { fileName: string };
		return await sendStaticFile(reply, {
			rootDir: runtimeDir,
			fileName,
			allowedExtensions: new Set([".html", ".png", ".jpg", ".jpeg", ".webp", ".pdf", ".txt", ".md", ".json", ".csv"]),
		});
	});

	app.get("/vendor/flatpickr/:fileName", async (request, reply) => {
		const { fileName } = request.params as { fileName: string };
		return await sendStaticFile(reply, {
			rootDir: flatpickrDir,
			fileName,
			allowedExtensions: new Set([".css", ".js"]),
		});
	});

	app.get("/vendor/flatpickr/l10n/:fileName", async (request, reply) => {
		const { fileName } = request.params as { fileName: string };
		return await sendStaticFile(reply, {
			rootDir: flatpickrLocaleDir,
			fileName,
			allowedExtensions: new Set([".js"]),
		});
	});
}

async function sendStaticFile(
	reply: FastifyReply,
	options: {
		rootDir: string;
		fileName: string;
		allowedExtensions?: Set<string>;
	},
) {
	const safeFileName = basename(options.fileName);
	if (!safeFileName || safeFileName !== options.fileName || safeFileName.startsWith(".")) {
		return reply.status(404).send();
	}

	const filePath = resolve(join(options.rootDir, safeFileName));
	if (!isPathInside(filePath, options.rootDir)) {
		return reply.status(404).send();
	}

	if (options.allowedExtensions && !options.allowedExtensions.has(extname(filePath).toLowerCase())) {
		return reply.status(404).send();
	}

	try {
		const fileStat = await stat(filePath);
		if (!fileStat.isFile()) {
			return reply.status(404).send();
		}

		reply.type(resolveContentType(filePath));
		reply.header("content-length", fileStat.size);
		reply.header("cache-control", "no-store, no-cache, must-revalidate");
		return reply.send(createReadStream(filePath));
	} catch {
		return reply.status(404).send();
	}
}
