import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { FeishuService } from "../integrations/feishu/service.js";

interface FeishuRouteOptions {
	feishuService: FeishuService;
}

export function registerFeishuRoutes(app: FastifyInstance, options: FeishuRouteOptions): void {
	app.post("/v1/integrations/feishu/events", async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
		const result = await options.feishuService.handleWebhook(request.body);
		if (result.challenge) {
			return {
				challenge: result.challenge,
			};
		}

		return {
			ok: result.accepted,
		};
	});
}
