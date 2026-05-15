import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { TeamRoleRunner, WorkerInput, WorkerOutput, CheckerInput, CheckerOutput, WatcherInput, WatcherOutput, FinalizerInput, FinalizerOutput } from "./role-runner.js";
import type { TeamTask, TeamPlan } from "./types.js";
import type { BackgroundAgentSessionFactory } from "../agent/background-agent-runner.js";
import { BackgroundAgentProfileResolver } from "../agent/background-agent-profile.js";
import type { ResolvedBackgroundAgentSnapshot, BackgroundAgentProfileRef } from "../agent/background-agent-profile.js";
import { ProjectBackgroundSessionFactory } from "../agent/background-agent-session-factory.js";
import { findLastAssistantMessage, assertAssistantMessageSucceeded } from "../agent/agent-run-result.js";
import { stringifyVisibleAssistantContent } from "../agent/background-agent-runner.js";
import { createBrowserCleanupScope, runWithScopedAgentEnvironment } from "../agent/agent-run-scope.js";
import { runWithBackgroundWorkspaceContext } from "../agent/background-workspace-context.js";

export interface AgentProfileRoleRunnerOptions {
	projectRoot: string;
	teamDataDir: string;
	workerProfileId: string;
	checkerProfileId: string;
	watcherProfileId: string;
	finalizerProfileId: string;
	profileResolver?: BackgroundAgentProfileResolver;
	sessionFactory?: BackgroundAgentSessionFactory;
	defaultBrowserId?: string;
	closeBrowserTargetsForScope?: (scope: string) => Promise<void>;
}

function buildDefaultRef(profileId: string): BackgroundAgentProfileRef {
	return {
		profileId,
		agentSpecId: "team-default",
		skillSetId: "team-default",
		modelPolicyId: "team-default",
		upgradePolicy: "latest",
	};
}

function buildWorkerPrompt(task: TeamTask, acceptanceRules: string[], feedback?: string): string {
	let prompt = `你是一个执行 Agent（worker）。请完成以下任务。

## 任务
标题：${task.title}
描述：${task.input.text}
${task.input.payload ? `\n附加数据：\n\`\`\`json\n${JSON.stringify(task.input.payload, null, 2)}\n\`\`\`` : ""}

