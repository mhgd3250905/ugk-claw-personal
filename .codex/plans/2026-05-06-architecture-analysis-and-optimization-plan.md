# UGK CLAW 架构分析与优化计划

> 执行前提：本计划只用于分析与规划。未经用户明确确认，不修改 `src/`、`test/`、`.pi/`、`runtime/` 或部署配置。
> 执行方式：用户确认后再用 `$do-plan` 分批执行，每批必须有独立验证与回滚点。

## 目标

在不影响当前已稳定功能的前提下，系统整理 `ugk-pi / UGK CLAW` 的架构边界、冗余实现、legacy 兼容层、测试承载方式和文档口径，形成可长期维护的优化路线。

本计划不追求“看见大文件就拆”。当前项目已经做过一轮较完整的模块拆分，继续盲拆只会把复杂度从一个文件搬到多个文件。真正目标是找出真实重复、真实漂移和真实风险，再小步治理。

## 当前事实基线

- 项目主入口：`src/server.ts`
- 聊天主链路：`src/routes/chat.ts`、`src/agent/agent-service.ts`、`src/agent/agent-session-factory.ts`
- Playground 真源：`src/ui/playground.ts`、`src/ui/playground-page-shell.ts`、`src/ui/playground-styles.ts`
- Playground 当前状态文档：`docs/playground-current.md`
- 设计规范：`DESIGN.md`
- 运行交接：`docs/handoff-current.md`
- 追溯地图：`docs/traceability-map.md`
- 已知大文件集中在 `src/ui`，尤其是 `playground-styles.ts`、`playground-conn-activity-controller.ts`、`playground-agent-manager.ts`、`playground-transcript-renderer.ts`
- 测试集中风险明显：`test/server.test.ts` 约 250KB，承担大量 UI HTML/CSS/接口断言
- 当前未跟踪本地现场：
  - `runtime/dangyang-weather-2026-05-01.json`
  - `runtime/karpathy-guidelines-CLAUDE.md`
  - `runtime/tab-accumulation-report.md`

## 成功标准

1. 不破坏现有用户可见行为：聊天、流式恢复、文件库、任务消息、后台 conn、Agent 切换、文件交付、Chrome sidecar。
2. 不删除仍被运行态、旧数据、生产配置或文档明确依赖的 legacy 兼容层。
3. 每个优化批次都有：
   - 明确影响范围
   - 调用链分析
   - 数据结构兼容性分析
   - 针对性测试
   - `npm test` 或更小范围测试 + 最终全量测试
4. 文档口径跟随改动：影响架构、接口、运行方式或接手路径时，同步更新 `docs/change-log.md` 和相关当前文档。
5. 最终输出一份可维护的“架构治理报告”，说明哪些该清、哪些不该动、哪些等真实需求再动。

## 不做事项

- 不做整目录重构。
- 不改 `references/pi-mono/`。
- 不把 `.data/`、`.env`、runtime 临时产物纳入治理提交。
- 不把 `AgentService.runChat()` 强行拆散成看似优雅但控制流更绕的多层抽象。
- 不把手机端 Playground 当桌面压缩版重做。
- 不在没有线上数据确认前删除 `conversation` target、legacy subagent、Windows host IPC fallback 等兼容层。

## 阶段 0：冻结基线与风险闸门

**目的：** 先确认现在能工作，再谈优化。不做这一步就开拆，属于拿稳定系统练刀。

**读取入口：**
- `AGENTS.md`
- `README.md`
- `docs/handoff-current.md`
- `docs/traceability-map.md`
- `docs/playground-current.md`
- `docs/project-cleanup-assessment-2026-05-05.md`
- `docs/runtime-assets-conn-feishu.md`
- `DESIGN.md`

**检查项：**
- 记录 `git status --short`
- 记录最新 `git log --oneline -10`
- 确认未跟踪 runtime 文件不纳入本轮
- 确认本地标准验证命令：
  - `git diff --check`
  - `npx tsc --noEmit`
  - `npm test`
  - 如涉及浏览器链路，再加 `npm run docker:chrome:check`

**产出：**
- 架构治理基线摘要
- 不可破坏功能清单
- 每一阶段执行前必须重新确认的验证命令

## 阶段 1：架构地图与依赖流分析

**目的：** 建立真实模块地图，避免凭感觉说“这里乱”“那里冗余”。

**分析维度：**
- HTTP 路由层：`src/routes/*`
- Agent 编排层：`src/agent/*`
- Playground UI 层：`src/ui/*`
- 后台 worker：`src/workers/*`
- Feishu 集成：`src/integrations/feishu/*`
- 类型契约：`src/types/api.ts`
- 测试覆盖：`test/*.test.ts`

**方法：**
- 统计文件大小和模块数量，只作为定位线索，不作为重构理由。
- 对主要 API 建立调用链：
  - `/v1/chat/*`
  - `/v1/agents/*`
  - `/v1/assets/*`
  - `/v1/activity/*`
  - `/v1/conns/*`
  - `/v1/debug/*`
