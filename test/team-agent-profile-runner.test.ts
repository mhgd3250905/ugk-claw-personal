import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AgentProfileRoleRunner } from "../src/team/agent-profile-role-runner.js";
import type { TeamRoleRunner } from "../src/team/role-runner.js";
import type { BackgroundAgentSessionFactory } from "../src/agent/background-agent-runner.js";

function makeFakeSessionFactory(responses: string[]): BackgroundAgentSessionFactory {
	let callIndex = 0;
	return {
		createSession: async () => {
			const content = responses[callIndex] ?? "ok";
			callIndex++;
			const messages = [
				{ role: "assistant", content: [{ type: "text", text: content }], stopReason: "end_turn" },
			];
			return {
				prompt: async () => {},
				subscribe: () => () => {},
				messages,
			};
		},
	} as unknown as BackgroundAgentSessionFactory;
}

const fakeProfileResolver = {
	resolve: async () => ({}),
};

test("AgentProfileRoleRunner runWorker returns content", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ap-runner-"));
	try {
		const runner: TeamRoleRunner = new AgentProfileRoleRunner({
			projectRoot: root,
			teamDataDir: root,
			watcherProfileId: "w",
			workerProfileId: "wo",
			checkerProfileId: "c",
			finalizerProfileId: "f",
			profileResolver: fakeProfileResolver as never,
			sessionFactory: makeFakeSessionFactory(["任务执行完毕"]),
		});

		const out = await runner.runWorker({
			runId: "run_test1",
			task: { id: "task_1", title: "测试任务", input: { text: "完成某事" }, acceptance: { rules: ["完成"] } },
			attemptId: "att_1",
			workDir: join(root, "work"),
			outputDir: join(root, "output"),
			acceptanceRules: ["完成"],
		});
		assert.equal(out.content, "任务执行完毕");
	} finally {
		await rm(root, { recursive: true }).catch(() => {});
	}
});

test("AgentProfileRoleRunner runChecker parses pass JSON", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ap-runner-"));
	try {
		const jsonOutput = JSON.stringify({ verdict: "pass", reason: "all good", resultContent: "accepted" });
		const runner: TeamRoleRunner = new AgentProfileRoleRunner({
			projectRoot: root,
			teamDataDir: root,
			watcherProfileId: "w",
			workerProfileId: "wo",
			checkerProfileId: "c",
			finalizerProfileId: "f",
			profileResolver: fakeProfileResolver as never,
			sessionFactory: makeFakeSessionFactory([jsonOutput]),
		});

		const out = await runner.runChecker({
			runId: "run_test2",
			task: { id: "task_1", title: "测试", input: { text: "do" }, acceptance: { rules: ["r1"] } },
			attemptId: "att_1",
			workerOutputRef: "output/worker-1.md",
			acceptanceRules: ["r1"],
		});
		assert.equal(out.verdict, "pass");
		assert.equal(out.reason, "all good");
	} finally {
		await rm(root, { recursive: true }).catch(() => {});
	}
});

test("AgentProfileRoleRunner runChecker handles invalid JSON gracefully", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ap-runner-"));
	try {
		const runner: TeamRoleRunner = new AgentProfileRoleRunner({
			projectRoot: root,
			teamDataDir: root,
			watcherProfileId: "w",
			workerProfileId: "wo",
			checkerProfileId: "c",
			finalizerProfileId: "f",
			profileResolver: fakeProfileResolver as never,
			sessionFactory: makeFakeSessionFactory(["this is not json"]),
		});

		const out = await runner.runChecker({
			runId: "run_test3",
			task: { id: "task_1", title: "测试", input: { text: "do" }, acceptance: { rules: ["r1"] } },
			attemptId: "att_1",
			workerOutputRef: "output/worker-1.md",
			acceptanceRules: ["r1"],
		});
		assert.equal(out.verdict, "fail");
	} finally {
		await rm(root, { recursive: true }).catch(() => {});
	}
});

test("AgentProfileRoleRunner runWatcher parses accept_task JSON", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ap-runner-"));
	try {
		const jsonOutput = JSON.stringify({ decision: "accept_task", reason: "looks good" });
		const runner: TeamRoleRunner = new AgentProfileRoleRunner({
			projectRoot: root,
			teamDataDir: root,
			watcherProfileId: "w",
			workerProfileId: "wo",
			checkerProfileId: "c",
			finalizerProfileId: "f",
			profileResolver: fakeProfileResolver as never,
			sessionFactory: makeFakeSessionFactory([jsonOutput]),
		});

		const out = await runner.runWatcher({
			runId: "run_test4",
			task: { id: "task_1", title: "测试", input: { text: "do" }, acceptance: { rules: ["r1"] } },
			attemptId: "att_1",
			workUnitStatus: "passed",
			resultRef: "result/accepted-1.md",
			errorSummary: null,
		});
		assert.equal(out.decision, "accept_task");
	} finally {
		await rm(root, { recursive: true }).catch(() => {});
	}
});

test("AgentProfileRoleRunner runWatcher defaults to accept_task on parse error", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ap-runner-"));
	try {
		const runner: TeamRoleRunner = new AgentProfileRoleRunner({
			projectRoot: root,
			teamDataDir: root,
			watcherProfileId: "w",
			workerProfileId: "wo",
			checkerProfileId: "c",
			finalizerProfileId: "f",
			profileResolver: fakeProfileResolver as never,
			sessionFactory: makeFakeSessionFactory(["not json"]),
		});

		const out = await runner.runWatcher({
			runId: "run_test5",
			task: { id: "task_1", title: "测试", input: { text: "do" }, acceptance: { rules: ["r1"] } },
			attemptId: "att_1",
			workUnitStatus: "passed",
			resultRef: null,
			errorSummary: null,
		});
		assert.equal(out.decision, "accept_task");
	} finally {
		await rm(root, { recursive: true }).catch(() => {});
	}
});

test("AgentProfileRoleRunner runFinalizer returns final report", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-ap-runner-"));
	try {
		const report = "# 汇总报告\n\n全部完成。";
		const runner: TeamRoleRunner = new AgentProfileRoleRunner({
			projectRoot: root,
			teamDataDir: root,
			watcherProfileId: "w",
			workerProfileId: "wo",
			checkerProfileId: "c",
			finalizerProfileId: "f",
			profileResolver: fakeProfileResolver as never,
			sessionFactory: makeFakeSessionFactory([report]),
		});

		const out = await runner.runFinalizer({
			runId: "run_test6",
			plan: {
				schemaVersion: "team/plan-1",
				planId: "plan_1",
				title: "测试计划",
				defaultTeamUnitId: "tu_1",
				goal: { text: "目标" },
				tasks: [{ id: "task_1", title: "任务1", input: { text: "do" }, acceptance: { rules: ["r1"] } }],
				outputContract: { text: "输出" },
				runCount: 0,
				archived: false,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
			taskResults: [{ taskId: "task_1", status: "succeeded", resultRef: "r.md", errorSummary: null }],
		});
		assert.equal(out.finalReport, report);
	} finally {
		await rm(root, { recursive: true }).catch(() => {});
	}
});
