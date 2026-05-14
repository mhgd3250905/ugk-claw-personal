import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	getSubmitToolsForRole,
	mapSubmitToolToStream,
} from "../src/team/team-submit-tools.js";

describe("team submit tool specs", () => {
	it("discovery only exposes submitCandidateDomain", () => {
		const tools = getSubmitToolsForRole("discovery");
		assert.deepEqual(tools.map((tool) => tool.name), ["submitCandidateDomain"]);
		assert.equal(tools[0].streamName, "candidate_domains");
	});

	it("reviewer only exposes submitReviewFinding", () => {
		const tools = getSubmitToolsForRole("reviewer");
		assert.deepEqual(tools.map((tool) => tool.name), ["submitReviewFinding"]);
		assert.equal(tools[0].streamName, "review_findings");
	});

	it("finalizer exposes no submit tools", () => {
		assert.deepEqual(getSubmitToolsForRole("finalizer"), []);
	});

	it("maps discovery submitCandidateDomain to candidate_domains", () => {
		const args = { domain: "med-example.com" };
		const result = mapSubmitToolToStream({
			roleId: "discovery",
			toolName: "submitCandidateDomain",
			arguments: args,
		});

		assert.equal(result.ok, true);
		if (result.ok) {
			assert.equal(result.streamName, "candidate_domains");
			assert.equal(result.payload, args);
		}
	});

	it("declares provider tool schemas with required payload fields", () => {
		const evidenceTool = getSubmitToolsForRole("evidence_collector")[0];
		const classifierTool = getSubmitToolsForRole("classifier")[0];
		const reviewerTool = getSubmitToolsForRole("reviewer")[0];

		assert.deepEqual(evidenceTool.inputSchema.required, ["domain", "pageSignals", "evidence", "limitations", "collectedAt"]);
		assert.deepEqual(classifierTool.inputSchema.required, ["domain", "category", "confidence", "reasons", "supportingEvidenceRefs", "recommendedAction", "classifiedAt"]);
		assert.deepEqual(reviewerTool.inputSchema.required, ["verdict", "issueType", "message", "createdAt"]);
	});

	it("rejects discovery calling submitReviewFinding", () => {
		const result = mapSubmitToolToStream({
			roleId: "discovery",
			toolName: "submitReviewFinding",
			arguments: {},
		});

		assert.equal(result.ok, false);
		if (!result.ok) assert.ok(result.errors.some((error) => error.includes("not allowed")));
	});

	it("rejects reviewer calling submitCandidateDomain", () => {
		const result = mapSubmitToolToStream({
			roleId: "reviewer",
			toolName: "submitCandidateDomain",
			arguments: {},
		});

		assert.equal(result.ok, false);
		if (!result.ok) assert.ok(result.errors.some((error) => error.includes("not allowed")));
	});
});
