import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, join, normalize } from "node:path";
import type { FastifyInstance } from "fastify";

export interface AssetRouteOptions {
	projectRoot: string;
}

export function registerAssetRoutes(app: FastifyInstance, options: AssetRouteOptions): void {
	app.get("/assets/fonts/:fileName", async (request, reply) => {
		const { fileName } = request.params as { fileName: string };
		const safeFileName = basename(fileName);
		if (safeFileName !== fileName || !safeFileName.endsWith(".ttf")) {
			return reply.status(404).send();
		}

		const fontPath = normalize(join(options.projectRoot, "public", "fonts", safeFileName));
		try {
			const fileStat = await stat(fontPath);
			reply.type("font/ttf");
			reply.header("content-length", fileStat.size);
			return reply.send(createReadStream(fontPath));
		} catch {
			return reply.status(404).send();
		}
	});
}
