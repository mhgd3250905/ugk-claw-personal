import type { TeamRole, TeamStreamName } from "./types.js";

export interface TeamSubmitToolSpec {
	name:
		| "submitCandidateDomain"
		| "submitDomainEvidence"
		| "submitClassification"
		| "submitReviewFinding";
	description: string;
	streamName: TeamStreamName;
	inputSchema: Record<string, unknown>;
}

export const TEAM_SUBMIT_TOOLS_BY_ROLE: Record<TeamRole["roleId"], TeamSubmitToolSpec[]> = {
	discovery: [
		{
			name: "submitCandidateDomain",
			description: "Submit one discovered candidate domain for validation and persistence.",
			streamName: "candidate_domains",
			inputSchema: {
				type: "object",
				additionalProperties: false,
				required: ["domain", "sourceType", "matchReason", "confidence", "discoveredAt"],
				properties: {
					domain: { type: "string", description: "Candidate domain, for example medtrum.com." },
					sourceType: { type: "string", enum: ["search_query", "certificate_transparency", "github_or_docs", "similar_domain", "known_site_link", "manual_seed"] },
					sourceUrl: { type: "string" },
					query: { type: "string" },
					snippet: { type: "string" },
					matchReason: { type: "string" },
					confidence: { type: "string", enum: ["low", "medium", "high"] },
					discoveredAt: { type: "string", description: "ISO 8601 timestamp." },
				},
			},
		},
	],
	evidence_collector: [
		{
			name: "submitDomainEvidence",
			description: "Submit collected evidence for one candidate domain.",
			streamName: "domain_evidence",
			inputSchema: {
				type: "object",
				additionalProperties: false,
				required: ["domain", "pageSignals", "evidence", "limitations", "collectedAt"],
				properties: {
					domain: { type: "string" },
					http: {
						type: "object",
						additionalProperties: true,
						properties: { checked: { type: "boolean" } },
					},
					dns: {
						type: "object",
						additionalProperties: true,
						properties: { checked: { type: "boolean" } },
					},
					certificate: {
						type: "object",
						additionalProperties: true,
						properties: { checked: { type: "boolean" } },
					},
					pageSignals: {
						type: "object",
						additionalProperties: false,
						required: ["mentionsKeyword", "mentionsCompanyName", "linksToOfficialDomain", "usesBrandLikeText", "notes"],
						properties: {
							mentionsKeyword: { type: "boolean" },
							mentionsCompanyName: { type: "boolean" },
							linksToOfficialDomain: { type: "boolean" },
							usesBrandLikeText: { type: "boolean" },
							notes: { type: "array", items: { type: "string" } },
						},
					},
					evidence: {
						type: "array",
						items: {
							type: "object",
							additionalProperties: false,
							required: ["claim", "source", "observation", "confidence"],
							properties: {
								claim: { type: "string" },
								source: { type: "string" },
								observation: { type: "string" },
								confidence: { type: "string", enum: ["low", "medium", "high"] },
							},
						},
					},
					limitations: { type: "array", items: { type: "string" } },
					collectedAt: { type: "string", description: "ISO 8601 timestamp." },
				},
			},
		},
	],
	classifier: [
		{
			name: "submitClassification",
			description: "Submit one domain classification based on collected evidence.",
			streamName: "domain_classifications",
			inputSchema: {
				type: "object",
				additionalProperties: false,
				required: ["domain", "category", "confidence", "reasons", "supportingEvidenceRefs", "recommendedAction", "classifiedAt"],
				properties: {
					domain: { type: "string" },
					category: { type: "string", enum: ["confirmed_company_asset", "likely_company_asset", "unknown", "likely_third_party", "suspicious_impersonation", "irrelevant"] },
					confidence: { type: "string", enum: ["low", "medium", "high"] },
					reasons: { type: "array", items: { type: "string" } },
					supportingEvidenceRefs: { type: "array", items: { type: "string" } },
					recommendedAction: { type: "string", enum: ["accept_as_company_asset", "manual_review", "monitor", "ignore", "investigate_risk"] },
					classifiedAt: { type: "string", description: "ISO 8601 timestamp." },
				},
			},
		},
	],
	reviewer: [
		{
			name: "submitReviewFinding",
			description: "Submit one independent review finding.",
			streamName: "review_findings",
			inputSchema: {
				type: "object",
				additionalProperties: false,
				required: ["verdict", "issueType", "message", "createdAt"],
				properties: {
					targetDomain: { type: "string" },
					verdict: { type: "string", enum: ["pass", "pass_with_warning", "fail", "needs_user_input"] },
					issueType: { type: "string", enum: ["unsupported_claim", "overstatement", "missing_evidence", "classification_risk", "strategy_warning", "coverage_limitation"] },
					message: { type: "string" },
					recommendedChange: { type: "string" },
					createdAt: { type: "string", description: "ISO 8601 timestamp." },
				},
			},
		},
	],
	finalizer: [],
};

export function getSubmitToolsForRole(roleId: TeamRole["roleId"]): TeamSubmitToolSpec[] {
	return TEAM_SUBMIT_TOOLS_BY_ROLE[roleId] ?? [];
}

export function mapSubmitToolToStream(input: {
	roleId: TeamRole["roleId"];
	toolName: TeamSubmitToolSpec["name"];
	arguments: unknown;
}): { ok: true; streamName: TeamStreamName; payload: unknown } | { ok: false; errors: string[] } {
	const tool = getSubmitToolsForRole(input.roleId).find((item) => item.name === input.toolName);
	if (!tool) {
		return {
			ok: false,
			errors: [`tool ${input.toolName} is not allowed for role ${input.roleId}`],
		};
	}
	return {
		ok: true,
		streamName: tool.streamName,
		payload: input.arguments,
	};
}
