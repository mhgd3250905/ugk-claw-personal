import type {
	CreateBrandDomainDiscoveryPlanInput,
	TeamPlan,
	TeamRole,
	TeamRunState,
} from "../types.js";
import type { TeamTemplate } from "../team-template.js";
import { brandDomainDiscoveryTemplate, createBrandDomainDiscoveryTemplateRun } from "./brand-domain-discovery.js";

function formatCompetitorCategory(category: string): string {
	switch (category) {
		case "confirmed_company_asset": return "确认公司资产";
		case "likely_company_asset": return "可能是公司资产";
		case "unknown": return "未知";
		case "likely_third_party": return "可能是第三方";
		case "suspicious_impersonation": return "疑似仿冒";
		case "irrelevant": return "无关";
		default: return category;
	}
}

function formatCompetitorConfidence(confidence: string): string {
	switch (confidence) {
		case "low": return "低";
		case "medium": return "中";
		case "high": return "高";
		default: return confidence;
	}
}

function formatCompetitorAction(action: string): string {
	switch (action) {
		case "accept_as_company_asset": return "按公司资产接受";
		case "manual_review": return "人工复核";
		case "monitor": return "持续监控";
		case "ignore": return "忽略";
		case "investigate_risk": return "调查风险";
		default: return action;
	}
}

const COMPETITOR_DOMAIN_ROLES: TeamRole[] = brandDomainDiscoveryTemplate.roles.map((role) => {
	switch (role.roleId) {
		case "discovery":
			return {
				...role,
				name: "Competitor Domain Discovery",
				responsibility: "Search for candidate domains that may belong to direct or adjacent competitors",
			};
		case "evidence_collector":
			return {
				...role,
				name: "Competitor Evidence Collector",
				responsibility: "Collect cautious public evidence for competitor-related candidate domains",
			};
		case "classifier":
			return {
				...role,
				name: "Competitor Domain Classifier",
				responsibility: "Classify competitor-related domains without claiming ownership beyond available evidence",
			};
		case "reviewer":
			return {
				...role,
				name: "Competitor Claim Reviewer",
				responsibility: "Review competitor classifications for unsupported ownership or market claims",
			};
		case "finalizer":
			return {
				...role,
				name: "Competitor Domain Report Finalizer",
				responsibility: "Aggregate competitor-domain streams into a cautious research brief",
			};
	}
});

export function createCompetitorDomainDiscoveryTemplateRun(
	input: CreateBrandDomainDiscoveryPlanInput,
): { plan: TeamPlan; state: TeamRunState } {
	const { plan, state } = createBrandDomainDiscoveryTemplateRun(input);
	const competitorNames = input.companyNames ?? [];
	const competitorQueries = competitorNames.flatMap((name) => [
		`"${name}" official domain`,
		`"${name}" login`,
		`"${name}" customer portal`,
		`"${name}" support`,
	]);

	const nextPlan: TeamPlan = {
		...plan,
		templateId: "competitor_domain_discovery",
		goal: `Discover and classify competitor-related domains for ${input.keyword}`,
		roles: COMPETITOR_DOMAIN_ROLES,
		discoveryPlan: {
			...plan.discoveryPlan,
			searchQueries: competitorQueries.length > 0
				? competitorQueries
				: [
					`${input.keyword} competitors official domains`,
					`${input.keyword} alternatives login`,
					`${input.keyword} market competitors portal`,
					`${input.keyword} similar products support`,
				],
			githubOrDocsQueries: [
				`${input.keyword} competitors domains`,
				`${input.keyword} alternatives API`,
				`${input.keyword} market comparison`,
			],
			similarDomainPatterns: [
				`${input.keyword.toLowerCase()}-alternative*`,
				`${input.keyword.toLowerCase()}competitor*`,
				`compare-${input.keyword.toLowerCase()}*`,
			],
		},
		stopConditions: [
			"All competitor discovery slices completed",
			...plan.stopConditions.filter((condition) => !condition.includes("high-priority discovery")),
		],
		deliverables: [
			"candidate_domains.json",
			"domain_evidence.json",
			"domain_classifications.json",
			"review_report.json",
			"competitor_domain_report.md",
		],
	};

	return {
		plan: nextPlan,
		state: {
			...state,
			templateId: "competitor_domain_discovery",
			goal: nextPlan.goal,
		},
	};
}

