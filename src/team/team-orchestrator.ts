import type { TeamRunState, TeamStreamName, TeamStreamItem, TeamRole, TeamRoleTaskExecutionInput } from "./types.js";
import type { TeamEvent } from "./team-events.js";
import type { TeamWorkspace } from "./team-workspace.js";
import type { TeamRoleTaskRunner } from "./team-role-task-runner.js";
import type { TeamRuntimeConfig } from "./team-config.js";
import {
	validateCandidateDomainPayload,
	validateDomainEvidencePayload,
	validateDomainClassificationPayload,
	validateReviewFindingPayload,
	canRoleWriteStream,
	normalizeDomain,
} from "./team-gate.js";
import { generateTeamEventId, generateStreamItemId, generateRoleTaskId } from "./team-id.js";

type ValidatorFn = (payload: unknown) => { ok: true; value: any } | { ok: false; errors: string[] };

const STREAM_VALIDATORS: Record<TeamStreamName, ValidatorFn> = {
	candidate_domains: validateCandidateDomainPayload,
	domain_evidence: validateDomainEvidencePayload,
	domain_classifications: validateDomainClassificationPayload,
	review_findings: validateReviewFindingPayload,
};

export interface TeamOrchestratorConfig {
	workspace: TeamWorkspace;
	roleTaskRunner: TeamRoleTaskRunner;
	maxRounds: number;
	maxCandidates: number;
	maxMinutes: number;
	roleTaskTimeoutMs: number;
	roleTaskMaxRetries: number;
}

export class TeamOrchestrator {
	private workspace: TeamWorkspace;
	private runner: TeamRoleTaskRunner;
	private config: Omit<TeamOrchestratorConfig, "workspace" | "roleTaskRunner">;

	constructor(input: TeamOrchestratorConfig) {
		this.workspace = input.workspace;
		this.runner = input.roleTaskRunner;
		this.config = {
			maxRounds: input.maxRounds,
			maxCandidates: input.maxCandidates,
			maxMinutes: input.maxMinutes,
			roleTaskTimeoutMs: input.roleTaskTimeoutMs,
			roleTaskMaxRetries: input.roleTaskMaxRetries,
		};
	}

	async tick(teamRunId: string): Promise<void> {
		const state = await this.workspace.readState(teamRunId);

		if (state.status === "completed" || state.status === "failed" || state.status === "cancelled") {
			return;
		}

		if (state.status === "queued") {
			state.status = "running";
			state.startedAt = new Date().toISOString();
			await this.emitEvent(teamRunId, "team_run_started", {});
		}

		// Check maxMinutes
		if (state.startedAt) {
			const elapsed = Date.now() - new Date(state.startedAt).getTime();
			if (elapsed > state.budgets.maxMinutes * 60 * 1000) {
				state.stopSignals.push("maxMinutes exceeded");
			}
		}

		// Discovery
		await this.maybeRunDiscovery(teamRunId, state);

		// Evidence Collector
		await this.maybeRunEvidenceCollector(teamRunId, state);

		// Classifier
		await this.maybeRunClassifier(teamRunId, state);

		// Reviewer
		await this.maybeRunReviewer(teamRunId, state);

		// Check for blocked
		const reviewItems = await this.workspace.readStreamItems(teamRunId, "review_findings");
		for (const item of reviewItems) {
			const payload = item.payload as { verdict: string; message?: string };
			if (payload.verdict === "needs_user_input") {
				state.status = "blocked";
				state.stopSignals.push(payload.message ?? "Reviewer needs user input");
				await this.emitEvent(teamRunId, "team_run_blocked", { reason: payload.message });
				break;
			}
		}

		// Finalizer
		if (state.status === "running") {
			await this.maybeFinalize(teamRunId, state);
		}

		state.updatedAt = new Date().toISOString();
		await this.workspace.writeState(state);
	}

	private async maybeRunDiscovery(teamRunId: string, state: TeamRunState): Promise<void> {
		if (state.stopSignals.length > 0) return;
		if (state.counters.candidateDomains >= state.budgets.maxCandidates) return;
		if (state.currentRound >= state.budgets.maxRounds) return;

		state.currentRound++;
		const task = this.createTaskInput(teamRunId, "discovery", { keyword: state.keyword });
		const result = await this.runRoleTask(teamRunId, state, "discovery", task);

		if (result.status === "success" && result.emits.length > 0) {
			const seenDomains = await this.getSeenNormalizedDomains(teamRunId);
			for (const emit of result.emits) {
				await this.processEmit(teamRunId, state, "discovery", emit, seenDomains);
			}
		}
	}

