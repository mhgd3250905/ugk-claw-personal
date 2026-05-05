import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
	DEFAULT_AGENT_ID,
	SEARCH_AGENT_ID,
	createAgentProfileFromSummary,
	createDefaultAgentProfiles,
	isValidAgentId,
	type AgentProfile,
	type AgentProfileSummaryInput,
} from "./agent-profile.js";
import { DEFAULT_AGENT_SYSTEM_SKILLS, ensureAgentProfileRuntime } from "./agent-profile-bootstrap.js";
import { getDefaultAllowedSkillPaths } from "./agent-session-factory.js";

interface StoredAgentProfiles {
	agents?: AgentProfileSummaryInput[];
	archivedAgentIds?: string[];
}

export interface CreateAgentProfileInput {
	agentId: string;
	name?: string;
	description?: string;
	initialSystemSkillNames?: string[];
}

export interface ArchiveAgentProfileResult {
	agentId: string;
	archivedPath: string;
}

export interface UpdateAgentProfileInput {
	name?: string;
	description?: string;
}

export interface AgentProfileSkillChangeResult {
	agentId: string;
	skillName: string;
	targetRoot: string;
	targetDir: string;
}

export function getAgentProfilesCatalogPath(projectRoot: string): string {
	return join(projectRoot, ".data", "agents", "profiles.json");
}

function normalizeAgentName(agentId: string, name: string | undefined): string {
	const normalized = String(name || "").trim();
	return normalized || `${agentId} Agent`;
}

function normalizeAgentDescription(description: string | undefined): string {
	const normalized = String(description || "").trim();
	return normalized || "独立 agent profile。";
}

function normalizeInitialSystemSkillNames(skillNames: unknown): string[] {
	if (!Array.isArray(skillNames)) {
		return [];
	}
	const reserved = new Set(DEFAULT_AGENT_SYSTEM_SKILLS.map((skill) => skill.name));
	const normalized = skillNames
		.map((skillName) => String(skillName || "").trim())
		.filter((skillName) => /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(skillName))
		.filter((skillName) => !reserved.has(skillName));
	return Array.from(new Set(normalized));
}

function normalizeSkillName(skillName: unknown): string {
	const normalized = String(skillName || "").trim();
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(normalized)) {
		throw new Error("skillName must start with a letter or digit and contain only letters, digits, underscores, or hyphens");
	}
	return normalized;
}

function parseStoredCatalog(raw: string): Required<StoredAgentProfiles> {
	const parsed = JSON.parse(raw) as StoredAgentProfiles;
	return {
		agents: Array.isArray(parsed.agents) ? parsed.agents : [],
		archivedAgentIds: Array.isArray(parsed.archivedAgentIds) ? parsed.archivedAgentIds : [],
	};
}

export function normalizeAgentProfileInput(input: CreateAgentProfileInput): AgentProfileSummaryInput {
	const agentId = String(input.agentId || "").trim();
	if (!isValidAgentId(agentId)) {
		throw new Error("agentId must start with a lowercase letter and contain only lowercase letters, digits, or hyphens");
	}
	if (agentId === DEFAULT_AGENT_ID || agentId === SEARCH_AGENT_ID) {
		throw new Error(`agentId ${agentId} is reserved`);
	}
	return {
		agentId,
		name: normalizeAgentName(agentId, input.name),
		description: normalizeAgentDescription(input.description),
	};
}

function isPathWithin(parentPath: string, childPath: string): boolean {
	const parent = resolve(parentPath);
	const child = resolve(childPath);
	return child === parent || child.startsWith(parent + "\\") || child.startsWith(parent + "/");
}

