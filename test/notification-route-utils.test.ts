import assert from "node:assert/strict";
import test from "node:test";
import { parseNotificationBroadcastEvent } from "../src/routes/notification-route-utils.js";

test("parseNotificationBroadcastEvent trims notification payload fields", () => {
	const parsed = parseNotificationBroadcastEvent({
		notificationId: " notice-1 ",
		activityId: " activity-1 ",
		conversationId: " manual:notice ",
		source: " conn ",
		sourceId: " conn-1 ",
		runId: " run-1 ",
		kind: " completed ",
		title: " Done ",
		createdAt: " 2026-04-22T10:02:00.000Z ",
	});

	assert.equal(parsed.error, undefined);
	assert.deepEqual(parsed.event, {
		notificationId: "notice-1",
		activityId: "activity-1",
		conversationId: "manual:notice",
		source: "conn",
		sourceId: "conn-1",
		runId: "run-1",
		kind: "completed",
		title: "Done",
		createdAt: "2026-04-22T10:02:00.000Z",
	});
});

test("parseNotificationBroadcastEvent accepts activityId without notificationId", () => {
	const parsed = parseNotificationBroadcastEvent({
		activityId: "activity-1",
		source: "conn",
		sourceId: "conn-1",
		kind: "completed",
		title: "Done",
		createdAt: "2026-04-22T10:02:00.000Z",
	});

	assert.equal(parsed.error, undefined);
	assert.equal(parsed.event?.activityId, "activity-1");
	assert.equal(parsed.event?.notificationId, undefined);
});

test("parseNotificationBroadcastEvent rejects invalid payloads", () => {
	assert.deepEqual(parseNotificationBroadcastEvent(undefined), {
		error: "Request body must be an object",
	});
	assert.deepEqual(parseNotificationBroadcastEvent({ source: "conn" }), {
		error: 'Field "notificationId" or "activityId" must be a non-empty string',
	});
	assert.deepEqual(
		parseNotificationBroadcastEvent({
			activityId: "activity-1",
			source: "conn",
			sourceId: "conn-1",
			kind: "completed",
			title: "Done",
			createdAt: "",
		}),
		{ error: 'Field "createdAt" must be a non-empty string' },
	);
});
