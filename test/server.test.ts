import test from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "../src/server.js";
import type { AgentService } from "../src/agent/agent-service.js";
import { renderPlaygroundMarkdown } from "../src/ui/playground.js";

type StreamEvent = Record<string, unknown>;

function createAgentServiceStub(overrides?: {
	chat?: AgentService["chat"];
	streamChat?: (
		input: { conversationId?: string; message: string; userId?: string },
		onEvent: (event: StreamEvent) => void,
	) => Promise<void>;
	queueMessage?: AgentService["queueMessage"];
	interruptChat?: AgentService["interruptChat"];
	getAvailableSkills?: () => Promise<Array<{ name: string; path?: string }>>;
}): AgentService {
	return {
		chat:
			overrides?.chat ??
			(async (input) => ({
				conversationId: input.conversationId ?? "manual:test-1",
				text: `echo:${input.message}`,
				sessionFile: "E:/sessions/test.jsonl",
			})),
		streamChat:
			overrides?.streamChat ??
			(async (input, onEvent) => {
				onEvent({
					type: "run_started",
					conversationId: input.conversationId ?? "manual:test-1",
				});
				onEvent({
					type: "tool_started",
					toolCallId: "tool-1",
					toolName: "read",
					args: '{"path":"README.md"}',
				});
				onEvent({
					type: "text_delta",
					textDelta: `echo:${input.message}`,
				});
				onEvent({
					type: "done",
					conversationId: input.conversationId ?? "manual:test-1",
					text: `echo:${input.message}`,
					sessionFile: "E:/sessions/test.jsonl",
				});
			}),
		queueMessage:
			overrides?.queueMessage ??
			(async (input) => ({
				conversationId: input.conversationId,
				mode: input.mode,
				queued: true,
			})),
		interruptChat:
			overrides?.interruptChat ??
			(async (input) => ({
				conversationId: input.conversationId,
				interrupted: true,
			})),
		getAvailableSkills:
			overrides?.getAvailableSkills ??
			(async () => [
				{ name: "using-superpowers", path: "E:/AII/ugk-pi/.pi/skills/superpowers/using-superpowers/SKILL.md" },
				{ name: "web-access", path: "E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md" },
			]),
	} as AgentService;
}

test("GET /healthz returns ok", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/healthz",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), { ok: true });
	await app.close();
});

test("GET /playground returns the test UI html", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/playground",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.headers["content-type"] ?? "", /^text\/html/);
	assert.match(response.body, /UGK PI Test Console/);
	assert.match(response.body, /font-family: "Agave"/);
	assert.match(response.body, /\/assets\/fonts\/Agave-Regular\.ttf/);
	assert.match(response.body, /conversation-id/);
	assert.match(response.body, /send-button/);
	assert.match(response.body, /interrupt-button/);
	assert.doesNotMatch(response.body, /queue-mode/);
	assert.doesNotMatch(response.body, /interrupt \/ steer/);
	assert.doesNotMatch(response.body, /wait \/ follow-up/);
	assert.match(response.body, /view-skills-button/);
	assert.match(response.body, /chat-stage/);
	assert.match(response.body, /process-feed/);
	assert.match(response.body, /\/v1\/debug\/skills/);
	assert.match(response.body, /\/v1\/chat\/stream/);
	assert.match(response.body, /\/v1\/chat\/queue/);
	assert.match(response.body, /\/v1\/chat\/interrupt/);
	assert.match(response.body, /mode:\s*"followUp"/);
	assert.match(response.body, /height: calc\(100vh - 40px\)/);
	assert.match(response.body, /\.chat-stage\s*\{[\s\S]*display: flex;/);
	assert.match(response.body, /\.chat-stage\s*\{[\s\S]*flex-direction: column;/);
	assert.match(response.body, /\.transcript\s*\{[\s\S]*flex: 1 1 auto;/);
	assert.match(response.body, /\.composer\s*\{[\s\S]*flex-shrink: 0;/);
	assert.match(response.body, /process-detail-toggle/);
	assert.match(response.body, /process-detail-body/);
	assert.match(response.body, /expand details/);
	assert.match(response.body, /overflow-y: auto/);
	assert.match(response.body, /message-content/);
	assert.match(response.body, /renderMessageMarkdown/);
	assert.match(response.body, /hydrateMarkdownContent/);
	assert.match(response.body, /copy-code-button/);
	assert.match(response.body, /code-block-toolbar/);
	assert.doesNotMatch(response.body, /__name/);
	await app.close();
});

test("GET /assets/fonts/Agave-Regular.ttf returns the bundled Agave font", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/assets/fonts/Agave-Regular.ttf",
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.headers["content-type"] ?? "", /font\/ttf|application\/octet-stream/);
	assert.ok(response.rawPayload.length > 1000);
	await app.close();
});

test("renderPlaygroundMarkdown renders safe markdown html for transcript messages", () => {
	const html = renderPlaygroundMarkdown(
		[
			"# Title",
			"",
			"- one",
			"- two",
			"",
			"**bold** and `code` and [link](https://example.com)",
			"",
			"> quote",
			"",
			"```ts",
			"const value = 1 < 2;",
			"```",
			"",
			"<script>alert(1)</script>",
		].join("\n"),
	);

	assert.match(html, /<h1>Title<\/h1>/);
	assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
	assert.match(html, /<strong>bold<\/strong>/);
	assert.match(html, /<code>code<\/code>/);
	assert.match(html, /<a href="https:\/\/example\.com" target="_blank" rel="noreferrer noopener">link<\/a>/);
	assert.match(html, /<blockquote><p>quote<\/p><\/blockquote>/);
	assert.match(html, /<pre><code class="language-ts">const value = 1 &lt; 2;<\/code><\/pre>/);
	assert.doesNotMatch(html, /<script>/);
	assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("POST /v1/chat returns aggregated chat response", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat",
		payload: {
			conversationId: "manual:test-2",
			message: "你好",
			userId: "u-001",
		},
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		conversationId: "manual:test-2",
		text: "echo:你好",
		sessionFile: "E:/sessions/test.jsonl",
	});
	await app.close();
});

