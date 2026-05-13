# 2026-05-13 全项目架构审计与优化计划

> **执行约束：** 本文是审计和计划文档，不改源码。后续任何源码清理、重构、删除 legacy 的动作，都必须由用户确认后再执行，并按本文的验证矩阵逐批提交。

## 1. 审计目标

本次审计覆盖 UGK CLAW 当前 `main` 基线，重点维度：

- 架构设计与模块边界
- 数据流向与状态所有权
- 功能模块实现质量
- 可扩展性、可读性、可维护性
- 过时功能、过时代码、冗余代码的清理策略
- 稳定性优先的分阶段优化路线

第一原则：当前版本已经是比较全面的稳定版本，不能用“大重构”的名义破坏现有行为。所有优化都必须先有事实证据、测试锚点和回滚边界。

## 2. 当前基线

### 2.1 版本与提交

- 当前 HEAD：`882126a Harden conn artifact delivery routes`
- 当前 snapshot tag：`snapshot-20260513-v4.5.0-stable`
- 最近新增主线：
  - conn artifact delivery validation
  - per-agent skill enable/disable toggle
  - per-agent default model
  - 独立 Agents 页面
  - 独立 Conn 页面增强
  - Conn unread / run 状态排序与展示

### 2.2 验证结果

已完成基线验证：

```bash
git diff --check
npx tsc --noEmit
npm test
```

结果：

- `git diff --check`：通过
- `npx tsc --noEmit`：通过
- `npm test`：720/720 通过

当前可以作为治理起点。别在一个红灯满天飞的版本上谈架构，这种事听起来很努力，实际很荒谬。

### 2.3 工作区状态

当前仍存在未跟踪运行产物和设计草稿，主要集中在：

- `.codex/plans/2026-05-12-next-agent-handoff-plan.md`
- `public/card*.png`、`public/ptt-*.html`、`public/slide*.png`、`public/reddit/`
- `runtime/*.cjs`、`runtime/*.mjs`、`runtime/*.jpg`、`runtime/snap.txt`
- `ui-design/`

这些不属于本次审计源码改动。后续提交前必须单独筛选，不得把运行产物、截图、临时脚本混进治理提交。

## 3. 架构总览

### 3.1 服务组合根

入口：`src/server.ts`

职责：

- 创建 `AssetStore`
- 创建 `ConnDatabase`
- 创建 `AgentServiceRegistry`
- 创建 main `AgentService`
- 创建 `ConnSqliteStore` / `ConnRunStore` / `AgentActivityStore`
- 创建 `NotificationHub`
- 注册 assets / files / static / playground / activity / chat / debug / model / notifications / Feishu / conns / artifacts routes

评价：

- 组合根职责基本正确，业务逻辑没有明显下沉到 `server.ts`。
- `BuildServerOptions` 对测试注入很有价值，最近 artifact route 锁库问题也说明这里的依赖注入是必要设计，不是多余抽象。
- 风险点是依赖组合条件较隐性：`options.connStore && options.connRunStore && options.activityStore` 同时满足才不创建默认 `ConnDatabase`。这条规则有测试教训，建议后续封装为命名 helper，避免新测试又漏注入一个 store。

### 3.2 Chat / Agent 数据流

主链路：

```text
HTTP client
-> src/routes/chat.ts
-> chat-route-parsers.ts / chat-sse.ts
-> AgentService.chat() / streamChat()
-> AgentService.runChat()
-> createDefaultAgentSessionFactory()
-> pi-coding-agent session
-> agent-session-event-adapter.ts
-> agent-run-events.ts / activeRuns
-> agent-run-result.ts / file-artifacts.ts
-> ConversationStore
-> GET /v1/chat/state / events / history
-> Playground transcript renderer
```

状态所有权：

- `AgentService.activeRuns`：当前运行中的前台 run。
- `AgentService.terminalRuns`：刚结束但还需要提供 run log / terminal snapshot 的 run。
- `ConversationStore`：会话目录、current pointer、metadata 和 session file。
- `AgentServiceRegistry`：agent profile 到 service 的运行时注册和缓存。

评价：

- `AgentService.runChat()` 虽长，但它串的是同一个 run 生命周期：创建、prompt、事件、结果、terminal snapshot、browser cleanup。当前不建议强拆。
- 真正该治理的是 `src/routes/chat.ts`：它同时承载 agent profile 元操作、main chat routes、scoped chat routes、browser/model/skill 修改接口。文件 1600+ 行不是最致命，致命的是 route 语义混在一起，后续加一个小接口都可能摸到 scoped/main 兼容边界。

### 3.3 Agent Profile 数据流

主链路：

