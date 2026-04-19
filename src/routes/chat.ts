import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ServerResponse } from "node:http";
import type { AgentService } from "../agent/agent-service.js";
import type {
	ChatAttachmentBody,
	ChatAssetBody,
	ChatRequestBody,
	ChatResponseBody,
	ChatStatusResponseBody,
	ChatStreamEvent,
	DebugSkillsResponseBody,
	ErrorResponseBody,
	InterruptChatRequestBody,
	InterruptChatResponseBody,
	QueueMessageMode,
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

function sendInternalError(reply: FastifyReply, error: unknown): FastifyReply {
	const messageText = error instanceof Error ? error.message : "Unknown internal error";
	return reply.status(500).send({
		error: {
			code: "INTERNAL_ERROR",
			message: messageText,
		},
	} satisfies ErrorResponseBody);
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

function isValidMessage(message: unknown): message is string {
	return typeof message === "string" && message.trim().length > 0;
}

function isValidConversationId(conversationId: unknown): conversationId is string {
	return typeof conversationId === "string" && conversationId.trim().length > 0;
}

function isValidQueueMode(mode: unknown): mode is QueueMessageMode {
	return mode === "steer" || mode === "followUp";
}

function parseAttachments(value: unknown): { attachments?: ChatAttachmentBody[]; error?: string } {
	if (value === undefined) {
		return {};
	}
	if (!Array.isArray(value)) {
		return { error: 'Field "attachments" must be an array when provided' };
	}
	if (value.length > 5) {
		return { error: 'Field "attachments" supports at most 5 files' };
	}

	const attachments: ChatAttachmentBody[] = [];
	for (const [index, rawAttachment] of value.entries()) {
		if (!rawAttachment || typeof rawAttachment !== "object") {
			return { error: `attachments[${index}] must be an object` };
		}
		const attachment = rawAttachment as Record<string, unknown>;
		if (typeof attachment.fileName !== "string" || attachment.fileName.trim().length === 0) {
			return { error: `attachments[${index}].fileName must be a non-empty string` };
		}
		if (attachment.mimeType !== undefined && typeof attachment.mimeType !== "string") {
			return { error: `attachments[${index}].mimeType must be a string when provided` };
		}
		if (attachment.sizeBytes !== undefined && (typeof attachment.sizeBytes !== "number" || !Number.isFinite(attachment.sizeBytes) || attachment.sizeBytes < 0)) {
			return { error: `attachments[${index}].sizeBytes must be a non-negative number when provided` };
		}
		if (attachment.text !== undefined && typeof attachment.text !== "string") {
			return { error: `attachments[${index}].text must be a string when provided` };
		}
		if (attachment.base64 !== undefined && typeof attachment.base64 !== "string") {
			return { error: `attachments[${index}].base64 must be a string when provided` };
		}
		if (attachment.text !== undefined && attachment.base64 !== undefined) {
			return { error: `attachments[${index}] cannot provide both text and base64` };
		}

		attachments.push({
			fileName: attachment.fileName,
			mimeType: typeof attachment.mimeType === "string" ? attachment.mimeType : undefined,
			sizeBytes: typeof attachment.sizeBytes === "number" ? attachment.sizeBytes : undefined,
			text: typeof attachment.text === "string" ? attachment.text : undefined,
			base64: typeof attachment.base64 === "string" ? attachment.base64 : undefined,
		});
	}

	return { attachments };
}

function parseAssetRefs(value: unknown): { assetRefs?: string[]; error?: string } {
	if (value === undefined) {
		return {};
	}
	if (!Array.isArray(value)) {
		return { error: 'Field "assetRefs" must be an array when provided' };
	}
	if (value.length > 20) {
		return { error: 'Field "assetRefs" supports at most 20 asset ids' };
	}

	const assetRefs: string[] = [];
	for (const [index, rawAssetId] of value.entries()) {
		if (typeof rawAssetId !== "string" || rawAssetId.trim().length === 0) {
			return { error: `assetRefs[${index}] must be a non-empty string` };
		}
		assetRefs.push(rawAssetId.trim());
	}

	return { assetRefs };
}

export function registerChatRoutes(app: FastifyInstance, deps: ChatRouteDependencies): void {
	app.get("/v1/debug/skills", async (): Promise<DebugSkillsResponseBody> => {
		return {
			skills: await deps.agentService.getAvailableSkills(),
		};
	});

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
				writeSseEvent(reply.raw, {
					type: "error",
					message: `Conversation ${conversationId} is not running`,
				});
				closeStream();
			}

			if (closed) {
				subscription.unsubscribe();
			}
		},
	);

	app.post(
		"/v1/chat",
		async (
			request: FastifyRequest<{ Body: Partial<ChatRequestBody> }>,
			reply,
		): Promise<ChatResponseBody | FastifyReply> => {
			const { conversationId, message, userId, attachments, assetRefs } = request.body ?? {};

			if (!isValidMessage(message)) {
				return sendBadRequest(reply, 'Field "message" must be a non-empty string');
			}
			const parsedAttachments = parseAttachments(attachments);
			if (parsedAttachments.error) {
				return sendBadRequest(reply, parsedAttachments.error);
			}
			const parsedAssetRefs = parseAssetRefs(assetRefs);
			if (parsedAssetRefs.error) {
				return sendBadRequest(reply, parsedAssetRefs.error);
			}

			try {
				return await deps.agentService.chat({
					conversationId,
					message,
					userId,
					...(parsedAttachments.attachments ? { attachments: parsedAttachments.attachments } : {}),
					...(parsedAssetRefs.assetRefs ? { assetRefs: parsedAssetRefs.assetRefs } : {}),
				});
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);

	app.post(
		"/v1/chat/stream",
		async (request: FastifyRequest<{ Body: Partial<ChatRequestBody> }>, reply): Promise<FastifyReply | void> => {
			const { conversationId, message, userId, attachments, assetRefs } = request.body ?? {};

			if (!isValidMessage(message)) {
				return sendBadRequest(reply, 'Field "message" must be a non-empty string');
			}
			const parsedAttachments = parseAttachments(attachments);
			if (parsedAttachments.error) {
				return sendBadRequest(reply, parsedAttachments.error);
			}
			const parsedAssetRefs = parseAssetRefs(assetRefs);
			if (parsedAssetRefs.error) {
				return sendBadRequest(reply, parsedAssetRefs.error);
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
						...(parsedAttachments.attachments ? { attachments: parsedAttachments.attachments } : {}),
						...(parsedAssetRefs.assetRefs ? { assetRefs: parsedAssetRefs.assetRefs } : {}),
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
			const { conversationId, message, mode, userId, attachments, assetRefs } = request.body ?? {};

			if (!isValidConversationId(conversationId)) {
				return sendBadRequest(reply, 'Field "conversationId" must be a non-empty string');
			}
			if (!isValidMessage(message)) {
				return sendBadRequest(reply, 'Field "message" must be a non-empty string');
			}
			if (!isValidQueueMode(mode)) {
				return sendBadRequest(reply, 'Field "mode" must be either "steer" or "followUp"');
			}
			const parsedAttachments = parseAttachments(attachments);
			if (parsedAttachments.error) {
				return sendBadRequest(reply, parsedAttachments.error);
			}
			const parsedAssetRefs = parseAssetRefs(assetRefs);
			if (parsedAssetRefs.error) {
				return sendBadRequest(reply, parsedAssetRefs.error);
			}

			try {
				return await deps.agentService.queueMessage({
					conversationId,
					message,
					mode,
					userId,
					...(parsedAttachments.attachments ? { attachments: parsedAttachments.attachments } : {}),
					...(parsedAssetRefs.assetRefs ? { assetRefs: parsedAssetRefs.assetRefs } : {}),
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
