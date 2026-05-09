import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getAppConfig, loadApiKeyFromApiTxt } from "../src/config.js";

test("loads ANTHROPIC_AUTH_TOKEN from zhipu-api.txt when environment variable is absent", async () => {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-config-"));
	const apiTxtPath = join(dir, "zhipu-api.txt");
	await writeFile(apiTxtPath, "api-key: sk-test-123", "utf8");
	delete process.env.ANTHROPIC_AUTH_TOKEN;

	const loaded = loadApiKeyFromApiTxt(dir);

	assert.equal(loaded, "sk-test-123");
	assert.equal(process.env.ANTHROPIC_AUTH_TOKEN, "sk-test-123");
	delete process.env.ANTHROPIC_AUTH_TOKEN;
});

test("loads DEEPSEEK_API_KEY from deepseek-api.txt when environment variable is absent", async () => {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-config-"));
	const apiTxtPath = join(dir, "deepseek-api.txt");
	await writeFile(apiTxtPath, "api-key = sk-deepseek-test-123", "utf8");

	const loaded = loadApiKeyFromApiTxt(dir, "TEST_DEEPSEEK_KEY", "deepseek-api.txt");

	assert.equal(loaded, "sk-deepseek-test-123");
	assert.equal(process.env.TEST_DEEPSEEK_KEY, "sk-deepseek-test-123");
	delete process.env.TEST_DEEPSEEK_KEY;
});

test("loads XIAOMI_MIMO_API_KEY from 小米api.txt with apikey spelling", async () => {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-config-"));
	const apiTxtPath = join(dir, "小米api.txt");
	await writeFile(apiTxtPath, "model_name:mimo-v2.5-pro\napikey:tp-xiaomi-test-123\n", "utf8");
	delete process.env.XIAOMI_MIMO_API_KEY;

	getAppConfig(dir);

	assert.equal(process.env.XIAOMI_MIMO_API_KEY, "tp-xiaomi-test-123");
	delete process.env.XIAOMI_MIMO_API_KEY;
});

test("loads ANTHROPIC_AUTH_TOKEN from Claude-style JSON env settings", async () => {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-config-"));
	const apiTxtPath = join(dir, "zhipu-api.txt");
	await writeFile(
		apiTxtPath,
		JSON.stringify({
			env: {
				ANTHROPIC_AUTH_TOKEN: "zhipu-json-token",
				ANTHROPIC_BASE_URL: "https://open.bigmodel.cn/api/anthropic",
				ANTHROPIC_MODEL: "glm-5.1",
			},
		}),
		"utf8",
	);
	delete process.env.ANTHROPIC_AUTH_TOKEN;

	getAppConfig(dir);

	assert.equal(process.env.ANTHROPIC_AUTH_TOKEN, "zhipu-json-token");
	delete process.env.ANTHROPIC_AUTH_TOKEN;
});

test("keeps existing environment variable and does not override it from api.txt", async () => {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-config-"));
	const apiTxtPath = join(dir, "zhipu-api.txt");
	await writeFile(apiTxtPath, "api-key: sk-test-123", "utf8");
	process.env.ANTHROPIC_AUTH_TOKEN = "existing-value";

	const loaded = loadApiKeyFromApiTxt(dir);

	assert.equal(loaded, "existing-value");
	assert.equal(process.env.ANTHROPIC_AUTH_TOKEN, "existing-value");
	delete process.env.ANTHROPIC_AUTH_TOKEN;
});
