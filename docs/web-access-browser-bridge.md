# Web-Access Browser Bridge

更新时间：`2026-04-21`

这份文档是 `web-access` 的正式运行手册。它回答四个问题：

1. agent 到底用哪一个浏览器。
2. Docker Chrome sidecar 和旧宿主 IPC 的边界是什么。
3. 本地 HTML / 图片 / artifact 为什么必须走 HTTP 桥接。
4. 出问题时该按什么顺序排查。

## 1. Current Decision

Primary runtime path:

```text
agent / skill
  -> requestHostBrowser()
  -> WEB_ACCESS_BROWSER_PROVIDER=direct_cdp
  -> LocalCdpBrowser
  -> http://172.31.250.10:9223
  -> Docker Chrome sidecar
```

Legacy Windows host IPC fallback:

```text
agent / skill
  -> requestHostBrowser()
  -> .data/browser-ipc
  -> host-browser-bridge-daemon.mjs
  -> Windows Chrome CDP
```

当前默认是 Docker Chrome sidecar。宿主 IPC 只保留为本机 Windows 调试和紧急 fallback，不再是 Docker / Linux 的主路径。

注意一个名字坑：`requestHostBrowser()` 是历史命名。现在它会先看 `WEB_ACCESS_BROWSER_PROVIDER`，在 `direct_cdp` / `direct` / `sidecar` 模式下直接走 sidecar CDP，不会先写 IPC 请求。

## 2. Why Sidecar Became Primary

宿主 IPC 曾经解决的是“容器里没有 Windows Chrome”的问题，但它有几个天然不稳定点：

- 依赖 Windows 宿主进程一直运行。
- 依赖共享 IPC 目录。
- 云服务器上没有 Windows 桌面 Chrome。
- 容器和宿主之间的 profile / 登录态迁移很别扭。

sidecar 模式把“可视化登录”和“CDP 自动化”放进同一个 Docker Chrome：

- 本地开发和 Linux 云服务器是同一种模型。
- 登录态存在 `.data/chrome-sidecar`，可以持久化和备份。
- agent 不需要等待 IPC 超时再 fallback。
- `x.com`、知乎、Google 登录态都可以在 sidecar 里复用。

## 3. Compose Facts

开发 compose 和生产 compose 都包含：

- `ugk-pi`: app / agent 容器
- `ugk-pi-browser`: LinuxServer Chrome sidecar
- `ugk-pi-browser-cdp`: `socat` relay，把 sidecar 内部 `127.0.0.1:9222` 暴露为 compose 网络里的 `172.31.250.10:9223`

关键环境变量：

```text
WEB_ACCESS_BROWSER_PROVIDER=direct_cdp
WEB_ACCESS_CDP_HOST=172.31.250.10
WEB_ACCESS_CDP_PORT=9223
WEB_ACCESS_BROWSER_PUBLIC_BASE_URL=http://ugk-pi:3000
PUBLIC_BASE_URL=http://127.0.0.1:3000
WEB_ACCESS_BROWSER_PROFILE_DIR=/config/chrome-profile-sidecar
```

关键入口：

- 用户访问 playground：`http://127.0.0.1:3000/playground`
- sidecar GUI 登录：`https://127.0.0.1:3901/`
- sidecar profile 宿主目录：`.data/chrome-sidecar`
- sidecar CDP app 侧地址：`http://172.31.250.10:9223`

## 4. URL Semantics

不要再把所有 URL 当成一个东西。这里有两个视角：

`PUBLIC_BASE_URL`

- 给用户看的地址。
- 本地通常是 `http://127.0.0.1:3000`。
- 线上可以是公网域名。
- 用于最终回复、文件预览链接、用户浏览器打开。

`WEB_ACCESS_BROWSER_PUBLIC_BASE_URL`

- 给 sidecar Chrome 打开的地址。
- compose 内默认是 `http://ugk-pi:3000`。
- 用于 CDP 自动化、截图、打开本地 HTML artifact。

为什么必须拆开：

- 宿主浏览器里的 `127.0.0.1:3000` 指向宿主机映射端口。
- sidecar Chrome 容器里的 `127.0.0.1:3000` 指向 sidecar 容器自己。
- 如果 sidecar 打开宿主视角的 `127.0.0.1:3000/v1/local-file?...`，会打到 sidecar 自己的 nginx，常见表现是 `404 Not Found`。

## 5. Local Artifact Rules

