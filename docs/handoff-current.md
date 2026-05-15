# 当前交接快照

更新时间：`2026-05-16`

这份文档给新接手 `ugk-pi / UGK CLAW` 的同事或 coding agent 看。先读这里，再按任务类型展开其他文档。不要靠聊天记录拼现状，聊天记录容易把历史事实和当前事实搅成一锅。

## 给新接手者的第一条消息

可以直接把下面这段发给同事：

```text
请接手 `E:\AII\ugk-pi`。你维护的是 ugk-pi 代码仓库，不是产品运行时 Playground agent。

开始前先读 `AGENTS.md`、`docs/handoff-current.md`、`docs/team-runtime.md` 顶部 v2 章节，以及 `.codex/plans/2026-05-15-team-runtime-v2-next-agent-execution-plan.md`。如果要跑本地，只用 Docker：`docker compose up -d` 或 `docker compose restart ugk-pi`，标准入口是 `http://127.0.0.1:3000/playground`，健康检查是 `http://127.0.0.1:3000/healthz`。不要把宿主机 `npm start` / `npm run dev` 当正规入口。

开始前执行 `git status --short` 和 `git log -1 --oneline`。截至本交接更新，本地 HEAD 为 `fa2bf4e feat: team role agent profile dropdown selection and dynamic injection`，工作区存在 Team Runtime v2 审计修复和交接文档改动，尚未提交；如果现场不一致，先查清楚是谁的新改动，不要直接回滚。当前生产发布点仍以服务器 `git log -1 --oneline` 为准；本地新提交不要默认已经上线。

