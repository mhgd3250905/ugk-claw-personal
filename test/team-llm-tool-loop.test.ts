import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { callLLMWithTeamSubmitTools } from "../src/team/llm-tool-loop.js";
import type { LLMConfig } from "../src/team/llm.js";
import { buildRoleBox } from "../src/team/role-box.js";
import { brandDomainDiscoveryTemplate } from "../src/team/templates/brand-domain-discovery.js";

function makeConfig(api: LLMConfig["api"]): LLMConfig {
	return {
		provider: "deepseek",
		api,
		apiKey: "sk-test",
		baseUrl: api === "anthropic-messages" ? "https://api.deepseek.com/anthropic" : "https://api.deepseek.com",
		model: "deepseek-v4-pro",
	};
}

function makeDiscoveryRoleBox() {
	const role = brandDomainDiscoveryTemplate.roles.find((item) => item.roleId === "discovery");
	assert.ok(role);
	return buildRoleBox({
		role,
		task: {
			roleTaskId: "rt_discovery",
			roleId: "discovery",
			teamRunId: "team_run_test",
			inputData: {},
		},
		prompt: "DISCOVERY PROMPT",
	});
}

describe("callLLMWithTeamSubmitTools", () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("handles Anthropic messages tool_use blocks and returns tool_result", async () => {
		const requests: unknown[] = [];
		let callCount = 0;
		globalThis.fetch = async (_input, init) => {
			callCount++;
			requests.push(JSON.parse(String(init?.body ?? "{}")));
			if (callCount === 1) {
				return new Response(JSON.stringify({
					content: [
						{
							type: "tool_use",
							id: "toolu_1",
							name: "submitCandidateDomain",
							input: {
								domain: "med-example.com",
								sourceType: "search_query",
							},
						},
					],
					stop_reason: "tool_use",
				}), { status: 200, headers: { "content-type": "application/json" } });
			}
			return new Response(JSON.stringify({
				content: [{ type: "text", text: "{\"status\":\"success\",\"emits\":[],\"checkpoint\":{}}" }],
				stop_reason: "end_turn",
			}), { status: 200, headers: { "content-type": "application/json" } });
		};

		const handled: unknown[] = [];
		const result = await callLLMWithTeamSubmitTools({
			config: makeConfig("anthropic-messages"),
			roleBox: makeDiscoveryRoleBox(),
			submitToolHandler: async (call) => {
				handled.push(call.arguments);
				return { ok: true, message: "accepted", streamName: call.streamName };
			},
		});

		assert.equal(result.submitCallCount, 1);
		assert.equal(result.finalText, "{\"status\":\"success\",\"emits\":[],\"checkpoint\":{}}");
		assert.deepEqual(handled, [{ domain: "med-example.com", sourceType: "search_query" }]);
		assert.equal((requests[0] as { tools?: unknown[] }).tools?.length, 1);
		const secondMessages = (requests[1] as { messages: Array<{ role: string; content: unknown }> }).messages;
		assert.deepEqual(secondMessages.at(-1), {
			role: "user",
			content: [
				{
					type: "tool_result",
					tool_use_id: "toolu_1",
					content: "accepted",
					is_error: false,
				},
			],
		});
	});

	it("handles OpenAI-compatible tool_calls", async () => {
		let callCount = 0;
		const requests: unknown[] = [];
		globalThis.fetch = async (_input, init) => {
			callCount++;
			requests.push(JSON.parse(String(init?.body ?? "{}")));
			if (callCount === 1) {
				return new Response(JSON.stringify({
					choices: [
						{
							message: {
								content: null,
								tool_calls: [
									{
										id: "call_1",
										type: "function",
										function: {
											name: "submitCandidateDomain",
											arguments: JSON.stringify({ domain: "med-example.com" }),
										},
									},
								],
							},
						},
					],
				}), { status: 200, headers: { "content-type": "application/json" } });
			}
			return new Response(JSON.stringify({
				choices: [{ message: { content: "{\"status\":\"success\",\"emits\":[],\"checkpoint\":{}}" } }],
			}), { status: 200, headers: { "content-type": "application/json" } });
		};

		const result = await callLLMWithTeamSubmitTools({
			config: makeConfig("openai-completions"),
			roleBox: makeDiscoveryRoleBox(),
			submitToolHandler: async (call) => ({ ok: true, message: `accepted ${call.streamName}`, streamName: call.streamName }),
		});

		assert.equal(result.submitCallCount, 1);
		assert.equal(result.finalText, "{\"status\":\"success\",\"emits\":[],\"checkpoint\":{}}");
		assert.equal((requests[0] as { tools?: unknown[] }).tools?.length, 1);
		const secondMessages = (requests[1] as { messages: Array<{ role: string; tool_call_id?: string }> }).messages;
		assert.equal(secondMessages.at(-1)?.role, "tool");
		assert.equal(secondMessages.at(-1)?.tool_call_id, "call_1");
	});

	it("returns rejected tool results to the model", async () => {
		let callCount = 0;
		globalThis.fetch = async () => {
			callCount++;
			if (callCount === 1) {
				return new Response(JSON.stringify({
					content: [
						{
							type: "tool_use",
							id: "toolu_bad",
							name: "submitReviewFinding",
							input: {},
						},
					],
				}), { status: 200, headers: { "content-type": "application/json" } });
			}
			return new Response(JSON.stringify({
				content: [{ type: "text", text: "{\"status\":\"failed\",\"emits\":[],\"checkpoint\":{}}" }],
			}), { status: 200, headers: { "content-type": "application/json" } });
		};

		const result = await callLLMWithTeamSubmitTools({
			config: makeConfig("anthropic-messages"),
			roleBox: makeDiscoveryRoleBox(),
			submitToolHandler: async () => {
				throw new Error("handler should not be called for forbidden tool");
			},
		});

		assert.equal(result.submitCallCount, 1);
		assert.equal(result.finalText, "{\"status\":\"failed\",\"emits\":[],\"checkpoint\":{}}");
	});
});
