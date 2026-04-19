# 更新记录

这份文档用来记录仓库层面的可追溯更新。

规则很简单，别搞花活：

- 任何影响外部行为、运行方式、接口、文档结构或协作约定的改动，都要在同一轮补一条记录
- 每条记录至少写清：日期、主题、影响范围、对应入口
- 如果只是纯局部代码重构且对外无感，可以不记；但只要会影响下一个接手的人，就应该记

---

## 2026-04-19

### 阶段版本文档收口
- 主题：把 Docker Chrome sidecar 阶段成果补进 `/init` 最容易读取的入口文档，避免新会话继续从旧宿主 IPC 口径出发。
- 影响范围：
  - `README.md` 新增阶段快照，明确 `web-access` 主链路已经切到 `direct_cdp -> Docker Chrome sidecar`。
  - `AGENTS.md` 新增当前阶段快照，固定 sidecar GUI、登录态目录、URL 变量分工和标准验证命令。
  - `docs/traceability-map.md` 的快速接手场景前置 `docs/web-access-browser-bridge.md`，并强调 `requestHostBrowser()` 是历史命名。
  - 清理 README 中残留的“web-access 宿主浏览器桥接”说法，避免后续 `/init` 又把默认路径理解成 Windows IPC。
- 对应入口：
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)

### Docker Chrome sidecar Restore Pages 清理
- 主题：修复 sidecar Chrome 非正常退出后左上角反复出现 `Restore Pages?` 气泡，遮挡手动登录和页面操作的问题。
- 影响范围：
  - `scripts/sidecar-chrome.mjs` 的 `start` / `restart` 流程现在会在启动前清理 `Singleton*` 锁文件，并把 Chrome profile 中的 `exited_cleanly` / `exit_type` 写回正常退出状态。
  - sidecar Chrome 启动参数增加 `--hide-crash-restore-bubble`，避免残留崩溃恢复气泡继续挡住 GUI。
  - `README.md`、`docs/web-access-browser-bridge.md`、`runtime/skills-user/web-access/SKILL.md` 同步说明：遇到该弹窗时使用 `npm run docker:chrome:restart`，不会清理登录 cookies。
  - `docker-compose.yml` 和 `docker-compose.prod.yml` 固定 `SELKIES_USE_BROWSER_CURSORS=true`，让手动 GUI 操作用浏览器本地光标，避免远程桌面 cursor theme 变成问号。
  - sidecar Chrome 统一通过 `DISPLAY=:0` 和 `--ozone-platform=x11` 启动，避免 Chrome 菜单、权限气泡、账号弹窗等顶层 UI 落到 Wayland popup surface 后无法点击。
  - `test/containerization.test.ts` 增加回归断言，防止 helper 后续移除 Restore Pages 清理逻辑。
- 对应入口：
  - [scripts/sidecar-chrome.mjs](/E:/AII/ugk-pi/scripts/sidecar-chrome.mjs)
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)

### Agent Web-Access Sidecar Operationalization

- 主题：把已经验证可用的 `web-access -> direct_cdp -> Docker Chrome sidecar` 链路收口成正式运行口径，而不是继续靠手工临场命令。
- 影响范围：
  - `package.json` 新增 `npm run docker:chrome:check`、`npm run docker:chrome:status`、`npm run docker:chrome:open`。
  - `scripts/sidecar-chrome.mjs` 支持 `check`、`status`、`open`，其中 `check` 会验证 Chrome CDP、app 到 sidecar CDP、以及 `check-deps.mjs` 代理 readiness。
  - `open` 只打印 GUI URL，不擅自启动宿主 GUI app；Linux 云服务器上应通过 SSH tunnel 或受保护反向代理访问。
  - `README.md`、`docs/web-access-browser-bridge.md`、`runtime/skills-user/web-access/SKILL.md` 同步写明 Docker 场景优先走 sidecar direct_cdp。
  - `test/containerization.test.ts` 增加脚本入口与 helper action 断言，防止后续回退成“能手动跑一次，但没有标准检查入口”的半成品。
- 对应入口：
  - [scripts/sidecar-chrome.mjs](/E:/AII/ugk-pi/scripts/sidecar-chrome.mjs)
  - [package.json](/E:/AII/ugk-pi/package.json)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)

### Web-Access Legacy IPC Cleanup And Documentation Pass