test("GET /v1/debug/skills returns the runtime skill registry", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "GET",
		url: "/v1/debug/skills",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		skills: [
			{ name: "using-superpowers", path: "E:/AII/ugk-pi/.pi/skills/superpowers/using-superpowers/SKILL.md" },
			{ name: "web-access", path: "E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md" },
		],
	});
	await app.close();
});

test("POST /v1/chat/stream returns server-sent events for the agent run", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat/stream",
		payload: {
			conversationId: "manual:test-stream",
			message: "直播一下",
			userId: "u-002",
		},
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.headers["content-type"] ?? "", /^text\/event-stream/);
	assert.match(response.body, /"type":"run_started"/);
	assert.match(response.body, /"type":"tool_started"/);
	assert.match(response.body, /"type":"text_delta"/);
	assert.match(response.body, /"type":"done"/);
	await app.close();
});

test("POST /v1/chat/queue queues a steer message for an active run", async () => {
	const calls: unknown[] = [];
	const app = buildServer({
		agentService: createAgentServiceStub({
			queueMessage: async (input) => {
				calls.push(input);
				return {
					conversationId: input.conversationId,
					mode: input.mode,
					queued: true,
				};
			},
		}),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat/queue",
		payload: {
			conversationId: "manual:queue",
			message: "插嘴",
			mode: "steer",
			userId: "u-queue",
		},
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		conversationId: "manual:queue",
		mode: "steer",
		queued: true,
	});
	assert.deepEqual(calls, [
		{
			conversationId: "manual:queue",
			message: "插嘴",
			mode: "steer",
			userId: "u-queue",
		},
	]);
	await app.close();
});

test("POST /v1/chat/interrupt interrupts an active run", async () => {
	const calls: unknown[] = [];
	const app = buildServer({
		agentService: createAgentServiceStub({
			interruptChat: async (input) => {
				calls.push(input);
				return {
					conversationId: input.conversationId,
					interrupted: true,
				};
			},
		}),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat/interrupt",
		payload: {
			conversationId: "manual:interrupt",
		},
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		conversationId: "manual:interrupt",
		interrupted: true,
	});
	assert.deepEqual(calls, [{ conversationId: "manual:interrupt" }]);
	await app.close();
});

test("POST /v1/chat returns 400 when message is missing", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat",
		payload: {
			conversationId: "manual:test-3",
		},
	});

	assert.equal(response.statusCode, 400);
	assert.deepEqual(response.json(), {
		error: {
			code: "BAD_REQUEST",
			message: "Field \"message\" must be a non-empty string",
		},
	});
	await app.close();
});

test("POST /v1/chat/stream returns 400 when message is missing", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub(),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat/stream",
		payload: {
			conversationId: "manual:test-stream-400",
		},
	});

	assert.equal(response.statusCode, 400);
	assert.deepEqual(response.json(), {
		error: {
			code: "BAD_REQUEST",
			message: "Field \"message\" must be a non-empty string",
		},
	});
	await app.close();
});

test("POST /v1/chat returns 500 when agent service throws", async () => {
	const app = buildServer({
		agentService: createAgentServiceStub({
			chat: async () => {
				throw new Error("boom");
			},
		}),
	});

	const response = await app.inject({
		method: "POST",
		url: "/v1/chat",
		payload: {
			conversationId: "manual:test-4",
			message: "触发异常",
		},
	});

	assert.equal(response.statusCode, 500);
	assert.deepEqual(response.json(), {
		error: {
			code: "INTERNAL_ERROR",
			message: "boom",
		},
	});
	await app.close();
});
