# Conn / Activity / Legacy 治理地图

日期：`2026-05-06`

这份文档服务于架构治理批次 D。目标是把 `conn` 后台任务、任务消息、output 文件、通知和 legacy 兼容层的边界写清楚。这个区域已经初步稳定，当前最危险的不是“代码不够漂亮”，而是有人看到旧字段就手痒删除，结果把后台任务、历史 run 或生产兼容链路一起带走。

## 当前结论

- `conn` 的默认投递目标是 `task_inbox`，不是前台聊天会话。
- 前台会话删除、切换、新建都不应影响已有 conn、pending run、历史 run、任务消息或 output 文件链接。
- `agent_activity_items` 是任务消息页当前主数据源；实时通知和飞书镜像只是投递层，不是结果真源。
- `workspace/output/` 是后台 run 持久产物的标准出口；`/app/public` 只保留 best-effort 收编旧输出的兼容兜底。
- `ConnTarget.type = "conversation"` 是 legacy 兼容类型，仍在 parser / store / cleanup debug 可见，不能直接删除。
- `conversation_notifications` 旧表不再是主链路，但 `/v1/debug/cleanup` 会只读统计它，用来判断旧数据风险。

## 主链路地图

### 1. Conn 定义与手动触发

- 路由入口：`src/routes/conns.ts`
- 请求解析：`src/routes/conn-route-parsers.ts`
- 展示投影：`src/routes/conn-route-presenters.ts`
- 类型定义：`src/agent/conn-store.ts`
- SQLite 存储：`src/agent/conn-sqlite-store.ts`

关键事实：

- `POST /v1/conns` 使用 `resolveDefaultTarget: true`，未传 target 时落成 `task_inbox`。
- `PATCH /v1/conns/:connId` 可更新 title、prompt、target、schedule、assetRefs、profileId、modelProvider / modelId 等运行字段。
- `DELETE /v1/conns/:connId` 和 bulk delete 在 `ConnSqliteStore` 中走软删除：设置 `deleted_at`、`status='completed'`、`next_run_at=NULL`，不是物理删除历史。
- `POST /v1/conns/:connId/run` 创建一条 `pending` run，workspace 为 `.data/agent/background/runs/<runId>` 语义下的运行目录。

### 2. Worker 执行

- Worker：`src/workers/conn-worker.ts`
- 后台 runner：`src/agent/background-agent-runner.ts`
- profile 解析：`src/agent/background-agent-profile.ts`
- workspace 管理：`src/agent/background-workspace.ts`
- run 存储：`src/agent/conn-run-store.ts`

关键事实：

- `ConnWorker.tick()` 先恢复 stale runs，再 enqueue due runs，再领取 pending run 执行。
- due run 去重按同一 `connId + scheduledAt` 防重复创建。
- worker 执行 run 时维护 heartbeat，超时会写 `run_timed_out` 事件并 abort。
- profile 不存在或已归档时，后台 run 应降级到主 Agent，并在 `resolvedSnapshot` / run event / activity 文案中显式暴露 fallback。
- worker 完成、失败、取消后才进入 activity / notification 投递；投递失败只 warn，不应改变 run 终态。

### 3. Output 文件

- 写入索引：`src/agent/background-agent-runner.ts` 的 `recordOutputFiles()`
- run 文件表：`conn_run_files`
- 路由服务：`src/routes/conns.ts`
- MIME / 下载策略：`src/routes/file-route-utils.ts`

关键事实：

- 只有写入 `workspace.outputDir` 的文件会被索引为标准 conn output。
- run 详情通过 `GET /v1/conns/:connId/runs/:runId` 返回 `files[]`，其中链接由 `toOutputFileLinks()` 补充。
- 单次产物入口：`GET /v1/conns/:connId/runs/:runId/output/<path>`。
- 最新成功产物入口：`GET /v1/conns/:connId/output/latest/<path>`。
- output 路由会校验相对路径、run 归属、`conn_run_files` 索引和 `workspacePath/output` 边界。
- `/app/public` / public URL 收编只是旧脚本兼容层：确认 public 文件存在后复制进本轮 `output/`，再走标准索引。

### 3.1 Artifact Public 目录