- 主题：对 sidecar 接入后的 `web-access` 技能、旧宿主 IPC 残留和文档口径做一次系统性收口，避免 agent 后续又被旧说明带回 Windows IPC。
- 影响范围：
  - `runtime/skills-user/web-access/SKILL.md` 重写为 sidecar-first 运行说明，明确 `Docker Chrome sidecar` 是 primary path，`Windows host IPC` 只是 legacy fallback。
  - `runtime/skills-user/x-search-latest/SKILL.md`、`ins-search-latest`、`linkedin-search-latest`、`tiktok-search-latest` 同步说明 `check-deps.mjs` 的 `host-browser: ok` 在 sidecar 模式下代表 direct CDP backend 可用，不再引导 Docker 用户启动 Windows IPC。
  - `runtime/skills-user/web-access/scripts/x-search-runner.mjs` 与 `linkedin-search-runner.mjs` 移除未使用的 IPC 常量，减少误导性旧代码痕迹。
  - `docs/web-access-browser-bridge.md` 重写为正式运行手册，覆盖主链路、legacy fallback、URL 视角、local artifact、登录态、截图流、云服务器安全暴露和排障顺序。
  - `AGENTS.md`、`README.md`、`docs/runtime-assets-conn-feishu.md`、`docs/traceability-map.md` 同步更新当前稳定事实。
  - `test/web-access-host-bridge.test.ts` 和 `test/x-search-latest-skill.test.ts` 增加回归断言，防止 direct CDP 模式再次先碰 IPC，或技能文档再次把 Docker 用户引向旧 IPC bridge。
- 对应入口：
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [test/web-access-host-bridge.test.ts](/E:/AII/ugk-pi/test/web-access-host-bridge.test.ts)
  - [test/x-search-latest-skill.test.ts](/E:/AII/ugk-pi/test/x-search-latest-skill.test.ts)

### Sidecar Local Artifact URL Split

- 主题：修复 sidecar Chrome 打开 `http://127.0.0.1:3000/v1/local-file?...` 时打到浏览器容器自身 nginx、返回 404 的问题。
- 影响范围：
  - `runtime/skills-user/web-access/scripts/local-cdp-browser.mjs` 将本地 artifact 解析为浏览器可访问的 `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL`，而不是复用用户可见的 `PUBLIC_BASE_URL`。
  - 对已经生成的宿主可见同源 URL，例如 `http://127.0.0.1:3000/v1/local-file?...`，浏览器自动化会在打开前改写成 sidecar 可访问的 `http://ugk-pi:3000/...`。
  - `runtime/screenshot.mjs` 支持传入 `browserBaseUrl`，截图脚本和 web-access 共用同一套 URL 解析规则。
  - `docker-compose.yml`、`docker-compose.prod.yml`、`.env.example` 新增 `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL=http://ugk-pi:3000`。
  - `README.md`、`docs/web-access-browser-bridge.md`、`runtime/skills-user/web-access/SKILL.md` 同步说明：`PUBLIC_BASE_URL` 给用户，`WEB_ACCESS_BROWSER_PUBLIC_BASE_URL` 给 CDP 控制的 sidecar Chrome。
- 对应入口：
  - [runtime/skills-user/web-access/scripts/local-cdp-browser.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/local-cdp-browser.mjs)
  - [runtime/screenshot.mjs](/E:/AII/ugk-pi/runtime/screenshot.mjs)
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [.env.example](/E:/AII/ugk-pi/.env.example)
  - [test/local-cdp-browser.test.ts](/E:/AII/ugk-pi/test/local-cdp-browser.test.ts)
  - [test/runtime-screenshot.test.ts](/E:/AII/ugk-pi/test/runtime-screenshot.test.ts)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)

### Docker Chrome sidecar 直连模式
- 主题：为 Docker / Linux 场景补一条不依赖 Windows 宿主 IPC 的浏览器路径，让 `web-access` 可以直接连可视化 Chrome sidecar 并复用持久登录态。
- 影响范围：
  - `docker-compose.yml` 与 `docker-compose.prod.yml` 新增 `ugk-pi-browser` 服务，默认提供 `https://127.0.0.1:3901/` 登录入口；同时补一个 `ugk-pi-browser-cdp` relay，把 sidecar 内部回环地址上的 `9222` 暴露给 compose 服务网络，宿主 GUI 端口可通过 `WEB_ACCESS_BROWSER_GUI_PORT` 覆盖
  - `ugk-pi` 容器默认注入 `WEB_ACCESS_BROWSER_PROVIDER=direct_cdp`、`WEB_ACCESS_CDP_HOST=172.31.250.10`、`WEB_ACCESS_CDP_PORT=9223`，避免 Chrome DevTools HTTP 接口拒绝服务名 Host 头
  - `host-bridge.mjs` 新增直连模式，sidecar 场景下不再先写 IPC 请求再等超时
  - `check-deps.mjs`、`README.md`、`docs/web-access-browser-bridge.md`、`runtime/skills-user/web-access/SKILL.md` 同步补齐 sidecar 登录与排障口径
  - 新增回归断言，防止 compose 配置和直连逻辑回退
