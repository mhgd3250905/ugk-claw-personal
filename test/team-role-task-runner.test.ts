import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LLMTeamRoleTaskRunner } from "../src/team/team-role-task-runner.js";
import type { LLMConfig } from "../src/team/llm.js";

describe("LLMTeamRoleTaskRunner RoleBox integration", () => {
	it("wraps discovery prompts with the RoleBox contract", async () => {
		let capturedPrompt = "";
		const runner = new LLMTeamRoleTaskRunner({
			search: async () => "Search result: med-example.com",
			callLLM: async (prompt) => {
				capturedPrompt = prompt;
				return JSON.stringify({
					status: "success",
					emits: [],
					checkpoint: {},
				});
			},
		});

		await runner.runTask({
			roleTaskId: "rt_discovery",
			roleId: "discovery",
			teamRunId: "team_run_test",
			inputData: {
				keyword: "MED",
				queries: ["MED official domain"],
			},
		});

		assert.ok(capturedPrompt.includes("You are a Discovery Agent"));
		assert.ok(capturedPrompt.includes("ROLE BOX CONTRACT"));
		assert.ok(capturedPrompt.includes("Allowed output streams: candidate_domains"));
		assert.ok(capturedPrompt.includes("Declared submit tools: submitCandidateDomain"));
	});

	it("wraps reviewer prompts with the RoleBox contract", async () => {
		let capturedPrompt = "";
		const runner = new LLMTeamRoleTaskRunner({
			callLLM: async (prompt) => {
				capturedPrompt = prompt;
				return JSON.stringify({
					status: "success",
					emits: [],
					checkpoint: {},
				});
			},
		});

		await runner.runTask({
			roleTaskId: "rt_reviewer",
			roleId: "reviewer",
			teamRunId: "team_run_test",
			inputData: {
				keyword: "MED",
				classifications: [
					{ domain: "med-example.com", category: "unknown", reasons: ["No official ownership signal"] },
				],
			},
		});

		assert.ok(capturedPrompt.includes("You are an Independent Reviewer"));
		assert.ok(capturedPrompt.includes("ROLE BOX CONTRACT"));
		assert.ok(capturedPrompt.includes("Allowed output streams: review_findings"));
		assert.ok(capturedPrompt.includes("Declared submit tools: submitReviewFinding"));
	});

	it("can use the Discovery submit tool loop when a handler is provided", async () => {
		const originalFetch = globalThis.fetch;
		let handled = 0;
		let fetchCount = 0;
		globalThis.fetch = async () => {
			fetchCount++;
			if (fetchCount === 1) {
				return new Response(JSON.stringify({
					content: [
						{
							type: "tool_use",
							id: "toolu_1",
							name: "submitCandidateDomain",
							input: { domain: "med-example.com" },
						},
					],
				}), { status: 200, headers: { "content-type": "application/json" } });
			}
			return new Response(JSON.stringify({
				content: [{ type: "text", text: "{\"status\":\"success\",\"emits\":[],\"checkpoint\":{}}" }],
			}), { status: 200, headers: { "content-type": "application/json" } });
		};

		try {
			const config: LLMConfig = {
				provider: "deepseek",
				api: "anthropic-messages",
				apiKey: "sk-test",
				baseUrl: "https://api.deepseek.com/anthropic",
				model: "deepseek-v4-pro",
			};
			const runner = new LLMTeamRoleTaskRunner({
				llmConfig: config,
				search: async () => "Search result: med-example.com",
				submitToolHandler: async (call) => {
					handled++;
					assert.equal(call.streamName, "candidate_domains");
					return { ok: true, message: "accepted", streamName: call.streamName };
				},
			});

			const result = await runner.runTask({
				roleTaskId: "rt_discovery",
				roleId: "discovery",
				teamRunId: "team_run_test",
				inputData: {
					keyword: "MED",
					queries: ["MED official domain"],
				},
			});

			assert.equal(handled, 1);
			assert.equal(result.status, "success");
			assert.deepEqual(result.emits, []);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
