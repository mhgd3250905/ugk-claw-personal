import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export interface ChatAttachment {
	fileName: string;
	mimeType?: string;
	sizeBytes?: number;
	text?: string;
}

export interface AgentFileDraft {
	fileName: string;
	mimeType: string;
	content: string;
}

export interface AgentFileArtifact {
	id: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	downloadUrl: string;
}

export interface StoredAgentFileArtifact extends AgentFileArtifact {
	content: Buffer;
}

export interface FileArtifactStoreLike {
	saveFiles(conversationId: string, files: AgentFileDraft[]): Promise<AgentFileArtifact[]>;
	getFile?(fileId: string): Promise<StoredAgentFileArtifact | undefined>;
}

interface FileIndexEntry {
	id: string;
	conversationId: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	filePath: string;
	createdAt: string;
}

type FileIndex = Record<string, FileIndexEntry>;

export class FileArtifactStore implements FileArtifactStoreLike {
	constructor(
		private readonly options: {
			filesDir: string;
			indexPath: string;
		},
	) {}

	async saveFiles(conversationId: string, files: AgentFileDraft[]): Promise<AgentFileArtifact[]> {
		if (files.length === 0) {
			return [];
		}

		const index = await this.readIndex();
		const saved: AgentFileArtifact[] = [];
		await mkdir(this.options.filesDir, { recursive: true });
		await mkdir(dirname(this.options.indexPath), { recursive: true });

		for (const file of files) {
			const id = randomUUID();
			const fileName = sanitizeFileName(file.fileName);
			const mimeType = normalizeMimeType(file.mimeType);
			const content = Buffer.from(file.content, "utf8");
			const storedFileName = `${id}-${fileName}`;
			const filePath = resolve(this.options.filesDir, storedFileName);

			if (!isPathInside(filePath, this.options.filesDir)) {
				throw new Error("Refusing to store file outside the artifact directory");
			}

			await writeFile(filePath, content);
			index[id] = {
				id,
				conversationId,
				fileName,
				mimeType,
				sizeBytes: content.byteLength,
				filePath,
				createdAt: new Date().toISOString(),
			};
			saved.push(toPublicArtifact(index[id]));
		}

		await this.writeIndex(index);
		return saved;
	}

	async getFile(fileId: string): Promise<StoredAgentFileArtifact | undefined> {
		const index = await this.readIndex();
		const entry = index[fileId];
		if (!entry) {
			return undefined;
		}

		const filePath = resolve(entry.filePath);
		if (!isPathInside(filePath, this.options.filesDir)) {
			return undefined;
		}

		return {
			...toPublicArtifact(entry),
			content: await readFile(filePath),
		};
	}

	private async readIndex(): Promise<FileIndex> {
		try {
			const content = await readFile(this.options.indexPath, "utf8");
			if (!content.trim()) {
				return {};
			}
			const parsed = JSON.parse(content) as FileIndex;
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

	private async writeIndex(index: FileIndex): Promise<void> {
		await writeFile(this.options.indexPath, JSON.stringify(index, null, 2), "utf8");
	}
}

export function buildPromptWithFileContext(message: string, attachments: readonly ChatAttachment[] = []): string {
	const sections = [message.trim(), buildFileResponseInstruction()];
	const attachmentContext = buildAttachmentContext(attachments);
	if (attachmentContext) {
		sections.splice(1, 0, attachmentContext);
	}
	return sections.filter((section) => section.length > 0).join("\n\n");
}

export function extractAgentFileDrafts(text: string): { text: string; files: AgentFileDraft[] } {
	const files: AgentFileDraft[] = [];
	const withoutFiles = text.replace(
		/```ugk-file[^\n]*\n([\s\S]*?)```/gi,
		(match, content: string) => {
			const header = match.split("\n", 1)[0] ?? "";
			const attrs = parseFileAttributes(header);
			files.push({
				fileName: sanitizeFileName(attrs.name ?? "agent-file.txt"),
				mimeType: normalizeMimeType(attrs.mime ?? "text/plain"),
				content: String(content).replace(/\n$/, ""),
			});
			return "";
		},
	);

	return {
		text: normalizeVisibleText(withoutFiles),
		files,
	};
}

function buildAttachmentContext(attachments: readonly ChatAttachment[]): string {
	const validAttachments = attachments.filter((attachment) => attachment.fileName.trim().length > 0);
	if (validAttachments.length === 0) {
		return "";
	}

	const fileSections = validAttachments.map((attachment, index) => {
		const lines = [
			`<file index="${index + 1}">`,
			`fileName: ${sanitizeFileName(attachment.fileName)}`,
			`mimeType: ${attachment.mimeType?.trim() || "application/octet-stream"}`,
			`sizeBytes: ${Number.isFinite(attachment.sizeBytes) ? attachment.sizeBytes : "unknown"}`,
		];

		if (typeof attachment.text === "string" && attachment.text.length > 0) {
			lines.push("content:", "```text", limitAttachmentText(attachment.text), "```");
		} else {
			lines.push("content: (binary or empty file content was not included; use the metadata above)");
		}

		lines.push("</file>");
		return lines.join("\n");
	});

	return ["<user_files>", ...fileSections, "</user_files>"].join("\n");
}

function buildFileResponseInstruction(): string {
	return [
		"<file_response_protocol>",
		'If you need to send a file back to the user, include a fenced block exactly like: ```ugk-file name="example.txt" mime="text/plain"',
		"file contents",
		"```",
		"Only use this protocol for files the user should download.",
		"</file_response_protocol>",
	].join("\n");
}

function limitAttachmentText(text: string): string {
	const maxLength = 120_000;
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.slice(0, maxLength)}\n\n[Attachment truncated after ${maxLength} characters]`;
}

function parseFileAttributes(header: string): { name?: string; mime?: string } {
	const attrs: { name?: string; mime?: string } = {};
	for (const match of header.matchAll(/\b(name|mime)="([^"]+)"/gi)) {
		if (match[1]?.toLowerCase() === "name") {
			attrs.name = match[2];
		}
		if (match[1]?.toLowerCase() === "mime") {
			attrs.mime = match[2];
		}
	}
	return attrs;
}

function normalizeVisibleText(text: string): string {
	return text
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function toPublicArtifact(entry: FileIndexEntry): AgentFileArtifact {
	return {
		id: entry.id,
		fileName: entry.fileName,
		mimeType: entry.mimeType,
		sizeBytes: entry.sizeBytes,
		downloadUrl: `/v1/files/${encodeURIComponent(entry.id)}`,
	};
}

function normalizeMimeType(mimeType: string): string {
	const normalized = mimeType.trim().toLowerCase();
	return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(normalized) ? normalized : "application/octet-stream";
}

function sanitizeFileName(fileName: string): string {
	const safeBaseName = basename(fileName).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
	return safeBaseName || "agent-file.txt";
}

function isPathInside(filePath: string, parentDir: string): boolean {
	const normalizedFilePath = resolve(filePath);
	const normalizedParentDir = resolve(parentDir);
	return normalizedFilePath === normalizedParentDir || normalizedFilePath.startsWith(`${normalizedParentDir}\\`) || normalizedFilePath.startsWith(`${normalizedParentDir}/`);
}
