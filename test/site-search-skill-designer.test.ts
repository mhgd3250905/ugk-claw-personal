import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SKILL_PATH = ".pi/skills/site-search-skill-designer/SKILL.md";

test("site-search-skill-designer is narrowly described as a meta-skill", async () => {
	const skill = await readFile(SKILL_PATH, "utf8");

	assert.match(skill, /name: site-search-skill-designer/);
	assert.match(skill, /Use only when the user explicitly asks to design, create, draft, review, or improve/i);
	assert.match(skill, /narrow meta-skill/i);
	assert.match(skill, /not for performing searches/i);
	assert.match(skill, /Do not use for ordinary web search/i);
});

test("site-search-skill-designer includes access strategy and evidence gates", async () => {
	const skill = await readFile(SKILL_PATH, "utf8");

	assert.match(skill, /Official API/);
	assert.match(skill, /Public JSON \/ RSS \/ sitemap/);
	assert.match(skill, /Page-internal fetch with browser cookies/);
	assert.match(skill, /Full CDP\/browser automation/);
	assert.match(skill, /Define Evidence Gate/);
	assert.match(skill, /search engine summary/);
	assert.match(skill, /Fallback Policy/);
});

test("site-search-skill-designer covers static-first and cdp-first examples", async () => {
	const skill = await readFile(SKILL_PATH, "utf8");

	assert.match(skill, /GitHub REST API/);
	assert.match(skill, /Reddit public JSON search/);
	assert.match(skill, /Zhihu data often depends on cookies/);
	assert.match(skill, /小红书 Search Skill/);
	assert.match(skill, /Browser cookies and signatures are expected/);
});
