import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentSessionLike, RawAgentSessionEventLike } from "../src/agent/agent-session-factory.js";
import type { BackgroundAgentSessionFactory } from "../src/agent/background-agent-runner.js";
import type { ResolvedBackgroundAgentSnapshot } from "../src/agent/background-agent-profile.js";
import { AgentProfileTeamRoleTaskRunner } from "../src/team/agent-profile-team-role-task-runner.js";

process.env.UGK_BROWSER_SCOPE_ROUTE_CACHE_PATH = join(
	tmpdir(),
	`ugk-pi-team-agent-profile-browser-routes-${process.pid}.json`,
);

class FakeSession implements AgentSessionLike {
	messages: Array<{ role: string; content?: unknown }> = [];

	constructor(private readonly response: string) {}

	subscribe(_listener: (event: RawAgentSessionEventLike) => void): () => void {
		return () => undefined;
	}

	async prompt(message: string): Promise<void> {
		this.messages.push({ role: "user", content: message });
		this.messages.push({ role: "assistant", content: this.response });
	}
}

class RecordingSessionFactory implements BackgroundAgentSessionFactory {
	inputs: unknown[] = [];

	constructor(private readonly session: AgentSessionLike) {}

	async createSession(input: unknown): Promise<AgentSessionLike> {
		this.inputs.push(input);
		return this.session;
	}
}

test("AgentProfileTeamRoleTaskRunner uses profile snapshot model, skills, browser, and Team submit tool", async () => {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-team-agent-profile-"));
	const session = new FakeSession(JSON.stringify({
		status: "success",
		emits: [
			{
				streamName: "candidate_domains",
				payload: {
					domain: "medtrum.com",
					sourceType: "search_query",
					matchReason: "official result",
					confidence: "high",
					discoveredAt: "2026-05-14T00:00:00.000Z",
				},
			},
		],
		checkpoint: {},
	}));
	const factory = new RecordingSessionFactory(session);
	const snapshot: ResolvedBackgroundAgentSnapshot = {
		requestedAgentId: "TeamAgent",
		agentId: "TeamAgent",
		agentName: "Team Agent",
		defaultBrowserId: "chrome-team",
		profileId: "TeamAgent",
		profileVersion: "2026-05-14",
		agentSpecId: "agent.default",
		agentSpecVersion: "1",
		skillSetId: "skills.default",
		skillSetVersion: "1",
		skills: [{ id: "web-access", name: "web-access", path: join(root, "web-access", "SKILL.md"), version: "1" }],
		modelPolicyId: "model.default",
		modelPolicyVersion: "1",
		provider: "deepseek",
		model: "deepseek-v4-flash",
		upgradePolicy: "latest",
		resolvedAt: "2026-05-14T00:00:00.000Z",
	};
	const runner = new AgentProfileTeamRoleTaskRunner({
		projectRoot: root,
		teamDataDir: join(root, ".data", "team"),
		sessionFactory: factory,
		defaultBrowserId: "chrome-default",
		profileResolver: {
			async resolve(ref) {
				assert.equal(ref.profileId, "TeamAgent");
				return snapshot;
			},
		},
		closeBrowserTargetsForScope: async () => undefined,
	});

	const result = await runner.runTaskWithSubmitToolHandler({
		roleTaskId: "role_task_1",
		roleId: "discovery",
		teamRunId: "teamrun_1",
		profileId: "TeamAgent",
		inputData: {
			keyword: "Medtrum",
			queries: ["Medtrum official domain"],
		},
	}, async () => ({ ok: true, message: "accepted", streamName: "candidate_domains" }));

	assert.equal(result.status, "success");
	assert.equal(result.emits.length, 1);
	assert.equal(factory.inputs.length, 1);
	const input = factory.inputs[0] as {
		snapshot: ResolvedBackgroundAgentSnapshot;
		browserId?: string;
		customTools?: Array<{ name: string }>;
	};
	assert.equal(input.snapshot.provider, "deepseek");
	assert.equal(input.snapshot.model, "deepseek-v4-flash");
	assert.equal(input.browserId, "chrome-team");
	assert.deepEqual(input.customTools?.map((tool) => tool.name), ["submitCandidateDomain"]);
	assert.match(String(session.messages[0]?.content), /Use your configured Agent profile abilities freely/);
	assert.match(String(session.messages[0]?.content), /choose the closest label for how you found the domain/);
	assert.match(String(session.messages[0]?.content), /professional domain discovery investigator/);
	assert.match(String(session.messages[0]?.content), /crt\.sh/);
	assert.match(String(session.messages[0]?.content), /certificate transparency/);
});

