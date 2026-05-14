// v0.1 §7 — Runtime Gate

import { normalizeDomain } from "../team-lab/brand-domain-gate.js";
import type {
	TeamStreamName,
	TeamRole,
	CandidateDomainPayload,
	DomainEvidencePayload,
	DomainClassificationPayload,
	ReviewFindingPayload,
} from "./types.js";

// Re-export for convenience
export { normalizeDomain };

// --- §7.4 Role → Stream permission ---

const ROLE_WRITE_PERMISSIONS: Record<TeamRole["roleId"], TeamStreamName[]> = {
	discovery: ["candidate_domains"],
	evidence_collector: ["domain_evidence"],
	classifier: ["domain_classifications"],
	reviewer: ["review_findings"],
	finalizer: [],
};

export function canRoleWriteStream(
	roleId: TeamRole["roleId"],
	streamName: TeamStreamName,
): boolean {
	const allowed = ROLE_WRITE_PERMISSIONS[roleId];
	return allowed ? allowed.includes(streamName) : false;
}

// --- §7.2 Payload validators ---

const VALID_CONFIDENCES = new Set(["low", "medium", "high"]);

const VALID_SOURCE_TYPES = new Set([
	"search_query",
	"certificate_transparency",
	"github_or_docs",
	"similar_domain",
	"known_site_link",
	"manual_seed",
]);

const VALID_CATEGORIES = new Set([
	"confirmed_company_asset",
	"likely_company_asset",
	"unknown",
	"likely_third_party",
	"suspicious_impersonation",
	"irrelevant",
]);

const VALID_RECOMMENDED_ACTIONS = new Set([
	"accept_as_company_asset",
	"manual_review",
	"monitor",
	"ignore",
	"investigate_risk",
]);

const VALID_VERDICTS = new Set(["pass", "pass_with_warning", "fail", "needs_user_input"]);

const VALID_ISSUE_TYPES = new Set([
	"unsupported_claim",
	"overstatement",
	"missing_evidence",
	"classification_risk",
	"strategy_warning",
	"coverage_limitation",
]);

export function validateCandidateDomainPayload(
	payload: unknown,
): { ok: true; value: CandidateDomainPayload } | { ok: false; errors: string[] } {
	if (typeof payload !== "object" || payload === null) return { ok: false, errors: ["payload must be an object"] };
	const p = payload as Record<string, unknown>;
	const errors: string[] = [];

	if (typeof p.domain !== "string" || !p.domain) errors.push("domain is required");
	if (typeof p.matchReason !== "string" || !p.matchReason) errors.push("matchReason is required");
	if (!VALID_SOURCE_TYPES.has(p.sourceType as string)) errors.push(`sourceType must be one of: ${[...VALID_SOURCE_TYPES].join(", ")}`);
	if (!VALID_CONFIDENCES.has(p.confidence as string)) errors.push("confidence must be low/medium/high");
	if (typeof p.discoveredAt !== "string" || !p.discoveredAt) errors.push("discoveredAt is required");

	if (errors.length > 0) return { ok: false, errors };

	const normalizedDomain = normalizeDomain(p.domain as string);
	if (!normalizedDomain) {
		return { ok: false, errors: [`invalid domain: ${p.domain}`] };
	}

	return {
		ok: true,
		value: {
			domain: p.domain as string,
			normalizedDomain,
			sourceType: p.sourceType as CandidateDomainPayload["sourceType"],
			sourceUrl: p.sourceUrl as string | undefined,
			query: p.query as string | undefined,
			snippet: p.snippet as string | undefined,
			matchReason: p.matchReason as string,
			confidence: p.confidence as "low" | "medium" | "high",
			discoveredAt: p.discoveredAt as string,
		},
	};
}

