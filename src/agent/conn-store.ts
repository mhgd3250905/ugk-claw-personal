import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type ConnStatus = "active" | "paused" | "completed";

export type ConnTarget =
	| {
			type: "conversation";
			conversationId: string;
	  }
	| {
			type: "feishu_chat";
			chatId: string;
	  }
	| {
			type: "feishu_user";
			openId: string;
	  };

export type ConnSchedule =
	| {
			kind: "once";
			at: string;
	  }
	| {
			kind: "interval";
			everyMs: number;
			startAt?: string;
	  }
	| {
			kind: "cron";
			expression: string;
	  };

export interface ConnRunResult {
	ok: boolean;
	summary: string;
	text?: string;
	error?: string;
	finishedAt: string;
}

export interface ConnDefinition {
	connId: string;
	title: string;
	prompt: string;
	target: ConnTarget;
	schedule: ConnSchedule;
	assetRefs: string[];
	status: ConnStatus;
	createdAt: string;
	updatedAt: string;
	lastRunAt?: string;
	nextRunAt?: string;
	lastResult?: ConnRunResult;
}

type ConnIndex = Record<string, ConnDefinition>;

export class ConnStore {
	constructor(private readonly options: { indexPath: string }) {}

	async list(): Promise<ConnDefinition[]> {
		const index = await this.readIndex();
		return Object.values(index).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
	}

	async get(connId: string): Promise<ConnDefinition | undefined> {
		const index = await this.readIndex();
		return index[connId];
	}

	async create(input: {
		title: string;
		prompt: string;
		target: ConnTarget;
		schedule: ConnSchedule;
		assetRefs?: string[];
		now?: Date;
	}): Promise<ConnDefinition> {
		const now = input.now ?? new Date();
		const createdAt = now.toISOString();
		const conn: ConnDefinition = {
			connId: randomUUID(),
			title: input.title.trim(),
			prompt: input.prompt.trim(),
			target: input.target,
			schedule: normalizeSchedule(input.schedule),
			assetRefs: normalizeAssetRefs(input.assetRefs),
			status: "active",
			createdAt,
			updatedAt: createdAt,
			nextRunAt: computeNextRunAt(normalizeSchedule(input.schedule), undefined, now)?.toISOString(),
		};

		const index = await this.readIndex();
		index[conn.connId] = conn;
		await this.writeIndex(index);
		return conn;
	}

	async update(
		connId: string,
		patch: Partial<Pick<ConnDefinition, "title" | "prompt" | "target" | "schedule" | "assetRefs" | "status">> & { now?: Date },
	): Promise<ConnDefinition | undefined> {
		const index = await this.readIndex();
		const existing = index[connId];
		if (!existing) {
			return undefined;
		}

		const now = patch.now ?? new Date();
		const nextSchedule = patch.schedule ? normalizeSchedule(patch.schedule) : existing.schedule;
		const nextStatus = patch.status ?? existing.status;
		const updated: ConnDefinition = {
			...existing,
			...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
			...(patch.prompt !== undefined ? { prompt: patch.prompt.trim() } : {}),
			...(patch.target !== undefined ? { target: patch.target } : {}),
			...(patch.schedule !== undefined ? { schedule: nextSchedule } : {}),
			...(patch.assetRefs !== undefined ? { assetRefs: normalizeAssetRefs(patch.assetRefs) } : {}),
			status: nextStatus,
			updatedAt: now.toISOString(),
			nextRunAt:
				nextStatus === "active"
					? computeNextRunAt(nextSchedule, existing.lastRunAt ? new Date(existing.lastRunAt) : undefined, now)?.toISOString()
					: existing.nextRunAt,
		};

		if (nextStatus === "paused") {
			delete updated.nextRunAt;
		}
		if (nextStatus === "completed") {
			delete updated.nextRunAt;
		}

		index[connId] = updated;
		await this.writeIndex(index);
		return updated;
	}

	async delete(connId: string): Promise<boolean> {
		const index = await this.readIndex();
		if (!index[connId]) {
			return false;
		}
		delete index[connId];
		await this.writeIndex(index);
		return true;
	}

	async pause(connId: string, now: Date = new Date()): Promise<ConnDefinition | undefined> {
		return await this.update(connId, { status: "paused", now });
	}

	async resume(connId: string, now: Date = new Date()): Promise<ConnDefinition | undefined> {
		return await this.update(connId, { status: "active", now });
	}

	async due(now: Date = new Date()): Promise<ConnDefinition[]> {
		const index = await this.readIndex();
		return Object.values(index)
			.filter((conn) => conn.status === "active" && typeof conn.nextRunAt === "string" && conn.nextRunAt <= now.toISOString())
			.sort((left, right) => (left.nextRunAt ?? "").localeCompare(right.nextRunAt ?? ""));
	}

	async recordRun(connId: string, result: ConnRunResult, now: Date = new Date()): Promise<ConnDefinition | undefined> {
		const index = await this.readIndex();
		const existing = index[connId];
		if (!existing) {
			return undefined;
		}

		const nextRunAt = computeNextRunAt(existing.schedule, now, now);
		const updated: ConnDefinition = {
			...existing,
			status: nextRunAt ? existing.status : "completed",
			lastRunAt: now.toISOString(),
			lastResult: result,
			nextRunAt: nextRunAt?.toISOString(),
			updatedAt: now.toISOString(),
		};

		index[connId] = updated;
		await this.writeIndex(index);
		return updated;
	}

