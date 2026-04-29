import test from "node:test";
import assert from "node:assert/strict";
import { FeishuHttpAgentGateway } from "../src/integrations/feishu/http-agent-gateway.js";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
		},
	});
}

test("FeishuHttpAgentGateway resolves the current conversation through the main server", async () => {
	const requests: Array<{ url: string; init?: RequestInit }> = [];
	const gateway = new FeishuHttpAgentGateway({
		baseUrl: "http://ugk-pi:3000/",
		fetchImpl: async (url, init) => {
			requests.push({ url: String(url), init });
			return jsonResponse({
				currentConversationId: "manual:current",
				conversations: [],
			});
		},
	});

	const conversationId = await gateway.getCurrentConversationId();

	assert.equal(conversationId, "manual:current");
	assert.equal(requests[0]?.url, "http://ugk-pi:3000/v1/chat/conversations");
});

test("FeishuHttpAgentGateway forwards chat, status, and queue calls to the main server", async () => {
	const requests: Array<{ url: string; init?: RequestInit }> = [];
	const gateway = new FeishuHttpAgentGateway({
		baseUrl: "http://ugk-pi:3000",
		fetchImpl: async (url, init) => {
			requests.push({ url: String(url), init });
			if (String(url).includes("/v1/chat/status")) {
				return jsonResponse({
					conversationId: "manual:current",
					running: true,
					contextUsage: {
						provider: "dashscope-coding",
						model: "glm-5",
						currentTokens: 0,
						contextWindow: 128000,
						reserveTokens: 16384,
						maxResponseTokens: 16384,
						availableTokens: 111616,
						percent: 0,
						status: "safe",
						mode: "estimate",
					},
				});
			}
			if (String(url).endsWith("/v1/chat/queue")) {
				return jsonResponse({
					conversationId: "manual:current",
					mode: "steer",
					queued: true,
				});
			}
			if (String(url).includes("/v1/chat/state")) {
				return jsonResponse({
					conversationId: "manual:current",
					running: true,
					contextUsage: {
						provider: "dashscope-coding",
						model: "glm-5",
						currentTokens: 0,
						contextWindow: 128000,
						reserveTokens: 16384,
						maxResponseTokens: 16384,
						availableTokens: 111616,
						percent: 0,
						status: "safe",
						mode: "estimate",
					},
					messages: [],
					viewMessages: [],
					activeRun: null,
					historyPage: { hasMore: false, limit: 8 },
					updatedAt: "2026-04-29T00:00:00.000Z",
				});
			}
			if (String(url).endsWith("/v1/chat/conversations")) {
				return jsonResponse({
					conversationId: "manual:new",
					currentConversationId: "manual:new",
					created: true,
				});
			}
			if (String(url).endsWith("/v1/chat/interrupt")) {
				return jsonResponse({
					conversationId: "manual:current",
					interrupted: true,
				});
			}
			return jsonResponse({
				conversationId: "manual:current",
				text: "ok",
				files: [],
			});
		},
	});

	const status = await gateway.getRunStatus("manual:current");
	const queued = await gateway.queueMessage({
		conversationId: "manual:current",
		message: "继续",
		mode: "steer",
	});
	const result = await gateway.chat({
		conversationId: "manual:current",
		message: "hello",
		attachments: [{ fileName: "note.txt", text: "note" }],
	});
	const state = await gateway.getConversationState("manual:current", { viewLimit: 8 });
	const created = await gateway.createConversation();
	const interrupted = await gateway.interruptChat({ conversationId: "manual:current" });

	assert.equal(status.running, true);
	assert.equal(queued.queued, true);
	assert.equal(result.text, "ok");
	assert.equal(state.conversationId, "manual:current");
	assert.equal(created.currentConversationId, "manual:new");
	assert.equal(interrupted.interrupted, true);
	assert.equal(requests[0]?.url, "http://ugk-pi:3000/v1/chat/status?conversationId=manual%3Acurrent");
	assert.equal(requests[1]?.url, "http://ugk-pi:3000/v1/chat/queue");
	assert.equal(requests[2]?.url, "http://ugk-pi:3000/v1/chat");
	assert.equal(requests[3]?.url, "http://ugk-pi:3000/v1/chat/state?conversationId=manual%3Acurrent&viewLimit=8");
	assert.equal(requests[4]?.url, "http://ugk-pi:3000/v1/chat/conversations");
	assert.equal(requests[5]?.url, "http://ugk-pi:3000/v1/chat/interrupt");
	assert.deepEqual(JSON.parse(String(requests[2]?.init?.body)), {
		conversationId: "manual:current",
		message: "hello",
		attachments: [{ fileName: "note.txt", text: "note" }],
	});
	assert.deepEqual(JSON.parse(String(requests[5]?.init?.body)), {
		conversationId: "manual:current",
	});
});

test("FeishuHttpAgentGateway reports non-2xx server responses", async () => {
	const gateway = new FeishuHttpAgentGateway({
		baseUrl: "http://ugk-pi:3000",
		fetchImpl: async () => jsonResponse({ error: { message: "boom" } }, 500),
	});

	await assert.rejects(
		() => gateway.chat({ conversationId: "manual:current", message: "hello" }),
		/UGK server request failed: POST \/v1\/chat returned 500/,
	);
});
