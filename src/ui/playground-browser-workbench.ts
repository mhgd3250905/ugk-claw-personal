export function getPlaygroundBrowserWorkbenchStyles(): string {
	return `
		.browser-workbench-panel {
			width: min(1040px, calc(100vw - 28px));
		}

		.browser-workbench-body {
			display: grid;
			grid-template-columns: minmax(220px, 0.32fr) minmax(0, 1fr);
			gap: 12px;
			min-height: min(68vh, 720px);
		}

		.browser-workbench-list,
		.browser-workbench-main {
			display: grid;
			align-content: start;
			gap: 8px;
			min-height: 0;
			overflow: auto;
		}

		.browser-workbench-item,
		.browser-workbench-summary,
		.browser-target-row {
			border: 1px solid rgba(201, 210, 255, 0.1);
			border-radius: 4px;
			background: rgba(255, 255, 255, 0.025);
		}

		.browser-workbench-item {
			display: grid;
			gap: 5px;
			width: 100%;
			padding: 10px;
			color: rgba(226, 234, 255, 0.74);
			text-align: left;
		}

		.browser-workbench-item-label {
			display: inline-flex;
			align-items: center;
			width: fit-content;
			padding: 2px 6px;
			border: 1px solid rgba(104, 213, 255, 0.2);
			border-radius: 999px;
			color: rgba(104, 213, 255, 0.88);
			font-size: 10px;
			line-height: 1.2;
		}

		.browser-workbench-item:hover,
		.browser-workbench-item:focus-visible,
		.browser-workbench-item.is-selected {
			border-color: rgba(104, 213, 255, 0.26);
			background: rgba(104, 213, 255, 0.08);
		}

		.browser-workbench-item strong,
		.browser-workbench-summary strong,
		.browser-target-row strong {
			color: rgba(246, 249, 255, 0.94);
			font-size: 12px;
			line-height: 1.35;
		}

		.browser-workbench-item span,
		.browser-workbench-summary span,
		.browser-target-row span,
		.browser-target-row code {
			color: rgba(226, 234, 255, 0.56);
			font-family: var(--font-mono);
			font-size: 10px;
			line-height: 1.45;
			overflow-wrap: anywhere;
		}

		.browser-workbench-summary {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 8px;
			padding: 10px;
		}

		.browser-workbench-status {
			display: inline-flex;
			align-items: center;
			width: fit-content;
			min-height: 20px;
			padding: 3px 7px;
			border: 1px solid rgba(255, 113, 136, 0.22);
			color: rgba(255, 190, 202, 0.9);
			font-family: var(--font-mono);
			font-size: 10px;
			line-height: 1;
			text-transform: uppercase;
		}

		.browser-workbench-status.online {
			border-color: rgba(141, 255, 178, 0.28);
			color: rgba(141, 255, 178, 0.9);
		}

		.browser-workbench-actions {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
		}

		.browser-workbench-actions button,
		.browser-target-row button {
			padding: 6px 10px;
			font-size: 10px;
		}

		.browser-target-list {
			display: grid;
			gap: 8px;
			min-height: 0;
		}

		.browser-target-row {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 10px;
			align-items: center;
			padding: 10px;
		}

		.browser-target-row.is-page {
			border-color: rgba(141, 255, 178, 0.24);
			background: linear-gradient(90deg, rgba(141, 255, 178, 0.08), rgba(255, 255, 255, 0.025));
		}

		.browser-target-kind {
			display: inline-flex;
			align-items: center;
			width: fit-content;
			padding: 2px 7px;
			border: 1px solid rgba(141, 255, 178, 0.26);
			border-radius: 999px;
			color: rgba(141, 255, 178, 0.92);
			font-size: 10px;
			line-height: 1.2;
		}

		.browser-target-row .browser-target-url {
			color: rgba(141, 255, 178, 0.9);
			font-family: var(--font-mono);
			font-size: 11px;
			font-weight: 700;
		}

		.browser-target-usage {
			display: flex;
			gap: 6px;
			flex-wrap: wrap;
		}

		.browser-target-usage span {
			width: fit-content;
			padding: 3px 7px;
			border: 1px solid rgba(201, 210, 255, 0.12);
			border-radius: 999px;
			background: rgba(255, 255, 255, 0.035);
			color: rgba(226, 234, 255, 0.68);
			font-family: var(--font-mono);
			font-size: 10px;
			line-height: 1.2;
		}

		.browser-target-usage .is-heavy {
			border-color: rgba(255, 113, 136, 0.32);
			color: rgba(255, 190, 202, 0.94);
			background: rgba(255, 113, 136, 0.08);
		}

		.browser-target-copy {
			display: grid;
			gap: 4px;
			min-width: 0;
		}

		.browser-workbench-empty {
			padding: 18px;
			border: 1px dashed rgba(201, 210, 255, 0.14);
			color: rgba(226, 234, 255, 0.58);
			font-size: 12px;
			text-align: center;
		}

		:root[data-theme="light"] .browser-workbench-body {
			background: #f1f5fa;
		}

		:root[data-theme="light"] .browser-workbench-item,
		:root[data-theme="light"] .browser-workbench-summary,
		:root[data-theme="light"] .browser-target-row {
			border-color: #dfe7f2;
			background: #ffffff;
			color: #24324a;
		}

		:root[data-theme="light"] .browser-workbench-item strong,
		:root[data-theme="light"] .browser-workbench-summary strong,
		:root[data-theme="light"] .browser-target-row strong {
			color: #172033;
		}

		:root[data-theme="light"] .browser-workbench-item span,
		:root[data-theme="light"] .browser-workbench-summary span,
		:root[data-theme="light"] .browser-target-row span,
		:root[data-theme="light"] .browser-target-row code {
			color: #40516d;
		}

		:root[data-theme="light"] .browser-target-row.is-page {
			border-color: #b8e6cc;
			background: linear-gradient(90deg, #eefaf3, #ffffff);
		}

		:root[data-theme="light"] .browser-workbench-item-label,
		:root[data-theme="light"] .browser-target-kind {
			border-color: #b8e6cc;
			color: #147d4f;
			background: #eefaf3;
		}

		:root[data-theme="light"] .browser-target-row .browser-target-url {
			color: #126a45;
		}

		:root[data-theme="light"] .browser-target-usage span {
			border-color: #dfe7f2;
			background: #f7faff;
			color: #40516d;
		}

		:root[data-theme="light"] .browser-target-usage .is-heavy {
			border-color: #f2b7c1;
			background: #fff1f4;
			color: #a12d42;
		}

		@media (max-width: 640px) {
			.browser-workbench-body {
				grid-template-columns: 1fr;
				min-height: 0;
			}

			.browser-workbench-list {
				grid-auto-flow: column;
				grid-auto-columns: minmax(180px, 72vw);
				overflow-x: auto;
				overflow-y: hidden;
			}

			.browser-workbench-summary {
				grid-template-columns: 1fr;
			}
		}
	`;
}

