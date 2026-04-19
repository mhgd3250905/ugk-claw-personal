# Web-access 浏览器桥接设计与排障

更新时间：`2026-04-19`

## 这份文档管什么

这份文档只说明 `web-access` 这条真实浏览器链路：

- Docker 容器里的 agent 如何请求浏览器
- Windows 宿主机如何自动拉起指定 Chrome
- X / 社交平台登录态为什么放在专用 profile
- `/x-search-latest:*` 这类技能为什么依赖这条链路
- 浏览器明明打开了但 agent 仍报不可用时该怎么查

如果只是查普通聊天、流式输出、消息气泡，别在这里绕圈，去看 [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)。

## 稳定结论

当前设计不是让容器直接启动 Windows Chrome。容器内跑的是 Linux 环境，它没有也不应该去找 `chrome.exe`。

稳定链路是：

```text
agent / skill
  -> requestHostBrowser()
  -> 共享 IPC 目录 .data/browser-ipc
  -> Windows 宿主 host-browser-bridge-daemon.mjs
  -> LocalCdpBrowser
  -> 指定 Chrome executable
  -> 指定持久 profile
  -> Chrome DevTools Protocol
```

关键事实：

- 容器内 IPC 目录：`/app/.data/browser-ipc`
- Windows 宿主 IPC 目录：`E:\AII\ugk-pi\.data\browser-ipc`
- 宿主 bridge ready 文件：`.data/browser-ipc/host-bridge-ready.json`
- 默认 Chrome profile：`.data/web-access-chrome-profile`
- 默认 CDP 端口：`9222`
- 本地 proxy：`http://127.0.0.1:3456`
- 启动脚本：[scripts/start-web-access-browser.ps1](/E:/AII/ugk-pi/scripts/start-web-access-browser.ps1)

## 为什么这么设计

### 1. 容器不能启动宿主 Chrome

`local_browser_executable_not_found` 在容器内出现时，不代表 Windows 没装 Chrome。它只说明当前命令跑在 `/app` Linux 容器里，容器看不到 Windows 的 `chrome.exe`。

错误方向：

```text
在容器里继续找 Chrome / Edge
```

正确方向：

```text
让容器写 IPC 请求，由 Windows 宿主 bridge 启动 Chrome
```

### 2. 不能依赖 `host.docker.internal` 作为 CDP Host

新版 Chrome 对 CDP 请求的 `Host` header 更严格。容器直接访问：

```text
http://host.docker.internal:9222/json/version
```

可能返回：

```text
Host header is specified and is not an IP address or localhost.
```

所以 `findDockerHostCdpBaseUrl()` 会把 `host.docker.internal` 解析成 IPv4，例如：

```text
http://192.168.65.254:9222
```

这样能避开 Chrome 的 Host header 限制。

### 3. 需要专用持久 profile

不要直接复用用户日常 Chrome 默认 profile。原因很朴素：

- 默认 profile 可能已经被日常 Chrome 占用
- 强行复用容易遇到 profile lock
- CDP 端口可能起不来
- 还可能把用户日常浏览器配置搞乱

当前默认使用专用 profile：

```text
E:\AII\ugk-pi\.data\web-access-chrome-profile
```

第一次需要在这个 Chrome 窗口里登录 X。登录后 cookie 会保留，后续 agent 自动拉起仍使用同一 profile，正常不需要重复登录。

会重新要求登录的常见情况：

- X session 自然过期
- 用户手动退出登录
- `.data/web-access-chrome-profile` 被删除或清空
- 启动脚本改用了新的 `-ProfileDir`
- X 风控要求重新验证

### 4. IPC 超时不能太短

之前的事故之一是：agent 发出 `status` IPC 请求后，宿主 bridge 正在启动 Chrome，但容器端只等 `1s`，于是误判浏览器不可用。

现在的规则：

- 没有 host bridge ready 文件：快速失败，默认 `1s`
- 存在 host bridge ready 文件：说明宿主 bridge 已启动，IPC 等待放宽到 `30s`

这避免把“Chrome 正在启动”误判成 `local_browser_executable_not_found`。

## 关键文件

- [runtime/skills-user/web-access/scripts/host-bridge.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/host-bridge.mjs)
  - 容器侧请求入口
  - 默认 IPC 目录解析
  - IPC timeout 策略
  - fallback 策略
- [runtime/skills-user/web-access/scripts/host-browser-bridge-daemon.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/host-browser-bridge-daemon.mjs)
  - Windows 宿主 IPC bridge daemon
  - 消费 `browser-requests`
  - 写入 `browser-responses`
  - 调用 `LocalCdpBrowser`
