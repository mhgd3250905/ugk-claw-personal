import assert from "node:assert/strict";
import test from "node:test";
import {
	applyChatStreamEventToActiveRunView,
	appendProcessEntry,
	cloneActiveRunView,
	completeProcess,
	createActiveRunView,
	sanitizeStateId,
} from "../src/agent/agent-active-run-view.js";
import type { AssetRecord } from "../src/agent/asset-store.js";

function asset(overrides: Partial<AssetRecord> = {}): AssetRecord {
	return {
		assetId: "asset-1",
		reference: "@asset[asset-1]",
		fileName: "note.txt",
		mimeType: "text/plain",
		sizeBytes: 12,
		kind: "text",
		hasContent: true,
		source: "user_upload",
		conversationId: "manual:thread",
		createdAt: "2026-04-26T00:00:00.000Z",
		...overrides,
	};
}

test("createActiveRunView creates a sanitized running view with copied input assets", () => {
	const inputAsset = asset();
	const view = createActiveRunView(" manual:/thread 1 ", "hello", [inputAsset]);

	assert.match(view.runId, /^run-manual-thread-1-/);
	assert.match(view.assistantMessageId, /^active-run-manual-thread-1-/);
	assert.equal(view.status, "running");
	assert.equal(view.loading, true);
	assert.equal(view.process?.title, "思考过程");
	assert.deepEqual(view.input.inputAssets, [inputAsset]);
	assert.notEqual(view.input.inputAssets[0], inputAsset);
});

test("appendProcessEntry and completeProcess update process narration", () => {
	const view = createActiveRunView("manual:thread", "hello", []);

	appendProcessEntry(view, {
		kind: "tool",
		title: "工具开始",
		toolName: "bash",
		detail: "npm test",
	});
	completeProcess(view, "ok", "任务完成", "done");

	assert.equal(view.process?.entries.length, 2);
	assert.equal(view.process?.entries[0]?.id, "process-1");
	assert.equal(view.process?.currentAction, "任务完成");
	assert.equal(view.process?.isComplete, true);
	assert.deepEqual(view.process?.narration, ["工具开始 · bash\nnpm test", "任务完成\ndone"]);
});

test("cloneActiveRunView deep copies mutable nested fields", () => {
	const view = createActiveRunView("manual:thread", "hello", [asset()]);
	view.queue = {
		steering: ["next"],
		followUp: ["later"],
	};
	appendProcessEntry(view, {
		kind: "system",
		title: "任务开始",
		detail: "manual:thread",
	});

	const cloned = cloneActiveRunView(view);
	cloned.input.inputAssets[0]!.fileName = "changed.txt";
	cloned.process!.entries[0]!.title = "changed";
	cloned.queue!.steering.push("mutated");

	assert.equal(view.input.inputAssets[0]?.fileName, "note.txt");
	assert.equal(view.process?.entries[0]?.title, "任务开始");
	assert.deepEqual(view.queue?.steering, ["next"]);
});

test("applyChatStreamEventToActiveRunView projects text, queue, and terminal events", () => {
	const view = createActiveRunView("manual:thread", "hello", []);

	applyChatStreamEventToActiveRunView(view, { type: "text_delta", textDelta: "partial" });
	assert.equal(view.text, "partial");
	assert.equal(Number.isNaN(Date.parse(view.updatedAt)), false);

	applyChatStreamEventToActiveRunView(view, {
		type: "queue_updated",
		steering: ["adjust"],
		followUp: ["next"],
	});
	assert.deepEqual(view.queue, { steering: ["adjust"], followUp: ["next"] });

	applyChatStreamEventToActiveRunView(view, {
		type: "done",
		conversationId: "manual:thread",
		runId: view.runId,
		text: "final answer",
	});
	assert.equal(view.status, "done");
	assert.equal(view.loading, false);
	assert.equal(view.text, "final answer");
	assert.equal(view.process?.isComplete, true);
});

test("sanitizeStateId falls back to conversation when input has no safe characters", () => {
	assert.equal(sanitizeStateId("  /:/  "), "conversation");
});
