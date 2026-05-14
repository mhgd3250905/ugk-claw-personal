import type { TeamRoleTaskExecutionInput, TeamRoleTaskExecutionResult, TeamStreamName } from "./types.js";
import { loadLLMConfig, callLLM } from "./llm.js";
import { searchAndFormat } from "../team-lab/search.js";
import { stripMarkdownFence, repairJson } from "../team-lab/brand-domain-gate.js";
import {
	buildDiscoveryPrompt,
	buildEvidenceCollectorPrompt,
	buildClassifierPrompt,
	buildReviewerPrompt,
} from "./team-role-prompts.js";

export interface TeamRoleTaskRunner {
	runTask(task: TeamRoleTaskExecutionInput): Promise<TeamRoleTaskExecutionResult>;
}

// --- Mock Runner (Phases 1-6) ---

export class DeterministicMockTeamRoleTaskRunner implements TeamRoleTaskRunner {
	async runTask(task: TeamRoleTaskExecutionInput): Promise<TeamRoleTaskExecutionResult> {
		switch (task.roleId) {
			case "discovery": return this.mockDiscovery(task);
			case "evidence_collector": return this.mockEvidence(task);
			case "classifier": return this.mockClassifier(task);
			case "reviewer": return this.mockReviewer(task);
			case "finalizer": return this.mockFinalizer(task);
			default: return { status: "failed", emits: [], message: `Unknown role: ${task.roleId}` };
		}
	}

	private mockDiscovery(task: TeamRoleTaskExecutionInput): TeamRoleTaskExecutionResult {
		const keyword = (task.inputData.keyword as string) ?? "MED";
		const domains = [`${keyword.toLowerCase()}-example.com`, `${keyword.toLowerCase()}-login.com`, `get${keyword.toLowerCase()}.com`];
		const now = new Date().toISOString();
		return {
			status: "success",
			emits: domains.map((d) => ({ streamName: "candidate_domains" as TeamStreamName, payload: { domain: d, normalizedDomain: d, sourceType: "search_query", query: `${keyword} official domain`, matchReason: `Domain contains ${keyword}`, confidence: "medium", discoveredAt: now } })),
			checkpoint: { completedQueries: [`${keyword} official domain`] },
		};
	}

	private mockEvidence(task: TeamRoleTaskExecutionInput): TeamRoleTaskExecutionResult {
		const candidates = (task.inputData.candidates as Array<{ domain: string; normalizedDomain: string }>) ?? [];
		const now = new Date().toISOString();
		return {
			status: "success",
			emits: candidates.map((c) => ({ streamName: "domain_evidence" as TeamStreamName, payload: { domain: c.normalizedDomain, http: { checked: true, reachable: true, status: 200 }, dns: { checked: false }, certificate: { checked: false }, pageSignals: { mentionsKeyword: true, mentionsCompanyName: false, linksToOfficialDomain: false, usesBrandLikeText: true, notes: [] }, evidence: [{ claim: `Page title contains ${c.normalizedDomain}`, source: `https://${c.normalizedDomain}/`, observation: "Title found", confidence: "medium" }], limitations: ["DNS and certificate checks not performed"], collectedAt: now } })),
			checkpoint: {},
		};
	}

	private mockClassifier(task: TeamRoleTaskExecutionInput): TeamRoleTaskExecutionResult {
		const evidences = (task.inputData.evidences as Array<{ domain: string }>) ?? [];
		const now = new Date().toISOString();
		return {
			status: "success",
			emits: evidences.map((e) => ({ streamName: "domain_classifications" as TeamStreamName, payload: { domain: e.domain, category: "unknown" as const, confidence: "low" as const, reasons: ["No official ownership signal found"], supportingEvidenceRefs: [`domain_evidence:${e.domain}`], recommendedAction: "manual_review" as const, classifiedAt: now } })),
			checkpoint: {},
		};
	}

