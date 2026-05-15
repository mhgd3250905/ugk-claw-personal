# Team Runtime v2 剩余任务执行计划

日期：2026-05-15  
接手对象：第一次接触 `ugk-pi` 的 coding agent  
目标：把 Team Runtime v2 从“可信基础骨架”推进到“真实 Agent 可控、可恢复、可观测”的可验收实现。

## 开始前必须读

1. `AGENTS.md`
2. `docs/handoff-current.md`
3. `docs/team-runtime.md` 顶部 `2026-05-15 v2 执行口径修正`
4. 本计划
5. 两份外部设计 / 执行计划：
   - `E:\AII\ugk-pi-res\plan\team-v2\team-runtime-v2-design.md`
   - `E:\AII\ugk-pi-res\plan\team-v2\2026-05-15-team-runtime-v2-agent-execution-cn.md`

别先翻旧 v0.1 域名调查章节。那里是历史资料，不是当前 v2 API 真源。照旧接口写代码，基本就是把坑重新铺平再踩一遍。

## 当前基线

本轮已经完成并验证：

- Run 创建只入队：`POST /v1/team/plans/:planId/runs` 返回 `queued`，不再 HTTP inline 执行。
- `ugk-pi-team-worker` 是执行入口；生产 compose 已补 Team worker 和 Team 数据挂载。
- TeamUnit 会校验四个 AgentProfile ID 存在。
- Plan 创建 / 切换默认团队会校验 TeamUnit 存在且未归档。
- 活跃 run 会锁住 Plan、TeamUnit 和四个 AgentProfile；AgentProfile 写接口会返回 409。
- runner 异常会把 run 收口为 `failed` / `completed_with_failures`，不再长期卡 `running`。
- watcher JSON 解析失败按 `confirm_failed`，不再默认 accept。
- finalizer prompt 会读取每个 task 的 `resultRef` 文件内容。
- `/playground/team` 对动态文本做 HTML escape，并显示任务进度、耗时、暂停 / 恢复 / 取消入口。
- `team-plan-creator` skill 禁止创建 / 启动 Run。
- `npm run test:team` 已改为串行，避免 SQLite 并发锁随机失败。

验证记录：

```powershell
node --test --import tsx test/team-routes.test.ts test/team-orchestrator-controls.test.ts test/team-agent-profile-runner.test.ts test/team-page-ui.test.ts test/containerization.test.ts test/team-agent-profile-locks.test.ts
npx tsc --noEmit
npm run test:team
npm test
git diff --check
```

结果：targeted 35 pass，`npm run test:team` 83 pass，`npm test` 812 pass。

## 工作区边界

建议提交的当前改动包括：

- `.pi/skills/team-plan-creator/SKILL.md`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `docs/change-log.md`
- `docs/team-runtime.md`
- `docs/handoff-current.md`
- `.codex/plans/2026-05-15-team-runtime-v2-next-agent-execution-plan.md`
- `package.json`
- `src/routes/agent-profiles.ts`
- `src/team/agent-profile-role-runner.ts`
- `src/team/config-locks.ts`
- `src/team/orchestrator.ts`
- `src/team/routes.ts`
- `src/ui/team-page.ts`
- `src/workers/team-worker.ts`
- `test/containerization.test.ts`
- `test/team-agent-profile-locks.test.ts`
- `test/team-agent-profile-runner.test.ts`
- `test/team-orchestrator-controls.test.ts`
- `test/team-page-ui.test.ts`
- `test/team-routes.test.ts`

不要默认提交这些现场已有的未跟踪项，除非用户另行确认它们的来源和用途：

- `.pi/skills/caveman/`
- `.pi/skills/diagnose/`
- `.pi/skills/grill-me/`
- `.pi/skills/grill-with-docs/`
- `.pi/skills/handoff/`
- `.pi/skills/improve-codebase-architecture/`
- `.pi/skills/prototype/`
- `.pi/skills/setup-matt-pocock-skills/`
- `.pi/skills/tdd/`
- `.pi/skills/to-issues/`
- `.pi/skills/to-prd/`
- `.pi/skills/triage/`
- `.pi/skills/write-a-skill/`
- `.pi/skills/zoom-out/`
- `skills-lock.json`

