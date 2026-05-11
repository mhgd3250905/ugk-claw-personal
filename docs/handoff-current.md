# 当前交接快照

更新时间：`2026-05-11`

这份文档给下一位全新接手 `ugk-pi / UGK CLAW` 的 agent 看。先读这里，再读 `AGENTS.md` 和追溯地图。别靠聊天记录拼现状，聊天记录会骗人，仓库里的事实比较不会装。

当前服务器更新、双云目录、shared 运行态和 user skills 规则仍以 [server-ops.md](./server-ops.md)、[server-ops-quick-reference.md](./server-ops-quick-reference.md)、[tencent-cloud-singapore-deploy.md](./tencent-cloud-singapore-deploy.md) 和 [aliyun-ecs-deploy.md](./aliyun-ecs-deploy.md) 顶部“当前部署快照”为准。本文件只做接手摘要，不替代发布 runbook。

## 给新接手 Agent 的第一条消息

可以把下面这段直接发给下一位同事 agent：

```text
请先接手 `E:\AII\ugk-pi`。你是维护这个仓库的 coding agent，不是产品运行时 Playground agent。

必须先读 `AGENTS.md`、`docs/handoff-current.md`、`docs/traceability-map.md`。如果要跑本地，只用 Docker：`docker compose up -d` 或 `docker compose restart ugk-pi`，不要用宿主机 `npm start` / `npm run dev` 当正规入口。如果要部署服务器，先读 `docs/server-ops.md`，默认增量更新；腾讯云拉 GitHub `origin/main`，阿里云拉 Gitee `gitee/main`，不要整目录覆盖，不要洗 shared 运行态。

开始前先执行 `git status --short` 和 `git log -1 --oneline`。未跟踪的 `.claude/`、`runtime/*.cjs`、`public/*.png/html`、`ui-design/`、奇怪的 `Eapp...jsonl` 都是本地运行产物，除非用户明确说明，否则不要提交、不要删除。

当前双云和两个远端已经同步到 `9917981 Document dual-cloud conn badge deployment`；功能锚点是 `efb0de7 Align conn unread badge with run counts`。最近修复的是：对话页“后台任务”按钮未读数字现在和 `/playground/conn` 的 Conn run 未读结果保持一致。
```

新 agent 如果只做普通 bugfix，最小阅读顺序是：

1. `AGENTS.md`
2. `docs/handoff-current.md`
3. `docs/traceability-map.md`
4. 按任务类型读 `docs/playground-current.md`、`docs/runtime-assets-conn-feishu.md`、`docs/docker-local-ops.md` 或 `docs/server-ops.md`

先别让新 agent 一上来全仓扫描。这个项目文档已经够多了，乱读只会把自己读晕。

## 当前结论

- 代码主仓库：`https://github.com/mhgd3250905/ugk-claw-personal.git`
- 主分支：`main`
- 当前稳定版本：`v1.2.0`
- 当前本地最新提交：本文件所在 HEAD；具体 hash 以 `git log -1 --oneline` 为准。
- 当前 `origin/main` / `gitee/main`：已同步到本文件所在 HEAD；具体 hash 以 `git log -1 --oneline` 为准。
- 腾讯云生产运行代码：已增量更新到本文件所在 HEAD，功能锚点 `efb0de7 Align conn unread badge with run counts`，已通过 `npm run server:ops -- tencent deploy` 和 `npm run server:ops -- tencent verify`。
- 阿里云生产运行代码：已增量更新到本文件所在 HEAD，功能锚点 `efb0de7 Align conn unread badge with run counts`，已通过 `npm run server:ops -- aliyun deploy` 和 `npm run server:ops -- aliyun verify`。
- 本轮稳定版主线：Agents 页面重写（inline 编辑器、对齐设计）、文件库指定文件删除、对话页 Agent 按钮直达独立 Agents 页面、Conn 未读统计收口、对话页后台任务未读徽章对齐 Conn run 未读口径、Conn 立即执行反馈防重复、Conn 立即执行后端幂等、Conn 运行一键全部已读按钮 + topbar 布局修复、Conn/Agents 独立页面浅色主题支持、Playground 刷新闪屏修复（`data-home` 路由架构清理）、`setStageMode` 死代码移除。
- 验收结论：本地 `npx tsc --noEmit`、`git diff --check`、`npm test` 通过；双云均完成增量更新与运行态检查，腾讯云和阿里云 `verify` 均返回 `ok=true`，shared 运行态挂载、runtime skills 和 Chrome sidecar 保持可用。
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
- 当前 Chrome 工作台发布现场：Chrome 工作台第一阶段已经完成本地验证、提交、推送和双云增量部署。发布过程没有执行 `docker compose down -v`，没有覆盖 shared，没有复制本地 Chrome profile 到服务器；默认旧 Chrome sidecar 在双云验收时仍显示 `Up 4 days (healthy)`，说明旧登录态未被重建洗掉。后续仍必须保护 shared Chrome 登录态目录：腾讯云 `~/ugk-claw-shared/.data/chrome-sidecar*`，阿里云 `/root/ugk-claw-shared/.data/chrome-sidecar*`。
- 当前本地未发布变更：无已跟踪源码 / 文档变更待发布；未跟踪运行产物仍不属于发布内容。
- 双云部署注意：腾讯云从 `origin`（GitHub）拉代码，阿里云从 `gitee` 拉代码。要让双云完全同版，发布前务必同时推送两个 remote：`git push && git push gitee main`；只修阿里云时也要在文档里写清楚腾讯云没有同步，别让下个 agent 脑补。
- Playground UI 架构：`data-home="true"/"false"` 是唯一路由开关（agent 列表 vs 对话视图）。`data-stage-mode="landing"` 是永久 CSS-only hook，运行时不变。主题系统用 `[data-theme="dark"]` / `[data-theme="light"]`，token 选择器不能包含 `body`。独立页面（conn、agents）用 `standalone-page-shared.ts` 作共享 CSS base，各自内嵌 token 覆盖块。
- 当前本地模型源变更：阿里 `dashscope-coding / glm-5` 已移除，默认接入智谱 `zhipu-glm / glm-5.1`，使用 `ANTHROPIC_AUTH_TOKEN` 和 `https://open.bigmodel.cn/api/anthropic` 的 `anthropic-messages` 兼容链路。`/v1/model-config` 本地已确认 `zhipu-glm` 为 `configured=true`；本地 `.env` 已写入真实 token 但不得提交。若修改 `.env`，必须重新创建 `ugk-pi` 容器，单纯 `docker compose restart ugk-pi` 不会重新加载 env_file。
- 当前本地多 Agent 并行加固：前台 Agent scope 已从全局 `process.env` 切到 `AsyncLocalStorage`，后台 Conn workspace env 也改为 async context 并在 Bash spawn 时显式注入；浏览器 cleanup scope 现在带 `agentId + conversationId` 或 `connId + runId`，降低共享 Chrome 误清理其他 run 的风险。新增 `GET /v1/agents/status` 查看 agent profile 级 `idle / busy`；同一 agent 忙时非流式 chat 返回 `409 AGENT_BUSY`，流式 chat 在 SSE hijack 前预检返回 409。普通 `ModelRegistry.create()` 未按外部报告改动，因为当前上游实现不在 create 路径 reset provider registry。
- 当前未跟踪禁区：`.claude/`、`runtime/xhs-extract.mjs`、`public/ptt-slide*.html`、`public/slide*.png`、`runtime/*.cjs`、奇怪的 `Eapp...jsonl` 路径等运行产物 / 本地文件不属于本轮增量提交，继续不要提交、不要删除，除非用户明确说明它们的归属。

## 2026-05-11 阿里云 Conn 立即执行反馈排查与发布

关键提交：`c376327 Improve conn run-now feedback`

本轮阿里云排查的重点是用户反馈“点击后台任务立即执行一直挂起，刷新页面很久加载不进去”。结论分两段：

- 刷新慢：nginx 日志显示北京时间 `2026-05-11 13:22` 和 `13:31` 附近有 app/nginx 重建窗口，期间出现 upstream `connect() failed (111: Connection refused)`，所以页面加载慢大概率撞上发布短暂不可用窗口。
- 立即执行：Conn `ffa38585-ea08-417c-9544-482f42eae57e` 在 `15:30:02` 左右产生了两条手动 run，worker 在 `15:30:09` 领取，`15:30:28` / `15:30:29` 均成功完成。后端没卡死，前端反馈太弱导致用户重复点击。

已修复：

- `src/ui/conn-page-js.ts`：独立 Conn 页面新增 `actionConnId`、run 短轮询、pending/running 判定；立即执行入队时显示“入队中”，执行中显示“执行中”并禁用按钮。
- `src/ui/playground-conn-activity-controller.ts`：Playground 内嵌后台任务入口同步相同行为，入队后展开运行历史并短轮询刷新。
- `src/ui/playground.ts`：补齐 `connManagerRunRefreshTimers` 状态。
- `test/server.test.ts`：补充独立 Conn 页和 Playground 脚本断言。

验证记录：

- `node --test --import tsx test/server.test.ts`：`119 pass`
- `npx tsc --noEmit`
- `git diff --check`
- `npm run server:ops -- aliyun preflight`
- `npm run server:ops -- aliyun deploy`
- `npm run server:ops -- aliyun verify`
- 公网验证：`/playground`、`/playground/conn`、`/v1/conns` 返回 `200`；脚本 marker 为 `app_has_run_feedback=True`、`conn_has_run_feedback=True`。

## 2026-05-11 独立页面浅色主题 + Agents 重写 + 路由架构清理

关键提交：`bb434f0` → `e37532e` → `d40c91d` → `d078b53` → `cebc6c0` → `f11a3e6`

### Agents 页面重写

- 全新的 inline 编辑器：点击 agent 卡片直接在原位展开编辑表单，不再跳转独立编辑页面。
- 与 conn 页面设计语言对齐：stat card 布局、配色、交互模式一致。
- `src/ui/agents-page.ts` 大幅重写（+800/-400 行）。

### Conn 页面增强

- 运行结果一键全部已读：`ConnRunStore.markAllRunsRead()` + `POST /v1/conns/:connId/runs/read-all`。
- Topbar 布局修复：按钮对齐、间距统一。

### 独立页面浅色主题

- Conn 页面（`src/ui/conn-page-css.ts`）和 Agents 页面（`src/ui/agents-page.ts`）补全 `[data-theme="light"]` token 块。
- 硬编码颜色覆盖：SVG data URI、scrollbar、列表项、stat card、markdown 渲染等浅色适配。
- 共享 CSS base：`src/ui/standalone-page-shared.ts` 提供两个页面共用的 token 和组件样式。
- 关键陷阱：token 选择器不能包含 `body`，否则 `body` 永远匹配会覆盖浅色 token。

### Playground 路由架构清理

- `data-home="true"/"false"` 是唯一路由开关。`data-stage-mode="landing"` 降级为永久 CSS-only hook。
- 删除 `setStageMode()` 函数和 `state.stageMode` 属性（死代码）。
- `aria-hidden` 逻辑迁移到 `backToLanding()`。
- HTML 模板添加 `data-home="true"` 防止页面刷新时对话视图闪现。
- CSS 规则分两层：`[data-home="true"]` 控制可见性（隐藏 topbar/rail/stream/command-deck），`[data-stage-mode="landing"]` 控制布局样式（composer/textarea/stream-layout 定位）。

## 2026-05-10 Conn 未读标记与 UI 收口

本轮核心：将 conn 运行结果的未读信号收拢到 conn 页面自身，同时优化 conn 独立工作台的视觉和交互。

关键提交：`98b0335`、`62cdfa3`

数据流：`conn_runs.read_at` → `ConnRunStore` 三个新方法 → `GET /v1/conns` 返回 `unreadRunCountsByConnId` + `totalUnreadRuns` + `POST .../runs/:runId/read` → Conn 页面 stat card / 列表徽章 / 时间线红点 → 展开时自动标记已读。

共享 Markdown 渲染：Conn 独立页面和 Playground 复用同一个 `renderMessageMarkdown()`（由 `getBrowserMarkdownRendererScript()` 生成，基于 `marked` CDN），不再各写各的渲染器。后续如果需要改 Markdown 渲染行为，只需改 `src/ui/playground-transcript-renderer.ts` 一处。

Playground 桌面端收口：
- Inbox 按钮桌面端隐藏（`display:none`），未读计数迁移到 conn 管理按钮徽章。
- 点击 conn 管理按钮从嵌入式 panel 改为 `window.open("/playground/conn", "_blank")` 新标签页。
- `playground-task-inbox.ts` 的 `renderTaskInboxToggleState()` 同时更新 conn manager badge。

UI 细节：
- 列表卡片背景 `#161E35` / hover `#1A2440`。
- 未读徽章红色药丸（`var(--danger)` bg，白色文字）。
- 时间线未读红点 + 红色边框卡片。
- 任务结果从代码框改为 Markdown 渲染。
- "新建任务"清除已选卡片。

SQLite 注意事项：
- `user_version` 已从 8 升到 9；旧库升级会 `ALTER TABLE conn_runs ADD COLUMN read_at TEXT`。
- 新增 `idx_conn_runs_unread` 索引。

## 2026-05-10 Conn 维护与本地 Docker 防踩坑收口

本轮准备增量更新的核心不是 UI 新功能，而是把后台任务维护和浏览器 scope 保护补齐：

- CDP 代理默认强制 `metaAgentScope`：`/new`、`/navigate`、`/session/*` 这类浏览器变更请求缺 scope 时返回 `400 missing_agent_scope`，避免旧脚本裸调 `127.0.0.1:3456` 静默落到旧 Chrome。
- Conn 事件日志瘦身：`ConnRunStore.appendEvent()` 不再持久化纯文本增量 `text_delta` / `message_update text_delta`，最终结果仍保留在 `conn_runs.result_text/result_summary`。
- Conn SQLite 维护入口：`scripts/maintain-conn-db.mjs` 支持 `--dry-run`、`--json`、`--keep-days`、`--keep-latest-runs-per-conn`，只清旧 run 的 `conn_run_events`，不删任务、run 记录、结果摘要或输出文件。
- 运行时系统技能：`.pi/skills/conn-maintenance/SKILL.md` 教 Agent 先读事实源、先 dry-run、汇报影响、等待用户确认，再在维护窗口清理；生产清理前应备份 shared conn 目录，脚本默认执行 `VACUUM` / WAL checkpoint。
- SQLite WAL 降级补强：`ConnDatabase` 现在把 `errcode=14` (`SQLITE_CANTOPEN`) 也视为 WAL 不可用场景并回退 DELETE journal mode，解决本地 Docker / Windows bind mount 重启循环。
- 本地 Docker 防踩坑：`docs/docker-local-ops.md` 记录本地 bind mount、`restart` vs `up --build`、orphan nginx、端口 3000、技能加载验证、运行态目录和本地 / 生产命令边界。

本轮关键验证：

- `npx tsc --noEmit`
- `npm test`：`624 pass / 0 fail`
- `npx tsx --test test\conn-db.test.ts test\conn-maintenance-skill.test.ts test\conn-db-maintenance-script.test.ts`
- `npx tsx --test test\background-agent-runner.test.ts test\conn-run-store.test.ts test\conn-db-maintenance-script.test.ts test\web-access-proxy.test.ts`
- 本地 Docker 重建后 `http://127.0.0.1:3000/healthz` 返回 `ok=true`，`/v1/debug/skills` 可见 `conn-maintenance`。

## 2026-05-09 本地浏览器绑定隔离收口

本轮目标不是新增“更聪明”的 Agent 操作，而是撤掉危险能力：Agent / Conn 的 Chrome 绑定只能由用户手动在 Playground UI 设置。

- UI 保留：Agent 操作台和 Conn 编辑器仍通过 `/v1/browsers` 渲染下拉，并用正式 API 保存 `defaultBrowserId` / `browserId`。
- 服务端闸门保留：浏览器 / 执行路由真实变化时必须带 `x-ugk-browser-binding-confirmed: true` 和 `x-ugk-browser-binding-source: playground`，否则拒绝并写审计。
- Agent 能力撤销：`agent-profile-ops`、`conn-orchestrator`、`web-access` 都不得通过自然语言修改浏览器绑定。
- 架构收口：`src/browser/browser-binding-policy.ts` 统一承载确认 header 读取、绑定字段变更计算和 UI-only 写入判断；`src/routes/chat.ts` 只处理 Agent profile 更新和 running conversation 拒绝，`src/routes/conns.ts` 只处理 Conn 更新，避免把绑定策略散落在多个路由里。
- 底层隔离补强：`cdp-proxy` / `host-bridge` 不再转发请求级浏览器 id，`local-cdp-browser` 不再用传入 `browserId` 选路；`browser-bound-bash` 只把当前绑定 Chrome 的一条 `UGK_BROWSER_INSTANCES_JSON` 注入 run 环境。scope route 记录当前绑定的 CDP endpoint，避免长驻 `cdp-proxy` 沿用首次启动时的旧 Chrome 环境；Agent run 启动的 proxy 会拒绝缺少 `metaAgentScope` 的浏览器变更请求，旧 runner 和文档示例已补齐 scope。浏览器绑定按 Agent 全局参数处理，服务端拒绝在该 Agent 有 running conversation 时切换，返回 409 并写 `rejected_running` 审计。
- 本地验证已通过：`npm test`（613 pass / 0 fail）、`npx tsc --noEmit`、`git diff --check`，并在本地服务上实测 UI 手动切换浏览器可生效、非 UI 来源被拒绝、运行中 Agent 不能切换默认浏览器。

## 2026-05-08 Chrome 工作台已发布摘要

本轮新增前台 `Chrome 工作台`：

- 接口：`GET /v1/browsers/:browserId/status`、`POST /v1/browsers/:browserId/targets/:targetId/close`、`POST /v1/browsers/:browserId/start`。
- 后端边界：`BrowserControlService` 负责编排 CDP 状态，`BrowserTargetUsageReader` / `CdpBrowserTargetUsageReader` 独立读取页面级 JS heap、DOM 节点和事件监听器；不接 Docker socket。
- 前端边界：`src/ui/playground-browser-workbench.ts` 独立承载工作台样式、弹层和脚本；Playground 只负责装配入口与 workspace 模式。
- 用户可见口径：默认只展示真实 `page` 页面，iframe / service worker 等内部 target 只折叠为中文提示；页面条目突出 `页面` 标签、网址和占用状态。
- 生产部署口径：这是代码增量，不是登录态迁移；已通过双云 `npm run server:ops -- <target> verify` 和公开浏览器接口抽查。`chrome-01` / `chrome-02` 是独立 profile，由用户分别登录维护。

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

截至最近一次全量测试，`npm test` 为 `613 pass / 0 fail`。本轮还单独跑过：

- `npx tsc --noEmit`
- `node --test --test-concurrency=1 --import tsx test\conn-db.test.ts test\conn-sqlite-store.test.ts test\cleanup-debug.test.ts`
- `node --test --test-concurrency=1 --import tsx test\server.test.ts --test-name-pattern "debug/cleanup"`
- `git diff --check`

最近一次生产验收：

- 腾讯云服务器已增量更新到 `e92da82`，`npm run server:ops -- tencent verify` 通过。
- 阿里云服务器已增量更新到 `e92da82`，`npm run server:ops -- aliyun verify` 通过。
- 腾讯云 / 阿里云公开 `GET /v1/browsers` 均返回 `default`、`chrome-01`、`chrome-02`。
- 腾讯云 / 阿里云 `GET /v1/browsers/<browserId>/status` 抽查通过，三套 Chrome 均 `online` 并可返回页面级 usage。
- 双云默认旧 Chrome sidecar `ugk-pi-browser` 验收时仍为 `Up 4 days (healthy)`；新增 `chrome-01` / `chrome-02` sidecar 是本次增量创建的独立 profile。

上一轮 conn / cleanup 生产验收：

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
