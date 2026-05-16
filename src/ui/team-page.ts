export function renderTeamPage(): string {
	return `<!doctype html>
<html lang="zh-CN" data-theme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Team Runtime v2</title>
<style>
:root { --bg: #0a0a0a; --surface: #141414; --border: #262626; --text: #e5e5e5; --muted: #737373; --accent: #3b82f6; --accent-hover: #2563eb; --success: #22c55e; --fail: #ef4444; --warn: #f59e0b; }
[data-theme="light"] { --bg: #fafafa; --surface: #fff; --border: #e5e5e5; --text: #171717; --muted: #737373; --accent: #2563eb; --accent-hover: #1d4ed8; --success: #16a34a; --fail: #dc2626; --warn: #d97706; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid var(--border); background: var(--surface); }
.topbar h1 { font-size: 16px; font-weight: 600; }
.topbar nav { display: flex; gap: 8px; }
.topbar button { padding: 6px 14px; border: 1px solid var(--border); border-radius: 6px; background: transparent; color: var(--text); cursor: pointer; font-size: 13px; }
.topbar button:hover, .topbar button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.main { max-width: 960px; margin: 0 auto; padding: 20px; }
.section { display: none; }
.section.active { display: block; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 12px; }
.card h3 { font-size: 14px; margin-bottom: 8px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
.badge-success { background: rgba(34,197,94,0.15); color: var(--success); }
.badge-fail { background: rgba(239,68,68,0.15); color: var(--fail); }
.badge-warn { background: rgba(245,158,11,0.15); color: var(--warn); }
.badge-muted { background: rgba(115,115,115,0.15); color: var(--muted); }
.btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-hover); }
.btn-danger { background: var(--fail); color: #fff; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn:disabled, .btn:disabled:hover { opacity: 0.5; cursor: not-allowed; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-weight: 500; font-size: 12px; }
.empty { text-align: center; color: var(--muted); padding: 40px 0; font-size: 14px; }
.progress-bar { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; margin-top: 4px; }
.progress-bar-fill { height: 100%; background: var(--accent); transition: width 0.3s; }
.run-detail { display: none; margin-top: 10px; border-top: 1px solid var(--border); padding-top: 10px; }
.task-table th { width: 30%; }
.task-table td { word-break: break-all; }
.detail-toggle { cursor: pointer; color: var(--accent); font-size: 12px; }
.detail-toggle:hover { text-decoration: underline; }
.refresh-btn { padding: 6px 14px; border: 1px solid var(--border); border-radius: 6px; background: transparent; color: var(--text); cursor: pointer; font-size: 13px; }
.refresh-btn:hover { background: var(--surface); }

/* Loading spinner */
@keyframes spin { to { transform: rotate(360deg); } }
.spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; vertical-align: middle; }
.loading { text-align: center; padding: 40px 0; color: var(--muted); font-size: 14px; }

/* Phase label */
.phase-label { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; margin-top: 2px; }
.phase-running { background: rgba(59,130,246,0.15); color: var(--accent); }
.phase-success { background: rgba(34,197,94,0.15); color: var(--success); }
.phase-fail { background: rgba(239,68,68,0.15); color: var(--fail); }
.phase-warn { background: rgba(245,158,11,0.15); color: var(--warn); }
.phase-muted { background: rgba(115,115,115,0.15); color: var(--muted); }

/* Timestamp */
.ts { font-size: 11px; color: var(--muted); font-family: monospace; margin-right: 8px; }

/* Plan title */
.plan-title { font-size: 14px; font-weight: 600; }

/* Attempt card */
.attempt-card { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; margin-top: 4px; font-size: 12px; }
.attempt-files { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; }
.attempt-file { color: var(--accent); cursor: pointer; font-size: 11px; text-decoration: underline; }
.attempt-file:hover { color: var(--accent-hover); }

/* Modal overlay base */
.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; justify-content: center; align-items: center; }
.modal-overlay.open { display: flex; }

/* Report modal */
.report-content { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; width: 720px; max-width: 95vw; max-height: 90vh; overflow-y: auto; padding: 24px; }
.report-content pre { white-space: pre-wrap; font-family: inherit; font-size: 13px; line-height: 1.6; }

/* File viewer */
.file-viewer { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 110; justify-content: center; align-items: center; }
.file-viewer.open { display: flex; }
.file-viewer-content { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; width: 640px; max-width: 95vw; max-height: 90vh; overflow-y: auto; padding: 24px; }
.file-viewer-content pre { white-space: pre-wrap; word-break: break-all; font-size: 12px; line-height: 1.5; }

/* TeamUnit Modal */
.modal { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; width: 480px; max-width: 95vw; max-height: 90vh; overflow-y: auto; padding: 24px; }
.modal h2 { font-size: 16px; margin-bottom: 16px; }
.modal label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 4px; margin-top: 12px; }
.modal input, .modal select, .modal textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: 13px; }
.modal textarea { min-height: 60px; resize: vertical; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
.profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.profile-grid label { margin-top: 0; }

/* Run card run-id */
.run-id { font-family: monospace; font-size: 12px; color: var(--muted); }
</style>
</head>
<body>
<div class="topbar">
	<h1>Team Runtime v2</h1>
	<nav>
		<button class="active" onclick="showSection('plans', event)">计划</button>
		<button onclick="showSection('teams', event)">预设团队</button>
		<button onclick="showSection('runs', event)">运行记录</button>
	</nav>
</div>

<div class="main">
	<!-- Plans -->
	<div id="section-plans" class="section active">
		<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
			<h2>计划</h2>
			<button class="btn btn-primary" onclick="createPlan()">新建计划</button>
		</div>
		<div id="plans-list"><div class="loading"><div class="spinner"></div> 加载中...</div></div>
	</div>

	<!-- Teams -->
	<div id="section-teams" class="section">
		<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
			<h2>预设团队</h2>
			<button class="btn btn-primary" onclick="openTeamUnitModal()">新建预设团队</button>
		</div>
		<div id="teams-list"></div>
	</div>

	<!-- Runs -->
	<div id="section-runs" class="section">
		<div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center"><h2>运行记录</h2><button class="refresh-btn" onclick="loadRuns()">刷新</button></div>
		<div id="runs-list"></div>
	</div>
</div>

<!-- TeamUnit Modal -->
<div id="teamunit-modal" class="modal-overlay">
	<div class="modal">
		<h2 id="teamunit-modal-title">新建预设团队</h2>
		<input type="hidden" id="tu-editing-id" value="" />
		<label>名称</label>
		<input id="tu-title" placeholder="预设团队名称" />
		<label>描述</label>
		<textarea id="tu-desc" placeholder="描述（可选）"></textarea>
		<div class="profile-grid" style="margin-top:12px">
			<div class="field">
				<label>执行 Agent (Worker)</label>
				<select id="tu-worker"></select>
			</div>
			<div class="field">
				<label>验收 Agent (Checker)</label>
				<select id="tu-checker"></select>
			</div>
			<div class="field">
				<label>复盘 Agent (Watcher)</label>
				<select id="tu-watcher"></select>
			</div>
			<div class="field">
				<label>汇总 Agent (Finalizer)</label>
				<select id="tu-finalizer"></select>
			</div>
		</div>
		<div class="modal-actions">
			<button class="btn" style="background:var(--border);color:var(--text)" onclick="closeTeamUnitModal()">取消</button>
			<button class="btn btn-primary" onclick="saveTeamUnit()">保存</button>
		</div>
	</div>
</div>

<!-- Report Modal -->
<div id="report-modal" class="modal-overlay">
	<div class="report-content">
		<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
			<h2>最终报告</h2>
			<button class="btn" style="background:var(--border);color:var(--text)" onclick="closeReportModal()">关闭</button>
		</div>
		<div id="report-body"><div class="loading"><div class="spinner"></div> 加载中...</div></div>
	</div>
</div>

<!-- File Viewer -->
<div id="file-viewer" class="file-viewer">
	<div class="file-viewer-content">
		<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
			<h3 id="file-viewer-title">文件内容</h3>
			<button class="btn" style="background:var(--border);color:var(--text)" onclick="closeFileViewer()">关闭</button>
		</div>
		<pre id="file-viewer-body"></pre>
	</div>
</div>

<script>
const API = '/v1/team';
var agentCatalog = [];

function $(id) { return document.getElementById(id); }

function escapeHtml(value) {
	return String(value == null ? '' : value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function formatDuration(ms) {
	if (!ms || ms <= 0) return '0秒';
	var s = Math.floor(ms / 1000);
	var h = Math.floor(s / 3600);
	var m = Math.floor((s % 3600) / 60);
	s = s % 60;
	if (h > 0) return h + '时' + (m > 0 ? m + '分' : '');
	if (m > 0) return m + '分' + (s > 0 ? s + '秒' : '');
	return s + '秒';
}

function formatTimestamp(iso) {
	if (!iso) return '';
	var d = new Date(iso);
	var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
	return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

var PHASE_LABELS = {
	pending: '等待执行', creating_workunit: '创建工作单元', creating_worker_session: '创建执行 Agent',
	worker_running: '执行中', checker_reviewing: '验收中', worker_revising: '修改中',
	watcher_reviewing: '复盘中', finalizer_running: '生成报告', writing_result: '写入结果',
	succeeded: '已通过', failed: '失败', interrupted: '已中断', cancelled: '已取消'
};

var PHASE_COLORS = {
	pending: 'phase-muted', creating_workunit: 'phase-running', creating_worker_session: 'phase-running',
	worker_running: 'phase-running', checker_reviewing: 'phase-running', worker_revising: 'phase-running',
	watcher_reviewing: 'phase-running', finalizer_running: 'phase-running', writing_result: 'phase-running',
	succeeded: 'phase-success', failed: 'phase-fail', interrupted: 'phase-warn', cancelled: 'phase-muted'
};

function phaseLabel(phase) {
	return PHASE_LABELS[phase] || phase;
}

function phaseColor(phase) {
	return PHASE_COLORS[phase] || 'phase-muted';
}

function showSection(name, evt) {
	document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
	$('section-' + name).classList.add('active');
	document.querySelectorAll('.topbar button').forEach(function(b) { b.classList.remove('active'); });
	if (evt && evt.target) {
		evt.target.classList.add('active');
	} else {
		var idx = { plans: 0, teams: 1, runs: 2 }[name];
		if (idx !== undefined) document.querySelectorAll('.topbar button')[idx].classList.add('active');
	}
	if (name === 'plans') loadPlans();
	if (name === 'teams') loadTeams();
	if (name === 'runs') loadRuns();
}

function statusBadge(status) {
	var map = { completed: 'badge-success', completed_with_failures: 'badge-warn', failed: 'badge-fail', running: 'badge-warn', queued: 'badge-muted', paused: 'badge-warn', cancelled: 'badge-muted' };
	return '<span class="badge ' + (map[status] || 'badge-muted') + '">' + escapeHtml(status) + '</span>';
}

function profileName(id) {
	var a = agentCatalog.find(function(x) { return (x.agentId || 'main') === id; });
	return a ? (a.name || a.agentId) : id;
}

async function api(path, opts) {
	if (!opts) opts = {};
	var res = await fetch(API + path, opts);
	if (!res.ok && res.status !== 204) { var e = await res.json().catch(function() { return {}; }); throw new Error(e.error || res.statusText); }
	return res.status === 204 ? null : res.json();
}

async function loadAgents() {
	try {
		var res = await fetch('/v1/agents');
		var data = await res.json();
		agentCatalog = data.agents || [];
	} catch (e) {
		agentCatalog = [];
	}
}

function renderProfileOptions(selId, selectedId) {
	var sel = $(selId);
	if (!sel) return;
	sel.innerHTML = '';
	var agents = agentCatalog.length > 0 ? agentCatalog : [{ agentId: 'main', name: '主 Agent' }];
	for (var i = 0; i < agents.length; i++) {
		var a = agents[i];
		var opt = document.createElement('option');
		opt.value = a.agentId || 'main';
		opt.textContent = a.name || a.agentId || 'main';
		sel.appendChild(opt);
	}
	if (selectedId && !agents.some(function(a) { return (a.agentId || 'main') === selectedId; })) {
		var opt = document.createElement('option');
		opt.value = selectedId;
		opt.textContent = selectedId + '（不可用）';
		sel.appendChild(opt);
	}
	if (selectedId) sel.value = selectedId;
}

function openTeamUnitModal(unit) {
	$('tu-editing-id').value = unit ? unit.teamUnitId : '';
	$('tu-title').value = unit ? unit.title : '';
	$('tu-desc').value = unit ? unit.description : '';
	$('teamunit-modal-title').textContent = unit ? '编辑预设团队' : '新建预设团队';
	renderProfileOptions('tu-worker', unit ? unit.workerProfileId : 'main');
	renderProfileOptions('tu-checker', unit ? unit.checkerProfileId : 'main');
	renderProfileOptions('tu-watcher', unit ? unit.watcherProfileId : 'main');
	renderProfileOptions('tu-finalizer', unit ? unit.finalizerProfileId : 'main');
	$('teamunit-modal').classList.add('open');
}

function closeTeamUnitModal() {
	$('teamunit-modal').classList.remove('open');
}

async function saveTeamUnit() {
	var editingId = $('tu-editing-id').value;
	var payload = {
		title: $('tu-title').value,
		description: $('tu-desc').value,
		workerProfileId: $('tu-worker').value,
		checkerProfileId: $('tu-checker').value,
		watcherProfileId: $('tu-watcher').value,
		finalizerProfileId: $('tu-finalizer').value,
	};
	if (!payload.title) { alert('请输入名称'); return; }
	try {
		if (editingId) {
			await api('/team-units/' + editingId, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
		} else {
			await api('/team-units', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
		}
		closeTeamUnitModal();
		loadTeams();
	} catch (e) { alert(e.message); }
}

async function loadPlans() {
	var el = $('plans-list');
	el.innerHTML = '<div class="loading"><div class="spinner"></div> 加载中...</div>';
	try {
		var plans = await api('/plans');
		if (!plans.length) { el.innerHTML = '<div class="empty">暂无计划。点击「新建计划」开始。</div>'; return; }
		el.innerHTML = plans.map(function(p) {
			return '<div class="card"><h3>' + escapeHtml(p.title) + ' <span class="badge badge-muted">' + p.tasks.length + ' 个任务</span></h3>' +
				'<p style="font-size:13px;color:var(--muted)">目标：' + escapeHtml(p.goal.text) + '</p>' +
				'<div style="margin-top:8px;display:flex;gap:8px">' +
				'<button class="btn btn-primary" onclick="startRun(\\'' + p.planId + '\\')">创建运行</button>' +
				(p.runCount === 0 ? '<button class="btn btn-danger" onclick="deletePlan(\\'' + p.planId + '\\')">删除</button>' : '') +
				'</div></div>';
		}).join('');
	} catch (e) {
		el.innerHTML = '<div class="empty" style="color:var(--fail)">加载失败：' + escapeHtml(e.message) + ' <span class="detail-toggle" onclick="loadPlans()">重试</span></div>';
	}
}

async function loadTeams() {
	var el = $('teams-list');
	el.innerHTML = '<div class="loading"><div class="spinner"></div> 加载中...</div>';
	try {
		var teams = await api('/team-units');
		if (!teams.length) { el.innerHTML = '<div class="empty">暂无预设团队。点击「新建预设团队」开始。</div>'; return; }
		el.innerHTML = teams.map(function(t) {
			return '<div class="card"><h3>' + escapeHtml(t.title) + (t.archived ? ' <span class="badge badge-muted">已归档</span>' : '') + '</h3>' +
				'<table><tr><td>执行 Agent</td><td>' + escapeHtml(profileName(t.workerProfileId)) + '</td></tr>' +
				'<tr><td>验收 Agent</td><td>' + escapeHtml(profileName(t.checkerProfileId)) + '</td></tr>' +
				'<tr><td>复盘 Agent</td><td>' + escapeHtml(profileName(t.watcherProfileId)) + '</td></tr>' +
				'<tr><td>汇总 Agent</td><td>' + escapeHtml(profileName(t.finalizerProfileId)) + '</td></tr></table>' +
				'<div style="margin-top:8px;display:flex;gap:8px">' +
				(!t.archived ? '<button class="btn btn-sm" style="background:var(--border);color:var(--text)" onclick="editTeamUnit(\\'' + t.teamUnitId + '\\')">编辑</button>' +
				'<button class="btn btn-sm btn-primary" onclick="archiveTeamUnit(\\'' + t.teamUnitId + '\\')">归档</button>' : '') +
				'</div></div>';
		}).join('');
	} catch (e) {
		el.innerHTML = '<div class="empty" style="color:var(--fail)">加载失败：' + escapeHtml(e.message) + ' <span class="detail-toggle" onclick="loadTeams()">重试</span></div>';
	}
}

var _planCache = {};

async function loadRuns() {
	var el = $('runs-list');
	el.innerHTML = '<div class="loading"><div class="spinner"></div> 加载中...</div>';
	try {
		var runs = await api('/runs');
		if (!runs.length) { el.innerHTML = '<div class="empty">暂无运行记录。</div>'; unsubscribeAllSSE(); return; }
		var planIds = [];
		runs.forEach(function(r) { if (r.planId && planIds.indexOf(r.planId) === -1) planIds.push(r.planId); });
		await Promise.all(planIds.map(async function(pid) {
			if (!_planCache[pid]) {
				try { _planCache[pid] = await api('/plans/' + pid); } catch (e) { /* ignore */ }
			}
		}));
		el.innerHTML = runs.map(function(r) {
			var plan = _planCache[r.planId];
			var planTitle = plan ? plan.title : '';
			var total = r.summary.totalTasks;
			var done = r.summary.succeededTasks + r.summary.failedTasks + r.summary.cancelledTasks;
			var pct = total ? Math.round(done / total * 100) : 0;
			var summaryParts = [];
			if (r.summary.succeededTasks) summaryParts.push('成功 ' + r.summary.succeededTasks);
			if (r.summary.failedTasks) summaryParts.push('失败 ' + r.summary.failedTasks);
			if (r.summary.cancelledTasks) summaryParts.push('取消 ' + r.summary.cancelledTasks);
			var summaryStr = summaryParts.length ? summaryParts.join(' / ') : '无完成';
			var errorHtml = r.lastError ? '<p class="run-error" style="font-size:12px;color:var(--fail);margin-top:4px">错误：' + escapeHtml(r.lastError) + '</p>' : '<p class="run-error" style="display:none;font-size:12px;color:var(--fail);margin-top:4px"></p>';
			var currentTaskTitle = '';
			if (r.currentTaskId && plan) {
				var task = plan.tasks.find(function(t) { return t.id === r.currentTaskId; });
				currentTaskTitle = task ? task.title : r.currentTaskId;
			} else if (r.currentTaskId) {
				currentTaskTitle = r.currentTaskId;
			}
			var currentTask = currentTaskTitle ? '<p class="run-current" style="font-size:12px;color:var(--muted)">当前任务：' + escapeHtml(currentTaskTitle) + '</p>' : '<p class="run-current" style="display:none;font-size:12px;color:var(--muted)"></p>';
			var timesHtml = '<p class="run-times" style="font-size:11px;color:var(--muted)"><span class="ts">创建：' + formatTimestamp(r.createdAt) + '</span>';
			if (r.startedAt) timesHtml += '<span class="ts">开始：' + formatTimestamp(r.startedAt) + '</span>';
			if (r.finishedAt) timesHtml += '<span class="ts">完成：' + formatTimestamp(r.finishedAt) + '</span>';
			timesHtml += '</p>';
			return '<div class="card" data-run-id="' + r.runId + '">' +
				'<h3>' + (planTitle ? '<span class="plan-title">' + escapeHtml(planTitle) + '</span> ' : '') + '<span class="run-id">' + escapeHtml(r.runId.slice(0, 12)) + '...</span> <span class="run-badge">' + statusBadge(r.status) + '</span></h3>' +
				'<p class="run-progress" style="font-size:13px;color:var(--muted)">任务进度：' + done + '/' + total + '（' + summaryStr + '）</p>' +
				'<p class="run-elapsed" style="font-size:13px;color:var(--muted)">耗时：' + formatDuration(r.activeElapsedMs) + '</p>' +
				timesHtml +
				currentTask + errorHtml +
				'<div class="progress-bar"><div class="progress-bar-fill" style="width:' + pct + '%"></div></div>' +
				'<div class="run-actions" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">' +
				renderRunActions(r) +
				'</div>' +
				'<div id="run-detail-' + r.runId + '" class="run-detail"></div>' +
				'</div>';
		}).join('');
		subscribeActiveRuns(runs);
	} catch (e) {
		el.innerHTML = '<div class="empty" style="color:var(--fail)">加载失败：' + escapeHtml(e.message) + ' <span class="detail-toggle" onclick="loadRuns()">重试</span></div>';
		unsubscribeAllSSE();
	}
}

async function toggleRunDetail(runId) {
	var detailEl = $('run-detail-' + runId);
	if (!detailEl) return;
	if (detailEl.style.display === 'block') {
		detailEl.style.display = 'none';
		return;
	}
	try {
		var state = await api('/runs/' + runId);
		if (!_planCache[state.planId]) {
			_planCache[state.planId] = await api('/plans/' + state.planId);
		}
		var plan = _planCache[state.planId];
		if (!window._latestPlanForRun) window._latestPlanForRun = {};
		window._latestPlanForRun[runId] = plan;
		var attemptsMap = {};
		try {
			var taskIds = plan.tasks ? plan.tasks.map(function(t) { return t.id; }) : [];
			await Promise.all(taskIds.map(async function(tid) {
				var res = await api('/runs/' + runId + '/tasks/' + tid + '/attempts');
				attemptsMap[tid] = res.attempts || [];
			}));
		} catch (e) { /* ignore */ }
		if (!window._latestAttemptsForRun) window._latestAttemptsForRun = {};
		window._latestAttemptsForRun[runId] = attemptsMap;
		detailEl.innerHTML = renderTaskDetail(state, plan, attemptsMap);
		detailEl.style.display = 'block';
	} catch (e) {
		detailEl.innerHTML = '<p style="color:var(--fail);font-size:13px">加载失败：' + escapeHtml(e.message) + '</p>';
		detailEl.style.display = 'block';
	}
}

function renderTaskDetail(state, plan, attemptsMap) {
	if (!plan || !plan.tasks || !plan.tasks.length) return '<p style="color:var(--muted);font-size:13px">无任务数据。</p>';
	return '<table class="task-table">' +
		'<tr><th>任务</th><th>状态</th><th>详情</th></tr>' +
		plan.tasks.map(function(task) {
			var ts = state.taskStates[task.id];
			if (!ts) return '<tr><td>' + escapeHtml(task.title) + '</td><td colspan="2">待执行</td></tr>';
			var phaseHtml = ts.progress ? '<span class="phase-label ' + phaseColor(ts.progress.phase) + '">' + escapeHtml(phaseLabel(ts.progress.phase)) + '</span>' : '';
			var msgStr = ts.progress ? escapeHtml(ts.progress.message) : '';
			var detailParts = [];
			if (ts.attemptCount > 0) detailParts.push('尝试 ' + ts.attemptCount + ' 次');
			if (ts.activeAttemptId) detailParts.push('尝试ID: ' + escapeHtml(ts.activeAttemptId.slice(0, 12)) + '...');
			if (ts.resultRef) detailParts.push('<span style="color:var(--success)">结果: ' + escapeHtml(ts.resultRef) + '</span>');
			if (ts.errorSummary) detailParts.push('<span style="color:var(--fail)">错误: ' + escapeHtml(ts.errorSummary) + '</span>');
			var attemptsHtml = '';
			var attempts = attemptsMap && attemptsMap[task.id];
			if (attempts && attempts.length > 0) {
				attemptsHtml = attempts.map(function(a) {
					var statusColor = a.status === 'succeeded' ? 'var(--success)' : a.status === 'failed' ? 'var(--fail)' : 'var(--muted)';
					var filesHtml = a.files.map(function(f) {
						return '<span class="attempt-file" onclick="viewAttemptFile(\\'' + state.runId + '\\',\\'' + task.id + '\\',\\'' + a.attemptId + '\\',\\'' + f + '\\')">' + escapeHtml(f) + '</span>';
					}).join('');
					return '<div class="attempt-card">' +
						'<span style="color:' + statusColor + '">' + escapeHtml(a.status) + '</span> ' +
						escapeHtml(a.attemptId.slice(0, 12)) + '... ' +
						'<span class="ts">' + formatTimestamp(a.createdAt) + '</span>' +
						(a.files.length > 0 ? '<div class="attempt-files">' + filesHtml + '</div>' : '') +
						'</div>';
				}).join('');
			}
			return '<tr>' +
				'<td>' + escapeHtml(task.title) + '</td>' +
				'<td>' + statusBadge(ts.status) + '<br/>' + phaseHtml + '</td>' +
				'<td style="font-size:12px">' +
				(msgStr ? '<div style="color:var(--muted)">' + msgStr + '</div>' : '') +
				(detailParts.length ? '<div>' + detailParts.join(' / ') + '</div>' : '') +
				attemptsHtml +
				'</td></tr>';
		}).join('') +
		'</table>';
}

async function editTeamUnit(id) {
	var teams = await api('/team-units');
	var unit = teams.find(function(t) { return t.teamUnitId === id; });
	if (unit) openTeamUnitModal(unit);
}

async function archiveTeamUnit(id) {
	if (!confirm('确认归档此预设团队？')) return;
	await api('/team-units/' + id + '/archive', { method: 'POST' });
	loadTeams();
}

async function createPlan() {
	var teams = await api('/team-units');
	if (!teams.length) { alert('请先创建预设团队。'); return; }
	var active = teams.filter(function(t) { return !t.archived; });
	if (!active.length) { alert('没有可用的预设团队（全部已归档）。'); return; }
	var unitId = active[0].teamUnitId;
	var title = prompt('计划名称：');
	if (!title) return;
	var goalText = prompt('目标：') || '';
	await api('/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title, defaultTeamUnitId: unitId, goal: { text: goalText }, tasks: [{ id: 'task_1', title: '任务1', input: { text: goalText }, acceptance: { rules: ['完成目标'] } }], outputContract: { text: '中文汇总' } }) });
	loadPlans();
}

async function startRun(planId) {
	try {
		await api('/plans/' + planId + '/runs', { method: 'POST' });
		showSection('runs');
		loadRuns();
		setTimeout(loadRuns, 2000);
	} catch (e) { alert(e.message); }
}

async function deletePlan(planId) {
	if (!confirm('确认删除此计划？')) return;
	await api('/plans/' + planId, { method: 'DELETE' });
	loadPlans();
}

async function controlRun(runId, action) {
	var btn = document.querySelector('[data-run-id="' + runId + '"] .run-actions');
	if (btn) btn.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
	try {
		await api('/runs/' + runId + '/' + action, { method: 'POST' });
	} catch (e) {
		alert(e.message);
	}
	loadRuns();
}

async function deleteRun(runId) {
	if (!confirm('确认删除此运行记录？')) return;
	var btn = document.querySelector('[data-run-id="' + runId + '"] .run-actions');
	if (btn) btn.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
	try {
		await api('/runs/' + runId, { method: 'DELETE' });
	} catch (e) {
		alert(e.message);
	}
	loadRuns();
}

async function viewReport(runId) {
	var body = $('report-body');
	$('report-modal').classList.add('open');
	body.innerHTML = '<div class="loading"><div class="spinner"></div> 加载中...</div>';
	try {
		var res = await fetch(API + '/runs/' + runId + '/final-report');
		if (res.ok) {
			var text = await res.text();
			body.innerHTML = '<pre>' + escapeHtml(text) + '</pre>';
		} else {
			body.innerHTML = '<p style="color:var(--fail)">报告未找到。</p>';
		}
	} catch (e) {
		body.innerHTML = '<p style="color:var(--fail)">加载失败：' + escapeHtml(e.message) + '</p>';
	}
}

function closeReportModal() {
	$('report-modal').classList.remove('open');
}

async function viewAttemptFile(runId, taskId, attemptId, fileName) {
	var viewer = $('file-viewer');
	var title = $('file-viewer-title');
	var body = $('file-viewer-body');
	title.textContent = fileName;
	body.textContent = '加载中...';
	viewer.classList.add('open');
	try {
		var res = await fetch(API + '/runs/' + runId + '/tasks/' + taskId + '/attempts/' + attemptId + '/files/' + fileName);
		if (res.ok) {
			var text = await res.text();
			body.textContent = text;
		} else {
			body.innerHTML = '<span style="color:var(--fail)">文件未找到。</span>';
		}
	} catch (e) {
		body.innerHTML = '<span style="color:var(--fail)">加载失败：' + escapeHtml(e.message) + '</span>';
	}
}

function closeFileViewer() {
	$('file-viewer').classList.remove('open');
}


// SSE management
var _sseConnections = {};

function subscribeRunSSE(runId) {
	if (_sseConnections[runId]) return;
	try {
		var es = new EventSource(API + "/runs/" + runId + "/events");
		_sseConnections[runId] = es;
		es.onmessage = function(evt) {
			try {
				var payload = JSON.parse(evt.data);
				if (payload.type === "snapshot" && payload.data) {
					updateRunCard(payload.data);
				}
			} catch(e) {}
		};
		es.onerror = function() {
			es.close();
			delete _sseConnections[runId];
		};
	} catch(e) {
		// SSE not supported or failed; silent fallback
	}
}

function unsubscribeRunSSE(runId) {
	if (_sseConnections[runId]) {
		_sseConnections[runId].close();
		delete _sseConnections[runId];
	}
}

function unsubscribeAllSSE() {
	Object.keys(_sseConnections).forEach(function(k) {
		_sseConnections[k].close();
	});
	_sseConnections = {};
}

function renderRunActions(r) {
	var html = '<span class="detail-toggle" onclick="toggleRunDetail(\\'' + r.runId + '\\')">展开任务详情</span>';
	if (r.status === 'running') html += '<button class="btn btn-primary btn-sm" onclick="controlRun(\\'' + r.runId + '\\', \\'pause\\')">暂停</button><button class="btn btn-danger btn-sm" onclick="controlRun(\\'' + r.runId + '\\', \\'cancel\\')">取消</button>';
	if (r.status === 'paused') html += '<button class="btn btn-primary btn-sm" onclick="controlRun(\\'' + r.runId + '\\', \\'resume\\')">恢复</button><button class="btn btn-danger btn-sm" onclick="controlRun(\\'' + r.runId + '\\', \\'cancel\\')">取消</button>';
	if (r.status === 'completed' || r.status === 'completed_with_failures' || r.status === 'failed') html += '<button class="btn btn-primary btn-sm" onclick="viewReport(\\'' + r.runId + '\\')">查看报告</button><button class="btn btn-danger btn-sm" onclick="deleteRun(\\'' + r.runId + '\\')">删除</button>';
	if (r.status === 'cancelled') html += '<button class="btn btn-danger btn-sm" onclick="deleteRun(\\'' + r.runId + '\\')">删除</button>';
	return html;
}

function updateRunCard(r) {
	var card = document.querySelector("[data-run-id='" + r.runId + "']");
	if (!card) return;
	var total = r.summary.totalTasks;
	var done = r.summary.succeededTasks + r.summary.failedTasks + r.summary.cancelledTasks;
	var pct = total ? Math.round(done / total * 100) : 0;
	var summaryParts = [];
	if (r.summary.succeededTasks) summaryParts.push("成功 " + r.summary.succeededTasks);
	if (r.summary.failedTasks) summaryParts.push("失败 " + r.summary.failedTasks);
	if (r.summary.cancelledTasks) summaryParts.push("取消 " + r.summary.cancelledTasks);
	var summaryStr = summaryParts.length ? summaryParts.join(" / ") : "无完成";

	var badgeEl = card.querySelector(".run-badge");
	if (badgeEl) badgeEl.innerHTML = statusBadge(r.status);
	var progressText = card.querySelector(".run-progress");
	if (progressText) progressText.textContent = "任务进度：" + done + "/" + total + "（" + summaryStr + "）";
	var elapsedEl = card.querySelector(".run-elapsed");
	if (elapsedEl) elapsedEl.textContent = "耗时：" + formatDuration(r.activeElapsedMs);
	var currentEl = card.querySelector(".run-current");
	if (currentEl) {
		var plan = _planCache[r.planId];
		var taskTitle = r.currentTaskId;
		if (plan && r.currentTaskId) {
			var task = plan.tasks.find(function(t) { return t.id === r.currentTaskId; });
			if (task) taskTitle = task.title;
		}
		currentEl.textContent = taskTitle ? "当前任务：" + taskTitle : "";
		currentEl.style.display = taskTitle ? "" : "none";
	}
	var errorEl = card.querySelector(".run-error");
	if (errorEl) {
		if (r.lastError) { errorEl.textContent = "错误：" + r.lastError; errorEl.style.display = ""; }
		else { errorEl.style.display = "none"; }
	}
	var barFill = card.querySelector(".progress-bar-fill");
	if (barFill) barFill.style.width = pct + "%";

	// Update action buttons
	var actionsEl = card.querySelector(".run-actions");
	if (actionsEl) actionsEl.innerHTML = renderRunActions(r);

	// Update task detail if expanded
	var detailEl = card.querySelector(".run-detail");
	if (detailEl && detailEl.style.display === "block" && window._latestPlanForRun) {
		var plan2 = window._latestPlanForRun[r.runId];
		if (plan2) {
			detailEl.innerHTML = renderTaskDetail(r, plan2, window._latestAttemptsForRun ? window._latestAttemptsForRun[r.runId] : null);
		}
	}

	var TERMINAL = { completed: 1, completed_with_failures: 1, failed: 1, cancelled: 1 };
	if (TERMINAL[r.status]) {
		unsubscribeRunSSE(r.runId);
		loadRuns();
	}
}

function subscribeActiveRuns(runs) {
	var ACTIVE = { queued: 1, running: 1, paused: 1 };
	var currentActiveIds = {};
	runs.forEach(function(r) {
		if (ACTIVE[r.status]) {
			currentActiveIds[r.runId] = 1;
			subscribeRunSSE(r.runId);
		}
	});
	Object.keys(_sseConnections).forEach(function(k) {
		if (!currentActiveIds[k]) unsubscribeRunSSE(k);
	});
}

// Click outside modals to close
$('teamunit-modal').addEventListener('click', function(e) {
	if (e.target === $('teamunit-modal')) closeTeamUnitModal();
});
$('report-modal').addEventListener('click', function(e) {
	if (e.target === $('report-modal')) closeReportModal();
});
$('file-viewer').addEventListener('click', function(e) {
	if (e.target === $('file-viewer')) closeFileViewer();
});

// Initial load
loadAgents().then(function() {
	loadPlans();
});
</script>
</body>
</html>`;
}
