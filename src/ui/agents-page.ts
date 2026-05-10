import {
	getStandaloneBaseCss,
	getStandaloneBaseJs,
	renderStandaloneTopbar,
	renderStandaloneConfirmDialog,
	renderStandaloneToastContainer,
	STANDALONE_FAVICON,
} from "./standalone-page-shared.js";

function getAgentsPageCss(): string {
	return `
		/* ── page overrides ── */
		:root {
			--ag-bg: #070A12;
			--ag-sidebar: #0B1020;
			--ag-card: #0F172A;
			--ag-card-hi: #111C32;
			--ag-input: #080D19;
			--ag-border: #22304A;
			--ag-border-strong: #334569;
			--ag-text: #F8FAFC;
			--ag-text-2: #CBD5E1;
			--ag-muted: #64748B;
			--ag-label: #94A3B8;
			--ag-primary: #6366F1;
			--ag-primary-hi: #7C83FF;
			--ag-primary-glow: rgba(99,102,241,0.25);
			--ag-success: #22C55E;
			--ag-warn: #F59E0B;
			--ag-danger: #FF4D6D;
		}

		html, body { background: var(--ag-bg); }
		#app { background: var(--ag-bg); }

		/* overrides for standalone topbar */
		.sp-topbar { height: 56px; border-bottom: 1px solid var(--ag-border); background: var(--ag-bg); }
		.sp-topbar-back { width: 36px; height: 36px; border-radius: 10px; border-color: var(--ag-border); }
		.sp-topbar-back:hover { background: rgba(99,102,241,0.1); color: var(--ag-primary-hi); border-color: var(--ag-border-strong); }
		.sp-topbar-title { font-size: 18px; font-weight: 700; }
		.sp-topbar-btn { height: 36px; border-radius: 10px; border-color: var(--ag-border); padding: 0 14px; font-size: 12px; }
		.sp-topbar-btn:hover { background: rgba(99,102,241,0.08); border-color: var(--ag-border-strong); color: var(--ag-text-2); }

		.ag-topbar-new {
			background: linear-gradient(135deg, #6366F1, #8B5CF6) !important;
			border: none !important;
			color: #fff !important;
			font-weight: 600;
			box-shadow: 0 8px 24px var(--ag-primary-glow);
		}
		.ag-topbar-new:hover {
			filter: brightness(1.12);
			box-shadow: 0 12px 32px rgba(99,102,241,0.35);
			color: #fff !important;
			background: linear-gradient(135deg, #6D7DFF, #9B6CFF) !important;
		}

		/* ── page shell ── */
		.ag-page {
			display: grid;
			grid-template-rows: auto auto minmax(0, 1fr);
			min-height: 0;
			overflow: hidden;
			padding: 24px;
			gap: 16px;
		}

		/* ── stats ── */
		.ag-stats {
			display: grid;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 16px;
			flex-shrink: 0;
		}
		.ag-stat-card {
			display: flex;
			align-items: center;
			gap: 16px;
			padding: 18px 20px;
			border-radius: 16px;
			background: var(--ag-card);
			border: 1px solid var(--ag-border);
		}
		.ag-stat-card:first-child {
			border-color: rgba(99,102,241,0.35);
			background: linear-gradient(135deg, rgba(17,28,50,0.98), rgba(15,23,42,0.96));
		}
		.ag-stat-icon {
			width: 42px; height: 42px;
			border-radius: 12px;
			display: flex; align-items: center; justify-content: center;
			flex-shrink: 0;
		}
		.ag-stat-icon svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; }
		.ag-stat-icon-1 { background: rgba(99,102,241,0.14); color: var(--ag-primary-hi); }
		.ag-stat-icon-2 { background: rgba(34,197,94,0.12); color: var(--ag-success); }
		.ag-stat-icon-3 { background: rgba(245,158,11,0.12); color: var(--ag-warn); }
		.ag-stat-icon-4 { background: rgba(99,102,241,0.1); color: #8B9CFF; }
		.ag-stat-info { min-width: 0; }
		.ag-stat-label { font-size: 12px; color: var(--ag-label); margin-bottom: 2px; }
		.ag-stat-num { font-size: 28px; font-weight: 700; color: var(--ag-text); line-height: 1.1; }
		.ag-stat-sub { font-size: 11px; color: var(--ag-muted); margin-top: 2px; }

		/* ── main layout ── */
		.ag-main {
			display: grid;
			grid-template-columns: 320px minmax(0, 1fr);
			gap: 16px;
			min-height: 0;
			overflow: hidden;
		}

		/* ── section card ── */
		.ag-card {
			background: linear-gradient(180deg, rgba(17,28,50,0.96), rgba(15,23,42,0.96));
			border: 1px solid var(--ag-border);
			border-radius: 16px;
			padding: 20px;
		}
		.ag-card-head {
			display: flex; align-items: center; gap: 10px;
			margin-bottom: 16px;
			padding-bottom: 14px;
			border-bottom: 1px solid var(--ag-border);
		}
		.ag-card-icon {
			width: 28px; height: 28px;
			border-radius: 8px;
			background: rgba(99,102,241,0.14);
			color: var(--ag-primary-hi);
			display: flex; align-items: center; justify-content: center;
			flex-shrink: 0;
		}
		.ag-card-icon svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; }
		.ag-card-title { font-size: 15px; font-weight: 700; color: var(--ag-text); }
		.ag-card-sub { font-size: 12px; color: var(--ag-muted); margin-left: auto; }

		/* ── sidebar ── */
		.ag-sidebar {
			display: grid;
			grid-template-rows: auto auto minmax(0, 1fr);
			min-height: 0;
			overflow: hidden;
			gap: 12px;
		}
		.ag-search-wrap {
			position: relative; flex-shrink: 0;
		}
		.ag-search-input {
			width: 100%; height: 40px;
			padding: 0 12px 0 36px;
			border-radius: 10px;
			border: 1px solid var(--ag-border);
			background: var(--ag-input);
			color: var(--ag-text);
			font-size: 13px;
			outline: none;
			transition: border-color .18s, box-shadow .18s;
		}
		.ag-search-input::placeholder { color: var(--ag-muted); }
		.ag-search-input:focus { border-color: var(--ag-primary); box-shadow: 0 0 0 3px rgba(99,102,241,0.14); }
		.ag-search-icon {
			position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
			width: 16px; height: 16px; color: var(--ag-muted); pointer-events: none;
		}
		.ag-search-shortcut {
			position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
			font-size: 10px; color: var(--ag-muted);
			padding: 2px 5px; border-radius: 4px;
			background: rgba(255,255,255,0.04);
			font-family: var(--font-mono); pointer-events: none;
		}

		.ag-filter-tabs {
			display: flex; gap: 6px; flex-shrink: 0; overflow-x: auto;
			scrollbar-width: none; -ms-overflow-style: none;
		}
		.ag-filter-tabs::-webkit-scrollbar { display: none; }
		.ag-filter-tab {
			height: 28px; padding: 0 12px;
			border-radius: 999px;
			border: 1px solid var(--ag-border);
			background: transparent;
			color: var(--ag-muted);
			font-size: 12px; font-family: var(--font-sans);
			cursor: pointer; white-space: nowrap; flex-shrink: 0;
			transition: background .15s, color .15s, border-color .15s;
		}
		.ag-filter-tab:hover { background: rgba(99,102,241,0.08); color: var(--ag-text-2); }
		.ag-filter-tab.active {
			border-color: var(--ag-primary);
			background: linear-gradient(135deg, rgba(99,102,241,0.22), rgba(99,102,241,0.08));
			color: var(--ag-primary-hi); font-weight: 600;
		}

		.ag-agent-list { overflow-y: auto; min-height: 0; display: grid; gap: 8px; padding-right: 2px; }

		.ag-agent-item {
			display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center;
			gap: 10px;
			padding: 12px 14px;
			border-radius: 14px;
			border: 1px solid transparent;
			background: var(--ag-card);
			cursor: pointer;
			text-align: left; font-family: var(--font-sans);
			transition: border-color .18s, background .18s, box-shadow .18s;
		}
		.ag-agent-item:hover { border-color: var(--ag-border-strong); background: var(--ag-card-hi); }
		.ag-agent-item.selected {
			border-color: var(--ag-primary);
			background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(17,28,50,0.96));
			box-shadow: 0 0 0 1px rgba(99,102,241,0.18), 0 8px 28px rgba(0,0,0,0.22);
		}
		.ag-agent-icon-wrap {
			width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
			display: flex; align-items: center; justify-content: center;
			background: rgba(99,102,241,0.1); color: var(--ag-primary-hi);
		}
		.ag-agent-item.selected .ag-agent-icon-wrap { background: rgba(99,102,241,0.2); }
		.ag-agent-icon-wrap svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 1.6; }
		.ag-agent-info { min-width: 0; }
		.ag-agent-name { font-size: 13px; font-weight: 600; color: var(--ag-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.ag-agent-id { font-size: 10px; color: var(--ag-muted); font-family: var(--font-mono); margin-top: 1px; }
		.ag-agent-browser { font-size: 10px; color: var(--ag-muted); }
		.ag-agent-status-dot {
			width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0;
			background: var(--ag-border-strong);
		}
		.ag-agent-status-dot.active { background: var(--ag-success); box-shadow: 0 0 6px rgba(34,197,94,0.4); }
		.ag-agent-status-dot.viewing { background: var(--ag-primary); box-shadow: 0 0 6px rgba(99,102,241,0.4); }

		/* ── detail ── */
		.ag-detail { overflow-y: auto; min-height: 0; display: grid; gap: 16px; align-content: start; padding-right: 2px; }

		/* header card */
		.ag-header-card {
			display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
			align-items: center; gap: 20px;
			padding: 20px 24px;
			border-radius: 16px;
			border: 1px solid var(--ag-border);
			background: linear-gradient(135deg, rgba(17,28,50,0.98), rgba(15,23,42,0.96));
		}
		.ag-header-icon {
			width: 52px; height: 52px; border-radius: 14px;
			background: rgba(99,102,241,0.16);
			color: var(--ag-primary-hi);
			display: flex; align-items: center; justify-content: center; flex-shrink: 0;
		}
		.ag-header-icon svg { width: 24px; height: 24px; stroke: currentColor; fill: none; stroke-width: 1.6; }
		.ag-header-info { min-width: 0; }
		.ag-header-name { font-size: 20px; font-weight: 700; color: var(--ag-text); }
		.ag-header-desc { font-size: 13px; color: var(--ag-label); margin-top: 4px; line-height: 1.5; }
		.ag-header-actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }

		/* buttons */
		.ag-btn {
			height: 40px; padding: 0 18px; border-radius: 10px;
			font-size: 13px; font-family: var(--font-sans);
			cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
			transition: all .18s; white-space: nowrap;
		}
		.ag-btn:disabled { opacity: 0.45; cursor: not-allowed; }
		.ag-btn-primary {
			border: none;
			background: linear-gradient(135deg, #6366F1, #8B5CF6);
			color: #fff; font-weight: 600;
			box-shadow: 0 8px 24px rgba(99,102,241,0.28);
		}
		.ag-btn-primary:hover:not(:disabled) {
			filter: brightness(1.1);
			box-shadow: 0 12px 32px rgba(99,102,241,0.38);
			transform: translateY(-1px);
		}
		.ag-btn-secondary {
			border: 1px solid var(--ag-border);
			background: rgba(15,23,42,0.6);
			color: var(--ag-text-2);
		}
		.ag-btn-secondary:hover:not(:disabled) { border-color: var(--ag-border-strong); background: var(--ag-card-hi); color: var(--ag-text); }
		.ag-btn-danger {
			border: 1px solid rgba(255,77,109,0.3);
			background: transparent; color: var(--ag-danger);
		}
		.ag-btn-danger:hover:not(:disabled) { background: rgba(255,77,109,0.08); border-color: var(--ag-danger); }

		.ag-btn-sm { height: 32px; padding: 0 12px; font-size: 11px; border-radius: 8px; }

		/* status badge */
		.ag-badge {
			display: inline-flex; align-items: center;
			padding: 3px 10px; border-radius: 6px;
			font-size: 11px; font-weight: 600; white-space: nowrap;
		}
		.ag-badge-active { background: rgba(34,197,94,0.14); color: var(--ag-success); }
		.ag-badge-available { background: rgba(99,102,241,0.12); color: var(--ag-primary-hi); }
		.ag-badge-current { background: rgba(99,102,241,0.18); color: var(--ag-primary-hi); }
		.ag-badge-custom { background: rgba(168,85,247,0.12); color: #A78BFA; }
		.ag-badge-default { background: rgba(100,116,139,0.12); color: var(--ag-muted); }

		/* info grid */
		.ag-field-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
			gap: 14px;
		}
		.ag-field-block { display: grid; gap: 4px; }
		.ag-field-label { font-size: 11px; font-weight: 600; color: var(--ag-label); text-transform: uppercase; letter-spacing: 0.04em; }
		.ag-field-value {
			font-size: 13px; color: var(--ag-text); word-break: break-all;
			font-family: var(--font-mono);
			display: flex; align-items: center; gap: 8px;
		}
		.ag-field-copy {
			background: none; border: none; cursor: pointer;
			padding: 2px; border-radius: 4px; color: var(--ag-muted);
			display: flex; align-items: center;
			transition: color .15s, background .15s; flex-shrink: 0;
		}
		.ag-field-copy:hover { color: var(--ag-primary-hi); background: rgba(99,102,241,0.1); }
		.ag-field-copy svg { width: 14px; height: 14px; }

		/* rules card */
		.ag-file-card {
			display: flex; align-items: center; gap: 14px;
			padding: 14px 16px;
			border-radius: 12px;
			border: 1px solid var(--ag-border);
			background: var(--ag-card);
			transition: border-color .15s, background .15s;
		}
		.ag-file-card:hover { border-color: var(--ag-border-strong); background: var(--ag-card-hi); }
		.ag-file-icon {
			width: 38px; height: 38px; border-radius: 10px;
			background: rgba(245,158,11,0.12); color: var(--ag-warn);
			display: flex; align-items: center; justify-content: center; flex-shrink: 0;
		}
		.ag-file-icon svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 1.6; }
		.ag-file-info { min-width: 0; flex: 1; }
		.ag-file-name { font-size: 13px; font-weight: 600; color: var(--ag-text); }
		.ag-file-desc { font-size: 11px; color: var(--ag-muted); margin-top: 2px; }

		/* runtime overview */
		.ag-runtime-grid {
			display: grid;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 12px;
		}
		.ag-runtime-item {
			padding: 14px; border-radius: 12px;
			background: var(--ag-card); border: 1px solid var(--ag-border);
			text-align: center;
		}
		.ag-runtime-num { font-size: 22px; font-weight: 700; color: var(--ag-text); line-height: 1.2; }
		.ag-runtime-num.green { color: var(--ag-success); }
		.ag-runtime-unit { font-size: 11px; color: var(--ag-muted); margin-top: 2px; }

		/* skills toolbar */
		.ag-skills-toolbar {
			display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
		}
		.ag-skills-toolbar .sp-select {
			width: 220px; height: 36px; border-radius: 10px;
			border-color: var(--ag-border); background: var(--ag-input);
			color: var(--ag-text); font-size: 12px;
		}

		/* skill items */
		.ag-skill-item {
			display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
			align-items: center; gap: 14px;
			padding: 14px 16px;
			border-radius: 12px;
			border: 1px solid var(--ag-border);
			background: var(--ag-card);
			transition: border-color .15s, background .15s;
		}
		.ag-skill-item:hover { border-color: var(--ag-border-strong); background: var(--ag-card-hi); }
		.ag-skill-icon {
			width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
			display: flex; align-items: center; justify-content: center;
			background: rgba(99,102,241,0.1); color: var(--ag-primary-hi);
		}
		.ag-skill-icon svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 1.6; }
		.ag-skill-info { min-width: 0; }
		.ag-skill-name { font-size: 13px; font-weight: 600; color: var(--ag-text); }
		.ag-skill-desc { font-size: 11px; color: var(--ag-muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.ag-skill-list { display: grid; gap: 8px; max-height: 320px; overflow-y: auto; margin-top: 14px; }

		/* empty / error */
		.ag-empty {
			text-align: center; padding: 48px 24px;
			color: var(--ag-muted); font-size: 13px; line-height: 1.6;
		}
		.ag-empty-icon {
			width: 48px; height: 48px; border-radius: 14px;
			background: rgba(99,102,241,0.08); color: var(--ag-muted);
			display: inline-flex; align-items: center; justify-content: center;
			margin-bottom: 12px;
		}
		.ag-empty-icon svg { width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 1.6; }

		/* scrollbar */
		.ag-agent-list::-webkit-scrollbar,
		.ag-detail::-webkit-scrollbar,
		.ag-skill-list::-webkit-scrollbar {
			width: 5px;
		}
		.ag-agent-list::-webkit-scrollbar-thumb,
		.ag-detail::-webkit-scrollbar-thumb,
		.ag-skill-list::-webkit-scrollbar-thumb {
			background: var(--ag-border-strong); border-radius: 999px;
		}
		.ag-agent-list::-webkit-scrollbar-track,
		.ag-detail::-webkit-scrollbar-track,
		.ag-skill-list::-webkit-scrollbar-track {
			background: transparent;
		}

		/* mobile */
		.ag-mobile-back { display: none !important; }
		@media (max-width: 768px) {
			.ag-page { padding: 12px; gap: 12px; }
			.ag-stats { grid-template-columns: repeat(2, 1fr); }
			.ag-main { grid-template-columns: minmax(0, 1fr); }
			.ag-sidebar { display: none; }
			.ag-sidebar.mobile-visible { display: grid; }
			.ag-detail { display: none; }
			.ag-detail.mobile-visible { display: grid; }
			.ag-mobile-back { display: flex !important; }
			.ag-header-card { grid-template-columns: auto minmax(0, 1fr); }
			.ag-header-actions { grid-column: 1/-1; justify-content: flex-start; }
			.ag-runtime-grid { grid-template-columns: repeat(2, 1fr); }
			.ag-field-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
			.sp-topbar { height: 48px; padding: 0 10px; }
			.sp-topbar-title { font-size: 15px; }
		}

		@media (max-width: 480px) {
			.ag-stats { grid-template-columns: repeat(2, 1fr); gap: 8px; }
			.ag-stat-num { font-size: 22px; }
		}
	`;
}

