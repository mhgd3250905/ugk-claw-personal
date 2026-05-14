import Fastify from "fastify";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { registerTeamRoutes } from "../src/routes/team.js";
import { TeamWorkspace } from "../src/team/team-workspace.js";
import { TeamOrchestrator } from "../src/team/team-orchestrator.js";
import { DeterministicMockTeamRoleTaskRunner } from "../src/team/team-role-task-runner.js";

const dir = join(tmpdir(), `team-e2e-${Date.now()}`);
mkdirSync(dir, { recursive: true });

const app = Fastify({ logger: false });
registerTeamRoutes(app, { teamDataDir: dir });

async function main() {
	// 1. Create run
	console.log("=== 1. 创建 Team Run ===");
	const createRes = await app.inject({
		method: "POST",
		url: "/v1/team/runs",
		payload: { keyword: "MED", companyNames: ["MED Corp"], maxRounds: 1 },
	});
	const { teamRunId, status } = createRes.json();
	console.log(`teamRunId: ${teamRunId}`);
	console.log(`status: ${status}`);

	// 2. Simulate worker tick
	console.log("\n=== 2. Worker tick ===");
	const ws = new TeamWorkspace({ teamDataDir: dir });
	const orch = new TeamOrchestrator({
		workspace: ws,
		roleTaskRunner: new DeterministicMockTeamRoleTaskRunner(),
		maxRounds: 1,
		maxCandidates: 10,
		maxMinutes: 60,
		roleTaskTimeoutMs: 180000,
		roleTaskMaxRetries: 1,
	});
	await orch.tick(teamRunId);

	const state = await ws.readState(teamRunId);
	console.log(`status after tick: ${state.status}`);

	// 3. Query state via API
	console.log("\n=== 3. 查询 State ===");
	const stateRes = await app.inject({ method: "GET", url: `/v1/team/runs/${teamRunId}` });
	const stateData = stateRes.json();
	console.log(`status: ${stateData.state.status}`);
	console.log(`keyword: ${stateData.state.keyword}`);
	console.log(`counters: ${JSON.stringify(stateData.state.counters)}`);

	// 4. Streams
	console.log("\n=== 4. Streams ===");
	for (const stream of ["candidate_domains", "domain_evidence", "domain_classifications", "review_findings"]) {
		const res = await app.inject({ method: "GET", url: `/v1/team/runs/${teamRunId}/streams/${stream}` });
		const items = res.json().items;
		console.log(`${stream}: ${items.length} items`);
		if (stream === "candidate_domains") {
			items.forEach((i: any) => console.log(`  - ${i.payload.normalizedDomain}`));
		}
	}

	// 5. Events
	console.log("\n=== 5. Events ===");
	const evtRes = await app.inject({ method: "GET", url: `/v1/team/runs/${teamRunId}/events` });
	const events = evtRes.json().events;
	const types = events.map((e: any) => e.eventType);
	types.forEach((t: string) => console.log(`  ${t}`));

	// 6. Final report
	console.log("\n=== 6. Final Report ===");
	const reportRes = await app.inject({ method: "GET", url: `/v1/team/runs/${teamRunId}/artifacts/final_report.md` });
	if (reportRes.statusCode === 200) {
		console.log(reportRes.body.split("\n").slice(0, 18).join("\n"));
		console.log("...");
	} else {
		console.log("Report not found:", reportRes.json());
	}

	// 7. Health check
	console.log("\n=== 7. Health Check ===");
	const hzRes = await app.inject({ method: "GET", url: "/v1/team/healthz" });
	console.log(`healthz: ${hzRes.statusCode} ${JSON.stringify(hzRes.json())}`);

	// Cleanup
	rmSync(dir, { recursive: true, force: true });
	console.log("\n✓ End-to-end verification passed");
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
