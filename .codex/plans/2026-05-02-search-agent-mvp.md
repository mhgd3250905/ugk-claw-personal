# Search Agent MVP Implementation Plan

> 执行前提：本计划只定义第一版 `search` agent 样板。用户确认后才能开始改源码。

**目标：** 在现有 `ugk-pi` 单进程内做出第一个可切换、会话隔离、技能隔离的 `search` agent。

**架构：** 保持同一个 `ugk-pi` Fastify 服务和同一份 `@mariozechner/pi-coding-agent` 依赖，但为不同 `agentId` 创建不同的 `AgentService`、`ConversationStore`、`sessionDir`、`agentDir`、`runtimeAgentRulesPath` 和 `allowedSkillPaths`。第一版只内置 `main` 与 `search`，不做动态创建接口。

**技术栈：** TypeScript、Fastify、`@mariozechner/pi-coding-agent`、Node test runner、现有 playground 内联 UI。

---

## 核心边界

- `main` 保持现有默认行为，不能因为新增 `search` 破坏历史会话、session、skills 和 playground 当前体验。
- `search` 是一个“幼年版 agent”：有自己的基础规则、自己的会话、自己的 session、自己的 workspace、自己的技能目录。
- 第一版不做权限矩阵，不限制 `search` 未来能安装什么技能；但必须限制它只能看到自己启用的技能。
- 技能可见性必须由当前 agent 的 `allowedSkillPaths` 决定，不能让 `search` 因为项目里存在 `.pi/skills` 或 `runtime/skills-user` 就看到主 agent 全量技能。
- `GET /v1/debug/skills` 或新 debug 入口必须能按当前 / 指定 `agentId` 返回对应 agent 的技能清单。
- playground 切换到 `search` 后，会话列表、当前会话、发送消息、查看技能都必须走 `search`。
- 共享文件资产可以先沿用现有全局资产库；本阶段不要求资产按 agent 拆库，但后续可给资产补 `sourceAgentId`。

---

## 建议目录模型

第一版尽量少迁移旧数据：

```text
.data/agent/
  sessions/
  conversation-index.json

.data/agents/
  search/
    sessions/
    conversation-index.json
    workspace/
    AGENTS.md
    skills/
```

解释：

- `main` 继续使用现有 `.data/agent/*`，降低破坏面。
- `search` 使用 `.data/agents/search/*`。
- `search/skills/` 第一版可以放少量引用 / 复制来的技能；真正实现时再决定复制 `SKILL.md` 目录还是用 enabled skill path 映射。

---

## Task 1: 定义 Agent Profile 模型与内置 registry

**Files:**
- Create: `src/agent/agent-profile.ts`
- Test: `test/agent-profile.test.ts`

**要点：**

- 定义 `AgentProfile`：

```ts
export interface AgentProfile {
  agentId: string;
  name: string;
  description: string;
  dataDir: string;
  sessionsDir: string;
  conversationIndexPath: string;
  agentDir: string;
  runtimeAgentRulesPath: string;
  workspaceDir: string;
  allowedSkillPaths: string[];
}
```

- 提供 `createDefaultAgentProfiles(projectRoot)`：
  - `main` 指向现有 `.data/agent` 与现有 `.pi/skills`、`runtime/skills-user`。
  - `search` 指向 `.data/agents/search`，`allowedSkillPaths` 只包含 `.data/agents/search/pi/skills` 与 `.data/agents/search/user-skills`。
- 提供 `resolveAgentProfile(agentId)`，非法或未知 agentId 返回 `undefined` 或受控错误。

**验收：**

```bash
npm test -- test/agent-profile.test.ts
```

预期：

- `main` profile 不改变现有路径。
- `search` profile 的 `sessionsDir`、`conversationIndexPath`、`agentDir`、`runtimeAgentRulesPath`、`allowedSkillPaths` 都与 `main` 不同。
- `search.allowedSkillPaths` 不包含 `.pi/skills` 和 `runtime/skills-user`。

---

## Task 2: 让 server 按 agent profile 创建 AgentService