function getAgentsPageJs(): string {
	return `
		const state = {
			agents: [],
			selectedId: null,
			searchQuery: "",
			filterTab: "all",
			skillsByAgentId: {},
			skillsLoading: false,
			switchLoading: false,
			gallerySkills: [],
		};

		const FILTER_TABS = [
			{ id: "all", label: "全部" },
			{ id: "available", label: "可用" },
			{ id: "current", label: "当前" },
			{ id: "custom", label: "自定义" },
		];

		function isAgentActive(agent) {
			return agent.currentAgent === true || agent.isCurrent === true;
		}

		async function apiFetchAgents() {
			const [agentsRes, statusRes] = await Promise.allSettled([
				fetchJson("/v1/agents"),
				fetchJson("/v1/agents/status").catch(function() { return { agents: [] }; }),
			]);
			const summaryList = agentsRes.status === "fulfilled" ? (Array.isArray(agentsRes.value.agents) ? agentsRes.value.agents : []) : [];
			const statusList = statusRes.status === "fulfilled" ? (Array.isArray(statusRes.value.agents) ? statusRes.value.agents : []) : [];

			state.agents = summaryList.map(function(s) {
				const st = statusList.find(function(t) { return t.agentId === s.agentId; });
				return Object.assign({}, s, { runStatus: st ? st.status : "unknown" });
			});
		}

		async function apiFetchAgentSkills(agentId) {
			try {
				const data = await fetchJson("/v1/agents/" + agentId + "/skills");
				state.skillsByAgentId[agentId] = Array.isArray(data.skills) ? data.skills : [];
			} catch {
				state.skillsByAgentId[agentId] = [];
			}
		}

		async function apiSwitchAgent(agentId) {
			state.switchLoading = true;
			renderDetail();
			try {
				await fetchJson("/v1/agents/" + agentId + "/switch", { method: "POST" });
			} finally {
				state.switchLoading = false;
			}
		}

		async function apiArchiveAgent(agentId) {
			await fetchJson("/v1/agents/" + agentId + "/archive", { method: "POST" });
		}

		async function apiRemoveSkill(agentId, skillName) {
			await fetchJson("/v1/agents/" + agentId + "/skills/" + encodeURIComponent(skillName), { method: "DELETE" });
		}

		async function apiFetchGallerySkills() {
			try {
				const data = await fetchJson("/v1/debug/skills");
				state.gallerySkills = Array.isArray(data.skills) ? data.skills : [];
			} catch {
				state.gallerySkills = [];
			}
		}

		async function apiCopySkill(agentId, skillName) {
			await fetchJson("/v1/agents/" + agentId + "/skills", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ skillName: skillName }),
			});
		}

		function getFilteredAgents() {
			const q = (state.searchQuery || "").toLowerCase();
			const tab = state.filterTab;
			return state.agents.filter(function(a) {
				if (q) {
					const nameOk = (a.name || "").toLowerCase().indexOf(q) !== -1;
					const idOk = (a.agentId || "").toLowerCase().indexOf(q) !== -1;
					if (!nameOk && !idOk) return false;
				}
				if (tab === "all") return true;
				if (tab === "available") return a.agentId !== "main" && a.runStatus !== "archived";
				if (tab === "current") return isAgentActive(a);
				if (tab === "custom") return !a.isDefault;
				return true;
			});
		}

		function getStatCounts() {
			const total = state.agents.length;
			const active = state.agents.filter(function(a) { return isAgentActive(a); }).length;
			let skillsTotal = 0;
			Object.keys(state.skillsByAgentId).forEach(function(id) {
				skillsTotal += (state.skillsByAgentId[id] || []).length;
			});
			const browsers = new Set();
			state.agents.forEach(function(a) { if (a.defaultBrowserId) browsers.add(a.defaultBrowserId); });
			return { total: total, active: active, skills: skillsTotal, browsers: browsers.size };
		}

		function renderStats() {
			const c = getStatCounts();
			document.getElementById("ag-stat-total").textContent = c.total;
			document.getElementById("ag-stat-active").textContent = c.active;
			document.getElementById("ag-stat-skills").textContent = c.skills;
			document.getElementById("ag-stat-browsers").textContent = c.browsers;
		}

		function renderFilterTabs() {
			const container = document.getElementById("ag-filter-tabs");
			if (!container) return;
			container.innerHTML = "";
			FILTER_TABS.forEach(function(tab) {
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = "ag-filter-tab" + (state.filterTab === tab.id ? " active" : "");
				btn.textContent = tab.label;
				btn.addEventListener("click", function() {
					state.filterTab = tab.id;
					renderFilterTabs();
					renderAgentList();
				});
				container.appendChild(btn);
			});
		}

		function renderAgentList() {
			const container = document.getElementById("ag-agent-list");
			if (!container) return;
			container.innerHTML = "";
			const filtered = getFilteredAgents();
			if (filtered.length === 0) {
				container.innerHTML = '<div class="ag-empty"><div class="ag-empty-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg></div>暂无匹配的 Agent</div>';
				return;
			}
			filtered.forEach(function(agent) {
				const item = document.createElement("button");
				item.type = "button";
				item.className = "ag-agent-item" + (state.selectedId === agent.agentId ? " selected" : "");

				const iconWrap = document.createElement("div");
				iconWrap.className = "ag-agent-icon-wrap";
				iconWrap.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M5.5 20v-1a6.5 6.5 0 0113 0v1"/></svg>';
				item.appendChild(iconWrap);

				const info = document.createElement("div");
				info.className = "ag-agent-info";
				const name = document.createElement("div");
				name.className = "ag-agent-name";
				name.textContent = agent.name || agent.agentId;
				const id = document.createElement("div");
				id.className = "ag-agent-id";
				id.textContent = agent.agentId;
				const browser = document.createElement("div");
				browser.className = "ag-agent-browser";
				browser.textContent = agent.defaultBrowserId || "跟随系统默认";
				info.appendChild(name);
				info.appendChild(id);
				info.appendChild(browser);
				item.appendChild(info);

				const dot = document.createElement("div");
				dot.className = "ag-agent-status-dot";
				if (isAgentActive(agent)) dot.classList.add("active");
				else if (agent.runStatus === "running") dot.classList.add("active");
				item.appendChild(dot);

				item.addEventListener("click", function() { selectAgent(agent.agentId); });
				container.appendChild(item);
			});
		}

		function getStatusLabel(agent) {
			if (isAgentActive(agent)) return { text: "当前激活", cls: "ag-badge-active" };
			if (agent.isDefault) return { text: "内置默认", cls: "ag-badge-default" };
			return { text: "自定义", cls: "ag-badge-custom" };
		}

		function renderDetail() {
			const body = document.getElementById("ag-detail");
			if (!body) return;

			const agent = state.agents.find(function(a) { return a.agentId === state.selectedId; });
			if (!agent) {
				body.innerHTML = '<div class="ag-empty"><div class="ag-empty-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M5.5 20v-1a6.5 6.5 0 0113 0v1"/></svg></div>请选择左侧 Agent 查看详情</div>';
				return;
			}

			const status = getStatusLabel(agent);
			const active = isAgentActive(agent);

			let html = '<div class="ag-header-card">';
			html += '<div class="ag-header-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M5.5 20v-1a6.5 6.5 0 0113 0v1"/></svg></div>';
			html += '<div class="ag-header-info">';
			html += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
			html += '<span class="ag-header-name">' + escapeHtml(agent.name || agent.agentId) + '</span>';
			html += '<span class="ag-badge ' + status.cls + '">' + status.text + '</span>';
			html += '</div>';
			html += '<div class="ag-header-desc">' + escapeHtml(agent.description || "暂无描述") + '</div>';
			html += '</div>';
			html += '<div class="ag-header-actions">';
			if (active) {
				html += '<button class="ag-btn ag-btn-primary" type="button" disabled>当前已激活</button>';
			} else {
				html += '<button id="ag-btn-switch" class="ag-btn ag-btn-primary" type="button"' + (state.switchLoading ? ' disabled' : '') + '>' + (state.switchLoading ? '切换中...' : '切换到此 Agent') + '</button>';
			}
			if (agent.agentId !== "main") {
				html += '<button id="ag-btn-archive" class="ag-btn ag-btn-danger" type="button">归档</button>';
			}
			html += '</div>';
			html += '</div>';

			html += '<div class="ag-card">';
			html += '<div class="ag-card-head"><div class="ag-card-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg></div><span class="ag-card-title">基础信息</span></div>';
			html += '<div class="ag-field-grid">';
			html += makeField("Agent ID", agent.agentId, true);
			html += makeField("状态", status.text, false);
			html += makeField("默认浏览器", agent.defaultBrowserId || "跟随系统默认", false);
			html += makeField("会话接口", "/v1/agents/" + agent.agentId + "/chat/*", true);
			html += makeField("技能接口", "/v1/agents/" + agent.agentId + "/debug/skills", true);
			html += makeField("规则文件", "AGENTS.MD", false);
			html += '</div>';
			html += '</div>';

			html += '<div class="ag-card">';
			html += '<div class="ag-card-head"><div class="ag-card-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><span class="ag-card-title">规则与说明</span></div>';
			html += '<div class="ag-file-card">';
			html += '<div class="ag-file-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>';
			html += '<div class="ag-file-info"><div class="ag-file-name">AGENTS.MD</div><div class="ag-file-desc">点击查看并编辑该 Agent 的规则文件</div></div>';
			html += '<a class="ag-btn ag-btn-secondary ag-btn-sm" href="/playground/agents/' + encodeURIComponent(agent.agentId) + '/rules" target="_blank">打开</a>';
			html += '</div>';
			html += '</div>';

			html += '<div class="ag-card">';
			html += '<div class="ag-card-head"><div class="ag-card-icon"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div><span class="ag-card-title">运行概览</span></div>';
			html += '<div class="ag-runtime-grid">';
			html += '<div class="ag-runtime-item"><div class="ag-runtime-num">-</div><div class="ag-runtime-unit">最近调用</div></div>';
			html += '<div class="ag-runtime-item"><div class="ag-runtime-num green">-</div><div class="ag-runtime-unit">成功率</div></div>';
			html += '<div class="ag-runtime-item"><div class="ag-runtime-num">-</div><div class="ag-runtime-unit">平均响应</div></div>';
			html += '<div class="ag-runtime-item"><div class="ag-runtime-num">-</div><div class="ag-runtime-unit">最后同步</div></div>';
			html += '</div>';
			html += '</div>';

			html += '<div class="ag-card">';
			html += '<div class="ag-card-head">';
			html += '<div class="ag-card-icon"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>';
			html += '<span class="ag-card-title">技能透明视图</span>';
			html += '<span class="ag-card-sub">仅展示该 Agent scoped 技能</span>';
			html += '</div>';
			html += '<div class="ag-skills-toolbar">';
			html += '<select id="ag-skill-select" class="sp-select"><option value="">选择要复制安装的技能...</option></select>';
			html += '<button id="ag-btn-copy-skill" class="ag-btn ag-btn-secondary ag-btn-sm" type="button" disabled>复制安装</button>';
			html += '<button id="ag-btn-refresh-skills" class="ag-btn ag-btn-secondary ag-btn-sm" type="button">刷新技能</button>';
			html += '</div>';
			html += '<div id="ag-skill-list" class="ag-skill-list"></div>';
			html += '</div>';

			body.innerHTML = html;

			const switchBtn = document.getElementById("ag-btn-switch");
			if (switchBtn && !active) {
				switchBtn.addEventListener("click", handleSwitch);
			}

			const archiveBtn = document.getElementById("ag-btn-archive");
			if (archiveBtn) {
				archiveBtn.addEventListener("click", handleArchive);
			}

			const copySkillBtn = document.getElementById("ag-btn-copy-skill");
			if (copySkillBtn) {
				copySkillBtn.addEventListener("click", handleCopySkill);
			}

			const refreshSkillsBtn = document.getElementById("ag-btn-refresh-skills");
			if (refreshSkillsBtn) {
				refreshSkillsBtn.addEventListener("click", handleRefreshSkills);
			}

			renderSkills();
			populateSkillSelect();
		}

		function makeField(label, value, copyable) {
			let h = '<div class="ag-field-block">';
			h += '<div class="ag-field-label">' + escapeHtml(label) + '</div>';
			h += '<div class="ag-field-value">';
			h += '<span>' + escapeHtml(value) + '</span>';
			if (copyable && value) {
				h += '<button class="ag-field-copy" type="button" data-copy="' + escapeHtml(value) + '" title="复制"><svg viewBox="0 0 20 20"><rect x="7" y="4" width="10" height="13" rx="2"/><path d="M5 8H4a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2v-1"/></svg></button>';
			}
			h += '</div></div>';
			return h;
		}

		function renderSkills() {
			const container = document.getElementById("ag-skill-list");
			if (!container) return;
			const skills = state.skillsByAgentId[state.selectedId] || [];
			const agent = state.agents.find(function(a) { return a.agentId === state.selectedId; });

			if (state.skillsLoading) {
				container.innerHTML = '<div class="ag-empty">加载中...</div>';
				return;
			}
			if (!skills || skills.length === 0) {
				container.innerHTML = '<div class="ag-empty"><div class="ag-empty-icon"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>暂无技能<br><span style="font-size:11px">可通过上方下拉选择技能并复制安装</span></div>';
				return;
			}
			container.innerHTML = "";
			skills.forEach(function(skill) {
				const name = skill.name || skill.skillName || "-";
				let desc = skill.description || "";
				if (desc.length > 80) desc = desc.slice(0, 80) + "...";

				const item = document.createElement("div");
				item.className = "ag-skill-item";

				const icon = document.createElement("div");
				icon.className = "ag-skill-icon";
				icon.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
				item.appendChild(icon);

				const info = document.createElement("div");
				info.className = "ag-skill-info";
				const n = document.createElement("div");
				n.className = "ag-skill-name";
				n.textContent = name;
				const d = document.createElement("div");
				d.className = "ag-skill-desc";
				d.textContent = desc || "暂无说明";
				info.appendChild(n);
				info.appendChild(d);
				item.appendChild(info);

				if (agent && agent.agentId !== "main" && skill.skillName) {
					const delBtn = document.createElement("button");
					delBtn.type = "button";
					delBtn.className = "ag-btn ag-btn-danger ag-btn-sm";
					delBtn.textContent = "删除";
					delBtn.addEventListener("click", function() {
						handleRemoveSkill(skill.skillName);
					});
					item.appendChild(delBtn);
				}

				container.appendChild(item);
			});
		}

		function populateSkillSelect() {
			const sel = document.getElementById("ag-skill-select");
			if (!sel) return;
			while (sel.options.length > 1) sel.remove(1);
			state.gallerySkills.forEach(function(s) {
				const name = s.name || s.skillName || "";
				if (!name) return;
				const opt = document.createElement("option");
				opt.value = name;
				opt.textContent = name;
				sel.appendChild(opt);
			});
			sel.addEventListener("change", function() {
				const btn = document.getElementById("ag-btn-copy-skill");
				if (btn) btn.disabled = !sel.value;
			});
		}

		function selectAgent(agentId) {
			state.selectedId = agentId;
			state.skillsLoading = true;
			renderAgentList();
			renderDetail();
			apiFetchAgentSkills(agentId).then(function() {
				state.skillsLoading = false;
				renderSkills();
			});
			const detail = document.querySelector(".ag-detail");
			const sidebar = document.querySelector(".ag-sidebar");
			if (detail) detail.classList.add("mobile-visible");
			if (sidebar) sidebar.classList.remove("mobile-visible");
		}

		async function handleSwitch() {
			const agent = state.agents.find(function(a) { return a.agentId === state.selectedId; });
			if (!agent) return;
			if (isAgentActive(agent)) return;
			try {
				await apiSwitchAgent(agent.agentId);
				showToast("已切换到 " + (agent.name || agent.agentId), "ok");
				await apiFetchAgents();
				renderAgentList();
				renderDetail();
				renderStats();
			} catch (e) {
				showToast(e.message || "切换失败", "danger");
			}
		}

		async function handleArchive() {
			const agent = state.agents.find(function(a) { return a.agentId === state.selectedId; });
			if (!agent) return;
			const ok = await openConfirmDialog({
				title: "归档 Agent",
				message: '确定归档 "' + (agent.name || agent.agentId) + '"？归档后可在档案中恢复。',
				confirmLabel: "归档",
				tone: "danger",
			});
			if (!ok) return;
			try {
				await apiArchiveAgent(agent.agentId);
				if (state.selectedId === agent.agentId) state.selectedId = null;
				await apiFetchAgents();
				renderAgentList();
				renderDetail();
				renderStats();
				showToast("已归档", "ok");
			} catch (e) {
				showToast(e.message || "归档失败", "danger");
			}
		}

		async function handleRemoveSkill(skillName) {
			if (!state.selectedId) return;
			try {
				await apiRemoveSkill(state.selectedId, skillName);
				await apiFetchAgentSkills(state.selectedId);
				renderSkills();
				showToast("已移除 " + skillName, "ok");
			} catch (e) {
				showToast(e.message || "移除失败", "danger");
			}
		}

		async function handleCopySkill() {
			const sel = document.getElementById("ag-skill-select");
			if (!sel || !sel.value || !state.selectedId) return;
			const skillName = sel.value;
			const btn = document.getElementById("ag-btn-copy-skill");
			if (btn) { btn.disabled = true; btn.textContent = "安装中..."; }
			try {
				await apiCopySkill(state.selectedId, skillName);
				await apiFetchAgentSkills(state.selectedId);
				renderSkills();
				showToast("已安装 " + skillName, "ok");
			} catch (e) {
				showToast(e.message || "安装失败", "danger");
			} finally {
				if (btn) { btn.disabled = false; btn.textContent = "复制安装"; }
			}
		}

		async function handleRefreshSkills() {
			if (!state.selectedId) return;
			const btn = document.getElementById("ag-btn-refresh-skills");
			if (btn) { btn.disabled = true; btn.textContent = "刷新中..."; }
			try {
				await apiFetchAgentSkills(state.selectedId);
				renderSkills();
				showToast("技能已刷新", "ok");
			} catch (e) {
				showToast(e.message || "刷新失败", "danger");
			} finally {
				if (btn) { btn.disabled = false; btn.textContent = "刷新技能"; }
			}
		}

		function mobileBackToList() {
			const detail = document.querySelector(".ag-detail");
			const sidebar = document.querySelector(".ag-sidebar");
			if (detail) detail.classList.remove("mobile-visible");
			if (sidebar) sidebar.classList.add("mobile-visible");
		}

		async function handleRefresh() {
			await apiFetchAgents();
			await apiFetchGallerySkills();
			renderAgentList();
			renderFilterTabs();
			renderDetail();
			renderStats();
			showToast("已刷新", "ok");
		}

		document.addEventListener("click", function(e) {
			const btn = e.target.closest(".ag-field-copy");
			if (!btn) return;
			const val = btn.getAttribute("data-copy") || "";
			const orig = btn.innerHTML;
			try {
				const ta = document.createElement("textarea");
				ta.value = val;
				ta.style.position = "fixed"; ta.style.opacity = "0";
				document.body.appendChild(ta);
				ta.select();
				document.execCommand("copy");
				ta.remove();
				btn.innerHTML = '<svg viewBox="0 0 20 20"><polyline points="3 12 8 17 17 6" stroke-width="2.2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>';
				setTimeout(function() { btn.innerHTML = orig; }, 1400);
			} catch {}
		});

		async function init() {
			applyTheme(readStoredTheme());

			document.getElementById("btn-refresh").addEventListener("click", handleRefresh);
			document.getElementById("mobile-back-btn").addEventListener("click", mobileBackToList);

			const searchInput = document.getElementById("ag-search");
			if (searchInput) {
				searchInput.addEventListener("input", debounce(function() {
					state.searchQuery = searchInput.value;
					renderAgentList();
				}, 200));
			}

			await Promise.all([apiFetchAgents(), apiFetchGallerySkills()]);
			renderFilterTabs();
			renderAgentList();
			renderStats();

			if (state.agents.length > 0 && !state.selectedId) {
				selectAgent(state.agents[0].agentId);
			}
		}

		document.addEventListener("DOMContentLoaded", init);
	`;
}

