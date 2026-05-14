import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerTeamRoutes } from "../src/routes/team.js";

describe("team routes", () => {
	it("lists registered team templates for clients", async () => {
		const dir = join(tmpdir(), `team-routes-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		const app = Fastify({ logger: false });
		try {
			registerTeamRoutes(app, { teamDataDir: dir });

			const response = await app.inject({
				method: "GET",
				url: "/v1/team/templates",
			});

			assert.equal(response.statusCode, 200);
			const body = response.json() as { templates: Array<{ templateId: string; title: string; inputSchema: { required: string[] } }> };
			assert.deepEqual(body.templates.map((template) => template.templateId), [
				"brand_domain_discovery",
				"competitor_domain_discovery",
			]);
			assert.equal(body.templates[0].title, "Brand Domain Discovery");
			assert.equal(body.templates[0].inputSchema.required.includes("keyword"), true);
		} finally {
			await app.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns a single team template by id", async () => {
		const dir = join(tmpdir(), `team-routes-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		const app = Fastify({ logger: false });
		try {
			registerTeamRoutes(app, { teamDataDir: dir });

			const response = await app.inject({
				method: "GET",
				url: "/v1/team/templates/competitor_domain_discovery",
			});

			assert.equal(response.statusCode, 200);
			const body = response.json() as { template: { templateId: string; inputSchema: { properties: Record<string, { label: string }> } } };
			assert.equal(body.template.templateId, "competitor_domain_discovery");
			assert.equal(body.template.inputSchema.properties.keyword.label, "Research topic");
		} finally {
			await app.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns 404 for unknown team template metadata", async () => {
		const dir = join(tmpdir(), `team-routes-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		const app = Fastify({ logger: false });
		try {
			registerTeamRoutes(app, { teamDataDir: dir });

			const response = await app.inject({
				method: "GET",
				url: "/v1/team/templates/unknown_template",
			});

			assert.equal(response.statusCode, 404);
			assert.deepEqual(response.json(), { error: "team template not found: unknown_template" });
		} finally {
			await app.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("creates a brand domain discovery run through the existing POST /v1/team/runs API", async () => {
		const dir = join(tmpdir(), `team-routes-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		const app = Fastify({ logger: false });
		try {
			registerTeamRoutes(app, { teamDataDir: dir });

			const response = await app.inject({
				method: "POST",
				url: "/v1/team/runs",
				payload: { keyword: "Medtrum", companyNames: ["上海移宇科技"], maxRounds: 1 },
			});

			assert.equal(response.statusCode, 201);
			const body = response.json() as { teamRunId: string; status: string; plan: { templateId: string } };
			assert.ok(body.teamRunId);
			assert.equal(body.status, "queued");
			assert.equal(body.plan.templateId, "brand_domain_discovery");
		} finally {
			await app.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("creates a competitor domain discovery run when templateId is provided", async () => {
		const dir = join(tmpdir(), `team-routes-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		const app = Fastify({ logger: false });
		try {
			registerTeamRoutes(app, { teamDataDir: dir });

			const response = await app.inject({
				method: "POST",
				url: "/v1/team/runs",
				payload: {
					templateId: "competitor_domain_discovery",
					keyword: "Medtrum",
					companyNames: ["Dexcom", "Abbott"],
					maxRounds: 1,
				},
			});

			assert.equal(response.statusCode, 201);
			const body = response.json() as { teamRunId: string; status: string; plan: { templateId: string; goal: string } };
			assert.ok(body.teamRunId);
			assert.equal(body.status, "queued");
			assert.equal(body.plan.templateId, "competitor_domain_discovery");
			assert.match(body.plan.goal, /competitor/i);
		} finally {
			await app.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("lists all team runs for the standalone workbench without changing the default runnable list", async () => {
		const dir = join(tmpdir(), `team-routes-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		const app = Fastify({ logger: false });
		try {
			registerTeamRoutes(app, { teamDataDir: dir });

			const created = await app.inject({
				method: "POST",
				url: "/v1/team/runs",
				payload: { keyword: "Medtrum", maxRounds: 1 },
			});
			const teamRunId = (created.json() as { teamRunId: string }).teamRunId;

			const defaultList = await app.inject({
				method: "GET",
				url: "/v1/team/runs",
			});
			assert.deepEqual(defaultList.json(), [teamRunId]);

			const statePath = join(dir, "runs", teamRunId, "state.json");
			const state = JSON.parse(readFileSync(statePath, "utf-8")) as { status: string; updatedAt: string; finishedAt?: string };
			state.status = "completed";
			state.finishedAt = "2026-05-14T00:00:00.000Z";
			state.updatedAt = "2026-05-14T00:00:00.000Z";
			writeFileSync(statePath, JSON.stringify(state, null, 2));

			const runnableAfterCompletion = await app.inject({
				method: "GET",
				url: "/v1/team/runs",
			});
			assert.deepEqual(runnableAfterCompletion.json(), []);

			const allRuns = await app.inject({
				method: "GET",
				url: "/v1/team/runs?scope=all",
			});
			assert.deepEqual(allRuns.json(), { runIds: [teamRunId] });
		} finally {
			await app.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("rejects unknown team templates", async () => {
		const dir = join(tmpdir(), `team-routes-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		const app = Fastify({ logger: false });
		try {
			registerTeamRoutes(app, { teamDataDir: dir });

			const response = await app.inject({
				method: "POST",
				url: "/v1/team/runs",
				payload: { templateId: "unknown_template", keyword: "Medtrum" },
			});

			assert.equal(response.statusCode, 400);
			assert.deepEqual(response.json(), { error: "unknown team template: unknown_template" });
		} finally {
			await app.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
