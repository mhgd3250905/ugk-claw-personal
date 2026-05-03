import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultAgentSessionFactory } from "../src/agent/agent-session-factory.js";
import { createDefaultAgentProfiles, resolveAgentProfile } from "../src/agent/agent-profile.js";

async function writeSkill(root: string, name: string): Promise<void> {
	const skillDir = join(root, name);
	await mkdir(skillDir, { recursive: true });
	await writeFile(
		join(skillDir, "SKILL.md"),
		`---\nname: ${name}\ndescription: ${name} test skill\n---\n\n# ${name}\n`,
		"utf8",
	);
}

test("search agent skill list only includes skills from its own allowedSkillPaths", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-search-skills-"));
	const profiles = createDefaultAgentProfiles(projectRoot);
	const main = resolveAgentProfile(profiles, "main");
	const search = resolveAgentProfile(profiles, "search");
	assert.ok(main);
	assert.ok(search);

	await writeSkill(main.allowedSkillPaths[0]!, "main-only");
	await writeSkill(search.allowedSkillPaths[0]!, "search-system");
	await writeSkill(search.allowedSkillPaths[1]!, "search-user");

	const searchFactory = createDefaultAgentSessionFactory({
		projectRoot,
		sessionDir: search.sessionsDir,
		agentDir: search.agentDir,
		allowedSkillPaths: search.allowedSkillPaths,
		runtimeAgentRulesPath: search.runtimeAgentRulesPath,
	});

	const result = await searchFactory.getAvailableSkills?.();

	assert.deepEqual(result?.skills.map((skill) => skill.name).sort(), ["search-system", "search-user"]);
});
