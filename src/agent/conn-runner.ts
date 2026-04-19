import type { AgentService } from "./agent-service.js";
import type { ConnDefinition, ConnRunResult } from "./conn-store.js";

export interface ConnDeliveryLike {
	deliverText(target: ConnDefinition["target"], text: string, options?: { files?: Array<{ fileName: string; downloadUrl: string }> }): Promise<void>;
}

export class ConnRunner {
	constructor(
		private readonly options: {
			agentService: AgentService;
			delivery?: ConnDeliveryLike;
		},
	) {}

	async run(conn: ConnDefinition): Promise<ConnRunResult> {
		const finishedAt = new Date().toISOString();

		try {
			const conversationId = this.resolveConversationId(conn);
			const result = await this.options.agentService.chat({
				conversationId,
				message: conn.prompt,
				assetRefs: conn.assetRefs,
			});

			if (conn.target.type !== "conversation") {
				if (!this.options.delivery) {
					throw new Error(`No delivery channel available for ${conn.target.type}`);
				}

				const fileLines =
					result.files?.map((file) => ({
						fileName: file.fileName,
						downloadUrl: file.downloadUrl,
					})) ?? [];
				await this.options.delivery.deliverText(conn.target, result.text, {
					files: fileLines,
				});
			}

			return {
				ok: true,
				summary: result.text.slice(0, 200) || "Conn run completed",
				text: result.text,
				finishedAt,
			};
		} catch (error) {
			const messageText = error instanceof Error ? error.message : "Unknown conn run error";
			return {
				ok: false,
				summary: messageText,
				error: messageText,
				finishedAt,
			};
		}
	}

	private resolveConversationId(conn: ConnDefinition): string {
		if (conn.target.type === "conversation") {
			return conn.target.conversationId;
		}
		if (conn.target.type === "feishu_chat") {
			return `feishu:chat:${conn.target.chatId}`;
		}
		return `feishu:user:${conn.target.openId}`;
	}
}
