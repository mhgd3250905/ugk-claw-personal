import { randomUUID } from "node:crypto";
import type { ChatActiveRunBody, ChatProcessBody, ChatProcessEntryBody, ChatStreamEvent } from "../types/api.js";
import type { AssetRecord } from "./asset-store.js";

export function createActiveRunView(
	conversationId: string,
	message: string,
	inputAssets: AssetRecord[],
): ChatActiveRunBody {
	const now = new Date().toISOString();
	const runId = `run-${sanitizeStateId(conversationId)}-${randomUUID()}`;
	return {
		runId,
		status: "running",
		assistantMessageId: `active-run-${sanitizeStateId(conversationId)}-${randomUUID()}`,
		input: {
			message,
			inputAssets: inputAssets.map((asset) => ({ ...asset })),
		},
		text: "",
		process: createEmptyProcess(),
		queue: null,
		loading: true,
		startedAt: now,
		updatedAt: now,
	};
}

export function sanitizeStateId(value: string): string {
	return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "conversation";
}

export function createEmptyProcess(): ChatProcessBody {
	return {
		title: "思考过程",
		narration: [],
		isComplete: false,
		entries: [],
	};
}

export function appendProcessEntry(
	view: ChatActiveRunBody,
	input: Omit<ChatProcessEntryBody, "id" | "createdAt">,
): void {
	const process = view.process ?? createEmptyProcess();
	const entry: ChatProcessEntryBody = {
		id: `process-${process.entries.length + 1}`,
		createdAt: new Date().toISOString(),
		...input,
	};
	process.entries.push(entry);
	process.kind = entry.kind;
	process.currentAction = formatProcessCurrentAction(entry.title, entry.toolName);
	process.narration.push(formatProcessNarration(entry));
	process.isComplete = false;
	view.process = process;
}

export function completeProcess(
	view: ChatActiveRunBody,
	kind: ChatProcessEntryBody["kind"],
	title: string,
	detail: string,
): void {
	appendProcessEntry(view, {
		kind,
		title,
		detail,
	});
	if (view.process) {
		view.process.isComplete = true;
	}
}

export function cloneActiveRunView(view: ChatActiveRunBody): ChatActiveRunBody {
	return {
		...view,
		input: {
			message: view.input.message,
			inputAssets: view.input.inputAssets.map((asset) => ({ ...asset })),
		},
		process: view.process
			? {
					...view.process,
					narration: [...view.process.narration],
					entries: view.process.entries.map((entry) => ({ ...entry })),
				}
			: null,
		queue: view.queue
			? {
					steering: [...view.queue.steering],
					followUp: [...view.queue.followUp],
				}
			: null,
	};
}

export function applyChatStreamEventToActiveRunView(view: ChatActiveRunBody, event: ChatStreamEvent): void {
	view.updatedAt = new Date().toISOString();
	switch (event.type) {
		case "run_started":
			appendProcessEntry(view, {
				kind: "system",
				title: "任务开始",
				detail: event.conversationId,
			});
			break;
		case "text_delta":
			view.text += event.textDelta;
			break;
		case "tool_started":
			appendProcessEntry(view, {
				kind: "tool",
				title: "工具开始",
				detail: event.args,
				toolCallId: event.toolCallId,
				toolName: event.toolName,
			});
			break;
		case "tool_updated":
			appendProcessEntry(view, {
				kind: "tool",
				title: "工具更新",
				detail: event.partialResult,
				toolCallId: event.toolCallId,
				toolName: event.toolName,
			});
			break;
		case "tool_finished":
			appendProcessEntry(view, {
				kind: event.isError ? "error" : "ok",
				title: "工具结束",
				detail: event.result,
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				isError: event.isError,
			});
			break;
		case "queue_updated":
			view.queue = {
				steering: [...event.steering],
				followUp: [...event.followUp],
			};
			break;
		case "interrupted":
			view.status = "interrupted";
			view.loading = false;
			completeProcess(view, "system", "任务已打断", event.conversationId);
			break;
		case "done":
			view.status = "done";
			view.loading = false;
			view.text = event.text;
			completeProcess(view, "ok", "任务完成", event.sessionFile ?? "");
			break;
		case "error":
			view.status = "error";
			view.loading = false;
			completeProcess(view, "error", "任务错误", event.message);
			break;
		default:
			break;
	}
}

function formatProcessCurrentAction(title: string, toolName?: string): string {
	return toolName ? `${title} · ${toolName}` : title;
}

function formatProcessNarration(entry: ChatProcessEntryBody): string {
	const subject = entry.toolName ? `${entry.title} · ${entry.toolName}` : entry.title;
	return entry.detail ? `${subject}\n${entry.detail}` : subject;
}
