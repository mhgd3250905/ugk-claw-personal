export interface ChatRequestBody {
	conversationId?: string;
	message: string;
	userId?: string;
	attachments?: ChatAttachmentBody[];
	assetRefs?: string[];
}

export interface ChatResponseBody {
	conversationId: string;
	text: string;
	sessionFile?: string;
	inputAssets?: ChatAssetBody[];
	files?: ChatFileBody[];
}

export interface ChatAttachmentBody {
	fileName: string;
	mimeType?: string;
	sizeBytes?: number;
	text?: string;
	base64?: string;
}

export interface ChatAssetBody {
	assetId: string;
	reference: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	kind: "text" | "binary" | "metadata";
	hasContent: boolean;
	source: "user_upload" | "agent_output";
	conversationId: string;
	createdAt: string;
	sha256?: string;
	textPreview?: string;
	downloadUrl?: string;
}

export interface ChatFileBody {
	id: string;
	assetId: string;
	reference: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	downloadUrl: string;
}

export interface AssetListResponseBody {
	assets: ChatAssetBody[];
}

export interface AssetDetailResponseBody {
	asset: ChatAssetBody;
}

export interface CreateAssetRequestBody {
	conversationId?: string;
	attachments: ChatAttachmentBody[];
}

export interface CreateAssetResponseBody {
	assets: ChatAssetBody[];
}

export type ConnTargetBody =
	| {
			type: "conversation";
			conversationId: string;
	  }
	| {
			type: "feishu_chat";
			chatId: string;
	  }
	| {
			type: "feishu_user";
			openId: string;
	  };

export type ConnScheduleBody =
	| {
			kind: "once";
			at: string;
	  }
	| {
			kind: "interval";
			everyMs: number;
			startAt?: string;
	  }
	| {
			kind: "cron";
			expression: string;
			timezone?: string;
	  };

export interface ConnBody {
	connId: string;
	title: string;
	prompt: string;
	target: ConnTargetBody;
	schedule: ConnScheduleBody;
	assetRefs: string[];
	maxRunMs?: number;
	profileId?: string;
	agentSpecId?: string;
	skillSetId?: string;
	modelPolicyId?: string;
	upgradePolicy?: "latest" | "pinned" | "manual";
	status: "active" | "paused" | "completed";
	createdAt: string;
	updatedAt: string;
	lastRunAt?: string;
	nextRunAt?: string;
	lastRunId?: string;
}

export interface ConnListResponseBody {
	conns: ConnBody[];
}

export interface ConnDetailResponseBody {
	conn: ConnBody;
}

export interface ConnBulkDeleteRequestBody {
	connIds: string[];
}

export interface ConnBulkDeleteResponseBody {
	deletedConnIds: string[];
	missingConnIds: string[];
}

