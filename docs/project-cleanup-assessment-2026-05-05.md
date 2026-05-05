# 项目脉络与旧功能清理评估（2026-05-05）

这份评估记录本轮 conn worker 会话解耦、HTML output 链接修复和阿里云增量发布后的项目状态。目标不是立刻删代码，而是把“主链路是什么、哪些只是兼容层、哪些已经容易误导”摆清楚。否则继续靠聊天记忆维护，迟早把旧路当新路，挺离谱。

## 当前主链路

- 前台 Playground：一个 agent profile 对应多条聊天会话，当前会话由服务端 catalog 管理，`GET /v1/chat/state` 是 canonical state 真源。
- 后台 conn：`POST /v1/conns` 未传 `target` 时默认 `{ "type": "task_inbox" }`；后台 run 的身份是 `connId + runId + workspace + resolvedSnapshot`，不再依赖前台 `conversationId`。
- conn 结果投递：终态结果写入 `agent_activity_items`，前端任务消息页读取 `/v1/activity`；全局通知和飞书通知镜像同一 activity。
- conn 文件产物：唯一持久出口是 run workspace 的 `output/` 和 `conn_run_files` 索引；标准访问入口是 `/v1/conns/:connId/runs/:runId/output/<path>` 与 `/v1/conns/:connId/output/latest/<path>`。
- HTML output：后端 `text/html` 默认 `inline`，前端文件卡片也应展示“打开”；显式下载使用 `?download=1`、`?download=true` 均可。
- web-access：生产默认 Docker Chrome sidecar + direct CDP；Windows host IPC 只作为 legacy 本机调试 fallback。
- agent profile：运行态以 `/v1/agents` 和 `.data/agents/<agentId>/AGENTS.md` 为准；仓库根 `AGENTS.md` 只服务维护本仓库的 coding agent。

## 本轮已收口

- 阿里云生产已增量更新到 `48db6b8 Fix conn HTML output links`，`server:ops aliyun verify` 通过。
- `AGENTS.md` 与 `docs/aliyun-ecs-deploy.md` 已更新阿里云当前基线，避免继续拿 `05c3b59` 或更早的阿里云基线当现状。
- 任务消息 / transcript 共用的文件卡片 `canPreviewFile()` 已补上 `text/html`，不再出现后端能 inline、前端却不给“打开”的半截修复。
- 新增只读体检接口 `GET /v1/debug/cleanup`，用于查看 conn target 分布、旧 `conversation_notifications` 表残留、最近 7 天 run 与 activity/output 的对齐情况。这个接口只读，不迁移、不删除、不修复数据。

## 体检接口

`GET /v1/debug/cleanup` 返回：

- `connTargets.total / active / byType`：统计未软删除 conn 的 target 类型分布，重点看 `conversation` 和 `invalid`。
- `legacyConversationNotifications.total / connSourceTotal / latestCreatedAt`：判断旧会话通知表是否仍有 conn 残留。
- `recentRuns`：最近 7 天 run 的状态分布，以及是否存在 task inbox activity 和 output 文件索引。
- `recentRuns.succeededWithoutOutputFiles / failedWithoutOutputFiles / cancelledWithoutOutputFiles`：按终态拆分缺少 output 文件索引的 run。失败或取消任务没有 output 通常不应算产物链路风险。
- `risks[]`：把可疑项转成可读提示。`ok=false` 不代表服务坏了，只代表仍有清理风险或遗留数据需要评估。output 文件风险只对 `succeededWithoutOutputFiles > 0` 报警，避免把失败任务也当作产物链路问题。
- 可选 `?since=<ISO time>`：只统计指定时间之后的 run，用来排除修复前的历史假成功 / 无产物旧账。未传时仍使用最近 7 天窗口。

本地查看：

```bash
curl http://127.0.0.1:3000/v1/debug/cleanup
```

阿里云查看：

```bash
curl http://101.37.209.54:3000/v1/debug/cleanup
```

