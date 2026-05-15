import { getAppConfig } from "../config.js";
import { PlanStore } from "../team/plan-store.js";
import { TeamUnitStore } from "../team/team-unit-store.js";
import { RunWorkspace } from "../team/run-workspace.js";
import { TeamOrchestrator } from "../team/orchestrator.js";
import { MockRoleRunner } from "../team/role-runner.js";
import type { TeamRoleRunner } from "../team/role-runner.js";
import { AgentProfileRoleRunner } from "../team/agent-profile-role-runner.js";

function createRoleRunner(config: ReturnType<typeof getAppConfig>): TeamRoleRunner {
	if (process.env.TEAM_USE_MOCK_RUNNER !== "false") {
		return new MockRoleRunner();
	}
	return new AgentProfileRoleRunner({
		projectRoot: config.projectRoot,
		teamDataDir: config.teamDataDir,
		workerProfileId: "main",
		checkerProfileId: "main",
		watcherProfileId: "main",
		finalizerProfileId: "main",
	});
}

const STATE_WATCH_INTERVAL_MS = 2000;

async function main() {
	const config = getAppConfig();
	console.log("[team-worker] starting, dataDir:", config.teamDataDir);

	const planStore = new PlanStore(config.teamDataDir);
	const unitStore = new TeamUnitStore(config.teamDataDir);
	const workspace = new RunWorkspace(config.teamDataDir);

	const pollIntervalMs = config.teamWorkerPollIntervalMs;

	async function tick() {
		try {
			const states = await workspace.listStates();
			const queued = states.find(s => s.status === "queued");
			if (!queued) return;

			console.log("[team-worker] found queued run:", queued.runId);
			const roleRunner = createRoleRunner(config);
			const orchestrator = new TeamOrchestrator({
				planStore,
				teamUnitStore: unitStore,
				workspace,
				roleRunner,
				dataDir: config.teamDataDir,
				maxCheckerRevisions: 3,
				maxWatcherRevisions: 1,
				maxRunDurationMinutes: 60,
			});

			const abortController = new AbortController();
			const watcher = setInterval(async () => {
				try {
					const current = await workspace.getState(queued.runId);
					if (!current) return;
					if (current.status === "cancelled" || current.status === "paused") {
						abortController.abort(new Error(`run externally ${current.status}`));
						clearInterval(watcher);
					}
				} catch {
					// watcher errors should not crash the worker
				}
			}, STATE_WATCH_INTERVAL_MS);

			try {
				const final = await orchestrator.runToCompletion(queued.runId, { signal: abortController.signal });
				console.log("[team-worker] run completed:", queued.runId, "status:", final.status);
			} finally {
				clearInterval(watcher);
			}
		} catch (err) {
			console.error("[team-worker] tick error:", err);
		}
	}

	async function loop() {
		await tick();
		setTimeout(loop, pollIntervalMs);
	}

	loop();
}

main().catch(err => {
	console.error("[team-worker] fatal:", err);
	process.exit(1);
});