agent 内部允许使用这些路径：

```text
/app/runtime/...
/app/public/...
file:///app/runtime/...
file:///app/public/...
runtime/...
public/...
```

这些路径不能直接交给 sidecar Chrome 当 `file://` 打开。sidecar 是另一个容器，它看不到 app 容器里的 `/app/runtime/...` 文件系统视角。

正确桥接：

```text
/app/runtime/zhihu-hot-card.html
  -> http://ugk-pi:3000/v1/local-file?path=%2Fapp%2Fruntime%2Fzhihu-hot-card.html
```

用户可见文本则应该是：

```text
http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fruntime%2Fzhihu-hot-card.html
```

也就是说：

- agent 内部工作可以继续用 `/app/...`。
- sidecar Chrome 打开必须用 `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL`。
- 用户最终看到必须用 `PUBLIC_BASE_URL`。
- 真实文件交付优先用 `send_file`。

## 6. Operational Commands

从项目根目录运行：

```bash
npm run docker:chrome:check
npm run docker:chrome:status
npm run docker:chrome:open
npm run docker:chrome:restart
```

### Agent-scope cleanup

`web-access` 在检测到 agent scope 时会复用同一任务下的浏览器 target，避免同一轮任务里反复开新页。这个 scope 与脚本侧一致，按 `CLAUDE_AGENT_ID`、`CLAUDE_HOOK_AGENT_ID`、`agent_id` 的顺序解析。

任务结束时由 `src/agent/agent-service.ts` 的 `runChat` `finally` 调用 `src/agent/browser-cleanup.ts`，向兼容代理发送：

```bash
POST http://127.0.0.1:3456/session/close-all?metaAgentScope=<scope>
```

这个清理是 best-effort：代理不可用、超时或返回错误时只写 `console.warn`，不覆盖原任务的成功、错误或中断结果。后续排障不要只看运行容器 `/app` 里有没有热改，必须确认 `src/agent/browser-cleanup.ts` 和 `AgentService` 调用已经进入 Git 仓库；否则生产重建镜像后修复会消失。

命令含义：

- `docker:chrome:check`: 标准 readiness check，验证 Chrome CDP、app 到 sidecar CDP、以及 `web-access` proxy。
- `docker:chrome:status`: 打印 compose 状态和 browser-local / app-to-sidecar 两个 CDP 探针。
- `docker:chrome:open`: 打印 GUI 登录入口，不擅自启动宿主 GUI app。
- `docker:chrome:restart`: 重启 sidecar Chrome，清理 stale lock 和 `Restore Pages?` 状态，不清登录 cookies；该清理逻辑由 Node helper 读写 profile JSON，不依赖 Chrome sidecar 容器里安装 `python3`。

期望健康输出包含：

```text
host-browser: ok (http://172.31.250.10:9223)
proxy: ready (127.0.0.1:3456)
```

这里的 `host-browser` 是兼容旧脚本的输出标签。sidecar 模式下它实际代表 browser backend 可达。

## 7. Manual Login

首次登录：

1. 运行 `docker compose up -d`。
2. 打开 `https://127.0.0.1:3901/`。
3. 接受自签名证书提示。
4. 在 sidecar Chrome 里登录 X、Google、知乎等账号。
5. 运行 `npm run docker:chrome:check`。
6. 让 agent 通过 playground 执行一个真实浏览器任务验证。

登录态保存在 `.data/chrome-sidecar`。不要随便删除这个目录，不然账号会集体失忆。

## 8. Screenshot Flow

标准链路：

```text
agent writes /app/runtime/report.html
  -> runtime/screenshot.mjs
  -> resolveBrowserInputUrl()
  -> http://ugk-pi:3000/v1/local-file?path=...
  -> sidecar Chrome CDP
  -> /app/runtime/report.png
  -> user sees http://127.0.0.1:3000/runtime/report.png
```

如果你手里已经有宿主可见 URL，例如：

```text
http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fruntime%2Freport.html
```

浏览器自动化会在打开前把同源地址改写成：

```text
http://ugk-pi:3000/v1/local-file?path=%2Fapp%2Fruntime%2Freport.html
```

这就是 `PUBLIC_BASE_URL` 和 `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL` 分开的原因。别再拿一个变量当万能胶，Docker 网络不吃这一套。

## 9. Legacy IPC Cleanup Status

已清理：

