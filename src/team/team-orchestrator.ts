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
import { generateTeamEventId, generateStreamItemId, generateRoleTaskId } from "./team-id.js";

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

		const { roleTaskId, result } = await this.runRoleTask(teamRunId, state, candidate.roleId, candidate.task);
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

		const { result } = await this.runRoleTask(teamRunId, state, "finalizer", task);
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
		roleId: TeamRole["roleId"],
		task: TeamRoleTaskExecutionInput,
	): Promise<{ roleTaskId: string; result: TeamRoleTaskExecutionResult }> {
		await this.emitEvent(teamRunId, "role_task_started", { roleId, roleTaskId: task.roleTaskId });

		const maxAttempts = 1 + this.config.roleTaskMaxRetries;
		let lastResult: TeamRoleTaskExecutionResult = { status: "failed", emits: [], message: "not attempted" };

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				const result = await this.runTaskWithTimeout(task);

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

	private async runTaskWithTimeout(task: TeamRoleTaskExecutionInput): Promise<TeamRoleTaskExecutionResult> {
		if (this.config.roleTaskTimeoutMs <= 0) {
			return this.runner.runTask(task);
		}

		let timeout: ReturnType<typeof setTimeout> | undefined;
		try {
			return await Promise.race([
				this.runner.runTask(task),
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

	private async processEmit(
		teamRunId: string,
		state: TeamRunState,
		template: TeamTemplate,
		roleId: TeamRole["roleId"],
		producerTaskId: string,
		emit: { streamName: TeamStreamName; payload: unknown },
		seenDomains: Set<string>,
	): Promise<void> {
		if (!this.canTemplateRoleWriteStream(template, roleId, emit.streamName)) {
			await this.emitEvent(teamRunId, "stream_item_rejected", { roleId, streamName: emit.streamName, reason: "role not allowed" });
			return;
		}

		const validator = template.getStreamValidator(emit.streamName);
		if (!validator) {
			await this.emitEvent(teamRunId, "stream_item_rejected", { roleId, streamName: emit.streamName, reason: "unknown stream" });
			return;
		}

		const validation = validator(emit.payload);
		if (!validation.ok) {
			await this.emitEvent(teamRunId, "stream_item_rejected", { roleId, streamName: emit.streamName, errors: validation.errors });
			return;
		}

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
			producerTaskId,
			payload: validation.value,
			createdAt: new Date().toISOString(),
		};

		await this.workspace.appendStreamItem(teamRunId, emit.streamName, streamItem);
		await this.emitEvent(teamRunId, "stream_item_accepted", { itemId, streamName: emit.streamName });

		this.incrementCounter(state, emit.streamName);
	}

	private canTemplateRoleWriteStream(
		template: TeamTemplate,
		roleId: TeamRole["roleId"],
		streamName: TeamStreamName,
	): boolean {
		const role = template.roles.find((item) => item.roleId === roleId);
		return Boolean(role?.outputStreams.includes(streamName));
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
