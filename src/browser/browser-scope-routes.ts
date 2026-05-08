import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface BrowserScopeRoute {
	browserId: string;
	updatedAt: string;
}

export interface BrowserScopeRouteStore {
	routes: Record<string, BrowserScopeRoute>;
}

export interface BrowserScopeRouteOptions {
	cachePath?: string;
	now?: () => Date;
}

const DEFAULT_BROWSER_SCOPE_ROUTE_CACHE_PATH = "/app/.data/browser-scope-routes.json";
const routeWriteQueues = new Map<string, Promise<void>>();

export function getBrowserScopeRouteCachePath(env: Record<string, string | undefined> = process.env): string {
	const explicit = env.UGK_BROWSER_SCOPE_ROUTE_CACHE_PATH?.trim();
	if (explicit) {
		return explicit;
	}
	return process.platform !== "win32" && existsSync("/app")
		? DEFAULT_BROWSER_SCOPE_ROUTE_CACHE_PATH
		: join(process.cwd(), ".data", "browser-scope-routes.json");
}

export async function setBrowserScopeRoute(
	scope: string,
	browserId: string | undefined,
	options: BrowserScopeRouteOptions = {},
): Promise<void> {
	const normalizedScope = scope.trim();
	if (!normalizedScope) {
		return;
	}
	const cachePath = options.cachePath ?? getBrowserScopeRouteCachePath();
	await updateBrowserScopeRouteStore(cachePath, (store) => {
		if (browserId?.trim()) {
			store.routes[normalizedScope] = {
				browserId: browserId.trim(),
				updatedAt: (options.now?.() ?? new Date()).toISOString(),
			};
		} else {
			delete store.routes[normalizedScope];
		}
		return store;
	});
}

export async function readBrowserScopeRoute(
	scope: string,
	options: BrowserScopeRouteOptions = {},
): Promise<BrowserScopeRoute | undefined> {
	const normalizedScope = scope.trim();
	if (!normalizedScope) {
		return undefined;
	}
	const store = await readBrowserScopeRouteStore(options.cachePath ?? getBrowserScopeRouteCachePath());
	return store.routes[normalizedScope];
}

async function readBrowserScopeRouteStore(cachePath: string): Promise<BrowserScopeRouteStore> {
	try {
		const parsed = JSON.parse(await readFile(cachePath, "utf8")) as Partial<BrowserScopeRouteStore>;
		if (!parsed || typeof parsed !== "object" || !parsed.routes || typeof parsed.routes !== "object") {
			return { routes: {} };
		}
		return {
			routes: Object.fromEntries(
				Object.entries(parsed.routes)
					.filter((entry): entry is [string, BrowserScopeRoute] => isBrowserScopeRoute(entry[1])),
			),
		};
	} catch {
		return { routes: {} };
	}
}

async function writeBrowserScopeRouteStore(cachePath: string, store: BrowserScopeRouteStore): Promise<void> {
	await mkdir(dirname(cachePath), { recursive: true });
	const tempPath = `${cachePath}.tmp`;
	await writeFile(tempPath, JSON.stringify(store, null, 2));
	await rename(tempPath, cachePath);
}

async function updateBrowserScopeRouteStore(
	cachePath: string,
	update: (store: BrowserScopeRouteStore) => BrowserScopeRouteStore,
): Promise<void> {
	const previous = routeWriteQueues.get(cachePath) ?? Promise.resolve();
	const next = previous
		.catch(() => undefined)
		.then(async () => {
			const store = await readBrowserScopeRouteStore(cachePath);
			await writeBrowserScopeRouteStore(cachePath, update(store));
		});
	routeWriteQueues.set(cachePath, next);
	try {
		await next;
	} finally {
		if (routeWriteQueues.get(cachePath) === next) {
			routeWriteQueues.delete(cachePath);
		}
	}
}

function isBrowserScopeRoute(value: unknown): value is BrowserScopeRoute {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as BrowserScopeRoute).browserId === "string" &&
		typeof (value as BrowserScopeRoute).updatedAt === "string"
	);
}
