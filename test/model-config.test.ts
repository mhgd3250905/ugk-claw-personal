import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	createFileModelConfigStore,
	saveDefaultModelConfig,
	type ModelSelectionValidator,
} from "../src/agent/model-config.js";

async function createProjectRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-model-config-"));
	await mkdir(join(root, ".pi"), { recursive: true });
	await mkdir(join(root, "runtime", "pi-agent"), { recursive: true });
	await writeFile(
		join(root, ".pi", "settings.json"),
		[
			"{",
			'  // keep this comment',
			'  "defaultProvider": "dashscope-coding",',
			'  "defaultModel": "glm-5",',
			'  "defaultThinkingLevel": "medium"',
			"}",
		].join("\n"),
		"utf8",
	);
	await writeFile(
		join(root, "runtime", "pi-agent", "models.json"),
		JSON.stringify({
			providers: {
				"dashscope-coding": {
					apiKey: "DASHSCOPE_CODING_API_KEY",
					models: [{ id: "glm-5", name: "GLM-5" }],
				},
				"deepseek-anthropic": {
					apiKey: "DEEPSEEK_API_KEY",
					models: [
						{ id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", contextWindow: 1048576, maxTokens: 262144 },
						{ id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", contextWindow: 1048576, maxTokens: 262144 },
					],
				},
			},
		}),
		"utf8",
	);
	return root;
}

test("model config store lists providers and current default selection", async () => {
	const projectRoot = await createProjectRoot();
	process.env.TEST_DEEPSEEK_UNUSED = "";
	const store = createFileModelConfigStore(projectRoot);

	const config = await store.getConfig();

	assert.deepEqual(config.current, {
		provider: "dashscope-coding",
		model: "glm-5",
	});
	assert.deepEqual(
		config.providers.map((provider) => provider.id),
		["dashscope-coding", "deepseek-anthropic"],
	);
	assert.deepEqual(
		config.providers.find((provider) => provider.id === "deepseek-anthropic")?.models.map((model) => model.id),
		["deepseek-v4-pro", "deepseek-v4-flash"],
	);
	assert.deepEqual(config.providers.find((provider) => provider.id === "deepseek-anthropic")?.models[0], {
		id: "deepseek-v4-pro",
		name: "DeepSeek V4 Pro",
		contextWindow: 1048576,
		maxTokens: 262144,
	});
	assert.equal(config.providers.find((provider) => provider.id === "deepseek-anthropic")?.auth.envVar, "DEEPSEEK_API_KEY");
});

test("saveDefaultModelConfig validates before writing settings", async () => {
	const projectRoot = await createProjectRoot();
	const store = createFileModelConfigStore(projectRoot);
	const calls: Array<{ provider: string; model: string }> = [];
	const validator: ModelSelectionValidator = async (selection) => {
		calls.push(selection);
		return { ok: true };
	};

	const result = await saveDefaultModelConfig(store, validator, {
		provider: "deepseek-anthropic",
		model: "deepseek-v4-pro",
	});

	const settings = await readFile(join(projectRoot, ".pi", "settings.json"), "utf8");
	assert.equal(result.ok, true);
	assert.deepEqual(calls, [{ provider: "deepseek-anthropic", model: "deepseek-v4-pro" }]);
	assert.match(settings, /"defaultProvider": "deepseek-anthropic"/);
	assert.match(settings, /"defaultModel": "deepseek-v4-pro"/);
	assert.match(settings, /\/\/ keep this comment/);
});

test("saveDefaultModelConfig does not write settings when validation fails", async () => {
	const projectRoot = await createProjectRoot();
	const store = createFileModelConfigStore(projectRoot);
	const validator: ModelSelectionValidator = async () => ({
		ok: false,
		code: "provider_validation_failed",
		message: "model request failed",
	});

	const result = await saveDefaultModelConfig(store, validator, {
		provider: "deepseek-anthropic",
		model: "deepseek-v4-pro",
	});

	const settings = await readFile(join(projectRoot, ".pi", "settings.json"), "utf8");
	assert.deepEqual(result, {
		ok: false,
		code: "provider_validation_failed",
		message: "model request failed",
	});
	assert.match(settings, /"defaultProvider": "dashscope-coding"/);
	assert.match(settings, /"defaultModel": "glm-5"/);
});
