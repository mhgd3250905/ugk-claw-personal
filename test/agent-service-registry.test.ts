import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultAgentProfiles } from "../src/agent/agent-profile.js";
import { AgentServiceRegistry } from "../src/agent/agent-service-registry.js";

test("AgentServiceRegistry resolves and caches separate services per agent profile", () => {
	const profiles = createDefaultAgentProfiles("E:/AII/ugk-pi");
	const createdFor: string[] = [];
	const registry = new AgentServiceRegistry({
		profiles,
		createService: (profile) => {
			createdFor.push(profile.agentId);
			return { agentId: profile.agentId };
		},
	});

	const main = registry.get("main");
	const search = registry.get("search");

	assert.deepEqual(createdFor, ["main", "search"]);
	assert.equal(main?.agentId, "main");
	assert.equal(search?.agentId, "search");
	assert.notEqual(main, search);
	assert.equal(registry.get("search"), search);
	assert.deepEqual(createdFor, ["main", "search"]);
});

test("AgentServiceRegistry rejects malformed or unknown agent ids without falling back to main", () => {
	const registry = new AgentServiceRegistry({
		profiles: createDefaultAgentProfiles("E:/AII/ugk-pi"),
		createService: (profile) => ({ agentId: profile.agentId }),
	});

	assert.equal(registry.get("missing"), undefined);
	assert.equal(registry.get("../main"), undefined);
	assert.equal(registry.get(""), undefined);
});

test("AgentServiceRegistry lists public agent summaries", () => {
	const registry = new AgentServiceRegistry({
		profiles: createDefaultAgentProfiles("E:/AII/ugk-pi"),
		createService: (profile) => ({ agentId: profile.agentId }),
	});

	assert.deepEqual(registry.list(), [
		{
			agentId: "main",
			name: "主 Agent",
			description: "默认综合 agent，保持现有会话、技能和运行方式。",
		},
		{
			agentId: "search",
			name: "搜索 Agent",
			description: "用于搜索、查证和资料整理的独立 agent。",
		},
	]);
});
