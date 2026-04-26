import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ServerResponse } from "node:http";
import type { AgentService } from "../agent/agent-service.js";
import {
	isValidConversationId,
	parseChatMessageBody,
	parseOptionalPositiveInteger,
	parseQueueMessageBody,
} from "./chat-route-parsers.js";
import { sendBadRequest, sendInternalError } from "./http-errors.js";
import type {
	ConversationCatalogResponseBody,
	ChatHistoryResponseBody,
	ChatRequestBody,
	ChatResponseBody,
	ChatRunEventsResponseBody,
	ChatStatusResponseBody,
	ChatStreamEvent,
	ConversationStateResponseBody,
	DebugSkillsResponseBody,
	InterruptChatRequestBody,
	InterruptChatResponseBody,
	CreateConversationResponseBody,
	DeleteConversationResponseBody,
	QueueMessageRequestBody,
	QueueMessageResponseBody,
	ResetConversationRequestBody,
	ResetConversationResponseBody,
	SwitchConversationRequestBody,
	SwitchConversationResponseBody,
} from "../types/api.js";

interface ChatRouteDependencies {
	agentService: AgentService;
}

function writeSseEvent(raw: ServerResponse, event: ChatStreamEvent): void {
	if (raw.destroyed || raw.writableEnded) {
		return;
	}

	try {
		raw.write(`data: ${JSON.stringify(event)}\n\n`);
	} catch {
		// Browser refresh closes the SSE response, but the agent run should keep working.
	}
}

function endSseResponse(raw: ServerResponse): void {
	if (!raw.destroyed && !raw.writableEnded) {
		raw.end();
	}
}

function isTerminalChatStreamEvent(event: ChatStreamEvent): boolean {
	return event.type === "done" || event.type === "interrupted" || event.type === "error";
}

