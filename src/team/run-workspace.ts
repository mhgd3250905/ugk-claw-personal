import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { join } from "node:path";
import type { TeamPlan, TeamProgress, TeamRunState, TeamTaskState } from "./types.js";
import { generateRunId, generateAttemptId } from "./ids.js";
import { progressMessages } from "./progress.js";

function initialTaskStates(plan: TeamPlan): Record<string, TeamTaskState> {
	const states: Record<string, TeamTaskState> = {};
	const now = new Date().toISOString();
	for (const task of plan.tasks) {
		states[task.id] = {
			status: "pending",
			attemptCount: 0,
			activeAttemptId: null,
			resultRef: null,
			errorSummary: null,
			progress: { phase: "pending", message: progressMessages.pending, updatedAt: now },
		};
	}
	return states;
}

export class RunWorkspace {
	constructor(private readonly rootDir: string) {}

	async createRun(plan: TeamPlan, teamUnitId: string): Promise<TeamRunState> {
		const runId = generateRunId();
		const now = new Date().toISOString();
		const runDir = join(this.rootDir, "runs", runId);

		await mkdir(runDir, { recursive: true });

		await writeFile(join(runDir, "plan.json"), JSON.stringify(plan, null, 2), "utf8");

		const state: TeamRunState = {
			schemaVersion: "team/state-1",
			runId,
			planId: plan.planId,
			teamUnitId,
			status: "queued",
			createdAt: now,
			queuedAt: now,
			startedAt: null,
			finishedAt: null,
			activeElapsedMs: 0,
			currentTaskId: null,
			taskStates: initialTaskStates(plan),
			summary: {
				totalTasks: plan.tasks.length,
				succeededTasks: 0,
				failedTasks: 0,
				cancelledTasks: 0,
			},
			pauseReason: null,
			lastError: null,
			updatedAt: now,
		};

		await this.saveState(state);
		return state;
	}

	async getState(runId: string): Promise<TeamRunState | null> {
		return this.readJson<TeamRunState>(join(this.rootDir, "runs", runId, "state.json"));
	}

	async saveState(state: TeamRunState): Promise<void> {
		const filePath = join(this.rootDir, "runs", state.runId, "state.json");
		const tmp = filePath + ".tmp";
		await writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
		await rename(tmp, filePath);
	}

	async listStates(): Promise<TeamRunState[]> {
		const runsDir = join(this.rootDir, "runs");
		try {
			const { readdir } = await import("node:fs/promises");
			const dirs = await readdir(runsDir);
			const states: TeamRunState[] = [];
			for (const d of dirs) {
				const s = await this.getState(d);
				if (s && s.schemaVersion === "team/state-1") states.push(s);
			}
			return states.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
		} catch {
			return [];
		}
	}

	async createAttempt(runId: string, taskId: string): Promise<{ attemptId: string; attemptRoot: string }> {
		const attemptId = generateAttemptId();
		const attemptRoot = join(this.rootDir, "runs", runId, "tasks", taskId, "attempts", attemptId);
		await mkdir(join(attemptRoot, "work"), { recursive: true });
		await mkdir(join(attemptRoot, "output"), { recursive: true });
		await writeFile(join(attemptRoot, "attempt.json"), JSON.stringify({ attemptId, taskId, status: "running", createdAt: new Date().toISOString() }, null, 2), "utf8");
		return { attemptId, attemptRoot };
	}

	async writeWorkerOutput(runId: string, taskId: string, attemptId: string, index: number, content: string): Promise<string> {
		const fileName = `worker-output-${String(index).padStart(3, "0")}.md`;
		await this.writeAttemptFile(runId, taskId, attemptId, fileName, content);
		return `tasks/${taskId}/attempts/${attemptId}/${fileName}`;
	}

	async writeCheckerVerdict(runId: string, taskId: string, attemptId: string, index: number, verdict: unknown): Promise<string> {
		const fileName = `checker-verdict-${String(index).padStart(3, "0")}.json`;
		await this.writeAttemptFile(runId, taskId, attemptId, fileName, JSON.stringify(verdict, null, 2));
		return `tasks/${taskId}/attempts/${attemptId}/${fileName}`;
	}

