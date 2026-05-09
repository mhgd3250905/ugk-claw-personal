import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
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
	assert.match(skill, /PUBLIC_BASE_URL/);
	assert.match(skill, /WEB_ACCESS_BROWSER_PUBLIC_BASE_URL/);
	assert.match(skill, /browser-reachable/i);
});

test("web-access skill documents sidecar as primary and host IPC as legacy fallback", async () => {
	const skill = await readFile("runtime/skills-user/web-access/SKILL.md", "utf8");

	assert.match(skill, /Primary path/i);
	assert.match(skill, /Docker Chrome sidecar/i);
	assert.match(skill, /Legacy fallback/i);
	assert.match(skill, /start-web-access-browser\.ps1/);
	assert.match(skill, /Do not make sidecar Chrome open `http:\/\/127\.0\.0\.1:3000\/\.\.\.`/);
});

test("web-access skill documents CDP text insertion for rich editors", async () => {
	const skill = await readFile("runtime/skills-user/web-access/SKILL.md", "utf8");

	assert.match(skill, /\/type\?target=ID/);
	assert.match(skill, /Input\.insertText/);
	assert.match(skill, /editor\.focus\(\)/);
});

test("web-access skill keeps browser assignment out of agent-visible operations", async () => {
	const skill = await readFile("runtime/skills-user/web-access/SKILL.md", "utf8");

	assert.match(skill, /must not inspect, list, configure, switch, bind, clear, or change Agent \/ Conn browser settings/);
	assert.match(skill, /Browser assignment is a user-only Playground UI setting/);
	assert.match(skill, /Do not edit browser route caches/);
	assert.doesNotMatch(skill, /PATCH \/v1\/agents\/:agentId/);
	assert.doesNotMatch(skill, /GET \/v1\/browsers/);
	assert.doesNotMatch(skill, /Browser Binding Change Request/);
	assert.doesNotMatch(skill, /chrome-01/);
	assert.doesNotMatch(skill, /chrome-02/);
});

test("explicit browser search skills do not steer Docker users back to the Windows IPC bridge", async () => {
	const skillRoot = "runtime/skills-user";
	const browserSearchSkillPaths = [
		"x-search-latest",
		"ins-search-latest",
		"linkedin-search-latest",
		"tiktok-search-latest",
	].map((name) => join(skillRoot, name, "SKILL.md"));

	for (const skillPath of browserSearchSkillPaths) {
		const skill = await readFile(skillPath, "utf8");
		assert.doesNotMatch(
			skill,
			/start-web-access-browser\.ps1/,
			`${skillPath} should not tell Docker-sidecar users to start the Windows IPC bridge`,
		);
		assert.match(
			skill,
			/docker:chrome:check|WEB_ACCESS_BROWSER_PROVIDER=direct_cdp|Chrome sidecar/,
			`${skillPath} should mention the sidecar-first browser readiness path`,
		);
	}
});

test("repository docs describe sidecar as primary and IPC as legacy fallback", async () => {
	const agents = await readFile("AGENTS.md", "utf8");
	const bridgeDoc = await readFile("docs/web-access-browser-bridge.md", "utf8");

	assert.doesNotMatch(agents, /web-access 真实浏览器链路走宿主 IPC bridge/);
	assert.match(agents, /Docker Chrome sidecar/);
	assert.match(agents, /legacy Windows host IPC fallback|Windows host IPC fallback/i);
	assert.match(bridgeDoc, /Primary runtime path/i);
	assert.match(bridgeDoc, /Legacy Windows host IPC fallback/i);
	assert.match(bridgeDoc, /WEB_ACCESS_BROWSER_PUBLIC_BASE_URL/);
});
