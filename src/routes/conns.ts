import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { ConnRunEventRecord, ConnRunFileRecord, ConnRunRecord } from "../agent/conn-run-store.js";
import type { ConnDefinition, ConnSchedule, ConnTarget } from "../agent/conn-store.js";
import type {
	ConnBulkDeleteRequestBody,
	ConnBulkDeleteResponseBody,
	ConnDetailResponseBody,
	ConnListResponseBody,
	ConnRunDetailResponseBody,
	ConnRunEventsResponseBody,
	ConnRunListResponseBody,
	ErrorResponseBody,
} from "../types/api.js";

interface ConnRouteOptions {
	connStore: ConnStoreLike;
	connRunStore: ConnRunStoreLike;
	backgroundDataDir: string;
}

interface ConnStoreLike {
	list(): Promise<ConnDefinition[]>;
	get(connId: string): Promise<ConnDefinition | undefined>;
	create(input: {
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
		upgradePolicy?: "latest" | "pinned" | "manual";
	}): Promise<ConnDefinition>;
	update(
		connId: string,
		patch: Partial<
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
			>
		>,
	): Promise<ConnDefinition | undefined>;
	delete(connId: string): Promise<boolean>;
	deleteMany?(connIds: readonly string[]): Promise<ConnBulkDeleteResponseBody>;
	pause(connId: string): Promise<ConnDefinition | undefined>;
	resume(connId: string): Promise<ConnDefinition | undefined>;
}

interface ConnRunStoreLike {
	createRun(input: {
		runId?: string;
		connId: string;
		scheduledAt: string;
		workspacePath: string;
	}): Promise<ConnRunRecord>;
	listRunsForConn(connId: string): Promise<ConnRunRecord[]>;
	getRun(runId: string): Promise<ConnRunRecord | undefined>;
	listEvents(runId: string): Promise<ConnRunEventRecord[]>;
	listFiles(runId: string): Promise<ConnRunFileRecord[]>;
}

function sendBadRequest(reply: FastifyReply, message: string): FastifyReply {
	return reply.status(400).send({
		error: {
			code: "BAD_REQUEST",
			message,
		},
	} satisfies ErrorResponseBody);
}

function sendInternalError(reply: FastifyReply, error: unknown): FastifyReply {
	const messageText = error instanceof Error ? error.message : "Unknown internal error";
	return reply.status(500).send({
		error: {
			code: "INTERNAL_ERROR",
			message: messageText,
		},
	} satisfies ErrorResponseBody);
}

