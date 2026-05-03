import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	DEFAULT_AGENT_ID,
	SEARCH_AGENT_ID,
	createAgentProfileFromSummary,
	createDefaultAgentProfiles,
	isValidAgentId,
	type AgentProfile,
	type AgentProfileSummaryInput,
} from "./agent-profile.js";
import { ensureAgentProfileRuntime } from "./agent-profile-bootstrap.js";

interface StoredAgentProfiles {
	agents?: AgentProfileSummaryInput[];
	archivedAgentIds?: string[];
}

export interface CreateAgentProfileInput {
	agentId: string;
	name?: string;
	description?: string;
}

export interface ArchiveAgentProfileResult {
	agentId: string;
	archivedPath: string;
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
	const profile = createAgentProfileFromSummary(projectRoot, normalized);
	await ensureAgentProfileRuntime(profile);
	await writeStoredAgentProfileSummaries(projectRoot, [...catalog.agents, normalized], catalog.archivedAgentIds);
	return profile;
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
		await rename(profile.dataDir, archivedPath);
	}
	await writeStoredAgentProfileSummaries(projectRoot, nextStored, nextArchivedAgentIds);
	return { agentId, archivedPath };
}