export interface ConnRunBody {
	runId: string;
	connId: string;
	status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
	scheduledAt: string;
	claimedAt?: string;
	startedAt?: string;
	leaseOwner?: string;
	leaseUntil?: string;
	finishedAt?: string;
	workspacePath: string;
	sessionFile?: string;
	resultSummary?: string;
	resultText?: string;
	errorText?: string;
	deliveredAt?: string;
	retryOfRunId?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ConnRunDetailResponseBody {
	run: ConnRunBody;
	files?: ConnRunFileBody[];
}

export interface ConnRunListResponseBody {
	runs: ConnRunBody[];
}

export interface ConnRunFileBody {
	fileId: string;
	runId: string;
	kind: string;
	relativePath: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	createdAt: string;
}

export interface ConnRunEventBody {
	eventId: string;
	runId: string;
	seq: number;
	eventType: string;
	event: Record<string, unknown>;
	createdAt: string;
}

export interface ConnRunEventsResponseBody {
	events: ConnRunEventBody[];
}

export interface NotificationStreamEventBody {
	notificationId: string;
	conversationId: string;
	source: string;
	sourceId: string;
	runId?: string;
	kind: string;
	title: string;
	createdAt: string;
}

export interface AgentActivityFileBody {
	fileName: string;
	downloadUrl: string;
	mimeType?: string;
	sizeBytes?: number;
}

export interface AgentActivityItemBody {
	activityId: string;
	scope: "agent";
	source: string;
	sourceId: string;
	runId?: string;
	conversationId?: string;
	kind: string;
	title: string;
	text: string;
	files: AgentActivityFileBody[];
	createdAt: string;
	readAt?: string;
}

export interface AgentActivityListResponseBody {
	activities: AgentActivityItemBody[];
}

export interface AgentActivityReadResponseBody {
	activity: AgentActivityItemBody;
}

export interface DebugSkillsResponseBody {
	skills: Array<{
		name: string;
		path?: string;
	}>;
}

export interface ChatContextUsageBody {
	provider: string;
	model: string;
	currentTokens: number;
	contextWindow: number;
	reserveTokens: number;
	maxResponseTokens: number;
	availableTokens: number;
	percent: number;
	status: "safe" | "caution" | "warning" | "danger";
	mode: "usage" | "estimate";
}

export interface ChatStatusResponseBody {
	conversationId: string;
	running: boolean;
	contextUsage: ChatContextUsageBody;
}

export interface ChatHistoryFileBody {
	fileName: string;
	downloadUrl: string;
	mimeType?: string;
	sizeBytes?: number;
}

export interface ChatHistoryMessageBody {
	id: string;
	kind: "user" | "assistant" | "system" | "error" | "notification";
	title: string;
	text: string;
	createdAt: string;
	source?: string;
	sourceId?: string;
	runId?: string;
	assetRefs?: ChatAssetBody[];
	files?: ChatHistoryFileBody[];
}

export interface ChatHistoryResponseBody {
	conversationId: string;
	messages: ChatHistoryMessageBody[];
}

export interface ConversationCatalogItemBody {
	conversationId: string;
	title: string;
	preview: string;
	messageCount: number;
	createdAt: string;
	updatedAt: string;
	running: boolean;
}

export interface ConversationCatalogResponseBody {
	currentConversationId: string;
	conversations: ConversationCatalogItemBody[];
}

export interface CreateConversationResponseBody {
	conversationId: string;
	currentConversationId: string;
	created: boolean;
	reason?: "running";
}

export interface DeleteConversationResponseBody {
	conversationId: string;
	currentConversationId: string;
	deleted: boolean;
	reason?: "running" | "not_found";
}

export interface SwitchConversationRequestBody {
	conversationId: string;
}

export interface SwitchConversationResponseBody {
	conversationId: string;
	currentConversationId: string;
	switched: boolean;
	reason?: "running" | "not_found";
}

export interface ChatProcessEntryBody {
	id: string;
	kind: "system" | "tool" | "ok" | "error";
	title: string;
	detail: string;
	createdAt: string;
	toolCallId?: string;
	toolName?: string;
	isError?: boolean;
}

export interface ChatProcessBody {
	title: string;
	narration: string[];
	currentAction?: string;
	kind?: "system" | "tool" | "ok" | "error";
	isComplete: boolean;
	entries: ChatProcessEntryBody[];
}

export interface ChatActiveRunInputBody {
	message: string;
	inputAssets: ChatAssetBody[];
}

export interface ChatActiveRunBody {
	runId: string;
	status: "running" | "interrupted" | "done" | "error";
	assistantMessageId: string;
	input: ChatActiveRunInputBody;
	text: string;
	process: ChatProcessBody | null;
	queue: {
		steering: string[];
		followUp: string[];
	} | null;
	loading: boolean;
	startedAt: string;
	updatedAt: string;
}

export interface ConversationStateResponseBody {
	conversationId: string;
	running: boolean;
	contextUsage: ChatContextUsageBody;
	messages: ChatHistoryMessageBody[];
	viewMessages: ChatHistoryMessageBody[];
	activeRun: ChatActiveRunBody | null;
	updatedAt: string;
}

export type QueueMessageMode = "steer" | "followUp";

export interface QueueMessageRequestBody {
	conversationId: string;
	message: string;
	mode: QueueMessageMode;
	userId?: string;
	attachments?: ChatAttachmentBody[];
	assetRefs?: string[];
}

export interface QueueMessageResponseBody {
	conversationId: string;
	mode: QueueMessageMode;
	queued: boolean;
	reason?: "not_running";
}

export interface InterruptChatRequestBody {
	conversationId: string;
}

export interface InterruptChatResponseBody {
	conversationId: string;
	interrupted: boolean;
	reason?: "not_running" | "abort_not_supported";
}

export interface ResetConversationRequestBody {
	conversationId: string;
}

export interface ResetConversationResponseBody {
	conversationId: string;
	reset: boolean;
	reason?: "running";
}

export type ChatStreamEvent =
	| {
			type: "run_started";
			conversationId: string;
	  }
	| {
			type: "text_delta";
			textDelta: string;
	  }
	| {
			type: "tool_started";
			toolCallId: string;
			toolName: string;
			args: string;
	  }
	| {
			type: "tool_updated";
			toolCallId: string;
			toolName: string;
			partialResult: string;
	  }
	| {
			type: "tool_finished";
			toolCallId: string;
			toolName: string;
			isError: boolean;
			result: string;
	  }
	| {
			type: "queue_updated";
			steering: readonly string[];
			followUp: readonly string[];
	  }
	| {
			type: "interrupted";
			conversationId: string;
	  }
	| {
			type: "done";
			conversationId: string;
			text: string;
			sessionFile?: string;
			inputAssets?: ChatAssetBody[];
			files?: ChatFileBody[];
	  }
	| {
			type: "error";
			conversationId: string;
			message: string;
	  };

export interface ErrorResponseBody {
	error: {
		code: "BAD_REQUEST" | "INTERNAL_ERROR";
		message: string;
	};
}
