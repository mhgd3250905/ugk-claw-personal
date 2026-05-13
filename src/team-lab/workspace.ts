import { writeFileSync, mkdirSync, existsSync, readFileSync, renameSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import type { CandidateDomain, SpikeState } from "./brand-domain-types.js";

export class TeamLabWorkspace {
  private rootDir: string;

  constructor(input: { rootDir: string }) {
    this.rootDir = input.rootDir;
  }

  private runDir(runId: string): string {
    return join(this.rootDir, "runs", runId);
  }

  private validateFilename(filename: string): void {
    if (filename.includes("..")) throw new Error(`path traversal rejected: ${filename}`);
    if (filename.startsWith("/")) throw new Error(`absolute path rejected: ${filename}`);
    if (filename.startsWith("\\")) throw new Error(`absolute path rejected: ${filename}`);
  }

  async createRun(input: { runId: string; state: SpikeState }): Promise<string> {
    const dir = this.runDir(input.runId);
    mkdirSync(dir, { recursive: true });
    await this.writeState(input.runId, input.state);
    // Create empty JSONL files
    writeFileSync(join(dir, "events.jsonl"), "");
    writeFileSync(join(dir, "candidates.jsonl"), "");
    return dir;
  }

  async readState(runId: string): Promise<SpikeState> {
    const p = join(this.runDir(runId), "state.json");
    return JSON.parse(readFileSync(p, "utf-8"));
  }

  async writeState(runId: string, state: SpikeState): Promise<void> {
    const dir = this.runDir(runId);
    const tmp = join(dir, "state.json.tmp");
    const target = join(dir, "state.json");
    writeFileSync(tmp, JSON.stringify(state, null, 2));
    renameSync(tmp, target);
  }

  async appendEvent(runId: string, event: unknown): Promise<void> {
    const p = join(this.runDir(runId), "events.jsonl");
    const record = typeof event === "object" && event !== null
      ? { ...event as Record<string, unknown>, _ts: new Date().toISOString() }
      : { data: event, _ts: new Date().toISOString() };
    appendFileSync(p, JSON.stringify(record) + "\n");
  }

  async appendCandidate(runId: string, candidate: CandidateDomain): Promise<void> {
    const p = join(this.runDir(runId), "candidates.jsonl");
    appendFileSync(p, JSON.stringify(candidate) + "\n");
  }

  async readCandidates(runId: string): Promise<CandidateDomain[]> {
    const p = join(this.runDir(runId), "candidates.jsonl");
    if (!existsSync(p)) return [];
    const content = readFileSync(p, "utf-8").trim();
    if (!content) return [];
    return content.split("\n").map((line) => JSON.parse(line));
  }

  async writeText(runId: string, filename: string, content: string): Promise<void> {
    this.validateFilename(filename);
    writeFileSync(join(this.runDir(runId), filename), content);
  }

  async writeJson(runId: string, filename: string, value: unknown): Promise<void> {
    this.validateFilename(filename);
    const dir = this.runDir(runId);
    const tmp = join(dir, filename + ".tmp");
    const target = join(dir, filename);
    writeFileSync(tmp, JSON.stringify(value, null, 2));
    renameSync(tmp, target);
  }

  async readArtifactText(runId: string, filename: string): Promise<string> {
    this.validateFilename(filename);
    return readFileSync(join(this.runDir(runId), filename), "utf-8");
  }
}
