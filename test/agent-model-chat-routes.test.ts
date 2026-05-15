import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildServer } from "../src/server.js";
import { AgentServiceRegistry } from "../src/agent/agent-service-registry.js";
import { createDefaultAgentProfiles } from "../src/agent/agent-profile.js";
import type { AgentService } from "../src/agent/agent-service.js";

import type { ModelConfigStore, ModelSelectionValidator } from "../src/agent/model-config.js";

const alwaysOkValidator: ModelSelectionValidator = async () => ({ ok: true });
const stubModelConfigStore: ModelConfigStore = {
	getConfig: async () => ({ current: { provider: "deepseek", model: "deepseek-v4-pro" }, providers: [] }),
	hasModel: async () => true,
	setDefault: async () => ({ current: { provider: "deepseek", model: "deepseek-v4-pro" }, providers: [] }),
};

function createScopedAgentService(agentId: string, running = false): AgentService {
	return {
		getAgentRunStatus: () =>
			running
				? { agentId, status: "busy", activeConversationId: `manual:${agentId}`, activeSince: new Date(0).toISOString() }
				: { agentId, status: "idle" },
		getAvailableSkills: async () => ({ skills: [], source: "fresh", cachedAt: new Date(0).toISOString() }),
		getConversationCatalog: async () => ({
			currentConversationId: `manual:${agentId}`,
			conversations: [
				{
					conversationId: `manual:${agentId}`,
					title: `${agentId} title`,
					preview: "",
					messageCount: 0,
					createdAt: new Date(0).toISOString(),
					updatedAt: new Date(0).toISOString(),
					running,
				},
			],
		}),
		createConversation: async () => ({ conversationId: `manual:${agentId}:new`, currentConversationId: `manual:${agentId}:new`, created: true }),
	} as unknown as AgentService;
}

function createTestRegistryForRoot(projectRoot: string, runningAgents = new Set<string>()): AgentServiceRegistry<AgentService> {
	return new AgentServiceRegistry({
		profiles: createDefaultAgentProfiles(projectRoot),
		createService: (profile) => createScopedAgentService(profile.agentId, runningAgents.has(profile.agentId)),
	});
}

test("POST /v1/agents creates agent with model fields", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-model-route-"));
	const app = await buildServer({
		agentService: createScopedAgentService("main"),
		agentServiceRegistry: createTestRegistryForRoot(projectRoot),
		agentProfileProjectRoot: projectRoot,
		modelSelectionValidator: alwaysOkValidator,
		modelConfigStore: stubModelConfigStore,
	});

	const created = await app.inject({
		method: "POST",
		url: "/v1/agents",
		payload: {
			agentId: "coder",
			name: "编码 Agent",
			description: "用于编码。",
			defaultModelProvider: "deepseek",
			defaultModelId: "deepseek-v4-pro",
		},
	});
	const listed = await app.inject({ method: "GET", url: "/v1/agents" });

	assert.equal(created.statusCode, 200);
	assert.equal(created.json().agent.defaultModelProvider, "deepseek");
	assert.equal(created.json().agent.defaultModelId, "deepseek-v4-pro");
	const coder = listed.json().agents.find((a: { agentId: string }) => a.agentId === "coder");
	assert.ok(coder);
	assert.equal(coder.defaultModelProvider, "deepseek");
	assert.equal(coder.defaultModelId, "deepseek-v4-pro");
});

test("POST /v1/agents rejects model-only without provider", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-model-route-"));
	const app = await buildServer({
		agentService: createScopedAgentService("main"),
		agentServiceRegistry: createTestRegistryForRoot(projectRoot),
		agentProfileProjectRoot: projectRoot,
		modelSelectionValidator: alwaysOkValidator,
		modelConfigStore: stubModelConfigStore,
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/agents",
		payload: {
			agentId: "coder",
			name: "编码 Agent",
			description: "用于编码。",
			defaultModelId: "deepseek-v4-pro",
		},
	});

	assert.equal(response.statusCode, 400);
	assert.match(response.json().error.message, /must be provided together/);
});

