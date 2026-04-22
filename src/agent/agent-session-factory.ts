import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
	AuthStorage,
	createAgentSession,
	DefaultResourceLoader,
	ModelRegistry,
	SessionManager,
} from "@mariozechner/pi-coding-agent";

export interface TextDeltaAssistantEventLike {
	type: "text_delta";
	delta: string;
}

export interface AssistantMessageEventLike {
	type: string;
	delta?: string;
}

export interface MessageUpdateEventLike {
	type: "message_update";
	assistantMessageEvent: TextDeltaAssistantEventLike | AssistantMessageEventLike;
}

export interface ToolExecutionStartEventLike {
	type: "tool_execution_start";
	toolCallId: string;
	toolName: string;
	args?: unknown;
}

export interface ToolExecutionUpdateEventLike {
	type: "tool_execution_update";
	toolCallId: string;
	toolName: string;
	args?: unknown;
	partialResult?: unknown;
}

export interface ToolExecutionEndEventLike {
	type: "tool_execution_end";
	toolCallId: string;
	toolName: string;
	result?: unknown;
	isError: boolean;
}

export interface QueueUpdateEventLike {
	type: "queue_update";
	steering: readonly string[];
	followUp: readonly string[];
}

export type AgentSessionEventLike =
	| MessageUpdateEventLike
	| ToolExecutionStartEventLike
	| ToolExecutionUpdateEventLike
	| ToolExecutionEndEventLike
	| QueueUpdateEventLike;

export type RawAgentSessionEventLike = AgentSessionEventLike | { type: string; [key: string]: unknown };

export interface PromptOptionsLike {
	streamingBehavior?: "steer" | "followUp";
}

export interface AgentSessionLike {
	sessionFile?: string;
	messages?: Array<{
		role: string;
		content?: unknown;
		stopReason?: string;
		errorMessage?: string;
		timestamp?: number | string;
	}>;
	subscribe(listener: (event: RawAgentSessionEventLike) => void): () => void;
	prompt(message: string, options?: PromptOptionsLike): Promise<void>;
	steer?(message: string): Promise<void>;
	followUp?(message: string): Promise<void>;
	abort?(): Promise<void>;
	clearQueue?(): { steering: string[]; followUp: string[] };
}

export interface AgentSessionFactory {
	createSession(input: { conversationId: string; sessionFile?: string }): Promise<AgentSessionLike>;
	getAvailableSkills?(): Promise<Array<{ name: string; path?: string }>>;
	getSkillFingerprint?(): Promise<string | undefined>;
	getDefaultModelContext?(): ProjectDefaultModelContext;
}

export interface DefaultAgentSessionFactoryOptions {
	projectRoot: string;
	sessionDir: string;
	agentDir?: string;
	allowedSkillPaths?: string[];
}

export interface ProjectDefaultModelContext {
	provider: string;
	model: string;
	contextWindow: number;
	maxResponseTokens: number;
	reserveTokens: number;
}

export function getDefaultSystemSkillPath(projectRoot: string): string {
	return join(projectRoot, ".pi", "skills");
}

export function getDefaultUserSkillPath(projectRoot: string): string {
	return join(projectRoot, "runtime", "skills-user");
}

export function getProjectAgentDirPath(projectRoot: string): string {
	return join(projectRoot, "runtime", "pi-agent");
}

export function getProjectModelsPath(projectRoot: string): string {
	return join(getProjectAgentDirPath(projectRoot), "models.json");
}

export function getProjectSettingsPath(projectRoot: string): string {
	return join(projectRoot, ".pi", "settings.json");
}

export function getDefaultAllowedSkillPaths(projectRoot: string): string[] {
	return [getDefaultSystemSkillPath(projectRoot), getDefaultUserSkillPath(projectRoot)];
}

export function createSkillRestrictedResourceLoader(options: {
	projectRoot: string;
	agentDir?: string;
	allowedSkillPaths: string[];
}): DefaultResourceLoader {
	return new DefaultResourceLoader({
		cwd: options.projectRoot,
		agentDir: options.agentDir,
		noSkills: true,
		additionalSkillPaths: options.allowedSkillPaths,
	});
}

