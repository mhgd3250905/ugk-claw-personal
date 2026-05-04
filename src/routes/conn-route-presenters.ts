import type { ConnRunEventRecord, ConnRunFileRecord, ConnRunRecord } from "../agent/conn-run-store.js";
import type { ConnDefinition } from "../agent/conn-store.js";
import type { ConnBody, ConnRunDetailResponseBody, ConnRunEventsResponseBody } from "../types/api.js";

export function toConnListBody(
	conn: ConnDefinition,
	latestRunsByConnId: Record<string, ConnRunRecord | undefined> | undefined,
): ConnBody {
	const latestRun = latestRunsByConnId?.[conn.connId];
	return {
		...conn,
		...(latestRunsByConnId ? { latestRun: latestRun ? toConnRunBody(latestRun) : null } : {}),
	};
}

export function toConnRunBody(run: ConnRunRecord): ConnRunDetailResponseBody["run"] {
	return {
		runId: run.runId,
		connId: run.connId,
		status: run.status,
		scheduledAt: run.scheduledAt,
		...(run.claimedAt ? { claimedAt: run.claimedAt } : {}),
		...(run.startedAt ? { startedAt: run.startedAt } : {}),
		...(run.leaseOwner ? { leaseOwner: run.leaseOwner } : {}),
		...(run.leaseUntil ? { leaseUntil: run.leaseUntil } : {}),
		...(run.finishedAt ? { finishedAt: run.finishedAt } : {}),
		workspacePath: run.workspacePath,
		...(run.sessionFile ? { sessionFile: run.sessionFile } : {}),
		...(run.resolvedSnapshot ? { resolvedSnapshot: run.resolvedSnapshot } : {}),
		...(run.resultSummary ? { resultSummary: run.resultSummary } : {}),
		...(run.resultText ? { resultText: run.resultText } : {}),
		...(run.errorText ? { errorText: run.errorText } : {}),
		...(run.deliveredAt ? { deliveredAt: run.deliveredAt } : {}),
		...(run.retryOfRunId ? { retryOfRunId: run.retryOfRunId } : {}),
		createdAt: run.createdAt,
		updatedAt: run.updatedAt,
	};
}

export function toConnRunFileBody(
	file: ConnRunFileRecord,
	links?: { url?: string; latestUrl?: string },
): NonNullable<ConnRunDetailResponseBody["files"]>[number] {
	return {
		fileId: file.fileId,
		runId: file.runId,
		kind: file.kind,
		relativePath: file.relativePath,
		fileName: file.fileName,
		mimeType: file.mimeType,
		sizeBytes: file.sizeBytes,
		createdAt: file.createdAt,
		...(links?.url ? { url: links.url } : {}),
		...(links?.latestUrl ? { latestUrl: links.latestUrl } : {}),
	};
}

export function toConnRunEventBody(event: ConnRunEventRecord): ConnRunEventsResponseBody["events"][number] {
	return {
		eventId: event.eventId,
		runId: event.runId,
		seq: event.seq,
		eventType: event.eventType,
		event: event.event,
		createdAt: event.createdAt,
	};
}
