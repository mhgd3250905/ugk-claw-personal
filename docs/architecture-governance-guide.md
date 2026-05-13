# 架构治理接手指南

日期：`2026-05-06`

这份文档是给后续接手 agent 的架构治理总入口。目标很朴素：少猜、少误删、少把稳定功能改成事故现场。项目长期可维护靠的不是“把大文件切碎”，而是事实入口、模块边界、验证矩阵和禁区都清楚。

## 先读顺序

不同任务别一上来全仓扫。按目标读最小集合：

| 任务 | 先读 |
| --- | --- |
| 全新接手 / `/init` | `AGENTS.md`、`README.md`、`docs/traceability-map.md`、本文件 |
| 架构治理 / 重构评估 | 本文件、`docs/architecture-governance-audit-2026-05-06.md`、`docs/architecture-test-matrix.md` |
| Playground UI | `docs/playground-current.md`、`DESIGN.md`、`docs/playground-ui-governance-map.md` |
| Chat / Agent / scoped agent | `docs/agent-chat-governance-map.md`、`src/routes/chat.ts`、`src/routes/agent-profiles.ts`、`src/agent/agent-service.ts` |
| Conn / Activity / output / Feishu | `docs/runtime-assets-conn-feishu.md`、`docs/conn-activity-legacy-governance-map.md` |
| 生产部署 / 双云验收 | `docs/server-ops.md`、`docs/server-ops-quick-reference.md`，再读对应云手册 |

如果只想知道“这个文件该不该改”，先查 `docs/traceability-map.md`。如果想知道“为什么这里不能乱改”，再查对应 governance map。

## 当前治理文档地图

| 文档 | 用途 |
| --- | --- |
| `docs/architecture-governance-audit-2026-05-06.md` | 当前架构地图、legacy 决策表、高风险调用链和优化 backlog |
| `docs/architecture-test-matrix.md` | 不同模块改动对应的最小验证命令和发布候选验证组合 |
| `docs/playground-ui-governance-map.md` | Playground shell、styles、workspace、feature controller 的边界和禁区 |
| `docs/conn-activity-legacy-governance-map.md` | `conn`、activity、output、通知和 legacy 兼容层边界 |
| `docs/agent-chat-governance-map.md` | main/scoped chat route、Agent profile 和 `AgentService` run 生命周期边界 |
| `.codex/plans/2026-05-06-architecture-analysis-and-optimization-plan.md` | 原始分阶段治理计划 |
| `.codex/plans/2026-05-06-architecture-governance-next-batches.md` | B/C/D/E 后续批次计划 |

## 模块边界速查

| 模块 | 应该负责 | 不应该负责 |
| --- | --- | --- |
| `src/server.ts` | 依赖创建、路由注册、组合根 | 业务逻辑、复杂状态机 |
| `src/routes/*` | HTTP 参数解析、状态码、响应体、调用 service | 长生命周期编排、运行时状态所有权 |
| `src/routes/chat.ts` | main/scoped chat HTTP 壳层，并注册 agent profile 管理路由 | `AgentService.runChat()` 生命周期拆分 |
| `src/routes/agent-profiles.ts` | `/v1/agents*` 元操作、技能开关、规则文件读写、默认 browser/model 绑定 | scoped chat 会话运行逻辑 |
| `src/agent/agent-service.ts` | 前台 run 生命周期、active/terminal run、会话状态 | HTTP 细节、UI 细节 |
| `src/agent/agent-*.ts` helpers | 会话、run、event、result、history 等窄职责 | 重新持有全局 run 生命周期 |
| `src/ui/playground.ts` | Playground 脚本、样式、dialog、shell 装配 | 新业务逻辑无限堆叠 |
| `src/ui/playground-page-shell.ts` | 稳定 DOM shell 和挂载点 | 业务加载、网络请求 |
| `src/ui/playground-styles.ts` | 基础布局、主题、workspace 和样式聚合 | 为了行数焦虑盲目拆散强耦合规则 |
| `src/ui/playground-workspace-controller.ts` | 桌面 workspace 壳层切换 | 接管资产、conn、agent、task 的业务状态 |
| `src/workers/conn-worker.ts` | 后台 run 领取、执行结果投递、activity / notification best-effort | 前台 conversation transcript 写回 |
| `workspace/output/` | conn run 持久产物标准出口 | 被 `/app/public` 替代为主输出目录 |

## 修改前检查清单