async function findMainAgentSkillDir(projectRoot: string, skillName: string): Promise<string | undefined> {
	for (const rootPath of getDefaultAllowedSkillPaths(projectRoot)) {
		const skillDir = join(rootPath, skillName);
		if (!isPathWithin(rootPath, skillDir)) {
			continue;
		}
		try {
			await readFile(join(skillDir, "SKILL.md"), "utf8");
			return skillDir;
		} catch (error) {
			if (!(error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT")) {
				throw error;
			}
		}
		const nestedSkillDir = await findNestedMainAgentSkillDir(rootPath, skillName);
		if (nestedSkillDir) {
			return nestedSkillDir;
		}
	}
	return undefined;
}

async function findNestedMainAgentSkillDir(rootPath: string, skillName: string): Promise<string | undefined> {
	const skillFiles = await collectSkillMetadataFiles(rootPath);
	for (const skillFile of skillFiles) {
		if (!isPathWithin(rootPath, skillFile)) {
			continue;
		}
		const content = await readFile(skillFile, "utf8");
		if (parseSkillMetadataName(content) === skillName) {
			return dirname(skillFile);
		}
	}
	return undefined;
}

async function collectSkillMetadataFiles(rootPath: string): Promise<string[]> {
	let entries;
	try {
		entries = await readdir(rootPath, { encoding: "utf8", withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}
	const skillFiles: string[] = [];
	for (const entry of entries) {
		const entryPath = join(rootPath, entry.name);
		if (!isPathWithin(rootPath, entryPath)) {
			continue;
		}
		if (entry.isFile() && entry.name === "SKILL.md") {
			skillFiles.push(entryPath);
		}
		if (entry.isDirectory()) {
			skillFiles.push(...(await collectSkillMetadataFiles(entryPath)));
		}
	}
	return skillFiles;
}

function parseSkillMetadataName(content: string): string | undefined {
	const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
	if (!frontmatter) {
		return undefined;
	}
	const match = /^name:\s*["']?([^"'\r\n]+)["']?\s*$/m.exec(frontmatter[1]);
	return match?.[1]?.trim();
}

async function copyInitialSystemSkills(
	projectRoot: string,
	profile: AgentProfile,
	skillNames: string[],
): Promise<void> {
	const targetRoot = profile.allowedSkillPaths[0];
	if (!targetRoot || skillNames.length === 0) {
		return;
	}
	for (const skillName of skillNames) {
		const sourceDir = await findMainAgentSkillDir(projectRoot, skillName);
		if (!sourceDir) {
			throw new Error(`main agent does not have skill ${skillName}`);
		}
		const targetDir = join(targetRoot, skillName);
		if (!isPathWithin(targetRoot, targetDir)) {
			throw new Error(`invalid skill target: ${skillName}`);
		}
		await cp(sourceDir, targetDir, {
			recursive: true,
			force: false,
			errorOnExist: false,
		});
	}
}

async function assertMainAgentHasInitialSystemSkills(projectRoot: string, skillNames: string[]): Promise<void> {
	for (const skillName of skillNames) {
		const sourceDir = await findMainAgentSkillDir(projectRoot, skillName);
		if (!sourceDir) {
			throw new Error(`main agent does not have skill ${skillName}`);
		}
	}
}

function isCrossDeviceRenameError(error: unknown): boolean {
	return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "EXDEV";
}

interface MoveAgentProfileDataDirOptions {
	rename?: typeof rename;
	cp?: typeof cp;
	rm?: typeof rm;
}

export async function moveAgentProfileDataDir(
	sourceDir: string,
	targetDir: string,
	options: MoveAgentProfileDataDirOptions = {},
): Promise<void> {
	const renameDir = options.rename ?? rename;
	const copyDir = options.cp ?? cp;
	const removeDir = options.rm ?? rm;
	try {
		await renameDir(sourceDir, targetDir);
	} catch (error) {
		if (!isCrossDeviceRenameError(error)) {
			throw error;
		}
		await copyDir(sourceDir, targetDir, {
			recursive: true,
			force: false,
			errorOnExist: true,
		});
		await removeDir(sourceDir, { recursive: true, force: true });
	}
}

function assertMutableAgentProfile(agentId: string): void {
	if (agentId === DEFAULT_AGENT_ID) {
		throw new Error("main agent skills cannot be managed through agent profile ops");
	}
}

async function resolveMutableAgentProfile(projectRoot: string, agentId: string): Promise<AgentProfile> {
	if (!isValidAgentId(agentId)) {
		throw new Error("agentId must start with a lowercase letter and contain only lowercase letters, digits, or hyphens");
	}
	assertMutableAgentProfile(agentId);
	const catalog = await readStoredAgentProfileCatalog(projectRoot);
	if (catalog.archivedAgentIds.includes(agentId)) {
		throw new Error(`agent ${agentId} is archived`);
	}
	const profile = createDefaultAgentProfiles(projectRoot, catalog.agents).find((entry) => entry.agentId === agentId);
	if (!profile) {
		throw new Error(`agent ${agentId} does not exist`);
	}
	return profile;
}

export async function readStoredAgentProfileSummaries(projectRoot: string): Promise<AgentProfileSummaryInput[]> {
	const catalogPath = getAgentProfilesCatalogPath(projectRoot);
	try {
		return parseStoredCatalog(await readFile(catalogPath, "utf8")).agents;
	} catch (error) {
		if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

export function readStoredAgentProfileSummariesSync(projectRoot: string): AgentProfileSummaryInput[] {
	const catalogPath = getAgentProfilesCatalogPath(projectRoot);
	if (!existsSync(catalogPath)) {
		return [];
	}
	const raw = readFileSync(catalogPath, "utf8");
	return parseStoredCatalog(raw).agents;
}

async function readStoredAgentProfileCatalog(projectRoot: string): Promise<Required<StoredAgentProfiles>> {
	const catalogPath = getAgentProfilesCatalogPath(projectRoot);
	try {
		return parseStoredCatalog(await readFile(catalogPath, "utf8"));
	} catch (error) {
		if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
			return { agents: [], archivedAgentIds: [] };
		}
		throw error;
	}
}

function readStoredAgentProfileCatalogSync(projectRoot: string): Required<StoredAgentProfiles> {
	const catalogPath = getAgentProfilesCatalogPath(projectRoot);
	if (!existsSync(catalogPath)) {
		return { agents: [], archivedAgentIds: [] };
	}
	return parseStoredCatalog(readFileSync(catalogPath, "utf8"));
}

export async function writeStoredAgentProfileSummaries(
	projectRoot: string,
	agents: AgentProfileSummaryInput[],
	archivedAgentIds: string[] = [],
): Promise<void> {
	const catalogPath = getAgentProfilesCatalogPath(projectRoot);
	await mkdir(dirname(catalogPath), { recursive: true });
	await writeFile(catalogPath, JSON.stringify({ agents, archivedAgentIds }, null, 2) + "\n", "utf8");
}

export function loadAgentProfilesSync(projectRoot: string): AgentProfile[] {
	const catalog = readStoredAgentProfileCatalogSync(projectRoot);
	const archived = new Set(catalog.archivedAgentIds);
	return createDefaultAgentProfiles(projectRoot, catalog.agents).filter((profile) => !archived.has(profile.agentId));
}

export function isAgentProfileArchivedSync(projectRoot: string, agentId: string): boolean {
	const catalog = readStoredAgentProfileCatalogSync(projectRoot);
	return catalog.archivedAgentIds.includes(agentId);
}

export async function createStoredAgentProfile(
	projectRoot: string,
	input: CreateAgentProfileInput,
): Promise<AgentProfile> {
	const normalized = normalizeAgentProfileInput(input);
	const catalog = await readStoredAgentProfileCatalog(projectRoot);
	const existing = createDefaultAgentProfiles(projectRoot, catalog.agents).filter(
		(profile) => !catalog.archivedAgentIds.includes(profile.agentId),
	);
	if (existing.some((profile) => profile.agentId === normalized.agentId)) {
		throw new Error(`agent ${normalized.agentId} already exists`);
	}
	const initialSystemSkillNames = normalizeInitialSystemSkillNames(input.initialSystemSkillNames);
	await assertMainAgentHasInitialSystemSkills(projectRoot, initialSystemSkillNames);
	const profile = createAgentProfileFromSummary(projectRoot, normalized);
	await ensureAgentProfileRuntime(profile);
	await copyInitialSystemSkills(projectRoot, profile, initialSystemSkillNames);
	await writeStoredAgentProfileSummaries(
		projectRoot,
		[...catalog.agents, normalized],
		catalog.archivedAgentIds.filter((agentId) => agentId !== normalized.agentId),
	);
	return profile;
}

export async function updateStoredAgentProfile(
	projectRoot: string,
	agentId: string,
	input: UpdateAgentProfileInput,
): Promise<AgentProfile> {
	if (!isValidAgentId(agentId)) {
		throw new Error("agentId must start with a lowercase letter and contain only lowercase letters, digits, or hyphens");
	}
	if (agentId === DEFAULT_AGENT_ID) {
		throw new Error("main agent cannot be edited");
	}
	const catalog = await readStoredAgentProfileCatalog(projectRoot);
	if (catalog.archivedAgentIds.includes(agentId)) {
		throw new Error(`agent ${agentId} is archived`);
	}
	const currentProfile = createDefaultAgentProfiles(projectRoot, catalog.agents).find(
		(profile) => profile.agentId === agentId,
	);
	if (!currentProfile) {
		throw new Error(`agent ${agentId} does not exist`);
	}
	const updatedSummary: AgentProfileSummaryInput = {
		agentId,
		name: normalizeAgentName(agentId, input.name ?? currentProfile.name),
		description: normalizeAgentDescription(input.description ?? currentProfile.description),
	};
	const nextStored = [
		...catalog.agents.filter((entry) => entry.agentId !== agentId),
		updatedSummary,
	];
	await writeStoredAgentProfileSummaries(projectRoot, nextStored, catalog.archivedAgentIds);
	return createAgentProfileFromSummary(projectRoot, updatedSummary);
}

export async function installStoredAgentProfileSkill(
	projectRoot: string,
	agentId: string,
	inputSkillName: unknown,
): Promise<AgentProfileSkillChangeResult> {
	const skillName = normalizeSkillName(inputSkillName);
	const profile = await resolveMutableAgentProfile(projectRoot, agentId);
	const sourceDir = await findMainAgentSkillDir(projectRoot, skillName);
	if (!sourceDir) {
		throw new Error(`main agent does not have skill ${skillName}`);
	}
	const targetRoot = profile.allowedSkillPaths[1] ?? profile.allowedSkillPaths[0];
	if (!targetRoot) {
		throw new Error(`agent ${agentId} does not have a skill target root`);
	}
	const targetDir = join(targetRoot, skillName);
	if (!isPathWithin(targetRoot, targetDir)) {
		throw new Error(`invalid skill target: ${skillName}`);
	}
	await mkdir(targetRoot, { recursive: true });
	await cp(sourceDir, targetDir, {
		recursive: true,
		force: true,
		errorOnExist: false,
	});
	return { agentId, skillName, targetRoot, targetDir };
}

export async function removeStoredAgentProfileSkill(
	projectRoot: string,
	agentId: string,
	inputSkillName: unknown,
): Promise<AgentProfileSkillChangeResult> {
	const skillName = normalizeSkillName(inputSkillName);
	if (DEFAULT_AGENT_SYSTEM_SKILLS.some((skill) => skill.name === skillName)) {
		throw new Error("required agent skill cannot be removed");
	}
	const profile = await resolveMutableAgentProfile(projectRoot, agentId);
	for (const targetRoot of profile.allowedSkillPaths) {
		const targetDir = join(targetRoot, skillName);
		if (!isPathWithin(targetRoot, targetDir)) {
			throw new Error(`invalid skill target: ${skillName}`);
		}
		if (existsSync(targetDir)) {
			await rm(targetDir, { recursive: true, force: true });
			return { agentId, skillName, targetRoot, targetDir };
		}
	}
	throw new Error(`agent ${agentId} does not have skill ${skillName}`);
}

export async function archiveStoredAgentProfile(
	projectRoot: string,
	agentId: string,
): Promise<ArchiveAgentProfileResult> {
	if (agentId === DEFAULT_AGENT_ID) {
		throw new Error("main agent cannot be archived");
	}
	const catalog = await readStoredAgentProfileCatalog(projectRoot);
	const profile = createDefaultAgentProfiles(projectRoot, catalog.agents).find((entry) => entry.agentId === agentId);
	if (!profile) {
		throw new Error(`agent ${agentId} does not exist`);
	}
	const nextStored = catalog.agents.filter((entry) => entry.agentId !== agentId);
	const nextArchivedAgentIds = Array.from(new Set([...catalog.archivedAgentIds, agentId]));
	const archivedPath = join(projectRoot, ".data", "agents-archive", `${agentId}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
	await mkdir(dirname(archivedPath), { recursive: true });
	if (existsSync(profile.dataDir)) {
		await moveAgentProfileDataDir(profile.dataDir, archivedPath);
	}
	await writeStoredAgentProfileSummaries(projectRoot, nextStored, nextArchivedAgentIds);
	return { agentId, archivedPath };
}
