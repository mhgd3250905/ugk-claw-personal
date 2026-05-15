import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBrowserRegistryFromEnv } from "../src/browser/browser-registry.js";
import { buildServer } from "../src/server.js";
import type { BrowserBindingAuditEntry } from "../src/browser/browser-binding-audit-log.js";
import { AgentServiceRegistry } from "../src/agent/agent-service-registry.js";
import { createDefaultAgentProfiles } from "../src/agent/agent-profile.js";
import type { AgentService } from "../src/agent/agent-service.js";

function createScopedAgentService(agentId: string, running = false): AgentService {
	return {
		getAgentRunStatus: () =>
			running
				? {
						agentId,
						status: "busy",
						activeConversationId: `manual:${agentId}`,
						activeSince: new Date(0).toISOString(),
					}
				: {
						agentId,
						status: "idle",
					},
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
	} as AgentService;
}

function createTestRegistryForRoot(projectRoot: string, runningAgents = new Set<string>()): AgentServiceRegistry<AgentService> {
	return new AgentServiceRegistry({
		profiles: createDefaultAgentProfiles(projectRoot),
		createService: (profile) => createScopedAgentService(profile.agentId, runningAgents.has(profile.agentId)),
	});
}

test("agent profile create and update validate defaultBrowserId against browser registry", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-browser-"));
	const app = await buildServer({
		agentProfileProjectRoot: projectRoot,
		browserRegistry: createBrowserRegistryFromEnv({
			UGK_BROWSER_INSTANCES_JSON: JSON.stringify([
				{ browserId: "default", name: "Default", cdpHost: "172.31.250.10", cdpPort: 9223 },
				{ browserId: "work-01", name: "我的浏览器", cdpHost: "172.31.250.11", cdpPort: 9223 },
			]),
		}),
	});

	try {
		const created = await app.inject({
			method: "POST",
			url: "/v1/agents",
			payload: {
				agentId: "research",
				name: "研究 Agent",
				description: "用于资料研究。",
				defaultBrowserId: "work-01",
			},
		});
		assert.equal(created.statusCode, 200);
		assert.equal(created.json().agent.defaultBrowserId, "work-01");

		const list = await app.inject({ method: "GET", url: "/v1/agents" });
		const research = list.json().agents.find((agent: { agentId: string }) => agent.agentId === "research");
		assert.equal(research.defaultBrowserId, "work-01");

		const rejected = await app.inject({
			method: "PATCH",
			url: "/v1/agents/research",
			payload: {
				defaultBrowserId: "missing",
			},
		});
		assert.equal(rejected.statusCode, 400);
		assert.match(rejected.json().error.message, /Unknown browserId: missing/);
	} finally {
		await app.close();
	}
});

test("agent browser binding updates write an audit entry with confirmation state", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-browser-audit-"));
	const auditEntries: BrowserBindingAuditEntry[] = [];
	const app = await buildServer({
		agentProfileProjectRoot: projectRoot,
		browserBindingAuditLog: {
			record: async (entry) => {
				auditEntries.push(entry);
			},
		},
		browserRegistry: createBrowserRegistryFromEnv({
			UGK_BROWSER_INSTANCES_JSON: JSON.stringify([
				{ browserId: "default", name: "Default", cdpHost: "172.31.250.10", cdpPort: 9223 },
				{ browserId: "work-01", name: "工作浏览器", cdpHost: "172.31.250.11", cdpPort: 9223 },
				{ browserId: "work-02", name: "备用浏览器", cdpHost: "172.31.250.12", cdpPort: 9223 },
			]),
		}),
	});

	try {
		await app.inject({
			method: "POST",
			url: "/v1/agents",
			payload: {
				agentId: "research",
				name: "研究 Agent",
				description: "用于资料研究。",
				defaultBrowserId: "work-01",
			},
		});
		const response = await app.inject({
			method: "PATCH",
			url: "/v1/agents/research",
			headers: {
				"x-ugk-browser-binding-confirmed": "true",
				"x-ugk-browser-binding-source": "playground",
			},
			payload: {
				defaultBrowserId: "work-02",
			},
		});

		assert.equal(response.statusCode, 200);
		assert.equal(auditEntries.length, 1);
		assert.match(auditEntries[0]?.createdAt || "", /^\d{4}-\d{2}-\d{2}T/);
		assert.deepEqual({ ...auditEntries[0], createdAt: undefined }, {
			createdAt: undefined,
			kind: "agent_browser_binding",
			targetId: "research",
			targetLabel: "研究 Agent",
			source: "playground",
			confirmedByClient: true,
			status: "succeeded",
			changes: [
				{
					field: "defaultBrowserId",
					from: "work-01",
					to: "work-02",
				},
			],
		});
	} finally {
		await app.close();
	}
});

