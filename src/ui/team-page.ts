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
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-weight: 500; font-size: 12px; }
.empty { text-align: center; color: var(--muted); padding: 40px 0; font-size: 14px; }
.progress-bar { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; margin-top: 4px; }
.progress-bar-fill { height: 100%; background: var(--accent); transition: width 0.3s; }

/* Modal */
.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; justify-content: center; align-items: center; }
.modal-overlay.open { display: flex; }
.modal { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; width: 480px; max-width: 95vw; max-height: 90vh; overflow-y: auto; padding: 24px; }
.modal h2 { font-size: 16px; margin-bottom: 16px; }
.modal label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 4px; margin-top: 12px; }
.modal input, .modal select, .modal textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: 13px; }
.modal textarea { min-height: 60px; resize: vertical; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
.profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.profile-grid .field { }
.profile-grid label { margin-top: 0; }
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
		<div id="plans-list"></div>
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
		<div style="margin-bottom:16px"><h2>运行记录</h2></div>
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
	return '<span class="badge ' + (map[status] || 'badge-muted') + '">' + status + '</span>';
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
	var plans = await api('/plans');
	var el = $('plans-list');
	if (!plans.length) { el.innerHTML = '<div class="empty">暂无计划。点击「新建计划」开始。</div>'; return; }
	el.innerHTML = plans.map(function(p) {
		return '<div class="card"><h3>' + escapeHtml(p.title) + ' <span class="badge badge-muted">' + p.tasks.length + ' 个任务</span></h3>' +
			'<p style="font-size:13px;color:var(--muted)">目标：' + escapeHtml(p.goal.text) + '</p>' +
			'<div style="margin-top:8px;display:flex;gap:8px">' +
			'<button class="btn btn-primary" onclick="startRun(\\'' + p.planId + '\\')">创建运行</button>' +
			(p.runCount === 0 ? '<button class="btn btn-danger" onclick="deletePlan(\\'' + p.planId + '\\')">删除</button>' : '') +
			'</div></div>';
	}).join('');
}

async function loadTeams() {
	var teams = await api('/team-units');
	var el = $('teams-list');
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
}

async function loadRuns() {
	var runs = await api('/runs');
	var el = $('runs-list');
	if (!runs.length) { el.innerHTML = '<div class="empty">暂无运行记录。</div>'; return; }
	el.innerHTML = runs.map(function(r) {
		var total = r.summary.totalTasks;
		var done = r.summary.succeededTasks + r.summary.failedTasks + r.summary.cancelledTasks;
		var pct = total ? Math.round(done / total * 100) : 0;
		return '<div class="card"><h3>运行 ' + r.runId.slice(0, 16) + '... ' + statusBadge(r.status) + '</h3>' +
			'<p style="font-size:13px;color:var(--muted)">任务进度：' + done + '/' + total + ' 个任务</p>' +
			'<p style="font-size:13px;color:var(--muted)">耗时统计：' + Math.round((r.activeElapsedMs || 0) / 1000) + ' 秒</p>' +
			'<div class="progress-bar"><div class="progress-bar-fill" style="width:' + pct + '%"></div></div>' +
			'<div style="margin-top:8px;display:flex;gap:8px">' +
			(r.status === 'running' ? '<button class="btn btn-primary" onclick="controlRun(\\'' + r.runId + '\\', \\'pause\\')">暂停</button><button class="btn btn-danger" onclick="controlRun(\\'' + r.runId + '\\', \\'cancel\\')">取消</button>' : '') +
			(r.status === 'paused' ? '<button class="btn btn-primary" onclick="controlRun(\\'' + r.runId + '\\', \\'resume\\')">恢复</button><button class="btn btn-danger" onclick="controlRun(\\'' + r.runId + '\\', \\'cancel\\')">取消</button>' : '') +
			(r.status === 'completed' || r.status === 'completed_with_failures' || r.status === 'failed' ? '<button class="btn btn-primary" onclick="viewReport(\\'' + r.runId + '\\')">查看报告</button><button class="btn btn-danger" onclick="deleteRun(\\'' + r.runId + '\\')">删除</button>' : '') +
			'</div></div>';
	}).join('');
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
	await api('/runs/' + runId + '/' + action, { method: 'POST' });
	loadRuns();
}

async function deleteRun(runId) {
	if (!confirm('确认删除此运行记录？')) return;
	await api('/runs/' + runId, { method: 'DELETE' });
	loadRuns();
}

async function viewReport(runId) {
	var res = await fetch(API + '/runs/' + runId + '/final-report');
	if (res.ok) { var text = await res.text(); var w = window.open('', '_blank'); w.document.write('<pre style="white-space:pre-wrap;font-family:sans-serif;padding:20px">' + escapeHtml(text) + '</pre>'); }
	else alert('报告未找到。');
}

// Click outside modal to close
$('teamunit-modal').addEventListener('click', function(e) {
	if (e.target === $('teamunit-modal')) closeTeamUnitModal();
});

// Initial load
loadAgents().then(function() {
	loadPlans();
});
</script>
</body>
</html>`;
}
