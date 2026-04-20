import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface ConversationEntry {
	sessionFile: string;
	updatedAt: string;
	skillFingerprint?: string;
}

type ConversationIndex = Record<string, ConversationEntry>;

export class ConversationStore {
	constructor(private readonly indexPath: string) {}

	async get(conversationId: string): Promise<ConversationEntry | undefined> {
		const index = await this.readIndex();
		return index[conversationId];
	}

	async set(
		conversationId: string,
		sessionFile: string,
		options?: {
			skillFingerprint?: string;
		},
	): Promise<ConversationEntry> {
		const index = await this.readIndex();
		const entry: ConversationEntry = {
			sessionFile,
			updatedAt: new Date().toISOString(),
			skillFingerprint: options?.skillFingerprint,
		};

		index[conversationId] = entry;
		await this.writeIndex(index);
		return entry;
	}

	async delete(conversationId: string): Promise<void> {
		const index = await this.readIndex();
		if (!(conversationId in index)) {
			return;
		}

		delete index[conversationId];
		await this.writeIndex(index);
	}

	private async readIndex(): Promise<ConversationIndex> {
		try {
			const content = await readFile(this.indexPath, "utf8");
			if (!content.trim()) {
				return {};
			}

			const parsed = JSON.parse(content) as ConversationIndex;
			return typeof parsed === "object" && parsed !== null ? parsed : {};
		} catch (error) {
			if (this.isRecoverableReadError(error)) {
				return {};
			}
			throw error;
		}
	}

	private async writeIndex(index: ConversationIndex): Promise<void> {
		await mkdir(dirname(this.indexPath), { recursive: true });
		await writeFile(this.indexPath, JSON.stringify(index, null, 2), "utf8");
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