- 对应入口：
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [runtime/skills-user/web-access/scripts/host-bridge.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/host-bridge.mjs)
  - [runtime/skills-user/web-access/scripts/check-deps.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/check-deps.mjs)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [test/web-access-host-bridge.test.ts](/E:/AII/ugk-pi/test/web-access-host-bridge.test.ts)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)

### Docker 开发镜像补齐 Git
- 主题：把容器内缺失 `git` 的环境短板收口到镜像层，避免每次需要查看仓库状态或执行只读 git 命令时都靠宿主机兜底或临时手工安装。
- 影响范围：
  - `Dockerfile` 现在会在构建阶段通过 `apt-get` 正式安装 `git`
  - `README.md` 同步补充当前开发镜像内置 `git`、`curl` 和 `ca-certificates` 的运行口径
  - `AGENTS.md` 的稳定事实改为明确说明镜像已内置 `git`，避免后续接手的人继续把容器缺 git 当成既定事实
  - `test/containerization.test.ts` 的基础镜像断言同步更新为新的安装清单，避免测试继续固化旧口径
- 对应入口：
  - [Dockerfile](/E:/AII/ugk-pi/Dockerfile)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)

### Web-access 本地报告出口统一
- 主题：修复同一条浏览器链路里仍有脚本偷偷回退到 `file://`，导致“第一次成功、第二次又把容器路径塞给宿主浏览器”的反复故障。
- 影响范围：
  - `runtime/screenshot-mobile.mjs` 改为直接复用 `runtime/screenshot.mjs` 的统一 URL 解析与截图逻辑，不再单独拼接 `file://`
  - `docker-compose.yml` 固定注入 `PUBLIC_BASE_URL=http://127.0.0.1:3000`，让运行时脚本和文档出口使用同一宿主地址
  - `runtime/skills-user/web-access/SKILL.md` 明确规定：凡是给用户打开的本地报告，一律输出 HTTP URL 或 `send_file`，禁止再吐 `file:///app/...`
  - 新增回归断言，防止移动截图脚本和 web-access 技能说明再次回退
- 对应入口：
  - [runtime/screenshot-mobile.mjs](/E:/AII/ugk-pi/runtime/screenshot-mobile.mjs)
  - [runtime/screenshot.mjs](/E:/AII/ugk-pi/runtime/screenshot.mjs)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [test/runtime-screenshot.test.ts](/E:/AII/ugk-pi/test/runtime-screenshot.test.ts)
  - [test/x-search-latest-skill.test.ts](/E:/AII/ugk-pi/test/x-search-latest-skill.test.ts)

### Agent 文件交付提示协议收口
- 主题：把“报告生成后该给什么地址、什么时候该发文件”收口到全局 prompt 协议，避免 agent 继续靠上下文运气输出错误交付方式。
- 影响范围：
  - `buildPromptWithAssetContext()` 追加的 `<file_response_protocol>` 现在明确要求：浏览器预览一律返回宿主可访问的 HTTP URL，禁止返回 `file:///app/...`
  - 对项目内已生成的真实文件，优先要求 agent 使用 `send_file`
  - `ugk-file` 降级为小型文本文件的兜底协议，不再当成默认文件交付方式
  - 新增回归测试，防止后续把这层全局约束删回去
