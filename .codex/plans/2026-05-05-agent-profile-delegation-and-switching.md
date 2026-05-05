# Agent Profile Delegation And Switching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** 让主 Agent 能可靠处理“切换到某个 agent profile”和“让某个 agent 干活”两类请求，同时兼容 legacy subagent 和用户创建的 agent profile，避免把两者互相否定，也避免前端自然语言关键词匹配。

**Architecture:** 保持 `agent profile` 和 legacy `subagent` 的运行模型分离，但在用户意图层提供统一派发兼容层。切换当前 Playground 视窗走显式 UI 操作接口；“让某个 agent 干活”走统一 dispatcher：优先匹配 agent profile 并调用 scoped chat API，未命中 profile 时再兼容 legacy subagent。前端不做多语言自然语言匹配，主 Agent 在理解用户意图后调用明确接口或脚本。

**Tech Stack:** Fastify routes, `AgentServiceRegistry`, scoped `/v1/agents/:agentId/chat/*` APIs, project skill `.pi/skills/agent-profile-ops`, Node.js tests.

---

## Root Cause

当前失败不是“知乎 / 搜索引擎 agent 不存在”，而是产品语义混乱：

- `agent profile` 是 Playground 的独立操作视窗，入口是 `GET /v1/agents` 和 `/v1/agents/:agentId/chat/*`。
- legacy `subagent` 是 `.pi/agents/` 里的内部派发工人，只包含 `planner/reviewer/scout/worker` 等，不等于用户创建的 agent profile，但用户口语里都会叫 “agent”，所以必须在派发层兼容两者。
- 主 Agent 看到“让 search-engine 搜 medtrum”时，没有一条明确技能路径告诉它调用 `/v1/agents/search-engine/chat`，于是误走 subagent 语义。
- “切换到某 agent”如果靠前端文本匹配，会遇到多国语言、别名、误触发和上下文歧义，属于错误方向。

## Product Semantics

### A. 切换当前操作视窗

用户意图示例：

- “帮我切换到知乎 agent”
- “切到 search-engine”
- “把当前窗口换成搜索引擎 agent”

目标行为：

- 先确认目标 agent 存在。
- 如果当前 Playground 页面暴露 `window.ugkPlaygroundAgentOps.switchAgent(agentId)`，调用它。
- 如果当前 agent 正在运行，由 `switchAgent()` 原有保护拒绝，不能绕过。
- 不发送聊天消息给目标 agent。

### B. 让某个 agent 干活，统一派发

用户意图示例：

- “让搜索引擎 agent 搜 medtrum”
- “让知乎 agent 看一下热榜”
- “用 search-engine 查一下 SearXNG 最新情况”
- “让 scout 看一下这个文件”

目标行为：

- 先通过统一 dispatcher 解析目标。
- 解析顺序：
  1. `GET /v1/agents` 中的 agent profile，支持 `agentId`、`name` 和显式 alias。
  2. legacy subagent 注册表，保持 `planner/reviewer/scout/worker` 等旧行为。
- 命中 agent profile：调用后端 scoped chat：`POST /v1/agents/:agentId/chat`。
- 命中 legacy subagent：继续走现有 subagent 派发能力。
- 两边都没命中：列出可用 agent profile 和 legacy subagent，要求用户明确目标。
- 主 Agent 将目标结果转述给用户，并标明执行目标类型，例如“由 agent profile `search-engine` 执行”或“由 legacy subagent `scout` 执行”。
- 不再回答“search-engine 不是 subagent，所以不能派发”。它不是 legacy subagent，但可以作为 agent profile 被派发。

## Non-Goals

- 不做前端自然语言关键词拦截。
- 不把用户创建的 agent profile 加入 `.pi/agents/` legacy subagent 系统。
- 不删除或破坏 legacy subagent 调用方式。
- 不让主 Agent 继承目标 agent 的技能。
- 不手写 `.data/agents/profiles.json`。
- 不绕过运行中保护强制切换当前视窗。

## Task 0: Clean Up Current Dirty Worktree

**Files:**
- Review: `git status --short`
- Review: `.pi/settings.json`
- Review: `src/ui/playground-stream-controller.ts`
- Review: `test/server.test.ts`
- Review: `docs/change-log.md`

**Steps:**

1. Confirm whether `.pi/settings.json` was modified by the user. If unrelated, do not stage it.
2. Ensure no natural-language switching parser remains:
   - `parseNaturalAgentSwitchCommand`
   - `normalizeAgentSwitchText`
   - regex such as `切换|切到|进入`