	private mockReviewer(task: TeamRoleTaskExecutionInput): TeamRoleTaskExecutionResult {
		const classifications = (task.inputData.classifications as Array<{ domain: string; category: string }>) ?? [];
		const now = new Date().toISOString();
		return {
			status: "success",
			emits: classifications.map((c) => ({ streamName: "review_findings" as TeamStreamName, payload: { targetDomain: c.domain, verdict: "pass_with_warning" as const, issueType: "coverage_limitation" as const, message: `Classification ${c.category} is appropriately cautious.`, recommendedChange: "Keep as unknown unless official evidence provided", createdAt: now } })),
			checkpoint: {},
		};
	}

	private mockFinalizer(task: TeamRoleTaskExecutionInput): TeamRoleTaskExecutionResult {
		return { status: "success", emits: [], checkpoint: {}, message: "final_report generated" };
	}
}

// --- LLM Runner (Phase 7) ---

function parseJsonOutput(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
	const stripped = stripMarkdownFence(raw);
	try { return { ok: true, value: JSON.parse(stripped) }; } catch { /* try repair */ }
	try { return { ok: true, value: repairJson(stripped) }; } catch (e) {
		return { ok: false, error: (e as Error).message };
	}
}

/**
 * Converts team-lab envelope format to v0.1 RoleTaskJsonEnvelope format.
 * team-lab discovery emits: { type, payload } — v0.1 expects { streamName, payload }.
 */
function convertDiscoveryEnvelope(raw: unknown): TeamRoleTaskExecutionResult {
	const obj = raw as { status?: string; emits?: Array<{ type?: string; streamName?: string; payload: unknown }>; checkpoint?: Record<string, unknown>; message?: string };
	return {
		status: (obj.status === "success" || obj.status === "partial") ? "success" : (obj.status === "failed" ? "failed" : "success"),
		emits: (obj.emits ?? []).map((e) => ({
			streamName: (e.streamName ?? "candidate_domains") as TeamStreamName,
			payload: e.payload,
		})),
		checkpoint: obj.checkpoint ?? {},
		message: obj.message,
	};
}

export class LLMTeamRoleTaskRunner implements TeamRoleTaskRunner {
	private callLLMFn: (prompt: string) => Promise<string>;
	private searchFn: (queries: string[]) => Promise<string>;

	constructor(deps?: {
		callLLM?: (prompt: string) => Promise<string>;
		search?: (queries: string[]) => Promise<string>;
	}) {
		if (deps?.callLLM) {
			this.callLLMFn = deps.callLLM;
		} else {
			const config = loadLLMConfig();
			this.callLLMFn = (prompt) => callLLM(config, prompt);
		}
		this.searchFn = deps?.search ?? searchAndFormat;
	}

	async runTask(task: TeamRoleTaskExecutionInput): Promise<TeamRoleTaskExecutionResult> {
		switch (task.roleId) {
			case "discovery": return this.runDiscovery(task);
			case "evidence_collector": return this.runEvidence(task);
			case "classifier": return this.runClassifier(task);
			case "reviewer": return this.runReviewer(task);
			case "finalizer": return { status: "success", emits: [], checkpoint: {} };
			default: return { status: "failed", emits: [], message: `Unknown role: ${task.roleId}` };
		}
	}

	private async runDiscovery(task: TeamRoleTaskExecutionInput): Promise<TeamRoleTaskExecutionResult> {
		const keyword = (task.inputData.keyword as string) ?? "MED";
		const queries = (task.inputData.queries as string[]) ?? [`${keyword} official domain`, `${keyword} login`, `${keyword} portal`];

		console.log(`[team-runner] discovery: searching ${queries.length} queries for "${keyword}"`);
		const searchContext = await this.searchFn(queries);
		console.log(`[team-runner] discovery: search context length ${searchContext.length}`);

		const companyHints = task.inputData.companyHints as { officialDomains?: string[]; companyNames?: string[]; excludedGenericMeanings?: string[] } | undefined;

			const prompt = buildDiscoveryPrompt(keyword, queries, searchContext, companyHints);
		const raw = await this.callLLMFn(prompt);

		const parsed = parseJsonOutput(raw);
		if (!parsed.ok) {
			return { status: "failed", emits: [], message: `JSON parse failed: ${parsed.error}`, rawOutput: raw };
		}

		// Handle both v0.1 format (streamName) and team-lab format (type)
		const obj = parsed.value as Record<string, unknown>;
		if (Array.isArray(obj.emits) && obj.emits.length > 0) {
			const firstEmit = obj.emits[0] as Record<string, unknown>;
			if (firstEmit.type && !firstEmit.streamName) {
				// team-lab format — convert to v0.1
				return convertDiscoveryEnvelope(parsed.value);
			}
		}

		return {
			status: (obj.status as "success" | "failed" | "needs_user_input") ?? "success",
			emits: (obj.emits as Array<{ streamName: TeamStreamName; payload: unknown }>) ?? [],
			checkpoint: (obj.checkpoint as Record<string, unknown>) ?? {},
			message: obj.message as string | undefined,
			rawOutput: raw,
		};
	}

