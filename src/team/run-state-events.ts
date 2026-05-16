import type { TeamRunState } from "./types.js";

export type RunStateListener = (state: TeamRunState) => void;

export class RunStateEvents {
	private readonly listeners = new Map<string, Set<RunStateListener>>();

	subscribe(runId: string, listener: RunStateListener): { unsubscribe(): void } {
		let set = this.listeners.get(runId);
		if (!set) {
			set = new Set();
			this.listeners.set(runId, set);
		}
		set.add(listener);
		return {
			unsubscribe: () => {
				const s = this.listeners.get(runId);
				if (s) {
					s.delete(listener);
					if (s.size === 0) this.listeners.delete(runId);
				}
			},
		};
	}

	notify(state: TeamRunState): void {
		const set = this.listeners.get(state.runId);
		if (!set) return;
		for (const listener of [...set]) {
			try {
				listener(state);
			} catch {
				// Listener failures must not break saveState()
			}
		}
	}
}
