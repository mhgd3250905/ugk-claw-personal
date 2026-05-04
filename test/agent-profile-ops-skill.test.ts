import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SKILL_PATH = ".pi/skills/agent-profile-ops/SKILL.md";

test("agent-profile-ops forbids manual profile catalog edits", async () => {
	const skill = await readFile(SKILL_PATH, "utf8");

	assert.match(skill, /禁止直接编辑 `\.data\/agents\/profiles\.json`/);
	assert.match(skill, /POST \/v1\/agents/);
	assert.match(skill, /GET \/v1\/agents/);
	assert.match(skill, /AgentServiceRegistry/);
	assert.match(skill, /磁盘 catalog 与运行时 registry 分裂/);
});

test("agent-profile-ops requires API routes for profile mutations", async () => {
	const skill = await readFile(SKILL_PATH, "utf8");

	assert.match(skill, /创建走 `POST \/v1\/agents`/);
	assert.match(skill, /归档走 `POST \/v1\/agents\/:agentId\/archive`/);
	assert.match(skill, /技能变更走对应 skills API/);
	assert.doesNotMatch(skill, /手动写入 profiles\.json/);
});
