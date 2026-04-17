# Agave Font, Interrupt, Queue, and Cleanup Implementation Plan

**Goal:** 将 playground 切换为 Agave 字体，并为 HTTP agent 增加运行中打断、运行中插嘴、等待续发能力，验证后更新文档、保存 Git，再整理代码结构。

**Architecture:** 复用 `pi-coding-agent` 的原生 `AgentSession.prompt(..., { streamingBehavior })`、`abort()` 和 `clearQueue()` 能力，在本项目 HTTP 层补 conversation 级运行控制器。前端只负责呈现和调用控制接口，不伪造状态。

**Tech Stack:** Fastify、TypeScript、Node test runner、SSE、本地静态字体资源、`@mariozechner/pi-coding-agent` session API。

---

## Facts Confirmed

- Agave 字体来自 `https://github.com/blobject/agave`，仓库 MIT license，`dist` 提供 TTF。
- `AgentSession.prompt()` 在 streaming 时支持 `streamingBehavior: "steer" | "followUp"`。
- `AgentSession.abort()` 可中断当前运行并等待 agent idle。
- `AgentSession.clearQueue()` 可清空 steering/follow-up 队列。
- 当前 `POST /v1/chat/stream` 总是等待 `session.prompt()` 完成，不支持第二条消息进入同一活跃 session。

## Decisions

- 字体：下载 Agave Regular / Bold TTF 到项目静态资源目录，由 Fastify 暴露 `/assets/fonts/...`，CSS 使用 `@font-face`。
- 打断：新增 `POST /v1/chat/interrupt`，按 `conversationId` 找活跃运行并调用 `abort()`，SSE 输出 `interrupted` 事件。
- 插嘴：新增 `POST /v1/chat/queue`，body 包含 `mode: "steer" | "followUp"`。`steer` 表示运行中插嘴，`followUp` 表示等本轮结束后继续。
- 继续：打断后用户正常再发 `POST /v1/chat/stream`，复用同一 `conversationId` 的 session 文件继续。
- 前端：运行中输入框保持可输入，主按钮根据选择发送 `steer/followUp`，另有 interrupt 控制。
- 结构整理：功能验证、文档和 Git 保存之后再做，避免重构掩盖行为改动。

## Tasks

### Task 1: Add Agave Font Asset Support

**Files:**
- Create: `public/fonts/Agave-Regular.ttf`
- Create: `public/fonts/Agave-Bold.ttf`
- Modify: `src/server.ts`
- Modify: `src/ui/playground.ts`
- Test: `test/server.test.ts`

**Steps:**
1. Write failing test that `/assets/fonts/Agave-Regular.ttf` returns a TTF response and playground HTML contains `font-family: "Agave"`.
2. Run targeted tests and confirm failure.
3. Add a static asset route in Fastify for local assets.
4. Download Agave TTF files from upstream `dist`.
5. Update CSS with `@font-face` and use Agave throughout playground.
6. Run targeted tests and full `npm run test`.

### Task 2: Add Runtime Control APIs

**Files:**
- Modify: `src/types/api.ts`
- Modify: `src/agent/agent-session-factory.ts`
- Modify: `src/agent/agent-service.ts`
- Modify: `src/routes/chat.ts`
- Test: `test/agent-service.test.ts`
- Test: `test/server.test.ts`

**Steps:**
1. Extend `AgentSessionLike` with optional `abort()`, `clearQueue()`, and streaming prompt options.
2. Write failing tests for:
   - active run rejects duplicate `streamChat`
   - `queueMessage(..., "steer")` calls active session prompt with `streamingBehavior: "steer"`
   - `queueMessage(..., "followUp")` calls active session prompt with `streamingBehavior: "followUp"`
   - `interruptChat()` calls `abort()` and emits an interrupted state
3. Implement conversation-level active run registry in `AgentService`.
4. Add `POST /v1/chat/queue` and `POST /v1/chat/interrupt`.
5. Run targeted tests and full `npm run test`.

### Task 3: Update Playground Interaction

**Files:**
- Modify: `src/ui/playground.ts`
- Test: `test/server.test.ts`

**Steps:**
1. Write failing HTML tests for interrupt button, queue mode control, `/v1/chat/queue`, and `/v1/chat/interrupt`.
2. Update UI so textarea stays enabled while running.
3. Add mode controls for `steer` and `followUp`.
4. Add interrupt button and status/process events.
5. Run targeted tests and browser/manual endpoint checks.

### Task 4: Documentation and Git Save

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `.gitignore` only if needed for font assets or intentionally versioned user skill assets.

**Steps:**
1. Update current snapshot, endpoints, architecture, validation status, and recovery notes.
2. Run `npm run test`.
3. Verify Docker dev container path if service is running.
4. Stage only relevant project files; do not stage `api.txt`, `.data`, `logs`, `node_modules`, or reference mirror.
5. Commit with a clear message.

### Task 5: Cleanup and Module Design Pass

**Files:**
- Likely create small focused modules under `src/agent/` and/or `src/ui/` only if they reduce real complexity.
- Modify tests alongside moved behavior.

**Steps:**
1. Identify duplicated stream/event formatting and oversized UI script sections.
2. Extract only stable boundaries; no speculative framework rewrite.
3. Remove dead code discovered by tests and search.
4. Run full tests.
5. Update docs if structure changes.
6. Commit cleanup separately.

## Validation Checklist

- `npm run test`
- `GET /healthz`
- `GET /playground`
- `GET /assets/fonts/Agave-Regular.ttf`
- `POST /v1/chat/stream`
- `POST /v1/chat/queue` while stream is active
- `POST /v1/chat/interrupt` while stream is active
- Manual playground run: start long task, steer message, follow-up message, interrupt, then send again with same conversation.