	private async maybeRunEvidenceCollector(teamRunId: string, state: TeamRunState): Promise<void> {
		const candidates = await this.workspace.readStreamItems(teamRunId, "candidate_domains");
		const cursor = await this.workspace.readCursor(teamRunId, "evidence_collector", "candidate_domains");

		const newItems = this.getItemsAfterCursor(candidates, cursor);
		if (newItems.length === 0) return;
		if (newItems.length < 10 && state.currentRound < state.budgets.maxRounds && state.counters.candidateDomains < state.budgets.maxCandidates) return;

		const batch = newItems.slice(0, 10);
		const task = this.createTaskInput(teamRunId, "evidence_collector", {
			candidates: batch.map((i) => i.payload),
		});

		const result = await this.runRoleTask(teamRunId, state, "evidence_collector", task);
		if (result.status === "success" && result.emits.length > 0) {
			for (const emit of result.emits) {
				await this.processEmit(teamRunId, state, "evidence_collector", emit, new Set());
			}
		}

		// Update cursor
		const lastItem = batch[batch.length - 1];
		await this.workspace.writeCursor(teamRunId, {
			roleId: "evidence_collector",
			streamName: "candidate_domains",
			lastConsumedItemId: lastItem.itemId,
			updatedAt: new Date().toISOString(),
		});
	}

	private async maybeRunClassifier(teamRunId: string, state: TeamRunState): Promise<void> {
		const evidences = await this.workspace.readStreamItems(teamRunId, "domain_evidence");
		const cursor = await this.workspace.readCursor(teamRunId, "classifier", "domain_evidence");

		const newItems = this.getItemsAfterCursor(evidences, cursor);
		if (newItems.length === 0) return;
		if (newItems.length < 10) {
			// Only run if discovery has stopped
			if (state.currentRound >= state.budgets.maxRounds || state.counters.candidateDomains >= state.budgets.maxCandidates || state.stopSignals.length > 0) {
				// ok, run batch
			} else {
				return;
			}
		}

		const batch = newItems.slice(0, 10);
		const task = this.createTaskInput(teamRunId, "classifier", {
			evidences: batch.map((i) => i.payload),
		});

		const result = await this.runRoleTask(teamRunId, state, "classifier", task);
		if (result.status === "success" && result.emits.length > 0) {
			for (const emit of result.emits) {
				await this.processEmit(teamRunId, state, "classifier", emit, new Set());
			}
		}

		const lastItem = batch[batch.length - 1];
		await this.workspace.writeCursor(teamRunId, {
			roleId: "classifier",
			streamName: "domain_evidence",
			lastConsumedItemId: lastItem.itemId,
			updatedAt: new Date().toISOString(),
		});
	}

	private async maybeRunReviewer(teamRunId: string, state: TeamRunState): Promise<void> {
		const classifications = await this.workspace.readStreamItems(teamRunId, "domain_classifications");
		const cursor = await this.workspace.readCursor(teamRunId, "reviewer", "domain_classifications");

		const newItems = this.getItemsAfterCursor(classifications, cursor);
		if (newItems.length === 0) return;

		// Run batch of 20, or all remaining if upstream done
		const batch = newItems.slice(0, 20);
		const task = this.createTaskInput(teamRunId, "reviewer", {
			classifications: batch.map((i) => i.payload),
		});

		const result = await this.runRoleTask(teamRunId, state, "reviewer", task);
		if (result.status === "success" && result.emits.length > 0) {
			for (const emit of result.emits) {
				await this.processEmit(teamRunId, state, "reviewer", emit, new Set());
			}
		}

		const lastItem = batch[batch.length - 1];
		await this.workspace.writeCursor(teamRunId, {
			roleId: "reviewer",
			streamName: "domain_classifications",
			lastConsumedItemId: lastItem.itemId,
			updatedAt: new Date().toISOString(),
		});
	}

