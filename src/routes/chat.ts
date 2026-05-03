import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AgentService } from "../agent/agent-service.js";
import type { AgentServiceRegistry } from "../agent/agent-service-registry.js";
import {
	archiveStoredAgentProfile,
	createStoredAgentProfile,
	updateStoredAgentProfile,
} from "../agent/agent-profile-catalog.js";
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
	agentServiceRegistry?: AgentServiceRegistry<AgentService>;
	projectRoot?: string;
}

export function registerChatRoutes(app: FastifyInstance, deps: ChatRouteDependencies): void {
	function resolveScopedAgentService(agentId: string | undefined): AgentService | undefined {
		return deps.agentServiceRegistry?.get(agentId);
	}

	function resolveAgentRulesPath(agentId: string | undefined): string | undefined {
		if (!agentId || !deps.projectRoot) {
			return undefined;
		}
		return deps.agentServiceRegistry?.getProfile(agentId)?.runtimeAgentRulesPath;
	}

	function sendUnknownAgent(reply: FastifyReply, agentId: string | undefined): FastifyReply {
		return reply.status(404).send({
			error: "NOT_FOUND",
			message: `Unknown agentId: ${agentId ?? ""}`,
		});
	}

	app.get("/v1/agents", async () => {
		return {
			agents: deps.agentServiceRegistry?.list() ?? [
				{
					agentId: "main",
					name: "主 Agent",
					description: "默认综合 agent，保持现有会话、技能和运行方式。",
				},
			],
		};
	});

	app.post(
		"/v1/agents",
		async (
			request: FastifyRequest<{
				Body: { agentId?: string; name?: string; description?: string; initialSystemSkillNames?: string[] };
			}>,
			reply,
		): Promise<{ agent: { agentId: string; name: string; description: string } } | FastifyReply> => {
			if (!deps.projectRoot || !deps.agentServiceRegistry) {
				return reply.status(501).send({
					error: "NOT_IMPLEMENTED",
					message: "Agent profile catalog is not available.",
				});
			}
			try {
				const body = request.body ?? {};
				const profile = await createStoredAgentProfile(deps.projectRoot, {
					agentId: body.agentId ?? "",
					name: body.name,
					description: body.description,
					initialSystemSkillNames: body.initialSystemSkillNames,
				});
				deps.agentServiceRegistry.add(profile);
				return {
					agent: {
						agentId: profile.agentId,
						name: profile.name,
						description: profile.description,
					},
				};
			} catch (error) {
				return reply.status(400).send({
					error: "BAD_REQUEST",
					message: error instanceof Error ? error.message : "Unable to create agent profile.",
				});
			}
		},
	);

	app.patch(
		"/v1/agents/:agentId",
		async (
			request: FastifyRequest<{
				Params: { agentId?: string };
				Body: { name?: string; description?: string };
			}>,
			reply,
		): Promise<{ agent: { agentId: string; name: string; description: string } } | FastifyReply> => {
			const { agentId } = request.params ?? {};
			if (!agentId || !deps.projectRoot || !deps.agentServiceRegistry) {
				return sendUnknownAgent(reply, agentId);
			}
			if (!resolveScopedAgentService(agentId)) {
				return sendUnknownAgent(reply, agentId);
			}
			try {
				const body = request.body ?? {};
				const profile = await updateStoredAgentProfile(deps.projectRoot, agentId, {
					name: body.name,
					description: body.description,
				});
				deps.agentServiceRegistry.updateProfile(profile);
				return {
					agent: {
						agentId: profile.agentId,
						name: profile.name,
						description: profile.description,
					},
				};
			} catch (error) {
				return reply.status(400).send({
					error: "BAD_REQUEST",
					message: error instanceof Error ? error.message : "Unable to update agent profile.",
				});
			}
		},
	);

	app.post(
		"/v1/agents/:agentId/archive",
		async (
			request: FastifyRequest<{ Params: { agentId?: string } }>,
			reply,
		): Promise<{ archived: true; agentId: string; archivedPath: string } | FastifyReply> => {
			const { agentId } = request.params ?? {};
			if (!agentId || !deps.projectRoot || !deps.agentServiceRegistry) {
				return sendUnknownAgent(reply, agentId);
			}
			const service = resolveScopedAgentService(agentId);
			if (!service) {
				return sendUnknownAgent(reply, agentId);
			}
			try {
				const catalog = await service.getConversationCatalog();
				if (catalog.conversations.some((conversation) => conversation.running)) {
					return reply.status(409).send({
						error: "CONFLICT",
						message: `Agent ${agentId} has a running conversation and cannot be archived.`,
					});
				}
				const archived = await archiveStoredAgentProfile(deps.projectRoot, agentId);
				deps.agentServiceRegistry.remove(agentId);
				return {
					archived: true,
					agentId: archived.agentId,
					archivedPath: archived.archivedPath,
				};
			} catch (error) {
				return reply.status(400).send({
					error: "BAD_REQUEST",
					message: error instanceof Error ? error.message : "Unable to archive agent profile.",
				});
			}
		},
	);

	app.get(
		"/v1/agents/:agentId/debug/skills",
		async (
			request: FastifyRequest<{ Params: { agentId?: string } }>,
			reply,
		): Promise<DebugSkillsResponseBody | FastifyReply> => {
			const service = resolveScopedAgentService(request.params?.agentId);
			if (!service) {
				return sendUnknownAgent(reply, request.params?.agentId);
			}
			return await service.getAvailableSkills();
		},
	);

	app.get(
		"/v1/agents/:agentId/rules",
		async (
			request: FastifyRequest<{ Params: { agentId?: string } }>,
			reply,
		): Promise<
			| {
					agentId: string;
					fileName: string;
					path: string;
					exists: boolean;
					content: string;
			  }
			| FastifyReply
		> => {
			const agentId = request.params?.agentId;
			if (!agentId || !resolveScopedAgentService(agentId)) {
				return sendUnknownAgent(reply, agentId);
			}
			const rulesPath = resolveAgentRulesPath(agentId);
			if (!rulesPath) {
				return sendUnknownAgent(reply, agentId);
			}
			try {
				return {
					agentId,
					fileName: "AGENTS.md",
					path: rulesPath,
					exists: true,
					content: await readFile(rulesPath, "utf8"),
				};
			} catch (error) {
				if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
					return {
						agentId,
						fileName: "AGENTS.md",
						path: rulesPath,
						exists: false,
						content: "",
					};
				}
				return sendInternalError(reply, error);
			}
		},
	);

	app.patch(
		"/v1/agents/:agentId/rules",
		async (
			request: FastifyRequest<{
				Params: { agentId?: string };
				Body: { content?: string };
			}>,
			reply,
		): Promise<
			| {
					agentId: string;
					fileName: string;
					path: string;
					exists: boolean;
					content: string;
			  }
			| FastifyReply
		> => {
			const agentId = request.params?.agentId;
			if (!agentId || !resolveScopedAgentService(agentId)) {
				return sendUnknownAgent(reply, agentId);
			}
			const rulesPath = resolveAgentRulesPath(agentId);
			if (!rulesPath) {
				return sendUnknownAgent(reply, agentId);
			}
			const content = request.body?.content;
			if (typeof content !== "string") {
				return sendBadRequest(reply, "content must be a string");
			}
			if (content.length > 200_000) {
				return sendBadRequest(reply, "content is too large");
			}
			try {
				await mkdir(dirname(rulesPath), { recursive: true });
				await writeFile(rulesPath, content, "utf8");
				return {
					agentId,
					fileName: "AGENTS.md",
					path: rulesPath,
					exists: true,
					content,
				};
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.get(
		"/v1/agents/:agentId/chat/conversations",
		async (
			request: FastifyRequest<{ Params: { agentId?: string } }>,
			reply,
		): Promise<ConversationCatalogResponseBody | FastifyReply> => {
			const service = resolveScopedAgentService(request.params?.agentId);
			if (!service) {
				return sendUnknownAgent(reply, request.params?.agentId);
			}
			return await service.getConversationCatalog();
		},
	);

	app.post(
		"/v1/agents/:agentId/chat/conversations",
		async (
			request: FastifyRequest<{ Params: { agentId?: string } }>,
			reply,
		): Promise<CreateConversationResponseBody | FastifyReply> => {
			const service = resolveScopedAgentService(request.params?.agentId);
			if (!service) {
				return sendUnknownAgent(reply, request.params?.agentId);
			}
			return await service.createConversation();
		},
	);

	app.delete(
		"/v1/agents/:agentId/chat/conversations/:conversationId",
		async (
			request: FastifyRequest<{
				Params: { agentId?: string; conversationId?: string };
			}>,
			reply,
		): Promise<DeleteConversationResponseBody | FastifyReply> => {
			const service = resolveScopedAgentService(request.params?.agentId);
			if (!service) {
				return sendUnknownAgent(reply, request.params?.agentId);
			}
			const { conversationId } = request.params ?? {};
			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}
			try {
				return await service.deleteConversation(conversationId);
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.post(
		"/v1/agents/:agentId/chat/current",
		async (
			request: FastifyRequest<{
				Params: { agentId?: string };
				Body: Partial<SwitchConversationRequestBody>;
			}>,
			reply,
		): Promise<SwitchConversationResponseBody | FastifyReply> => {
			const service = resolveScopedAgentService(request.params?.agentId);
			if (!service) {
				return sendUnknownAgent(reply, request.params?.agentId);
			}
			const { conversationId } = request.body ?? {};
			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}
			try {
				return await service.switchConversation(conversationId);
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.get(
		"/v1/agents/:agentId/chat/state",
		async (
			request: FastifyRequest<{
				Params: { agentId?: string };
				Querystring: { conversationId?: string; viewLimit?: string };
			}>,
			reply,
		): Promise<ConversationStateResponseBody | FastifyReply> => {
			const service = resolveScopedAgentService(request.params?.agentId);
			if (!service) {
				return sendUnknownAgent(reply, request.params?.agentId);
			}
			const { conversationId, viewLimit } = request.query ?? {};
			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}
			const parsedViewLimit = parseOptionalPositiveInteger(viewLimit, "viewLimit");
			if (parsedViewLimit.error) {
				return sendBadRequest(reply, parsedViewLimit.error);
			}
			try {
				return await service.getConversationState(conversationId, {
					viewLimit: parsedViewLimit.value,
				});
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.get(
		"/v1/agents/:agentId/chat/status",
		async (
			request: FastifyRequest<{
				Params: { agentId?: string };
				Querystring: { conversationId?: string };
			}>,
			reply,
		): Promise<ChatStatusResponseBody | FastifyReply> => {
			const service = resolveScopedAgentService(request.params?.agentId);
			if (!service) {
				return sendUnknownAgent(reply, request.params?.agentId);
			}
			const { conversationId } = request.query ?? {};
			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}
			try {
				return await service.getRunStatus(conversationId);
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.get(
		"/v1/agents/:agentId/chat/history",
		async (
			request: FastifyRequest<{
				Params: { agentId?: string };
				Querystring: { conversationId?: string; limit?: string; before?: string };
			}>,
			reply,
		): Promise<ChatHistoryResponseBody | FastifyReply> => {
			const service = resolveScopedAgentService(request.params?.agentId);
			if (!service) {
				return sendUnknownAgent(reply, request.params?.agentId);
			}
			const { conversationId, limit, before } = request.query ?? {};
			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}
			const parsedLimit = parseOptionalPositiveInteger(limit, "limit");
			if (parsedLimit.error) {
				return sendBadRequest(reply, parsedLimit.error);
			}
			try {
				return await service.getConversationHistory(conversationId, {
					limit: parsedLimit.value,
					before: typeof before === "string" && before.trim().length > 0 ? before.trim() : undefined,
				});
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.get(
		"/v1/agents/:agentId/chat/events",
		async (
			request: FastifyRequest<{
				Params: { agentId?: string };
				Querystring: { conversationId?: string };
			}>,
			reply,
		): Promise<FastifyReply | void> => {
			const service = resolveScopedAgentService(request.params?.agentId);
			if (!service) {
				return sendUnknownAgent(reply, request.params?.agentId);
			}
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
			subscription = service.subscribeRunEvents(conversationId, (event) => {
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
		"/v1/agents/:agentId/chat/runs/:runId/events",
		async (
			request: FastifyRequest<{
				Params: { agentId?: string; runId?: string };
				Querystring: { conversationId?: string; limit?: string; before?: string };
			}>,
			reply,
		): Promise<ChatRunEventsResponseBody | FastifyReply> => {
			const service = resolveScopedAgentService(request.params?.agentId);
			if (!service) {
				return sendUnknownAgent(reply, request.params?.agentId);
			}
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
				const page = paginateChatRunEvents(await service.getRunEvents(conversationId, runId), parsedPage.value);
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
		"/v1/agents/:agentId/chat",
		async (
			request: FastifyRequest<{
				Params: { agentId?: string };
				Body: Partial<ChatRequestBody>;
			}>,
			reply,
		): Promise<ChatResponseBody | FastifyReply> => {
			const service = resolveScopedAgentService(request.params?.agentId);
			if (!service) {
				return sendUnknownAgent(reply, request.params?.agentId);
			}
			const parsedBody = parseChatMessageBody(request.body ?? {});
			if (parsedBody.error) {
				return sendBadRequest(reply, parsedBody.error);
			}
			const body = parsedBody.value!;
			try {
				return await service.chat({
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
		"/v1/agents/:agentId/chat/stream",
		async (
			request: FastifyRequest<{
				Params: { agentId?: string };
				Body: Partial<ChatRequestBody>;
			}>,
			reply,
		): Promise<FastifyReply | void> => {
			const service = resolveScopedAgentService(request.params?.agentId);
			if (!service) {
				return sendUnknownAgent(reply, request.params?.agentId);
			}
			const parsedBody = parseChatMessageBody(request.body ?? {});
			if (parsedBody.error) {
				return sendBadRequest(reply, parsedBody.error);
			}
			const body = parsedBody.value!;
			reply.hijack();
			configureSseResponse(reply.raw);
			const heartbeat = startSseHeartbeat(reply.raw);
			try {
				await service.streamChat(
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
		"/v1/agents/:agentId/chat/queue",
		async (
			request: FastifyRequest<{
				Params: { agentId?: string };
				Body: Partial<QueueMessageRequestBody>;
			}>,
			reply,
		): Promise<QueueMessageResponseBody | FastifyReply> => {
			const service = resolveScopedAgentService(request.params?.agentId);
			if (!service) {
				return sendUnknownAgent(reply, request.params?.agentId);
			}
			const parsedBody = parseQueueMessageBody(request.body ?? {});
			if (parsedBody.error) {
				return sendBadRequest(reply, parsedBody.error);
			}
			const body = parsedBody.value!;
			try {
				return await service.queueMessage({
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
		"/v1/agents/:agentId/chat/reset",
		async (
			request: FastifyRequest<{
				Params: { agentId?: string };
				Body: Partial<ResetConversationRequestBody>;
			}>,
			reply,
		): Promise<ResetConversationResponseBody | FastifyReply> => {
			const service = resolveScopedAgentService(request.params?.agentId);
			if (!service) {
				return sendUnknownAgent(reply, request.params?.agentId);
			}
			const { conversationId } = request.body ?? {};
			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}
			try {
				return await service.resetConversation({ conversationId });
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.post(
		"/v1/agents/:agentId/chat/interrupt",
		async (
			request: FastifyRequest<{
				Params: { agentId?: string };
				Body: Partial<InterruptChatRequestBody>;
			}>,
			reply,
		): Promise<InterruptChatResponseBody | FastifyReply> => {
			const service = resolveScopedAgentService(request.params?.agentId);
			if (!service) {
				return sendUnknownAgent(reply, request.params?.agentId);
			}
			const { conversationId } = request.body ?? {};
			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}
			try {
				return await service.interruptChat({ conversationId });
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

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