- 对应入口：
  - [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
  - [test/file-artifacts.test.ts](/E:/AII/ugk-pi/test/file-artifacts.test.ts)

### Runtime 报告 HTTP 发布收口
- 主题：修复 `runtime/` 报告仍被当成 `file:///app/...` 容器路径交给用户打开，导致宿主浏览器报 `ERR_FILE_NOT_FOUND` 的问题。
- 影响范围：
  - 新增 `GET /runtime/:fileName`，专门服务 `runtime/` 根目录下的安全报告文件，和 `public/` 根文件服务分开收口。
  - `runtime/screenshot.mjs` 不再把本地 HTML 报告强行拼成 `file://`，而是自动把 `public/` / `runtime/` 本地路径转换成可访问的本地 HTTP URL。
  - 对外口径同步固定：宿主浏览器不能直接打开容器内 `file:///app/...`；要么给 HTTP URL，要么走 `send_file`。
  - 新增回归断言，覆盖 `runtime/report-medtrum-v2.html` 的 HTTP 访问和截图脚本 URL 解析。
- 对应入口：
  - [src/routes/static.ts](/E:/AII/ugk-pi/src/routes/static.ts)
  - [runtime/screenshot.mjs](/E:/AII/ugk-pi/runtime/screenshot.mjs)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [test/runtime-screenshot.test.ts](/E:/AII/ugk-pi/test/runtime-screenshot.test.ts)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [README.md](/E:/AII/ugk-pi/README.md)

### 文件卡片预览与下载分流
- 主题：修复截图等文件点击后容易落入“无法访问您的文件”提示的问题，把预览和下载链路拆开处理。
- 影响范围：
  - `/v1/files/:fileId` 新增 `download=1` 强制下载参数；安全可预览文件默认走 `inline`，显式下载才走 `attachment`。
  - playground 文件卡片新增“打开”入口，图片/PDF/纯文本等安全类型可直接新标签预览；“下载”继续保留，但改走强制下载 URL。
  - 预览白名单只覆盖相对安全的静态类型；`html`、`svg`、`js` 等可能执行脚本的内容不做同源直接预览，避免把文件预览改成 XSS 入口。
  - 新增回归断言，覆盖图片默认 inline 和 `?download=1` 强制 attachment 两条行为。
- 对应入口：
  - [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)

### Agent `send_file` 文件发送工具
- 主题：新增正式的 agent 发文件通道，避免继续把图片、报告等文件用 base64 或 ````ugk-file```` 原始块塞进聊天正文。
- 影响范围：
  - 新增项目级 `send_file` extension：agent 可把项目根目录内已生成的本地文件注册成统一资产，并返回可下载文件元数据。
  - `send_file` 会校验文件必须位于项目根目录内，拒绝路径穿越和项目外路径；文件名会做安全化处理，MIME 会按常见扩展名推断。
  - `AssetStore` 新增 Buffer 文件保存能力，图片、PDF、压缩包等二进制产物不再需要先转成文本协议。
  - `AgentService` 会从 `tool_execution_end` 的 `send_file` 工具结果中提取 `details.file`，合并进最终 `ChatResult.files` 和流式 `done.files`。
  - playground 不需要新增 UI 分支，继续复用现有文件下载卡片；这才像个文件交付系统，不是把聊天框当垃圾桶。
  - 文档同步记录 `send_file` 的设计、数据流、限制和排查入口。
- 对应入口：
  - [.pi/extensions/send-file.ts](/E:/AII/ugk-pi/.pi/extensions/send-file.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/agent/asset-store.ts](/E:/AII/ugk-pi/src/agent/asset-store.ts)
  - [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)
  - [test/send-file-extension.test.ts](/E:/AII/ugk-pi/test/send-file-extension.test.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)

### Playground 文件型回复正文收口
- 主题：修复 agent 只返回 `ugk-file` 文件块时，playground 仍把流式阶段收到的 base64 / fenced block 留在助手正文里的问题。
- 影响范围：
  - `done` 事件现在会在 `event.text` 是空字符串时也覆盖当前流式正文，确保后端已经抽离为 `files` 的内容不会继续显示在消息气泡里。
  - 文件型回复仍通过 `files` 渲染为下载卡片；正文为空时只显示文件发送结果，不再泄漏 `ugk-file` 原始协议块。
  - 新增回归断言，防止以后把判断写回 `event.text && ...` 这种会漏掉空字符串的形式。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)

### Web-access 本地浏览器自动拉起
- 主题：修复宿主浏览器关闭后，IPC 仍返回 `chrome_cdp_unreachable` 导致 web-access 不再尝试拉起 Chrome 的问题
- 影响范围：
  - `requestHostBrowser` 在 IPC 有响应但报告 Chrome/CDP 不可达时，会改走 `LocalCdpBrowser` fallback
  - 默认 IPC 目录从容器不可共享的 `/workspace/ipc` 收口到项目共享的 `.data/browser-ipc`；容器内对应 `/app/.data/browser-ipc`
  - 新增宿主 IPC bridge daemon，负责消费容器写入的 browser IPC request，并在收到请求时用宿主侧指定 Chrome/profile 自动拉起 CDP 浏览器
  - 当共享 IPC 目录中存在 host bridge ready 文件时，`status` 检查会把 IPC 等待时间从 1 秒放宽到 30 秒，避免把“宿主正在自动启动 Chrome”误判成浏览器不可用
  - `LocalCdpBrowser` 既有的 `ensureBrowser -> startBrowser` 逻辑会负责启动带 `--remote-debugging-port` 的托管 Chrome profile；Windows 下不再默认尝试 Edge，除非显式设置 `WEB_ACCESS_ALLOW_EDGE=1`
  - 宿主侧启动脚本 `scripts/start-web-access-browser.ps1` 改为启动 host bridge daemon，并默认使用 `.data/web-access-chrome-profile` 作为持久登录态目录
  - `check-deps.mjs` 遇到容器内 `local_browser_executable_not_found` 或 CDP 启动超时时，会输出可执行的宿主启动命令，不再直接甩一段 Node stack
  - 普通浏览器命令如 `new_target`、`list_targets` 等收到 `chrome_cdp_unreachable` / CDP 超时类错误时，也会重试 local fallback，而不只是在 IPC 完全无响应时 fallback
  - `web-access` 技能说明同步更新：只有 fallback 也失败时才报告浏览器不可用，并且脚本命令改为容器内 `/app/runtime/skills-user/...` 路径
  - `x-search-latest` 技能说明同样改为在容器内直接使用 `/app/runtime/skills-user/...` 脚本路径，避免 `$CLAUDE_SKILL_DIR` 为空时拼出 `/web-access/...` 这类无效路径
  - 新增专题文档记录完整设计、根因、验证命令、常见故障和排障顺序，避免后续继续把 profile、IPC、CDP、X 登录态混成一锅粥
