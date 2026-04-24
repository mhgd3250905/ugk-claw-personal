import { readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import type { AgentSessionLike, RawAgentSessionEventLike } from "./agent-session-factory.js";
import type { ResolvedBackgroundAgentSnapshot, BackgroundAgentProfileResolver } from "./background-agent-profile.js";
import type { BackgroundWorkspaceManager, RunWorkspace } from "./background-workspace.js";
import type { ConnRunRecord, ConnRunStore } from "./conn-run-store.js";
import type { ConnDefinition } from "./conn-store.js";
import { prependCurrentTimeContext } from "./file-artifacts.js";

export interface BackgroundAgentSessionFactory {
	createSession(input: {
		runId: string;
		connId: string;
		workspace: RunWorkspace;
		snapshot: ResolvedBackgroundAgentSnapshot;
		sessionFile?: string;
	}): Promise<AgentSessionLike>;
}

export interface BackgroundAgentRunnerOptions {
	runStore: ConnRunStore;
	profileResolver: BackgroundAgentProfileResolver;
	workspaceManager: BackgroundWorkspaceManager;
	sessionFactory: BackgroundAgentSessionFactory;
}

export class BackgroundAgentRunner {
	constructor(private readonly options: BackgroundAgentRunnerOptions) {}

	async run(
		conn: ConnDefinition,
		run: ConnRunRecord,
		now: Date = new Date(),
		signal?: AbortSignal,
	): Promise<ConnRunRecord | undefined> {
		let unsubscribe: (() => void) | undefined;
		try {
			const workspace = await this.options.workspaceManager.createRunWorkspace({
				runId: run.runId,
				connId: conn.connId,
				title: conn.title,
				assetRefs: conn.assetRefs,
				now,
			});
			await this.options.runStore.appendEvent({
				runId: run.runId,
				eventType: "workspace_created",
				event: {
					rootPath: workspace.rootPath,
				},
				createdAt: now,
			});

			const snapshot = await this.options.profileResolver.resolve({
				profileId: conn.profileId ?? "background.default",
				agentSpecId: conn.agentSpecId ?? "agent.default",
				skillSetId: conn.skillSetId ?? "skills.default",
				modelPolicyId: conn.modelPolicyId ?? "model.default",
				upgradePolicy: conn.upgradePolicy ?? "latest",
				now,
			});
			await this.options.runStore.appendEvent({
				runId: run.runId,
				eventType: "snapshot_resolved",
				event: {
					profileId: snapshot.profileId,
					agentSpecId: snapshot.agentSpecId,
					skillSetId: snapshot.skillSetId,
					modelPolicyId: snapshot.modelPolicyId,
					skillSetVersion: snapshot.skillSetVersion,
				},
				createdAt: now,
			});

			await this.options.runStore.updateRuntimeInfo({
				runId: run.runId,
				workspacePath: workspace.rootPath,
				resolvedSnapshot: { ...snapshot },
				now,
			});

			const session = await this.options.sessionFactory.createSession({
				runId: run.runId,
				connId: conn.connId,
				workspace,
				snapshot,
				sessionFile: run.sessionFile,
			});
			unsubscribe = session.subscribe((event) => {
				void this.recordSessionEvent(run.runId, event);
			});

			const prompt = buildBackgroundPrompt(conn, workspace);
			await promptWithAbort(session, prompt, signal);
			unsubscribe?.();
			unsubscribe = undefined;

			await recordOutputFiles(this.options.runStore, run.runId, workspace, now);
			const resultText = extractAssistantText(session);
			const summary = resultText.slice(0, 200) || "Conn run completed";
			await this.options.runStore.updateRuntimeInfo({
				runId: run.runId,
				sessionFile: session.sessionFile,
				now,
			});
			await this.options.runStore.appendEvent({
				runId: run.runId,
				eventType: "run_succeeded",
				event: { summary },
				createdAt: now,
			});
			return await this.options.runStore.completeRun({
				runId: run.runId,
				summary,
				text: resultText,
				finishedAt: now,
			});
		} catch (error) {
			unsubscribe?.();
			const message = error instanceof Error ? error.message : "Unknown background conn run error";
			await this.options.runStore.appendEvent({
				runId: run.runId,
				eventType: "run_failed",
				event: { error: message },
				createdAt: now,
			});
			return await this.options.runStore.failRun({
				runId: run.runId,
				summary: message,
				errorText: message,
				finishedAt: now,
			});
		}
	}

	private async recordSessionEvent(runId: string, event: RawAgentSessionEventLike): Promise<void> {
		await this.options.runStore.appendEvent({
			runId,
			eventType: event.type,
			event: normalizeEvent(event),
		});
	}
}

async function promptWithAbort(session: AgentSessionLike, prompt: string, signal?: AbortSignal): Promise<void> {
	if (!signal) {
		await session.prompt(prompt);
		return;
	}

	if (signal.aborted) {
		await session.abort?.();
		throw toAbortError(signal.reason);
	}

	let removeAbortListener = (): undefined => undefined;
	const aborted = new Promise<never>((_resolve, reject) => {
		const onAbort = () => {
			void session.abort?.();
			reject(toAbortError(signal.reason));
		};
		signal.addEventListener("abort", onAbort, { once: true });
		removeAbortListener = () => {
			signal.removeEventListener("abort", onAbort);
			return undefined;
		};
	});

	try {
		await Promise.race([session.prompt(prompt), aborted]);
	} finally {
		removeAbortListener();
	}
}

function toAbortError(reason: unknown): Error {
	return reason instanceof Error ? reason : new Error(typeof reason === "string" ? reason : "Background conn run aborted");
}

function buildBackgroundPrompt(conn: ConnDefinition, workspace: RunWorkspace): string {
	return [
		`Background conn task: ${conn.title}`,
		"",
		"User task:",
		prependCurrentTimeContext(conn.prompt),
		"",
		"Workspace contract:",
		`- Input files are in: ${workspace.inputDir}`,
		`- Write intermediate files to: ${workspace.workDir}`,
		`- Write final deliverables to: ${workspace.outputDir}`,
		`- Write logs to: ${workspace.logsDir}`,
		"- Final response should summarize the result and mention output files.",
	].join("\n");
}

function extractAssistantText(session: AgentSessionLike): string {
	const messages = session.messages ?? [];
	const visibleAssistantTexts: string[] = [];
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role === "assistant") {
			const text = stringifyVisibleAssistantContent(message.content).trim();
			if (text) {
				visibleAssistantTexts.push(text);
			}
		}
	}
	const [latestText, ...earlierTexts] = visibleAssistantTexts;
	if (!latestText) {
		return "";
	}
	if (isOutputOnlySummary(latestText)) {
		return earlierTexts.find((text) => !isOutputOnlySummary(text)) ?? latestText;
	}
	return latestText;
}