```text
GET /v1/agents
POST /v1/agents
PATCH /v1/agents/:agentId
POST /v1/agents/:agentId/archive
PATCH /v1/agents/:agentId/skills/:skillName
-> agent-profile-catalog.ts
-> AgentServiceRegistry.updateProfile()
-> ensureAgentProfileRuntime()
-> scoped /v1/agents/:agentId/chat/*
```

评价：

- 运行时注册列表以 API 为准，`.data/agents/profiles.json` 只是持久 catalog，这个边界文档和测试已经压住。
- per-agent default model 和 skill toggle 已有测试，方向正确。
- 风险点是 agent profile 元操作仍在 `chat.ts`，建议中期迁移到 `src/routes/agent-profiles.ts`，但外部路由和响应结构必须保持不变。

### 3.4 Playground / 前端数据流

主链路：

```text
GET /playground
-> src/routes/playground.ts
-> renderPlaygroundPage()
-> playground-page-shell.ts
-> playground-styles.ts
-> playground.ts assembler
-> playground-* controllers
-> /v1/chat/state / events / history / activity / conns / agents / files
```

评价：

- 前端已经拆出一批 controller，方向比早期把所有东西塞进 `playground.ts` 好很多。
- 但 UI 模块现在形成了另一类债务：多个大字符串模块各自持有 API 调用、DOM 渲染、编辑器状态和错误处理。
- `playground-styles.ts` 4475 行，`playground-agent-manager.ts` 2228 行，`playground-conn-activity-controller.ts` 2210 行，`conn-page-js.ts` 1584 行，`agents-page.ts` 1496 行。不要因为行数而乱拆，但这已经是维护压力区。

### 3.5 Conn / Activity / Artifact 数据流

主链路：

```text
POST /v1/conns
-> ConnSqliteStore
-> ConnWorker
-> ConnRunStore.claimNextDue()
-> BackgroundAgentRunner
-> run workspace: input / work / output / logs / session / artifact-public
-> artifact validation / repair loop
-> ConnRunStore files/events/status
-> AgentActivityStore
-> NotificationHub
-> /v1/activity / /v1/notifications/stream
-> Feishu optional mirror
-> /v1/conns/:connId/runs/:runId/output/*
-> /v1/conns/:connId/runs/:runId/artifacts/*
```

评价：

- conn 产物从 `/app/public` 收口到 workspace output / artifact-public 是正确方向。
- 最近 artifact route 已补上 `connId -> runId` 归属校验和 workspace 边界校验，安全边界比之前合理。
- 当前要避免的不是“代码不够漂亮”，而是有人看见 legacy 字段就删除，结果旧任务、旧数据、飞书兼容和后台输出一起炸。

### 3.6 Feishu / Notification 数据流

主链路：

```text
Feishu WS worker
-> message parser / deduper
-> FeishuService
-> http-agent-gateway
-> /v1/chat/* or queue / interrupt
-> optional delivery back to Feishu
```

评价：

- Feishu 已经是外挂收发窗口，不是新的会话真源。
- `mapped` mode 仍是兼容模式，不能默认推广。
- 当前不建议作为第一批治理目标，除非生产反馈飞书链路有真实问题。

## 4. 主要问题与风险分级

### P0：稳定性边界，先守住

1. **未跟踪运行产物仍堆在仓库目录。**
   - 风险：后续提交误带截图、报告、临时脚本、设计目录。
   - 证据：`git status --short` 当前仍列出 `public/card*.png`、`runtime/*.jpg`、`ui-design/` 等。
   - 建议：先做提交前清单和 `.gitignore` 收口评估，不直接删除用户产物。

2. **独立 Conn 页面使用 CDN 资源。**
   - 文件：`src/ui/conn-page.ts`
   - 证据：页面直接引用 `https://cdn.jsdelivr.net/npm/flatpickr...` 和 `https://cdn.jsdelivr.net/npm/marked...`。
   - 风险：生产内网、弱网、CDN 被墙或供应链变化时，独立 Conn 页面时间选择和 Markdown 渲染会退化；主 Playground 已经使用本地 `/vendor/flatpickr` 和本地 marked bundle，独立页面口径不一致。
   - 建议：第一批修复，改为复用本地静态资源和 `playground-page-shell` 的 vendor 口径。

3. **`chat.ts` route 聚合过重。**
   - 文件：`src/routes/chat.ts`
   - 风险：agent profile 元操作、main chat、scoped chat、skills、browser/model 绑定全混在一个 route 注册器里。
   - 建议：先抽 agent profile routes，不碰 `AgentService.runChat()`。

### P1：高收益、低到中风险治理

1. **`BuildServerOptions` 的 conn DB 创建条件隐性。**
   - 文件：`src/server.ts`
   - 建议：抽 `resolveConnStores(options, config)` 或 `createServerStores()`，让“测试必须一起注入 connStore/connRunStore/activityStore”变成显式规则。

