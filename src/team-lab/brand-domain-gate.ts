import type { CandidateDomain, DiscoveryEnvelope, ReviewEnvelope } from "./brand-domain-types.js";

const VALID_CONFIDENCES = new Set(["low", "medium", "high"]);
const VALID_SOURCE_TYPES = new Set([
  "search_query",
  "certificate_transparency",
  "github_or_docs",
  "similar_domain",
  "known_site_link",
  "manual_seed",
]);

export function normalizeDomain(input: string): string | undefined {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  const slashIdx = d.indexOf("/");
  if (slashIdx >= 0) d = d.slice(0, slashIdx);
  d = d.replace(/[#?].*$/, "");
  d = d.replace(/\.$/, "");
  if (!d.includes(".")) return undefined;
  if (d.includes(" ")) return undefined;
  if (d.includes("_")) return undefined;
  if (d.length > 253) return undefined;
  return d || undefined;
}

export function validateCandidateDomain(input: unknown):
  | { ok: true; value: CandidateDomain }
  | { ok: false; errors: string[] }
{
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["payload is not an object"] };
  const p = input as Record<string, unknown>;

  if (typeof p.domain !== "string" || !p.domain) errors.push("missing domain");
  if (typeof p.normalizedDomain !== "string" || !p.normalizedDomain) errors.push("missing normalizedDomain");
  else {
    const normalized = normalizeDomain(p.normalizedDomain as string);
    if (!normalized) errors.push("invalid normalizedDomain");
  }
  if (!VALID_SOURCE_TYPES.has(p.sourceType as string)) errors.push("missing or invalid sourceType");
  if (typeof p.matchReason !== "string" || !p.matchReason) errors.push("missing matchReason");
  if (!VALID_CONFIDENCES.has(p.confidence as string)) errors.push("missing or invalid confidence");
  if (typeof p.discoveredAt !== "string" || !p.discoveredAt) errors.push("missing discoveredAt");

  if (p.sourceType === "search_query" && !p.query && !p.sourceUrl) {
    errors.push("search_query requires query or sourceUrl");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: input as CandidateDomain };
}

export function stripMarkdownFence(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    const firstNewline = s.indexOf("\n");
    if (firstNewline >= 0) s = s.slice(firstNewline + 1);
  }
  if (s.endsWith("```")) {
    s = s.slice(0, s.lastIndexOf("```"));
  }
  return s.trim();
}

export function validateDiscoveryEnvelope(input: unknown):
  | { ok: true; value: DiscoveryEnvelope }
  | { ok: false; errors: string[] }
{
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["envelope is not an object"] };
  const e = input as Record<string, unknown>;

  if (!["success", "partial", "failed"].includes(e.status as string)) {
    errors.push("missing or invalid status");
  }
  if (!Array.isArray(e.emits)) {
    errors.push("emits is not an array");
  } else {
    for (let i = 0; i < e.emits.length; i++) {
      const emit = e.emits[i] as Record<string, unknown>;
      if (emit.type !== "candidate_domain") {
        errors.push(`emits[${i}].type must be "candidate_domain"`);
      }
      if (!emit.payload || typeof emit.payload !== "object") {
        errors.push(`emits[${i}].payload is missing or not an object`);
      } else {
        const candidateResult = validateCandidateDomain(emit.payload);
        if (!candidateResult.ok) {
          errors.push(`emits[${i}].payload: ${candidateResult.errors.join(", ")}`);
        }
      }
    }
  }
  if (!e.checkpoint || typeof e.checkpoint !== "object") {
    errors.push("missing checkpoint");
  } else {
    const cp = e.checkpoint as Record<string, unknown>;
    if (!Array.isArray(cp.completedQueries)) errors.push("checkpoint.completedQueries is not an array");
    if (!Array.isArray(cp.remainingQueries)) errors.push("checkpoint.remainingQueries is not an array");
    if (!Array.isArray(cp.notes)) errors.push("checkpoint.notes is not an array");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: input as DiscoveryEnvelope };
}

const VALID_VERDICTS = new Set(["pass", "pass_with_warning", "fail", "needs_user_input"]);
const VALID_ISSUE_TYPES = new Set([
  "unsupported_claim",
  "overstatement",
  "missing_evidence",
  "classification_risk",
  "strategy_warning",
  "coverage_limitation",
]);

export function validateReviewEnvelope(input: unknown):
  | { ok: true; value: ReviewEnvelope }
  | { ok: false; errors: string[] }
{
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["envelope is not an object"] };
  const e = input as Record<string, unknown>;

  if (!["success", "partial", "failed"].includes(e.status as string)) {
    errors.push("missing or invalid status");
  }
  if (!Array.isArray(e.findings)) {
    errors.push("findings is not an array");
  } else {
    for (let i = 0; i < e.findings.length; i++) {
      const f = e.findings[i] as Record<string, unknown>;
      if (!VALID_VERDICTS.has(f.verdict as string)) errors.push(`findings[${i}].verdict invalid`);
      if (!VALID_ISSUE_TYPES.has(f.issueType as string)) errors.push(`findings[${i}].issueType invalid`);
      if (typeof f.message !== "string" || !f.message) errors.push(`findings[${i}].message missing`);
      if (typeof f.createdAt !== "string" || !f.createdAt) errors.push(`findings[${i}].createdAt missing`);
    }
  }
  if (typeof e.summary !== "string") {
    errors.push("missing summary");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: input as ReviewEnvelope };
}
