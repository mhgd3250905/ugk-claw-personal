import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import {
	getDefaultAllowedSkillPaths,
	getDefaultRuntimeAgentRulesPath,
	getProjectAgentDirPath,
	resolveProjectDefaultModelContext,
} from "./agent-session-factory.js";
import { DEFAULT_AGENT_ID, type AgentProfile } from "./agent-profile.js";
import { isAgentProfileArchivedSync, loadAgentProfilesSync } from "./agent-profile-catalog.js";
import type { ConnUpgradePolicy } from "./conn-store.js";

export interface BackgroundAgentProfileRef {
	profileId: string;
	agentSpecId: string;
	skillSetId: string;
	modelPolicyId: string;
	modelProvider?: string;
	modelId?: string;
	upgradePolicy: ConnUpgradePolicy;
	now?: Date;
}

export interface ResolvedBackgroundAgentSnapshot {
	requestedAgentId?: string;
	agentId?: string;
	agentName?: string;
	defaultBrowserId?: string;
	agentDir?: string;
	rulesPath?: string;
	skillPaths?: string[];
	fallbackUsed?: boolean;
	fallbackReason?: "profile_not_found" | "profile_archived" | "legacy_profile";
	profileId: string;
	profileVersion: string;
	agentSpecId: string;
	agentSpecVersion: string;
	skillSetId: string;
	skillSetVersion: string;
	skills: Array<{
		id: string;
		name: string;
		path: string;
		version: string;
	}>;
	modelPolicyId: string;
	modelPolicyVersion: string;
	provider: string;
	model: string;
	upgradePolicy: ConnUpgradePolicy;
	resolvedAt: string;
}

export interface BackgroundAgentProfileResolverOptions {
	projectRoot: string;
	registryDir?: string;
}

interface ProfileRegistry {
	profiles?: Array<{
		id: string;
		version?: string;
		agentSpecId?: string;
		skillSetId?: string;
		modelPolicyId?: string;
	}>;
}

interface AgentSpecRegistry {
	agentSpecs?: Array<{ id: string; version?: string }>;
}

interface SkillSetRegistry {
	skillSets?: Array<{
		id: string;
		version?: string;
		skillPaths?: string[];
	}>;
}

interface ModelPolicyRegistry {
	modelPolicies?: Array<{
		id: string;
		version?: string;
		provider?: string;
		model?: string;
	}>;
}

interface SkillFile {
	id: string;
	name: string;
	path: string;
	version: string;
}

const DEFAULT_PROFILE_ID = "background.default";
const DEFAULT_AGENT_SPEC_ID = "agent.default";
const DEFAULT_SKILL_SET_ID = "skills.default";
const DEFAULT_MODEL_POLICY_ID = "model.default";
const BUILTIN_VERSION = "builtin:1";

export class BackgroundAgentProfileResolver {
	private readonly registryDir: string;

	constructor(private readonly options: BackgroundAgentProfileResolverOptions) {
		this.registryDir = options.registryDir ?? join(options.projectRoot, ".pi", "background-agent");
	}

