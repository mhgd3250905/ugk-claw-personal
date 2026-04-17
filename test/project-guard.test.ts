import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import {
	buildProjectBashSpawnOptions,
	buildProjectShellEnv,
	isUnsupportedWindowsBashShim,
} from "../.pi/extensions/project-guard.js";

test("buildProjectBashSpawnOptions hides the console window on Windows without detaching", () => {
	const options = buildProjectBashSpawnOptions("E:/AII/ugk-pi", { PATH: "C:\\Windows\\System32" }, "win32");

	assert.equal(options.cwd, "E:/AII/ugk-pi");
	assert.equal(options.detached, false);
	assert.equal(options.windowsHide, true);
	assert.deepEqual(options.stdio, ["ignore", "pipe", "pipe"]);
});

test("buildProjectShellEnv prepends the managed agent bin directory once", () => {
	const agentBin = join(getAgentDir(), "bin");
	const basePath = "C:\\Windows\\System32";

	const env = buildProjectShellEnv({ PATH: basePath });
	const envAgain = buildProjectShellEnv(env);

	assert.equal(env.PATH, `${agentBin};${basePath}`);
	assert.equal(envAgain.PATH, `${agentBin};${basePath}`);
});

test("isUnsupportedWindowsBashShim rejects WSL compatibility shims", () => {
	assert.equal(isUnsupportedWindowsBashShim("C:\\Windows\\System32\\bash.exe"), true);
	assert.equal(isUnsupportedWindowsBashShim("C:\\Users\\demo\\AppData\\Local\\Microsoft\\WindowsApps\\bash.exe"), true);
	assert.equal(isUnsupportedWindowsBashShim("C:\\Program Files\\Git\\bin\\bash.exe"), false);
});