export const competitorDomainDiscoveryTemplate: TeamTemplate = {
	templateId: "competitor_domain_discovery",
	metadata: {
		templateId: "competitor_domain_discovery",
		title: "Competitor Domain Discovery",
		description: "Discover and cautiously classify domains that may belong to direct or adjacent competitors.",
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
					label: "Research topic",
					required: true,
					description: "Market, product, or company topic used to frame competitor discovery.",
				},
				companyNames: {
					type: "string_array",
					label: "Competitor names",
					itemLabel: "Competitor name",
					description: "Optional competitor names used to generate targeted discovery queries.",
				},
				officialDomains: {
					type: "string_array",
					label: "Known domains",
					itemLabel: "Known domain",
					description: "Optional known domains used as reference context.",
				},
				excludedGenericMeanings: {
					type: "string_array",
					label: "Excluded generic meanings",
					itemLabel: "Meaning",
					description: "Optional generic meanings that should not be treated as competitor signals.",
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
	roles: COMPETITOR_DOMAIN_ROLES,
	streamNames: brandDomainDiscoveryTemplate.streamNames,
	createRun: createCompetitorDomainDiscoveryTemplateRun,
	getStreamValidator: brandDomainDiscoveryTemplate.getStreamValidator,
	getReadyRoleTasks: brandDomainDiscoveryTemplate.getReadyRoleTasks,
	shouldBlock: brandDomainDiscoveryTemplate.shouldBlock,
	shouldFinalize: brandDomainDiscoveryTemplate.shouldFinalize,
	async finalize(input) {
		await brandDomainDiscoveryTemplate.finalize(input);
		if (input.finalReportMarkdown) {
			await input.workspace.writeArtifactText(input.teamRunId, "competitor_domain_report.md", input.finalReportMarkdown);
			return;
		}

		const classifications = input.streams.domain_classifications ?? [];
		const reviews = input.streams.review_findings ?? [];
		const lines: string[] = [];
		lines.push(`# ${input.state.keyword} 竞争对手域名调查报告`);
		lines.push("");
		lines.push("## 摘要");
		lines.push(`- 候选域名：${input.streams.candidate_domains?.length ?? 0}`);
		lines.push(`- 已收集证据：${input.streams.domain_evidence?.length ?? 0}`);
		lines.push(`- 分类结果：${classifications.length}`);
		lines.push(`- 审核意见：${reviews.length}`);
		lines.push("");
		lines.push("## 分类结果");
		lines.push("| 域名 | 分类 | 置信度 | 建议操作 |");
		lines.push("|--------|----------|------------|--------|");
		for (const item of classifications) {
			const payload = item.payload as { domain: string; category: string; confidence: string; recommendedAction: string };
			lines.push(`| ${payload.domain} | ${formatCompetitorCategory(payload.category)} | ${formatCompetitorConfidence(payload.confidence)} | ${formatCompetitorAction(payload.recommendedAction)} |`);
		}
		lines.push("");
		lines.push("## 局限性");
		lines.push("- 本报告是竞争对手域名发现简报，不是市场份额分析。");
		lines.push("- 除非有明确证据支持，否则域名所有权尚未正式核验。");
		lines.push("- 所有竞争关系判断都应视为初步结论，并等待人工复核。");
		lines.push("");
		lines.push(`生成时间：${new Date().toISOString()}`);

		await input.workspace.writeArtifactText(input.teamRunId, "competitor_domain_report.md", lines.join("\n"));
	},
};
