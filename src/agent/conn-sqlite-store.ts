import { randomUUID } from "node:crypto";
import { ConnDatabase } from "./conn-db.js";
import {
	computeNextCronOccurrence,
	computeNextRunAt,
	type ConnDefinition,
	type ConnSchedule,
	type ConnStatus,
	type ConnTarget,
	type ConnUpgradePolicy,
} from "./conn-store.js";

export interface ConnSqliteStoreOptions {
	database: ConnDatabase;
}

export interface CreateConnInput {
	title: string;
	prompt: string;
	target: ConnTarget;
	schedule: ConnSchedule;
	assetRefs?: string[];
	maxRunMs?: number;
	profileId?: string;
	agentSpecId?: string;
	skillSetId?: string;
	modelPolicyId?: string;
	upgradePolicy?: ConnUpgradePolicy;
	now?: Date;
}

export type UpdateConnInput = Partial<
	Pick<
		ConnDefinition,
		| "title"
		| "prompt"
		| "target"
		| "schedule"
		| "assetRefs"
		| "maxRunMs"
		| "profileId"
		| "agentSpecId"
		| "skillSetId"
		| "modelPolicyId"
		| "upgradePolicy"
		| "status"
	>
> & { now?: Date };

export interface DeleteManyConnsResult {
	deletedConnIds: string[];
	missingConnIds: string[];
}

interface ConnRow {
	conn_id: string;
	title: string;
	prompt: string;
	target_json: string;
	schedule_json: string;
	asset_refs_json: string;
	max_run_ms?: number | null;
	profile_id: string;
	agent_spec_id: string;
	skill_set_id: string;
	model_policy_id: string;
	upgrade_policy: ConnUpgradePolicy;
	status: ConnStatus;
	created_at: string;
	updated_at: string;
	last_run_at?: string;
	next_run_at?: string;
	last_run_id?: string;
}

const DEFAULT_PROFILE_ID = "background.default";
const DEFAULT_AGENT_SPEC_ID = "agent.default";
const DEFAULT_SKILL_SET_ID = "skills.default";
const DEFAULT_MODEL_POLICY_ID = "model.default";
const DEFAULT_UPGRADE_POLICY: ConnUpgradePolicy = "latest";

export class ConnSqliteStore {
	constructor(private readonly options: ConnSqliteStoreOptions) {}

	async list(): Promise<ConnDefinition[]> {
		const rows = this.options.database.all<ConnRow>(
			"SELECT * FROM conns ORDER BY created_at DESC",
		);
		return rows.map(rowToConnDefinition);
	}

	async get(connId: string): Promise<ConnDefinition | undefined> {
		const row = this.options.database.get<ConnRow>(
			"SELECT * FROM conns WHERE conn_id = ?",
			connId,
		);
		return row ? rowToConnDefinition(row) : undefined;
	}

