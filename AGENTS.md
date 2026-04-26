This file provides the highest-level working rules for AI coding agents in this repository.

# ugk-pi Agent Guide

## 1. 最高准则

- 默认使用简体中文回复；只有用户明确要求英文时才切换。
- 命令、代码、日志、报错保持原始语言；其余解释用中文。
- 先读现有文件，再动手；优先编辑已有文件，不要无意义新建。
- 先判断任务性质：
  - 文档 / 规划任务：优先改文档，不要顺手碰源码。
  - 实现 / 修复任务：先看真实入口和调用链，再落代码。
- 涉及云服务器更新部署时，必须先向用户确认本次是“增量更新”还是“整目录替换”；在用户明确确认前，不要默认执行整目录替换。默认倾向是增量更新，不要擅自把服务器本地状态、已安装 skills、`.data` 和运行目录一起洗掉。
- 缺少上下文但需要规划时，先写 `.codex/plans/`，执行前等用户确认。
- 不要臆造 `pi` 的配置、技能、provider、行为；涉及这类事实时必须查：
  - `references/pi-mono/packages/coding-agent/README.md`
  - `references/pi-mono/packages/coding-agent/docs/settings.md`
  - `references/pi-mono/AGENTS.md`
  - `GET /v1/debug/skills`
- `references/pi-mono/` 是官方参考镜像，不是业务源码目录；除非用户明确要求，不要改它。

## 2. 项目边界

- 这是基于 `pi-coding-agent` 的自定义 HTTP agent 原型，不是完整业务平台。
- 当前阶段优先目标：
  - 跑通并稳定 agent runtime
  - 稳定会话机制
  - 稳定 HTTP 接口
  - 稳定 playground
  - 为飞书 / Slack / 企业微信等 IM 接入预留形态
- 在用户没有给出明确业务能力前，不要擅自初始化数据库、业务框架或大型前端工程体系。

## 2.1 当前阶段快照

- 截至 `2026-04-19`，本阶段已经把 `web-access` 主链路收口到 Docker Chrome sidecar；后续 `/init` 不要再默认按 Windows 宿主 IPC 理解。
- 当前代码主仓库已经切到 GitHub：`https://github.com/mhgd3250905/ugk-claw-personal.git`；腾讯云新加坡服务器当前主部署目录也已经迁到 GitHub 工作目录 `~/ugk-claw-repo`，不要再把 Gitee / tar 包搬运当成长期主流程理解。
- 默认浏览器链路是 `WEB_ACCESS_BROWSER_PROVIDER=direct_cdp` -> `http://172.31.250.10:9223` -> Docker Chrome sidecar。
- agent 任务结束时，`AgentService` 会通过 `src/agent/browser-cleanup.ts` 按 `CLAUDE_AGENT_ID` / `CLAUDE_HOOK_AGENT_ID` / `agent_id` 清理本轮 `web-access` scope 下保留的浏览器页面；不要只在运行容器 `/app` 里热改，否则重建镜像会直接丢修复。
- sidecar GUI 登录入口是 `https://127.0.0.1:3901/`，登录态持久目录是 `.data/chrome-sidecar`。
- 当前生产更新默认不能洗掉两类状态：sidecar 登录态挂在 `~/ugk-claw-shared/.data/chrome-sidecar`，agent 会话 / session / 资产 / conn 数据挂在 `~/ugk-claw-shared/.data/agent` 并映射到容器 `/app/.data/agent`；如果更新后历史会话消失，先查 `docker inspect ugk-pi-claw-ugk-pi-1` 的 mounts 和 `UGK_AGENT_DATA_DIR`，别又让容器可写层背锅。
- 用户可见链接使用 `PUBLIC_BASE_URL`；sidecar 自动化打开本地 artifact 使用 `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL`，本地 compose 默认是 `http://ugk-pi:3000`。
- 腾讯云新加坡 CVM 的正式部署记录在 `docs/tencent-cloud-singapore-deploy.md`；当前公网入口是 `http://43.134.167.179:3000/playground`，sidecar GUI 只能走 SSH tunnel，不要开放公网 `3901`。
- Windows host IPC fallback 仍保留，但只用于 legacy 本机调试和紧急排障。
- 本阶段标准验证命令是 `npm test` 与 `npm run docker:chrome:check`。
- `playground` 手机端已经单独重写成移动聊天页；后续 `/init` 如果接手前端，不要把手机端继续按桌面端压缩版理解，先看 `docs/playground-current.md`。

