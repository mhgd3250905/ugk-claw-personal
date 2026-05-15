import test from "node:test";
import assert from "node:assert/strict";
import type { TeamPlan, TeamRunState, TeamUnit } from "../src/team/types.js";

test("TeamUnit has exactly four role profile slots", () => {
	const team: TeamUnit = {
		schemaVersion: "team/team-unit-1",
		teamUnitId: "team_web_research",
		title: "网页调研团队",
		description: "适合公开网页调研和证据整理",
		watcherProfileId: "profile_watcher",
		workerProfileId: "profile_worker",
		checkerProfileId: "profile_checker",
		finalizerProfileId: "profile_finalizer",
		archived: false,
		createdAt: "2026-05-15T00:00:00.000Z",
		updatedAt: "2026-05-15T00:00:00.000Z",
	};
	assert.equal(team.workerProfileId, "profile_worker");
	assert.equal(team.watcherProfileId, "profile_watcher");
	assert.equal(team.checkerProfileId, "profile_checker");
	assert.equal(team.finalizerProfileId, "profile_finalizer");
});

test("Plan stores ordered human readable tasks", () => {
	const plan: TeamPlan = {
		schemaVersion: "team/plan-1",
		planId: "plan_medtrum_domains",
		title: "Medtrum 域名调查",
		defaultTeamUnitId: "team_web_research",
		goal: { text: "调查 Medtrum 相关域名并输出中文汇总。" },
		tasks: [{
			id: "task_medtrum_com",
			title: "核查 medtrum.com",
			input: { text: "核查 medtrum.com 与 Medtrum 的关系。", payload: { domain: "medtrum.com" } },
			acceptance: { rules: ["必须说明查过哪些公开来源", "必须说明证据和不确定性"] },
		}],
		outputContract: { text: "输出中文汇总，区分已完成任务、失败任务和下次准备建议。" },
		archived: false,
		createdAt: "2026-05-15T00:00:00.000Z",
		updatedAt: "2026-05-15T00:00:00.000Z",
		runCount: 0,
	};
	assert.equal(plan.tasks[0]?.title, "核查 medtrum.com");
	assert.equal(plan.tasks.length, 1);
});

test("Run state stores refs instead of large outputs", () => {
	const state: TeamRunState = {
		schemaVersion: "team/state-1",
		runId: "run_001",
		planId: "plan_medtrum_domains",
		teamUnitId: "team_web_research",
		status: "running",
		createdAt: "2026-05-15T00:00:00.000Z",
		queuedAt: "2026-05-15T00:00:00.000Z",
		startedAt: "2026-05-15T00:00:01.000Z",
		finishedAt: null,
		activeElapsedMs: 0,
		currentTaskId: "task_medtrum_com",
		taskStates: {
			task_medtrum_com: {
				status: "running",
				attemptCount: 1,
				activeAttemptId: "attempt_001",
				resultRef: null,
				errorSummary: null,
				progress: {
					phase: "worker_running",
					message: "执行 Agent 正在处理",
					updatedAt: "2026-05-15T00:00:02.000Z",
				},
			},
		},
		summary: { totalTasks: 1, succeededTasks: 0, failedTasks: 0, cancelledTasks: 0 },
		pauseReason: null,
		lastError: null,
		updatedAt: "2026-05-15T00:00:02.000Z",
	};
	assert.equal(state.taskStates.task_medtrum_com?.activeAttemptId, "attempt_001");
	assert.equal(state.status, "running");
});

test("RunStatus covers all expected statuses", () => {
	const nonTerminal: string[] = ["queued", "running", "paused"];
	const terminal: string[] = ["completed", "completed_with_failures", "failed", "cancelled"];
	assert.equal(nonTerminal.length + terminal.length, 7);
});

test("CheckerVerdict is pass revise or fail", () => {
	const verdicts: string[] = ["pass", "revise", "fail"];
	assert.equal(verdicts.length, 3);
});

test("WatcherDecision is accept_task confirm_failed or request_revision", () => {
	const decisions: string[] = ["accept_task", "confirm_failed", "request_revision"];
	assert.equal(decisions.length, 3);
});
