import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	normalizeDomain,
	canRoleWriteStream,
	validateCandidateDomainPayload,
	validateDomainEvidencePayload,
	validateDomainClassificationPayload,
	validateReviewFindingPayload,
} from "../src/team/team-gate.js";

describe("TeamGate — normalizeDomain", () => {
	it("normalizes https://Med.Example.com/path to med.example.com", () => {
		assert.equal(normalizeDomain("https://Med.Example.com/path"), "med.example.com");
	});

	it("rejects domains without dot", () => {
		assert.equal(normalizeDomain("localhost"), undefined);
	});

	it("rejects empty string", () => {
		assert.equal(normalizeDomain(""), undefined);
	});

	it("rejects domains with spaces", () => {
		assert.equal(normalizeDomain("med example.com"), undefined);
	});

	it("rejects domains with underscores", () => {
		assert.equal(normalizeDomain("med_example.com"), undefined);
	});

	it("strips trailing dot", () => {
		assert.equal(normalizeDomain("med.example.com."), "med.example.com");
	});

	it("strips query and hash", () => {
		assert.equal(normalizeDomain("med.example.com/page?q=1#top"), "med.example.com");
	});
});

describe("TeamGate — canRoleWriteStream", () => {
	it("discovery can write candidate_domains", () => {
		assert.equal(canRoleWriteStream("discovery", "candidate_domains"), true);
	});

	it("discovery cannot write domain_evidence", () => {
		assert.equal(canRoleWriteStream("discovery", "domain_evidence"), false);
	});

	it("evidence_collector can write domain_evidence", () => {
		assert.equal(canRoleWriteStream("evidence_collector", "domain_evidence"), true);
	});

	it("classifier can write domain_classifications", () => {
		assert.equal(canRoleWriteStream("classifier", "domain_classifications"), true);
	});

	it("reviewer can write review_findings", () => {
		assert.equal(canRoleWriteStream("reviewer", "review_findings"), true);
	});

	it("reviewer cannot write candidate_domains", () => {
		assert.equal(canRoleWriteStream("reviewer", "candidate_domains"), false);
	});

	it("finalizer cannot write any stream", () => {
		assert.equal(canRoleWriteStream("finalizer", "candidate_domains"), false);
		assert.equal(canRoleWriteStream("finalizer", "domain_evidence"), false);
		assert.equal(canRoleWriteStream("finalizer", "domain_classifications"), false);
		assert.equal(canRoleWriteStream("finalizer", "review_findings"), false);
	});
});

describe("TeamGate — validateCandidateDomainPayload", () => {
	const validCandidate = {
		domain: "med-example.com",
		sourceType: "search_query",
		matchReason: "Domain contains MED",
		confidence: "medium",
		discoveredAt: "2026-05-14T00:00:00.000Z",
	};

	it("accepts a valid candidate", () => {
		const result = validateCandidateDomainPayload(validCandidate);
		assert.equal(result.ok, true);
		if (result.ok) {
			assert.equal(result.value.normalizedDomain, "med-example.com");
		}
	});

	it("rejects missing sourceType", () => {
		const { sourceType, ...withoutSourceType } = validCandidate;
		const result = validateCandidateDomainPayload(withoutSourceType);
		assert.equal(result.ok, false);
		if (!result.ok) assert.ok(result.errors.some((e) => e.includes("sourceType")));
	});

	it("rejects missing matchReason", () => {
		const { matchReason, ...without } = validCandidate;
		const result = validateCandidateDomainPayload(without);
		assert.equal(result.ok, false);
		if (!result.ok) assert.ok(result.errors.some((e) => e.includes("matchReason")));
	});

	it("rejects invalid domain", () => {
		const result = validateCandidateDomainPayload({ ...validCandidate, domain: "not a domain" });
		assert.equal(result.ok, false);
	});

	it("rejects null payload", () => {
		const result = validateCandidateDomainPayload(null);
		assert.equal(result.ok, false);
	});
});

describe("TeamGate — validateDomainEvidencePayload", () => {
	const validEvidence = {
		domain: "med-example.com",
		pageSignals: { mentionsKeyword: true, mentionsCompanyName: false, linksToOfficialDomain: false, usesBrandLikeText: false, notes: [] },
		evidence: [{ claim: "test", source: "http://example.com", observation: "obs", confidence: "medium" }],
		limitations: [],
		collectedAt: "2026-05-14T00:00:00.000Z",
	};

	it("accepts valid evidence", () => {
		const result = validateDomainEvidencePayload(validEvidence);
		assert.equal(result.ok, true);
	});

	it("rejects missing pageSignals", () => {
		const { pageSignals, ...without } = validEvidence;
		const result = validateDomainEvidencePayload(without);
		assert.equal(result.ok, false);
	});
});

describe("TeamGate — validateDomainClassificationPayload", () => {
	const validClassification = {
		domain: "med-example.com",
		category: "unknown",
		confidence: "low",
		reasons: ["No official ownership signal"],
		supportingEvidenceRefs: ["domain_evidence:med-example.com"],
		recommendedAction: "manual_review",
		classifiedAt: "2026-05-14T00:00:00.000Z",
	};

	it("accepts valid classification", () => {
		const result = validateDomainClassificationPayload(validClassification);
		assert.equal(result.ok, true);
	});

	it("rejects invalid category", () => {
		const result = validateDomainClassificationPayload({ ...validClassification, category: "invalid" });
		assert.equal(result.ok, false);
	});
});

describe("TeamGate — validateReviewFindingPayload", () => {
	const validFinding = {
		targetDomain: "med-example.com",
		verdict: "pass_with_warning",
		issueType: "coverage_limitation",
		message: "Appropriately cautious",
		recommendedChange: "Keep as unknown",
		createdAt: "2026-05-14T00:00:00.000Z",
	};

	it("accepts valid finding", () => {
		const result = validateReviewFindingPayload(validFinding);
		assert.equal(result.ok, true);
	});

	it("accepts finding without targetDomain", () => {
		const { targetDomain, ...without } = validFinding;
		const result = validateReviewFindingPayload(without);
		assert.equal(result.ok, true);
	});

	it("rejects invalid verdict", () => {
		const result = validateReviewFindingPayload({ ...validFinding, verdict: "maybe" });
		assert.equal(result.ok, false);
	});
});
