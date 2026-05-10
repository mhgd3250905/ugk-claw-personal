import {
	getStandaloneBaseCss,
	getStandaloneBaseJs,
	renderStandaloneTopbar,
	renderStandaloneConfirmDialog,
	renderStandaloneToastContainer,
	STANDALONE_FAVICON,
} from "./standalone-page-shared.js";

function getInboxPageCss(): string {
	return `
		.inbox-content {
			max-width: 960px;
			margin: 0 auto;
			padding: 18px 24px;
			overflow-y: auto;
			min-height: 0;
		}

		.inbox-card {
			padding: 14px 16px;
			border-radius: 4px;
			background: var(--bg-panel);
			margin-bottom: 8px;
		}

		.inbox-card.is-unread {
			border-left: 3px solid var(--accent);
		}

		.inbox-card-head {
			display: flex;
			align-items: center;
			gap: 8px;
			flex-wrap: wrap;
		}

		.inbox-card-title {
			font-size: 12px;
			font-weight: 600;
			color: var(--fg);
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.inbox-card-time {
			font-size: 10px;
			color: var(--muted);
			font-family: var(--font-mono);
			flex-shrink: 0;
		}

		.inbox-card-source {
			font-size: 9px;
			padding: 2px 6px;
			border-radius: 4px;
			background: var(--bg-panel-2);
			color: var(--muted);
			letter-spacing: 0.04em;
			flex-shrink: 0;
		}

		.inbox-card-body {
			margin-top: 8px;
		}

		.inbox-card-text {
			font-size: 12px;
			line-height: 1.6;
			color: var(--fg);
			padding: 8px 10px;
			border-radius: 4px;
			background: var(--bg-panel-2);
			max-height: 200px;
			overflow-y: auto;
			white-space: pre-wrap;
			word-break: break-word;
		}

		.inbox-card-files {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			margin-top: 6px;
		}

		.inbox-file-link {
			font-size: 10px;
			padding: 3px 8px;
			border-radius: 4px;
			background: var(--bg-panel);
			color: var(--muted);
			text-decoration: none;
			font-family: var(--font-mono);
		}

		.inbox-file-link:hover {
			color: var(--fg);
			background: var(--accent-soft);
		}

		.inbox-card-actions {
			display: flex;
			gap: 6px;
			margin-top: 8px;
		}

		.inbox-load-more {
			display: block;
			margin: 16px auto 0;
			padding: 8px 24px;
			border-radius: 4px;
			background: var(--bg-panel);
			border: none;
			color: var(--muted);
			font-size: 11px;
			cursor: pointer;
		}

		.inbox-load-more:hover {
			background: var(--accent-soft);
			color: var(--fg);
		}

		.inbox-empty {
			padding: 60px 20px;
			text-align: center;
			color: var(--muted);
			font-size: 12px;
		}
	`;
}

