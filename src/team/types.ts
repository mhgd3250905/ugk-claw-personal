// v0.1 §5 — Team Runtime Type Definitions

// --- §5.1 TeamRunStatus ---
export type TeamRunStatus =
	| "queued"
	| "running"
	| "blocked"
	| "failed"
	| "completed"
	| "cancelled";

// --- §5.5 TeamStreamName ---
export type TeamStreamName =
	| "candidate_domains"
	| "domain_evidence"
	| "domain_classifications"
	| "review_findings";

export type TeamTemplateId =
	| "brand_domain_discovery"
	| "competitor_domain_discovery";

// --- §5.4 TeamRole ---
export interface TeamRole {
	roleId:
		| "discovery"
		| "evidence_collector"
		| "classifier"
		| "reviewer"
		| "finalizer";
	name: string;
	responsibility: string;
	mustNotDo: string[];
	allowedInputStreams: TeamStreamName[];
	outputStreams: TeamStreamName[];
}

// --- §5.6 DiscoveryPlan ---
export interface DiscoveryPlan {
	searchQueries: string[];
	certificatePatterns: string[];
	githubOrDocsQueries: string[];
	similarDomainPatterns: string[];
	knownSiteLinks: string[];
}

// --- §5.3 TeamPlan ---
export interface TeamPlan {
	templateId: TeamTemplateId;
	goal: string;
	keyword: string;
	roles: TeamRole[];
	streams: TeamStreamName[];
	discoveryPlan: DiscoveryPlan;
	stopConditions: string[];
	deliverables: string[];
}

// --- §5.2 TeamRunState ---
export interface TeamRunState {
	teamRunId: string;
	templateId: TeamTemplateId;
	status: TeamRunStatus;
	goal: string;
	keyword: string;
	companyHints: {
		officialDomains: string[];
		companyNames: string[];
		excludedGenericMeanings: string[];
	};
	createdAt: string;
	updatedAt: string;
	startedAt?: string;
	finishedAt?: string;
	currentRound: number;
	budgets: {
		maxRounds: number;
		maxCandidates: number;
		maxMinutes: number;
		roleTaskTimeoutMs: number;
		roleTaskMaxRetries: number;
	};
	counters: {
		candidateDomains: number;
		domainEvidence: number;
		classifications: number;
		reviewFindings: number;
		failedRoleTasks: number;
	};
	stopSignals: string[];
	lastError?: string;
}

// --- §5.7 CandidateDomainPayload ---
export interface CandidateDomainPayload {
	domain: string;
	normalizedDomain: string;
	sourceType:
		| "search_query"
		| "certificate_transparency"
		| "github_or_docs"
		| "similar_domain"
		| "known_site_link"
		| "manual_seed";
	sourceUrl?: string;
	query?: string;
	snippet?: string;
	matchReason: string;
	confidence: "low" | "medium" | "high";
	discoveredAt: string;
}

// --- §5.8 DomainEvidencePayload ---
export interface DomainEvidencePayload {
	domain: string;
	http?: {
		checked: boolean;
		reachable?: boolean;
		status?: number;
		finalUrl?: string;
		title?: string;
		error?: string;
	};
	dns?: {
		checked: boolean;
		records?: Record<string, string[]>;
		error?: string;
	};
	certificate?: {
		checked: boolean;
		issuer?: string;
		san?: string[];
		error?: string;
	};
	pageSignals: {
		mentionsKeyword: boolean;
		mentionsCompanyName: boolean;
		linksToOfficialDomain: boolean;
		usesBrandLikeText: boolean;
		notes: string[];
	};
	evidence: Array<{
		claim: string;
		source: string;
		observation: string;
		confidence: "low" | "medium" | "high";
	}>;
	limitations: string[];
	collectedAt: string;
}

// --- §5.9 DomainClassificationPayload ---
export interface DomainClassificationPayload {
	domain: string;
	category:
		| "confirmed_company_asset"
		| "likely_company_asset"
		| "unknown"
		| "likely_third_party"
		| "suspicious_impersonation"
		| "irrelevant";
	confidence: "low" | "medium" | "high";
	reasons: string[];
	supportingEvidenceRefs: string[];
	recommendedAction:
		| "accept_as_company_asset"
		| "manual_review"
		| "monitor"
		| "ignore"
		| "investigate_risk";
	classifiedAt: string;
}

// --- §5.10 ReviewFindingPayload ---
export interface ReviewFindingPayload {
	targetDomain?: string;
	verdict:
		| "pass"
		| "pass_with_warning"
		| "fail"
		| "needs_user_input";
	issueType:
		| "unsupported_claim"
		| "overstatement"
		| "missing_evidence"
		| "classification_risk"
		| "strategy_warning"
		| "coverage_limitation";
	message: string;
	recommendedChange?: string;
	createdAt: string;
}

// --- §5.11 TeamStreamItem ---
export interface TeamStreamItem<TPayload = unknown> {
	itemId: string;
	teamRunId: string;
	streamName: TeamStreamName;
	producerRoleId: TeamRole["roleId"];
	producerTaskId: string;
	payload: TPayload;
	createdAt: string;
}

// --- §5.12 Cursor ---
export interface TeamStreamCursor {
	roleId: TeamRole["roleId"];
	streamName: TeamStreamName;
	lastConsumedItemId?: string;
	updatedAt: string;
}


// --- Role Task execution ---
export interface TeamRoleTaskExecutionInput {
	roleTaskId: string;
	roleId: TeamRole["roleId"];
	teamRunId: string;
	inputData: Record<string, unknown>;
}

export interface TeamRoleTaskExecutionResult {
	status: "success" | "failed" | "needs_user_input";
	emits: Array<{
		streamName: TeamStreamName;
		payload: unknown;
	}>;
	checkpoint?: Record<string, unknown>;
	message?: string;
	rawOutput?: string;
}

// --- API input types ---
export interface CreateBrandDomainDiscoveryPlanInput {
	templateId?: TeamTemplateId;
	keyword: string;
	companyNames?: string[];
	officialDomains?: string[];
	excludedGenericMeanings?: string[];
	maxRounds?: number;
	maxCandidates?: number;
	maxMinutes?: number;
}
