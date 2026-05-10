import { getStandaloneBaseCss, getStandaloneBaseJs, STANDALONE_FAVICON, renderStandaloneConfirmDialog, renderStandaloneToastContainer, renderStandaloneTopbar } from "./standalone-page-shared.js";
import { getConnPageCss } from "./conn-page-css.js";
import { getConnPageJs } from "./conn-page-js.js";

export { getConnPageCss } from "./conn-page-css.js";
export { getConnPageJs } from "./conn-page-js.js";

export function renderConnPage(): string {
	const css = getStandaloneBaseCss() + getConnPageCss();
	const js = getStandaloneBaseJs() + getConnPageJs();

	return `<!doctype html>
<html lang="zh-CN" data-theme="dark">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>后台任务工作台 - UGK Claw</title>
	<link rel="icon" href="${STANDALONE_FAVICON}" />
	<style>${css}</style>
</head>
<body>
	<div id="app">
		${renderStandaloneTopbar("后台任务工作台", "/playground")}
		<button id="btn-new-conn" class="sp-topbar-btn" type="button" style="position:absolute;right:110px;top:11px">
			<svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
			新建任务
		</button>
		<button id="btn-refresh" class="sp-topbar-btn" type="button" style="position:absolute;right:52px;top:11px">
			<svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
		</button>

		<section class="conn-stats">
			<div class="conn-stat-card conn-stat-card--blue">
				<div class="conn-stat-card-body">
					<div class="label">全部任务</div>
					<div class="value" id="stat-total">0</div>
				</div>
				<div class="conn-stat-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
				</div>
			</div>
			<div class="conn-stat-card conn-stat-card--green">
				<div class="conn-stat-card-body">
					<div class="label">运行中</div>
					<div class="value" id="stat-active">0</div>
				</div>
				<div class="conn-stat-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
				</div>
			</div>
			<div class="conn-stat-card conn-stat-card--amber">
				<div class="conn-stat-card-body">
					<div class="label">已暂停</div>
					<div class="value" id="stat-paused">0</div>
				</div>
				<div class="conn-stat-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="10" rx="1"/></svg>
				</div>
			</div>
			<div class="conn-stat-card conn-stat-card--red">
				<div class="conn-stat-card-body">
					<div class="label">近期失败</div>
					<div class="value" id="stat-failed">0</div>
				</div>
				<div class="conn-stat-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="#FF4D6D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
				</div>
			</div>
		</section>

		<div class="conn-main">
			<aside class="conn-list mobile-visible">
				<div class="conn-list-toolbar">
					<input id="conn-search" class="conn-search" type="text" placeholder="搜索任务名称或 ID..." />
				</div>
				<div class="conn-filter-tabs">
					<button class="conn-filter-tab active" data-filter="all">全部</button>
					<button class="conn-filter-tab" data-filter="active">运行中</button>
					<button class="conn-filter-tab" data-filter="paused">已暂停</button>
					<button class="conn-filter-tab" data-filter="completed">已完成</button>
				</div>
				<div id="conn-list-items" class="conn-list-items"></div>
			</aside>

			<section class="conn-detail">
				<div class="conn-detail-head">
					<button id="mobile-back-btn" class="sp-topbar-back" type="button" style="display:none">
						<svg viewBox="0 0 20 20" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4l-6 6 6 6"/></svg>
					</button>
					<strong id="conn-detail-title" class="conn-detail-title"></strong>
					<div id="conn-detail-actions" class="conn-detail-actions"></div>
				</div>
				<div id="conn-detail-body" class="conn-detail-body"></div>
			</section>
		</div>
	</div>

	${renderStandaloneConfirmDialog()}
	${renderStandaloneToastContainer()}

	<script>${js}</script>
</body>
</html>`;
}
