import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createStoredAgentProfile,
	loadAgentProfilesSync,
	normalizeOptionalModelSelection,
	updateStoredAgentProfile,
} from "../src/agent/agent-profile-catalog.js";
import { resolveAgentProfile } from "../src/agent/agent-profile.js";

test("normalizeOptionalModelSelection returns empty when both fields are omitted", () => {
	const result = normalizeOptionalModelSelection({});
	assert.deepEqual(result, {});
});

test("normalizeOptionalModelSelection returns empty when both fields are empty strings", () => {
	const result = normalizeOptionalModelSelection({ defaultModelProvider: "", defaultModelId: "" });
	assert.deepEqual(result, {});
});

test("normalizeOptionalModelSelection returns trimmed pair when both are provided", () => {
	const result = normalizeOptionalModelSelection({
		defaultModelProvider: " deepseek ",
		defaultModelId: " deepseek-v4-pro ",
	});
	assert.deepEqual(result, { defaultModelProvider: "deepseek", defaultModelId: "deepseek-v4-pro" });
});

test("normalizeOptionalModelSelection rejects provider-only input", () => {
	assert.throws(
		() => normalizeOptionalModelSelection({ defaultModelProvider: "deepseek", defaultModelId: "" }),
		/must be provided together/,
	);
});

test("normalizeOptionalModelSelection rejects model-only input", () => {
	assert.throws(
		() => normalizeOptionalModelSelection({ defaultModelProvider: "", defaultModelId: "deepseek-v4-pro" }),
		/must be provided together/,
	);
});

test("normalizeOptionalModelSelection rejects null model when provider is present", () => {
	assert.throws(
		() => normalizeOptionalModelSelection({ defaultModelProvider: "deepseek", defaultModelId: null }),
		/must be provided together/,
	);
});

test("createStoredAgentProfile persists agent model fields", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-model-"));

	await createStoredAgentProfile(projectRoot, {
		agentId: "coder",
		name: "编码 Agent",
		description: "用于编码任务。",
		defaultModelProvider: "deepseek",
		defaultModelId: "deepseek-v4-pro",
	});
	const loaded = loadAgentProfilesSync(projectRoot);
	const coder = resolveAgentProfile(loaded, "coder");

	assert.ok(coder);
	assert.equal(coder.defaultModelProvider, "deepseek");
	assert.equal(coder.defaultModelId, "deepseek-v4-pro");
});

test("createStoredAgentProfile omits model fields when not provided", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-model-"));

	await createStoredAgentProfile(projectRoot, {
		agentId: "plain",
		name: "普通 Agent",
		description: "无模型配置。",
	});
	const loaded = loadAgentProfilesSync(projectRoot);
	const plain = resolveAgentProfile(loaded, "plain");

	assert.ok(plain);
	assert.equal(plain.defaultModelProvider, undefined);
	assert.equal(plain.defaultModelId, undefined);
});

test("updateStoredAgentProfile sets model fields on an existing profile", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-model-"));
	await createStoredAgentProfile(projectRoot, {
		agentId: "research",
		name: "研究 Agent",
		description: "用于资料研究。",
	});

	await updateStoredAgentProfile(projectRoot, "research", {
		name: "研究 Agent",
		description: "用于资料研究。",
		defaultModelProvider: "zhipu-glm",
		defaultModelId: "glm-5.1",
	});
	const loaded = loadAgentProfilesSync(projectRoot);
	const research = resolveAgentProfile(loaded, "research");

	assert.ok(research);
	assert.equal(research.defaultModelProvider, "zhipu-glm");
	assert.equal(research.defaultModelId, "glm-5.1");
});

test("updateStoredAgentProfile clears model fields when set to null", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-model-"));
	await createStoredAgentProfile(projectRoot, {
		agentId: "research",
		name: "研究 Agent",
		description: "用于资料研究。",
		defaultModelProvider: "deepseek",
		defaultModelId: "deepseek-v4-pro",
	});

	await updateStoredAgentProfile(projectRoot, "research", {
		name: "研究 Agent",
		description: "用于资料研究。",
		defaultModelProvider: null,
		defaultModelId: null,
	});
	const loaded = loadAgentProfilesSync(projectRoot);
	const research = resolveAgentProfile(loaded, "research");

	assert.ok(research);
	assert.equal(research.defaultModelProvider, undefined);
	assert.equal(research.defaultModelId, undefined);
});

test("updateStoredAgentProfile preserves existing model when patch omits model fields", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "ugk-pi-agent-model-"));
	await createStoredAgentProfile(projectRoot, {
		agentId: "research",
		name: "研究 Agent",
		description: "用于资料研究。",
		defaultModelProvider: "deepseek",
		defaultModelId: "deepseek-v4-pro",
	});

	await updateStoredAgentProfile(projectRoot, "research", {
		name: "资料 Agent",
		description: "更新名称。",
	});
	const loaded = loadAgentProfilesSync(projectRoot);
	const research = resolveAgentProfile(loaded, "research");

	assert.ok(research);
	assert.equal(research.name, "资料 Agent");
	assert.equal(research.defaultModelProvider, "deepseek");
	assert.equal(research.defaultModelId, "deepseek-v4-pro");
});
