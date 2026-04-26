# ugk-pi

基于 `pi-coding-agent` 的自定义 HTTP agent 原型仓库。

当前重点不是做一个完整业务平台，而是把这些基础能力跑稳：

- agent runtime
- 会话与流式输出
- playground
- 文件交付与本地报告访问
- web-access Docker Chrome sidecar 浏览器桥接
- 为 Feishu / Slack / 企业微信等接入预留形态

## 阶段快照

截至 `2026-04-26`，这个阶段的核心结论是：`web-access` 主链路已经从 Windows 宿主 IPC 迁移到 Docker Chrome sidecar，playground / 会话 / 资产 / conn runtime 已进入稳定整理阶段。后续 `/init` 接手时，先把它当作 Linux / Docker 可部署方案看，不要默认回到宿主 Chrome；最新交接入口看 [docs/handoff-current.md](/E:/AII/ugk-pi/docs/handoff-current.md)。

当前主链路：

```text
agent / skill -> direct_cdp -> LocalCdpBrowser -> 172.31.250.10:9223 -> Docker Chrome sidecar
```

当前稳定事实：

- 当前代码主仓库已经切到 GitHub：`https://github.com/mhgd3250905/ugk-claw-personal.git`
- sidecar GUI 登录入口是 `https://127.0.0.1:3901/`
- 登录态持久目录是 `.data/chrome-sidecar`
- 用户可见链接使用 `PUBLIC_BASE_URL`
- sidecar 自动化打开本地 artifact 使用 `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL=http://ugk-pi:3000`
- Windows host IPC 只保留为 legacy fallback，不是 Docker / Linux 默认路径
- 阶段验证命令是 `npm test` 和 `npm run docker:chrome:check`
- `playground` 的手机端已经单独重写成移动聊天页，不是把桌面端硬压缩；后续 `/init` 如果要接手前端，先看 [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)，别按“桌面端缩略版”理解
- `playground` 当前采用“一个 agent、多条历史会话、一个全局当前会话”的模型；不同浏览器 / 设备打开后先通过 `GET /v1/chat/conversations` 跟随服务端 `currentConversationId`，再用 `GET /v1/chat/state` 同步当前会话的历史、运行态和 active run 过程
- 页面前后台切换、手机浏览器挂起或 `/v1/chat/stream` 主连接短断时，如果 `/v1/chat/state` 仍显示后端任务运行中，前端会切到 `/v1/chat/events` 继续订阅，不把这种浏览器生命周期断线当成本轮失败
- `新会话` 按钮现在走 `POST /v1/chat/conversations` 创建并激活新的服务端会话；旧会话保留为历史，运行中禁止新建或切换，避免一个 agent 同时被拖到两条产线
- 当前推荐稳定发布 tag 是 `snapshot-20260422-v4.1.2-stable`；`snapshot-20260422-v4.1.1-stable` 已存在，但因为 `docker-compose.prod.yml` 的 YAML 缩进错误，不应再作为交接后的部署基线
- `.env`、`.data/`、部署 tar 包、运行时截图 / HTML 报告和本地调试目录不属于代码仓库；后续 GitHub 部署与服务器迁移都要按 `.gitignore` 边界处理

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

当前腾讯云新加坡部署入口记录在 [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)。云端公网入口是 `http://43.134.167.179:3000/playground`，Chrome sidecar GUI 只通过 SSH tunnel 访问，不开放公网 `3901`。

当前仓库管理口径：

- GitHub 是代码事实源
- 服务器当前主部署目录已经迁到 `~/ugk-claw-repo`，是 GitHub clone 出来的 Git 工作目录
- 旧的 `~/ugk-pi-claw` 与 `~/ugk-pi-claw-prev-*` 只保留作回滚兜底，不再是默认更新入口
- 服务器当前把 `.env`、`.data/chrome-sidecar` 和生产日志进一步外置到 `~/ugk-claw-shared/`，后续部署统一通过 shared env 文件驱动

大多数源码改动后只需要：

```bash
docker compose restart ugk-pi
```

但如果你改的是这些东西：

- `Dockerfile`
- npm 依赖安装层
- 容器内系统工具，例如 `python3`
- compose 环境变量或运行时依赖

就不要偷懒用 `restart`，而要在对应环境执行：

```bash
docker compose up --build -d
```

云服务器生产环境则用：

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

如果页面还是旧内容，先重启 `ugk-pi`，再强刷浏览器；别一上来再开一堆临时端口把状态搞脏。对 `playground` 前端行为改动，重启后还要确认 `http://127.0.0.1:3000/playground` 实际返回了本轮新增的 HTML / JS 标记，避免拿旧页面测试新逻辑。

当前开发镜像已内置 `git`、`curl`、`ca-certificates` 和 `python3`。需要在容器内确认仓库状态、执行只读 git 命令，或运行用户技能里的 Python 脚本时，不用再额外临时安装。

当前 `docker compose up -d` 还会同时拉起一个可登录的 Chrome sidecar：

- GUI 登录入口：`https://127.0.0.1:3901/`
- 浏览器登录态持久目录：`.data/chrome-sidecar`
- `ugk-pi` 容器默认通过 `WEB_ACCESS_BROWSER_PROVIDER=direct_cdp` 直连 sidecar 的 `172.31.250.10:9223` CDP relay，不再先等宿主 IPC 超时
- 用户可见链接继续使用 `PUBLIC_BASE_URL`；sidecar Chrome 打开本地 artifact 时使用 `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL=http://ugk-pi:3000`

第一次打开 sidecar GUI 时浏览器会使用自签名证书，手工放行后即可在里面登录站点账号做验证。

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

- 当前默认链路是 Docker Chrome sidecar：

