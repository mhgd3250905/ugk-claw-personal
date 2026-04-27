import test from "node:test";
import assert from "node:assert/strict";
import { queueActiveMessage } from "../src/agent/agent-queue-message.js";
import type { AssetRecord, ChatAttachment } from "../src/agent/asset-store.js";
import type {
	AgentSessionLike,
	PromptOptionsLike,
	RawAgentSessionEventLike,
} from "../src/agent/agent-session-factory.js";

class QueueSession implements AgentSessionLike {
	public prompts: Array<{ message: string; options?: PromptOptionsLike }> = [];
	public steerCalls: string[] = [];
	public followUpCalls: string[] = [];

	subscribe(_listener: (event: RawAgentSessionEventLike) => void): () => void {
		return () => undefined;
	}

	async prompt(message: string, options?: PromptOptionsLike): Promise<void> {
		this.prompts.push({ message, options });
	}

	async steer(message: string): Promise<void> {
		this.steerCalls.push(message);
	}

	async followUp(message: string): Promise<void> {
		this.followUpCalls.push(message);
	}
}

class PromptOnlyQueueSession implements AgentSessionLike {
	public prompts: Array<{ message: string; options?: PromptOptionsLike }> = [];
	public steerCalls: string[] = [];
	public followUpCalls: string[] = [];

	subscribe(_listener: (event: RawAgentSessionEventLike) => void): () => void {
		return () => undefined;
	}

	async prompt(message: string, options?: PromptOptionsLike): Promise<void> {
		this.prompts.push({ message, options });
	}
}

class QueueAssetStore {
	public savedAttachments: Array<{ conversationId: string; attachments: readonly ChatAttachment[] }> = [];
	public resolvedAssetIds: readonly string[] = [];

	async registerAttachments(conversationId: string, attachments: readonly ChatAttachment[]): Promise<AssetRecord[]> {
		this.savedAttachments.push({ conversationId, attachments });
		return attachments.map((attachment, index) => ({
			assetId: `asset-upload-${index + 1}`,
			reference: `@asset[asset-upload-${index + 1}]`,
			fileName: attachment.fileName,
			mimeType: attachment.mimeType ?? "application/octet-stream",
			sizeBytes: attachment.sizeBytes ?? 0,
			kind: typeof attachment.text === "string" ? "text" : "metadata",
			hasContent: typeof attachment.text === "string",
			source: "user_upload",
			conversationId,
			createdAt: "2026-04-27T00:00:00.000Z",
			...(typeof attachment.text === "string" ? { textPreview: attachment.text } : {}),
		}));
	}

	async resolveAssets(assetIds: readonly string[]): Promise<AssetRecord[]> {
		this.resolvedAssetIds = assetIds;
		return assetIds.map((assetId) => ({
			assetId,
			reference: `@asset[${assetId}]`,
			fileName: `${assetId}.md`,
			mimeType: "text/markdown",
			sizeBytes: 12,
			kind: "text",
			hasContent: true,
			source: "agent_output",
			conversationId: "manual:queue",
			createdAt: "2026-04-27T00:01:00.000Z",
		}));
	}

	async readText(assetId: string): Promise<string | undefined> {
		return `referenced text for ${assetId}`;
	}

	async saveFiles(): Promise<never[]> {
		return [];
	}

	async listAssets(): Promise<never[]> {
		return [];
	}

	async getAsset(): Promise<undefined> {
		return undefined;
	}

	async getFile(): Promise<undefined> {
		return undefined;
	}
}

test("queueActiveMessage sends steer messages through the explicit steer API with asset context", async () => {
	const session = new QueueSession();
	const assetStore = new QueueAssetStore();

	await queueActiveMessage({
		conversationId: "manual:queue",
		message: "please refine this",
		mode: "steer",
		session,
		assetStore,
		attachments: [
			{
				fileName: "notes.txt",
				mimeType: "text/plain",
				sizeBytes: 11,
				text: "hello queue",
			},
		],
		assetRefs: ["asset-existing"],
	});

	assert.equal(session.prompts.length, 0);
	assert.equal(session.followUpCalls.length, 0);
	assert.equal(session.steerCalls.length, 1);
	assert.match(session.steerCalls[0] ?? "", /\[当前时间：[^\]]+\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/);
	assert.match(session.steerCalls[0] ?? "", /please refine this/);
	assert.match(session.steerCalls[0] ?? "", /assetId: asset-upload-1/);
	assert.match(session.steerCalls[0] ?? "", /hello queue/);
	assert.match(session.steerCalls[0] ?? "", /assetId: asset-existing/);
	assert.match(session.steerCalls[0] ?? "", /referenced text for asset-existing/);
	assert.deepEqual(assetStore.savedAttachments[0]?.attachments, [
		{
			fileName: "notes.txt",
			mimeType: "text/plain",
			sizeBytes: 11,
			text: "hello queue",
		},
	]);
	assert.deepEqual(assetStore.resolvedAssetIds, ["asset-existing"]);
});

test("queueActiveMessage sends follow-up messages through the explicit followUp API", async () => {
	const session = new QueueSession();

	await queueActiveMessage({
		conversationId: "manual:queue",
		message: "continue after this",
		mode: "followUp",
		session,
	});

	assert.equal(session.prompts.length, 0);
	assert.deepEqual(session.steerCalls, []);
	assert.equal(session.followUpCalls.length, 1);
	assert.match(session.followUpCalls[0] ?? "", /continue after this/);
});

test("queueActiveMessage falls back to prompt streaming behavior when explicit queue APIs are unavailable", async () => {
	const session = new PromptOnlyQueueSession();

	await queueActiveMessage({
		conversationId: "manual:queue",
		message: "fallback steer",
		mode: "steer",
		session,
	});

	assert.equal(session.steerCalls.length, 0);
	assert.equal(session.followUpCalls.length, 0);
	assert.equal(session.prompts.length, 1);
	assert.equal(session.prompts[0]?.options?.streamingBehavior, "steer");
	assert.match(session.prompts[0]?.message ?? "", /fallback steer/);
});