test("agent browser binding updates reject unconfirmed changes before writing", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-browser-reject-"));
	const auditEntries: BrowserBindingAuditEntry[] = [];
	const app = await buildServer({
		agentProfileProjectRoot: projectRoot,
		browserBindingAuditLog: {
			record: async (entry) => {
				auditEntries.push(entry);
			},
		},
		browserRegistry: createBrowserRegistryFromEnv({
			UGK_BROWSER_INSTANCES_JSON: JSON.stringify([
				{ browserId: "default", name: "Default", cdpHost: "172.31.250.10", cdpPort: 9223 },
				{ browserId: "work-01", name: "工作浏览器", cdpHost: "172.31.250.11", cdpPort: 9223 },
				{ browserId: "work-02", name: "备用浏览器", cdpHost: "172.31.250.12", cdpPort: 9223 },
			]),
		}),
	});

	try {
		await app.inject({
			method: "POST",
			url: "/v1/agents",
			payload: {
				agentId: "research",
				name: "研究 Agent",
				description: "用于资料研究。",
				defaultBrowserId: "work-01",
			},
		});
		const response = await app.inject({
			method: "PATCH",
			url: "/v1/agents/research",
			payload: {
				defaultBrowserId: "work-02",
			},
		});
		const list = await app.inject({ method: "GET", url: "/v1/agents" });
		const research = list.json().agents.find((agent: { agentId: string }) => agent.agentId === "research");

		assert.equal(response.statusCode, 400);
		assert.match(response.json().error.message, /explicit confirmation/);
		assert.equal(research.defaultBrowserId, "work-01");
		assert.equal(auditEntries.length, 1);
		assert.deepEqual({ ...auditEntries[0], createdAt: undefined }, {
			createdAt: undefined,
			kind: "agent_browser_binding",
			targetId: "research",
			targetLabel: "研究 Agent",
			source: "api",
			confirmedByClient: false,
			status: "rejected_unconfirmed",
			changes: [
				{ field: "defaultBrowserId", from: "work-01", to: "work-02" },
			],
		});
	} finally {
		await app.close();
	}
});

test("agent browser binding updates reject confirmed changes outside the Playground UI", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-browser-source-"));
	const auditEntries: BrowserBindingAuditEntry[] = [];
	const app = await buildServer({
		agentProfileProjectRoot: projectRoot,
		browserBindingAuditLog: {
			record: async (entry) => {
				auditEntries.push(entry);
			},
		},
		browserRegistry: createBrowserRegistryFromEnv({
			UGK_BROWSER_INSTANCES_JSON: JSON.stringify([
				{ browserId: "default", name: "Default", cdpHost: "172.31.250.10", cdpPort: 9223 },
				{ browserId: "work-01", name: "工作浏览器", cdpHost: "172.31.250.11", cdpPort: 9223 },
				{ browserId: "work-02", name: "备用浏览器", cdpHost: "172.31.250.12", cdpPort: 9223 },
			]),
		}),
	});

	try {
		await app.inject({
			method: "POST",
			url: "/v1/agents",
			payload: {
				agentId: "research",
				name: "研究 Agent",
				description: "用于资料研究。",
				defaultBrowserId: "work-01",
			},
		});
		const response = await app.inject({
			method: "PATCH",
			url: "/v1/agents/research",
			headers: {
				"x-ugk-browser-binding-confirmed": "true",
				"x-ugk-browser-binding-source": "agent-profile-ops",
			},
			payload: {
				defaultBrowserId: "work-02",
			},
		});
		const list = await app.inject({ method: "GET", url: "/v1/agents" });
		const research = list.json().agents.find((agent: { agentId: string }) => agent.agentId === "research");

		assert.equal(response.statusCode, 400);
		assert.match(response.json().error.message, /Playground UI/);
		assert.equal(research.defaultBrowserId, "work-01");
		assert.equal(auditEntries.length, 1);
		assert.equal(auditEntries[0]?.status, "rejected_non_ui_source");
		assert.equal(auditEntries[0]?.source, "agent-profile-ops");
	} finally {
		await app.close();
	}
});

