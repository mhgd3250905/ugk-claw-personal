import type { BrowserBindingAuditChange, BrowserBindingAuditField } from "./browser-binding-audit-log.js";

export const BROWSER_BINDING_SOURCE_HEADER = "x-ugk-browser-binding-source";
export const BROWSER_BINDING_CONFIRMED_HEADER = "x-ugk-browser-binding-confirmed";
export const PLAYGROUND_BROWSER_BINDING_SOURCE = "playground";

export const BROWSER_BINDING_UNCONFIRMED_MESSAGE = "Browser binding changes require explicit confirmation.";
export const BROWSER_BINDING_NON_UI_MESSAGE = "Browser binding changes are only allowed from the Playground UI.";

export interface BrowserBindingRequestContext {
	source: string;
	confirmedByClient: boolean;
}

export type BrowserBindingWriteDecision =
	| { allowed: true }
	| { allowed: false; status: "rejected_unconfirmed" | "rejected_non_ui_source"; message: string };

export function readBrowserBindingRequestContext(
	headers: Record<string, string | string[] | undefined>,
): BrowserBindingRequestContext {
	const sourceHeader = headers[BROWSER_BINDING_SOURCE_HEADER];
	const confirmedHeader = headers[BROWSER_BINDING_CONFIRMED_HEADER];
	const source = String(Array.isArray(sourceHeader) ? sourceHeader[0] : sourceHeader || "api").trim() || "api";
	const confirmedByClient = String(Array.isArray(confirmedHeader) ? confirmedHeader[0] : confirmedHeader || "")
		.trim()
		.toLowerCase() === "true";
	return { source, confirmedByClient };
}

export function createBrowserBindingChange(
	field: BrowserBindingAuditField,
	from: string | null,
	to: string | null,
): BrowserBindingAuditChange | undefined {
	return from === to ? undefined : { field, from, to };
}

export function compactBrowserBindingChanges(
	changes: Array<BrowserBindingAuditChange | undefined>,
): BrowserBindingAuditChange[] {
	return changes.filter((change): change is BrowserBindingAuditChange => Boolean(change));
}

export function evaluateBrowserBindingWrite(
	changes: readonly BrowserBindingAuditChange[],
	context: BrowserBindingRequestContext,
): BrowserBindingWriteDecision {
	if (changes.length === 0) {
		return { allowed: true };
	}
	if (!context.confirmedByClient) {
		return {
			allowed: false,
			status: "rejected_unconfirmed",
			message: BROWSER_BINDING_UNCONFIRMED_MESSAGE,
		};
	}
	if (context.source !== PLAYGROUND_BROWSER_BINDING_SOURCE) {
		return {
			allowed: false,
			status: "rejected_non_ui_source",
			message: BROWSER_BINDING_NON_UI_MESSAGE,
		};
	}
	return { allowed: true };
}