服务器发布默认走增量更新。腾讯云拉 GitHub `origin/main`，阿里云拉 Gitee `gitee/main`。不要整目录覆盖，不要删除 shared 运行态，不要提交 `.env`、`.data/`、Chrome profile、runtime 临时产物或本地截图。
```

## 2026-05-15 Team Runtime v2 审计修复现场

本轮目标是审计并修复 `E:\AII\ugk-pi-res\plan\team-v2\team-runtime-v2-design.md` 与 `E:\AII\ugk-pi-res\plan\team-v2\2026-05-15-team-runtime-v2-agent-execution-cn.md` 对应实现中“声称完成但实际高风险”的部分。当前已经把 Team v2 从纸面骨架修到可信基础链路，但还不是生产级 scheduler。

已完成并验证：

- `POST /v1/team/plans/:planId/runs` 只创建 `queued` run，不再 HTTP inline 执行；执行由 `ugk-pi-team-worker` 接管。
- `resume` 只恢复 queued，不偷偷在路由里执行。
- runner 抛错时 run 会进入 `failed` / `completed_with_failures`，不会卡 `running`。
- TeamUnit 创建 / 修改会校验四个 AgentProfile ID。
- Plan 创建 / 切换默认团队会校验 TeamUnit 存在且未归档。
- 活跃 Team run 会锁住 Plan、TeamUnit 和 TeamUnit 中四个 AgentProfile；AgentProfile 编辑、归档、技能安装 / 删除 / 启停、规则文件修改都会被 409 拦住。
- 本地 / 生产 compose 默认 `TEAM_USE_MOCK_RUNNER=true`；真实 runner 必须显式设置 `TEAM_USE_MOCK_RUNNER=false`。
- 生产 compose 已补 `ugk-pi-team-worker`、Team 数据挂载和 Team 环境变量。
- watcher JSON 解析失败改为 `confirm_failed`。
- finalizer 会读取 task `resultRef` 文件内容。
- `/playground/team` 对动态 API 文本做 HTML escape，并显示任务进度、耗时统计、暂停 / 恢复 / 取消入口。
- `team-plan-creator` skill 只允许创建 / 更新 TeamUnit 和 Plan，禁止创建 / 启动 Run。
- `npm run test:team` 改为串行，避免 SQLite 并发初始化随机 `database is locked`。
- 3000 端口检查：宿主监听来自 Docker backend，当前映射到 `ugk-pi-ugk-pi-1`，没有额外 Node 服务抢占；`/healthz` 返回 `{"ok":true}`。

验证记录：

- `node --test --import tsx test/team-routes.test.ts test/team-orchestrator-controls.test.ts test/team-agent-profile-runner.test.ts test/team-page-ui.test.ts test/containerization.test.ts test/team-agent-profile-locks.test.ts`：35 pass
- `npx tsc --noEmit`：通过
- `npm run test:team`：83 pass
- `npm test`：812 pass
- `git diff --check`：通过

本轮新增 / 修改的核心记录：

- `docs/change-log.md`
- `docs/team-runtime.md`
- `.codex/plans/2026-05-15-team-runtime-v2-next-agent-execution-plan.md`

## 2026-05-16 P0: 真实 Agent Session 强中断 + 端到端验证

本轮完成 P0 两项：AbortSignal 全链路传播 + `TEAM_USE_MOCK_RUNNER=false` 架构验证。

已完成并验证：

- **AbortSignal 全链路传播**：orchestrator → roleRunner → AgentProfile session，三层传播，中途 cancel/pause 能中断正在执行的 agent session。
  - `TeamOrchestrator.runToCompletion()` 内部创建 `AbortController`，链接外部 signal（来自 worker 跨进程 watcher）
  - `executeTask` / `runWorkUnit` / `runWatcherPhase` / `runFinalizer` 均接收 `signal: AbortSignal`，传入 roleRunner
  - `pauseRun()` / `cancelRun()` 写完状态后调用 `this.abortController?.abort()` 中断当前执行
- **`promptWithAbort()` 模式**：在 `AgentProfileRoleRunner` 中内联实现 `Promise.race([session.prompt(), aborted])`，abort 时先调用 `session.abort()` 再 reject
- **跨进程取消**：`team-worker` 每 2 秒轮询 run state，发现外部 cancel/pause 后触发 `AbortController.abort()`，信号经 orchestrator 传到 session
- **Mock 模式 compose 默认**：`docker-compose.yml` 和 `docker-compose.prod.yml` 静态设置 `TEAM_USE_MOCK_RUNNER=true`；真实 runner 需显式设 `false`

验证记录（2026-05-16）：

- `npx tsc --noEmit`：通过
- `npm run test:team`：90 pass
- `npm test`：819 pass
- 新增测试：
  - `test/team-orchestrator-controls.test.ts`：cancel during finalizer 不覆盖 cancelled、resume 跳过已成功 task
  - `test/team-agent-profile-runner.test.ts`：finalizer prompt 包含 resultRef 文件内容

## 2026-05-16 审计修复：stale write-back + finalizer resultRef + resume skip

本轮修复 3 个审计问题。

已完成并验证：

- **Stale write-back 防护**：`runWorkUnit`/`runWatcherPhase`/`runFinalizer` 每个 phase 返回后重新读取 run state，如果已变为 `cancelled` 或 `paused`，立即停止写回并返回。`isRunExternallyStopped()` helper 在关键写点前检查。
- **Finalizer 读取 resultRef 内容**：`AgentProfileRoleRunner.runFinalizer()` 现在用 `readRefContent()` 读取每个 task 的 `resultRef` 文件内容，传入 `buildFinalizerPrompt()`。文件不存在时 fallback 为 ref 字符串。
- **Resume 跳过 terminal task**：`runToCompletion()` 遍历 `plan.tasks` 时跳过状态为 `succeeded`/`failed`/`cancelled` 的 task，只执行 pending/interrupted/running 的 task。

验证记录（2026-05-16）：

- `npx tsc --noEmit`：通过
- `npm run test:team`：87 pass
- `npm test`：816 pass
- 新增测试：
  - `test/team-agent-profile-runner.test.ts`：abort during runWorker / abort during runChecker
  - `test/team-orchestrator-controls.test.ts`：cancelRun triggers abort / external AbortSignal aborts / pauseRun triggers abort

核心修改文件：

- `src/team/role-runner.ts` — 四个 Input 接口增加 `signal?: AbortSignal`
- `src/team/agent-profile-role-runner.ts` — `promptWithAbort()` + signal 透传
- `src/team/orchestrator.ts` — AbortController 管理 + signal 透传 + pause/cancel 触发 abort
- `src/workers/team-worker.ts` — 跨进程状态 watcher + signal 传入 orchestrator
- `test/team-agent-profile-runner.test.ts` — abort 语义测试
- `test/team-orchestrator-controls.test.ts` — 控制流 abort 测试

继续执行前先看 `.codex/plans/2026-05-15-team-runtime-v2-next-agent-execution-plan.md`。P0 已完成，剩余 P1 见下方推荐下一步。

## 2026-05-16 P1: UI 可观测性 + 文档收口 + Skill 增强 + Finalizer Fallback

本轮完成 4 个 P1 任务。

已完成并验证：

- **UI 可观测性增强**：`/playground/team` Run 列表展示 lastError、currentTaskId、summary 细分。可展开 task detail panel 显示 title/status/phase/message/attemptCount/activeAttemptId/resultRef/errorSummary。刷新按钮和 cancelled run 删除按钮。所有动态文本走 escapeHtml。8 个新 UI 测试。
- **文档收口**：`docs/team-runtime.md` 重写为纯 v2 参考文档。v0.1 域名调查历史压缩到文末归档章节。
- **Skill 增强**：`team-plan-creator` 改为交互式向导，先问目标/交付物，查已有资源，优先复用，创建前预览 JSON。明确禁止启动 Run 和编辑 .data/team。8 个静态断言测试。
- **Finalizer Fallback Report**：finalizer agent 失败时生成确定性 fallback markdown 报告，列出每个 task 的 status/resultRef/errorSummary。报告明确标注为系统生成。cancelled/paused run 不写 fallback report。lastError 保留 finalizer 错误。4 个新测试。

验证记录（2026-05-16）：

- `npx tsc --noEmit`：通过
- `npm run test:team`：113 pass
- `npm test`：未全量重跑（只改 Team 模块，不涉及其他 route/server/docker 行为）

## 当前状态

- 当前本地 HEAD：`a3ce81b fix: complete error format migration in tests and browsers.ts`
- 当前本地工作区：本快照更新时 `git status --short` 干净
- 当前 `origin/main` / `gitee/main`：以现场 `git branch -vv` 和远端状态为准；不要假设本地 `a2d962c` 已推送或已部署
- 当前稳定 tag：`snapshot-20260513-v4.5.0-stable`（在最近 7 个 team 提交之前）
- 本轮最新功能（2026-05-14 ~ 2026-05-15，共 10 个提交）：

### 核心架构变更：移除 Submit Tool 机制

这是最近最重要的变更。原来的 Team Runtime 让 agent 通过结构化 tool call（submitCandidateDomain、submitDomainEvidence 等）提交结果。实测发现 submit tool 消耗了 LLM 的注意力预算，"同样的 agent 在对话式表现更好"。

**改动**：所有 Agent profile 绑定的角色现在走"自然输出 + JSON envelope"路径——agent 跑完后一次性输出 JSON，不再有 realtime submit。

**影响文件**：
- `src/team/agent-profile-team-role-task-runner.ts`：移除 submit tool 注入，删除 `buildAgentSubmitPrompt` 和 `buildTeamSubmitToolDefinitions`，各角色（discovery/evidence/classifier/reviewer）用 `team-role-prompts.ts` 的基础 prompt + roleBox
- `src/team/role-box.ts`：CONTRACT 文本从 "submit tools" 改为 "JSON envelope output instructions"；`submitTools` 字段保留供 LLM runner 路径使用
- `src/team/team-orchestrator.ts`：删除 `createSubmitToolHandler`，`runTaskWithTimeout` 简化为直接调用 `runner.runTask(task)`，`runTaskWithoutRoleTimeout` 同理；`shouldRunRoleInBackground` 不再检查 `runTaskWithSubmitToolHandler`

**未改动的**：`src/team/team-submit.ts`、`src/team/team-submit-tools.ts`、`src/team/llm-tool-loop.ts` 保留供 LLM runner 路径使用，agent profile 路径不再调用它们。

### Pipeline 并行执行

原来的 while 循环里角色串行执行（for + await），改为 `Promise.all` 并行——只要手上有未处理的数据就可以干活。配合 `freshState` 每轮从磁盘重读状态，解决了 background task 完成后 in-memory state 不更新的 bug。

### 其他功能补充

- **Team Run 手动取消**：`POST /v1/team/runs/:teamRunId/cancel`，页面有取消按钮
- **Dockerfile 补 dnsutils**：容器内可使用 dig、nslookup
- **Team 页面角色卡**：每个角色可选择 Agent profile、编辑 role prompt
- **Discovery 专业调查员 prompt**：自动规划发现路径（搜索、CT、DNS、TLD 等）

### 主体代码核查（3 个提交）

对 Routes / Agent / Browser 主体模块（不含 Team）做全面代码核查：

1. **统一错误响应**：所有路由返回 `{ error: { code, message } }`，`http-errors.ts` 新增 `sendNotFound`/`sendConflict`/`sendNotImplemented`。
2. **死代码清理**：删除 `conn-run-store.ts` 的 `parseJson<T>`、`conn-db.ts` 重复索引、`api.ts` 未使用类型。
3. **架构去重**：SSE 基础设施统一到 `chat-sse.ts`；MIME 映射统一到 `file-route-utils.ts`；路由工具函数提取到 `agent-route-utils.ts`；路径检查 `isPathInside` 统一到一处。
4. **审计补全**：发现 5 个测试文件的断言和 `browsers.ts` 一处错误响应未迁移到新格式，全部修复并通过验证。

涉及提交：`856e253`、`f1e9863`、`a3ce81b`。

## 已知问题（2026-05-15）

### 1. Classifier 频繁 JSON 解析失败

最近一次运行 `teamrun_mp666loj_k629` 中，classifier 角色出现大量 `"Agent profile runner returned non-JSON output: JSON repair failed"` 错误（`failedRoleTasks: 13`）。

**原因分析**：Agent 没有按 JSON envelope 格式输出，可能输出了自然语言文本。`parseAgentJsonEnvelope` 在 `stripMarkdownFence` + `JSON.parse` + `repairJson` 全部失败后返回 failed。

**建议修复方向**：
- 加强 classifier prompt 的 JSON 格式约束
- 考虑在 `parseAgentJsonEnvelope` 中增加更宽松的提取逻辑（比如从文本中查找 `{` 到 `}` 的 JSON 块）
- 检查 agent profile 的 model 和 system prompt 是否与 JSON 输出兼容

### 2. Discovery Round 2 可能卡住

Discovery 绑定 Agent profile 后作为 background task 运行。移除 submit tool 后，heartbeat 机制仅依赖 session 文件 mtime。如果 agent 在长时间 API 调用中不写 session 文件，watchdog 可能误判为活跃（靠 mtime）或误判为超时（靠 heartbeat）。

**建议**：考虑在 `runBackgroundRoleTask` 中增加定期 heartbeat 更新，或者依赖 `getRoleTaskSessionActivityTime` 就够了但需要确认 agent 运行时确实会持续写 session。

### 3. 超预算未停止

`maxMinutes: 20` 的 run 实际跑了 38 分钟仍为 running。Discovery 的 session 文件持续更新让 watchdog 认为它仍然活跃。

### 4. Counters 与 Stream 不一致

state.json 中 `candidateDomains: 10` 但实际 stream 文件有 17 条。可能是并发 tick 之间的 race condition。

## 生产部署状态

腾讯云：

- Playground：`http://43.156.19.100:3000/playground`
- Health：`http://43.156.19.100:3000/healthz`
- 主部署目录：`/home/ubuntu/ugk-claw-repo`
- shared 运行态：`/home/ubuntu/ugk-claw-shared`
- 更新方式：`npm run server:ops -- tencent preflight|deploy|verify`
- 当前已知部署点：`2090fa4 Improve conn UX and mobile home scrolling`（本轮 team 提交均未部署）

