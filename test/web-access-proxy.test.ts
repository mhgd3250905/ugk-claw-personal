import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createProxyServer } from "../runtime/skills-user/web-access/scripts/cdp-proxy.mjs";

function restoreEnvValue(key: string, value: string | undefined): void {
	if (value === undefined) {
		delete process.env[key];
		return;
	}
	process.env[key] = value;
}

test("cdp proxy exposes /type as text input for the selected target", async () => {
	const calls: Array<{ command: Record<string, unknown>; meta?: Record<string, unknown> }> = [];
	const server = createProxyServer({
		requestHostBrowser: async (command: Record<string, unknown>, options: { meta?: Record<string, unknown> }) => {
			calls.push({ command, meta: options.meta });
			return { ok: true, textLength: String(command.text ?? "").length };
		},
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;

	try {
		const response = await fetch(
			`http://127.0.0.1:${port}/type?target=target-1&metaAgentScope=scope-1`,
			{
				method: "POST",
				headers: { "content-type": "text/plain; charset=utf-8" },
				body: "你好 Draft",
			},
		);

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { ok: true, textLength: 8 });
		assert.equal(calls.length, 1);
		assert.deepEqual(calls[0]?.command, {
			action: "type",
			targetId: "target-1",
			text: "你好 Draft",
		});
		assert.equal(calls[0]?.meta?.operation, "type");
		assert.equal(calls[0]?.meta?.agentScope, "scope-1");
	} finally {
		server.close();
		await once(server, "close");
	}
});

test("cdp proxy exposes /key for keyboard input on the selected target", async () => {
	const calls: Array<{ command: Record<string, unknown>; meta?: Record<string, unknown> }> = [];
	const server = createProxyServer({
		requestHostBrowser: async (command: Record<string, unknown>, options: { meta?: Record<string, unknown> }) => {
			calls.push({ command, meta: options.meta });
			return { ok: true, key: command.key };
		},
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;

	try {
		const response = await fetch(
			`http://127.0.0.1:${port}/key?target=target-1&key=Enter&metaAgentScope=scope-1`,
			{ method: "POST" },
		);

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { ok: true, key: "Enter" });
		assert.deepEqual(calls[0]?.command, {
			action: "press_key",
			targetId: "target-1",
			key: "Enter",
		});
		assert.equal(calls[0]?.meta?.operation, "key");
		assert.equal(calls[0]?.meta?.agentScope, "scope-1");
	} finally {
		server.close();
		await once(server, "close");
	}
});

test("cdp proxy exposes /enter as an Enter key shortcut", async () => {
	const calls: Array<{ command: Record<string, unknown>; meta?: Record<string, unknown> }> = [];
	const server = createProxyServer({
		requestHostBrowser: async (command: Record<string, unknown>, options: { meta?: Record<string, unknown> }) => {
			calls.push({ command, meta: options.meta });
			return { ok: true, key: command.key };
		},
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;

	try {
		const response = await fetch(
			`http://127.0.0.1:${port}/enter?target=target-1&metaAgentScope=scope-1`,
			{ method: "POST" },
		);

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { ok: true, key: "Enter" });
		assert.deepEqual(calls[0]?.command, {
			action: "press_key",
			targetId: "target-1",
			key: "Enter",
		});
		assert.equal(calls[0]?.meta?.operation, "enter");
		assert.equal(calls[0]?.meta?.agentScope, "scope-1");
	} finally {
		server.close();
		await once(server, "close");
	}
});

test("cdp proxy exposes /session/navigate for scoped single-tab navigation", async () => {
	const calls: Array<{ command: Record<string, unknown>; meta?: Record<string, unknown> }> = [];
	const server = createProxyServer({
		requestHostBrowser: async (command: Record<string, unknown>, options: { meta?: Record<string, unknown> }) => {
			calls.push({ command, meta: options.meta });
			return { ok: true, page: { id: "target-1", url: command.url } };
		},
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;

	try {
		const response = await fetch(
			`http://127.0.0.1:${port}/session/navigate?url=https%3A%2F%2Fexample.com%2Fnext&metaAgentScope=scope-1`,
			{ method: "POST" },
		);

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { ok: true, page: { id: "target-1", url: "https://example.com/next" } });
		assert.deepEqual(calls[0]?.command, {
			action: "navigate_session",
			url: "https://example.com/next",
		});
		assert.equal(calls[0]?.meta?.operation, "navigate_session");
		assert.equal(calls[0]?.meta?.agentScope, "scope-1");
	} finally {
		server.close();
		await once(server, "close");
	}
});

test("cdp proxy ignores request-supplied browserId metadata", async () => {
	const calls: Array<{ command: Record<string, unknown>; meta?: Record<string, unknown> }> = [];
	const server = createProxyServer({
		requestHostBrowser: async (command: Record<string, unknown>, options: { meta?: Record<string, unknown> }) => {
			calls.push({ command, meta: options.meta });
			return { ok: true, target: { id: "target-1", url: command.url } };
		},
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;

	try {
		const response = await fetch(
			`http://127.0.0.1:${port}/new?url=https%3A%2F%2Fexample.com&metaAgentScope=scope-1&metaBrowserId=chrome-01`,
		);

		assert.equal(response.status, 200);
		assert.equal(calls[0]?.meta?.agentScope, "scope-1");
		assert.equal(calls[0]?.meta?.browserId, undefined);
	} finally {
		server.close();
		await once(server, "close");
	}
});

test("cdp proxy rejects unscoped browser-changing requests in agent-run mode", async () => {
	const originalRequireScoped = process.env.UGK_REQUIRE_SCOPED_BROWSER_PROXY;
	process.env.UGK_REQUIRE_SCOPED_BROWSER_PROXY = "true";
	const calls: Array<{ command: Record<string, unknown>; meta?: Record<string, unknown> }> = [];
	const server = createProxyServer({
		requestHostBrowser: async (command: Record<string, unknown>, options: { meta?: Record<string, unknown> }) => {
			calls.push({ command, meta: options.meta });
			return { ok: true };
		},
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;

	try {
		const rejected = await fetch(`http://127.0.0.1:${port}/new?url=https%3A%2F%2Fexample.com`);
		assert.equal(rejected.status, 400);
		assert.deepEqual(await rejected.json(), {
			ok: false,
			error: "missing_agent_scope",
			message: "Browser proxy requests from agent runs must include metaAgentScope.",
		});
		assert.equal(calls.length, 0);

		const accepted = await fetch(
			`http://127.0.0.1:${port}/new?url=https%3A%2F%2Fexample.com&metaAgentScope=scope-1`,
		);
		assert.equal(accepted.status, 200);
		assert.equal(calls.length, 1);
		assert.equal(calls[0]?.meta?.agentScope, "scope-1");
	} finally {
		server.close();
		await once(server, "close");
		restoreEnvValue("UGK_REQUIRE_SCOPED_BROWSER_PROXY", originalRequireScoped);
	}
});
