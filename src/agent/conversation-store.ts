import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface ConversationEntry {
	sessionFile?: string;
	updatedAt: string;
	createdAt?: string;
	skillFingerprint?: string;
	title?: string;
	preview?: string;
	messageCount?: number;
}

export interface ConversationListEntry extends ConversationEntry {
	conversationId: string;
}

interface ConversationStoreState {
	currentConversationId?: string;
	conversations: Record<string, ConversationEntry>;
}

type LegacyConversationIndex = Record<string, ConversationEntry>;

export class ConversationStore {
	constructor(private readonly indexPath: string) {}

	async get(conversationId: string): Promise<ConversationEntry | undefined> {
		const state = await this.readState();
		return state.conversations[conversationId];
	}

	async set(
		conversationId: string,
		sessionFile?: string,
		options?: {
			skillFingerprint?: string;
			title?: string;
			preview?: string;
			messageCount?: number;
		},
	): Promise<ConversationEntry> {
		const state = await this.readState();
		const now = new Date().toISOString();
		const existing = state.conversations[conversationId];
		const entry: ConversationEntry = {
			sessionFile: sessionFile ?? existing?.sessionFile,
			updatedAt: now,
			createdAt: existing?.createdAt ?? now,
			skillFingerprint: options?.skillFingerprint ?? existing?.skillFingerprint,
			title: options?.title ?? existing?.title,
			preview: options?.preview ?? existing?.preview,
			messageCount: options?.messageCount ?? existing?.messageCount ?? 0,
		};

		state.conversations[conversationId] = entry;
		await this.writeState(state);
		return entry;
	}

	async delete(conversationId: string): Promise<void> {
		const state = await this.readState();
		if (!(conversationId in state.conversations)) {
			return;
		}

		delete state.conversations[conversationId];
		if (state.currentConversationId === conversationId) {
			const fallback = this.sortEntries(state).at(0);
			state.currentConversationId = fallback?.conversationId;
		}
		await this.writeState(state);
	}

	async list(): Promise<ConversationListEntry[]> {
		const state = await this.readState();
		return this.sortEntries(state);
	}

	async getCurrentConversationId(): Promise<string | undefined> {
		const state = await this.readState();
		return state.currentConversationId;
	}

	async setCurrentConversationId(conversationId: string): Promise<void> {
		const state = await this.readState();
		const now = new Date().toISOString();
		if (!state.conversations[conversationId]) {
			state.conversations[conversationId] = {
				updatedAt: now,
				createdAt: now,
				messageCount: 0,
			};
		}
		state.currentConversationId = conversationId;
		await this.writeState(state);
	}

	private async readState(): Promise<ConversationStoreState> {
		try {
			const content = await readFile(this.indexPath, "utf8");
			if (!content.trim()) {
				return { conversations: {} };
			}

			const parsed = JSON.parse(content) as
				| ConversationStoreState
				| LegacyConversationIndex
				| null;
			if (!parsed || typeof parsed !== "object") {
				return { conversations: {} };
			}

			if ("conversations" in parsed && parsed.conversations && typeof parsed.conversations === "object") {
				return {
					currentConversationId:
						typeof parsed.currentConversationId === "string" && parsed.currentConversationId
							? parsed.currentConversationId
							: undefined,
					conversations: parsed.conversations as Record<string, ConversationEntry>,
				};
			}

			return {
				conversations: parsed as LegacyConversationIndex,
			};
		} catch (error) {
			if (this.isRecoverableReadError(error)) {
				return { conversations: {} };
			}
			throw error;
		}
	}

	private async writeState(state: ConversationStoreState): Promise<void> {
		await mkdir(dirname(this.indexPath), { recursive: true });
		await writeFile(
			this.indexPath,
			JSON.stringify(
				{
					currentConversationId: state.currentConversationId,
					conversations: state.conversations,
				},
				null,
				2,
			),
			"utf8",
		);
	}

	private sortEntries(state: ConversationStoreState): ConversationListEntry[] {
		return Object.entries(state.conversations)
			.map(([conversationId, entry]) => ({
				conversationId,
				...entry,
			}))
			.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
	}

	private isRecoverableReadError(error: unknown): boolean {
		if (!(error instanceof Error)) {
			return false;
		}

		return "code" in error
			? (error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError
			: error instanceof SyntaxError;
	}
}
