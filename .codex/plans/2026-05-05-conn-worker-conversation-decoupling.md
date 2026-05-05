# Conn Worker Conversation Decoupling Implementation Plan

> **For Codex:** 执行本计划前必须得到用户明确批准。按任务逐项实施，不要顺手重构无关 conn / playground / activity 逻辑。

**Goal:** 让 `conn` 后台任务默认独立于前台聊天会话运行，避免删除会话、无效 `conversationId` 或 agent 编造会话 ID 影响后台任务执行与结果投递。

**Architecture:** 把 `task_inbox` 确认为 `conn` 的默认投递目标和后台任务主语义；保留 `conversation` 作为 legacy 数据兼容，但不再作为新建任务的默认或必填路径。`conn worker` 执行继续基于 `connId + runId + workspace + resolved agent snapshot`，结果统一进入任务消息 / 全局通知 / 飞书目标，前台会话只作为可选来源信息而不是执行依赖。

**Tech Stack:** TypeScript, Fastify routes, pi extension tool schema, SQLite-backed conn store, Node test runner, inline Playground UI modules.

---

## Current Findings

- `src/agent/background-agent-runner.ts` 的执行主链路已经不依赖 `conversationId`：browser cleanup scope 使用 `conn.connId`，session 创建参数使用 `runId / connId / workspace / snapshot`，产物目录使用 `background/runs/<runId>`。
- `src/workers/conn-worker.ts` 的 `toAgentActivityInput()` 当前没有写入 `conversationId`，说明结果投递已经天然适合全局任务消息。
- `src/routes/conn-route-parsers.ts` 在缺省 `target` 时已经能补 `{ type: "task_inbox" }`，但仍接受 legacy `conversation`。
- `src/ui/playground-conn-activity-controller.ts` 的新建 / 编辑 UI 默认 `task_inbox`，并把 legacy `conversation` 展示为任务消息。
- 真正导致 agent 继续制造会话绑定的是 `.pi/skills/conn-orchestrator/SKILL.md` 和 `.pi/extensions/conn/index.ts`：前者写着默认当前会话，后者工具 schema 不支持 `task_inbox`，迫使 agent 传 `conversation`。

## Target Behavior

1. 使用 `conn` 工具创建后台任务时，如果用户没有明确指定飞书目标，默认 `target` 为 `{ "type": "task_inbox" }`。
2. agent 不再需要读取、猜测或传递当前 `conversationId` 来创建 conn。
3. 已存在的 `target.type === "conversation"` 旧任务继续可读、可编辑、可执行，并在 UI 中显示为“任务消息”或 legacy 说明，不因为旧数据直接坏掉。
4. 删除前台会话不应影响任何 conn 的执行、run 历史、结果通知或产物链接。
5. conn 编辑器上传附件不再依赖当前前台 `state.conversationId`；后台任务附件应使用稳定内部资产归属。

## Non-Goals

- 不改 `AgentActivityStore` 的表结构；`conversationId` 字段继续保留给其他通知或 legacy 过滤使用。
- 不删除 `ConnTarget` 的 `conversation` union 分支，避免旧数据和旧 API 客户端断裂。
- 不把后台任务做成强隔离容器；本计划只处理会话绑定，不改变工具权限沙箱。
- 不重做 conn UI 交互框架、不改飞书投递能力。

---

## Task 1: Add Failing Tests For Tool-Level `task_inbox` Default

**Files:**
- Modify: `test/subagent.test.ts` or create focused extension test if existing conn extension tests are absent
- Read: `.pi/extensions/conn/index.ts`

**Steps:**

1. Add a test proving the `conn` extension parameter schema accepts `{ type: "task_inbox" }`.
2. Add a test proving `create` can omit `target` and the implementation creates a conn with `target.type === "task_inbox"`.
3. Run the focused test.

**Expected failure before implementation:**

- Schema rejects `task_inbox`, or create returns `create requires title, prompt, target, and schedule.`

**Verification command:**

```powershell
npm test
```

If the full suite is too broad during implementation, run the smallest available test file first, then finish with full `npm test`.

---

## Task 2: Update Conn Extension Schema And Create Defaults

**Files:**
- Modify: `.pi/extensions/conn/index.ts`

**Implementation:**

1. Add `task_inbox` to `ConnTargetSchema`:

```ts
Type.Object({
	type: Type.Literal("task_inbox"),
})
```

2. Change `create` validation so `target` is optional:

```ts
if (!params.title || !params.prompt || !params.schedule) {
	return createErrorResult("create requires title, prompt, and schedule.", {
		action: "create",
	});
}
```

3. Pass the default target to `runtime.connStore.create()`:

```ts
target: params.target ?? { type: "task_inbox" },
```

4. Keep `conversation` accepted in schema for legacy compatibility, but do not document it as default.

**Impact analysis:**

- Direct callers using old `conversation` target keep working.
- New agent-created conn no longer needs a valid conversation ID.
- Store-level validation remains unchanged because `ConnTarget` already supports `task_inbox`.

---

## Task 3: Correct Conn-Orchestrator Skill Instructions

**Files:**
- Modify: `.pi/skills/conn-orchestrator/SKILL.md`

**Implementation:**

1. Replace “默认把结果投递回当前会话” with “默认投递到任务消息 / 全局通知”。
2. Replace target mapping:

```md
- 默认目标：任务消息 `target = { type: "task_inbox" }`；也可以省略 `target`，由工具默认补齐。
- 飞书群：`target = { type: "feishu_chat", chatId }`
- 飞书用户：`target = { type: "feishu_user", openId }`
- Legacy 会话目标仅用于读取或维护旧任务；不要为新任务编造 `conversationId`。
```

