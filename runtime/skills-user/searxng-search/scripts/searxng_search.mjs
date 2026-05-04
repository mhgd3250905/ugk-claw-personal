#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://ugk-pi-searxng:8080";
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const TIMEOUT_MS = 8000;
const USER_AGENT = "UgkClawSearXNGSearch/1.0";

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };

  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!key?.startsWith("--")) continue;
    const name = key.slice(2);
    if (name === "dry-run") {
      args.dryRun = true;
      continue;
    }
    args[name] = rest[index + 1];
    index += 1;
  }

  return args;
}

function printUsage() {
  console.error([
    "Usage:",
    "  searxng_search.mjs search --query <keyword> [--category general] [--language zh-CN] [--time-range day|month|year] [--limit 10]",
    "  searxng_search.mjs health",
  ].join("\n"));
}

function resolveBaseUrl(env = process.env) {
  const raw = env.SEARXNG_BASE_URL || env.SEARXNG_INTERNAL_BASE_URL || DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

function parsePositiveInt(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("limit must be a positive integer");
  }
  return Math.min(parsed, MAX_LIMIT);
}

function buildSearchUrl(args, env = process.env) {
  const query = String(args.query || "").trim();
  if (!query) {
    throw new Error("query is required");
  }

  const url = new URL("/search", resolveBaseUrl(env));
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("categories", args.category || args.categories || "general");
  if (args.language) {
    url.searchParams.set("language", args.language);
  }
  if (args["time-range"]) {
    const timeRange = args["time-range"];
    if (!["day", "month", "year"].includes(timeRange)) {
      throw new Error("time-range must be one of: day, month, year");
    }
    url.searchParams.set("time_range", timeRange);
  }
  return url;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        "accept": "application/json",
        "user-agent": USER_AGENT,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      const hint = response.status === 403
        ? "SearXNG returned 403. Check settings.yml search.formats includes json and the instance allows API access."
        : `SearXNG returned HTTP ${response.status}.`;
      throw new Error(`${hint} Body: ${text.slice(0, 300)}`);
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`SearXNG response is not valid JSON: ${error.message}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeResult(result) {
  const engines = Array.isArray(result.engines)
    ? result.engines.join(", ")
    : result.engine || result.source || "";
  return {
    title: result.title || "(untitled)",
    url: result.url || "",
    snippet: result.content || result.snippet || "",
    engines,
    category: result.category || "",
    publishedDate: result.publishedDate || result.published_date || "",
  };
}

function formatHostOnly(baseUrl) {
  try {
    const parsed = new URL(baseUrl);
    return parsed.host;
  } catch {
    return baseUrl;
  }
}

function printSearchResults(args, baseUrl, searchUrl, payload, limit) {
  const results = Array.isArray(payload.results) ? payload.results.map(normalizeResult) : [];
  const visible = results.slice(0, limit);

  const lines = [
    "SearXNG 搜索结果",
    `查询：${String(args.query || "").trim()}`,
    `实例：${formatHostOnly(baseUrl)}`,
    `分类：${args.category || args.categories || "general"}`,
    `请求 URL：${searchUrl.toString()}`,
    "",
  ];

  if (visible.length === 0) {
    lines.push("结果概览：未检索到匹配结果。");
    console.log(lines.join("\n"));
    return;
  }

  lines.push(`显示前 ${visible.length} 条结果`);
  lines.push("");

  visible.forEach((result, index) => {
    lines.push(`${index + 1}. ${result.title}`);
    if (result.snippet) lines.push(`   摘要：${result.snippet}`);
    if (result.engines) lines.push(`   来源引擎：${result.engines}`);
    if (result.category) lines.push(`   分类：${result.category}`);
    if (result.publishedDate) lines.push(`   发布时间：${result.publishedDate}`);
    lines.push(`   URL：${result.url || "（无）"}`);
    lines.push("");
  });

  console.log(lines.join("\n"));
}

async function runSearch(args) {
  const limit = parsePositiveInt(args.limit, DEFAULT_LIMIT);
  const baseUrl = resolveBaseUrl();
  const searchUrl = buildSearchUrl(args);

  if (args.dryRun) {
    console.log(JSON.stringify({
      command: "search",
      baseUrl,
      url: searchUrl.toString(),
      limit,
    }, null, 2));
    return 0;
  }

  try {
    const payload = await fetchJson(searchUrl);
    printSearchResults(args, baseUrl, searchUrl, payload, limit);
    return 0;
  } catch (error) {
    console.error(`SearXNG 搜索失败：${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

async function runHealth(args) {
  const baseUrl = resolveBaseUrl();
  const url = new URL("/", baseUrl);
  if (args.dryRun) {
    console.log(JSON.stringify({ command: "health", baseUrl, url: url.toString() }, null, 2));
    return 0;
  }
  try {
    await fetchJson(new URL("/search?q=health&format=json&categories=general", baseUrl));
    console.log(`SearXNG 可用：${formatHostOnly(baseUrl)}`);
    return 0;
  } catch (error) {
    console.error(`SearXNG 健康检查失败：${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    if (args.command === "search") {
      return await runSearch(args);
    }
    if (args.command === "health") {
      return await runHealth(args);
    }
    printUsage();
    return 1;
  } catch (error) {
    console.error(`参数错误：${error instanceof Error ? error.message : String(error)}`);
    printUsage();
    return 1;
  }
}

process.exitCode = await main();
