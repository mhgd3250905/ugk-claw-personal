export interface CandidateDomain {
  domain: string;
  normalizedDomain: string;
  sourceType:
    | "search_query"
    | "certificate_transparency"
    | "github_or_docs"
    | "similar_domain"
    | "known_site_link"
    | "manual_seed";
  sourceUrl?: string;
  query?: string;
  snippet?: string;
  matchReason: string;
  confidence: "low" | "medium" | "high";
  discoveredAt: string;
}

export interface DiscoveryEnvelope {
  status: "success" | "partial" | "failed";
  emits: Array<{
    type: "candidate_domain";
    payload: CandidateDomain;
  }>;
  checkpoint: {
    completedQueries: string[];
    remainingQueries: string[];
    notes: string[];
  };
  errors?: string[];
}

export interface ReviewFinding {
  targetDomain?: string;
  verdict: "pass" | "pass_with_warning" | "fail" | "needs_user_input";
  issueType:
    | "unsupported_claim"
    | "overstatement"
    | "missing_evidence"
    | "classification_risk"
    | "strategy_warning"
    | "coverage_limitation";
  message: string;
  recommendedChange?: string;
  createdAt: string;
}

export interface ReviewEnvelope {
  status: "success" | "partial" | "failed";
  findings: ReviewFinding[];
  summary: string;
  errors?: string[];
}

export interface SpikeState {
  runId: string;
  keyword: string;
  status: "running" | "failed" | "completed";
  currentRound: number;
  maxRounds: number;
  maxCandidates: number;
  queries: string[];
  completedQueries: string[];
  acceptedCandidates: number;
  rejectedCandidates: number;
  duplicateCandidates: number;
  startedAt: string;
  finishedAt?: string;
  lastError?: string;
}

export interface ProbeResult {
  probeId: string;
  totalRuns: number;
  passed: number;
  failed: number;
  errors: Array<{ run: number; error: string }>;
  runDetails: Array<{
    run: number;
    passed: boolean;
    candidateCount: number;
    error?: string;
  }>;
}
