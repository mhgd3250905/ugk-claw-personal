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
	  };

export interface ConnBody {
	connId: string;
	title: string;
	prompt: string;
	target: ConnTargetBody;
	schedule: ConnScheduleBody;
	assetRefs: string[];
	status: "active" | "paused" | "completed";
	createdAt: string;
	updatedAt: string;
	lastRunAt?: string;
	nextRunAt?: string;
	lastResult?: {
		ok: boolean;
		summary: string;
		text?: string;
		error?: string;
		finishedAt: string;
	};
}

export interface ConnListResponseBody {
	conns: ConnBody[];
}

export interface ConnDetailResponseBody {
	conn: ConnBody;
}

export interface DebugSkillsResponseBody {
	skills: Array<{
		name: string;
		path?: string;
	}>;
}

export interface ChatStatusResponseBody {
	conversationId: string;
	running: boolean;
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
			message: string;
	  };

export interface ErrorResponseBody {
	error: {
		code: "BAD_REQUEST" | "INTERNAL_ERROR";
		message: string;
	};
}