## 3. 全局验证规则

- 不要把“代码里出现了某段字符串”当作修复完成；要验证真实入口、真实状态、真实行为。
- 任何影响外部行为、运行方式、接口、文档结构或协作约定的改动，必须在同一轮同步更新文档系统，不能等“之后有空再补”。
- 每次这类改动完成后，都要追加更新记录到 `docs/change-log.md`，至少写清：
  - 日期
  - 改动主题
  - 影响范围
  - 对应源码或文档入口
- 前端任务统一遵守：
  - 先锁定用户点名的真实 DOM / 组件 / 状态
  - 先查约束链，再改样式或脚本
  - 优先删除冲突旧逻辑，再新增修复
  - 连续两次补丁没打中根因时，停止缝补，改做整体收口
- 前端任务回报只说三件事：
  - 我认定的真实需求
  - 真正生效的约束源改在哪里
  - 我如何验证这次改动不是假修复
- 运行时 / API 改动至少验证：
  - 代码真源
  - 实际接口或页面入口
  - 类型检查 / 测试
  - 服务重启后的最终结果
- 纯文档任务至少验证：
  - 目录和链接不失真
  - 描述与当前代码 / 运行事实一致
  - 旧说法已从主文档移除

## 4. 固定运行口径

- 固定本地入口：`http://127.0.0.1:3000/playground`
- 健康检查：`http://127.0.0.1:3000/healthz`
- 默认开发方式：`docker compose up -d`
- 代码已挂载到容器 `/app`，多数改动后只需要：
  - `docker compose restart ugk-pi`
- agent 内部可以继续使用 `/app/...` 或 `file:///app/...` 这类本地 artifact 路径做浏览器操作；运行时会按浏览器所在网络自动桥接成 HTTP：
  - 用户可见链接走 `PUBLIC_BASE_URL`
  - Docker Chrome sidecar 自动化走 `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL`
- 如果是要直接交付文件而不是浏览器预览，优先走 `send_file`
- 如果页面还是旧 HTML：
  - 先重启 `ugk-pi`
  - 再确认 `http://127.0.0.1:3000/playground` 实际返回了本轮新增的 HTML / JS 标记
  - 再强刷浏览器
  - 不要第一反应去开 `3101`、`3102` 之类临时端口
- 临时端口只允许短时排障；排障结束必须回到 `3000` 做最终验证。

## 5. 关键路径

- 服务入口：`src/server.ts`
- 聊天路由：`src/routes/chat.ts`，请求解析：`src/routes/chat-route-parsers.ts`
- playground 路由：`src/routes/playground.ts`
- 静态报告路由：`src/routes/static.ts`
- 文件 / 资产路由：`src/routes/files.ts`，文件路由工具：`src/routes/file-route-utils.ts`
- 任务消息路由：`src/routes/activity.ts`，任务消息路由工具：`src/routes/activity-route-utils.ts`
- 实时通知路由：`src/routes/notifications.ts`，实时通知路由工具：`src/routes/notification-route-utils.ts`
- playground UI：`src/ui/playground.ts`，页面静态 shell：`src/ui/playground-page-shell.ts`，共享基础样式：`src/ui/playground-styles.ts`，弹层焦点 helper：`src/ui/playground-panel-focus-controller.ts`
- playground 设计系统：`DESIGN.md`，变更视觉 token / 组件口径后运行 `npm run design:lint`
- agent 服务核心：`src/agent/agent-service.ts`，conversation history helper：`src/agent/agent-conversation-history.ts`，process text helper：`src/agent/agent-process-text.ts`，active run 视图 helper：`src/agent/agent-active-run-view.ts`，session event 守卫：`src/agent/agent-session-event-guards.ts`
- web-access 任务结束清理：`src/agent/browser-cleanup.ts`
- session 工厂：`src/agent/agent-session-factory.ts`
- 资产库：`src/agent/asset-store.ts`
- 文件交付协议：`src/agent/file-artifacts.ts`
- 文件交付历史挂载与 `send_file` 结果合并：`src/agent/agent-file-history.ts`
- agent 发文件工具：`.pi/extensions/send-file.ts`
- conn：`src/agent/conn-store.ts`、`src/agent/conn-db.ts`、`src/agent/conn-sqlite-store.ts`、`src/agent/conn-run-store.ts`、`src/workers/conn-worker.ts`
- 飞书：`src/integrations/feishu/`
- 项目级配置：`.pi/settings.json`
- 项目级 prompts：`.pi/prompts/`
- 项目级 skills：`.pi/skills/`
- 用户 skills：`runtime/skills-user/`
- 报告截图脚本：`runtime/screenshot.mjs`
- 移动报告截图脚本：`runtime/screenshot-mobile.mjs`
- web-access 浏览器桥接：`docs/web-access-browser-bridge.md`
- 腾讯云新加坡部署运行手册：`docs/tencent-cloud-singapore-deploy.md`
- 项目级 subagent：`.pi/agents/`
- 用户 subagent：`runtime/agents-user/`
- 项目级 `pi` agent：`runtime/pi-agent/`

