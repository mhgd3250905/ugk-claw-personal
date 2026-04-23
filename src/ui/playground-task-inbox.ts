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
			box-shadow:
				0 0 0 1px rgba(255, 255, 255, 0.78),
				0 0 14px rgba(255, 23, 68, 0.74);
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
			box-shadow:
				0 0 0 1px rgba(255, 255, 255, 0.82),
				0 0 16px rgba(255, 23, 68, 0.86);
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
			box-shadow:
				0 0 0 1px rgba(255, 255, 255, 0.78),
				0 0 14px rgba(255, 23, 68, 0.72);
		}

		.task-inbox-view {
			display: none;
			flex: 1 1 auto;
			min-height: 0;
		}

		.task-inbox-pane {
			display: grid;
			grid-template-rows: auto minmax(0, 1fr);
			width: min(var(--conversation-width), 100%);
			height: 100%;
			margin: 0 auto;
			min-height: 0;
		}

		.task-inbox-head {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 14px;
			padding: 8px 12px 12px;
		}

		.task-inbox-head-copy {
			display: grid;
			gap: 4px;
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
			justify-content: flex-end;
		}

		.task-inbox-head-button,
		.task-inbox-action {
			min-height: 28px;
			padding: 5px 10px;
			font-size: 11px;
		}

		.task-inbox-filter-row {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 8px;
			padding: 0 12px 12px;
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
			gap: 8px;
			padding: 14px 0 0;
		}

		.task-inbox-item-shell {
			display: grid;
			gap: 8px;
			padding: 14px 16px;
			border: 1px solid rgba(201, 210, 255, 0.12);
			border-radius: 4px;
			background: rgba(34, 38, 46, 0.72);
		}

		.task-inbox-item.is-unread .task-inbox-item-shell {
			border-color: rgba(101, 209, 255, 0.24);
			box-shadow: inset 3px 0 0 rgba(101, 209, 255, 0.5);
		}

		.task-inbox-item-head {
			justify-content: space-between;
		}

		.task-inbox-item-title-row {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 8px;
			min-width: 0;
		}

		.task-inbox-item-head strong {
			min-width: 0;
			color: rgba(246, 249, 255, 0.94);
			font-size: 13px;
		}

		.task-inbox-item-unread-dot {
			width: 8px;
			height: 8px;
			border-radius: 999px;
			background: #ff1744;
			box-shadow:
				0 0 0 2px rgba(255, 255, 255, 0.68),
				0 0 12px rgba(255, 23, 68, 0.76);
			flex: 0 0 auto;
		}

		.task-inbox-item-kind {
			color: rgba(201, 210, 255, 0.68);
			font-family: var(--font-mono);
			font-size: 10px;
			text-transform: uppercase;
		}

		.task-inbox-item-text {
			color: rgba(226, 234, 255, 0.78);
			font-size: 12px;
			line-height: 1.65;
			white-space: pre-wrap;
			word-break: break-word;
		}

		.task-inbox-item-meta {
			color: rgba(226, 234, 255, 0.5);
			font-size: 10px;
		}

		.task-inbox-item-meta code {
			color: rgba(223, 230, 255, 0.72);
			font-family: var(--font-mono);
			font-size: 10px;
		}

		.shell[data-primary-view="tasks"] .landing-screen,
		.shell[data-primary-view="tasks"] .stream-layout,
		.shell[data-primary-view="tasks"] .command-deck {
			display: none !important;
		}

		.shell[data-primary-view="tasks"] .task-inbox-view {
			display: flex;
		}

		@media (max-width: 640px) {
			.task-inbox-pane {
				width: 100%;
			}

			.task-inbox-head {
				position: sticky;
				top: 0;
				z-index: 2;
				display: grid;
				grid-template-columns: minmax(0, 1fr);
				gap: 12px;
				padding: 20px 0 12px;
				background:
					linear-gradient(180deg, rgba(12, 16, 28, 0.99), rgba(12, 16, 28, 0.92));
			}

			.task-inbox-head-actions {
				display: grid;
				grid-template-columns: repeat(3, minmax(0, 1fr));
			}

			.task-inbox-filter-row {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				padding: 0 0 12px;
			}

			.task-inbox-list {
				gap: 12px;
				padding: 0 0 16px;
			}

			.task-inbox-item-shell {
				min-height: 64px;
				padding: 14px;
				border-radius: 4px;
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
				<section id="task-inbox-view" class="task-inbox-view" aria-hidden="true" hidden>
					<div class="task-inbox-pane">
						<header class="pane-head task-inbox-head">
							<div class="task-inbox-head-copy">
								<strong>任务消息</strong>
								<span>后台任务跑完的结果统一收在这里，不再往当前会话里乱塞。</span>
							</div>
							<div class="task-inbox-head-actions">
								<button id="mark-all-task-inbox-read-button" class="task-inbox-head-button" type="button">全部已读</button>
								<button id="refresh-task-inbox-button" class="task-inbox-head-button" type="button">刷新</button>
								<button id="close-task-inbox-button" class="task-inbox-head-button" type="button">返回对话</button>
							</div>
						</header>
						<div class="task-inbox-filter-row" role="group" aria-label="任务消息筛选">
							<button id="task-inbox-filter-unread-button" class="task-inbox-filter-button" type="button">未读</button>
							<button id="task-inbox-filter-all-button" class="task-inbox-filter-button" type="button">全部</button>
						</div>
						<section id="task-inbox-list" class="task-inbox-list" aria-live="polite"></section>
					</div>
				</section>
	`;
}

export function getPlaygroundTaskInboxElementRefsScript(): string {
	return `
		const markAllTaskInboxReadButton = document.getElementById("mark-all-task-inbox-read-button");
		const taskInboxFilterUnreadButton = document.getElementById("task-inbox-filter-unread-button");
		const taskInboxFilterAllButton = document.getElementById("task-inbox-filter-all-button");
		const mobileOverflowTaskInboxBadge = document.getElementById("mobile-overflow-task-inbox-badge");
	`;
}

export function getPlaygroundTaskInboxControllerScript(): string {
	return `
		function renderTaskInboxToggleState() {
			const unreadCount = Math.max(0, Number(state.taskInboxUnreadCount) || 0);
			const isTasksView = state.primaryView === "tasks";
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

		function setPrimaryView(next, options) {
			const normalized = String(next || "chat").trim() === "tasks" ? "tasks" : "chat";
			state.primaryView = normalized;
			shell.dataset.primaryView = normalized;
			if (taskInboxView) {
				taskInboxView.hidden = normalized !== "tasks";
				taskInboxView.setAttribute("aria-hidden", normalized === "tasks" ? "false" : "true");
			}
			renderTaskInboxToggleState();
			if (normalized === "tasks") {
				renderTaskInbox();
				if (!options?.skipRefresh) {
					void loadTaskInbox({ silent: true });
				}
				return;
			}
			if (options?.focusComposer !== false) {
				messageInput.focus({ preventScroll: true });
			}
		}

		function openTaskInbox() {
			state.taskInboxFilter = state.taskInboxUnreadCount > 0 ? "unread" : "all";
			setPrimaryView("tasks");
		}

		function closeTaskInbox() {
			setPrimaryView("chat");
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
			return Math.max(0, Number(payload?.unreadCount) || 0);
		}

		async function syncTaskInboxSummary(options) {
			try {
				state.taskInboxUnreadCount = await fetchTaskInboxSummary();
				renderTaskInboxToggleState();
				if (state.primaryView === "tasks") {
					updateTaskInboxFilterButtons();
					updateMarkAllTaskInboxReadButtonState();
				}
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
			return normalizeTaskInboxItem(payload?.activity);
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
			if (changed && state.primaryView === "tasks") {
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
				const activity = await markTaskInboxItemRead(activityId);
				setTaskInboxItemReadLocally(activityId, activity?.readAt);
				await syncTaskInboxSummary({ silent: true });
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
				if (state.primaryView === "tasks") {
					renderTaskInbox();
				}
				await syncTaskInboxSummary({ silent: true });
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
			if (state.primaryView === "tasks") {
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
				state.taskInboxError = "";
				if (state.primaryView === "tasks") {
					renderTaskInbox();
				}
				void syncTaskInboxSummary({ silent: true });
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "无法读取任务消息";
				state.taskInboxError = messageText;
				if (!options?.silent) {
					showError(messageText);
				}
				if (state.primaryView === "tasks") {
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
				if (state.primaryView === "tasks") {
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

				const text = document.createElement("div");
				text.className = "task-inbox-item-text";
				text.textContent = activity.text || "没有正文摘要。";

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

				const actions = document.createElement("div");
				actions.className = "task-inbox-item-actions";
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
				shell.appendChild(text);
				shell.appendChild(meta);
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
			if (state.primaryView === "tasks") {
				closeTaskInbox();
				return;
			}
			openTaskInbox();
		});
		mobileMenuTaskInboxButton.addEventListener("click", () => {
			closeMobileOverflowMenu();
			openTaskInbox();
		});
		closeTaskInboxButton.addEventListener("click", closeTaskInbox);
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