test("agent browser binding updates reject while that agent has a running conversation", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-browser-running-"));
	const auditEntries: BrowserBindingAuditEntry[] = [];
	const app = await buildServer({
		agentProfileProjectRoot: projectRoot,
		agentServiceRegistry: createTestRegistryForRoot(projectRoot, new Set(["research"])),
		browserBindingAuditLog: {
			record: async (entry) => {
				auditEntries.push(entry);
			},
		},
		browserRegistry: createBrowserRegistryFromEnv({
			UGK_BROWSER_INSTANCES_JSON: JSON.stringify([
				{ browserId: "default", name: "Default", cdpHost: "172.31.250.10", cdpPort: 9223 },
				{ browserId: "work-01", name: "工作浏览器", cdpHost: "172.31.250.11", cdpPort: 9223 },
				{ browserId: "work-02", name: "备用浏览器", cdpHost: "172.31.250.12", cdpPort: 9223 },
			]),
		}),
	});

	try {
		await app.inject({
			method: "POST",
			url: "/v1/agents",
			payload: {
				agentId: "research",
				name: "研究 Agent",
				description: "用于资料研究。",
				defaultBrowserId: "work-01",
			},
		});
		const response = await app.inject({
			method: "PATCH",
			url: "/v1/agents/research",
			headers: {
				"x-ugk-browser-binding-confirmed": "true",
				"x-ugk-browser-binding-source": "playground",
			},
			payload: {
				defaultBrowserId: "work-02",
			},
		});
		const list = await app.inject({ method: "GET", url: "/v1/agents" });
		const research = list.json().agents.find((agent: { agentId: string }) => agent.agentId === "research");

		assert.equal(response.statusCode, 409);
		assert.match(response.json().error.message, /running conversation/);
		assert.equal(research.defaultBrowserId, "work-01");
		assert.equal(auditEntries.length, 1);
		assert.deepEqual({ ...auditEntries[0], createdAt: undefined }, {
			createdAt: undefined,
			kind: "agent_browser_binding",
			targetId: "research",
			targetLabel: "研究 Agent",
			source: "playground",
			confirmedByClient: true,
			status: "rejected_running",
			changes: [
				{ field: "defaultBrowserId", from: "work-01", to: "work-02" },
			],
		});
	} finally {
		await app.close();
	}
});

test("conn execution binding updates write one audit entry for agent and browser changes", async () => {
	const auditEntries: BrowserBindingAuditEntry[] = [];
	const updateCalls: unknown[] = [];
	const existingConn = {
		connId: "conn-1",
		title: "知乎日报",
		prompt: "run",
		target: { type: "task_inbox" as const },
		schedule: { kind: "cron" as const, expression: "0 9 * * *", timezone: "Asia/Shanghai" },
		assetRefs: [],
		profileId: "main",
		browserId: "work-01",
		status: "active" as const,
		createdAt: "2026-05-09T00:00:00.000Z",
		updatedAt: "2026-05-09T00:00:00.000Z",
	};
	const app = await buildServer({
		browserBindingAuditLog: {
			record: async (entry) => {
				auditEntries.push(entry);
			},
		},
		browserRegistry: createBrowserRegistryFromEnv({
			UGK_BROWSER_INSTANCES_JSON: JSON.stringify([
				{ browserId: "default", name: "Default", cdpHost: "172.31.250.10", cdpPort: 9223 },
				{ browserId: "work-01", name: "工作浏览器", cdpHost: "172.31.250.11", cdpPort: 9223 },
				{ browserId: "work-02", name: "备用浏览器", cdpHost: "172.31.250.12", cdpPort: 9223 },
			]),
		}),
		connStore: {
			list: async () => [],
			get: async () => existingConn,
			create: async () => existingConn,
			update: async (_connId: string, patch: { profileId?: unknown; browserId?: unknown }) => {
				updateCalls.push(patch);
				return {
					...existingConn,
					profileId: patch.profileId as string,
					browserId: patch.browserId as string,
					updatedAt: "2026-05-09T00:01:00.000Z",
				};
			},
			delete: async () => false,
			pause: async () => undefined,
			resume: async () => undefined,
		} as never,
	});

	try {
		const response = await app.inject({
			method: "PATCH",
			url: "/v1/conns/conn-1",
			headers: {
				"x-ugk-browser-binding-confirmed": "true",
				"x-ugk-browser-binding-source": "playground",
			},
			payload: {
				profileId: "agent-2",
				browserId: "work-02",
			},
		});

		assert.equal(response.statusCode, 200);
		assert.equal(updateCalls.length, 1);
		assert.equal(auditEntries.length, 1);
		assert.match(auditEntries[0]?.createdAt || "", /^\d{4}-\d{2}-\d{2}T/);
		assert.deepEqual([{ ...auditEntries[0], createdAt: undefined }], [
			{
				createdAt: undefined,
				kind: "conn_execution_binding",
				targetId: "conn-1",
				targetLabel: "知乎日报",
				source: "playground",
				confirmedByClient: true,
				status: "succeeded",
				changes: [
					{ field: "profileId", from: "main", to: "agent-2" },
					{ field: "browserId", from: "work-01", to: "work-02" },
				],
			},
		]);
	} finally {
		await app.close();
	}
});

