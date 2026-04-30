import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type {
	ConnRunEventRecord,
	ConnRunFileRecord,
	ConnRunRecord,
	ListConnRunEventsOptions,
} from "../agent/conn-run-store.js";
import type { ConnDefinition, ConnSchedule, ConnTarget } from "../agent/conn-store.js";
import { toConnListBody, toConnRunBody, toConnRunEventBody, toConnRunFileBody } from "./conn-route-presenters.js";
import { parseConnIdList, parseConnMutationBody } from "./conn-route-parsers.js";
import { sendBadRequest, sendInternalError } from "./http-errors.js";
import type {
	ConnBulkDeleteRequestBody,
	ConnBulkDeleteResponseBody,
	ConnDetailResponseBody,
	ConnListResponseBody,
	ConnRunDetailResponseBody,
	ConnRunEventsResponseBody,
	ConnRunListResponseBody,
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
		modelProvider?: string;
		modelId?: string;
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
				| "modelProvider"
				| "modelId"
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
	listLatestRunsForConns?(connIds: readonly string[]): Promise<Record<string, ConnRunRecord | undefined>>;
	getRun(runId: string): Promise<ConnRunRecord | undefined>;
	listEvents(runId: string, options?: ListConnRunEventsOptions): Promise<ConnRunEventRecord[]>;
	listFiles(runId: string): Promise<ConnRunFileRecord[]>;
}

const RUN_EVENT_PAGE_SIZE = 2;
const RUN_EVENT_MAX_PAGE_SIZE = 20;

function parseRunEventPageQuery(query: Record<string, unknown>): {
	value?: { limit: number; beforeSeq?: number };
	error?: string;
} {
	const rawLimit = query.limit;
	let limit = RUN_EVENT_PAGE_SIZE;
	if (rawLimit !== undefined) {
		if (typeof rawLimit !== "string" || rawLimit.trim().length === 0) {
			return { error: 'Field "limit" must be a positive integer when provided' };
		}
		const parsedLimit = Number(rawLimit);
		if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
			return { error: 'Field "limit" must be a positive integer when provided' };
		}
		limit = Math.min(parsedLimit, RUN_EVENT_MAX_PAGE_SIZE);
	}

	const rawBefore = query.before;
	if (rawBefore === undefined || rawBefore === "") {
		return { value: { limit } };
	}
	if (typeof rawBefore !== "string") {
		return { error: 'Field "before" must be a positive integer when provided' };
	}
	const beforeSeq = Number(rawBefore);
	if (!Number.isInteger(beforeSeq) || beforeSeq <= 0) {
		return { error: 'Field "before" must be a positive integer when provided' };
	}
	return { value: { limit, beforeSeq } };
}

function isConnRunLogNoiseEvent(event: ConnRunEventRecord): boolean {
	const normalizedEventType = event.eventType.toLowerCase();
	const nestedType = typeof event.event?.type === "string" ? event.event.type.toLowerCase() : "";
	return normalizedEventType === "text_delta" || nestedType === "text_delta";
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

export function registerConnRoutes(app: FastifyInstance, options: ConnRouteOptions): void {
	app.get("/v1/conns", async (): Promise<ConnListResponseBody> => {
		const conns = await options.connStore.list();
		const latestRunsByConnId = options.connRunStore.listLatestRunsForConns
			? await options.connRunStore.listLatestRunsForConns(conns.map((conn) => conn.connId))
			: undefined;
		return {
			conns: conns.map((conn) => toConnListBody(conn, latestRunsByConnId)),
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
		async (
			request: FastifyRequest<{
				Params: { connId: string; runId: string };
				Querystring: { limit?: string; before?: string };
			}>,
			reply,
		): Promise<ConnRunEventsResponseBody | FastifyReply> => {
			const { connId, runId } = request.params as { connId: string; runId: string };
			const run = await options.connRunStore.getRun(runId);
			if (!run || run.connId !== connId) {
				return reply.status(404).send();
			}
			const parsed = parseRunEventPageQuery(request.query ?? {});
			if (parsed.error || !parsed.value) {
				return sendBadRequest(reply, parsed.error || "Invalid run event query");
			}
			const events = await options.connRunStore.listEvents(runId, {
				beforeSeq: parsed.value.beforeSeq,
				descending: true,
				limit: parsed.value.limit * 6 + 1,
			});
			const meaningfulEvents = events.filter((event) => !isConnRunLogNoiseEvent(event));
			const visibleEvents = meaningfulEvents.slice(0, parsed.value.limit);
			const lastVisible = visibleEvents.at(-1);
			const hasMore =
				!!lastVisible && (meaningfulEvents.length > parsed.value.limit || events.length > parsed.value.limit * 6);
			return {
				events: visibleEvents.map(toConnRunEventBody),
				hasMore,
				...(hasMore && lastVisible ? { nextBefore: String(lastVisible.seq) } : {}),
				limit: parsed.value.limit,
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
				modelProvider: parsed.value!.modelProvider,
				modelId: parsed.value!.modelId,
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
				...(body.modelProvider !== undefined ? { modelProvider: parsed.value!.modelProvider } : {}),
				...(body.modelId !== undefined ? { modelId: parsed.value!.modelId } : {}),
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
