import type { NotificationBroadcastEvent } from "../agent/notification-hub.js";

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

export function parseNotificationBroadcastEvent(value: unknown): { event?: NotificationBroadcastEvent; error?: string } {
	if (!value || typeof value !== "object") {
		return { error: "Request body must be an object" };
	}

	const input = value as Record<string, unknown>;
	if (!isNonEmptyString(input.notificationId) && !isNonEmptyString(input.activityId)) {
		return { error: 'Field "notificationId" or "activityId" must be a non-empty string' };
	}
	if (input.conversationId !== undefined && !isNonEmptyString(input.conversationId)) {
		return { error: 'Field "conversationId" must be a non-empty string when provided' };
	}
	if (!isNonEmptyString(input.source)) {
		return { error: 'Field "source" must be a non-empty string' };
	}
	if (!isNonEmptyString(input.sourceId)) {
		return { error: 'Field "sourceId" must be a non-empty string' };
	}
	if (!isNonEmptyString(input.kind)) {
		return { error: 'Field "kind" must be a non-empty string' };
	}
	if (!isNonEmptyString(input.title)) {
		return { error: 'Field "title" must be a non-empty string' };
	}
	if (!isNonEmptyString(input.createdAt)) {
		return { error: 'Field "createdAt" must be a non-empty string' };
	}
	if (input.runId !== undefined && !isNonEmptyString(input.runId)) {
		return { error: 'Field "runId" must be a non-empty string when provided' };
	}

	return {
		event: {
			...(isNonEmptyString(input.notificationId) ? { notificationId: input.notificationId.trim() } : {}),
			...(isNonEmptyString(input.activityId) ? { activityId: input.activityId.trim() } : {}),
			...(isNonEmptyString(input.conversationId) ? { conversationId: input.conversationId.trim() } : {}),
			source: input.source.trim(),
			sourceId: input.sourceId.trim(),
			...(isNonEmptyString(input.runId) ? { runId: input.runId.trim() } : {}),
			kind: input.kind.trim(),
			title: input.title.trim(),
			createdAt: input.createdAt.trim(),
		},
	};
}
