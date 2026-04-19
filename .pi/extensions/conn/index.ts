import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { ConnStore, type ConnDefinition } from "../../../src/agent/conn-store.js";
import { getAppConfig } from "../../../src/config.js";

function findProjectRoot(startPath: string): string {
	let current = resolve(startPath);

	while (true) {
		if (existsSync(join(current, ".pi"))) {
			return current;
		}

		const parent = dirname(current);
		if (parent === current) {
			return resolve(startPath);
		}
		current = parent;
	}
}

function createConnStore(projectRoot: string): ConnStore {
	const config = getAppConfig(projectRoot);
	return new ConnStore({
		indexPath: config.connIndexPath,
	});
}

function summarizeConn(conn: ConnDefinition): string {
	return [
		`connId: ${conn.connId}`,
		`title: ${conn.title}`,
		`status: ${conn.status}`,
		`target: ${JSON.stringify(conn.target)}`,
		`schedule: ${JSON.stringify(conn.schedule)}`,
		`assetRefs: ${conn.assetRefs.join(", ") || "(none)"}`,
		`nextRunAt: ${conn.nextRunAt ?? "(none)"}`,
		`lastRunAt: ${conn.lastRunAt ?? "(none)"}`,
		`lastResult: ${conn.lastResult?.summary ?? "(none)"}`,
	].join("\n");
}

const ConnTargetSchema = Type.Union([
	Type.Object({
		type: Type.Literal("conversation"),
		conversationId: Type.String(),
	}),
	Type.Object({
		type: Type.Literal("feishu_chat"),
		chatId: Type.String(),
	}),
	Type.Object({
		type: Type.Literal("feishu_user"),
		openId: Type.String(),
	}),
]);

const ConnScheduleSchema = Type.Union([
	Type.Object({
		kind: Type.Literal("once"),
		at: Type.String(),
	}),
	Type.Object({
		kind: Type.Literal("interval"),
		everyMs: Type.Number(),
		startAt: Type.Optional(Type.String()),
	}),
	Type.Object({
		kind: Type.Literal("cron"),
		expression: Type.String(),
	}),
]);

const ConnToolParams = Type.Object({
	action: Type.Union([
		Type.Literal("create"),
		Type.Literal("list"),
		Type.Literal("get"),
		Type.Literal("update"),
		Type.Literal("pause"),
		Type.Literal("resume"),
		Type.Literal("delete"),
		Type.Literal("run_now"),
	]),
	connId: Type.Optional(Type.String()),
	title: Type.Optional(Type.String()),
	prompt: Type.Optional(Type.String()),
	target: Type.Optional(ConnTargetSchema),
	schedule: Type.Optional(ConnScheduleSchema),
	assetRefs: Type.Optional(Type.Array(Type.String())),
});

export default function connExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "conn",
		label: "Conn",
		description: "Create, inspect, update, pause, resume, delete, or trigger scheduled conn tasks.",
		parameters: ConnToolParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const projectRoot = findProjectRoot(ctx.cwd);
			const store = createConnStore(projectRoot);

			if (params.action === "list") {
				const conns = await store.list();
				return {
					content: [{ type: "text", text: conns.length > 0 ? conns.map(summarizeConn).join("\n\n---\n\n") : "No conn tasks found." }],
					details: {
						action: "list",
						conns,
					},
				};
			}

			if (params.action === "create") {
				if (!params.title || !params.prompt || !params.target || !params.schedule) {
					return {
						content: [{ type: "text", text: "create requires title, prompt, target, and schedule." }],
						isError: true,
					};
				}

				const conn = await store.create({
					title: params.title,
					prompt: params.prompt,
					target: params.target,
					schedule: params.schedule,
					assetRefs: params.assetRefs,
				});
				return {
					content: [{ type: "text", text: summarizeConn(conn) }],
					details: {
						action: "create",
						conn,
					},
				};
			}

			if (!params.connId) {
				return {
					content: [{ type: "text", text: "connId is required for this action." }],
					isError: true,
				};
			}

			if (params.action === "get") {
				const conn = await store.get(params.connId);
				if (!conn) {
					return {
						content: [{ type: "text", text: `Conn not found: ${params.connId}` }],
						isError: true,
					};
				}

				return {
					content: [{ type: "text", text: summarizeConn(conn) }],
					details: {
						action: "get",
						conn,
					},
				};
			}

			if (params.action === "update") {
				const conn = await store.update(params.connId, {
					...(params.title !== undefined ? { title: params.title } : {}),
					...(params.prompt !== undefined ? { prompt: params.prompt } : {}),
					...(params.target !== undefined ? { target: params.target } : {}),
					...(params.schedule !== undefined ? { schedule: params.schedule } : {}),
					...(params.assetRefs !== undefined ? { assetRefs: params.assetRefs } : {}),
				});
				if (!conn) {
					return {
						content: [{ type: "text", text: `Conn not found: ${params.connId}` }],
						isError: true,
					};
				}

				return {
					content: [{ type: "text", text: summarizeConn(conn) }],
					details: {
						action: "update",
						conn,
					},
				};
			}

			if (params.action === "pause") {
				const conn = await store.pause(params.connId);
				if (!conn) {
					return {
						content: [{ type: "text", text: `Conn not found: ${params.connId}` }],
						isError: true,
					};
				}
				return {
					content: [{ type: "text", text: summarizeConn(conn) }],
					details: { action: "pause", conn },
				};
			}

			if (params.action === "resume") {
				const conn = await store.resume(params.connId);
				if (!conn) {
					return {
						content: [{ type: "text", text: `Conn not found: ${params.connId}` }],
						isError: true,
					};
				}
				return {
					content: [{ type: "text", text: summarizeConn(conn) }],
					details: { action: "resume", conn },
				};
			}

			if (params.action === "delete") {
				const deleted = await store.delete(params.connId);
				return {
					content: [{ type: "text", text: deleted ? `Deleted ${params.connId}` : `Conn not found: ${params.connId}` }],
					details: { action: "delete", connId: params.connId, deleted },
					isError: !deleted,
				};
			}

			const conn = await store.triggerNow(params.connId);
			if (!conn) {
				return {
					content: [{ type: "text", text: `Conn not found: ${params.connId}` }],
					isError: true,
				};
			}

			return {
				content: [{ type: "text", text: `Triggered ${params.connId} for immediate execution.` }],
				details: {
					action: "run_now",
					conn,
				},
			};
		},
	});
}