function stringifyVisibleAssistantContent(content: unknown): string {
	if (typeof content === "string") {
		return content;
	}
	if (Array.isArray(content)) {
		return content.map(stringifyVisibleAssistantContent).filter(Boolean).join("\n");
	}
	if (content && typeof content === "object") {
		if ("type" in content && content.type === "text" && "text" in content && typeof content.text === "string") {
			return content.text;
		}
		if (!("type" in content) && "text" in content && typeof content.text === "string") {
			return content.text;
		}
		return "";
	}
	return "";
}

async function recordOutputFiles(runStore: ConnRunStore, runId: string, workspace: RunWorkspace, now: Date): Promise<void> {
	const files = await listOutputFiles(workspace.outputDir);
	for (const filePath of files) {
		const fileStats = await stat(filePath);
		const relativePath = join("output", relative(workspace.outputDir, filePath)).replace(/\\/g, "/");
		await runStore.recordFile({
			runId,
			kind: "output",
			relativePath,
			fileName: basename(filePath),
			mimeType: inferOutputMimeType(filePath),
			sizeBytes: fileStats.size,
			createdAt: now,
		});
	}
}

async function listOutputFiles(outputDir: string): Promise<string[]> {
	const entries = await readdir(outputDir, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const entryPath = join(outputDir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listOutputFiles(entryPath)));
			continue;
		}
		if (entry.isFile()) {
			files.push(entryPath);
		}
	}
	return files.sort();
}

function inferOutputMimeType(filePath: string): string {
	const extension = extname(filePath).toLowerCase();
	if (extension === ".txt" || extension === ".md" || extension === ".csv") {
		return "text/plain; charset=utf-8";
	}
	if (extension === ".json") {
		return "application/json";
	}
	if (extension === ".html" || extension === ".htm") {
		return "text/html; charset=utf-8";
	}
	if (extension === ".png") {
		return "image/png";
	}
	if (extension === ".jpg" || extension === ".jpeg") {
		return "image/jpeg";
	}
	if (extension === ".webp") {
		return "image/webp";
	}
	if (extension === ".pdf") {
		return "application/pdf";
	}
	return "application/octet-stream";
}

function isOutputOnlySummary(text: string): boolean {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (normalized.length > 120) {
		return false;
	}
	return (
		/^(任务完成。?)?\s*(输出文件|结果文件|文件).*(已写入|写入|已保存|保存)/.test(normalized) ||
		/^(done|completed)[\s.:;-]+(output|file).*(written|saved)/i.test(normalized)
	);
}

function normalizeEvent(event: RawAgentSessionEventLike): Record<string, unknown> {
	return JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
}
