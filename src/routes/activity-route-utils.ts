import type { AgentActivityItem, AgentActivityListOptions } from "../agent/agent-activity-store.js";
import type { AgentActivityItemBody } from "../types/api.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

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

export function parseActivityListOptions(query: Record<string, unknown>): {
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

export function normalizeActivityListLimit(value: number | undefined): number {
	if (!Number.isFinite(value)) {
		return DEFAULT_LIST_LIMIT;
	}
	return Math.max(1, Math.min(Math.trunc(Number(value)), MAX_LIST_LIMIT));
}

export function toActivityBody(activity: AgentActivityItem): AgentActivityItemBody {
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