- 对 Playground 建立 UI 装配图：
  - shell
  - workspace
  - transcript
  - assets
  - task inbox
  - conn manager
  - agent manager
  - mobile shell
  - theme

**产出：**
- `docs/architecture-map-current.md` 草案，执行阶段再决定是否正式落文档。
- 候选治理点列表，按风险和收益排序。

## 阶段 2：冗余与 legacy 审计

**目的：** 区分“该删的旧实现”和“必须保留的兼容层”。这两个混在一起，是项目后期最常见的坑。

**重点审计对象：**
- `ConnTarget.type = "conversation"` legacy 兼容
- `conversation_notifications` cleanup debug 只读观测
- legacy subagent `.pi/agents`
- Windows host IPC fallback
- `/playground/reset` 与外部化 runtime
- 模型源运行态持久化与 `.pi/settings.json` 兜底
- Feishu bootstrap env 与 Web 动态配置

**每个候选项必须回答：**
- 当前是否仍有生产读取路径？
- 当前是否仍有写入路径？
- 是否有旧数据迁移风险？
- 是否有用户入口还能创建该类型数据？
- 删除后失败会表现在哪里？
- 是否能先 deprecated、观测、再删除？

**产出：**
- legacy 决策表更新建议
- 可删除 / 不可删除 / 需要观测 三类清单
- 对应验证命令和线上检查接口，如 `/v1/debug/cleanup`

## 阶段 3：Playground UI 架构治理

**目的：** 当前 UI 功能初步稳定，但 `src/ui` 仍有明显长期维护压力。这里要治理，不要大改视觉。

**重点对象：**
- `src/ui/playground-styles.ts`
- `src/ui/playground-theme-controller.ts`
- `src/ui/playground-conn-activity-controller.ts`
- `src/ui/playground-agent-manager.ts`
- `src/ui/playground-transcript-renderer.ts`
- `src/ui/playground-assets.ts`
- `src/ui/playground-task-inbox.ts`
- `test/server.test.ts` 中 Playground 断言

**治理方向：**
- 把“样式 token / 主题覆盖 / 组件局部样式”边界重新标注清楚。
- 找出深色主题、浅色主题、移动端覆盖的重复规则，先记录，不急着合并。
- 检查 workspace 面板规则是否集中由 `playground-workspace-controller.ts` 驱动，避免各控制器私自改 `workspaceMode`。
- 检查文件库、任务消息、后台任务、Agent 管理的 header 是否继续出现重复 DOM 结构。
- 检查 `test/server.test.ts` 是否可以拆出更小的 UI 断言测试文件，降低单测巨石风险。

**禁止行为：**
- 不重做视觉风格。
- 不把 runtime 外部化产物当源码真源。
- 不把手机端规则合回桌面规则。
- 不为了减少行数删除可读性更强的明确覆盖。

**验证：**
- `npm run design:lint`
- `node --test --import tsx test/playground-*.test.ts`
- `node --test --import tsx test/server.test.ts --test-name-pattern "GET /playground"`
- 最终 `npm test`

## 阶段 4：Agent / Chat 编排边界复核

**目的：** 复核 `AgentService` 周边是否还有真实可测边界，但不强拆 run 生命周期。

**重点对象：**
- `src/agent/agent-service.ts`
- `src/agent/agent-session-factory.ts`
- `src/agent/agent-conversation-*`
- `src/agent/agent-run-*`
- `src/agent/agent-session-event-*`
- `src/routes/chat.ts`
- `src/routes/chat-route-parsers.ts`
- `src/routes/chat-sse.ts`

**候选优化：**
- 检查 `AgentService.runChat()` 内部是否有重复错误处理或本地路径改写逻辑。
- 检查 active run / terminal run 的状态读写是否仍集中，不扩散。
- 检查 scoped agent API 与 main API 是否存在重复路由包装，可否以薄 adapter 收口。
- 检查 event replay / SSE / queue / interrupt 的终态判断是否有两套语义。

**高风险边界：**
- active run 清理
- terminal run snapshot
- browser cleanup scope
- conversation current pointer
- queued message steer/followUp
- local artifact path rewrite

**验证：**
- `node --test --import tsx test/agent-service.test.ts`
- `node --test --import tsx test/chat-agent-routes.test.ts test/chat-sse.test.ts test/chat-route-parsers.test.ts`
- `node --test --import tsx test/agent-run-*.test.ts test/agent-session-event-*.test.ts`
- 最终 `npm test`

## 阶段 5：Conn / Activity / Feishu 数据流复核

**目的：** 后台任务链路刚稳定，不能乱动；但它也是冗余兼容层最多的区域，适合做审计。

**重点对象：**
- `src/routes/conns.ts`
- `src/routes/activity.ts`
- `src/agent/conn-db.ts`
- `src/agent/conn-sqlite-store.ts`
- `src/agent/conn-run-store.ts`
- `src/agent/agent-activity-store.ts`
- `src/agent/background-agent-runner.ts`
- `src/workers/conn-worker.ts`
- `src/integrations/feishu/*`
- `docs/runtime-assets-conn-feishu.md`

