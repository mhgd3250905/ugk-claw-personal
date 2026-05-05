export function getPlaygroundTaskInboxStyles(): string {
	return `
		.mobile-overflow-menu-item-badge {
			justify-self: end;
			min-width: 20px;
			padding: 1px 6px;
			border-radius: 999px;
			background: #ff1744;
			color: #ffffff;
			font-size: 10px;
			font-weight: 700;
			line-height: 1.6;
			text-align: center;
			box-shadow: none;
		}

		.mobile-topbar-button-with-badge {
			position: relative;
			overflow: visible;
		}

		.mobile-topbar-notification-badge {
			position: absolute;
			top: -5px;
			right: -6px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 18px;
			height: 18px;
			padding: 0 5px;
			border: 2px solid rgba(12, 14, 20, 0.96);
			border-radius: 999px;
			background: #ff1744;
			color: #ffffff;
			font-size: 10px;
			font-variant-numeric: tabular-nums;
			font-weight: 800;
			line-height: 1;
			box-shadow: none;
			pointer-events: none;
		}

		.mobile-topbar-notification-badge[hidden] {
			display: none !important;
		}

		.telemetry-action-with-badge {
			position: relative;
		}

		.telemetry-action[data-active="true"] {
			border-color: rgba(101, 209, 255, 0.24);
			background: rgba(101, 209, 255, 0.08);
		}

		.telemetry-action-badge {
			position: absolute !important;
			top: 4px;
			right: 4px;
			width: auto !important;
			height: auto !important;
			min-width: 18px;
			padding: 1px 5px;
			clip: auto !important;
			overflow: visible !important;
			border-radius: 999px;
			background: #ff1744;
			color: #ffffff;
			font-size: 10px;
			font-weight: 700;
			line-height: 1.4;
			white-space: nowrap;
			box-shadow: none;
		}

		.task-inbox-view {
			position: fixed;
			inset: 0;
			z-index: 60;
			display: none;
			align-items: center;
			justify-content: center;
			padding: 22px;
			background: #01030a;
			backdrop-filter: none;
		}

		.task-inbox-view.open {
			display: flex;
		}

		.task-inbox-pane {
			display: grid;
			grid-template-rows: auto minmax(0, 1fr);
			width: min(820px, 100%);
			height: min(78vh, 760px);
			min-height: 0;
			border: 0;
			border-radius: 8px;
			background:
				linear-gradient(180deg, #060711 0%, #040611 100%),
				#060711;
			box-shadow: none;
			overflow: hidden;
		}

		.task-inbox-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			padding: 8px 12px;
			background: transparent;
		}

		.task-inbox-head-copy {
			display: grid;
			min-width: 0;
		}

		.task-inbox-head-actions,
		.task-inbox-item-actions,
		.task-inbox-item-head,
		.task-inbox-item-meta {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 8px 10px;
		}

		.task-inbox-head-actions,
		.task-inbox-item-actions {
			justify-content: flex-start;
			gap: 4px;
			padding-top: 2px;
		}

		.task-inbox-item-actions button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			height: 22px;
			padding: 0 8px;
			border: 0;
			border-radius: 4px;
			background: transparent;
			color: rgba(238, 244, 255, 0.36);
			font-size: 10px;
			line-height: 1;
			cursor: pointer;
		}

		.task-inbox-item-actions button:hover:not(:disabled) {
			background: rgba(255, 255, 255, 0.05);
			color: rgba(238, 244, 255, 0.62);
		}

		.task-inbox-head-actions {
			flex-wrap: nowrap;
			gap: 6px;
			min-width: 0;
			overflow-x: auto;
			overflow-y: hidden;
			scrollbar-width: none;
			-ms-overflow-style: none;
		}

		.task-inbox-head-actions::-webkit-scrollbar {
			display: none;
		}

		.task-inbox-head-button,
		.task-inbox-action {
			min-height: 28px;
			padding: 5px 10px;
			font-size: 11px;
		}

		.task-inbox-filter-row {
			display: flex;
			flex: 0 0 auto;
			flex-wrap: nowrap;
			align-items: center;
			gap: 6px;
			padding: 0;
		}

		.task-inbox-head-button,
		.task-inbox-filter-button {
			flex: 0 0 auto;
			white-space: nowrap;
		}

		.task-inbox-filter-button {
			min-height: 30px;
			padding: 5px 12px;
			border-radius: 4px;
			font-size: 11px;
		}

		.task-inbox-filter-button[data-active="true"] {
			border-color: rgba(101, 209, 255, 0.28);
			background: rgba(101, 209, 255, 0.1);
			color: rgba(242, 248, 255, 0.96);
		}

		.task-inbox-load-more {
			justify-self: center;
			margin: 4px 0 12px;
			min-height: 32px;
			padding: 6px 14px;
			border-radius: 4px;
			font-size: 11px;
		}

		.task-inbox-list {
			display: grid;
			align-content: start;
			gap: 14px;
			min-height: 0;
			padding: 0 0 12px;
			overflow-y: auto;
			overflow-x: hidden;
			scrollbar-width: none;
			-ms-overflow-style: none;
		}

		.task-inbox-list::-webkit-scrollbar {
			display: none;
		}

		.task-inbox-item {
			display: grid;
			gap: 0;
			padding: 0;
		}

		.task-inbox-item + .task-inbox-item {
			margin-top: 8px;
		}

		.task-inbox-item-shell {
			position: relative;
			display: grid;
			gap: 10px;
			padding: 14px 16px;
			border: 0;
			border-radius: 4px;
			background: #0b0c18;
			box-shadow: none;
			overflow: hidden;
		}

		.task-inbox-result-bubble {
			display: grid;
			gap: 10px;
			width: 100%;
			min-width: 0;
			padding: 0;
			border: 0;
			border-radius: 0;
			background: transparent;
			color: #d1d5e0;
			box-shadow: none;
			backdrop-filter: none;
		}

		.task-inbox-item-head {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			gap: 12px;
			background: transparent;
			color: rgba(238, 244, 255, 0.42);
			font-size: 10px;
			line-height: 1.5;
			letter-spacing: 0.02em;
			text-transform: none;
		}

		.task-inbox-item-title-row {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 8px;
			min-width: 0;
		}

		.task-inbox-item-head strong {
			display: inline;
			min-width: 0;
			padding: 0;
			border: 0;
			border-radius: 0;
			background: transparent;
			color: rgba(248, 251, 255, 0.94);
			font-size: 12px;
			font-weight: 650;
			line-height: 1.35;
			letter-spacing: 0.01em;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.task-inbox-item-unread-dot {
			width: 7px;
			height: 7px;
			border-radius: 999px;
			background: #ff1744;
			box-shadow: none;
			flex: 0 0 auto;
		}

		.task-inbox-item-kind {
			display: inline-flex;
			align-items: center;
			height: 18px;
			padding: 0 7px;
			border-radius: 4px;
			background: rgba(143, 147, 173, 0.1);
			color: rgba(143, 147, 173, 0.6);
			font-family: inherit;
			font-size: 10px;
			line-height: 1;
			letter-spacing: 0.02em;
			text-transform: none;
			white-space: nowrap;
			flex-shrink: 0;
		}

		/* Unread left edge accent */
		.task-inbox-item.is-unread .task-inbox-item-shell::before {
			content: "";
			position: absolute;
			left: 0;
			top: 12px;
			bottom: 12px;
			width: 3px;
			border-radius: 999px;
			background: linear-gradient(180deg, #c9d2ff, #8dffb2);
		}

		/* Read item: dimmed */
		.task-inbox-item:not(.is-unread) .task-inbox-item-head strong {
			color: rgba(238, 244, 255, 0.76);
			font-weight: 600;
		}

		.task-inbox-item:not(.is-unread) .task-inbox-item-text {
			color: rgba(209, 213, 224, 0.72);
		}

		.task-inbox-item-text {
			color: #d1d5e0;
			font-size: 12px;
			line-height: 1.7;
			word-break: break-word;
			padding-right: 6px;
		}

		.task-inbox-result-bubble .message-content,
		.task-inbox-result-bubble .message-content .code-block-language {
			color: #edf5ff;
		}

		.task-inbox-result-bubble .message-content h1 {
			color: #ffffff;
			font-size: 18px;
			line-height: 1.35;
		}

		.task-inbox-result-bubble .message-content h2 {
			color: #d7e5ff;
			font-size: 16px;
			line-height: 1.38;
		}

		.task-inbox-result-bubble .message-content h3 {
			color: #bdf0df;
			font-size: 14px;
			line-height: 1.42;
		}

		.task-inbox-result-bubble .message-content h4,
		.task-inbox-result-bubble .message-content h5,
		.task-inbox-result-bubble .message-content h6 {
			color: #ffdca8;
			font-size: 13px;
			line-height: 1.45;
		}

		.task-inbox-result-bubble .message-content a {
			color: #8fd6ff;
			text-decoration-color: rgba(143, 214, 255, 0.42);
		}

		.task-inbox-result-bubble .message-content strong {
			color: #fff4c7;
		}

		.task-inbox-result-bubble .message-content code {
			color: #ffe6ad;
			border-color: rgba(255, 255, 255, 0.12);
			background: rgba(255, 220, 168, 0.12);
		}

		.task-inbox-result-bubble .message-content blockquote {
			border-left-color: rgba(128, 232, 198, 0.46);
			background: rgba(128, 232, 198, 0.08);
			color: rgba(223, 255, 244, 0.9);
		}

		.task-inbox-result-bubble .message-content pre,
		.task-inbox-result-bubble .message-content .code-block {
			border-color: rgba(255, 220, 168, 0.16);
			background: rgba(7, 10, 18, 0.5);
		}

		.task-inbox-result-bubble .message-content th {
			color: #d7e5ff;
			background: rgba(143, 214, 255, 0.1);
		}

		.task-inbox-result-bubble .message-content td {
			color: rgba(237, 245, 255, 0.84);
		}

		.task-inbox-result-bubble .copy-code-button {
			border-color: rgba(255, 255, 255, 0.12);
			background: rgba(255, 255, 255, 0.12);
			color: #edf5ff;
		}

		.task-inbox-item-meta {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 6px;
			color: rgba(226, 234, 255, 0.48);
			font-size: 10px;
		}

		.task-inbox-item-meta > span {
			display: inline-flex;
			align-items: center;
			height: 18px;
			padding: 0 6px;
			border-radius: 4px;
			background: rgba(255, 255, 255, 0.04);
			color: rgba(226, 234, 255, 0.48);
			font-size: 10px;
			line-height: 1;
			font-family: var(--font-mono);
		}

		.task-inbox-item-meta > span:last-child {
			background: rgba(141, 255, 178, 0.07);
			color: rgba(141, 255, 178, 0.64);
			font-family: inherit;
		}

		.task-inbox-item-meta code {
			color: inherit;
			font-family: inherit;
			font-size: inherit;
			background: transparent;
			padding: 0;
		}

					@media (min-width: 641px) {
				.mobile-work-back-button {
					display: none !important;
				}
			}

@media (max-width: 640px) {
				.task-inbox-item-shell {
					border-radius: 4px;
					background: transparent;
				}

				.task-inbox-result-bubble {
					background: #0b0e19;
					border: 0;
					border-radius: 4px;
					padding: 14px;
				}

			.task-inbox-view.open {
				align-items: stretch;
				justify-content: stretch;
				padding: 0;
				background: #01030a;
				backdrop-filter: none;
			}

			.task-inbox-pane {
				width: 100%;
				height: 100dvh;
				max-height: 100dvh;
				border-radius: 0;
				background: #01030a;
				box-shadow: none;
			}

			.task-inbox-view {
				padding: 0;
			}

			.task-inbox-head {
				position: sticky;
				top: 0;
				z-index: 2;
				display: flex;
				align-items: center;
				gap: 10px;
				margin: 0 -10px;
				padding: calc(8px + env(safe-area-inset-top)) 10px 10px;
				border-bottom: 0;
				background: #101421;
				box-shadow: none;
			}

			.task-inbox-head-actions {
				display: flex;
				justify-content: flex-start;
				overflow-x: auto;
			}

			.task-inbox-filter-row {
				display: flex;
				padding: 0;
			}

			.task-inbox-list {
				gap: 12px;
				padding: 12px 10px calc(16px + env(safe-area-inset-bottom));
			}

			.task-inbox-result-bubble {
				min-height: 64px;
				padding: 14px;
				border: 0;
				border-radius: 4px;
				background: #0b0e19;
				box-shadow: none;
			}

			.task-inbox-item-actions {
				display: grid;
				grid-template-columns: repeat(3, minmax(0, 1fr));
			}

			.task-inbox-head-button,
			.task-inbox-action {
				border-radius: 4px;
			}
		}
	`;
}

