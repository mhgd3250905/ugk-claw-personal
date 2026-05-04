import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("searxng-search skill only allows explicit slash-command triggering", async () => {
	const skill = await readFile("runtime/skills-user/searxng-search/SKILL.md", "utf8");

	assert.match(skill, /仅在用户显式输入 `\/searx:关键词` 或 `\/searxng:关键词` 时使用/);
	assert.match(skill, /不要从普通自然语言搜索、查资料、最新信息请求中猜测触发/);
	assert.match(skill, /不应使用本技能，除非用户明确写了 `\/searx:` 或 `\/searxng:`/);
});

test("searxng-search skill uses stable container runtime paths", async () => {
	const skill = await readFile("runtime/skills-user/searxng-search/SKILL.md", "utf8");

	assert.doesNotMatch(skill, /\$CLAUDE_SKILL_DIR/);
	assert.match(
		skill,
		/node \/app\/runtime\/skills-user\/searxng-search\/scripts\/searxng_search\.mjs search/,
	);
});

test("searxng search cli dry-run builds a JSON API request without network access", async () => {
	const { stdout } = await execFileAsync(
		process.execPath,
		[
			"runtime/skills-user/searxng-search/scripts/searxng_search.mjs",
			"search",
			"--query",
			"SearXNG JSON API",
			"--category",
			"general",
			"--language",
			"zh-CN",
			"--time-range",
			"day",
			"--limit",
			"5",
			"--dry-run",
		],
		{
			env: {
				...process.env,
				SEARXNG_BASE_URL: "http://127.0.0.1:48080",
			},
		},
	);
	const payload = JSON.parse(stdout);

	assert.equal(payload.command, "search");
	assert.equal(payload.baseUrl, "http://127.0.0.1:48080");
	assert.equal(payload.limit, 5);
	assert.match(payload.url, /^http:\/\/127\.0\.0\.1:48080\/search\?/);
	assert.match(payload.url, /q=SearXNG\+JSON\+API/);
	assert.match(payload.url, /format=json/);
	assert.match(payload.url, /categories=general/);
	assert.match(payload.url, /language=zh-CN/);
	assert.match(payload.url, /time_range=day/);
});