## 6. 场景索引

### A 场景：快速接手项目

先看这些文件，别一上来全仓乱翻：

1. `AGENTS.md`
2. `README.md`
3. `docs/traceability-map.md`
4. `docs/web-access-browser-bridge.md`
5. `docs/tencent-cloud-singapore-deploy.md`
6. `src/server.ts`
7. `src/routes/chat.ts`
8. `src/agent/agent-service.ts`
9. `src/agent/agent-session-factory.ts`
10. `src/ui/playground.ts`
11. `src/ui/playground-page-shell.ts`
12. `src/ui/playground-styles.ts`

如果这次 `/init` 的目标是接手云服务器，而不是本机开发，先记住三件事：

- 当前云端正式入口是 `http://43.134.167.179:3000/playground`。
- 服务器当前主部署目录是 `~/ugk-claw-repo`，已经是 GitHub 工作目录；旧的 `~/ugk-pi-claw` 与 `~/ugk-pi-claw-prev-*` 只保留给回滚和比对，不是默认更新入口。
- 只要改到 `Dockerfile`、系统依赖或运行环境，服务器必须执行 `docker compose -f docker-compose.prod.yml up --build -d`，不要只 `restart`。

如果这次 `/init` 还要接手 `playground` 前端，再记住两件事：

- 手机端当前不是桌面端压缩版，而是独立收口过的移动展示层；先看 `docs/playground-current.md`，别上来就按桌面布局推断手机样式。
- 手机端近期高频改动集中在 `src/ui/playground-styles.ts` 的移动断点、`src/ui/playground.ts` 的页面装配、`test/server.test.ts` 的页面断言，以及 `docs/playground-current.md` 的真实口径。

### B 场景：查聊天、会话、流式、打断

- `GET /v1/chat/state`
- `GET /v1/chat/status`
- `GET /v1/chat/events`
- `GET /v1/chat/conversations`
- `POST /v1/chat/conversations`
- `POST /v1/chat/current`
- `POST /v1/chat/reset`
- `src/routes/chat.ts`
- `src/agent/agent-service.ts`
- `src/agent/agent-session-factory.ts`
- `src/types/api.ts`

### C 场景：查 playground 页面、消息气泡、思考过程、品牌和文件展示

- `src/ui/playground.ts`
- `src/ui/playground-page-shell.ts`
- `src/ui/playground-styles.ts`
- `src/ui/playground-panel-focus-controller.ts`
- `test/server.test.ts`
- `docs/playground-current.md`

### D 场景：查上传文件、资产复用、`assetRefs`、`ugk-file`、`send_file`

- `src/routes/files.ts`
- `src/agent/asset-store.ts`
- `src/agent/file-artifacts.ts`
- `src/agent/agent-file-history.ts`
- `.pi/extensions/send-file.ts`
- `docs/runtime-assets-conn-feishu.md`

### E 场景：查技能加载、查看技能、运行时真实技能清单

- `GET /v1/debug/skills`
- `src/routes/chat.ts`
- `.pi/skills/`
- `runtime/skills-user/`
- `docs/web-access-browser-bridge.md`（查 web-access / x-search-latest / 浏览器登录态时先看这里）