- 对应入口：
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [runtime/skills-user/web-access/scripts/host-bridge.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/host-bridge.mjs)
  - [runtime/skills-user/web-access/scripts/host-browser-bridge-daemon.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/host-browser-bridge-daemon.mjs)
  - [runtime/skills-user/web-access/scripts/check-deps.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/check-deps.mjs)
  - [runtime/skills-user/web-access/scripts/local-cdp-browser.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/local-cdp-browser.mjs)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
  - [runtime/skills-user/x-search-latest/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/x-search-latest/SKILL.md)
  - [scripts/start-web-access-browser.ps1](/E:/AII/ugk-pi/scripts/start-web-access-browser.ps1)
  - [test/web-access-host-bridge.test.ts](/E:/AII/ugk-pi/test/web-access-host-bridge.test.ts)
  - [test/x-search-latest-skill.test.ts](/E:/AII/ugk-pi/test/x-search-latest-skill.test.ts)

### Public 根静态文件路由正规化
- 主题：把临时硬编码的 X API 报告静态路由收口为安全的 `public/` 根文件服务
- 影响范围：
  - 新增 `GET /:fileName` 静态文件入口，仅服务 `public/` 根目录下的普通文件，不递归目录、不允许隐藏文件或路径穿越
  - `x-api-report-card.html`、`x-api-report.html`、`x-api-report.png`、`x-api-report-full.png` 等报告产物可以通过 HTTP URL 访问，宿主浏览器不需要再尝试容器内 `file://` 路径
  - 静态响应按扩展名设置基础 `content-type`，并使用 `no-store` 避免截图调试时看到旧页面
  - 页面级截图仍应使用 HTTP 地址，例如 `http://127.0.0.1:3000/x-api-report-card.html`；CDP 截图超时属于浏览器自动化链路问题，不应靠 `file:///app/...` 绕路
- 对应入口：
  - [src/routes/static.ts](/E:/AII/ugk-pi/src/routes/static.ts)
  - [src/server.ts](/E:/AII/ugk-pi/src/server.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)

### Playground 错误消息样式收口
- 主题：修复网络 / 服务端错误仍生成旧 `message error` 气泡、没有使用 agent 回复样式的问题
- 影响范围：
  - transcript 消息视觉类型收敛为用户气泡和助手气泡两类，`system` / `error` 等非用户语义统一渲染为助手视觉样式，并继续通过 `data-message-kind` 保留真实语义
  - 移除旧 `.message.error` 居中布局和移动端选择器，避免错误消息绕过当前 agent 回复样式
  - `/v1/chat/stream` 请求拒绝和网络异常不再追加 `appendTranscriptMessage("error", ...)`，统一收口到顶部错误横幅与当前助手气泡的过程区
  - 页面回归断言新增对旧错误气泡入口和旧 `.message.error` 样式的反向检查，同时修正一个依赖旧错误样式误命中的 transcript 对齐断言
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
  - [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)

### Init 接手文档同步运行态重连口径
- 主题：把当前运行态重连能力同步到下次 `/init` 最容易读取的入口文档，避免新会话只看到旧的“流式 / 打断”口径
- 影响范围：
  - `AGENTS.md` 的聊天场景索引新增 `GET /v1/chat/status` 与 `GET /v1/chat/events`，稳定事实补充“当前正在运行”文案和 active run 事件缓冲边界
  - `README.md` 的能力概览、接口速查和验证结果补齐运行态查询、事件重连以及 `76 / 76` 测试口径
  - `docs/traceability-map.md` 增加刷新后 active run 状态映射、事件缓冲和 `/v1/chat/events` 重连追溯点
  - `docs/playground-current.md` 清理旧乱码小节，补成明确的运行态与 loading 约束
- 对应入口：
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
  - [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)

