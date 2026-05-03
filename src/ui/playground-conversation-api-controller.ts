export function getPlaygroundConversationApiControllerScript(): string {
	return `
		async function fetchConversationRunStatus(conversationId) {
			if (!conversationId) {
				return { conversationId: "", running: false, contextUsage: createFallbackContextUsage() };
			}

			const response = await fetch(getAgentApiPath("/chat/status") + "?conversationId=" + encodeURIComponent(conversationId), {
				method: "GET",
				headers: { accept: "application/json" },
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法获取当前会话状态";
				throw new Error(errorMessage);
			}

			return {
				conversationId: payload?.conversationId || conversationId,
				running: Boolean(payload?.running),
				contextUsage: normalizeContextUsage(payload?.contextUsage),
			};
		}

		async function fetchConversationState(conversationId, options) {
			const nextConversationId = String(conversationId || "").trim();
			if (!nextConversationId) {
				return {
					conversationId: "",
					running: false,
					contextUsage: createFallbackContextUsage(),
					messages: [],
					activeRun: null,
				};
			}

			const stateUrl =
				getAgentApiPath("/chat/state") + "?conversationId=" +
				encodeURIComponent(nextConversationId) +
				"&viewLimit=" +
				encodeURIComponent(String(MAX_STORED_MESSAGES_PER_CONVERSATION));
			const response = await fetch(stateUrl, {
				method: "GET",
				headers: { accept: "application/json" },
				signal: options?.signal,
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法获取当前会话状态";
				throw new Error(errorMessage);
			}

			return {
				conversationId: payload?.conversationId || nextConversationId,
				running: Boolean(payload?.running),
				contextUsage: normalizeContextUsage(payload?.contextUsage),
				messages: Array.isArray(payload?.messages) ? payload.messages : [],
				viewMessages: Array.isArray(payload?.viewMessages) ? payload.viewMessages : [],
				activeRun: normalizeActiveRun(payload?.activeRun),
				historyPage:
					payload?.historyPage && typeof payload.historyPage === "object"
						? {
								hasMore: Boolean(payload.historyPage.hasMore),
								nextBefore:
									typeof payload.historyPage.nextBefore === "string"
										? payload.historyPage.nextBefore
										: "",
								limit: Number.isFinite(payload.historyPage.limit)
									? payload.historyPage.limit
									: MAX_STORED_MESSAGES_PER_CONVERSATION,
							}
						: {
								hasMore: false,
								nextBefore: "",
								limit: MAX_STORED_MESSAGES_PER_CONVERSATION,
							},
				updatedAt: typeof payload?.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
			};
		}

		async function fetchConversationHistoryPage(conversationId, options) {
			const nextConversationId = String(conversationId || "").trim();
			if (!nextConversationId) {
				return {
					conversationId: "",
					messages: [],
					hasMore: false,
					nextBefore: "",
					limit: MAX_STORED_MESSAGES_PER_CONVERSATION,
				};
			}

			const params = new URLSearchParams();
			params.set("conversationId", nextConversationId);
			params.set("limit", String(options?.limit || MAX_STORED_MESSAGES_PER_CONVERSATION));
			const before = String(options?.before || "").trim();
			if (before) {
				params.set("before", before);
			}

			const response = await fetch(getAgentApiPath("/chat/history") + "?" + params.toString(), {
				method: "GET",
				headers: { accept: "application/json" },
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const errorMessage = payload?.error?.message || payload?.message || "无法获取更早的对话历史";
				throw new Error(errorMessage);
			}

			return {
				conversationId: payload?.conversationId || nextConversationId,
				messages: Array.isArray(payload?.messages) ? payload.messages : [],
				hasMore: Boolean(payload?.hasMore),
				nextBefore: typeof payload?.nextBefore === "string" ? payload.nextBefore : "",
				limit: Number.isFinite(payload?.limit) ? payload.limit : MAX_STORED_MESSAGES_PER_CONVERSATION,
			};
		}
	`;
}
