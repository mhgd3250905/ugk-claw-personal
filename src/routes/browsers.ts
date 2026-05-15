import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { BrowserControlService } from "../browser/browser-control.js";
import type { BrowserRegistry } from "../browser/browser-registry.js";
import type {
	BrowserCloseTargetResponseBody,
	BrowserDetailResponseBody,
	BrowserListResponseBody,
	BrowserStartResponseBody,
	BrowserStatusResponseBody,
} from "../types/api.js";
import { sendBadRequest, sendNotFound } from "./http-errors.js";

interface BrowserRouteDependencies {
	browserRegistry: BrowserRegistry;
	browserControl?: BrowserControlService;
}

export function registerBrowserRoutes(app: FastifyInstance, deps: BrowserRouteDependencies): void {
	const browserControl = deps.browserControl ?? new BrowserControlService();

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

	app.get(
		"/v1/browsers/:browserId/status",
		async (
			request: FastifyRequest<{ Params: { browserId?: string } }>,
			reply,
		): Promise<BrowserStatusResponseBody | FastifyReply> => {
			const browser = resolveBrowserOrReply(deps.browserRegistry, reply, request.params?.browserId);
			if (!browser) {
				return reply;
			}
			return { status: await browserControl.getStatus(browser) };
		},
	);

	app.post(
		"/v1/browsers/:browserId/targets/:targetId/close",
		async (
			request: FastifyRequest<{ Params: { browserId?: string; targetId?: string } }>,
			reply,
		): Promise<BrowserCloseTargetResponseBody | FastifyReply> => {
			const browser = resolveBrowserOrReply(deps.browserRegistry, reply, request.params?.browserId);
			if (!browser) {
				return reply;
			}
			try {
				return await browserControl.closeTarget(browser, request.params?.targetId ?? "");
			} catch (error) {
				return reply.status(400).send({
					error: "BAD_REQUEST",
					message: error instanceof Error ? error.message : "Unable to close browser target",
				});
			}
		},
	);

	app.post(
		"/v1/browsers/:browserId/start",
		async (
			request: FastifyRequest<{ Params: { browserId?: string } }>,
			reply,
		): Promise<BrowserStartResponseBody | FastifyReply> => {
			const browser = resolveBrowserOrReply(deps.browserRegistry, reply, request.params?.browserId);
			if (!browser) {
				return reply;
			}
			const result = await browserControl.start(browser);
			if (!result.supported) {
				return reply.status(501).send(result);
			}
			return result;
		},
	);
}

function sendUnknownBrowser(reply: FastifyReply, browserId: string): FastifyReply {
	return sendNotFound(reply, `Unknown browserId: ${browserId}`);
}

function resolveBrowserOrReply(
	browserRegistry: BrowserRegistry,
	reply: FastifyReply,
	browserId: string | undefined,
) {
	const normalizedBrowserId = browserId ?? "";
	const browser = browserRegistry.get(normalizedBrowserId);
	if (!browser) {
		sendUnknownBrowser(reply, normalizedBrowserId);
		return undefined;
	}
	return browser;
}
