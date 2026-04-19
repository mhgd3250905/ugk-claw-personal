import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	buildSubagentCliArgs,
	getDefaultAssetStoreExtensionPath,
	getDefaultConnExtensionPath,
	buildSubagentSpawnOptions,
	getDefaultProjectGuardExtensionPath,
	getProjectAgentDirPath,
	resolvePiCliEntry,
} from "../.pi/extensions/subagent/index.js";
import {
	discoverSubagents,
	getDefaultSystemAgentPath,
	getDefaultUserAgentPath,
} from "../.pi/extensions/subagent/agents.js";
import {
	getDefaultSystemSkillPath,
	getDefaultUserSkillPath,
} from "../src/agent/agent-session-factory.js";

test("discoverSubagents loads system and user directories with user definitions overriding system ones", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-subagents-"));
	const systemAgentsDir = getDefaultSystemAgentPath(projectRoot);
	const userAgentsDir = getDefaultUserAgentPath(projectRoot);

	await mkdir(systemAgentsDir, { recursive: true });
	await mkdir(userAgentsDir, { recursive: true });

	await writeFile(
		join(systemAgentsDir, "scout.md"),
		[
			"---",
			"name: scout",
			"description: system scout",
			"tools: read, grep",
			"---",
			"System scout prompt.",
			"",
		].join("\n"),
		"utf8",
	);
	await writeFile(
		join(systemAgentsDir, "reviewer.md"),
		[
			"---",
			"name: reviewer",
			"description: system reviewer",
			"---",
			"System reviewer prompt.",
			"",
		].join("\n"),
		"utf8",
	);
	await writeFile(
		join(userAgentsDir, "reviewer.md"),
		[
			"---",
			"name: reviewer",
			"description: user reviewer override",
			"tools: read, ls",
			"---",
			"User reviewer prompt.",
			"",
		].join("\n"),
		"utf8",
	);

	const agents = discoverSubagents({ projectRoot });

	assert.deepEqual(
		agents.map((agent) => ({
			name: agent.name,
			description: agent.description,
			source: agent.source,
			tools: agent.tools,
		})),
		[
			{
				name: "reviewer",
				description: "user reviewer override",
				source: "user",
				tools: ["read", "ls"],
			},
			{
				name: "scout",
				description: "system scout",
				source: "system",
				tools: ["read", "grep"],
			},
		],
	);

	assert.equal(agents[0]?.systemPrompt.includes("User reviewer prompt."), true);
});

test("buildSubagentCliArgs locks child pi to project-approved extensions and skills", () => {
	const projectRoot = "E:/AII/ugk-pi";
	const promptFile = "E:/tmp/subagent-system-prompt.md";

	const args = buildSubagentCliArgs({
		projectRoot,
		task: "Investigate session reuse",
		systemPromptFile: promptFile,
		model: "glm-5",
		tools: ["read", "grep", "find", "ls"],
	});

	assert.deepEqual(args.slice(0, 5), ["--mode", "json", "-p", "--no-session", "--no-extensions"]);
	assert.equal(args.includes(getDefaultProjectGuardExtensionPath(projectRoot)), true);
	assert.equal(args.includes(getDefaultAssetStoreExtensionPath(projectRoot)), true);
	assert.equal(args.includes(getDefaultConnExtensionPath(projectRoot)), true);
	assert.equal(args.includes("--no-skills"), true);
	assert.equal(args.includes("--skill"), true);
	assert.equal(args.includes(getDefaultSystemSkillPath(projectRoot)), true);
	assert.equal(args.includes(getDefaultUserSkillPath(projectRoot)), true);
	assert.equal(args.includes("--append-system-prompt"), true);
	assert.equal(args.includes(promptFile), true);
	assert.equal(args.includes("--model"), true);
	assert.equal(args.includes("glm-5"), true);
	assert.equal(args.includes("--tools"), true);
	assert.equal(args.includes("read,grep,find,ls"), true);
	assert.equal(args.at(-1), "Task: Investigate session reuse");
});

test("buildSubagentCliArgs inherits default provider and model from the project root settings", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-subagent-settings-"));
	await mkdir(join(projectRoot, ".pi"), { recursive: true });
	await writeFile(
		join(projectRoot, ".pi", "settings.json"),
		JSON.stringify({
			defaultProvider: "dashscope-coding",
			defaultModel: "glm-5",
		}),
		"utf8",
	);

	const args = buildSubagentCliArgs({
		projectRoot,
		task: "Reply with exactly SUBAGENT_OK",
	});

	const providerIndex = args.indexOf("--provider");
	const modelIndex = args.indexOf("--model");

	assert.notEqual(providerIndex, -1);
	assert.notEqual(modelIndex, -1);
	assert.equal(args[providerIndex + 1], "dashscope-coding");
	assert.equal(args[modelIndex + 1], "glm-5");
});

test("buildSubagentSpawnOptions hides console windows on Windows", () => {
	const options = buildSubagentSpawnOptions("E:/AII/ugk-pi", "win32");

	assert.equal(options.cwd, "E:/AII/ugk-pi");
	assert.equal(options.shell, false);
	assert.equal(options.windowsHide, true);
	assert.deepEqual(options.stdio, ["ignore", "pipe", "pipe"]);
	assert.equal(options.env?.PI_CODING_AGENT_DIR, getProjectAgentDirPath("E:/AII/ugk-pi"));
});

test("resolvePiCliEntry returns an existing local pi CLI entry", () => {
	const cliEntry = resolvePiCliEntry();

	assert.equal(existsSync(cliEntry), true);
	assert.equal(cliEntry.endsWith("cli.js"), true);
});
