# 架构治理审计（2026-05-06）

这份文档执行 `.codex/plans/2026-05-06-architecture-analysis-and-optimization-plan.md` 的批次 A：只读架构审计。目标是建立当前架构地图、legacy 决策表、高风险调用链和候选优化 backlog。

本轮没有修改源码。当前阶段不要把“文件大”直接等同于“架构差”。这个项目已经做过一轮拆分，后续要按真实风险治理，不要靠行数焦虑开刀。

## 1. 当前基线

### 1.1 运行与入口

- 服务装配入口：`src/server.ts`
- 本地 Playground：`http://127.0.0.1:3000/playground`
- 健康检查：`http://127.0.0.1:3000/healthz`
- 默认本地运行：`docker compose up -d`
- 标准验证：
  - `git diff --check`
  - `npx tsc --noEmit`
  - `npm test`
  - 涉及浏览器链路时加 `npm run docker:chrome:check`

### 1.2 当前未跟踪现场

以下文件是本地 runtime / 临时现场，不纳入本轮治理提交：

- `runtime/dangyang-weather-2026-05-01.json`
- `runtime/karpathy-guidelines-CLAUDE.md`
- `runtime/tab-accumulation-report.md`

### 1.3 主要模块规模

当前文件规模最大的区域集中在 `src/ui`：

| 文件 | 角色 | 审计判断 |
| --- | --- | --- |
| `src/ui/playground-styles.ts` | Playground 主样式与局部 workspace 样式聚合 | 大，但不能按行数硬拆；后续应先标注 token / 主题 / 组件覆盖边界 |
| `src/ui/playground-conn-activity-controller.ts` | 后台任务管理器、编辑器、run detail 前端控制器 | 高维护压力；适合先做测试和职责地图，不适合直接拆 |
| `src/ui/playground-agent-manager.ts` | Agent 操作台 HTML / 样式 / 控制逻辑 | 与 agent profile API 强耦合；后续改动必须带 API 兼容检查 |
| `src/ui/playground-transcript-renderer.ts` | transcript、markdown hydration、消息动作 | 用户可见风险高；只做有测试压住的小步调整 |
| `src/ui/playground.ts` | Playground 运行时 assembler | 负责拼装各 controller，不应继续塞业务细节 |
| `src/routes/chat.ts` | main 与 scoped agent 聊天 API | 有重复 wrapper，但属于兼容主路由；先观察，不急着抽象 |
| `src/workers/conn-worker.ts` | conn 调度、执行、activity、通知、Feishu 镜像 | 后台链路核心；只能做带验收的小步治理 |
| `src/agent/agent-service.ts` | 前台 Agent run 生命周期编排 | 保留 active/terminal run 状态所有权，禁止强拆主生命周期 |

## 2. 架构地图

### 2.1 服务装配层

`src/server.ts` 是组合根：

- 创建 `AssetStore`
- 创建 `ConnDatabase`
- 创建 `AgentServiceRegistry`
- 创建 main `AgentService`
- 创建 `ConnSqliteStore` / `ConnRunStore` / `AgentActivityStore`
- 注册路由：
  - assets / files / static
  - playground
  - activity
  - chat
  - runtime debug / cleanup debug
  - model config
  - notifications
  - Feishu settings
  - conns

治理建议：`server.ts` 当前职责合理，暂不拆。它是依赖装配层，不应塞业务逻辑；后续只在新模块引入时保持薄注册。

### 2.2 Chat / Agent 主链路

主链路：

1. `src/routes/chat.ts` 解析 HTTP 请求。
2. `src/routes/chat-route-parsers.ts` 做输入解析。
3. `src/routes/chat-sse.ts` 负责 SSE 响应。
4. `src/agent/agent-service.ts` 管理 conversation、active run、terminal run。
5. `src/agent/agent-session-factory.ts` 创建 pi-coding-agent session。
6. `src/agent/agent-session-event-adapter.ts` 把原始 session event 转为 `ChatStreamEvent`。
7. `src/agent/agent-run-result.ts` 收口最终文本、文件、`send_file` 和本地路径改写。
8. `src/agent/agent-conversation-state.ts` 构建 canonical state。

高风险状态：

- `activeRuns`
- `terminalRuns`
- conversation current pointer
- `browserCleanupScope`
- queued `steer` / `followUp`
- `send_file` 文件合并
- `/app` / `file:///app` 用户可见路径改写

治理建议：保留 `AgentService.runChat()` 的主生命周期连续性。它长，但它串的是同一个 run 的创建、执行、事件、持久化和清理。强拆会让控制流更绕，不是优化，是把麻烦分摊给读代码的人。

### 2.3 Scoped Agent Profile 链路

运行时事实：

