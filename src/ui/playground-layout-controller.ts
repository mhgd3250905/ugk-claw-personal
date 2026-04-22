export function getPlaygroundLayoutConstantsScript(): string {
	return `
		const LAYOUT_SYNC_DELAY_MS = 80;
		const RESUME_SYNC_COOLDOWN_MS = 900;
		const TRANSCRIPT_BOTTOM_SYNC_COOLDOWN_MS = 160;
	`;
}

export function getPlaygroundLayoutControllerScript(): string {
	return `
		function syncConversationLayout() {
			const composerWidth = Math.round(composerDropTarget.getBoundingClientRect().width || 0);
			if (composerWidth > 0) {
				shell.style.setProperty("--conversation-width", composerWidth + "px");
			}
			const chatStageRect = chatStage.getBoundingClientRect();
			const commandDeckRect = commandDeck.getBoundingClientRect();
			const commandDeckOffset = Math.ceil(chatStageRect.bottom - commandDeckRect.top || 0);
			if (commandDeckOffset > 0) {
				shell.style.setProperty("--command-deck-offset", commandDeckOffset + "px");
			}
		}

		function scheduleConversationLayoutSync(options) {
			if (state.layoutSyncRaf) {
				return;
			}
			const delay = options?.immediate ? 0 : LAYOUT_SYNC_DELAY_MS;
			if (state.layoutSyncTimer !== null) {
				window.clearTimeout(state.layoutSyncTimer);
				state.layoutSyncTimer = null;
			}
			const queueFrame = () => {
				state.layoutSyncRaf = window.requestAnimationFrame(() => {
					state.layoutSyncRaf = 0;
					syncConversationLayout();
				});
			};
			if (delay <= 0) {
				queueFrame();
				return;
			}
			state.layoutSyncTimer = window.setTimeout(() => {
				state.layoutSyncTimer = null;
				queueFrame();
			}, delay);
		}

		function syncConversationWidth() {
			scheduleConversationLayoutSync({ immediate: true });
		}

		function syncComposerTextareaHeight() {
			const style = window.getComputedStyle(messageInput);
			const lineHeight = Number.parseFloat(style.lineHeight) || 20;
			const paddingTop = Number.parseFloat(style.paddingTop) || 0;
			const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
			const maxLines = 10;
			const maxHeight = Math.ceil(lineHeight * maxLines + paddingTop + paddingBottom);
			messageInput.style.height = "auto";
			const nextHeight = Math.min(messageInput.scrollHeight, maxHeight);
			messageInput.style.height = nextHeight + "px";
			messageInput.style.overflowY = messageInput.scrollHeight > maxHeight ? "auto" : "hidden";
			scheduleConversationLayoutSync();
		}

		function setTranscriptState(next) {
			shell.dataset.transcriptState = next === "active" ? "active" : "idle";
			scheduleConversationLayoutSync();
		}

		function isTranscriptNearBottom() {
			const remaining = transcript.scrollHeight - transcript.clientHeight - transcript.scrollTop;
			return remaining <= TRANSCRIPT_FOLLOW_THRESHOLD_PX;
		}

		function updateScrollToBottomButton() {
			const shouldShow =
				!state.autoFollowTranscript &&
				transcript.scrollHeight > transcript.clientHeight + TRANSCRIPT_FOLLOW_THRESHOLD_PX;
			scrollToBottomButton.hidden = !shouldShow;
			scrollToBottomButton.classList.toggle("visible", shouldShow);
		}

		function cancelScheduledTranscriptAutoScroll() {
			if (state.transcriptScrollTimer !== null) {
				window.clearTimeout(state.transcriptScrollTimer);
				state.transcriptScrollTimer = null;
			}
			if (state.transcriptScrollRaf) {
				window.cancelAnimationFrame(state.transcriptScrollRaf);
				state.transcriptScrollRaf = 0;
			}
		}

		function syncTranscriptFollowState() {
			state.autoFollowTranscript = isTranscriptNearBottom();
			if (!state.autoFollowTranscript) {
				cancelScheduledTranscriptAutoScroll();
			}
			updateScrollToBottomButton();
		}

		function scrollTranscriptToBottom(options) {
			if (!(options?.force || state.autoFollowTranscript || isTranscriptNearBottom())) {
				updateScrollToBottomButton();
				return;
			}

			const applyScroll = () => {
				state.transcriptScrollRaf = 0;
				transcript.scrollTop = transcript.scrollHeight;
				state.lastTranscriptScrollAt = Date.now();
				state.autoFollowTranscript = true;
				updateScrollToBottomButton();
			};

			if (options?.force) {
				if (state.transcriptScrollTimer !== null) {
					window.clearTimeout(state.transcriptScrollTimer);
					state.transcriptScrollTimer = null;
				}
				if (state.transcriptScrollRaf) {
					window.cancelAnimationFrame(state.transcriptScrollRaf);
					state.transcriptScrollRaf = 0;
				}
				applyScroll();
				return;
			}

			if (state.transcriptScrollRaf || state.transcriptScrollTimer !== null) {
				return;
			}

			const elapsed = Date.now() - state.lastTranscriptScrollAt;
			const delay = Math.max(0, TRANSCRIPT_BOTTOM_SYNC_COOLDOWN_MS - elapsed);
			const queueScroll = () => {
				state.transcriptScrollTimer = null;
				state.transcriptScrollRaf = window.requestAnimationFrame(applyScroll);
			};
			if (delay > 0) {
				state.transcriptScrollTimer = window.setTimeout(queueScroll, delay);
			} else {
				queueScroll();
			}
		}

		function scheduleResumeConversationSync(reason, options) {
			connectNotificationStream();
			if (state.resumeSyncPromise) {
				return state.resumeSyncPromise;
			}
			if (state.resumeSyncTimer !== null) {
				return Promise.resolve();
			}
			const elapsed = Date.now() - state.lastResumeSyncAt;
			const delay = Math.max(0, RESUME_SYNC_COOLDOWN_MS - elapsed);
			state.resumeSyncTimer = window.setTimeout(() => {
				state.resumeSyncTimer = null;
				state.lastResumeSyncAt = Date.now();
				state.resumeSyncPromise = (async () => {
					await ensureCurrentConversation({ silent: true });
					if (!state.conversationId) {
						return;
					}
					await restoreConversationHistoryFromServer(state.conversationId, {
						silent: true,
						clearIfIdle: state.loading,
						attachIfRunning: true,
					});
				})()
					.catch(() => undefined)
					.finally(() => {
						state.resumeSyncPromise = null;
					});
			}, delay);
			return Promise.resolve();
		}

		function handleTranscriptScroll() {
			syncTranscriptFollowState();
			if (transcript.scrollTop <= 5 && !state.historyLoadingMore) {
				renderMoreConversationHistory();
			}
		}

		function bindPlaygroundLayoutController() {
			window.addEventListener("resize", syncConversationWidth);
			document.addEventListener("visibilitychange", () => {
				if (document.visibilityState === "visible") {
					void scheduleResumeConversationSync("visibilitychange", { restoreHistory: true });
				}
			});
			window.addEventListener("pageshow", () => {
				state.pageUnloading = false;
				void scheduleResumeConversationSync("pageshow", { restoreHistory: true });
			});
			window.addEventListener("online", () => {
				void scheduleResumeConversationSync("online", { restoreHistory: false });
			});
			const layoutObserver = new ResizeObserver(() => {
				scheduleConversationLayoutSync();
			});
			layoutObserver.observe(composerDropTarget);
			syncComposerTextareaHeight();
			scrollToBottomButton.addEventListener("click", () => {
				scrollTranscriptToBottom({ force: true });
			});
			transcript.addEventListener("scroll", handleTranscriptScroll);
			scheduleConversationLayoutSync({ immediate: true });
		}
	`;
}
