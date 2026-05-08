# 当前交接快照

更新时间：`2026-05-08`

这份文档给下一位全新接手 `ugk-pi / UGK CLAW` 的 agent 看。先读这里，再读 `AGENTS.md` 和追溯地图。别靠聊天记录拼现状，聊天记录会骗人，仓库里的事实比较不会装。

当前服务器更新、双云目录、shared 运行态和 user skills 规则仍以 [server-ops.md](./server-ops.md)、[server-ops-quick-reference.md](./server-ops-quick-reference.md)、[tencent-cloud-singapore-deploy.md](./tencent-cloud-singapore-deploy.md) 和 [aliyun-ecs-deploy.md](./aliyun-ecs-deploy.md) 顶部“当前部署快照”为准。本文件只做接手摘要，不替代发布 runbook。

## 当前结论

- 代码主仓库：`https://github.com/mhgd3250905/ugk-claw-personal.git`
- 主分支：`main`
- 当前稳定版本：`v1.2.0`
- 当前本地最新提交：`c95af2d Release v1.2.0`
- 当前 `origin/main` / `gitee/main`：均已推送到 `c95af2d`；`v1.2.0` tag 也已同步推送到 GitHub 和 Gitee。
- 腾讯云生产运行代码提交：最近一次已增量更新并验证到 `260faf3 Add conn public directory contract`，随后本地只追加版本号 / change-log release commit `c95af2d`。
- 阿里云生产运行代码提交：最近一次已增量更新并验证到 `260faf3 Add conn public directory contract`，随后本地只追加版本号 / change-log release commit `c95af2d`。
- 本轮稳定版主线：Playground 会话菜单、任务消息重设计、Markdown 代码块宽度约束、浅色主题 / 后台任务 / Agent 设置页面视觉一致性收口、UI 层级清理，以及 conn 长期公开目录 / 站点级公开目录契约。
- 验收结论：双云已完成 conn 公共目录契约增量更新与运行态检查；`v1.2.0` release commit 只变更 `package.json`、`package-lock.json` 和 `docs/change-log.md`，已通过 `git diff --check`，并确认 tag 指向当前 HEAD。
- 腾讯云正式入口：`http://43.134.167.179:3000/playground`
- 腾讯云健康检查：`http://43.134.167.179:3000/healthz`
- 腾讯云主部署目录：`/home/ubuntu/ugk-claw-repo`
- 腾讯云 shared 运行态目录：`/home/ubuntu/ugk-claw-shared`
- 腾讯云最近一次生产回滚 tag：`server-pre-deploy-20260427-144258`
- 腾讯云最近一次 sidecar 备份：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260427-144258.tar.gz`
- 阿里云正式入口：`http://101.37.209.54:3000/playground`
- 阿里云健康检查：`http://101.37.209.54:3000/healthz`
- 阿里云主部署目录：`/root/ugk-claw-repo`
- 阿里云 shared 运行态目录：`/root/ugk-claw-shared`
- 当前服务器更新方式：默认增量更新，腾讯云默认拉 `origin/main`，阿里云默认拉 `gitee/main`；如 Gitee 推送或阿里云直连 GitHub 不通，可在用户确认后用 Git bundle 做 ff-only 增量，不要整目录覆盖。
- 当前未提交本地现场：本轮只剩交接文档和架构治理审计文档的事实校准需要视情况提交；此前遗留的 `public/test.html` 和 `runtime/*` 临时日志 / 报告已清理，不要在后续任务里恢复为仓库内容。

## 最近已完成

最近一轮已经完成 conn / activity / output 主链路收口：

- conn 默认目标是 `task_inbox`，不再依赖前台 `conversationId`；删除或切换聊天会话不影响后台 run、任务消息或 output 链接。
- conn run 只索引 `workspace/output/` 下的真实产物；用户可见链接走 `/v1/conns/:connId/runs/:runId/output/<path>` 和 `/v1/conns/:connId/output/latest/<path>`。
- HTML / 图片 / PDF / 文本类 conn output 默认 inline 打开；强制下载才用 `?download=true`。
- `ActivityFile` 已从旧 conversation notification store 中拆出，`AgentActivityStore` / `conn-worker` 不再从旧 store 引类型。
- `ConversationNotificationStore` 和对应测试已删除。
- `conversation_notifications` 已从 conn SQLite schema、表清单和 conn 删除清理路径移除；旧库升级到 `user_version=6` 时会 `DROP TABLE IF EXISTS conversation_notifications`。
- `/v1/debug/cleanup` 保留只读体检：正常新库旧通知统计返回 0；异常旧库如果仍有该表，会继续统计并暴露风险。

关键提交：

```bash
git log --oneline c05753b..HEAD
```

## 当前测试状态

最近一轮完整验证口径：

