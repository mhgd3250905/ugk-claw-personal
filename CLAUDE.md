# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `mhgd3250905/ugk-claw-personal`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-label triage vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context domain-doc layout: root `CONTEXT.md` when present, with ADRs under `docs/adr/`. See `docs/agents/domain.md`.

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
npm run worker:team       # Team pipeline worker (requires TEAM_RUNTIME_ENABLED=true)
```

Team Runtime (experimental):
```bash
npm run team:spike          # Run spike with fixture data (--keyword MED)
npm run team:spike:real     # Run spike with SearXNG live search
npm run test:team           # Run team module tests (workspace, gate, orchestrator)
npm run test:team-lab       # Run all team-related tests
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
  └─ Workers (src/workers/) — conn-worker, feishu-worker, team-worker (separate Node processes)
```

### Core Subsystems

**Agent Service** (`src/agent/agent-service.ts`): Central orchestrator. Manages conversation CRUD, chat execution, streaming, queuing, interruption, history pagination, and active-run state. Each agent profile gets its own `AgentService` instance via `AgentServiceRegistry` (`src/agent/agent-service-registry.ts`).

**Session Factory** (`src/agent/agent-session-factory.ts`): Creates `pi-coding-agent` sessions wired to the project's skills (`.pi/skills/`), extensions (`.pi/extensions/`), prompts (`.pi/prompts/`), and model settings (`.pi/settings.json`). Each agent profile can have its own session directory and rules file. Skills are filtered by a per-agent deny-list (`disabledSkillNames` in the profile), so each agent only sees its enabled skills.

**Multi-Agent Profiles** (`src/agent/agent-profile.ts`): The system supports multiple agent profiles (e.g., default, scout, planner, reviewer, worker). Each profile has isolated sessions, conversations, assets, and optional browser bindings and model sources. Profiles are defined in `.pi/agents/` as markdown files. `AgentTemplateRegistry` manages profile-to-service mapping. Model priority chain: Conn explicit override > Agent default (`defaultModelProvider`/`defaultModelId`) > Project global default (`.pi/settings.json`). `AgentServiceRegistry.list()` exposes model fields in `AgentSummary`.

**Multi-Agent Isolation**: Frontend agent scope uses `AsyncLocalStorage` (not global `process.env`), so concurrent agent runs don't leak env into each other. Backend conn workspace env also uses async context with explicit injection at Bash spawn. Browser cleanup scope carries `agentId + conversationId` or `connId + runId` to avoid shared Chrome instance cleanup colliding across runs. `GET /v1/agents/status` reports per-profile `idle/busy`; same-agent concurrent non-streaming chat returns `409 AGENT_BUSY`, streaming chat pre-checks before SSE hijack.

**Conversation Lifecycle**: One global "current conversation" + many historical conversations. State is stored as JSON files under `.data/agent/sessions/`. `ConversationStore` (`src/agent/conversation-store.ts`) manages the catalog index with atomic writes. Switching, creating, and deleting conversations goes through command helpers in `src/agent/agent-conversation-commands.ts`.

**Streaming**: `POST /v1/chat/stream` returns SSE. `AgentService` buffers events per active run so reconnecting clients can catch up via `GET /v1/chat/events`. The Playground uses `playground-stream-controller.ts` to manage SSE connections and auto-reconnect. A stream owner guard ensures that after a cross-agent switch (changing the active agent profile mid-conversation), stale events from the previous agent's run are discarded rather than delivered to the client.

**File & Asset System**: User uploads become assets stored in `.data/agent/assets/`. `AssetStore` (`src/agent/asset-store.ts`) manages blobs + index. `file-artifacts.ts` injects a file delivery protocol into agent prompts: local artifact paths get rewritten to `GET /v1/local-file?path=...` URLs. Real file delivery uses `send_file` extension (`.pi/extensions/send-file.ts`).

**Conn (Background Tasks)**: SQLite-backed job queue. `ConnSqliteStore`/`ConnDatabase` manage conn definitions, `ConnRunStore` tracks runs. `conn-worker.ts` polls for due jobs and executes them via `BackgroundAgentRunner`. Each conn run gets an isolated workspace (`BackgroundWorkspace` in `src/agent/background-workspace.ts`) with input/work/output/logs/session directories under `.data/agent/background/`. `AgentTemplateRegistry` (`src/agent/agent-template-registry.ts`) caches resolved agent profiles for conn tasks so the worker doesn't re-resolve on every run. Results delivered to task inbox, conversations, or Feishu. Each conn run gets an `ARTIFACT_PUBLIC_DIR` for publishable outputs; when artifact validation is enabled, a validation pass runs after agent execution with an optional repair loop for missing or invalid files. Validated artifacts are served via `/v1/conns/:connId/runs/:runId/artifacts/*` and `/v1/conns/:connId/artifacts/latest/*`.

**Browser Integration**: Agent browser automation uses Docker Chrome sidecars via CDP (`WEB_ACCESS_BROWSER_PROVIDER=direct_cdp`). `UGK_BROWSER_INSTANCES_JSON` configures up to 3 independent Chrome instances (default / chrome-01 / chrome-02), each with its own profile directory, CDP endpoint, and GUI port. `BrowserRegistry` manages multi-instance lifecycle; `browser-cleanup.ts` closes targets after each agent run. Sidecar profiles persist in `.data/chrome-sidecar*/` for login-state retention. `browser-control.ts` handles start/restart/close operations. Browser bindings can only be changed through the Playground UI (requires `x-ugk-browser-binding-confirmed: true` + `x-ugk-browser-binding-source: playground` headers); agent skills (`agent-profile-ops`, `web-access`, etc.) cannot modify browser bindings programmatically. Policy is centralized in `src/browser/browser-binding-policy.ts`.

**Notification Hub** (`src/agent/notification-hub.ts`): In-process broadcast bus for real-time events (conn run completion, task inbox updates). Frontend subscribes via `GET /v1/notifications/stream` (SSE). `playground-notification-controller.ts` renders toasts; `playground-task-inbox.ts` handles cross-session conn result observation.

**Search (SearXNG)**: Web search uses a self-hosted SearXNG sidecar (`SEARXNG_BASE_URL`). The search skill calls SearXNG's JSON API and returns results to the agent. Config lives in `deploy/searxng/` with persistent cache at `.data/searxng/`.

**Playground UI** (`src/ui/`): Vanilla TypeScript single-page application with no framework. Follows a controller-per-feature pattern — each `playground-*-controller.ts` manages one UI concern (streaming, conversations, assets, status, layout, theme, etc.). HTML is server-rendered from `src/ui/playground.ts`.

**Playground Theming & Routing**: Dual-theme (`[data-theme="dark"]`/`[data-theme="light"]`) with FOUC prevention via inline `<script>`. Token selectors must use `:root` / `[data-theme]` only — never `body`. View routing uses `data-home="true"/"false"` on the shell element; `data-stage-mode="landing"` is a permanent CSS-only hook. Full CSS details in `docs/playground-current.md`.

**Route Pattern**: All route modules export a `register*Routes(app, options)` function called from `buildServer()` in `server.ts`. Shared parsing logic lives in `*-route-parsers.ts`, shared response formatting in `*-route-utils.ts`, shared response presentation in `*-route-presenters.ts` (e.g., `conn-route-presenters.ts`). API errors use helpers from `http-errors.ts` for consistent error responses. To add a new route group, create the file and call its register function in `buildServer()`.

**Team Runtime v2** (`src/team/`): Plan-driven sequential multi-role pipeline. Core concepts: Plan → TeamUnit → Run → Task → Attempt → WorkUnit. Four roles: **worker** (executes task), **checker** (reviews output: pass/revise/fail, max 3 revisions), **watcher** (post-task review: accept_task/confirm_failed/request_revision, max 1 revision), **finalizer** (generates summary report). `TeamOrchestrator` drives sequential task execution with work-unit loops; `RunWorkspace` manages run persistence (atomic JSON state + per-attempt files). API routes at `/v1/team/*`: Plans CRUD, TeamUnits CRUD, Runs with pause/resume/cancel controls, healthz, final-report. The `team-worker` process polls for queued runs when `TEAM_RUNTIME_ENABLED=true`.

Team Runtime v2 internals:
- **TeamUnit**: Reusable preset team binding 4 AgentProfile slots (worker, checker, watcher, finalizer). Each slot stores an `agentId` referencing a system agent profile (same profiles used by conn tasks). Users select profiles from a dropdown in the UI (fetched via `GET /v1/agents`). Archived units cannot be used for new runs.
- **Plan**: Ordered task list with acceptance criteria, goal, and output contract. Plans with runs are content-immutable; unused plans can be deleted.
- **Run lifecycle**: queued → running → completed/completed_with_failures/failed/cancelled. Pause/resume interrupts mid-task.
- **WorkUnit loop**: worker runs → checker reviews (pass → accepted, revise → worker retries with feedback, fail → work unit fails) → watcher reviews (accept → task done, confirm_failed → task fails, request_revision → new attempt with feedback).
- **Config locks**: Active runs lock their Plan, TeamUnit, and all 4 AgentProfiles to prevent mutation during execution.
- **Profile resolution flow**: `TeamOrchestrator.runToCompletion()` loads the run's TeamUnit and injects its 4 profile IDs into `AgentProfileRoleRunner.setProfileIds()` before execution. The role runner resolves each ID via `BackgroundAgentProfileResolver` → `AgentTemplateRegistry` → playground profile lookup (`.data/agents/profiles.json`). If a profile ID is not found, falls back to "main". `createRoleRunner()` defaults all 4 slots to "main" as safe baseline; orchestrator overrides at runtime.
- **AgentProfile integration**: `AgentProfileRoleRunner` (`src/team/agent-profile-role-runner.ts`) implements `TeamRoleRunner` using real AgentProfile sessions via `BackgroundAgentSessionFactory`. Checker/watcher agents output JSON; parse errors default to safe fallbacks.
- **Mock mode**: `TEAM_USE_MOCK_RUNNER=true` uses `MockRoleRunner` for testing; unset or false uses `AgentProfileRoleRunner`.
- **Stale state**: Orchestrator re-reads state from disk after every async mutation to avoid stale references.
- **Timeout**: Max run duration 60 minutes; timed-out runs are marked failed.
- **Feature flag**: `TEAM_RUNTIME_ENABLED` gates route registration and worker startup; when false, zero impact on rest of system.
- **UI**: Team page (`src/ui/team-page.ts`) provides a modal form for creating/editing TeamUnits with agent profile `<select>` dropdowns (same pattern as conn task editor). Displays profile names (not raw IDs) in the team list. Supports edit and archive operations.

### Architecture Governance

`AgentService` (`src/agent/agent-service.ts`) is the runtime orchestration center. Its `activeRuns` / `terminalRuns` in-memory maps and `runChat()` lifecycle (create session → prepare assets → register active run → subscribe events → execute prompt → persist → terminal snapshot → browser cleanup) are intentionally kept together — splitting them into separate stores would make synchronization boundaries worse, not better. Do not refactor `AgentService` further unless a real bug or new feature demands it. The project has completed its architecture cleanup phase (~85-90%); remaining work should focus on real user scenarios, small-scoped tests for new features, and targeted fixes rather than continued file splitting.

Out of bounds (do not do unless explicitly asked):
- Do not continue splitting `AgentService` or `src/team/` without a concrete bug or feature driving it.
- Do not treat mobile Playground as a compressed desktop version.
- Do not push Feishu as current mainline unless the user re-requests.
- Do not modify `references/pi-mono/` — reference mirror, not business code.

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
| Artifact routes (delivery validation) | `src/routes/artifacts.ts` |
| Artifact contract & validation | `src/agent/artifact-contract.ts`, `src/agent/artifact-validation.ts`, `src/agent/artifact-repair-loop.ts` |
| Conn workspace & template cache | `src/agent/background-workspace.ts`, `src/agent/agent-template-registry.ts` |
| Agent profile catalog & skill deny-list | `src/agent/agent-profile-catalog.ts` |
| Model config & validation | `src/agent/model-config.ts`, `src/routes/model-config.ts` |
| Playground UI shell | `src/ui/playground.ts` |
| Standalone conn task page | `src/ui/conn-page.ts` |
| Standalone task inbox page | `src/ui/inbox-page.ts` |
| Standalone agent management page | `src/ui/agents-page.ts` |
| Team page UI | `src/ui/team-page.ts` |
| pi-coding-agent settings | `.pi/settings.json` |
| Multi-agent profile definitions | `.pi/agents/` |
| Team Runtime types | `src/team/types.ts` |
| Team Runtime orchestrator | `src/team/orchestrator.ts` |
| Team Runtime run workspace | `src/team/run-workspace.ts` |
| Team Runtime plan store | `src/team/plan-store.ts` |
| Team Runtime team unit store | `src/team/team-unit-store.ts` |
| Team Runtime config locks | `src/team/config-locks.ts` |
| Team Runtime role runner interface + mock | `src/team/role-runner.ts` |
| Team Runtime AgentProfile role runner | `src/team/agent-profile-role-runner.ts` |
| Team Runtime progress/timing | `src/team/progress.ts`, `src/team/timing.ts` |
| Team Runtime path validation | `src/team/path-refs.ts` |
| Team Runtime ID generation | `src/team/ids.ts` |
| Team API routes | `src/team/routes.ts` |
| Team worker | `src/workers/team-worker.ts` |

### Configuration

Requires Node.js >= 22. Runtime config comes from env vars, with `.env.example` as the template. Key vars:
- `ANTHROPIC_AUTH_TOKEN` — primary model key; also used for zhipu-glm compatible chain (`https://open.bigmodel.cn/api/anthropic` via `anthropic-messages` provider)
- `ZHIPU_GLM_API_KEY` — 智谱 GLM model key (separate from `ANTHROPIC_AUTH_TOKEN`; uses `authHeader: true`)
- `DASHSCOPE_CODING_API_KEY` / `DEEPSEEK_API_KEY` / `XIAOMI_MIMO_API_KEY` — alternative model provider keys
- `PUBLIC_BASE_URL` — external URL for generated links
- `UGK_AGENT_DATA_DIR` / `UGK_AGENTS_DATA_DIR` — persistent state directories (externally mounted in production)
- `UGK_RUNTIME_SKILLS_USER_DIR` — user skills directory (production: shared volume, not git worktree)
- `CONN_WORKER_MAX_CONCURRENCY` — max parallel conn runs (default 3)
- `TEAM_RUNTIME_ENABLED` — enable team runtime routes and worker (must be `"true"`)
- `TEAM_USE_MOCK_RUNNER` — use mock role runner instead of real AgentProfile sessions (default false)
- `TEAM_DATA_DIR` — team data directory (default `.data/team`)
- `TEAM_WORKER_POLL_INTERVAL_MS` — worker poll interval (default 3000)
- `TEAM_MAX_CONCURRENT_RUNS` — max concurrent runs (default 1)

Model source selection persists at `.data/agent/model-settings.json` and can be changed at runtime via Playground.

### Testing

Uses Node.js native test runner (`node:test` + `node:assert/strict`). Tests run with `--test-concurrency=1` to avoid SQLite contention between test files. Tests import from `../src/` directly via tsx. Test files live in a flat `test/` directory covering all major modules. The server test (`test/server.test.ts`) uses Fastify's `inject()` for HTTP-level testing against a `buildServer()` instance with stubbed services. Test isolation is achieved by passing stub services and using temp directories (`node:os` `tmpdir()`).

### Conventions

- **ESM**: `"type": "module"` — all local imports must use `.js` extensions (e.g., `import { foo } from "./bar.js"` for `bar.ts`).
- **Route registration**: Every route file exports `register*Routes(app, options)`. Shared parsers → `*-route-parsers.ts`, shared utils → `*-route-utils.ts`, shared presenters → `*-route-presenters.ts`. Add new route groups by creating the file and calling its register function in `buildServer()` inside `server.ts`.
- **UI controllers**: Each `playground-*-controller.ts` owns one UI concern. No framework; vanilla TS with direct DOM manipulation.
- **Agent profile operations**: Must go through REST API (`POST /v1/agents`, `/v1/agents/:agentId/skills`, etc.), never by editing `.data/agents/profiles.json` directly.
- **Browser bindings**: Only changeable via Playground UI (specific headers required); agent skills cannot modify browser bindings programmatically.

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
  team/
    runs/<teamRunId>/  # Per-run state, plan, events, streams, cursors, artifacts
  chrome-sidecar/      # Chrome profile (login-state persistence)
```

### Production Notes

- **Never commit** `.env`, `.data/`, deployment tarballs, runtime screenshots, or generated reports.
- Tencent Cloud: `ssh ugk-claw-prod`, repo at `~/ugk-claw-repo`, shared state at `~/ugk-claw-shared/`.
- Aliyun ECS: `root@101.37.209.54`, repo at `/root/ugk-claw-repo`, shared state at `/root/ugk-claw-shared/`.
- Production updates use `git pull` (fast-forward), not tarball replacement. Tencent pulls from `origin` (GitHub), Aliyun from `gitee`. Always push both remotes before deploying: `git push && git push gitee main`.
- When Dockerfile, dependencies, or system packages change, use `docker compose up --build -d`; plain code changes only need `restart`.
- Browser profile, agent data, and user skills are external mounts — updating the git tree must not wipe them.
