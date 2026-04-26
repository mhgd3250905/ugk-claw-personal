import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ServerResponse } from "node:http";
import type { NotificationBroadcastEvent, NotificationHub } from "../agent/notification-hub.js";
import { sendBadRequest } from "./http-errors.js";

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

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function parseNotificationBroadcastEvent(value: unknown): { event?: NotificationBroadcastEvent; error?: string } {
	if (!value || typeof value !== "object") {
		return { error: 'Request body must be an object' };
	}

	const input = value as Record<string, unknown>;
	if (!isNonEmptyString(input.notificationId) && !isNonEmptyString(input.activityId)) {
		return { error: 'Field "notificationId" or "activityId" must be a non-empty string' };
	}
	if (input.conversationId !== undefined && !isNonEmptyString(input.conversationId)) {
		return { error: 'Field "conversationId" must be a non-empty string when provided' };
	}
	if (!isNonEmptyString(input.source)) {
		return { error: 'Field "source" must be a non-empty string' };
	}
	if (!isNonEmptyString(input.sourceId)) {
		return { error: 'Field "sourceId" must be a non-empty string' };
	}
	if (!isNonEmptyString(input.kind)) {
		return { error: 'Field "kind" must be a non-empty string' };
	}
	if (!isNonEmptyString(input.title)) {
		return { error: 'Field "title" must be a non-empty string' };
	}
	if (!isNonEmptyString(input.createdAt)) {
		return { error: 'Field "createdAt" must be a non-empty string' };
	}
	if (input.runId !== undefined && !isNonEmptyString(input.runId)) {
		return { error: 'Field "runId" must be a non-empty string when provided' };
	}

	return {
		event: {
			...(isNonEmptyString(input.notificationId) ? { notificationId: input.notificationId.trim() } : {}),
			...(isNonEmptyString(input.activityId) ? { activityId: input.activityId.trim() } : {}),
			...(isNonEmptyString(input.conversationId) ? { conversationId: input.conversationId.trim() } : {}),
			source: input.source.trim(),
			sourceId: input.sourceId.trim(),
			...(isNonEmptyString(input.runId) ? { runId: input.runId.trim() } : {}),
			kind: input.kind.trim(),
			title: input.title.trim(),
			createdAt: input.createdAt.trim(),
		},
	};
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
