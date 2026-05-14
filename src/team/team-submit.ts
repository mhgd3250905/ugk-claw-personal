import type { TeamTemplate } from "./team-template.js";
import type { TeamRole, TeamStreamItem, TeamStreamName } from "./types.js";
import type { TeamWorkspace } from "./team-workspace.js";
import { generateStreamItemId } from "./team-id.js";

export type SubmitTeamStreamItemResult =
	| { status: "accepted"; item: TeamStreamItem }
	| { status: "rejected"; reason: "role not allowed" | "unknown stream" | "invalid payload"; errors: string[] }
	| { status: "duplicate_skipped"; normalizedDomain: string };

export async function submitTeamStreamItem(input: {
	workspace: TeamWorkspace;
	template: TeamTemplate;
	teamRunId: string;
	roleId: TeamRole["roleId"];
	producerTaskId: string;
	streamName: TeamStreamName;
	payload: unknown;
	seenCandidateDomains?: Set<string>;
}): Promise<SubmitTeamStreamItemResult> {
	if (!canTemplateRoleWriteStream(input.template, input.roleId, input.streamName)) {
		return { status: "rejected", reason: "role not allowed", errors: ["role not allowed"] };
	}

	const validator = input.template.getStreamValidator(input.streamName);
	if (!validator) {
		return { status: "rejected", reason: "unknown stream", errors: [`unknown stream: ${input.streamName}`] };
	}

	const validation = validator(input.payload);
	if (!validation.ok) {
		return { status: "rejected", reason: "invalid payload", errors: validation.errors };
	}

	if (input.streamName === "candidate_domains") {
		const payload = validation.value as { normalizedDomain: string };
		const seenDomains = input.seenCandidateDomains ?? await getSeenNormalizedDomains(input.workspace, input.teamRunId);
		if (seenDomains.has(payload.normalizedDomain)) {
			return { status: "duplicate_skipped", normalizedDomain: payload.normalizedDomain };
		}
		seenDomains.add(payload.normalizedDomain);
	}

	const item: TeamStreamItem = {
		itemId: generateStreamItemId(),
		teamRunId: input.teamRunId,
		streamName: input.streamName,
		producerRoleId: input.roleId,
		producerTaskId: input.producerTaskId,
		payload: validation.value,
		createdAt: new Date().toISOString(),
	};

	await input.workspace.appendStreamItem(input.teamRunId, input.streamName, item);
	return { status: "accepted", item };
}

function canTemplateRoleWriteStream(
	template: TeamTemplate,
	roleId: TeamRole["roleId"],
	streamName: TeamStreamName,
): boolean {
	const role = template.roles.find((item) => item.roleId === roleId);
	return Boolean(role?.outputStreams.includes(streamName));
}

async function getSeenNormalizedDomains(
	workspace: TeamWorkspace,
	teamRunId: string,
): Promise<Set<string>> {
	const items = await workspace.readStreamItems(teamRunId, "candidate_domains");
	const seen = new Set<string>();
	for (const item of items) {
		const payload = item.payload as { normalizedDomain?: string };
		if (payload.normalizedDomain) {
			seen.add(payload.normalizedDomain);
		}
	}
	return seen;
}