只看某个修复时间之后的腾讯云状态：

```bash
curl "http://43.134.167.179:3000/v1/debug/cleanup?since=2026-05-05T06:00:00.000Z"
```

## 保留但必须标记为 legacy 的兼容层

### Legacy 清理决策表

这张表是后续清理的准绳：先标记、再观测、最后才删除。不要一看到 `legacy` 就手痒删代码，线上旧数据和旧配置不会因为你心情好就自动迁移。

| 对象 | 当前状态 | 当前决策 | 禁止事项 | 可删除 / 迁移条件 |
| --- | --- | --- | --- | --- |
| `ConnTarget.type = "conversation"` | 后端仍兼容解析，前端主入口不再暴露 | 标记 deprecated，保留读取兼容 | 新文档、新 UI、新 agent prompt 不得推荐填写 conversation target | `/v1/debug/cleanup` 显示 active conversation target 为 0，且历史 conn 已迁移或确认可废弃 |
| `conversation_notifications` / `ConversationNotificationStore` | 旧会话通知表仍在 schema 和清理逻辑中 | 标记 legacy data path，保留删除清理和迁移兼容 | 不得把 conn 结果重新写回 conversation notification | 调用链确认只剩测试 / 删除清理；历史数据已有迁移或明确归档策略 |
| `agent_activity_items` | 当前任务消息主链路 | 保持主链路 | 不得用 conversation transcript 替代后台任务结果读模型 | 不适用，当前不可删 |
| Feishu `mapped` mode | 兼容模式仍保留 | 标记 compatibility mode，默认仍是 current mode | 不得把每个飞书群默认映射成本地 conversation | 线上确认无 `mapped` 配置，且有替代隔离策略 |
| legacy subagent `.pi/agents` | 旧 scout / planner / worker / reviewer 链路仍可能被 prompt / skill 引用 | 保留，明确区别于 Playground agent profile | 用户说“agent”时不得默认解释成 `.pi/agents` subagent | profile dispatch 覆盖旧 chain 能力，且项目级 prompt / skill 不再引用 legacy subagent |
| Windows host IPC fallback | 本机 legacy 调试兜底 | 保留 fallback | 不得写成生产默认浏览器链路 | Docker Chrome sidecar 在本机和生产排障上完全覆盖 IPC 需求 |
| `/playground/reset` | runtime factory reset | 保留但明确语义 | 不得宣传为源码热更新或完整会话重置 | 如果 runtime 外部化机制改造完成并有替代入口，再评估删除 |

### 1. `ConnTarget.type = "conversation"`

现状：`src/routes/conn-route-parsers.ts` 仍接受 `target.type === "conversation"`，`.pi/extensions/conn` 测试也覆盖显式 conversation target。

评估：这是兼容旧定义和旧工具调用需要，不应在没有迁移统计前硬删。但它已经不是新建默认路径，worker 结果主投递也不走 conversation transcript。

建议：保留解析，文档和前端都不要再推荐用户填写 conversation target。下一步可以加管理页标识“legacy target”，并统计线上是否还有 conversation target 的 active conn。

### 2. `conversation_notifications` 表与 `ConversationNotificationStore`

现状：SQLite schema、store 和测试仍存在；当前 conn 终态结果主链路已转到 `agent_activity_items`。搜索结果显示生产路径主要只在删除 conn 时清理 `conversation_notifications`，没有看到新的 conn worker 写入该表。

评估：这基本是旧“按会话投递通知”的遗留读写模型。直接删表不划算，可能影响历史数据和迁移测试；但继续把它当主能力会误导排障。

建议：短期保留 schema 和删除清理；中期做一次迁移评估，确认没有 UI/API 依赖后，将 store 标注 deprecated，测试改成迁移兼容测试而不是主功能测试。

### 3. `GET /v1/activity/summary`

