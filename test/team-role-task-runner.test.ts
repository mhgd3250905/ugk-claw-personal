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

	it("uses the finalizer LLM to produce a Chinese markdown report", async () => {
		let capturedPrompt = "";
		const runner = new LLMTeamRoleTaskRunner({
			callLLM: async (prompt) => {
				capturedPrompt = prompt;
				return "# MED 域名调查报告\n\n## 摘要\n- 已生成。";
			},
		});

		const result = await runner.runTask({
			roleTaskId: "rt_finalizer",
			roleId: "finalizer",
			teamRunId: "team_run_test",
			inputData: {
				keyword: "MED",
				goal: "Discover MED domains",
				streamCounts: { candidate_domains: 1 },
				streams: {
					candidate_domains: [
						{
							itemId: "si_1",
							teamRunId: "team_run_test",
							streamName: "candidate_domains",
							producerRoleId: "discovery",
							producerTaskId: "rt_1",
							payload: { domain: "med-example.com", normalizedDomain: "med-example.com" },
							createdAt: "2026-05-14T00:00:00.000Z",
						},
					],
				},
				stopSignals: [],
				currentRound: 1,
			},
		});

		assert.equal(result.status, "success");
		assert.equal(result.finalReportMarkdown, "# MED 域名调查报告\n\n## 摘要\n- 已生成。");
		assert.match(capturedPrompt, /Finalizer Agent/);
		assert.match(capturedPrompt, /只输出 Markdown 正文/);
		assert.match(capturedPrompt, /报告必须是中文/);
		assert.match(capturedPrompt, /med-example\.com/);
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

	it("treats accepted submit tool calls as success when the final JSON envelope is malformed", async () => {
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
							input: {
								domain: "med-example.com",
								sourceType: "search_query",
								matchReason: "Search result references MED",
								confidence: "medium",
								discoveredAt: "2026-05-14T00:00:00.000Z",
							},
						},
					],
				}), { status: 200, headers: { "content-type": "application/json" } });
			}
			return new Response(JSON.stringify({
				content: [{ type: "text", text: "not json" }],
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
			assert.match(result.message ?? "", /Final JSON envelope ignored/);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	for (const scenario of [
		{
			name: "Evidence Collector",
			roleId: "evidence_collector" as const,
			toolName: "submitDomainEvidence",
			streamName: "domain_evidence",
			inputData: {
				keyword: "MED",
				candidates: [
					{ domain: "med-example.com", normalizedDomain: "med-example.com", sourceType: "search_query" },
				],
			},
			toolInput: {
				domain: "med-example.com",
				http: { checked: false },
				dns: { checked: false },
				certificate: { checked: false },
				pageSignals: {
					mentionsKeyword: true,
					mentionsCompanyName: false,
					linksToOfficialDomain: false,
					usesBrandLikeText: true,
					notes: [],
				},
				evidence: [
					{
						claim: "Domain contains MED keyword",
						source: "domain name analysis",
						observation: "med-example.com includes MED",
						confidence: "low",
					},
				],
				limitations: ["HTTP/DNS/certificate checks not performed in MVP"],
				collectedAt: "2026-05-14T00:00:00.000Z",
			},
		},
		{
			name: "Classifier",
			roleId: "classifier" as const,
			toolName: "submitClassification",
			streamName: "domain_classifications",
			inputData: {
				keyword: "MED",
				evidences: [{ domain: "med-example.com" }],
			},
			toolInput: {
				domain: "med-example.com",
				category: "unknown",
				confidence: "low",
				reasons: ["No official ownership signal found"],
				supportingEvidenceRefs: ["domain_evidence:med-example.com"],
				recommendedAction: "manual_review",
				classifiedAt: "2026-05-14T00:00:00.000Z",
			},
		},
		{
			name: "Reviewer",
			roleId: "reviewer" as const,
			toolName: "submitReviewFinding",
			streamName: "review_findings",
			inputData: {
				keyword: "MED",
				classifications: [
					{ domain: "med-example.com", category: "unknown", reasons: ["No official ownership signal found"] },
				],
			},
			toolInput: {
				targetDomain: "med-example.com",
				verdict: "pass_with_warning",
				issueType: "coverage_limitation",
				message: "Classification is cautious but evidence is limited.",
				recommendedChange: "Keep manual review",
				createdAt: "2026-05-14T00:00:00.000Z",
			},
		},
	]) {
		it(`can use the ${scenario.name} submit tool loop when a handler is provided`, async () => {
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
								name: scenario.toolName,
								input: scenario.toolInput,
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
					submitToolHandler: async (call) => {
						handled++;
						assert.equal(call.roleId, scenario.roleId);
						assert.equal(call.streamName, scenario.streamName);
						assert.deepEqual(call.arguments, scenario.toolInput);
						return { ok: true, message: "accepted", streamName: call.streamName };
					},
				});

				const result = await runner.runTask({
					roleTaskId: `rt_${scenario.roleId}`,
					roleId: scenario.roleId,
					teamRunId: "team_run_test",
					inputData: scenario.inputData,
				});

				assert.equal(handled, 1);
				assert.equal(result.status, "success");
				assert.deepEqual(result.emits, []);
			} finally {
				globalThis.fetch = originalFetch;
			}
		});
	}
});
