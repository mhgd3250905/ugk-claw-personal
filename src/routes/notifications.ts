import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ServerResponse } from "node:http";
import type { NotificationBroadcastEvent, NotificationHub } from "../agent/notification-hub.js";
import { sendBadRequest } from "./http-errors.js";
import { parseNotificationBroadcastEvent } from "./notification-route-utils.js";

interface NotificationRouteDependencies {
	notificationHub: NotificationHub;
}

function writeSseEvent(raw: ServerResponse, event: NotificationBroadcastEvent): void {
	if (raw.destroyed || raw.writableEnded) {
		return;
	}

	try {
		raw.write(`data: ${JSON.stringify(event)}\n\n`);
	} catch {
		// Browser refresh closes the SSE response, but the notification hub should keep working.
	}
}

function endSseResponse(raw: ServerResponse): void {
	if (!raw.destroyed && !raw.writableEnded) {
		raw.end();
	}
}

export function registerNotificationRoutes(app: FastifyInstance, deps: NotificationRouteDependencies): void {
	app.get("/v1/notifications/stream", async (_request, reply): Promise<FastifyReply | void> => {
		reply.hijack();
		reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
		reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
		reply.raw.setHeader("Connection", "keep-alive");
		reply.raw.setHeader("X-Accel-Buffering", "no");
		reply.raw.flushHeaders?.();
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
