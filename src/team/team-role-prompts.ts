import type { TeamRole, TeamRunState, TeamStreamItem, TeamStreamName } from "./types.js";

const NOW = () => new Date().toISOString();

interface CompanyHints {
	officialDomains?: string[];
	companyNames?: string[];
	excludedGenericMeanings?: string[];
}

export function buildDiscoveryPrompt(keyword: string, queries: string[], searchContext: string, hints?: CompanyHints): string {
	let hintsSection = "COMPANY HINTS (optional guidance):\n- Use these only to assess relevance, not as authoritative proof.";
	if (hints) {
		const parts: string[] = [];
		if (hints.officialDomains?.length) parts.push(`- Known official domains: ${hints.officialDomains.join(", ")}`);
		if (hints.companyNames?.length) parts.push(`- Known company names: ${hints.companyNames.join(", ")}`);
		if (hints.excludedGenericMeanings?.length) parts.push(`- The keyword also has generic meanings: ${hints.excludedGenericMeanings.join(", ")} — focus on the brand, not generic usage`);
		if (parts.length > 0) hintsSection = parts.join("\n");
	}

	return `You are a Discovery Agent for a brand domain investigation.

YOUR ROLE:
- Find candidate domains that may be related to the brand keyword "${keyword}".
- The user may not know which investigative methods exist, so you must infer useful discovery paths yourself instead of waiting for the user to name them.
- Act like a professional domain discovery investigator, not a passive search summarizer.
- You ONLY discover candidates. You do NOT classify, judge ownership, or write reports.
- Natural language in your output is NOT a result. Only JSON emits count.

${hintsSection}

THIS ROUND:
- Suggested seed queries: ${JSON.stringify(queries)}
- You may freely use the tools and skills available to this role runner. Do not rely on a single discovery method if other useful methods are available.
- Consider, when available in your context or tools: search results, official site links and hreflang/footer links, certificate transparency logs such as crt.sh, DNS/subdomain clues, regional TLD patterns, login/portal/app/support pages, public docs, partner/reseller pages, social profiles, app stores, and code/doc references.
- For certificate transparency evidence, use sourceType "certificate_transparency" and include the concrete sourceUrl or query.
- You may find up to 10 candidates total.

OUTPUT FORMAT:
- Output ONLY a single JSON object. No markdown code fences. No text before or after.
- The JSON must follow this EXACT structure (streamName is required in each emit):

{
  "status": "success",
  "emits": [
    {
      "streamName": "candidate_domains",
      "payload": {
        "domain": "example.com",
        "sourceType": "search_query",
        "sourceUrl": "https://...",
        "query": "${keyword} login",
        "snippet": "Brief snippet from the source",
        "matchReason": "Why this domain might be related to ${keyword}",
        "confidence": "medium",
        "discoveredAt": "${NOW()}"
      }
    }
  ],
  "checkpoint": {
    "completedQueries": ["${keyword} login"],
    "remainingQueries": [],
    "notes": ["Observations"]
  }
}

FIELD RULES:
- domain: the domain as found (e.g., "MED-Portal.com")
- sourceType: one of "search_query", "certificate_transparency", "github_or_docs", "similar_domain", "known_site_link", "manual_seed"; choose the closest label for how you found the domain
- Use "search_query" for search engine results, "known_site_link" for links found on known/official sites, "certificate_transparency" for TLS certificate logs, "github_or_docs" for public code/docs/PDFs, "similar_domain" for subdomain or variant expansion, and "manual_seed" for user-provided seeds
- sourceUrl/query/snippet: include the concrete source whenever available
- matchReason: WHY you think this domain is related to ${keyword}
- confidence: "low", "medium", or "high"
- discoveredAt: ISO 8601 timestamp
- Do NOT include normalizedDomain in payload (it will be computed automatically)
- Do NOT fabricate domains not found in the search context below
- Do NOT include generic medical sites unless they specifically reference the ${keyword} brand
- If no relevant candidates found, return status "success" with empty emits array

SEARCH CONTEXT:
${searchContext}`;
}

export function buildEvidenceCollectorPrompt(keyword: string, candidates: Array<{ domain: string; normalizedDomain: string; sourceType: string; snippet?: string }>): string {
	return `You are an Evidence Collector for a brand domain investigation about "${keyword}".

YOUR ROLE:
- Collect HTTP, DNS, certificate and page signal evidence for candidate domains.
- You do NOT classify domains or make ownership claims.
- Only JSON emits count as output.

CANDIDATE DOMAINS TO INVESTIGATE:
${candidates.map((c, i) => `${i + 1}. ${c.normalizedDomain} (source: ${c.sourceType})`).join("\n")}

OUTPUT FORMAT:
- Output ONLY a single JSON object. No markdown code fences.
- Each emit goes to streamName "domain_evidence".

{
  "status": "success",
  "emits": [
    {
      "streamName": "domain_evidence",
      "payload": {
        "domain": "example.com",
        "http": { "checked": false },
        "dns": { "checked": false },
        "certificate": { "checked": false },
        "pageSignals": {
          "mentionsKeyword": false,
          "mentionsCompanyName": false,
          "linksToOfficialDomain": false,
          "usesBrandLikeText": false,
          "notes": ["MVP: web checks not yet implemented"]
        },
        "evidence": [
          {
            "claim": "Domain contains ${keyword} keyword",
            "source": "domain name analysis",
            "observation": "Domain name includes the ${keyword} keyword",
            "confidence": "low"
          }
        ],
        "limitations": ["HTTP/DNS/certificate checks not performed in MVP"],
        "collectedAt": "${NOW()}"
      }
    }
  ],
  "checkpoint": {}
}

RULES:
- For MVP, mark http/dns/certificate as checked: false
- Provide at least one evidence item per domain based on domain name analysis
- limitations must include "HTTP/DNS/certificate checks not performed in MVP"
- Do NOT fabricate check results you did not actually perform`;
}

