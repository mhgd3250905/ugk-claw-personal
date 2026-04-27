import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	AuthStorage,
	createAgentSession,
	ModelRegistry,
	SessionManager,
} from "@mariozechner/pi-coding-agent";
import {
	createSkillRestrictedResourceLoader,
	getProjectAgentDirPath,
	getProjectModelsPath,
	getProjectSettingsPath,
} from "./agent-session-factory.js";

export interface ModelConfigModelBody {
	id: string;
	name: string;
	contextWindow?: number;
	maxTokens?: number;
}

export interface ModelConfigProviderBody {
	id: string;
	models: ModelConfigModelBody[];
	auth: {
		configured: boolean;
		envVar?: string;
		source: "environment" | "literal" | "missing";
	};
}

export interface ModelConfigBody {
	current: {
		provider: string;
		model: string;
	};
	providers: ModelConfigProviderBody[];
}

export interface ModelConfigSelection {
	provider: string;
	model: string;
}

export type ModelValidationResult =
	| {
			ok: true;
	  }
	| {
			ok: false;
			code: "model_not_found" | "provider_validation_failed";
			message: string;
	  };

export type ModelConfigSaveResult =
	| {
			ok: true;
			current: ModelConfigSelection;
			effective: "new_sessions";
	  }
	| {
			ok: false;
			code: "model_not_found" | "provider_validation_failed";
			message: string;
	  };

export type ModelSelectionValidator = (selection: ModelConfigSelection) => Promise<ModelValidationResult>;

export interface ModelConfigStore {
	getConfig(): Promise<ModelConfigBody>;
	setDefault(selection: ModelConfigSelection): Promise<ModelConfigBody>;
	hasModel(selection: ModelConfigSelection): Promise<boolean>;
}

interface ProjectModelsJson {
	providers?: Record<
		string,
		{
			apiKey?: string;
			models?: Array<{ id?: string; name?: string; contextWindow?: number; maxTokens?: number }>;
		}
	>;
}

const FALLBACK_CURRENT_MODEL = {
	provider: "unknown",
	model: "unknown",
};

export function createFileModelConfigStore(projectRoot: string): ModelConfigStore {
	return {
		async getConfig(): Promise<ModelConfigBody> {
			const [settingsContent, modelsContent] = await Promise.all([
				readOptionalText(getProjectSettingsPath(projectRoot)),
				readOptionalText(getProjectModelsPath(projectRoot)),
			]);
			return {
				current: readDefaultSelection(settingsContent),
				providers: readProviders(modelsContent),
			};
		},
		async setDefault(selection): Promise<ModelConfigBody> {
			const settingsPath = getProjectSettingsPath(projectRoot);
			const settingsContent = await readOptionalText(settingsPath);
			const nextContent = replaceDefaultSelection(settingsContent || "{}", selection);
			await writeFile(settingsPath, nextContent, "utf8");
			return await this.getConfig();
		},
		async hasModel(selection): Promise<boolean> {
			const config = await this.getConfig();
			return Boolean(
				config.providers
					.find((provider) => provider.id === selection.provider)
					?.models.some((model) => model.id === selection.model),
			);
		},
	};
}

export async function saveDefaultModelConfig(
	store: ModelConfigStore,
	validator: ModelSelectionValidator,
	selection: ModelConfigSelection,
): Promise<ModelConfigSaveResult> {
	if (!(await store.hasModel(selection))) {
		return {
			ok: false,
			code: "model_not_found",
			message: `Model not found: ${selection.provider}/${selection.model}`,
		};
	}

	const validation = await validator(selection);
	if (!validation.ok) {
		return validation;
	}

	await store.setDefault(selection);
	return {
		ok: true,
		current: selection,
		effective: "new_sessions",
	};
}

