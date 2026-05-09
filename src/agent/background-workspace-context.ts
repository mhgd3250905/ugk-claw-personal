import { AsyncLocalStorage } from "node:async_hooks";

export type BackgroundWorkspaceEnvironment = Record<string, string | undefined>;

const backgroundWorkspaceStorage = new AsyncLocalStorage<BackgroundWorkspaceEnvironment>();

export async function runWithBackgroundWorkspaceContext<T>(
	values: BackgroundWorkspaceEnvironment,
	operation: () => Promise<T>,
): Promise<T> {
	return await backgroundWorkspaceStorage.run({ ...values }, operation);
}

export function getCurrentBackgroundWorkspaceEnvironment(): BackgroundWorkspaceEnvironment {
	return { ...(backgroundWorkspaceStorage.getStore() ?? {}) };
}
