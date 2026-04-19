# ugk-pi

基于 `pi-coding-agent` 的自定义 HTTP agent 原型仓库。

这不是完整业务平台，当前重点是把 runtime、会话、技能加载、HTTP 接口、playground 和后续 IM 接入形态跑稳。

## 文档导航

- [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - 最高准则、全局规则、固定运行口径、场景索引
- [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - 按问题场景追溯该先看哪些文件
- [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)
  - 统一更新记录；每次影响行为或口径的改动都要留痕
- [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
  - playground 当前真实 UI、交互和约束
- [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)
  - 资产、附件、`assetRefs`、`ugk-file`、`conn`、飞书接入

## 快速接手

推荐顺序：

1. [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
2. [README.md](/E:/AII/ugk-pi/README.md)
3. [src/server.ts](/E:/AII/ugk-pi/src/server.ts)
4. [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
5. [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
6. [src/agent/agent-session-factory.ts](/E:/AII/ugk-pi/src/agent/agent-session-factory.ts)
7. [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)

先记住这几个事实：

- 这是 `pi-coding-agent` 的自定义 HTTP agent 原型，不是完整产品。
- 技能分两层：
  - 系统技能：`.pi/skills`
  - 用户技能：`runtime/skills-user`
- subagent 分两层：
  - 系统 subagent：`.pi/agents`
  - 用户 subagent：`runtime/agents-user`
- 真实技能清单以 `GET /v1/debug/skills` 为准，不要信模型自述。
- 默认本地验证入口固定为 `http://127.0.0.1:3000/playground`。

## 当前能力概览

- HTTP 服务入口已稳定：
  - `GET /healthz`
  - `GET /playground`
  - `GET /assets/fonts/:fileName`
  - `GET /v1/files/:fileId`
  - `GET /v1/assets`
  - `GET /v1/assets/:assetId`
  - `GET /v1/conns`
  - `GET /v1/debug/skills`
  - `GET /v1/chat/status`
  - `GET /v1/chat/events`
  - `POST /v1/chat`
  - `POST /v1/chat/stream`
  - `POST /v1/chat/queue`
  - `POST /v1/chat/interrupt`
  - `POST /v1/integrations/feishu/events`
- playground 当前品牌为 `UGK CLAW`，顶部与首页使用纯文字字标。
- playground 支持文件选择、拖入、最近资产复用、chip 展示、Markdown 渲染、代码块复制。
- 用户消息固定靠右；系统反馈视觉上与助手消息保持一致。
- 助手消息内保留单个“思考过程”区域，默认展开显示过程和当前动作。
- 运行中刷新页面会按真实 agent 状态恢复：`GET /v1/chat/status` 判断当前 `conversationId` 是否仍在运行，`GET /v1/chat/events` 重新订阅 active run 事件并继续更新同一个助手气泡。
- “查看技能”按钮会先展示过程，再列出 `GET /v1/debug/skills` 返回的完整技能清单。
- 统一资产库已接入上传文件、agent 产出文件、`assetRefs` 复用和 `ugk-file` 协议。
- 已支持 `conn` 定时 / 周期任务和飞书 webhook 接入。
- Docker 镜像已内置 `curl` 与 `ca-certificates`。

## 目录结构

```text
ugk-pi/
├─ .codex/plans/
├─ .data/
├─ .pi/
│  ├─ agents/
│  ├─ extensions/
│  ├─ prompts/
│  ├─ settings.json
│  └─ skills/
├─ docs/
├─ public/
│  └─ fonts/
├─ runtime/
│  ├─ agents-user/
│  ├─ pi-agent/
│  └─ skills-user/
├─ src/
├─ test/
├─ AGENTS.md
└─ README.md
```

## 核心架构

- [src/server.ts](/E:/AII/ugk-pi/src/server.ts)
  - 装配 Fastify、AgentService、资产库、conn、飞书、playground 和各路由
- [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - 聊天、流式、追加、打断、技能清单接口
- [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - 会话复用、SSE 映射、运行中追加、打断、附件/资产注入、文件产出提取
- [src/agent/agent-session-factory.ts](/E:/AII/ugk-pi/src/agent/agent-session-factory.ts)
  - session 创建、技能白名单、项目级 provider/model 装配
- [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - 本地 playground 页面、样式、前端状态、消息渲染、文件/资产交互

## 参考基线

- 官方仓库：`https://github.com/badlogic/pi-mono`
- 本地参考镜像：`references/pi-mono`
- 优先参考：
  - `references/pi-mono/packages/coding-agent/README.md`
  - `references/pi-mono/packages/coding-agent/docs/settings.md`
  - `references/pi-mono/AGENTS.md`

别把 `references/pi-mono/` 当业务目录改，它是参考镜像，不是给你撒野的地方。

## 运行方式

### 推荐方式

- Windows：Docker Desktop 跑 Linux 容器
- macOS：Docker Desktop 跑 Linux 容器
- Linux：优先容器，裸跑只作为兼容调试

### 本地开发

安装依赖：

```bash
npm install
```

启动开发容器：

```bash
docker compose up -d
```

或使用脚本：

```bash
npm run docker:up
```

默认入口：

```text
http://127.0.0.1:3000
http://127.0.0.1:3000/playground
```

大多数源码改动后只需要：

```bash
docker compose restart ugk-pi
```

如果页面还是旧 HTML，先重启容器再强刷，别手贱另开 `3101`、`3102` 制造脏状态。

### 生产 compose

准备环境变量：

```bash
cp .env.example .env
```

至少填写：

```text
DASHSCOPE_CODING_API_KEY=你的真实 key
```

启动：

```bash
npm run docker:up:prod
```

查看状态：

```bash
npm run docker:status:prod
npm run docker:health:prod
```

查看日志：

```bash
npm run docker:logs:prod
npm run docker:logs:nginx
```

### 裸跑兼容方式

```bash
npm install
npm start
```

容器外默认：

```text
HOST=127.0.0.1
PORT=3000
```

容器内默认：

```text
HOST=0.0.0.0
PORT=3000
```

## `pi` 与项目资源

安装：

```bash
npm install -g @mariozechner/pi-coding-agent
```

启动：

```bash
pi
```

建议进入后先：

```bash
/reload
```

常用项目资源：

- prompts：`.pi/prompts/`
- skills：`.pi/skills/`
- 用户 skills：`runtime/skills-user/`
- subagents：`.pi/agents/`
- 用户 subagents：`runtime/agents-user/`
- 项目级 agent 配置：`runtime/pi-agent/`

常用 prompt：

```bash
/feature-bootstrap <功能目标>
/implement <实现目标>
/scout-and-plan <调研目标>
/implement-and-review <实现并审查目标>
```

## 接口速查

健康检查：

```bash
curl http://127.0.0.1:3000/healthz
```

查看真实技能清单：

```bash
curl http://127.0.0.1:3000/v1/debug/skills
```

同步聊天：

```bash
curl -X POST http://127.0.0.1:3000/v1/chat ^
  -H "content-type: application/json" ^
  -d "{\"conversationId\":\"manual:test-1\",\"message\":\"你好，介绍一下当前项目\"}"
```

带附件聊天：

```bash
curl -X POST http://127.0.0.1:3000/v1/chat ^
  -H "content-type: application/json" ^
  -d "{\"conversationId\":\"manual:file-1\",\"message\":\"请总结这个文件\",\"attachments\":[{\"fileName\":\"notes.txt\",\"mimeType\":\"text/plain\",\"sizeBytes\":12,\"text\":\"hello file\"}]}"
```

复用已有资产：

```bash
curl -X POST http://127.0.0.1:3000/v1/chat ^
  -H "content-type: application/json" ^
  -d "{\"conversationId\":\"manual:file-2\",\"message\":\"继续基于这个文件处理\",\"assetRefs\":[\"asset-id\"]}"
```

流式聊天：

```bash
curl -N -X POST http://127.0.0.1:3000/v1/chat/stream ^
  -H "content-type: application/json" ^
  -d "{\"conversationId\":\"manual:stream-1\",\"message\":\"请流式回复\"}"
```

查看当前会话是否仍在运行：

```bash
curl "http://127.0.0.1:3000/v1/chat/status?conversationId=manual:stream-1"
```

重新订阅当前运行任务事件：

```bash
curl -N "http://127.0.0.1:3000/v1/chat/events?conversationId=manual:stream-1"
```

追加运行中消息：

```bash
curl -X POST http://127.0.0.1:3000/v1/chat/queue ^
  -H "content-type: application/json" ^
  -d "{\"conversationId\":\"manual:stream-1\",\"message\":\"补充一条要求\",\"mode\":\"steer\"}"
```

打断当前运行：

```bash
curl -X POST http://127.0.0.1:3000/v1/chat/interrupt ^
  -H "content-type: application/json" ^
  -d "{\"conversationId\":\"manual:stream-1\"}"
```

查看最近资产：

```bash
curl http://127.0.0.1:3000/v1/assets
```

下载 agent 产出文件：

```bash
curl -OJ http://127.0.0.1:3000/v1/files/file-id
```

## 当前实现边界

当前阶段不要自作主张去补这些东西：

- 多租户鉴权
- 数据库存储
- 分布式任务编排
- 正式业务前后端框架
- Slack / 企业微信完整适配

先把 runtime 和接入层打稳，不然越写越像给事故做预埋。

## 验证

基础检查：

```bash
npx tsc --noEmit
npm run test
```

最近文档整理前的回归结果是：

- `npx tsc --noEmit` 通过
- `npm run test` 为 `76 / 76` 通过
- 默认入口 `127.0.0.1:3000` 已验证 `/healthz`、`/playground`、运行态重连入口和 `UGK CLAW` playground HTML