除了 `output/` 外，conn run 还有一个独立的官方交付目录 `artifact-public/`（`<runRoot>/artifact-public/`），用于经过验证的正式产物。

- 路由服务：`src/routes/artifacts.ts`（`registerArtifactRoutes`）
- Contract 定义：`src/agent/artifact-contract.ts`
- 产物验证：`src/agent/artifact-validation.ts`
- 修复循环：`src/agent/artifact-repair-loop.ts`
- 环境变量注入：`ARTIFACT_PUBLIC_DIR`，由 `background-agent-runner.ts` 在 run 启动时注入

关键事实：

- 当 conn 的 `artifactDelivery.enabled` 为 true 时，后台 run 会启用产物验证：扫描 `artifact-public/` 校验文件存在性、格式、敏感文件和容器路径。
- 验证不通过时自动追加修复 prompt 重试，最多 `repairMaxAttempts` 轮。
- artifact 路由独立于 output 路由：`GET /v1/conns/:connId/runs/:runId/artifacts/*`、`GET .../artifacts/latest/*` 和 `GET .../artifacts/health`。
- `artifact-public/` 是每条 run 独立的交付目录，与跨 run 共享的 `CONN_PUBLIC_DIR` 和 run 级 `output/` 各自独立，不互相替代。
- 不启用 `artifactDelivery` 的 conn 不受影响，`artifact-public/` 目录仅作为空目录存在。

### 4. Activity 与通知

- Store：`src/agent/agent-activity-store.ts`
- Route：`src/routes/activity.ts`
- Route utils：`src/routes/activity-route-utils.ts`
- 前端任务消息：`src/ui/playground-task-inbox.ts`
- Conn worker 投递：`src/workers/conn-worker.ts`

关键事实：

- `AgentActivityStore.create()` 以 `source + sourceId + runId` 做幂等保护，同一个 run 不应重复生成任务消息。
- `/v1/activity` 支持 limit、before cursor、unreadOnly 等列表语义，并返回 `unreadCount`。
- `/v1/activity/summary` 是轻量未读数兜底，保留给初始化和 badge 场景。
- activity 条目依赖 `source/sourceId/runId` 追溯到后台任务过程；这些字段丢失时应修 activity 写入或前端归一化，不要回退到 conversation transcript。
- `notificationBroadcaster` 和 `activityNotifier` 都是 best-effort；Feishu 镜像失败不能影响 activity 写入或 run 终态。

### 5. Cleanup Debug

- 路由：`src/routes/cleanup-debug.ts`
- 入口：`GET /v1/debug/cleanup`

当前观测项：

- conn target 类型统计：`task_inbox`、`conversation`、`feishu_chat`、`feishu_user`、`invalid`
- 旧 `conversation_notifications` 总量和 conn 来源数量
- 最近 run 的 activity 覆盖率
- 最近 run 的 output file 覆盖率
- succeeded run 缺 output 索引风险

这条 debug 路由是 legacy 删除前的硬闸门。别拿“我搜了一下没看到调用”当删除依据，那种自信一般只适合删自己的临时代码。

## Legacy 决策表

| 对象 | 当前状态 | 保留原因 | 删除或迁移条件 |
| --- | --- | --- | --- |
| `ConnTarget.type = "conversation"` | 类型仍存在，旧请求仍可显式传入 | 兼容旧 conn / 旧工具 / 历史数据读取 | `/v1/debug/cleanup` 连续确认 active conversation target 为 0，并给历史 conn 明确迁移或废弃策略 |
| `conversation_notifications` | 主链路不写，只读统计 | 判断旧通知残留是否仍影响用户 | cleanup debug 显示 conn source 残留为 0，且生产库确认不再需要追溯 |
| `/v1/activity/summary` | 保留轻量未读数接口 | 初始化 badge / 轻量刷新成本低 | 前端全部切到 `/v1/activity` 或通知流并有测试覆盖后再评估 |
| `/app/public` output 收编 | 保留 best-effort 兼容 | 兜底旧脚本或模型手写 public 链接 | 生产 cleanup 连续确认 succeeded run 均有 output 索引，且旧脚本全部改写到 `OUTPUT_DIR` |
| `modelPolicyId` | UI 不再手写，底层兼容 | 旧任务和旧策略字段仍可能存在 | 所有旧 conn 迁移到 `modelProvider/modelId` 或确认不用 |
| `agentSpecId/skillSetId/upgradePolicy` | 后台 registry 兼容字段 | 保留背景能力快照兼容 | 新 profile / skill snapshot 机制完全替代并有迁移脚本 |
| Feishu activity mirror | 可选镜像 | 用户可能依赖群聊或私聊提醒 | 不能删除；除非 Feishu 集成整体退役 |