- [runtime/skills-user/web-access/scripts/local-cdp-browser.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/local-cdp-browser.mjs)
  - Chrome executable 查找
  - profile 目录选择
  - CDP endpoint 检查
  - target / evaluate / screenshot / download 等浏览器动作
- [runtime/skills-user/web-access/scripts/check-deps.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/check-deps.mjs)
  - 依赖检查
  - 启动本地 proxy
  - 输出可执行排障提示
- [runtime/skills-user/web-access/scripts/cdp-proxy.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/cdp-proxy.mjs)
  - `http://127.0.0.1:3456` 兼容 proxy
- [runtime/skills-user/x-search-latest/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/x-search-latest/SKILL.md)
  - X Latest 搜索技能的执行约束
- [scripts/start-web-access-browser.ps1](/E:/AII/ugk-pi/scripts/start-web-access-browser.ps1)
  - Windows 宿主启动入口
- [test/web-access-host-bridge.test.ts](/E:/AII/ugk-pi/test/web-access-host-bridge.test.ts)
  - IPC 目录、timeout、fallback 行为测试
- [test/x-search-latest-skill.test.ts](/E:/AII/ugk-pi/test/x-search-latest-skill.test.ts)
  - 技能说明路径回归测试

## 启动方式

在 Windows 项目目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-web-access-browser.ps1
```

默认输出类似：

```text
Starting web-access host bridge:
  executable: C:\Program Files\Google\Chrome\Application\chrome.exe
  CDP:        http://127.0.0.1:9222
  Docker:     http://host.docker.internal:9222
  profile:    E:\AII\ugk-pi\.data\web-access-chrome-profile
  IPC:        E:\AII\ugk-pi\.data\browser-ipc
web-access host bridge ready. pid=...
Chrome will be started automatically when the agent sends an IPC browser request.
```

如果要指定 profile：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-web-access-browser.ps1 -ProfileDir "E:\AII\ugk-pi\.data\web-access-chrome-profile"
```

如果要指定 Chrome：

```powershell
$env:WEB_ACCESS_CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
powershell -ExecutionPolicy Bypass -File .\scripts\start-web-access-browser.ps1
```

Edge 不是默认 fallback。只有显式设置后才允许：

```powershell
$env:WEB_ACCESS_ALLOW_EDGE = "1"
```

这条很重要。之前 Edge 弹 `msedge.exe` 应用程序错误，别又把它默认塞回来，属于典型“修一个坑，挖三个坑”。

## 验证命令

### 1. 宿主 bridge 是否活着

```powershell
Get-Content .\.data\browser-ipc\host-bridge-ready.json
```

再确认进程：

```powershell
$ready = Get-Content -Raw .\.data\browser-ipc\host-bridge-ready.json | ConvertFrom-Json
Get-Process -Id $ready.pid
```

### 2. 容器内依赖检查

```powershell
docker compose exec -T ugk-pi sh -lc "node /app/runtime/skills-user/web-access/scripts/check-deps.mjs"
```

成功输出：

```text
host-browser: ok (...)
proxy: ready (127.0.0.1:3456)
```

### 3. 禁用 fallback 验证真 IPC

这条能防止被容器侧 fallback 假象骗了：

```powershell
docker compose exec -T ugk-pi node --input-type=module -e "import { requestHostBrowser } from '/app/runtime/skills-user/web-access/scripts/host-bridge.mjs'; const result = await requestHostBrowser({ action: 'status' }, { disableLocalFallback: true, timeoutMs: 5000 }); console.log(JSON.stringify(result));"
```

成功时会返回：

```json
{"ok":true,"status":{"enabled":true,"connected":true,"endpoint":"http://127.0.0.1:9222","browser":"Chrome/..."}}
```

如果这条失败，别急着怪 X。IPC 都没通，X 还没资格背锅。

### 4. 确认 Chrome 使用的是正确 profile

```powershell
Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" |
  Where-Object { $_.CommandLine -like '*--remote-debugging-port=9222*' -or $_.CommandLine -like '*web-access-chrome-profile*' } |
  ForEach-Object { $_.CommandLine }
```

必须看到：

```text
--user-data-dir="E:\AII\ugk-pi\.data\web-access-chrome-profile"
```

如果看到 `.tmp\web-access-host-chrome`，说明跑错旧 profile 了。

## 常见故障表

### `local_browser_executable_not_found`

如果出现在 `/app` 容器内：

```text
host-browser: unavailable (local_browser_executable_not_found)
```

含义：

```text
容器找不到 Windows Chrome，这是正常的。
```

