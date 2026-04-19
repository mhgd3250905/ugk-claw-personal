This file provides the highest-level working rules for AI coding agents in this repository.

# ugk-pi Agent Guide

## 1. 最高准则

- 默认使用简体中文回复；只有用户明确要求英文时才切换。
- 命令、代码、日志、报错保持原始语言；其余解释用中文。
- 先读现有文件，再动手；优先编辑已有文件，不要无意义新建。
- 先判断任务性质：
  - 文档 / 规划任务：优先改文档，不要顺手碰源码。
  - 实现 / 修复任务：先看真实入口和调用链，再落代码。
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
- 任何需要让宿主浏览器打开的本地报告 / 图片 / HTML，不要给 `file:///app/...` 这类容器路径：
  - `public/` 根目录文件走 `http://127.0.0.1:3000/<fileName>`
  - `runtime/` 生成报告走 `http://127.0.0.1:3000/runtime/<fileName>`
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
- 项目级 subagent：`.pi/agents/`
- 用户 subagent：`runtime/agents-user/`
- 项目级 `pi` agent：`runtime/pi-agent/`

## 6. 场景索引

### A 场景：快速接手项目

先看这些文件，别一上来全仓乱翻：

1. `AGENTS.md`
2. `README.md`
3. `docs/traceability-map.md`
4. `src/server.ts`
5. `src/routes/chat.ts`
6. `src/agent/agent-service.ts`
7. `src/agent/agent-session-factory.ts`
8. `src/ui/playground.ts`

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

## 8. 当前稳定事实

- agent 每轮 prompt 都会通过 `src/agent/file-artifacts.ts` 注入文件交付协议：预览型产物回 HTTP URL，真实文件优先 `send_file`，`ugk-file` 只作小文本兜底
- 当前品牌文案为 `UGK CLAW`，playground 顶部和首页使用纯文字字标，不显示图片 logo。
- playground 消息宽度跟随 composer；用户消息靠右，系统反馈视觉上跟助手消息保持一致。
- playground 刷新恢复运行态以 `GET /v1/chat/status` 和 `GET /v1/chat/events` 为准；文案统一是“当前正在运行”，不要再写“上一轮仍在运行”。
- `AgentService` 会为同进程内 active run 保留短期事件缓冲，刷新后的 web 观察者可重新订阅继续更新；服务进程重启后的完整回放仍需要持久化 run event log。
- 已选择文件 / 资产、以及已发送的附件 / 引用资产，统一采用 chip 风格展示。
- “查看技能”走真实接口 `GET /v1/debug/skills`，前端以助手式过程 + 结果列表展示。
- Docker 镜像已内置 `curl` 与 `ca-certificates`，不要再把 `/bin/bash: curl: command not found` 当成玄学问题。
- `web-access` 真实浏览器链路走宿主 IPC bridge；容器内 `local_browser_executable_not_found` 不等于 Windows 没装 Chrome，先查 `docs/web-access-browser-bridge.md`。
- 宿主浏览器永远不能直接访问容器内 `file:///app/...`；凡是要给用户打开的本地报告，必须转成 HTTP URL 或 `send_file`。