## 执行顺序总览

1. P0：真实 Agent session 强中断与 pause / cancel 语义
2. P0：真实 runner 端到端验收和回归测试
3. P1：worker lease / heartbeat / crash recovery
4. P1：finalizer deterministic fallback report
5. P1：Team 页面可观测性
6. P1：重写 `docs/team-runtime.md` 为纯 v2 文档
7. P2：增强 `team-plan-creator` 成为可用向导

每个任务都先补测试，再改实现。别裸改，这项目的历史已经充分证明“看起来能跑”不值钱。

## P0-1 真实 Agent session 强中断

### 问题

当前 `pauseRun()` / `cancelRun()` 会更新 run state，但如果真实 AgentProfile runner 正在一次长 prompt、tool call 或浏览器操作中运行，底层 session 不会立刻 abort。它可能继续烧模型和工具，直到当前 phase 自然返回。

### 相关文件

- `src/team/orchestrator.ts`
- `src/team/agent-profile-role-runner.ts`
- `src/agent/background-agent-session-factory.ts`
- `src/agent/agent-session-factory.ts`
- `src/agent/agent-service.ts`
- `src/workers/team-worker.ts`
- `test/team-orchestrator-controls.test.ts`
- `test/team-agent-profile-runner.test.ts`

### 实现建议

1. 先调查 session interface 是否已有 `abort` / `interrupt` / cancellation signal。
2. 如果已有能力，给 `TeamRoleRunner` 增加可选取消入口，例如：
   - `cancelRun?(runId: string, reason: string): Promise<void>`
   - 或在 `runWorker` / `runChecker` / `runWatcher` / `runFinalizer` input 中传 `AbortSignal`
3. `TeamOrchestrator.cancelRun()` 标记 state 后，同时通知当前 runner 取消 active phase。
4. `pauseRun()` 是否强中断要做产品判断：
   - 保守方案：pause 只在 phase 边界生效，但 UI 文案必须写清楚。
   - 强方案：pause 也 abort 当前 phase，并在 resume 后重新执行当前 task attempt。
5. runner 收到取消后不能把迟到结果写回已 cancelled run。
6. worker loop 在每个 phase 前后都重新读取 state，发现 `cancelled` / `paused` 立即停止。

### 必补测试

- running phase 中 cancel 会调用 runner cancellation hook。
- cancellation hook 抛错不影响 run 进入 cancelled。
- cancel 后迟到的 worker/checker/watcher/finalizer 结果不会覆盖 terminal state。
- pause 的语义测试：如果选择阶段边界 pause，就明确断言不会启动下一 phase；如果选择强 pause，就断言当前 session 被 abort。

### 验收标准

- 用户点击取消后，真实 Agent 不再继续产生新的 Team resultRef / final report。
- cancelled run 的 `finishedAt`、`activeElapsedMs`、task summary 和 event 都一致。
- `npm run test:team`、`npx tsc --noEmit` 通过。

## P0-2 真实 runner 端到端验收

### 问题

当前默认 `TEAM_USE_MOCK_RUNNER=true`。单元测试覆盖了真实 runner 的 prompt 拼装和解析边界，但还没有在本地 Docker 环境用真实 AgentProfile runner 跑完整 Team run。

### 相关文件

- `docker-compose.yml`
- `src/workers/team-worker.ts`
- `src/team/agent-profile-role-runner.ts`
- `src/team/routes.ts`
- `src/ui/team-page.ts`
- `.pi/skills/team-plan-creator/SKILL.md`
- `docs/team-runtime.md`

### 实现建议

1. 准备一个最小真实 TeamUnit，四个 role 可以先都绑定 `main` 或测试 profile。
2. 设置：
   - `TEAM_RUNTIME_ENABLED=true`
   - `TEAM_USE_MOCK_RUNNER=false`
3. 通过 API 创建 Plan，任务控制在 1 个，验收标准非常短。
4. 创建 Run，确认 HTTP 返回 queued。
5. 确认 worker 接管并完成 run。
6. 检查：
   - state 从 `queued -> running -> completed`
   - task resultRef 指向存在的文件
   - final report 包含 resultRef 内容
   - AgentProfile 锁在 active run 时生效，terminal 后释放
