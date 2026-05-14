import {
	getStandaloneBaseCss,
	getStandaloneBaseJs,
	renderStandaloneToastContainer,
	STANDALONE_FAVICON,
	STANDALONE_THEME_INLINE_SCRIPT,
} from "./standalone-page-shared.js";

function getTeamPageCss(): string {
	return `
		:root, [data-theme="dark"] {
			--team-bg: #070A12;
			--team-surface: #0F1524;
			--team-surface-2: #121A2B;
			--team-sidebar: #0B1020;
			--team-input: #080D18;
			--team-border: #202A44;
			--team-border-strong: #334569;
			--team-fg: #F8FAFC;
			--team-muted: #64748B;
			--team-secondary: #CBD5E1;
			--team-primary: #6366F1;
			--team-primary-soft: rgba(99, 102, 241, 0.16);
			--team-green: #22C55E;
			--team-green-soft: rgba(34, 197, 94, 0.14);
			--team-amber: #F59E0B;
			--team-amber-soft: rgba(245, 158, 11, 0.14);
			--team-red: #FF4D6D;
			--team-red-soft: rgba(255, 77, 109, 0.14);
			--team-violet: #8B5CF6;
			--team-violet-soft: rgba(139, 92, 246, 0.14);
		}
		[data-theme="light"] {
			--team-bg: #F0F2F8;
			--team-surface: #FFFFFF;
			--team-surface-2: #F8F9FC;
			--team-sidebar: #F4F5FA;
			--team-input: #FFFFFF;
			--team-border: #D4D9E6;
			--team-border-strong: #AAB5CA;
			--team-fg: #1A1F36;
			--team-muted: #8896AB;
			--team-secondary: #4A5568;
			--team-primary: #5B5BD6;
			--team-primary-soft: rgba(91, 91, 214, 0.10);
			--team-green: #16A34A;
			--team-green-soft: rgba(22, 163, 74, 0.10);
			--team-amber: #D97706;
			--team-amber-soft: rgba(217, 119, 6, 0.10);
			--team-red: #E11D48;
			--team-red-soft: rgba(225, 29, 72, 0.10);
			--team-violet: #7C3AED;
			--team-violet-soft: rgba(124, 58, 237, 0.10);
		}

		html, body { background: var(--team-bg); }
		#app {
			display: grid;
			grid-template-rows: auto auto minmax(0, 1fr);
			height: 100%;
			overflow: hidden;
			background: transparent;
		}
		body[data-standalone-theme="cockpit"] .team-stat-card {
			background: rgba(15, 21, 36, 0.86);
			backdrop-filter: blur(14px);
		}
		[data-theme="light"] body[data-standalone-theme="cockpit"] .team-stat-card,
		body[data-standalone-theme="cockpit"][data-theme="light"] .team-stat-card {
			background: rgba(255, 255, 255, 0.86);
		}

		.team-stats {
			display: grid;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 16px;
			padding: 20px 24px;
		}
		.team-stat-card {
			min-height: 104px;
			padding: 18px 20px;
			border: 1px solid var(--team-border);
			border-radius: 8px;
			background: var(--team-surface);
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 14px;
		}
		.team-stat-label { font-size: 12px; font-weight: 700; color: var(--team-muted); }
		.team-stat-value { margin-top: 8px; font-size: 30px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
		.team-stat-desc { margin-top: 6px; font-size: 11px; color: var(--team-muted); }
		.team-stat-icon {
			width: 44px; height: 44px; border-radius: 8px;
			display: flex; align-items: center; justify-content: center;
			flex-shrink: 0;
		}
		.team-stat-icon svg { width: 22px; height: 22px; stroke: currentColor; fill: none; }
		.team-stat-card--blue .team-stat-value, .team-stat-card--blue .team-stat-icon { color: var(--team-primary); }
		.team-stat-card--blue .team-stat-icon { background: var(--team-primary-soft); }
		.team-stat-card--green .team-stat-value, .team-stat-card--green .team-stat-icon { color: var(--team-green); }
		.team-stat-card--green .team-stat-icon { background: var(--team-green-soft); }
		.team-stat-card--amber .team-stat-value, .team-stat-card--amber .team-stat-icon { color: var(--team-amber); }
		.team-stat-card--amber .team-stat-icon { background: var(--team-amber-soft); }
		.team-stat-card--violet .team-stat-value, .team-stat-card--violet .team-stat-icon { color: var(--team-violet); }
		.team-stat-card--violet .team-stat-icon { background: var(--team-violet-soft); }

		.team-main {
			display: grid;
			grid-template-columns: 360px minmax(0, 1fr);
			gap: 16px;
			min-height: 0;
			padding: 0 24px 24px;
			overflow: hidden;
		}
		.team-sidebar,
		.team-detail {
			min-height: 0;
			overflow: hidden;
			border: 1px solid var(--team-border);
			border-radius: 8px;
			background: var(--team-surface);
		}
		.team-sidebar {
			display: grid;
			grid-template-rows: auto minmax(0, 1fr);
			background: var(--team-sidebar);
		}
		.team-create {
			border-bottom: 1px solid var(--team-border);
			padding: 16px;
			display: grid;
			gap: 12px;
		}
		.team-field { display: grid; gap: 5px; }
		.team-field span { font-size: 11px; font-weight: 700; color: var(--team-muted); }
		.team-input,
		.team-select,
		.team-textarea {
			width: 100%;
			border: 1px solid var(--team-border);
			border-radius: 8px;
			background: var(--team-input);
			color: var(--team-fg);
			font-family: var(--font-sans);
			font-size: 12px;
			outline: none;
		}
		.team-input, .team-select { height: 38px; padding: 0 10px; }
		.team-textarea { min-height: 72px; resize: vertical; padding: 9px 10px; line-height: 1.5; }
		.team-input:focus,
		.team-select:focus,
		.team-textarea:focus { border-color: var(--team-primary); box-shadow: 0 0 0 3px var(--team-primary-soft); }
		.team-form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
		.team-btn {
			display: inline-flex; align-items: center; justify-content: center; gap: 6px;
			height: 36px; padding: 0 14px;
			border: 1px solid var(--team-border);
			border-radius: 8px;
			background: transparent;
			color: var(--team-secondary);
			font-family: var(--font-sans);
			font-size: 12px; font-weight: 700;
			cursor: pointer;
			white-space: nowrap;
		}
		.team-btn:hover { border-color: var(--team-border-strong); background: var(--team-primary-soft); color: var(--team-fg); }
		.team-btn:disabled { opacity: 0.45; cursor: not-allowed; }
		.team-btn--primary { border-color: var(--team-primary); background: linear-gradient(135deg, var(--team-primary), var(--team-violet)); color: #fff; }
		.team-btn svg { width: 14px; height: 14px; stroke: currentColor; fill: none; }
		.team-runs-head {
			display: flex; align-items: center; justify-content: space-between; gap: 10px;
			padding: 14px 16px 10px;
		}
		.team-runs-head strong { font-size: 13px; }
		.team-run-list { min-height: 0; overflow-y: auto; padding: 0 8px 8px; }
		.team-run-item {
			display: grid; gap: 6px;
			width: 100%; margin-bottom: 6px; padding: 13px 14px;
			border: 1px solid transparent; border-radius: 8px;
			background: rgba(18, 26, 43, 0.88);
			color: var(--team-fg);
			text-align: left; cursor: pointer;
			font-family: var(--font-sans);
		}
		[data-theme="light"] .team-run-item { background: #fff; }
		.team-run-item:hover,
		.team-run-item.selected { border-color: var(--team-primary); background: var(--team-primary-soft); }
		.team-run-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
		.team-run-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
		.team-run-meta { font-size: 11px; color: var(--team-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.team-badge {
			display: inline-flex; align-items: center; padding: 3px 9px;
			border-radius: 999px; font-size: 10px; font-weight: 800;
			letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap;
		}
		.team-badge--queued { background: rgba(100,116,139,0.16); color: var(--team-muted); }
		.team-badge--running { background: var(--team-primary-soft); color: var(--team-primary); }
		.team-badge--completed { background: var(--team-green-soft); color: var(--team-green); }
		.team-badge--blocked { background: var(--team-amber-soft); color: var(--team-amber); }
		.team-badge--failed { background: var(--team-red-soft); color: var(--team-red); }

		.team-detail {
			display: grid;
			grid-template-rows: auto minmax(0, 1fr);
		}
		.team-detail-head {
			display: flex; align-items: center; gap: 10px;
			border-bottom: 1px solid var(--team-border);
			padding: 16px 20px;
		}
		.team-detail-title {
			font-size: 16px; font-weight: 800; flex: 1; min-width: 0;
			overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
		}
		.team-detail-body { min-height: 0; overflow-y: auto; padding: 20px; }
		.team-card {
			border: 1px solid var(--team-border);
			border-radius: 8px;
			background: var(--team-surface-2);
			padding: 18px;
		}
		.team-card + .team-card { margin-top: 16px; }
		.team-card-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; font-size: 13px; font-weight: 800; color: var(--team-secondary); }
		.team-detail-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
		.team-kv { display: grid; gap: 4px; min-width: 0; }
		.team-kv span { font-size: 11px; color: var(--team-muted); font-weight: 700; }
		.team-kv strong { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.team-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
		.team-tab {
			height: 30px; padding: 0 11px;
			border-radius: 999px; border: 1px solid var(--team-border);
			background: transparent; color: var(--team-muted);
			font-family: var(--font-sans); font-size: 11px; font-weight: 800;
			cursor: pointer;
		}
		.team-tab.active { background: var(--team-primary); border-color: var(--team-primary); color: #fff; }
		.team-code {
			width: 100%;
			max-height: 360px;
			overflow: auto;
			padding: 14px;
			border: 1px solid var(--team-border);
			border-radius: 8px;
			background: var(--team-input);
			color: var(--team-secondary);
			font-family: var(--font-mono);
			font-size: 12px;
			line-height: 1.55;
			white-space: pre-wrap;
			word-break: break-word;
		}
		.team-event-list { display: grid; gap: 8px; }
		.team-event-item {
			display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 10px;
			padding: 10px 12px; border: 1px solid var(--team-border); border-radius: 8px;
			background: var(--team-surface);
		}
		.team-event-time { color: var(--team-muted); font-family: var(--font-mono); font-size: 11px; }
		.team-event-type { font-weight: 800; }
		.team-empty { padding: 64px 18px; text-align: center; color: var(--team-muted); }
		.team-empty strong { display: block; color: var(--team-secondary); font-size: 15px; margin-bottom: 4px; }
		.team-error {
			padding: 10px 12px; border: 1px solid var(--team-red-soft); border-radius: 8px;
			background: var(--team-red-soft); color: var(--team-red); font-size: 12px;
		}
		.team-error[hidden] { display: none; }

		@media (max-width: 900px) {
			.team-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 14px; gap: 10px; }
			.team-main { grid-template-columns: 1fr; padding: 0 14px 14px; overflow-y: auto; }
			.team-sidebar, .team-detail { min-height: 420px; }
			.team-detail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
			.team-form-grid { grid-template-columns: 1fr; }
			html, body, #app { overflow: auto; height: auto; min-height: 100%; }
		}
	`;
}

