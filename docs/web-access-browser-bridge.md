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

### 3.1 Browser Instance Registry

`2026-05-08` 起，服务端新增只读浏览器实例注册表，用于把用户自定义的 `browserId` 映射到 Chrome sidecar CDP 信息。未配置时，系统会自动合成当前老链路：

```text
browserId=default
cdpHost=172.31.250.10
cdpPort=9223
guiUrl=https://127.0.0.1:3901/
profileLabel=chrome-sidecar
```

接口：

```text
GET /v1/browsers
GET /v1/browsers/:browserId
```

可选配置：

```text
UGK_DEFAULT_BROWSER_ID=default
UGK_BROWSER_INSTANCES_JSON=[{"browserId":"default","name":"Default","cdpHost":"172.31.250.10","cdpPort":9223,"guiUrl":"https://127.0.0.1:3901/","profileLabel":"chrome-sidecar"}]
```

`browserId` 只做路由标识，由用户自定义；系统不内置 `x`、`feishu`、`research` 这类业务命名。每个 Chrome 实例必须使用独立 profile/config 目录，登录态由用户自己打开对应 GUI 维护。不要让两个 Chrome service 指向同一个 `/config` 或同一个 `--user-data-dir`，也不要复制正在运行的 Chrome profile。这个坑不是“可能不优雅”，是可能直接伤登录态。

当前已接入 Agent profile 默认浏览器字段 `defaultBrowserId` 和 chat 请求可选 `browserId` 解析。`AgentService` 会在每轮 run 开始前把 `browser cleanup scope -> browserId` 写入轻量路由缓存，并把 `WEB_ACCESS_BROWSER_ID` / scope 注入本轮 Bash 子进程；run 结束后会清掉该 scope 路由，避免同一会话后续切回默认浏览器时继续吃到旧绑定。`web-access` 的 proxy / host bridge / local CDP 层会按 `metaBrowserId`、`metaAgentScope` 路由缓存、`WEB_ACCESS_BROWSER_ID`、`UGK_DEFAULT_BROWSER_ID` 的顺序选择 Chrome 实例。不要用进程级 `WEB_ACCESS_CDP_HOST` 在多任务之间来回切，这会让并发任务串浏览器。

路由缓存只记录 scope 和 `browserId`，默认路径为 `/app/.data/browser-scope-routes.json`，可通过 `UGK_BROWSER_SCOPE_ROUTE_CACHE_PATH` 覆盖。它不保存 cookie、不读取 profile，也不迁移登录态；同一进程内写入会串行化，避免并发更新互相覆盖。

每个 browserId 使用独立的 CDP target scope cache。`default` 继续使用 `WEB_ACCESS_SCOPE_CACHE_PATH`；非默认浏览器会在同目录生成带 browserId 后缀的 cache，避免 `chrome-01` 的 targetId 被 `chrome-02` 误清理。

本地 compose 现在默认建立三个浏览器实例：

| browserId | CDP | GUI | config/profile 宿主目录 |
| --- | --- | --- | --- |
| `default` | `172.31.250.10:9223` | `https://127.0.0.1:3901/` | `.data/chrome-sidecar` |
| `chrome-01` | `172.31.250.11:9223` | `https://127.0.0.1:3902/` | `.data/chrome-sidecar-chrome-01` |
| `chrome-02` | `172.31.250.12:9223` | `https://127.0.0.1:3903/` | `.data/chrome-sidecar-chrome-02` |

`chrome-01` 和 `chrome-02` 是空白独立 profile。用户需要分别打开对应 GUI 自己登录并维护账号；不要从 `default` 复制正在使用的 profile。

### 3.2 Chrome Memory Guardrails

Chrome sidecar 当前有两层内存防护：

- compose 层对 `ugk-pi-browser` 设置 `mem_limit: ${UGK_BROWSER_MEM_LIMIT:-2g}` 和 `mem_reservation: ${UGK_BROWSER_MEM_RESERVATION:-512m}`。这比只写 `deploy.resources` 更直接，因为普通 Docker Compose 不应靠 swarm-only 语义碰运气。
- Chrome 启动参数统一带 `--js-flags=--max-old-space-size=1536`，通过 Chrome 官方的 `js-flags` 通道传给 V8。不要裸写 `--max-old-space-size=1536`；那是 Node 常见写法，不是 Chrome V8 flags 的可靠传参方式。

这两个限制必须同时覆盖三条启动路径：

1. `docker-compose.yml` / `docker-compose.prod.yml` 里的 `CHROME_CLI`，用于容器初始化自动启动。
2. `scripts/ensure-sidecar-chrome.sh` 的 `start_browser()` 和 GUI launcher，用户点 sidecar 桌面 Chrome 或 healthcheck 自愈时会走这里。
3. `scripts/sidecar-chrome.mjs`，`npm run docker:chrome:restart` 会走这里重启 Chrome。

如果只改其中一条路径，重启或 GUI 启动后参数会蒸发，属于看起来修了、实际没修。

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

## 5.1 Sidecar File Upload Bridge

