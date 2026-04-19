import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("x-search-latest skill uses runtime paths that work inside the container", async () => {
	const skill = await readFile("runtime/skills-user/x-search-latest/SKILL.md", "utf8");

	assert.doesNotMatch(skill, /\$CLAUDE_SKILL_DIR\/\.\./);
	assert.match(
		skill,
		/node \/app\/runtime\/skills-user\/web-access\/scripts\/check-deps\.mjs/,
	);
	assert.match(
		skill,
		/node \/app\/runtime\/skills-user\/x-search-latest\/scripts\/x_search_latest\.mjs/,
	);
});

test("web-access skill does not depend on CLAUDE_SKILL_DIR for script commands", async () => {
	const skill = await readFile("runtime/skills-user/web-access/SKILL.md", "utf8");

	assert.doesNotMatch(skill, /\$CLAUDE_SKILL_DIR/);
	assert.match(
		skill,
		/node \/app\/runtime\/skills-user\/web-access\/scripts\/check-deps\.mjs/,
	);
	assert.match(
		skill,
		/node \/app\/runtime\/skills-user\/web-access\/scripts\/staged-route-cli\.mjs run-url/,
	);
});

test("web-access skill treats container file URLs as valid internal artifact inputs and keeps user delivery separate", async () => {
	const skill = await readFile("runtime/skills-user/web-access/SKILL.md", "utf8");

	assert.match(skill, /file:\/\/\/app\/\.\.\./);
	assert.match(skill, /internal artifact input/i);
	assert.match(skill, /send_file/);
	assert.match(skill, /host-reachable/i);
});