2. **Standalone 页面与 Playground 控制器重复。**
   - 文件：
     - `src/ui/conn-page-js.ts`
     - `src/ui/playground-conn-activity-controller.ts`
     - `src/ui/agents-page.ts`
     - `src/ui/playground-agent-manager.ts`
   - 重复形态：API fetch、toast、agent/browser/model option rendering、编辑器 payload build、run 状态判定。
   - 建议：先提取纯字符串 helper / presenter，不急着引入前端框架。

3. **CSS 主题覆盖分散。**
   - 文件：
     - `src/ui/playground-styles.ts`
     - `src/ui/playground-theme-controller.ts`
     - `src/ui/conn-page-css.ts`
     - `src/ui/agents-page.ts`
     - `src/ui/standalone-page-shared.ts`
   - 风险：浅色主题、workspace-contained、flatpickr 覆盖容易重复和互相打架。
   - 建议：优先统一 standalone theme token 和 vendor component CSS，不按行数拆主样式。

4. **测试巨石维护成本高。**
   - 文件：`test/server.test.ts` 6170 行。
   - 现状：仍然是重要集成烟测，不能拆空。
   - 建议：只迁移纯 HTML/CSS 字符串断言到更窄测试，保留 route + render + API 注入类集成断言。

### P2：需要观测后再清理的 legacy

1. `ConnTarget.type = "conversation"`
2. Feishu `mapped` mode
3. Windows host IPC fallback
4. legacy subagent `.pi/agents`
5. `/app/public` output best-effort 收编
6. `modelPolicyId` / `agentSpecId` / `skillSetId` / `upgradePolicy`
7. `/playground/reset`

这些都不能靠 `rg` 没看到调用就删。删除条件必须来自：

- `/v1/debug/cleanup`
- 生产双云验证
- 旧数据迁移策略
- 文档和测试同时更新

## 5. 详细优化路线

### Batch A：安全和运行口径收口

目标：不改变用户行为，先堵最容易翻车的地方。

任务：

1. 处理独立 Conn 页面 CDN 依赖。
   - 修改：`src/ui/conn-page.ts`
   - 方案：改用 `/vendor/flatpickr/...`，marked 复用本地 bundled UMD 或增加本地静态路由。
   - 测试：
     ```bash
     node --test --import tsx test/server.test.ts --test-name-pattern "standalone conn page|vendor|marked|flatpickr"
     npx tsc --noEmit
     ```

2. 收口 `.gitignore` 与当前运行产物。
   - 修改：`.gitignore`
   - 重点：评估是否应忽略 `ui-design/`；修正疑似拼写 `desgin/`；补充当前高频临时图片/HTML模式。
   - 注意：不删除用户产物，只防止误提交。
   - 验证：
     ```bash
     git status --short
     git diff --check
     ```

3. 增加治理前置检查清单。
   - 修改：`.codex/plans/` 或 `docs/architecture-governance-guide.md`
   - 内容：提交前必须确认未跟踪产物、验证命令、是否触碰 legacy。

### Batch B：Route 边界治理

目标：降低 `chat.ts` 修改风险，不改外部 API。

任务：

1. 抽出 agent profile 元操作 route。
   - 新文件候选：`src/routes/agent-profiles.ts`
   - 保留原 URL：
     - `GET /v1/agents`
     - `POST /v1/agents`
     - `PATCH /v1/agents/:agentId`
     - `POST /v1/agents/:agentId/archive`
     - skill toggle/list/copy/remove routes
   - `registerChatRoutes()` 仍可调用新 route 注册器，避免一次性改 `server.ts` 注入面。
   - 测试：
     ```bash
     node --test --import tsx test/agent-profile.test.ts test/agent-profile-catalog.test.ts test/agent-service-registry.test.ts
     node --test --import tsx test/chat-agent-routes.test.ts test/agent-model-chat-routes.test.ts
     node --test --import tsx test/server.test.ts --test-name-pattern "agent"
     npm test
     ```

2. 抽 main/scoped chat handler 工厂。
   - 只抽重复 wrapper，不改变 unknown scoped agent 404 语义。
   - 禁止：把 scoped 找不到 fallback 到 main。
   - 测试：
     ```bash
     node --test --import tsx test/chat-agent-routes.test.ts test/chat-agent-browser-routes.test.ts test/chat-sse.test.ts test/chat-route-parsers.test.ts
     ```

### Batch C：Store / Server 依赖装配显式化

目标：避免测试或新 route 隐式打开默认 SQLite，减少并行锁库事故。

任务：