## 不要做的事

- 不要把 `conn_runs`、`conn_run_events`、`conn_run_files` 当成可随 conn 删除的附属缓存。
- 不要把任务结果写回前台 conversation transcript 作为默认投递方式。
- 不要让 worker 重新直接写 `/app/public` 当主输出目录。
- 不要让模型正文里的 URL 成为 output 事实来源；事实以 `conn_run_files` 和平台路由为准。
- 不要把 Feishu 通知失败升级成 run 失败。
- 不要在没有 cleanup debug 证据时删除 `conversation` target、旧通知统计或 model legacy 字段。
- 不要只看 `/healthz` 验证后台任务。`/healthz` 只能说明服务还喘气，不能说明产物链路、activity 和 output 链路通。

## 低风险治理队列

### P0：观测与文档

- 保留并使用 `GET /v1/debug/cleanup?since=<ISO time>` 做修复后窗口化验收。
- 在涉及 conn / activity 的变更中固定引用本治理地图和 `docs/runtime-assets-conn-feishu.md`。
- 对生产验收继续使用 `npm run server:ops -- <target> verify` 加 cleanup debug，而不是只看健康检查。

### P1：测试防护

- 新增或修改 conn route 时跑：
  - `node --test --import tsx test/conn-route-presenters.test.ts test/conn-sqlite-store.test.ts test/conn-run-store.test.ts`
- 修改 worker / output / activity 时跑：
  - `node --test --import tsx test/conn-worker.test.ts test/cleanup-debug.test.ts`
- 修改 activity route 或任务消息投影时跑：
  - `node --test --import tsx test/activity-route-utils.test.ts test/conn-worker.test.ts`
- 修改 Feishu 镜像时跑：
  - `node --test --import tsx test/feishu-service.test.ts test/feishu-http-agent-gateway.test.ts test/feishu-ws-subscription.test.ts`

### P2：需要再次确认后才动代码

- 如果要真正迁移 legacy `conversation` target，应先写迁移计划和回滚策略，再跑 cleanup debug 对比。
- 如果要收口 `/app/public` 兼容层，应先查最近成功 run 是否仍有模型正文 public 链接收编记录。
- 如果要合并或拆分 `ConnWorker.deliverRunResult()`，必须保证 activity 幂等、notification best-effort 和 Feishu mirror failure isolation 不变。

## 最小验证矩阵

| 改动范围 | 最小验证 |
| --- | --- |
| 纯文档治理 | `git diff --check` |
| conn route / parser / presenter | `git diff --check` + `node --test --import tsx test/conn-route-presenters.test.ts test/conn-sqlite-store.test.ts` |
| run store / output | `git diff --check` + `node --test --import tsx test/conn-run-store.test.ts test/conn-worker.test.ts` |
| activity | `git diff --check` + `node --test --import tsx test/activity-route-utils.test.ts test/conn-worker.test.ts` |
| cleanup debug | `git diff --check` + `node --test --import tsx test/cleanup-debug.test.ts` |
| Feishu worker / gateway | `git diff --check` + 对应 `feishu-*` 测试 |
| 发布候选 | `git diff --check` + `npx tsc --noEmit` + `npm test` + 目标服务器 `server:ops verify` |

## 下一步建议

批次 D 到这里保持文档治理即可。下一批建议进入批次 E：评估 `Agent / Chat` 主路由和 scoped agent wrapper 的重复边界。那一批仍应以“识别可抽薄的 adapter”为主，不要一上来强拆 `AgentService.runChat()`，这个函数虽然长，但它握着一条 run 的生命周期。
