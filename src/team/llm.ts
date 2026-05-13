import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function loadLLMConfig(): LLMConfig {
  const envKey = process.env.DEEPSEEK_API_KEY;
  if (envKey) return { apiKey: envKey, baseUrl: "https://api.deepseek.com", model: "deepseek-chat" };

  for (const filename of ["deepseek.txt", "deepseek-api.txt"]) {
    const p = join(process.cwd(), filename);
    if (!existsSync(p)) continue;
    const content = readFileSync(p, "utf-8").trim();
    let apiKey: string | undefined;
    let baseUrl = "https://api.deepseek.com";
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const kvMatch = trimmed.match(/^(\S+)\s*[=:]\s*(.+)$/);
      if (kvMatch) {
        const [, key, val] = kvMatch;
        if (/api.key/i.test(key)) apiKey = val.trim();
        if (/base.url/i.test(key)) baseUrl = val.trim();
      }
    }
    if (apiKey) return { apiKey, baseUrl, model: "deepseek-chat" };
  }

  throw new Error("DEEPSEEK_API_KEY not found. Set env var or create deepseek.txt");
}

export async function callLLM(config: LLMConfig, prompt: string): Promise<string> {
  const isAnthropic = config.baseUrl.includes("/anthropic");
  if (isAnthropic) {
    const url = `${config.baseUrl}/v1/messages`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: config.model, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok) throw new Error(`API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    const data = (await resp.json()) as { content: Array<{ type: string; text?: string }> };
    return data.content.filter((b) => b.type === "text" && b.text).map((b) => b.text!).join("\n");
  }
  const url = `${config.baseUrl}/chat/completions`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: prompt }], temperature: 0.3, max_tokens: 4000 }),
  });
  if (!resp.ok) throw new Error(`API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = (await resp.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? "";
}