```text
container agent -> direct_cdp -> LocalCdpBrowser -> 172.31.250.10:9223 -> Docker Chrome sidecar
```

- legacy Windows host IPC fallback 仍保留给本机调试和紧急排障，但不再是 Docker / Linux 默认路径。
- sidecar 登录态默认保存在：

```text
.data/chrome-sidecar
```

- X 等站点第一次在 sidecar GUI 登录后，后续通常不用重复登录，除非站点 session 过期、手动退出，或 profile 被清空。

### 5. Docker Chrome sidecar（当前已启用）

- 开发 compose 与生产 compose 都已预留 `ugk-pi-browser`
- `ugk-pi` 优先直连 `http://172.31.250.10:9223`
- 手工登录走 `https://127.0.0.1:3901/`
- 自动截图 / 浏览器打开本地 HTML 时，agent 会把 `/app/runtime/...`、`/app/public/...` 解析成 sidecar 可访问的 `http://ugk-pi:3000/v1/local-file?...`，而不是让 sidecar Chrome 打开宿主用的 `127.0.0.1:3000`
- sidecar 模式更适合 Linux 云服务器；宿主 IPC bridge 继续保留给本机 Windows 登录态复用和排障

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
- `GET /v1/chat/state`
- `GET /v1/chat/history`
- `GET /v1/chat/events`
- `GET /v1/chat/conversations`
- `POST /v1/chat/conversations`
- `POST /v1/chat/current`
- `POST /v1/chat/reset`
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
- `POST /v1/conns`
- `GET /v1/conns/:connId/runs`
- `GET /v1/conns/:connId/runs/:runId`
- `GET /v1/conns/:connId/runs/:runId/events`
- `POST /v1/conns/:connId/run`
- `POST /v1/integrations/feishu/events`

`POST /v1/conns` 在未显式传入 `target` 时，会默认把任务结果投递到任务消息页 `{ "type": "task_inbox" }`；显式传入 `conversation` / `feishu_chat` / `feishu_user` 目标时仍按请求值执行。旧的 `conversation` 目标只保留后端兼容读取，不再作为前台默认投递路径。

本地 `docker compose` 默认把 `conn.sqlite` 放在 Docker named volume `ugk-pi-conn-db`，避免 Windows / macOS 上 Docker Desktop bind mount 下的多进程 SQLite 打开异常；第一次切换到这个路径时，会从 legacy `.data/agent/conn/conn.sqlite` 做一次自动迁移。

## 文档导航

- [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - 最高准则、固定运行口径、关键路径、场景索引
- [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - 按问题场景快速定位入口
- [docs/handoff-current.md](/E:/AII/ugk-pi/docs/handoff-current.md)
  - 当前交接总览；包含最新稳定 tag、线上已部署提交、回滚锚点与接手顺序
- [docs/playground-runtime-refactor-summary-2026-04-22.md](/E:/AII/ugk-pi/docs/playground-runtime-refactor-summary-2026-04-22.md)
  - `playground` 本轮 runtime 拆分、竞态修复与边界收口的阶段总结
- [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
  - playground 当前真实 UI 与交互约束；包含手机端重写后的布局、代码块和发送区口径
- [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)
  - 资产、附件、`send_file`、`conn`、Feishu 运行说明
- [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - web-access Docker Chrome sidecar、legacy IPC fallback、Chrome 持久 profile、排障口径
- [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
  - 腾讯云服务器最常用运维命令速查；只保留更新、验收、日志、SSH tunnel 和回滚这些高频动作
- [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
  - 腾讯云新加坡 CVM 部署、`.env`、更新发布、SSH tunnel、验证与回滚 runbook
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

检查 sidecar 浏览器链路：

```bash
docker compose exec -T ugk-pi sh -lc "node /app/runtime/skills-user/web-access/scripts/check-deps.mjs"
```

打开本地 artifact：

```text
http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fpublic%2Fzhihu-hot-share.html
```

查看运行态：

```bash
curl "http://127.0.0.1:3000/v1/chat/state?conversationId=agent%3Aglobal"
```

## Docker Chrome sidecar 速查

- sidecar 使用唯一持久 profile 配置：`WEB_ACCESS_BROWSER_PROFILE_DIR`
- 默认 profile 路径是 `${WEB_ACCESS_BROWSER_PROFILE_DIR:-/config/chrome-profile-sidecar}`
- `PUBLIC_BASE_URL` 给用户可见链接使用；`WEB_ACCESS_BROWSER_PUBLIC_BASE_URL` 给 CDP 控制的 sidecar Chrome 使用
- 默认 sidecar 浏览器内访问 app 的地址是 `http://ugk-pi:3000`，因为浏览器容器里的 `127.0.0.1` 指向它自己
- 不要把手工登录和自动启动拆到两个 profile 路径，否则重启验证会骗你
- `npm run docker:chrome:restart` 会在启动前清理 Chrome crash-restore 状态，`Restore Pages?` 不应该继续挡住手工操作
- `npm run docker:chrome:check` 是 `web-access -> direct_cdp -> Chrome sidecar` 链路的标准验证命令
- `npm run docker:chrome:status` 打印 compose 状态和两个 CDP 探针；`npm run docker:chrome:open` 只打印 sidecar GUI URL，不擅自启动宿主 GUI app
- sidecar 使用 `SELKIES_USE_BROWSER_CURSORS=true`，手工 GUI 控制会使用本地浏览器光标，避免远程桌面 cursor theme 变成问号
- Chrome 使用 `DISPLAY=:0` 和 `--ozone-platform=x11` 启动，让菜单、权限提示、账号气泡等顶层 UI 走 X11 路径，输入转发更可靠
