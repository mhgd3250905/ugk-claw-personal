import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
	ensureHostBrowserBridge,
	requestHostBrowser,
	resolveDefaultIpcDir,
	resolveIpcTimeoutMs,
} from "../runtime/skills-user/web-access/scripts/host-bridge.mjs";

test("resolveDefaultIpcDir uses a project-shared path in host and container contexts", () => {
	assert.equal(
		resolveDefaultIpcDir({
			env: {},
			cwd: "E:\\AII\\ugk-pi",
			existsSync: (filePath: string) => filePath === "/app",
		}),
		"/app/.data/browser-ipc",
	);

	assert.equal(
		resolveDefaultIpcDir({
			env: {},
			cwd: "E:\\AII\\ugk-pi",
			existsSync: () => false,
		}),
		join("E:\\AII\\ugk-pi", ".data", "browser-ipc"),
	);

	assert.equal(
		resolveDefaultIpcDir({
			env: { NANOCLAW_BROWSER_BRIDGE_DIR: "D:\\ipc" },
			cwd: "E:\\AII\\ugk-pi",
			existsSync: () => true,
		}),
		"D:\\ipc",
	);
});

test("resolveIpcTimeoutMs waits longer when a host bridge ready file exists", async () => {
	const ipcDir = await mkdtemp(join(tmpdir(), "ugk-pi-browser-ipc-"));

	try {
		assert.equal(resolveIpcTimeoutMs({}, ipcDir), 1000);

		await writeFile(join(ipcDir, "host-bridge-ready.json"), "{}", "utf8");
		assert.equal(resolveIpcTimeoutMs({}, ipcDir), 30000);
		assert.equal(resolveIpcTimeoutMs({ timeoutMs: 5000 }, ipcDir), 5000);
		assert.equal(resolveIpcTimeoutMs({ ipcTimeoutMs: 7000 }, ipcDir), 7000);
	} finally {
		await rm(ipcDir, { recursive: true, force: true });
	}
});

async function answerNextBrowserRequest(
	ipcDir: string,
	payload: Record<string, unknown>,
): Promise<void> {
	const requestsDir = join(ipcDir, "browser-requests");
	const responsesDir = join(ipcDir, "browser-responses");
	await mkdir(responsesDir, { recursive: true });

	for (let attempt = 0; attempt < 20; attempt += 1) {
		const entries = await readdir(requestsDir).catch(() => []);
		const requestFile = entries.find((entry) => entry.endsWith(".json"));
		if (requestFile) {
			const request = JSON.parse(await readFile(join(requestsDir, requestFile), "utf8")) as { requestId: string };
			await writeFile(join(responsesDir, `${request.requestId}.json`), JSON.stringify(payload), "utf8");
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 10));
	}

	throw new Error("browser request was not written");
}

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

test("requestHostBrowser can prefer direct local CDP without touching IPC", async () => {
	const ipcDir = await mkdtemp(join(tmpdir(), "ugk-pi-browser-ipc-"));
	let localCommandCalls = 0;

	try {
		const result = await requestHostBrowser(
			{ action: "status" },
			{
				ipcDir,
				env: {
					WEB_ACCESS_BROWSER_PROVIDER: "direct_cdp",
				},
				localBrowser: {
					async handleCommand(command: { action: string }) {
						assert.equal(command.action, "status");
						localCommandCalls += 1;
						return {
							ok: true,
							status: {
								enabled: true,
								connected: true,
								endpoint: "http://ugk-pi-browser:9222",
							},
						};
					},
				},
			},
		);

		assert.equal(existsSync(join(ipcDir, "browser-requests")), false);
		assert.equal(localCommandCalls, 1);
		assert.equal(result.ok, true);
		assert.equal(result.status.endpoint, "http://ugk-pi-browser:9222");
	} finally {
		await rm(ipcDir, { recursive: true, force: true });
	}
});

test("requestHostBrowser falls back when the IPC directory cannot be written", async () => {
	const ipcFile = join(await mkdtemp(join(tmpdir(), "ugk-pi-browser-ipc-")), "ipc-file");
	await writeFile(ipcFile, "not a directory", "utf8");

	try {
		const result = await requestHostBrowser(
			{ action: "status" },
			{
				ipcDir: ipcFile,
				timeoutMs: 20,
				localBrowser: {
					async handleCommand(command: { action: string }) {
						assert.equal(command.action, "status");
						return {
							ok: true,
							status: {
								enabled: true,
								connected: true,
								endpoint: "local-cdp://write-fallback",
							},
						};
					},
				},
			},
		);

		assert.equal(result.ok, true);
		assert.equal(result.status.endpoint, "local-cdp://write-fallback");
	} finally {
		await rm(ipcFile, { force: true });
		await rm(join(ipcFile, ".."), { recursive: true, force: true });
	}
});