export function createLiveModelSelectionValidator(projectRoot: string): ModelSelectionValidator {
	return async (selection) => {
		const authStorage = AuthStorage.create();
		const modelRegistry = ModelRegistry.create(authStorage, getProjectModelsPath(projectRoot));
		const model = modelRegistry.find(selection.provider, selection.model);
		if (!model) {
			return {
				ok: false,
				code: "model_not_found",
				message: `Model not found: ${selection.provider}/${selection.model}`,
			};
		}

		try {
			const resourceLoader = createSkillRestrictedResourceLoader({
				projectRoot,
				agentDir: getProjectAgentDirPath(projectRoot),
				allowedSkillPaths: [],
			});
			await resourceLoader.reload();
			const { session } = await createAgentSession({
				cwd: projectRoot,
				agentDir: getProjectAgentDirPath(projectRoot),
				authStorage,
				modelRegistry,
				model,
				sessionManager: SessionManager.inMemory(projectRoot),
				resourceLoader,
				tools: [],
			});
			await session.prompt("Reply exactly: UGK_PROVIDER_OK");
			const lastMessage = session.messages?.at(-1) as { content?: unknown } | undefined;
			const text = stringifyMessageContent(lastMessage?.content);
			if (!text.includes("UGK_PROVIDER_OK")) {
				return {
					ok: false,
					code: "provider_validation_failed",
					message: "Provider responded, but did not return the expected validation text.",
				};
			}
			return { ok: true };
		} catch (error) {
			return {
				ok: false,
				code: "provider_validation_failed",
				message: error instanceof Error ? error.message : "Unknown provider validation error",
			};
		}
	};
}

function readDefaultSelection(settingsContent: string): ModelConfigSelection {
	return {
		provider: readSettingsValue(settingsContent, "defaultProvider") ?? FALLBACK_CURRENT_MODEL.provider,
		model: readSettingsValue(settingsContent, "defaultModel") ?? FALLBACK_CURRENT_MODEL.model,
	};
}

function readSettingsValue(content: string, key: string): string | undefined {
	const match = content.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`));
	return match?.[1];
}

function replaceDefaultSelection(content: string, selection: ModelConfigSelection): string {
	let nextContent = content;
	nextContent = replaceOrInsertJsonStringProperty(nextContent, "defaultProvider", selection.provider);
	nextContent = replaceOrInsertJsonStringProperty(nextContent, "defaultModel", selection.model);
	return nextContent.endsWith("\n") ? nextContent : `${nextContent}\n`;
}

function replaceOrInsertJsonStringProperty(content: string, key: string, value: string): string {
	const escapedValue = JSON.stringify(value);
	const propertyPattern = new RegExp(`("${key}"\\s*:\\s*)"[^"]*"`);
	if (propertyPattern.test(content)) {
		return content.replace(propertyPattern, `$1${escapedValue}`);
	}
	const closingBraceIndex = content.lastIndexOf("}");
	const propertyLine = `  "${key}": ${escapedValue}`;
	if (closingBraceIndex < 0) {
		return `{\n${propertyLine}\n}`;
	}
	const before = content.slice(0, closingBraceIndex).trimEnd();
	const after = content.slice(closingBraceIndex);
	const separator = before.endsWith("{") ? "\n" : ",\n";
	return `${before}${separator}${propertyLine}\n${after}`;
}

function readProviders(modelsContent: string): ModelConfigProviderBody[] {
	if (!modelsContent.trim()) {
		return [];
	}

	const parsed = JSON.parse(modelsContent) as ProjectModelsJson;
	const providers = parsed.providers ?? {};
	return Object.entries(providers)
		.map(([providerId, provider]) => ({
			id: providerId,
			models: (provider.models ?? [])
				.filter((model): model is { id: string; name?: string; contextWindow?: number; maxTokens?: number } =>
					typeof model.id === "string" && model.id.length > 0)
				.map((model) => ({
					id: model.id,
					name: model.name ?? model.id,
					contextWindow: normalizePositiveNumber(model.contextWindow),
					maxTokens: normalizePositiveNumber(model.maxTokens),
				})),
			auth: resolveProviderAuth(provider.apiKey),
		}))
		.sort((left, right) => left.id.localeCompare(right.id));
}

function normalizePositiveNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function resolveProviderAuth(apiKey: string | undefined): ModelConfigProviderBody["auth"] {
	if (!apiKey || !apiKey.trim()) {
		return {
			configured: false,
			source: "missing",
		};
	}
	const trimmed = apiKey.trim();
	if (/^[A-Z][A-Z0-9_]+$/.test(trimmed)) {
		return {
			configured: Boolean(process.env[trimmed]?.trim()),
			envVar: trimmed,
			source: process.env[trimmed]?.trim() ? "environment" : "missing",
		};
	}
	return {
		configured: true,
		source: "literal",
	};
}

function stringifyMessageContent(content: unknown): string {
	if (typeof content === "string") {
		return content;
	}
	if (!Array.isArray(content)) {
		return "";
	}
	return content
		.map((part) => {
			if (typeof part === "string") {
				return part;
			}
			if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
				return part.text;
			}
			return "";
		})
		.join("");
}

async function readOptionalText(filePath: string): Promise<string> {
	try {
		return await readFile(filePath, "utf8");
	} catch (error) {
		if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
			return "";
		}
		throw error;
	}
}
