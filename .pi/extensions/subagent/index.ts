import { spawn, type SpawnOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SettingsManager, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
	discoverSubagents,
	getDefaultSystemAgentPath,
	getDefaultUserAgentPath,
	type SubagentDefinition,
} from "./agents.js";
import {
	getDefaultSystemSkillPath,
	getDefaultUserSkillPath,
	getProjectAgentDirPath as getProjectAgentDirPathFromSessionFactory,
} from "../../../src/agent/agent-session-factory.js";

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;

interface ToolTaskInput {
	agent: string;
	task: string;
	cwd?: string;
}

interface SubagentExecutionResult {
	agent: string;
	task: string;
	cwd: string;
	exitCode: number;
	outputText: string;
	lastUpdateText: string;
	stopReason?: string;
	errorMessage?: string;
	stderr: string;
}

interface SubagentToolDetails {
	mode: "single" | "parallel" | "chain";
	projectRoot: string;
	results: SubagentExecutionResult[];
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findProjectRoot(startPath: string): string {
	let current = resolve(startPath);

	while (true) {
		if (existsSync(join(current, ".pi"))) {
			return current;
		}

		const parent = dirname(current);
		if (parent === current) {
			return resolve(startPath);
		}
		current = parent;
	}
}

export function getDefaultProjectGuardExtensionPath(projectRoot: string): string {
	return join(projectRoot, ".pi", "extensions", "project-guard.ts");
}

export function getDefaultAssetStoreExtensionPath(projectRoot: string): string {
	return join(projectRoot, ".pi", "extensions", "asset-store.ts");
}

export function getDefaultConnExtensionPath(projectRoot: string): string {
	return join(projectRoot, ".pi", "extensions", "conn", "index.ts");
}

export function getProjectAgentDirPath(projectRoot: string): string {
	return getProjectAgentDirPathFromSessionFactory(projectRoot);
}

function resolveSubagentModelSelection(projectRoot: string, explicitModel?: string): {
	provider?: string;
	model?: string;
} {
	const settings = SettingsManager.create(projectRoot);
	const defaultProvider = settings.getDefaultProvider();
	const defaultModel = settings.getDefaultModel();

	if (!explicitModel) {
		return {
			provider: defaultProvider,
			model: defaultModel,
		};
	}

	const hasProviderPrefix = explicitModel.includes("/");
	return {
		provider: hasProviderPrefix ? undefined : defaultProvider,
		model: explicitModel,
	};
}

export function buildSubagentCliArgs(options: {
	projectRoot: string;
	task: string;
	systemPromptFile?: string;
	model?: string;
	tools?: string[];
}): string[] {
	const args = ["--mode", "json", "-p", "--no-session", "--no-extensions"];
	args.push("-e", getDefaultProjectGuardExtensionPath(options.projectRoot));
	args.push("-e", getDefaultAssetStoreExtensionPath(options.projectRoot));
	args.push("-e", getDefaultConnExtensionPath(options.projectRoot));
	args.push("--no-skills");
	args.push("--skill", getDefaultSystemSkillPath(options.projectRoot));
	args.push("--skill", getDefaultUserSkillPath(options.projectRoot));
	args.push("--no-prompt-templates", "--no-themes");

	const modelSelection = resolveSubagentModelSelection(options.projectRoot, options.model);
	if (modelSelection.provider) {
		args.push("--provider", modelSelection.provider);
	}
	if (modelSelection.model) {
		args.push("--model", modelSelection.model);
	}
	if (options.tools && options.tools.length > 0) {
		args.push("--tools", options.tools.join(","));
	}
	if (options.systemPromptFile) {
		args.push("--append-system-prompt", options.systemPromptFile);
	}

	args.push(`Task: ${options.task}`);
	return args;
}

export function buildSubagentSpawnOptions(
	cwd: string,
	platform: NodeJS.Platform = process.platform,
	projectRoot = findProjectRoot(cwd),
): SpawnOptions {
	return {
		cwd,
		env: {
			...process.env,
			PI_CODING_AGENT_DIR: getProjectAgentDirPath(projectRoot),
		},
		shell: false,
		stdio: ["ignore", "pipe", "pipe"],
		...(platform === "win32" ? { windowsHide: true } : {}),
	};
}

export function resolvePiCliEntry(): string {
	const packageEntry = import.meta.resolve("@mariozechner/pi-coding-agent");
	const packageDir = dirname(fileURLToPath(packageEntry));
	const cliEntry = join(packageDir, "cli.js");
	if (!existsSync(cliEntry)) {
		throw new Error(`Unable to resolve local pi CLI entry: ${cliEntry}`);
	}
	return cliEntry;
}

async function withSystemPromptFile<T>(agent: SubagentDefinition, work: (path: string) => Promise<T>): Promise<T> {
	const directory = await mkdtemp(join(tmpdir(), "ugk-pi-subagent-"));
	const filePath = join(directory, `${agent.name}.md`);

	try {
		await writeFile(filePath, agent.systemPrompt, { encoding: "utf8" });
		return await work(filePath);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

function extractMessageText(message: unknown): string {
	if (!message || typeof message !== "object") {
		return "";
	}
	if (!("content" in message) || !Array.isArray(message.content)) {
		return "";
	}

	return message.content
		.map((item) => {
			if (typeof item === "string") {
				return item;
			}
			if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
				return item.text;
			}
			return "";
		})
		.filter((part) => part.length > 0)
		.join("\n")
		.trim();
}

function isAssistantMessage(message: unknown): boolean {
	return Boolean(message && typeof message === "object" && "role" in message && message.role === "assistant");
}

function isToolResultMessage(message: unknown): boolean {
	return Boolean(message && typeof message === "object" && "role" in message && message.role === "toolResult");
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object";
}

function toErrorText(result: SubagentExecutionResult): string {
	return result.errorMessage || result.stderr.trim() || result.outputText || "Subagent execution failed";
}

function isFailedResult(result: SubagentExecutionResult): boolean {
	return result.exitCode !== 0 || result.stopReason === "error" || result.stopReason === "aborted";
}

async function runSingleSubagent(
	projectRoot: string,
	agent: SubagentDefinition,
	task: string,
	cwd: string,
	signal: AbortSignal | undefined,
	onUpdate?: (text: string, current: SubagentExecutionResult) => void,
): Promise<SubagentExecutionResult> {
	const cliEntry = resolvePiCliEntry();
	const result: SubagentExecutionResult = {
		agent: agent.name,
		task,
		cwd,
		exitCode: 1,
		outputText: "",
		lastUpdateText: "",
		stderr: "",
	};

	return await withSystemPromptFile(agent, async (systemPromptFile) => {
		const args = buildSubagentCliArgs({
			projectRoot,
			task,
			systemPromptFile,
			model: agent.model,
			tools: agent.tools,
		});

		await new Promise<void>((resolvePromise, rejectPromise) => {
			const child = spawn(process.execPath, [cliEntry, ...args], buildSubagentSpawnOptions(cwd, process.platform, projectRoot));
			let stdoutBuffer = "";

			const processLine = (line: string) => {
				if (!line.trim()) {
					return;
				}

				let payload: unknown;
				try {
					payload = JSON.parse(line);
				} catch {
					return;
				}

				if (!isJsonObject(payload)) {
					return;
				}

				if (payload.type === "message_end" && "message" in payload) {
					const text = extractMessageText(payload.message);
					if (isAssistantMessage(payload.message)) {
						result.outputText = text || result.outputText;
						result.lastUpdateText = text || result.lastUpdateText;
						if (
							"message" in payload &&
							payload.message &&
							typeof payload.message === "object" &&
							"stopReason" in payload.message &&
							typeof payload.message.stopReason === "string"
						) {
							result.stopReason = payload.message.stopReason;
						}
						if (
							"message" in payload &&
							payload.message &&
							typeof payload.message === "object" &&
							"errorMessage" in payload.message &&
							typeof payload.message.errorMessage === "string"
						) {
							result.errorMessage = payload.message.errorMessage;
						}
					}
					if (text) {
						onUpdate?.(text, result);
					}
				}

				if (payload.type === "tool_result_end" && "message" in payload && isToolResultMessage(payload.message)) {
					const text = extractMessageText(payload.message);
					if (text) {
						result.lastUpdateText = text;
						onUpdate?.(text, result);
					}
				}
			};

			child.stdout?.on("data", (chunk: Buffer) => {
				stdoutBuffer += chunk.toString();
				const lines = stdoutBuffer.split(/\r?\n/);
				stdoutBuffer = lines.pop() ?? "";
				for (const line of lines) {
					processLine(line);
				}
			});

			child.stderr?.on("data", (chunk: Buffer) => {
				result.stderr += chunk.toString();
			});

			child.once("error", rejectPromise);
			child.once("close", (code: number | null) => {
				if (stdoutBuffer.trim()) {
					processLine(stdoutBuffer);
				}
				result.exitCode = code ?? 1;
				resolvePromise();
			});

			const abortChild = () => {
				result.stopReason = "aborted";
				child.kill();
			};

			if (signal) {
				if (signal.aborted) {
					abortChild();
				} else {
					signal.addEventListener("abort", abortChild, { once: true });
					child.once("close", () => signal.removeEventListener("abort", abortChild));
				}
			}
		});

		return result;
	});
}

async function mapWithConcurrencyLimit<T, TResult>(
	items: readonly T[],
	limit: number,
	mapper: (item: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
	if (items.length === 0) {
		return [];
	}

	const results = new Array<TResult>(items.length);
	let nextIndex = 0;
	const concurrency = Math.max(1, Math.min(limit, items.length));

	await Promise.all(
		Array.from({ length: concurrency }, async () => {
			while (true) {
				const currentIndex = nextIndex++;
				if (currentIndex >= items.length) {
					return;
				}
				results[currentIndex] = await mapper(items[currentIndex], currentIndex);
			}
		}),
	);

	return results;
}

function buildAvailableAgentsText(agents: SubagentDefinition[]): string {
	if (agents.length === 0) {
		return "none";
	}

	return agents.map((agent) => `${agent.name} (${agent.source})`).join(", ");
}

const TaskItemSchema = Type.Object({
	agent: Type.String({ description: "Subagent profile name" }),
	task: Type.String({ description: "Delegated task" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the child agent" })),
});

const SubagentParams = Type.Object({
	agent: Type.Optional(Type.String({ description: "Subagent profile name for single execution" })),
	task: Type.Optional(Type.String({ description: "Delegated task for single execution" })),
	cwd: Type.Optional(Type.String({ description: "Working directory for the child agent" })),
	tasks: Type.Optional(Type.Array(TaskItemSchema, { description: "Parallel delegated tasks" })),
	chain: Type.Optional(
		Type.Array(TaskItemSchema, {
			description: "Sequential delegated tasks. Later tasks can reference {previous}.",
		}),
	),
});

export default function subagentExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description:
			"Delegate work to project-scoped subagents with isolated pi subprocesses. Supports single, parallel, and chain execution.",
		parameters: SubagentParams,
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const projectRoot = findProjectRoot(ctx.cwd);
			const agents = discoverSubagents({ projectRoot });
			const availableAgents = buildAvailableAgentsText(agents);

			const singleMode = Boolean(params.agent && params.task);
			const parallelMode = Array.isArray(params.tasks) && params.tasks.length > 0;
			const chainMode = Array.isArray(params.chain) && params.chain.length > 0;
			const modeCount = Number(singleMode) + Number(parallelMode) + Number(chainMode);

			if (modeCount !== 1) {
				return {
					content: [
						{
							type: "text",
							text: `Invalid subagent parameters. Provide exactly one execution mode. Available agents: ${availableAgents}`,
						},
					],
					details: {
						mode: "single",
						projectRoot,
						results: [],
					} satisfies SubagentToolDetails,
					isError: true,
				};
			}

			const byName = new Map(agents.map((agent) => [agent.name, agent]));

			if (singleMode) {
				const agent = byName.get(params.agent!);
				if (!agent) {
					return {
						content: [{ type: "text", text: `Unknown subagent "${params.agent}". Available: ${availableAgents}` }],
						details: { mode: "single", projectRoot, results: [] } satisfies SubagentToolDetails,
						isError: true,
					};
				}

				const result = await runSingleSubagent(
					projectRoot,
					agent,
					params.task!,
					params.cwd ?? ctx.cwd,
					signal,
					(text, current) => {
						onUpdate?.({
							content: [{ type: "text", text: `[${current.agent}] ${text}` }],
							details: {
								mode: "single",
								projectRoot,
								results: [{ ...current }],
							} satisfies SubagentToolDetails,
						});
					},
				);

				return {
					content: [{ type: "text", text: isFailedResult(result) ? toErrorText(result) : result.outputText || "(no output)" }],
					details: { mode: "single", projectRoot, results: [result] } satisfies SubagentToolDetails,
					isError: isFailedResult(result),
				};
			}

			if (parallelMode) {
				if (params.tasks!.length > MAX_PARALLEL_TASKS) {
					return {
						content: [
							{
								type: "text",
								text: `Too many parallel subagent tasks: ${params.tasks!.length}. Max is ${MAX_PARALLEL_TASKS}.`,
							},
						],
						details: { mode: "parallel", projectRoot, results: [] } satisfies SubagentToolDetails,
						isError: true,
					};
				}

				const streamingResults = params.tasks!.map<SubagentExecutionResult>((taskInput) => ({
					agent: taskInput.agent,
					task: taskInput.task,
					cwd: taskInput.cwd ?? ctx.cwd,
					exitCode: -1,
					outputText: "",
					lastUpdateText: "",
					stderr: "",
				}));

				const results = await mapWithConcurrencyLimit(params.tasks!, MAX_CONCURRENCY, async (taskInput, index) => {
					const agent = byName.get(taskInput.agent);
					if (!agent) {
						return {
							...streamingResults[index],
							exitCode: 1,
							errorMessage: `Unknown subagent "${taskInput.agent}". Available: ${availableAgents}`,
						} satisfies SubagentExecutionResult;
					}

					const result = await runSingleSubagent(
						projectRoot,
						agent,
						taskInput.task,
						taskInput.cwd ?? ctx.cwd,
						signal,
						(text, current) => {
							streamingResults[index] = { ...current };
							const doneCount = streamingResults.filter((entry) => entry.exitCode >= 0).length;
							const runningCount = streamingResults.length - doneCount;
							onUpdate?.({
								content: [
									{
										type: "text",
										text: `Parallel subagents: ${doneCount}/${streamingResults.length} done, ${runningCount} running. [${current.agent}] ${text}`,
									},
								],
								details: {
									mode: "parallel",
									projectRoot,
									results: [...streamingResults],
								} satisfies SubagentToolDetails,
							});
						},
					);
					streamingResults[index] = { ...result };
					return result;
				});

				const failures = results.filter((result) => isFailedResult(result));
				const summary = results
					.map((result) => `[${result.agent}] ${isFailedResult(result) ? toErrorText(result) : result.outputText || "(no output)"}`)
					.join("\n\n");

				return {
					content: [{ type: "text", text: summary }],
					details: { mode: "parallel", projectRoot, results } satisfies SubagentToolDetails,
					isError: failures.length > 0,
				};
			}

			const chainResults: SubagentExecutionResult[] = [];
			let previousOutput = "";

			for (const [index, step] of params.chain!.entries()) {
				const agent = byName.get(step.agent);
				if (!agent) {
					return {
						content: [{ type: "text", text: `Unknown subagent "${step.agent}". Available: ${availableAgents}` }],
						details: { mode: "chain", projectRoot, results: chainResults } satisfies SubagentToolDetails,
						isError: true,
					};
				}

				const task = step.task.replace(new RegExp(escapeRegExp("{previous}"), "g"), previousOutput);
				const result = await runSingleSubagent(projectRoot, agent, task, step.cwd ?? ctx.cwd, signal, (text, current) => {
					onUpdate?.({
						content: [{ type: "text", text: `Chain step ${index + 1}/${params.chain!.length} [${current.agent}] ${text}` }],
						details: {
							mode: "chain",
							projectRoot,
							results: [...chainResults, { ...current }],
						} satisfies SubagentToolDetails,
					});
				});
				chainResults.push(result);

				if (isFailedResult(result)) {
					return {
						content: [{ type: "text", text: `Chain stopped at step ${index + 1}: ${toErrorText(result)}` }],
						details: { mode: "chain", projectRoot, results: chainResults } satisfies SubagentToolDetails,
						isError: true,
					};
				}

				previousOutput = result.outputText;
			}

			return {
				content: [{ type: "text", text: chainResults.at(-1)?.outputText || "(no output)" }],
				details: { mode: "chain", projectRoot, results: chainResults } satisfies SubagentToolDetails,
			};
		},
	});
}