3. Keep the `EXDEV` archive fix if already present and tested.
4. Keep or re-add only the explicit UI operation API:
   - `window.ugkPlaygroundAgentOps.switchAgent`
   - `window.ugkPlaygroundAgentOps.listAgents`
   - `window.ugkPlaygroundAgentOps.getCurrentAgentId`

**Verification:**

Run:

```bash
Select-String -Path src\ui\*.ts,test\*.ts,docs\*.md,.pi\skills\agent-profile-ops\SKILL.md -Pattern "parseNaturalAgentSwitchCommand|normalizeAgentSwitchText|切换\\|切到\\|进入"
```

Expected: no production parser references; tests may only contain `doesNotMatch` safeguards.

## Task 1: Add A Unified Agent Dispatch Script

**Files:**
- Create: `.pi/skills/agent-profile-ops/scripts/agent_profile_ops.mjs`
- Modify: `.pi/skills/agent-profile-ops/SKILL.md`
- Test: `test/agent-profile-ops-skill.test.ts`

**Design:**

The script should expose deterministic commands:

```bash
node .pi/skills/agent-profile-ops/scripts/agent_profile_ops.mjs list
node .pi/skills/agent-profile-ops/scripts/agent_profile_ops.mjs dispatch --agent search-engine --message "搜索 medtrum"
node .pi/skills/agent-profile-ops/scripts/agent_profile_ops.mjs dispatch --agent scout --message "检查这个实现"
node .pi/skills/agent-profile-ops/scripts/agent_profile_ops.mjs current
```

`list` output must include two sections:

```json
{
  "agentProfiles": [
    { "agentId": "search-engine", "name": "搜索引擎", "type": "agent-profile" }
  ],
  "legacySubagents": [
    { "agentId": "scout", "name": "scout", "type": "legacy-subagent" }
  ]
}
```

`dispatch` resolution rules:

1. Match `--agent` against agent profile `agentId`.
2. Match `--agent` against normalized agent profile `name` / configured aliases.
3. Match `--agent` against legacy subagent id.
4. If multiple targets match, fail with an ambiguity error and list candidates.
5. If no target matches, fail with available agent profiles and legacy subagents.

When resolved as `agent-profile`, `dispatch` should call:

```http
POST /v1/agents/:agentId/chat
```

Payload:

```json
{
  "conversationId": "delegation:main:search-engine:<timestamp>",
  "message": "搜索 medtrum",
  "userId": "agent-profile-ops"
}
```

When resolved as `legacy-subagent`, `dispatch` should call the existing legacy subagent mechanism. If there is no stable programmatic legacy subagent API available in this repository, the first implementation must return a clear unsupported result for legacy targets while preserving the target resolution contract; do not pretend the legacy target ran.

Base URL resolution:

1. `UGK_INTERNAL_BASE_URL`
2. `PUBLIC_BASE_URL`
3. `http://127.0.0.1:${PORT || 3000}`

**Error Handling:**

- Unknown agent: print a clear list of available agents.
- Ambiguous agent: print candidate profile/subagent matches.
- Target run already busy: return the backend error as-is.
- Network failure: state that the scoped agent API is unavailable.
- Empty message: fail before calling backend.

**Tests:**

Add doc/script tests that assert:

- Skill mentions `dispatch`.
- Skill explicitly says dispatch is compatible with both agent profiles and legacy subagents.
- Script dry-run or help output documents `POST /v1/agents/:agentId/chat`.
- Script docs say agent profile matches take precedence over legacy subagents when ids collide.

## Task 2: Update agent-profile-ops Skill Behavior For Compatibility

**Files:**
- Modify: `.pi/skills/agent-profile-ops/SKILL.md`
- Test: `test/agent-profile-ops-skill.test.ts`

**Required Skill Wording:**

Add a section:

```markdown
## 代办任务：兼容 agent profile 和 legacy subagent

当用户说“让某个 agent 帮我做 X”时：
1. 调脚本 `list`，同时查看 agent profiles 和 legacy subagents。
2. 调脚本 `dispatch --agent <agentId-or-name> --message <task>`。
3. 如果命中 agent profile，脚本走 `/v1/agents/:agentId/chat`。
4. 如果命中 legacy subagent，脚本走 legacy subagent 机制。
5. 把结果回传用户，并说明由哪类目标执行。
```

Update common mistakes:

- “不要把 agent profile 说成 subagent。”
- “不要说 search-engine 不能被派发；它不能作为 legacy subagent，但可以通过统一 dispatch 作为 agent profile 代办任务。”
- “不要说只能派发 planner/reviewer/scout/worker；这些只是 legacy subagent，不是全部可派发目标。”
- “不要回答‘我无法切换’后停止；如果用户要切换视窗，调用 UI 操作接口；如果用户要代办任务，调用 scoped chat API。”

