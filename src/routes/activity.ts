import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AgentActivityItem, AgentActivityListOptions, AgentActivityStore } from "../agent/agent-activity-store.js";
import type {
	AgentActivityItemBody,
	AgentActivityListResponseBody,
	AgentActivityReadResponseBody,
	ErrorResponseBody,
} from "../types/api.js";

interface ActivityRouteDependencies {
	activityStore: Pick<AgentActivityStore, "get" | "list" | "markRead">;
}

function sendBadRequest(reply: FastifyReply, message: string): FastifyReply {
	return reply.status(400).send({
		error: {
			code: "BAD_REQUEST",
			message,
		},
	} satisfies ErrorResponseBody);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function parseLimit(value: unknown): { limit?: number; error?: string } {
	if (value === undefined) {
		return {};
	}
	const numericValue = typeof value === "string" ? Number(value) : value;
	if (!Number.isInteger(numericValue) || Number(numericValue) <= 0) {
		return { error: 'Query "limit" must be a positive integer' };
	}
	return { limit: Number(numericValue) };
}

function parseListOptions(query: Record<string, unknown>): { options?: AgentActivityListOptions; error?: string } {
	const parsedLimit = parseLimit(query.limit);
	if (parsedLimit.error) {
		return { error: parsedLimit.error };
	}
	if (query.conversationId !== undefined && !isNonEmptyString(query.conversationId)) {
		return { error: 'Query "conversationId" must be a non-empty string when provided' };
	}
	if (query.before !== undefined && !isNonEmptyString(query.before)) {
		return { error: 'Query "before" must be a non-empty string when provided' };
	}

	return {
		options: {
			...(parsedLimit.limit ? { limit: parsedLimit.limit } : {}),
			...(isNonEmptyString(query.conversationId) ? { conversationId: query.conversationId.trim() } : {}),
			...(isNonEmptyString(query.before) ? { before: query.before.trim() } : {}),
		},
	};
}

export function registerActivityRoutes(app: FastifyInstance, deps: ActivityRouteDependencies): void {
	app.get(
		"/v1/activity",
		async (
			request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
			reply,
		): Promise<AgentActivityListResponseBody | FastifyReply> => {
			const parsed = parseListOptions(request.query ?? {});
			if (parsed.error) {
				return sendBadRequest(reply, parsed.error);
			}
			const activities = await deps.activityStore.list(parsed.options);
			return { activities: activities.map(toActivityBody) };
		},
	);

	app.post(
		"/v1/activity/:activityId/read",
		async (
			request: FastifyRequest<{ Params: { activityId?: string } }>,
			reply,
		): Promise<AgentActivityReadResponseBody | FastifyReply> => {
			const activityId = request.params.activityId?.trim();
			if (!activityId) {
				return sendBadRequest(reply, 'Path parameter "activityId" must be a non-empty string');
			}
			const marked = await deps.activityStore.markRead(activityId);
			if (!marked) {
				return reply.status(404).send();
			}
			const activity = await deps.activityStore.get(activityId);
			if (!activity) {
				return reply.status(404).send();
			}
			return { activity: toActivityBody(activity) };
		},
	);
}

function toActivityBody(activity: AgentActivityItem): AgentActivityItemBody {
	return {
		activityId: activity.activityId,
		scope: activity.scope,
		source: activity.source,
		sourceId: activity.sourceId,
		...(activity.runId ? { runId: activity.runId } : {}),
		...(activity.conversationId ? { conversationId: activity.conversationId } : {}),
		kind: activity.kind,
		title: activity.title,
		text: activity.text,
		files: activity.files,
		createdAt: activity.createdAt,
		...(activity.readAt ? { readAt: activity.readAt } : {}),
	};
}
