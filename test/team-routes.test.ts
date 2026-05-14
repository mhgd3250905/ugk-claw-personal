import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerTeamRoutes } from "../src/routes/team.js";

function makeDir(): string {
  return join(tmpdir(), `team-routes-test-${Date.now()}`);
}

describe("Team API routes", () => {
  let app: FastifyInstance;
  let dir: string;

  beforeEach(async () => {
    dir = makeDir();
    mkdirSync(dir, { recursive: true });
    app = Fastify();
    registerTeamRoutes(app, { dataDir: dir });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("POST /v1/team/runs returns 400 for missing keyword", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/team/runs",
      payload: {},
    });
    assert.equal(res.statusCode, 400);
    assert.ok(res.json().error.includes("keyword"));
  });

  it("POST /v1/team/runs?async=true creates pending run", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/team/runs?async=true",
      payload: { keyword: "TEST" },
    });
    assert.equal(res.statusCode, 202);
    const body = res.json();
    assert.equal(body.status, "pending");
    assert.ok(body.runId);
  });

  it("GET /v1/team/runs returns empty list initially", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/team/runs",
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), []);
  });

  it("GET /v1/team/runs/:runId returns 404 for missing run", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/team/runs/nonexistent",
    });
    assert.equal(res.statusCode, 404);
  });

  it("GET /v1/team/runs/:runId/report returns 404 for missing report", async () => {
    // Create a pending run first
    const createRes = await app.inject({
      method: "POST",
      url: "/v1/team/runs?async=true",
      payload: { keyword: "TEST" },
    });
    const { runId } = createRes.json();

    const res = await app.inject({
      method: "GET",
      url: `/v1/team/runs/${runId}/report`,
    });
    assert.equal(res.statusCode, 404);
  });

  it("GET /v1/team/runs lists created runs", async () => {
    await app.inject({
      method: "POST",
      url: "/v1/team/runs?async=true",
      payload: { keyword: "ALPHA" },
    });
    await app.inject({
      method: "POST",
      url: "/v1/team/runs?async=true",
      payload: { keyword: "BETA" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/v1/team/runs",
    });
    assert.equal(res.statusCode, 200);
    const list = res.json();
    assert.equal(list.length, 2);
    assert.equal(list[0].keyword, "BETA"); // newest first
  });

  it("GET /v1/team/runs/:runId returns run details", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/v1/team/runs?async=true",
      payload: { keyword: "TEST" },
    });
    const { runId } = createRes.json();

    const res = await app.inject({
      method: "GET",
      url: `/v1/team/runs/${runId}`,
    });
    assert.equal(res.statusCode, 200);
    const run = res.json();
    assert.equal(run.runId, runId);
    assert.equal(run.keyword, "TEST");
    assert.equal(run.status, "pending");
  });
});
