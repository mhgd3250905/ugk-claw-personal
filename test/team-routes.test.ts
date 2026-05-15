import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
			const body = response.json() as { templates: Array<{ templateId: string; title: string; roles: Array<{ roleId: string }>; inputSchema: { required: string[] } }> };
			assert.deepEqual(body.templates.map((template) => template.templateId), [
				"brand_domain_discovery",
				"competitor_domain_discovery",
			]);
			assert.equal(body.templates[0].title, "Brand Domain Discovery");
			assert.deepEqual(body.templates[0].roles.map((role) => role.roleId), [
				"discovery",
				"evidence_collector",
				"classifier",
				"reviewer",
				"finalizer",
			]);
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
			const body = response.json() as { template: { templateId: string; roles: Array<{ roleId: string }>; inputSchema: { properties: Record<string, { label: string }> } } };
			assert.equal(body.template.templateId, "competitor_domain_discovery");
			assert.equal(body.template.inputSchema.properties.keyword.label, "Research topic");
			assert.equal(body.template.roles.some((role) => role.roleId === "discovery"), true);
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

	it("persists role profile bindings when creating a team run", async () => {
		const dir = join(tmpdir(), `team-routes-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		const app = Fastify({ logger: false });
		try {
			registerTeamRoutes(app, { teamDataDir: dir });

			const response = await app.inject({
				method: "POST",
				url: "/v1/team/runs",
				payload: {
					keyword: "Medtrum",
					maxRounds: 1,
					roleProfileIds: {
						discovery: "TeamAgent",
						evidence_collector: "EvidenceAgent",
					},
				},
			});

			assert.equal(response.statusCode, 201);
			const body = response.json() as { teamRunId: string };
			const state = JSON.parse(readFileSync(join(dir, "runs", body.teamRunId, "state.json"), "utf-8")) as {
				roleProfileIds?: Record<string, string>;
			};
			const events = readFileSync(join(dir, "runs", body.teamRunId, "events.jsonl"), "utf-8")
				.trim()
				.split("\n")
				.map((line) => JSON.parse(line)) as Array<{ data?: { roleProfileIds?: Record<string, string> } }>;
			assert.deepEqual(state.roleProfileIds, {
				discovery: "TeamAgent",
				evidence_collector: "EvidenceAgent",
			});
			assert.deepEqual(events[0].data?.roleProfileIds, state.roleProfileIds);
		} finally {
			await app.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("persists editable role prompt overrides when creating a team run", async () => {
		const dir = join(tmpdir(), `team-routes-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		const app = Fastify({ logger: false });
		try {
			registerTeamRoutes(app, { teamDataDir: dir });

			const response = await app.inject({
				method: "POST",
				url: "/v1/team/runs",
				payload: {
					keyword: "Medtrum",
					maxRounds: 1,
					rolePromptOverrides: {
						discovery: "优先使用浏览器和搜索引擎交叉找域名。",
						evidence_collector: "每个域名查完马上提交 evidence。",
						not_a_role: "ignore me",
						classifier: "",
					},
				},
			});

			assert.equal(response.statusCode, 201);
			const body = response.json() as { teamRunId: string };
			const state = JSON.parse(readFileSync(join(dir, "runs", body.teamRunId, "state.json"), "utf-8")) as {
				rolePromptOverrides?: Record<string, string>;
			};
			const events = readFileSync(join(dir, "runs", body.teamRunId, "events.jsonl"), "utf-8")
				.trim()
				.split("\n")
				.map((line) => JSON.parse(line)) as Array<{ data?: { rolePromptOverrides?: Record<string, string> } }>;
			assert.deepEqual(state.rolePromptOverrides, {
				discovery: "优先使用浏览器和搜索引擎交叉找域名。",
				evidence_collector: "每个域名查完马上提交 evidence。",
			});
			assert.deepEqual(events[0].data?.rolePromptOverrides, state.rolePromptOverrides);
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

	it("streams live team run events from events.jsonl", async () => {
		const dir = join(tmpdir(), `team-routes-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		const app = Fastify({ logger: false });
		const abort = new AbortController();
		try {
			registerTeamRoutes(app, { teamDataDir: dir });
			await app.listen({ port: 0, host: "127.0.0.1" });
			const address = app.server.address();
			assert.ok(address && typeof address === "object");
			const baseUrl = `http://127.0.0.1:${address.port}`;

			const created = await fetch(`${baseUrl}/v1/team/runs`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ keyword: "Medtrum", maxRounds: 1 }),
			});
			assert.equal(created.status, 201);
			const teamRunId = ((await created.json()) as { teamRunId: string }).teamRunId;

			const streamResponse = await fetch(`${baseUrl}/v1/team/runs/${teamRunId}/events/stream`, {
				signal: abort.signal,
			});
			assert.equal(streamResponse.status, 200);
			assert.match(streamResponse.headers.get("content-type") ?? "", /text\/event-stream/);
			assert.ok(streamResponse.body);

			appendFileSync(join(dir, "runs", teamRunId, "events.jsonl"), JSON.stringify({
				eventId: "evt_live_test",
				teamRunId,
				eventType: "stream_item_accepted",
				createdAt: "2026-05-14T00:00:00.000Z",
				data: { itemId: "si_live_test", streamName: "candidate_domains" },
			}) + "\n");

			const reader = streamResponse.body.getReader();
			const decoder = new TextDecoder();
			let text = "";
			const deadline = Date.now() + 3000;
			while (!text.includes("stream_item_accepted") && Date.now() < deadline) {
				const chunk = await reader.read();
				if (chunk.done) break;
				text += decoder.decode(chunk.value, { stream: true });
			}

			assert.match(text, /data: /);
			assert.match(text, /stream_item_accepted/);
			assert.match(text, /si_live_test/);
			reader.releaseLock();
		} finally {
			abort.abort();
			await app.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns 404 when streaming events for an unknown run", async () => {
		const dir = join(tmpdir(), `team-routes-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		const app = Fastify({ logger: false });
		try {
			registerTeamRoutes(app, { teamDataDir: dir });

			const response = await app.inject({
				method: "GET",
				url: "/v1/team/runs/missing-run/events/stream",
			});

			assert.equal(response.statusCode, 404);
			assert.deepEqual(response.json(), { error: "run not found" });
		} finally {
			await app.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("cancels a queued team run via POST /v1/team/runs/:teamRunId/cancel", async () => {
		const dir = join(tmpdir(), `team-routes-cancel-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		const app = Fastify({ logger: false });
		try {
			registerTeamRoutes(app, { teamDataDir: dir });

			const created = await app.inject({
				method: "POST",
				url: "/v1/team/runs",
				payload: { keyword: "Medtrum", maxRounds: 1 },
			});
			assert.equal(created.statusCode, 201);
			const teamRunId = (created.json() as { teamRunId: string }).teamRunId;

			const cancelResponse = await app.inject({
				method: "POST",
				url: `/v1/team/runs/${teamRunId}/cancel`,
			});
			assert.equal(cancelResponse.statusCode, 200);
			const body = cancelResponse.json() as { state: { status: string; finishedAt: string; stopSignals: string[] } };
			assert.equal(body.state.status, "cancelled");
			assert.ok(body.state.finishedAt);
			assert.ok(body.state.stopSignals.some((s) => s.includes("cancelled by user")));

			const eventsRaw = readFileSync(join(dir, "runs", teamRunId, "events.jsonl"), "utf-8").trim();
			const events = eventsRaw.split("\n").map((line) => JSON.parse(line)) as Array<{ eventType: string }>;
			assert.ok(events.some((e) => e.eventType === "team_run_cancelled"));
		} finally {
			await app.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns 409 when cancelling a completed run", async () => {
		const dir = join(tmpdir(), `team-routes-cancel-409-${Date.now()}`);
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

			const statePath = join(dir, "runs", teamRunId, "state.json");
			const state = JSON.parse(readFileSync(statePath, "utf-8"));
			state.status = "completed";
			state.finishedAt = new Date().toISOString();
			writeFileSync(statePath, JSON.stringify(state, null, 2));

			const cancelResponse = await app.inject({
				method: "POST",
				url: `/v1/team/runs/${teamRunId}/cancel`,
			});
			assert.equal(cancelResponse.statusCode, 409);
		} finally {
			await app.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns 404 when cancelling a non-existent run", async () => {
		const dir = join(tmpdir(), `team-routes-cancel-404-${Date.now()}`);
		mkdirSync(dir, { recursive: true });
		const app = Fastify({ logger: false });
		try {
			registerTeamRoutes(app, { teamDataDir: dir });

			const cancelResponse = await app.inject({
				method: "POST",
				url: "/v1/team/runs/nonexistent/cancel",
			});
			assert.equal(cancelResponse.statusCode, 404);
		} finally {
			await app.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

});
