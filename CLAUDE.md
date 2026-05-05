# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev              # Start server with watch (tsx watch src/server.ts)
npm test                 # Run all tests (Node native test runner + tsx)
npx tsc --noEmit         # Type-check without emitting
npm run design:lint      # Validate DESIGN.md token/component definitions
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

UGK CLAW is a self-hosted HTTP agent workbench. A Fastify server wraps `@mariozechner/pi-coding-agent` sessions behind REST + SSE APIs, serving a single-page Playground UI for long-running agent conversations.

### Layer Map

```
Browser/Client
  ↓ HTTP + SSE
Fastify Server (src/server.ts)
  ├─ Routes (src/routes/) — HTTP handlers for chat, files, assets, conns, feishu, model-config, debug
  ├─ Agent Layer (src/agent/) — session lifecycle, conversation state, asset store, conn backend
  ├─ UI Layer (src/ui/) — server-rendered Playground SPA (HTML template + inline CSS/JS)
  ├─ Integrations (src/integrations/feishu/) — Feishu IM bridge
  └─ Workers (src/workers/) — conn-worker, feishu-worker (separate Node processes)
```

### Core Subsystems

**Agent Service** (`src/agent/agent-service.ts`): Central orchestrator. Manages conversation CRUD, chat execution, streaming, queuing, interruption, history pagination, and active-run state. Each agent profile gets its own `AgentService` instance via `AgentServiceRegistry` (`src/agent/agent-service-registry.ts`).

**Session Factory** (`src/agent/agent-session-factory.ts`): Creates `pi-coding-agent` sessions wired to the project's skills (`.pi/skills/`), extensions (`.pi/extensions/`), prompts (`.pi/prompts/`), and model settings (`.pi/settings.json`). Each agent profile can have its own session directory and rules file.

**Conversation Lifecycle**: One global "current conversation" + many historical conversations. State is stored as JSON files under `.data/agent/sessions/`. `ConversationStore` (`src/agent/conversation-store.ts`) manages the catalog index with atomic writes. Switching, creating, and deleting conversations goes through command helpers in `src/agent/agent-conversation-commands.ts`.

**Streaming**: `POST /v1/chat/stream` returns SSE. `AgentService` buffers events per active run so reconnecting clients can catch up via `GET /v1/chat/events`. The Playground uses `playground-stream-controller.ts` to manage SSE connections and auto-reconnect.

**File & Asset System**: User uploads become assets stored in `.data/agent/assets/`. `AssetStore` (`src/agent/asset-store.ts`) manages blobs + index. `file-artifacts.ts` injects a file delivery protocol into agent prompts: local artifact paths get rewritten to `GET /v1/local-file?path=...` URLs. Real file delivery uses `send_file` extension (`.pi/extensions/send-file.ts`).

**Conn (Background Tasks)**: SQLite-backed job queue. `ConnSqliteStore`/`ConnDatabase` manage conn definitions, `ConnRunStore` tracks runs. `conn-worker.ts` polls for due jobs and executes them via `BackgroundAgentRunner`. Results delivered to task inbox, conversations, or Feishu.

**Browser Integration**: Agent browser automation uses Docker Chrome sidecar via CDP (`WEB_ACCESS_BROWSER_PROVIDER=direct_cdp` → `172.31.250.10:9223`). `browser-cleanup.ts` closes browser targets after each agent run. Sidecar profile persists in `.data/chrome-sidecar/` for login-state retention.

### Key Files

| Area | Entrypoint |
|------|-----------|
| Server assembly | `src/server.ts` |
| App config (paths, env) | `src/config.ts` |
| API types | `src/types/api.ts` |
| Chat route (largest route file) | `src/routes/chat.ts` |
| Playground UI shell | `src/ui/playground.ts` |
| Design tokens | `DESIGN.md` |
| pi-coding-agent settings | `.pi/settings.json` |

### Configuration

Runtime config comes from env vars, with `.env.example` as the template. Key vars:
- `DASHSCOPE_CODING_API_KEY` / `DEEPSEEK_API_KEY` / `XIAOMI_MIMO_API_KEY` — model provider keys
- `PUBLIC_BASE_URL` — external URL for generated links
- `UGK_AGENT_DATA_DIR` / `UGK_AGENTS_DATA_DIR` — persistent state directories (externally mounted in production)
- `UGK_RUNTIME_SKILLS_USER_DIR` — user skills directory (production: shared volume, not git worktree)

Model source selection persists at `.data/agent/model-settings.json` and can be changed at runtime via Playground.

### Testing

Uses Node.js native test runner (`node:test` + `node:assert/strict`). Tests import from `../src/` directly via tsx. The server test (`test/server.test.ts`) uses Fastify's `inject()` for HTTP-level testing against a `buildServer()` instance with stubbed services. Test isolation is achieved by passing stub services and using temp directories.

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
