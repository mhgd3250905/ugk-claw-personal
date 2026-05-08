import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBrowserRegistryFromEnv } from "../src/browser/browser-registry.js";
import { buildServer } from "../src/server.js";

test("agent profile create and update validate defaultBrowserId against browser registry", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-browser-"));
	const app = buildServer({
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
		assert.match(rejected.json().message, /Unknown browserId: missing/);
	} finally {
		await app.close();
	}
});

