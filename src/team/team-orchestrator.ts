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
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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
			state.updatedAt = new Date().toISOString();
			await this.workspace.writeState(state);
			await this.emitEvent(teamRunId, "team_run_started", {});
		}

		if (state.startedAt) {
			const elapsed = Date.now() - new Date(state.startedAt).getTime();
			if (elapsed > state.budgets.maxMinutes * 60 * 1000) {
				state.stopSignals.push("maxMinutes exceeded");
				await this.stopOverBudgetActiveTasks(teamRunId, state);
			}
		}
		await this.stopIdleActiveTasks(teamRunId, state);

		await this.runReadyTemplateTasks(teamRunId, state, plan, template);

		const latestState = await this.workspace.readState(teamRunId);
		const streams = await this.readTemplateStreams(teamRunId, template);
		const cursors = await this.readTemplateCursors(teamRunId, template);
		const blockResult = template.shouldBlock({ state: latestState, streams });
		if (blockResult.blocked) {
			latestState.status = "blocked";
			latestState.stopSignals.push(blockResult.reason);
			await this.emitEvent(teamRunId, "team_run_blocked", { reason: blockResult.reason });
		}

		if (latestState.status === "running" && !hasActiveRoleTasks(latestState) && template.shouldFinalize({ state: latestState, streams, cursors })) {
			await this.runTemplateFinalizer(teamRunId, latestState, plan, template, streams);
			return;
		}

		latestState.updatedAt = new Date().toISOString();
		await this.workspace.writeState(latestState);
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
			const candidate = candidates.find((task) => task.roleId === role.roleId && !isRoleTaskActive(state, task.roleId));
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
			state.updatedAt = new Date().toISOString();
			await this.workspace.writeState(state);
		}

		const boundTask = this.bindTaskProfile(state, candidate.roleId, candidate.task);
		if (this.shouldRunRoleInBackground(boundTask)) {
			await this.startBackgroundRoleTask(teamRunId, state, template, candidate.roleId, boundTask, candidate.consumes);
			return;
		}

		const { roleTaskId, result } = await this.runRoleTask(teamRunId, state, template, candidate.roleId, boundTask, candidate.consumes);
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

	private async startBackgroundRoleTask(
		teamRunId: string,
		state: TeamRunState,
		template: TeamTemplate,
		roleId: TeamRole["roleId"],
		task: TeamRoleTaskExecutionInput,
		consumes?: TeamRoleTaskCandidate["consumes"],
	): Promise<void> {
		const now = new Date().toISOString();
		state.activeRoleTasks = {
			...(state.activeRoleTasks ?? {}),
			[roleId]: {
				roleTaskId: task.roleTaskId,
				roleId,
				status: "running",
				startedAt: now,
				updatedAt: now,
				lastHeartbeatAt: now,
				...(task.profileId ? { profileId: task.profileId } : {}),
				outputCount: 0,
			},
		};
		state.updatedAt = now;
		await this.workspace.writeState(state);
		await this.emitEvent(teamRunId, "role_task_started", {
			roleId,
			roleTaskId: task.roleTaskId,
			mode: "background",
			...(consumes ? { consumes: describeConsumedItems(consumes) } : {}),
			...(task.profileId ? { profileId: task.profileId } : {}),
		});

		void this.runBackgroundRoleTask(teamRunId, task, template);
	}

	private shouldRunRoleInBackground(task: TeamRoleTaskExecutionInput): boolean {
		return task.roleId === "discovery" && Boolean(task.profileId) && Boolean(this.runner.runTaskWithSubmitToolHandler);
	}

	private async runBackgroundRoleTask(
		teamRunId: string,
		task: TeamRoleTaskExecutionInput,
		template: TeamTemplate,
	): Promise<void> {
		try {
			const state = await this.workspace.readState(teamRunId);
			const result = await this.runTaskWithoutRoleTimeout(task, state, template);
			const latestState = await this.workspace.readState(teamRunId);
			if (result.status === "success") {
				if (result.emits.length > 0) {
					const seenDomains = await this.getSeenNormalizedDomains(teamRunId);
					for (const emit of result.emits) {
						await this.processEmit(teamRunId, latestState, template, task.roleId, task.roleTaskId, emit, seenDomains);
					}
				}
				await this.clearActiveRoleTask(teamRunId, task.roleId);
				await this.emitEvent(teamRunId, "role_task_completed", { roleId: task.roleId, emitCount: result.emits.length, mode: "background" });
				return;
			}
			const failedState = await this.workspace.readState(teamRunId);
			failedState.counters.failedRoleTasks++;
			await this.clearActiveRoleTask(teamRunId, task.roleId, failedState);
			await this.emitEvent(teamRunId, "role_task_failed", { roleId: task.roleId, message: result.message, mode: "background" });
		} catch (err) {
			const failedState = await this.workspace.readState(teamRunId);
			failedState.counters.failedRoleTasks++;
			await this.clearActiveRoleTask(teamRunId, task.roleId, failedState);
			await this.emitEvent(teamRunId, "role_task_failed", { roleId: task.roleId, error: (err as Error).message, mode: "background" });
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
			keyword: state.keyword,
			goal: state.goal,
			companyHints: state.companyHints,
			currentRound: state.currentRound,
			stopSignals: state.stopSignals,
			streams,
			streamCounts,
		});

		const { result } = await this.runRoleTask(teamRunId, state, template, "finalizer", task);

		await template.finalize({
			teamRunId,
			state,
			plan,
			streams,
			workspace: this.workspace,
			finalReportMarkdown: result.status === "success" ? result.finalReportMarkdown : undefined,
		});

		state.status = "completed";
		state.finishedAt = new Date().toISOString();
		state.updatedAt = state.finishedAt;
		await this.workspace.writeState(state);
		await this.emitEvent(teamRunId, "team_run_completed", {});
		await this.emitEvent(teamRunId, "final_report_created", {});
	}

	private async runRoleTask(
		teamRunId: string,
		state: TeamRunState,
		template: TeamTemplate,
		roleId: TeamRole["roleId"],
		task: TeamRoleTaskExecutionInput,
		consumes?: TeamRoleTaskCandidate["consumes"],
	): Promise<{ roleTaskId: string; result: TeamRoleTaskExecutionResult }> {
		const boundTask = task.profileId ? task : this.bindTaskProfile(state, roleId, task);
		await this.emitEvent(teamRunId, "role_task_started", {
			roleId,
			roleTaskId: boundTask.roleTaskId,
			...(consumes ? { consumes: describeConsumedItems(consumes) } : {}),
			...(boundTask.profileId ? { profileId: boundTask.profileId } : {}),
		});

		const maxAttempts = 1 + this.config.roleTaskMaxRetries;
		let lastResult: TeamRoleTaskExecutionResult = { status: "failed", emits: [], message: "not attempted" };

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				const result = await this.runTaskWithTimeout(boundTask, state, template);

				if (result.status === "failed" && attempt < maxAttempts) {
					await this.emitEvent(teamRunId, "role_task_retrying", { roleId, attempt, maxAttempts, message: result.message });
					lastResult = result;
					continue;
				}

				if (result.status === "failed") {
					state.counters.failedRoleTasks++;
					state.updatedAt = new Date().toISOString();
					await this.workspace.writeState(state);
					await this.emitEvent(teamRunId, "role_task_failed", { roleId, message: result.message });
				} else {
					await this.emitEvent(teamRunId, "role_task_completed", { roleId, emitCount: result.emits.length });
				}
				return { roleTaskId: boundTask.roleTaskId, result };
			} catch (err) {
				const msg = (err as Error).message;
				if (attempt < maxAttempts) {
					await this.emitEvent(teamRunId, "role_task_retrying", { roleId, attempt, maxAttempts, error: msg });
					lastResult = { status: "failed", emits: [], message: msg };
					continue;
				}
				state.counters.failedRoleTasks++;
				state.updatedAt = new Date().toISOString();
				await this.workspace.writeState(state);
				await this.emitEvent(teamRunId, "role_task_failed", { roleId, error: msg });
				return { roleTaskId: boundTask.roleTaskId, result: { status: "failed", emits: [], message: msg } };
			}
		}
		return { roleTaskId: boundTask.roleTaskId, result: lastResult };
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

	private async runTaskWithoutRoleTimeout(
		task: TeamRoleTaskExecutionInput,
		state: TeamRunState,
		template: TeamTemplate,
	): Promise<TeamRoleTaskExecutionResult> {
		if (this.runner.runTaskWithSubmitToolHandler) {
			return this.runner.runTaskWithSubmitToolHandler(
				task,
				this.createSubmitToolHandler(state, template, task),
			);
		}
		return this.runner.runTask(task);
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

		const latestState = await this.workspace.readState(teamRunId).catch(() => state);
		this.incrementCounter(latestState, result.item.streamName);
		this.recordActiveRoleOutput(latestState, roleId);
		latestState.updatedAt = new Date().toISOString();
		await this.workspace.writeState(latestState);
	}

	private recordActiveRoleOutput(state: TeamRunState, roleId: TeamRole["roleId"]): void {
		const active = state.activeRoleTasks?.[roleId];
		if (!active) return;
		const now = new Date().toISOString();
		state.activeRoleTasks = {
			...(state.activeRoleTasks ?? {}),
			[roleId]: {
				...active,
				updatedAt: now,
				lastHeartbeatAt: now,
				lastOutputAt: now,
				outputCount: active.outputCount + 1,
			},
		};
	}

	private async clearActiveRoleTask(
		teamRunId: string,
		roleId: TeamRole["roleId"],
		state?: TeamRunState,
	): Promise<void> {
		const nextState = state ?? await this.workspace.readState(teamRunId);
		if (!nextState.activeRoleTasks?.[roleId]) return;
		const activeRoleTasks = { ...nextState.activeRoleTasks };
		delete activeRoleTasks[roleId];
		nextState.activeRoleTasks = Object.keys(activeRoleTasks).length > 0 ? activeRoleTasks : undefined;
		nextState.updatedAt = new Date().toISOString();
		await this.workspace.writeState(nextState);
	}

	private async stopOverBudgetActiveTasks(teamRunId: string, state: TeamRunState): Promise<void> {
		if (!state.activeRoleTasks) return;
		const activeRoleIds = Object.keys(state.activeRoleTasks) as Array<TeamRole["roleId"]>;
		if (activeRoleIds.length === 0) return;
		state.activeRoleTasks = undefined;
		state.updatedAt = new Date().toISOString();
		await this.workspace.writeState(state);
		for (const roleId of activeRoleIds) {
			await this.emitEvent(teamRunId, "role_task_watchdog", {
				roleId,
				action: "marked_stale",
				reason: "maxMinutes exceeded",
			});
		}
	}

	private async stopIdleActiveTasks(teamRunId: string, state: TeamRunState): Promise<void> {
		if (!state.activeRoleTasks || this.config.roleTaskTimeoutMs <= 0) return;
		const now = Date.now();
		const activeRoleTasks = { ...state.activeRoleTasks };
		const staleRoleIds: Array<TeamRole["roleId"]> = [];
		for (const [roleId, task] of Object.entries(activeRoleTasks) as Array<[TeamRole["roleId"], NonNullable<TeamRunState["activeRoleTasks"]>[TeamRole["roleId"]]]>) {
			if (!task) continue;
			const heartbeatAt = Math.max(
				new Date(task.lastHeartbeatAt ?? task.updatedAt ?? task.startedAt).getTime(),
				this.getRoleTaskSessionActivityTime(teamRunId, task.roleTaskId),
			);
			if (now - heartbeatAt > this.config.roleTaskTimeoutMs) {
				delete activeRoleTasks[roleId];
				staleRoleIds.push(roleId);
			}
		}
		if (staleRoleIds.length === 0) return;
		state.activeRoleTasks = Object.keys(activeRoleTasks).length > 0 ? activeRoleTasks : undefined;
		state.counters.failedRoleTasks += staleRoleIds.length;
		state.updatedAt = new Date().toISOString();
		await this.workspace.writeState(state);
		for (const roleId of staleRoleIds) {
			await this.emitEvent(teamRunId, "role_task_watchdog", {
				roleId,
				action: "marked_stale",
				reason: `no heartbeat for ${this.config.roleTaskTimeoutMs}ms`,
			});
		}
	}

	private getRoleTaskSessionActivityTime(teamRunId: string, roleTaskId: string): number {
		const sessionDir = join(this.workspace.getRunDir(teamRunId), "agent-workspaces", roleTaskId, "session");
		if (!existsSync(sessionDir)) return 0;
		let latest = 0;
		for (const entry of readdirSync(sessionDir, { withFileTypes: true })) {
			if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
			const mtime = statSync(join(sessionDir, entry.name)).mtimeMs;
			if (mtime > latest) latest = mtime;
		}
		return latest;
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

	private bindTaskProfile(
		state: TeamRunState,
		roleId: TeamRole["roleId"],
		task: TeamRoleTaskExecutionInput,
	): TeamRoleTaskExecutionInput {
		const profileId = state.roleProfileIds?.[roleId]?.trim();
		const rolePromptOverrideInput = this.getRolePromptOverrideInput(state, roleId);
		if (!profileId && !rolePromptOverrideInput.rolePromptOverride) {
			return task;
		}
		return {
			...task,
			...(profileId && task.profileId !== profileId ? { profileId } : {}),
			inputData: {
				...task.inputData,
				...(profileId ? { roleProfileId: profileId } : {}),
				...rolePromptOverrideInput,
			},
		};
	}

	private getRolePromptOverrideInput(
		state: TeamRunState,
		roleId: TeamRole["roleId"],
	): { rolePromptOverride?: string } {
		const rolePromptOverride = state.rolePromptOverrides?.[roleId]?.trim();
		return rolePromptOverride ? { rolePromptOverride } : {};
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

function describeConsumedItems(consumes: NonNullable<TeamRoleTaskCandidate["consumes"]>): {
	streamName: TeamStreamName;
	itemCount: number;
	itemIds: string[];
	domains: string[];
} {
	return {
		streamName: consumes.streamName,
		itemCount: consumes.items.length,
		itemIds: consumes.items.map((item) => item.itemId),
		domains: consumes.items
			.map((item) => {
				const payload = item.payload as { domain?: unknown; normalizedDomain?: unknown; targetDomain?: unknown };
				return String(payload.normalizedDomain ?? payload.domain ?? payload.targetDomain ?? "").trim();
			})
			.filter(Boolean),
	};
}

function isRoleTaskActive(state: TeamRunState, roleId: TeamRole["roleId"]): boolean {
	return state.activeRoleTasks?.[roleId]?.status === "running";
}

function hasActiveRoleTasks(state: TeamRunState): boolean {
	return Object.values(state.activeRoleTasks ?? {}).some((task) => task?.status === "running");
}
