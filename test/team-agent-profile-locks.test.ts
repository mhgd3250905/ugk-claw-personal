import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildServer } from "../src/server.js";
import type { AgentService } from "../src/agent/agent-service.js";
import { createAgentProfileFromSummary } from "../src/agent/agent-profile.js";
import { AgentServiceRegistry } from "../src/agent/agent-service-registry.js";
import { PlanStore } from "../src/team/plan-store.js";
import { RunWorkspace } from "../src/team/run-workspace.js";
import { TeamUnitStore } from "../src/team/team-unit-store.js";

function createAgentServiceStub() {
	return {
		getConversationCatalog: async () => ({ conversations: [] }),
	} as unknown as AgentService;
}

test("AgentProfile write routes reject profiles locked by an active Team run", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-agent-lock-"));
	const teamDir = join(root, ".data", "team");
	const previousRuntimeEnabled = process.env.TEAM_RUNTIME_ENABLED;
	const previousTeamDataDir = process.env.TEAM_DATA_DIR;
	process.env.TEAM_RUNTIME_ENABLED = "true";
	process.env.TEAM_DATA_DIR = teamDir;

	try {
		const profiles = [
			createAgentProfileFromSummary(root, { agentId: "main", name: "Main", description: "Main agent" }),
			createAgentProfileFromSummary(root, { agentId: "research", name: "Research", description: "Research agent" }),
		];
		const registry = new AgentServiceRegistry<AgentService>({
			profiles,
			createService: () => createAgentServiceStub(),
		});
		const unitStore = new TeamUnitStore(teamDir);
		const planStore = new PlanStore(teamDir);
		const workspace = new RunWorkspace(teamDir);
		const teamUnit = await unitStore.create({
			title: "Research team",
			description: "Locks research profile",
			watcherProfileId: "research",
			workerProfileId: "research",
			checkerProfileId: "research",
			finalizerProfileId: "research",
		});
		const plan = await planStore.create({
			title: "Research plan",
			defaultTeamUnitId: teamUnit.teamUnitId,
			goal: { text: "Do research" },
			tasks: [{ id: "t1", title: "Task 1", input: { text: "Work" }, acceptance: { rules: ["Done"] } }],
			outputContract: { text: "Report" },
		});
		await workspace.createRun(plan, teamUnit.teamUnitId);

		const app = await buildServer({
			agentServiceRegistry: registry,
			agentProfileProjectRoot: root,
			agentService: createAgentServiceStub(),
		});
		try {
			const res = await app.inject({
				method: "PATCH",
				url: "/v1/agents/research",
				payload: { name: "New name" },
			});
			assert.equal(res.statusCode, 409);
			assert.match(res.json().error.message, /locked by an active Team run/i);
		} finally {
			await app.close();
		}
	} finally {
		if (previousRuntimeEnabled === undefined) delete process.env.TEAM_RUNTIME_ENABLED;
		else process.env.TEAM_RUNTIME_ENABLED = previousRuntimeEnabled;
		if (previousTeamDataDir === undefined) delete process.env.TEAM_DATA_DIR;
		else process.env.TEAM_DATA_DIR = previousTeamDataDir;
		try { await rm(root, { recursive: true, force: true }); } catch { /* ok */ }
	}
});
