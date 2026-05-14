import type {
	CreateBrandDomainDiscoveryPlanInput,
	TeamPlan,
	TeamRole,
	TeamRoleTaskExecutionInput,
	TeamRunState,
	TeamStreamItem,
	TeamStreamName,
} from "./types.js";
import type { TeamWorkspace } from "./team-workspace.js";

export type TeamStreamValidator = (payload: unknown) =>
	| { ok: true; value: unknown }
	| { ok: false; errors: string[] };

export interface TeamRoleTaskCandidate {
	roleId: TeamRole["roleId"];
	consumes?: {
		streamName: TeamStreamName;
		items: TeamStreamItem[];
	};
	task: TeamRoleTaskExecutionInput;
	updates?: {
		incrementCurrentRound?: boolean;
	};
}

export interface TeamFinalizationInput {
	teamRunId: string;
	state: TeamRunState;
	plan: TeamPlan;
	streams: Partial<Record<TeamStreamName, TeamStreamItem[]>>;
	workspace: TeamWorkspace;
	finalReportMarkdown?: string;
}

export interface TeamTemplateInputField {
	type: "string" | "string_array" | "number";
	label: string;
	required?: boolean;
	defaultValue?: string | number;
	minimum?: number;
	itemLabel?: string;
	description: string;
}

export interface TeamTemplateMetadata {
	templateId: TeamPlan["templateId"];
	title: string;
	description: string;
	defaults: {
		maxRounds: number;
		maxCandidates: number;
		maxMinutes: number;
	};
	inputSchema: {
		required: string[];
		properties: Record<string, TeamTemplateInputField>;
	};
}

export interface TeamTemplate {
	templateId: TeamPlan["templateId"];
	metadata: TeamTemplateMetadata;
	roles: TeamRole[];
	streamNames: TeamStreamName[];
	createRun(input: CreateBrandDomainDiscoveryPlanInput): { plan: TeamPlan; state: TeamRunState };
	getStreamValidator(streamName: TeamStreamName): TeamStreamValidator | undefined;
	getReadyRoleTasks(input: {
		teamRunId: string;
		state: TeamRunState;
		plan: TeamPlan;
		streams: Partial<Record<TeamStreamName, TeamStreamItem[]>>;
		cursors: Record<string, { lastConsumedItemId?: string } | undefined>;
	}): TeamRoleTaskCandidate[];
	shouldBlock(input: {
		state: TeamRunState;
		streams: Partial<Record<TeamStreamName, TeamStreamItem[]>>;
	}): { blocked: true; reason: string } | { blocked: false };
	shouldFinalize(input: {
		state: TeamRunState;
		streams: Partial<Record<TeamStreamName, TeamStreamItem[]>>;
		cursors: Record<string, { lastConsumedItemId?: string } | undefined>;
	}): boolean;
	finalize(input: TeamFinalizationInput): Promise<void>;
}
