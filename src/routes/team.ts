import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { TeamWorkspace } from "../team/team-workspace.js";
import { createBrandDomainDiscoveryPlan } from "../team/team-plan-brand-domain.js";
import { generateTeamEventId } from "../team/team-id.js";
import type { CreateBrandDomainDiscoveryPlanInput } from "../team/types.js";

interface TeamRouteDependencies {
	teamDataDir: string;
}

export function registerTeamRoutes(app: FastifyInstance, deps: TeamRouteDependencies): void {
	const workspace = new TeamWorkspace({ teamDataDir: deps.teamDataDir });

	app.get("/v1/team/healthz", async () => {
		return { ok: true, module: "team-runtime" };
	});

	app.post("/v1/team/runs", async (
		request: FastifyRequest<{ Body: CreateBrandDomainDiscoveryPlanInput }>,
		reply: FastifyReply,
	) => {
		const input = request.body;
		if (!input?.keyword || typeof input.keyword !== "string") {
			return reply.status(400).send({ error: "keyword is required" });
		}

		const { plan, state } = createBrandDomainDiscoveryPlan(input);
		await workspace.createRun({ teamRunId: state.teamRunId, plan, state });

		await workspace.appendEvent(state.teamRunId, {
			eventId: generateTeamEventId(),
			teamRunId: state.teamRunId,
			eventType: "team_run_created",
			createdAt: new Date().toISOString(),
			data: { keyword: input.keyword },
		});

		return reply.status(201).send({
			teamRunId: state.teamRunId,
			status: state.status,
			plan,
		});
	});

	app.get("/v1/team/runs", async () => {
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
