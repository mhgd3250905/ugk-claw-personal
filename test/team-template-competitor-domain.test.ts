import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { competitorDomainDiscoveryTemplate } from "../src/team/templates/competitor-domain-discovery.js";
import { TeamWorkspace } from "../src/team/team-workspace.js";

describe("competitorDomainDiscoveryTemplate", () => {
	it("declares a separate competitor domain discovery template contract", () => {
		assert.equal(competitorDomainDiscoveryTemplate.templateId, "competitor_domain_discovery");
		assert.deepEqual(competitorDomainDiscoveryTemplate.streamNames, [
			"candidate_domains",
			"domain_evidence",
			"domain_classifications",
			"review_findings",
		]);
		assert.ok(competitorDomainDiscoveryTemplate.roles.some((role) => role.name.includes("Competitor")));
	});

	it("creates competitor-specific discovery queries from competitor names", () => {
		const { plan, state } = competitorDomainDiscoveryTemplate.createRun({
			keyword: "Medtrum",
			companyNames: ["Dexcom", "Abbott"],
			maxRounds: 1,
		});

		assert.equal(plan.templateId, "competitor_domain_discovery");
		assert.equal(state.templateId, "competitor_domain_discovery");
		assert.equal(state.goal, "Discover and classify competitor-related domains for Medtrum");
		assert.ok(plan.discoveryPlan.searchQueries.includes("\"Dexcom\" official domain"));
		assert.ok(plan.discoveryPlan.searchQueries.includes("\"Abbott\" customer portal"));
	});

	it("writes a competitor-specific report artifact", async () => {
		const dir = join(tmpdir(), `team-template-competitor-finalize-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		try {
			const workspace = new TeamWorkspace({ teamDataDir: dir });
			const { plan, state } = competitorDomainDiscoveryTemplate.createRun({ keyword: "Medtrum", maxRounds: 1 });
			await workspace.createRun({ teamRunId: state.teamRunId, plan, state });

			await competitorDomainDiscoveryTemplate.finalize({
				teamRunId: state.teamRunId,
				state,
				plan,
				streams: {},
				workspace,
			});

			const report = await workspace.readArtifactText(state.teamRunId, "competitor_domain_report.md");
			assert.match(report, /Medtrum Competitor Domain Discovery Report/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