阿里云：

- Playground：`http://101.37.209.54:3000/playground`
- Health：`http://101.37.209.54:3000/healthz`
- 主部署目录：`/root/ugk-claw-repo`
- shared 运行态：`/root/ugk-claw-shared`
- 更新方式：`npm run server:ops -- aliyun preflight|deploy|verify`
- 当前已知部署点：`2090fa4 Improve conn UX and mobile home scrolling`（本轮 team 提交均未部署）

发布禁区：

- 不要 `git reset --hard`
- 不要整目录覆盖服务器仓库
- 不要删除或重建 shared 运行态
- 不要执行 `docker compose down -v`
- 不要把本地 Chrome profile 复制到服务器
- 不要提交 `.env`、token、cookie、`.data/`、部署包、runtime 临时文件

## 最小阅读顺序

继续开发 Team Runtime：

1. `CLAUDE.md`（Team Runtime 章节）
2. `docs/team-runtime.md`
3. `src/team/team-orchestrator.ts` — 调度核心
4. `src/team/agent-profile-team-role-task-runner.ts` — Agent profile 角色执行器
5. `src/team/team-role-prompts.ts` — 各角色基础 prompt
6. `src/team/role-box.ts` — 角色契约包装
7. `src/team/templates/brand-domain-discovery.ts` — 域名调查模板（角色定义、stream、finalize）
8. `src/ui/team-page.ts` — Team 页面 UI
9. `src/routes/team.ts` — Team API 路由