	private async maybeFinalize(teamRunId: string, state: TeamRunState): Promise<void> {
		if (state.currentRound < state.budgets.maxRounds && state.counters.candidateDomains < state.budgets.maxCandidates && state.stopSignals.length === 0) {
			return;
		}

		// Check all streams consumed
		const candidates = await this.workspace.readStreamItems(teamRunId, "candidate_domains");
		const evidences = await this.workspace.readStreamItems(teamRunId, "domain_evidence");
		const classifications = await this.workspace.readStreamItems(teamRunId, "domain_classifications");
		const reviews = await this.workspace.readStreamItems(teamRunId, "review_findings");

		const evCursor = await this.workspace.readCursor(teamRunId, "evidence_collector", "candidate_domains");
		const clCursor = await this.workspace.readCursor(teamRunId, "classifier", "domain_evidence");
		const rvCursor = await this.workspace.readCursor(teamRunId, "reviewer", "domain_classifications");

		const evUnconsumed = this.getItemsAfterCursor(candidates, evCursor).length;
		const clUnconsumed = this.getItemsAfterCursor(evidences, clCursor).length;
		const rvUnconsumed = this.getItemsAfterCursor(classifications, rvCursor).length;

		if (evUnconsumed > 0 || clUnconsumed > 0 || rvUnconsumed > 0) return;

		// Finalize
		const task = this.createTaskInput(teamRunId, "finalizer", {
			candidateCount: candidates.length,
			evidenceCount: evidences.length,
			classificationCount: classifications.length,
			reviewCount: reviews.length,
		});

		const result = await this.runRoleTask(teamRunId, state, "finalizer", task);

		// Generate report
		await this.generateReport(teamRunId, state, candidates, evidences, classifications, reviews);

		state.status = "completed";
		state.finishedAt = new Date().toISOString();
		await this.emitEvent(teamRunId, "team_run_completed", {});
		await this.emitEvent(teamRunId, "final_report_created", {});
	}

	private async runRoleTask(
		teamRunId: string,
		state: TeamRunState,
		roleId: TeamRole["roleId"],
		task: TeamRoleTaskExecutionInput,
	) {
		await this.emitEvent(teamRunId, "role_task_started", { roleId, roleTaskId: task.roleTaskId });
		try {
			const result = await this.runner.runTask(task);
			if (result.status === "failed") {
				state.counters.failedRoleTasks++;
				await this.emitEvent(teamRunId, "role_task_failed", { roleId, message: result.message });
			} else {
				await this.emitEvent(teamRunId, "role_task_completed", { roleId, emitCount: result.emits.length });
			}
			return result;
		} catch (err) {
			state.counters.failedRoleTasks++;
			await this.emitEvent(teamRunId, "role_task_failed", { roleId, error: (err as Error).message });
			return { status: "failed" as const, emits: [], message: (err as Error).message };
		}
	}

	private async processEmit(
		teamRunId: string,
		state: TeamRunState,
		roleId: TeamRole["roleId"],
		emit: { streamName: TeamStreamName; payload: unknown },
		seenDomains: Set<string>,
	): Promise<void> {
		if (!canRoleWriteStream(roleId, emit.streamName)) {
			await this.emitEvent(teamRunId, "stream_item_rejected", { roleId, streamName: emit.streamName, reason: "role not allowed" });
			return;
		}

		const validator = STREAM_VALIDATORS[emit.streamName];
		const validation = validator(emit.payload);
		if (!validation.ok) {
			await this.emitEvent(teamRunId, "stream_item_rejected", { roleId, streamName: emit.streamName, errors: validation.errors });
			return;
		}

		// Duplicate check for candidate_domains
		if (emit.streamName === "candidate_domains") {
			const payload = validation.value as { normalizedDomain: string };
			if (seenDomains.has(payload.normalizedDomain)) {
				await this.emitEvent(teamRunId, "stream_item_duplicate_skipped", { domain: payload.normalizedDomain });
				return;
			}
			seenDomains.add(payload.normalizedDomain);
		}

		const itemId = generateStreamItemId();
		const streamItem: TeamStreamItem = {
			itemId,
			teamRunId,
			streamName: emit.streamName,
			producerRoleId: roleId,
			producerTaskId: "mock",
			payload: validation.value,
			createdAt: new Date().toISOString(),
		};

		await this.workspace.appendStreamItem(teamRunId, emit.streamName, streamItem);
		await this.emitEvent(teamRunId, "stream_item_accepted", { itemId, streamName: emit.streamName });

		this.incrementCounter(state, emit.streamName);
	}

	private incrementCounter(state: TeamRunState, streamName: TeamStreamName): void {
		switch (streamName) {
			case "candidate_domains": state.counters.candidateDomains++; break;
			case "domain_evidence": state.counters.domainEvidence++; break;
			case "domain_classifications": state.counters.classifications++; break;
			case "review_findings": state.counters.reviewFindings++; break;
		}
	}