function sendConnValidationError(reply: FastifyReply, error: unknown): FastifyReply | undefined {
	if (!(error instanceof Error)) {
		return undefined;
	}
	if (!/^Invalid conn /.test(error.message)) {
		return undefined;
	}
	return sendBadRequest(reply, error.message);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function parseTarget(value: unknown): { target?: ConnTarget; error?: string } {
	if (!value || typeof value !== "object") {
		return { error: 'Field "target" must be an object' };
	}

	const target = value as Record<string, unknown>;
	if (target.type === "task_inbox") {
		return { target: { type: "task_inbox" } };
	}
	if (target.type === "conversation" && isNonEmptyString(target.conversationId)) {
		return { target: { type: "conversation", conversationId: target.conversationId.trim() } };
	}
	if (target.type === "feishu_chat" && isNonEmptyString(target.chatId)) {
		return { target: { type: "feishu_chat", chatId: target.chatId.trim() } };
	}
	if (target.type === "feishu_user" && isNonEmptyString(target.openId)) {
		return { target: { type: "feishu_user", openId: target.openId.trim() } };
	}

	return { error: 'Field "target" is invalid' };
}

async function resolveCreateTarget(
	value: unknown,
): Promise<{ target?: ConnTarget; error?: string }> {
	if (value === undefined) {
		return {
			target: {
				type: "task_inbox",
			},
		};
	}

	return parseTarget(value);
}

function parseSchedule(value: unknown): { schedule?: ConnSchedule; error?: string } {
	if (!value || typeof value !== "object") {
		return { error: 'Field "schedule" must be an object' };
	}

	const schedule = value as Record<string, unknown>;
	if (schedule.kind === "once" && isNonEmptyString(schedule.at)) {
		return {
			schedule: {
				kind: "once",
				at: schedule.at.trim(),
				...(isNonEmptyString(schedule.timezone) ? { timezone: schedule.timezone.trim() } : {}),
			},
		};
	}
	if (schedule.kind === "interval" && typeof schedule.everyMs === "number" && Number.isFinite(schedule.everyMs)) {
		return {
			schedule: {
				kind: "interval",
				everyMs: schedule.everyMs,
				...(isNonEmptyString(schedule.startAt) ? { startAt: schedule.startAt.trim() } : {}),
				...(isNonEmptyString(schedule.timezone) ? { timezone: schedule.timezone.trim() } : {}),
			},
		};
	}
	if (schedule.kind === "cron" && isNonEmptyString(schedule.expression)) {
		return {
			schedule: {
				kind: "cron",
				expression: schedule.expression.trim(),
				...(isNonEmptyString(schedule.timezone) ? { timezone: schedule.timezone.trim() } : {}),
			},
		};
	}

	return { error: 'Field "schedule" is invalid' };
}

function parseAssetRefs(value: unknown): { assetRefs?: string[]; error?: string } {
	if (value === undefined) {
		return {};
	}
	if (!Array.isArray(value)) {
		return { error: 'Field "assetRefs" must be an array when provided' };
	}

	const assetRefs: string[] = [];
	for (const [index, entry] of value.entries()) {
		if (!isNonEmptyString(entry)) {
			return { error: `assetRefs[${index}] must be a non-empty string` };
		}
		assetRefs.push(entry.trim());
	}
	return { assetRefs };
}

function parseOptionalId(value: unknown, fieldName: string): { value?: string; error?: string } {
	if (value === undefined) {
		return {};
	}
	if (!isNonEmptyString(value)) {
		return { error: `Field "${fieldName}" must be a non-empty string when provided` };
	}
	return { value: value.trim() };
}

function parseUpgradePolicy(value: unknown): { value?: "latest" | "pinned" | "manual"; error?: string } {
	if (value === undefined) {
		return {};
	}
	if (value === "latest" || value === "pinned" || value === "manual") {
		return { value };
	}
	return { error: 'Field "upgradePolicy" must be one of "latest", "pinned", or "manual"' };
}

function parseMaxRunMs(value: unknown): { value?: number; error?: string } {
	if (value === undefined) {
		return {};
	}
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		return { error: 'Field "maxRunMs" must be a positive number when provided' };
	}
	return { value: Math.trunc(value) };
}

function parseConnIdList(value: unknown): { connIds?: string[]; error?: string } {
	if (!Array.isArray(value)) {
		return { error: 'Field "connIds" must be an array' };
	}
	const connIds: string[] = [];
	for (const [index, entry] of value.entries()) {
		if (!isNonEmptyString(entry)) {
			return { error: `connIds[${index}] must be a non-empty string` };
		}
		const connId = entry.trim();
		if (!connIds.includes(connId)) {
			connIds.push(connId);
		}
	}
	if (connIds.length === 0) {
		return { error: 'Field "connIds" must include at least one id' };
	}
	if (connIds.length > 100) {
		return { error: 'Field "connIds" must include at most 100 ids' };
	}
	return { connIds };
}

function parseTrimmedTextField(
	value: unknown,
	fieldName: string,
	options: { required?: boolean } = {},
): { value?: string; error?: string } {
	if (value === undefined) {
		if (options.required) {
			return { error: `Field "${fieldName}" must be a non-empty string` };
		}
		return {};
	}
	if (!isNonEmptyString(value)) {
		return {
			error: `Field "${fieldName}" must be a non-empty string${options.required ? "" : " when provided"}`,
		};
	}
	return { value: value.trim() };
}

interface ParsedConnMutationBody {
	title?: string;
	prompt?: string;
	target?: ConnTarget;
	schedule?: ConnSchedule;
	assetRefs?: string[];
	profileId?: string;
	agentSpecId?: string;
	skillSetId?: string;
	modelPolicyId?: string;
	upgradePolicy?: "latest" | "pinned" | "manual";
	maxRunMs?: number;
}

