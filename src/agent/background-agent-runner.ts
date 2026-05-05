import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import type { AgentSessionLike, RawAgentSessionEventLike } from "./agent-session-factory.js";
import type { ResolvedBackgroundAgentSnapshot, BackgroundAgentProfileResolver } from "./background-agent-profile.js";
import type { BackgroundWorkspaceManager, RunWorkspace } from "./background-workspace.js";
import type { ConnRunRecord, ConnRunStore } from "./conn-run-store.js";
import type { ConnDefinition } from "./conn-store.js";
import { closeBrowserTargetsForScope } from "./browser-cleanup.js";
import {
	createBrowserCleanupScope,
	runWithScopedAgentEnvironment,
} from "./agent-run-scope.js";
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
	closeBrowserTargetsForScope?: (scope: string) => Promise<void>;
	publicBaseUrl?: string;
	publicDir?: string;
}

export class BackgroundAgentRunner {
	constructor(private readonly options: BackgroundAgentRunnerOptions) {}

	async run(
		conn: ConnDefinition,
		run: ConnRunRecord,
		now: Date = new Date(),
		signal?: AbortSignal,
	): Promise<ConnRunRecord | undefined> {
		const browserCleanupScope = createBrowserCleanupScope(conn.connId);
		const closeBrowserTargets = this.options.closeBrowserTargetsForScope ?? closeBrowserTargetsForScope;
		let unsubscribe: (() => void) | undefined;
		try {
			await closeBrowserTargets(browserCleanupScope);
			const workspace = await this.options.workspaceManager.createRunWorkspace({
				runId: run.runId,
				connId: conn.connId,
				title: conn.title,
				assetRefs: conn.assetRefs,
				now,
			});
			await this.options.runStore.appendEvent({
				runId: run.runId,
				leaseOwner: run.leaseOwner,
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
				modelProvider: conn.modelProvider,
				modelId: conn.modelId,
				upgradePolicy: conn.upgradePolicy ?? "latest",
				now,
			});
			await this.options.runStore.appendEvent({
				runId: run.runId,
				leaseOwner: run.leaseOwner,
				eventType: "snapshot_resolved",
				event: {
					profileId: snapshot.profileId,
					...(snapshot.requestedAgentId ? { requestedAgentId: snapshot.requestedAgentId } : {}),
					...(snapshot.agentId ? { agentId: snapshot.agentId } : {}),
					...(snapshot.agentName ? { agentName: snapshot.agentName } : {}),
					agentSpecId: snapshot.agentSpecId,
					skillSetId: snapshot.skillSetId,
					modelPolicyId: snapshot.modelPolicyId,
					skillSetVersion: snapshot.skillSetVersion,
				},
				createdAt: now,
			});
			if (snapshot.fallbackUsed) {
				await this.options.runStore.appendEvent({
					runId: run.runId,
					leaseOwner: run.leaseOwner,
					eventType: "agent_profile_fallback",
					event: {
						requestedProfileId: snapshot.requestedAgentId ?? conn.profileId ?? snapshot.profileId,
						fallbackProfileId: snapshot.agentId ?? snapshot.profileId,
						reason: snapshot.fallbackReason ?? "profile_not_found",
					},
					createdAt: now,
				});
			}

			await this.options.runStore.updateRuntimeInfo({
				runId: run.runId,
				leaseOwner: run.leaseOwner,
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
				void this.recordSessionEvent(run.runId, run.leaseOwner, event).catch((error) => {
					console.warn(`[conn-worker] Failed to record session event for run ${run.runId}:`, error);
				});
			});

			const outputBaseUrl = buildConnOutputBaseUrl(this.options.publicBaseUrl, conn.connId, run.runId);
			const prompt = buildBackgroundPrompt(conn, workspace, outputBaseUrl);
			await runWithScopedAgentEnvironment(browserCleanupScope, async () => {
				await runWithBackgroundWorkspaceEnvironment(buildBackgroundWorkspaceEnvironment(workspace, outputBaseUrl), async () => {
					await promptWithAbort(session, prompt, signal);
				});
			});
			unsubscribe?.();
			unsubscribe = undefined;

			const resultText = extractAssistantText(session);
			await captureLinkedPublicOutputFiles(resultText, workspace, this.options.publicDir);
			const finishedAt = new Date();
			await recordOutputFiles(this.options.runStore, run.runId, run.leaseOwner, workspace, finishedAt);
			const summary = resultText.slice(0, 200) || "Conn run completed";
			await this.options.runStore.updateRuntimeInfo({
				runId: run.runId,
				leaseOwner: run.leaseOwner,
				sessionFile: session.sessionFile,
				now: finishedAt,
			});
			await this.options.runStore.appendEvent({
				runId: run.runId,
				leaseOwner: run.leaseOwner,
				eventType: "run_succeeded",
				event: { summary },
				createdAt: finishedAt,
			});
			return await this.options.runStore.completeRun({
				runId: run.runId,
				leaseOwner: run.leaseOwner,
				summary,
				text: resultText,
				finishedAt,
			});
		} catch (error) {
			unsubscribe?.();
			const failedAt = new Date();
			const message = error instanceof Error ? error.message : "Unknown background conn run error";
			await this.options.runStore.appendEvent({
				runId: run.runId,
				leaseOwner: run.leaseOwner,
				eventType: "run_failed",
				event: { error: message },
				createdAt: failedAt,
			});
			return await this.options.runStore.failRun({
				runId: run.runId,
				leaseOwner: run.leaseOwner,
				summary: message,
				errorText: message,
				finishedAt: failedAt,
			});
		} finally {
			await closeBrowserTargets(browserCleanupScope);
		}
	}

