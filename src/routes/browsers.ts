import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { BrowserRegistry } from "../browser/browser-registry.js";
import type { BrowserDetailResponseBody, BrowserListResponseBody } from "../types/api.js";

interface BrowserRouteDependencies {
	browserRegistry: BrowserRegistry;
}

export function registerBrowserRoutes(app: FastifyInstance, deps: BrowserRouteDependencies): void {
	app.get("/v1/browsers", async (): Promise<BrowserListResponseBody> => {
		return deps.browserRegistry.toJSON();
	});

	app.get(
		"/v1/browsers/:browserId",
		async (
			request: FastifyRequest<{ Params: { browserId?: string } }>,
			reply,
		): Promise<BrowserDetailResponseBody | FastifyReply> => {
			const browserId = request.params?.browserId ?? "";
			const browser = deps.browserRegistry.get(browserId);
			if (!browser) {
				return sendUnknownBrowser(reply, browserId);
			}
			return { browser };
		},
	);
}

function sendUnknownBrowser(reply: FastifyReply, browserId: string): FastifyReply {
	return reply.status(404).send({
		error: "NOT_FOUND",
		message: `Unknown browserId: ${browserId}`,
	});
}