	private async runEvidence(task: TeamRoleTaskExecutionInput): Promise<TeamRoleTaskExecutionResult> {
		const keyword = (task.inputData.keyword as string) ?? "MED";
		const candidates = (task.inputData.candidates as Array<{ domain: string; normalizedDomain: string; sourceType: string; snippet?: string }>) ?? [];

		const prompt = buildEvidenceCollectorPrompt(keyword, candidates);
		const raw = await this.callLLMFn(prompt);
		return this.parseEnvelope(raw);
	}

	private async runClassifier(task: TeamRoleTaskExecutionInput): Promise<TeamRoleTaskExecutionResult> {
		const keyword = (task.inputData.keyword as string) ?? "MED";
		const evidences = (task.inputData.evidences as Array<{ domain: string }>) ?? [];

		const prompt = buildClassifierPrompt(keyword, evidences);
		const raw = await this.callLLMFn(prompt);
		return this.parseEnvelope(raw);
	}

	private async runReviewer(task: TeamRoleTaskExecutionInput): Promise<TeamRoleTaskExecutionResult> {
		const keyword = (task.inputData.keyword as string) ?? "MED";
		const classifications = (task.inputData.classifications as Array<{ domain: string; category: string; reasons: string[] }>) ?? [];

		const prompt = buildReviewerPrompt(keyword, classifications);
		const raw = await this.callLLMFn(prompt);
		return this.parseEnvelope(raw);
	}

	private parseEnvelope(raw: string): TeamRoleTaskExecutionResult {
		const parsed = parseJsonOutput(raw);
		if (!parsed.ok) {
			return { status: "failed", emits: [], message: `JSON parse failed: ${parsed.error}`, rawOutput: raw };
		}
		const obj = parsed.value as Record<string, unknown>;
		return {
			status: (obj.status as "success" | "failed" | "needs_user_input") ?? "success",
			emits: (obj.emits as Array<{ streamName: TeamStreamName; payload: unknown }>) ?? [],
			checkpoint: (obj.checkpoint as Record<string, unknown>) ?? {},
			message: obj.message as string | undefined,
			rawOutput: raw,
		};
	}
}

// --- Composite Runner: real for specific roles, mock for the rest ---

export class CompositeTeamRoleTaskRunner implements TeamRoleTaskRunner {
	private realRunner: LLMTeamRoleTaskRunner;
	private mockRunner: DeterministicMockTeamRoleTaskRunner;
	private realRoles: Set<string>;

	constructor(realRoles: string[], deps?: { callLLM?: (prompt: string) => Promise<string>; search?: (queries: string[]) => Promise<string> }) {
		this.realRunner = new LLMTeamRoleTaskRunner(deps);
		this.mockRunner = new DeterministicMockTeamRoleTaskRunner();
		this.realRoles = new Set(realRoles);
	}

	async runTask(task: TeamRoleTaskExecutionInput): Promise<TeamRoleTaskExecutionResult> {
		if (this.realRoles.has(task.roleId)) {
			console.log(`[team-runner] using LLM runner for role: ${task.roleId}`);
			return this.realRunner.runTask(task);
		}
		return this.mockRunner.runTask(task);
	}
}
