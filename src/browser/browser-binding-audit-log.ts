import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type BrowserBindingAuditKind =
	| "agent_browser_binding"
	| "conn_browser_binding"
	| "conn_execution_binding";

export type BrowserBindingAuditField = "defaultBrowserId" | "browserId" | "profileId";

export interface BrowserBindingAuditChange {
	field: BrowserBindingAuditField;
	from: string | null;
	to: string | null;
}

export interface BrowserBindingAuditEntry {
	createdAt?: string;
	kind: BrowserBindingAuditKind;
	targetId: string;
	targetLabel: string;
	source: string;
	confirmedByClient: boolean;
	status: "succeeded" | "rejected_unconfirmed" | "rejected_non_ui_source" | "rejected_running";
	changes: BrowserBindingAuditChange[];
}

export interface BrowserBindingAuditLog {
	record(entry: BrowserBindingAuditEntry): Promise<void>;
}

export class JsonlBrowserBindingAuditLog implements BrowserBindingAuditLog {
	constructor(private readonly filePath: string) {}

	async record(entry: BrowserBindingAuditEntry): Promise<void> {
		await mkdir(dirname(this.filePath), { recursive: true });
		await appendFile(
			this.filePath,
			JSON.stringify({
				...entry,
				createdAt: entry.createdAt ?? new Date().toISOString(),
			}) + "\n",
			"utf8",
		);
	}
}

export function normalizeBrowserBindingAuditValue(value: unknown): string | null {
	const normalized = String(value ?? "").trim();
	return normalized || null;
}

export async function recordBrowserBindingAudit(
	auditLog: BrowserBindingAuditLog | undefined,
	entry: BrowserBindingAuditEntry,
): Promise<void> {
	if (!auditLog || entry.changes.length === 0) {
		return;
	}
	try {
		await auditLog.record({
			...entry,
			createdAt: entry.createdAt ?? new Date().toISOString(),
		});
	} catch (error) {
		console.warn("[browser-binding-audit] write failed:", error);
	}
}