3. Add an explicit prohibition:

```md
- 不要猜测、编造或依赖当前 `conversationId` 来创建后台任务。
```

**Impact analysis:**

- 这是 agent 行为修正的关键，不改这里，模型还会被提示词带回旧坑。
- 只改技能文档，不影响运行时 API 兼容。

---

## Task 4: Normalize Legacy Conversation Target At API Boundary

**Files:**
- Modify: `src/routes/conn-route-parsers.ts`
- Test: `test/conn-route-parsers.test.ts` if present, otherwise add focused parser assertions to the nearest route/parser test

**Implementation choice:**

Recommended conservative path:

- Continue parsing `target.type === "conversation"` if `conversationId` is provided.
- Do not validate whether the conversation exists.
- Do not use `conversationId` to gate run creation or worker execution.

Optional hardening:

- Add a small helper `isLegacyConversationTarget()` only if needed by tests or presenters.

**Expected behavior:**

- `target` omitted on create still resolves to `task_inbox` through existing `resolveDefaultTarget`.
- Invalid `conversation` target remains invalid if `conversationId` is empty, preserving existing API hygiene.

**Impact analysis:**

- Avoids destructive migration.
- Keeps old clients from breaking.
- Prevents a deleted front-end conversation from becoming a backend execution prerequisite.

---

## Task 5: Decouple Conn Editor Asset Upload From Current Conversation

**Files:**
- Modify: `src/ui/playground-conn-activity-controller.ts`
- Read: `src/ui/playground-assets-controller.ts`
- Read: `src/agent/asset-store.ts`

**Current issue:**

`handleConnEditorAssetUpload()` calls:

```js
uploadFilesAsAssets(selectedFiles, {
	conversationId: state.conversationId,
});
```

If `state.conversationId` is empty, deleted, stale, or unrelated, conn asset indexing inherits a fragile foreground chat identity.

**Implementation:**

Use a stable internal conversation-like namespace for conn assets:

```js
const connAssetConversationId =
	state.connEditorMode === "edit" && state.connEditorConnId
		? "conn:" + state.connEditorConnId
		: "conn:draft";

const assets = await uploadFilesAsAssets(selectedFiles, {
	conversationId: connAssetConversationId,
});
```

If `asset-store` has stricter assumptions, keep the string format simple and non-empty. Do not introduce schema migration.

**Impact analysis:**

- Newly uploaded conn assets no longer disappear or become semantically tied to whatever chat happened to be open.
- Existing assets remain readable because `assetRefs` are global IDs.
- Asset library filtering by conversation may no longer naturally show these in the current chat, which is acceptable for conn editor uploads. Conn selected assets are tracked by `assetRefs`.

---

## Task 6: Ensure Notifications Stay Global

**Files:**
- Read/possibly modify: `src/workers/conn-worker.ts`
- Test: `test/conn-worker.test.ts` or nearest worker/activity test

**Checks:**

1. Confirm `toAgentActivityInput()` still does not include `conversationId`.
2. Add or update a test that delivers a conn run result for `target: { type: "task_inbox" }` and asserts activity has no `conversationId`.
3. Confirm `toNotificationBroadcastEvent()` omits `conversationId` when absent.

**Expected behavior:**

- Global notification stream still receives conn result.
- Task inbox still lists conn result.
- No frontend route has to open or restore a deleted conversation.

---

## Task 7: Update Documentation And Change Log

**Files:**
- Modify: `docs/runtime-assets-conn-feishu.md`
- Modify: `docs/playground-current.md`
- Modify: `docs/change-log.md`

**Documentation updates:**

1. State that conn default delivery target is task inbox / global notifications.
2. State that foreground conversation IDs are legacy metadata only and not execution dependencies.
3. State that deleting a chat conversation does not delete or disable conn definitions/runs.
4. Mention conn editor uploaded files use stable conn asset ownership and durable `assetRefs`.

**Change log entry:**

Include:

- Date: `2026-05-05`
- Topic: conn worker conversation decoupling
- Impact: conn tool defaults, skill guidance, asset ownership, notification behavior
- Entries: `.pi/extensions/conn/index.ts`, `.pi/skills/conn-orchestrator/SKILL.md`, `src/ui/playground-conn-activity-controller.ts`, tests, docs

---

## Task 8: Regression Tests

**Commands:**

```powershell
npm test
```

If frontend visual behavior changed:

```powershell
npm run design:lint
```

If conn/browser execution paths were touched beyond schema and UI upload ownership:

```powershell
npm run docker:chrome:check
```

**Required manual/API checks after implementation:**

1. Create conn through tool without `target`; verify stored target is `task_inbox`.
2. Create conn through Playground UI; verify target summary says task messages.
3. Delete an unrelated conversation; trigger `POST /v1/conns/:connId/run`; verify run is created.
4. Let worker process the run; verify task inbox / notification receives result without needing that conversation.
5. Edit an existing legacy `conversation` target conn; verify it remains visible and does not block execution.

---

## Rollback Plan

- Revert `.pi/extensions/conn/index.ts` and `.pi/skills/conn-orchestrator/SKILL.md` if agent task creation unexpectedly breaks.
- Keep parser compatibility changes unless they caused a concrete regression; they are intentionally backward-compatible.
- Conn data migration is not required, so rollback does not need database surgery.

## Approval Gate

Do not execute this plan until the user confirms. Suggested execution phrase:

```text
批准执行 2026-05-05-conn-worker-conversation-decoupling
```

