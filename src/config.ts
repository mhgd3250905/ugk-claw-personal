import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface AppConfig {
	host: string;
	port: number;
	publicBaseUrl?: string;
	projectRoot: string;
	dataDir: string;
	agentDataDir: string;
	agentSessionsDir: string;
	conversationIndexPath: string;
	agentAssetsDir: string;
	agentAssetBlobsDir: string;
	assetIndexPath: string;
	connDataDir: string;
	connIndexPath: string;
	feishuDataDir: string;
	feishuConversationMapPath: string;
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
	const agentAssetsDir = join(agentDataDir, "assets");
	const agentAssetBlobsDir = join(agentAssetsDir, "blobs");
	const assetIndexPath = join(agentDataDir, "asset-index.json");
	const connDataDir = join(agentDataDir, "conn");
	const connIndexPath = join(connDataDir, "conn-index.json");
	const feishuDataDir = join(agentDataDir, "feishu");
	const feishuConversationMapPath = join(feishuDataDir, "conversation-map.json");

	return {
		host: process.env.HOST ?? "127.0.0.1",
		port: Number(process.env.PORT ?? "3000"),
		publicBaseUrl: process.env.PUBLIC_BASE_URL?.trim() || undefined,
		projectRoot,
		dataDir,
		agentDataDir,
		agentSessionsDir,
		conversationIndexPath,
		agentAssetsDir,
		agentAssetBlobsDir,
		assetIndexPath,
		connDataDir,
		connIndexPath,
		feishuDataDir,
		feishuConversationMapPath,
	};
}
