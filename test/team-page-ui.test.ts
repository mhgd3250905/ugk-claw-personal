import test from "node:test";
import assert from "node:assert/strict";
import { renderTeamPage } from "../src/ui/team-page.js";

test("team page contains Chinese labels", () => {
	const html = renderTeamPage();
	assert.match(html, /计划/);
	assert.match(html, /预设团队/);
	assert.match(html, /运行记录/);
	assert.match(html, /任务/);
	assert.match(html, /执行 Agent/);
	assert.match(html, /验收 Agent/);
	assert.match(html, /复盘 Agent/);
	assert.match(html, /汇总 Agent/);
});

test("team page references /v1/team API", () => {
	const html = renderTeamPage();
	assert.match(html, /\/v1\/team/);
});

test("team page has plan, team, run sections", () => {
	const html = renderTeamPage();
	assert.match(html, /section-plans/);
	assert.match(html, /section-teams/);
	assert.match(html, /section-runs/);
});
