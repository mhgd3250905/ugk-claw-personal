---
name: site-search-skill-designer
description: Use only when the user explicitly asks to design, create, draft, review, or improve a dedicated search/query skill for a specific website or platform, such as "为 GitHub 做一个查询技能", "设计一个知乎搜索技能", "把这个网站访问流程沉淀成 skill", or "教 agent 怎么为某网站做专项检索技能". Do not use for ordinary web search, browsing, direct GitHub/Zhihu/Reddit/X queries, or questions about website content. This is a narrow meta-skill for designing site-specific search skills, not for performing searches.
---

# site-search-skill-designer

This is a meta-skill for designing narrow, site-specific search/query skills.

Use it only when the user explicitly wants to create, design, review, or improve a dedicated skill for querying a specific website or platform. Do not use this skill to perform the actual website query.

## Goal

Help design a dedicated skill for one target website, such as GitHub, Zhihu, Reddit, X, LinkedIn, 小红书, TikTok, or a company/internal site.

The output should be a practical skill design that can later become a `SKILL.md` plus optional scripts and tests.

## Process

### 1. Capture Intent

Identify:

- Target site or platform
- Main query tasks
- Whether the skill should auto-trigger from natural language or require explicit commands
- Expected output format
- Whether the target requires login, cookies, signatures, dynamic pages, or browser interaction

Ask one clarifying question if the target site or task boundary is unclear.

### 2. Classify Site Access Strategy

Choose the lowest reliable access layer:

1. Official API
2. Public JSON / RSS / sitemap
3. Raw/static files
4. Static HTML parsing
5. Jina/readability reader
6. Page-internal fetch with browser cookies
7. Full CDP/browser automation

Explain why the chosen first layer is appropriate.

Do not force static access when the task is clearly site-state or login dependent, such as Zhihu hot list, X latest search, LinkedIn content, or 小红书 signed APIs.

Do not force CDP when the site has stable public APIs, such as GitHub public repo metadata, releases, README, issues, or Reddit public JSON search.

### 3. Define Trigger Rules

Design narrow trigger rules.

Include:

- Should-trigger examples
- Should-not-trigger examples
- Whether explicit command syntax is required
- Whether natural language trigger is safe

Example guidance:

- GitHub lookup may safely trigger from natural language when the user asks about a repo, issue, release, README, or GitHub search.
- X, LinkedIn, Instagram, and TikTok latest-search skills may be safer as explicit commands because they can require login-heavy browser work.
- This meta-skill itself should only trigger when the user asks to design a skill, not when the user asks to query the target site.

### 4. Define Evidence Gate

Specify what counts as a valid result.

A result is valid only if it satisfies the user's target site and task.

Examples:

- GitHub repo lookup must use GitHub API/raw/github.com source and return repo URL.
- Zhihu hot list must return actual Zhihu hot list entries, not search engine snippets.
- Reddit latest search must include post URL, subreddit, timestamp, title, and local freshness filtering.
- X latest search must include visible tweet URL, timestamp, author, content, and keyword match reason.

If evidence is incomplete, stale, wrong-domain, or only a search engine summary, the skill being designed must not present it as final.

### 5. Define Fallback Policy

Write when to escalate.

Common escalation reasons:

- API returns 401/403/rate limit
- Static result lacks required fields
- Site requires login/cookies/signature
- Dynamic content is missing
- User asks for visual page state or screenshot
- The low-level result is only a search engine shell or irrelevant summary

Fallback should preserve known good paths. If a site is known to require CDP, start at CDP rather than wasting time on doomed static probes.

### 6. Design Script Structure

Prefer deterministic scripts for repeatable tasks.

Recommended structure:

```text
<site>-search/
  SKILL.md
  scripts/
    <site>_search.mjs
    <site>_lib.mjs
  evals/
    evals.json
```

Scripts should:

- Parse arguments
- Build URLs safely
- Fetch or browse using the chosen access layer
- Filter results locally
- Return structured, source-linked output
- Report exact failure reasons
- Avoid fabricating results

### 7. Produce Final Design

Return:

1. Skill name
2. Trigger description
3. Access strategy
4. Data contract
5. Evidence gate
6. Fallback policy
7. Script plan
8. `SKILL.md` draft
9. 3-5 eval prompts

## Design Examples

### Example A: GitHub Lookup Skill

Recommended first layer:

- GitHub REST API
- Raw GitHub files
- Static HTML only as fallback
- CDP only for private repos, UI interaction, screenshots, or API failure

Should trigger:

- "帮我查 vercel/next.js 最新 release"
- "查一下这个 GitHub repo 的 README 和 license"
- "GitHub 上有哪些 react table virtualized 的库"

Should not trigger:

- "帮我设计 GitHub 查询技能" - this meta-skill should trigger instead
- "打开 GitHub 页面截图" - use browser/web-access
- "写一份 GitHub README" - documentation task, not lookup

### Example B: Zhihu Search / Hot List Skill

Recommended first layer:

- CDP or page-internal fetch with browser cookies
- Do not answer from search engine snippets

Reason:

Zhihu data often depends on cookies and browser session state.

Valid result requires:

- `zhihu.com` source
- Hot list / question / answer records
- Title, link, rank or hot value where applicable

### Example C: Reddit Latest Search Skill

Recommended first layer:

- Reddit public JSON search
- Local timestamp filtering
- No CDP unless Reddit blocks public JSON or user needs logged-in content

Valid result requires:

- Reddit post URL
- Subreddit
- Author
- Created time
- Title
- Snippet
- Exact freshness filtering

### Example D: 小红书 Search Skill

Recommended first layer:

- CDP page-internal fetch
- Browser cookies and signatures are expected
- Static search engine results are not valid

Valid result requires:

- `xiaohongshu.com` source
- Note URL or ID
- Author/title/content snippet
- Timestamp if freshness is requested

## Wrong Uses

Do not use this skill for:

- Ordinary web search
- Directly querying GitHub, Zhihu, Reddit, X, LinkedIn, Instagram, TikTok, or 小红书
- Opening a website in a browser
- Debugging CDP or web-access runtime
- Writing a general-purpose web search tool

This skill teaches the agent how to design a site-specific search skill. It is not the site-specific search skill itself.
