import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRoleBox } from "../src/team/role-box.js";
import { brandDomainDiscoveryTemplate } from "../src/team/templates/brand-domain-discovery.js";
import type { TeamRole, TeamRoleTaskExecutionInput } from "../src/team/types.js";

function getRole(roleId: TeamRole["roleId"]): TeamRole {
	const role = brandDomainDiscoveryTemplate.roles.find((item) => item.roleId === roleId);
	assert.ok(role);
	return role;
}

function makeTask(roleId: TeamRole["roleId"]): TeamRoleTaskExecutionInput {
	return {
		roleTaskId: `rt_${roleId}`,
		roleId,
		teamRunId: "team_run_test",
		inputData: {},
	};
}

describe("buildRoleBox", () => {
	it("builds the discovery role boundary", () => {
		const box = buildRoleBox({
			role: getRole("discovery"),
			task: makeTask("discovery"),
			prompt: "DISCOVERY PROMPT",
		});

		assert.equal(box.roleId, "discovery");
		assert.deepEqual(box.allowedInputStreams, []);
		assert.deepEqual(box.outputStreams, ["candidate_domains"]);
		assert.deepEqual(box.submitTools.map((tool) => tool.name), ["submitCandidateDomain"]);
		assert.equal(box.outputMode, "json_envelope");
		assert.equal(box.expectedEnvelope.required, true);
		assert.equal(box.expectedEnvelope.naturalLanguageCountsAsResult, false);
		assert.equal(box.expectedEnvelope.checkpointRequired, true);
		assert.ok(box.prompt.includes("DISCOVERY PROMPT"));
		assert.ok(box.prompt.includes("Natural language does not count as a result"));
		assert.ok(box.mustNotDo.some((rule) => rule.includes("classify")));
	});

	it("builds the reviewer role boundary", () => {
		const box = buildRoleBox({
			role: getRole("reviewer"),
			task: makeTask("reviewer"),
			prompt: "REVIEWER PROMPT",
		});

		assert.equal(box.roleId, "reviewer");
		assert.deepEqual(box.allowedInputStreams, ["domain_classifications"]);
		assert.deepEqual(box.outputStreams, ["review_findings"]);
		assert.deepEqual(box.submitTools.map((tool) => tool.name), ["submitReviewFinding"]);
		assert.ok(box.mustNotDo.some((rule) => rule.includes("new facts")));
		assert.ok(box.mustNotDo.some((rule) => rule.includes("streams other than review_findings")));
	});

	it("builds the finalizer boundary without submit tools", () => {
		const box = buildRoleBox({
			role: getRole("finalizer"),
			task: makeTask("finalizer"),
			prompt: "FINALIZER PROMPT",
		});

		assert.equal(box.roleId, "finalizer");
		assert.deepEqual(box.outputStreams, []);
		assert.deepEqual(box.submitTools, []);
		assert.ok(box.mustNotDo.some((rule) => rule.includes("introduce new facts")));
		assert.equal(box.outputMode, "json_envelope");
	});
});
