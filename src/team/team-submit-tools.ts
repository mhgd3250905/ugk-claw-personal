import type { TeamRole, TeamStreamName } from "./types.js";

export interface TeamSubmitToolSpec {
	name:
		| "submitCandidateDomain"
		| "submitDomainEvidence"
		| "submitClassification"
		| "submitReviewFinding";
	description: string;
	streamName: TeamStreamName;
}

export const TEAM_SUBMIT_TOOLS_BY_ROLE: Record<TeamRole["roleId"], TeamSubmitToolSpec[]> = {
	discovery: [
		{
			name: "submitCandidateDomain",
			description: "Submit one discovered candidate domain for validation and persistence.",
			streamName: "candidate_domains",
		},
	],
	evidence_collector: [
		{
			name: "submitDomainEvidence",
			description: "Submit collected evidence for one candidate domain.",
			streamName: "domain_evidence",
		},
	],
	classifier: [
		{
			name: "submitClassification",
			description: "Submit one domain classification based on collected evidence.",
			streamName: "domain_classifications",
		},
	],
	reviewer: [
		{
			name: "submitReviewFinding",
			description: "Submit one independent review finding.",
			streamName: "review_findings",
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