动代码前先回答这几个问题。答不上来就别急着改，仓库不是拿来练手速的。

1. 这次改动属于文档、route、service、worker、UI、部署还是运行态？
2. 有没有 main/scoped agent 差异？unknown scoped agent 是否仍然 404？
3. 有没有 legacy 兼容对象？例如 `conversation` target、`conversation_notifications`、`modelPolicyId`、`/app/public` output 收编。
4. 这次改动影响用户可见行为、接口、运行方式或协作约定吗？如果影响，必须更新 `docs/change-log.md`。
5. 对应最小验证是什么？先查 `docs/architecture-test-matrix.md`。
6. 是否碰到运行态目录？`.env`、`.data/`、`runtime/` 临时报告、部署包默认不进提交。
7. 是否只是因为“文件太大”想拆？如果是，先停。大文件不是罪，边界不清才是。

## 提交前防误提交清单

架构治理批次提交前，除了跑对应测试，还必须检查这些东西。别让一次“代码优化”顺手带上截图、临时脚本和网页草稿，那不叫交付，那叫搬家。

1. `git status --short` 里只能出现本批次明确要提交的源码 / 测试 / 文档文件。
2. 新增未跟踪文件如果属于运行产物、截图、临时 HTML、临时脚本或设计草稿，优先补 `.gitignore` 或移到仓库外，不要混进治理提交。
3. 如果改了页面外部资源来源，例如 CDN 改成本地 vendor，必须补页面断言，防止后续又悄悄退回外链。
4. 如果触碰 legacy / fallback 字段，必须写明保留、迁移或删除条件，并确认是否需要 `/v1/debug/cleanup` 观测。
5. 如果改动影响外部行为、运行方式、接口、文档结构或协作约定，同轮更新 `docs/change-log.md`。

## 禁区

- 不要按行数拆 `playground-styles.ts` 或 `AgentService.runChat()`。
- 不要删除 `/v1/chat/*` main 兼容路由。
- 不要让 scoped agent 找不到时 fallback 到 main。
- 不要手写 `.data/agents/profiles.json` 创建、修复、归档 agent profile。
- 不要把移动端 Playground 当桌面端缩小版。
- 不要删除 legacy 字段前跳过 `/v1/debug/cleanup`。
- 不要恢复 conn worker 对 `/app/public` 的主输出直写。
- 不要把 Feishu 通知失败升级成后台 run 失败。
- 不要把运行态、部署包、临时报告或本地截图纳入 Git。

## 推荐治理节奏

架构治理按这个顺序来：

1. **先事实地图**：确认真实入口、调用链、运行态和测试。
2. **再测试锚点**：用现有测试或新增聚焦测试锁住行为。
3. **再小 helper**：先收口重复规则，例如 scoped agent resolver。
4. **再局部 handler**：只抽稳定、重复、低状态的 route handler。
5. **最后才拆模块**：只有当边界和测试都清楚时再拆文件。

不要从第 5 步开始。那不是架构治理，是拆盲盒。

## 验证口径

纯文档：

```bash
git diff --check
```

常规 TypeScript 源码：

```bash
git diff --check
npx tsc --noEmit
```

按模块补最小测试：

- Chat / Agent：`node --test --import tsx test/chat-agent-routes.test.ts test/agent-service.test.ts`
- Playground UI：`node --test --import tsx test/playground-page-shell.test.ts test/playground-styles.test.ts`
- Conn / Activity：`node --test --import tsx test/conn-worker.test.ts test/cleanup-debug.test.ts`
- Feishu：`node --test --import tsx test/feishu-service.test.ts test/feishu-http-agent-gateway.test.ts test/feishu-ws-subscription.test.ts`

发布候选再跑：

```bash
npm test
```

涉及 Docker Chrome、浏览器链路或生产验收时再加：

```bash
npm run docker:chrome:check
npm run server:ops -- <tencent|aliyun> verify
```

## 接手时的判断标准

一个改动值得做，至少要满足其中之一：

- 收口一个散落规则，降低后续复制粘贴错误。
- 给高风险链路增加测试或文档锚点。
- 移除明确无用且有证据支持的 legacy。
- 让新需求能用更小 diff 落地。
- 修复真实 bug 或线上排障痛点。

如果只是“看着不爽”“文件太长”“想显得架构高级”，先别动。项目变成屎山，往往不是因为没人重构，而是因为每个人都在没有事实和验证的情况下热情重构。
