import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

type ConversationMap = Record<string, string>;

export class FeishuConversationMapStore {
	private writeQueue: Promise<void> = Promise.resolve();

	constructor(private readonly options: { indexPath: string }) {}

	async get(key: string): Promise<string | undefined> {
		const index = await this.readIndex();
		return index[key];
	}

	async getOrCreate(key: string, builder: () => string): Promise<string> {
		return await this.mutateIndex((index) => {
			if (index[key]) {
				return index[key];
			}

			const conversationId = builder();
			index[key] = conversationId;
			return conversationId;
		});
	}

	private async readIndex(): Promise<ConversationMap> {
		await this.writeQueue;
		return await this.readIndexFromDisk();
	}

	private async readIndexFromDisk(): Promise<ConversationMap> {
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
		const dir = dirname(this.options.indexPath);
		const tempPath = join(dir, `.${basename(this.options.indexPath)}.${process.pid}.${process.hrtime.bigint()}.tmp`);
		await mkdir(dir, { recursive: true });
		try {
			await writeFile(tempPath, JSON.stringify(index, null, 2), "utf8");
			await rename(tempPath, this.options.indexPath);
		} catch (error) {
			await unlink(tempPath).catch(() => undefined);
			throw error;
		}
	}

	private async mutateIndex<T>(mutator: (index: ConversationMap) => T | Promise<T>): Promise<T> {
		let result: T;
		const operation = this.writeQueue
			.catch(() => undefined)
			.then(async () => {
				const index = await this.readIndexFromDisk();
				result = await mutator(index);
				await this.writeIndex(index);
			});

		this.writeQueue = operation.then(
			() => undefined,
			() => undefined,
		);
		await operation;
		return result!;
	}
}
