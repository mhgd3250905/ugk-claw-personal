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
- sidecar GUI 登录入口是 `https://127.0.0.1:3901/`，登录态持久目录是 `.data/chrome-sidecar`。
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
  - 再强刷浏览器
  - 不要第一反应去开 `3101`、`3102` 之类临时端口
- 临时端口只允许短时排障；排障结束必须回到 `3000` 做最终验证。

## 5. 关键路径

- 服务入口：`src/server.ts`
- 聊天路由：`src/routes/chat.ts`
- playground 路由：`src/routes/playground.ts`
- 静态报告路由：`src/routes/static.ts`
- playground UI：`src/ui/playground.ts`
- agent 服务核心：`src/agent/agent-service.ts`
- session 工厂：`src/agent/agent-session-factory.ts`
- 资产库：`src/agent/asset-store.ts`
- 文件交付协议：`src/agent/file-artifacts.ts`
- agent 发文件工具：`.pi/extensions/send-file.ts`
- conn：`src/agent/conn-store.ts`、`src/agent/conn-scheduler.ts`、`src/agent/conn-runner.ts`
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

如果这次 `/init` 的目标是接手云服务器，而不是本机开发，先记住三件事：

- 当前云端正式入口是 `http://43.134.167.179:3000/playground`。
- 服务器当前主部署目录是 `~/ugk-claw-repo`，已经是 GitHub 工作目录；旧的 `~/ugk-pi-claw` 与 `~/ugk-pi-claw-prev-*` 只保留给回滚和比对，不是默认更新入口。
- 只要改到 `Dockerfile`、系统依赖或运行环境，服务器必须执行 `docker compose -f docker-compose.prod.yml up --build -d`，不要只 `restart`。

如果这次 `/init` 还要接手 `playground` 前端，再记住两件事：

- 手机端当前不是桌面端压缩版，而是独立收口过的移动展示层；先看 `docs/playground-current.md`，别上来就按桌面布局推断手机样式。
- 手机端近期高频改动集中在 `src/ui/playground.ts` 的移动断点、`test/server.test.ts` 的页面断言，以及 `docs/playground-current.md` 的真实口径。

### B 场景：查聊天、会话、流式、打断

- `GET /v1/chat/status`
- `GET /v1/chat/events`
- `src/routes/chat.ts`
- `src/agent/agent-service.ts`
- `src/agent/agent-session-factory.ts`
- `src/types/api.ts`

### C 场景：查 playground 页面、消息气泡、思考过程、品牌和文件展示

- `src/ui/playground.ts`
- `test/server.test.ts`
- `docs/playground-current.md`

### D 场景：查上传文件、资产复用、`assetRefs`、`ugk-file`、`send_file`

- `src/routes/files.ts`
- `src/agent/asset-store.ts`
- `src/agent/file-artifacts.ts`
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
- `src/routes/feishu.ts`
- `src/agent/conn-store.ts`
- `src/agent/conn-scheduler.ts`
- `src/agent/conn-runner.ts`
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
- `docs/runtime-assets-conn-feishu.md`
  - 资产、附件、`conn`、飞书接入的运行说明
- `docs/tencent-cloud-singapore-deploy.md`
  - 腾讯云新加坡 CVM 的部署事实、`.env` 口径、更新发布流程、SSH tunnel、验证命令和踩坑记录

## 8. 当前稳定事实

- agent 每轮 prompt 都会通过 `src/agent/file-artifacts.ts` 注入文件交付协议：内部本地 artifact 路径允许直接用于工具与浏览器自动化；用户交付时浏览器预览走宿主可访问 HTTP，真实文件优先 `send_file`，`ugk-file` 只作小文本兜底
- `AgentService` 会在用户可见的正文、流式增量和工具过程消息里，自动把支持的 `/app/public/...`、`/app/runtime/...`、`file:///app/...` 重写成宿主可访问的 `GET /v1/local-file?path=...`；不要再指望宿主浏览器直接打开容器 `file://`
- 当前品牌文案为 `UGK CLAW`，playground 顶部和首页使用纯文字字标，不显示图片 logo。
- 代码仓库和运行态目录必须分离：`.env`、`.data/`、部署 tar 包、运行时截图 / HTML 报告、本地调试目录都不属于 GitHub 主仓库内容。
- 腾讯云服务器当前已经把 `.env`、`.data/chrome-sidecar` 和生产日志外置到 `~/ugk-claw-shared/`；后续部署默认使用 shared env 文件，不要再把运行态塞回代码目录。
- playground 消息宽度跟随 composer；用户消息靠右，系统反馈视觉上跟助手消息保持一致。
- playground 刷新恢复运行态以 `GET /v1/chat/status` 和 `GET /v1/chat/events` 为准；文案统一是“当前正在运行”，不要再写“上一轮仍在运行”。
- `AgentService` 会为同进程内 active run 保留短期事件缓冲，刷新后的 web 观察者可重新订阅继续更新；服务进程重启后的完整回放仍需要持久化 run event log。
- 已选择文件 / 资产、以及已发送的附件 / 引用资产，统一采用 chip 风格展示。
- “查看技能”走真实接口 `GET /v1/debug/skills`，前端以助手式过程 + 结果列表展示。
- `playground` 手机端当前采用“顶部四按钮条 / 中间 transcript / 底部 composer”结构；发送区是 icon-only 控件，代码块展示层单独收口，所有这些改动只在 `max-width: 640px` 内生效。
- Docker 镜像已内置 `git`、`curl`、`ca-certificates` 与 `python3`，不要再把 `/bin/bash: git: command not found`、`/bin/bash: curl: command not found` 或 `python3: not found` 当成玄学问题。
- `web-access` 默认真实浏览器链路走 Docker Chrome sidecar：`WEB_ACCESS_BROWSER_PROVIDER=direct_cdp` -> `http://172.31.250.10:9223`；Windows host IPC fallback 仅保留给 legacy 本机调试和紧急排障。
- `ugk-pi-browser` 当前通过容器内 healthcheck 自举 Chrome CDP；后续排障别只看 GUI 能不能打开，至少同时确认浏览器容器 `healthy`，以及 `127.0.0.1:9222` / `172.31.250.10:9223` 探针能通。
- 宿主浏览器和 sidecar Chrome 都不能直接依赖容器内 `file:///app/...`：用户可见文本要改写成 `PUBLIC_BASE_URL` 下的 `GET /v1/local-file?path=...`，sidecar 自动化要改写成 `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL` 下的同一路由，真实文件交付优先走 `send_file`。
- 腾讯云新加坡生产样例使用 `docker-compose.prod.yml`，当前 `HOST_PORT=3000`、`PUBLIC_BASE_URL=http://43.134.167.179:3000`；后续切域名或 HTTPS 时必须同步服务器 `.env`、安全组和 `docs/tencent-cloud-singapore-deploy.md`。