test("requestHostBrowser still throws IPC write errors when local fallback is disabled", async () => {
	const ipcFile = join(await mkdtemp(join(tmpdir(), "ugk-pi-browser-ipc-")), "ipc-file");
	await writeFile(ipcFile, "not a directory", "utf8");

	try {
		await assert.rejects(
			() =>
				requestHostBrowser(
					{ action: "status" },
					{
						ipcDir: ipcFile,
						disableLocalFallback: true,
					},
				),
			/error|ENOENT|ENOTDIR|EPERM|EACCES/i,
		);
	} finally {
		await rm(ipcFile, { force: true });
		await rm(join(ipcFile, ".."), { recursive: true, force: true });
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

test("ensureHostBrowserBridge honors direct CDP mode before legacy IPC", async () => {
	const ipcDir = await mkdtemp(join(tmpdir(), "ugk-pi-browser-ipc-"));
	let localStatusCalls = 0;

	try {
		const status = await ensureHostBrowserBridge({
			ipcDir,
			env: {
				WEB_ACCESS_BROWSER_PROVIDER: "sidecar",
			},
			localBrowser: {
				async handleCommand(command: { action: string }) {
					assert.equal(command.action, "status");
					localStatusCalls += 1;
					return {
						ok: true,
						status: {
							enabled: true,
							connected: true,
							endpoint: "http://172.31.250.10:9223",
						},
					};
				},
			},
		});

		assert.equal(existsSync(join(ipcDir, "browser-requests")), false);
		assert.equal(localStatusCalls, 1);
		assert.equal(status.endpoint, "http://172.31.250.10:9223");
	} finally {
		await rm(ipcDir, { recursive: true, force: true });
	}
});

test("ensureHostBrowserBridge starts local fallback when IPC reports Chrome is disconnected", async () => {
	const ipcDir = await mkdtemp(join(tmpdir(), "ugk-pi-browser-ipc-"));
	let localStatusCalls = 0;

	try {
		const pendingAnswer = answerNextBrowserRequest(ipcDir, {
			ok: true,
			status: {
				enabled: true,
				connected: false,
				error: "chrome_cdp_unreachable",
			},
		});

		const status = await ensureHostBrowserBridge({
			ipcDir,
			timeoutMs: 200,
			localBrowser: {
				async handleCommand(command: { action: string }) {
					assert.equal(command.action, "status");
					localStatusCalls += 1;
					return {
						ok: true,
						status: {
							enabled: true,
							connected: true,
							endpoint: "local-cdp://started",
						},
					};
				},
			},
		});

		await pendingAnswer;
		assert.equal(localStatusCalls, 1);
		assert.equal(status.endpoint, "local-cdp://started");
	} finally {
		await rm(ipcDir, { recursive: true, force: true });
	}
});

test("requestHostBrowser retries through local fallback when IPC command reports Chrome is unreachable", async () => {
	const ipcDir = await mkdtemp(join(tmpdir(), "ugk-pi-browser-ipc-"));
	let localCommandCalls = 0;

	try {
		const pendingAnswer = answerNextBrowserRequest(ipcDir, {
			ok: false,
			error: "chrome_cdp_unreachable",
		});

		const result = await requestHostBrowser(
			{ action: "new_target", url: "https://example.com" },
			{
				ipcDir,
				timeoutMs: 200,
				localBrowser: {
					async handleCommand(command: { action: string; url?: string }) {
						assert.equal(command.action, "new_target");
						assert.equal(command.url, "https://example.com");
						localCommandCalls += 1;
						return {
							ok: true,
							target: {
								id: "target-from-local-cdp",
								url: command.url,
							},
						};
					},
				},
			},
		);

		await pendingAnswer;
		assert.equal(localCommandCalls, 1);
		assert.equal(result.target.id, "target-from-local-cdp");
	} finally {
		await rm(ipcDir, { recursive: true, force: true });
	}
});
