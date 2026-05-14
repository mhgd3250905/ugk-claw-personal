import type {
	TeamRunState,
	TeamStreamName,
	TeamStreamItem,
	TeamRole,
	TeamRoleTaskExecutionInput,
	TeamRoleTaskExecutionResult,
	TeamPlan,
} from "./types.js";
import type { TeamEvent } from "./team-events.js";
import type { TeamWorkspace } from "./team-workspace.js";
import type { TeamRoleTaskRunner } from "./team-role-task-runner.js";
import type { TeamRoleTaskCandidate, TeamTemplate } from "./team-template.js";
import { TeamTemplateRegistry, createDefaultTeamTemplateRegistry } from "./team-template-registry.js";
import { generateTeamEventId, generateRoleTaskId } from "./team-id.js";
import { submitTeamStreamItem, type SubmitTeamStreamItemResult } from "./team-submit.js";
import type { TeamSubmitToolCall, TeamSubmitToolResult } from "./llm-tool-loop.js";

export interface TeamOrchestratorConfig {
	workspace: TeamWorkspace;
	roleTaskRunner: TeamRoleTaskRunner;
	templateRegistry?: TeamTemplateRegistry;
	maxRounds: number;
	maxCandidates: number;
	maxMinutes: number;
	roleTaskTimeoutMs: number;
	roleTaskMaxRetries: number;
}

export class TeamOrchestrator {
	private workspace: TeamWorkspace;
	private runner: TeamRoleTaskRunner;
	private templateRegistry: TeamTemplateRegistry;
	private config: Omit<TeamOrchestratorConfig, "workspace" | "roleTaskRunner" | "templateRegistry">;

	constructor(input: TeamOrchestratorConfig) {
		this.workspace = input.workspace;
		this.runner = input.roleTaskRunner;
		this.templateRegistry = input.templateRegistry ?? createDefaultTeamTemplateRegistry();
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

		const plan = await this.workspace.readPlan(teamRunId);
		const template = this.templateRegistry.get(plan.templateId);

		if (state.status === "queued") {
			state.status = "running";
			state.startedAt = new Date().toISOString();
			await this.emitEvent(teamRunId, "team_run_started", {});
		}

		if (state.startedAt) {
			const elapsed = Date.now() - new Date(state.startedAt).getTime();
			if (elapsed > state.budgets.maxMinutes * 60 * 1000) {
				state.stopSignals.push("maxMinutes exceeded");
			}
		}

		await this.runReadyTemplateTasks(teamRunId, state, plan, template);

		const streams = await this.readTemplateStreams(teamRunId, template);
		const cursors = await this.readTemplateCursors(teamRunId, template);
		const blockResult = template.shouldBlock({ state, streams });
		if (blockResult.blocked) {
			state.status = "blocked";
			state.stopSignals.push(blockResult.reason);
			await this.emitEvent(teamRunId, "team_run_blocked", { reason: blockResult.reason });
		}

		if (state.status === "running" && template.shouldFinalize({ state, streams, cursors })) {
			await this.runTemplateFinalizer(teamRunId, state, plan, template, streams);
		}

		state.updatedAt = new Date().toISOString();
		await this.workspace.writeState(state);
	}

	private async runReadyTemplateTasks(
		teamRunId: string,
		state: TeamRunState,
		plan: TeamPlan,
		template: TeamTemplate,
	): Promise<void> {
		const executedRoleIds = new Set<TeamRole["roleId"]>();
		for (const role of template.roles) {
			if (executedRoleIds.has(role.roleId)) continue;

			const streams = await this.readTemplateStreams(teamRunId, template);
			const cursors = await this.readTemplateCursors(teamRunId, template);
			const candidates = template.getReadyRoleTasks({ teamRunId, state, plan, streams, cursors });
			const candidate = candidates.find((task) => task.roleId === role.roleId);
			if (!candidate) continue;

			await this.runTemplateTask(teamRunId, state, template, candidate);
			executedRoleIds.add(role.roleId);
		}
	}

