import type { TeamRunState, TeamUnit } from "./types.js";

export const activeRunStatuses: ReadonlySet<string> = new Set(["queued", "running", "paused"]);

export interface TeamConfigLocks {
	lockedPlanIds: Set<string>;
	lockedTeamUnitIds: Set<string>;
	lockedProfileIds: Set<string>;
}

export function computeTeamConfigLocks(states: TeamRunState[], teams: TeamUnit[]): TeamConfigLocks {
	const lockedPlanIds = new Set<string>();
	const lockedTeamUnitIds = new Set<string>();
	const lockedProfileIds = new Set<string>();

	for (const state of states) {
		if (!activeRunStatuses.has(state.status)) continue;
		lockedPlanIds.add(state.planId);
		lockedTeamUnitIds.add(state.teamUnitId);

		const team = teams.find(t => t.teamUnitId === state.teamUnitId);
		if (team) {
			lockedProfileIds.add(team.watcherProfileId);
			lockedProfileIds.add(team.workerProfileId);
			lockedProfileIds.add(team.checkerProfileId);
			lockedProfileIds.add(team.finalizerProfileId);
		}
	}

	return { lockedPlanIds, lockedTeamUnitIds, lockedProfileIds };
}