function getTeamPageJs(): string {
	return `
		const STREAM_NAMES = ["candidate_domains", "domain_evidence", "domain_classifications", "review_findings"];
		const DEFAULT_ARTIFACT_NAMES = ["final_report.md", "competitor_domain_report.md"];
		const state = {
			templates: [],
			selectedTemplateId: "",
			runIds: [],
			runs: {},
			selectedRunId: "",
			events: [],
			streamItems: {},
			artifactText: "",
			activeTab: "plan",
			eventSource: null,
			eventStreamStatus: "",
			loading: false,
			creating: false,
		};

		function statusClass(status) {
			return "team-badge team-badge--" + String(status || "queued");
		}

		function currentTemplate() {
			return state.templates.find(function(template) { return template.templateId === state.selectedTemplateId; }) || state.templates[0] || null;
		}

		function renderStats() {
			document.getElementById("team-stat-templates").textContent = String(state.templates.length);
			document.getElementById("team-stat-runs").textContent = String(state.runIds.length);
			var running = Object.values(state.runs).filter(function(item) { return item && item.state && item.state.status === "running"; }).length;
			var completed = Object.values(state.runs).filter(function(item) { return item && item.state && item.state.status === "completed"; }).length;
			document.getElementById("team-stat-running").textContent = String(running);
			document.getElementById("team-stat-completed").textContent = String(completed);
		}

		async function apiFetchTemplates() {
			const data = await fetchJson("/v1/team/templates");
			state.templates = Array.isArray(data.templates) ? data.templates : [];
			if (!state.selectedTemplateId && state.templates.length) {
				state.selectedTemplateId = state.templates[0].templateId;
			}
		}

	async function apiFetchRuns() {
			const data = await fetchJson("/v1/team/runs?scope=all");
			state.runIds = Array.isArray(data) ? data : (Array.isArray(data.runIds) ? data.runIds : []);
			await Promise.all(state.runIds.map(function(runId) {
				return apiFetchRunDetail(runId).catch(function() {});
			}));
		}

		async function apiFetchRunDetail(teamRunId) {
			const data = await fetchJson("/v1/team/runs/" + encodeURIComponent(teamRunId));
			state.runs[teamRunId] = data;
			return data;
		}

		async function apiFetchRunEvents(teamRunId) {
			const data = await fetchJson("/v1/team/runs/" + encodeURIComponent(teamRunId) + "/events");
			state.events = Array.isArray(data.events) ? data.events : [];
		}

		async function apiFetchStream(teamRunId, streamName) {
			const data = await fetchJson("/v1/team/runs/" + encodeURIComponent(teamRunId) + "/streams/" + encodeURIComponent(streamName));
			state.streamItems[streamName] = Array.isArray(data.items) ? data.items : [];
			return state.streamItems[streamName];
		}

		async function apiFetchArtifact(teamRunId, artifactName) {
			const res = await fetch("/v1/team/runs/" + encodeURIComponent(teamRunId) + "/artifacts/" + encodeURIComponent(artifactName));
			if (!res.ok) throw new Error("HTTP " + res.status);
			state.artifactText = await res.text();
		}

		function closeRunEventStream() {
			if (state.eventSource) {
				state.eventSource.close();
				state.eventSource = null;
			}
		}

		function subscribeRunEvents(teamRunId) {
			closeRunEventStream();
			if (!teamRunId || typeof EventSource === "undefined") return;
			state.eventStreamStatus = "实时接收中";
			const source = new EventSource("/v1/team/runs/" + encodeURIComponent(teamRunId) + "/events/stream");
			state.eventSource = source;
			source.onmessage = function(event) {
				if (teamRunId !== state.selectedRunId) return;
				try {
					const payload = JSON.parse(event.data);
					if (!state.events.some(function(item) { return item.eventId === payload.eventId; })) {
						state.events.push(payload);
					}
					if (payload.eventType === "stream_item_accepted") {
						const streamName = payload.data && payload.data.streamName;
						const refreshes = [apiFetchRunDetail(teamRunId)];
						if (STREAM_NAMES.includes(streamName)) {
							refreshes.push(apiFetchStream(teamRunId, streamName));
						}
						Promise.all(refreshes).then(function() {
							renderRunList();
							renderRunDetail();
							renderStats();
						}).catch(function() {});
					} else {
						renderRunDetail();
					}
				} catch {}
			};
			source.onerror = function() {
				if (teamRunId !== state.selectedRunId) return;
				state.eventStreamStatus = "事件流已断开，正在使用手动刷新";
				renderRunDetail();
			};
			renderRunDetail();
		}

		async function apiCreateRun(payload) {
			return fetchJson("/v1/team/runs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload),
			});
		}

		function renderTemplateSelect() {
			var select = document.getElementById("team-template-select");
			select.innerHTML = state.templates.map(function(template) {
				return '<option value="' + escapeHtml(template.templateId) + '"' + (template.templateId === state.selectedTemplateId ? " selected" : "") + '>' + escapeHtml(template.title || template.templateId) + '</option>';
			}).join("");
			renderTemplateHint();
		}

		function renderTemplateHint() {
			var template = currentTemplate();
			var el = document.getElementById("team-template-hint");
			if (!el) return;
			if (!template) {
				el.textContent = "Team Runtime API 未返回可用模板。";
				return;
			}
			el.textContent = (template.description || "") + " 默认预算：" + template.defaults.maxRounds + " rounds / " + template.defaults.maxCandidates + " candidates / " + template.defaults.maxMinutes + " minutes";
		}

		function getCreatePayload() {
			var keyword = (document.getElementById("team-run-keyword").value || "").trim();
			var names = (document.getElementById("team-run-company-names").value || "").split(/\\n|,/).map(function(item) { return item.trim(); }).filter(Boolean);
			var officialDomains = (document.getElementById("team-run-official-domains").value || "").split(/\\n|,/).map(function(item) { return item.trim(); }).filter(Boolean);
			var maxRounds = Number(document.getElementById("team-run-max-rounds").value || "1");
			var maxCandidates = Number(document.getElementById("team-run-max-candidates").value || "20");
			var maxMinutes = Number(document.getElementById("team-run-max-minutes").value || "15");
			return {
				templateId: state.selectedTemplateId,
				keyword: keyword,
				companyNames: names,
				officialDomains: officialDomains,
				maxRounds: maxRounds,
				maxCandidates: maxCandidates,
				maxMinutes: maxMinutes,
			};
		}

		function renderRunList() {
			var list = document.getElementById("team-run-list");
			if (!state.runIds.length) {
				list.innerHTML = '<div class="team-empty"><strong>暂无 Team Run</strong><span>创建一个 run 后会显示在这里。</span></div>';
				return;
			}
			list.innerHTML = state.runIds.map(function(runId) {
				var detail = state.runs[runId] || {};
				var stateBody = detail.state || {};
				var plan = detail.plan || {};
				return '<button class="team-run-item' + (runId === state.selectedRunId ? ' selected' : '') + '" type="button" data-run-id="' + escapeHtml(runId) + '">'
					+ '<div class="team-run-title"><strong>' + escapeHtml(stateBody.keyword || plan.keyword || runId) + '</strong><span class="' + statusClass(stateBody.status) + '">' + escapeHtml(stateBody.status || "queued") + '</span></div>'
					+ '<div class="team-run-meta">' + escapeHtml(plan.templateId || stateBody.templateId || "-") + '</div>'
					+ '<div class="team-run-meta">' + escapeHtml(runId) + '</div>'
					+ '</button>';
			}).join("");
			list.querySelectorAll("[data-run-id]").forEach(function(button) {
				button.addEventListener("click", function() { selectRun(button.getAttribute("data-run-id")); });
			});
		}

		function renderRunDetail() {
			var title = document.getElementById("team-detail-title");
			var body = document.getElementById("team-detail-body");
			var actions = document.getElementById("team-detail-actions");
			var detail = state.runs[state.selectedRunId];
			if (!detail) {
				title.textContent = "Team Runtime";
				actions.innerHTML = "";
				body.innerHTML = '<div class="team-empty"><strong>选择或创建一个 run</strong><span>左侧负责创建和选择，右侧查看计划、事件、streams 和报告。</span></div>';
				return;
			}
			var runState = detail.state || {};
			var plan = detail.plan || {};
			title.textContent = runState.keyword || plan.keyword || state.selectedRunId;
			actions.innerHTML = '<button id="team-refresh-detail" class="team-btn" type="button"><svg viewBox="0 0 24 24" stroke-width="1.8"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>刷新</button>';
			body.innerHTML = ''
				+ '<div class="team-card"><div class="team-card-title"><span>Run 状态</span><span class="' + statusClass(runState.status) + '">' + escapeHtml(runState.status || "-") + '</span></div>'
				+ (state.eventStreamStatus ? '<div class="team-run-meta" style="margin-bottom:12px">' + escapeHtml(state.eventStreamStatus) + '</div>' : '')
				+ '<div class="team-detail-grid">'
				+ kv("Run ID", state.selectedRunId)
				+ kv("Template", plan.templateId || runState.templateId || "-")
				+ kv("Round", String(runState.currentRound || 0) + " / " + String((runState.budgets || {}).maxRounds || "-"))
				+ kv("Created", formatTimestamp(runState.createdAt))
				+ kv("Candidates", String(((runState.counters || {}).candidateDomains) || 0))
				+ kv("Evidence", String(((runState.counters || {}).domainEvidence) || 0))
				+ kv("Classifications", String(((runState.counters || {}).classifications) || 0))
				+ kv("Review", String(((runState.counters || {}).reviewFindings) || 0))
				+ '</div></div>'
				+ '<div class="team-card"><div class="team-tabs">' + renderTabs(plan) + '</div><div id="team-tab-body"></div></div>';
			document.getElementById("team-refresh-detail").addEventListener("click", function() { refreshSelectedRun(); });
			body.querySelectorAll("[data-tab]").forEach(function(btn) {
				btn.addEventListener("click", function() {
					state.activeTab = btn.getAttribute("data-tab");
					renderRunDetail();
				});
			});
			renderTabBody(plan);
		}

		function kv(label, value) {
			return '<div class="team-kv"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
		}

		function renderTabs(plan) {
			var tabs = ["plan", "events"].concat(STREAM_NAMES);
			var deliverables = Array.isArray(plan.deliverables) && plan.deliverables.length ? plan.deliverables : DEFAULT_ARTIFACT_NAMES;
			deliverables.forEach(function(name) {
				if (/\\.md$/.test(name)) tabs.push("artifact:" + name);
			});
			return tabs.map(function(tab) {
				var label = tab === "plan" ? "Plan" : tab === "events" ? "Events" : tab.indexOf("artifact:") === 0 ? tab.slice(9) : tab;
				return '<button class="team-tab' + (state.activeTab === tab ? ' active' : '') + '" type="button" data-tab="' + escapeHtml(tab) + '">' + escapeHtml(label) + '</button>';
			}).join("");
		}

		function renderTabBody(plan) {
			var el = document.getElementById("team-tab-body");
			if (!el) return;
			if (state.activeTab === "plan") {
				el.innerHTML = '<pre class="team-code">' + escapeHtml(JSON.stringify(plan, null, 2)) + '</pre>';
				return;
			}
			if (state.activeTab === "events") {
				if (!state.events.length) {
					el.innerHTML = '<div class="team-empty"><strong>暂无事件</strong><span>点击刷新会重新读取 events。</span></div>';
					return;
				}
				el.innerHTML = '<div class="team-event-list">' + state.events.map(function(event) {
					return '<div class="team-event-item"><div class="team-event-time">' + escapeHtml(formatTimestamp(event.createdAt)) + '</div><div><div class="team-event-type">' + escapeHtml(event.eventType) + '</div><pre class="team-code" style="max-height:160px;margin-top:6px">' + escapeHtml(JSON.stringify(event.data || {}, null, 2)) + '</pre></div></div>';
				}).join("") + '</div>';
				return;
			}
			if (state.activeTab.indexOf("artifact:") === 0) {
				el.innerHTML = state.artifactText
					? '<pre class="team-code">' + escapeHtml(state.artifactText) + '</pre>'
					: '<div class="team-empty"><strong>报告尚未生成</strong><span>run 完成后再刷新查看 artifact。</span></div>';
				return;
			}
			var items = state.streamItems[state.activeTab] || [];
			el.innerHTML = items.length
				? '<pre class="team-code">' + escapeHtml(JSON.stringify(items, null, 2)) + '</pre>'
				: '<div class="team-empty"><strong>暂无 stream item</strong><span>' + escapeHtml(state.activeTab) + ' 还没有数据。</span></div>';
		}

		async function selectRun(runId) {
			if (!runId) return;
			state.selectedRunId = runId;
			state.activeTab = "plan";
			state.events = [];
			state.streamItems = {};
			state.artifactText = "";
			await refreshSelectedRun();
			subscribeRunEvents(runId);
		}

		async function refreshSelectedRun() {
			if (!state.selectedRunId) return;
			try {
				await apiFetchRunDetail(state.selectedRunId);
				await apiFetchRunEvents(state.selectedRunId).catch(function() {});
				await Promise.all(STREAM_NAMES.map(function(streamName) {
					return apiFetchStream(state.selectedRunId, streamName).catch(function() {});
				}));
				var detail = state.runs[state.selectedRunId] || {};
				var deliverables = (((detail.plan || {}).deliverables || DEFAULT_ARTIFACT_NAMES)).filter(function(name) { return /\\.md$/.test(name); });
				var artifactName = state.activeTab.indexOf("artifact:") === 0 ? state.activeTab.slice(9) : deliverables[0];
				if (artifactName) {
					await apiFetchArtifact(state.selectedRunId, artifactName).catch(function() { state.artifactText = ""; });
				}
				renderRunList();
				renderRunDetail();
				renderStats();
			} catch (e) {
				showToast(e.message || "读取 run 失败", "danger");
			}
		}

		async function handleCreateRun() {
			if (state.creating) return;
			var payload = getCreatePayload();
			if (!payload.keyword) {
				showToast("keyword 不能为空", "danger");
				return;
			}
			var btn = document.getElementById("team-create-run");
			state.creating = true;
			btn.disabled = true;
			btn.textContent = "创建中...";
			try {
				var result = await apiCreateRun(payload);
				state.selectedRunId = result.teamRunId;
				showToast("Team run 已创建", "ok");
				await loadAll();
				await selectRun(result.teamRunId);
			} catch (e) {
				showToast(e.message || "创建失败，请确认 TEAM_RUNTIME_ENABLED 已开启", "danger");
			} finally {
				state.creating = false;
				btn.disabled = false;
				btn.textContent = "创建 Run";
			}
		}

		async function loadAll() {
			var error = document.getElementById("team-page-error");
			error.hidden = true;
			try {
				await apiFetchTemplates();
				renderTemplateSelect();
				await apiFetchRuns();
				renderRunList();
				renderRunDetail();
				renderStats();
			} catch (e) {
				error.textContent = (e.message || "Team Runtime API 不可用") + "。请确认服务端已启用 TEAM_RUNTIME_ENABLED。";
				error.hidden = false;
				renderStats();
			}
		}

		document.addEventListener("DOMContentLoaded", function() {
			applyTheme(readStoredTheme());
			document.getElementById("team-template-select").addEventListener("change", function(event) {
				state.selectedTemplateId = event.target.value;
				renderTemplateHint();
			});
			document.getElementById("team-create-run").addEventListener("click", handleCreateRun);
			document.getElementById("team-refresh").addEventListener("click", loadAll);
			loadAll();
		});
	`;
}