7. 把手工验收步骤沉淀为可重复脚本或文档。能自动化就自动化；不能自动化就写清楚环境变量和观察命令。

### 必补测试

- 如果能 mock background session factory，补一个 integration-ish 测试，证明真实 runner 能走完整 worker/checker/watcher/finalizer。
- 补文档测试或静态断言，防止 compose 默认误设成真实 runner。

### 验收标准

- 有一条真实 runner run 的完整验收记录。
- 没有把真实模型 key、`.env`、`.data/team` 运行态提交进 Git。
- `npm run test:team`、`npx tsc --noEmit` 通过。

## P1-1 worker lease / heartbeat / crash recovery

### 问题

当前 worker 是轻量轮询 queued run。没有 lease、heartbeat、worker identity、crash recovery 和重复执行防护。worker 崩溃、重启或多实例运行时，run 可能卡住或被重复执行。

### 相关文件

- `src/workers/team-worker.ts`
- `src/team/orchestrator.ts`
- `src/team/run-workspace.ts`
- `src/team/types.ts`
- `test/team-orchestrator.test.ts`
- `test/team-orchestrator-controls.test.ts`

### 实现建议

1. 在 `TeamRunState` 增加 lease 字段：
   - `leaseOwner`
   - `leaseAcquiredAt`
   - `leaseHeartbeatAt`
   - `leaseExpiresAt`
   - `recoveryCount`
2. worker 每轮只认领未被有效 lease 占用的 queued / recoverable run。
3. worker 执行期间周期性 heartbeat。
4. 超过 lease TTL 的 running run 可进入 recoverable 状态，或由新 worker 接管。
5. 每次写 state 时检查当前 worker 是否仍持有 lease，避免过期 worker 写回。
6. 明确单机文件锁策略：可以先基于 state 原子写 + owner 校验，不要上来就引数据库。简单点，别给 MVP 装航母。

### 必补测试

- active lease 阻止第二个 worker 接管。
- expired lease 允许 recovery。
- 旧 owner 迟到写入被拒绝或忽略。
- worker crash 后 run 不永久卡 running。

### 验收标准

- 多 worker 同时启动不会重复跑同一个 run。
- worker 重启后可恢复或明确失败收口。
- 文档说明当前 recovery 语义和限制。

## P1-2 finalizer fallback report

### 问题

finalizer 读取 resultRef 内容后可以生成报告，但 finalizer 自己失败时缺少稳定 fallback。现在更偏“失败就收口”，用户看不到一个可读的部分成功总结。

### 相关文件

- `src/team/orchestrator.ts`
- `src/team/agent-profile-role-runner.ts`
- `src/team/run-workspace.ts`
- `test/team-orchestrator.test.ts`
- `test/team-agent-profile-runner.test.ts`

### 实现建议

1. 把 deterministic report 生成器做成纯函数：
   - 输入 plan、run state、task titles、resultRef 内容、失败摘要
   - 输出 Markdown
2. finalizer 成功时写真实 report。
3. finalizer 失败时写 fallback report，并把 run 状态设为：
   - task 全成功但 finalizer 失败：建议 `completed_with_failures`
   - 有 task 失败：保持 `completed_with_failures` 或 `failed`
4. fallback report 必须明确标注“finalizer failed，以下为系统汇总”。

### 必补测试

- finalizer 抛错时仍写 `final-report.md`。
- fallback report 包含 succeeded / failed task、resultRef、errorSummary。
- fallback 不吞掉 lastError。

### 验收标准

- 用户永远能从 terminal run 读取一个 final report，除非 run 在未产生任何结果前被取消。

## P1-3 Team 页面可观测性

### 问题

`/playground/team` 现在能基础操作，但看不清每个 task / attempt / phase 的真实进展。失败时需要翻 state 文件和日志，不像产品。

### 相关文件

- `src/ui/team-page.ts`
- `src/team/types.ts`
- `src/team/run-workspace.ts`
- `src/routes/team.ts`
- `test/team-page-ui.test.ts`
- `test/team-routes.test.ts`

### 实现建议

1. Run detail 展示：
   - 总任务数、成功、失败、取消
   - 当前 task
   - activeElapsedMs
   - lastError
