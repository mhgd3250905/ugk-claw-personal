---
name: web-access
description: Use this skill for web browsing, logged-in websites, social platforms, dynamic pages, and any task that benefits from a real browser backed by the host machine.
allowed-tools: Bash
---

# web-access

Use this skill as the single external entry point whenever a task needs web access.

Do not expose `WebSearch`, `WebFetch`, `curl`, `Jina`, or the host browser bridge as parallel choices for the agent to pick from manually.

Inside this skill, use staged routing:

- `S1`: `WebSearch / WebFetch / curl`
- `S2`: `Jina`
- `S3`: the existing stable browser path in this project

Move from a lower stage to a higher stage only after a current-round failure is confirmed. A current-round failure includes fetch errors, empty results, obviously irrelevant results, login walls, anti-bot blocking, or incomplete content caused by static access.

Historical hits may influence only the starting stage. They never override the current-round failure facts: if the chosen starting stage fails again in this round, continue upgrading.

## Startup

Always start with:

```bash
node /app/runtime/skills-user/web-access/scripts/check-deps.mjs
```

If you are debugging from the Windows project directory instead of the `/app` container, use:

```bash
node runtime/skills-user/web-access/scripts/check-deps.mjs
```

If the check passes, a local compatibility proxy will be available at `http://127.0.0.1:3456`.

When this skill runs inside the Docker container, it cannot start Windows Chrome by itself. If `check-deps.mjs` reports `local_browser_executable_not_found`, ask the user to start the host IPC bridge from the Windows project directory:

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\start-web-access-browser.ps1
```

After that command reports `web-access host bridge ready`, rerun `check-deps.mjs`. The host bridge will launch the configured Chrome/profile when the agent sends an IPC browser request.

When this skill produces a local HTML report, screenshot page, or any artifact that the user should open in the host browser, never expose `file:///app/...` container paths to the user. Convert them to host-reachable URLs instead:

- `public/<fileName>` -> `http://127.0.0.1:3000/<fileName>`
- `runtime/<fileName>` -> `http://127.0.0.1:3000/runtime/<fileName>`
- If the goal is direct file delivery instead of browser preview, use `send_file`

When you need browser-backed work that may span multiple commands, define the current agent scope once and reuse it on every proxy request:

```bash
AGENT_SCOPE="${CLAUDE_AGENT_ID:-${CLAUDE_HOOK_AGENT_ID:-${agent_id:-}}}"
```

For a concrete URL, 默认优先使用自动 `run-url` 路径，不要手动把 `recommend` 和 `report` 再额外跑一遍：

```bash
node /app/runtime/skills-user/web-access/scripts/staged-route-cli.mjs run-url --url "https://example.com" --task-kind "open_page"
```

That command uses `staged-url-runner.mjs` internally and will automatically try `S1 -> S2 -> S3` for a 具体 URL, while updating the route cache after each current-round attempt.

Only use `recommend` / `report` when you are doing manual debugging or deliberately running the stages one by one.

## Local proxy API

The following endpoints are available:

```bash
curl -s http://127.0.0.1:3456/health
curl -s http://127.0.0.1:3456/targets
curl -s "http://127.0.0.1:3456/new?url=https%3A%2F%2Fexample.com"
curl -s "http://127.0.0.1:3456/session/target?metaAgentScope=${AGENT_SCOPE}"
curl -s -X POST "http://127.0.0.1:3456/session/target?target=ID&metaAgentScope=${AGENT_SCOPE}"
curl -s -X DELETE "http://127.0.0.1:3456/session/target?metaAgentScope=${AGENT_SCOPE}"
curl -s -X POST "http://127.0.0.1:3456/session/close-all?metaAgentScope=${AGENT_SCOPE}"
curl -s "http://127.0.0.1:3456/info?target=ID"
curl -s -X POST "http://127.0.0.1:3456/eval?target=ID" -d 'document.title'
curl -s "http://127.0.0.1:3456/navigate?target=ID&url=https%3A%2F%2Fexample.com"
curl -s "http://127.0.0.1:3456/back?target=ID"
curl -s -X POST "http://127.0.0.1:3456/click?target=ID" -d 'button.submit'
curl -s -X POST "http://127.0.0.1:3456/clickAt?target=ID" -d 'button.upload'
curl -s "http://127.0.0.1:3456/scroll?target=ID&direction=bottom"
curl -s "http://127.0.0.1:3456/screenshot?target=ID&file=/tmp/page.png"
curl -s -X POST "http://127.0.0.1:3456/download?target=ID" -d 'a.download-link'
curl -s -X POST "http://127.0.0.1:3456/download?target=ID&dir=/workspace/group/downloads" -d 'a.download-link'
curl -s -X POST "http://127.0.0.1:3456/download?target=ID&file=/workspace/group/downloads/report.pdf" -d 'a.download-link'
curl -s "http://127.0.0.1:3456/close?target=ID"
```

`/download` is for browser-native downloads that depend on login state, cookies, or a real click. If you omit both `file` and `dir`, it defaults to `/workspace/group/downloads`. The response always returns the actual saved file path after the browser download completes, so you do not need to guess the browser-generated filename.

When passing a nested URL into `/new` or `/navigate`, always URL-encode it first. Otherwise `&foo=bar` inside the target URL can be misread as proxy query params.

Preferred workflow for downloads:

- If you have not clicked the download control yet, trigger the download with:
  - `curl -s -X POST "http://127.0.0.1:3456/download?target=ID" -d '<download selector>'`
- If you already clicked a download control and only need to wait for the file, do **not** guess a second selector. Reuse the same target and call:
  - `curl -s "http://127.0.0.1:3456/download?target=ID"`
- After `/download` returns, immediately read the returned file path and continue processing that file.

## Working style

- Keep `web-access` as the single external entry point and make stage choices internally.
- When S3 browser work may span multiple commands, always carry the same `metaAgentScope=${AGENT_SCOPE}` so the proxy can reuse the current agent-owned target instead of competing for a shared page.
- When a task only needs a lightweight public result, start from `S1`.
- When the current-round evidence shows `S1` is insufficient, upgrade to `S2`.
- When `S2` still cannot produce a reliable result, upgrade to `S3`.
- For a 具体 URL task, 默认优先:
  - `node /app/runtime/skills-user/web-access/scripts/staged-route-cli.mjs run-url --url "<URL>" --task-kind "<TASK_KIND>"`
- Only for manual debugging, you may use:
  - `node /app/runtime/skills-user/web-access/scripts/staged-route-cli.mjs recommend --url "<URL>" --task-kind "<TASK_KIND>"`
  - `node /app/runtime/skills-user/web-access/scripts/staged-route-cli.mjs report --url "<URL>" --task-kind "<TASK_KIND>" --stage "S1|S2|S3" --status "success|failure" [--failure-reason "<REASON>"]`
- Prefer `eval` for extraction.
- Open your own background tab with `/new`; do not assume an existing tab is safe to reuse.
- If you intentionally keep an agent-owned browser page alive for follow-up work, clear it with `/session/target` or `/session/close-all` when the task is complete.
- URL-encode nested URLs before calling `/new` or `/navigate`, especially when the target URL already contains query params such as `&src=` or `&f=live`.
- Close tabs you created when the task is complete.
- If IPC reports `chrome_cdp_unreachable`, the host bridge or local CDP fallback will try to launch the configured Chrome profile automatically. Inside Docker, use the host launcher above instead of looking for a browser executable in the container.
