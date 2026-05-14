import { getAppConfig } from "../config.js";
import { createBrowserRegistryFromEnv } from "../browser/browser-registry.js";
import { BackgroundAgentProfileResolver } from "../agent/background-agent-profile.js";
import { ProjectBackgroundSessionFactory } from "../agent/background-agent-session-factory.js";
import { getTeamConfig } from "../team/team-config.js";
import { TeamWorkspace } from "../team/team-workspace.js";
import { TeamOrchestrator } from "../team/team-orchestrator.js";
import { DeterministicMockTeamRoleTaskRunner, CompositeTeamRoleTaskRunner } from "../team/team-role-task-runner.js";
import { createDefaultTeamTemplateRegistry } from "../team/team-template-registry.js";
import { AgentProfileTeamRoleTaskRunner } from "../team/agent-profile-team-role-task-runner.js";

async function main(): Promise<void> {
	const appConfig = getAppConfig();
	const config = getTeamConfig(appConfig);

	if (!config.enabled) {
		console.log("[team-worker] TEAM_RUNTIME_ENABLED is not true, exiting.");
		process.exit(0);
	}

	console.log(`[team-worker] starting (poll: ${config.workerPollIntervalMs}ms, maxConcurrent: ${config.maxConcurrentRuns})`);

	const workspace = new TeamWorkspace({ teamDataDir: config.dataDir });
	const templateRegistry = createDefaultTeamTemplateRegistry();

	const realRoles = process.env.TEAM_REAL_ROLES?.trim();
	const browserRegistry = createBrowserRegistryFromEnv();
	const agentProfileRunner = new AgentProfileTeamRoleTaskRunner({
		projectRoot: appConfig.projectRoot,
		teamDataDir: config.dataDir,
		profileResolver: new BackgroundAgentProfileResolver({ projectRoot: appConfig.projectRoot }),
		sessionFactory: new ProjectBackgroundSessionFactory(appConfig.projectRoot),
		defaultBrowserId: browserRegistry.defaultBrowserId,
	});
	const runner = realRoles
		? new CompositeTeamRoleTaskRunner(realRoles.split(",").map((r) => r.trim()), { agentProfileRunner })
		: new DeterministicMockTeamRoleTaskRunner();

	console.log(`[team-worker] runner: ${realRoles ? `composite (real: [${realRoles}])` : "mock"}`);

	let running = true;

	const shutdown = () => {
		console.log("[team-worker] shutting down...");
		running = false;
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	while (running) {
		try {
			const runIds = await workspace.listRunnableRunIds();
			if (runIds.length > 0) {
				console.log(`[team-worker] processing ${runIds.length} run(s)`);
			}

			const batch = runIds.slice(0, config.maxConcurrentRuns);
			for (const teamRunId of batch) {
				if (!running) break;

				// Read budgets from state instead of hardcoding
				const state = await workspace.readState(teamRunId);
				const orchestrator = new TeamOrchestrator({
					workspace,
					roleTaskRunner: runner,
					templateRegistry,
					maxRounds: state.budgets.maxRounds,
					maxCandidates: state.budgets.maxCandidates,
					maxMinutes: state.budgets.maxMinutes,
					roleTaskTimeoutMs: config.roleTaskTimeoutMs,
					roleTaskMaxRetries: config.roleTaskMaxRetries,
				});

				try {
					await orchestrator.tick(teamRunId);
					const updatedState = await workspace.readState(teamRunId);
					console.log(`[team-worker] tick done: ${teamRunId} → ${updatedState.status}`);
				} catch (err) {
					console.error(`[team-worker] tick failed: ${teamRunId}: ${(err as Error).message}`);
				}
			}
		} catch (err) {
			console.error(`[team-worker] poll error: ${(err as Error).message}`);
		}

		if (running) {
			await new Promise((resolve) => setTimeout(resolve, config.workerPollIntervalMs));
		}
	}

	console.log("[team-worker] stopped.");
}

main().catch((err) => {
	console.error("[team-worker] fatal:", err);
	process.exit(1);
});
