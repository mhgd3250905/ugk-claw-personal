import type { TeamPlan, TeamRole, TeamStreamName, DiscoveryPlan, TeamRunState, CreateBrandDomainDiscoveryPlanInput } from "./types.js";
import { generateTeamRunId } from "./team-id.js";

const BRAND_DOMAIN_ROLES: TeamRole[] = [
	{
		roleId: "discovery",
		name: "Domain Discovery",
		responsibility: "Search for candidate domains related to the keyword using multiple sources",
		mustNotDo: [
			"Do not claim to have searched the entire internet",
			"Do not classify or judge domains",
			"Do not write to any stream other than candidate_domains",
		],
		allowedInputStreams: [],
		outputStreams: ["candidate_domains"],
	},
	{
		roleId: "evidence_collector",
		name: "Evidence Collector",
		responsibility: "Collect HTTP, DNS, certificate and page signals for candidate domains",
		mustNotDo: [
			"Do not classify domains",
			"Do not fabricate evidence",
			"Do not write to streams other than domain_evidence",
		],
		allowedInputStreams: ["candidate_domains"],
		outputStreams: ["domain_evidence"],
	},
	{
		roleId: "classifier",
		name: "Domain Classifier",
		responsibility: "Classify domains based on collected evidence",
		mustNotDo: [
			"Do not make final ownership claims without evidence",
			"Do not write to streams other than domain_classifications",
		],
		allowedInputStreams: ["domain_evidence"],
		outputStreams: ["domain_classifications"],
	},
	{
		roleId: "reviewer",
		name: "Independent Reviewer",
		responsibility: "Review classifications for unsupported claims, overstatements, and missing evidence",
		mustNotDo: [
			"Do not share context with producer roles",
			"Do not write to streams other than review_findings",
			"Do not introduce new facts",
		],
		allowedInputStreams: ["domain_classifications"],
		outputStreams: ["review_findings"],
	},
	{
		roleId: "finalizer",
		name: "Report Finalizer",
		responsibility: "Aggregate all streams into a final report",
		mustNotDo: [
			"Do not introduce new facts",
			"Do not claim comprehensive coverage",
			"Do not make final ownership claims without official whitelist",
		],
		allowedInputStreams: ["candidate_domains", "domain_evidence", "domain_classifications", "review_findings"],
		outputStreams: [],
	},
];

const ALL_STREAMS: TeamStreamName[] = [
	"candidate_domains",
	"domain_evidence",
	"domain_classifications",
	"review_findings",
];

export function createBrandDomainDiscoveryPlan(
	input: CreateBrandDomainDiscoveryPlanInput,
): { plan: TeamPlan; state: TeamRunState } {
	const keyword = input.keyword;

	const searchQueries = [
		`${keyword} official domain`,
		`${keyword} login`,
		`${keyword} portal`,
		`${keyword} app`,
		`${keyword} support`,
		`${keyword} company`,
	];

	if (input.companyNames?.length) {
		for (const name of input.companyNames) {
			searchQueries.push(`"${name}" ${keyword} domain`);
			searchQueries.push(`"${name}" login`);
			searchQueries.push(`"${name}" portal`);
		}
	}

	const discoveryPlan: DiscoveryPlan = {
		searchQueries,
		certificatePatterns: [`*${keyword.toLowerCase()}*`],
		githubOrDocsQueries: [
			`${keyword} domain`,
			`${keyword} login`,
			`${keyword} API`,
			`${keyword} portal`,
		],
		similarDomainPatterns: [
			`${keyword.toLowerCase()}-*`,
			`get${keyword.toLowerCase()}*`,
			`${keyword.toLowerCase()}login*`,
			`${keyword.toLowerCase()}portal*`,
		],
		knownSiteLinks: input.officialDomains?.length ? input.officialDomains : [],
	};

	const maxRounds = input.maxRounds ?? 5;
	const maxCandidates = input.maxCandidates ?? 100;
	const maxMinutes = input.maxMinutes ?? 60;

	const plan: TeamPlan = {
		templateId: "brand_domain_discovery",
		goal: `Discover and classify ${keyword}-related domains`,
		keyword,
		roles: BRAND_DOMAIN_ROLES,
		streams: ALL_STREAMS,
		discoveryPlan,
		stopConditions: [
			"All high-priority discovery slices completed",
			`maxRounds (${maxRounds}) reached`,
			`maxCandidates (${maxCandidates}) reached`,
			"2 consecutive rounds with no new candidates",
			"Reviewer outputs needs_user_input",
			`maxMinutes (${maxMinutes}) exceeded`,
		],
		deliverables: [
			"candidate_domains.json",
			"domain_evidence.json",
			"domain_classifications.json",
			"review_report.json",
			"final_report.md",
		],
	};

	const now = new Date().toISOString();
	const teamRunId = generateTeamRunId();

	const state: TeamRunState = {
		teamRunId,
		templateId: "brand_domain_discovery",
		status: "queued",
		goal: plan.goal,
		keyword,
		companyHints: {
			officialDomains: input.officialDomains ?? [],
			companyNames: input.companyNames ?? [],
			excludedGenericMeanings: input.excludedGenericMeanings ?? [],
		},
		createdAt: now,
		updatedAt: now,
		currentRound: 0,
		budgets: {
			maxRounds,
			maxCandidates,
			maxMinutes,
			roleTaskTimeoutMs: 180000,
			roleTaskMaxRetries: 1,
		},
		counters: {
			candidateDomains: 0,
			domainEvidence: 0,
			classifications: 0,
			reviewFindings: 0,
			failedRoleTasks: 0,
		},
		stopSignals: [],
	};

	return { plan, state };
}
