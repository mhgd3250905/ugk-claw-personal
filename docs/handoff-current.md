# 当前交接总览

更新时间：`2026-04-27`

这份文档给下一位接手 `ugk-pi / UGK CLAW` 的 agent 看。先读这里，再读 `AGENTS.md` 和追溯地图。别靠聊天记录拼现状，聊天记录会骗人，仓库里的事实比较不会装。

## 当前结论

- 代码主仓库：`https://github.com/mhgd3250905/ugk-claw-personal.git`
- 主分支：`main`
- 当前本地 / GitHub 最新提交：`caa2eac Record production deploy to 46088a0`
- 当前生产运行代码提交：`46088a0 Refresh current handoff docs`
- 说明：`caa2eac` 只是生产发布记录文档提交，没有重新部署到服务器；服务器当前运行代码保持在 `46088a0`
- 上一轮架构整理代码落点：`524fb71 Extract assistant run result checks`
- 本轮架构整理前备份 tag：`backup-pre-architecture-cleanup-20260426`
- 云端正式入口：`http://43.134.167.179:3000/playground`
- 云端健康检查：`http://43.134.167.179:3000/healthz`
- 服务器主部署目录：`~/ugk-claw-repo`
- shared 运行态目录：`~/ugk-claw-shared`
- 最近一次生产回滚 tag：`server-pre-deploy-20260426-234533`
- 最近一次 sidecar 备份：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260426-234533.tar.gz`
- 服务器更新方式：默认且本次明确为“增量更新”，不要整目录替换
- 当前未跟踪 runtime 文件不要顺手提交：`runtime/commit-playground-asset-detail-hydration.ps1`、`runtime/pudong-weather.md`、`runtime/zhihu-collection-ai-agent-summary.md`

## 最近已完成

这一轮已经完成一批“低风险、小切片、可测试”的整理，核心目标是减少胖文件和隐性坏数据风险：

- 路由 parser / presenter / SSE helper 拆分：chat、conn、activity、notification、files。
- `AgentService` 继续瘦身：会话 catalog、conversation commands、context loading、session lifecycle、queue message、run scope、run result、terminal snapshot、event buffering 等逻辑已经拆到独立 helper。
- playground 运行时代码继续模块化：page shell、base styles、status、notification、confirm dialog、panel focus、conversation API / sync / state / history pagination / process controller、active run normalizer。
- conn run 租约防护：过期 worker 不能迟到写入终态、runtime metadata、events 或 output files。
- 数据索引读边界加固：`ConversationStore`、`AssetStore`、session JSONL 全量读取都已经补回归测试，坏索引 / 坏 JSONL 行不会直接拖垮页面恢复。
- 资产库并发写入、会话索引写入、Feishu map 并发写入都已有串行队列和原子替换防护。注意：Feishu 后续现阶段不继续做。

关键提交从 `backup-pre-architecture-cleanup-20260426` 到 `524fb71` 可查：

```bash
git log --oneline backup-pre-architecture-cleanup-20260426..HEAD
```

## 当前测试状态

最近一轮完整验证口径：

- `git diff --check`
- `npx tsc --noEmit`
- `docker compose -f docker-compose.prod.yml config --quiet`
- `npm test`

截至最近一次全量测试，测试总数为 `404`，通过 `404`，跳过 `0`。上一版交接提到的两个 `test.skip` 已处理：一个是过时断言，另一个是重复覆盖；SQLite / JSON 字段边界也已完成一轮非 Feishu 区域加固。本轮新增了 `test/agent-queue-message.test.ts` 的 3 个队列消息 helper 用例和 `test/agent-conversation-commands.test.ts` 的 5 个会话命令 helper 用例，已纳入 `npm test` 全量验证。

最近一次生产验收：

- 服务器从 `9d3cb37` fast-forward 到 `46088a0`
- `ugk-pi`、`nginx`、`ugk-pi-browser` 均 healthy
- 内网 / 公网 `/healthz` 返回 `{"ok":true}`
- 内网 / 公网 `/playground` 返回 `200 OK`
- `check-deps.mjs` 返回 `host-browser: ok` 与 `proxy: ready`
- 发布中 nginx 曾短暂 `502`，已按手册 `up -d --force-recreate nginx` 恢复

## 下一步建议

如果你是用户刚点了新会话后重新 `/init` 的新 agent，先别急着开工。先确认：

1. `git status --short` 里只有上面列出的 runtime 临时文件，或者先处理它们。
2. 不要重新部署 `caa2eac`，它只是发布记录文档；生产已经运行 `46088a0`。
3. SQLite / JSON 字段边界本轮已扫完，`AgentService.queueMessage()` 已经抽到 `src/agent/agent-queue-message.ts`，新建 / 删除 / 切换 / 重置会话命令也已经抽到 `src/agent/agent-conversation-commands.ts`；下一步如果继续做架构整理，优先从 `AgentService.runChat()` 周边找真正可测的窄边界，别继续堆“为了拆而拆”的文件。

### 1. 已完成的 SQLite / JSON 字段边界

本轮覆盖非 Feishu 区域：
- [src/agent/agent-activity-store.ts](/E:/AII/ugk-pi/src/agent/agent-activity-store.ts)
- [src/agent/conversation-notification-store.ts](/E:/AII/ugk-pi/src/agent/conversation-notification-store.ts)
- [src/agent/conn-sqlite-store.ts](/E:/AII/ugk-pi/src/agent/conn-sqlite-store.ts)
- [src/agent/conn-run-store.ts](/E:/AII/ugk-pi/src/agent/conn-run-store.ts)
- [src/routes/activity.ts](/E:/AII/ugk-pi/src/routes/activity.ts)

已加固点：
- `ConversationNotificationStore.create()` 遇到同源 run 并发唯一冲突时回读已有通知。
- `ConnSqliteStore.list()` / `get()` 遇到坏 JSON conn 行时跳过 / 返回空，不拖垮列表或详情。
- `ConnRunStore` 读取坏 `resolved_snapshot_json` / `event_json` 时降级为空对象或省略字段；完成 run 时如果 owning conn 的 `schedule_json` 已坏，仍能终结 run，并把 conn 收到 completed。
- conn、run、notification、activity 查询补稳定 tie-breaker；`GET /v1/activity` 的 `nextBefore` 现在是不透明游标 `createdAt|activityId`，旧 timestamp-only `before` 入参仍兼容。

### 2. 继续拆 `AgentService` 剩余编排代码

不要为了拆而拆。只拆能让行为更可测、职责更清晰的片段。优先选择有纯函数边界、能补单测的 helper。已经拆过的模块不要重复造第二套名字。

本轮已新增：

- [src/agent/agent-queue-message.ts](/E:/AII/ugk-pi/src/agent/agent-queue-message.ts)：运行中队列消息 helper，负责 prompt asset 准备、当前时间前缀、asset context 拼接，以及 `steer` / `followUp` 显式 API 优先。`AgentService.queueMessage()` 只保留 active run 存在性判断与响应外壳。
- [test/agent-queue-message.test.ts](/E:/AII/ugk-pi/test/agent-queue-message.test.ts)：覆盖 steer、followUp、fallback prompt streaming behavior 与附件 / 引用资产上下文。
- [src/agent/agent-conversation-commands.ts](/E:/AII/ugk-pi/src/agent/agent-conversation-commands.ts)：新建 / 删除 / 切换 / 重置会话命令 helper，负责运行中拒绝切线、空闲 current pointer 更新、删除 / 重置时触发 terminal run 清理 callback。`AgentService` 仍保留 active run / terminal run 状态所有权。
- [test/agent-conversation-commands.test.ts](/E:/AII/ugk-pi/test/agent-conversation-commands.test.ts)：覆盖会话命令的 idle / running / missing / terminal cleanup 边界。

### 3. 文档整理只做事实校准

当前文档体系已经很重，后续不要再新增散落文档。优先更新：
- [docs/handoff-current.md](/E:/AII/ugk-pi/docs/handoff-current.md)
- [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
- [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)
- [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
- [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

如果只是代码内部小重构、外部行为不变，可以不写长篇发布故事；但影响运行口径、部署、接口、用户体验或接手路径时，必须更新 `docs/change-log.md`。

## 架构整理阶段收尾判断

截至 `2026-04-27`，本轮代码整理主线可以视为阶段完成，完成度约 `85%-90%`。后续不要继续按“看到大文件就拆”的方式推进；那不是工程洁癖，是把维护成本从一个文件搬到多个文件，听起来很高级，实际更烦人。

已经完成并有测试压住的边界：

- 路由层：chat / conn / activity / notification / files 的 parser、presenter、SSE、route utils 已经拆出。
- AgentService 领域 helper：conversation catalog、conversation commands、conversation context、conversation session、conversation state、conversation history、prompt assets、queue message、run scope、run events、run result、terminal run、session event adapter / guards。
- playground 运行时：page shell、基础样式、状态、通知、确认弹窗、panel focus、conversation API / sync / state / history pagination / process / active run normalizer 等控制器已经拆出。
- 存储与坏数据边界：ConversationStore、AssetStore、AgentActivityStore、ConversationNotificationStore、ConnSqliteStore、ConnRunStore 已经完成一轮坏 JSON、并发、稳定排序、分页游标和 lease 防护加固。

剩余不建议继续拆的区域：

- `src/agent/agent-service.ts` 仍是运行编排中心，保留 `activeRuns` / `terminalRuns` 两个内存态 Map 是合理的；把它们抽成独立 store 只会让同步边界更绕。
- `runChat()` 仍然较长，但它承载的是连续生命周期：创建会话、准备资产、注册 active run、订阅事件、执行 prompt、持久化、生成 terminal snapshot、清理浏览器 scope。强拆会让一次 run 的控制流散到多个文件，不值得。
- `interruptChat()`、`getRunEvents()`、`subscribeRunEvents()` 都依赖 active / terminal run 状态，继续保留在 service 内更直观。

后续如果继续做质量工作，优先级应改为：

1. 验证真实用户场景，而不是继续拆 helper。
2. 针对新增功能补小范围测试。
3. 发现真实重复或真实 bug 后再拆边界。
4. 涉及服务器发布时继续走增量更新，不做整目录替换。

当前建议：不要再主动推进架构拆分，除非有新的功能需求或线上问题指向某个具体边界。

## 暂时不要做

- 不要继续推进 Feishu 业务闭环。用户已经明确：现阶段飞书部分可以跳过。
- 不要整目录替换服务器目录。
- 不要动 `references/pi-mono/`，那是参考镜像，不是业务源码。
- 不要把 `.data/`、`.env`、部署 tar 包、截图报告、runtime 临时产物提交进仓库。
- 不要为了“优化”把已稳定的 playground 手机端又改成桌面压缩版。

## 发布口径

本次用户已经明确要求服务器“增量更新”。标准流程：

1. 本地确认工作区，只提交本轮文档 / 代码改动。
2. 本地跑 `git diff --check`、`npx tsc --noEmit`、`npm test`。
3. 提交并推送 `main` 到 GitHub。
4. 服务器进入 `~/ugk-claw-repo`。
5. 备份 sidecar 登录态到 `~/ugk-claw-shared/backups/`。
6. 给服务器旧 `HEAD` 打 `server-pre-deploy-*` 本地 tag。
7. `git fetch --tags origin`。
8. `git pull --ff-only origin main`。
9. `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet`。
10. `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`。
11. 验收内外网 `/healthz`、`/playground`、compose 状态和 `check-deps.mjs`。

生产 shared 状态不能洗：
- `~/ugk-claw-shared/.data/agent`
- `~/ugk-claw-shared/.data/chrome-sidecar`
- `~/ugk-claw-shared/app.env`
- `~/ugk-claw-shared/compose.env`
- `~/ugk-claw-shared/logs`

## 阅读顺序

1. [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
2. [README.md](/E:/AII/ugk-pi/README.md)
3. [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
4. [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
5. [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)
6. [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
7. [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
8. [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)
