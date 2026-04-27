import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AgentActivityStore } from "../agent/agent-activity-store.js";
import { sendBadRequest } from "./http-errors.js";
import type {
	AgentActivityListResponseBody,
	AgentActivityMarkAllReadResponseBody,
	AgentActivityReadResponseBody,
	AgentActivitySummaryResponseBody,
} from "../types/api.js";
import { normalizeActivityListLimit, parseActivityListOptions, toActivityBody } from "./activity-route-utils.js";

interface ActivityRouteDependencies {
	activityStore: Pick<AgentActivityStore, "get" | "list" | "markRead" | "markAllRead" | "getUnreadCount">;
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
			const parsed = parseActivityListOptions(request.query ?? {});
			if (parsed.error) {
				return sendBadRequest(reply, parsed.error);
			}
			const requestedLimit = normalizeActivityListLimit(parsed.requestedLimit);
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
				...(hasMore && lastVisible?.createdAt ? { nextBefore: `${lastVisible.createdAt}|${lastVisible.activityId}` } : {}),
				unreadCount: await deps.activityStore.getUnreadCount(),
			};
		},
	);

	app.post(
		"/v1/activity/read-all",
		async (): Promise<AgentActivityMarkAllReadResponseBody> => {
			const markedCount = await deps.activityStore.markAllRead();
			return {
				markedCount,
				unreadCount: await deps.activityStore.getUnreadCount(),
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
			return {
				activity: toActivityBody(activity),
				unreadCount: await deps.activityStore.getUnreadCount(),
			};
		},
	);
}
