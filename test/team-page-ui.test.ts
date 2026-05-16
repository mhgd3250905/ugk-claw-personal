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
	assert.match(html, /耗时统计/);
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
	assert.match(html, /escapeHtml\(r\.currentTaskId\)/);
});

test("team page escapes task detail dynamic fields", () => {
	const html = renderTeamPage();
	assert.match(html, /escapeHtml\(task\.title\)/);
	assert.match(html, /escapeHtml\(ts\.progress\.phase\)/);
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