async function parseConnMutationBody(
	body: Record<string, unknown>,
	options: {
		requireTitle?: boolean;
		requirePrompt?: boolean;
		requireSchedule?: boolean;
		resolveDefaultTarget?: boolean;
	},
): Promise<{ value?: ParsedConnMutationBody; error?: string }> {
	const parsed: ParsedConnMutationBody = {};

	const parsedTitle = parseTrimmedTextField(body.title, "title", { required: options.requireTitle });
	if (parsedTitle.error) {
		return { error: parsedTitle.error };
	}
	if (parsedTitle.value !== undefined) {
		parsed.title = parsedTitle.value;
	}

	const parsedPrompt = parseTrimmedTextField(body.prompt, "prompt", { required: options.requirePrompt });
	if (parsedPrompt.error) {
		return { error: parsedPrompt.error };
	}
	if (parsedPrompt.value !== undefined) {
		parsed.prompt = parsedPrompt.value;
	}

	if (body.target === undefined) {
		if (options.resolveDefaultTarget) {
			const parsedTarget = await resolveCreateTarget(undefined);
			if (parsedTarget.error) {
				return { error: parsedTarget.error };
			}
			parsed.target = parsedTarget.target;
		}
	} else {
		const parsedTarget = parseTarget(body.target);
		if (parsedTarget.error) {
			return { error: parsedTarget.error };
		}
		parsed.target = parsedTarget.target;
	}

	if (body.schedule !== undefined || options.requireSchedule) {
		const parsedSchedule = parseSchedule(body.schedule);
		if (parsedSchedule.error) {
			return { error: parsedSchedule.error };
		}
		parsed.schedule = parsedSchedule.schedule;
	}

	const parsedAssetRefs = parseAssetRefs(body.assetRefs);
	if (parsedAssetRefs.error) {
		return { error: parsedAssetRefs.error };
	}
	if (body.assetRefs !== undefined) {
		parsed.assetRefs = parsedAssetRefs.assetRefs ?? [];
	}

	for (const fieldName of ["profileId", "agentSpecId", "skillSetId", "modelPolicyId"] as const) {
		const parsedOptionalId = parseOptionalId(body[fieldName], fieldName);
		if (parsedOptionalId.error) {
			return { error: parsedOptionalId.error };
		}
		if (body[fieldName] !== undefined) {
			parsed[fieldName] = parsedOptionalId.value;
		}
	}

	const parsedUpgradePolicy = parseUpgradePolicy(body.upgradePolicy);
	if (parsedUpgradePolicy.error) {
		return { error: parsedUpgradePolicy.error };
	}
	if (body.upgradePolicy !== undefined) {
		parsed.upgradePolicy = parsedUpgradePolicy.value;
	}

	const parsedMaxRunMs = parseMaxRunMs(body.maxRunMs);
	if (parsedMaxRunMs.error) {
		return { error: parsedMaxRunMs.error };
	}
	if (body.maxRunMs !== undefined) {
		parsed.maxRunMs = parsedMaxRunMs.value;
	}

	return { value: parsed };
}

