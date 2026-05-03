import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	archiveStoredAgentProfile,
	createStoredAgentProfile,
	loadAgentProfilesSync,
} from "../src/agent/agent-profile-catalog.js";
import { resolveAgentProfile } from "../src/agent/agent-profile.js";

test("createStoredAgentProfile persists an isolated agent profile", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-profile-"));

	const profile = await createStoredAgentProfile(projectRoot, {
		agentId: "research",
		name: "研究 Agent",
		description: "用于资料研究。",
	});
	const loaded = loadAgentProfilesSync(projectRoot);
	const research = resolveAgentProfile(loaded, "research");

	assert.equal(profile.agentId, "research");
	assert.ok(research);
	assert.equal(research.runtimeAgentRulesPath, join(projectRoot, ".data", "agents", "research", "AGENTS.md"));
	assert.deepEqual(research.allowedSkillPaths, [
		join(projectRoot, ".data", "agents", "research", "pi", "skills"),
		join(projectRoot, ".data", "agents", "research", "user-skills"),
	]);

	const rules = await readFile(research.runtimeAgentRulesPath, "utf8");
	assert.match(rules, /# 研究 Agent/);
	assert.match(rules, /GET \/v1\/agents\/research\/debug\/skills/);
	assert.doesNotMatch(rules, /GET \/v1\/agents\/search\/debug\/skills/);
});

test("archiveStoredAgentProfile removes custom profiles and preserves files", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-profile-"));
	await createStoredAgentProfile(projectRoot, {
		agentId: "draft",
		name: "草稿 Agent",
		description: "用于草稿。",
	});

	const archived = await archiveStoredAgentProfile(projectRoot, "draft");
	const loaded = loadAgentProfilesSync(projectRoot);

	assert.equal(resolveAgentProfile(loaded, "draft"), undefined);
	assert.match(archived.archivedPath, /agents-archive/);
});

test("agent profile catalog rejects reserved and malformed ids", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-profile-"));

	await assert.rejects(
		createStoredAgentProfile(projectRoot, { agentId: "main" }),
		/main.*reserved/,
	);
	await assert.rejects(
		createStoredAgentProfile(projectRoot, { agentId: "../bad" }),
		/agentId must start/,
	);
});
