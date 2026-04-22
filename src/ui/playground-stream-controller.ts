export function getPlaygroundStreamControllerScript(): string {
	return `
		function scheduleNotificationStreamReconnect() {
			if (
				state.pageUnloading ||
				state.notificationEventSource ||
				state.notificationReconnectTimer !== null ||
				typeof EventSource !== "function"
			) {
				return;
			}
			const nextDelay = state.notificationReconnectDelayMs > 0
				? Math.min(state.notificationReconnectDelayMs * 2, 30000)
				: 1500;
			state.notificationReconnectDelayMs = nextDelay;
			state.notificationReconnectTimer = window.setTimeout(() => {
				state.notificationReconnectTimer = null;
				connectNotificationStream();
			}, nextDelay);
		}

		function disconnectNotificationStream() {
			clearNotificationReconnectTimer();
			const eventSource = state.notificationEventSource;
			state.notificationEventSource = null;
			if (eventSource) {
				eventSource.onopen = null;
				eventSource.onmessage = null;
				eventSource.onerror = null;
				eventSource.close();
			}
		}

		function handleNotificationBroadcastEvent(rawEvent) {
			const event = normalizeNotificationBroadcastEvent(rawEvent);
			if (!event) {
				return;
			}
			showNotificationToast(event);
			void loadAgentActivity({ silent: true });
			void syncConversationCatalog({
				silent: true,
				activateCurrent: false,
			});
			if (event.conversationId === state.conversationId) {
				void syncConversationRunState(event.conversationId, {
					silent: true,
					clearIfIdle: true,
				});
				void restoreConversationHistoryFromServer(event.conversationId);
			}
		}

		function connectNotificationStream() {
			if (state.pageUnloading || state.notificationEventSource || typeof EventSource !== "function") {
				return;
			}
			clearNotificationReconnectTimer();
			const stream = new EventSource("/v1/notifications/stream");
			state.notificationEventSource = stream;
			stream.onopen = () => {
				state.notificationReconnectDelayMs = 0;
			};
			stream.onmessage = (messageEvent) => {
				let payload;
				try {
					payload = JSON.parse(String(messageEvent.data || ""));
				} catch {
					return;
				}
				handleNotificationBroadcastEvent(payload);
			};
			stream.onerror = () => {
				if (state.notificationEventSource !== stream) {
					return;
				}
				state.notificationEventSource = null;
				stream.close();
				scheduleNotificationStreamReconnect();
			};
		}

		function stopActiveRunEventStream() {
			const controller = state.activeRunEventController;
			state.activeRunEventController = null;
			if (controller && !controller.signal.aborted) {
				controller.abort();
			}
		}

		function isAbortError(error) {
			return (
				error?.name === "AbortError" ||
				error?.code === 20 ||
				(typeof error?.message === "string" && error.message.toLowerCase().includes("abort"))
			);
		}

		async function attachActiveRunEventStream(conversationId) {
			const nextConversationId = String(conversationId || "").trim();
			if (!nextConversationId) {
				return;
			}
			if (
				state.activeRunEventController &&
				state.activeRunEventController.conversationId === nextConversationId &&
				!state.activeRunEventController.signal.aborted
			) {
				return;
			}

			stopActiveRunEventStream();
			const controller = new AbortController();
			controller.conversationId = nextConversationId;
			state.activeRunEventController = controller;

			try {
				const query = new URLSearchParams({ conversationId: nextConversationId });
				const response = await fetch("/v1/chat/events?" + query.toString(), {
					method: "GET",
					headers: { accept: "text/event-stream" },
					signal: controller.signal,
				});
				if (!response.ok) {
					throw new Error("无法重新连接当前运行任务");
				}

				await readEventStream(response, handleStreamEvent);
			} catch (error) {
				if (controller.signal.aborted || isAbortError(error) || isPageUnloadStreamError(error)) {
					return;
				}

				const messageText = error instanceof Error ? error.message : "无法重新连接当前运行任务";
				showError(messageText);
				updateStreamingProcess("error", "运行状态重连失败", messageText);
			} finally {
				if (state.activeRunEventController === controller) {
					state.activeRunEventController = null;
				}
			}
		}

		function buildConversationStateSignature(conversationState) {
			const source = conversationState && typeof conversationState === "object" ? conversationState : {};
			const messages = Array.isArray(source.messages) ? source.messages : [];
			const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
			const activeRun = normalizeActiveRun(source.activeRun);
			return JSON.stringify({
				updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
				running: Boolean(source.running),
				messageCount: messages.length,
				lastMessageId: lastMessage && typeof lastMessage.id === "string" ? lastMessage.id : "",
				lastMessageText: lastMessage && typeof lastMessage.text === "string" ? lastMessage.text : "",
				activeRunStatus: activeRun ? activeRun.status : "",
				activeRunText: activeRun ? activeRun.text : "",
			});
		}

		function isPageUnloadStreamError(error) {
			const messageText = error instanceof Error ? error.message : String(error || "");
			return state.pageUnloading && !state.receivedDoneEvent && isNetworkErrorText(messageText);
		}

		async function recoverRunningStreamAfterDisconnect(reason) {
			if (state.receivedDoneEvent || !state.conversationId) {
				return false;
			}

			const previousSignature = buildConversationStateSignature(state.conversationState);
			const payload = await syncConversationRunState(state.conversationId, {
				silent: true,
				clearIfIdle: false,
			});
			if (!payload.running) {
				const nextSignature = buildConversationStateSignature(state.conversationState);
				const canonicalStateSettled =
					nextSignature !== previousSignature || Boolean(state.conversationState?.activeRun);
				if (!canonicalStateSettled) {
					return false;
				}

				clearError();
				setLoading(false);
				return true;
			}

			clearError();
			setLoading(true);
			setAssistantLoadingState("当前正在运行", "system");
			updateStreamingProcess(
				"warn",
				"页面连接已恢复",
				reason === "missing_done"
					? "主连接结束但后端任务仍在运行，已切换到运行态事件流继续接收。"
					: "浏览器网络连接短暂断开，已重新订阅当前运行任务。",
			);
			return true;
		}

		function describeToolEvent(event, prefix) {
			const payload = event.args || event.partialResult || event.result || "";
			return prefix + " " + event.toolName + (payload ? "\\n" + payload : "");
		}

		function handleStreamEvent(event) {
			switch (event.type) {
				case "run_started":
					ensureStreamingAssistantMessage();
					setAssistantLoadingState("正在接手任务", "system");
					updateStreamingProcess("system", "任务开始", event.conversationId);
					statusPill.textContent = "运行中";
					void syncContextUsage(event.conversationId, { silent: true });
					break;
				case "tool_started":
					setAssistantLoadingState("正在调用工具", "tool");
					updateStreamingProcess("tool", "工具开始", describeToolEvent(event, "调用"));
					break;
				case "tool_updated":
					setAssistantLoadingState("正在等待工具返回", "tool");
					updateStreamingProcess("tool", "工具更新", describeToolEvent(event, "片段"));
					break;
				case "tool_finished":
					setAssistantLoadingState(
						event.isError ? "工具步骤失败" : "工具步骤已完成",
						event.isError ? "error" : "system",
					);
					updateStreamingProcess(
						event.isError ? "error" : "ok",
						"工具结束",
						describeToolEvent(event, event.isError ? "失败" : "完成"),
					);
					break;
				case "queue_updated":
					setAssistantLoadingState("正在等待当前步骤收尾", "system");
					updateStreamingProcess(
						"system",
						"队列更新",
						"转向消息: " + event.steering.length + "\\n追加消息: " + event.followUp.length,
					);
					break;
				case "interrupted":
					updateStreamingProcess("system", "任务已打断", event.conversationId);
					completeAssistantLoadingBubble("warn", "本轮已中断");
					completeProcessStream();
					setLoading(false);
					statusPill.textContent = "已打断";
					void syncContextUsage(event.conversationId, { silent: true });
					void restoreConversationHistoryFromServer(event.conversationId);
					break;
				case "text_delta": {
					state.streamingText += event.textDelta;
					const content = ensureStreamingAssistantMessage();
					setAssistantLoadingState("正在生成回复", "system");
					setMessageContent(content, state.streamingText);
					scrollTranscriptToBottom();
					break;
				}
				case "done": {
					state.receivedDoneEvent = true;
					sessionFile.textContent = event.sessionFile || "不可用";
					if (typeof event.text === "string" && event.text !== state.streamingText) {
						const content = ensureStreamingAssistantMessage();
						setMessageContent(content, event.text);
						state.streamingText = event.text;
					}
					mergeRecentAssets(event.inputAssets);
					appendFileDownloads(event.files);
					void loadAssets(true);
					updateStreamingProcess("ok", "任务完成", event.sessionFile || "未返回会话文件");
					completeAssistantLoadingBubble("ok", "本轮已完成");
					completeProcessStream();
					setLoading(false);
					statusPill.textContent = "完成";
					void syncContextUsage(event.conversationId, { silent: true });
					void restoreConversationHistoryFromServer(event.conversationId);
					break;
				}
				case "error":
					showError(event.message);
					updateStreamingProcess("error", "任务错误", event.message);
					completeAssistantLoadingBubble("error", "本轮执行失败");
					completeProcessStream();
					setLoading(false);
					void syncContextUsage(event.conversationId, { silent: true });
					void restoreConversationHistoryFromServer(event.conversationId);
					break;
				default:
					updateStreamingProcess("system", "事件", JSON.stringify(event));
					break;
			}
		}

		async function readEventStream(response, onEvent) {
			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error("流式读取器不可用");
			}

			const decoder = new TextDecoder();
			let buffer = "";

			while (true) {
				const { value, done } = await reader.read();
				buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\\r/g, "");

				let boundaryIndex = buffer.indexOf("\\n\\n");
				while (boundaryIndex !== -1) {
					const chunk = buffer.slice(0, boundaryIndex);
					buffer = buffer.slice(boundaryIndex + 2);

					const data = chunk
						.split("\\n")
						.filter((line) => line.startsWith("data:"))
						.map((line) => line.slice(5).trimStart())
						.join("\\n");

					if (data) {
						onEvent(JSON.parse(data));
					}

					boundaryIndex = buffer.indexOf("\\n\\n");
				}

				if (done) {
					break;
				}
			}
		}

		async function sendMessage() {
			const composerDraft = createComposerDraft();
			const message = messageInput.value.trim();
			const attachments = [...state.pendingAttachments];
			const assetRefs = [...state.selectedAssetRefs];
			if (!message && attachments.length === 0 && assetRefs.length === 0) {
				showError("请输入消息");
				return;
			}
			const outboundMessage =
				message ||
				(assetRefs.length > 0
					? "\\u8bf7\\u7ed3\\u5408\\u6211\\u5f15\\u7528\\u7684\\u8d44\\u4ea7\\u4e00\\u8d77\\u5904\\u7406"
					: "\\u8bf7\\u67e5\\u770b\\u6211\\u53d1\\u9001\\u7684\\u9644\\u4ef6");

			if (!state.conversationId) {
				await ensureCurrentConversation({ silent: false });
			} else {
				void syncConversationCatalog({
					silent: true,
					activateCurrent: false,
				});
			}
			ensureConversationId();
			if (!state.conversationId) {
				showError("无法确认当前会话");
				return;
			}
			clearError();

			if (state.loading) {
				if (isInterruptIntentMessage(outboundMessage) && attachments.length === 0 && assetRefs.length === 0) {
					appendTranscriptMessage("user", state.conversationId, outboundMessage, { forceScroll: true });
					updateStreamingProcess("system", "检测到停止意图", "本次发送改为直接打断当前任务");
					messageInput.value = "";
					await interruptRun();
					return;
				}
				await queueActiveMessage(outboundMessage, attachments, assetRefs, { composerDraft });
				return;
			}

			setTranscriptState("active");
			stopActiveRunEventStream();
			resetStreamingState();
			appendUserTranscriptMessage(message, attachments, assetRefs);
			updateStreamingProcess("system", "请求已发送", formatOutboundSummary(message, attachments, assetRefs));
			clearComposerDraft();
			setLoading(true);
			ensureStreamingAssistantMessage();
			setAssistantLoadingState("正在等待 Agent 开始处理", "system");

			let handoffToRunEvents = false;
			try {
				const payload = {
					conversationId: state.conversationId,
					message: outboundMessage,
					userId: "web-playground",
				};
				if (attachments.length > 0) {
					payload.attachments = attachments;
				}
				if (assetRefs.length > 0) {
					payload.assetRefs = assetRefs;
				}
				const response = await fetch("/v1/chat/stream", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					const body = await response.json().catch(() => ({}));
					const errorMessage = body?.error?.message || body?.message || "未知错误";
					restoreComposerDraft(composerDraft);
					showError(errorMessage);
					updateStreamingProcess("error", "请求被拒绝", errorMessage);
					completeAssistantLoadingBubble("error", "本轮执行失败");
					completeProcessStream();
					return;
				}

				state.primaryStreamActive = true;
				try {
					await readEventStream(response, handleStreamEvent);
				} finally {
					state.primaryStreamActive = false;
				}

				if (!state.receivedDoneEvent && !errorBanner.classList.contains("visible")) {
					const streamWasRecovered = await recoverRunningStreamAfterDisconnect("missing_done");
					if (streamWasRecovered) {
						handoffToRunEvents = true;
						return;
					}
					showError("流已结束，但没有收到完成事件");
					updateStreamingProcess("error", "流被中断", "缺少 done 事件");
					completeAssistantLoadingBubble("error", "本轮异常结束");
					completeProcessStream();
				}

				if (state.receivedDoneEvent) {
					messageInput.focus();
				}
			} catch (error) {
				if (isPageUnloadStreamError(error)) {
					return;
				}

				const streamWasRecovered = await recoverRunningStreamAfterDisconnect("network_error");
				if (streamWasRecovered) {
					handoffToRunEvents = true;
					return;
				}

				if (!String(state.streamingText || "").trim() && !state.receivedDoneEvent) {
					restoreComposerDraft(composerDraft);
				}
				const messageText = error instanceof Error ? error.message : "请求失败";
				showError(messageText);
				updateStreamingProcess("error", "网络错误", messageText);
				completeAssistantLoadingBubble("error", "本轮执行失败");
				completeProcessStream();
			} finally {
				state.primaryStreamActive = false;
				if (!state.pageUnloading && !handoffToRunEvents) {
					setLoading(false);
				}
			}
		}

		async function queueActiveMessage(message, attachments, assetRefs, options) {
			const composerDraft = options?.composerDraft || createComposerDraft();
			if (options?.appendTranscript !== false) {
				appendUserTranscriptMessage(message, attachments, assetRefs);
			}
			clearComposerDraft();

			try {
				const payloadBody = {
					conversationId: state.conversationId,
					message,
					mode: "steer",
					userId: "web-playground",
				};
				if (attachments.length > 0) {
					payloadBody.attachments = attachments;
				}
				if (assetRefs.length > 0) {
					payloadBody.assetRefs = assetRefs;
				}
				const response = await fetch("/v1/chat/queue", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payloadBody),
				});

				const payload = await response.json().catch(() => ({}));
				if (!response.ok || !payload.queued) {
					const errorMessage = getControlActionErrorMessage("queue", payload, "消息无法追加");
					restoreComposerDraft(composerDraft);
					showError(errorMessage);
					return;
				}

				messageInput.focus();
				updateStreamingProcess("ok", "消息已加入队列", payload.conversationId);
			} catch (error) {
				restoreComposerDraft(composerDraft);
				const messageText = error instanceof Error ? error.message : "追加请求失败";
				showError(messageText);
			}
		}

		async function interruptRun() {
			if (!state.loading) {
				return;
			}

			await ensureCurrentConversation({ silent: true });
			ensureConversationId();
			if (!state.conversationId) {
				showError("无法确认当前会话");
				return;
			}

			try {
				const response = await fetch("/v1/chat/interrupt", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						conversationId: state.conversationId,
					}),
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok || !payload.interrupted) {
					if (payload?.reason === "not_running") {
						updateStreamingProcess("ok", "任务状态已同步", "后端没有正在运行的任务");
						stopActiveRunEventStream();
						completeAssistantLoadingBubble("ok", "当前任务已结束");
						completeProcessStream();
						setLoading(false);
						statusPill.textContent = "已结束";
						return;
					}
					const errorMessage = getControlActionErrorMessage("interrupt", payload, "当前任务无法打断");
					showError(errorMessage);
					return;
				}
				updateStreamingProcess("ok", "打断请求已接收", state.conversationId);
				completeAssistantLoadingBubble("warn", "本轮已中断");
				completeProcessStream();
				setLoading(false);
				statusPill.textContent = "已打断";
			} catch (error) {
				const messageText = error instanceof Error ? error.message : "打断请求失败";
				showError(messageText);
			}
		}

		function bindPlaygroundStreamController() {
			connectNotificationStream();
		}
	`;
}