export function registerConnRoutes(app: FastifyInstance, options: ConnRouteOptions): void {
	app.get("/v1/conns", async (): Promise<ConnListResponseBody> => {
		return {
			conns: await options.connStore.list(),
		};
	});

	app.get("/v1/conns/:connId", async (request, reply): Promise<ConnDetailResponseBody | FastifyReply> => {
		const { connId } = request.params as { connId: string };
		const conn = await options.connStore.get(connId);
		if (!conn) {
			return reply.status(404).send();
		}
		return { conn };
	});

	app.get("/v1/conns/:connId/runs", async (request, reply): Promise<ConnRunListResponseBody | FastifyReply> => {
		const { connId } = request.params as { connId: string };
		const conn = await options.connStore.get(connId);
		if (!conn) {
			return reply.status(404).send();
		}
		const runs = await options.connRunStore.listRunsForConn(connId);
		return {
			runs: runs.map(toConnRunBody),
		};
	});

	app.get("/v1/conns/:connId/runs/:runId", async (request, reply): Promise<ConnRunDetailResponseBody | FastifyReply> => {
		const { connId, runId } = request.params as { connId: string; runId: string };
		const run = await options.connRunStore.getRun(runId);
		if (!run || run.connId !== connId) {
			return reply.status(404).send();
		}
		const files = await options.connRunStore.listFiles(runId);
		return {
			run: toConnRunBody(run),
			files: files.map(toConnRunFileBody),
		};
	});

	app.get(
		"/v1/conns/:connId/runs/:runId/events",
		async (request, reply): Promise<ConnRunEventsResponseBody | FastifyReply> => {
			const { connId, runId } = request.params as { connId: string; runId: string };
			const run = await options.connRunStore.getRun(runId);
			if (!run || run.connId !== connId) {
				return reply.status(404).send();
			}
			const events = await options.connRunStore.listEvents(runId);
			return {
				events: events.map(toConnRunEventBody),
			};
		},
	);

	app.post("/v1/conns", async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply) => {
		try {
			const body = request.body ?? {};
			const parsed = await parseConnMutationBody(body, {
				requireTitle: true,
				requirePrompt: true,
				requireSchedule: true,
				resolveDefaultTarget: true,
			});
			if (parsed.error) {
				return sendBadRequest(reply, parsed.error);
			}

			const conn = await options.connStore.create({
				title: parsed.value!.title!,
				prompt: parsed.value!.prompt!,
				target: parsed.value!.target!,
				schedule: parsed.value!.schedule!,
				assetRefs: parsed.value!.assetRefs,
				...(parsed.value!.maxRunMs !== undefined ? { maxRunMs: parsed.value!.maxRunMs } : {}),
				profileId: parsed.value!.profileId,
				agentSpecId: parsed.value!.agentSpecId,
				skillSetId: parsed.value!.skillSetId,
				modelPolicyId: parsed.value!.modelPolicyId,
				upgradePolicy: parsed.value!.upgradePolicy,
			});
			return reply.status(201).send({ conn } satisfies ConnDetailResponseBody);
		} catch (error) {
			const validationReply = sendConnValidationError(reply, error);
			if (validationReply) {
				return validationReply;
			}
			return sendInternalError(reply, error);
		}
	});

	app.post(
		"/v1/conns/bulk-delete",
		async (request: FastifyRequest<{ Body: ConnBulkDeleteRequestBody }>, reply): Promise<ConnBulkDeleteResponseBody | FastifyReply> => {
			const parsed = parseConnIdList(request.body?.connIds);
			if (parsed.error) {
				return sendBadRequest(reply, parsed.error);
			}
			if (options.connStore.deleteMany) {
				return await options.connStore.deleteMany(parsed.connIds!);
			}
			const deletedConnIds: string[] = [];
			const missingConnIds: string[] = [];
			for (const connId of parsed.connIds!) {
				if (await options.connStore.delete(connId)) {
					deletedConnIds.push(connId);
				} else {
					missingConnIds.push(connId);
				}
			}
			return { deletedConnIds, missingConnIds };
		},
	);

	app.patch("/v1/conns/:connId", async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply) => {
		const { connId } = request.params as { connId: string };
		const body = request.body ?? {};
		const parsed = await parseConnMutationBody(body, {});
		if (parsed.error) {
			return sendBadRequest(reply, parsed.error);
		}

		try {
			const conn = await options.connStore.update(connId, {
				...(parsed.value!.title !== undefined ? { title: parsed.value!.title } : {}),
				...(parsed.value!.prompt !== undefined ? { prompt: parsed.value!.prompt } : {}),
				...(parsed.value!.target ? { target: parsed.value!.target } : {}),
				...(parsed.value!.schedule ? { schedule: parsed.value!.schedule } : {}),
				...(body.assetRefs !== undefined ? { assetRefs: parsed.value!.assetRefs ?? [] } : {}),
				...(body.profileId !== undefined ? { profileId: parsed.value!.profileId } : {}),
				...(body.agentSpecId !== undefined ? { agentSpecId: parsed.value!.agentSpecId } : {}),
				...(body.skillSetId !== undefined ? { skillSetId: parsed.value!.skillSetId } : {}),
				...(body.modelPolicyId !== undefined ? { modelPolicyId: parsed.value!.modelPolicyId } : {}),
				...(body.upgradePolicy !== undefined ? { upgradePolicy: parsed.value!.upgradePolicy } : {}),
				...(body.maxRunMs !== undefined ? { maxRunMs: parsed.value!.maxRunMs } : {}),
			});
			if (!conn) {
				return reply.status(404).send();
			}
			return { conn } satisfies ConnDetailResponseBody;
		} catch (error) {
			const validationReply = sendConnValidationError(reply, error);
			if (validationReply) {
				return validationReply;
			}
			return sendInternalError(reply, error);
		}
	});

	app.post("/v1/conns/:connId/pause", async (request, reply) => {
		const { connId } = request.params as { connId: string };
		const conn = await options.connStore.pause(connId);
		if (!conn) {
			return reply.status(404).send();
		}
		return { conn } satisfies ConnDetailResponseBody;
	});

	app.post("/v1/conns/:connId/resume", async (request, reply) => {
		const { connId } = request.params as { connId: string };
		const conn = await options.connStore.resume(connId);
		if (!conn) {
			return reply.status(404).send();
		}
		return { conn } satisfies ConnDetailResponseBody;
	});

	app.post("/v1/conns/:connId/run", async (request, reply) => {
		const { connId } = request.params as { connId: string };
		try {
			const conn = await options.connStore.get(connId);
			if (!conn) {
				return reply.status(404).send();
			}
			const scheduledAt = new Date().toISOString();
			const runId = randomUUID();
			const run = await options.connRunStore.createRun({
				runId,
				connId,
				scheduledAt,
				workspacePath: join(options.backgroundDataDir, "runs", runId),
			});
			return reply.status(202).send({ run: toConnRunBody(run) } satisfies ConnRunDetailResponseBody);
		} catch (error) {
			return sendInternalError(reply, error);
		}
	});

	app.delete("/v1/conns/:connId", async (request, reply) => {
		const { connId } = request.params as { connId: string };
		const deleted = await options.connStore.delete(connId);
		if (!deleted) {
			return reply.status(404).send();
		}
		return reply.status(204).send();
	});
}