export function getPlaygroundTaskInboxView(): string {
	return `
				<div id="task-inbox-view" class="task-inbox-view" aria-hidden="true" hidden>
					<section class="task-inbox-pane" role="dialog" aria-modal="true" aria-labelledby="task-inbox-title">
						<header class="topbar pane-head task-inbox-head">
							<div class="mobile-work-title-row task-inbox-head-left">
								<button id="close-task-inbox-button" class="mobile-work-back-button task-inbox-head-button" type="button" aria-label="返回对话">
									<span aria-hidden="true">&larr;</span>
								</button>
								<span class="task-inbox-head-breadcrumb">工作区 /</span>
								<div class="task-inbox-head-copy">
									<strong id="task-inbox-title">任务消息</strong>
									<span id="task-inbox-unread-count" class="task-inbox-head-count"></span>
								</div>
							</div>
							<div class="task-inbox-head-actions">
								<div class="task-inbox-filter-row" role="group" aria-label="任务消息筛选">
									<button id="task-inbox-filter-unread-button" class="task-inbox-filter-button" type="button">未读</button>
									<button id="task-inbox-filter-all-button" class="task-inbox-filter-button" type="button">全部</button>
								</div>
								<button id="mark-all-task-inbox-read-button" class="task-inbox-head-button" type="button">全部已读</button>
								<button id="refresh-task-inbox-button" class="task-inbox-head-button" type="button">刷新</button>
								
							</div>
						</header>
						<section id="task-inbox-list" class="task-inbox-list" aria-live="polite"></section>
					</section>
				</div>
	`;
}