**Files:**
- Modify: `src/server.ts`
- Modify: `src/agent/agent-session-factory.ts` if needed
- Test: `test/server-agent-profile.test.ts`

**要点：**

- 新增一个轻量 `AgentServiceRegistry` 或等价 helper，按 `agentId` 缓存 / 返回对应 `AgentService`。
- `main` 的 `AgentService` 继续使用现有配置。
- `search` 的 `AgentService` 使用：
  - `ConversationStore(search.conversationIndexPath)`
  - `createDefaultAgentSessionFactory({ projectRoot, sessionDir: search.sessionsDir, agentDir: search.agentDir, allowedSkillPaths: search.allowedSkillPaths, runtimeAgentRulesPath: search.runtimeAgentRulesPath })`
  - 共享现有 `assetStore`
- 第一版不把 `AgentService` 改成内部多 agent；外层 registry 管多个 service，降低侵入。

**验收：**

```bash
npm test -- test/server-agent-profile.test.ts
```

预期：

- 请求 `main` 与 `search` 时命中不同 service。
- `search` 创建会话不会写入 `main` conversation index。
- `search` debug skills 不会调用 main session factory。

---

## Task 3: Chat API 增加 agentId 路由参数

**Files:**
- Modify: `src/routes/chat.ts`
- Modify: `src/routes/chat-route-parsers.ts`
- Modify: `src/types/api.ts`
- Test: `test/chat-agent-routes.test.ts`

**建议接口：**

优先新增 agent-scoped 路由，保留旧路由兼容 `main`：

```text
GET  /v1/agents
GET  /v1/agents/:agentId/debug/skills
GET  /v1/agents/:agentId/chat/conversations
POST /v1/agents/:agentId/chat/conversations
POST /v1/agents/:agentId/chat/current
GET  /v1/agents/:agentId/chat/state
GET  /v1/agents/:agentId/chat/status
GET  /v1/agents/:agentId/chat/history
GET  /v1/agents/:agentId/chat/events
POST /v1/agents/:agentId/chat/stream
POST /v1/agents/:agentId/chat/queue
POST /v1/agents/:agentId/chat/interrupt
```

旧接口：

```text
/v1/chat/*
/v1/debug/skills
```

继续指向 `main`，避免现有 Feishu / 测试 / UI 一次性全断。

**验收：**

```bash
npm test -- test/chat-agent-routes.test.ts
```

预期：

- `GET /v1/debug/skills` 返回 main skills。
- `GET /v1/agents/search/debug/skills` 只返回 search skills。
- 未知 `agentId` 返回 `404` 或 `400`，不能 fallback 到 main。
- `POST /v1/agents/search/chat/conversations` 只影响 search catalog。

---

## Task 4: 初始化 search agent 基础目录与 AGENTS.md

**Files:**
- Create: `.data/agents/search/AGENTS.md` at runtime, not committed if `.data` ignored
- Possibly Create: `src/agent/agent-profile-bootstrap.ts`
- Test: `test/agent-profile-bootstrap.test.ts`

**要点：**

- 启动时或首次解析 `search` profile 时，确保这些目录存在：

```text
.data/agents/search/
.data/agents/search/sessions/
.data/agents/search/workspace/
.data/agents/search/pi/skills/
.data/agents/search/user-skills/
```

- 如果 `.data/agents/search/AGENTS.md` 不存在，写入基础规则：

```text
# Search Agent

你是搜索 Agent。
默认使用简体中文回复。
你的主要用途是搜索、查证、整理资料。
当用户询问你有哪些技能时，只基于当前 runtime 提供的技能清单回答。
```

- 不要提交 `.data/agents/search/AGENTS.md`，它是运行态。
- 如果需要仓库内模板，放到 `src/agent` 常量或 `.pi/agent-templates/search/AGENTS.md`，但第一版可用代码常量，少造目录。

**验收：**

```bash
npm test -- test/agent-profile-bootstrap.test.ts
```

预期：

- 缺目录时能创建。
- 已存在 AGENTS.md 时不覆盖用户修改。
- `runtimeAgentRulesPath` 指向 search 自己的 AGENTS.md。

---

## Task 5: 安装 / 启用 search agent 的首批技能

