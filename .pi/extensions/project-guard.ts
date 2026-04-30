import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import {
	createBashTool,
	getAgentDir,
	SettingsManager,
	type BashOperations,
	type ExtensionAPI,
} from "@mariozechner/pi-coding-agent";

const EXIT_STDIO_GRACE_MS = 100;

type ShellConfig = {
	shell: string;
	args: string[];
};

function normalizePath(value: unknown): string {
	return String(value ?? "").replace(/\\/g, "/").toLowerCase();
}

export function isUnsupportedWindowsBashShim(shellPath: string): boolean {
	const normalized = normalizePath(shellPath);
	return normalized === "c:/windows/system32/bash.exe" || normalized.endsWith("/windowsapps/bash.exe");
}

function findWindowsBashOnPath(): string | null {
	try {
		const result = spawnSync("where", ["bash.exe"], {
			encoding: "utf-8",
			timeout: 5000,
			windowsHide: true,
		});
		if (result.status === 0 && result.stdout) {
			const matches = result.stdout
				.trim()
				.split(/\r?\n/)
				.map((value) => value.trim())
				.filter((value) => value.length > 0 && existsSync(value));
			const supportedMatch = matches.find((value) => !isUnsupportedWindowsBashShim(value));
			if (supportedMatch) {
				return supportedMatch;
			}
		}
	} catch {
		// Ignore shell discovery errors and fall back to the normal search order.
	}

	return null;
}

export function resolveProjectShellConfig(platform: NodeJS.Platform = process.platform): ShellConfig {
	const settings = SettingsManager.create(process.cwd());
	const customShellPath = settings.getShellPath();

	if (customShellPath) {
		if (existsSync(customShellPath)) {
			return { shell: customShellPath, args: ["-c"] };
		}
		throw new Error(`Custom shell path not found: ${customShellPath}`);
	}

	if (platform === "win32") {
		const candidates = [
			process.env.ProgramFiles ? `${process.env.ProgramFiles}\\Git\\bin\\bash.exe` : undefined,
			process.env["ProgramFiles(x86)"] ? `${process.env["ProgramFiles(x86)"]}\\Git\\bin\\bash.exe` : undefined,
		].filter((value): value is string => Boolean(value));

		for (const candidate of candidates) {
			if (existsSync(candidate) && !isUnsupportedWindowsBashShim(candidate)) {
				return { shell: candidate, args: ["-c"] };
			}
		}

		const bashOnPath = findWindowsBashOnPath();
		if (bashOnPath) {
			return { shell: bashOnPath, args: ["-c"] };
		}

		throw new Error(
			"No supported bash shell found on Windows. Install Git for Windows or set shellPath in .pi/settings.json. " +
				"WSL compatibility shims such as C:\\Windows\\System32\\bash.exe are not used by this project.",
		);
	}

	if (existsSync("/bin/bash")) {
		return { shell: "/bin/bash", args: ["-c"] };
	}

	return { shell: "bash", args: ["-c"] };
}

export function buildProjectShellEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
	const pathKey = Object.keys(baseEnv).find((key) => key.toLowerCase() === "path") ?? "PATH";
	const currentPath = baseEnv[pathKey] ?? "";
	const binDir = join(getAgentDir(), "bin");
	const entries = currentPath.split(delimiter).filter(Boolean);
	const pathValue = entries.includes(binDir) ? currentPath : [binDir, currentPath].filter(Boolean).join(delimiter);

	return {
		...baseEnv,
		[pathKey]: pathValue,
	};
}

export function buildProjectBashSpawnOptions(
	cwd: string,
	env: NodeJS.ProcessEnv,
	platform: NodeJS.Platform = process.platform,
): SpawnOptions {
	return {
		cwd,
		detached: platform === "win32" ? false : true,
		env,
		stdio: ["ignore", "pipe", "pipe"],
		...(platform === "win32" ? { windowsHide: true } : {}),
	};
}

function killProcessTree(pid: number, platform: NodeJS.Platform = process.platform): void {
	if (platform === "win32") {
		try {
			const killer = spawn("taskkill", ["/F", "/T", "/PID", String(pid)], {
				detached: true,
				stdio: "ignore",
				windowsHide: true,
			});
			killer.unref();
		} catch {
			// Ignore cleanup failures for already-terminated processes.
		}
		return;
	}

	try {
		process.kill(-pid, "SIGKILL");
	} catch {
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			// Ignore cleanup failures for already-terminated processes.
		}
	}
}