现状：`GET /v1/activity`、单条已读和全部已读响应都已经携带 `unreadCount`；前端仍在初始化/轻量同步时调用 `/v1/activity/summary`。

评估：这不是错误功能，是轻量兜底接口。风险在于新代码若打开任务消息后再固定补打一跳 summary，会退回旧的双请求体验。

建议：保留接口，但新增代码只在初始化 badge 或极轻量同步时使用；列表场景以 `/v1/activity` 的 `unreadCount` 为准。

### 4. Feishu `mapped` conversation mode

现状：默认是 `current conversation mode`；`mapped` 模式仍有 resolver、store 和测试。

评估：兼容层合理，但默认主链路已经不是“每个飞书群映射一个本地 conversation”。如果文档或 agent 继续按 mapped 讲，会造成会话错位预期。

建议：继续保留到确认没有线上使用；设置页和文档里必须明确 `mapped` 是兼容模式。

### 5. Legacy subagent `.pi/agents`

现状：项目同时存在 agent profile / operation window 和 `.pi/agents` legacy subagent。`agent-profile-ops` 已经明确优先解析 agent profile，再兼容 legacy subagent。

评估：不要现在删除。很多项目级 prompt 和 skill 仍会提到 `scout/planner/worker/reviewer`。真正的问题是术语混乱：用户说“agent”时默认应指 `/v1/agents`，不是 legacy subagent。

建议：保留 legacy subagent 文件；持续避免把 agent profile 叫“子 Agent”。等 profile dispatch 能稳定替代 legacy chain 后，再规划迁移。

### 6. Windows host IPC fallback

现状：web-access 默认 direct CDP，host IPC 仍保留脚本、测试和文档。

评估：这是本机紧急调试 fallback，不是生产主路径。保留没问题，删除会让本地排障少一个兜底。

建议：保持“legacy fallback”定位，禁止任何新技能或新文档把它写成默认浏览器链路。

### 7. `/playground/reset` 与运行时 UI 外部化

现状：`/playground/reset` 只恢复 `runtime/playground/`，不重新加载 `src/ui/` TypeScript 模块。

评估：功能本身没错，但名字很容易让人误以为“源码热更新重置”。这已经在文档里说明，仍属于高误解点。

建议：保留接口；UI 或文档里继续强调它是 runtime factory reset，不是源码热重载。

## 当前发现的文档风险

- 长部署手册包含大量历史记录，例如 archive 小包、DeepSeek Flash 下架、旧目录等。它们用于追溯是有价值的，但不能作为当前操作入口。
- 当前应优先读 `docs/server-ops.md` 和 `docs/server-ops-quick-reference.md`；单云长手册只在迁移、回滚或异常排障时展开。
- `docs/aliyun-ecs-deploy.md` 的当前基线已更新到 `48db6b8`；腾讯云没有在本轮发布到 `48db6b8`，不要默认双云同步。

## 建议的后续清理顺序

1. 为 conn target 增加线上统计或 debug 输出：按 `task_inbox / conversation / feishu_*` 汇总 active conn 数量。
2. 如果 `conversation` target 数量为 0 或可迁移，先在 API 文档标记 deprecated，再考虑前端隐藏该入口。
3. 对 `ConversationNotificationStore` 做调用链审计：如果只剩测试和删除清理，把主功能测试改成 legacy migration 测试。
4. 给文件卡片增加更直接的 HTML output 回归测试：activity `files[]` 里 `text/html` 应展示“打开”和“下载”。
5. 清理长手册首页：历史记录保留，但“当前快照”和“固定流程”必须永远在顶部，别让后来的人从 4 月旧命令开始复制。

## 结论

当前项目不是缺功能，而是迁移层太多：conversation 投递、task inbox、activity、Feishu current/mapped、agent profile、legacy subagent、sidecar/IPC 都叠在一起。现阶段不要大刀阔斧删兼容层，先做“主链路强约束 + legacy 可观测 + 文档明确降级”。否则删得爽，线上旧数据第一个不答应。
