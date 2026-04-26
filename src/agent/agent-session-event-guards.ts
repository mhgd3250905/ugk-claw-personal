import type {
	MessageUpdateEventLike,
	QueueUpdateEventLike,
	RawAgentSessionEventLike,
	ToolExecutionEndEventLike,
	ToolExecutionStartEventLike,
	ToolExecutionUpdateEventLike,
} from "./agent-session-factory.js";

export function isMessageUpdateEvent(event: RawAgentSessionEventLike): event is MessageUpdateEventLike {
	return event.type === "message_update" && "assistantMessageEvent" in event;
}

export function isToolExecutionStartEvent(event: RawAgentSessionEventLike): event is ToolExecutionStartEventLike {
	return event.type === "tool_execution_start" && hasStringProperty(event, "toolCallId") && hasStringProperty(event, "toolName");
}

export function isToolExecutionUpdateEvent(event: RawAgentSessionEventLike): event is ToolExecutionUpdateEventLike {
	return event.type === "tool_execution_update" && hasStringProperty(event, "toolCallId") && hasStringProperty(event, "toolName");
}

export function isToolExecutionEndEvent(event: RawAgentSessionEventLike): event is ToolExecutionEndEventLike {
	return (
		event.type === "tool_execution_end" &&
		hasStringProperty(event, "toolCallId") &&
		hasStringProperty(event, "toolName") &&
		"isError" in event &&
		typeof event.isError === "boolean"
	);
}

export function isQueueUpdateEvent(event: RawAgentSessionEventLike): event is QueueUpdateEventLike {
	return event.type === "queue_update" && Array.isArray(event.steering) && Array.isArray(event.followUp);
}

function hasStringProperty(value: object, propertyName: string): boolean {
	return propertyName in value && typeof value[propertyName as keyof typeof value] === "string";
}