- `/v1/agents` 是当前 agent profile 注册列表真源。
- `main` 继续兼容 `/v1/chat/*`。
- 其他 agent profile 走 `/v1/agents/:agentId/chat/*`。
- `.data/agents/profiles.json` 只是用户创建记录，不是完整运行时注册表。
- 创建、编辑、归档、技能变更必须走 API，不手写 JSON。

`src/routes/chat.ts` 当前同时注册 main 和 scoped agent 路由，存在 wrapper 重复，但这是兼容成本。后续如果要收口，只能抽薄 adapter，不能改外部路由语义。

### 2.4 Playground UI 链路

Playground 真源仍在 `src/ui/`：

1. `src/routes/playground.ts` 决定内联渲染或 externalized runtime。
2. `src/ui/playground.ts` 拼装 script、style、dialog 和 shell。
3. `src/ui/playground-page-shell.ts` 输出页面骨架。
4. `src/ui/playground-styles.ts` 聚合主样式、资产样式、任务消息样式、主题样式。
5. 各 controller 通过字符串注入浏览器运行时。

当前主要 controller：

- workspace：`playground-workspace-controller.ts`
- conversation API：`playground-conversation-api-controller.ts`
- conversation sync：`playground-conversation-sync-controller.ts`
- conversation state：`playground-conversation-state-controller.ts`
- transcript：`playground-transcript-renderer.ts`
- stream：`playground-stream-controller.ts`
- assets：`playground-assets-controller.ts`
- task inbox：`playground-task-inbox.ts`
- conn manager：`playground-conn-activity-controller.ts`
- agent manager：`playground-agent-manager.ts`
- theme：`playground-theme-controller.ts`

治理建议：后续优先治理“边界说明”和“测试分组”，不要先拆样式。`playground-styles.ts` 大，但其中包含暗色、浅色、移动端、workspace、外部模块样式拼装，盲拆很容易造成覆盖顺序变化。

### 2.5 Conn / Activity / Output 链路

后台任务主链路：

1. `POST /v1/conns` 创建 conn，默认 target 是 `task_inbox`。
2. `ConnWorker` 领取 due run。
3. `BackgroundAgentRunner` 创建后台 workspace 并运行 agent。
4. run 结果写入 `conn_runs`、`conn_run_events`、`conn_run_files`。
5. 终态结果写入 `agent_activity_items`。
6. 前端任务消息页读取 `/v1/activity`。
7. 全局通知走 `/v1/notifications/stream`。
8. Feishu notification 是 activity 的镜像投递。
9. output 文件通过 `/v1/conns/:connId/runs/:runId/output/<path>` 和 `/v1/conns/:connId/output/latest/<path>` 打开。

高风险边界：

- `workspace/output/` 是唯一持久产物出口。
- `text/html` inline 行为由 `file-route-utils.ts` 控制。
- `activity.files[]` 要复用平台生成链接，不能信模型正文手写 URL。
- 软删除 conn 不硬删 run 历史。
- fallback agent 必须显式写入 resolved snapshot 和 run detail。

治理建议：这个区域刚稳定，短期以观测和文档强化为主。任何删除 legacy 的动作都必须先看 `/v1/debug/cleanup`。

### 2.6 Feishu 链路

当前 Feishu 入站已从 HTTP webhook 转成 WebSocket worker：

- `src/workers/feishu-worker.ts`
- `src/integrations/feishu/ws-subscription.ts`
- `src/integrations/feishu/http-agent-gateway.ts`
- `src/integrations/feishu/settings-store.ts`
- `src/routes/feishu-settings.ts`

治理建议：Feishu 不是当前主治理目标。保留 current mode / mapped compatibility 的事实说明，避免新文档误把 mapped conversation mode 当默认。

## 3. Legacy 决策表

| 对象 | 当前写入路径 | 当前读取路径 | 决策 | 删除条件 |
| --- | --- | --- | --- | --- |
| `ConnTarget.type = "conversation"` | 新 UI 不推荐；旧工具和 API 仍可能显式传入 | parser / store / cleanup debug 仍兼容 | 保留并标记 deprecated | `/v1/debug/cleanup` active conversation target 为 0，且确认旧 conn 可迁移或废弃 |
| `conversation_notifications` | 当前主链路无写入 | cleanup debug 对异常旧库只读统计 | 旧数据路径已删除，保留只读观测 | 已完成；不要恢复旧 store |
| `GET /v1/activity/summary` | 不写入 | 初始化 / 轻量未读数兜底 | 保留 | 如果 `/v1/activity` 和通知流完全覆盖初始化 badge，再评估 |
| Feishu `mapped` mode | 兼容配置可能仍存在 | resolver / tests 仍存在 | 保留 compatibility mode | 确认线上无 mapped 配置且有替代隔离策略 |
| legacy subagent `.pi/agents` | 旧 prompt / skill 可能引用 | agent-profile-ops dispatch 仍兼容 | 保留，但术语上和 Playground agent profile 分开 | profile dispatch 完全替代旧 scout/planner/worker/reviewer 链路 |
| Windows host IPC fallback | 新链路不写 | 本机调试 fallback | 保留 fallback | direct CDP sidecar 完全覆盖本机和生产排障需求 |
| `/playground/reset` | 重置 runtime playground 副本 | externalized runtime 使用 | 保留，但明确不是源码热加载 | 外部化机制有更明确的恢复入口后再评估 |
| `.pi/settings.json` model fallback | 运行态设置缺失时读取 | session factory / model config | 保留 fallback | 所有环境迁移到 runtime model settings 且有验证脚本 |

