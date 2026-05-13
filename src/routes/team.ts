import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { join } from "node:path";
import { TeamStore } from "../team/team-store.js";
import { TeamPipeline } from "../team/team-pipeline.js";
import type { CreateTeamRunInput } from "../team/types.js";

interface TeamRouteDependencies {
  dataDir: string;
}

export function registerTeamRoutes(app: FastifyInstance, deps: TeamRouteDependencies): void {
  const store = new TeamStore(join(deps.dataDir, "team"));

  app.post("/v1/team/runs", async (
    request: FastifyRequest<{ Body: CreateTeamRunInput }>,
    reply,
  ) => {
    const input = request.body;
    if (!input?.keyword || typeof input.keyword !== "string") {
      return reply.status(400).send({ error: "keyword is required" });
    }

    const pipeline = new TeamPipeline(store);
    const { run } = await pipeline.execute(input);
    return reply.status(201).send({ runId: run.runId, status: run.status });
  });

  app.get("/v1/team/runs", async () => {
    return store.listRuns();
  });

  app.get("/v1/team/runs/:runId", async (
    request: FastifyRequest<{ Params: { runId: string } }>,
    reply,
  ) => {
    const { runId } = request.params;
    try {
      const run = store.readRun(runId);
      return run;
    } catch {
      return reply.status(404).send({ error: "run not found" });
    }
  });

  app.get("/v1/team/runs/:runId/report", async (
    request: FastifyRequest<{ Params: { runId: string } }>,
    reply,
  ) => {
    const { runId } = request.params;
    try {
      const report = store.readArtifact(runId, "final_report.md");
      return reply.type("text/markdown").send(report);
    } catch {
      return reply.status(404).send({ error: "report not found" });
    }
  });
}
