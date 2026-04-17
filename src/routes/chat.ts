import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ServerResponse } from "node:http";
import type { AgentService } from "../agent/agent-service.js";
import type {
	ChatRequestBody,
	ChatResponseBody,
	ChatStreamEvent,
	DebugSkillsResponseBody,
	ErrorResponseBody,
	InterruptChatRequestBody,
	InterruptChatResponseBody,
	QueueMessageRequestBody,
	QueueMessageResponseBody,
} from "../types/api.js";

interface ChatRouteDependencies {
	agentService: AgentService;
}

function sendBadRequest(reply: FastifyReply, message: string): FastifyReply {
	return reply.status(400).send({
		error: {
			code: "BAD_REQUEST",
			message,
		},
	} satisfies ErrorResponseBody);
}

function writeSseEvent(raw: ServerResponse, event: ChatStreamEvent): void {
	raw.write(`data: ${JSON.stringify(event)}\n\n`);
}

function isValidMessage(message: unknown): message is string {
	return typeof message === "string" && message.trim().length > 0;
}

function isValidConversationId(conversationId: unknown): conversationId is string {
	return typeof conversationId === "string" && conversationId.trim().length > 0;
}

function isValidQueueMode(mode: unknown): mode is "steer" | "followUp" {
	return mode === "steer" || mode === "followUp";
}

export function registerChatRoutes(app: FastifyInstance, deps: ChatRouteDependencies): void {
	app.get("/v1/debug/skills", async (): Promise<DebugSkillsResponseBody> => {
		return {
			skills: await deps.agentService.getAvailableSkills(),
		};
	});

	app.post(
		"/v1/chat",
		async (
			request: FastifyRequest<{ Body: Partial<ChatRequestBody> }>,
			reply,
		): Promise<ChatResponseBody | FastifyReply> => {
			const { conversationId, message, userId } = request.body ?? {};

			if (!isValidMessage(message)) {
				return sendBadRequest(reply, 'Field "message" must be a non-empty string');
			}

			try {
				return await deps.agentService.chat({
					conversationId,
					message,
					userId,
				});
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "Unknown internal error";
				return reply.status(500).send({
					error: {
						code: "INTERNAL_ERROR",
						message: messageText,
					},
				} satisfies ErrorResponseBody);
			}
		},
	);

	app.post(
		"/v1/chat/stream",
		async (request: FastifyRequest<{ Body: Partial<ChatRequestBody> }>, reply): Promise<FastifyReply | void> => {
			const { conversationId, message, userId } = request.body ?? {};

			if (!isValidMessage(message)) {
				return sendBadRequest(reply, 'Field "message" must be a non-empty string');
			}

			reply.hijack();
			reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
			reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
			reply.raw.setHeader("Connection", "keep-alive");
			reply.raw.setHeader("X-Accel-Buffering", "no");
			reply.raw.flushHeaders?.();

			try {
				await deps.agentService.streamChat(
					{
						conversationId,
						message,
						userId,
					},
					(event) => {
						writeSseEvent(reply.raw, event);
					},
				);
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "Unknown internal error";
				writeSseEvent(reply.raw, {
					type: "error",
					message: messageText,
				});
			} finally {
				reply.raw.end();
			}
		},
	);

	app.post(
		"/v1/chat/queue",
		async (
			request: FastifyRequest<{ Body: Partial<QueueMessageRequestBody> }>,
			reply,
		): Promise<QueueMessageResponseBody | FastifyReply> => {
			const { conversationId, message, mode, userId } = request.body ?? {};

			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}
			if (!isValidMessage(message)) {
				return sendBadRequest(reply, 'Field "message" must be a non-empty string');
			}
			if (!isValidQueueMode(mode)) {
				return sendBadRequest(reply, 'Field "mode" must be either "steer" or "followUp"');
			}

			try {
				return await deps.agentService.queueMessage({
					conversationId,
					message,
					mode,
					userId,
				});
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "Unknown internal error";
				return reply.status(500).send({
					error: {
						code: "INTERNAL_ERROR",
						message: messageText,
					},
				} satisfies ErrorResponseBody);
			}
		},
	);

	app.post(
		"/v1/chat/interrupt",
		async (
			request: FastifyRequest<{ Body: Partial<InterruptChatRequestBody> }>,
			reply,
		): Promise<InterruptChatResponseBody | FastifyReply> => {
			const { conversationId } = request.body ?? {};

			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}

			try {
				return await deps.agentService.interruptChat({
					conversationId,
				});
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "Unknown internal error";
				return reply.status(500).send({
					error: {
						code: "INTERNAL_ERROR",
						message: messageText,
					},
				} satisfies ErrorResponseBody);
			}
		},
	);
}