**分析问题：**
- conn 定义、run、event、activity、output files 的数据所有权是否清楚？
- run result、activity text、Feishu notification 是否存在重复格式化逻辑？
- output/latest URL 生成是否只有一个可信 presenter？
- Feishu 动态配置和 env fallback 是否文档、代码、UI 一致？
- 软删除 conn 后 run 历史保留策略是否表达清楚？

**验证：**
- `node --test --import tsx test/conn-*.test.ts`
- `node --test --import tsx test/activity-route-utils.test.ts test/notification-route-utils.test.ts`
- `node --test --import tsx test/feishu-*.test.ts`
- `node --test --import tsx test/background-agent-runner.test.ts test/conn-worker.test.ts`
- `GET /v1/debug/cleanup?since=<本轮开始时间>`

## 阶段 6：测试架构优化

**目的：** 不只是让测试“能过”，而是让未来改动知道该跑哪组测试。

**问题：**
- `test/server.test.ts` 过大，HTML、CSS、路由、集成断言混在一起。
- UI controller 已拆出多个 `playground-*.test.ts`，但很多页面结构断言仍集中在 server test。
- 架构治理必须避免把测试拆得比源码还难找。

**候选动作：**
- 建立测试分组文档：
  - chat / agent
  - playground shell / styles / controllers
  - conn / activity
  - Feishu
  - deployment / runtime debug
- 只在有明确收益时，把 `server.test.ts` 中纯 Playground HTML/CSS 断言迁移到更窄的测试文件。
- 保留少量 `/playground` 集成烟测在 `server.test.ts`，不要拆空。

**验证：**
- 迁移前后断言数量不下降。
- 迁移前后失败信息更可定位。
- 最终 `npm test`。

## 阶段 7：文档体系收口

**目的：** 架构清理后，文档不能继续讲旧故事。文档漂移比代码冗余更阴险，因为它会稳定地误导下一个人。

**重点文档：**
- `AGENTS.md`
- `README.md`
- `docs/traceability-map.md`
- `docs/handoff-current.md`
- `docs/playground-current.md`
- `docs/runtime-assets-conn-feishu.md`
- `docs/project-cleanup-assessment-2026-05-05.md`
- `docs/change-log.md`

**规则：**
- 只更新事实，不写流水账。
- 主文档不塞排障长文，长文进专题文档。
- 接手入口必须保持渐进式披露。
- 任何行为、接口、运行方式或协作约定变化，都要补 `docs/change-log.md`。

## 分批执行建议

### 批次 A：只读架构审计

不改源码，只产出：
- 当前架构地图
- legacy 决策表
- 高风险调用链
- 候选优化 backlog

验证：
- 无源码 diff
- 文档链接可读

### 批次 B：测试分组与风险闸门

优先整理测试运行口径，必要时迁移少量低风险断言。

验证：
- `npm test`
- 迁移测试前后覆盖点对齐

### 批次 C：Playground UI 局部治理

只处理低风险重复和明显漂移：
- header 结构重复
- workspace mode 控制权
- 浅色主题漏网规则
- 文件库 / 任务消息样式边界

验证：
- `npm run design:lint`
- Playground 相关测试
- 必要时本地页面截图验证

### 批次 D：后台链路与 legacy 观测

只做观测和文档强化，除非 `/v1/debug/cleanup` 证明某 legacy 已可删。

验证：
- conn/activity/Feishu 相关测试
- cleanup debug

### 批次 E：Agent / Chat 小边界优化

只有发现真实重复或 bug 才动。默认不拆 `runChat()` 主生命周期。

验证：
- agent/chat 定向测试
- 全量 `npm test`

## 每个改动批次必须附带影响分析

### 直接影响

- 修改函数被哪些地方调用？
- 参数签名是否兼容？
- 返回结构是否变化？
- API 响应字段是否变化？

### 间接影响

- active run / terminal run 状态是否改变？
- conversation current pointer 是否改变？
- workspace mode 是否改变？
- conn run / activity / output 生命周期是否改变？
- browser cleanup scope 是否改变？

### 数据兼容

- 新字段是否有默认值？
- 删除字段是否仍被旧数据访问？
- 类型变化是否会破坏旧 JSON / SQLite 行？
- 前端 localStorage key 是否兼容？

## 执行批准口径

本计划生成后不自动执行。下一步需要用户明确选择：

1. 只做“批次 A：只读架构审计”
2. 从“批次 A + 批次 B”开始，先把测试和风险闸门立住
3. 直接进入某个用户点名的具体区域，例如 Playground UI、AgentService、conn/activity

推荐选择 1，然后根据审计结果再决定是否进入 B/C/D/E。现在功能刚稳定，第一刀应该是显微镜，不是斧头。
