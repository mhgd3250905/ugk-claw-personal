# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev              # Start server with watch (tsx watch src/server.ts)
npm test                 # Run all tests (Node native test runner + tsx)
npx tsc --noEmit         # Type-check without emitting
npm run design:lint      # Validate DESIGN.md token/component definitions
```

Single test / filtered tests:
```bash
node --import tsx test/server.test.ts                          # Run one test file
node --import tsx test/**/*.test.ts --test-name-pattern "foo"  # Run tests matching name
```

Docker (local dev):
```bash
docker compose up -d              # Start full local stack
docker compose restart ugk-pi     # Restart after code changes (no rebuild needed for most edits)
docker compose up --build -d      # Rebuild + start (use after Dockerfile/package changes)
docker compose -f docker-compose.prod.yml up --build -d   # Production-style deploy
npm run docker:chrome:check       # Verify Chrome sidecar health
```

Cloud server updates (production):
```bash
npm run server:ops -- tencent preflight     # Tencent Cloud pre-deploy check
npm run server:ops -- tencent deploy        # Tencent Cloud incremental deploy
npm run server:ops -- tencent verify        # Tencent Cloud post-deploy verification
npm run server:ops -- aliyun preflight      # Aliyun ECS equivalents
npm run server:ops -- aliyun deploy
npm run server:ops -- aliyun verify
```

Worker processes (run independently, not via dev/start):
```bash
npm run worker:conn       # Background conn worker (reads SQLite job queue)
npm run worker:feishu     # Feishu WebSocket subscription worker
```

## Architecture

UGK CLAW is a self-hosted HTTP agent workbench. A Fastify server wraps `@mariozechner/pi-coding-agent` sessions behind REST + SSE APIs, serving a single-page Playground UI for long-running agent conversations. The project uses ESM (`"type": "module"` in package.json) — all imports use `.js` extensions for NodeNext module resolution.

### Layer Map

```
Browser/Client
  ↓ HTTP + SSE
Fastify Server (src/server.ts)
  ├─ Routes (src/routes/) — HTTP handlers, each exports register*Routes(app, opts)
  ├─ Agent Layer (src/agent/) — session lifecycle, conversation state, asset store, conn backend
  ├─ Browser Layer (src/browser/) — Chrome sidecar registry, CDP control, target management
  ├─ UI Layer (src/ui/) — vanilla TypeScript SPA, controller-per-feature, no framework
  ├─ Integrations (src/integrations/feishu/) — Feishu IM bridge
  └─ Workers (src/workers/) — conn-worker, feishu-worker (separate Node processes)
