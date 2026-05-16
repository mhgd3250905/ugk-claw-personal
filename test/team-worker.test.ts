import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTeamWorkerRoleRunner } from "../src/workers/team-worker.js";
import { MockRoleRunner } from "../src/team/role-runner.js";
import type { BackgroundAgentSessionFactory } from "../src/agent/background-agent-runner.js";
import type { ResolvedBackgroundAgentSnapshot } from "../src/agent/background-agent-profile.js";

function makeConfig(root: string) {
	return {
		projectRoot: root,
		teamDataDir: root,
	} as ReturnType<typeof import("../src/config.js").getAppConfig>;
}

function makeProfileResolver(snapshot: Partial<ResolvedBackgroundAgentSnapshot>) {
	return {
		resolve: async (ref: { profileId: string }) => ({
			profileId: ref.profileId,
			profileVersion: "1",
			agentSpecId: "team-default",
			agentSpecVersion: "1",
			skillSetId: "team-default",
			skillSetVersion: "1",
			skills: [],
			modelPolicyId: "team-default",
			modelPolicyVersion: "1",
			provider: "test",
			model: "test-model",
			upgradePolicy: "latest" as const,
			resolvedAt: new Date().toISOString(),
			...snapshot,
		}),
	};
}

test("team worker uses mock runner unless real runner is explicitly enabled", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-worker-"));
	try {
		const runner = createTeamWorkerRoleRunner(makeConfig(root), {});
		assert.ok(runner instanceof MockRoleRunner);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("team worker real runner wires browser route and cleanup lifecycle", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-worker-"));
	try {
		const routeCalls: Array<{ scope: string; browserId: string | undefined }> = [];
		const cleanupCalls: Array<{ scope: string; options?: { browserId?: string } }> = [];
		const sessionScopes: string[] = [];
		const sessionFactory = {
			createSession: async (input: { browserScope?: string }) => {
				sessionScopes.push(input.browserScope ?? "");
				return {
					prompt: async () => {},
					subscribe: () => () => {},
					messages: [
						{ role: "assistant", content: [{ type: "text", text: "done" }], stopReason: "end_turn" },
					],
				};
			},
		} as unknown as BackgroundAgentSessionFactory;

		const runner = createTeamWorkerRoleRunner(
			makeConfig(root),
			{ TEAM_USE_MOCK_RUNNER: "false" },
			{
				profileResolver: makeProfileResolver({ defaultBrowserId: "work-01" }) as never,
				sessionFactory,
				setBrowserScopeRoute: async (scope, browserId) => { routeCalls.push({ scope, browserId }); },
				closeBrowserTargetsForScope: async (scope, options) => { cleanupCalls.push({ scope, options }); },
			},
		);

		const out = await runner.runWorker({
			runId: "run_worker_1",
			task: { id: "task_1", title: "t", input: { text: "do" }, acceptance: { rules: ["r1"] } },
			attemptId: "attempt_1",
			workDir: join(root, "work"),
			outputDir: join(root, "output"),
			acceptanceRules: ["r1"],
		});

		assert.equal(out.content, "done");
		assert.equal(sessionScopes.length, 1);
		const scope = sessionScopes[0]!;
		assert.ok(scope);
		assert.deepEqual(routeCalls, [
			{ scope, browserId: "work-01" },
			{ scope, browserId: undefined },
		]);
		assert.deepEqual(cleanupCalls, [
			{ scope, options: { browserId: "work-01" } },
		]);
		assert.equal(out.runtimeContext?.browserScope, scope);
		assert.equal(out.runtimeContext?.browserId, "work-01");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
