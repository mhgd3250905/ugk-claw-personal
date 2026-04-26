export function getPlaygroundNotificationControllerScript(): string {
	return `
		function clearNotificationReconnectTimer() {
			if (state.notificationReconnectTimer !== null) {
				window.clearTimeout(state.notificationReconnectTimer);
				state.notificationReconnectTimer = null;
			}
		}

		function hideNotificationLiveRegionIfIdle() {
			if (!notificationToastStack.children.length) {
				notificationLiveRegion.hidden = true;
			}
		}

		function removeNotificationToast(toast) {
			if (!toast || !toast.parentNode) {
				hideNotificationLiveRegionIfIdle();
				return;
			}
			toast.parentNode.removeChild(toast);
			hideNotificationLiveRegionIfIdle();
		}

		function formatNotificationTimestamp(value) {
			const date = new Date(value || 0);
			if (!Number.isFinite(date.getTime())) {
				return "JUST NOW";
			}
			return date.toLocaleString("zh-CN", {
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
			});
		}

		function normalizeNotificationBroadcastEvent(rawEvent) {
			if (!rawEvent || typeof rawEvent !== "object") {
				return null;
			}
			const notificationId =
				typeof rawEvent.notificationId === "string"
					? rawEvent.notificationId.trim()
					: typeof rawEvent.activityId === "string"
						? rawEvent.activityId.trim()
						: "";
			const conversationId = typeof rawEvent.conversationId === "string" ? rawEvent.conversationId.trim() : "";
			const source = typeof rawEvent.source === "string" ? rawEvent.source.trim() : "";
			const sourceId = typeof rawEvent.sourceId === "string" ? rawEvent.sourceId.trim() : "";
			const kind = typeof rawEvent.kind === "string" ? rawEvent.kind.trim() : "";
			const title = typeof rawEvent.title === "string" ? rawEvent.title.trim() : "";
			const createdAt = typeof rawEvent.createdAt === "string" ? rawEvent.createdAt.trim() : "";
			const runId = typeof rawEvent.runId === "string" ? rawEvent.runId.trim() : "";
			if (!notificationId || !source || !sourceId || !kind || !title || !createdAt) {
				return null;
			}
			return {
				notificationId,
				conversationId: conversationId || undefined,
				source,
				sourceId,
				runId: runId || undefined,
				kind,
				title,
				createdAt,
			};
		}

		function showNotificationToast(event) {
			const notification = normalizeNotificationBroadcastEvent(event);
			if (!notification) {
				return;
			}
			notificationLiveRegion.hidden = false;
			const toast = document.createElement("article");
			toast.className = "notification-toast";
			toast.dataset.notificationId = notification.notificationId;
			const copy = document.createElement("div");
			copy.className = "notification-toast-copy";
			const title = document.createElement("strong");
			title.className = "notification-toast-title";
			title.textContent = notification.title;
			const meta = document.createElement("span");
			meta.className = "notification-toast-meta";
			meta.textContent =
				(notification.conversationId === state.conversationId ? "当前会话" : notification.conversationId) +
				" · " +
				formatNotificationTimestamp(notification.createdAt);
			copy.appendChild(title);
			copy.appendChild(meta);
			const dismissButton = document.createElement("button");
			dismissButton.type = "button";
			dismissButton.className = "notification-toast-dismiss";
			dismissButton.setAttribute("aria-label", "关闭实时通知");
			dismissButton.textContent = "×";
			dismissButton.addEventListener("click", () => {
				removeNotificationToast(toast);
			});
			toast.appendChild(copy);
			toast.appendChild(dismissButton);
			notificationToastStack.prepend(toast);
			while (notificationToastStack.children.length > 4) {
				removeNotificationToast(notificationToastStack.lastElementChild);
			}
			window.setTimeout(() => {
				removeNotificationToast(toast);
			}, 6000);
		}
	`;
}
