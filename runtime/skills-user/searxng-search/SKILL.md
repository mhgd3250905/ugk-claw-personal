---
name: searxng-search
description: 仅在用户显式输入 `/searx:关键词` 或 `/searxng:关键词` 时使用。不要从普通自然语言搜索、查资料、最新信息请求中猜测触发。该技能只负责调用已配置的内部 SearXNG 实例返回结构化搜索结果。
allowed-tools: Bash
---

# searxng-search

这个技能只允许显式触发。只有当用户消息直接以下列格式开头时使用：

- `/searx:关键词`
- `/searxng:关键词`

如果关键词为空，停止并返回正确用法，不要猜。

## 职责边界

本技能负责：

1. 调用内部 SearXNG 实例做聚合搜索。
2. 返回结构化的标题、摘要、来源引擎和原始 URL。
3. 在搜索服务不可用、JSON API 未启用、搜索源限流或超时时，明确报告失败原因。

本技能不负责：

- 普通自然语言问题的自动搜索。
- 登录态网站、截图、下载、表单填写、发布内容。
- 替代 `web-access` 打开具体网页。
- 编造搜索结果或把搜索摘要当成事实终点。

如果用户需要打开某个结果页、登录态内容、截图或网站操作，再结合 `web-access`。

## 显式触发规则

允许：

```text
/searx:国产大模型 2026
/searxng:SearXNG JSON API format json
```

不允许自动触发：

```text
帮我查一下今天有什么 AI 新闻
搜索一下 SearXNG 怎么部署
看看知乎上有没有相关讨论
```

这些普通请求不应使用本技能，除非用户明确写了 `/searx:` 或 `/searxng:`。

## 执行方式

统一调用脚本：

```bash
node /app/runtime/skills-user/searxng-search/scripts/searxng_search.mjs search \
  --query "<keyword>" \
  --limit 10
```

如果在 Windows 项目目录调试，使用：

```bash
node runtime/skills-user/searxng-search/scripts/searxng_search.mjs search \
  --query "<keyword>" \
  --limit 10
```

脚本读取：

- `SEARXNG_BASE_URL`
- `SEARXNG_INTERNAL_BASE_URL`

如果都未设置，默认尝试 `http://ugk-pi-searxng:8080`。

## 可选参数

```bash
--category general
--language zh-CN
--time-range day
--limit 10
```

说明：

- `--category` 会映射到 SearXNG `categories` 参数。
- `--language` 会映射到 SearXNG `language` 参数。
- `--time-range` 可选 `day`、`month`、`year`。
- `--limit` 默认 10，最大 20。

## 输出要求

最终回答必须保留：

- 查询关键词
- SearXNG 实例地址（只写 host，不泄露密钥；通常没有密钥）
- 每条结果的标题、摘要、来源引擎、原始 URL
- 搜索失败或结果为空时的具体原因

如果结果只是搜索摘要，不要把它包装成已经验证的事实。需要精确引用、登录态内容或网页全文时，应继续打开原始 URL。

## 错误处理

常见错误：

- `HTTP 403`：通常是 SearXNG 未启用 `format: json`，或实例限制 JSON API。
- `fetch failed` / timeout：SearXNG 容器不可达或搜索源响应过慢。
- 空结果：明确说明未检索到，不要编造。
- 搜索源 block / CAPTCHA：说明这是 SearXNG 上游搜索源限制，不要无限重试。

## 错误做法

- 从普通“帮我搜索 / 查一下 / 最新”自动触发本技能。
- 把本技能接入 `web-access` 默认 staged router。
- 一次请求打开大量 engine 或无限翻页。
- 搜索失败后反复重试轰炸服务器出口。
- 使用公网 SearXNG 实例处理用户敏感查询。
- 把搜索摘要当作事实证据而不打开来源链接核验。