	async resolve(ref: BackgroundAgentProfileRef): Promise<ResolvedBackgroundAgentSnapshot> {
		const [profileRegistry, agentSpecRegistry, skillSetRegistry, modelPolicyRegistry] = await Promise.all([
			this.readJson<ProfileRegistry>("profiles.json", {}),
			this.readJson<AgentSpecRegistry>("agent-specs.json", {}),
			this.readJson<SkillSetRegistry>("skill-sets.json", {}),
			this.readJson<ModelPolicyRegistry>("model-policies.json", {}),
		]);
		const agentProfiles = loadAgentProfilesSync(this.options.projectRoot);
		const requestedAgentProfile = agentProfiles.find((profile) => profile.agentId === ref.profileId);
		if (requestedAgentProfile) {
			return await this.resolvePlaygroundAgentProfile({
				profile: requestedAgentProfile,
				ref,
				fallbackUsed: false,
			});
		}

		const profile = findRegistryEntry(profileRegistry.profiles, ref.profileId);
		if (!profile && ref.profileId !== DEFAULT_PROFILE_ID) {
			const fallbackProfile = agentProfiles.find((entry) => entry.agentId === DEFAULT_AGENT_ID);
			if (fallbackProfile) {
				const fallbackReason = isAgentProfileArchivedSync(this.options.projectRoot, ref.profileId)
					? "profile_archived"
					: "profile_not_found";
				return await this.resolvePlaygroundAgentProfile({
					profile: fallbackProfile,
					ref,
					fallbackUsed: true,
					fallbackReason,
				});
			}
		}

		const resolvedProfile =
			profile ??
			resolveRegistryEntry(
				profileRegistry.profiles,
				ref.profileId,
				DEFAULT_PROFILE_ID,
				"Unknown background agent profile",
			);
		const profileAgentSpecId = resolvedProfile.agentSpecId ?? DEFAULT_AGENT_SPEC_ID;
		const profileSkillSetId = resolvedProfile.skillSetId ?? DEFAULT_SKILL_SET_ID;
		const profileModelPolicyId = resolvedProfile.modelPolicyId ?? DEFAULT_MODEL_POLICY_ID;
		if (profileAgentSpecId !== ref.agentSpecId) {
			throw new Error(`Background agent profile ${ref.profileId} expects agent spec ${profileAgentSpecId}`);
		}
		if (profileSkillSetId !== ref.skillSetId) {
			throw new Error(`Background agent profile ${ref.profileId} expects skill set ${profileSkillSetId}`);
		}
		if (profileModelPolicyId !== ref.modelPolicyId) {
			throw new Error(`Background agent profile ${ref.profileId} expects model policy ${profileModelPolicyId}`);
		}

		const agentSpec = resolveRegistryEntry(
			agentSpecRegistry.agentSpecs,
			ref.agentSpecId,
			DEFAULT_AGENT_SPEC_ID,
			"Unknown background agent spec",
		);
		const skillSet = resolveRegistryEntry(
			skillSetRegistry.skillSets,
			ref.skillSetId,
			DEFAULT_SKILL_SET_ID,
			"Unknown background skill set",
		);
		const modelPolicy = resolveRegistryEntry(
			modelPolicyRegistry.modelPolicies,
			ref.modelPolicyId,
			DEFAULT_MODEL_POLICY_ID,
			"Unknown background model policy",
		);

		const defaultModel = resolveProjectDefaultModelContext(this.options.projectRoot);
		const provider = ref.modelProvider ?? modelPolicy.provider ?? defaultModel.provider;
		const model = ref.modelId ?? modelPolicy.model ?? defaultModel.model;
		const skillPaths = skillSet.skillPaths?.length ? skillSet.skillPaths : getDefaultAllowedSkillPaths(this.options.projectRoot);
		const skills = await collectSkills(skillPaths);
		const computedSkillSetVersion = hashStrings([
			...skillPaths,
			...skills.flatMap((skill) => [skill.path, skill.version]),
		]);

		return {
			profileId: ref.profileId,
			profileVersion: resolvedProfile.version ?? BUILTIN_VERSION,
			agentSpecId: ref.agentSpecId,
			agentSpecVersion: agentSpec.version ?? BUILTIN_VERSION,
			skillSetId: ref.skillSetId,
			skillSetVersion: skillSet.version && skillSet.version !== BUILTIN_VERSION ? skillSet.version : computedSkillSetVersion,
			skills,
			modelPolicyId: ref.modelPolicyId,
			modelPolicyVersion: modelPolicy.version ?? BUILTIN_VERSION,
			provider,
			model,
			upgradePolicy: ref.upgradePolicy,
			resolvedAt: (ref.now ?? new Date()).toISOString(),
		};
	}