export function getPlaygroundTaskInboxElementRefsScript(): string {
	return `
		const markAllTaskInboxReadButton = document.getElementById("mark-all-task-inbox-read-button");
		const taskInboxFilterUnreadButton = document.getElementById("task-inbox-filter-unread-button");
		const taskInboxFilterAllButton = document.getElementById("task-inbox-filter-all-button");
		const mobileOverflowTaskInboxBadge = document.getElementById("mobile-overflow-task-inbox-badge");
						const taskInboxUnreadCount = document.getElementById("task-inbox-unread-count");
	`;
}

export function getPlaygroundTaskInboxControllerScript(): string {
	return `
		function renderTaskInboxToggleState() {
			const unreadCount = Math.max(0, Number(state.taskInboxUnreadCount) || 0);
			const isTasksView = Boolean(state.taskInboxOpen);
			const entries = [
				{ button: openTaskInboxButton, badge: taskInboxUnreadBadge, baseLabel: "任务消息" },
				{ button: mobileMenuTaskInboxButton, badge: mobileTaskInboxUnreadBadge, baseLabel: "任务消息" },
			];
			for (const entry of entries) {
				if (!entry.button || !entry.badge) {
					continue;
				}
				entry.button.setAttribute("aria-pressed", isTasksView ? "true" : "false");
				entry.button.dataset.active = isTasksView ? "true" : "false";
				entry.badge.hidden = unreadCount < 1;
				entry.badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
				if (taskInboxUnreadCount) { taskInboxUnreadCount.textContent = unreadCount > 0 ? String(unreadCount) : ""; }
				entry.button.setAttribute(
					"aria-label",
					unreadCount > 0 ? entry.baseLabel + "，未读 " + unreadCount : entry.baseLabel,
				);
			}
			if (mobileOverflowMenuButton && mobileOverflowTaskInboxBadge) {
				mobileOverflowTaskInboxBadge.hidden = unreadCount < 1;
				mobileOverflowTaskInboxBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
				mobileOverflowMenuButton.setAttribute(
					"aria-label",
					unreadCount > 0 ? "更多操作，任务消息未读 " + unreadCount : "更多操作",
				);
				mobileOverflowMenuButton.title = unreadCount > 0 ? "更多操作，任务消息未读 " + unreadCount : "更多操作";
			}
		}

		function showTaskInboxPage(restoreFocusElement, options) {
			state.taskInboxOpen = true;
			state.taskInboxRestoreFocusElement = rememberPanelReturnFocus(
				restoreFocusElement || openTaskInboxButton,
			);
			taskInboxView.hidden = false;
			taskInboxView.classList.add("open");
			taskInboxView.setAttribute("aria-hidden", "false");
			renderTaskInboxToggleState();
			renderTaskInbox();
			openWorkspacePanel("task", taskInboxView, {
				forceOverlay: options?.mode !== "workspace",
			});
			if (!options?.skipRefresh) {
				void loadTaskInbox({ silent: true });
			}
		}

		function openTaskInbox(restoreFocusElement, options) {
			state.taskInboxFilter = state.taskInboxUnreadCount > 0 ? "unread" : "all";
			showTaskInboxPage(restoreFocusElement, options);
		}

		function closeTaskInbox() {
			state.taskInboxOpen = false;
			restoreFocusAfterPanelClose(taskInboxView, state.taskInboxRestoreFocusElement);
			state.taskInboxRestoreFocusElement = null;
			taskInboxView.classList.remove("open");
			taskInboxView.hidden = true;
			taskInboxView.setAttribute("aria-hidden", "true");
			closeWorkspacePanel("task", taskInboxView);
			renderTaskInboxToggleState();
		}

		function applyTaskInboxUnreadCount(payload) {
			state.taskInboxUnreadCount = Math.max(0, Number(payload?.unreadCount) || 0);
			renderTaskInboxToggleState();
			if (state.taskInboxOpen) {
				updateTaskInboxFilterButtons();
				updateMarkAllTaskInboxReadButtonState();
			}
			return state.taskInboxUnreadCount;
		}

		async function fetchTaskInboxSummary() {
			const response = await fetch("/v1/activity/summary", {
				method: "GET",
				headers: { accept: "application/json" },
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法读取任务消息摘要";
				throw new Error(errorMessage);
			}
			return payload;
		}

		async function syncTaskInboxSummary(options) {
			try {
				applyTaskInboxUnreadCount(await fetchTaskInboxSummary());
			} catch (error) {
				if (!options?.silent) {
					const messageText = error instanceof Error ? error.message : "无法读取任务消息摘要";
					showError(messageText);
				}
			}
		}

		function normalizeTaskInboxItem(item) {
			const activityId = String(item?.activityId || "").trim();
			if (!activityId) {
				return null;
			}
			return {
				activityId,
				scope: String(item?.scope || "agent").trim() || "agent",
				source: String(item?.source || "").trim() || "unknown",
				sourceId: typeof item?.sourceId === "string" ? item.sourceId : undefined,
				runId: typeof item?.runId === "string" ? item.runId : undefined,
				kind: String(item?.kind || "activity").trim() || "activity",
				title: String(item?.title || "任务消息").trim() || "任务消息",
				text: String(item?.text || "").trim(),
				files: Array.isArray(item?.files) ? item.files : [],
				createdAt: typeof item?.createdAt === "string" ? item.createdAt : new Date(0).toISOString(),
				readAt: typeof item?.readAt === "string" ? item.readAt : undefined,
			};
		}

		async function fetchTaskInboxItems(options) {
			const params = new URLSearchParams();
			params.set("limit", "50");
			if (state.taskInboxFilter === "unread") {
				params.set("unreadOnly", "true");
			}
			if (options?.append && state.taskInboxNextBefore) {
				params.set("before", state.taskInboxNextBefore);
			}
			const response = await fetch("/v1/activity?" + params.toString(), {
				method: "GET",
				headers: { accept: "application/json" },
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法读取任务消息";
				throw new Error(errorMessage);
			}
			return {
				activities: Array.isArray(payload?.activities)
					? payload.activities.map(normalizeTaskInboxItem).filter(Boolean)
					: [],
				hasMore: Boolean(payload?.hasMore),
				nextBefore: typeof payload?.nextBefore === "string" ? payload.nextBefore : "",
				unreadCount: Math.max(0, Number(payload?.unreadCount) || 0),
			};
		}

		async function markTaskInboxItemRead(activityId) {
			const response = await fetch("/v1/activity/" + encodeURIComponent(activityId) + "/read", {
				method: "POST",
				headers: { accept: "application/json" },
			});
			if (!response.ok) {
				throw new Error("标记任务消息已读失败");
			}
			const payload = await response.json().catch(() => ({}));
			return {
				activity: normalizeTaskInboxItem(payload?.activity),
				unreadCount: Math.max(0, Number(payload?.unreadCount) || 0),
			};
		}

		function setTaskInboxItemReadLocally(activityId, readAt) {
			let changed = false;
			if (state.taskInboxFilter === "unread") {
				const nextItems = state.taskInboxItems.filter((item) => item?.activityId !== activityId);
				changed = nextItems.length !== state.taskInboxItems.length;
				state.taskInboxItems = nextItems;
			} else {
				state.taskInboxItems = state.taskInboxItems.map((item) => {
					if (!item || item.activityId !== activityId || item.readAt) {
						return item;
					}
					changed = true;
					return {
						...item,
						readAt: readAt || new Date().toISOString(),
					};
				});
			}
			if (changed && state.taskInboxOpen) {
				renderTaskInbox();
			}
			return changed;
		}

		async function markTaskInboxItemReadAndSync(activityId, options) {
			const current = state.taskInboxItems.find((item) => item?.activityId === activityId);
			if (!current || current.readAt) {
				return;
			}
			try {
				const payload = await markTaskInboxItemRead(activityId);
				setTaskInboxItemReadLocally(activityId, payload.activity?.readAt);
				applyTaskInboxUnreadCount(payload);
			} catch (error) {
				if (!options?.silent) {
					const messageText = error instanceof Error ? error.message : "标记任务消息已读失败";
					showError(messageText);
				}
			}
		}

		async function markAllTaskInboxItemsRead() {
			if (state.taskInboxMarkingRead) {
				return;
			}
			state.taskInboxMarkingRead = true;
			if (markAllTaskInboxReadButton) {
				markAllTaskInboxReadButton.disabled = true;
			}
			try {
				const now = new Date().toISOString();
				const response = await fetch("/v1/activity/read-all", {
					method: "POST",
					headers: { accept: "application/json" },
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					const errorMessage = payload?.error?.message || payload?.message || "全部标记已读失败";
					throw new Error(errorMessage);
				}
				if (state.taskInboxFilter === "unread") {
					state.taskInboxItems = [];
					state.taskInboxHasMore = false;
					state.taskInboxNextBefore = "";
				} else {
					state.taskInboxItems = state.taskInboxItems.map((item) =>
						item?.readAt ? item : { ...item, readAt: now },
					);
				}
				if (state.taskInboxOpen) {
					renderTaskInbox();
				}
				applyTaskInboxUnreadCount(payload);
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "全部标记已读失败";
				showError(messageText);
			} finally {
				state.taskInboxMarkingRead = false;
				if (markAllTaskInboxReadButton) {
					markAllTaskInboxReadButton.disabled = false;
				}
			}
		}

		async function loadTaskInbox(options) {
			const append = Boolean(options?.append);
			if (append && (!state.taskInboxHasMore || state.taskInboxLoadingMore || state.taskInboxLoading)) {
				return;
			}
			if (!options?.silent) {
				clearError();
			}
			if (append) {
				state.taskInboxLoadingMore = true;
			} else {
				state.taskInboxLoading = true;
				state.taskInboxNextBefore = "";
				state.taskInboxHasMore = false;
			}
			state.taskInboxError = "";
			if (refreshTaskInboxButton) {
				refreshTaskInboxButton.disabled = true;
			}
			if (taskInboxList) {
				taskInboxList.setAttribute("aria-busy", "true");
			}
			if (state.taskInboxOpen) {
				renderTaskInbox();
			}
			try {
				const page = await fetchTaskInboxItems({ append });
				if (append) {
					const seen = new Set(state.taskInboxItems.map((item) => item?.activityId).filter(Boolean));
					const nextItems = page.activities.filter((item) => item && !seen.has(item.activityId));
					state.taskInboxItems = state.taskInboxItems.concat(nextItems);
				} else {
					state.taskInboxItems = page.activities;
				}
				state.taskInboxHasMore = page.hasMore;
				state.taskInboxNextBefore = page.nextBefore;
				state.taskInboxUnreadCount = page.unreadCount;
				renderTaskInboxToggleState();
				state.taskInboxError = "";
				if (state.taskInboxOpen) {
					renderTaskInbox();
				}
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "无法读取任务消息";
				state.taskInboxError = messageText;
				if (!options?.silent) {
					showError(messageText);
				}
				if (state.taskInboxOpen) {
					renderTaskInbox();
				}
			} finally {
				if (append) {
					state.taskInboxLoadingMore = false;
				} else {
					state.taskInboxLoading = false;
				}
				if (refreshTaskInboxButton) {
					refreshTaskInboxButton.disabled = false;
				}
				if (taskInboxList) {
					taskInboxList.removeAttribute("aria-busy");
				}
				if (state.taskInboxOpen) {
					renderTaskInbox();
				}
			}
		}

		function createTaskInboxAction(text, onClick, options) {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "task-inbox-action";
			button.textContent = text;
			button.disabled = Boolean(options?.disabled);
			button.addEventListener("click", onClick);
			return button;
		}

		function updateTaskInboxFilterButtons() {
			const unreadCount = Math.max(0, Number(state.taskInboxUnreadCount) || 0);
			const filters = [
				{
					button: taskInboxFilterUnreadButton,
					filter: "unread",
					label: unreadCount > 0 ? "未读 " + unreadCount : "未读",
				},
				{ button: taskInboxFilterAllButton, filter: "all", label: "全部" },
			];
			for (const entry of filters) {
				if (!entry.button) {
					continue;
				}
				const active = state.taskInboxFilter === entry.filter;
				entry.button.textContent = entry.label;
				entry.button.dataset.active = active ? "true" : "false";
				entry.button.setAttribute("aria-pressed", active ? "true" : "false");
				entry.button.disabled = state.taskInboxLoading || state.taskInboxLoadingMore;
			}
		}

		function updateMarkAllTaskInboxReadButtonState() {
			if (!markAllTaskInboxReadButton) {
				return;
			}
			const hasUnreadItems =
				state.taskInboxUnreadCount > 0 || state.taskInboxItems.some((item) => item && !item.readAt);
			markAllTaskInboxReadButton.disabled = state.taskInboxMarkingRead || !hasUnreadItems;
		}

		function renderTaskInbox() {
			if (!taskInboxList) {
				return;
			}
			updateTaskInboxFilterButtons();
			updateMarkAllTaskInboxReadButtonState();
			taskInboxList.innerHTML = "";
			if (state.taskInboxLoading && state.taskInboxItems.length === 0) {
				const loading = document.createElement("div");
				loading.className = "asset-empty";
				loading.textContent = "正在读取任务消息。";
				taskInboxList.appendChild(loading);
				return;
			}
			if (state.taskInboxError && state.taskInboxItems.length === 0) {
				const empty = document.createElement("div");
				empty.className = "asset-empty";
				empty.textContent = state.taskInboxError;
				taskInboxList.appendChild(empty);
				return;
			}
			const items = Array.isArray(state.taskInboxItems) ? state.taskInboxItems : [];
			if (items.length === 0) {
				const empty = document.createElement("div");
				empty.className = "asset-empty";
				empty.textContent =
					state.taskInboxFilter === "unread"
						? "暂无未读任务消息。"
						: "暂时没有任务消息。后台任务完成后，结果会出现在这里。";
				taskInboxList.appendChild(empty);
				return;
			}
			for (const activity of items) {
				const item = document.createElement("article");
				item.className = "task-inbox-item";
				if (!activity.readAt) {
					item.classList.add("is-unread");
				}
				const shell = document.createElement("div");
				shell.className = "task-inbox-item-shell";
				shell.tabIndex = 0;
				shell.setAttribute("role", "button");
				shell.setAttribute("aria-pressed", activity.readAt ? "true" : "false");
				shell.setAttribute("aria-label", (activity.title || "任务消息") + "，点击标记已读");

				const head = document.createElement("div");
				head.className = "task-inbox-item-head";
				const titleRow = document.createElement("div");
				titleRow.className = "task-inbox-item-title-row";
				if (!activity.readAt) {
					const unreadDot = document.createElement("span");
					unreadDot.className = "task-inbox-item-unread-dot";
					unreadDot.setAttribute("aria-hidden", "true");
					titleRow.appendChild(unreadDot);
				}
				const title = document.createElement("strong");
				title.textContent = activity.title || "任务消息";
				titleRow.appendChild(title);
				const source = document.createElement("span");
				source.className = "task-inbox-item-kind";
				source.textContent = describeActivitySourceLabel(activity.source, activity.kind);
				head.appendChild(titleRow);
				head.appendChild(source);

				const body = document.createElement("div");
				body.className = "task-inbox-result-bubble";
				const text = document.createElement("div");
				text.className = "task-inbox-item-text message-content";
				const resultText = activity.text || "没有正文摘要。";
				if (typeof renderMessageMarkdown === "function") {
					text.innerHTML = renderMessageMarkdown(resultText);
					if (typeof hydrateMarkdownContent === "function") {
						hydrateMarkdownContent(text);
					}
				} else {
					text.textContent = resultText;
				}

				const meta = document.createElement("div");
				meta.className = "task-inbox-item-meta";
				const created = document.createElement("span");
				created.textContent = formatConnRunTimestamp(activity.createdAt) || activity.createdAt || "";
				meta.appendChild(created);
				const taskId = activity.runId || activity.activityId;
				if (taskId) {
					const run = document.createElement("span");
					run.textContent = "任务 ";
					const code = document.createElement("code");
					code.textContent = taskId;
					run.appendChild(code);
					meta.appendChild(run);
				}
				if (activity.files.length > 0) {
					const files = document.createElement("span");
					files.textContent = "附 " + activity.files.length + " 个文件";
					meta.appendChild(files);
				}
				body.appendChild(text);
				if (activity.files.length > 0 && typeof appendFileDownloadList === "function") {
					appendFileDownloadList(body, activity.files);
				}
				body.appendChild(meta);

				const actions = document.createElement("div");
				actions.className = "task-inbox-item-actions message-actions";
				const taskIdButton = createTaskInboxAction("任务ID", async () => {
					await markTaskInboxItemReadAndSync(activity.activityId, { silent: true });
					const original = taskIdButton.textContent;
					try {
						await copyTextToClipboard(taskId || "");
						taskIdButton.textContent = "已复制ID";
					} catch {
						taskIdButton.textContent = "复制失败";
					} finally {
						window.setTimeout(() => {
							taskIdButton.textContent = original;
						}, 1200);
					}
				}, { disabled: !taskId });
				const copyButton = createTaskInboxAction("复制", async () => {
					await markTaskInboxItemReadAndSync(activity.activityId, { silent: true });
					const original = copyButton.textContent;
					try {
						await copyTextToClipboard(activity.text || "");
						copyButton.textContent = "已复制";
					} catch {
						copyButton.textContent = "复制失败";
					} finally {
						window.setTimeout(() => {
							copyButton.textContent = original;
						}, 1200);
					}
				}, { disabled: !activity.text });
				const detailsButton = createTaskInboxAction("查看过程", async () => {
					await markTaskInboxItemReadAndSync(activity.activityId, { silent: true });
					void openConnRunDetails(activity, openTaskInboxButton);
				}, { disabled: !canOpenConnRunDetails(activity) });
				actions.appendChild(taskIdButton);
				actions.appendChild(copyButton);
				actions.appendChild(detailsButton);

				shell.addEventListener("click", async (event) => {
					if (event.target instanceof Element && event.target.closest("button")) {
						return;
					}
					await markTaskInboxItemReadAndSync(activity.activityId);
				});
				shell.addEventListener("keydown", async (event) => {
					if (event.key !== "Enter" && event.key !== " ") {
						return;
					}
					event.preventDefault();
					await markTaskInboxItemReadAndSync(activity.activityId);
				});

				shell.appendChild(head);
				shell.appendChild(body);
				shell.appendChild(actions);
				item.appendChild(shell);
				taskInboxList.appendChild(item);
			}
			if (state.taskInboxHasMore || state.taskInboxLoadingMore) {
				const loadMoreButton = document.createElement("button");
				loadMoreButton.id = "task-inbox-load-more-button";
				loadMoreButton.type = "button";
				loadMoreButton.className = "task-inbox-load-more";
				loadMoreButton.textContent = state.taskInboxLoadingMore ? "加载中" : "加载更多";
				loadMoreButton.disabled = state.taskInboxLoadingMore || state.taskInboxLoading;
				loadMoreButton.addEventListener("click", () => {
					void loadTaskInbox({ append: true, silent: false });
				});
				taskInboxList.appendChild(loadMoreButton);
			}
		}
	`;
}