function getInboxPageJs(): string {
	return `
		const SOURCE_LABELS = { conn: "后台任务", feishu: "飞书", notification: "通知", agent: "助手" };

		const state = {
			items: [],
			unreadCount: 0,
			hasMore: false,
			nextBefore: null,
			loading: false,
		};

		async function apiFetchActivity(params) {
			const query = new URLSearchParams();
			if (params?.limit) query.set("limit", String(params.limit));
			if (params?.before) query.set("before", params.before);
			const url = "/v1/activity" + (query.toString() ? "?" + query.toString() : "");
			return await fetchJson(url);
		}

		async function apiFetchSummary() {
			return await fetchJson("/v1/activity/summary");
		}

		async function apiMarkRead(activityId) {
			return await fetchJson("/v1/activity/" + activityId + "/read", { method: "POST" });
		}

		async function apiMarkAllRead() {
			return await fetchJson("/v1/activity/read-all", { method: "POST" });
		}

		async function loadData() {
			state.loading = true;
			try {
				const [activityData, summaryData] = await Promise.all([
					apiFetchActivity({ limit: 20 }),
					apiFetchSummary().catch(() => ({ unreadCount: 0 })),
				]);
				state.items = activityData.activities || [];
				state.hasMore = activityData.hasMore || false;
				state.nextBefore = activityData.nextBefore || null;
				state.unreadCount = summaryData.unreadCount || 0;
			} catch (e) {
				showToast(e.message, "danger");
			} finally {
				state.loading = false;
			}
		}

		async function loadMore() {
			if (!state.hasMore || state.loading) return;
			state.loading = true;
			try {
				const data = await apiFetchActivity({ limit: 20, before: state.nextBefore });
				state.items = state.items.concat(data.activities || []);
				state.hasMore = data.hasMore || false;
				state.nextBefore = data.nextBefore || null;
				renderItems();
			} catch (e) {
				showToast(e.message, "danger");
			} finally {
				state.loading = false;
			}
		}

		async function handleMarkRead(activityId) {
			try {
				const data = await apiMarkRead(activityId);
				const item = state.items.find(i => i.activityId === activityId);
				if (item) item.readAt = new Date().toISOString();
				state.unreadCount = Math.max(0, (data.unreadCount ?? state.unreadCount) - 1);
				renderItems();
			} catch (e) { showToast(e.message, "danger"); }
		}

		async function handleMarkAllRead() {
			try {
				const data = await apiMarkAllRead();
				for (const item of state.items) item.readAt = new Date().toISOString();
				state.unreadCount = 0;
				renderItems();
				showToast("已全部标记为已读", "ok");
			} catch (e) { showToast(e.message, "danger"); }
		}

		function renderItems() {
			const container = document.getElementById("inbox-items");
			if (!container) return;
			container.innerHTML = "";

			if (state.items.length === 0) {
				container.innerHTML = '<div class="inbox-empty">暂无消息</div>';
				return;
			}

			for (const item of state.items) {
				const card = document.createElement("article");
				card.className = "inbox-card" + (!item.readAt ? " is-unread" : "");

				const head = document.createElement("div");
				head.className = "inbox-card-head";
				const title = document.createElement("div");
				title.className = "inbox-card-title";
				title.textContent = item.title || "消息";
				const source = document.createElement("span");
				source.className = "inbox-card-source";
				source.textContent = SOURCE_LABELS[item.source] || item.source || "";
				const time = document.createElement("span");
				time.className = "inbox-card-time";
				time.textContent = formatRelativeTime(item.createdAt);
				head.appendChild(title);
				head.appendChild(source);
				head.appendChild(time);
				card.appendChild(head);

				if (item.text) {
					const body = document.createElement("div");
					body.className = "inbox-card-body";
					const text = document.createElement("div");
					text.className = "inbox-card-text";
					text.textContent = item.text.length > 500 ? item.text.slice(0, 500) + "..." : item.text;
					body.appendChild(text);

					if (Array.isArray(item.files) && item.files.length > 0) {
						const files = document.createElement("div");
						files.className = "inbox-card-files";
						for (const file of item.files) {
							const a = document.createElement("a");
							a.className = "inbox-file-link";
							a.href = file.downloadUrl || file.url || "#";
							a.target = "_blank";
							a.textContent = file.fileName || file.kind || "file";
							files.appendChild(a);
						}
						body.appendChild(files);
					}

					const actions = document.createElement("div");
					actions.className = "inbox-card-actions";
					if (!item.readAt) {
						const readBtn = document.createElement("button");
						readBtn.type = "button";
						readBtn.className = "sp-btn";
						readBtn.textContent = "标为已读";
						readBtn.addEventListener("click", () => handleMarkRead(item.activityId));
						actions.appendChild(readBtn);
					}
					body.appendChild(actions);
					card.appendChild(body);
				}

				// auto-mark as read
				if (!item.readAt) {
					void apiMarkRead(item.activityId).then(data => {
						item.readAt = new Date().toISOString();
						state.unreadCount = Math.max(0, (data.unreadCount ?? state.unreadCount));
					}).catch(() => {});
				}

				container.appendChild(card);
			}

			const loadMoreBtn = document.getElementById("inbox-load-more");
			if (loadMoreBtn) loadMoreBtn.hidden = !state.hasMore;
		}

		async function handleRefresh() {
			await loadData();
			renderItems();
			showToast("已刷新", "ok");
		}

		async function init() {
			applyTheme(readStoredTheme());

			const refreshBtn = document.getElementById("btn-refresh");
			if (refreshBtn) refreshBtn.addEventListener("click", handleRefresh);

			const readAllBtn = document.getElementById("btn-read-all");
			if (readAllBtn) readAllBtn.addEventListener("click", handleMarkAllRead);

			const loadMoreBtn = document.getElementById("inbox-load-more");
			if (loadMoreBtn) loadMoreBtn.addEventListener("click", loadMore);

			await loadData();
			renderItems();

			// SSE for real-time
			try {
				const es = new EventSource("/v1/notifications/stream");
				es.addEventListener("message", () => { void loadData().then(renderItems); });
				es.addEventListener("error", () => { es.close(); });
			} catch {}
		}

		document.addEventListener("DOMContentLoaded", init);
	`;
}

export function renderInboxPage(): string {
	return `<!doctype html>
<html lang="zh-CN" data-theme="dark">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>消息中心 - UGK Claw</title>
	<link rel="icon" href="${STANDALONE_FAVICON}" />
	<style>${getStandaloneBaseCss()}${getInboxPageCss()}</style>
</head>
<body>
	<div id="app">
		${renderStandaloneTopbar("消息中心", "/playground")}
		<button id="btn-read-all" class="sp-topbar-btn" type="button" style="position:absolute;right:120px;top:11px">全部已读</button>
		<button id="btn-refresh" class="sp-topbar-btn" type="button" style="position:absolute;right:70px;top:11px">
			<svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 105.64-12.36L1 10"/></svg>
			刷新
		</button>

		<div class="inbox-content">
			<div id="inbox-items"></div>
			<button id="inbox-load-more" class="inbox-load-more" hidden>加载更多</button>
		</div>
	</div>

	${renderStandaloneConfirmDialog()}
	${renderStandaloneToastContainer()}
	<script>${getStandaloneBaseJs()}${getInboxPageJs()}</script>
</body>
</html>`;
}