test("conn execution binding updates reject unconfirmed agent or browser changes before writing", async () => {
	const auditEntries: BrowserBindingAuditEntry[] = [];
	const updateCalls: unknown[] = [];
	const existingConn = {
		connId: "conn-1",
		title: "知乎日报",
		prompt: "run",
		target: { type: "task_inbox" as const },
		schedule: { kind: "cron" as const, expression: "0 9 * * *", timezone: "Asia/Shanghai" },
		assetRefs: [],
		profileId: "main",
		browserId: "work-01",
		status: "active" as const,
		createdAt: "2026-05-09T00:00:00.000Z",
		updatedAt: "2026-05-09T00:00:00.000Z",
	};
	const app = await buildServer({
		browserBindingAuditLog: {
			record: async (entry) => {
				auditEntries.push(entry);
			},
		},
		browserRegistry: createBrowserRegistryFromEnv({
			UGK_BROWSER_INSTANCES_JSON: JSON.stringify([
				{ browserId: "default", name: "Default", cdpHost: "172.31.250.10", cdpPort: 9223 },
				{ browserId: "work-01", name: "工作浏览器", cdpHost: "172.31.250.11", cdpPort: 9223 },
				{ browserId: "work-02", name: "备用浏览器", cdpHost: "172.31.250.12", cdpPort: 9223 },
			]),
		}),
		connStore: {
			list: async () => [],
			get: async () => existingConn,
			create: async () => existingConn,
			update: async (_connId: string, patch: unknown) => {
				updateCalls.push(patch);
				return existingConn;
			},
			delete: async () => false,
			pause: async () => undefined,
			resume: async () => undefined,
		} as never,
	});

	try {
		const response = await app.inject({
			method: "PATCH",
			url: "/v1/conns/conn-1",
			payload: {
				profileId: "agent-2",
				browserId: "work-02",
			},
		});

		assert.equal(response.statusCode, 400);
		assert.match(response.json().error.message, /explicit confirmation/);
		assert.equal(updateCalls.length, 0);
		assert.equal(auditEntries.length, 1);
		assert.deepEqual({ ...auditEntries[0], createdAt: undefined }, {
			createdAt: undefined,
			kind: "conn_execution_binding",
			targetId: "conn-1",
			targetLabel: "知乎日报",
			source: "api",
			confirmedByClient: false,
			status: "rejected_unconfirmed",
			changes: [
				{ field: "profileId", from: "main", to: "agent-2" },
				{ field: "browserId", from: "work-01", to: "work-02" },
			],
		});
	} finally {
		await app.close();
	}
});

test("conn execution binding updates reject confirmed changes outside the Playground UI", async () => {
	const auditEntries: BrowserBindingAuditEntry[] = [];
	const updateCalls: unknown[] = [];
	const existingConn = {
		connId: "conn-1",
		title: "知乎日报",
		prompt: "run",
		target: { type: "task_inbox" as const },
		schedule: { kind: "cron" as const, expression: "0 9 * * *", timezone: "Asia/Shanghai" },
		assetRefs: [],
		profileId: "main",
		browserId: "work-01",
		status: "active" as const,
		createdAt: "2026-05-09T00:00:00.000Z",
		updatedAt: "2026-05-09T00:00:00.000Z",
	};
	const app = await buildServer({
		browserBindingAuditLog: {
			record: async (entry) => {
				auditEntries.push(entry);
			},
		},
		browserRegistry: createBrowserRegistryFromEnv({
			UGK_BROWSER_INSTANCES_JSON: JSON.stringify([
				{ browserId: "default", name: "Default", cdpHost: "172.31.250.10", cdpPort: 9223 },
				{ browserId: "work-01", name: "工作浏览器", cdpHost: "172.31.250.11", cdpPort: 9223 },
				{ browserId: "work-02", name: "备用浏览器", cdpHost: "172.31.250.12", cdpPort: 9223 },
			]),
		}),
		connStore: {
			list: async () => [],
			get: async () => existingConn,
			create: async () => existingConn,
			update: async (_connId: string, patch: unknown) => {
				updateCalls.push(patch);
				return existingConn;
			},
			delete: async () => false,
			pause: async () => undefined,
			resume: async () => undefined,
		} as never,
	});

	try {
		const response = await app.inject({
			method: "PATCH",
			url: "/v1/conns/conn-1",
			headers: {
				"x-ugk-browser-binding-confirmed": "true",
				"x-ugk-browser-binding-source": "agent-profile-ops",
			},
			payload: {
				profileId: "agent-2",
				browserId: "work-02",
			},
		});

		assert.equal(response.statusCode, 400);
		assert.match(response.json().error.message, /Playground UI/);
		assert.equal(updateCalls.length, 0);
		assert.equal(auditEntries.length, 1);
		assert.equal(auditEntries[0]?.status, "rejected_non_ui_source");
		assert.equal(auditEntries[0]?.source, "agent-profile-ops");
	} finally {
		await app.close();
	}
});