	private async runTemplateTask(
		teamRunId: string,
		state: TeamRunState,
		template: TeamTemplate,
		candidate: TeamRoleTaskCandidate,
	): Promise<void> {
		if (candidate.updates?.incrementCurrentRound) {
			state.currentRound++;
		}

		const { roleTaskId, result } = await this.runRoleTask(teamRunId, state, template, candidate.roleId, candidate.task);
		if (result.status !== "success") return;

		if (result.emits.length > 0) {
			const seenDomains = await this.getSeenNormalizedDomains(teamRunId);
			for (const emit of result.emits) {
				await this.processEmit(teamRunId, state, template, candidate.roleId, roleTaskId, emit, seenDomains);
			}
		}

		if (candidate.consumes) {
			const lastItem = candidate.consumes.items[candidate.consumes.items.length - 1];
			if (lastItem) {
				await this.workspace.writeCursor(teamRunId, {
					roleId: candidate.roleId,
					streamName: candidate.consumes.streamName,
					lastConsumedItemId: lastItem.itemId,
					updatedAt: new Date().toISOString(),
				});
			}
		}
	}

	private async runTemplateFinalizer(
		teamRunId: string,
		state: TeamRunState,
		plan: TeamPlan,
		template: TeamTemplate,
		streams: Partial<Record<TeamStreamName, TeamStreamItem[]>>,
	): Promise<void> {
		const streamCounts = Object.fromEntries(
			template.streamNames.map((streamName) => [streamName, streams[streamName]?.length ?? 0]),
		);
		const task = this.createTaskInput(teamRunId, "finalizer", {
			streamCounts,
		});

		const { result } = await this.runRoleTask(teamRunId, state, template, "finalizer", task);
		if (result.status !== "success") return;

		await template.finalize({ teamRunId, state, plan, streams, workspace: this.workspace });

		state.status = "completed";
		state.finishedAt = new Date().toISOString();
		await this.emitEvent(teamRunId, "team_run_completed", {});
		await this.emitEvent(teamRunId, "final_report_created", {});
	}

