export function getPlaygroundStatusControllerScript(): string {
	return `
		function setStageMode(next) {
			state.stageMode = next;
			shell.dataset.stageMode = next;
			landingScreen.setAttribute("aria-hidden", next === "landing" ? "false" : "true");
		}

		function setCommandStatus(next) {
			shell.dataset.commandState = String(next || "standby").toLowerCase();
			newConversationButton.dataset.state = shell.dataset.commandState;
		}

		function setLoading(next) {
			state.loading = next;
			sendButton.disabled = false;
			sendButton.textContent = "发送";
			interruptButton.disabled = !next;
			viewSkillsButton.disabled = next;
			filePickerAction.disabled = false;
			messageInput.disabled = false;
			fileInput.disabled = false;
			conversationInput.disabled = next;
			newConversationButton.disabled = next || state.conversationCreatePending;
			mobileNewConversationButton.disabled = next || state.conversationCreatePending;
			mobileOverflowMenuButton.disabled = false;
			mobileMenuSkillsButton.disabled = next;
			mobileMenuFileButton.disabled = false;
			mobileMenuLibraryButton.disabled = next;
			mobileMenuTaskInboxButton.disabled = false;
			mobileMenuConnButton.disabled = false;
			openAssetLibraryButton.disabled = next;
			openTaskInboxButton.disabled = false;
			openConnManagerButton.disabled = false;
			refreshAssetsButton.disabled = next;
			if (next) {
				closeMobileOverflowMenu();
				renderConversationDrawer();
			}
			setCommandStatus(next ? "RUNNING" : "STANDBY");
			statusPill.textContent = next ? "运行中" : "就绪";
		}

		function showError(message) {
			errorBannerMessage.textContent = message;
			errorBanner.hidden = false;
			errorBanner.classList.add("visible");
			setCommandStatus("ERROR");
			statusPill.textContent = "错误";
		}

		function formatControlActionReason(action, reason) {
			if (reason === "not_running") {
				return action === "interrupt"
					? "当前没有可打断的运行任务，请从顶部提示确认状态。"
					: "当前没有可追加的运行任务，请直接重新发送消息。";
			}
			if (reason === "abort_not_supported") {
				return "当前运行任务暂不支持打断，请等待它自然结束。";
			}
			return "";
		}

		function getControlActionErrorMessage(action, payload, fallbackMessage) {
			return (
				payload?.error?.message ||
				formatControlActionReason(action, payload?.reason) ||
				payload?.reason ||
				fallbackMessage
			);
		}

		function clearError() {
			errorBannerMessage.textContent = "";
			errorBanner.classList.remove("visible");
			errorBanner.hidden = true;
			if (!state.loading) {
				setCommandStatus("STANDBY");
			}
			if (!state.loading) {
				statusPill.textContent = "就绪";
			}
		}
	`;
}
