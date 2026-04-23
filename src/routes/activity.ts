import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AgentActivityItem, AgentActivityListOptions, AgentActivityStore } from "../agent/agent-activity-store.js";
import type {
	AgentActivityItemBody,
	AgentActivityListResponseBody,
	AgentActivityMarkAllReadResponseBody,
	AgentActivityReadResponseBody,
	AgentActivitySummaryResponseBody,
	ErrorResponseBody,
} from "../types/api.js";

interface ActivityRouteDependencies {
	activityStore: Pick<AgentActivityStore, "get" | "list" | "markRead" | "markAllRead" | "getUnreadCount">;
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

function parseBoolean(value: unknown, name: string): { value?: boolean; error?: string } {
	if (value === undefined) {
		return {};
	}
	if (typeof value === "boolean") {
		return { value };
	}
	if (typeof value !== "string") {
		return { error: `Query "${name}" must be a boolean when provided` };
	}
	const normalized = value.trim().toLowerCase();
	if (["true", "1", "yes"].includes(normalized)) {
		return { value: true };
	}
	if (["false", "0", "no"].includes(normalized)) {
		return { value: false };
	}
	return { error: `Query "${name}" must be a boolean when provided` };
}

function parseListOptions(query: Record<string, unknown>): {
	options?: AgentActivityListOptions;
	requestedLimit?: number;
	error?: string;
} {
	const parsedLimit = parseLimit(query.limit);
	if (parsedLimit.error) {
		return { error: parsedLimit.error };
	}
	const parsedUnreadOnly = parseBoolean(query.unreadOnly, "unreadOnly");
	if (parsedUnreadOnly.error) {
		return { error: parsedUnreadOnly.error };
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
			...(parsedUnreadOnly.value === true ? { unreadOnly: true } : {}),
		},
		requestedLimit: parsedLimit.limit,
	};
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

function normalizeRequestedLimit(value: number | undefined): number {
	if (!Number.isFinite(value)) {
		return DEFAULT_LIST_LIMIT;
	}
	return Math.max(1, Math.min(Math.trunc(Number(value)), MAX_LIST_LIMIT));
}

export function registerActivityRoutes(app: FastifyInstance, deps: ActivityRouteDependencies): void {
	app.get("/v1/activity/summary", async (): Promise<AgentActivitySummaryResponseBody> => {
		return {
			unreadCount: await deps.activityStore.getUnreadCount(),
		};
	});

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
			const requestedLimit = normalizeRequestedLimit(parsed.requestedLimit);
			const activities = await deps.activityStore.list({
				...(parsed.options ?? {}),
				limit: requestedLimit + 1,
			});
			const visibleActivities = activities.slice(0, requestedLimit);
			const hasMore = activities.length > requestedLimit;
			const lastVisible = visibleActivities.at(-1);
			return {
				activities: visibleActivities.map(toActivityBody),
				hasMore,
				...(hasMore && lastVisible?.createdAt ? { nextBefore: lastVisible.createdAt } : {}),
			};
		},
	);

	app.post(
		"/v1/activity/read-all",
		async (): Promise<AgentActivityMarkAllReadResponseBody> => {
			return {
				markedCount: await deps.activityStore.markAllRead(),
			};
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
