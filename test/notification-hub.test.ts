import test from "node:test";
import assert from "node:assert/strict";
import { NotificationHub } from "../src/agent/notification-hub.js";

test("NotificationHub broadcasts events to active subscribers and stops after unsubscribe", () => {
	const hub = new NotificationHub();
	const events: unknown[] = [];
	const subscription = hub.subscribe((event) => {
		events.push(event);
	});

	hub.broadcast({
		notificationId: "notice-1",
		conversationId: "manual:notice",
		source: "conn",
		sourceId: "conn-1",
		runId: "run-1",
		kind: "conn_result",
		title: "Daily Digest completed",
		createdAt: "2026-04-21T10:01:05.000Z",
	});
	subscription.unsubscribe();
	hub.broadcast({
		notificationId: "notice-2",
		conversationId: "manual:notice",
		source: "conn",
		sourceId: "conn-1",
		runId: "run-2",
		kind: "conn_result",
		title: "Daily Digest completed again",
		createdAt: "2026-04-21T10:02:05.000Z",
	});

	assert.deepEqual(events, [
		{
			notificationId: "notice-1",
			conversationId: "manual:notice",
			source: "conn",
			sourceId: "conn-1",
			runId: "run-1",
			kind: "conn_result",
			title: "Daily Digest completed",
			createdAt: "2026-04-21T10:01:05.000Z",
		},
	]);
});