sidecar 浏览器选择本地图片时，CDP 看到的是浏览器容器的文件系统，不是 app 容器的 `/app`。不要再把 `/app/.data/chrome-sidecar/...` 这类路径直接塞给 `DOM.setFileInputFiles`，这就是“返回 `{}` 但 `input.files.length` 还是 0”的高发坑。

当前固定桥接口径：

```text
app / agent container writes:
  /app/.data/browser-upload/<file-name>

sidecar Chrome selects:
  /config/upload/<file-name>

host directory:
  ${UGK_BROWSER_UPLOAD_DIR:-./.data/chrome-sidecar/upload}
```

compose 会把同一个 `UGK_BROWSER_UPLOAD_DIR` 同时挂到 app / worker 的 `/app/.data/browser-upload` 和 sidecar 的 `/config/upload`。这样 agent 生成图片后只需要写 app 侧路径，文件选择器或 CDP 上传时使用 browser 侧路径。

注意两点：

- 只共享 `upload` 子目录，不把整个 Chrome profile 暴露给 app；登录态仍然只由 sidecar profile 管。
- 页面内 `fetch("http://ugk-pi:3000/...")` 失败不等价于 Docker 网络断了。第三方页面 origin、CORS、Private Network Access 都可能挡住它，不能把 `fetch` 当文件上传通道。

## 5.2 Rich Editor Text Input

`POST http://127.0.0.1:3456/type?target=<targetId>&metaAgentScope=<scope>` 用 CDP `Input.insertText` 向当前焦点插入文本，主要用于 Draft.js、ProseMirror、React rich editor 这类不会可靠响应 `document.execCommand('insertText')` / `insertHTML` 的编辑器。

`POST http://127.0.0.1:3456/key?target=<targetId>&key=Enter&metaAgentScope=<scope>` 用 CDP `Input.dispatchKeyEvent` 向当前焦点发送键盘事件；`/enter` 是 `key=Enter` 的快捷端点。多页 ProseMirror / Draft.js 这类需要真实段落事务的编辑器，应在多行内容之间使用 `/type` + `/enter`，不要把 `<p>` 拼进 `insertHTML`。

调用顺序必须是：
1. 先用 `/eval` 或点击操作让目标编辑器获得焦点，例如 `editor.focus()`。
2. 再用 `/type` 发送 `text/plain` 正文。
3. 多行内容按行发送：非空行用 `/type`，行间用 `/enter` 或 `/key?key=Enter`。
4. `/type` 和 `/key` 只作用于当前焦点，不负责清空旧内容，也不负责选择目标元素。

这个端点属于 `web-access` 兼容代理，不是页面脚本 API。不要在第三方页面里 `fetch('/type')`；agent 应从 app 容器内调用 `127.0.0.1:3456`。

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

同一 scope 的默认页面现在按单 target 管理：

- 推荐人工导航入口是 `POST http://127.0.0.1:3456/session/navigate?url=<encoded-url>&metaAgentScope=<scope>`；已有默认 target 时复用并导航，缺失时才新建。
- `/new?url=...&metaAgentScope=<scope>` 仍保留为低层入口，但同一 scope 已有默认 target 时会先关闭旧默认 target，再登记新 target，避免长任务里每次打开 URL 都堆一个 Chrome tab。
- 显式独立 target 仍可用 `/session/target` 管理；任务结束时的 `close-all` 仍是兜底清理，不是日常防止堆 tab 的唯一手段。

任务结束时由 `src/agent/agent-service.ts` 的 `runChat` `finally` 调用 `src/agent/browser-cleanup.ts`，向兼容代理发送：

```bash
POST http://127.0.0.1:3456/session/close-all?metaAgentScope=<scope>
```

这个清理是 best-effort：代理不可用、超时或返回错误时只写 `console.warn`，不覆盖原任务的成功、错误或中断结果。后续排障不要只看运行容器 `/app` 里有没有热改，必须确认 `src/agent/browser-cleanup.ts` 和 `AgentService` 调用已经进入 Git 仓库；否则生产重建镜像后修复会消失。

`runtime/skills-user/web-access/scripts/local-cdp-browser.mjs` 会把 scoped targets 和 default targets 以 best-effort 方式持久化到 `WEB_ACCESS_SCOPE_CACHE_PATH`，默认 `/app/.data/browser-scope-cache.json`。这让 `web-access` 兼容代理或 app 容器短暂重启后，仍能按 agent scope 清理上一实例登记过的浏览器页面；缓存损坏时只忽略缓存，不影响当前轮浏览器操作。

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

生产发布脚本还会检查：

- `docker inspect` 中 `ugk-pi-browser` 的 `HostConfig.Memory` 必须大于 `0`。
- Chrome 实际进程命令行必须包含 `max-old-space-size=1536`。

不要只看 compose 文件里的字符串。上线验收看实际容器和实际进程，别让 YAML 陪你演戏。

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
- [src/browser/browser-bound-bash.ts](/E:/AII/ugk-pi/src/browser/browser-bound-bash.ts)
- [src/browser/browser-scope-routes.ts](/E:/AII/ugk-pi/src/browser/browser-scope-routes.ts)
- [src/agent/browser-cleanup.ts](/E:/AII/ugk-pi/src/agent/browser-cleanup.ts)
- [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
- [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
- [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
