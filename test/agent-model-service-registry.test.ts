import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultAgentProfiles } from "../src/agent/agent-profile.js";
import { AgentServiceRegistry } from "../src/agent/agent-service-registry.js";

test("AgentServiceRegistry.updateProfile evicts cached service so next get creates a fresh one", () => {
	const profiles = createDefaultAgentProfiles("E:/AII/ugk-pi");
	const createdFor: string[] = [];
	const registry = new AgentServiceRegistry({
		profiles,
		createService: (profile) => {
			createdFor.push(profile.agentId);
			return { agentId: profile.agentId } as never;
		},
	});

	const firstService = registry.get("main");
	assert.ok(firstService);
	assert.deepEqual(createdFor, ["main"]);

	const updatedProfile = {
		...profiles.find((p) => p.agentId === "main")!,
		name: "主 Agent (已更新)",
		defaultModelProvider: "deepseek",
		defaultModelId: "deepseek-v4-pro",
	};
	registry.updateProfile(updatedProfile);

	const secondService = registry.get("main");
	assert.ok(secondService);
	assert.deepEqual(createdFor, ["main", "main"]);
	assert.notEqual(secondService, firstService);
});

test("AgentServiceRegistry.updateProfile preserves other cached services", () => {
	const profiles = createDefaultAgentProfiles("E:/AII/ugk-pi");
	const registry = new AgentServiceRegistry({
		profiles,
		createService: (profile) => ({ agentId: profile.agentId } as never),
	});

	const searchService = registry.get("search");
	const mainProfile = profiles.find((p) => p.agentId === "main")!;
	registry.updateProfile({ ...mainProfile, name: "Updated" });

	assert.equal(registry.get("search"), searchService);
});