### Playground 当前运行态事件重连
- 主题：修复刷新后恢复出的当前运行任务只显示旧快照、不会继续更新的问题，并移除“上一轮仍在运行”这类误导文案
- 影响范围：
  - `AgentService` 的 active run 增加内存事件缓冲和 `subscribeRunEvents` 订阅能力，刷新后的 web 观察者可以重新接入同一个真实 agent run
  - 新增 `GET /v1/chat/events` SSE 入口，用于按 `conversationId` 订阅当前正在运行任务的事件回放和后续更新
  - playground 恢复运行态时会继续连接 `/v1/chat/events`，把 `text_delta`、工具事件、完成、打断和错误继续渲染到同一个助手气泡
  - 恢复态文案统一改为“当前任务正在运行 / 当前正在运行 / 当前任务已结束”，不再把真实仍在运行的 agent run 说成“上一轮”
  - 当前缓冲只覆盖同一服务进程内的 active run；跨服务重启的完整回放仍需要持久化 run event log
- 对应入口：
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 刷新断线网络错误过滤
- 主题：修复运行中刷新页面后，历史里出现“网络 / network error”错误气泡的问题
- 影响范围：
  - 页面 `beforeunload` / `pagehide` 会标记当前 web 观察连接正在卸载
  - 卸载期间 `/v1/chat/stream` 断开产生的 `network error` 不再写入 transcript，也不再持久化成会话历史
  - 恢复历史时会过滤旧的“网络 / network error”暂态错误气泡，避免已经写脏的本地历史继续污染界面
  - 真正的运行态仍以 `/v1/chat/status` 映射后端 agent 状态为准，web 刷新不应该自己编造失败结论
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)

### SSE 断线不再杀掉 Agent 运行态
- 主题：修复刷新页面后正在运行的上一轮任务从状态接口消失的问题
- 影响范围：
  - `AgentService` 事件投递改为 best-effort，SSE 客户端断开或事件回调抛错不再中断真实 agent run
  - `/v1/chat/stream` 写入已关闭响应时会安全忽略，避免浏览器刷新把后端运行态误杀
  - 新增回归测试，覆盖事件消费者抛出 `client closed` 时 `streamChat` 仍能完成并持久化会话文件
  - 刷新后 `/v1/chat/status` 才能继续看到同一个 `conversationId` 的 running 状态，前端恢复气泡和过程日志才有真实依据
- 对应入口：
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)

### Playground 运行过程日志刷新恢复
- 主题：让刷新前已经收到的 Agent 过程日志随会话历史恢复，避免运行中刷新后只剩任务摘要和 loading
- 影响范围：
  - 助手消息历史新增 `process` 快照字段，保存思考过程日志、当前动作、状态类型和完成状态
  - 过程日志追加、当前动作变更、过程收口时会同步写入本地会话历史
  - 刷新后如果会话仍在运行，playground 会优先复用最近的助手气泡，并把过程日志卡片恢复为运行态
  - 当前只恢复刷新前浏览器已经收到的过程日志；刷新期间页面断线后新产生的事件仍需要后端事件回放能力，别指望前端通灵
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 刷新运行态与打断反馈收口
- 主题：修复刷新后恢复到“上一轮仍在运行”时缺少上一轮任务正文，以及点击打断后旧 loading 气泡仍显示运行中的问题
- 影响范围：
  - playground 恢复运行中会话时，会从本地历史中提取最近一条用户消息，并写入助手气泡正文，避免只剩一个空的“上一轮仍在运行”
  - `/v1/chat/interrupt` 返回打断成功后，当前助手 loading 气泡会收口为“本轮已中断”，并释放前端 loading 状态
  - 如果打断时后端已无运行任务，前端会将残留 loading 收口为“上一轮已结束”，不再继续误导用户
  - 页面断言同步覆盖恢复态任务摘要与打断后的 loading 收口
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground ?????????????
- ????????????????????????????????? `Conversation ... is already running` ????
- ?????
  - ?? `GET /v1/chat/status`????????????????
  - playground ?????????????????????? loading ????
  - ????????????????????? `/v1/chat/queue`????????? stream
  - ???????????????????????????????
- ?????
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
### Playground ??? loading ????
- ??????????????????? loading ?????????????????????
- ?????
  - ??????????????? loading ?????? `text_delta` ??????
  - loading ????? `run_started`????????????? / ?? / ????????
  - ????????????????????? loading ????
  - ????????? loading ???????????
