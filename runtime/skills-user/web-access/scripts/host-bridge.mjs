#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { getDefaultLocalBrowser } from './local-cdp-browser.mjs';

const DEFAULT_IPC_DIR = process.env.NANOCLAW_BROWSER_BRIDGE_DIR || '/workspace/ipc';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeJsonAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}

function trimMetaValue(value, maxLength = 200) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return undefined;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') {
    return undefined;
  }

  const sanitized = {
    stage: trimMetaValue(meta.stage, 32),
    url: trimMetaValue(meta.url, 240),
    taskKind: trimMetaValue(meta.taskKind, 80),
    query: trimMetaValue(meta.query, 200),
    operation: trimMetaValue(meta.operation, 80),
    note: trimMetaValue(meta.note, 160),
    agentScope: trimMetaValue(meta.agentScope, 120),
  };

  return Object.values(sanitized).some((value) => typeof value === 'string')
    ? sanitized
    : undefined;
}

export async function requestHostBrowser(command, options = {}) {
  const canUseLocalFallback =
    options.localBrowser !== null && options.disableLocalFallback !== true;
  const timeoutMs =
    options.ipcTimeoutMs ||
    options.timeoutMs ||
    (canUseLocalFallback ? 1000 : 30000);
  const ipcDir = options.ipcDir || DEFAULT_IPC_DIR;
  const requestsDir = path.join(ipcDir, 'browser-requests');
  const responsesDir = path.join(ipcDir, 'browser-responses');
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const requestPath = path.join(requestsDir, `${requestId}.json`);
  const responsePath = path.join(responsesDir, `${requestId}.json`);

  writeJsonAtomic(requestPath, {
    requestId,
    command,
    meta: sanitizeMeta(options.meta),
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (fs.existsSync(responsePath)) {
      const payload = JSON.parse(fs.readFileSync(responsePath, 'utf-8'));
      fs.rmSync(responsePath, { force: true });
      return payload;
    }
    await sleep(150);
  }

  if (canUseLocalFallback) {
    const localBrowser = options.localBrowser || getDefaultLocalBrowser();
    return await localBrowser.handleCommand(command, {
      meta: sanitizeMeta(options.meta),
    });
  }

  throw new Error(`host_browser_timeout:${command.action}`);
}

export async function ensureHostBrowserBridge(options = {}) {
  const result = await requestHostBrowser({ action: 'status' }, {
    ...options,
    timeoutMs: options.timeoutMs,
    ipcTimeoutMs: options.ipcTimeoutMs || options.timeoutMs || 1000,
  });

  if (!result.ok) {
    throw new Error(result.error || 'host_browser_status_failed');
  }

  if (!result.status?.enabled) {
    throw new Error('bridge_disabled');
  }

  if (!result.status?.connected) {
    throw new Error(result.status?.error || 'chrome_cdp_unreachable');
  }

  return result.status;
}
