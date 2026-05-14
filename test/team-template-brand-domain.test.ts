import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { brandDomainDiscoveryTemplate } from "../src/team/templates/brand-domain-discovery.js";
import { TeamWorkspace } from "../src/team/team-workspace.js";
import type { TeamStreamItem } from "../src/team/types.js";

function emptyStreams(): Record<string, TeamStreamItem[]> {
	return {
		candidate_domains: [],
		domain_evidence: [],
		domain_classifications: [],
		review_findings: [],
	};
}

describe("brandDomainDiscoveryTemplate", () => {
	it("declares the brand domain discovery template contract", () => {
		assert.equal(brandDomainDiscoveryTemplate.templateId, "brand_domain_discovery");
		assert.deepEqual(brandDomainDiscoveryTemplate.streamNames, [
			"candidate_domains",
			"domain_evidence",
			"domain_classifications",
			"review_findings",
		]);
		assert.ok(brandDomainDiscoveryTemplate.roles.some((role) => role.roleId === "discovery"));
		const discoveryRole = brandDomainDiscoveryTemplate.roles.find((role) => role.roleId === "discovery");
		assert.match(discoveryRole?.responsibility ?? "", /professional domain discovery investigator/);
		assert.match(discoveryRole?.responsibility ?? "", /crt\.sh/);
		assert.equal(typeof brandDomainDiscoveryTemplate.createRun, "function");
	});

	it("creates a brand domain discovery run from input", () => {
		const { plan, state } = brandDomainDiscoveryTemplate.createRun({
			keyword: "Medtrum",
			companyNames: ["上海移宇科技"],
			maxRounds: 1,
		});

		assert.equal(plan.templateId, "brand_domain_discovery");
		assert.equal(state.templateId, "brand_domain_discovery");
		assert.equal(state.keyword, "Medtrum");
		assert.equal(state.budgets.maxRounds, 1);
		assert.ok(plan.discoveryPlan.searchQueries.includes("Medtrum official domain"));
		assert.ok(plan.discoveryPlan.searchQueries.includes("\"上海移宇科技\" Medtrum domain"));
	});

	it("persists role profile bindings for later agent-profile execution", () => {
		const { state } = brandDomainDiscoveryTemplate.createRun({
			keyword: "Medtrum",
			roleProfileIds: {
				discovery: "TeamAgent",
				evidence_collector: "EvidenceAgent",
				classifier: "",
			},
		});

		assert.deepEqual(state.roleProfileIds, {
			discovery: "TeamAgent",
			evidence_collector: "EvidenceAgent",
		});
	});

	it("validates candidate domain payloads through the template", () => {
		const validator = brandDomainDiscoveryTemplate.getStreamValidator("candidate_domains");
		assert.ok(validator);

		const result = validator({
			domain: "medtrum.com",
			sourceType: "search_query",
			matchReason: "official result",
			confidence: "high",
			discoveredAt: "2026-05-14T00:00:00.000Z",
		});

		assert.equal(result.ok, true);
		if (result.ok) {
			assert.equal((result.value as { normalizedDomain: string }).normalizedDomain, "medtrum.com");
		}
	});

	it("builds a discovery task when the run has discovery budget", () => {
		const { plan, state } = brandDomainDiscoveryTemplate.createRun({ keyword: "Medtrum", maxRounds: 1 });

		const tasks = brandDomainDiscoveryTemplate.getReadyRoleTasks({
			teamRunId: state.teamRunId,
			state,
			plan,
			streams: emptyStreams(),
			cursors: {},
		});

		assert.equal(tasks[0].roleId, "discovery");
		assert.equal(tasks[0].updates?.incrementCurrentRound, true);
		assert.deepEqual(tasks[0].task.inputData.queries, plan.discoveryPlan.searchQueries);
	});

	it("starts evidence collection as soon as at least one candidate exists", () => {
		const { plan, state } = brandDomainDiscoveryTemplate.createRun({ keyword: "Medtrum", maxRounds: 2 });
		state.currentRound = 1;
		state.counters.candidateDomains = 1;
		const streams = emptyStreams();
		streams.candidate_domains.push({
			itemId: "si_1",
			teamRunId: state.teamRunId,
			streamName: "candidate_domains",
			producerRoleId: "discovery",
			producerTaskId: "rt_1",
			payload: { domain: "medtrum.com", normalizedDomain: "medtrum.com" },
			createdAt: "2026-05-14T00:00:00.000Z",
		});

		const tasks = brandDomainDiscoveryTemplate.getReadyRoleTasks({
			teamRunId: state.teamRunId,
			state,
			plan,
			streams,
			cursors: {},
		});

		assert.equal(tasks.some((task) => task.roleId === "evidence_collector"), true);
	});

	it("creates one evidence task per candidate stream item", () => {
		const { plan, state } = brandDomainDiscoveryTemplate.createRun({ keyword: "Medtrum", maxRounds: 2 });
		state.currentRound = 1;
		state.counters.candidateDomains = 2;
		const streams = emptyStreams();
		streams.candidate_domains.push(
			{
				itemId: "si_1",
				teamRunId: state.teamRunId,
				streamName: "candidate_domains",
				producerRoleId: "discovery",
				producerTaskId: "rt_1",
				payload: { domain: "one.medtrum.com", normalizedDomain: "one.medtrum.com" },
				createdAt: "2026-05-14T00:00:00.000Z",
			},
			{
				itemId: "si_2",
				teamRunId: state.teamRunId,
				streamName: "candidate_domains",
				producerRoleId: "discovery",
				producerTaskId: "rt_1",
				payload: { domain: "two.medtrum.com", normalizedDomain: "two.medtrum.com" },
				createdAt: "2026-05-14T00:00:01.000Z",
			},
		);

		const tasks = brandDomainDiscoveryTemplate.getReadyRoleTasks({
			teamRunId: state.teamRunId,
			state,
			plan,
			streams,
			cursors: {},
		});

		const evidenceTask = tasks.find((task) => task.roleId === "evidence_collector");
		assert.equal(evidenceTask?.consumes?.items.length, 1);
		assert.deepEqual(evidenceTask?.task.inputData.candidates, [streams.candidate_domains[0].payload]);
	});

	it("starts classification as soon as at least one evidence item exists", () => {
		const { plan, state } = brandDomainDiscoveryTemplate.createRun({ keyword: "Medtrum", maxRounds: 2 });
		state.currentRound = 1;
		state.counters.candidateDomains = 1;
		state.counters.domainEvidence = 1;
		const streams = emptyStreams();
		streams.domain_evidence.push({
			itemId: "si_1",
			teamRunId: state.teamRunId,
			streamName: "domain_evidence",
			producerRoleId: "evidence_collector",
			producerTaskId: "rt_1",
			payload: {
				domain: "medtrum.com",
				normalizedDomain: "medtrum.com",
				checked: false,
				pageSignals: [],
				ownershipSignals: [],
				riskSignals: [],
				summary: "Initial evidence",
				collectedAt: "2026-05-14T00:00:00.000Z",
			},
			createdAt: "2026-05-14T00:00:00.000Z",
		});

		const tasks = brandDomainDiscoveryTemplate.getReadyRoleTasks({
			teamRunId: state.teamRunId,
			state,
			plan,
			streams,
			cursors: {},
		});

		assert.equal(tasks.some((task) => task.roleId === "classifier"), true);
	});

	it("creates one classifier and reviewer task per upstream item", () => {
		const { plan, state } = brandDomainDiscoveryTemplate.createRun({ keyword: "Medtrum", maxRounds: 2 });
		state.currentRound = 1;
		state.counters.domainEvidence = 2;
		state.counters.classifications = 2;
		const streams = emptyStreams();
		streams.domain_evidence.push(
			{
				itemId: "si_ev_1",
				teamRunId: state.teamRunId,
				streamName: "domain_evidence",
				producerRoleId: "evidence_collector",
				producerTaskId: "rt_1",
				payload: { domain: "one.medtrum.com" },
				createdAt: "2026-05-14T00:00:00.000Z",
			},
			{
				itemId: "si_ev_2",
				teamRunId: state.teamRunId,
				streamName: "domain_evidence",
				producerRoleId: "evidence_collector",
				producerTaskId: "rt_1",
				payload: { domain: "two.medtrum.com" },
				createdAt: "2026-05-14T00:00:01.000Z",
			},
		);
		streams.domain_classifications.push(
			{
				itemId: "si_cl_1",
				teamRunId: state.teamRunId,
				streamName: "domain_classifications",
				producerRoleId: "classifier",
				producerTaskId: "rt_2",
				payload: { domain: "one.medtrum.com", category: "unknown", reasons: [] },
				createdAt: "2026-05-14T00:00:02.000Z",
			},
			{
				itemId: "si_cl_2",
				teamRunId: state.teamRunId,
				streamName: "domain_classifications",
				producerRoleId: "classifier",
				producerTaskId: "rt_2",
				payload: { domain: "two.medtrum.com", category: "unknown", reasons: [] },
				createdAt: "2026-05-14T00:00:03.000Z",
			},
		);

		const tasks = brandDomainDiscoveryTemplate.getReadyRoleTasks({
			teamRunId: state.teamRunId,
			state,
			plan,
			streams,
			cursors: {},
		});

		const classifierTask = tasks.find((task) => task.roleId === "classifier");
		const reviewerTask = tasks.find((task) => task.roleId === "reviewer");
		assert.equal(classifierTask?.consumes?.items.length, 1);
		assert.deepEqual(classifierTask?.task.inputData.evidences, [streams.domain_evidence[0].payload]);
		assert.equal(reviewerTask?.consumes?.items.length, 1);
		assert.deepEqual(reviewerTask?.task.inputData.classifications, [streams.domain_classifications[0].payload]);
	});

	it("blocks when review findings need user input", () => {
		const { state } = brandDomainDiscoveryTemplate.createRun({ keyword: "Medtrum" });
		const streams = emptyStreams();
		streams.review_findings.push({
			itemId: "si_1",
			teamRunId: state.teamRunId,
			streamName: "review_findings",
			producerRoleId: "reviewer",
			producerTaskId: "rt_1",
			payload: {
				verdict: "needs_user_input",
				issueType: "missing_evidence",
				message: "Need official whitelist",
				createdAt: "2026-05-14T00:00:00.000Z",
			},
			createdAt: "2026-05-14T00:00:00.000Z",
		});

		assert.deepEqual(brandDomainDiscoveryTemplate.shouldBlock({ state, streams }), {
			blocked: true,
			reason: "Need official whitelist",
		});
	});

	it("writes final report artifacts through the template finalizer", async () => {
		const dir = join(tmpdir(), `team-template-finalize-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		try {
			const workspace = new TeamWorkspace({ teamDataDir: dir });
			const { plan, state } = brandDomainDiscoveryTemplate.createRun({ keyword: "Medtrum", maxRounds: 1 });
			await workspace.createRun({ teamRunId: state.teamRunId, plan, state });

			await brandDomainDiscoveryTemplate.finalize({
				teamRunId: state.teamRunId,
				state,
				plan,
				streams: emptyStreams(),
				workspace,
			});

			const report = await workspace.readArtifactText(state.teamRunId, "final_report.md");
			assert.match(report, /Medtrum 域名调查报告/);
			assert.match(report, /## 1\. 摘要/);
			assert.match(report, /## 5\. 局限性/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