## 4. 高风险调用链

### 4.1 前台聊天 run

`POST /v1/chat/stream` 或 `/v1/agents/:agentId/chat/stream`
-> `parseChatMessageBody()`
-> `AgentService.streamChat()`
-> `AgentService.runChat()`
-> `createBrowserCleanupScope()`
-> `runWithScopedAgentEnvironment()`
-> session prompt
-> `createAgentSessionEventAdapter()`
-> `applyChatStreamEventToActiveRunView()`
-> `buildAgentRunResult()`
-> `buildTerminalRunSnapshot()`
-> `closeBrowserTargetsForScope()`

不能破坏：

- 同一时刻只有一个 active run。
- 刷新后可以通过 state / events 恢复。
- terminal run 可提供 run log。
- browser cleanup 失败不能覆盖原任务结果。

### 4.2 会话切换 / 删除 / 新建

`/v1/chat/conversations`
-> `ConversationStore`
-> `AgentService.createConversation/deleteConversation/switchConversation`
-> `agent-conversation-commands.ts`
-> active run 禁止切线
-> terminal run 清理

不能破坏：

- 当前有 active run 时不能切换或删除相关会话。
- 删除前台会话不影响 conn 后台任务和任务消息。
- 多 agent 的会话缓存必须按 `agentId + conversationId` 分区。

### 4.3 conn run 到任务消息

due conn
-> `ConnWorker.enqueueDueRuns()`
-> `claimNextDue()`
-> `BackgroundAgentRunner.run()`
-> output 文件索引
-> `ConnWorker.deliverRunResult()`
-> `AgentActivityStore.create()`
-> notification broadcast
-> optional Feishu activity notifier
-> `/v1/activity`
-> `playground-task-inbox.ts`

不能破坏：

- run 终态必须写入 activity。
- output 文件必须只来自 `workspace/output/`。
- activity 文件链接必须能打开平台路由。
- Feishu 投递失败只能 warn，不能影响 run 终态。

### 4.4 Playground workspace

topbar action
-> feature open function
-> `openWorkspacePanel()`
-> `setWorkspaceMode()`
-> `syncWorkspacePanelPlacement()`
-> desktop 内嵌 / mobile fixed page 分流

不能破坏：

- mobile 不是 desktop 缩略版。
- workspace 激活时 topbar 左侧按钮变成“回到会话”。
- 左侧会话切换要关闭当前 workspace。
- 各业务控制器不要私自绕过 workspace controller 改 mode。

## 5. 候选优化 backlog

### P0：先做审计和防护，不改行为

1. 补齐架构地图和 legacy 决策文档。
2. 为后续每批重构建立固定影响分析模板。
3. 梳理测试分组，让未来改动知道该跑哪些定向测试。
4. 明确 `server.test.ts` 哪些断言是集成烟测，哪些可以迁移到窄测试。

### P1：低风险治理

1. Playground workspace header 的重复结构审计，先找重复，不急着抽。
2. 浅色主题覆盖规则分层标注，避免继续出现白底白字。
3. conn output URL 生成链路复核，确认 presenter / worker / UI 没有三套口径。
4. scoped agent 与 main chat 路由重复 wrapper 审计，考虑薄 adapter。

### P2：需要更多观测后再做

1. `ConnTarget.type = "conversation"` deprecated 后续迁移。
2. Feishu mapped mode 清退。
3. legacy subagent 到 agent profile dispatch 的迁移。
4. Windows host IPC fallback 删除评估。
5. `/playground/reset` 命名或入口语义优化。

### 不建议做

1. 不建议继续拆 `AgentService.runChat()` 主生命周期。
2. 不建议按行数拆 `playground-styles.ts`。
3. 不建议删除所有 legacy / fallback。
4. 不建议把所有 `/playground` HTML/CSS 断言从 `server.test.ts` 拆空。

## 6. 下一批建议

建议进入批次 B：测试分组与风险闸门。

具体目标：

- 新增一份测试运行矩阵文档。
- 标记各业务区域的最小定向测试命令。
- 从 `server.test.ts` 里挑选少量纯 Playground 结构断言做迁移评估，但不急着迁移。

推荐原因：架构治理真正的护城河不是“多拆几个文件”，而是未来每次改动都知道跑什么测试、观察什么状态、哪里不能碰。否则项目越整理越玄学，最后只能靠祈祷上线，太原始。