export function validateDomainEvidencePayload(
	payload: unknown,
): { ok: true; value: DomainEvidencePayload } | { ok: false; errors: string[] } {
	if (typeof payload !== "object" || payload === null) return { ok: false, errors: ["payload must be an object"] };
	const p = payload as Record<string, unknown>;
	const errors: string[] = [];

	if (typeof p.domain !== "string" || !p.domain) errors.push("domain is required");
	if (!p.pageSignals || typeof p.pageSignals !== "object") errors.push("pageSignals is required");
	if (!Array.isArray(p.evidence)) errors.push("evidence must be an array");
	if (!Array.isArray(p.limitations)) errors.push("limitations must be an array");
	if (typeof p.collectedAt !== "string" || !p.collectedAt) errors.push("collectedAt is required");

	if (errors.length > 0) return { ok: false, errors };

	return {
		ok: true,
		value: {
			domain: p.domain as string,
			http: p.http as DomainEvidencePayload["http"],
			dns: p.dns as DomainEvidencePayload["dns"],
			certificate: p.certificate as DomainEvidencePayload["certificate"],
			pageSignals: p.pageSignals as DomainEvidencePayload["pageSignals"],
			evidence: p.evidence as DomainEvidencePayload["evidence"],
			limitations: p.limitations as string[],
			collectedAt: p.collectedAt as string,
		},
	};
}

export function validateDomainClassificationPayload(
	payload: unknown,
): { ok: true; value: DomainClassificationPayload } | { ok: false; errors: string[] } {
	if (typeof payload !== "object" || payload === null) return { ok: false, errors: ["payload must be an object"] };
	const p = payload as Record<string, unknown>;
	const errors: string[] = [];

	if (typeof p.domain !== "string" || !p.domain) errors.push("domain is required");
	if (!VALID_CATEGORIES.has(p.category as string)) errors.push(`category must be one of: ${[...VALID_CATEGORIES].join(", ")}`);
	if (!VALID_CONFIDENCES.has(p.confidence as string)) errors.push("confidence must be low/medium/high");
	if (!Array.isArray(p.reasons)) errors.push("reasons must be an array");
	if (!Array.isArray(p.supportingEvidenceRefs)) errors.push("supportingEvidenceRefs must be an array");
	if (!VALID_RECOMMENDED_ACTIONS.has(p.recommendedAction as string)) errors.push("recommendedAction is invalid");
	if (typeof p.classifiedAt !== "string" || !p.classifiedAt) errors.push("classifiedAt is required");

	if (errors.length > 0) return { ok: false, errors };

	return {
		ok: true,
		value: {
			domain: p.domain as string,
			category: p.category as DomainClassificationPayload["category"],
			confidence: p.confidence as "low" | "medium" | "high",
			reasons: p.reasons as string[],
			supportingEvidenceRefs: p.supportingEvidenceRefs as string[],
			recommendedAction: p.recommendedAction as DomainClassificationPayload["recommendedAction"],
			classifiedAt: p.classifiedAt as string,
		},
	};
}

export function validateReviewFindingPayload(
	payload: unknown,
): { ok: true; value: ReviewFindingPayload } | { ok: false; errors: string[] } {
	if (typeof payload !== "object" || payload === null) return { ok: false, errors: ["payload must be an object"] };
	const p = payload as Record<string, unknown>;
	const errors: string[] = [];

	if (!VALID_VERDICTS.has(p.verdict as string)) errors.push(`verdict must be one of: ${[...VALID_VERDICTS].join(", ")}`);
	if (!VALID_ISSUE_TYPES.has(p.issueType as string)) errors.push(`issueType must be one of: ${[...VALID_ISSUE_TYPES].join(", ")}`);
	if (typeof p.message !== "string" || !p.message) errors.push("message is required");
	if (typeof p.createdAt !== "string" || !p.createdAt) errors.push("createdAt is required");

	if (errors.length > 0) return { ok: false, errors };

	return {
		ok: true,
		value: {
			targetDomain: p.targetDomain as string | undefined,
			verdict: p.verdict as ReviewFindingPayload["verdict"],
			issueType: p.issueType as ReviewFindingPayload["issueType"],
			message: p.message as string,
			recommendedChange: p.recommendedChange as string | undefined,
			createdAt: p.createdAt as string,
		},
	};
}
