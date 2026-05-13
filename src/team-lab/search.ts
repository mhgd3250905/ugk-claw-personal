const DEFAULT_BASE_URL = "http://ugk-pi-searxng:8080";
const TIMEOUT_MS = 10000;

interface SearXNGResult {
  title?: string;
  url?: string;
  content?: string;
  snippet?: string;
  engines?: string[];
  engine?: string;
}

interface SearXNGResponse {
  results?: SearXNGResult[];
}

function resolveBaseUrl(): string {
  const raw = process.env.SEARXNG_BASE_URL || process.env.SEARXNG_INTERNAL_BASE_URL || DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

export async function searchSearXNG(query: string): Promise<SearXNGResponse> {
  const baseUrl = resolveBaseUrl();
  const url = new URL("/search", baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("categories", "general");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!resp.ok) {
      const hint = resp.status === 403
        ? "SearXNG 403: check settings.yml allows json format"
        : `SearXNG HTTP ${resp.status}`;
      throw new Error(`${hint}`);
    }
    return (await resp.json()) as SearXNGResponse;
  } finally {
    clearTimeout(timeout);
  }
}

export function formatSearchContext(query: string, results: SearXNGResult[]): string {
  const lines = [`Query: "${query}"`, "Results:"];
  const visible = results.filter((r) => r.url).slice(0, 10);
  if (visible.length === 0) {
    lines.push("(no results)");
    return lines.join("\n");
  }
  visible.forEach((r, i) => {
    const snippet = r.content || r.snippet || "";
    const truncated = snippet.length > 200 ? snippet.slice(0, 200) + "..." : snippet;
    lines.push(`${i + 1}. ${r.url} - ${r.title || "(untitled)"}${truncated ? ` — ${truncated}` : ""}`);
  });
  return lines.join("\n");
}

export async function searchAndFormat(queries: string[]): Promise<string> {
  const parts: string[] = [];
  for (const query of queries) {
    try {
      const resp = await searchSearXNG(query);
      const results = resp.results || [];
      console.log(`[team-lab] search "${query}" returned ${results.length} results`);
      parts.push(formatSearchContext(query, results));
    } catch (err) {
      const msg = (err as Error).message;
      console.log(`[team-lab] search "${query}" failed: ${msg}`);
      parts.push(`Query: "${query}"\nResults: (search failed: ${msg})`);
    }
  }
  return parts.join("\n\n");
}