- ?????
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
### Playground 深空主题收口
- 主题：将 playground 的整体氛围从偏蓝电子夜景收口为更深的宇宙深空主题
- 影响范围：
  - 全局背景改为近黑深空底色，并加入暗紫星云与冷白星尘层次，页面纵深更明显
  - 主强调色从亮蓝改为偏冷白的星光色，避免操作按钮、高亮边框和装饰线条整体发蓝
  - landing 区域的输入面板、悬浮控制、引用按钮和拖拽态一起同步降蓝，避免背景改深了但组件还在泛蓝
  - 补充页面断言，覆盖新的深空配色与旧蓝色退场
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 会话历史恢复与正文复制
- 主题：为 playground 补上当前会话的本地历史恢复、上滚加载更多、新会话提示气泡，以及消息正文复制按钮
- 影响范围：
  - transcript 现在会按 `conversationId` 持久化最近消息，刷新页面后优先恢复当前会话最近历史，不再每次刷新都变成白板
  - 对话区顶部新增“加载更多历史”兜底入口，同时在滚动到顶部时自动继续加载更早消息
  - 点击“全新的记忆”后，会立即插入一条助手样式气泡，明确提示当前已启用的新会话和对应会话 ID
  - 所有消息气泡底部统一增加“复制正文”按钮，复制范围只包含该条消息正文
  - 同步补齐页面断言，覆盖历史恢复脚本、新会话提示和复制按钮
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 对话区底部动态避让
- 主题：将 `landing` 模式下 transcript 区域的底部留白从固定值改为跟随 `command-deck` 实际高度动态同步
- 影响范围：
  - 解决待发送文件 / 已选资产过多时，`command-deck` 变高并与对话区底部重叠的问题
  - `stream-layout` 的底部避让改为按 `chat-stage` 底部到 `command-deck` 顶部的真实距离计算，避免遗漏 padding / margin 带来的视觉重叠
  - `landing` 模式下 transcript 容器高度被约束在可用空间内，内容过多时应转为滚动而不是继续压到 `command-deck` 上
  - 页面缩放、文件增删、资产增删后，对话区底部避让会一起更新
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 控制类错误提示收口

- 主题：将 `not_running`、`abort_not_supported` 等运行态控制错误统一收口到顶部横幅提示
- 影响范围：
  - `/v1/chat/queue` 与 `/v1/chat/interrupt` 的拒绝信息不再写进底部过程流，避免和对话气泡重叠
  - 错误横幅改为顶部悬浮通知层，不再作为主内容流中的普通块级元素跟随 landing 会话布局下沉到底部
  - 错误横幅视觉收口为无边框 `4px` 圆角通知条，并新增右侧关闭按钮
  - 修正错误横幅默认显隐逻辑，避免刷新页面后空的横幅壳子常驻顶部
  - 错误横幅默认增加 `hidden` 语义开关，不再只依赖 CSS 显隐，降低旧样式或缓存导致空壳可见的风险
  - 增加 `.error-banner[hidden] { display: none !important; }` 兜底规则，防止显隐逻辑再次被普通样式覆盖
  - 运行态 reason 码转为可读文案，减少原始错误码直接暴露
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 用户消息可读性修正

- 主题：保留用户消息气泡靠右，但将正文文本恢复为标准左对齐
- 影响范围：
  - 修正 playground 中用户长文本消息全部右对齐导致的阅读负担
  - 同步更新页面断言与当前 UI 文档口径，避免后续把错误表现继续当成设计
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### 文档系统重构

- 主题：压缩 `AGENTS.md`，建立渐进式披露文档结构
- 影响范围：
  - `AGENTS.md` 只保留最高准则、全局规则、固定运行口径和场景索引
  - 新增追溯与专题文档承接细节
- 对应入口：
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
  - [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### README 收敛

- 主题：README 改为入口说明文档，移除重复和过时描述
- 影响范围：
  - 保留项目定位、运行方式、接口速查、文档导航
  - 移除冗长历史碎片和重复说明
- 对应入口：
  - [README.md](/E:/AII/ugk-pi/README.md)

### 文档同步纪律固化

- 主题：将“改动后必须同步文档并留痕”提升为全局规则
- 影响范围：
  - 后续 agent 在实现行为变更、运行口径变更、接口变更、文档结构变更后，必须同步更新文档并写入本文件
- 对应入口：
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)
# 2026-04-19 Addendum

## Local Artifact Bridge And Download Header Fix

- 主题：把“内部 file 路径可用、外部浏览器自动桥接”做成运行时能力，而不是继续靠提示词限制 agent；同时修复中文文件名触发 `content-disposition` 非法头，导致打开/下载 0B 的硬 bug。
- 影响范围：
  - `runtime/skills-user/web-access/scripts/local-cdp-browser.mjs` 现在会把 `/app/...`、`file:///app/...`、`public/...`、`runtime/...` 这类本地 artifact 输入自动桥接到 `GET /v1/local-file?path=...`
  - `runtime/screenshot.mjs` 复用同一套本地 artifact URL 解析，不再单独维护一份路径转换逻辑
  - `src/routes/files.ts` 新增 `GET /v1/local-file`，统一服务 `public/` / `runtime/` 本地 artifact 的浏览器打开场景
  - `src/routes/files.ts` 的 `content-disposition` 改为 `filename` + `filename*` 双写法，中文文件名下载恢复正常
  - `src/agent/file-artifacts.ts` 与 `runtime/skills-user/web-access/SKILL.md` 更新为：内部允许 file 路径，用户交付再走 HTTP URL 或 `send_file`
