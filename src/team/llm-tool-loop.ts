import type { LLMConfig } from "./llm.js";
import { mapSubmitToolToStream, type TeamSubmitToolSpec } from "./team-submit-tools.js";
import type { TeamRoleBox } from "./role-box.js";
import type { TeamRole, TeamStreamName } from "./types.js";

export interface TeamSubmitToolCall {
	roleId: TeamRole["roleId"];
	toolName: TeamSubmitToolSpec["name"];
	streamName: TeamStreamName;
	arguments: unknown;
	callId: string;
}

export interface TeamSubmitToolResult {
	ok: boolean;
	message: string;
	streamName?: TeamStreamName;
}

export async function callLLMWithTeamSubmitTools(input: {
	config: LLMConfig;
	roleBox: TeamRoleBox;
	submitToolHandler: (call: TeamSubmitToolCall) => Promise<TeamSubmitToolResult>;
	maxToolRounds?: number;
}): Promise<{
	finalText: string;
	submitCallCount: number;
	rawMessages: unknown[];
}> {
	if (input.config.api === "anthropic-messages") {
		return callAnthropicToolLoop(input);
	}
	return callOpenAiToolLoop(input);
}

async function callAnthropicToolLoop(input: {
	config: LLMConfig;
	roleBox: TeamRoleBox;
	submitToolHandler: (call: TeamSubmitToolCall) => Promise<TeamSubmitToolResult>;
	maxToolRounds?: number;
}): Promise<{ finalText: string; submitCallCount: number; rawMessages: unknown[] }> {
	const maxToolRounds = normalizeMaxToolRounds(input.maxToolRounds);
	const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
		{ role: "user", content: input.roleBox.prompt },
	];
	const rawMessages: unknown[] = [];
	let submitCallCount = 0;

	for (let round = 0; round <= maxToolRounds; round++) {
		const body = {
			model: input.config.model,
			max_tokens: 4000,
			messages,
			tools: input.roleBox.submitTools.map(toAnthropicToolSpec),
		};
		const data = await postJson<AnthropicResponse>(`${input.config.baseUrl}/v1/messages`, {
			"Content-Type": "application/json",
			"x-api-key": input.config.apiKey,
			"anthropic-version": "2023-06-01",
		}, body);
		rawMessages.push(data);
		const content = Array.isArray(data.content) ? data.content : [];
		const toolUses = content.filter(isAnthropicToolUse);
		if (toolUses.length === 0) {
			return {
				finalText: content.filter(isAnthropicText).map((block) => block.text).join("\n"),
				submitCallCount,
				rawMessages,
			};
		}
		if (round >= maxToolRounds) {
			throw new Error(`Team submit tool loop exceeded maxToolRounds (${maxToolRounds})`);
		}

		messages.push({ role: "assistant", content });
		const toolResults = [];
		for (const toolUse of toolUses) {
			const result = await handleSubmitToolCall({
				roleId: input.roleBox.roleId,
				toolName: toolUse.name,
				callId: toolUse.id,
				arguments: toolUse.input,
				submitToolHandler: input.submitToolHandler,
			});
			submitCallCount++;
			toolResults.push({
				type: "tool_result",
				tool_use_id: toolUse.id,
				content: result.message,
				is_error: !result.ok,
			});
		}
		messages.push({ role: "user", content: toolResults });
	}

	throw new Error("Team submit tool loop ended without final text");
}

async function callOpenAiToolLoop(input: {
	config: LLMConfig;
	roleBox: TeamRoleBox;
	submitToolHandler: (call: TeamSubmitToolCall) => Promise<TeamSubmitToolResult>;
	maxToolRounds?: number;
}): Promise<{ finalText: string; submitCallCount: number; rawMessages: unknown[] }> {
	const maxToolRounds = normalizeMaxToolRounds(input.maxToolRounds);
	const messages: Array<Record<string, unknown>> = [
		{ role: "user", content: input.roleBox.prompt },
	];
	const rawMessages: unknown[] = [];
	let submitCallCount = 0;

	for (let round = 0; round <= maxToolRounds; round++) {
		const body = {
			model: input.config.model,
			messages,
			temperature: 0.3,
			max_tokens: 4000,
			tools: input.roleBox.submitTools.map(toOpenAiToolSpec),
		};
		const data = await postJson<OpenAiResponse>(`${input.config.baseUrl}/chat/completions`, {
			"Content-Type": "application/json",
			Authorization: `Bearer ${input.config.apiKey}`,
		}, body);
		rawMessages.push(data);
		const message = data.choices?.[0]?.message ?? {};
		const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
		if (toolCalls.length === 0) {
			return {
				finalText: typeof message.content === "string" ? message.content : "",
				submitCallCount,
				rawMessages,
			};
		}
		if (round >= maxToolRounds) {
			throw new Error(`Team submit tool loop exceeded maxToolRounds (${maxToolRounds})`);
		}

		messages.push(message as Record<string, unknown>);
		for (const toolCall of toolCalls) {
			const parsedArgs = parseToolArguments(toolCall.function?.arguments);
			const result = await handleSubmitToolCall({
				roleId: input.roleBox.roleId,
				toolName: toolCall.function?.name,
				callId: toolCall.id,
				arguments: parsedArgs,
				submitToolHandler: input.submitToolHandler,
			});
			submitCallCount++;
			messages.push({
				role: "tool",
				tool_call_id: toolCall.id,
				content: result.message,
			});
		}
	}

	throw new Error("Team submit tool loop ended without final text");
}