**Files:**
- Decide during implementation after inspecting available project skills
- Test: `test/search-agent-skills.test.ts`

**要点：**

- 第一版不要把 `.pi/skills` 整目录加入 `search.allowedSkillPaths`。
- 子 agent 也采用系统技能与用户技能分层：系统技能放 `.data/agents/search/pi/skills/`，用户技能放 `.data/agents/search/user-skills/`。
- 第一版默认在系统技能目录写入最小 `agent-skill-ops`，用于让子 agent 知道只按自己的真实 debug skills 清单回答技能问题。
- 如果当前仓库没有明确搜索 skill，就先保留空 skills，重点验证隔离机制。别为了演示效果把主技能全放进去，那个叫自己拆自己台。

**验收：**

```bash
npm test -- test/search-agent-skills.test.ts
```

预期：

- `search` 只列出安装到 `.data/agents/search/pi/skills` 与 `.data/agents/search/user-skills` 的技能。
- `main` skills 不受影响。
- `search` 未安装的 main skill 不出现在 debug skills。

---

## Task 6: Playground 接入 agent 切换

**Files:**
- Modify: `src/ui/playground.ts`
- Modify: `src/ui/playground-page-shell.ts`
- Modify: `src/ui/playground-styles.ts`
- Modify: likely `src/ui/playground-conversation-api-controller.ts`
- Modify: likely `src/ui/playground-conversations-controller.ts`
- Test: `test/server.test.ts` or new `test/playground-agent-switch.test.ts`
- Docs: `docs/playground-current.md`

**要点：**

- UI 显示当前 agent：默认 `main`。
- 增加轻量 agent selector，第一版只列 `main` / `search`。
- 前端 state 增加 `agentId`。
- 所有 chat/conversation/debug skills 请求按当前 `agentId` 使用 `/v1/agents/:agentId/...`。
- 切换 agent 后：
  - 清当前 transcript shell。
  - 拉取目标 agent 的 conversations。
  - 拉取目标 agent 当前 conversation state。
  - 保持 assets/file library 共享。
- 旧 `/v1/chat/*` 逻辑保留给 main fallback，但 playground 应使用新 agent-scoped API。

**验收：**

```bash
npm test -- test/server.test.ts
npm run design:lint
```

前端人工验收：

- 打开 `http://127.0.0.1:3000/playground`。
- 默认看到 `main`。
- 切到 `search` 后，会话列表与主 agent 不同。
- search 新建会话不污染 main。
- search 查看技能只显示 search skills。

---

## Task 7: 文档与变更记录

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md` if public behavior changes
- Modify: `docs/traceability-map.md`
- Modify: `docs/playground-current.md`
- Modify: `docs/change-log.md`

**要点：**

- 明确当前模型从“单例 agent”演进为“单进程多 agent profile”。
- 说明第一版只有 `main` 和 `search`。
- 说明 `main` 旧接口兼容，agent-scoped API 是新接口。
- 说明技能隔离硬边界：`allowedSkillPaths` 按 agent profile 生效。
- `docs/change-log.md` 必须追加日期、主题、影响范围、入口。

**验收：**

```bash
npm test
```

预期全部通过。

---

## 最终验收清单

- `main` 旧行为保持兼容。
- `search` 有独立 conversation index。
- `search` 有独立 session dir。
- `search` 有独立 runtime AGENTS.md。
- `search` 有独立 workspace。
- `search` 技能清单不包含 main-only skills。
- `/v1/agents/search/debug/skills` 不会 fallback 到 main。
- playground 能切换当前 agent。
- 切换 agent 后，会话列表和当前会话随 agent 切换。
- 标准测试通过：`npm test`。
- 视觉或 playground 改动后通过：`npm run design:lint`。

---

## 暂不做

- 不做动态创建 agent。
- 不做主 agent 的 create-agent 技能。
- 不做权限矩阵。
- 不做独立容器或 worktree。
- 不迁移 main 的现有 `.data/agent`。
- 不把 assets 拆成 agent 私有库。

这些放到第二阶段，等 `search` 样板验证稳定后，再抽象创建接口。
