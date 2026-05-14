import type { TeamSubmitToolSpec } from "./team-submit-tools.js";
import { getSubmitToolsForRole } from "./team-submit-tools.js";
import type { TeamRole, TeamRoleTaskExecutionInput, TeamStreamName } from "./types.js";

export type TeamRoleOutputMode = "json_envelope" | "submit_tool";

export interface TeamRoleBox {
	roleId: TeamRole["roleId"];
	prompt: string;
	allowedInputStreams: TeamStreamName[];
	outputStreams: TeamStreamName[];
	mustNotDo: string[];
	outputMode: TeamRoleOutputMode;
	submitTools: TeamSubmitToolSpec[];
	expectedEnvelope: {
		required: boolean;
		naturalLanguageCountsAsResult: false;
		checkpointRequired: boolean;
	};
}

export function buildRoleBox(input: {
	role: TeamRole;
	task: TeamRoleTaskExecutionInput;
	prompt: string;
}): TeamRoleBox {
	return {
		roleId: input.role.roleId,
		prompt: appendRoleBoxContract(input.prompt, input.role),
		allowedInputStreams: [...input.role.allowedInputStreams],
		outputStreams: [...input.role.outputStreams],
		mustNotDo: [...input.role.mustNotDo],
		outputMode: "json_envelope",
		submitTools: getSubmitToolsForRole(input.role.roleId),
		expectedEnvelope: {
			required: true,
			naturalLanguageCountsAsResult: false,
			checkpointRequired: true,
		},
	};
}

function appendRoleBoxContract(prompt: string, role: TeamRole): string {
	const outputStreams = role.outputStreams.length ? role.outputStreams.join(", ") : "none";
	const submitTools = getSubmitToolsForRole(role.roleId).map((tool) => tool.name);
	const submitToolText = submitTools.length ? submitTools.join(", ") : "none";
	return `${prompt}

ROLE BOX CONTRACT:
- Natural language does not count as a result.
- When submit tools are available, submit each finished stream item immediately through the matching tool.
- Current compatibility mode still requires a final JSON envelope; do not duplicate already submitted tool results in final emits.
- Allowed output streams: ${outputStreams}.
- Declared submit tools: ${submitToolText}.
- Do not violate these role boundaries:
${role.mustNotDo.map((rule) => `  - ${rule}`).join("\n")}`;
}