export function renderTeamPage(): string {
	const css = getStandaloneBaseCss() + getTeamPageCss();
	const js = getStandaloneBaseJs() + getTeamPageJs();

	return `<!doctype html>
<html lang="zh-CN" data-theme="dark">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	${STANDALONE_THEME_INLINE_SCRIPT}
	<title>Team Runtime 工作台 - UGK Claw</title>
	<link rel="icon" href="${STANDALONE_FAVICON}" />
	<style>${css}</style>
</head>
<body data-standalone-theme="cockpit">
	<div id="app">
		<header class="sp-topbar">
			<a class="sp-topbar-back" href="/playground" title="返回">
				<svg viewBox="0 0 20 20" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4l-6 6 6 6"/></svg>
			</a>
			<strong class="sp-topbar-title">Team Runtime 工作台</strong>
			<div class="sp-topbar-spacer"></div>
			<button id="team-refresh" class="sp-topbar-btn" type="button">
				<svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
			</button>
			<button class="sp-topbar-btn" type="button" onclick="toggleTheme()" title="切换主题">
				<svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></svg>
			</button>
		</header>

		<section class="team-stats">
			<div class="team-stat-card team-stat-card--blue"><div><div class="team-stat-label">模板</div><div id="team-stat-templates" class="team-stat-value">0</div><div class="team-stat-desc">已注册 TeamTemplate</div></div><div class="team-stat-icon"><svg viewBox="0 0 24 24" stroke-width="1.8"><path d="M4 5h16M4 12h16M4 19h10"/></svg></div></div>
			<div class="team-stat-card team-stat-card--green"><div><div class="team-stat-label">运行中</div><div id="team-stat-running" class="team-stat-value">0</div><div class="team-stat-desc">当前 runnable run</div></div><div class="team-stat-icon"><svg viewBox="0 0 24 24" stroke-width="1.8"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div></div>
			<div class="team-stat-card team-stat-card--amber"><div><div class="team-stat-label">Run</div><div id="team-stat-runs" class="team-stat-value">0</div><div class="team-stat-desc">队列 / 运行中 run</div></div><div class="team-stat-icon"><svg viewBox="0 0 24 24" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 15h5"/></svg></div></div>
			<div class="team-stat-card team-stat-card--violet"><div><div class="team-stat-label">完成</div><div id="team-stat-completed" class="team-stat-value">0</div><div class="team-stat-desc">当前列表中的完成数</div></div><div class="team-stat-icon"><svg viewBox="0 0 24 24" stroke-width="1.8"><path d="M20 6L9 17l-5-5"/></svg></div></div>
		</section>

		<div class="team-main">
			<aside class="team-sidebar">
				<div class="team-create">
					<div id="team-page-error" class="team-error" hidden></div>
					<label class="team-field"><span>模板</span><select id="team-template-select" class="team-select"></select></label>
					<div id="team-template-hint" class="team-run-meta"></div>
					<label class="team-field"><span>Keyword</span><input id="team-run-keyword" class="team-input" placeholder="Medtrum" autocomplete="off" /></label>
					<label class="team-field"><span>公司 / 竞争对手名称</span><textarea id="team-run-company-names" class="team-textarea" placeholder="一行一个，或用逗号分隔"></textarea></label>
					<label class="team-field"><span>官方 / 已知域名</span><textarea id="team-run-official-domains" class="team-textarea" placeholder="example.com"></textarea></label>
					<div class="team-form-grid">
						<label class="team-field"><span>Rounds</span><input id="team-run-max-rounds" class="team-input" type="number" min="1" value="1" /></label>
						<label class="team-field"><span>Candidates</span><input id="team-run-max-candidates" class="team-input" type="number" min="1" value="20" /></label>
						<label class="team-field"><span>Minutes</span><input id="team-run-max-minutes" class="team-input" type="number" min="1" value="15" /></label>
					</div>
					<button id="team-create-run" class="team-btn team-btn--primary" type="button">创建 Run</button>
				</div>
				<div class="team-runs-head"><strong>Runs</strong><button class="team-btn" type="button" onclick="loadAll()">刷新</button></div>
				<div id="team-run-list" class="team-run-list"></div>
			</aside>
			<section class="team-detail">
				<div class="team-detail-head">
					<strong id="team-detail-title" class="team-detail-title">Team Runtime</strong>
					<div id="team-detail-actions"></div>
				</div>
				<div id="team-detail-body" class="team-detail-body"></div>
			</section>
		</div>
	</div>
	${renderStandaloneToastContainer()}
	<script>${js}</script>
</body>
</html>`;
}
