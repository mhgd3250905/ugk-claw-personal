import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, renameSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import type { TeamRun, TeamEvent, TeamRunSummary } from "./types.js";
import type { CandidateDomain } from "../team-lab/brand-domain-types.js";

export class TeamStore {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  private runDir(runId: string): string {
    return join(this.rootDir, "runs", runId);
  }

  private validateFilename(filename: string): void {
    if (filename.includes("..")) throw new Error(`path traversal rejected: ${filename}`);
    if (filename.startsWith("/") || filename.startsWith("\\")) throw new Error(`absolute path rejected: ${filename}`);
  }

  createRun(run: TeamRun): string {
    const dir = this.runDir(run.runId);
    mkdirSync(dir, { recursive: true });
    this.writeRun(run);
    writeFileSync(join(dir, "events.jsonl"), "");
    writeFileSync(join(dir, "candidates.jsonl"), "");
    return dir;
  }

  readRun(runId: string): TeamRun {
    const p = join(this.runDir(runId), "state.json");
    return JSON.parse(readFileSync(p, "utf-8"));
  }

  writeRun(run: TeamRun): void {
    const dir = this.runDir(run.runId);
    const tmp = join(dir, "state.json.tmp");
    const target = join(dir, "state.json");
    writeFileSync(tmp, JSON.stringify(run, null, 2));
    renameSync(tmp, target);
  }

  appendEvent(runId: string, event: TeamEvent): void {
    const p = join(this.runDir(runId), "events.jsonl");
    appendFileSync(p, JSON.stringify(event) + "\n");
  }

  appendCandidate(runId: string, candidate: CandidateDomain): void {
    const p = join(this.runDir(runId), "candidates.jsonl");
    appendFileSync(p, JSON.stringify(candidate) + "\n");
  }

  readCandidates(runId: string): CandidateDomain[] {
    const p = join(this.runDir(runId), "candidates.jsonl");
    if (!existsSync(p)) return [];
    const content = readFileSync(p, "utf-8").trim();
    if (!content) return [];
    return content.split("\n").map((line) => JSON.parse(line));
  }

  writeArtifact(runId: string, filename: string, content: string): void {
    this.validateFilename(filename);
    writeFileSync(join(this.runDir(runId), filename), content);
  }

  readArtifact(runId: string, filename: string): string {
    this.validateFilename(filename);
    return readFileSync(join(this.runDir(runId), filename), "utf-8");
  }

  listRuns(): TeamRunSummary[] {
    const runsDir = join(this.rootDir, "runs");
    if (!existsSync(runsDir)) return [];
    const dirs = readdirSync(runsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());
    const summaries: TeamRunSummary[] = [];
    for (const d of dirs) {
      try {
        const run = this.readRun(d.name);
        summaries.push({
          runId: run.runId,
          keyword: run.keyword,
          status: run.status,
          candidateCount: run.candidates.length,
          findingCount: run.findings.length,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          error: run.error,
        });
      } catch { /* skip corrupt */ }
    }
    return summaries.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
}
