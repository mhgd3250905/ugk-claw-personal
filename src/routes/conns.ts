import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { ConnRunEventRecord, ConnRunFileRecord, ConnRunRecord } from "../agent/conn-run-store.js";
import type { ConnDefinition, ConnSchedule, ConnTarget } from "../agent/conn-store.js";
import type {
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
	getCurrentConversationId(): Promise<string>;
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

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function parseTarget(value: unknown): { target?: ConnTarget; error?: string } {
	if (!value || typeof value !== "object") {
		return { error: 'Field "target" must be an object' };
	}

	const target = value as Record<string, unknown>;
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
	getCurrentConversationId: () => Promise<string>,
): Promise<{ target?: ConnTarget; error?: string }> {
	if (value === undefined) {
		const conversationId = (await getCurrentConversationId()).trim();
		if (!conversationId) {
			throw new Error("Current conversation id is unavailable");
		}
		return {
			target: {
				type: "conversation",
				conversationId,
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
		return { schedule: { kind: "once", at: schedule.at.trim() } };
	}
	if (schedule.kind === "interval" && typeof schedule.everyMs === "number" && Number.isFinite(schedule.everyMs)) {
		return {
			schedule: {
				kind: "interval",
				everyMs: schedule.everyMs,
				...(isNonEmptyString(schedule.startAt) ? { startAt: schedule.startAt.trim() } : {}),
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
			if (!isNonEmptyString(body.title)) {
				return sendBadRequest(reply, 'Field "title" must be a non-empty string');
			}
			if (!isNonEmptyString(body.prompt)) {
				return sendBadRequest(reply, 'Field "prompt" must be a non-empty string');
			}
			const parsedTarget = await resolveCreateTarget(body.target, options.getCurrentConversationId);
			if (parsedTarget.error) {
				return sendBadRequest(reply, parsedTarget.error);
			}
			const parsedSchedule = parseSchedule(body.schedule);
			if (parsedSchedule.error) {
				return sendBadRequest(reply, parsedSchedule.error);
			}
			const parsedAssetRefs = parseAssetRefs(body.assetRefs);
			if (parsedAssetRefs.error) {
				return sendBadRequest(reply, parsedAssetRefs.error);
			}
			const parsedProfileId = parseOptionalId(body.profileId, "profileId");
			if (parsedProfileId.error) {
				return sendBadRequest(reply, parsedProfileId.error);
			}
			const parsedAgentSpecId = parseOptionalId(body.agentSpecId, "agentSpecId");
			if (parsedAgentSpecId.error) {
				return sendBadRequest(reply, parsedAgentSpecId.error);
			}
			const parsedSkillSetId = parseOptionalId(body.skillSetId, "skillSetId");
			if (parsedSkillSetId.error) {
				return sendBadRequest(reply, parsedSkillSetId.error);
			}
			const parsedModelPolicyId = parseOptionalId(body.modelPolicyId, "modelPolicyId");
			if (parsedModelPolicyId.error) {
				return sendBadRequest(reply, parsedModelPolicyId.error);
			}
			const parsedUpgradePolicy = parseUpgradePolicy(body.upgradePolicy);
			if (parsedUpgradePolicy.error) {
				return sendBadRequest(reply, parsedUpgradePolicy.error);
			}
			const parsedMaxRunMs = parseMaxRunMs(body.maxRunMs);
			if (parsedMaxRunMs.error) {
				return sendBadRequest(reply, parsedMaxRunMs.error);
			}

			const conn = await options.connStore.create({
				title: body.title.trim(),
				prompt: body.prompt.trim(),
				target: parsedTarget.target!,
				schedule: parsedSchedule.schedule!,
				assetRefs: parsedAssetRefs.assetRefs,
				...(parsedMaxRunMs.value !== undefined ? { maxRunMs: parsedMaxRunMs.value } : {}),
				profileId: parsedProfileId.value,
				agentSpecId: parsedAgentSpecId.value,
				skillSetId: parsedSkillSetId.value,
				modelPolicyId: parsedModelPolicyId.value,
				upgradePolicy: parsedUpgradePolicy.value,
			});
			return reply.status(201).send({ conn } satisfies ConnDetailResponseBody);
		} catch (error) {
			return sendInternalError(reply, error);
		}
	});

	app.patch("/v1/conns/:connId", async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply) => {
		const { connId } = request.params as { connId: string };
		const body = request.body ?? {};
		const parsedTarget = body.target !== undefined ? parseTarget(body.target) : {};
		if ("error" in parsedTarget && parsedTarget.error) {
			return sendBadRequest(reply, parsedTarget.error);
		}
		const parsedSchedule = body.schedule !== undefined ? parseSchedule(body.schedule) : {};
		if ("error" in parsedSchedule && parsedSchedule.error) {
			return sendBadRequest(reply, parsedSchedule.error);
		}
		const parsedAssetRefs = parseAssetRefs(body.assetRefs);
		if (parsedAssetRefs.error) {
			return sendBadRequest(reply, parsedAssetRefs.error);
		}
		const parsedProfileId = parseOptionalId(body.profileId, "profileId");
		if (parsedProfileId.error) {
			return sendBadRequest(reply, parsedProfileId.error);
		}
		const parsedAgentSpecId = parseOptionalId(body.agentSpecId, "agentSpecId");
		if (parsedAgentSpecId.error) {
			return sendBadRequest(reply, parsedAgentSpecId.error);
		}
		const parsedSkillSetId = parseOptionalId(body.skillSetId, "skillSetId");
		if (parsedSkillSetId.error) {
			return sendBadRequest(reply, parsedSkillSetId.error);
		}
		const parsedModelPolicyId = parseOptionalId(body.modelPolicyId, "modelPolicyId");
		if (parsedModelPolicyId.error) {
			return sendBadRequest(reply, parsedModelPolicyId.error);
		}
		const parsedUpgradePolicy = parseUpgradePolicy(body.upgradePolicy);
		if (parsedUpgradePolicy.error) {
			return sendBadRequest(reply, parsedUpgradePolicy.error);
		}
		const parsedMaxRunMs = parseMaxRunMs(body.maxRunMs);
		if (parsedMaxRunMs.error) {
			return sendBadRequest(reply, parsedMaxRunMs.error);
		}

		try {
			const conn = await options.connStore.update(connId, {
				...(isNonEmptyString(body.title) ? { title: body.title.trim() } : {}),
				...(isNonEmptyString(body.prompt) ? { prompt: body.prompt.trim() } : {}),
				...(parsedTarget.target ? { target: parsedTarget.target } : {}),
				...(parsedSchedule.schedule ? { schedule: parsedSchedule.schedule } : {}),
				...(body.assetRefs !== undefined ? { assetRefs: parsedAssetRefs.assetRefs ?? [] } : {}),
				...(body.profileId !== undefined ? { profileId: parsedProfileId.value } : {}),
				...(body.agentSpecId !== undefined ? { agentSpecId: parsedAgentSpecId.value } : {}),
				...(body.skillSetId !== undefined ? { skillSetId: parsedSkillSetId.value } : {}),
				...(body.modelPolicyId !== undefined ? { modelPolicyId: parsedModelPolicyId.value } : {}),
				...(body.upgradePolicy !== undefined ? { upgradePolicy: parsedUpgradePolicy.value } : {}),
				...(body.maxRunMs !== undefined ? { maxRunMs: parsedMaxRunMs.value } : {}),
			});
			if (!conn) {
				return reply.status(404).send();
			}
			return { conn } satisfies ConnDetailResponseBody;
		} catch (error) {
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