	private async getSeenNormalizedDomains(teamRunId: string): Promise<Set<string>> {
		const items = await this.workspace.readStreamItems(teamRunId, "candidate_domains");
		const seen = new Set<string>();
		for (const item of items) {
			const payload = item.payload as { normalizedDomain: string };
			seen.add(payload.normalizedDomain);
		}
		return seen;
	}

	private getItemsAfterCursor<T>(items: Array<TeamStreamItem<T>>, cursor: { lastConsumedItemId?: string } | undefined): Array<TeamStreamItem<T>> {
		if (!cursor?.lastConsumedItemId) return [...items];
		const idx = items.findIndex((i) => i.itemId === cursor.lastConsumedItemId);
		if (idx < 0) return [...items];
		return items.slice(idx + 1);
	}

	private createTaskInput(teamRunId: string, roleId: TeamRole["roleId"], inputData: Record<string, unknown>): TeamRoleTaskExecutionInput {
		return {
			roleTaskId: generateRoleTaskId(),
			roleId,
			teamRunId,
			inputData,
		};
	}

	private async emitEvent(teamRunId: string, eventType: TeamEvent["eventType"], data: unknown): Promise<void> {
		await this.workspace.appendEvent(teamRunId, {
			eventId: generateTeamEventId(),
			teamRunId,
			eventType,
			createdAt: new Date().toISOString(),
			data,
		});
	}

	private async generateReport(
		teamRunId: string,
		state: TeamRunState,
		candidates: TeamStreamItem[],
		evidences: TeamStreamItem[],
		classifications: TeamStreamItem[],
		reviews: TeamStreamItem[],
	): Promise<void> {
		const lines: string[] = [];
		lines.push(`# ${state.keyword} Domain Discovery Report`);
		lines.push("");
		lines.push("## 1. Summary");
		lines.push(`- Candidate domains: ${candidates.length}`);
		lines.push(`- Evidence collected: ${evidences.length}`);
		lines.push(`- Classifications: ${classifications.length}`);
		lines.push(`- Review findings: ${reviews.length}`);

		const unknownCount = classifications.filter((c) => (c.payload as any).category === "unknown").length;
		const suspiciousCount = classifications.filter((c) => (c.payload as any).category === "suspicious_impersonation").length;
		lines.push(`- Need manual review: ${unknownCount}`);
		lines.push(`- Suspicious: ${suspiciousCount}`);
		lines.push("");

		lines.push("## 2. Coverage");
		lines.push(`- Rounds: ${state.currentRound}`);
		lines.push(`- Stop signals: ${state.stopSignals.join(", ") || "none"}`);
		lines.push("- NOT a comprehensive search of the entire internet.");
		lines.push("");

		lines.push("## 3. Classification Results");
		lines.push("| Domain | Category | Confidence | Action |");
		lines.push("|--------|----------|------------|--------|");
		for (const c of classifications) {
			const p = c.payload as any;
			lines.push(`| ${p.domain} | ${p.category} | ${p.confidence} | ${p.recommendedAction} |`);
		}
		lines.push("");

		if (reviews.length > 0) {
			lines.push("## 4. Review Findings");
			for (const r of reviews) {
				const p = r.payload as any;
				const target = p.targetDomain ? ` (${p.targetDomain})` : "";
				lines.push(`- **${p.verdict}**${target}: ${p.message}`);
			}
			lines.push("");
		}

		lines.push("## 5. Limitations");
		lines.push("- NOT a comprehensive search of the entire internet.");
		lines.push(`- Does NOT represent all ${state.keyword}-related domains.`);
		lines.push("- Domain ownership was NOT verified.");
		if (!state.companyHints.officialDomains?.length) {
			lines.push("- No official domain whitelist was provided; ownership judgments are preliminary only.");
		}
		lines.push("");
		lines.push(`Generated at ${new Date().toISOString()}`);

		await this.workspace.writeArtifactText(teamRunId, "final_report.md", lines.join("\n"));

		await this.workspace.writeArtifactJson(teamRunId, "candidate_domains.json", candidates.map((i) => i.payload));
		await this.workspace.writeArtifactJson(teamRunId, "domain_evidence.json", evidences.map((i) => i.payload));
		await this.workspace.writeArtifactJson(teamRunId, "domain_classifications.json", classifications.map((i) => i.payload));
		await this.workspace.writeArtifactJson(teamRunId, "review_report.json", reviews.map((i) => i.payload));
	}
}