普通 bugfix / 小功能：

1. `CLAUDE.md`
2. `docs/handoff-current.md`
3. 按模块读 CLAUDE.md 中列出的对应文档

Playground / UI：

1. `docs/playground-current.md`
2. `DESIGN.md`
3. `src/ui/playground.ts`

Conn / 后台任务 / artifact：

1. `docs/runtime-assets-conn-feishu.md`
2. `src/routes/conns.ts`

本地 Docker / 端口 / 运行态：

1. `docs/docker-local-ops.md`
2. `docker-compose.yml`

服务器发布：

1. `docs/server-ops.md`
2. `docs/server-ops-quick-reference.md`

## 当前关键事实

- 本地固定入口：`http://127.0.0.1:3000/playground`
- 本地健康检查：`http://127.0.0.1:3000/healthz`
- 默认本地启动：`docker compose up -d`
- 常规代码改动后优先：`docker compose restart ugk-pi`
- Team worker 改动后：`docker compose restart ugk-pi-team-worker`
- 涉及 Dockerfile、系统依赖或 compose 结构时才 `up --build -d`
- 双云默认发布方式是增量更新，腾讯云拉 `origin/main`，阿里云拉 `gitee/main`
- Agent profile 运行时列表以 `GET /v1/agents` 为准
- 不要手写 `.data/agents/profiles.json` 来创建、归档或修复 Agent
- 模型源当前事实看 `docs/model-providers.md` 和 `/v1/model-config`
- Chrome sidecar 登录态在 shared 运行态目录，不能被部署流程洗掉
- `TEAM_RUNTIME_ENABLED=true` 才会注册 team 路由和启动 worker
- Team worker 是独立容器 `ugk-pi-team-worker`，与主服务器 `ugk-pi` 分开重启
- 所有 `.js` 扩展名 import 是 ESM 规范（`"type": "module"`），不是笔误

