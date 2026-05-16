# Team Runtime v2 P3/P7 执行计划：真实 runner 输出可靠性 + phase timeout

更新时间：2026-05-16

## 0. 当前基线

接手前必须确认当前仓库已经包含以下提交：

- `831bddb feat: add team worker run leases`

当前已完成能力：

- P0：cancel / pause / resume 全链路 abort。
- P1：`/playground/team` 基础 UI、文档、`team-plan-creator` skill。
- P1.5：SSE 实时刷新 + attempt 详情。
- P2：worker run lease / heartbeat / stale running recovery。
- checker/watcher 已有基础 JSONish fallback。
- progress 阶段推进和 attempt 状态写回已补。

当前已验证：

- `npm run test:team`：145 pass。
- `npx tsc --noEmit`：通过。
- `git diff --check`：通过。
- 真实 run smoke：`run_7ad056e1a832` completed，`lease=null`，`final-report.md` 已生成。

## 1. 铁律

- 不要碰 untracked `.pi/skills/*` 和 `skills-lock.json`。
- 不要直接编辑 `.data/team`。
- 不要部署服务器。
- 不要做多 run 并发。
- 不要重构整个 Team Runtime。
- 不要改 Dockerfile / docker-compose，除非本计划明确要求。
- 每个阶段小提交，不要一个巨大 commit 糊完。
- 完成后先停，等待审核，不要继续做 P4/P5/P6。

## 2. 本轮目标

本轮只做两件事：

1. P3：真实 runner 输出可靠性。
2. P7-1/P7-2：phase timeout + 真实 duration 记录。

成功标准：

- checker/watcher prompt 明确要求严格 JSON。
- checker/watcher 解析结果经过结构校验。
- JSONish fallback 保留，但边界清楚。
- worker/checker/watcher/finalizer 都有 phase timeout。
- timeout 能 abort 底层 Agent session，并且 run/task 能收口，不长期停在 `running`。
- timing span 记录真实耗时，不再大量 `durationMs: 0`。
- `npm run test:team`、`npx tsc --noEmit`、`git diff --check` 全通过。

## 3. 文件入口

优先阅读和修改这些文件：

- `src/team/agent-profile-role-runner.ts`
- `src/team/orchestrator.ts`
- `src/team/run-workspace.ts`
- `src/team/timing.ts`
- `src/team/types.ts`
- `src/team/routes.ts`
- `src/workers/team-worker.ts`
- `src/config.ts`
- `test/team-agent-profile-runner.test.ts`
- `test/team-orchestrator-controls.test.ts`
- `test/team-orchestrator-failure.test.ts`
- `test/team-run-workspace.test.ts`
- `docs/team-runtime.md`
- `docs/change-log.md`

不要一上来全仓乱翻。

## 4. P3：真实 runner 输出可靠性

### 4.1 背景

真实 checker 曾输出类似内容：

```json
{"verdict":"pass","reason":"符合"连续3次问好"的核心目标","resultContent":"..."}
```

这不是严格 JSON，因为 `reason` 内部有裸双引号。

当前已经有 JSONish fallback，但这只是容错，不是推荐格式。本阶段要让模型输出更稳，解析更严格，失败更可解释。

### 4.2 强化 checker / watcher prompt

修改文件：

- `src/team/agent-profile-role-runner.ts`

修改函数：

- `buildCheckerPrompt()`
- `buildWatcherPrompt()`

prompt 必须明确要求：

- 只输出一个 JSON object。
- 不要输出 markdown。
- 不要输出解释文字。
- 不要在 JSON 前后添加任何文字。
- 字符串内部如果需要双引号，必须转义为 `\"`。
- 顶层必须是 JSON object。
- checker 的 `verdict` 只能是 `pass` / `revise` / `fail`。
- watcher 的 `decision` 只能是 `accept_task` / `confirm_failed` / `request_revision`。

checker prompt 建议补充：

```text
输出必须满足：
- 顶层必须是 JSON object
- verdict 必须是 "pass"、"revise" 或 "fail"
- reason 必须是 string
- resultContent / feedback 如存在必须是 string
- 字符串中的双引号必须写成 \"
- 不要在 JSON 前后添加任何文字
```

watcher prompt 同理。

### 4.3 结构校验 parsed checker / watcher output

修改文件：

- `src/team/agent-profile-role-runner.ts`

新增或等价实现：

- `normalizeCheckerOutput(parsed): CheckerOutput`
- `normalizeWatcherOutput(parsed): WatcherOutput`

