import assert from "node:assert/strict";
import test from "node:test";

import {
	closeBrowserTargetsForScope,
	resolveBrowserCleanupAgentScope,
} from "../src/agent/browser-cleanup.js";

test("resolveBrowserCleanupAgentScope follows the web-access scope environment precedence", () => {
	assert.equal(
		resolveBrowserCleanupAgentScope({
			CLAUDE_AGENT_ID: " primary ",
			CLAUDE_HOOK_AGENT_ID: "hook",
			agent_id: "fallback",
		}),
		"primary",
	);
	assert.equal(
		resolveBrowserCleanupAgentScope({
			CLAUDE_AGENT_ID: " ",
			CLAUDE_HOOK_AGENT_ID: " hook ",
			agent_id: "fallback",
		}),
		"hook",
	);
	assert.equal(
		resolveBrowserCleanupAgentScope({
			CLAUDE_AGENT_ID: "",
			CLAUDE_HOOK_AGENT_ID: "",
			agent_id: " fallback ",
		}),
		"fallback",
	);
	assert.equal(resolveBrowserCleanupAgentScope({}), undefined);
});

test("closeBrowserTargetsForScope skips cleanup when no scope can be resolved", async () => {
	let called = false;

	await closeBrowserTargetsForScope(undefined, {
		env: {},
		fetchImpl: (async () => {
			called = true;
			return new Response(JSON.stringify({ ok: true }));
		}) as typeof fetch,
		warn: () => undefined,
	});

	assert.equal(called, false);
});

test("closeBrowserTargetsForScope posts the encoded scope to the CDP proxy", async () => {
	const calls: Array<{ url: string; init?: RequestInit }> = [];

	await closeBrowserTargetsForScope(undefined, {
		env: { CLAUDE_AGENT_ID: " agent one " },
		proxyBaseUrl: "http://127.0.0.1:4567/",
		fetchImpl: (async (url, init) => {
			calls.push({ url: String(url), init });
			return new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}) as typeof fetch,
		timeoutMs: 250,
		warn: () => undefined,
	});

	assert.equal(calls.length, 1);
	assert.equal(
		calls[0]?.url,
		"http://127.0.0.1:4567/session/close-all?metaAgentScope=agent+one",
	);
	assert.equal(calls[0]?.init?.method, "POST");
	assert.ok(calls[0]?.init?.signal);
});

test("closeBrowserTargetsForScope keeps cleanup best-effort when the proxy fails", async () => {
	await assert.doesNotReject(
		closeBrowserTargetsForScope("scope-failure", {
			fetchImpl: (async () => {
				throw new Error("proxy offline");
			}) as typeof fetch,
			timeoutMs: 250,
			warn: () => undefined,
		}),
	);
});

test("closeBrowserTargetsForScope keeps cleanup best-effort when proxy configuration is invalid", async () => {
	await assert.doesNotReject(
		closeBrowserTargetsForScope("scope-invalid-proxy", {
			proxyBaseUrl: "not a url",
			warn: () => undefined,
		}),
	);
});