## 暂时不要做

- 不要继续无目标拆 `AgentService`；当前结构已经按可测边界拆过一轮
- 不要把手机端 Playground 当桌面端压缩版改
- 不要把 Feishu 当当前主线推进，除非用户重新明确要求
- 不要动 `references/pi-mono/`，那是参考镜像，不是业务源码
- 不要动 `src/team-lab/`，那是已验证的 spike 实验，冻结
- 不要把 `.data/`、`.env`、runtime 临时产物、截图报告、部署包提交进仓库

## 推荐下一步

### P1-1: Worker Lease / Heartbeat / Crash Recovery

当前 worker 进程崩溃后，run 会永远卡在 `running`。需要：
1. Worker 启动时扫描 `running` 状态的 run，标记为 `failed` 或 `interrupted`
2. 引入 lease 机制，worker 定期续期；超时未续期的 run 自动回收
3. 配合现有的 timeout 机制形成双层保护

### P1-2: Finalizer Deterministic Fallback Report

当 finalizer agent 输出不可解析或失败时，需要生成一份确定性的兜底报告（列出每个 task 的 status/errorSummary），而非让整个 run 卡在未完成状态。

### P1-3: Team Page Observability

UI 层面补充：attempt 展开详情、checker/watcher verdict 显示、resultRef 内容浏览。当前 UI 只展示 task 级别状态。

### P1-4: Rewrite docs/team-runtime.md as Pure v2 Document

当前 `docs/team-runtime.md` 仍混合 v1 历史和 v2 描述。需要重写为纯 v2 文档，移除所有 v1 引用（submit tool、discovery/classifier 等）。

### P2: team-plan-creator Skill Enhancement

wizard 增强：交互式 task 拆分建议、acceptance criteria 模板、Plan 预览和校验。

## 最近验证记录

- 2026-05-16：`npx tsc --noEmit` 通过，`npm run test:team` 87 pass，`npm test` 816 pass
- 2026-05-15：`npx tsc --noEmit` 通过，`npm run test:team` 83 pass，`npm test` 812 pass
- 2026-05-15：`git diff --check` 通过
- 最近测试 run：`teamrun_mp666loj_k629`（keyword: medtrum），暴露了 classifier JSON 失败和 discovery 卡住问题（v1 遗留，v2 已移除相关架构）

## 交接操作清单

需要给同事准备：

- GitHub 仓库权限：`https://github.com/mhgd3250905/ugk-claw-personal.git`
- Gitee 仓库权限：用于阿里云默认拉取 `gitee/main`
- 腾讯云 SSH 权限：`ugk-claw-prod` 或 `ubuntu@43.156.19.100`
- 阿里云 SSH 权限：`root@101.37.209.54`
- 服务器 shared 运行态说明：只能保护，不能覆盖
- 本地 `.env` 获取渠道：不要通过 Git 传
- Chrome sidecar 登录态维护方式：通过 sidecar GUI / SSH tunnel，不开放公网 `3901`
