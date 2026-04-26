import { sanitizeStateId } from "./agent-active-run-view.js";

type ScopeEnvKey = "CLAUDE_AGENT_ID" | "CLAUDE_HOOK_AGENT_ID" | "agent_id";

const SCOPE_ENV_KEYS: readonly ScopeEnvKey[] = ["CLAUDE_AGENT_ID", "CLAUDE_HOOK_AGENT_ID", "agent_id"];

export function createBrowserCleanupScope(conversationId: string): string {
	return sanitizeStateId(conversationId);
}

export async function runWithScopedAgentEnvironment<T>(scope: string, operation: () => Promise<T>): Promise<T> {
	const previousValues = Object.fromEntries(
		SCOPE_ENV_KEYS.map((key) => [key, process.env[key]]),
	) as Record<ScopeEnvKey, string | undefined>;
	for (const key of SCOPE_ENV_KEYS) {
		process.env[key] = scope;
	}

	try {
		return await operation();
	} finally {
		for (const key of SCOPE_ENV_KEYS) {
			restoreScopedAgentEnvironment(key, previousValues[key]);
		}
	}
}

function restoreScopedAgentEnvironment(key: ScopeEnvKey, value: string | undefined): void {
	if (value === undefined) {
		delete process.env[key];
		return;
	}
	process.env[key] = value;
}
