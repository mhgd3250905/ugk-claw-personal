# Web-access 浏览器桥接

更新时间：`2026-04-19`

这份文档只讲一件事：`web-access` 如何通过宿主浏览器工作，以及最近围绕本地文件、Chrome 持久 profile、IPC 和 CDP 做了哪些收口。

## 1. 真实链路

当前稳定链路不是“容器直接起 Windows Chrome”，而是：

```text
container agent / skill
  -> requestHostBrowser()
  -> .data/browser-ipc
  -> host-browser-bridge-daemon.mjs
  -> LocalCdpBrowser
  -> Chrome DevTools Protocol
```

关键事实：

- 容器 IPC 目录：`/app/.data/browser-ipc`
- 宿主 IPC 目录：`.data/browser-ipc`
- 默认 CDP 端口：`9222`
- 默认浏览器 profile：`.data/web-access-chrome-profile`

## 2. 为什么不能在容器里直接找 Chrome

容器里报：

```text
local_browser_executable_not_found
```

并不代表 Windows 没装 Chrome。

它通常只说明：

- 这条命令正运行在 Linux 容器里
- 容器看不到宿主机 `chrome.exe`

正确方向不是继续在容器里搜浏览器，而是让容器通过 IPC 请求宿主 bridge。

## 3. 持久登录态

当前桥接默认使用项目内专用 profile：

```text
.data/web-access-chrome-profile
```

这样做是为了：

- 避开用户日常浏览器 profile lock
- 固定 X 等站点登录态
- 避免每次都重新登录

正常情况下：

- 你在这个专用 Chrome 窗口里登录一次
- 后续 agent 自动拉起继续复用这个 profile

重新要求登录的常见原因：

- 站点 session 自然过期
- 手动退出登录
- profile 被删掉或清空
- 改用了新的 profile 目录

## 4. 本地文件与 web-access

现在要分清楚两层语义。

### 内部语义

web-access 内部允许继续使用这些输入：

- `/app/public/...`
- `/app/runtime/...`
- `file:///app/public/...`
- `file:///app/runtime/...`
- `public/...`
- `runtime/...`

### 对外交付语义

宿主浏览器仍然不能直接打开容器 `file:///app/...`。

因此运行时会把这些内部路径桥接成：

```text
GET /v1/local-file?path=...
```

也就是说：

- 内部操作可以继续按本地文件思维工作
- 给用户看的地址必须是宿主能访问的地址

## 5. 当前关键实现点

- [runtime/skills-user/web-access/scripts/local-cdp-browser.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/local-cdp-browser.mjs)
  - 接受容器本地 artifact 输入
  - 自动桥接到 `/v1/local-file?path=...`
- [runtime/skills-user/web-access/scripts/host-bridge.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/host-bridge.mjs)
  - 容器侧 IPC 请求入口
- [runtime/skills-user/web-access/scripts/host-browser-bridge-daemon.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/host-browser-bridge-daemon.mjs)
  - 宿主侧 bridge daemon
- [scripts/start-web-access-browser.ps1](/E:/AII/ugk-pi/scripts/start-web-access-browser.ps1)
  - 宿主启动入口
- [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
  - `GET /v1/local-file?path=...`

## 6. 启动方式

在 Windows 项目目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-web-access-browser.ps1
```

如果需要显式指定 profile：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-web-access-browser.ps1 -ProfileDir "E:\AII\ugk-pi\.data\web-access-chrome-profile"
```

## 7. 排障顺序

### 场景 1：浏览器没起来

先看：

- `.data/browser-ipc/host-bridge-ready.json`
- 宿主 Chrome 进程是否存在

再跑：

```powershell
docker compose exec -T ugk-pi sh -lc "node /app/runtime/skills-user/web-access/scripts/check-deps.mjs"
```

### 场景 2：浏览器起来了，但 agent 仍说不可用

优先怀疑：

- IPC 响应超时
- CDP 还没连上
- 旧 profile / 错 profile

关键入口：

- [runtime/skills-user/web-access/scripts/host-bridge.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/host-bridge.mjs)
- [runtime/skills-user/web-access/scripts/local-cdp-browser.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/local-cdp-browser.mjs)

### 场景 3：agent 又把 `file:///app/...` 说给用户

这时候已经不是浏览器桥本身的问题，而是用户可见文本出口没收住。

先看：

- [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
- [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)

## 8. 当前稳定结论

- 允许 agent 内部继续使用本地 file 语义
- 不要求 agent 自己记住哪些地址能给宿主打开
- 运行时负责桥接本地 artifact
- 用户拿真实文件时优先 `send_file`

这才是正经系统，不是继续靠提示词念经。
