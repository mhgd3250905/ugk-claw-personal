# 更新记录

这份文档用来记录仓库层面的可追溯更新。

规则很简单，别搞花活：

- 任何影响外部行为、运行方式、接口、文档结构或协作约定的改动，都要在同一轮补一条记录
- 每条记录至少写清：日期、主题、影响范围、对应入口
- 如果只是纯局部代码重构且对外无感，可以不记；但只要会影响下一个接手的人，就应该记

---

## 2026-04-20

### Playground 新会话改为服务端真重置
- 主题：修复点击 `新会话` 后只在前端清 DOM、插入本地提示气泡，结果刷新又被 `/v1/chat/state` 的真实历史打回去的问题。
- 影响范围：
  - `src/routes/chat.ts` 新增 `POST /v1/chat/reset`，由后端负责清空指定会话的 canonical state。
  - `src/agent/agent-service.ts` 新增 `resetConversation()`；空闲时删除会话映射，运行中则返回 `reason: "running"`，避免把还在执行的 active run 硬抹掉。
  - `src/agent/conversation-store.ts` 新增删除会话索引能力，让 `agent:global` 的新会话真正落到服务端状态，而不是仅靠前端本地假动作。
  - `src/ui/playground.ts` 的 `新会话` 按钮改为调用 `/v1/chat/reset` 后再按清空后的 `/v1/chat/state` 重绘；移除刷新后会消失的本地“当前启用新会话”提示气泡。
  - `test/agent-service.test.ts`、`test/server.test.ts` 增加回归断言，覆盖服务端 reset 和前端入口脚本。
  - `AGENTS.md`、`README.md`、`docs/traceability-map.md`、`docs/playground-current.md` 同步更新新会话语义与接口口径。
- 对应入口：
  - [src/agent/conversation-store.ts](/E:/AII/ugk-pi/src/agent/conversation-store.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)

### Playground 统一 agent 状态渲染
- 主题：把刷新、多浏览器和运行中任务展示收口到后端 canonical conversation state，避免前端继续把 history、status、events、localStorage 和 DOM 指针拼成多套状态。
- 影响范围：
  - `src/types/api.ts` 新增 `ConversationStateResponseBody`、`ChatActiveRunBody`、`ChatProcessBody` 等状态协议，明确 `messages + activeRun` 的统一渲染结构。
  - `src/agent/agent-service.ts` 在 active run 内维护可渲染 `view` 快照，随 `run_started`、`text_delta`、工具事件、队列、`done`、`interrupted`、`error` 更新同一份状态。
  - `src/routes/chat.ts` 新增 `GET /v1/chat/state`，返回全局会话历史、当前运行态、active assistant 正文、过程区、队列和上下文占用；旧 `/history`、`/status`、`/events` 保留兼容。
  - `src/ui/playground.ts` 刷新恢复改为优先消费 `/v1/chat/state` 并通过 `renderConversationState()` 渲染；本地 `process` 快照恢复和写回逻辑移除，SSE 只继续更新同一个 active assistant 气泡。
  - `test/agent-service.test.ts` 与 `test/server.test.ts` 增加 canonical state、路由和前端入口断言，防止同一 run 再被拆成多条助手过程消息。
  - `AGENTS.md`、`README.md`、`docs/traceability-map.md`、`docs/playground-current.md` 同步更新刷新恢复、运行态和 context usage 口径。
