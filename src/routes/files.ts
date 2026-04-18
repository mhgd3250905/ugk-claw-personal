import type { FastifyInstance } from "fastify";
import type { FileArtifactStoreLike } from "../agent/file-artifacts.js";

export interface FileRouteOptions {
	fileArtifactStore: FileArtifactStoreLike;
}

export function registerFileRoutes(app: FastifyInstance, options: FileRouteOptions): void {
	app.get("/v1/files/:fileId", async (request, reply) => {
		const { fileId } = request.params as { fileId: string };
		if (!fileId || !options.fileArtifactStore.getFile) {
			return reply.status(404).send();
		}

		const file = await options.fileArtifactStore.getFile(fileId);
		if (!file) {
			return reply.status(404).send();
		}

		reply.type(file.mimeType);
		reply.header("content-length", file.sizeBytes);
		reply.header("content-disposition", `attachment; filename="${escapeContentDispositionFileName(file.fileName)}"`);
		return reply.send(file.content);
	});
}

function escapeContentDispositionFileName(fileName: string): string {
	return fileName.replace(/["\\\r\n]/g, "_");
}