```

### Core Subsystems

**Agent Service** (`src/agent/agent-service.ts`): Central orchestrator. Manages conversation CRUD, chat execution, streaming, queuing, interruption, history pagination, and active-run state. Each agent profile gets its own `AgentService` instance via `AgentServiceRegistry` (`src/agent/agent-service-registry.ts`).

**Session Factory** (`src/agent/agent-session-factory.ts`): Creates `pi-coding-agent` sessions wired to the project's skills (`.pi/skills/`), extensions (`.pi/extensions/`), prompts (`.pi/prompts/`), and model settings (`.pi/settings.json`). Each agent profile can have its own session directory and rules file.

**Multi-Agent Profiles** (`src/agent/agent-profile.ts`): The system supports multiple agent profiles (e.g., default, scout, planner, reviewer, worker). Each profile has isolated sessions, conversations, assets, and optional browser bindings. Profiles are defined in `.pi/agents/` as markdown files. `AgentTemplateRegistry` manages profile-to-service mapping.

**Conversation Lifecycle**: One global "current conversation" + many historical conversations. State is stored as JSON files under `.data/agent/sessions/`. `ConversationStore` (`src/agent/conversation-store.ts`) manages the catalog index with atomic writes. Switching, creating, and deleting conversations goes through command helpers in `src/agent/agent-conversation-commands.ts`.

**Streaming**: `POST /v1/chat/stream` returns SSE. `AgentService` buffers events per active run so reconnecting clients can catch up via `GET /v1/chat/events`. The Playground uses `playground-stream-controller.ts` to manage SSE connections and auto-reconnect.

**File & Asset System**: User uploads become assets stored in `.data/agent/assets/`. `AssetStore` (`src/agent/asset-store.ts`) manages blobs + index. `file-artifacts.ts` injects a file delivery protocol into agent prompts: local artifact paths get rewritten to `GET /v1/local-file?path=...` URLs. Real file delivery uses `send_file` extension (`.pi/extensions/send-file.ts`).

**Conn (Background Tasks)**: SQLite-backed job queue. `ConnSqliteStore`/`ConnDatabase` manage conn definitions, `ConnRunStore` tracks runs. `conn-worker.ts` polls for due jobs and executes them via `BackgroundAgentRunner`. Each conn run gets an isolated workspace (`BackgroundWorkspace` in `src/agent/background-workspace.ts`) with input/work/output/logs/session directories under `.data/agent/background/`. `AgentTemplateRegistry` (`src/agent/agent-template-registry.ts`) caches resolved agent profiles for conn tasks so the worker doesn't re-resolve on every run. Results delivered to task inbox, conversations, or Feishu.

**Browser Integration**: Agent browser automation uses Docker Chrome sidecar via CDP (`WEB_ACCESS_BROWSER_PROVIDER=direct_cdp` → `172.31.250.10:9223`). `browser-cleanup.ts` closes browser targets after each agent run. Sidecar profile persists in `.data/chrome-sidecar/` for login-state retention. The browser layer (`src/browser/`) provides `BrowserRegistry` for multi-instance management and `browser-control.ts` for start/restart/close operations.

**Search (SearXNG)**: Web search uses a self-hosted SearXNG sidecar (`SEARXNG_BASE_URL`). The search skill calls SearXNG's JSON API and returns results to the agent. Config lives in `deploy/searxng/` with persistent cache at `.data/searxng/`.

**Playground UI** (`src/ui/`): Vanilla TypeScript single-page application with no framework. Follows a controller-per-feature pattern — each `playground-*-controller.ts` manages one UI concern (streaming, conversations, assets, status, layout, theme, etc.). The design system is codified in `DESIGN.md` (dark theme primary, no shadows/gradients, two-column "cockpit" layout). HTML is server-rendered from `src/ui/playground.ts`.

**Playground Theming**: Dual-theme system via `[data-theme="dark"]` / `[data-theme="light"]` on `<html>`. Main playground uses `playground-theme-controller.ts`; standalone pages (conn, agents) embed their own CSS token blocks with `standalone-page-shared.ts` as the shared base. Token selectors must NOT include `body` — only `:root` and `[data-theme="dark"]` for dark tokens, `[data-theme="light"]` for light tokens.

**Playground Routing**: Two data attributes control view state on the shell element: `data-home="true"/"false"` is the sole routing toggle (agent list vs. conversation view). `data-stage-mode="landing"` is a permanent CSS-only hook for base layout styles (composer, textarea, stream-layout positioning) — it never changes at runtime and has no corresponding JS state.

**Route Pattern**: All route modules export a `register*Routes(app, options)` function called from `buildServer()` in `server.ts`. Shared parsing logic lives in `*-route-parsers.ts`, shared response formatting in `*-route-utils.ts`. To add a new route group, create the file and call its register function in `buildServer()`.

### `.pi/` Directory

The `.pi/` directory holds agent configuration tracked in git (except `.pi/sessions/`):
- **agents/** — Multi-agent profile definitions (`scout.md`, `planner.md`, `reviewer.md`, `worker.md`)
- **prompts/** — Reusable prompt templates (`implement.md`, `scout-and-plan.md`, etc.)
- **skills/** — Agent skill library (includes `superpowers/`, `anthropics/`, `vercel-labs/`, and project-specific skills)
- **extensions/** — Agent extensions (`subagent/`, `send-file`, `asset-store`, `project-guard`, `conn`)
- **settings.json** — Default provider/model, compaction, retry, and feature flags

### Key Files

| Area | Entrypoint |
|------|-----------|
| Server assembly | `src/server.ts` |
| App config (paths, env) | `src/config.ts` |
| API types (entire REST/SSE contract) | `src/types/api.ts` |
| Chat route (largest route file) | `src/routes/chat.ts` |
| Conn routes (scheduled tasks) | `src/routes/conns.ts` |
| Conn workspace & template cache | `src/agent/background-workspace.ts`, `src/agent/agent-template-registry.ts` |
| Playground UI shell | `src/ui/playground.ts` |
| Design system tokens & components | `DESIGN.md` |
| pi-coding-agent settings | `.pi/settings.json` |
| Multi-agent profile definitions | `.pi/agents/` |

### Configuration

Runtime config comes from env vars, with `.env.example` as the template. Key vars:
- `DASHSCOPE_CODING_API_KEY` / `DEEPSEEK_API_KEY` / `XIAOMI_MIMO_API_KEY` — model provider keys
- `PUBLIC_BASE_URL` — external URL for generated links
- `UGK_AGENT_DATA_DIR` / `UGK_AGENTS_DATA_DIR` — persistent state directories (externally mounted in production)
- `UGK_RUNTIME_SKILLS_USER_DIR` — user skills directory (production: shared volume, not git worktree)

Model source selection persists at `.data/agent/model-settings.json` and can be changed at runtime via Playground.

### Testing

Uses Node.js native test runner (`node:test` + `node:assert/strict`). Tests import from `../src/` directly via tsx. 86 test files in a flat `test/` directory covering all major modules. The server test (`test/server.test.ts`) uses Fastify's `inject()` for HTTP-level testing against a `buildServer()` instance with stubbed services. Test isolation is achieved by passing stub services and using temp directories.

### Data Directory Layout

```
.data/
  agent/
    sessions/          # pi-coding-agent session files
    assets/blobs/      # Uploaded file blobs
    asset-index.json   # Asset metadata index
    conversation-index.json  # Conversation catalog
    conn/conn.sqlite   # Background task database
    background/        # Background run workspaces
    feishu/            # Feishu settings + conversation map
    model-settings.json
    AGENTS.md          # Runtime agent rules (replaces repo AGENTS.md for sessions)
  agents/
    <agentId>/         # Per-agent-profile sessions, rules, skills
  chrome-sidecar/      # Chrome profile (login-state persistence)
```

### Production Notes

- **Never commit** `.env`, `.data/`, deployment tarballs, runtime screenshots, or generated reports.
- Tencent Cloud: `ssh ugk-claw-prod`, repo at `~/ugk-claw-repo`, shared state at `~/ugk-claw-shared/`.
- Aliyun ECS: `root@101.37.209.54`, repo at `/root/ugk-claw-repo`, shared state at `/root/ugk-claw-shared/`.
- Production updates use `git pull` (fast-forward), not tarball replacement. Tencent pulls from `origin` (GitHub), Aliyun from `gitee`.
- When Dockerfile, dependencies, or system packages change, use `docker compose up --build -d`; plain code changes only need `restart`.
- Browser profile, agent data, and user skills are external mounts — updating the git tree must not wipe them.
