import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDomain,
  validateCandidateDomain,
  validateDiscoveryEnvelope,
  validateReviewEnvelope,
  stripMarkdownFence,
} from "../src/team-lab/brand-domain-gate.js";

describe("normalizeDomain", () => {
  it("normalizes https://Med.Example.com/path to med.example.com", () => {
    assert.equal(normalizeDomain("https://Med.Example.com/path"), "med.example.com");
  });

  it("removes trailing dot", () => {
    assert.equal(normalizeDomain("example.com."), "example.com");
  });

  it("removes query and hash", () => {
    assert.equal(normalizeDomain("example.com/page?q=1#top"), "example.com");
  });

  it("lowercases", () => {
    assert.equal(normalizeDomain("MED-EXAMPLE.COM"), "med-example.com");
  });

  it("rejects domain without dot", () => {
    assert.equal(normalizeDomain("localhost"), undefined);
  });

  it("rejects domain with spaces", () => {
    assert.equal(normalizeDomain("med example.com"), undefined);
  });

  it("rejects domain with underscores", () => {
    assert.equal(normalizeDomain("med_example.com"), undefined);
  });

  it("rejects domain over 253 chars", () => {
    const long = "a".repeat(250) + ".com";
    assert.equal(normalizeDomain(long), undefined);
  });

  it("accepts valid subdomain", () => {
    assert.equal(normalizeDomain("login.med.company.com"), "login.med.company.com");
  });

  it("trims whitespace", () => {
    assert.equal(normalizeDomain("  med-example.com  "), "med-example.com");
  });
});

describe("validateCandidateDomain", () => {
  const validCandidate = {
    domain: "med-example.com",
    normalizedDomain: "med-example.com",
    sourceType: "search_query",
    sourceUrl: "https://example.com",
    query: "MED login",
    matchReason: "Domain contains MED keyword",
    confidence: "medium",
    discoveredAt: "2026-05-14T00:00:00.000Z",
  };

  it("accepts valid candidate", () => {
    const result = validateCandidateDomain(validCandidate);
    assert.equal(result.ok, true);
  });

  it("rejects missing domain", () => {
    const result = validateCandidateDomain({ ...validCandidate, domain: undefined });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("domain")));
  });

  it("rejects missing matchReason", () => {
    const result = validateCandidateDomain({ ...validCandidate, matchReason: "" });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("matchReason")));
  });

  it("rejects invalid confidence", () => {
    const result = validateCandidateDomain({ ...validCandidate, confidence: "certain" });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("confidence")));
  });

  it("rejects invalid sourceType", () => {
    const result = validateCandidateDomain({ ...validCandidate, sourceType: "social_media" });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("sourceType")));
  });

  it("requires query or sourceUrl for search_query", () => {
    const result = validateCandidateDomain({
      ...validCandidate,
      sourceType: "search_query",
      query: undefined,
      sourceUrl: undefined,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("search_query")));
  });

  it("accepts candidate with only sourceUrl (no query)", () => {
    const result = validateCandidateDomain({ ...validCandidate, query: undefined });
    assert.equal(result.ok, true);
  });

  it("rejects invalid normalizedDomain", () => {
    const result = validateCandidateDomain({ ...validCandidate, normalizedDomain: "no_dot" });
    assert.equal(result.ok, false);
  });
});

describe("validateDiscoveryEnvelope", () => {
  const validEnvelope = {
    status: "success",
    emits: [
      {
        type: "candidate_domain",
        payload: {
          domain: "med-example.com",
          normalizedDomain: "med-example.com",
          sourceType: "search_query",
          sourceUrl: "https://example.com",
          matchReason: "Contains MED",
          confidence: "medium",
          discoveredAt: "2026-05-14T00:00:00.000Z",
        },
      },
    ],
    checkpoint: {
      completedQueries: ["MED login"],
      remainingQueries: [],
      notes: ["Test note"],
    },
  };

  it("accepts valid envelope", () => {
    const result = validateDiscoveryEnvelope(validEnvelope);
    assert.equal(result.ok, true);
  });

  it("rejects when emits is not an array", () => {
    const result = validateDiscoveryEnvelope({ ...validEnvelope, emits: "not-array" });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("emits")));
  });

  it("rejects missing checkpoint", () => {
    const result = validateDiscoveryEnvelope({ ...validEnvelope, checkpoint: undefined });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("checkpoint")));
  });

  it("rejects invalid status", () => {
    const result = validateDiscoveryEnvelope({ ...validEnvelope, status: "unknown" });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("status")));
  });

  it("accepts empty emits", () => {
    const result = validateDiscoveryEnvelope({ ...validEnvelope, emits: [] });
    assert.equal(result.ok, true);
  });

  it("rejects emit with wrong type", () => {
    const result = validateDiscoveryEnvelope({
      ...validEnvelope,
      emits: [{ type: "review", payload: {} }],
    });
    assert.equal(result.ok, false);
  });
});

describe("validateReviewEnvelope", () => {
  const validReview = {
    status: "success",
    findings: [
      {
        targetDomain: "med-example.com",
        verdict: "pass_with_warning",
        issueType: "coverage_limitation",
        message: "Keyword match alone is insufficient",
        recommendedChange: "Keep as candidate only",
        createdAt: "2026-05-14T00:00:00.000Z",
      },
    ],
    summary: "Candidates require further evidence",
  };

  it("accepts valid review envelope", () => {
    const result = validateReviewEnvelope(validReview);
    assert.equal(result.ok, true);
  });

  it("rejects when findings is not an array", () => {
    const result = validateReviewEnvelope({ ...validReview, findings: "not-array" });
    assert.equal(result.ok, false);
  });
});

describe("stripMarkdownFence", () => {
  it("strips ```json ... ```", () => {
    const input = "```json\n{\"status\":\"success\"}\n```";
    assert.equal(stripMarkdownFence(input), '{"status":"success"}');
  });

  it("strips ``` ... ``` without language", () => {
    const input = "```\n{\"status\":\"success\"}\n```";
    assert.equal(stripMarkdownFence(input), '{"status":"success"}');
  });

  it("returns plain JSON unchanged", () => {
    const input = '{"status":"success"}';
    assert.equal(stripMarkdownFence(input), '{"status":"success"}');
  });

  it("handles leading/trailing whitespace", () => {
    const input = "  \n  ```json\n{\"status\":\"success\"}\n```\n  ";
    assert.equal(stripMarkdownFence(input), '{"status":"success"}');
  });
});