- 对应入口：
  - [src/types/api.ts](/E:/AII/ugk-pi/src/types/api.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 多前端终态一致性收口
- 主题：把 `error` / `interrupted` 也收进 canonical conversation state，顺手修掉断流恢复误报失败和重复 prompt 被观察页吞掉的边界问题，别再让不同前端各看各的平行宇宙。
- 影响范围：
  - `src/agent/agent-service.ts` 新增 terminal run snapshot；active run 结束后会把 `error` / `interrupted` 终态短期保留给刷新页和观察页，不再随着 `activeRuns` 清理一起蒸发。
  - `src/agent/agent-service.ts` 在 provider 失败时会先发 canonical `error` 事件，再抛给主流路由；主 `/v1/chat/stream` 和 `/v1/chat/events` 终于看到的是同一份失败语义，不再靠路由层偷偷补一条只有当前页能看到的 SSE。
  - `src/routes/chat.ts` 的 `/v1/chat/events` 不再把“当前已经不在运行”硬翻译成 `error` 事件；这类情况直接收流，让前端优先信 `/v1/chat/state` 的最终状态。
  - `src/ui/playground.ts` 断流恢复会先比较 canonical state 是否已经推进到终态；如果任务其实已经正常收口，就不再误报“流被中断 / 网络错误”。
  - `src/agent/agent-service.ts` 在生成 `messages + activeRun` 视图时会剔除尾部那条与 `activeRun.input.message` 重复的历史 user message，避免连续两轮都发“继续”时观察页把当前输入吞掉。
  - `src/types/api.ts` 给 `error` 事件补上 `conversationId`，让前端在失败收口时也能回源同步上下文占用和历史。
  - `test/agent-service.test.ts`、`test/server.test.ts` 增加回归断言，覆盖 canonical error 终态、interrupt 终态语义、重复 prompt 观察页渲染，以及刷新恢复时不误报失败的页面脚本入口。
- 对应入口：
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [src/types/api.ts](/E:/AII/ugk-pi/src/types/api.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 历史恢复过滤内部 prompt 协议
- 主题：修复刷新或重新打开 playground 后，从后端 session 恢复的用户历史消息会暴露 `<asset_reference_protocol>`、`<file_response_protocol>` 等内部 prompt 注入段的问题。
- 影响范围：
  - `src/agent/file-artifacts.ts` 新增内部 prompt 上下文剥离逻辑，统一移除 `<user_assets>`、`<asset_reference_protocol>`、`<file_response_protocol>` 这些只应给模型看的协议段。
  - `src/agent/agent-service.ts` 在 `GET /v1/chat/history` 还原用户消息时应用剥离逻辑，保留真实用户原文，不影响助手回复、工具过程和实际发送给模型的增强 prompt。
  - `test/agent-service.test.ts` 增加回归测试，覆盖“session 里存的是增强 prompt，但历史接口只返回用户原文”的场景。
  - `docs/playground-current.md` 同步记录历史恢复口径，避免后续把内部协议泄漏误认为正常历史内容。
- 对应入口：
  - [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 历史阅读时不强制滚底
- 主题：修复 playground 在最新对话流式更新时无条件自动滚到底部，导致用户上滑查阅历史被打断的问题。
- 影响范围：
  - `src/ui/playground.ts` 新增 transcript 跟随状态，只有用户停留在底部附近时才自动跟随 `text_delta`、loading 和过程日志更新。
  - 用户离开底部阅读历史时显示“回到底部”按钮，点击后强制回到底部并恢复自动跟随。
  - 初次恢复本地 / 服务端历史仍会强制定位到底部，避免打开页面时停在旧消息中段。
  - 补强前端验收口径：改完 `playground` 后不仅要跑测试，还要重启 `ugk-pi` 并确认 `3000/playground` 实际返回了新 HTML / JS 标记，避免拿旧页面误测。
  - `test/server.test.ts` 增加页面断言，固定滚动跟随阈值、按钮入口和事件绑定。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 全局 agent 会话与断线续订
- 主题：把 playground 从“每个浏览器各自持有本地 conversationId / 本地历史”收口为固定全局 agent 会话 `agent:global`，并修复手机前后台切换导致 `/v1/chat/stream` 断线后页面停止更新的问题。
- 影响范围：
  - `src/ui/playground.ts` 固定使用 `agent:global`，`conversation-id` 只展示全局 ID，不再从浏览器 `localStorage` 读取设备私有会话身份。
  - 新增 `GET /v1/chat/history`，由 `AgentService` 从 pi session messages 还原全局会话历史；新浏览器 / 新设备打开 playground 会先用本地缓存快速渲染，再从后端同步真实 agent 历史。
  - 当前任务运行中如果主 `/v1/chat/stream` 因手机后台、页面恢复或网络短断提前结束，前端会重新查询 `/v1/chat/status`；只要后端仍在 running，就切到 `/v1/chat/events` 继续订阅，不再把这种浏览器生命周期断线显示成任务失败。
  - `visibilitychange`、`pageshow` 和 `online` 会触发运行态 / 历史重查，让页面重新回到真实 agent 状态。
  - `test/server.test.ts` 增加全局会话、history 接口和 stream 断线续订的回归断言。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/types/api.ts](/E:/AII/ugk-pi/src/types/api.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### 本地 artifact 链接避免二次包裹
- 主题：修复 agent 回复里的 `/v1/local-file?path=...` 链接被用户可见文本重写器再次包裹，生成 `path=http://.../v1/local-file?path=...` 后打不开的问题。
- 影响范围：
  - `src/agent/file-artifacts.ts` 在重写 `/app/public/...`、`/app/runtime/...` 和 `file:///app/...` 时，会识别当前匹配是否已经位于 `/v1/local-file` 的 `path` 查询参数里，避免二次重写。
  - `src/routes/files.ts` 对历史上已经生成的双层 `/v1/local-file` URL 做兼容拆包，拆出内层真实 artifact 路径后仍按 `public/`、`runtime/` 白名单校验和服务。
  - `test/file-artifacts.test.ts` 增加“已翻译 local-file URL 不再二次包裹”的回归用例；`test/server.test.ts` 增加“双层 local-file URL 仍能打开”的回归用例。
  - `docs/runtime-assets-conn-feishu.md` 同步记录本地 artifact 链接重写与双层链接兜底口径。
- 对应入口：
  - [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
  - [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
  - [test/file-artifacts.test.ts](/E:/AII/ugk-pi/test/file-artifacts.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### Playground Markdown 渲染库化
- 主题：把 agent 回复 Markdown 从项目内手写解析器迁到 `marked`，避免表格、分割线等标准 Markdown 继续靠临时正则补洞。
- 影响范围：
  - `package.json` 新增 `marked` 依赖，`src/ui/playground.ts` 的 `renderPlaygroundMarkdown()` 改为使用 `marked` 的 GFM 渲染能力。
  - playground 浏览器端内联 `marked` 的 UMD 版本，避免单文件 HTML 前端在运行时依赖外部 CDN 或 Node import。
  - 仍然覆盖安全边界：原始 HTML 会被转义，链接只允许 `http/https`，并继续加 `target="_blank"` 与 `rel="noreferrer noopener"`。
  - playground 消息内容新增表格样式，表头、单元格、横向滚动和边框层次跟当前深色消息气泡保持一致；表格由外层滚动容器控制最大宽度，窄表按内容宽度展示，不再强制撑满消息气泡。
  - `test/server.test.ts` 增加“段落 + pipe table + `---`”回归断言，固定表格必须输出 `<table>` / `<thead>` / `<tbody>`，分割线必须输出 `<hr>`，并防止分隔行裸露。
  - `docs/playground-current.md` 同步记录当前 Markdown 渲染口径。
- 对应入口：
  - [package.json](/E:/AII/ugk-pi/package.json)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### 生产运行态外置到 shared 目录
- 主题：把腾讯云服务器上的 `.env`、`.data/chrome-sidecar` 和生产日志从代码目录继续剥离到 `~/ugk-claw-shared/`，让 Git 工作目录和运行态彻底分家。
- 影响范围：
  - `docker-compose.prod.yml` 改为支持通过 `UGK_APP_ENV_FILE`、`UGK_APP_LOG_DIR`、`UGK_NGINX_LOG_DIR`、`UGK_BROWSER_CONFIG_DIR` 从 shared 目录注入生产运行态路径
  - `.env.example` 补齐这些路径变量的默认值，避免后续只会盯着仓库内相对路径发呆
  - `README.md`、`AGENTS.md`、`docs/traceability-map.md`、`docs/tencent-cloud-singapore-deploy.md` 同步更新 shared 目录口径和生产命令
  - 腾讯云服务器已实际完成迁移验证：`healthz` 与 `playground` 均返回 `200`，`ugk-pi` / `nginx` / `chrome-sidecar` 的生产挂载已切到 `~/ugk-claw-shared/`
  - 旧 repo 内遗留的 `logs/` 已归档到 `~/ugk-claw-shared/backups/repo-logs-from-repo-20260420-112034`
- 对应入口：
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [.env.example](/E:/AII/ugk-pi/.env.example)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

### Chrome sidecar 自举收口
- 主题：修复 `ugk-pi-browser` 容器启动后只有 GUI 壳子、却不会自动拉起带 `--remote-debugging-port=9222` 的 Chrome 进程，导致 direct CDP 默认链路空转的问题。
- 影响范围：
  - 新增 `scripts/ensure-sidecar-chrome.sh`，让浏览器容器在 healthcheck 中自检并按需拉起 Chrome CDP
  - `docker-compose.yml` 与 `docker-compose.prod.yml` 把该脚本挂进 `ugk-pi-browser`，并要求 `ugk-pi-browser-cdp`、`ugk-pi` 等到浏览器健康后再继续启动
  - `test/containerization.test.ts` 增加对 sidecar 自举脚本、挂载路径和 `service_healthy` 依赖条件的回归断言
- 对应入口：
  - [scripts/ensure-sidecar-chrome.sh](/E:/AII/ugk-pi/scripts/ensure-sidecar-chrome.sh)
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)

### 服务器运维速查页
- 主题：把腾讯云新加坡服务器最常用的更新、验收、日志、SSH tunnel、运行态位置与回滚命令压成一页速查，避免每次都在长 runbook 里考古。
- 影响范围：
  - 新增 `docs/server-ops-quick-reference.md`，只保留高频操作，不重复铺陈历史背景
  - `README.md`、`AGENTS.md`、`docs/traceability-map.md`、`docs/tencent-cloud-singapore-deploy.md` 同步挂出速查页入口，形成“速查页 -> 长 runbook”的文档梯度
- 对应入口：
  - [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

### Sidecar GUI 与 CDP 统一 profile
- 主题：修复 sidecar GUI 手点打开的浏览器仍走默认 desktop launcher，导致它和 agent/CDP 控制的 Chrome 分别落到不同 profile、看起来像“登录态全没了”的问题。
- 影响范围：
  - `scripts/ensure-sidecar-chrome.sh` 现在会在容器内生成 `ugk-sidecar-chrome` launcher，并把 `google-chrome.desktop` 与 `com.google.Chrome.desktop` 的 `Exec=` 改写到同一个 `chrome-profile-sidecar`
  - GUI 手点浏览器与 direct CDP 启动的 Chrome 现在共用 `WEB_ACCESS_BROWSER_PROFILE_DIR=/config/chrome-profile-sidecar`
  - `test/containerization.test.ts` 增加对 launcher 名称、desktop patch 和统一 `--user-data-dir` 的回归断言
- 对应入口：
  - [scripts/ensure-sidecar-chrome.sh](/E:/AII/ugk-pi/scripts/ensure-sidecar-chrome.sh)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)

### Sidecar 登录态持久化口径补强
- 主题：把“为什么正常更新不该把 sidecar 登录态洗掉”写成明确 runbook，而不是继续靠口头传说维持秩序。
- 影响范围：
  - `AGENTS.md` 明确：生产 sidecar 登录态挂在 `~/ugk-claw-shared/.data/chrome-sidecar`，且 GUI 与 direct CDP 共用同一套 `chrome-profile-sidecar`；更新后如果又像两套登录态，先查 launcher 与浏览器容器版本。
  - `docs/server-ops-quick-reference.md` 新增 sidecar 登录态备份命令，以及更新后针对 `9222`、desktop launcher、`chrome-profile-sidecar` 进程的三段式验收。
  - `docs/tencent-cloud-singapore-deploy.md` 同步补上登录态备份、验收和浏览器栈强制重建口径，避免后续 `/init` 又把“刷新 GUI 看起来没登录”误判成 shared 目录被清空。
  - `docs/traceability-map.md` 在 web-access 场景下补了 sidecar 登录态异常的追溯入口，后续 `/init` 不用再在多份文档里瞎游泳。
- 对应入口：
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### 腾讯云服务器迁移到 GitHub 工作目录
- 主题：把腾讯云新加坡服务器的主部署目录从 tar 解包目录迁到 GitHub 工作目录，结束“本地打包 tar -> 服务器解包”作为默认主流程的阶段。
- 影响范围：
  - 服务器当前主部署目录改为 `~/ugk-claw-repo`，`origin` 指向 `https://github.com/mhgd3250905/ugk-claw-personal.git`
  - 生产容器实际 bind source 已切到 `~/ugk-claw-repo`：`runtime/skills-user` 与 `.data/chrome-sidecar`
  - 原 `~/ugk-pi-claw` 与两个历史目录保留为回滚兜底，不再是默认更新入口
  - 服务器实测通过：`/healthz` 返回 `200`、`playground` 返回 `200`、`python3 --version` 正常、`check-deps.mjs` 返回 `host-browser: ok`
  - `README.md`、`AGENTS.md`、`docs/traceability-map.md`、`docs/tencent-cloud-singapore-deploy.md` 同步更新接手和部署口径，避免后续 `/init` 继续按旧 tar 目录理解
- 对应入口：
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

### GitHub 主仓库切换与仓库边界收口
- 主题：把代码主仓库切到 GitHub，并先收紧 `.gitignore` 与部署文档口径，避免后续服务器迁移还没开始，主仓库已经被本地运行产物污染。
- 影响范围：
  - `.gitignore` 新增本地调试目录、部署 tar 包、运行时截图 / 调试 HTML、临时输出目录等低争议 ignore 规则，先把明显不该入库的产物挡在 Git 之外
  - `README.md`、`AGENTS.md`、`docs/traceability-map.md` 同步声明 GitHub 已是代码事实源，并明确 `.env`、`.data/`、运行时报告、部署包不属于主仓库
  - `docs/tencent-cloud-singapore-deploy.md` 从“Gitee / tar 为主”调整为“GitHub 为主、tar 为服务器过渡方案”，为后续把服务器迁成 Git 工作目录铺路
- 对应入口：
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
  - [.gitignore](/E:/AII/ugk-pi/.gitignore)

### Playground 手机端展示层重写
- 主题：不再继续拿桌面端布局硬压手机，而是在保留现有会话、文件、技能、发送等逻辑的前提下，把手机端展示层整体重写成真正可用的移动聊天页。
- 影响范围：
  - `src/ui/playground.ts` 的手机断点样式整体收口为“顶部紧凑头部 + 四按钮操作条 + 全高 transcript + 底部 composer”三段式，不再让桌面 `landing` hero 占掉首屏空间；手机端 `transcript-pane` 额外去掉边框并收成全透明
  - 手机端当前可见界面的圆角统一压到 `4px`，不再混用 `12px / 14px / 16px`
  - 手机端底部发送区的 `send` / `interrupt` 控制改成纯 icon：发送使用居中的向上箭头 icon，打断使用白色方形中断 icon，不再显示“发 / 停”文字，同时彻底切断桌面端按钮背景、边框、阴影和默认外观在手机端的继承；当前两个 icon 调整为 `28px`，避免把按钮本体撑大；`interrupt` 在禁用态仍保留占位，只做变淡处理，不再直接隐藏
  - 手机端直接隐藏 `landing-screen` 与拖拽上传壳子，已选文件 / 资产改成横向滚动 strip，把有限高度还给对话内容
  - 手机端 `composer`、发送 / 打断按钮、消息气泡、字号、留白全部按触屏阅读与单手点击重新收口；桌面端现有布局不改
  - 手机端额外收紧富文本代码块：让外层 `.code-block` 退成透明壳子，代码区域本身取消叠加半透明背景，只保留排版层次；工具条不再整条展示，只保留右上角透明背景的纯图标复制按钮，不显示文字 label；助手消息里的 `code` 背景也强制透明，并让长代码行在块内换行，避免把消息气泡横向撑爆
  - `docs/playground-current.md` 更新为新的手机端真实口径，明确这次是“移动展示层重写”，不是继续缝补适配
  - `README.md`、`AGENTS.md`、`docs/traceability-map.md` 同步补齐后续 `/init` 接手提醒，明确手机端已经独立收口，不要再按桌面端缩略版理解
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

## 2026-04-19

### Playground 新会话历史保留、代码块渲染与手机端菜单收口
- 主题：把 `playground` 里最影响真实使用的三个交互问题一次收口，并单独给手机 Web 做不污染桌面端的适配。
- 影响范围：
  - `src/ui/playground.ts` 修复 markdown 在“普通文本 + fenced code block”场景下把 `CODEBLOCK0` 占位符漏到页面的问题，保证技能结构这类回复能正常显示代码块
  - 点击“新会话”前，会先把当前页 transcript 归档到滚动区顶部的“历史会话”区块，不再一键把当前可见历史直接清空
  - 发送消息或向运行中会话追加消息后，composer 会立即清空；如果请求在真正进入后端前失败，会把草稿恢复回来，避免用户误以为已发出却又丢内容
  - 手机端新增顶部菜单，接管 `新会话 / 查看技能 / 选择文件 / 项目文件库` 四个操作；桌面端原有侧边操作保持不动
  - `test/server.test.ts` 增加回归断言，覆盖代码块渲染、新会话归档、立即清空输入框以及手机端菜单入口
  - `docs/playground-current.md` 同步补齐当前口径，避免后续再按旧版“点新会话就清空页面历史”来理解
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 手机端从折叠菜单改回常驻四按钮条
- 主题：撤掉手机端顶部菜单方案，改成更直接的四按钮常驻操作条，把空间还给对话区。
- 影响范围：
  - `src/ui/playground.ts` 删除手机端 `menu button + panel` 逻辑，改成顶部常驻 `新会话 / 技能 / 文件 / 文件库` 四按钮条
  - 手机端布局重新收口为“顶部快捷操作 / 中间 transcript / 底部 composer”，不再为了展开菜单额外占用交互成本
  - `test/server.test.ts` 更新断言，明确手机端是 action strip，不是折叠菜单
  - `docs/playground-current.md` 更新当前手机端真实口径
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### 云服务器更新方式确认规则
- 主题：把“服务器更新前必须先确认增量更新还是整目录替换”上升到项目最高规则和部署 runbook，避免后续 agent 默认整目录替换把服务器本地状态一起覆盖。
- 影响范围：
  - `AGENTS.md` 的最高准则新增部署确认规则：云服务器更新前必须先问清是增量更新还是整目录替换，默认倾向增量更新。
  - `docs/tencent-cloud-singapore-deploy.md` 的更新部署流程前置这条硬规则，明确在未获确认前不要默认执行整目录替换。
  - 这条规则的直接目标是保护服务器上的 `runtime/skills-user/`、`runtime/agents-user/`、`.data/` 以及其他不在仓库里的本地状态。
- 对应入口：
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

### `/init` 接手入口补强
- 主题：把后续 agent `/init` 最容易踩的云端接手前提前置到主入口文档，避免每次重新考古“服务器是不是 Git 仓库”和“什么时候该 build 镜像”。
- 影响范围：
  - `AGENTS.md` 的快速接手场景前置 `docs/web-access-browser-bridge.md` 与 `docs/tencent-cloud-singapore-deploy.md`，并明确云端入口、tar 解包目录属性和运行环境变更必须 `up --build -d`。
  - `README.md` 的快速开始补充“什么时候只 `restart`、什么时候必须 `up --build -d`”的判断口径，减少后续把环境层变更误当成普通热重启。
  - `docs/traceability-map.md` 的快速接手场景追加云端目录不是 Git 仓库的提醒，防止 `/init` 之后又在服务器里直接跑 `git archive` / `git pull`。
- 对应入口：
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### 云服务器更新部署流程补强
- 主题：把本次 `python3` 环境修复上线后的真实云端更新操作补进部署 runbook，明确本机打包、服务器替换、必须重建镜像和验证顺序。
- 影响范围：
  - `docs/tencent-cloud-singapore-deploy.md` 的“后续更新部署流程”补充说明：服务器 `~/ugk-pi-claw` 是 tar 解包目录，不是 Git 仓库，不能在服务器里执行 `git archive` / `git pull`。
  - 明确运行环境变更必须执行 `docker compose -f docker-compose.prod.yml up --build -d`，只 `restart` 不会让旧镜像获得新依赖。
  - 记录本次云端实测结果：`ugk-pi` healthy、`python3 --version -> Python 3.11.2`、`/healthz -> HTTP/1.1 200 OK`、`check-deps.mjs -> host-browser ok + proxy ready`。
  - 固化后续更新验收口径：容器健康、健康检查、运行环境命令、以及 web-access sidecar readiness 必须按变更范围逐项验证。
- 对应入口：
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

### 容器 Python3 运行环境补齐
- 主题：修复容器内缺少 `python3`，以及 sidecar Chrome 重启 helper 依赖浏览器容器 Python 导致 `python is required to clear Chrome restore state` 的问题。
- 影响范围：
  - `Dockerfile` 的基础工具安装列表新增 `python3`，让 app / agent 容器可以直接运行用户技能里的 Python 脚本。
  - `scripts/sidecar-chrome.mjs` 不再进入 `ugk-pi-browser` 容器查找 `python3` / `python`；改为由 Node helper 读取并写回 Chrome profile JSON，避免第三方 Chrome sidecar 镜像缺 Python 时重启失败。
  - `test/containerization.test.ts` 增加回归断言，固定 app 镜像必须包含 `python3`，并防止 sidecar helper 再次依赖浏览器容器内 Python。
  - `AGENTS.md`、`README.md`、`docs/web-access-browser-bridge.md`、`docs/tencent-cloud-singapore-deploy.md` 同步更新运行口径和线上验证命令。
- 对应入口：
  - [Dockerfile](/E:/AII/ugk-pi/Dockerfile)
  - [scripts/sidecar-chrome.mjs](/E:/AII/ugk-pi/scripts/sidecar-chrome.mjs)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

### 腾讯云新加坡部署 Runbook 落地
- 主题：把本次腾讯云新加坡 CVM 从选型、初始化、Docker 安装、代码传输、`.env`、生产 compose 启动、Chrome sidecar 登录、线上故障修复到后续更新发布的全过程沉淀为可追溯部署文档。
- 影响范围：
  - 新增 `docs/tencent-cloud-singapore-deploy.md`，记录当前云端实例 `43.134.167.179`、`4 核 8G`、`5Mbps`、Ubuntu `24.04.4 LTS`、`docker-compose.prod.yml`、公网 `3000`、SSH tunnel 访问 sidecar GUI 等事实。
  - `AGENTS.md` 增加云端部署 runbook 线索，明确后续接手时不要开放公网 `3901`，域名或 HTTPS 变更必须同步服务器 `.env` 与部署文档。
  - `README.md` 的文档导航补充部署 runbook 入口，避免只有 agent 接手文档知道这件事，普通入口却找不到。
  - `docs/traceability-map.md` 在快速接手和容器部署场景中加入部署 runbook，后续排查云端更新、回滚、SSH tunnel 时可以直接定位。
  - 文档记录本次 Gitee 新加坡访问慢、zip 半截下载、`crypto.randomUUID()` 在公网 HTTP 下不可用等真实踩坑，以及推荐的本地 `git archive` 打包上传更新流程。
- 对应入口：
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### Playground HTTP 部署 ID 生成兼容
- 主题：修复公网 `http://IP:3000/playground` 下浏览器缺少 `crypto.randomUUID()` 导致页面初始化失败、无法发送消息的问题。
- 影响范围：
  - `src/ui/playground.ts` 新增 `createBrowserId()` / `createConversationId()`，优先使用 `crypto.randomUUID()`，再退回 `crypto.getRandomValues()`，最后退回时间戳加随机数。
  - 替换 playground 内会话 ID、历史消息 ID、文件展示 ID 的裸 `crypto.randomUUID()` 调用，避免非 HTTPS 部署直接炸前端。
  - `test/server.test.ts` 增加回归断言，防止后续又直接依赖 secure-context-only API。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)

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
## 2026-04-20 Playground Context Usage Indicator

- 主题：为 `playground` 增加位于对话区和输入框之间、右侧对齐的小圆环上下文提示，并把当前会话的上下文估算结果暴露到 `GET /v1/chat/status`
- 影响范围：
  - `src/agent/context-usage.ts` 新增会话上下文估算逻辑，优先复用最近一次 assistant `usage`，并补上 trailing messages / 输入附件 / 资产的粗估 token
  - `src/agent/agent-session-factory.ts` 暴露项目默认 provider / model / context window / reserve budget，避免前端凭空脑补上下文上限
  - `src/agent/agent-service.ts` 的 `getRunStatus` 现在会返回 `contextUsage`，即使当前没有 active run，也会基于已存 session 估算会话占用
  - `src/types/api.ts`、`src/routes/chat.ts` 同步把 `ChatStatusResponseBody` 收口为 `conversationId + running + contextUsage`
  - `src/ui/playground.ts` 在对话区和输入框之间新增独立的小圆环进度提示，圆环只显示百分比，风险色跟随 `safe / caution / warning / danger`
  - 桌面 Web 和手机端都使用同一位置规则：在输入框外部、右侧与输入区域对齐
  - 桌面端 hover / focus 展示详情浮层，手机端点击圆环打开底部详情弹窗
  - `playground` 前端会把本地草稿、待发附件、已选资产叠加到后端基线，占用文案明确标成估算，不再装成 provider 精确统计
- 对应入口：
  - [src/agent/context-usage.ts](/E:/AII/ugk-pi/src/agent/context-usage.ts)
  - [src/agent/agent-session-factory.ts](/E:/AII/ugk-pi/src/agent/agent-session-factory.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [src/types/api.ts](/E:/AII/ugk-pi/src/types/api.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/agent-session-factory.test.ts](/E:/AII/ugk-pi/test/agent-session-factory.test.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
