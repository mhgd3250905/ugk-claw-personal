export function generateTeamRunId(): string {
	return `teamrun_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function generateTeamEventId(): string {
	return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function generateStreamItemId(): string {
	return `si_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function generateRoleTaskId(): string {
	return `rt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
