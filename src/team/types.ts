import type { CandidateDomain, ReviewFinding } from "../team-lab/brand-domain-types.js";

// --- Roles ---

export type RoleType = "discovery" | "evidence" | "reviewer" | "finalizer";

export interface RoleTask {
  role: RoleType;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  finishedAt?: string;
  inputSummary: string;
  outputSummary?: string;
  error?: string;
}

// --- Stream Events ---

export type TeamEventType =
  | "run_started"
  | "role_started"
  | "role_completed"
  | "role_failed"
  | "candidates_accepted"
  | "candidates_rejected"
  | "gate_rejected"
  | "run_completed"
  | "run_failed";

export interface TeamEvent {
  type: TeamEventType;
  _ts: string;
  [key: string]: unknown;
}

// --- Team Run ---

export type TeamRunStatus = "pending" | "running" | "completed" | "failed";

export interface TeamRun {
  runId: string;
  keyword: string;
  mode: "fixture" | "real";
  status: TeamRunStatus;
  roles: RoleTask[];
  candidates: CandidateDomain[];
  findings: ReviewFinding[];
  queries: string[];
  completedQueries: string[];
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

// --- Cursor (for pagination / resumption) ---

export interface TeamCursor {
  runId: string;
  afterRole?: RoleType;
  afterRound?: number;
}

// --- API types ---

export interface CreateTeamRunInput {
  keyword: string;
  mode?: "fixture" | "real";
  maxRounds?: number;
  maxCandidates?: number;
}

export interface TeamRunSummary {
  runId: string;
  keyword: string;
  status: TeamRunStatus;
  candidateCount: number;
  findingCount: number;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}
