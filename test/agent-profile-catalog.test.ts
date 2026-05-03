import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	archiveStoredAgentProfile,
	createStoredAgentProfile,
	installStoredAgentProfileSkill,
	loadAgentProfilesSync,
	removeStoredAgentProfileSkill,
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

test("createStoredAgentProfile copies selected main agent skills into the new system skill root", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-profile-"));
	await mkdir(join(projectRoot, ".pi", "skills", "web-access"), { recursive: true });
	await writeFile(join(projectRoot, ".pi", "skills", "web-access", "SKILL.md"), "# web-access\n", "utf8");

	const profile = await createStoredAgentProfile(projectRoot, {
		agentId: "research",
		name: "研究 Agent",
		description: "用于资料研究。",
		initialSystemSkillNames: ["web-access", "agent-skill-ops", "web-access"],
	});

	const copied = await readFile(join(profile.allowedSkillPaths[0], "web-access", "SKILL.md"), "utf8");
	const required = await readFile(join(profile.allowedSkillPaths[0], "agent-skill-ops", "SKILL.md"), "utf8");

	assert.equal(copied, "# web-access\n");
	assert.match(required, /name: agent-skill-ops/);
});

test("createStoredAgentProfile copies nested main agent skills by metadata name", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-profile-"));
	await mkdir(join(projectRoot, ".pi", "skills", "superpowers", "brainstorming"), { recursive: true });
	await writeFile(
		join(projectRoot, ".pi", "skills", "superpowers", "brainstorming", "SKILL.md"),
		"---\nname: brainstorming\ndescription: nested skill\n---\n\n# brainstorming\n",
		"utf8",
	);

	const profile = await createStoredAgentProfile(projectRoot, {
		agentId: "research",
		name: "研究 Agent",
		description: "用于资料研究。",
		initialSystemSkillNames: ["brainstorming"],
	});

	const copied = await readFile(join(profile.allowedSkillPaths[0], "brainstorming", "SKILL.md"), "utf8");

	assert.match(copied, /name: brainstorming/);
});

test("createStoredAgentProfile rejects initial skills that main agent does not have", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-profile-"));

	await assert.rejects(
		createStoredAgentProfile(projectRoot, {
			agentId: "research",
			name: "研究 Agent",
			description: "用于资料研究。",
			initialSystemSkillNames: ["missing-skill"],
		}),
		/main agent does not have skill missing-skill/,
	);
	await assert.rejects(access(join(projectRoot, ".data", "agents", "research")));
});

test("createStoredAgentProfile can recreate an archived agent id as visible", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-profile-"));
	await createStoredAgentProfile(projectRoot, {
		agentId: "draft",
		name: "草稿 Agent",
		description: "用于草稿。",
	});
	await archiveStoredAgentProfile(projectRoot, "draft");

	await createStoredAgentProfile(projectRoot, {
		agentId: "draft",
		name: "新草稿 Agent",
		description: "重新启用。",
	});
	const loaded = loadAgentProfilesSync(projectRoot);
	const draft = resolveAgentProfile(loaded, "draft");

	assert.ok(draft);
	assert.equal(draft.name, "新草稿 Agent");
});

test("installStoredAgentProfileSkill copies a main agent skill into an existing agent user skill root", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-profile-"));
	await mkdir(join(projectRoot, ".pi", "skills", "web-access"), { recursive: true });
	await writeFile(join(projectRoot, ".pi", "skills", "web-access", "SKILL.md"), "# web-access\n", "utf8");
	await createStoredAgentProfile(projectRoot, {
		agentId: "research",
		name: "研究 Agent",
		description: "用于资料研究。",
	});

	const result = await installStoredAgentProfileSkill(projectRoot, "research", "web-access");
	const copied = await readFile(join(projectRoot, ".data", "agents", "research", "user-skills", "web-access", "SKILL.md"), "utf8");

	assert.equal(result.agentId, "research");
	assert.equal(result.skillName, "web-access");
	assert.equal(result.targetRoot, join(projectRoot, ".data", "agents", "research", "user-skills"));
	assert.equal(copied, "# web-access\n");
});

test("removeStoredAgentProfileSkill removes only mutable skills from custom agent roots", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-profile-"));
	await createStoredAgentProfile(projectRoot, {
		agentId: "research",
		name: "研究 Agent",
		description: "用于资料研究。",
	});
	await mkdir(join(projectRoot, ".data", "agents", "research", "user-skills", "web-access"), { recursive: true });
	await writeFile(
		join(projectRoot, ".data", "agents", "research", "user-skills", "web-access", "SKILL.md"),
		"# web-access\n",
		"utf8",
	);

	const removed = await removeStoredAgentProfileSkill(projectRoot, "research", "web-access");

	assert.equal(removed.agentId, "research");
	assert.equal(removed.skillName, "web-access");
	await assert.rejects(access(join(projectRoot, ".data", "agents", "research", "user-skills", "web-access")));
	await assert.rejects(
		removeStoredAgentProfileSkill(projectRoot, "research", "agent-skill-ops"),
		/required agent skill cannot be removed/,
	);
	await assert.rejects(
		installStoredAgentProfileSkill(projectRoot, "main", "web-access"),
		/main agent skills cannot be managed through agent profile ops/,
	);
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
