import { createEmptyConversation, ensureCurrentConversationId } from "./agent-conversation-session.js";
import type { ConversationStore } from "./conversation-store.js";

export interface CreateConversationCommandInput {
	conversationStore: ConversationStore;
	hasActiveRun: boolean;
	generateConversationId?: () => string;
}

export interface CreateConversationCommandResult {
	conversationId: string;
	currentConversationId: string;
	created: boolean;
	reason?: "running";
}

export interface DeleteConversationCommandInput {
	conversationStore: ConversationStore;
	conversationId: string;
	hasActiveRun: boolean;
	deleteTerminalRun: (conversationId: string) => void;
}

export interface DeleteConversationCommandResult {
	conversationId: string;
	currentConversationId: string;
	deleted: boolean;
	reason?: "running" | "not_found";
}

export interface SwitchConversationCommandInput {
	conversationStore: ConversationStore;
	conversationId: string;
	hasActiveRun: boolean;
}

export interface SwitchConversationCommandResult {
	conversationId: string;
	currentConversationId: string;
	switched: boolean;
	reason?: "running" | "not_found";
}

export interface ResetConversationCommandInput {
	conversationStore: ConversationStore;
	conversationId: string;
	hasActiveRun: boolean;
	deleteTerminalRun: (conversationId: string) => void;
}

export interface ResetConversationCommandResult {
	conversationId: string;
	reset: boolean;
	reason?: "running";
}

export async function createConversationCommand(
	input: CreateConversationCommandInput,
): Promise<CreateConversationCommandResult> {
	const currentConversationId = await ensureCurrentConversationId({
		conversationStore: input.conversationStore,
		generateConversationId: input.generateConversationId,
	});
	if (input.hasActiveRun) {
		return {
			conversationId: currentConversationId,
			currentConversationId,
			created: false,
			reason: "running",
		};
	}

	const conversationId = await createEmptyConversation({
		conversationStore: input.conversationStore,
		generateConversationId: input.generateConversationId,
	});
	return {
		conversationId,
		currentConversationId: conversationId,
		created: true,
	};
}

export async function deleteConversationCommand(
	input: DeleteConversationCommandInput,
): Promise<DeleteConversationCommandResult> {
	const currentConversationId = await ensureCurrentConversationId({
		conversationStore: input.conversationStore,
	});
	if (input.hasActiveRun) {
		return {
			conversationId: currentConversationId,
			currentConversationId,
			deleted: false,
			reason: "running",
		};
	}

	const existingConversation = await input.conversationStore.get(input.conversationId);
	if (!existingConversation) {
		return {
			conversationId: input.conversationId,
			currentConversationId,
			deleted: false,
			reason: "not_found",
		};
	}

	await input.conversationStore.delete(input.conversationId);
	input.deleteTerminalRun(input.conversationId);
	const nextCurrentConversationId = await ensureCurrentConversationId({
		conversationStore: input.conversationStore,
	});
	return {
		conversationId: input.conversationId,
		currentConversationId: nextCurrentConversationId,
		deleted: true,
	};
}

export async function switchConversationCommand(
	input: SwitchConversationCommandInput,
): Promise<SwitchConversationCommandResult> {
	const currentConversationId = await ensureCurrentConversationId({
		conversationStore: input.conversationStore,
	});
	if (input.hasActiveRun) {
		return {
			conversationId: currentConversationId,
			currentConversationId,
			switched: false,
			reason: "running",
		};
	}

	const existingConversation = await input.conversationStore.get(input.conversationId);
	if (!existingConversation) {
		return {
			conversationId: input.conversationId,
			currentConversationId,
			switched: false,
			reason: "not_found",
		};
	}

	await input.conversationStore.setCurrentConversationId(input.conversationId);
	return {
		conversationId: input.conversationId,
		currentConversationId: input.conversationId,
		switched: true,
	};
}

export async function resetConversationCommand(
	input: ResetConversationCommandInput,
): Promise<ResetConversationCommandResult> {
	if (input.hasActiveRun) {
		return {
			conversationId: input.conversationId,
			reset: false,
			reason: "running",
		};
	}

	input.deleteTerminalRun(input.conversationId);
	await input.conversationStore.delete(input.conversationId);
	return {
		conversationId: input.conversationId,
		reset: true,
	};
}
