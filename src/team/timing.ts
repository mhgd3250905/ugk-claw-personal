import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { generateTimingSpanId } from "./ids.js";

export interface TimingSpan {
	timingSpanId: string;
	runId: string;
	taskId: string | null;
	attemptId: string | null;
	phase: string;
	startedAt: string;
	finishedAt: string;
	durationMs: number;
}

export async function writeTimingSpan(dataDir: string, span: Omit<TimingSpan, "timingSpanId">): Promise<TimingSpan> {
	const full: TimingSpan = { ...span, timingSpanId: generateTimingSpanId() };
	const runsDir = join(dataDir, "runs", span.runId);
	await mkdir(runsDir, { recursive: true });
	await appendFile(join(runsDir, "timings.jsonl"), JSON.stringify(full) + "\n", "utf8");
	return full;
}
