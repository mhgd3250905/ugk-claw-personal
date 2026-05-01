import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createProxyServer } from "../runtime/skills-user/web-access/scripts/cdp-proxy.mjs";

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