## Task 3: Add Server-Side Unified Dispatch API If Needed

**Files:**
- Modify: `src/routes/chat.ts`
- Test: `test/server.test.ts`

**Decision Gate:**

Only add this if skill script directly resolving both agent profiles and legacy subagents proves awkward.

Optional endpoint:

```http
POST /v1/agent-dispatch
```

Payload:

```json
{
  "agent": "search-engine",
  "message": "搜索 medtrum",
  "sourceAgentId": "main"
}
```

Response:

```json
{
  "targetType": "agent-profile",
  "targetId": "search-engine",
  "targetName": "搜索引擎",
  "conversationId": "delegation:main:search-engine:...",
  "message": "..."
}
```

This endpoint is sugar only. For `agent-profile`, it must call the same scoped `AgentService.chat()` path. For `legacy-subagent`, it must call the existing subagent path if one is stable; otherwise return `501 legacy subagent dispatch is not available through this endpoint yet`. It must not silently degrade or pretend work ran.

Compatibility requirements:

- Existing `/v1/agents/:agentId/chat` remains unchanged.
- Existing legacy subagent commands remain unchanged.
- New dispatch API is additive.
- If an id exists in both profiles and legacy subagents, profile wins unless the request includes `targetType: "legacy-subagent"`.

## Task 4: Keep Explicit UI Switching API

**Files:**
- Modify: `src/ui/playground.ts`
- Test: `test/server.test.ts`

**Implementation:**

Expose:

```js
window.ugkPlaygroundAgentOps = Object.freeze({
  listAgents: () => [...state.agentCatalog],
  getCurrentAgentId,
  switchAgent,
});
```

**Test Requirements:**

- HTML contains `window.ugkPlaygroundAgentOps`.
- HTML contains `switchAgent`.
- HTML does not contain natural-language parser names.

## Task 5: Keep EXDEV Archive Fix

**Files:**
- Modify: `src/agent/agent-profile-catalog.ts`
- Test: `test/agent-profile-catalog.test.ts`

**Implementation:**

Keep `rename` as fast path. On `EXDEV`, fall back to:

1. `cp(sourceDir, targetDir, { recursive: true, force: false, errorOnExist: true })`
2. `rm(sourceDir, { recursive: true, force: true })`

**Test:**

Simulate `rename` throwing `EXDEV` and assert target file exists and source dir is gone.

## Task 6: Documentation

**Files:**
- Modify: `docs/change-log.md`
- Optionally modify: `AGENTS.md`

**Required Record:**

- Date: `2026-05-05`
- Theme: Agent profile archive EXDEV fix and explicit agent profile delegation/switching.
- Impact: profile archive cross-device fallback; explicit UI switching API; unified dispatch compatibility for agent profiles and legacy subagents; no natural-language frontend matching; no legacy subagent confusion.

## Verification

Run:

```bash
node --test --import tsx test\agent-profile-catalog.test.ts test\agent-profile-ops-skill.test.ts test\server.test.ts
npx tsc --noEmit
npm test
```

Expected:

- All targeted tests pass.
- Full suite passes.
- No natural-language switching parser exists in production code.
- Dispatch list shows both agent profiles and legacy subagents.
- Dispatch to `search-engine` resolves as `agent-profile`.
- Dispatch to `scout` preserves legacy subagent compatibility or returns an explicit unsupported status if no stable programmatic legacy API exists yet.

## Deployment

Because this affects production Agent deletion and Playground behavior:

1. Commit locally.
2. Push both remotes:

```bash
git push origin main
git push gitee main
```

3. Before Aliyun deploy, back up shared runtime:

```text
/root/ugk-claw-shared/.data/agents
/root/ugk-claw-shared/.data/agent
/root/ugk-claw-shared/runtime/skills-user
```

4. Run:

```bash
npm run server:ops -- tencent preflight
npm run server:ops -- aliyun preflight
npm run server:ops -- tencent deploy
npm run server:ops -- aliyun deploy
npm run server:ops -- tencent verify
npm run server:ops -- aliyun verify
```

5. Production smoke tests:

- Archive a non-running test agent on Aliyun; no `EXDEV`.
- Ask main Agent: “让搜索引擎 agent 搜 medtrum”; it should call unified dispatch and resolve to agent profile.
- Ask main Agent: “让 scout 看一下这个文件”; it should preserve legacy subagent behavior or report explicit legacy dispatch unsupported, not confuse this with agent profile.
- Ask main Agent: “切换到知乎 agent”; it should use explicit UI switch when available, not tell user to manually click settings.
