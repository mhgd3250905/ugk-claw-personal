import type { AgentSessionLike } from "./agent-session-factory.js";
import type { RunWorkspace } from "./background-workspace.js";
import type { ConnDefinition } from "./conn-store.js";
import type { ArtifactContract } from "./artifact-contract.js";
import {
	validateArtifactDelivery,
	type ArtifactValidationResult,
} from "./artifact-validation.js";

export interface ArtifactRepairLoopInput {
	session: AgentSessionLike;
	workspace: RunWorkspace;
	conn: ConnDefinition;
	contract: ArtifactContract;
	initialResultText: string;
	maxAttempts: number;
	promptWithAbort: (
		session: AgentSessionLike,
		prompt: string,
		signal?: AbortSignal,
	) => Promise<void>;
	extractAssistantText: (session: AgentSessionLike) => string;
	signal?: AbortSignal;
}

export interface ArtifactRepairLoopResult {
	ok: boolean;
	resultText: string;
	attemptsUsed: number;
	validation: ArtifactValidationResult;
}

export async function runArtifactValidationRepairLoop(
	input: ArtifactRepairLoopInput,
): Promise<ArtifactRepairLoopResult> {
	const {
		session,
		workspace,
		contract,
		initialResultText,
		maxAttempts,
		promptWithAbort,
		extractAssistantText,
		signal,
	} = input;

	let resultText = initialResultText;
	let validation = await validateArtifactDelivery({
		workspace,
		contract,
		resultText,
	});

	let attemptsUsed = 0;
	while (!validation.ok && attemptsUsed < maxAttempts) {
		attemptsUsed += 1;
		const repairPrompt = buildArtifactRepairPrompt(
			validation,
			workspace,
			contract,
			attemptsUsed,
			maxAttempts,
		);
		await promptWithAbort(session, repairPrompt, signal);
		resultText = extractAssistantText(session);
		validation = await validateArtifactDelivery({
			workspace,
			contract,
			resultText,
		});
	}

	return { ok: validation.ok, resultText, attemptsUsed, validation };
}

function buildArtifactRepairPrompt(
	validation: ArtifactValidationResult,
	workspace: RunWorkspace,
	_contract: ArtifactContract,
	attemptNumber: number,
	maxAttempts: number,
): string {
	const lines: string[] = [
		"Your previous output did not pass UGK artifact delivery validation.",
		"",
		"Do not explain. Directly fix the files.",
		"",
		`Official delivery directory: ARTIFACT_PUBLIC_DIR=${workspace.artifactPublicDir}`,
		"",
		"Validation errors:",
	];

	for (const issue of validation.issues) {
		lines.push(
			`${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ""}`,
		);
	}

	if (validation.candidates.length > 0) {
		lines.push("", "Detected candidate outputs:");
		for (const candidate of validation.candidates) {
			lines.push(
				`- ${candidate.kind}: ${candidate.path}${candidate.entryPath ? ` (${candidate.entryPath})` : ""}`,
			);
		}
		lines.push("", "Copy or move these candidates into ARTIFACT_PUBLIC_DIR.");
	}

	lines.push(
		"",
		"Required action:",
		"- Put all final user-facing files and websites into ARTIFACT_PUBLIC_DIR.",
		"- If creating a website, ensure index.html and all local assets exist.",
		"- Do not put /app, file://, or /tmp paths in your final answer.",
		"- After fixing, run simple shell checks such as test -f ... where appropriate.",
		"",
		`This is repair attempt ${attemptNumber} of ${maxAttempts}.`,
	);

	return lines.join("\n");
}
