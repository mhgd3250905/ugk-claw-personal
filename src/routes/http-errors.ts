import type { FastifyReply } from "fastify";
import type { ErrorResponseBody } from "../types/api.js";

export function sendBadRequest(reply: FastifyReply, message: string): FastifyReply {
	return sendErrorResponse(reply, 400, "BAD_REQUEST", message);
}

export function sendPayloadTooLarge(reply: FastifyReply, message: string): FastifyReply {
	return sendErrorResponse(reply, 413, "PAYLOAD_TOO_LARGE", message);
}

export function sendInternalError(reply: FastifyReply, error: unknown): FastifyReply {
	const message = error instanceof Error ? error.message : "Unknown internal error";
	return sendErrorResponse(reply, 500, "INTERNAL_ERROR", message);
}

function sendErrorResponse(
	reply: FastifyReply,
	statusCode: 400 | 413 | 500,
	code: ErrorResponseBody["error"]["code"],
	message: string,
): FastifyReply {
	return reply.status(statusCode).send({
		error: {
			code,
			message,
		},
	} satisfies ErrorResponseBody);
}
