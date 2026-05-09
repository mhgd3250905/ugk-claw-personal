import { AsyncLocalStorage } from "node:async_hooks";

export interface AgentScopeContext {
	scope: string;
}

const agentScopeStorage = new AsyncLocalStorage<AgentScopeContext>();

export async function runWithAgentScope<T>(scope: string, operation: () => Promise<T>): Promise<T> {
	return await agentScopeStorage.run({ scope }, operation);
}

export function getCurrentAgentScope(): AgentScopeContext | undefined {
	return agentScopeStorage.getStore();
}