test("AgentProfileTeamRoleTaskRunner exposes role submit tools for non-discovery roles", async () => {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-team-agent-profile-evidence-"));
	const session = new FakeSession(JSON.stringify({
		status: "success",
		emits: [
			{
				streamName: "domain_evidence",
				payload: {
					domain: "medtrum.com",
					http: { checked: false },
					dns: { checked: false },
					certificate: { checked: false },
					pageSignals: {
						mentionsKeyword: true,
						mentionsCompanyName: false,
						linksToOfficialDomain: false,
						usesBrandLikeText: true,
						notes: [],
					},
					evidence: [{
						claim: "Domain contains medtrum",
						source: "domain name analysis",
						observation: "medtrum.com contains the keyword",
						confidence: "high",
					}],
					limitations: [],
					collectedAt: "2026-05-14T00:00:00.000Z",
				},
			},
		],
		checkpoint: {},
	}));
	const factory = new RecordingSessionFactory(session);
	const snapshot: ResolvedBackgroundAgentSnapshot = {
		requestedAgentId: "EvidenceAgent",
		agentId: "EvidenceAgent",
		agentName: "Evidence Agent",
		defaultBrowserId: "chrome-evidence",
		profileId: "EvidenceAgent",
		profileVersion: "2026-05-14",
		agentSpecId: "agent.default",
		agentSpecVersion: "1",
		skillSetId: "skills.default",
		skillSetVersion: "1",
		skills: [],
		modelPolicyId: "model.default",
		modelPolicyVersion: "1",
		provider: "deepseek",
		model: "deepseek-v4-flash",
		upgradePolicy: "latest",
		resolvedAt: "2026-05-14T00:00:00.000Z",
	};
	const runner = new AgentProfileTeamRoleTaskRunner({
		projectRoot: root,
		teamDataDir: join(root, ".data", "team"),
		sessionFactory: factory,
		profileResolver: { async resolve() { return snapshot; } },
		closeBrowserTargetsForScope: async () => undefined,
	});

	const result = await runner.runTaskWithSubmitToolHandler({
		roleTaskId: "role_task_2",
		roleId: "evidence_collector",
		teamRunId: "teamrun_1",
		profileId: "EvidenceAgent",
		inputData: {
			keyword: "Medtrum",
			candidates: [{ domain: "medtrum.com", normalizedDomain: "medtrum.com", sourceType: "manual_seed" }],
		},
	}, async () => ({ ok: true, message: "accepted", streamName: "domain_evidence" }));

	assert.equal(result.status, "success");
	assert.equal(result.emits[0]?.streamName, "domain_evidence");
	const input = factory.inputs[0] as { browserId?: string; customTools?: Array<{ name: string }> };
	assert.equal(input.browserId, "chrome-evidence");
	assert.deepEqual(input.customTools?.map((tool) => tool.name), ["submitDomainEvidence"]);
	assert.match(String(session.messages[0]?.content), /Evidence Collector/);
	assert.match(String(session.messages[0]?.content), /submitDomainEvidence/);
});