checker 校验规则：

- `verdict` 不在 `pass/revise/fail` 中，视为 parse error。
- `reason` 非 string 时，使用空字符串或 parse error，选择一种并保持测试一致。
- `verdict=revise` 时，如果 `feedback` 缺失，给默认反馈，例如 `checker requested revision`。
- `verdict=pass/fail` 时，`resultContent` 可选。

watcher 校验规则：

- `decision` 不在 `accept_task/confirm_failed/request_revision` 中，视为 parse error。
- `revisionMode` 只允许 `amend/redo`；非法则忽略或默认 `amend`。
- `request_revision` 时，如果 `feedback` 缺失，给默认反馈，例如 `watcher requested revision`。
- `reason` 非 string 时，使用空字符串或 parse error，选择一种并保持测试一致。

注意：

- 不要让 `{"verdict":"PASS"}` 被误判成功，除非你明确做大小写兼容并补测试和文档。
- 更推荐严格小写。

### 4.4 保留 JSONish fallback，但明确边界

修改文件：

- `src/team/agent-profile-role-runner.ts`
- `docs/team-runtime.md`

要求：

- 标准格式仍然是严格 JSON。
- JSONish fallback 只处理常见模型瑕疵，比如字符串字段中未转义中文引号。
- JSONish fallback 不保证修复任意坏 JSON。
- 解析失败时：
  - checker 返回 `verdict=fail`，`reason=checker output parse error`。
  - watcher 返回 `decision=confirm_failed`，`reason=watcher output parse error`。

### 4.5 P3 测试

修改文件：

- `test/team-agent-profile-runner.test.ts`

至少新增测试：

1. checker prompt 包含“字符串双引号必须转义”的约束。
2. watcher prompt 包含“字符串双引号必须转义”的约束。
3. checker 能解析带裸中文引号的 JSONish 输出：

```json
{"verdict":"pass","reason":"符合"连续3次问好"的核心目标","resultContent":"验收通过"}
```

4. checker 非法 verdict 会降级为 fail parse error：

```json
{"verdict":"ok","reason":"bad"}
```

5. watcher 非法 decision 会降级为 confirm_failed parse error。
6. watcher `request_revision` 缺 `feedback` 时有默认 feedback，或者明确按 parse error 处理。
7. fenced JSON、混合文本、bare JSON 原有测试不能退化。

## 5. P7-1：phase timeout

### 5.1 背景

当前已有 run 级 timeout，但缺少 phase 级 timeout。真实 run 中 watcher 阶段明显偏长，后续 worker/checker/watcher/finalizer 任一阶段都可能卡住。

目标：

- 某个 phase 卡住时自动 abort。
- run/task 状态能收口。
- cancel/pause 仍优先于 timeout，不被 timeout 覆盖。

### 5.2 新增 timeout 配置

修改文件：

- `src/config.ts`
- `src/team/orchestrator.ts`
- `src/team/routes.ts`
- `src/workers/team-worker.ts`
- `docs/team-runtime.md`

推荐新增环境变量：

- `TEAM_WORKER_PHASE_TIMEOUT_MS`，默认 `600000`，10 分钟。
- `TEAM_CHECKER_PHASE_TIMEOUT_MS`，默认 `300000`，5 分钟。
- `TEAM_WATCHER_PHASE_TIMEOUT_MS`，默认 `300000`，5 分钟。
- `TEAM_FINALIZER_PHASE_TIMEOUT_MS`，默认 `300000`，5 分钟。

如果实现复杂度过高，可以先做统一变量：

- `TEAM_PHASE_TIMEOUT_MS`，默认 `600000`。

但更推荐四个变量，因为 worker 真实任务通常比 checker/watcher 长。

### 5.3 TeamOrchestratorOptions

修改 `TeamOrchestratorOptions`，增加 phase timeout 配置，例如：

```ts
phaseTimeouts: {
  workerMs: number;
  checkerMs: number;
  watcherMs: number;
  finalizerMs: number;
}
```

要求：

- `src/workers/team-worker.ts` 创建 `TeamOrchestrator` 时从 config 传入。
- `src/team/routes.ts` 创建 `TeamOrchestrator` 时也传入默认配置。
- 所有测试里手动 new `TeamOrchestrator` 的地方都要补齐，或提供默认值 helper，避免几十处重复。

### 5.4 runWithTimeout helper

建议在 `orchestrator.ts` 内新增 helper：

```ts
async function runWithTimeout<T>(
  phase: string,
  timeoutMs: number,
  parentSignal: AbortSignal,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T>
```