export function getPlaygroundBrowserWorkbenchDialogs(): string {
	return `
		<div id="browser-workbench-dialog" class="asset-modal-shell browser-workbench-dialog" aria-hidden="true" hidden>
			<section class="asset-modal browser-workbench-panel" role="dialog" aria-modal="true" aria-labelledby="browser-workbench-title">
				<header class="topbar asset-modal-head mobile-work-topbar">
					<div class="mobile-work-title-row">
						<button id="close-browser-workbench-button" class="mobile-work-back-button" type="button" aria-label="返回对话">
							<span aria-hidden="true">&larr;</span>
						</button>
						<div class="asset-modal-copy">
							<strong id="browser-workbench-title">Chrome 工作台</strong>
						</div>
					</div>
					<div class="asset-modal-actions mobile-work-topbar-actions">
						<button id="refresh-browser-workbench-button" type="button">刷新</button>
						<button id="start-browser-workbench-button" type="button">启动</button>
					</div>
				</header>
				<div class="asset-modal-body browser-workbench-body">
					<aside id="browser-workbench-list" class="browser-workbench-list" aria-label="Chrome 列表"></aside>
					<section class="browser-workbench-main" aria-label="Chrome 状态">
						<div id="browser-workbench-summary" class="browser-workbench-summary"></div>
						<div id="browser-workbench-status" class="agent-manager-notice" role="status" hidden></div>
						<div id="browser-workbench-targets" class="browser-target-list"></div>
					</section>
				</div>
			</section>
		</div>
	`;
}

