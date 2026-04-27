import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AgentService } from "../agent/agent-service.js";
import {
	configureSseResponse,
	endSseResponse,
	isTerminalChatStreamEvent,
	startSseHeartbeat,
	writeSseEvent,
} from "./chat-sse.js";
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
	ChatStreamEvent,
	ChatStatusResponseBody,
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

const RUN_EVENT_PAGE_SIZE = 2;
const RUN_EVENT_MAX_PAGE_SIZE = 20;

function isChatRunLogNoiseEvent(event: ChatStreamEvent): boolean {
	return event.type === "text_delta";
}

function parseChatRunEventPageQuery(query: Record<string, unknown>): {
	value?: { limit: number; before?: number };
	error?: string;
} {
	const parsedLimit = parseOptionalPositiveInteger(query.limit, "limit");
	if (parsedLimit.error) {
		return { error: parsedLimit.error };
	}
	const parsedBefore = parseOptionalPositiveInteger(query.before, "before");
	if (parsedBefore.error) {
		return { error: parsedBefore.error };
	}
	return {
		value: {
			limit: Math.min(parsedLimit.value ?? RUN_EVENT_PAGE_SIZE, RUN_EVENT_MAX_PAGE_SIZE),
			before: parsedBefore.value,
		},
	};
}

function paginateChatRunEvents(
	events: ChatStreamEvent[],
	options: { limit: number; before?: number },
): { events: ChatStreamEvent[]; hasMore: boolean; nextBefore?: string } {
	const meaningfulEvents = events.filter((event) => !isChatRunLogNoiseEvent(event));
	const endIndex = Math.min(options.before ?? meaningfulEvents.length, meaningfulEvents.length);
	const startIndex = Math.max(0, endIndex - options.limit);
	const visibleEvents = meaningfulEvents.slice(startIndex, endIndex).reverse();
	return {
		events: visibleEvents,
		hasMore: startIndex > 0,
		...(startIndex > 0 ? { nextBefore: String(startIndex) } : {}),
	};
}

interface ChatRouteDependencies {
	agentService: AgentService;
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
			configureSseResponse(reply.raw);
			const heartbeat = startSseHeartbeat(reply.raw);

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
				heartbeat.stop();
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
			request: FastifyRequest<{
				Params: { runId?: string };
				Querystring: { conversationId?: string; limit?: string; before?: string };
			}>,
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
			const parsedPage = parseChatRunEventPageQuery(request.query ?? {});
			if (parsedPage.error || !parsedPage.value) {
				return sendBadRequest(reply, parsedPage.error || "Invalid run event query");
			}

			try {
				const page = paginateChatRunEvents(await deps.agentService.getRunEvents(conversationId, runId), parsedPage.value);
				return {
					conversationId,
					runId,
					events: page.events,
					hasMore: page.hasMore,
					...(page.nextBefore ? { nextBefore: page.nextBefore } : {}),
					limit: parsedPage.value.limit,
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
			configureSseResponse(reply.raw);
			const heartbeat = startSseHeartbeat(reply.raw);

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
				heartbeat.stop();
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
