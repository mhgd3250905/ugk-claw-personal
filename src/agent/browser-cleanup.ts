import { getCurrentAgentScope } from "./agent-scope-context.js";

type BrowserCleanupEnv = Record<string, string | undefined>;

export interface BrowserCleanupOptions {
	browserId?: string;
	env?: BrowserCleanupEnv;
	fetchImpl?: typeof fetch;
	proxyBaseUrl?: string;
	timeoutMs?: number;
	warn?: (message: string, ...args: unknown[]) => void;
}

const DEFAULT_PROXY_PORT = 3456;
const DEFAULT_TIMEOUT_MS = 2000;
const SCOPE_ENV_NAMES = [
	"CLAUDE_AGENT_ID",
	"CLAUDE_HOOK_AGENT_ID",
	"agent_id",
] as const;

export function resolveBrowserCleanupAgentScope(env: BrowserCleanupEnv = process.env): string | undefined {
	const currentScope = getCurrentAgentScope()?.scope.trim();
	if (currentScope) {
		return currentScope;
	}
	for (const name of SCOPE_ENV_NAMES) {
		const trimmed = env[name]?.trim();
		if (trimmed) {
			return trimmed;
		}
	}
	return undefined;
}

export async function closeBrowserTargetsForScope(
	scope: string | undefined,
	options: BrowserCleanupOptions = {},
): Promise<void> {
	const env = options.env ?? process.env;
	const agentScope = scope?.trim() || resolveBrowserCleanupAgentScope(env);
	if (!agentScope) {
		return;
	}

	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== "function") {
		warn(options, `[browser-cleanup] fetch is unavailable; skipped closing browser targets for scope ${agentScope}`);
		return;
	}

	try {
		const timeoutMs = resolveTimeoutMs(options.timeoutMs, env);
		const signal = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined;
		const url = new URL("/session/close-all", resolveProxyBaseUrl(options, env));
		url.searchParams.set("metaAgentScope", agentScope);

		const response = await fetchImpl(url, {
			method: "POST",
			...(signal ? { signal } : {}),
		});
		if (!response.ok) {
			warn(options, `[browser-cleanup] Failed to close browser targets: HTTP ${response.status}`);
			return;
		}

		const result = await parseJsonResult(response);
		if (isObject(result) && "ok" in result && result.ok !== true) {
			warn(options, "[browser-cleanup] Close browser targets returned error:", result.error);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		warn(options, `[browser-cleanup] Error closing browser targets for scope ${agentScope}:`, message);
	}
}

function resolveProxyBaseUrl(options: BrowserCleanupOptions, env: BrowserCleanupEnv): string {
	const explicitBaseUrl =
		options.proxyBaseUrl?.trim() ||
		env.WEB_ACCESS_CDP_PROXY_BASE_URL?.trim() ||
		env.CDP_PROXY_BASE_URL?.trim();
	if (explicitBaseUrl) {
		return stripTrailingSlash(explicitBaseUrl);
	}

	const port = parsePositiveInteger(env.CDP_PROXY_PORT) ?? DEFAULT_PROXY_PORT;
	return `http://127.0.0.1:${port}`;
}

function resolveTimeoutMs(timeoutMs: number | undefined, env: BrowserCleanupEnv): number {
	return timeoutMs && Number.isFinite(timeoutMs) && timeoutMs > 0
		? timeoutMs
		: parsePositiveInteger(env.WEB_ACCESS_BROWSER_CLEANUP_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function stripTrailingSlash(value: string): string {
	return value.replace(/\/+$/, "");
}

async function parseJsonResult(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		return undefined;
	}
}

function isObject(value: unknown): value is { ok?: unknown; error?: unknown } {
	return typeof value === "object" && value !== null;
}

function warn(options: BrowserCleanupOptions, message: string, ...args: unknown[]): void {
	(options.warn ?? console.warn)(message, ...args);
}