export function renderAgentsPage(): string {
	return `<!doctype html>
<html lang="zh-CN" data-theme="dark">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Agent 管理台 - UGK Claw</title>
	<link rel="icon" href="${STANDALONE_FAVICON}" />
	<style>${getStandaloneBaseCss()}${getAgentsPageCss()}</style>
</head>
<body>
	<div id="app">
		${renderStandaloneTopbar("Agent 管理台", "/playground")}
		<button id="btn-refresh" class="sp-topbar-btn" type="button" style="position:absolute;right:70px;top:10px">
			<svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 105.64-12.36L1 10"/></svg>
			刷新
		</button>

		<div class="ag-page">
			<div class="ag-stats">
				<div class="ag-stat-card">
					<div class="ag-stat-icon ag-stat-icon-1"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M5.5 20v-1a6.5 6.5 0 0113 0v1"/></svg></div>
					<div class="ag-stat-info">
						<div class="ag-stat-label">全部 Agent</div>
						<div class="ag-stat-num" id="ag-stat-total">0</div>
					</div>
				</div>
				<div class="ag-stat-card">
					<div class="ag-stat-icon ag-stat-icon-2"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
					<div class="ag-stat-info">
						<div class="ag-stat-label">当前激活</div>
						<div class="ag-stat-num" id="ag-stat-active">0</div>
					</div>
				</div>
				<div class="ag-stat-card">
					<div class="ag-stat-icon ag-stat-icon-3"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
					<div class="ag-stat-info">
						<div class="ag-stat-label">技能总数</div>
						<div class="ag-stat-num" id="ag-stat-skills">0</div>
					</div>
				</div>
				<div class="ag-stat-card">
					<div class="ag-stat-icon ag-stat-icon-4"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
					<div class="ag-stat-info">
						<div class="ag-stat-label">可用浏览器</div>
						<div class="ag-stat-num" id="ag-stat-browsers">0</div>
					</div>
				</div>
			</div>

			<div class="ag-main">
				<aside class="ag-sidebar mobile-visible">
					<div class="ag-search-wrap">
						<svg class="ag-search-icon" viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5"/><line x1="13" y1="13" x2="18" y2="18"/></svg>
						<input id="ag-search" class="ag-search-input" type="text" placeholder="搜索 Agent 名称或 ID..." autocomplete="off" />
						<span class="ag-search-shortcut">⌘K</span>
					</div>
					<div id="ag-filter-tabs" class="ag-filter-tabs"></div>
					<div id="ag-agent-list" class="ag-agent-list"></div>
				</aside>

				<section class="ag-detail" id="ag-detail">
					<button id="mobile-back-btn" class="ag-mobile-back ag-btn ag-btn-secondary ag-btn-sm" type="button" style="margin-bottom:8px">
						<svg viewBox="0 0 20 20" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"><path d="M13 4l-6 6 6 6"/></svg>
						返回列表
					</button>
				</section>
			</div>
		</div>
	</div>

	${renderStandaloneConfirmDialog()}
	${renderStandaloneToastContainer()}
	<script>${getStandaloneBaseJs()}${getAgentsPageJs()}</script>
</body>
</html>`;
}
