export interface ChatRequestBody {
	conversationId?: string;
	message: string;
	userId?: string;
	attachments?: ChatAttachmentBody[];
}

export interface ChatResponseBody {
	conversationId: string;
	text: string;
	sessionFile?: string;
	files?: ChatFileBody[];
}

export interface ChatAttachmentBody {
	fileName: string;
	mimeType?: string;
	sizeBytes?: number;
	text?: string;
}

export interface ChatFileBody {
	id: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	downloadUrl: string;
}

export interface DebugSkillsResponseBody {
	skills: Array<{
		name: string;
		path?: string;
	}>;
}

export type QueueMessageMode = "steer" | "followUp";

export interface QueueMessageRequestBody {
	conversationId: string;
	message: string;
	mode: QueueMessageMode;
	userId?: string;
	attachments?: ChatAttachmentBody[];
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