test("AgentProfileTeamRoleTaskRunner includes editable role prompt override while preserving the default contract", async () => {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-team-agent-profile-prompt-"));
	const session = new FakeSession(JSON.stringify({
		status: "success",
		emits: [],
		checkpoint: {},
	}));
	const factory = new RecordingSessionFactory(session);
	const snapshot: ResolvedBackgroundAgentSnapshot = {
		requestedAgentId: "DiscoveryAgent",
		agentId: "DiscoveryAgent",
		agentName: "Discovery Agent",
		profileId: "DiscoveryAgent",
		profileVersion: "2026-05-14",
		agentSpecId: "agent.default",
		agentSpecVersion: "1",
		skillSetId: "skills.default",
		skillSetVersion: "1",
		skills: [],
		modelPolicyId: "model.default",
		modelPolicyVersion: "1",
		provider: "deepseek",
		model: "deepseek-v4-flash",
		upgradePolicy: "latest",
		resolvedAt: "2026-05-14T00:00:00.000Z",
	};
	const runner = new AgentProfileTeamRoleTaskRunner({
		projectRoot: root,
		teamDataDir: join(root, ".data", "team"),
		sessionFactory: factory,
		profileResolver: { async resolve() { return snapshot; } },
		closeBrowserTargetsForScope: async () => undefined,
	});

	await runner.runTask({
		roleTaskId: "role_task_prompt",
		roleId: "discovery",
		teamRunId: "teamrun_1",
		profileId: "DiscoveryAgent",
		inputData: {
			keyword: "Medtrum",
			queries: ["Medtrum official domain"],
			rolePromptOverride: "优先使用浏览器搜索、官网线索和第三方目录交叉找候选域名。",
		},
	});

	const prompt = String(session.messages[0]?.content);
	assert.match(prompt, /USER EDITED ROLE PROMPT OVERRIDE/);
	assert.match(prompt, /优先使用浏览器搜索、官网线索和第三方目录交叉找候选域名/);
	assert.match(prompt, /DEFAULT TEAM ROLE CONTRACT/);
	assert.match(prompt, /submitCandidateDomain/);
});

test("AgentProfileTeamRoleTaskRunner returns finalizer markdown as final report", async () => {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-team-agent-profile-finalizer-"));
	const session = new FakeSession("# 中文报告\n\n## 摘要\n- 已完成。");
	const factory = new RecordingSessionFactory(session);
	const snapshot: ResolvedBackgroundAgentSnapshot = {
		requestedAgentId: "ReportAgent",
		agentId: "ReportAgent",
		agentName: "Report Agent",
		profileId: "ReportAgent",
		profileVersion: "2026-05-14",
		agentSpecId: "agent.default",
		agentSpecVersion: "1",
		skillSetId: "skills.default",
		skillSetVersion: "1",
		skills: [],
		modelPolicyId: "model.default",
		modelPolicyVersion: "1",
		provider: "deepseek",
		model: "deepseek-v4-flash",
		upgradePolicy: "latest",
		resolvedAt: "2026-05-14T00:00:00.000Z",
	};
	const runner = new AgentProfileTeamRoleTaskRunner({
		projectRoot: root,
		teamDataDir: join(root, ".data", "team"),
		sessionFactory: factory,
		profileResolver: { async resolve() { return snapshot; } },
		closeBrowserTargetsForScope: async () => undefined,
	});

	const result = await runner.runTask({
		roleTaskId: "role_task_3",
		roleId: "finalizer",
		teamRunId: "teamrun_1",
		profileId: "ReportAgent",
		inputData: {
			keyword: "Medtrum",
			goal: "Discover domains",
			streams: {},
			streamCounts: {},
		},
	});

	assert.equal(result.status, "success");
	assert.equal(result.finalReportMarkdown, "# 中文报告\n\n## 摘要\n- 已完成。");
	const input = factory.inputs[0] as { customTools?: Array<{ name: string }> };
	assert.deepEqual(input.customTools, []);
	assert.match(String(session.messages[0]?.content), /Return only the Markdown report body/);
});
