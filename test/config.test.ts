import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadApiKeyFromApiTxt } from "../src/config.js";

test("loads DASHSCOPE_CODING_API_KEY from api.txt when environment variable is absent", async () => {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-config-"));
	const apiTxtPath = join(dir, "api.txt");
	await writeFile(apiTxtPath, "api-key: sk-test-123", "utf8");

	const loaded = loadApiKeyFromApiTxt(dir, "TEST_DASHSCOPE_KEY");

	assert.equal(loaded, "sk-test-123");
	assert.equal(process.env.TEST_DASHSCOPE_KEY, "sk-test-123");
	delete process.env.TEST_DASHSCOPE_KEY;
});

test("keeps existing environment variable and does not override it from api.txt", async () => {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-config-"));
	const apiTxtPath = join(dir, "api.txt");
	await writeFile(apiTxtPath, "api-key: sk-test-123", "utf8");
	process.env.TEST_DASHSCOPE_KEY = "existing-value";

	const loaded = loadApiKeyFromApiTxt(dir, "TEST_DASHSCOPE_KEY");

	assert.equal(loaded, "existing-value");
	assert.equal(process.env.TEST_DASHSCOPE_KEY, "existing-value");
	delete process.env.TEST_DASHSCOPE_KEY;
});
