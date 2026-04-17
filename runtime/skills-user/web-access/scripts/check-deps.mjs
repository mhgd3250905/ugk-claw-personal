#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ensureHostBrowserBridge } from './host-bridge.mjs';

const PROXY_PORT = Number(process.env.CDP_PROXY_PORT || 3456);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROXY_SCRIPT = path.join(SCRIPT_DIR, 'cdp-proxy.mjs');

async function isProxyReady() {
  try {
    const response = await fetch(`http://127.0.0.1:${PROXY_PORT}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function startProxyDetached() {
  const child = spawn(process.execPath, [PROXY_SCRIPT], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

async function main() {
  const status = await ensureHostBrowserBridge();
  console.log(`host-browser: ok (${status.endpoint})`);

  if (await isProxyReady()) {
    console.log(`proxy: ready (127.0.0.1:${PROXY_PORT})`);
    return;
  }

  console.log('proxy: starting');
  startProxyDetached();

  for (let index = 0; index < 20; index += 1) {
    if (await isProxyReady()) {
      console.log(`proxy: ready (127.0.0.1:${PROXY_PORT})`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('proxy_start_timeout');
}

await main();
