import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import {
	createSkillRestrictedResourceLoader,
	getDefaultAllowedSkillPaths,
	getDefaultSystemSkillPath,
	getDefaultUserSkillPath,
	getProjectModelsPath,
	resolveProjectDefaultModelContext,
} from "../src/agent/agent-session-factory.js";

test("createSkillRestrictedResourceLoader only loads skills from the allowed paths", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-session-factory-"));
	const allowedSkillDir = join(projectRoot, ".pi", "skills", "allowed-skill");
	const blockedSkillDir = join(projectRoot, "skills", "blocked-skill");

	await mkdir(allowedSkillDir, { recursive: true });
	await mkdir(blockedSkillDir, { recursive: true });
	await writeFile(
		join(projectRoot, ".pi", "settings.json"),
		JSON.stringify({
			skills: ["../skills"],
		}),
		"utf8",
	);
	await writeFile(
		join(allowedSkillDir, "SKILL.md"),
		"---\nname: allowed-skill\ndescription: skill from the allowed whitelist path\n---\n",
		"utf8",
	);
	await writeFile(
		join(blockedSkillDir, "SKILL.md"),
		"---\nname: blocked-skill\ndescription: skill from a blocked path\n---\n",
		"utf8",
	);

	const loader = createSkillRestrictedResourceLoader({
		projectRoot,
		allowedSkillPaths: [join(projectRoot, ".pi", "skills")],
	});

	await loader.reload();

	assert.deepEqual(
		loader.getSkills().skills.map((skill) => skill.name),
		["allowed-skill"],
	);
});

test("project whitelist exposes the vendored superpowers meta skill and workflow skills", async () => {
	const loader = createSkillRestrictedResourceLoader({
		projectRoot: process.cwd(),
		allowedSkillPaths: getDefaultAllowedSkillPaths(process.cwd()),
	});

	await loader.reload();

	const skillNames = new Set(loader.getSkills().skills.map((skill) => skill.name));

	assert.equal(skillNames.has("project-planning"), true);
	assert.equal(skillNames.has("using-superpowers"), true);
	assert.equal(skillNames.has("brainstorming"), true);
	assert.equal(skillNames.has("test-driven-development"), true);
	assert.equal(skillNames.has("systematic-debugging"), true);
});

test("default allowed skill paths include both system and user skill directories", () => {
	const projectRoot = "E:/AII/ugk-pi";

	assert.deepEqual(getDefaultAllowedSkillPaths(projectRoot), [
		getDefaultSystemSkillPath(projectRoot),
		getDefaultUserSkillPath(projectRoot),
	]);
});

test("skill whitelist can load both system and user-installed skill directories", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-dual-skill-loader-"));
	const systemSkillDir = join(projectRoot, ".pi", "skills", "system-skill");
	const userSkillDir = join(projectRoot, "runtime", "skills-user", "user-skill");

	await mkdir(systemSkillDir, { recursive: true });
	await mkdir(userSkillDir, { recursive: true });
	await writeFile(
		join(systemSkillDir, "SKILL.md"),
		"---\nname: system-skill\ndescription: bundled system skill\n---\n",
		"utf8",
	);
	await writeFile(
		join(userSkillDir, "SKILL.md"),
		"---\nname: user-skill\ndescription: user installed skill\n---\n",
		"utf8",
	);

	const loader = createSkillRestrictedResourceLoader({
		projectRoot,
		allowedSkillPaths: getDefaultAllowedSkillPaths(projectRoot),
	});

	await loader.reload();

	assert.deepEqual(
		loader.getSkills().skills.map((skill) => skill.name).sort(),
		["system-skill", "user-skill"],
	);
});

test("project models.json exposes the checked-in dashscope-coding glm-5 provider", () => {
	const registry = ModelRegistry.create(AuthStorage.create(), getProjectModelsPath(process.cwd()));
	const model = registry.find("dashscope-coding", "glm-5");

	assert.notEqual(model, undefined);
	assert.equal(model?.provider, "dashscope-coding");
	assert.equal(model?.id, "glm-5");
});

test("resolveProjectDefaultModelContext uses the checked-in project defaults and reserve budget", () => {
	const context = resolveProjectDefaultModelContext(process.cwd());

	assert.deepEqual(context, {
		provider: "dashscope-coding",
		model: "glm-5",
		contextWindow: 128000,
		maxResponseTokens: 16384,
		reserveTokens: 16384,
	});
});
