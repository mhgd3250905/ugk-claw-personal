import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "@mariozechner/pi-coding-agent";

export type SubagentSource = "system" | "user";

export interface SubagentDefinition {
	name: string;
	description: string;
	systemPrompt: string;
	tools?: string[];
	model?: string;
	filePath: string;
	source: SubagentSource;
}

export interface DiscoverSubagentsOptions {
	projectRoot: string;
	systemAgentsDir?: string;
	userAgentsDir?: string;
}

export function getDefaultSystemAgentPath(projectRoot: string): string {
	return join(projectRoot, ".pi", "agents");
}

export function getDefaultUserAgentPath(projectRoot: string): string {
	return join(projectRoot, "runtime", "agents-user");
}

function isReadableDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

function loadSubagentsFromDir(directoryPath: string, source: SubagentSource): SubagentDefinition[] {
	if (!isReadableDirectory(directoryPath)) {
		return [];
	}

	const definitions: SubagentDefinition[] = [];
	for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
		if (!entry.name.endsWith(".md")) {
			continue;
		}
		if (!entry.isFile() && !entry.isSymbolicLink()) {
			continue;
		}

		const filePath = join(directoryPath, entry.name);
		const raw = readFileSync(filePath, "utf8");
		const { frontmatter, body } = parseFrontmatter<Record<string, string>>(raw);
		if (!frontmatter.name || !frontmatter.description) {
			continue;
		}

		const tools = frontmatter.tools
			?.split(",")
			.map((tool) => tool.trim())
			.filter((tool) => tool.length > 0);

		definitions.push({
			name: frontmatter.name,
			description: frontmatter.description,
			systemPrompt: body.trim(),
			tools: tools && tools.length > 0 ? tools : undefined,
			model: frontmatter.model?.trim() || undefined,
			filePath,
			source,
		});
	}

	return definitions.sort((left, right) => left.name.localeCompare(right.name));
}

export function discoverSubagents(options: DiscoverSubagentsOptions): SubagentDefinition[] {
	const systemAgentsDir = options.systemAgentsDir ?? getDefaultSystemAgentPath(options.projectRoot);
	const userAgentsDir = options.userAgentsDir ?? getDefaultUserAgentPath(options.projectRoot);

	const merged = new Map<string, SubagentDefinition>();
	for (const definition of loadSubagentsFromDir(systemAgentsDir, "system")) {
		merged.set(definition.name, definition);
	}
	for (const definition of loadSubagentsFromDir(userAgentsDir, "user")) {
		merged.set(definition.name, definition);
	}

	return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function hasProjectPiConfig(projectRoot: string): boolean {
	return existsSync(join(projectRoot, ".pi"));
}
