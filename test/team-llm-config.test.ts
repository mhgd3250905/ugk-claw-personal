import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadLLMConfig } from "../src/team/llm.js";

async function createProjectRoot(input: {
	api: "anthropic-messages" | "openai-completions";
	baseUrl: string;
}): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-team-llm-"));
	await mkdir(join(root, ".pi"), { recursive: true });
	await mkdir(join(root, "runtime", "pi-agent"), { recursive: true });
	await writeFile(
		join(root, ".pi", "settings.json"),
		JSON.stringify({
			defaultProvider: "deepseek",
			defaultModel: "deepseek-v4-pro",
		}),
		"utf8",
	);
	await writeFile(
		join(root, "runtime", "pi-agent", "models.json"),
		JSON.stringify({
			providers: {
				deepseek: {
					name: "DeepSeek",
					vendor: "deepseek",
					baseUrl: input.baseUrl,
					api: input.api,
					apiKey: "TEST_TEAM_DEEPSEEK_API_KEY",
					models: [
						{ id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
						{ id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" },
					],
				},
			},
		}),
		"utf8",
	);
	return root;
}

test("team LLM config follows project default provider model and api type", async () => {
	const previousKey = process.env.TEST_TEAM_DEEPSEEK_API_KEY;
	process.env.TEST_TEAM_DEEPSEEK_API_KEY = "sk-team-test";
	try {
		const projectRoot = await createProjectRoot({
			api: "anthropic-messages",
			baseUrl: "https://api.deepseek.com/anthropic",
		});

		const config = loadLLMConfig(projectRoot);

		assert.equal(config.provider, "deepseek");
		assert.equal(config.model, "deepseek-v4-pro");
		assert.equal(config.api, "anthropic-messages");
		assert.equal(config.baseUrl, "https://api.deepseek.com/anthropic");
		assert.equal(config.apiKey, "sk-team-test");
	} finally {
		if (previousKey === undefined) {
			delete process.env.TEST_TEAM_DEEPSEEK_API_KEY;
		} else {
			process.env.TEST_TEAM_DEEPSEEK_API_KEY = previousKey;
		}
	}
});

test("team LLM config reports provider model and env var when auth is missing", async () => {
	const previousKey = process.env.TEST_TEAM_DEEPSEEK_API_KEY;
	delete process.env.TEST_TEAM_DEEPSEEK_API_KEY;
	try {
		const projectRoot = await createProjectRoot({
			api: "anthropic-messages",
			baseUrl: "https://api.deepseek.com/anthropic",
		});

		assert.throws(
			() => loadLLMConfig(projectRoot),
			/Team LLM API key missing for deepseek\/deepseek-v4-pro \(env: TEST_TEAM_DEEPSEEK_API_KEY\)/,
		);
	} finally {
		if (previousKey !== undefined) {
			process.env.TEST_TEAM_DEEPSEEK_API_KEY = previousKey;
		}
	}
});

test("checked-in Team LLM config uses the project DeepSeek Anthropic-compatible provider", () => {
	const previousKey = process.env.DEEPSEEK_API_KEY;
	process.env.DEEPSEEK_API_KEY = "sk-team-real-config-test";
	try {
		const config = loadLLMConfig(process.cwd());

		assert.equal(config.provider, "deepseek");
		assert.equal(config.model, "deepseek-v4-pro");
		assert.equal(config.api, "anthropic-messages");
		assert.equal(config.baseUrl, "https://api.deepseek.com/anthropic");
	} finally {
		if (previousKey === undefined) {
			delete process.env.DEEPSEEK_API_KEY;
		} else {
			process.env.DEEPSEEK_API_KEY = previousKey;
		}
	}
});
