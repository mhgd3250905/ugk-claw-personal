import test from "node:test";
import assert from "node:assert/strict";
import { renderTeamPage } from "../src/ui/team-page.js";

test("team page contains Chinese labels", () => {
	const html = renderTeamPage();
	assert.match(html, /计划/);
	assert.match(html, /预设团队/);
	assert.match(html, /运行记录/);
	assert.match(html, /任务/);
	assert.match(html, /执行 Agent/);
	assert.match(html, /验收 Agent/);
	assert.match(html, /复盘 Agent/);
	assert.match(html, /汇总 Agent/);
});

test("team page references /v1/team API", () => {
	const html = renderTeamPage();
	assert.match(html, /\/v1\/team/);
});

test("team page inline scripts are valid JavaScript", () => {
	const html = renderTeamPage();
	const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
	assert.ok(scripts.length > 0);
	for (const script of scripts) {
		assert.doesNotThrow(() => new Function(script));
	}
});

test("team page has plan, team, run sections", () => {
	const html = renderTeamPage();
	assert.match(html, /section-plans/);
	assert.match(html, /section-teams/);
	assert.match(html, /section-runs/);
});

test("team page escapes dynamic API values before inserting HTML", () => {
	const html = renderTeamPage();
	assert.match(html, /escapeHtml\(p\.title\)/);
	assert.match(html, /escapeHtml\(p\.goal\.text\)/);
	assert.match(html, /escapeHtml\(t\.title\)/);
	assert.match(html, /escapeHtml\(text\)/);
});

test("team page exposes pause resume controls and timing panel labels", () => {
	const html = renderTeamPage();
	assert.match(html, /暂停/);
	assert.match(html, /恢复/);
	assert.match(html, /任务进度/);
	assert.match(html, /耗时/);
});

test("team page has refresh button for runs", () => {
	const html = renderTeamPage();
	assert.match(html, /刷新/);
	assert.match(html, /refresh-btn/);
});

test("team page has expandable task detail toggle", () => {
	const html = renderTeamPage();
	assert.match(html, /toggleRunDetail/);
	assert.match(html, /run-detail-/);
	assert.match(html, /展开任务详情/);
});

test("team page renders task detail fields", () => {
	const html = renderTeamPage();
	assert.match(html, /renderTaskDetail/);
	assert.match(html, /task\.title/);
	assert.match(html, /ts\.status/);
	assert.match(html, /ts\.progress/);
	assert.match(html, /ts\.resultRef/);
	assert.match(html, /ts\.errorSummary/);
	assert.match(html, /ts\.attemptCount/);
	assert.match(html, /ts\.activeAttemptId/);
});

