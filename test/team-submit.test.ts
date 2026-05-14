import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TeamWorkspace } from "../src/team/team-workspace.js";
import { brandDomainDiscoveryTemplate } from "../src/team/templates/brand-domain-discovery.js";
import { submitTeamStreamItem } from "../src/team/team-submit.js";
import type { CandidateDomainPayload, TeamRole, TeamStreamName } from "../src/team/types.js";

function makeDir(): string {
	return join(tmpdir(), `team-submit-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function makeCandidate(domain: string): CandidateDomainPayload {
	return {
		domain,
		normalizedDomain: domain.toLowerCase(),
		sourceType: "search_query",
		query: "MED official domain",
		matchReason: "Domain contains MED",
		confidence: "medium",
		discoveredAt: "2026-05-14T00:00:00.000Z",
	};
}

async function createRun(workspace: TeamWorkspace): Promise<string> {
	const { plan, state } = brandDomainDiscoveryTemplate.createRun({
		keyword: "MED",
		maxRounds: 1,
		maxCandidates: 10,
		maxMinutes: 60,
	});
	await workspace.createRun({ teamRunId: state.teamRunId, plan, state });
	return state.teamRunId;
}

async function submit(input: {
	workspace: TeamWorkspace;
	teamRunId: string;
	roleId?: TeamRole["roleId"];
	streamName?: TeamStreamName;
	payload?: unknown;
	seenCandidateDomains?: Set<string>;
}) {
	return submitTeamStreamItem({
		workspace: input.workspace,
		template: brandDomainDiscoveryTemplate,
		teamRunId: input.teamRunId,
		roleId: input.roleId ?? "discovery",
		producerTaskId: "rt_test",
		streamName: input.streamName ?? "candidate_domains",
		payload: input.payload ?? makeCandidate("med-example.com"),
		seenCandidateDomains: input.seenCandidateDomains,
	});
}

describe("submitTeamStreamItem", () => {
	let dir: string;
	let workspace: TeamWorkspace;
	let teamRunId: string;

	beforeEach(async () => {
		dir = makeDir();
		mkdirSync(dir, { recursive: true });
		workspace = new TeamWorkspace({ teamDataDir: dir });
		teamRunId = await createRun(workspace);
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("accepts discovery candidate_domains and appends the stream item", async () => {
		const result = await submit({ workspace, teamRunId });

		assert.equal(result.status, "accepted");
		if (result.status === "accepted") {
			assert.equal(result.item.streamName, "candidate_domains");
			assert.equal(result.item.producerRoleId, "discovery");
			assert.equal((result.item.payload as CandidateDomainPayload).normalizedDomain, "med-example.com");
		}

		const items = await workspace.readStreamItems(teamRunId, "candidate_domains");
		assert.equal(items.length, 1);
		assert.equal(items[0].itemId, result.status === "accepted" ? result.item.itemId : "");
	});

	it("rejects reviewer writing candidate_domains", async () => {
		const result = await submit({ workspace, teamRunId, roleId: "reviewer" });

		assert.equal(result.status, "rejected");
		if (result.status === "rejected") {
			assert.equal(result.reason, "role not allowed");
		}
		assert.deepEqual(await workspace.readStreamItems(teamRunId, "candidate_domains"), []);
	});

	it("rejects discovery writing review_findings", async () => {
		const result = await submit({
			workspace,
			teamRunId,
			roleId: "discovery",
			streamName: "review_findings",
			payload: {
				verdict: "pass",
				issueType: "coverage_limitation",
				message: "Looks cautious",
				createdAt: "2026-05-14T00:00:00.000Z",
			},
		});

		assert.equal(result.status, "rejected");
		if (result.status === "rejected") {
			assert.equal(result.reason, "role not allowed");
		}
		assert.deepEqual(await workspace.readStreamItems(teamRunId, "review_findings"), []);
	});

	it("rejects invalid payload without appending it", async () => {
		const result = await submit({
			workspace,
			teamRunId,
			payload: { domain: "not a domain", sourceType: "search_query" },
		});

		assert.equal(result.status, "rejected");
		if (result.status === "rejected") {
			assert.equal(result.reason, "invalid payload");
			assert.ok(result.errors.length > 0);
		}
		assert.deepEqual(await workspace.readStreamItems(teamRunId, "candidate_domains"), []);
	});

	it("skips duplicate candidate from existing stream", async () => {
		await submit({ workspace, teamRunId, payload: makeCandidate("med-example.com") });

		const seenCandidateDomains = new Set<string>();
		for (const item of await workspace.readStreamItems<CandidateDomainPayload>(teamRunId, "candidate_domains")) {
			seenCandidateDomains.add(item.payload.normalizedDomain);
		}

		const result = await submit({
			workspace,
			teamRunId,
			payload: makeCandidate("https://MED-EXAMPLE.com/path"),
			seenCandidateDomains,
		});

		assert.equal(result.status, "duplicate_skipped");
		if (result.status === "duplicate_skipped") {
			assert.equal(result.normalizedDomain, "med-example.com");
		}
		assert.equal((await workspace.readStreamItems(teamRunId, "candidate_domains")).length, 1);
	});

	it("skips duplicate candidate inside the same seenCandidateDomains batch", async () => {
		const seenCandidateDomains = new Set<string>();
		const first = await submit({
			workspace,
			teamRunId,
			payload: makeCandidate("med-example.com"),
			seenCandidateDomains,
		});
		const second = await submit({
			workspace,
			teamRunId,
			payload: makeCandidate("MED-EXAMPLE.com"),
			seenCandidateDomains,
		});

		assert.equal(first.status, "accepted");
		assert.equal(second.status, "duplicate_skipped");
		assert.equal((await workspace.readStreamItems(teamRunId, "candidate_domains")).length, 1);
	});

	it("does not mutate seenCandidateDomains for rejected candidates", async () => {
		const seenCandidateDomains = new Set<string>();
		const result = await submit({
			workspace,
			teamRunId,
			payload: { domain: "not a domain", sourceType: "search_query" },
			seenCandidateDomains,
		});

		assert.equal(result.status, "rejected");
		assert.equal(seenCandidateDomains.size, 0);
	});
});