function waitForChildProcess(child: ChildProcess): Promise<number | null> {
	return new Promise((resolve, reject) => {
		let settled = false;
		let exited = false;
		let exitCode: number | null = null;
		let postExitTimer: NodeJS.Timeout | undefined;
		let stdoutEnded = child.stdout === null;
		let stderrEnded = child.stderr === null;

		const cleanup = () => {
			if (postExitTimer) {
				clearTimeout(postExitTimer);
				postExitTimer = undefined;
			}
			child.removeListener("error", onError);
			child.removeListener("exit", onExit);
			child.removeListener("close", onClose);
			child.stdout?.removeListener("end", onStdoutEnd);
			child.stderr?.removeListener("end", onStderrEnd);
		};

		const finalize = (code: number | null) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			child.stdout?.destroy();
			child.stderr?.destroy();
			resolve(code);
		};

		const maybeFinalizeAfterExit = () => {
			if (!exited || settled) {
				return;
			}
			if (stdoutEnded && stderrEnded) {
				finalize(exitCode);
			}
		};

		const onStdoutEnd = () => {
			stdoutEnded = true;
			maybeFinalizeAfterExit();
		};

		const onStderrEnd = () => {
			stderrEnded = true;
			maybeFinalizeAfterExit();
		};

		const onError = (error: Error) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			reject(error);
		};

		const onExit = (code: number | null) => {
			exited = true;
			exitCode = code;
			maybeFinalizeAfterExit();
			if (!settled) {
				postExitTimer = setTimeout(() => finalize(code), EXIT_STDIO_GRACE_MS);
			}
		};

		const onClose = (code: number | null) => {
			finalize(code);
		};

		child.stdout?.once("end", onStdoutEnd);
		child.stderr?.once("end", onStderrEnd);
		child.once("error", onError);
		child.once("exit", onExit);
		child.once("close", onClose);
	});
}

export function createProjectBashOperations(platform: NodeJS.Platform = process.platform): BashOperations {
	return {
		exec: (command, cwd, { onData, signal, timeout, env }) =>
			new Promise((resolve, reject) => {
				if (!existsSync(cwd)) {
					reject(new Error(`Working directory does not exist: ${cwd}\nCannot execute bash commands.`));
					return;
				}

				const shellConfig = resolveProjectShellConfig(platform);
				const shellEnv = env ?? buildProjectShellEnv();
				const child = spawn(
					shellConfig.shell,
					[...shellConfig.args, command],
					buildProjectBashSpawnOptions(cwd, shellEnv, platform),
				);

				let timedOut = false;
				let timeoutHandle: NodeJS.Timeout | undefined;

				if (timeout !== undefined && timeout > 0) {
					timeoutHandle = setTimeout(() => {
						timedOut = true;
						if (child.pid) {
							killProcessTree(child.pid, platform);
						}
					}, timeout * 1000);
				}

				child.stdout?.on("data", onData);
				child.stderr?.on("data", onData);

				const onAbort = () => {
					if (child.pid) {
						killProcessTree(child.pid, platform);
					}
				};

				if (signal) {
					if (signal.aborted) {
						onAbort();
					} else {
						signal.addEventListener("abort", onAbort, { once: true });
					}
				}

				waitForChildProcess(child)
					.then((exitCode) => {
						if (timeoutHandle) {
							clearTimeout(timeoutHandle);
						}
						if (signal) {
							signal.removeEventListener("abort", onAbort);
						}
						if (signal?.aborted) {
							reject(new Error("aborted"));
							return;
						}
						if (timedOut) {
							reject(new Error(`timeout:${timeout}`));
							return;
						}
						resolve({ exitCode });
					})
					.catch((error) => {
						if (timeoutHandle) {
							clearTimeout(timeoutHandle);
						}
						if (signal) {
							signal.removeEventListener("abort", onAbort);
						}
						reject(error);
					});
			}),
	};
}

export default function projectGuard(pi: ExtensionAPI) {
	const dangerousCommandPatterns = [
		/\bgit\s+reset\s+--hard\b/i,
		/\brm\s+(-rf?|--recursive)\b/i,
		/\bdel\b.+\s\/[sqf]/i,
		/\bformat\b/i,
	];

	const protectedPathMarkers = ["references/pi-mono/", ".git/", ".env", ".env."];

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName === "bash") {
			const command = String(event.input.command ?? "");
			const isDangerous = dangerousCommandPatterns.some((pattern) => pattern.test(command));

			if (isDangerous) {
				if (ctx.hasUI) {
					ctx.ui.notify(`Blocked dangerous bash command: ${command}`, "warning");
				}
				return { block: true, reason: "Dangerous bash command blocked by project-guard" };
			}
		}

		if (event.toolName === "write" || event.toolName === "edit") {
			const path = normalizePath(event.input.path);
			const hitsProtectedPath = protectedPathMarkers.some((marker) => path.includes(marker));

			if (hitsProtectedPath) {
				if (ctx.hasUI) {
					ctx.ui.notify(`Blocked protected path write: ${path}`, "warning");
				}
				return { block: true, reason: `Protected path blocked by project-guard: ${path}` };
			}
		}

		return undefined;
	});

	if (process.platform === "win32") {
		const bashTool = createBashTool(process.cwd(), {
			operations: createProjectBashOperations("win32"),
		});

		pi.registerTool({
			...bashTool,
		});
	}

	pi.registerCommand("project-rules", {
		description: "Show ugk-pi local project guard rules",
		handler: async (_args, ctx) => {
			const lines = [
				"ugk-pi project rules",
				"- references/pi-mono/ is read-only reference content",
				"- write/edit to .git and .env paths are blocked",
				"- dangerous bash commands such as rm -rf and git reset --hard are blocked",
				"- Windows bash tool runs with windowsHide enabled to avoid console flash",
			];

			if (ctx.hasUI) {
				ctx.ui.notify(lines.join("\n"), "info");
			}
		},
	});
}