## 验收标准
${acceptanceRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

## 输出要求
- 自由输出你的工作结果（markdown 格式）
- 产出的文件放在当前工作目录
${feedback ? `\n## 上次反馈（请针对反馈修改）\n${feedback}` : ""}`;

	return prompt;
}

function buildCheckerPrompt(task: TeamTask, acceptanceRules: string[], workerOutput: string): string {
	return `你是一个验收 Agent（checker）。请评审 worker 的输出。

## 任务
标题：${task.title}
描述：${task.input.text}

## 验收标准
${acceptanceRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

## Worker 输出
${workerOutput}

## 输出要求
请严格按以下 JSON 格式输出（不要输出其他内容）：
- 如果通过：{"verdict":"pass","reason":"通过原因","resultContent":"最终验收内容（markdown）"}
- 如果需要修改：{"verdict":"revise","reason":"需要修改的原因","feedback":"具体修改建议"}
- 如果失败：{"verdict":"fail","reason":"失败原因","resultContent":"失败说明"}`;
}

function buildWatcherPrompt(task: TeamTask, workUnitStatus: "passed" | "failed", resultRef: string | null, errorSummary: string | null): string {
	return `你是一个复盘 Agent（watcher）。请审核当前任务的工作结果。

## 任务
标题：${task.title}

## 工作单元结果
状态：${workUnitStatus === "passed" ? "通过" : "失败"}
${errorSummary ? `错误：${errorSummary}` : ""}

## 输出要求
请严格按以下 JSON 格式输出（不要输出其他内容）：
- 如果认可结果：{"decision":"accept_task","reason":"认可原因"}
- 如果确认失败：{"decision":"confirm_failed","reason":"确认失败原因"}
- 如果需要重新执行：{"decision":"request_revision","reason":"重新执行原因","revisionMode":"amend 或 redo","feedback":"给执行 Agent 的补充说明"}`;
}

function buildFinalizerPrompt(plan: TeamPlan, taskResults: Array<{ taskId: string; status: "succeeded" | "failed"; resultRef: string | null; errorSummary: string | null }>): string {
	const taskSummary = taskResults.map(r => `- ${r.taskId}: ${r.status === "succeeded" ? "成功" : "失败"}${r.errorSummary ? `（${r.errorSummary}）` : ""}`).join("\n");

	return `你是一个汇总 Agent（finalizer）。请根据任务执行结果生成最终报告。

## 计划目标
${plan.goal.text}

## 输出要求
${plan.outputContract.text}

## 任务结果
${taskSummary}

## 输出格式
用中文输出 markdown 格式的最终汇总报告，包括：
1. 总结
2. 已完成任务
3. 失败/未完成任务
4. 下次准备建议`;
}

function parseJsonResponse<T>(text: string): T {
	const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
	return JSON.parse(cleaned) as T;
}

interface CheckerJsonOutput {
	verdict: "pass" | "revise" | "fail";
	reason: string;
	feedback?: string;
	resultContent?: string;
}

interface WatcherJsonOutput {
	decision: "accept_task" | "confirm_failed" | "request_revision";
	reason: string;
	revisionMode?: "amend" | "redo";
	feedback?: string;
}

async function readRefContent(teamDataDir: string, runId: string, ref: string): Promise<string> {
	const { readFile } = await import("node:fs/promises");
	const { join } = await import("node:path");
	try {
		return await readFile(join(teamDataDir, "runs", runId, ref), "utf8");
	} catch {
		return ref;
	}
}

export class AgentProfileRoleRunner implements TeamRoleRunner {
	private readonly options: AgentProfileRoleRunnerOptions;
	private readonly sessionFactory: BackgroundAgentSessionFactory;
	private readonly profileResolver: BackgroundAgentProfileResolver;

	constructor(options: AgentProfileRoleRunnerOptions) {
		this.options = options;
		this.sessionFactory = options.sessionFactory ?? new ProjectBackgroundSessionFactory(options.projectRoot);
		this.profileResolver = options.profileResolver ?? new BackgroundAgentProfileResolver({ projectRoot: options.projectRoot });
	}

	setProfileIds(profiles: { workerProfileId: string; checkerProfileId: string; watcherProfileId: string; finalizerProfileId: string }): void {
		this.options.workerProfileId = profiles.workerProfileId;
		this.options.checkerProfileId = profiles.checkerProfileId;
		this.options.watcherProfileId = profiles.watcherProfileId;
		this.options.finalizerProfileId = profiles.finalizerProfileId;
	}

	async runWorker(input: WorkerInput): Promise<WorkerOutput> {
		const snapshot = await this.resolveProfile(this.options.workerProfileId);
		const workspace = await this.createRoleWorkspace(input.runId, input.attemptId, "worker");
		const prompt = buildWorkerPrompt(input.task, input.acceptanceRules, input.feedback);

		const content = await this.runSession(snapshot, input.runId, workspace, prompt);

		return { content, artifactRefs: [] };
	}

	async runChecker(input: CheckerInput): Promise<CheckerOutput> {
		const snapshot = await this.resolveProfile(this.options.checkerProfileId);
		const workspace = await this.createRoleWorkspace(input.runId, input.attemptId, "checker");
		const workerOutput = await readRefContent(this.options.teamDataDir, input.runId, input.workerOutputRef);
		const prompt = buildCheckerPrompt(input.task, input.acceptanceRules, workerOutput);

		const content = await this.runSession(snapshot, input.runId, workspace, prompt);

		try {
			const parsed = parseJsonResponse<CheckerJsonOutput>(content);
			return {
				verdict: parsed.verdict,
				reason: parsed.reason ?? "",
				feedback: parsed.feedback,
				resultContent: parsed.resultContent,
			};
		} catch {
			return { verdict: "fail", reason: "checker output parse error", resultContent: content };
		}
	}

	async runWatcher(input: WatcherInput): Promise<WatcherOutput> {
		const snapshot = await this.resolveProfile(this.options.watcherProfileId);
		const workspace = await this.createRoleWorkspace(input.runId, input.attemptId, "watcher");
		const prompt = buildWatcherPrompt(input.task, input.workUnitStatus, input.resultRef, input.errorSummary);

		const content = await this.runSession(snapshot, input.runId, workspace, prompt);

		try {
			const parsed = parseJsonResponse<WatcherJsonOutput>(content);
			return {
				decision: parsed.decision,
				reason: parsed.reason ?? "",
				revisionMode: parsed.revisionMode,
				feedback: parsed.feedback,
			};
		} catch {
			return { decision: "accept_task", reason: "watcher output parse error, defaulting to accept" };
		}
	}

	async runFinalizer(input: FinalizerInput): Promise<FinalizerOutput> {
		const snapshot = await this.resolveProfile(this.options.finalizerProfileId);
		const workspace = await this.createRoleWorkspace(input.runId, "finalizer", "finalizer");
		const prompt = buildFinalizerPrompt(input.plan, input.taskResults);

		const content = await this.runSession(snapshot, input.runId, workspace, prompt);

		return { finalReport: content };
	}

	private async resolveProfile(profileId: string): Promise<ResolvedBackgroundAgentSnapshot> {
		return this.profileResolver.resolve(buildDefaultRef(profileId));
	}

	private async createRoleWorkspace(runId: string, roleKey: string, role: string) {
		const workspaceRoot = join(this.options.teamDataDir, "runs", runId, "agent-workspaces", roleKey, role);
		const workDir = join(workspaceRoot, "work");
		const outputDir = join(workspaceRoot, "output");
		const sessionDir = join(workspaceRoot, "session");
		await mkdir(workDir, { recursive: true });
		await mkdir(outputDir, { recursive: true });
		await mkdir(sessionDir, { recursive: true });
		return { rootPath: workspaceRoot, workDir, outputDir, sessionDir };
	}

	private async runSession(
		snapshot: ResolvedBackgroundAgentSnapshot,
		runId: string,
		workspace: { rootPath: string; workDir: string; outputDir: string; sessionDir: string },
		prompt: string,
	): Promise<string> {
		const browserId = this.options.defaultBrowserId;
		const browserScope = `team:${runId}`;
		const scopeId = browserId ? createBrowserCleanupScope(browserScope, browserId) : undefined;

		const session = await this.sessionFactory.createSession({
			runId,
			connId: `team-${runId}`,
			workspace: {
				rootPath: workspace.rootPath,
				inputDir: workspace.workDir,
				workDir: workspace.workDir,
				outputDir: workspace.outputDir,
				logsDir: workspace.outputDir,
				sessionDir: workspace.sessionDir,
				sharedDir: workspace.workDir,
				publicDir: workspace.outputDir,
				artifactPublicDir: workspace.outputDir,
				manifestPath: join(workspace.rootPath, "manifest.json"),
			},
			snapshot,
			browserId,
			browserScope,
		});

		const wsEnv: Record<string, string | undefined> = {
			OUTPUT_DIR: workspace.outputDir,
			WORK_DIR: workspace.workDir,
			INPUT_DIR: workspace.workDir,
			LOGS_DIR: workspace.outputDir,
		};

		try {
			if (scopeId) {
				await runWithScopedAgentEnvironment(scopeId, async () => {
					await runWithBackgroundWorkspaceContext(wsEnv, async () => {
						await session.prompt(prompt);
					});
				});
			} else {
				await runWithBackgroundWorkspaceContext(wsEnv, async () => {
					await session.prompt(prompt);
				});
			}
		} finally {
			if (this.options.closeBrowserTargetsForScope && browserScope) {
				await this.options.closeBrowserTargetsForScope(browserScope).catch(() => {});
			}
		}

		const lastMsg = findLastAssistantMessage(session.messages ?? []);
		assertAssistantMessageSucceeded(lastMsg);

		return stringifyVisibleAssistantContent(lastMsg?.content ?? "");
	}
}