export function getPlaygroundTaskInboxEventHandlersScript(): string {
	return `
		openTaskInboxButton.addEventListener("click", () => {
			toggleWorkspacePanel(
				"task",
				() => openTaskInbox(openTaskInboxButton, { mode: "workspace" }),
				closeTaskInbox,
			);
		});
		mobileMenuTaskInboxButton.addEventListener("click", () => {
			closeMobileOverflowMenu();
			openTaskInbox(mobileMenuTaskInboxButton);
		});
		closeTaskInboxButton.addEventListener("click", closeTaskInbox);
		taskInboxView.addEventListener("click", (event) => {
			if (event.target === taskInboxView) {
				closeTaskInbox();
			}
		});
		markAllTaskInboxReadButton.addEventListener("click", () => {
			void markAllTaskInboxItemsRead();
		});
		refreshTaskInboxButton.addEventListener("click", () => {
			void loadTaskInbox({ silent: false });
		});
		taskInboxFilterUnreadButton.addEventListener("click", () => {
			if (state.taskInboxFilter === "unread") {
				return;
			}
			state.taskInboxFilter = "unread";
			void loadTaskInbox({ silent: false });
		});
		taskInboxFilterAllButton.addEventListener("click", () => {
			if (state.taskInboxFilter === "all") {
				return;
			}
			state.taskInboxFilter = "all";
			void loadTaskInbox({ silent: false });
		});
	`;
}
