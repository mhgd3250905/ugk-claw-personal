import assert from "node:assert/strict";
import test from "node:test";
import {
	normalizeActivityListLimit,
	parseActivityListOptions,
	toActivityBody,
} from "../src/routes/activity-route-utils.js";

test("parseActivityListOptions trims filters and preserves unreadOnly semantics", () => {
	const parsed = parseActivityListOptions({
		limit: "25",
		conversationId: " manual:one ",
		before: " 2026-04-22T10:02:00.000Z ",
		unreadOnly: "yes",
	});

	assert.equal(parsed.error, undefined);
	assert.deepEqual(parsed.options, {
		limit: 25,
		conversationId: "manual:one",
		before: "2026-04-22T10:02:00.000Z",
		unreadOnly: true,
	});
	assert.equal(parsed.requestedLimit, 25);
});

test("parseActivityListOptions rejects invalid query values", () => {
	assert.deepEqual(parseActivityListOptions({ limit: "nope" }), {
		error: 'Query "limit" must be a positive integer',
	});
	assert.deepEqual(parseActivityListOptions({ unreadOnly: "maybe" }), {
		error: 'Query "unreadOnly" must be a boolean when provided',
	});
	assert.deepEqual(parseActivityListOptions({ conversationId: "" }), {
		error: 'Query "conversationId" must be a non-empty string when provided',
	});
});

test("normalizeActivityListLimit clamps missing and excessive limits", () => {
	assert.equal(normalizeActivityListLimit(undefined), 50);
	assert.equal(normalizeActivityListLimit(0), 1);
	assert.equal(normalizeActivityListLimit(500), 200);
	assert.equal(normalizeActivityListLimit(3.9), 3);
});

test("toActivityBody omits absent optional fields", () => {
	const body = toActivityBody({
		activityId: "activity-1",
		scope: "agent",
		source: "conn",
		sourceId: "conn-1",
		kind: "completed",
		title: "Done",
		text: "Finished",
		files: [],
		createdAt: "2026-04-22T10:02:00.000Z",
	});

	assert.deepEqual(body, {
		activityId: "activity-1",
		scope: "agent",
		source: "conn",
		sourceId: "conn-1",
		kind: "completed",
		title: "Done",
		text: "Finished",
		files: [],
		createdAt: "2026-04-22T10:02:00.000Z",
	});
});