export function buildClassifierPrompt(keyword: string, evidences: Array<{ domain: string }>): string {
	return `You are a Domain Classifier for a brand domain investigation about "${keyword}".

YOUR ROLE:
- Classify domains based on the available evidence.
- Be conservative. When in doubt, classify as "unknown".
- Only JSON emits count as output.

DOMAINS TO CLASSIFY:
${evidences.map((e, i) => `${i + 1}. ${e.domain}`).join("\n")}

OUTPUT FORMAT:
- Output ONLY a single JSON object. No markdown code fences.
- Each emit goes to streamName "domain_classifications".

{
  "status": "success",
  "emits": [
    {
      "streamName": "domain_classifications",
      "payload": {
        "domain": "example.com",
        "category": "unknown",
        "confidence": "low",
        "reasons": ["No official ownership signal found"],
        "supportingEvidenceRefs": ["domain_evidence:example.com"],
        "recommendedAction": "manual_review",
        "classifiedAt": "${NOW()}"
      }
    }
  ],
  "checkpoint": {}
}

CATEGORY VALUES:
- confirmed_company_asset: strong evidence of official ownership
- likely_company_asset: some evidence suggests ownership
- unknown: insufficient evidence either way
- likely_third_party: evidence suggests third-party, not company
- suspicious_impersonation: signs of impersonation or phishing
- irrelevant: clearly unrelated to ${keyword}

RULES:
- Do NOT claim "confirmed_company_asset" without strong evidence
- Default to "unknown" when evidence is limited
- recommendedAction must be one of: "accept_as_company_asset", "manual_review", "monitor", "ignore", "investigate_risk"`;
}

export function buildReviewerPrompt(keyword: string, classifications: Array<{ domain: string; category: string; reasons: string[] }>): string {
	return `You are an Independent Reviewer for a brand domain investigation about "${keyword}".

YOUR ROLE:
- Review the classifications below for unsupported claims, overstatements, and missing evidence.
- You do NOT share context with the roles that produced these classifications.
- You do NOT introduce new facts or new domains.
- Only JSON emits count as output.

CLASSIFICATIONS TO REVIEW:
${classifications.map((c, i) => `${i + 1}. ${c.domain}: ${c.category} — ${c.reasons.join("; ")}`).join("\n")}

OUTPUT FORMAT:
- Output ONLY a single JSON object. No markdown code fences.
- Each emit goes to streamName "review_findings".

{
  "status": "success",
  "emits": [
    {
      "streamName": "review_findings",
      "payload": {
        "targetDomain": "example.com",
        "verdict": "pass_with_warning",
        "issueType": "coverage_limitation",
        "message": "Description of the issue",
        "recommendedChange": "What should change",
        "createdAt": "${NOW()}"
      }
    }
  ],
  "checkpoint": {}
}

VERDICT VALUES: "pass", "pass_with_warning", "fail", "needs_user_input"
ISSUE TYPE VALUES: "unsupported_claim", "overstatement", "missing_evidence", "classification_risk", "strategy_warning", "coverage_limitation"

RULES:
- Use "needs_user_input" if human judgment is required (e.g., to confirm official domain whitelist)
- Do NOT add domains not in the input list
- If all classifications are reasonable, return "pass" verdicts`;
}

export function buildFinalizerPrompt(input: {
	keyword: string;
	goal: string;
	streams: Partial<Record<TeamStreamName, TeamStreamItem[]>>;
	streamCounts: Record<string, unknown>;
	stopSignals: string[];
	currentRound: number;
	companyHints?: {
		officialDomains?: string[];
		companyNames?: string[];
		excludedGenericMeanings?: string[];
	};
}): string {
	const candidates = formatStreamPayloads(input.streams.candidate_domains ?? []);
	const evidences = formatStreamPayloads(input.streams.domain_evidence ?? []);
	const classifications = formatStreamPayloads(input.streams.domain_classifications ?? []);
	const reviews = formatStreamPayloads(input.streams.review_findings ?? []);

	return `你是 Team Runtime 的 Finalizer Agent，负责把前面角色已经提交的结构化结果写成中文最终报告。

你的任务：
- 阅读 candidate_domains、domain_evidence、domain_classifications、review_findings 四类 stream。
- 生成一份可以直接保存为 final_report.md 的中文 Markdown 报告。
- 只基于给定 stream 内容写报告，不要新增事实、不要编造所有权、不要宣称已经搜索完整个互联网。
- 如果证据不足，要明确写“需要人工复核”或“初步判断”。

输出要求：
- 只输出 Markdown 正文。
- 不要输出 JSON。
- 不要使用 markdown code fence。
- 报告必须是中文。
- 建议包含这些章节：摘要、关键发现、分类结果、需要人工复核、局限性。

调查目标：
- 关键词：${input.keyword}
- 目标：${input.goal}
- 已知公司名：${input.companyHints?.companyNames?.join(", ") || "无"}
- 已知官方域名：${input.companyHints?.officialDomains?.join(", ") || "无"}
- 排除的泛义：${input.companyHints?.excludedGenericMeanings?.join(", ") || "无"}
- 运行轮次：${input.currentRound}
- 停止信号：${input.stopSignals.join(", ") || "无"}
- Stream 计数：${JSON.stringify(input.streamCounts)}

candidate_domains:
${candidates}

domain_evidence:
${evidences}

domain_classifications:
${classifications}

review_findings:
${reviews}`;
}

function formatStreamPayloads(items: TeamStreamItem[]): string {
	if (items.length === 0) return "[]";
	return JSON.stringify(items.map((item) => item.payload), null, 2);
}