async function handleSubmitToolCall(input: {
	roleId: TeamRole["roleId"];
	toolName: unknown;
	callId: string;
	arguments: unknown;
	submitToolHandler: (call: TeamSubmitToolCall) => Promise<TeamSubmitToolResult>;
}): Promise<TeamSubmitToolResult> {
	if (!isSubmitToolName(input.toolName)) {
		return { ok: false, message: `unknown submit tool: ${String(input.toolName)}` };
	}
	const mapped = mapSubmitToolToStream({
		roleId: input.roleId,
		toolName: input.toolName,
		arguments: input.arguments,
	});
	if (!mapped.ok) {
		return { ok: false, message: mapped.errors.join("; ") };
	}
	return input.submitToolHandler({
		roleId: input.roleId,
		toolName: input.toolName,
		streamName: mapped.streamName,
		arguments: mapped.payload,
		callId: input.callId,
	});
}

async function postJson<T>(url: string, headers: Record<string, string>, body: unknown): Promise<T> {
	const response = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify(body),
	});
	if (!response.ok) {
		throw new Error(`API ${response.status}: ${(await response.text()).slice(0, 200)}`);
	}
	return response.json() as Promise<T>;
}

function toAnthropicToolSpec(tool: TeamSubmitToolSpec): Record<string, unknown> {
	return {
		name: tool.name,
		description: tool.description,
		input_schema: {
			type: "object",
			additionalProperties: true,
			properties: {},
		},
	};
}

function toOpenAiToolSpec(tool: TeamSubmitToolSpec): Record<string, unknown> {
	return {
		type: "function",
		function: {
			name: tool.name,
			description: tool.description,
			parameters: {
				type: "object",
				additionalProperties: true,
				properties: {},
			},
		},
	};
}

function normalizeMaxToolRounds(value: number | undefined): number {
	return Number.isFinite(value) && value !== undefined && value >= 0 ? Math.trunc(value) : 12;
}

function parseToolArguments(value: unknown): unknown {
	if (typeof value !== "string") return {};
	try {
		return JSON.parse(value);
	} catch {
		return {};
	}
}

function isSubmitToolName(value: unknown): value is TeamSubmitToolSpec["name"] {
	return value === "submitCandidateDomain" ||
		value === "submitDomainEvidence" ||
		value === "submitClassification" ||
		value === "submitReviewFinding";
}

interface AnthropicTextBlock {
	type: "text";
	text: string;
}

interface AnthropicToolUseBlock {
	type: "tool_use";
	id: string;
	name: string;
	input: unknown;
}

interface AnthropicResponse {
	content?: unknown[];
}

interface OpenAiResponse {
	choices?: Array<{
		message?: {
			content?: string | null;
			tool_calls?: Array<{
				id: string;
				type: string;
				function?: {
					name?: string;
					arguments?: string;
				};
			}>;
		};
	}>;
}

function isAnthropicText(value: unknown): value is AnthropicTextBlock {
	return typeof value === "object" &&
		value !== null &&
		(value as { type?: unknown }).type === "text" &&
		typeof (value as { text?: unknown }).text === "string";
}

function isAnthropicToolUse(value: unknown): value is AnthropicToolUseBlock {
	return typeof value === "object" &&
		value !== null &&
		(value as { type?: unknown }).type === "tool_use" &&
		typeof (value as { id?: unknown }).id === "string" &&
		typeof (value as { name?: unknown }).name === "string";
}