- 对应入口：
  - [runtime/skills-user/web-access/scripts/local-cdp-browser.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/local-cdp-browser.mjs)
  - [runtime/screenshot.mjs](/E:/AII/ugk-pi/runtime/screenshot.mjs)
  - [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
  - [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
  - [test/local-cdp-browser.test.ts](/E:/AII/ugk-pi/test/local-cdp-browser.test.ts)
  - [test/runtime-screenshot.test.ts](/E:/AII/ugk-pi/test/runtime-screenshot.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [test/file-artifacts.test.ts](/E:/AII/ugk-pi/test/file-artifacts.test.ts)
  - [test/x-search-latest-skill.test.ts](/E:/AII/ugk-pi/test/x-search-latest-skill.test.ts)

## Assistant Text Local Artifact Rewrite

- 主题：把“内部本地 file 路径可以继续用”和“用户可见文本不能把宿主浏览器带进沟里”彻底拆开；运行时现在负责重写用户可见消息里的容器本地 artifact 路径。
- 影响范围：
  - `src/agent/file-artifacts.ts` 新增用户可见文本重写逻辑，会把 `/app/public/...`、`/app/runtime/...`、`file:///app/...` 改写为 `GET /v1/local-file?path=...`
  - `src/agent/agent-service.ts` 在最终正文、流式 `text_delta`、以及工具过程输出里统一应用这层重写，不再依赖 agent 自己记住什么地址能给宿主打开
  - 保持内部工具链不变：浏览器自动化和本地 artifact 处理仍然可以继续使用原始 `/app/...` / `file:///app/...`
- 对应入口：
  - [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [test/file-artifacts.test.ts](/E:/AII/ugk-pi/test/file-artifacts.test.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
## 2026-04-19 Documentation Consolidation

### 文档口径整理：本地文件桥接与用户交付

- 主题：把最近围绕本地 artifact、`send_file`、`/v1/local-file`、web-access 浏览器桥接的口径重新收成主文档，清理 README 和专题文档里残留的旧说法。
- 影响范围：
  - `README.md` 重写为当前稳定入口文档，明确区分“agent 内部允许 file 路径”和“用户可见地址必须可打开”
  - `docs/traceability-map.md` 重写为按场景追溯入口，补齐文件交付、`/v1/local-file`、web-access 与截图链路
  - `docs/runtime-assets-conn-feishu.md` 重写资产/附件/`send_file`/本地 artifact 桥接口径
  - `docs/web-access-browser-bridge.md` 重写浏览器桥接、专用 profile、本地文件桥接与排障顺序
  - `docs/change-log.md` 追加本条记录，避免后续 `/init` 还被旧口径误导
- 对应入口：
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)

## 2026-04-19 Sidecar Profile Consolidation

- 主题：把 Docker Chrome sidecar 的 profile 路径收口成唯一配置，避免人工登录和自动启动分别落到不同目录，搞出一次能登、重启失忆的假稳定。
- 影响范围：
  - `docker-compose.yml` 与 `docker-compose.prod.yml` 统一使用 `WEB_ACCESS_BROWSER_PROFILE_DIR`
  - 默认 sidecar profile 路径固定为 `${WEB_ACCESS_BROWSER_PROFILE_DIR:-/config/chrome-profile-sidecar}`
  - `.env.example`、`README.md`、`docs/web-access-browser-bridge.md`、`runtime/skills-user/web-access/SKILL.md` 同步说明 sidecar 只应保留一份正式持久 profile
  - `test/containerization.test.ts` 增加对 profile 配置键的断言，防止后续回退到多路径
- 对应入口：
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [.env.example](/E:/AII/ugk-pi/.env.example)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)

## 2026-04-19 Sidecar Chrome Start And Restart Helper

- 主题：补一个明确的 sidecar Chrome 启动/重启入口，别再靠现场手搓 `docker compose exec` 长命令救火。
- 影响范围：
  - 新增 `scripts/sidecar-chrome.mjs`，统一负责清理残留锁、用正确 Wayland 环境拉起 Chrome、重启 relay，并验证 app 到 sidecar 的 CDP 链路
  - `package.json` 新增 `npm run docker:chrome:start` 与 `npm run docker:chrome:restart`
  - `check-deps.mjs` 在 direct sidecar 模式失败时会直接提示使用新命令
  - `README.md`、`docs/web-access-browser-bridge.md`、`runtime/skills-user/web-access/SKILL.md` 同步记录新入口
- 对应入口：
  - [scripts/sidecar-chrome.mjs](/E:/AII/ugk-pi/scripts/sidecar-chrome.mjs)
  - [package.json](/E:/AII/ugk-pi/package.json)
  - [runtime/skills-user/web-access/scripts/check-deps.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/check-deps.mjs)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