	async writeCheckerOutput(runId: string, taskId: string, attemptId: string, index: number, content: string): Promise<string> {
		const fileName = `checker-output-${String(index).padStart(3, "0")}.md`;
		await this.writeAttemptFile(runId, taskId, attemptId, fileName, content);
		return `tasks/${taskId}/attempts/${attemptId}/${fileName}`;
	}

	async writeAcceptedResult(runId: string, taskId: string, attemptId: string, content: string): Promise<string> {
		await this.writeAttemptFile(runId, taskId, attemptId, "accepted-result.md", content);
		return `tasks/${taskId}/attempts/${attemptId}/accepted-result.md`;
	}

	async writeFailedResult(runId: string, taskId: string, attemptId: string, content: string): Promise<string> {
		await this.writeAttemptFile(runId, taskId, attemptId, "failed-result.md", content);
		return `tasks/${taskId}/attempts/${attemptId}/failed-result.md`;
	}

	async writeWatcherReview(runId: string, taskId: string, attemptId: string, review: unknown): Promise<string> {
		await this.writeAttemptFile(runId, taskId, attemptId, "watcher-review.json", JSON.stringify(review, null, 2));
		return `tasks/${taskId}/attempts/${attemptId}/watcher-review.json`;
	}

	async writeFinalReport(runId: string, content: string): Promise<string> {
		const filePath = join(this.rootDir, "runs", runId, "final-report.md");
		await writeFile(filePath, content, "utf8");
		return "final-report.md";
	}

	async deleteRun(runId: string): Promise<void> {
		const runDir = join(this.rootDir, "runs", runId);
		await rm(runDir, { recursive: true, force: true });
	}
	async listAttempts(runId: string, taskId: string): Promise<Array<{ attemptId: string; status: string; createdAt: string; files: string[] }>> {
		const attemptsDir = join(this.rootDir, "runs", runId, "tasks", taskId, "attempts");
		let dirs: string[];
		try { dirs = await readdir(attemptsDir); } catch { return []; }
		const results: Array<{ attemptId: string; status: string; createdAt: string; files: string[] }> = [];
		for (const d of dirs) {
			const meta = await this.readJson<{ attemptId: string; status: string; createdAt: string }>(join(attemptsDir, d, "attempt.json"));
			let files: string[] = [];
			try { files = (await readdir(join(attemptsDir, d))).filter(f => f !== "attempt.json" && f !== "work" && f !== "output"); } catch { /* empty */ }
			results.push({
				attemptId: meta?.attemptId ?? d,
				status: meta?.status ?? "unknown",
				createdAt: meta?.createdAt ?? "",
				files,
			});
		}
		return results;
	}

	async readAttemptFile(runId: string, taskId: string, attemptId: string, fileName: string): Promise<string | null> {
		if (/[^a-zA-Z0-9._-]/.test(fileName) || fileName.includes("..")) return null;
		if (/[^a-zA-Z0-9_-]/.test(attemptId) || attemptId.includes("..")) return null;
		if (/[^a-zA-Z0-9_-]/.test(taskId) || taskId.includes("..")) return null;
		const filePath = join(this.rootDir, "runs", runId, "tasks", taskId, "attempts", attemptId, fileName);
		const runRoot = join(this.rootDir, "runs", runId);
		const resolved = path.resolve(filePath);
		const root = path.resolve(runRoot);
		if (!resolved.startsWith(root + path.sep) && resolved !== root) return null;
		try { return await readFile(filePath, "utf8"); } catch { return null; }
	}

	private async writeAttemptFile(runId: string, taskId: string, attemptId: string, fileName: string, content: string): Promise<void> {
		const dir = join(this.rootDir, "runs", runId, "tasks", taskId, "attempts", attemptId);
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, fileName), content, "utf8");
	}

	private async readJson<T>(filePath: string): Promise<T | null> {
		try {
			const data = await readFile(filePath, "utf8");
			return JSON.parse(data) as T;
		} catch {
			return null;
		}
	}
}