test("POST /v1/agents rejects provider-only without model", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-model-route-"));
	const app = await buildServer({
		agentService: createScopedAgentService("main"),
		agentServiceRegistry: createTestRegistryForRoot(projectRoot),
		agentProfileProjectRoot: projectRoot,
		modelSelectionValidator: alwaysOkValidator,
		modelConfigStore: stubModelConfigStore,
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/agents",
		payload: {
			agentId: "coder",
			name: "编码 Agent",
			description: "用于编码。",
			defaultModelProvider: "deepseek",
		},
	});

	assert.equal(response.statusCode, 400);
	assert.match(response.json().error.message, /must be provided together/);
});

test("PATCH /v1/agents/:agentId updates model fields", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-model-route-"));
	const app = await buildServer({
		agentService: createScopedAgentService("main"),
		agentServiceRegistry: createTestRegistryForRoot(projectRoot),
		agentProfileProjectRoot: projectRoot,
		modelSelectionValidator: alwaysOkValidator,
		modelConfigStore: stubModelConfigStore,
	});
	await app.inject({
		method: "POST",
		url: "/v1/agents",
		payload: { agentId: "research", name: "研究 Agent", description: "用于研究。" },
	});

	const updated = await app.inject({
		method: "PATCH",
		url: "/v1/agents/research",
		payload: {
			name: "研究 Agent",
			description: "用于研究。",
			defaultModelProvider: "zhipu-glm",
			defaultModelId: "glm-5.1",
		},
	});

	assert.equal(updated.statusCode, 200);
	assert.equal(updated.json().agent.defaultModelProvider, "zhipu-glm");
	assert.equal(updated.json().agent.defaultModelId, "glm-5.1");
});

test("PATCH /v1/agents/:agentId clears model fields with null", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-model-route-"));
	const app = await buildServer({
		agentService: createScopedAgentService("main"),
		agentServiceRegistry: createTestRegistryForRoot(projectRoot),
		agentProfileProjectRoot: projectRoot,
		modelSelectionValidator: alwaysOkValidator,
		modelConfigStore: stubModelConfigStore,
	});
	await app.inject({
		method: "POST",
		url: "/v1/agents",
		payload: {
			agentId: "research",
			name: "研究 Agent",
			description: "用于研究。",
			defaultModelProvider: "deepseek",
			defaultModelId: "deepseek-v4-pro",
		},
	});

	const cleared = await app.inject({
		method: "PATCH",
		url: "/v1/agents/research",
		payload: {
			name: "研究 Agent",
			description: "用于研究。",
			defaultModelProvider: null,
			defaultModelId: null,
		},
	});

	assert.equal(cleared.statusCode, 200);
	assert.equal(cleared.json().agent.defaultModelProvider, undefined);
	assert.equal(cleared.json().agent.defaultModelId, undefined);
});

test("PATCH /v1/agents/:agentId rejects model change when agent is running", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-model-route-"));
	const runningRegistry = createTestRegistryForRoot(projectRoot, new Set(["research"]));
	const app = await buildServer({
		agentService: createScopedAgentService("main"),
		agentServiceRegistry: runningRegistry,
		agentProfileProjectRoot: projectRoot,
		modelSelectionValidator: alwaysOkValidator,
		modelConfigStore: stubModelConfigStore,
	});
	await app.inject({
		method: "POST",
		url: "/v1/agents",
		payload: { agentId: "research", name: "研究 Agent", description: "用于研究。" },
	});
	// Touch the service so the registry considers it running
	await app.inject({ method: "GET", url: "/v1/agents/research/debug/skills" });

	const response = await app.inject({
		method: "PATCH",
		url: "/v1/agents/research",
		payload: {
			name: "研究 Agent",
			description: "用于研究。",
			defaultModelProvider: "zhipu-glm",
			defaultModelId: "glm-5.1",
		},
	});

	assert.equal(response.statusCode, 409);
	assert.match(response.json().error.message, /running/i);
});