- `git diff --check`
- `npx tsc --noEmit`
- `docker compose -f docker-compose.prod.yml config --quiet`
- `npm test`

截至最近一次全量测试，`npm test` 为 `552 pass / 0 fail`。本轮还单独跑过：

- `npx tsc --noEmit`
- `node --test --test-concurrency=1 --import tsx test\conn-db.test.ts test\conn-sqlite-store.test.ts test\cleanup-debug.test.ts`
- `node --test --test-concurrency=1 --import tsx test\server.test.ts --test-name-pattern "debug/cleanup"`
- `git diff --check`

最近一次生产验收：

- 腾讯云服务器已增量更新到 `4a8c7e5`，`npm run server:ops -- tencent verify` 通过。
- 阿里云服务器已增量更新到 `4a8c7e5`，`npm run server:ops -- aliyun verify` 通过。
- 腾讯云 cleanup：`ok=true`，`conversation=0`，`legacyConversationNotifications.total=0`，`withActivity=1`，`withOutputFiles=1`，`risks=[]`。
- 阿里云 cleanup：`ok=true`，`conversation=0`，`legacyConversationNotifications.total=0`，`withActivity=7`，`succeededWithoutOutputFiles=0`，`risks=[]`。
- 用户已真实测试 conn HTML 输出任务，确认全局通知和 output/latest 链接可用。

## 下一步建议

如果你是用户刚点了新会话后重新 `/init` 的新 agent，先别急着开工。先确认：

1. `git status --short` 里只有上面列出的本地现场文件，或者先处理它们。
2. 不要把腾讯云和阿里云当成一台机器。腾讯云是 `ubuntu@43.134.167.179` 且目录是 `/home/ubuntu/...`；阿里云是 `root@101.37.209.54` 且目录是 `/root/...`。
3. 这条是历史提醒：当时不要在阿里云 `/root/ugk-claw-repo` 里直接 `git pull`，因为那时它还是 archive 解包目录；当前阿里云已经迁移为 Git 工作目录，发布看 `docs/server-ops.md`。
4. SQLite / JSON 字段边界本轮已扫完，`AgentService.queueMessage()` 已经抽到 `src/agent/agent-queue-message.ts`，新建 / 删除 / 切换 / 重置会话命令也已经抽到 `src/agent/agent-conversation-commands.ts`；下一步如果继续做架构整理，优先从 `AgentService.runChat()` 周边找真正可测的窄边界，别继续堆“为了拆而拆”的文件。

### 1. 已完成的 SQLite / JSON 字段边界

本轮覆盖非 Feishu 区域：
- [src/agent/agent-activity-store.ts](/E:/AII/ugk-pi/src/agent/agent-activity-store.ts)
- [src/agent/conn-sqlite-store.ts](/E:/AII/ugk-pi/src/agent/conn-sqlite-store.ts)
- [src/agent/conn-run-store.ts](/E:/AII/ugk-pi/src/agent/conn-run-store.ts)
- [src/routes/activity.ts](/E:/AII/ugk-pi/src/routes/activity.ts)

已加固点：
- `conversation_notifications` 已从 conn SQLite schema 中移除；当前主链路是 `AgentActivityStore` / `agent_activity_items`，旧 conversation-scoped store 已移除。
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
- [docs/aliyun-ecs-deploy.md](/E:/AII/ugk-pi/docs/aliyun-ecs-deploy.md)

如果只是代码内部小重构、外部行为不变，可以不写长篇发布故事；但影响运行口径、部署、接口、用户体验或接手路径时，必须更新 `docs/change-log.md`。

## 架构整理阶段收尾判断

截至 `2026-04-27`，本轮代码整理主线可以视为阶段完成，完成度约 `85%-90%`。后续不要继续按“看到大文件就拆”的方式推进；那不是工程洁癖，是把维护成本从一个文件搬到多个文件，听起来很高级，实际更烦人。

已经完成并有测试压住的边界：

- 路由层：chat / conn / activity / notification / files 的 parser、presenter、SSE、route utils 已经拆出。
- AgentService 领域 helper：conversation catalog、conversation commands、conversation context、conversation session、conversation state、conversation history、prompt assets、queue message、run scope、run events、run result、terminal run、session event adapter / guards。
- playground 运行时：page shell、基础样式、状态、通知、确认弹窗、panel focus、conversation API / sync / state / history pagination / process / active run normalizer 等控制器已经拆出。
- 存储与坏数据边界：ConversationStore、AssetStore、AgentActivityStore、ConnSqliteStore、ConnRunStore 已经完成一轮坏 JSON、并发、稳定排序、分页游标和 lease 防护加固；`conversation_notifications` 只在 cleanup debug 中保留异常旧库只读观测。

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
8. [docs/aliyun-ecs-deploy.md](/E:/AII/ugk-pi/docs/aliyun-ecs-deploy.md)
9. [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)
