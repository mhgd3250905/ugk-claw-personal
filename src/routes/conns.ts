import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ConnScheduler } from "../agent/conn-scheduler.js";
import { ConnStore, type ConnSchedule, type ConnTarget } from "../agent/conn-store.js";
import type { ConnDetailResponseBody, ConnListResponseBody, ErrorResponseBody } from "../types/api.js";

interface ConnRouteOptions {
	connStore: ConnStore;
	connScheduler: ConnScheduler;
}

function sendBadRequest(reply: FastifyReply, message: string): FastifyReply {
	return reply.status(400).send({
		error: {
			code: "BAD_REQUEST",
			message,
		},
	} satisfies ErrorResponseBody);
}

function sendInternalError(reply: FastifyReply, error: unknown): FastifyReply {
	const messageText = error instanceof Error ? error.message : "Unknown internal error";
	return reply.status(500).send({
		error: {
			code: "INTERNAL_ERROR",
			message: messageText,
		},
	} satisfies ErrorResponseBody);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function parseTarget(value: unknown): { target?: ConnTarget; error?: string } {
	if (!value || typeof value !== "object") {
		return { error: 'Field "target" must be an object' };
	}

	const target = value as Record<string, unknown>;
	if (target.type === "conversation" && isNonEmptyString(target.conversationId)) {
		return { target: { type: "conversation", conversationId: target.conversationId.trim() } };
	}
	if (target.type === "feishu_chat" && isNonEmptyString(target.chatId)) {
		return { target: { type: "feishu_chat", chatId: target.chatId.trim() } };
	}
	if (target.type === "feishu_user" && isNonEmptyString(target.openId)) {
		return { target: { type: "feishu_user", openId: target.openId.trim() } };
	}

	return { error: 'Field "target" is invalid' };
}

function parseSchedule(value: unknown): { schedule?: ConnSchedule; error?: string } {
	if (!value || typeof value !== "object") {
		return { error: 'Field "schedule" must be an object' };
	}

	const schedule = value as Record<string, unknown>;
	if (schedule.kind === "once" && isNonEmptyString(schedule.at)) {
		return { schedule: { kind: "once", at: schedule.at.trim() } };
	}
	if (schedule.kind === "interval" && typeof schedule.everyMs === "number" && Number.isFinite(schedule.everyMs)) {
		return {
			schedule: {
				kind: "interval",
				everyMs: schedule.everyMs,
				...(isNonEmptyString(schedule.startAt) ? { startAt: schedule.startAt.trim() } : {}),
			},
		};
	}
	if (schedule.kind === "cron" && isNonEmptyString(schedule.expression)) {
		return { schedule: { kind: "cron", expression: schedule.expression.trim() } };
	}

	return { error: 'Field "schedule" is invalid' };
}

function parseAssetRefs(value: unknown): { assetRefs?: string[]; error?: string } {
	if (value === undefined) {
		return {};
	}
	if (!Array.isArray(value)) {
		return { error: 'Field "assetRefs" must be an array when provided' };
	}

	const assetRefs: string[] = [];
	for (const [index, entry] of value.entries()) {
		if (!isNonEmptyString(entry)) {
			return { error: `assetRefs[${index}] must be a non-empty string` };
		}
		assetRefs.push(entry.trim());
	}
	return { assetRefs };
}

export function registerConnRoutes(app: FastifyInstance, options: ConnRouteOptions): void {
	app.get("/v1/conns", async (): Promise<ConnListResponseBody> => {
		return {
			conns: await options.connStore.list(),
		};
	});

	app.get("/v1/conns/:connId", async (request, reply): Promise<ConnDetailResponseBody | FastifyReply> => {
		const { connId } = request.params as { connId: string };
		const conn = await options.connStore.get(connId);
		if (!conn) {
			return reply.status(404).send();
		}
		return { conn };
	});

	app.post("/v1/conns", async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply) => {
		const body = request.body ?? {};
		if (!isNonEmptyString(body.title)) {
			return sendBadRequest(reply, 'Field "title" must be a non-empty string');
		}
		if (!isNonEmptyString(body.prompt)) {
			return sendBadRequest(reply, 'Field "prompt" must be a non-empty string');
		}
		const parsedTarget = parseTarget(body.target);
		if (parsedTarget.error) {
			return sendBadRequest(reply, parsedTarget.error);
		}
		const parsedSchedule = parseSchedule(body.schedule);
		if (parsedSchedule.error) {
			return sendBadRequest(reply, parsedSchedule.error);
		}
		const parsedAssetRefs = parseAssetRefs(body.assetRefs);
		if (parsedAssetRefs.error) {
			return sendBadRequest(reply, parsedAssetRefs.error);
		}

		try {
			const conn = await options.connStore.create({
				title: body.title.trim(),
				prompt: body.prompt.trim(),
				target: parsedTarget.target!,
				schedule: parsedSchedule.schedule!,
				assetRefs: parsedAssetRefs.assetRefs,
			});
			return reply.status(201).send({ conn } satisfies ConnDetailResponseBody);
		} catch (error) {
			return sendInternalError(reply, error);
		}
	});

	app.patch("/v1/conns/:connId", async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply) => {
		const { connId } = request.params as { connId: string };
		const body = request.body ?? {};
		const parsedTarget = body.target !== undefined ? parseTarget(body.target) : {};
		if ("error" in parsedTarget && parsedTarget.error) {
			return sendBadRequest(reply, parsedTarget.error);
		}
		const parsedSchedule = body.schedule !== undefined ? parseSchedule(body.schedule) : {};
		if ("error" in parsedSchedule && parsedSchedule.error) {
			return sendBadRequest(reply, parsedSchedule.error);
		}
		const parsedAssetRefs = parseAssetRefs(body.assetRefs);
		if (parsedAssetRefs.error) {
			return sendBadRequest(reply, parsedAssetRefs.error);
		}

		try {
			const conn = await options.connStore.update(connId, {
				...(isNonEmptyString(body.title) ? { title: body.title.trim() } : {}),
				...(isNonEmptyString(body.prompt) ? { prompt: body.prompt.trim() } : {}),
				...(parsedTarget.target ? { target: parsedTarget.target } : {}),
				...(parsedSchedule.schedule ? { schedule: parsedSchedule.schedule } : {}),
				...(body.assetRefs !== undefined ? { assetRefs: parsedAssetRefs.assetRefs ?? [] } : {}),
			});
			if (!conn) {
				return reply.status(404).send();
			}
			return { conn } satisfies ConnDetailResponseBody;
		} catch (error) {
			return sendInternalError(reply, error);
		}
	});

	app.post("/v1/conns/:connId/pause", async (request, reply) => {
		const { connId } = request.params as { connId: string };
		const conn = await options.connStore.pause(connId);
		if (!conn) {
			return reply.status(404).send();
		}
		return { conn } satisfies ConnDetailResponseBody;
	});

	app.post("/v1/conns/:connId/resume", async (request, reply) => {
		const { connId } = request.params as { connId: string };
		const conn = await options.connStore.resume(connId);
		if (!conn) {
			return reply.status(404).send();
		}
		return { conn } satisfies ConnDetailResponseBody;
	});

	app.post("/v1/conns/:connId/run", async (request, reply) => {
		const { connId } = request.params as { connId: string };
		try {
			const conn = await options.connScheduler.runNow(connId);
			if (!conn) {
				return reply.status(404).send();
			}
			return { conn } satisfies ConnDetailResponseBody;
		} catch (error) {
			return sendInternalError(reply, error);
		}
	});

	app.delete("/v1/conns/:connId", async (request, reply) => {
		const { connId } = request.params as { connId: string };
		const deleted = await options.connStore.delete(connId);
		if (!deleted) {
			return reply.status(404).send();
		}
		return reply.status(204).send();
	});
}