### F 场景：查 subagent、prompt 工作流、项目级防护

- `.pi/extensions/subagent/index.ts`
- `.pi/extensions/subagent/agents.ts`
- `.pi/extensions/project-guard.ts`
- `.pi/agents/`
- `runtime/agents-user/`
- `.pi/prompts/`

### G 场景：查 conn / Feishu 集成

- `src/routes/conns.ts`
- `src/routes/conn-route-presenters.ts`
- `src/routes/feishu.ts`
- `src/agent/conn-store.ts`
- `src/agent/conn-db.ts`
- `src/agent/conn-sqlite-store.ts`
- `src/agent/conn-run-store.ts`
- `src/workers/conn-worker.ts`
- `src/integrations/feishu/`
- `docs/runtime-assets-conn-feishu.md`

### H 场景：查容器、部署、健康检查、基础工具

- `Dockerfile`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `deploy/nginx/default.conf`
- `docs/tencent-cloud-singapore-deploy.md`
- `scripts/docker-health.mjs`
- `src/routes/static.ts`
- `runtime/screenshot.mjs`
- `runtime/screenshot-mobile.mjs`

## 7. 文档分层

- `AGENTS.md`
  - 只放最高准则、全局规则、固定口径、场景索引
- `README.md`
  - 对外入口、运行方式、能力概览、文档导航
- `docs/traceability-map.md`
  - 追溯地图：按场景告诉你该先看哪些文件
- `docs/change-log.md`
  - 统一更新记录；行为变更、接口变更、运行口径变更、文档结构变更都要留痕
- `docs/playground-current.md`
  - 当前 playground 的真实交互与 UI 约束
- `DESIGN.md`
  - 当前 playground 的视觉 identity / token / 组件口径；用于辅助 agent 做前端设计决策
- `docs/runtime-assets-conn-feishu.md`
  - 资产、附件、`conn`、飞书接入的运行说明
- `docs/server-ops-quick-reference.md`
  - 腾讯云服务器高频运维动作速查；只看更新、验收、日志、SSH tunnel 和回滚
- `docs/tencent-cloud-singapore-deploy.md`
  - 腾讯云新加坡 CVM 的部署事实、`.env` 口径、更新发布流程、SSH tunnel、验证命令和踩坑记录

## 8. 当前稳定事实

