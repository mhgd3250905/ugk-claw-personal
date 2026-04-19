import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type ConversationMap = Record<string, string>;

export class FeishuConversationMapStore {
	constructor(private readonly options: { indexPath: string }) {}

	async get(key: string): Promise<string | undefined> {
		const index = await this.readIndex();
		return index[key];
	}

	async getOrCreate(key: string, builder: () => string): Promise<string> {
		const index = await this.readIndex();
		if (index[key]) {
			return index[key];
		}

		const conversationId = builder();
		index[key] = conversationId;
		await this.writeIndex(index);
		return conversationId;
	}

	private async readIndex(): Promise<ConversationMap> {
		try {
			const content = await readFile(this.options.indexPath, "utf8");
			if (!content.trim()) {
				return {};
			}
			const parsed = JSON.parse(content) as ConversationMap;
			return typeof parsed === "object" && parsed !== null ? parsed : {};
		} catch (error) {
			if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
				return {};
			}
			if (error instanceof SyntaxError) {
				return {};
			}
			throw error;
		}
	}

	private async writeIndex(index: ConversationMap): Promise<void> {
		await mkdir(dirname(this.options.indexPath), { recursive: true });
		await writeFile(this.options.indexPath, JSON.stringify(index, null, 2), "utf8");
	}
}
