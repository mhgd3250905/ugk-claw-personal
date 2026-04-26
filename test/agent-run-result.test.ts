import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentRunResult, buildDoneChatStreamEvent } from "../src/agent/agent-run-result.js";
import type { AssetRecord, AssetStoreLike, ChatAttachment, StoredAssetRecord } from "../src/agent/asset-store.js";
import type { AgentFileArtifact } from "../src/agent/file-artifacts.js";

class FakeAssetStore implements AssetStoreLike {
	public savedFiles: Array<{ conversationId: string; fileName: string; mimeType: string; content: string }> = [];

	async saveFiles(conversationId: string, files: readonly { fileName: string; mimeType: string; content: string }[]): Promise<AgentFileArtifact[]> {
		this.savedFiles.push(...files.map((file) => ({ conversationId, ...file })));
		return files.map((file, index) => ({
			id: `saved-${index + 1}`,
			assetId: `saved-${index + 1}`,
			reference: `@asset[saved-${index + 1}]`,
			fileName: file.fileName,
			mimeType: file.mimeType,
			sizeBytes: file.content.length,
			downloadUrl: `/v1/files/saved-${index + 1}`,
		}));
	}

	async registerAttachments(_conversationId: string, _attachments: readonly ChatAttachment[]): Promise<AssetRecord[]> {
		return [];
	}

	async listAssets(): Promise<AssetRecord[]> {
		return [];
	}

	async getAsset(): Promise<AssetRecord | undefined> {
		return undefined;
	}

	async resolveAssets(): Promise<AssetRecord[]> {
		return [];
	}

	async readText(): Promise<string | undefined> {
		return undefined;
	}

	async getFile(): Promise<StoredAssetRecord | undefined> {
		return undefined;
	}
}

test("buildAgentRunResult extracts inline files, merges send_file artifacts, and rewrites visible local paths", async () => {
	const assetStore = new FakeAssetStore();
	const sentFile: AgentFileArtifact = {
		id: "sent-1",
		assetId: "sent-1",
		reference: "@asset[sent-1]",
		fileName: "sent.md",
		mimeType: "text/markdown",
		sizeBytes: 12,
		downloadUrl: "/v1/files/sent-1",
	};

	const result = await buildAgentRunResult({
		conversationId: "manual:result",
		rawText: [
			"Report: /app/runtime/report.html",
			"",
			'```ugk-file name="hello.txt" mime="text/plain"',
			"hello from agent",
			"```",
		].join("\n"),
		sessionFile: "E:/sessions/result.jsonl",
		inputAssets: [],
		sentFiles: [sentFile],
		assetStore,
	});

	assert.match(result.text, /\/v1\/local-file\?path=%2Fapp%2Fruntime%2Freport\.html/);
	assert.doesNotMatch(result.text, /ugk-file/);
	assert.deepEqual(assetStore.savedFiles, [
		{
			conversationId: "manual:result",
			fileName: "hello.txt",
			mimeType: "text/plain",
			content: "hello from agent",
		},
	]);
	assert.deepEqual(result.files?.map((file) => file.assetId), ["saved-1", "sent-1"]);
	assert.equal(result.sessionFile, "E:/sessions/result.jsonl");
});

test("buildAgentRunResult falls back to the final assistant message when no stream text was captured", async () => {
	const result = await buildAgentRunResult({
		conversationId: "manual:final",
		rawText: "",
		lastAssistantMessage: {
			role: "assistant",
			content: [{ type: "text", text: "final text" }],
		},
		inputAssets: [],
		sentFiles: [],
	});

	assert.equal(result.text, "final text");
	assert.equal(result.files, undefined);
});

test("buildDoneChatStreamEvent mirrors optional result fields", () => {
	const event = buildDoneChatStreamEvent(
		{
			conversationId: "manual:done",
			text: "ok",
			sessionFile: "E:/sessions/done.jsonl",
			inputAssets: [
				{
					assetId: "asset-1",
					reference: "@asset[asset-1]",
					fileName: "note.txt",
					mimeType: "text/plain",
					sizeBytes: 4,
					kind: "text",
					hasContent: true,
					source: "user_upload",
					conversationId: "manual:done",
					createdAt: "2026-04-26T00:00:00.000Z",
				},
			],
		},
		"run-1",
	);

	assert.equal(event.type, "done");
	assert.equal(event.runId, "run-1");
	assert.equal(event.sessionFile, "E:/sessions/done.jsonl");
	assert.equal(event.inputAssets?.[0]?.assetId, "asset-1");
});
