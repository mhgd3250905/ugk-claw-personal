import {
	mkdirSync,
	existsSync,
	readFileSync,
	writeFileSync,
	renameSync,
	appendFileSync,
	readdirSync,
} from "node:fs";
import { join } from "node:path";
import type {
	TeamRunState,
	TeamPlan,
	TeamStreamName,
	TeamRole,
	TeamStreamItem,
	TeamStreamCursor,
} from "./types.js";
import type { TeamEvent } from "./team-events.js";
import { generateTeamEventId } from "./team-id.js";

export class TeamWorkspace {
	private teamDataDir: string;

	constructor(input: { teamDataDir: string }) {
		this.teamDataDir = input.teamDataDir;
	}

	private runDir(teamRunId: string): string {
		return join(this.teamDataDir, "runs", teamRunId);
	}

	private validateRelativeName(name: string): void {
		if (name.includes("..")) throw new Error(`path traversal rejected: ${name}`);
		if (name.startsWith("/") || name.startsWith("\\")) throw new Error(`absolute path rejected: ${name}`);
	}

	getRunDir(teamRunId: string): string {
		return this.runDir(teamRunId);
	}

	async createRun(input: {
		teamRunId: string;
		plan: TeamPlan;
		state: TeamRunState;
	}): Promise<void> {
		const dir = this.runDir(input.teamRunId);
		mkdirSync(dir, { recursive: true });
		mkdirSync(join(dir, "streams"), { recursive: true });
		mkdirSync(join(dir, "cursors"), { recursive: true });
		mkdirSync(join(dir, "role-tasks"), { recursive: true });
		mkdirSync(join(dir, "artifacts"), { recursive: true });

		this.writeJsonAtomic(join(dir, "plan.json"), input.plan);
		this.writeJsonAtomic(join(dir, "state.json"), input.state);
		writeFileSync(join(dir, "events.jsonl"), "");
	}

	async listRunnableRunIds(): Promise<string[]> {
		const runsDir = join(this.teamDataDir, "runs");
		if (!existsSync(runsDir)) return [];
		const dirs = readdirSync(runsDir, { withFileTypes: true })
			.filter((d) => d.isDirectory());
		const result: string[] = [];
		for (const d of dirs) {
			try {
				const state = await this.readState(d.name);
				if (state.status === "queued" || state.status === "running") {
					result.push(d.name);
				}
			} catch { /* skip corrupt */ }
		}
		return result;
	}

	async readPlan(teamRunId: string): Promise<TeamPlan> {
		const p = join(this.runDir(teamRunId), "plan.json");
		return this.readJsonFile<TeamPlan>(p);
	}

	async readState(teamRunId: string): Promise<TeamRunState> {
		const p = join(this.runDir(teamRunId), "state.json");
		return this.readJsonFile<TeamRunState>(p);
	}

	async writeState(state: TeamRunState): Promise<void> {
		const p = join(this.runDir(state.teamRunId), "state.json");
		this.writeJsonAtomic(p, state);
	}

	async appendEvent(teamRunId: string, event: TeamEvent): Promise<void> {
		const p = join(this.runDir(teamRunId), "events.jsonl");
		appendFileSync(p, JSON.stringify(event) + "\n");
	}

	async readEvents(teamRunId: string): Promise<TeamEvent[]> {
		const p = join(this.runDir(teamRunId), "events.jsonl");
		if (!existsSync(p)) return [];
		const content = readFileSync(p, "utf-8").trim();
		if (!content) return [];
		return content.split("\n").map((line) => JSON.parse(line));
	}

	async appendStreamItem<T>(
		teamRunId: string,
		streamName: TeamStreamName,
		item: TeamStreamItem<T>,
	): Promise<void> {
		const p = join(this.runDir(teamRunId), "streams", `${streamName}.jsonl`);
		appendFileSync(p, JSON.stringify(item) + "\n");
	}

	async readStreamItems<T>(
		teamRunId: string,
		streamName: TeamStreamName,
	): Promise<Array<TeamStreamItem<T>>> {
		const p = join(this.runDir(teamRunId), "streams", `${streamName}.jsonl`);
		if (!existsSync(p)) return [];
		const content = readFileSync(p, "utf-8").trim();
		if (!content) return [];
		return content.split("\n").map((line) => JSON.parse(line));
	}

	async readCursor(
		teamRunId: string,
		roleId: TeamRole["roleId"],
		streamName: TeamStreamName,
	): Promise<TeamStreamCursor | undefined> {
		const p = join(this.runDir(teamRunId), "cursors", `${roleId}_${streamName}.json`);
		if (!existsSync(p)) return undefined;
		return this.readJsonFile<TeamStreamCursor>(p);
	}

	async writeCursor(
		teamRunId: string,
		cursor: TeamStreamCursor,
	): Promise<void> {
		const p = join(this.runDir(teamRunId), "cursors", `${cursor.roleId}_${cursor.streamName}.json`);
		this.writeJsonAtomic(p, cursor);
	}

	async writeArtifactJson(
		teamRunId: string,
		relativeName: string,
		value: unknown,
	): Promise<void> {
		this.validateRelativeName(relativeName);
		const p = join(this.runDir(teamRunId), "artifacts", relativeName);
		this.writeJsonAtomic(p, value);
	}

	async writeArtifactText(
		teamRunId: string,
		relativeName: string,
		value: string,
	): Promise<void> {
		this.validateRelativeName(relativeName);
		const p = join(this.runDir(teamRunId), "artifacts", relativeName);
		writeFileSync(p, value);
	}

	async readArtifactText(
		teamRunId: string,
		relativeName: string,
	): Promise<string> {
		this.validateRelativeName(relativeName);
		const p = join(this.runDir(teamRunId), "artifacts", relativeName);
		return readFileSync(p, "utf-8");
	}

	private writeJsonAtomic(filePath: string, value: unknown): void {
		const tmp = `${filePath}.tmp`;
		writeFileSync(tmp, JSON.stringify(value, null, 2));
		renameSync(tmp, filePath);
	}

	private readJsonFile<T>(filePath: string): T {
		try {
			return JSON.parse(readFileSync(filePath, "utf-8"));
		} catch (e) {
			throw new Error(`Failed to parse JSON from ${filePath}: ${(e as Error).message}`);
		}
	}
}