async function collectSkillFiles(rootPath: string): Promise<string[]> {
	try {
		const entries = await readdir(rootPath, { withFileTypes: true });
		const files = await Promise.all(
			entries.map(async (entry) => {
				const nextPath = join(rootPath, entry.name);
				if (entry.isDirectory()) {
					return await collectSkillFiles(nextPath);
				}
				return entry.isFile() && entry.name === "SKILL.md" ? [nextPath] : [];
			}),
		);
		return files.flat();
	} catch (error) {
		if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

async function buildSkillFingerprint(allowedSkillPaths: string[]): Promise<string> {
	const hash = createHash("sha256");
	hash.update(JSON.stringify([...allowedSkillPaths].sort()));

	for (const rootPath of allowedSkillPaths) {
		const skillFiles = (await collectSkillFiles(rootPath)).sort();
		for (const skillFile of skillFiles) {
			hash.update(`${relative(rootPath, skillFile)}\n`);
			hash.update(await readFile(skillFile, "utf8"));
			hash.update("\n---\n");
		}
	}

	return hash.digest("hex");
}

function readProjectSettingValue(fileContent: string, key: string): string | undefined {
	const match = fileContent.match(new RegExp(`"${key}"\\s*:\\s*("([^"]+)"|(\\d+))`, "i"));
	return match?.[2] ?? match?.[3];
}

export function resolveProjectDefaultModelContext(projectRoot: string): ProjectDefaultModelContext {
	const fallback: ProjectDefaultModelContext = {
		provider: "unknown",
		model: "unknown",
		contextWindow: 128000,
		maxResponseTokens: 16384,
		reserveTokens: 16384,
	};

	let settingsContent = "";
	try {
		settingsContent = readFileSyncUtf8(getProjectSettingsPath(projectRoot));
	} catch {
		return fallback;
	}

	const provider = readProjectSettingValue(settingsContent, "defaultProvider") ?? fallback.provider;
	const model = readProjectSettingValue(settingsContent, "defaultModel") ?? fallback.model;
	const reserveTokens = Number(readProjectSettingValue(settingsContent, "reserveTokens") ?? fallback.reserveTokens);

	const registry = ModelRegistry.create(AuthStorage.create(), getProjectModelsPath(projectRoot));
	const resolvedModel = registry.find(provider, model);
	if (!resolvedModel) {
		return {
			...fallback,
			provider,
			model,
			reserveTokens: Number.isFinite(reserveTokens) ? reserveTokens : fallback.reserveTokens,
		};
	}

	return {
		provider: resolvedModel.provider,
		model: resolvedModel.id,
		contextWindow: resolvedModel.contextWindow,
		maxResponseTokens: resolvedModel.maxTokens,
		reserveTokens: Number.isFinite(reserveTokens) ? reserveTokens : fallback.reserveTokens,
	};
}

function readFileSyncUtf8(filePath: string): string {
	return readFileSync(filePath, "utf8");
}

export function createDefaultAgentSessionFactory(
	options: DefaultAgentSessionFactoryOptions,
): AgentSessionFactory {
	const allowedSkillPaths = options.allowedSkillPaths ?? getDefaultAllowedSkillPaths(options.projectRoot);
	const defaultModelContext = resolveProjectDefaultModelContext(options.projectRoot);

	async function loadSkills(): Promise<Array<{ name: string; path?: string }>> {
		const resourceLoader = createSkillRestrictedResourceLoader({
			projectRoot: options.projectRoot,
			agentDir: options.agentDir,
			allowedSkillPaths,
		});
		await resourceLoader.reload();
		const result = await resourceLoader.getSkills();
		return result.skills
			.map((skill) => ({
				name: skill.name,
				path: "path" in skill && typeof skill.path === "string" ? skill.path : undefined,
			}))
			.sort((left, right) => left.name.localeCompare(right.name));
	}

	return {
		async createSession(input) {
			const sessionManager = input.sessionFile
				? SessionManager.open(input.sessionFile, options.sessionDir)
				: SessionManager.create(options.projectRoot, options.sessionDir);
			const authStorage = AuthStorage.create();
			const modelRegistry = ModelRegistry.create(authStorage, getProjectModelsPath(options.projectRoot));
			const resourceLoader = createSkillRestrictedResourceLoader({
				projectRoot: options.projectRoot,
				agentDir: options.agentDir,
				allowedSkillPaths,
			});

			await resourceLoader.reload();

			const { session } = await createAgentSession({
				cwd: options.projectRoot,
				agentDir: options.agentDir,
				authStorage,
				modelRegistry,
				sessionManager,
				resourceLoader,
			});

			return session;
		},
		async getAvailableSkills() {
			return await loadSkills();
		},
		async getSkillFingerprint() {
			return await buildSkillFingerprint(allowedSkillPaths);
		},
		getDefaultModelContext() {
			return defaultModelContext;
		},
	};
}