	async create(input: CreateConnInput): Promise<ConnDefinition> {
		const now = input.now ?? new Date();
		const createdAt = now.toISOString();
		const schedule = normalizeSchedule(input.schedule, now);
		const conn: ConnDefinition = {
			connId: randomUUID(),
			title: input.title.trim(),
			prompt: input.prompt.trim(),
			target: input.target,
			schedule,
			assetRefs: normalizeAssetRefs(input.assetRefs),
			...(input.maxRunMs !== undefined ? { maxRunMs: normalizeMaxRunMs(input.maxRunMs) } : {}),
			profileId: normalizeOptionalId(input.profileId) ?? DEFAULT_PROFILE_ID,
			agentSpecId: normalizeOptionalId(input.agentSpecId) ?? DEFAULT_AGENT_SPEC_ID,
			skillSetId: normalizeOptionalId(input.skillSetId) ?? DEFAULT_SKILL_SET_ID,
			modelPolicyId: normalizeOptionalId(input.modelPolicyId) ?? DEFAULT_MODEL_POLICY_ID,
			upgradePolicy: input.upgradePolicy ?? DEFAULT_UPGRADE_POLICY,
			status: "active",
			createdAt,
			updatedAt: createdAt,
			nextRunAt: computeNextRunAt(schedule, undefined, now)?.toISOString(),
		};

		this.options.database.run(
			[
				"INSERT INTO conns (",
				"conn_id, title, prompt, target_json, schedule_json, asset_refs_json, max_run_ms,",
				"profile_id, agent_spec_id, skill_set_id, model_policy_id, upgrade_policy,",
				"status, created_at, updated_at, next_run_at",
				") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			].join(" "),
			conn.connId,
			conn.title,
			conn.prompt,
			JSON.stringify(conn.target),
			JSON.stringify(conn.schedule),
			JSON.stringify(conn.assetRefs),
			conn.maxRunMs,
			conn.profileId,
			conn.agentSpecId,
			conn.skillSetId,
			conn.modelPolicyId,
			conn.upgradePolicy,
			conn.status,
			conn.createdAt,
			conn.updatedAt,
			conn.nextRunAt,
		);

		return conn;
	}

	async update(connId: string, patch: UpdateConnInput): Promise<ConnDefinition | undefined> {
		const existing = await this.get(connId);
		if (!existing) {
			return undefined;
		}

		const now = patch.now ?? new Date();
		const schedule = patch.schedule ? normalizeSchedule(patch.schedule, now) : existing.schedule;
		const status = patch.status ?? existing.status;
		const updated: ConnDefinition = {
			...existing,
			...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
			...(patch.prompt !== undefined ? { prompt: patch.prompt.trim() } : {}),
			...(patch.target !== undefined ? { target: patch.target } : {}),
			...(patch.schedule !== undefined ? { schedule } : {}),
			...(patch.assetRefs !== undefined ? { assetRefs: normalizeAssetRefs(patch.assetRefs) } : {}),
			...(patch.maxRunMs !== undefined ? { maxRunMs: normalizeMaxRunMs(patch.maxRunMs) } : {}),
			...(patch.profileId !== undefined ? { profileId: normalizeRequiredId(patch.profileId, "profileId") } : {}),
			...(patch.agentSpecId !== undefined ? { agentSpecId: normalizeRequiredId(patch.agentSpecId, "agentSpecId") } : {}),
			...(patch.skillSetId !== undefined ? { skillSetId: normalizeRequiredId(patch.skillSetId, "skillSetId") } : {}),
			...(patch.modelPolicyId !== undefined ? { modelPolicyId: normalizeRequiredId(patch.modelPolicyId, "modelPolicyId") } : {}),
			...(patch.upgradePolicy !== undefined ? { upgradePolicy: patch.upgradePolicy } : {}),
			status,
			updatedAt: now.toISOString(),
			nextRunAt:
				status === "active"
					? computeNextRunAt(schedule, existing.lastRunAt ? new Date(existing.lastRunAt) : undefined, now)?.toISOString()
					: undefined,
		};

		this.options.database.run(
			[
				"UPDATE conns SET",
				"title = ?, prompt = ?, target_json = ?, schedule_json = ?, asset_refs_json = ?, max_run_ms = ?,",
				"profile_id = ?, agent_spec_id = ?, skill_set_id = ?, model_policy_id = ?, upgrade_policy = ?,",
				"status = ?, updated_at = ?, next_run_at = ?",
				"WHERE conn_id = ?",
			].join(" "),
			updated.title,
			updated.prompt,
			JSON.stringify(updated.target),
			JSON.stringify(updated.schedule),
			JSON.stringify(updated.assetRefs),
			updated.maxRunMs,
			updated.profileId,
			updated.agentSpecId,
			updated.skillSetId,
			updated.modelPolicyId,
			updated.upgradePolicy,
			updated.status,
			updated.updatedAt,
			updated.nextRunAt,
			updated.connId,
		);

		return updated;
	}

	async delete(connId: string): Promise<boolean> {
		const result = await this.deleteMany([connId]);
		return result.deletedConnIds.includes(connId);
	}

	async deleteMany(connIds: readonly string[]): Promise<DeleteManyConnsResult> {
		const uniqueConnIds = Array.from(
			new Set(connIds.map((connId) => connId.trim()).filter((connId) => connId.length > 0)),
		);
		const result: DeleteManyConnsResult = {
			deletedConnIds: [],
			missingConnIds: [],
		};
		if (uniqueConnIds.length === 0) {
			return result;
		}

		try {
			this.options.database.exec("BEGIN IMMEDIATE");
			for (const connId of uniqueConnIds) {
				const existing = this.options.database.get<Pick<ConnRow, "conn_id">>(
					"SELECT conn_id FROM conns WHERE conn_id = ?",
					connId,
				);
				if (!existing) {
					result.missingConnIds.push(connId);
					continue;
				}
				this.deleteConnReferences(connId);
				this.options.database.run("DELETE FROM conns WHERE conn_id = ?", connId);
				result.deletedConnIds.push(connId);
			}
			this.options.database.exec("COMMIT");
		} catch (error) {
			this.rollbackQuietly();
			throw error;
		}
		return result;
	}

	async pause(connId: string, now: Date = new Date()): Promise<ConnDefinition | undefined> {
		return await this.update(connId, { status: "paused", now });
	}

	async resume(connId: string, now: Date = new Date()): Promise<ConnDefinition | undefined> {
		return await this.update(connId, { status: "active", now });
	}

	private deleteConnReferences(connId: string): void {
		this.options.database.run("DELETE FROM conversation_notifications WHERE source = 'conn' AND source_id = ?", connId);
		this.options.database.run("DELETE FROM agent_activity_items WHERE source = 'conn' AND source_id = ?", connId);
	}

	private rollbackQuietly(): void {
		try {
			this.options.database.exec("ROLLBACK");
		} catch {
			// SQLite may have already closed the transaction.
		}
	}
}

function rowToConnDefinition(row: ConnRow): ConnDefinition {
	return {
		connId: row.conn_id,
		title: row.title,
		prompt: row.prompt,
		target: parseJsonField<ConnTarget>(row.target_json, "target_json"),
		schedule: parseJsonField<ConnSchedule>(row.schedule_json, "schedule_json"),
		assetRefs: parseJsonField<string[]>(row.asset_refs_json, "asset_refs_json"),
		...(typeof row.max_run_ms === "number" ? { maxRunMs: row.max_run_ms } : {}),
		profileId: row.profile_id,
		agentSpecId: row.agent_spec_id,
		skillSetId: row.skill_set_id,
		modelPolicyId: row.model_policy_id,
		upgradePolicy: row.upgrade_policy,
		status: row.status,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		...(row.last_run_at ? { lastRunAt: row.last_run_at } : {}),
		...(row.next_run_at ? { nextRunAt: row.next_run_at } : {}),
		...(row.last_run_id ? { lastRunId: row.last_run_id } : {}),
	};
}

function parseJsonField<T>(value: string, fieldName: string): T {
	try {
		return JSON.parse(value) as T;
	} catch {
		throw new Error(`Invalid JSON in conn database field ${fieldName}`);
	}
}

function normalizeSchedule(schedule: ConnSchedule, now: Date): ConnSchedule {
	if (schedule.kind === "once") {
		const at = parseValidDate(schedule.at, "Invalid conn schedule: once.at must be a valid date");
		return {
			kind: "once",
			at: at.toISOString(),
		};
	}

	if (schedule.kind === "interval") {
		if (!Number.isFinite(schedule.everyMs)) {
			throw new Error("Invalid conn schedule: interval.everyMs must be finite");
		}
		return {
			kind: "interval",
			everyMs: Math.max(60_000, Math.trunc(schedule.everyMs)),
			...(schedule.startAt
				? { startAt: parseValidDate(schedule.startAt, "Invalid conn schedule: interval.startAt must be a valid date").toISOString() }
				: {}),
		};
	}

	const expression = schedule.expression.trim();
	const timezone = normalizeCronTimeZone(schedule.timezone);
	if (!timezone) {
		throw new Error("Invalid conn schedule: cron.timezone is invalid");
	}
	if (!expression || !computeNextCronOccurrence(expression, now, timezone)) {
		throw new Error("Invalid conn schedule: cron.expression is invalid");
	}
	return {
		kind: "cron",
		expression,
		timezone,
	};
}

function parseValidDate(value: string, message: string): Date {
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) {
		throw new Error(message);
	}
	return date;
}

function normalizeAssetRefs(assetRefs: readonly string[] | undefined): string[] {
	return Array.from(new Set((assetRefs ?? []).map((value) => value.trim()).filter((value) => value.length > 0)));
}

function normalizeOptionalId(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed || undefined;
}

function normalizeRequiredId(value: string, fieldName: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error(`Invalid conn ${fieldName}: value must be non-empty`);
	}
	return trimmed;
}

function normalizeMaxRunMs(value: number): number {
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error("Invalid conn maxRunMs: value must be a positive number");
	}
	return Math.trunc(value);
}

function normalizeCronTimeZone(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	const timeZone = trimmed || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	try {
		new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
		return timeZone;
	} catch {
		return undefined;
	}
}
