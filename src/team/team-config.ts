import { getAppConfig, type AppConfig } from "../config.js";

export interface TeamRuntimeConfig {
	enabled: boolean;
	dataDir: string;
	workerPollIntervalMs: number;
	maxConcurrentRuns: number;
	maxConcurrentRoleTasks: number;
	roleTaskTimeoutMs: number;
	roleTaskMaxRetries: number;
}

export function getTeamConfig(appConfig?: AppConfig): TeamRuntimeConfig {
	const config = appConfig ?? getAppConfig();
	return {
		enabled: config.teamRuntimeEnabled,
		dataDir: config.teamDataDir,
		workerPollIntervalMs: config.teamWorkerPollIntervalMs,
		maxConcurrentRuns: config.teamMaxConcurrentRuns,
		maxConcurrentRoleTasks: config.teamMaxConcurrentRoleTasks,
		roleTaskTimeoutMs: config.teamRoleTaskTimeoutMs,
		roleTaskMaxRetries: config.teamRoleTaskMaxRetries,
	};
}