2. Task 列表展示：
   - status
   - attemptCount
   - activeAttemptId
   - resultRef
   - errorSummary
   - progress phase/message
3. attempt 展开：
   - worker output
   - checker verdict
   - watcher review
   - accepted / failed result
4. 增加刷新策略：
   - 先轮询即可
   - 后续再接 SSE，别一口吃太胖
5. 所有动态文本继续 `escapeHtml`。

### 必补测试

- 页面包含 attempt/resultRef/phase 展示入口。
- 动态 resultRef 和 errorSummary 经过 escape。
- running/paused/terminal run 的按钮状态正确。

### 验收标准

- 不打开 `.data/team` 也能在页面判断 run 卡在哪个 phase。

## P1-4 重写 Team Runtime 文档为纯 v2

### 问题

`docs/team-runtime.md` 下方仍保留大量 v0.1 域名调查、template、stream、submit tool 旧内容。顶部已加 v2 警告，但长期看会误导新 agent。

### 相关文件

- `docs/team-runtime.md`
- `docs/change-log.md`
- `docs/handoff-current.md`

### 实现建议

1. 新建或重写为纯 v2 结构：
   - 当前目标
   - 数据模型：TeamUnit / Plan / Run / Attempt / resultRef
   - API
   - worker
   - AgentProfile runner
   - pause / cancel / resume
   - locks
   - compose
   - 测试和验收
   - 已知限制
2. 将 v0.1 域名调查历史移到归档章节或单独历史文档。
3. `docs/change-log.md` 记录文档结构变化。

### 验收标准

- 新 agent 只读 `docs/team-runtime.md` 不会误以为当前主 API 是 `/v1/team/runs {keyword}` 或 template runtime。

## P2 team-plan-creator 向导增强

### 问题

当前 skill 已经禁止创建 Run，但还只是 API 指南，不够像可用向导。

### 相关文件

- `.pi/skills/team-plan-creator/SKILL.md`
- `test/team-*.test.ts`
- 可新增 skill 文档静态测试

### 实现建议

1. 增加“先问目标和交付物”的步骤。
2. 引导列出已有 TeamUnit / Plan 并优先复用。
3. 增加 task 拆分质量规则：
   - 每个 task 要有清晰输入
   - acceptance rules 必须可验证
   - final output contract 必须具体
4. 增加“创建前预览 Plan JSON，不启动 Run”的确认口径。
5. 静态测试锁定不得出现 `POST /v1/team/plans/:planId/runs`。

### 验收标准

- 运行时 agent 使用该 skill 只能创建计划资源，不会误启动执行。

## 每阶段完成后的验证

至少运行：

```powershell
npx tsc --noEmit
npm run test:team
git diff --check
```

涉及跨模块 route / AgentProfile / worker 行为时，再运行：

```powershell
npm test
```

涉及 Docker / compose 时，额外检查：

```powershell
docker compose ps
Invoke-WebRequest -UseBasicParsing -Uri http://127.0.0.1:3000/healthz
```

涉及真实 runner 时，必须说明：

- 是否设置了 `TEAM_USE_MOCK_RUNNER=false`
- 使用了哪些 AgentProfile
- runId 是什么
- 是否产生 final report
- 是否有真实模型费用或外部工具调用

## 给执行 agent 的第一条消息

可以直接发这段：

```text
请接手 `E:\AII\ugk-pi` 的 Team Runtime v2 后续实现。先读 `AGENTS.md`、`docs/handoff-current.md`、`docs/team-runtime.md` 顶部 v2 章节，以及 `.codex/plans/2026-05-15-team-runtime-v2-next-agent-execution-plan.md`。不要按 `docs/team-runtime.md` 下方 v0.1 域名调查旧 API 开发。

当前基线已经通过 `npx tsc --noEmit`、`npm run test:team`、`npm test`。你的任务是按计划优先完成 P0：真实 Agent session 强中断，以及 `TEAM_USE_MOCK_RUNNER=false` 的真实 runner 端到端验收。每个改动先补测试，完成后更新 `docs/change-log.md` 和相关 Team 文档。不要提交 `.env`、`.data/`、runtime 产物或未确认来源的 `.pi/skills/*` 未跟踪目录。
```