- 显式浏览器搜索技能不再引导 Docker 用户启动 Windows host IPC。
- `x-search-runner.mjs` 和 `linkedin-search-runner.mjs` 中未使用的 IPC 常量已移除。
- `web-access` skill 文档明确 sidecar 是 primary path，IPC 是 legacy fallback。
- 测试已覆盖 direct CDP 模式必须先于 IPC。

保留：

- `host-bridge.mjs` 的 IPC 逻辑。
- `host-browser-bridge-daemon.mjs`。
- `scripts/start-web-access-browser.ps1`。

保留原因：

- Windows 本机调试仍可能需要。
- sidecar 不可用时可以临时 fallback。
- 旧脚本和测试仍复用 `requestHostBrowser()` 抽象，贸然删除会制造更多坑。

清理原则：

- 不删除可用 fallback。
- 不让 fallback 冒充默认路径。
- 所有 Docker / Linux 文档和技能默认指向 sidecar。

## 10. Troubleshooting

### `Connection Terminated`

常见原因是同时开了多个 primary client。关闭多余 GUI 页面，保留一个控制端。

### `Restore Pages?` 挡住左上角

运行：

```bash
npm run docker:chrome:restart
```

helper 会清理 Chrome crash-restore profile 状态。

如果旧版本提示：

```text
python is required to clear Chrome restore state
```

说明 `scripts/sidecar-chrome.mjs` 还是旧实现。更新代码并重新构建 app 容器，不要去改第三方 Chrome sidecar 镜像硬装 Python。

### 鼠标是问号或菜单点不了

确认 compose 里有：

```text
SELKIES_USE_BROWSER_CURSORS=true
DISPLAY=:0
--ozone-platform=x11
```

不要回退到 Wayland，除非重新验证 Chrome 顶层弹窗、菜单、账号气泡都能点击。

### `local_browser_executable_not_found`

如果 `WEB_ACCESS_BROWSER_PROVIDER=direct_cdp` 已设置，这不是让你去容器里找 Chrome。先运行：

```bash
npm run docker:chrome:check
npm run docker:chrome:status
```

只有在明确调试 legacy Windows host IPC 时，才考虑 `scripts/start-web-access-browser.ps1`。

### `/v1/local-file` 宿主能打开，sidecar 截图失败

检查：

```bash
docker compose exec -T ugk-pi sh -lc "printenv PUBLIC_BASE_URL; printenv WEB_ACCESS_BROWSER_PUBLIC_BASE_URL"
docker compose exec -T ugk-pi-browser sh -lc "curl -sS -o /tmp/check.html -w '%{http_code} %{size_download}\n' 'http://ugk-pi:3000/v1/local-file?path=%2Fapp%2Fruntime%2Fzhihu-hot-card.html'"
```

期望：

```text
http://127.0.0.1:3000
http://ugk-pi:3000
200 <non-zero-size>
```

### 改了 compose env 但容器里没生效

只 `docker compose restart ugk-pi` 不会刷新 compose environment。需要：

```bash
docker compose up -d ugk-pi
```

这会重建 app 容器，不会重建 sidecar Chrome，也不会清登录态。

## 11. Cloud Deployment Notes

Linux 云服务器上不要把 `3901` 裸露公网。这个入口能操作登录态浏览器，裸奔就是把账号控制台挂城门楼子上。

推荐方式：

- SSH tunnel
- VPN
- 带鉴权的反向代理
- 只在登录维护窗口短时开放

必须持久化和备份：

```text
.data/chrome-sidecar
```

部署后标准验收：

1. `docker compose up -d`
2. `npm run docker:chrome:check`
3. sidecar GUI 手工确认登录态
4. agent 打开登录态网站
5. agent 生成 HTML 并截图
6. 用户可见 URL 能从外部打开

## 12. Key Files

- [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
- [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
- [scripts/sidecar-chrome.mjs](/E:/AII/ugk-pi/scripts/sidecar-chrome.mjs)
- [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
- [runtime/skills-user/web-access/scripts/host-bridge.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/host-bridge.mjs)
- [runtime/skills-user/web-access/scripts/local-cdp-browser.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/local-cdp-browser.mjs)
- [runtime/skills-user/web-access/scripts/check-deps.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/check-deps.mjs)
- [runtime/screenshot.mjs](/E:/AII/ugk-pi/runtime/screenshot.mjs)
- [src/agent/browser-cleanup.ts](/E:/AII/ugk-pi/src/agent/browser-cleanup.ts)
- [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
- [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
- [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