test("team page escapes run dynamic fields", () => {
	const html = renderTeamPage();
	assert.match(html, /escapeHtml\(r\.runId/);
	assert.match(html, /escapeHtml\(r\.lastError\)/);
	assert.match(html, /escapeHtml\(currentTaskTitle\)/);
});

test("team page escapes task detail dynamic fields", () => {
	const html = renderTeamPage();
	assert.match(html, /escapeHtml\(task\.title\)/);
	assert.match(html, /phaseLabel\(ts\.progress\.phase\)/);
	assert.match(html, /escapeHtml\(ts\.progress\.message\)/);
	assert.match(html, /escapeHtml\(ts\.resultRef\)/);
	assert.match(html, /escapeHtml\(ts\.errorSummary\)/);
	assert.match(html, /escapeHtml\(ts\.activeAttemptId/);
});

test("team page shows view report button for terminal runs", () => {
	const html = renderTeamPage();
	assert.match(html, /查看报告/);
	assert.match(html, /viewReport/);
});

test("team page shows delete button for cancelled runs", () => {
	const html = renderTeamPage();
	assert.match(html, /status === 'cancelled'/);
	assert.match(html, /deleteRun/);
});

test("team page has final report endpoint handler", () => {
	const html = renderTeamPage();
	assert.match(html, /final-report/);
	assert.match(html, /报告未找到/);
});

test("team page contains SSE/EventSource logic", () => {
	const html = renderTeamPage();
	assert.match(html, /EventSource/);
	assert.match(html, /subscribeRunSSE/);
	assert.match(html, /updateRunCard/);
	assert.match(html, /_sseConnections/);
});

test("team page SSE subscribes to active runs and unsubscribes terminal", () => {
	const html = renderTeamPage();
	assert.match(html, /subscribeActiveRuns/);
	assert.match(html, /unsubscribeRunSSE/);
	assert.match(html, /unsubscribeAllSSE/);
});

test("team page SSE updates run card elements by class", () => {
	const html = renderTeamPage();
	assert.match(html, /run-badge/);
	assert.match(html, /run-progress/);
	assert.match(html, /run-elapsed/);
	assert.match(html, /run-current/);
	assert.match(html, /run-error/);
});

test("team page run cards have data-run-id attribute", () => {
	const html = renderTeamPage();
	assert.match(html, /data-run-id/);
});

test("team page fetches attempts for task detail", () => {
	const html = renderTeamPage();
	assert.match(html, /\/attempts/);
	assert.match(html, /attemptsMap/);
});

test("team page renderTaskDetail accepts attemptsMap parameter", () => {
	const html = renderTeamPage();
	assert.match(html, /renderTaskDetail\(state,\s*plan,\s*attemptsMap\)/);
});

test("team page inline scripts are still valid JavaScript with SSE", () => {
	const html = renderTeamPage();
	const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
	assert.ok(scripts.length > 0);
	for (const script of scripts) {
		assert.doesNotThrow(() => new Function(script), "inline script should be valid JS");
	}
});

// ── Behavioral tests: extract and execute inline functions ──

function extractScript(): string {
	const html = renderTeamPage();
	const match = html.match(/<script>([\s\S]*?)<\/script>/);
	assert.ok(match, "should have inline script");
	return match[1];
}

function makeDomLike() {
	const elements: Record<string, { innerHTML: string; textContent: string; style: Record<string, string>; classList: { add: () => void; remove: () => void } }> = {};
	return {
		document: {
			querySelector: (sel: string) => {
				if (sel.startsWith("[data-run-id=")) return null;
				return elements[sel] ?? null;
			},
			querySelectorAll: () => [],
			getElementById: (id: string) => elements["#" + id] ?? null,
			createElement: () => ({ appendChild: () => {} }),
		},
		window: {},
		elements,
	};
}

test("behavioral: loadRuns calls subscribeActiveRuns(runs) after rendering", () => {
	const script = extractScript();
	// Verify the function body: loadRuns should end with subscribeActiveRuns(runs)
	// Extract the loadRuns function
	const loadRunsMatch = script.match(/async function loadRuns\(\)[\s\S]*?^[\t]}/m);
	assert.ok(loadRunsMatch, "should find loadRuns function");
	const body = loadRunsMatch[0];
	assert.match(body, /subscribeActiveRuns\(runs\)/, "loadRuns must call subscribeActiveRuns(runs)");
	// Verify it's AFTER the join (i.e. after rendering)
	const joinIdx = body.indexOf("}).join('')");
	const subscribeIdx = body.indexOf("subscribeActiveRuns(runs)");
	assert.ok(subscribeIdx > joinIdx, "subscribeActiveRuns must come after join (rendering)");
});

test("behavioral: loadRuns calls unsubscribeAllSSE() when runs is empty", () => {
	const script = extractScript();
	const loadRunsMatch = script.match(/async function loadRuns\(\)[\s\S]*?^[\t]}/m);
	assert.ok(loadRunsMatch, "should find loadRuns function");
	const body = loadRunsMatch[0];
	// Find the empty case
	const emptyIdx = body.indexOf("!runs.length");
	assert.ok(emptyIdx > -1, "should have empty check");
	// Find unsubscribeAllSSE after the empty check
	const unsubIdx = body.indexOf("unsubscribeAllSSE()", emptyIdx);
	assert.ok(unsubIdx > emptyIdx, "unsubscribeAllSSE should be called in empty case");
	// Verify it's before the return
	const returnIdx = body.indexOf("return;", emptyIdx);
	assert.ok(unsubIdx < returnIdx, "unsubscribeAllSSE should be before return");
});

