import { createHash } from "node:crypto";
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
	}>;
	subscribe(listener: (event: AgentSessionEventLike | { type: string }) => void): () => void;
	prompt(message: string, options?: PromptOptionsLike): Promise<void>;
	abort?(): Promise<void>;
	clearQueue?(): { steering: string[]; followUp: string[] };
}

export interface AgentSessionFactory {
	createSession(input: { conversationId: string; sessionFile?: string }): Promise<AgentSessionLike>;
	getAvailableSkills?(): Promise<Array<{ name: string; path?: string }>>;
	getSkillFingerprint?(): Promise<string | undefined>;
}

export interface DefaultAgentSessionFactoryOptions {
	projectRoot: string;
	sessionDir: string;
	agentDir?: string;
	allowedSkillPaths?: string[];
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

export function createDefaultAgentSessionFactory(
	options: DefaultAgentSessionFactoryOptions,
): AgentSessionFactory {
	const allowedSkillPaths = options.allowedSkillPaths ?? getDefaultAllowedSkillPaths(options.projectRoot);

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
	};
}
