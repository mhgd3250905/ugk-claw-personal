import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { join } from "node:path";
import { TeamStore } from "../team/team-store.js";
import { TeamPipeline } from "../team/team-pipeline.js";
import { generateRunId } from "../team/run-id.js";
import type { CreateTeamRunInput, TeamRun } from "../team/types.js";
import type { NotificationHub } from "../agent/notification-hub.js";

interface TeamRouteDependencies {
  dataDir: string;
  notificationHub?: NotificationHub;
}

export function registerTeamRoutes(app: FastifyInstance, deps: TeamRouteDependencies): void {
  const store = new TeamStore(join(deps.dataDir, "team"));

  function makePipeline(): TeamPipeline {
    return new TeamPipeline(store, {
      onCompleted: (run) => {
        deps.notificationHub?.broadcast({
          source: "team-run",
          sourceId: run.runId,
          kind: "team_run_completed",
          title: `Team run completed: ${run.keyword}`,
          createdAt: new Date().toISOString(),
        });
      },
    });
  }

  app.post("/v1/team/runs", async (
    request: FastifyRequest<{ Body: CreateTeamRunInput; Querystring: { async?: string } }>,
    reply,
  ) => {
    const input = request.body;
    if (!input?.keyword || typeof input.keyword !== "string") {
      return reply.status(400).send({ error: "keyword is required" });
    }

    const isAsync = request.query.async === "true" || request.query.async === "1";
    const mode = input.mode ?? "real";
    const keyword = input.keyword;
    const now = new Date().toISOString();

    if (isAsync) {
      const run: TeamRun = {
        runId: generateRunId(),
        keyword,
        mode,
        status: "pending",
        roles: [],
        candidates: [],
        findings: [],
        queries: [`${keyword} official domain`, `${keyword} login`, `${keyword} portal`],
        completedQueries: [],
        startedAt: now,
      };
      store.createRun(run);
      return reply.status(202).send({ runId: run.runId, status: "pending" });
    }

    const pipeline = makePipeline();
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
