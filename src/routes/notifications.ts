import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { NotificationBroadcastEvent, NotificationHub } from "../agent/notification-hub.js";
import { configureSseResponse, endSseResponse, writeSseEvent } from "./chat-sse.js";
import { sendBadRequest } from "./http-errors.js";
import { parseNotificationBroadcastEvent } from "./notification-route-utils.js";

interface NotificationRouteDependencies {
	notificationHub: NotificationHub;
}

export function registerNotificationRoutes(app: FastifyInstance, deps: NotificationRouteDependencies): void {
	app.get("/v1/notifications/stream", async (_request, reply): Promise<FastifyReply | void> => {
		reply.hijack();
		configureSseResponse(reply.raw);
		reply.raw.write(": connected\n\n");

		let closed = false;
		const subscription = deps.notificationHub.subscribe((event) => {
			writeSseEvent(reply.raw, event);
		});
		const closeStream = () => {
			if (closed) {
				return;
			}
			closed = true;
			subscription.unsubscribe();
			endSseResponse(reply.raw);
		};

		_request.raw.on("close", closeStream);
	});

	app.post(
		"/v1/internal/notifications/broadcast",
		async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply): Promise<FastifyReply> => {
			const parsed = parseNotificationBroadcastEvent(request.body ?? {});
			if (parsed.error) {
				return sendBadRequest(reply, parsed.error);
			}

			deps.notificationHub.broadcast(parsed.event!);
			return reply.status(202).send({ ok: true });
		},
	);
}