	private async runRoleTask(
		teamRunId: string,
		state: TeamRunState,
		template: TeamTemplate,
		roleId: TeamRole["roleId"],
		task: TeamRoleTaskExecutionInput,
	): Promise<{ roleTaskId: string; result: TeamRoleTaskExecutionResult }> {
		await this.emitEvent(teamRunId, "role_task_started", { roleId, roleTaskId: task.roleTaskId });

		const maxAttempts = 1 + this.config.roleTaskMaxRetries;
		let lastResult: TeamRoleTaskExecutionResult = { status: "failed", emits: [], message: "not attempted" };

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				const result = await this.runTaskWithTimeout(task, state, template);

				if (result.status === "failed" && attempt < maxAttempts) {
					await this.emitEvent(teamRunId, "role_task_retrying", { roleId, attempt, maxAttempts, message: result.message });
					lastResult = result;
					continue;
				}

				if (result.status === "failed") {
					state.counters.failedRoleTasks++;
					await this.emitEvent(teamRunId, "role_task_failed", { roleId, message: result.message });
				} else {
					await this.emitEvent(teamRunId, "role_task_completed", { roleId, emitCount: result.emits.length });
				}
				return { roleTaskId: task.roleTaskId, result };
			} catch (err) {
				const msg = (err as Error).message;
				if (attempt < maxAttempts) {
					await this.emitEvent(teamRunId, "role_task_retrying", { roleId, attempt, maxAttempts, error: msg });
					lastResult = { status: "failed", emits: [], message: msg };
					continue;
				}
				state.counters.failedRoleTasks++;
				await this.emitEvent(teamRunId, "role_task_failed", { roleId, error: msg });
				return { roleTaskId: task.roleTaskId, result: { status: "failed", emits: [], message: msg } };
			}
		}
		return { roleTaskId: task.roleTaskId, result: lastResult };
	}

	private async runTaskWithTimeout(
		task: TeamRoleTaskExecutionInput,
		state: TeamRunState,
		template: TeamTemplate,
	): Promise<TeamRoleTaskExecutionResult> {
		const runTask = () => {
			if (this.runner.runTaskWithSubmitToolHandler) {
				return this.runner.runTaskWithSubmitToolHandler(
					task,
					this.createSubmitToolHandler(state, template, task),
				);
			}
			return this.runner.runTask(task);
		};

		if (this.config.roleTaskTimeoutMs <= 0) {
			return runTask();
		}

		let timeout: ReturnType<typeof setTimeout> | undefined;
		try {
			return await Promise.race([
				runTask(),
				new Promise<never>((_, reject) => {
					timeout = setTimeout(
						() => reject(new Error(`role task timed out after ${this.config.roleTaskTimeoutMs}ms`)),
						this.config.roleTaskTimeoutMs,
					);
				}),
			]);
		} finally {
			if (timeout) clearTimeout(timeout);
		}
	}

	private createSubmitToolHandler(
		state: TeamRunState,
		template: TeamTemplate,
		task: TeamRoleTaskExecutionInput,
	): (call: TeamSubmitToolCall) => Promise<TeamSubmitToolResult> {
		let seenDomains: Set<string> | undefined;
		return async (call) => {
			if (!seenDomains) {
				seenDomains = await this.getSeenNormalizedDomains(task.teamRunId);
			}
			const result = await submitTeamStreamItem({
				workspace: this.workspace,
				template,
				teamRunId: task.teamRunId,
				roleId: call.roleId,
				producerTaskId: task.roleTaskId,
				streamName: call.streamName,
				payload: call.arguments,
				seenCandidateDomains: seenDomains,
			});
			await this.recordSubmitResult(task.teamRunId, state, call.roleId, call.streamName, result);
			if (result.status === "accepted") {
				return { ok: true, message: "accepted", streamName: result.item.streamName };
			}
			if (result.status === "duplicate_skipped") {
				return { ok: false, message: `duplicate skipped: ${result.normalizedDomain}`, streamName: call.streamName };
			}
			return { ok: false, message: result.errors.join("; "), streamName: call.streamName };
		};
	}

	private async processEmit(
		teamRunId: string,
		state: TeamRunState,
		template: TeamTemplate,
		roleId: TeamRole["roleId"],
		producerTaskId: string,
		emit: { streamName: TeamStreamName; payload: unknown },
		seenDomains: Set<string>,
	): Promise<void> {
		const result = await submitTeamStreamItem({
			workspace: this.workspace,
			template,
			teamRunId,
			roleId,
			producerTaskId,
			streamName: emit.streamName,
			payload: emit.payload,
			seenCandidateDomains: seenDomains,
		});

		await this.recordSubmitResult(teamRunId, state, roleId, emit.streamName, result);
	}

	private async recordSubmitResult(
		teamRunId: string,
		state: TeamRunState,
		roleId: TeamRole["roleId"],
		streamName: TeamStreamName,
		result: SubmitTeamStreamItemResult,
	): Promise<void> {
		if (result.status === "rejected") {
			await this.emitEvent(teamRunId, "stream_item_rejected", {
				roleId,
				streamName,
				reason: result.reason,
				errors: result.errors,
			});
			return;
		}

		if (result.status === "duplicate_skipped") {
			await this.emitEvent(teamRunId, "stream_item_duplicate_skipped", { domain: result.normalizedDomain });
			return;
		}

		await this.emitEvent(teamRunId, "stream_item_accepted", {
			itemId: result.item.itemId,
			streamName: result.item.streamName,
		});

		this.incrementCounter(state, result.item.streamName);
	}

	private incrementCounter(state: TeamRunState, streamName: TeamStreamName): void {
		switch (streamName) {
			case "candidate_domains": state.counters.candidateDomains++; break;
			case "domain_evidence": state.counters.domainEvidence++; break;
			case "domain_classifications": state.counters.classifications++; break;
			case "review_findings": state.counters.reviewFindings++; break;
		}
	}

	private async readTemplateStreams(
		teamRunId: string,
		template: TeamTemplate,
	): Promise<Partial<Record<TeamStreamName, TeamStreamItem[]>>> {
		const streams: Partial<Record<TeamStreamName, TeamStreamItem[]>> = {};
		for (const streamName of template.streamNames) {
			streams[streamName] = await this.workspace.readStreamItems(teamRunId, streamName);
		}
		return streams;
	}

	private async readTemplateCursors(
		teamRunId: string,
		template: TeamTemplate,
	): Promise<Record<string, { lastConsumedItemId?: string } | undefined>> {
		const cursors: Record<string, { lastConsumedItemId?: string } | undefined> = {};
		for (const role of template.roles) {
			for (const streamName of role.allowedInputStreams) {
				cursors[`${role.roleId}_${streamName}`] = await this.workspace.readCursor(teamRunId, role.roleId, streamName);
			}
		}
		return cursors;
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
}
