import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { TeamWorkspace } from "../team/team-workspace.js";
import { generateTeamEventId } from "../team/team-id.js";
import { configureSseResponse, endSseResponse, startSseHeartbeat } from "./chat-sse.js";
import type { CreateBrandDomainDiscoveryPlanInput, TeamTemplateId } from "../team/types.js";
import {
	createDefaultTeamTemplateRegistry,
	type TeamTemplateRegistry,
} from "../team/team-template-registry.js";

interface TeamRouteDependencies {
	teamDataDir: string;
	templateRegistry?: TeamTemplateRegistry;
}

export function registerTeamRoutes(app: FastifyInstance, deps: TeamRouteDependencies): void {
	const workspace = new TeamWorkspace({ teamDataDir: deps.teamDataDir });
	const templateRegistry = deps.templateRegistry ?? createDefaultTeamTemplateRegistry();

	app.get("/v1/team/healthz", async () => {
		return { ok: true, module: "team-runtime" };
	});

	app.get("/v1/team/templates", async () => {
		return { templates: templateRegistry.list() };
	});

	app.get("/v1/team/templates/:templateId", async (
		request: FastifyRequest<{ Params: { templateId: string } }>,
		reply: FastifyReply,
	) => {
		const { templateId } = request.params;
		try {
			return { template: templateRegistry.get(templateId).metadata };
		} catch {
			return reply.status(404).send({ error: `team template not found: ${templateId}` });
		}
	});

	app.post("/v1/team/runs", async (
		request: FastifyRequest<{ Body: CreateBrandDomainDiscoveryPlanInput }>,
		reply: FastifyReply,
	) => {
		const input = request.body;
		if (!input?.keyword || typeof input.keyword !== "string") {
			return reply.status(400).send({ error: "keyword is required" });
		}

		const templateId = input.templateId ?? "brand_domain_discovery";
		let template;
		try {
			template = templateRegistry.get(templateId as TeamTemplateId);
		} catch {
			return reply.status(400).send({ error: `unknown team template: ${templateId}` });
		}

		const { plan, state } = template.createRun(input);
		await workspace.createRun({ teamRunId: state.teamRunId, plan, state });

		await workspace.appendEvent(state.teamRunId, {
			eventId: generateTeamEventId(),
			teamRunId: state.teamRunId,
			eventType: "team_run_created",
			createdAt: new Date().toISOString(),
			data: { keyword: input.keyword, templateId: plan.templateId },
		});

		return reply.status(201).send({
			teamRunId: state.teamRunId,
			status: state.status,
			plan,
		});
	});

	app.get("/v1/team/runs", async (
		request: FastifyRequest<{ Querystring: { scope?: string } }>,
	) => {
		if (request.query.scope === "all") {
			return { runIds: await workspace.listRunIds() };
		}
		return workspace.listRunnableRunIds();
	});

	app.get("/v1/team/runs/:teamRunId", async (
		request: FastifyRequest<{ Params: { teamRunId: string } }>,
		reply: FastifyReply,
	) => {
		const { teamRunId } = request.params;
		try {
			const [state, plan] = await Promise.all([
				workspace.readState(teamRunId),
				workspace.readPlan(teamRunId),
			]);
			return { state, plan };
		} catch {
			return reply.status(404).send({ error: "run not found" });
		}
	});

	app.get("/v1/team/runs/:teamRunId/events", async (
		request: FastifyRequest<{ Params: { teamRunId: string } }>,
		reply: FastifyReply,
	) => {
		const { teamRunId } = request.params;
		try {
			const events = await workspace.readEvents(teamRunId);
			return { events };
		} catch {
			return reply.status(404).send({ error: "run not found" });
		}
	});

	app.get("/v1/team/runs/:teamRunId/events/stream", async (
		request: FastifyRequest<{ Params: { teamRunId: string } }>,
		reply: FastifyReply,
	): Promise<void | FastifyReply> => {
		const { teamRunId } = request.params;
		try {
			await workspace.readState(teamRunId);
		} catch {
			return reply.status(404).send({ error: "run not found" });
		}

		const initialEvents = await workspace.readEvents(teamRunId);
		let sentCount = initialEvents.length;
		let closed = false;

		reply.hijack();
		configureSseResponse(reply.raw);
		reply.raw.write(": connected\n\n");
		const heartbeat = startSseHeartbeat(reply.raw);

		const closeStream = () => {
			if (closed) return;
			closed = true;
			clearInterval(timer);
			heartbeat.stop();
			endSseResponse(reply.raw);
		};

		const pollEvents = async () => {
			if (closed || reply.raw.destroyed || reply.raw.writableEnded) return;
			try {
				const events = await workspace.readEvents(teamRunId);
				for (const event of events.slice(sentCount)) {
					if (reply.raw.destroyed || reply.raw.writableEnded) break;
					reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
				}
				sentCount = events.length;
			} catch (err) {
				if (!reply.raw.destroyed && !reply.raw.writableEnded) {
					reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
				}
				closeStream();
			}
		};

		const timer = setInterval(() => {
			void pollEvents();
		}, 250);
		timer.unref?.();
		request.raw.on("close", closeStream);
	});

	app.get("/v1/team/runs/:teamRunId/streams/:streamName", async (
		request: FastifyRequest<{ Params: { teamRunId: string; streamName: string } }>,
		reply: FastifyReply,
	) => {
		const { teamRunId, streamName } = request.params;
		const validStreams = ["candidate_domains", "domain_evidence", "domain_classifications", "review_findings"];
		if (!validStreams.includes(streamName)) {
			return reply.status(400).send({ error: `invalid streamName: ${streamName}` });
		}
		try {
			const items = await workspace.readStreamItems(teamRunId, streamName as any);
			return { items };
		} catch {
			return reply.status(404).send({ error: "run not found" });
		}
	});

	app.get("/v1/team/runs/:teamRunId/artifacts/:artifactName", async (
		request: FastifyRequest<{ Params: { teamRunId: string; artifactName: string } }>,
		reply: FastifyReply,
	) => {
		const { teamRunId, artifactName } = request.params;
		try {
			const text = await workspace.readArtifactText(teamRunId, artifactName);
			if (artifactName.endsWith(".md")) {
				return reply.type("text/markdown").send(text);
			}
			return reply.type("application/json").send(text);
		} catch (err: any) {
			if (err.message?.includes("path traversal")) {
				return reply.status(400).send({ error: "invalid artifact name" });
			}
			return reply.status(404).send({ error: "artifact not found" });
		}
	});
}
