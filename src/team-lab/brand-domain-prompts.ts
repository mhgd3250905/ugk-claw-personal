export function buildDiscoveryPrompt(queries: string[], searchContext: string): string {
  return `You are a Discovery Agent for a brand domain investigation.

YOUR ROLE:
- Find candidate domains that may be related to the brand keyword "MED".
- You ONLY discover candidates. You do NOT classify, judge ownership, or write reports.
- You do NOT output any review or analysis text outside the JSON envelope.

THIS ROUND:
- Process ONLY these queries: ${JSON.stringify(queries)}
- You may find up to 5 candidates total.

OUTPUT FORMAT:
- Output ONLY a single JSON object. No markdown code fences. No text before or after the JSON.
- The JSON must follow this exact structure:

{
  "status": "success",
  "emits": [
    {
      "type": "candidate_domain",
      "payload": {
        "domain": "example.com",
        "normalizedDomain": "example.com",
        "sourceType": "search_query",
        "sourceUrl": "https://...",
        "query": "MED login",
        "snippet": "Brief snippet from the source",
        "matchReason": "Why this domain might be related to MED",
        "confidence": "low",
        "discoveredAt": "${new Date().toISOString()}"
      }
    }
  ],
  "checkpoint": {
    "completedQueries": ["MED login"],
    "remainingQueries": [],
    "notes": ["Observations about the search results"]
  }
}

RULES:
- Every candidate MUST have: domain, normalizedDomain, sourceType, matchReason, confidence, discoveredAt.
- If sourceType is "search_query", include at least one of: query or sourceUrl.
- confidence must be one of: "low", "medium", "high".
- Do NOT include candidates from generic medical sites unless they specifically reference the MED brand.
- Do NOT fabricate or hallucinate domains that were not found in the search context below.
- If no relevant candidates were found, return status "success" with an empty emits array.

SEARCH CONTEXT (use this as your source material):
${searchContext}`;
}

export const FIXTURE_SEARCH_CONTEXT = `
Query: "MED official domain"
Results:
1. https://med.company.com - Official MED company portal, login page for employees
2. https://med-health.com - Medical health information portal, unrelated to MED brand
3. https://www.med-tech.io - MED Tech startup, offers API services for medical devices

Query: "MED login"
Results:
1. https://login.med.company.com - SSO login portal for MED employees
2. https://med-portal.com - A portal claiming to be MED gateway, requires registration
3. https://github.com/med-sdk - MED SDK documentation with references to med-sdk.com

Query: "MED portal"
Results:
1. https://portal.med.company.com - Official MED partner portal
2. https://medportal.net - Third-party medical portal, mentions MED in ads
3. https://getmed.io - GetMED app website, references MED brand in footer
`;

export function buildReviewerPrompt(candidates: string, keyword: string): string {
  return `You are a Reviewer for a brand domain investigation about "${keyword}".

YOUR ROLE:
- Review the candidate domains below for obvious problems in how they were discovered.
- You do NOT add new candidates.
- You do NOT classify ownership or write final reports.
- You ONLY output a review JSON envelope.

REVIEW CRITERIA:
- Check if matchReason actually supports the candidate.
- Check if confidence level seems justified.
- Flag any candidate that seems fabricated or hallucinated.
- Flag any overstatement (e.g., claiming official ownership without evidence).

OUTPUT FORMAT:
- Output ONLY a single JSON object. No markdown code fences. No text before or after the JSON.

{
  "status": "success",
  "summary": "Brief summary of the review",
  "findings": [
    {
      "targetDomain": "example.com",
      "verdict": "pass_with_warning",
      "issueType": "coverage_limitation",
      "message": "Description of the issue",
      "recommendedChange": "What should change",
      "createdAt": "${new Date().toISOString()}"
    }
  ]
}

RULES:
- verdict must be one of: "pass", "pass_with_warning", "fail", "needs_user_input".
- issueType must be one of: "unsupported_claim", "overstatement", "missing_evidence", "classification_risk", "strategy_warning", "coverage_limitation".
- If all candidates look reasonable, return a single "pass" finding.
- Do NOT include any "candidate" or "domain" fields that add new domains not in the input.

CANDIDATES TO REVIEW:
${candidates}`;
}
