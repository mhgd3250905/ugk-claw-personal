export function getPlaygroundHistoryPaginationControllerScript(): string {
	return `
		function hasOlderConversationHistory() {
			return state.renderedHistoryCount < state.conversationHistory.length || state.historyHasMore;
		}

		function syncHistoryAutoLoadStatus() {
			historyAutoLoadStatus.hidden = !state.historyLoadingMore;
			historyAutoLoadStatus.textContent = state.historyLoadingMore
				? "正在加载更早历史"
				: "";
		}

		async function fetchOlderConversationHistoryFromServer() {
			if (!state.historyHasMore || !state.historyNextBefore) {
				return false;
			}

			const conversationId = String(state.conversationId || "").trim();
			const before = state.historyNextBefore;
			const page = await fetchConversationHistoryPage(conversationId, {
				before,
				limit: MAX_STORED_MESSAGES_PER_CONVERSATION,
			});
			if (conversationId !== String(state.conversationId || "").trim()) {
				return false;
			}

			const existingIds = new Set(state.conversationHistory.map((entry) => entry.id));
			const olderEntries = page.messages
				.map(normalizeHistoryEntry)
				.filter(Boolean)
				.filter((entry) => !existingIds.has(entry.id));
			if (olderEntries.length > 0) {
				state.conversationHistory = olderEntries.concat(state.conversationHistory);
			}
			state.historyHasMore = Boolean(page.hasMore);
			state.historyNextBefore = typeof page.nextBefore === "string" ? page.nextBefore : "";
			return olderEntries.length > 0;
		}

		async function renderMoreConversationHistory() {
			if (state.historyLoadingMore) {
				return;
			}

			state.historyLoadingMore = true;
			syncHistoryAutoLoadStatus();
			try {
				let remaining = state.conversationHistory.length - state.renderedHistoryCount;
				if (remaining <= 0 && state.historyHasMore) {
					await fetchOlderConversationHistoryFromServer();
					remaining = state.conversationHistory.length - state.renderedHistoryCount;
				}
				if (remaining <= 0) {
					return;
				}

				const previousHeight = transcript.scrollHeight;
				const nextCount = Math.min(state.historyPageSize, remaining);
				const startIndex = Math.max(0, state.conversationHistory.length - state.renderedHistoryCount - nextCount);
				const slice = state.conversationHistory.slice(startIndex, startIndex + nextCount);

				for (const entry of slice.slice().reverse()) {
					renderTranscriptEntry(entry, "prepend");
				}

				state.renderedHistoryCount += slice.length;
				const heightDelta = transcript.scrollHeight - previousHeight;
				if (heightDelta > 0) {
					transcript.scrollTop += heightDelta;
				}
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "无法获取更早的对话历史";
				showError(messageText);
			} finally {
				state.historyLoadingMore = false;
				syncHistoryAutoLoadStatus();
			}
		}
	`;
}
