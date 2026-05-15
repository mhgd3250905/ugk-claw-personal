import test from "node:test";
import assert from "node:assert/strict";
import { MockRoleRunner } from "../src/team/role-runner.js";

test("MockRoleRunner defaults: worker returns task done, checker pass, watcher accept", async () => {
	const runner = new MockRoleRunner();
	const worker = await runner.runWorker({ runId: "r", task: { id: "t1", title: "t", input: { text: "x" }, acceptance: { rules: [] } }, attemptId: "a", workDir: "/w", outputDir: "/o", acceptanceRules: [] });
	assert.match(worker.content, /t1/);

	const checker = await runner.runChecker({ runId: "r", task: { id: "t1", title: "t", input: { text: "x" }, acceptance: { rules: [] } }, attemptId: "a", workerOutputRef: "ref", acceptanceRules: [] });
	assert.equal(checker.verdict, "pass");

	const watcher = await runner.runWatcher({ runId: "r", task: { id: "t1", title: "t", input: { text: "x" }, acceptance: { rules: [] } }, attemptId: "a", workUnitStatus: "passed", resultRef: "ref", errorSummary: null });
	assert.equal(watcher.decision, "accept_task");
});

test("MockRoleRunner custom outputs cycle through arrays", async () => {
	const runner = new MockRoleRunner({
		workerOutputs: ["first", "second"],
		checkerOutputs: [{ verdict: "revise", reason: "fix it" }, { verdict: "pass", reason: "ok", resultContent: "done" }],
	});
	const w1 = await runner.runWorker({ runId: "r", task: { id: "t1", title: "t", input: { text: "x" }, acceptance: { rules: [] } }, attemptId: "a", workDir: "/w", outputDir: "/o", acceptanceRules: [] });
	assert.equal(w1.content, "first");
	const w2 = await runner.runWorker({ runId: "r", task: { id: "t1", title: "t", input: { text: "x" }, acceptance: { rules: [] } }, attemptId: "a", workDir: "/w", outputDir: "/o", acceptanceRules: [] });
	assert.equal(w2.content, "second");

	const c1 = await runner.runChecker({ runId: "r", task: { id: "t1", title: "t", input: { text: "x" }, acceptance: { rules: [] } }, attemptId: "a", workerOutputRef: "ref", acceptanceRules: [] });
	assert.equal(c1.verdict, "revise");
	const c2 = await runner.runChecker({ runId: "r", task: { id: "t1", title: "t", input: { text: "x" }, acceptance: { rules: [] } }, attemptId: "a", workerOutputRef: "ref", acceptanceRules: [] });
	assert.equal(c2.verdict, "pass");
});

test("MockRoleRunner finalizer aggregates task results", async () => {
	const runner = new MockRoleRunner({ finalReport: "# Report" });
	const out = await runner.runFinalizer({
		runId: "r",
		plan: { schemaVersion: "team/plan-1", planId: "p", title: "t", defaultTeamUnitId: "tu", goal: { text: "g" }, tasks: [], outputContract: { text: "o" }, archived: false, createdAt: "", updatedAt: "", runCount: 0 },
		taskResults: [
			{ taskId: "t1", status: "succeeded", resultRef: "ref1", errorSummary: null },
			{ taskId: "t2", status: "failed", resultRef: null, errorSummary: "timeout" },
		],
	});
	assert.match(out.finalReport, /# Report/);
	assert.match(out.finalReport, /t1: succeeded/);
	assert.match(out.finalReport, /t2: failed/);
});

test("MockRoleRunner reset clears call indices", async () => {
	const runner = new MockRoleRunner({ workerOutputs: ["a", "b"] });
	await runner.runWorker({ runId: "r", task: { id: "t", title: "t", input: { text: "" }, acceptance: { rules: [] } }, attemptId: "a", workDir: "", outputDir: "", acceptanceRules: [] });
	runner.reset();
	const out = await runner.runWorker({ runId: "r", task: { id: "t", title: "t", input: { text: "" }, acceptance: { rules: [] } }, attemptId: "a", workDir: "", outputDir: "", acceptanceRules: [] });
	assert.equal(out.content, "a");
});
