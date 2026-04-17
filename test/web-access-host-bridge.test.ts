import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
	ensureHostBrowserBridge,
	requestHostBrowser,
} from "../runtime/skills-user/web-access/scripts/host-bridge.mjs";

test("requestHostBrowser falls back to a local browser backend when IPC has no responder", async () => {
	const ipcDir = await mkdtemp(join(tmpdir(), "ugk-pi-browser-ipc-"));

	try {
		const result = await requestHostBrowser(
			{ action: "status" },
			{
				ipcDir,
				timeoutMs: 20,
				localBrowser: {
					async handleCommand(command: { action: string }) {
						assert.equal(command.action, "status");
						return {
							ok: true,
							status: {
								enabled: true,
								connected: true,
								endpoint: "local-cdp://test",
							},
						};
					},
				},
			},
		);

		assert.equal(result.ok, true);
		assert.equal(result.status.endpoint, "local-cdp://test");
	} finally {
		await rm(ipcDir, { recursive: true, force: true });
	}
});

test("ensureHostBrowserBridge accepts status from the local browser fallback", async () => {
	const ipcDir = await mkdtemp(join(tmpdir(), "ugk-pi-browser-ipc-"));

	try {
		const status = await ensureHostBrowserBridge({
			ipcDir,
			timeoutMs: 20,
			localBrowser: {
				async handleCommand() {
					return {
						ok: true,
						status: {
							enabled: true,
							connected: true,
							endpoint: "local-cdp://test",
						},
					};
				},
			},
		});

		assert.equal(status.endpoint, "local-cdp://test");
	} finally {
		await rm(ipcDir, { recursive: true, force: true });
	}
});