export function getPlaygroundBrowserWorkbenchScript(): string {
	return `
		function getBrowserWorkbenchSelectedId() {
			const selected = String(state.browserWorkbenchSelectedBrowserId || "").trim();
			if (selected && (state.browserCatalog || []).some((browser) => browser.browserId === selected)) {
				return selected;
			}
			return String(state.defaultBrowserId || "default");
		}

		function setBrowserWorkbenchNotice(message, tone) {
			if (!browserWorkbenchStatus) return;
			browserWorkbenchStatus.textContent = message || "";
			browserWorkbenchStatus.dataset.tone = tone || "neutral";
			browserWorkbenchStatus.hidden = !message;
		}

		function formatBrowserUsageBytes(value) {
			const number = Number(value);
			if (!Number.isFinite(number) || number < 0) {
				return "-";
			}
			if (number < 1024 * 1024) {
				return Math.max(1, Math.round(number / 1024)) + " KB";
			}
			return (number / 1024 / 1024).toFixed(number >= 100 * 1024 * 1024 ? 0 : 1) + " MB";
		}

		function formatBrowserUsageCount(value) {
			const number = Number(value);
			if (!Number.isFinite(number) || number < 0) {
				return "-";
			}
			return Math.round(number).toLocaleString("zh-CN");
		}

		function getBrowserPageUsageLevel(usage) {
			if (!usage?.available) {
				return "unknown";
			}
			const heap = Number(usage.jsHeapUsedBytes || 0);
			const nodes = Number(usage.domNodes || 0);
			if (heap >= 300 * 1024 * 1024 || nodes >= 120000) {
				return "heavy";
			}
			if (heap >= 120 * 1024 * 1024 || nodes >= 50000) {
				return "busy";
			}
			return "normal";
		}

		function getBrowserPageUsageLabel(usage) {
			const level = getBrowserPageUsageLevel(usage);
			if (level === "heavy") return "占用偏高";
			if (level === "busy") return "占用较多";
			if (level === "normal") return "占用正常";
			return "占用未知";
		}

		function getBrowserWorkbenchPageTargets(status) {
			const allTargets = Array.isArray(status?.targets) ? status.targets : [];
			return {
				allTargets,
				pageTargets: allTargets.filter((target) => target?.type === "page"),
			};
		}

		function renderBrowserWorkbenchList(browsers, selectedId) {
			browserWorkbenchList.innerHTML = "";
			for (const browser of browsers) {
				const button = document.createElement("button");
				button.type = "button";
				button.className = "browser-workbench-item" + (browser.browserId === selectedId ? " is-selected" : "");
				button.dataset.browserId = browser.browserId;
				button.innerHTML = "<strong></strong><span></span><span></span><span class=\\"browser-workbench-item-label\\"></span>";
				button.querySelector("strong").textContent = browser.name || browser.browserId;
				const spans = button.querySelectorAll("span");
				spans[0].textContent = "编号：" + browser.browserId;
				spans[1].textContent = "地址：" + browser.cdpHost + ":" + browser.cdpPort;
				spans[2].textContent = browser.isDefault ? "系统默认" : "独立登录态";
				button.addEventListener("click", () => {
					state.browserWorkbenchSelectedBrowserId = browser.browserId;
					renderBrowserWorkbench();
					void loadBrowserWorkbenchStatus();
				});
				browserWorkbenchList.appendChild(button);
			}
		}

		function renderBrowserWorkbenchSummary(status, pageTargets) {
			const online = Boolean(status?.online);
			const totalHeapUsed = pageTargets.reduce((sum, target) => {
				const value = Number(target?.usage?.jsHeapUsedBytes || 0);
				return Number.isFinite(value) ? sum + value : sum;
			}, 0);
			browserWorkbenchSummary.innerHTML = "";
			const summaryItems = [
				["状态", online ? "在线" : "离线"],
				["页面", String(pageTargets.length)],
				["页面占用", totalHeapUsed > 0 ? formatBrowserUsageBytes(totalHeapUsed) : "不可用"],
				["技术地址", status?.cdpUrl || "-"],
			];
			for (const [label, value] of summaryItems) {
				const item = document.createElement("div");
				item.className = "browser-workbench-summary-item";
				const labelNode = document.createElement("span");
				labelNode.textContent = label;
				const valueNode = document.createElement("strong");
				valueNode.textContent = value;
				if (label === "状态") {
					valueNode.className = "browser-workbench-status" + (online ? " online" : "");
				}
				item.appendChild(labelNode);
				item.appendChild(valueNode);
				browserWorkbenchSummary.appendChild(item);
			}
		}

		function createBrowserTargetUsageView(usage) {
			const usageView = document.createElement("div");
			usageView.className = "browser-target-usage";
			const usageLabel = document.createElement("span");
			usageLabel.textContent = getBrowserPageUsageLabel(usage);
			if (getBrowserPageUsageLevel(usage) === "heavy") {
				usageLabel.classList.add("is-heavy");
			}
			const heap = document.createElement("span");
			heap.textContent = "JS 内存：" + formatBrowserUsageBytes(usage?.jsHeapUsedBytes);
			const dom = document.createElement("span");
			dom.textContent = "页面元素：" + formatBrowserUsageCount(usage?.domNodes);
			const listeners = document.createElement("span");
			listeners.textContent = "事件：" + formatBrowserUsageCount(usage?.eventListeners);
			usageView.appendChild(usageLabel);
			usageView.appendChild(heap);
			usageView.appendChild(dom);
			usageView.appendChild(listeners);
			return usageView;
		}

		function createBrowserTargetRow(target) {
			const row = document.createElement("div");
			row.className = "browser-target-row is-page";
			const copy = document.createElement("div");
			copy.className = "browser-target-copy";
			const kind = document.createElement("span");
			kind.className = "browser-target-kind";
			kind.textContent = "页面";
			const title = document.createElement("strong");
			title.textContent = target.title || "未命名页面";
			const url = document.createElement("span");
			url.className = "browser-target-url";
			url.textContent = target.url || "about:blank";
			const meta = document.createElement("code");
			meta.textContent = "页面编号：" + target.targetId;
			copy.appendChild(kind);
			copy.appendChild(title);
			copy.appendChild(url);
			copy.appendChild(createBrowserTargetUsageView(target.usage));
			copy.appendChild(meta);
			const closeButton = document.createElement("button");
			closeButton.type = "button";
			closeButton.textContent = "关闭";
			closeButton.disabled = state.browserWorkbenchActionTargetId === target.targetId;
			closeButton.addEventListener("click", () => {
				void closeBrowserWorkbenchTarget(target.targetId);
			});
			row.appendChild(copy);
			row.appendChild(closeButton);
			return row;
		}

		function renderBrowserWorkbenchTargets(status, pageTargets, hiddenTargetCount) {
			const online = Boolean(status?.online);
			browserWorkbenchTargets.innerHTML = "";
			if (!pageTargets.length) {
				const empty = document.createElement("div");
				empty.className = "browser-workbench-empty";
				empty.textContent = state.browserWorkbenchLoading ? "正在读取页面" : (online ? "当前没有页面" : "Chrome 未在线或 CDP 不可达");
				browserWorkbenchTargets.appendChild(empty);
				return;
			}
			if (hiddenTargetCount > 0) {
				const notice = document.createElement("div");
				notice.className = "browser-workbench-empty";
				notice.textContent = "已隐藏 " + hiddenTargetCount + " 个浏览器内部项目，只显示真正页面。";
				browserWorkbenchTargets.appendChild(notice);
			}
			for (const target of pageTargets) {
				browserWorkbenchTargets.appendChild(createBrowserTargetRow(target));
			}
		}

		function renderBrowserWorkbench() {
			if (!browserWorkbenchDialog) return;
			const browsers = Array.isArray(state.browserCatalog) ? state.browserCatalog : [];
			const selectedId = getBrowserWorkbenchSelectedId();
			const status = state.browserWorkbenchStatus;
			const { allTargets, pageTargets } = getBrowserWorkbenchPageTargets(status);
			const hiddenTargetCount = Math.max(0, allTargets.length - pageTargets.length);

			renderBrowserWorkbenchList(browsers, selectedId);
			renderBrowserWorkbenchSummary(status, pageTargets);
			startBrowserWorkbenchButton.disabled = state.browserWorkbenchLoading;
			refreshBrowserWorkbenchButton.disabled = state.browserWorkbenchLoading;
			startBrowserWorkbenchButton.textContent = state.browserWorkbenchStarting ? "启动中" : "启动";
			renderBrowserWorkbenchTargets(status, pageTargets, hiddenTargetCount);
		}

		async function loadBrowserWorkbenchStatus() {
			const browserId = getBrowserWorkbenchSelectedId();
			if (!browserId) return;
			state.browserWorkbenchLoading = true;
			renderBrowserWorkbench();
			try {
				const response = await fetch("/v1/browsers/" + encodeURIComponent(browserId) + "/status", {
					headers: { accept: "application/json" },
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(payload?.message || "读取 Chrome 状态失败");
				}
				state.browserWorkbenchStatus = payload.status;
				setBrowserWorkbenchNotice(payload.status?.online ? "" : (payload.status?.message || "Chrome 未在线"), payload.status?.online ? "success" : "error");
			} catch (error) {
				state.browserWorkbenchStatus = null;
				setBrowserWorkbenchNotice(error instanceof Error ? error.message : "读取 Chrome 状态失败", "error");
			} finally {
				state.browserWorkbenchLoading = false;
				renderBrowserWorkbench();
			}
		}

		async function openBrowserWorkbench(returnFocusElement) {
			state.browserWorkbenchOpen = true;
			state.browserWorkbenchRestoreFocusElement = rememberPanelReturnFocus(returnFocusElement);
			browserWorkbenchDialog.hidden = false;
			browserWorkbenchDialog.inert = false;
			browserWorkbenchDialog.classList.add("open");
			browserWorkbenchDialog.setAttribute("aria-hidden", "false");
			const contained = openWorkspacePanel("browsers", browserWorkbenchDialog);
			if (!contained) {
				browserWorkbenchList.focus?.();
			}
			await loadBrowserCatalog();
			state.browserWorkbenchSelectedBrowserId = getBrowserWorkbenchSelectedId();
			renderBrowserWorkbench();
			await loadBrowserWorkbenchStatus();
		}

		function closeBrowserWorkbench() {
			if (!state.browserWorkbenchOpen) return;
			state.browserWorkbenchOpen = false;
			closeWorkspacePanel("browsers", browserWorkbenchDialog);
			restoreFocusAfterPanelClose(browserWorkbenchDialog, state.browserWorkbenchRestoreFocusElement);
			browserWorkbenchDialog.classList.remove("open");
			browserWorkbenchDialog.setAttribute("aria-hidden", "true");
			browserWorkbenchDialog.inert = true;
			browserWorkbenchDialog.hidden = true;
			state.browserWorkbenchRestoreFocusElement = null;
		}

		async function closeBrowserWorkbenchTarget(targetId) {
			const browserId = getBrowserWorkbenchSelectedId();
			state.browserWorkbenchActionTargetId = targetId;
			renderBrowserWorkbench();
			try {
				const response = await fetch(
					"/v1/browsers/" + encodeURIComponent(browserId) + "/targets/" + encodeURIComponent(targetId) + "/close",
					{ method: "POST", headers: { accept: "application/json" } },
				);
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(payload?.message || "关闭页面失败");
				}
				setBrowserWorkbenchNotice("页面已关闭。", "success");
				await loadBrowserWorkbenchStatus();
			} catch (error) {
				setBrowserWorkbenchNotice(error instanceof Error ? error.message : "关闭页面失败", "error");
			} finally {
				state.browserWorkbenchActionTargetId = "";
				renderBrowserWorkbench();
			}
		}

		async function startBrowserFromWorkbench() {
			const browserId = getBrowserWorkbenchSelectedId();
			state.browserWorkbenchStarting = true;
			renderBrowserWorkbench();
			try {
				const response = await fetch("/v1/browsers/" + encodeURIComponent(browserId) + "/start", {
					method: "POST",
					headers: { accept: "application/json" },
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok && payload?.supported !== false) {
					throw new Error(payload?.message || "启动 Chrome 失败");
				}
				setBrowserWorkbenchNotice(payload?.message || "当前环境不支持从 Web 启动 Chrome。", payload?.supported === false ? "neutral" : "success");
				await loadBrowserWorkbenchStatus();
			} catch (error) {
				setBrowserWorkbenchNotice(error instanceof Error ? error.message : "启动 Chrome 失败", "error");
			} finally {
				state.browserWorkbenchStarting = false;
				renderBrowserWorkbench();
			}
		}

		function bindBrowserWorkbenchEvents() {
			openBrowserWorkbenchButton.addEventListener("click", () => {
				void openBrowserWorkbench(openBrowserWorkbenchButton);
			});
			closeBrowserWorkbenchButton.addEventListener("click", closeBrowserWorkbench);
			refreshBrowserWorkbenchButton.addEventListener("click", () => {
				void loadBrowserWorkbenchStatus();
			});
			startBrowserWorkbenchButton.addEventListener("click", () => {
				void startBrowserFromWorkbench();
			});
			browserWorkbenchDialog.addEventListener("click", (event) => {
				if (event.target === browserWorkbenchDialog) {
					closeBrowserWorkbench();
				}
			});
		}
	`;
}
