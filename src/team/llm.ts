import { readFileSync } from "node:fs";
import {
	getProjectModelsPath,
	readProjectSettingsContent,
} from "../agent/agent-session-factory.js";
import { readJsonScalarSetting } from "../agent/settings-json.js";

export type TeamLLMApiType = "anthropic-messages" | "openai-completions";

export interface LLMConfig {
	provider: string;
	apiKey: string;
	baseUrl: string;
	api: TeamLLMApiType;
	model: string;
}

interface ProjectModelsJson {
	providers?: Record<string, {
		baseUrl?: string;
		api?: string;
		apiKey?: string;
		models?: Array<{ id?: string }>;
	}>;
}

export function loadLLMConfig(projectRoot: string = process.cwd()): LLMConfig {
	const settingsContent = readProjectSettingsContent(projectRoot) ?? "";
	const providerId = readJsonScalarSetting(settingsContent, "defaultProvider");
	const modelId = readJsonScalarSetting(settingsContent, "defaultModel");
	if (!providerId || !modelId) {
		throw new Error("Team LLM default model is not configured in project settings");
	}

	const models = JSON.parse(readFileSync(getProjectModelsPath(projectRoot), "utf8")) as ProjectModelsJson;
	const provider = models.providers?.[providerId];
	if (!provider) {
		throw new Error(`Team LLM provider not found: ${providerId}`);
	}
	if (!provider.models?.some((model) => model.id === modelId)) {
		throw new Error(`Team LLM model not found: ${providerId}/${modelId}`);
	}

	const api = normalizeApiType(provider.api, providerId, modelId);
	const baseUrl = normalizeBaseUrl(provider.baseUrl, providerId, modelId);
	const apiKey = resolveApiKey(provider.apiKey, providerId, modelId);
	return { provider: providerId, apiKey, baseUrl, api, model: modelId };
}

export async function callLLM(config: LLMConfig, prompt: string): Promise<string> {
	if (config.api === "anthropic-messages") {
		const url = `${config.baseUrl}/v1/messages`;
		const resp = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json", "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" },
			body: JSON.stringify({ model: config.model, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
		});
		if (!resp.ok) throw new Error(`API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
		const data = (await resp.json()) as { content: Array<{ type: string; text?: string }> };
		return data.content.filter((b) => b.type === "text" && b.text).map((b) => b.text!).join("\n");
	}

	const url = `${config.baseUrl}/chat/completions`;
	const resp = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
		body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: prompt }], temperature: 0.3, max_tokens: 4000 }),
	});
	if (!resp.ok) throw new Error(`API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
	const data = (await resp.json()) as { choices: Array<{ message: { content: string } }> };
	return data.choices[0]?.message?.content ?? "";
}

function normalizeApiType(api: string | undefined, provider: string, model: string): TeamLLMApiType {
	if (api === "anthropic-messages" || api === "openai-completions") {
		return api;
	}
	throw new Error(`Team LLM api type unsupported for ${provider}/${model}: ${api ?? "missing"}`);
}

function normalizeBaseUrl(baseUrl: string | undefined, provider: string, model: string): string {
	const trimmed = baseUrl?.trim();
	if (!trimmed) {
		throw new Error(`Team LLM baseUrl missing for ${provider}/${model}`);
	}
	return trimmed.replace(/\/+$/, "");
}

function resolveApiKey(apiKeySetting: string | undefined, provider: string, model: string): string {
	const trimmed = apiKeySetting?.trim();
	if (!trimmed) {
		throw new Error(`Team LLM apiKey setting missing for ${provider}/${model}`);
	}
	if (/^[A-Z][A-Z0-9_]+$/.test(trimmed)) {
		const value = process.env[trimmed]?.trim();
		if (!value) {
			throw new Error(`Team LLM API key missing for ${provider}/${model} (env: ${trimmed})`);
		}
		return value;
	}
	return trimmed;
}
