import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("server ops script protects shared runtime state during deploys", () => {
	const script = readFileSync("scripts/server-ops.mjs", "utf8");

	assert.match(script, /tencent/);
	assert.match(script, /aliyun/);
	assert.match(script, /UGK_RUNTIME_SKILLS_USER_DIR/);
	assert.match(script, /\/home\/ubuntu\/ugk-claw-shared\/runtime\/skills-user/);
	assert.match(script, /\/root\/ugk-claw-shared\/runtime\/skills-user/);
	assert.match(script, /git status --short/);
	assert.match(script, /Remote worktree is dirty; stop before deploying/);
	assert.match(script, /docker compose --env-file/);
	assert.match(script, /config --quiet/);
	assert.match(script, /up --build -d/);
	assert.match(script, /restart nginx/);
	assert.match(script, /\/v1\/debug\/skills/);
});