行为要求：

- parent signal abort 时，local controller 跟随 abort。
- timeout 到时 abort local controller。
- timeout 抛出 `Error("${phase} timeout")`。
- finally 清理 timer 和 listener。
- 传给 roleRunner 的必须是 local signal，而不是原始 signal。

接入点：

- `roleRunner.runWorker()`
- `roleRunner.runChecker()`
- `roleRunner.runWatcher()`
- `roleRunner.runFinalizer()`

注意：

- 现有 roleRunner input 已经支持 `signal`。
- 不要破坏 cancel/pause 的 abort 语义。

### 5.5 timeout 后状态收口

要求：

worker timeout：

- 当前 task 标记 failed。
- `errorSummary` 写 `worker timeout` 或 `${phase} timeout`。
- progress phase 进入 `failed`。
- run 最终 `completed_with_failures` 或 `failed`，沿用现有汇总规则。

checker timeout：

- 当前 workUnit 视为 failed。
- 写 `failed-result.md`。
- `errorSummary = checker timeout`。

watcher timeout：

- 不要无限挂住。
- 简单策略：视为 `confirm_failed`，`reason=watcher timeout`。

finalizer timeout：

- 使用 deterministic fallback report。
- run 状态 `completed_with_failures`。
- `lastError=finalizer timeout`。

cancel/pause 优先级：

- 如果 cancel/pause 已经把 run 变成 `cancelled/paused`，timeout 返回后不得覆盖状态。
- 这点必须有测试。

## 6. P7-2：真实 duration 记录

### 6.1 背景

现在 `timings.jsonl` 里很多 span 是：

```json
{"durationMs":0}
```

这对排障没用。

### 6.2 修改要求

修改文件：

- `src/team/orchestrator.ts`
- `src/team/timing.ts` 如需要

要求：

- worker/checker/watcher/finalizer phase 的 `startedAt` / `finishedAt` / `durationMs` 使用真实时间。
- 不要继续写 `startedAt=now`、`finishedAt=now`、`durationMs=0`。
- timeout / abort 时也尽量写 timing span。
- 如果不改 timing schema，至少 `durationMs` 要真实。

建议模式：

```ts
const started = new Date();
try {
  ...
} finally {
  const finished = new Date();
  await writeTimingSpan(this.dataDir, {
    runId,
    taskId,
    attemptId,
    phase,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationMs: finished.getTime() - started.getTime(),
  });
}
```

## 7. P7 测试

至少新增/更新：

1. worker timing duration 记录真实耗时。
2. checker timing duration 记录真实耗时。
3. watcher timing duration 记录真实耗时。
4. 使用 fake runner 延迟 20ms，验证 `durationMs >= 15`。
5. checker timeout 会写 failed state，不会卡 running。
6. watcher timeout 会收口，不会卡 running。
7. finalizer timeout 写 fallback report。
8. cancel/pause 仍然优先于 timeout，不会被 timeout 覆盖。

建议测试文件：

- `test/team-orchestrator-timeout.test.ts`
- 或追加到 `test/team-orchestrator-controls.test.ts`，但别把单文件搞得太臃肿。

## 8. 文档要求

必须更新：

- `docs/team-runtime.md`
- `docs/change-log.md`

`docs/team-runtime.md` 至少补：

- checker/watcher 标准 JSON 输出格式。
- JSONish fallback 的边界。
- phase timeout 环境变量。
- timing span 现在记录真实耗时。
- 已知限制：fallback 不是通用 JSON 修复器。

`docs/change-log.md` 新增 2026-05-16 条目：

- 主题：P3/P7 输出可靠性和 phase timeout。
- 影响文件。
- 测试结果。

## 9. 验收命令

必须跑：

```bash
npm run test:team
npx tsc --noEmit
git diff --check
```

如果改动范围较大，额外跑：

```bash
npm test
```

如果 `npm test` 太慢或因为非本轮问题失败，必须说明失败点，以及是否与本轮相关。

## 10. 最终回复格式

完成后回复：

1. commit hash
2. 改动摘要
3. 新增/修改文件列表
4. 新增测试列表
5. 验证结果
6. 已知限制
7. 是否需要重启 `ugk-pi` / `ugk-pi-team-worker`

## 11. 禁止继续做的内容

本轮完成后停止，不要继续做：

- P4 Team UI 可用性完善
- P5 attempt 生命周期重建
- P6 多 run 并发
- 生产部署
- Dockerfile / compose 改造

做完后等待审核。