	private async resolvePlaygroundAgentProfile(input: {
		profile: AgentProfile;
		ref: BackgroundAgentProfileRef;
		fallbackUsed: boolean;
		fallbackReason?: "profile_not_found" | "profile_archived" | "legacy_profile";
	}): Promise<ResolvedBackgroundAgentSnapshot> {
		const defaultModel = resolveProjectDefaultModelContext(this.options.projectRoot);
		const provider = input.ref.modelProvider ?? defaultModel.provider;
		const model = input.ref.modelId ?? defaultModel.model;
		const skillPaths = input.profile.allowedSkillPaths.length
			? input.profile.allowedSkillPaths
			: getDefaultAllowedSkillPaths(this.options.projectRoot);
		const skills = await collectSkills(skillPaths);
		const skillSetVersion = hashStrings([
			...skillPaths,
			...skills.flatMap((skill) => [skill.path, skill.version]),
		]);
		const rulesPath =
			input.profile.runtimeAgentRulesPath ||
			(input.profile.agentId === DEFAULT_AGENT_ID
				? getDefaultRuntimeAgentRulesPath(this.options.projectRoot)
				: undefined);
		const agentDir = input.profile.agentDir || getProjectAgentDirPath(this.options.projectRoot);

		return {
			requestedAgentId: input.ref.profileId,
			agentId: input.profile.agentId,
			agentName: input.profile.name,
			...(input.profile.defaultBrowserId ? { defaultBrowserId: input.profile.defaultBrowserId } : {}),
			agentDir,
			...(rulesPath ? { rulesPath } : {}),
			skillPaths,
			fallbackUsed: input.fallbackUsed,
			...(input.fallbackReason ? { fallbackReason: input.fallbackReason } : {}),
			profileId: input.profile.agentId,
			profileVersion: BUILTIN_VERSION,
			agentSpecId: input.ref.agentSpecId,
			agentSpecVersion: BUILTIN_VERSION,
			skillSetId: input.ref.skillSetId,
			skillSetVersion,
			skills,
			modelPolicyId: input.ref.modelPolicyId,
			modelPolicyVersion: BUILTIN_VERSION,
			provider,
			model,
			upgradePolicy: input.ref.upgradePolicy,
			resolvedAt: (input.ref.now ?? new Date()).toISOString(),
		};
	}

	private async readJson<T>(fileName: string, fallback: T): Promise<T> {
		try {
			return JSON.parse(await readFile(join(this.registryDir, fileName), "utf8")) as T;
		} catch (error) {
			if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
				return fallback;
			}
			throw error;
		}
	}
}

function findRegistryEntry<T extends { id: string; version?: string }>(entries: T[] | undefined, id: string): T | undefined {
	return entries?.find((entry) => entry.id === id);
}

function resolveRegistryEntry<T extends { id: string; version?: string }>(
	entries: T[] | undefined,
	id: string,
	defaultId: string,
	errorPrefix: string,
): T {
	const found = entries?.find((entry) => entry.id === id);
	if (found) {
		return found;
	}
	if (id === defaultId) {
		return { id, version: BUILTIN_VERSION } as T;
	}
	throw new Error(`${errorPrefix}: ${id}`);
}

async function collectSkills(skillPaths: readonly string[]): Promise<SkillFile[]> {
	const skills = (await Promise.all(skillPaths.map((rootPath) => collectSkillFiles(rootPath, rootPath)))).flat();
	return skills.sort((left, right) => left.name.localeCompare(right.name) || left.path.localeCompare(right.path));
}

async function collectSkillFiles(rootPath: string, currentPath: string): Promise<SkillFile[]> {
	try {
		const entries = await readdir(currentPath, { withFileTypes: true });
		const files = await Promise.all(
			entries.map(async (entry) => {
				const nextPath = join(currentPath, entry.name);
				if (entry.isDirectory()) {
					return await collectSkillFiles(rootPath, nextPath);
				}
				if (!entry.isFile() || entry.name !== "SKILL.md") {
					return [];
				}
				const content = await readFile(nextPath, "utf8");
				const id = relative(rootPath, nextPath).replace(/\\/g, "/");
				return [
					{
						id,
						name: inferSkillName(nextPath, content),
						path: nextPath,
						version: hashStrings([id, content]),
					},
				];
			}),
		);
		return files.flat();
	} catch (error) {
		if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

function inferSkillName(skillPath: string, content: string): string {
	const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
	if (heading) {
		return heading.toLowerCase().replace(/\s+/g, "-");
	}
	const parts = skillPath.replace(/\\/g, "/").split("/");
	return parts.at(-2) ?? "skill";
}

function hashStrings(parts: readonly string[]): string {
	const hash = createHash("sha256");
	for (const part of parts) {
		hash.update(part);
		hash.update("\n---\n");
	}
	return hash.digest("hex");
}
