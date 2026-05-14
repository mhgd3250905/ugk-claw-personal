import type {
	CandidateDomainPayload,
	CreateBrandDomainDiscoveryPlanInput,
	DiscoveryPlan,
	DomainClassificationPayload,
	TeamPlan,
	TeamRole,
	TeamRoleProfileBindings,
	TeamRolePromptOverrides,
	TeamRunState,
	TeamStreamItem,
	TeamStreamName,
} from "../types.js";
import type { TeamTemplate } from "../team-template.js";
import { generateRoleTaskId, generateTeamRunId } from "../team-id.js";
import {
	validateCandidateDomainPayload,
	validateDomainClassificationPayload,
	validateDomainEvidencePayload,
	validateReviewFindingPayload,
} from "../team-gate.js";

const BRAND_DOMAIN_ROLES: TeamRole[] = [
	{
		roleId: "discovery",
		name: "Domain Discovery",
		responsibility: "Act as a professional domain discovery investigator: infer useful discovery methods, search broadly, inspect official links, certificate transparency logs such as crt.sh, DNS/subdomain clues, regional TLDs, login/app/support portals, docs, partners, social profiles, app stores, and other public traces to find candidate domains related to the keyword",
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

const ROLE_IDS = new Set<TeamRole["roleId"]>([
	"discovery",
	"evidence_collector",
	"classifier",
	"reviewer",
	"finalizer",
]);

function getStreamItems(
	streams: Partial<Record<TeamStreamName, TeamStreamItem[]>>,
	streamName: TeamStreamName,
): TeamStreamItem[] {
	return streams[streamName] ?? [];
}

function getItemsAfterCursor(
	items: TeamStreamItem[],
	cursor: { lastConsumedItemId?: string } | undefined,
): TeamStreamItem[] {
	if (!cursor?.lastConsumedItemId) return [...items];
	const idx = items.findIndex((item) => item.itemId === cursor.lastConsumedItemId);
	if (idx < 0) return [...items];
	return items.slice(idx + 1);
}

function cursorKey(roleId: TeamRole["roleId"], streamName: TeamStreamName): string {
	return `${roleId}_${streamName}`;
}

function formatClassificationCategory(category: DomainClassificationPayload["category"]): string {
	switch (category) {
		case "confirmed_company_asset": return "确认公司资产";
		case "likely_company_asset": return "可能是公司资产";
		case "unknown": return "未知";
		case "likely_third_party": return "可能是第三方";
		case "suspicious_impersonation": return "疑似仿冒";
		case "irrelevant": return "无关";
	}
}

function formatConfidence(confidence: DomainClassificationPayload["confidence"]): string {
	switch (confidence) {
		case "low": return "低";
		case "medium": return "中";
		case "high": return "高";
	}
}

function formatRecommendedAction(action: DomainClassificationPayload["recommendedAction"]): string {
	switch (action) {
		case "accept_as_company_asset": return "按公司资产接受";
		case "manual_review": return "人工复核";
		case "monitor": return "持续监控";
		case "ignore": return "忽略";
		case "investigate_risk": return "调查风险";
	}
}

function formatVerdict(verdict: string): string {
	switch (verdict) {
		case "pass": return "通过";
		case "pass_with_warning": return "带警告通过";
		case "fail": return "不通过";
		case "needs_user_input": return "需要人工输入";
		default: return verdict;
	}
}

function normalizeRoleProfileIds(input: unknown): TeamRoleProfileBindings | undefined {
	if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
	const output: TeamRoleProfileBindings = {};
	for (const [roleId, profileId] of Object.entries(input as Record<string, unknown>)) {
		if (!ROLE_IDS.has(roleId as TeamRole["roleId"]) || typeof profileId !== "string") continue;
		const normalizedProfileId = profileId.trim();
		if (normalizedProfileId) {
			output[roleId as TeamRole["roleId"]] = normalizedProfileId;
		}
	}
	return Object.keys(output).length > 0 ? output : undefined;
}

function normalizeRolePromptOverrides(input: unknown): TeamRolePromptOverrides | undefined {
	if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
	const output: TeamRolePromptOverrides = {};
	for (const [roleId, prompt] of Object.entries(input as Record<string, unknown>)) {
		if (!ROLE_IDS.has(roleId as TeamRole["roleId"]) || typeof prompt !== "string") continue;
		const normalizedPrompt = prompt.trim();
		if (normalizedPrompt) {
			output[roleId as TeamRole["roleId"]] = normalizedPrompt;
		}
	}
	return Object.keys(output).length > 0 ? output : undefined;
}

export function createBrandDomainDiscoveryTemplateRun(
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
	const roleProfileIds = normalizeRoleProfileIds(input.roleProfileIds);
	const rolePromptOverrides = normalizeRolePromptOverrides(input.rolePromptOverrides);

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
		...(roleProfileIds ? { roleProfileIds } : {}),
		...(rolePromptOverrides ? { rolePromptOverrides } : {}),
		stopSignals: [],
	};

	return { plan, state };
}

export const brandDomainDiscoveryTemplate: TeamTemplate = {
	templateId: "brand_domain_discovery",
	metadata: {
		templateId: "brand_domain_discovery",
		title: "Brand Domain Discovery",
		description: "Discover and cautiously classify domains related to a brand, product, or company keyword.",
		defaults: {
			maxRounds: 5,
			maxCandidates: 100,
			maxMinutes: 60,
		},
		inputSchema: {
			required: ["keyword"],
			properties: {
				keyword: {
					type: "string",
					label: "Brand keyword",
					required: true,
					description: "Brand, product, or company keyword to investigate.",
				},
				companyNames: {
					type: "string_array",
					label: "Company names",
					itemLabel: "Company name",
					description: "Optional official company names used to expand discovery queries.",
				},
				officialDomains: {
					type: "string_array",
					label: "Official domains",
					itemLabel: "Official domain",
					description: "Optional known official domains used as whitelist context.",
				},
				excludedGenericMeanings: {
					type: "string_array",
					label: "Excluded generic meanings",
					itemLabel: "Meaning",
					description: "Optional generic meanings that should not be treated as brand matches.",
				},
				maxRounds: {
					type: "number",
					label: "Max rounds",
					defaultValue: 5,
					minimum: 1,
					description: "Maximum discovery rounds before the run can finalize.",
				},
				maxCandidates: {
					type: "number",
					label: "Max candidates",
					defaultValue: 100,
					minimum: 1,
					description: "Maximum candidate domains to collect.",
				},
				maxMinutes: {
					type: "number",
					label: "Max minutes",
					defaultValue: 60,
					minimum: 1,
					description: "Maximum wall-clock runtime budget.",
				},
			},
		},
	},
	roles: BRAND_DOMAIN_ROLES,
	streamNames: ALL_STREAMS,
	createRun: createBrandDomainDiscoveryTemplateRun,
	getStreamValidator(streamName) {
		switch (streamName) {
			case "candidate_domains": return validateCandidateDomainPayload;
			case "domain_evidence": return validateDomainEvidencePayload;
			case "domain_classifications": return validateDomainClassificationPayload;
			case "review_findings": return validateReviewFindingPayload;
			default: return undefined;
		}
	},
	getReadyRoleTasks({ teamRunId, state, plan, streams, cursors }) {
		const tasks = [];

		if (
			state.stopSignals.length === 0 &&
			state.counters.candidateDomains < state.budgets.maxCandidates &&
			state.currentRound < state.budgets.maxRounds
		) {
			tasks.push({
				roleId: "discovery" as const,
				task: {
					roleTaskId: generateRoleTaskId(),
					roleId: "discovery" as const,
					teamRunId,
					inputData: {
						keyword: state.keyword,
						queries: plan.discoveryPlan.searchQueries,
						companyHints: state.companyHints,
					},
				},
				updates: { incrementCurrentRound: true },
			});
		}

		const candidates = getStreamItems(streams, "candidate_domains");
		const candidateCursor = cursors[cursorKey("evidence_collector", "candidate_domains")];
		const newCandidates = getItemsAfterCursor(candidates, candidateCursor);
		if (newCandidates.length > 0) {
			const batch = newCandidates.slice(0, 1);
			tasks.push({
				roleId: "evidence_collector" as const,
				consumes: { streamName: "candidate_domains" as const, items: batch },
				task: {
					roleTaskId: generateRoleTaskId(),
					roleId: "evidence_collector" as const,
					teamRunId,
					inputData: {
						keyword: state.keyword,
						candidates: batch.map((item) => item.payload),
					},
				},
			});
		}

		const evidences = getStreamItems(streams, "domain_evidence");
		const evidenceCursor = cursors[cursorKey("classifier", "domain_evidence")];
		const newEvidences = getItemsAfterCursor(evidences, evidenceCursor);
		if (newEvidences.length > 0) {
			const batch = newEvidences.slice(0, 1);
			tasks.push({
				roleId: "classifier" as const,
				consumes: { streamName: "domain_evidence" as const, items: batch },
				task: {
					roleTaskId: generateRoleTaskId(),
					roleId: "classifier" as const,
					teamRunId,
					inputData: {
						keyword: state.keyword,
						evidences: batch.map((item) => item.payload),
					},
				},
			});
		}

		const classifications = getStreamItems(streams, "domain_classifications");
		const classificationCursor = cursors[cursorKey("reviewer", "domain_classifications")];
		const newClassifications = getItemsAfterCursor(classifications, classificationCursor);
		if (newClassifications.length > 0) {
			const batch = newClassifications.slice(0, 1);
			tasks.push({
				roleId: "reviewer" as const,
				consumes: { streamName: "domain_classifications" as const, items: batch },
				task: {
					roleTaskId: generateRoleTaskId(),
					roleId: "reviewer" as const,
					teamRunId,
					inputData: {
						keyword: state.keyword,
						classifications: batch.map((item) => item.payload),
					},
				},
			});
		}

		return tasks;
	},
	shouldBlock({ streams }) {
		for (const item of getStreamItems(streams, "review_findings")) {
			const payload = item.payload as { verdict?: string; message?: string };
			if (payload.verdict === "needs_user_input") {
				return { blocked: true, reason: payload.message ?? "Reviewer needs user input" };
			}
		}
		return { blocked: false };
	},
	shouldFinalize({ state, streams, cursors }) {
		if (
			state.currentRound < state.budgets.maxRounds &&
			state.counters.candidateDomains < state.budgets.maxCandidates &&
			state.stopSignals.length === 0
		) {
			return false;
		}

		const candidates = getStreamItems(streams, "candidate_domains");
		const evidences = getStreamItems(streams, "domain_evidence");
		const classifications = getStreamItems(streams, "domain_classifications");

		const evUnconsumed = getItemsAfterCursor(
			candidates,
			cursors[cursorKey("evidence_collector", "candidate_domains")],
		).length;
		const clUnconsumed = getItemsAfterCursor(
			evidences,
			cursors[cursorKey("classifier", "domain_evidence")],
		).length;
		const rvUnconsumed = getItemsAfterCursor(
			classifications,
			cursors[cursorKey("reviewer", "domain_classifications")],
		).length;

		return evUnconsumed === 0 && clUnconsumed === 0 && rvUnconsumed === 0;
	},
	async finalize({ teamRunId, state, streams, workspace, finalReportMarkdown }) {
		const candidates = getStreamItems(streams, "candidate_domains");
		const evidences = getStreamItems(streams, "domain_evidence");
		const classifications = getStreamItems(streams, "domain_classifications");
		const reviews = getStreamItems(streams, "review_findings");

		const lines: string[] = [];
		lines.push(`# ${state.keyword} 域名调查报告`);
		lines.push("");
		lines.push("## 1. 摘要");
		lines.push(`- 候选域名：${candidates.length}`);
		lines.push(`- 已收集证据：${evidences.length}`);
		lines.push(`- 分类结果：${classifications.length}`);
		lines.push(`- 审核意见：${reviews.length}`);

		const unknownCount = classifications.filter((item) => (item.payload as DomainClassificationPayload).category === "unknown").length;
		const suspiciousCount = classifications.filter((item) => (item.payload as DomainClassificationPayload).category === "suspicious_impersonation").length;
		lines.push(`- 需要人工复核：${unknownCount}`);
		lines.push(`- 疑似仿冒：${suspiciousCount}`);
		lines.push("");

		lines.push("## 2. 覆盖范围");
		lines.push(`- 运行轮次：${state.currentRound}`);
		lines.push(`- 停止信号：${state.stopSignals.join(", ") || "无"}`);
		lines.push("- 本报告不是对整个互联网的完整搜索。");
		lines.push("");

		lines.push("## 3. 分类结果");
		lines.push("| 域名 | 分类 | 置信度 | 建议操作 |");
		lines.push("|--------|----------|------------|--------|");
		for (const item of classifications) {
			const payload = item.payload as DomainClassificationPayload;
			lines.push(`| ${payload.domain} | ${formatClassificationCategory(payload.category)} | ${formatConfidence(payload.confidence)} | ${formatRecommendedAction(payload.recommendedAction)} |`);
		}
		lines.push("");

		if (reviews.length > 0) {
			lines.push("## 4. 审核意见");
			for (const item of reviews) {
				const payload = item.payload as { targetDomain?: string; verdict: string; message: string };
				const target = payload.targetDomain ? ` (${payload.targetDomain})` : "";
				lines.push(`- **${formatVerdict(payload.verdict)}**${target}：${payload.message}`);
			}
			lines.push("");
		}

		lines.push("## 5. 局限性");
		lines.push("- 本报告不是对整个互联网的完整搜索。");
		lines.push(`- 本报告不代表所有与 ${state.keyword} 相关的域名。`);
		lines.push("- 域名所有权尚未完成正式核验。");
		if (!state.companyHints.officialDomains?.length) {
			lines.push("- 未提供官方域名白名单；所有权判断仅作为初步参考。");
		}
		lines.push("");
		lines.push(`生成时间：${new Date().toISOString()}`);

		await workspace.writeArtifactText(teamRunId, "final_report.md", finalReportMarkdown ?? lines.join("\n"));

		await workspace.writeArtifactJson(teamRunId, "candidate_domains.json", candidates.map((item) => item.payload as CandidateDomainPayload));
		await workspace.writeArtifactJson(teamRunId, "domain_evidence.json", evidences.map((item) => item.payload));
		await workspace.writeArtifactJson(teamRunId, "domain_classifications.json", classifications.map((item) => item.payload));
		await workspace.writeArtifactJson(teamRunId, "review_report.json", reviews.map((item) => item.payload));
	},
};
