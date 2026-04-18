import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface AppConfig {
	host: string;
	port: number;
	projectRoot: string;
	dataDir: string;
	agentDataDir: string;
	agentSessionsDir: string;
	conversationIndexPath: string;
	agentFilesDir: string;
	fileIndexPath: string;
}

export function loadApiKeyFromApiTxt(
	projectRoot: string,
	envVarName: string = "DASHSCOPE_CODING_API_KEY",
): string | undefined {
	const existingValue = process.env[envVarName];
	if (existingValue && existingValue.trim().length > 0) {
		return existingValue;
	}

	const apiTxtPath = join(projectRoot, "api.txt");
	if (!existsSync(apiTxtPath)) {
		return undefined;
	}

	const content = readFileSync(apiTxtPath, "utf8");
	const match = content.match(/api-key:\s*(\S+)/i);
	const apiKey = match?.[1]?.trim();
	if (!apiKey) {
		return undefined;
	}

	process.env[envVarName] = apiKey;
	return apiKey;
}

export function getAppConfig(projectRoot: string = process.cwd()): AppConfig {
	loadApiKeyFromApiTxt(projectRoot);
	const dataDir = join(projectRoot, ".data");
	const agentDataDir = join(dataDir, "agent");
	const agentSessionsDir = join(agentDataDir, "sessions");
	const conversationIndexPath = join(agentDataDir, "conversation-index.json");
	const agentFilesDir = join(agentDataDir, "files");
	const fileIndexPath = join(agentDataDir, "file-index.json");

	return {
		host: process.env.HOST ?? "127.0.0.1",
		port: Number(process.env.PORT ?? "3000"),
		projectRoot,
		dataDir,
		agentDataDir,
		agentSessionsDir,
		conversationIndexPath,
		agentFilesDir,
		fileIndexPath,
	};
}
