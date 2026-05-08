import { chmod, mkdir, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";

export interface BrowserBoundBashEnvironmentInput {
	workspaceRoot: string;
	browserId?: string;
	browserScope?: string;
	binDir?: string;
	env?: NodeJS.ProcessEnv;
}

export async function prepareBrowserBoundBashEnvironment(
	input: BrowserBoundBashEnvironmentInput,
): Promise<Record<string, string>> {
	const env: Record<string, string> = {};
	if (input.browserScope) {
		env.CLAUDE_AGENT_ID = input.browserScope;
		env.CLAUDE_HOOK_AGENT_ID = input.browserScope;
		env.agent_id = input.browserScope;
	}
	if (input.browserId) {
		env.WEB_ACCESS_BROWSER_ID = input.browserId;
	}
	if (!input.browserId && !input.browserScope) {
		return env;
	}

	const binDir = input.binDir ?? join(input.workspaceRoot, ".data", "browser-bin");
	await mkdir(binDir, { recursive: true });
	const curlWrapperPath = join(binDir, process.platform === "win32" ? "curl.cmd" : "curl");
	const curlWrapperScript = buildCurlBrowserBindingWrapper();
	if (process.platform === "win32") {
		await writeFile(join(binDir, "curl-browser-binding.mjs"), curlWrapperScript, "utf8");
		await writeFile(curlWrapperPath, "@echo off\r\nnode \"%~dp0curl-browser-binding.mjs\" %*\r\n", "utf8");
	} else {
		await writeFile(curlWrapperPath, curlWrapperScript, "utf8");
		await chmod(curlWrapperPath, 0o755);
	}

	const currentPath = input.env?.PATH ?? input.env?.Path ?? process.env.PATH ?? "";
	env.PATH = currentPath ? `${binDir}${delimiter}${currentPath}` : binDir;
	return env;
}

function buildCurlBrowserBindingWrapper(): string {
	return `#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const realCurl = process.platform === 'win32' ? 'curl.exe' : existsSync('/usr/bin/curl') ? '/usr/bin/curl' : '/usr/local/bin/curl';
const scope = process.env.CLAUDE_AGENT_ID || process.env.CLAUDE_HOOK_AGENT_ID || process.env.agent_id || '';
const browserId = process.env.WEB_ACCESS_BROWSER_ID || '';

function appendMeta(raw) {
  if (!/^https?:\\/\\/(127\\.0\\.0\\.1|localhost):3456(\\/|$)/.test(raw)) {
    return raw;
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return raw;
  }
  if (scope && !parsed.searchParams.has('metaAgentScope')) {
    parsed.searchParams.set('metaAgentScope', scope);
  }
  if (browserId && !parsed.searchParams.has('metaBrowserId')) {
    parsed.searchParams.set('metaBrowserId', browserId);
  }
  return parsed.toString();
}

const result = spawnSync(realCurl, process.argv.slice(2).map(appendMeta), { stdio: 'inherit' });
if (typeof result.status === 'number') {
  process.exit(result.status);
}
if (result.signal) {
  process.kill(process.pid, result.signal);
}
process.exit(1);
`;
}