处理：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-web-access-browser.ps1
```

然后重新跑：

```powershell
docker compose exec -T ugk-pi sh -lc "node /app/runtime/skills-user/web-access/scripts/check-deps.mjs"
```

### Chrome 已经打开，但 agent 仍说浏览器不可用

先查最新 session：

```powershell
Get-ChildItem .\.data\agent\sessions | Sort-Object LastWriteTime -Descending | Select-Object -First 5
```

再查里面的真实错误：

```powershell
Select-String -Path .\.data\agent\sessions\<latest>.jsonl -Pattern "check-deps|host-browser|local_browser|浏览器桥接"
```

重点看是否是 `1s` 超时误判。当前代码已通过 host bridge ready 文件把等待时间放宽到 `30s`。

### 容器访问 `host.docker.internal:9222` 被拒

典型输出：

```text
Host header is specified and is not an IP address or localhost.
```

处理：

- 不要手写 `host.docker.internal:9222` 直接访问 CDP
- 走 `requestHostBrowser()` 或 `check-deps.mjs`
- 让 `findDockerHostCdpBaseUrl()` 解析成 IPv4 地址

### 打开的 Chrome 没有 X 登录态

这是 profile 隔离导致的，不是 bug。

处理：

1. 在当前 web-access Chrome 窗口登录 X
2. 保留 `.data/web-access-chrome-profile`
3. 后续自动复用

不要把日常 Chrome 默认 profile 硬接进来，除非你很清楚 profile lock 和 CDP 端口冲突会带来什么后果。

### `x-search-latest` 仍失败

排查顺序：

1. `check-deps.mjs` 是否成功
2. 禁用 fallback 的 IPC status 是否成功
3. Chrome 是否使用 `.data/web-access-chrome-profile`
4. 当前 profile 是否已登录 X
5. X 页面是否被风控、验证码、登录墙挡住
6. `x_search_latest.mjs` 是否能打开 target 并提取 `article`

别跳过前四步直接改提取逻辑。那叫拿螺丝刀修天气。

## 设计取舍

### 为什么不是让 agent 自动执行 PowerShell 启动脚本

agent 主运行环境在 Docker 容器。容器内不能直接执行 Windows PowerShell 去启动宿主 GUI 程序。这个项目允许我们在外部手动启动一次宿主 bridge daemon；之后 agent 的浏览器请求全部经 IPC 自动触发宿主 Chrome。

### 为什么 host bridge 需要常驻

没有常驻宿主进程时，容器写入 `.data/browser-ipc/browser-requests/*.json` 后没人消费，只能等超时。常驻 daemon 才能完成：

```text
容器请求 -> 宿主消费 -> 自动启动 Chrome -> 写回响应
```

### 为什么不用 `.tmp`

`.tmp` 是临时目录，不适合作为登录态容器。之前看到“Chrome 打开了但没有登录态”，就是因为用了临时 profile。现在登录态固定在：

```text
.data/web-access-chrome-profile
```

### 为什么启动脚本会清理同端口错误 profile

如果 `9222` 端口上已经有旧 Chrome，`LocalCdpBrowser` 会检测到 CDP 可用并复用它。这样可能继续使用旧的 `.tmp` profile，导致“明明修了但还是没登录态”。

所以启动脚本会清理同 `9222` 端口、但 `--user-data-dir` 不是目标 profile 的 Chrome 进程。

## 与 `/x-search-latest` 的关系

`/x-search-latest:关键词:天数` 只是上层技能。它不应该自己拼 CDP，也不应该自己开浏览器。

正确链路：

```text
x-search-latest/SKILL.md
  -> check-deps.mjs
  -> x_search_latest.mjs
  -> requestHostBrowser()
  -> host bridge IPC
  -> Chrome profile with X login
```

这意味着：

- 桥接不通时，`x-search-latest` 必须停止，不要编造结果
- 登录态不在当前 profile 时，需要先登录 X
- X 页面风控时，要明确报告页面状态，别假装搜到了

## 完成标准

这条链路只有同时满足下面几项，才算真的可用：

- `scripts/start-web-access-browser.ps1` 已启动 host bridge daemon
- `.data/browser-ipc/host-bridge-ready.json` 存在且 pid 存活
- 容器内 `check-deps.mjs` 返回 `host-browser: ok` 和 `proxy: ready`
- 禁用 fallback 的 IPC status 能返回 `ok: true`
- Chrome 命令行使用 `.data/web-access-chrome-profile`
- 该 profile 已登录目标网站
- `/x-search-latest:*` 能打开 X Latest 页面并拿到真实页面状态
# 2026-04-19 Addendum

- `web-access` 现在正式支持把 `/app/...` 和 `file:///app/...` 当作内部浏览器输入
- 这些本地 artifact 输入会由运行时自动桥接到 `GET /v1/local-file?path=...`
- 这层桥接的目标是让 agent 保持 file 工作流，不再靠提示词强行禁止 file 思路
