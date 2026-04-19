# ugk-pi

基于 `pi-coding-agent` 的自定义 HTTP agent 原型仓库。

当前重点不是做一个完整业务平台，而是把这些基础能力跑稳：

- agent runtime
- 会话与流式输出
- playground
- 文件交付与本地报告访问
- web-access 宿主浏览器桥接
- 为 Feishu / Slack / 企业微信等接入预留形态

## 快速开始

安装依赖：

```bash
npm install
```

启动开发容器：

```bash
docker compose up -d
```

默认入口：

- `http://127.0.0.1:3000`
- `http://127.0.0.1:3000/playground`
- `http://127.0.0.1:3000/healthz`

大多数源码改动后只需要：

```bash
docker compose restart ugk-pi
```

如果页面还是旧内容，先重启 `ugk-pi`，再强刷浏览器；别一上来再开一堆临时端口把状态搞脏。

## 当前稳定口径

### 1. 本地文件与报告

- agent 内部允许继续使用 `/app/...` 和 `file:///app/...` 作为本地 artifact 路径
- 宿主浏览器不能直接打开容器内 `file:///app/...`
- 运行时会自动把用户可见文本里的受支持本地路径改写成：

```text
http://127.0.0.1:3000/v1/local-file?path=...
```

- 需要直接给用户文件时，优先使用 `send_file`

### 2. 静态与运行时文件出口

- `public/` 根目录文件：
  - `GET /:fileName`
- `runtime/` 报告文件：
  - `GET /runtime/:fileName`
- 统一本地 artifact 桥接：
  - `GET /v1/local-file?path=...`
- 资产与文件下载：
  - `GET /v1/assets`
  - `GET /v1/assets/:assetId`
  - `GET /v1/files/:fileId`

### 3. 文件预览与下载

- `/v1/files/:fileId` 会按 MIME 决定默认 `inline` 还是 `attachment`
- 强制下载使用：

```text
/v1/files/:fileId?download=1
```

- 中文文件名已经按 `filename` + `filename*` 处理，不再因为响应头非法导致 0B 下载

### 4. web-access 浏览器桥接

- 容器内 agent 不直接找 Windows Chrome
- 真正链路是：

```text
container agent -> IPC -> host bridge -> LocalCdpBrowser -> Chrome CDP
```

- 宿主桥接默认使用项目内持久 profile：

```text
.data/web-access-chrome-profile
```

- X 等站点第一次登录后，后续通常不用重复登录，除非站点 session 过期、手动退出，或 profile 被清空

## 常用接口

### 基础

- `GET /healthz`
- `GET /playground`
- `GET /assets/fonts/:fileName`

### 聊天与流式

- `POST /v1/chat`
- `POST /v1/chat/stream`
- `POST /v1/chat/queue`
- `POST /v1/chat/interrupt`
- `GET /v1/chat/status`
- `GET /v1/chat/events`
- `GET /v1/debug/skills`

### 文件与资产

- `GET /v1/assets`
- `GET /v1/assets/:assetId`
- `GET /v1/files/:fileId`
- `GET /v1/local-file?path=...`
- `GET /:fileName`
- `GET /runtime/:fileName`

### 集成

- `GET /v1/conns`
- `POST /v1/integrations/feishu/events`

## 文档导航

- [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - 最高准则、固定运行口径、关键路径、场景索引
- [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - 按问题场景快速定位入口
- [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
  - playground 当前真实 UI 与交互约束
- [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)
  - 资产、附件、`send_file`、`conn`、Feishu 运行说明
- [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - web-access 宿主浏览器桥接、Chrome 持久 profile、排障口径
- [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)
  - 统一更新记录

## 关键路径

- [src/server.ts](/E:/AII/ugk-pi/src/server.ts)
- [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
- [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
- [src/routes/static.ts](/E:/AII/ugk-pi/src/routes/static.ts)
- [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
- [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
- [.pi/extensions/send-file.ts](/E:/AII/ugk-pi/.pi/extensions/send-file.ts)
- [runtime/screenshot.mjs](/E:/AII/ugk-pi/runtime/screenshot.mjs)
- [runtime/skills-user/web-access/scripts/local-cdp-browser.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/local-cdp-browser.mjs)

## 常用验证命令

健康检查：

```bash
curl http://127.0.0.1:3000/healthz
```

查看真实技能清单：

```bash
curl http://127.0.0.1:3000/v1/debug/skills
```

打开本地 artifact：

```text
http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fpublic%2Fzhihu-hot-share.html
```

查看运行态：

```bash
curl "http://127.0.0.1:3000/v1/chat/status?conversationId=manual:test"
```