test("behavioral: updateRunCard uses innerHTML (not outerHTML) for badge", () => {
	const script = extractScript();
	// Verify badgeEl.innerHTML, NOT badgeEl.outerHTML
	assert.match(script, /badgeEl\.innerHTML\s*=\s*statusBadge/);
	assert.doesNotMatch(script, /badgeEl\.outerHTML/);
});

test("behavioral: updateRunCard updates actions via renderRunActions", () => {
	const script = extractScript();
	// Verify actionsEl is queried and updated
	assert.match(script, /\.run-actions/);
	assert.match(script, /actionsEl\.innerHTML\s*=\s*renderRunActions\(r\)/);
});

test("behavioral: renderRunActions shows pause/cancel for running, resume/cancel for paused, report/delete for completed", () => {
	const script = extractScript();
	// Verify the function exists and has the right conditional logic
	const rraMatch = script.match(/function renderRunActions\(r\)[\s\S]*?^[\t]}/m);
	assert.ok(rraMatch, "should find renderRunActions function");
	const body = rraMatch[0];
	assert.match(body, /r\.status === ["']running["']/, "should handle running status");
	assert.match(body, /r\.status === ["']paused["']/, "should handle paused status");
	assert.match(body, /r\.status === ["']completed["']/, "should handle completed status");
	assert.match(body, /r\.status === ["']cancelled["']/, "should handle cancelled status");
	// Verify actions contain the right control calls
	assert.match(body, /controlRun.*pause/, "running should have pause button");
	assert.match(body, /controlRun.*cancel/, "running should have cancel button");
	assert.match(body, /controlRun.*resume/, "paused should have resume button");
	assert.match(body, /viewReport/, "completed should have view report button");
	assert.match(body, /deleteRun/, "terminal should have delete button");
});

test("behavioral: loadRuns uses renderRunActions via .run-actions div", () => {
	const script = extractScript();
	// Verify the actions div has .run-actions class
	assert.match(script, /class="run-actions"/);
	// Verify renderRunActions is called in the template
	assert.match(script, /renderRunActions\(r\)/);
});

// ── P4: Team UI usability improvements ──

test("P4: formatDuration function exists and handles cases", () => {
	const script = extractScript();
	assert.match(script, /function formatDuration\(ms\)/);
	// Should return 0秒 for 0
	assert.match(script, /return '0秒'/);
	// Should handle hours
	assert.match(script, /时/);
	// Should handle minutes
	assert.match(script, /分/);
	// Should handle seconds
	assert.match(script, /秒/);
});

test("P4: formatDuration is used in loadRuns and updateRunCard", () => {
	const script = extractScript();
	assert.match(script, /formatDuration\(r\.activeElapsedMs\)/);
});

test("P4: formatTimestamp function exists and formats ISO date", () => {
	const script = extractScript();
	assert.match(script, /function formatTimestamp\(iso\)/);
	assert.match(script, /getMonth/);
	assert.match(script, /getDate/);
	assert.match(script, /getHours/);
	assert.match(script, /getMinutes/);
});

test("P4: formatTimestamp is used in loadRuns for createdAt, startedAt, finishedAt", () => {
	const script = extractScript();
	assert.match(script, /formatTimestamp\(r\.createdAt\)/);
	assert.match(script, /formatTimestamp\(r\.startedAt\)/);
	assert.match(script, /formatTimestamp\(r\.finishedAt\)/);
});

test("P4: PHASE_LABELS map contains Chinese labels", () => {
	const html = renderTeamPage();
	assert.match(html, /PHASE_LABELS/);
	assert.match(html, /worker_running.*执行中/);
	assert.match(html, /checker_reviewing.*验收中/);
	assert.match(html, /watcher_reviewing.*复盘中/);
	assert.match(html, /finalizer_running.*生成报告/);
	assert.match(html, /succeeded.*已通过/);
	assert.match(html, /failed.*失败/);
});

test("P4: phaseLabel function is used in renderTaskDetail", () => {
	const script = extractScript();
	assert.match(script, /function phaseLabel/);
	assert.match(script, /escapeHtml\(phaseLabel\(ts\.progress\.phase\)\)/);
});

test("P4: phaseColor function is used for phase label styling", () => {
	const script = extractScript();
	assert.match(script, /function phaseColor/);
	assert.match(script, /phaseColor\(ts\.progress\.phase\)/);
});

test("P4: CSS includes loading spinner", () => {
	const html = renderTeamPage();
	assert.match(html, /@keyframes spin/);
	assert.match(html, /\.spinner/);
	assert.match(html, /\.loading/);
});

test("P4: CSS includes button disabled state", () => {
	const html = renderTeamPage();
	assert.match(html, /\.btn:disabled/);
});

test("P4: CSS includes phase label color classes", () => {
	const html = renderTeamPage();
	assert.match(html, /\.phase-label/);
	assert.match(html, /\.phase-running/);
	assert.match(html, /\.phase-success/);
	assert.match(html, /\.phase-fail/);
	assert.match(html, /\.phase-warn/);
	assert.match(html, /\.phase-muted/);
});

test("P4: report modal HTML exists with close button", () => {
	const html = renderTeamPage();
	assert.match(html, /id="report-modal"/);
	assert.match(html, /report-content/);
	assert.match(html, /closeReportModal/);
	assert.match(html, /最终报告/);
});

test("P4: file viewer HTML exists with close button", () => {
	const html = renderTeamPage();
	assert.match(html, /id="file-viewer"/);
	assert.match(html, /file-viewer-content/);
	assert.match(html, /closeFileViewer/);
});

test("P4: viewAttemptFile function exists", () => {
	const script = extractScript();
	assert.match(script, /async function viewAttemptFile/);
	assert.match(script, /\/attempts\//);
	const html = renderTeamPage();
	assert.match(html, /attempt-file/);
});

test("P4: plan title displayed in run cards with plan-title class", () => {
	const html = renderTeamPage();
	assert.match(html, /plan-title/);
	assert.match(html, /escapeHtml\(planTitle\)/);
});

test("P4: run-id class used for runId display", () => {
	const html = renderTeamPage();
	assert.match(html, /\.run-id/);
	assert.match(html, /run-id/);
});

test("P4: escapeHtml used on status in statusBadge", () => {
	const script = extractScript();
	// statusBadge should escape the status value
	assert.match(script, /escapeHtml\(status\)/);
});

test("P4: escapeHtml used on currentTaskTitle in run cards", () => {
	const script = extractScript();
	assert.match(script, /escapeHtml\(currentTaskTitle\)/);
});

test("P4: escapeHtml used on attempt status and attemptId", () => {
	const script = extractScript();
	assert.match(script, /escapeHtml\(a\.status\)/);
	assert.match(script, /escapeHtml\(a\.attemptId/);
});

test("P4: escapeHtml used on file names in attempt display", () => {
	const script = extractScript();
	assert.match(script, /escapeHtml\(f\)/);
});

test("P4: attempt file onclick arguments are JS-string and HTML escaped", () => {
	const script = extractScript();
	assert.match(script, /function jsArg\(value\)/);
	assert.match(script, /JSON\.stringify\(String\(value/);
	assert.match(script, /viewAttemptFile\(' \+ jsArg\(state\.runId\) \+ ',' \+ jsArg\(task\.id\) \+ ',' \+ jsArg\(a\.attemptId\) \+ ',' \+ jsArg\(f\) \+ '\)/);
	assert.doesNotMatch(script, /viewAttemptFile\\\(\\\\'' \+ state\.runId/);
});

test("P4: attempt file URL path segments are encoded", () => {
	const script = extractScript();
	assert.match(script, /function pathSegment\(value\)/);
	assert.match(script, /encodeURIComponent\(String\(value/);
	assert.match(script, /pathSegment\(runId\).*pathSegment\(taskId\).*pathSegment\(attemptId\).*pathSegment\(fileName\)/s);
});

test("P4: escapeHtml used on report body content", () => {
	const script = extractScript();
	assert.match(script, /escapeHtml\(text\)/);
});

test("P4: loading state shown in loadPlans", () => {
	const script = extractScript();
	assert.match(script, /plans-list/);
	const loadPlansMatch = script.match(/async function loadPlans\(\)[\s\S]*?^[\t]}/m);
	assert.ok(loadPlansMatch, "should find loadPlans function");
	assert.match(loadPlansMatch[0], /spinner/);
});

test("P4: loading state shown in loadTeams", () => {
	const script = extractScript();
	const loadTeamsMatch = script.match(/async function loadTeams\(\)[\s\S]*?^[\t]}/m);
	assert.ok(loadTeamsMatch, "should find loadTeams function");
	assert.match(loadTeamsMatch[0], /spinner/);
});

test("P4: loading state shown in loadRuns", () => {
	const script = extractScript();
	const loadRunsMatch = script.match(/async function loadRuns\(\)[\s\S]*?^[\t]}/m);
	assert.ok(loadRunsMatch, "should find loadRuns function");
	assert.match(loadRunsMatch[0], /spinner/);
});

test("P4: error retry links in loadPlans, loadTeams, loadRuns", () => {
	const script = extractScript();
	// loadPlans retry
	assert.match(script, /onclick="loadPlans\(\)"[^>]*>重试/);
	// loadTeams retry
	assert.match(script, /onclick="loadTeams\(\)"[^>]*>重试/);
	// loadRuns retry
	assert.match(script, /onclick="loadRuns\(\)"[^>]*>重试/);
});

test("P4: controlRun disables buttons during operation", () => {
	const script = extractScript();
	const match = script.match(/async function controlRun[\s\S]*?^[\t]}/m);
	assert.ok(match, "should find controlRun function");
	assert.match(match[0], /disabled/);
});

test("P4: deleteRun disables buttons during operation", () => {
	const script = extractScript();
	const match = script.match(/async function deleteRun[\s\S]*?^[\t]}/m);
	assert.ok(match, "should find deleteRun function");
	assert.match(match[0], /disabled/);
});

test("P4: click-outside handlers for report-modal and file-viewer", () => {
	const script = extractScript();
	assert.match(script, /report-modal.*closeReportModal/);
	assert.match(script, /file-viewer.*closeFileViewer/);
});

test("P4: timestamp class used for formatted times", () => {
	const html = renderTeamPage();
	assert.match(html, /\.ts\s*\{/);
});

test("P4: attempt-card CSS class defined", () => {
	const html = renderTeamPage();
	assert.match(html, /\.attempt-card/);
	assert.match(html, /\.attempt-file/);
});

test("P4: inline scripts are still valid JavaScript with P4 changes", () => {
	const html = renderTeamPage();
	const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
	assert.ok(scripts.length > 0);
	for (const script of scripts) {
		assert.doesNotThrow(() => new Function(script), "inline script should be valid JS after P4 changes");
	}
});


// ── P5: attempt lifecycle UI tests ──

test("P5: PHASE_LABELS includes attempt lifecycle phases", () => {
	const html = renderTeamPage();
	assert.match(html, /worker_completed.*执行完成/);
	assert.match(html, /checker_passed.*验收通过/);
	assert.match(html, /checker_revising.*验收修改/);
	assert.match(html, /checker_failed.*验收失败/);
	assert.match(html, /watcher_accepted.*复盘通过/);
	assert.match(html, /watcher_revision_requested.*复盘请求重做/);
	assert.match(html, /watcher_confirmed_failed.*复盘确认失败/);
	assert.match(html, /created.*已创建/);
});

test("P5: attempt card renders lifecycle summary lines", () => {
	const script = extractScript();
	assert.match(script, /lcLines/);
	assert.match(script, /a\.phase/);
	assert.match(script, /a\.worker/);
	assert.match(script, /a\.checker/);
	assert.match(script, /a\.watcher/);
	assert.match(script, /phaseLabel\(a\.phase\)/);
});

test("P5: checker verdict chain uses escapeHtml", () => {
	const script = extractScript();
	assert.match(script, /escapeHtml\(c\.verdict\)/);
});

test("P5: watcher decision uses escapeHtml", () => {
	const script = extractScript();
	assert.match(script, /escapeHtml\(a\.watcher\.decision\)/);
});

test("P5: resultRef and errorSummary use escapeHtml", () => {
	const script = extractScript();
	assert.match(script, /escapeHtml\(a\.resultRef\)/);
	assert.match(script, /escapeHtml\(a\.errorSummary\)/);
});

test("P5: PHASE_COLORS includes attempt lifecycle phases", () => {
	const html = renderTeamPage();
	assert.match(html, /checker_passed.*phase-success/);
	assert.match(html, /checker_failed.*phase-fail/);
	assert.match(html, /watcher_accepted.*phase-success/);
	assert.match(html, /watcher_revision_requested.*phase-warn/);
	assert.match(html, /watcher_confirmed_failed.*phase-fail/);
});

test("P5: inline scripts remain valid JavaScript after P5 changes", () => {
	const html = renderTeamPage();
	const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
	assert.ok(scripts.length > 0);
	for (const script of scripts) {
		assert.doesNotThrow(() => new Function(script), "inline script should be valid JS after P5 changes");
	}
});

// ── P8-C: role runtime context UI ──

test("P8-C: attempt cards render role runtime context", () => {
	const script = extractScript();
	assert.match(script, /function renderRuntimeContext\(role,\s*ctx\)/);
	assert.match(script, /runtime-context/);
	assert.match(script, /requestedProfileId/);
	assert.match(script, /resolvedProfileId/);
	assert.match(script, /browserId/);
	assert.match(script, /browserScope/);
	assert.match(script, /fallbackUsed/);
	assert.match(script, /fallbackReason/);
	assert.match(script, /renderRuntimeContext\('worker'/);
	assert.match(script, /renderRuntimeContext\('checker'/);
	assert.match(script, /renderRuntimeContext\('watcher'/);
});

test("P8-C: runtime context dynamic values are escaped", () => {
	const script = extractScript();
	assert.match(script, /escapeHtml\(role\)/);
	assert.match(script, /escapeHtml\(ctx\.requestedProfileId\)/);
	assert.match(script, /escapeHtml\(ctx\.resolvedProfileId\)/);
	assert.match(script, /escapeHtml\(ctx\.fallbackReason\)/);
	assert.match(script, /escapeHtml\(ctx\.browserId/);
	assert.match(script, /escapeHtml\(ctx\.browserScope\)/);
});

test("P8-C: runtime context has compact CSS and fallback badge", () => {
	const html = renderTeamPage();
	assert.match(html, /\.runtime-context/);
	assert.match(html, /\.runtime-context-fallback/);
	assert.match(html, /fallback/);
});

// ── P8-D: finalizer runtime context UI ──

test("P8-D: task detail renders finalizer runtime context from run state", () => {
	const script = extractScript();
	assert.match(script, /finalizerRuntimeContext/);
	assert.match(script, /renderRuntimeContext\('finalizer',\s*state\.finalizerRuntimeContext\)/);
	assert.match(script, /finalizer-runtime/);
});

test("P8-E: renderTaskDetail escapes role runtime context values", () => {
	const script = extractScript();
	const helperStart = script.indexOf("function escapeHtml");
	const helperEnd = script.indexOf("async function editTeamUnit");
	assert.ok(helperStart >= 0, "should find helper source start");
	assert.ok(helperEnd > helperStart, "should find helper source end");
	const helperSource = script.slice(helperStart, helperEnd);
	const renderTaskDetail = new Function(helperSource + "\nreturn renderTaskDetail;")() as (state: any, plan: any, attemptsMap: any) => string;
	const maliciousContext = {
		requestedProfileId: "<script>alert(1)</script>",
		resolvedProfileId: "\" onclick=\"bad",
		browserId: "browser<&>",
		browserScope: "scope\" onmouseover=\"bad",
		fallbackUsed: true,
		fallbackReason: "'><img src=x onerror=bad>",
	};
	const state = {
		runId: "run_<bad>",
		finalizerRuntimeContext: maliciousContext,
		taskStates: {
			t1: { status: "succeeded", progress: { phase: "succeeded", message: "done" }, attemptCount: 1, activeAttemptId: "attempt_1" },
		},
	};
	const plan = { tasks: [{ id: "t1", title: "<b>task</b>" }] };
	const attemptsMap = {
		t1: [{
			status: "succeeded",
			attemptId: "attempt_<bad>",
			createdAt: "2026-05-16T00:00:00.000Z",
			phase: "succeeded",
			worker: [{ runtimeContext: maliciousContext }],
			checker: [{ verdict: "pass", runtimeContext: maliciousContext }],
			watcher: { decision: "accept", runtimeContext: maliciousContext },
			files: [],
		}],
	};

	const html = renderTaskDetail(state, plan, attemptsMap);

	assert.doesNotMatch(html, /<script>/);
	assert.doesNotMatch(html, /<img/);
	assert.doesNotMatch(html, /onclick="bad/);
	assert.doesNotMatch(html, /onmouseover="bad/);
	assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
	assert.match(html, /&quot; onclick=&quot;bad/);
	assert.match(html, /scope&quot; onmouseover=&quot;bad/);
	assert.match(html, /&lt;img src=x onerror=bad&gt;/);
});

// ── P12 Task 1: toast + confirmAction replaces system dialogs ──

test("P12-T1: page has toast root container", () => {
	const html = renderTeamPage();
	assert.match(html, /id="team-toast-root"/);
});

test("P12-T1: page has confirm modal", () => {
	const html = renderTeamPage();
	assert.match(html, /id="team-confirm-modal"/);
	assert.match(html, /id="confirm-message"/);
	assert.match(html, /id="confirm-ok"/);
	assert.match(html, /id="confirm-cancel"/);
});

test("P12-T1: inline script contains no native alert()", () => {
	const html = renderTeamPage();
	const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
	const scriptContent = scripts.join('');
	assert.doesNotMatch(scriptContent, /\balert\s*\(/, "script must not contain native alert()");
});

test("P12-T1: inline script contains no native confirm()", () => {
	const html = renderTeamPage();
	const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
	const scriptContent = scripts.join('');
	assert.doesNotMatch(scriptContent, /\bconfirm\s*\(/, "script must not contain native confirm()");
});

test("P12-T1: showToast and showError and showSuccess helpers exist", () => {
	const script = extractScript();
	assert.match(script, /function showToast\(message,\s*type\)/);
	assert.match(script, /function showError\(message\)/);
	assert.match(script, /function showSuccess\(message\)/);
});

test("P12-T1: confirmAction returns Promise and uses confirm modal", () => {
	const script = extractScript();
	assert.match(script, /function confirmAction\(opts\)/);
	assert.match(script, /return new Promise/);
	assert.match(script, /confirm-ok/);
	assert.match(script, /confirm-cancel/);
});

test("P12-T1: confirmAction used in archiveTeamUnit", () => {
	const script = extractScript();
	const match = script.match(/async function archiveTeamUnit[\s\S]*?^}/m);
	assert.ok(match, "should find archiveTeamUnit");
	assert.match(match[0], /confirmAction/);
	assert.match(match[0], /danger:\s*true/);
});

test("P12-T1: confirmAction used in deletePlan", () => {
	const script = extractScript();
	const match = script.match(/async function deletePlan[\s\S]*?^}/m);
	assert.ok(match, "should find deletePlan");
	assert.match(match[0], /confirmAction/);
	assert.match(match[0], /danger:\s*true/);
});

test("P12-T1: confirmAction used in deleteRun", () => {
	const script = extractScript();
	const match = script.match(/async function deleteRun[\s\S]*?^}/m);
	assert.ok(match, "should find deleteRun");
	assert.match(match[0], /confirmAction/);
	assert.match(match[0], /danger:\s*true/);
});

test("P12-T1: toast uses textContent not innerHTML for safety", () => {
	const script = extractScript();
	const showToastMatch = script.match(/function showToast\(message,\s*type\)[\s\S]*?^}/m);
	assert.ok(showToastMatch, "should find showToast");
	assert.match(showToastMatch[0], /textContent/);
});

test("P12-T1: CSS defines toast and confirm styles", () => {
	const html = renderTeamPage();
	assert.match(html, /\.toast-success/);
	assert.match(html, /\.toast-error/);
	assert.match(html, /\.toast-info/);
	assert.match(html, /\.confirm-box/);
	assert.match(html, /#team-confirm-modal/);
});

// ── P12 Task 2: Plan modal replaces prompt() ──

test("P12-T2: inline script contains no native prompt()", () => {
	const html = renderTeamPage();
	const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
	const scriptContent = scripts.join('');
	assert.doesNotMatch(scriptContent, /\bprompt\s*\(/, "script must not contain native prompt()");
});

test("P12-T2: page has plan-modal with form fields", () => {
	const html = renderTeamPage();
	assert.match(html, /id="plan-modal"/);
	assert.match(html, /id="plan-title"/);
	assert.match(html, /id="plan-teamunit"/);
	assert.match(html, /id="plan-goal"/);
	assert.match(html, /id="plan-task-title"/);
	assert.match(html, /id="plan-task-text"/);
	assert.match(html, /id="plan-acceptance"/);
	assert.match(html, /id="plan-output-contract"/);
});

test("P12-T2: savePlan function exists and constructs acceptance rules", () => {
	const script = extractScript();
	assert.match(script, /async function savePlan\(\)/);
	assert.match(script, /acceptanceText\.split/);
	assert.match(script, /acceptance:.*rules/);
});

test("P12-T2: createPlan opens modal instead of using prompt", () => {
	const script = extractScript();
	const match = script.match(/async function createPlan[\s\S]*?^}/m);
	assert.ok(match, "should find createPlan");
	assert.match(match[0], /plan-modal/);
	assert.match(match[0], /classList\.add\('open'\)/);
});

test("P12-T2: plan-modal has click-outside close handler", () => {
	const script = extractScript();
	assert.match(script, /plan-modal[\s\S]*closePlanModal/);
});

test("P12-T2: savePlan shows error on empty title", () => {
	const script = extractScript();
	const match = script.match(/async function savePlan[\s\S]*?^}/m);
	assert.ok(match, "should find savePlan");
	assert.match(match[0], /showError.*计划名称/);
});

test("P12-T2: savePlan escapes dynamic values in acceptance rules", () => {
	const script = extractScript();
	// savePlan uses .value from DOM elements, not innerHTML injection
	const match = script.match(/async function savePlan[\s\S]*?^}/m);
	assert.ok(match, "should find savePlan");
	// Should use .value for reading fields
	assert.match(match[0], /\$\('plan-title'\)\.value/);
	assert.match(match[0], /\$\('plan-goal'\)\.value/);
});