export function registerChatRoutes(app: FastifyInstance, deps: ChatRouteDependencies): void {
	app.get("/v1/debug/skills", async (): Promise<DebugSkillsResponseBody> => {
		return await deps.agentService.getAvailableSkills();
	});

	app.get("/v1/chat/conversations", async (): Promise<ConversationCatalogResponseBody> => {
		return await deps.agentService.getConversationCatalog();
	});

	app.post("/v1/chat/conversations", async (): Promise<CreateConversationResponseBody> => {
		return await deps.agentService.createConversation();
	});

	app.delete(
		"/v1/chat/conversations/:conversationId",
		async (
			request: FastifyRequest<{ Params: { conversationId: string } }>,
			reply,
		): Promise<DeleteConversationResponseBody | FastifyReply> => {
			const { conversationId } = request.params ?? {};

			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}

			try {
				return await deps.agentService.deleteConversation(conversationId);
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.post(
		"/v1/chat/current",
		async (
			request: FastifyRequest<{ Body: Partial<SwitchConversationRequestBody> }>,
			reply,
		): Promise<SwitchConversationResponseBody | FastifyReply> => {
			const { conversationId } = request.body ?? {};

			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}

			try {
				return await deps.agentService.switchConversation(conversationId);
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.get(
		"/v1/chat/state",
		async (
			request: FastifyRequest<{ Querystring: { conversationId?: string; viewLimit?: string } }>,
			reply,
		): Promise<ConversationStateResponseBody | FastifyReply> => {
			const { conversationId, viewLimit } = request.query ?? {};

			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}
			const parsedViewLimit = parseOptionalPositiveInteger(viewLimit, "viewLimit");
			if (parsedViewLimit.error) {
				return sendBadRequest(reply, parsedViewLimit.error);
			}

			try {
				return await deps.agentService.getConversationState(conversationId, {
					viewLimit: parsedViewLimit.value,
				});
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.get(
		"/v1/chat/status",
		async (
			request: FastifyRequest<{ Querystring: { conversationId?: string } }>,
			reply,
		): Promise<ChatStatusResponseBody | FastifyReply> => {
			const { conversationId } = request.query ?? {};

			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}

			try {
				return await deps.agentService.getRunStatus(conversationId);
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.get(
		"/v1/chat/history",
		async (
			request: FastifyRequest<{ Querystring: { conversationId?: string; limit?: string; before?: string } }>,
			reply,
		): Promise<ChatHistoryResponseBody | FastifyReply> => {
			const { conversationId, limit, before } = request.query ?? {};

			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}
			const parsedLimit = parseOptionalPositiveInteger(limit, "limit");
			if (parsedLimit.error) {
				return sendBadRequest(reply, parsedLimit.error);
			}

			try {
				return await deps.agentService.getConversationHistory(conversationId, {
					limit: parsedLimit.value,
					before: typeof before === "string" && before.trim().length > 0 ? before.trim() : undefined,
				});
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.get(
		"/v1/chat/events",
		async (
			request: FastifyRequest<{ Querystring: { conversationId?: string } }>,
			reply,
		): Promise<FastifyReply | void> => {
			const { conversationId } = request.query ?? {};

			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}

			reply.hijack();
			reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
			reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
			reply.raw.setHeader("Connection", "keep-alive");
			reply.raw.setHeader("X-Accel-Buffering", "no");
			reply.raw.flushHeaders?.();

			let subscription:
				| {
						running: boolean;
						unsubscribe: () => void;
				  }
				| undefined;
			let closed = false;
			const closeStream = () => {
				if (closed) {
					return;
				}
				closed = true;
				subscription?.unsubscribe();
				endSseResponse(reply.raw);
			};

			request.raw.on("close", closeStream);

			subscription = deps.agentService.subscribeRunEvents(conversationId, (event) => {
				writeSseEvent(reply.raw, event);
				if (isTerminalChatStreamEvent(event)) {
					closeStream();
				}
			});

			if (!subscription.running) {
				closeStream();
			}

			if (closed) {
				subscription.unsubscribe();
			}
		},
	);

	app.get(
		"/v1/chat/runs/:runId/events",
		async (
			request: FastifyRequest<{ Params: { runId?: string }; Querystring: { conversationId?: string } }>,
			reply,
		): Promise<ChatRunEventsResponseBody | FastifyReply> => {
			const { runId } = request.params ?? {};
			const { conversationId } = request.query ?? {};

			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}
			if (!isValidConversationId(runId)) {
				return sendBadRequest(reply, 'Field "runId" must be a non-empty string');
			}

			try {
				return {
					conversationId,
					runId,
					events: await deps.agentService.getRunEvents(conversationId, runId),
				};
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.post(
		"/v1/chat",
		async (
			request: FastifyRequest<{ Body: Partial<ChatRequestBody> }>,
			reply,
		): Promise<ChatResponseBody | FastifyReply> => {
			const parsedBody = parseChatMessageBody(request.body ?? {});
			if (parsedBody.error) {
				return sendBadRequest(reply, parsedBody.error);
			}
			const body = parsedBody.value!;

			try {
				return await deps.agentService.chat({
					conversationId: body.conversationId,
					message: body.message,
					userId: body.userId,
					...(body.attachments ? { attachments: body.attachments } : {}),
					...(body.assetRefs ? { assetRefs: body.assetRefs } : {}),
				});
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.post(
		"/v1/chat/stream",
		async (request: FastifyRequest<{ Body: Partial<ChatRequestBody> }>, reply): Promise<FastifyReply | void> => {
			const parsedBody = parseChatMessageBody(request.body ?? {});
			if (parsedBody.error) {
				return sendBadRequest(reply, parsedBody.error);
			}
			const body = parsedBody.value!;

			reply.hijack();
			reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
			reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
			reply.raw.setHeader("Connection", "keep-alive");
			reply.raw.setHeader("X-Accel-Buffering", "no");
			reply.raw.flushHeaders?.();

			try {
				await deps.agentService.streamChat(
					{
						conversationId: body.conversationId,
						message: body.message,
						userId: body.userId,
						...(body.attachments ? { attachments: body.attachments } : {}),
						...(body.assetRefs ? { assetRefs: body.assetRefs } : {}),
					},
					(event) => {
						writeSseEvent(reply.raw, event);
					},
				);
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "Unknown internal error";
				const streamEventAlreadyEmitted =
					error instanceof Error &&
					"chatStreamEventEmitted" in error &&
					(error as Error & { chatStreamEventEmitted?: boolean }).chatStreamEventEmitted === true;
				if (!streamEventAlreadyEmitted) {
					writeSseEvent(reply.raw, {
						type: "error",
						conversationId: body.conversationId ?? "",
						runId: "",
						message: messageText,
					});
				}
			} finally {
				if (!reply.raw.destroyed && !reply.raw.writableEnded) {
					reply.raw.end();
				}
			}
		},
	);

	app.post(
		"/v1/chat/queue",
		async (
			request: FastifyRequest<{ Body: Partial<QueueMessageRequestBody> }>,
			reply,
		): Promise<QueueMessageResponseBody | FastifyReply> => {
			const parsedBody = parseQueueMessageBody(request.body ?? {});
			if (parsedBody.error) {
				return sendBadRequest(reply, parsedBody.error);
			}
			const body = parsedBody.value!;

			try {
				return await deps.agentService.queueMessage({
					conversationId: body.conversationId,
					message: body.message,
					mode: body.mode,
					userId: body.userId,
					...(body.attachments ? { attachments: body.attachments } : {}),
					...(body.assetRefs ? { assetRefs: body.assetRefs } : {}),
				});
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.post(
		"/v1/chat/reset",
		async (
			request: FastifyRequest<{ Body: Partial<ResetConversationRequestBody> }>,
			reply,
		): Promise<ResetConversationResponseBody | FastifyReply> => {
			const { conversationId } = request.body ?? {};

			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}

			try {
				return await deps.agentService.resetConversation({
					conversationId,
				});
			} catch (error) {
				return sendInternalError(reply, error);
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
				return sendInternalError(reply, error);
			}
		},
	);
}
