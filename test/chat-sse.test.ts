import assert from "node:assert/strict";
import test from "node:test";
import {
	configureSseResponse,
	endSseResponse,
	isTerminalChatStreamEvent,
	writeSseEvent,
} from "../src/routes/chat-sse.js";
import type { ChatStreamEvent } from "../src/types/api.js";

function createRawResponse(overrides: Partial<{
	destroyed: boolean;
	writableEnded: boolean;
	write: (chunk: string) => boolean;
	end: () => void;
}> = {}) {
	const writes: string[] = [];
	let ended = false;
	return {
		writes,
		get ended() {
			return ended;
		},
		raw: {
			destroyed: overrides.destroyed ?? false,
			writableEnded: overrides.writableEnded ?? false,
			write: overrides.write ?? ((chunk: string) => {
				writes.push(chunk);
				return true;
			}),
			end: overrides.end ?? (() => {
				ended = true;
			}),
		},
	};
}

test("writeSseEvent writes a JSON server-sent event frame", () => {
	const response = createRawResponse();
	const event: ChatStreamEvent = {
		type: "done",
		conversationId: "conversation-1",
		runId: "run-1",
		text: "ok",
	};

	writeSseEvent(response.raw, event);

	assert.deepEqual(response.writes, [`data: ${JSON.stringify(event)}\n\n`]);
});

test("configureSseResponse applies the standard SSE headers and flushes them", () => {
	const headers: Record<string, string> = {};
	let flushed = false;
	const raw = {
		setHeader: (name: string, value: string) => {
			headers[name] = value;
		},
		flushHeaders: () => {
			flushed = true;
		},
	};

	configureSseResponse(raw);

	assert.deepEqual(headers, {
		"Content-Type": "text/event-stream; charset=utf-8",
		"Cache-Control": "no-cache, no-transform",
		"Connection": "keep-alive",
		"X-Accel-Buffering": "no",
	});
	assert.equal(flushed, true);
});

test("writeSseEvent ignores closed responses and swallowed write failures", () => {
	const closed = createRawResponse({ writableEnded: true });
	writeSseEvent(closed.raw, { type: "text_delta", textDelta: "ignored" });
	assert.deepEqual(closed.writes, []);

	const failed = createRawResponse({
		write: () => {
			throw new Error("socket closed");
		},
	});
	assert.doesNotThrow(() => {
		writeSseEvent(failed.raw, { type: "text_delta", textDelta: "ignored" });
	});
});

test("endSseResponse ends only open responses", () => {
	const open = createRawResponse();
	endSseResponse(open.raw);
	assert.equal(open.ended, true);

	const closed = createRawResponse({
		writableEnded: true,
		end: () => {
			throw new Error("should not end twice");
		},
	});
	assert.doesNotThrow(() => endSseResponse(closed.raw));
});

test("isTerminalChatStreamEvent identifies stream-ending event types", () => {
	assert.equal(isTerminalChatStreamEvent({ type: "done", conversationId: "c", runId: "r", text: "" }), true);
	assert.equal(isTerminalChatStreamEvent({ type: "interrupted", conversationId: "c", runId: "r" }), true);
	assert.equal(isTerminalChatStreamEvent({ type: "error", conversationId: "c", runId: "r", message: "x" }), true);
	assert.equal(isTerminalChatStreamEvent({ type: "text_delta", textDelta: "still running" }), false);
});