	async triggerNow(connId: string, now: Date = new Date()): Promise<ConnDefinition | undefined> {
		const index = await this.readIndex();
		const existing = index[connId];
		if (!existing) {
			return undefined;
		}

		const updated: ConnDefinition = {
			...existing,
			status: "active",
			nextRunAt: now.toISOString(),
			updatedAt: now.toISOString(),
		};
		index[connId] = updated;
		await this.writeIndex(index);
		return updated;
	}

	private async readIndex(): Promise<ConnIndex> {
		try {
			const content = await readFile(this.options.indexPath, "utf8");
			if (!content.trim()) {
				return {};
			}
			const parsed = JSON.parse(content) as ConnIndex;
			return typeof parsed === "object" && parsed !== null ? parsed : {};
		} catch (error) {
			if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
				return {};
			}
			if (error instanceof SyntaxError) {
				return {};
			}
			throw error;
		}
	}

	private async writeIndex(index: ConnIndex): Promise<void> {
		await mkdir(dirname(this.options.indexPath), { recursive: true });
		await writeFile(this.options.indexPath, JSON.stringify(index, null, 2), "utf8");
	}
}

export function computeNextRunAt(schedule: ConnSchedule, lastRunAt: Date | undefined, now: Date): Date | undefined {
	if (schedule.kind === "once") {
		const onceAt = new Date(schedule.at);
		return onceAt.getTime() > now.getTime() ? onceAt : undefined;
	}

	if (schedule.kind === "interval") {
		const baseTime = lastRunAt ?? (schedule.startAt ? new Date(schedule.startAt) : now);
		const next = new Date(baseTime.getTime() + schedule.everyMs);
		return next.getTime() > now.getTime() ? next : new Date(now.getTime() + schedule.everyMs);
	}

	return computeNextCronOccurrence(schedule.expression, now);
}

export function computeNextCronOccurrence(expression: string, now: Date): Date | undefined {
	const cron = parseCronExpression(expression);
	if (!cron) {
		return undefined;
	}

	const cursor = new Date(now);
	cursor.setSeconds(0, 0);
	cursor.setMinutes(cursor.getMinutes() + 1);

	for (let step = 0; step < 366 * 24 * 60; step += 1) {
		if (
			cron.minute.has(cursor.getMinutes()) &&
			cron.hour.has(cursor.getHours()) &&
			cron.dayOfMonth.has(cursor.getDate()) &&
			cron.month.has(cursor.getMonth() + 1) &&
			cron.dayOfWeek.has(cursor.getDay())
		) {
			return new Date(cursor);
		}
		cursor.setMinutes(cursor.getMinutes() + 1);
	}

	return undefined;
}

function normalizeSchedule(schedule: ConnSchedule): ConnSchedule {
	if (schedule.kind === "once") {
		return {
			kind: "once",
			at: new Date(schedule.at).toISOString(),
		};
	}

	if (schedule.kind === "interval") {
		return {
			kind: "interval",
			everyMs: Math.max(60_000, Math.trunc(schedule.everyMs)),
			...(schedule.startAt ? { startAt: new Date(schedule.startAt).toISOString() } : {}),
		};
	}

	return {
		kind: "cron",
		expression: schedule.expression.trim(),
	};
}

function normalizeAssetRefs(assetRefs: readonly string[] | undefined): string[] {
	return Array.from(new Set((assetRefs ?? []).map((value) => value.trim()).filter((value) => value.length > 0)));
}

function parseCronExpression(expression: string): {
	minute: Set<number>;
	hour: Set<number>;
	dayOfMonth: Set<number>;
	month: Set<number>;
	dayOfWeek: Set<number>;
} | null {
	const parts = expression.trim().split(/\s+/);
	if (parts.length !== 5) {
		return null;
	}

	const minute = parseCronField(parts[0], 0, 59);
	const hour = parseCronField(parts[1], 0, 23);
	const dayOfMonth = parseCronField(parts[2], 1, 31);
	const month = parseCronField(parts[3], 1, 12);
	const dayOfWeek = parseCronField(parts[4], 0, 6);
	if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
		return null;
	}

	return {
		minute,
		hour,
		dayOfMonth,
		month,
		dayOfWeek,
	};
}

function parseCronField(field: string, min: number, max: number): Set<number> | null {
	const values = new Set<number>();

	for (const part of field.split(",")) {
		if (part === "*") {
			for (let value = min; value <= max; value += 1) {
				values.add(value);
			}
			continue;
		}

		const stepMatch = part.match(/^\*\/(\d+)$/);
		if (stepMatch) {
			const step = Number(stepMatch[1]);
			if (!Number.isInteger(step) || step <= 0) {
				return null;
			}
			for (let value = min; value <= max; value += step) {
				values.add(value);
			}
			continue;
		}

		const rangeMatch = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
		if (rangeMatch) {
			const rangeStart = Number(rangeMatch[1]);
			const rangeEnd = Number(rangeMatch[2]);
			const step = rangeMatch[3] ? Number(rangeMatch[3]) : 1;
			if (
				!Number.isInteger(rangeStart) ||
				!Number.isInteger(rangeEnd) ||
				!Number.isInteger(step) ||
				rangeStart < min ||
				rangeEnd > max ||
				rangeStart > rangeEnd ||
				step <= 0
			) {
				return null;
			}
			for (let value = rangeStart; value <= rangeEnd; value += step) {
				values.add(value);
			}
			continue;
		}

		const value = Number(part);
		if (!Number.isInteger(value) || value < min || value > max) {
			return null;
		}
		values.add(value);
	}

	return values;
}