function toConnRunBody(run: ConnRunRecord): ConnRunDetailResponseBody["run"] {
	return {
		runId: run.runId,
		connId: run.connId,
		status: run.status,
		scheduledAt: run.scheduledAt,
		...(run.claimedAt ? { claimedAt: run.claimedAt } : {}),
		...(run.startedAt ? { startedAt: run.startedAt } : {}),
		...(run.leaseOwner ? { leaseOwner: run.leaseOwner } : {}),
		...(run.leaseUntil ? { leaseUntil: run.leaseUntil } : {}),
		...(run.finishedAt ? { finishedAt: run.finishedAt } : {}),
		workspacePath: run.workspacePath,
		...(run.sessionFile ? { sessionFile: run.sessionFile } : {}),
		...(run.resultSummary ? { resultSummary: run.resultSummary } : {}),
		...(run.resultText ? { resultText: run.resultText } : {}),
		...(run.errorText ? { errorText: run.errorText } : {}),
		...(run.deliveredAt ? { deliveredAt: run.deliveredAt } : {}),
		...(run.retryOfRunId ? { retryOfRunId: run.retryOfRunId } : {}),
		createdAt: run.createdAt,
		updatedAt: run.updatedAt,
	};
}

function toConnRunFileBody(file: ConnRunFileRecord): NonNullable<ConnRunDetailResponseBody["files"]>[number] {
	return {
		fileId: file.fileId,
		runId: file.runId,
		kind: file.kind,
		relativePath: file.relativePath,
		fileName: file.fileName,
		mimeType: file.mimeType,
		sizeBytes: file.sizeBytes,
		createdAt: file.createdAt,
	};
}

function toConnRunEventBody(event: ConnRunEventRecord): ConnRunEventsResponseBody["events"][number] {
	return {
		eventId: event.eventId,
		runId: event.runId,
		seq: event.seq,
		eventType: event.eventType,
		event: event.event,
		createdAt: event.createdAt,
	};
}
