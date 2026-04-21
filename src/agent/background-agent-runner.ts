import type { AgentSessionLike, RawAgentSessionEventLike } from "./agent-session-factory.js";
import type { ResolvedBackgroundAgentSnapshot, BackgroundAgentProfileResolver } from "./background-agent-profile.js";
import type { BackgroundWorkspaceManager, RunWorkspace } from "./background-workspace.js";
import type { ConnRunRecord, ConnRunStore } from "./conn-run-store.js";
import type { ConnDefinition } from "./conn-store.js";

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
		conn.prompt,
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
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role === "assistant") {
			return stringifyVisibleAssistantContent(message.content).trim();
		}
	}
	return "";
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

function normalizeEvent(event: RawAgentSessionEventLike): Record<string, unknown> {
	return JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
}
