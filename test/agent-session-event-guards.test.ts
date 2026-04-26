import assert from "node:assert/strict";
import test from "node:test";
import {
	isMessageUpdateEvent,
	isQueueUpdateEvent,
	isToolExecutionEndEvent,
	isToolExecutionStartEvent,
	isToolExecutionUpdateEvent,
} from "../src/agent/agent-session-event-guards.js";

test("session event guards recognize valid raw event shapes", () => {
	assert.equal(isMessageUpdateEvent({ type: "message_update", assistantMessageEvent: {} } as never), true);
	assert.equal(
		isToolExecutionStartEvent({
			type: "tool_execution_start",
			toolCallId: "tool-1",
			toolName: "bash",
		} as never),
		true,
	);
	assert.equal(
		isToolExecutionUpdateEvent({
			type: "tool_execution_update",
			toolCallId: "tool-1",
			toolName: "bash",
		} as never),
		true,
	);
	assert.equal(
		isToolExecutionEndEvent({
			type: "tool_execution_end",
			toolCallId: "tool-1",
			toolName: "bash",
			isError: false,
		} as never),
		true,
	);
	assert.equal(isQueueUpdateEvent({ type: "queue_update", steering: [], followUp: [] } as never), true);
});

test("session event guards reject incomplete tool and queue events", () => {
	assert.equal(
		isToolExecutionStartEvent({
			type: "tool_execution_start",
			toolCallId: "tool-1",
		} as never),
		false,
	);
	assert.equal(
		isToolExecutionEndEvent({
			type: "tool_execution_end",
			toolCallId: "tool-1",
			toolName: "bash",
			isError: "false",
		} as never),
		false,
	);
	assert.equal(isQueueUpdateEvent({ type: "queue_update", steering: [] } as never), false);
});
