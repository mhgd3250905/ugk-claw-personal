import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildServer } from "../src/server.js";
import { AgentServiceRegistry } from "../src/agent/agent-service-registry.js";
import { createDefaultAgentProfiles } from "../src/agent/agent-profile.js";
import type { AgentService } from "../src/agent/agent-service.js";

function createScopedAgentService(agentId: string, running = false): AgentService {
	return {
		getAvailableSkills: async () => ({
			skills: [{ name: `${agentId}-skill` }],
			source: "fresh",
			cachedAt: new Date(0).toISOString(),
		}),
		getConversationCatalog: async () => ({
			currentConversationId: `manual:${agentId}`,
			conversations: [
				{
					conversationId: `manual:${agentId}`,
					title: `${agentId} title`,
					preview: `${agentId} preview`,
					messageCount: 0,
					createdAt: new Date(0).toISOString(),
					updatedAt: new Date(0).toISOString(),
					running,
				},
			],
		}),
		createConversation: async () => ({
			conversationId: `manual:${agentId}:new`,
			currentConversationId: `manual:${agentId}:new`,
			created: true,
		}),
	} as AgentService;
}

function createTestRegistry(): AgentServiceRegistry<AgentService> {
	return new AgentServiceRegistry({
		profiles: createDefaultAgentProfiles("E:/AII/ugk-pi"),
		createService: (profile) => createScopedAgentService(profile.agentId),
	});
}

function createTestRegistryForRoot(projectRoot: string, runningAgents = new Set<string>()): AgentServiceRegistry<AgentService> {
	return new AgentServiceRegistry({
		profiles: createDefaultAgentProfiles(projectRoot),
		createService: (profile) => createScopedAgentService(profile.agentId, runningAgents.has(profile.agentId)),
	});
}

test("agent-scoped debug skills use the requested agent service", async () => {
	const app = buildServer({
		agentService: createScopedAgentService("main"),
		agentServiceRegistry: createTestRegistry(),
	});

	const legacyResponse = await app.inject({
		method: "GET",
		url: "/v1/debug/skills",
	});
	const searchResponse = await app.inject({
		method: "GET",
		url: "/v1/agents/search/debug/skills",
	});

	assert.equal(legacyResponse.statusCode, 200);
	assert.equal(searchResponse.statusCode, 200);
	assert.deepEqual(legacyResponse.json().skills, [{ name: "main-skill" }]);
	assert.deepEqual(searchResponse.json().skills, [{ name: "search-skill" }]);
});

test("unknown agent-scoped routes do not fall back to main", async () => {
	const app = buildServer({
		agentService: createScopedAgentService("main"),
		agentServiceRegistry: createTestRegistry(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/agents/missing/debug/skills",
	});

	assert.equal(response.statusCode, 404);
	assert.match(response.json().message, /missing/);
});

test("agent-scoped conversations are served from the requested agent service", async () => {
	const app = buildServer({
		agentService: createScopedAgentService("main"),
		agentServiceRegistry: createTestRegistry(),
	});

	const searchCatalog = await app.inject({
		method: "GET",
		url: "/v1/agents/search/chat/conversations",
	});
	const created = await app.inject({
		method: "POST",
		url: "/v1/agents/search/chat/conversations",
	});

	assert.equal(searchCatalog.statusCode, 200);
	assert.equal(searchCatalog.json().currentConversationId, "manual:search");
	assert.equal(created.statusCode, 200);
	assert.equal(created.json().conversationId, "manual:search:new");
});

test("POST /v1/agents creates a persisted custom agent profile", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-route-"));
	const registry = createTestRegistryForRoot(projectRoot);
	const app = buildServer({
		agentService: createScopedAgentService("main"),
		agentServiceRegistry: registry,
		agentProfileProjectRoot: projectRoot,
	});

	const created = await app.inject({
		method: "POST",
		url: "/v1/agents",
		payload: {
			agentId: "research",
			name: "研究 Agent",
			description: "用于资料研究。",
		},
	});
	const listed = await app.inject({
		method: "GET",
		url: "/v1/agents",
	});

	assert.equal(created.statusCode, 200);
	assert.equal(created.json().agent.agentId, "research");
	assert.ok(listed.json().agents.some((agent: { agentId: string }) => agent.agentId === "research"));
});

test("POST /v1/agents/:agentId/archive rejects main and running agents", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-route-"));
	const runningRegistry = createTestRegistryForRoot(projectRoot, new Set(["search"]));
	const app = buildServer({
		agentService: createScopedAgentService("main"),
		agentServiceRegistry: runningRegistry,
		agentProfileProjectRoot: projectRoot,
	});

	const main = await app.inject({
		method: "POST",
		url: "/v1/agents/main/archive",
	});
	const search = await app.inject({
		method: "POST",
		url: "/v1/agents/search/archive",
	});

	assert.equal(main.statusCode, 400);
	assert.equal(search.statusCode, 409);
});