	private async recordSessionEvent(runId: string, leaseOwner: string | undefined, event: RawAgentSessionEventLike): Promise<void> {
		await this.options.runStore.appendEvent({
			runId,
			leaseOwner,
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

function buildBackgroundPrompt(conn: ConnDefinition, workspace: RunWorkspace, outputBaseUrl: string | undefined): string {
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
		"",
		"Workspace aliases:",
		`OUTPUT_DIR=${workspace.outputDir}`,
		`WORK_DIR=${workspace.workDir}`,
		`INPUT_DIR=${workspace.inputDir}`,
		`LOGS_DIR=${workspace.logsDir}`,
		...(outputBaseUrl ? [`CONN_OUTPUT_BASE_URL=${outputBaseUrl}`, `ZHIHU_REPORT_BASE_URL=${outputBaseUrl}`] : []),
		"- If this task requires commands, file operations, or browser automation, call the available tools; do not answer from intention alone.",
		"- Only files written under the final deliverables directory are indexed and durable conn outputs.",
		"- Do not report execution success unless the required tool calls actually completed.",
		"- Final response should summarize the result and mention output files.",
	].join("\n");
}

function buildConnOutputBaseUrl(publicBaseUrl: string | undefined, connId: string, runId: string): string | undefined {
	const normalizedBaseUrl = publicBaseUrl?.trim();
	if (!normalizedBaseUrl) {
		return undefined;
	}
	return new URL(
		`/v1/conns/${encodeURIComponent(connId)}/runs/${encodeURIComponent(runId)}/output`,
		normalizedBaseUrl.endsWith("/") ? normalizedBaseUrl : `${normalizedBaseUrl}/`,
	).toString();
}

function buildBackgroundWorkspaceEnvironment(
	workspace: RunWorkspace,
	outputBaseUrl: string | undefined,
): Record<string, string | undefined> {
	return {
		OUTPUT_DIR: workspace.outputDir,
		WORK_DIR: workspace.workDir,
		INPUT_DIR: workspace.inputDir,
		LOGS_DIR: workspace.logsDir,
		CONN_OUTPUT_BASE_URL: outputBaseUrl,
		ZHIHU_REPORT_BASE_URL: outputBaseUrl,
	};
}

async function runWithBackgroundWorkspaceEnvironment<T>(
	values: Record<string, string | undefined>,
	operation: () => Promise<T>,
): Promise<T> {
	const previousValues = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
	for (const [key, value] of Object.entries(values)) {
		if (value === undefined) {
			delete process.env[key];
			continue;
		}
		process.env[key] = value;
	}
	try {
		return await operation();
	} finally {
		for (const [key, value] of Object.entries(previousValues)) {
			if (value === undefined) {
				delete process.env[key];
				continue;
			}
			process.env[key] = value;
		}
	}
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

async function recordOutputFiles(
	runStore: ConnRunStore,
	runId: string,
	leaseOwner: string | undefined,
	workspace: RunWorkspace,
	now: Date,
): Promise<void> {
	const files = await listOutputFiles(workspace.outputDir);
	for (const filePath of files) {
		const fileStats = await stat(filePath);
		const relativePath = join("output", relative(workspace.outputDir, filePath)).replace(/\\/g, "/");
		await runStore.recordFile({
			runId,
			leaseOwner,
			kind: "output",
			relativePath,
			fileName: basename(filePath),
			mimeType: inferOutputMimeType(filePath),
			sizeBytes: fileStats.size,
			createdAt: now,
		});
	}
}

async function captureLinkedPublicOutputFiles(
	resultText: string,
	workspace: RunWorkspace,
	publicDir: string | undefined,
): Promise<void> {
	if (!publicDir) {
		return;
	}
	const publicRoot = resolve(publicDir);
	const outputRoot = resolve(workspace.outputDir);
	for (const publicPath of extractPublicLinkPaths(resultText)) {
		const sourcePath = resolve(join(publicRoot, publicPath));
		if (!isPathInside(sourcePath, publicRoot)) {
			continue;
		}
		let fileStats;
		try {
			fileStats = await stat(sourcePath);
		} catch {
			continue;
		}
		if (!fileStats.isFile()) {
			continue;
		}
		const destinationPath = resolve(join(outputRoot, publicPath));
		if (!isPathInside(destinationPath, outputRoot)) {
			continue;
		}
		await mkdir(dirname(destinationPath), { recursive: true });
		await copyFile(sourcePath, destinationPath);
	}
}

function extractPublicLinkPaths(text: string): string[] {
	const paths = new Set<string>();
	for (const match of text.matchAll(/https?:\/\/[^\s<>)"']+/gi)) {
		tryAddPublicUrlPath(paths, match[0]);
	}
	for (const match of text.matchAll(/\/app\/public\/([^\s<>)"`']+)/g)) {
		addSafePublicPath(paths, match[1]);
	}
	return Array.from(paths);
}

function tryAddPublicUrlPath(paths: Set<string>, value: string): void {
	try {
		addSafePublicPath(paths, new URL(value).pathname.replace(/^\/+/, ""));
	} catch {
		// Ignore malformed model-generated URLs.
	}
}

function addSafePublicPath(paths: Set<string>, value: string): void {
	const normalized = value
		.split(/[?#]/, 1)[0]
		.replace(/\\/g, "/")
		.replace(/^\/+/, "");
	if (!normalized || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
		return;
	}
	paths.add(normalized);
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

function isPathInside(filePath: string, parentDir: string): boolean {
	const normalizedFilePath = resolve(filePath);
	const normalizedParentDir = resolve(parentDir);
	return (
		normalizedFilePath === normalizedParentDir ||
		normalizedFilePath.startsWith(`${normalizedParentDir}\\`) ||
		normalizedFilePath.startsWith(`${normalizedParentDir}/`)
	);
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