1. 给 `buildServer()` 的 conn store 组合创建命名 helper。
   - 修改：`src/server.ts`
   - 新 helper 返回 `{ connDatabase, connStore, connRunStore, activityStore }`。
   - 测试：
     ```bash
     node --test --import tsx test/artifact-routes.test.ts test/server.test.ts --test-name-pattern "conns|activity|debug/cleanup"
     npm test
     ```

2. 文档补充测试注入规则。
   - 修改：`docs/architecture-test-matrix.md`
   - 说明：测试里注入任一 conn store 时，应同时注入 `connStore`、`connRunStore`、`activityStore` 或显式接受默认 DB。

### Batch D：Standalone UI 复用层

目标：减少 Conn/Agents 独立页面与 Playground 内嵌控制器的重复，但不引入大型前端工程。

任务：

1. 抽 API helper 字符串片段。
   - 候选文件：`src/ui/standalone-api-shared.ts`
   - 复用对象：agent catalog、browser catalog、model config、toast、safe JSON fetch。
   - 先服务独立页面，不强行改 Playground controller。

2. 抽 standalone form presenter。
   - 候选文件：`src/ui/standalone-form-shared.ts`
   - 复用对象：model provider select、browser label、agent label。

3. 拆分 `conn-page-js.ts`。
   - 方向：API、state、render、editor、events 五段。
   - 不改变 `renderConnPage()` 对外导出。
   - 测试：
     ```bash
     node --test --import tsx test/server.test.ts --test-name-pattern "standalone conn page"
     node --test --import tsx test/playground-conn-activity-controller.test.ts
     ```

### Batch E：测试债务治理

目标：降低每次前端小改动都摸 `server.test.ts` 的成本。

任务：

1. 盘点 `test/server.test.ts` 中纯 UI 字符串断言。
2. 每次只迁移 5-10 条到对应窄测试。
3. 保留以下集成烟测：
   - `/playground` 完整页面返回
   - externalized assets
   - chat route actual Fastify inject
   - conn output route
   - activity route
   - assets / local-file
   - debug route 注册

验证：

```bash
node --test --import tsx test/playground-page-shell.test.ts test/playground-styles.test.ts
node --test --import tsx test/server.test.ts --test-name-pattern "GET /playground"
npm test
```

### Batch F：Legacy 删除前观测

目标：只删除有证据表明无用的 legacy。

任务：

1. 在本地和生产调用：
   ```bash
   curl "http://127.0.0.1:3000/v1/debug/cleanup?since=<ISO time>"
   npm run server:ops -- tencent verify
   npm run server:ops -- aliyun verify
   ```

2. 为每个 legacy 项建删除条件记录：
   - 当前写入路径是否为 0
   - 当前读取路径是否只剩兼容
   - 旧数据迁移或确认废弃
   - 回滚方案

3. 删除顺序建议：
   - 先文档降级
   - 再 UI 隐藏
   - 再 API 拒绝新写入
   - 再迁移旧数据
   - 最后删除读取兼容

不要跳到最后一步。那种“我搜不到所以删了”的操作，线上旧数据会替你补课。

## 6. 不建议做的事

- 不建议重写 `AgentService.runChat()`。
- 不建议按行数拆 `playground-styles.ts`。
- 不建议一次性把 `test/server.test.ts` 拆空。
- 不建议删除 `/v1/chat/*` main 兼容路由。
- 不建议删除所有 legacy / fallback。
- 不建议引入 React/Vite 等大型前端工程，只为解决几个字符串模块重复。
- 不建议把 `.data/`、`runtime/playground*`、截图、报告、临时 HTML 纳入 Git。

## 7. 执行批准点

建议执行顺序：

1. Batch A：安全和运行口径收口。
2. Batch B：Route 边界治理。
3. Batch C：Store / Server 依赖装配显式化。
4. Batch D：Standalone UI 复用层。
5. Batch E：测试债务治理。
6. Batch F：Legacy 删除前观测。

每个 batch 独立提交、独立验证。跨 batch 混提交会让回归定位变得很蠢。

## 8. MCP 同步状态

本轮调用 MCP resource 列表返回空，没有可用 MCP 资源或模板可同步。因此计划已落地到本地 `.codex/plans/`。如果后续接入项目治理 MCP，应把本文作为首个同步源。

## 9. 当前结论

当前项目架构已经有可维护的主骨架：服务组合根、AgentService、Conn worker、Activity、Artifact、Agent profile、Playground controller 都有基本边界，测试基线也足够强。

真正的问题不是“缺少架构”，而是新能力叠得快，导致 UI 字符串模块、route 聚合和 legacy 兼容层开始变厚。治理方向应该是：先把外部资源和运行产物风险收住，再抽 route 和 standalone UI 的重复，最后用 cleanup debug 和生产验证决定 legacy 是否能删。

稳定性第一。优化不是把代码切碎，而是让下一次改动更不容易炸。