- agent 每轮 prompt 都会通过 `src/agent/file-artifacts.ts` 注入文件交付协议：内部本地 artifact 路径允许直接用于工具与浏览器自动化；用户交付时浏览器预览走宿主可访问 HTTP，真实文件优先 `send_file`，`ugk-file` 只作小文本兜底
- `AgentService` 会在用户可见的正文、流式增量和工具过程消息里，自动把支持的 `/app/public/...`、`/app/runtime/...`、`file:///app/...` 重写成宿主可访问的 `GET /v1/local-file?path=...`；不要再指望宿主浏览器直接打开容器 `file://`
- `AgentService.runChat` 的 `finally` 会 best-effort 调用 `closeBrowserTargetsForScope(undefined)`，通过 `POST /session/close-all?metaAgentScope=...` 清理本轮 `web-access` 保留页面；清理失败只 warn，不应盖住原始任务结果或错误。
- 当前品牌文案为 `UGK CLAW`；桌面端顶部与首页继续使用纯文字字标，手机端顶部状态栏显示品牌 logo + `UGK Claw` 字标。
- 根目录 `DESIGN.md` 是当前 playground 视觉 identity 的机器可读入口；涉及颜色、字号、圆角、组件视觉语义的前端改动，先参考它，必要时同步更新并运行 `npm run design:lint`。
- 代码仓库和运行态目录必须分离：`.env`、`.data/`、部署 tar 包、运行时截图 / HTML 报告、本地调试目录都不属于 GitHub 主仓库内容。
- 腾讯云服务器当前已经把 `.env`、`.data/chrome-sidecar`、`.data/agent` 和生产日志外置到 `~/ugk-claw-shared/`；后续部署默认使用 shared env 文件，不要再把运行态塞回代码目录，也不要删掉 `UGK_AGENT_DATA_DIR` 这条挂载。
- playground 消息宽度跟随 composer；用户消息靠右，系统反馈视觉上跟助手消息保持一致。
- playground 刷新恢复运行态以 `GET /v1/chat/state` 的 canonical conversation state 为准；`GET /v1/chat/events` 只负责同一 active run 的后续增量续订，文案统一是“当前正在运行”，不要再写“上一轮仍在运行”。
- playground 的 `GET /v1/chat/state` 默认只返回最近 160 条可渲染历史，并通过 `historyPage.hasMore / nextBefore / limit` 暴露分页状态；旧消息补页走 `GET /v1/chat/history?before=...&limit=...`，不要再让 state 扛完整历史，也不要把本地 `localStorage` 当完整历史真源。
- playground 从后端 session 恢复已完成任务时，连续 assistant 消息片段必须在 `AgentService` 的 canonical history 中合并成一条助手回复；不要让刷新后的同一轮浏览器处理过程拆成多条“助手”气泡。
- playground Web 入口当前采用“一个 agent、多条历史会话、一个全局当前会话”的模型；不同浏览器 / 设备打开后应先通过 `GET /v1/chat/conversations` 跟随服务端 `currentConversationId`，再通过 `GET /v1/chat/state` 看到当前会话的历史、当前输入、active assistant 正文和过程区。
- playground 会话目录由 `ConversationStore` 维护进程内 `mtime` cache 和串行写队列；不要把 `GET /v1/chat/conversations`、`POST /v1/chat/current`、`POST /v1/chat/conversations` 恢复成每次读写整份 JSON 且无队列保护的实现，写入应继续用同目录临时文件加 `rename` 原子替换。
- playground 的“新会话”必须走 `POST /v1/chat/conversations` 创建并激活新的服务端会话；不要再 reset 旧会话，也不要只清当前浏览器 DOM 写一条本地假提示。
- playground 历史会话切换必须走 `POST /v1/chat/current` 更新全局当前会话；当前 agent 运行中禁止新建和切换，避免一个 agent 工人同时被拖到两条产线。
- playground 用户上滑阅读历史时，流式更新不应强制滚到底部；只有靠近底部时才自动跟随，离开底部后显示“回到底部”按钮。
- playground active 对话态的 `transcript-current` 底部保留 `--transcript-bottom-scroll-buffer` 余量；最后一条消息必须能继续上拖到 composer 上方，不要把这段 padding 当成多余空白删掉。
- playground 的 canonical state hydrate 不应默认清空 transcript；同会话同 `buildConversationStateSignature()` 时跳过 DOM 重绘，消息窗口变化时优先 patch / append 已渲染节点，只有会话切换或消息序列无法对齐时才重建当前 transcript。
- 手机前后台切换或 `/v1/chat/stream` 短断不等于 agent 任务失败；只要 `GET /v1/chat/state` 仍显示 running，前端应切到 `/v1/chat/events` 续订事件流。
- `AgentService` 会为同进程内 active run 保留短期事件缓冲，刷新后的 web 观察者可重新订阅继续更新；服务进程重启后的完整回放仍需要持久化 run event log。
- `playground` 页面恢复同步必须按触发原因分级：`pageshow` 才强制校准当前 state，`visibilitychange` 只在 active run 或 state 过期时回源，`online` 优先查 active run 并续订 `/v1/chat/events`；不要把 `visibilitychange/pageshow/online` 又改回无差别 `GET /v1/chat/conversations` + `GET /v1/chat/state`。
- 已选择文件 / 资产、以及已发送的附件 / 引用资产，统一采用 chip 风格展示。
- playground 资产详情按 id hydrate 由 `assetDetailQueue` 控制最多 4 路并发，并通过 `assetDetailInFlightById` 复用同一 assetId 的进行中请求；不要把 `/v1/assets/:assetId` 恢复成无限制 `Promise.all`。
- “查看技能”走真实接口 `GET /v1/debug/skills`，前端以助手式过程 + 结果列表展示；接口会返回 `source` / `cachedAt`，同一 skill fingerprint 在短 TTL 内应命中缓存，不要每次点击都 reload skills。
- `playground` 消息气泡底部的复制正文操作是小型灰色裸 icon：无可见文字、无背景、无边框、无阴影；文字只保留在 `aria-label` / 隐藏文本里，不要再改回占高度的“复制正文”按钮。
- `playground` 底部 composer textarea 当前按内容自适应，最多显示 10 行，超过后只在 textarea 内部纵向滚动；textarea 必须显式 `rows="1"`，空内容和单行内容保留 CSS `min-height` 来保证 placeholder / 正文纵向居中，placeholder 固定为“和我聊聊吧”。
- `playground` 助手气泡、任务消息结果气泡和后台 run detail `Result` 都走 markdown 渲染与 hydration；正文收口为 `12px`，标题按 `18px / 16px / 14px` 分级，链接、inline code、blockquote 和表格头用轻量颜色区分。用户气泡不要套这组助手输出规则。
- `playground` 手机端当前采用“顶部紧凑品牌状态栏 / 左侧历史会话抽屉 / 中间 transcript / 底部 composer”结构；状态栏左侧是可点击的 logo + `UGK Claw` 历史入口，右侧只保留 `新会话` 和 `更多` 两个 icon 按钮，`技能 / 文件 / 文件库 / 后台任务 / 任务消息` 收进右上角溢出菜单；发送区是 icon-only 控件，代码块展示层单独收口，所有这些改动只在 `max-width: 640px` 内生效。
- `playground` 文件库、后台任务管理器和任务消息页的头部统一按透明单行工具栏收口：只保留标题和必要动作，不显示解释性说明句，不铺独立深色渐变背景；手机端允许横向滚动按钮行，但不要拆回筛选区 / 动作区两层。
- 任务消息未读数随 `GET /v1/activity`、`POST /v1/activity/:activityId/read` 和 `POST /v1/activity/read-all` 主响应返回；`GET /v1/activity/summary` 只保留给初始化 / 轻量兜底，不要在打开任务消息或标记已读后固定补打一条 summary 请求。
- 后台任务管理器打开时只应请求一次 `GET /v1/conns`；该接口会在 conn 条目上返回 `latestRun` 摘要，完整 runs 只在展开单个 conn 或打开详情时按需读取。不要再恢复成打开管理器就对所有 conn 做 `1 + N` runs 请求。
- `playground` 手机端历史会话抽屉右侧只保留透明点击遮罩用于关闭，不再叠加暗色或 blur；历史列表保留纵向滚动但隐藏侧边滚动条，列表项统一 `4px` 圆角。
- Docker 镜像已内置 `git`、`curl`、`ca-certificates` 与 `python3`，不要再把 `/bin/bash: git: command not found`、`/bin/bash: curl: command not found` 或 `python3: not found` 当成玄学问题。
- `web-access` 默认真实浏览器链路走 Docker Chrome sidecar：`WEB_ACCESS_BROWSER_PROVIDER=direct_cdp` -> `http://172.31.250.10:9223`；Windows host IPC fallback 仅保留给 legacy 本机调试和紧急排障。
- `ugk-pi-browser` 当前通过容器内 healthcheck 自举 Chrome CDP；后续排障别只看 GUI 能不能打开，至少同时确认浏览器容器 `healthy`，以及 `127.0.0.1:9222` / `172.31.250.10:9223` 探针能通。
- sidecar GUI 从桌面手点打开的 Chrome 也必须走同一个 `WEB_ACCESS_BROWSER_PROFILE_DIR=/config/chrome-profile-sidecar`；如果 GUI 和 agent 看起来像两套登录态，优先检查 desktop launcher 是否还是旧容器里的默认命令。
- 宿主浏览器和 sidecar Chrome 都不能直接依赖容器内 `file:///app/...`：用户可见文本要改写成 `PUBLIC_BASE_URL` 下的 `GET /v1/local-file?path=...`，sidecar 自动化要改写成 `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL` 下的同一路由，真实文件交付优先走 `send_file`。
- 腾讯云新加坡生产样例使用 `docker-compose.prod.yml`，当前 `HOST_PORT=3000`、`PUBLIC_BASE_URL=http://43.134.167.179:3000`；后续切域名或 HTTPS 时必须同步服务器 `.env`、安全组和 `docs/tencent-cloud-singapore-deploy.md`。
