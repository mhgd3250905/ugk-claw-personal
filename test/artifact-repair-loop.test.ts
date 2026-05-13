import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runArtifactValidationRepairLoop } from "../src/agent/artifact-repair-loop.js";
import { buildDefaultArtifactContract } from "../src/agent/artifact-contract.js";
import type { AgentSessionLike } from "../src/agent/agent-session-factory.js";
import type { RunWorkspace } from "../src/agent/background-workspace.js";
import type { ArtifactContract } from "../src/agent/artifact-contract.js";

function createFakeSession(): {
	prompts: string[];
	session: {
		messages: Array<{ role: string; content: string }>;
		sessionFile?: string;
		subscribe: () => () => void;
		prompt(text: string): Promise<void>;
	} & AgentSessionLike;
	setLastAssistantText(text: string): void;
} {
	const prompts: string[] = [];
	let messages: Array<{ role: string; content: string }> = [];
	return {
		prompts,
		session: {
			get messages() {
				return messages;
			},
			sessionFile: undefined,
			subscribe: () => () => {},
			async prompt(text: string) {
				prompts.push(text);
			},
		},
		setLastAssistantText(text: string) {
			messages = [...messages, { role: "assistant", content: text }];
		},
	};
}

async function createTestWorkspace(): Promise<{
	rootPath: string;
	workspace: RunWorkspace;
}> {
	const rootPath = await mkdtemp(join(tmpdir(), "ugk-pi-repair-"));
	const workspace: RunWorkspace = {
		rootPath,
		inputDir: join(rootPath, "input"),
		workDir: join(rootPath, "work"),
		outputDir: join(rootPath, "output"),
		logsDir: join(rootPath, "logs"),
		sessionDir: join(rootPath, "session"),
		sharedDir: join(rootPath, "shared"),
		publicDir: join(rootPath, "shared", "public"),
		artifactPublicDir: join(rootPath, "artifact-public"),
		manifestPath: join(rootPath, "manifest.json"),
	};
	await mkdir(workspace.artifactPublicDir, { recursive: true });
	return { rootPath, workspace };
}

test("first validation ok, no repair", async () => {
	const { rootPath, workspace } = await createTestWorkspace();
	const { session, setLastAssistantText } = createFakeSession();
	const contract = buildDefaultArtifactContract({ expectedKind: "auto", repairMaxAttempts: 2 });

	await writeFile(join(workspace.artifactPublicDir, "report.txt"), "hello");
	setLastAssistantText("done");

	const result = await runArtifactValidationRepairLoop({
		session,
		workspace,
		conn: {} as never,
		contract,
		initialResultText: "done",
		maxAttempts: 2,
		promptWithAbort: async (sess, promptText) => {
			await sess.prompt(promptText);
		},
		extractAssistantText: () => "done",
	});

	assert.equal(result.ok, true);
	assert.equal(result.attemptsUsed, 0);

	const { rm } = await import("node:fs/promises");
	await rm(rootPath, { recursive: true, force: true });
});

test("first fail, repair succeeds", async () => {
	const { rootPath, workspace } = await createTestWorkspace();
	const contract = buildDefaultArtifactContract({ expectedKind: "auto", repairMaxAttempts: 2 });

	let callCount = 0;
	const fakePromptWithAbort = async (_sess: AgentSessionLike, promptText: string) => {
		callCount += 1;
		assert.ok(promptText.includes("ARTIFACT_PUBLIC_DIR"));
		await writeFile(join(workspace.artifactPublicDir, "report.txt"), "hello");
	};

	const result = await runArtifactValidationRepairLoop({
		session: createFakeSession().session,
		workspace,
		conn: {} as never,
		contract,
		initialResultText: "done",
		maxAttempts: 2,
		promptWithAbort: fakePromptWithAbort,
		extractAssistantText: () => "fixed",
	});

	assert.equal(result.ok, true);
	assert.equal(result.attemptsUsed, 1);

	const { rm } = await import("node:fs/promises");
	await rm(rootPath, { recursive: true, force: true });
});

test("maxAttempts=0, no repair", async () => {
	const { rootPath, workspace } = await createTestWorkspace();
	const contract = buildDefaultArtifactContract({ expectedKind: "auto", repairMaxAttempts: 0 });

	const result = await runArtifactValidationRepairLoop({
		session: createFakeSession().session,
		workspace,
		conn: {} as never,
		contract,
		initialResultText: "done",
		maxAttempts: 0,
		promptWithAbort: async () => {},
		extractAssistantText: () => "done",
	});

	assert.equal(result.ok, false);
	assert.equal(result.attemptsUsed, 0);

	const { rm } = await import("node:fs/promises");
	await rm(rootPath, { recursive: true, force: true });
});

test("maxAttempts=2 still fails", async () => {
	const { rootPath, workspace } = await createTestWorkspace();
	const contract = buildDefaultArtifactContract({ expectedKind: "auto", repairMaxAttempts: 2 });

	let callCount = 0;
	const result = await runArtifactValidationRepairLoop({
		session: createFakeSession().session,
		workspace,
		conn: {} as never,
		contract,
		initialResultText: "done",
		maxAttempts: 2,
		promptWithAbort: async () => {
			callCount += 1;
		},
		extractAssistantText: () => "still failing",
	});

	assert.equal(result.ok, false);
	assert.equal(result.attemptsUsed, 2);
	assert.equal(callCount, 2);

	const { rm } = await import("node:fs/promises");
	await rm(rootPath, { recursive: true, force: true });
});

test("repair prompt contains ARTIFACT_PUBLIC_DIR", async () => {
	const { rootPath, workspace } = await createTestWorkspace();
	const contract = buildDefaultArtifactContract({ expectedKind: "auto", repairMaxAttempts: 1 });

	let capturedPrompt = "";
	await runArtifactValidationRepairLoop({
		session: createFakeSession().session,
		workspace,
		conn: {} as never,
		contract,
		initialResultText: "done",
		maxAttempts: 1,
		promptWithAbort: async (_sess, promptText) => {
			capturedPrompt = promptText;
			await writeFile(join(workspace.artifactPublicDir, "report.txt"), "hello");
		},
		extractAssistantText: () => "fixed",
	});

	assert.ok(capturedPrompt.includes("ARTIFACT_PUBLIC_DIR"));
	assert.ok(capturedPrompt.includes(workspace.artifactPublicDir));
	assert.ok(capturedPrompt.includes("ARTIFACT_PUBLIC_BASE_URL"));
	assert.ok(capturedPrompt.includes("/v1/local-file"));

	const { rm } = await import("node:fs/promises");
	await rm(rootPath, { recursive: true, force: true });
});

test("repair prompt contains issue details", async () => {
	const { rootPath, workspace } = await createTestWorkspace();
	const contract = buildDefaultArtifactContract({ expectedKind: "auto", repairMaxAttempts: 1 });

	let capturedPrompt = "";
	await runArtifactValidationRepairLoop({
		session: createFakeSession().session,
		workspace,
		conn: {} as never,
		contract,
		initialResultText: "see /app/output/file.txt",
		maxAttempts: 1,
		promptWithAbort: async (_sess, promptText) => {
			capturedPrompt = promptText;
			await writeFile(join(workspace.artifactPublicDir, "report.txt"), "hello");
		},
		extractAssistantText: () => "fixed",
	});

	assert.ok(capturedPrompt.includes("artifact_public_empty"));
	assert.ok(capturedPrompt.includes("repair attempt 1 of 1"));

	const { rm } = await import("node:fs/promises");
	await rm(rootPath, { recursive: true, force: true });
});
