This file provides guidance and project history for AI coding agents working in this repository.

# ugk-pi Agent Rules

## Language

- 默认使用简体中文回复
- 只有用户明确要求英文时才切换
- 命令、代码、日志、报错保持原始语言

## Project Intent

- 这是一个基于 `pi-coding-agent` 的自定义 agent 项目工作区
- 当前目标不是直接使用 `pi` CLI 当成最终产品，而是复用 `pi-coding-agent` 的基础设施来构建自己的 agent
- 当前已落地的是一个最小可运行的 HTTP API agent 和 Web playground
- `references/pi-mono/` 是官方参考镜像，优先用来查 `pi` 的能力、配置和目录约定
- 不要把 `references/pi-mono/` 当成业务代码目录修改，除非用户明确要求更新参考镜像

## Working Rules

- 先读现有文件，再动手改
- 优先编辑现有文件，不要无意义地新建文件
- 在缺少业务上下文时，先写计划到 `.codex/plans/`
- 做实现前先确认这次任务到底是在写代码、写文档，还是只做规划
- 后续所有方法实现，优先参考 `references/pi-mono/` 里的官方案例、官方文档和官方测试，不要自己拍脑袋发明一套
- 不要臆造 `pi` 配置项；涉及 `pi` 行为时先看：
  - `references/pi-mono/packages/coding-agent/README.md`
  - `references/pi-mono/packages/coding-agent/docs/settings.md`
  - `references/pi-mono/AGENTS.md`

## Current Local Conventions

- 项目级 `pi` 配置文件：`.pi/settings.json`
- 项目级 subagent 目录：`.pi/agents/`
- 项目级 prompt 目录：`.pi/prompts/`
- 项目级 skills 目录：`.pi/skills/`
- 项目级 extensions 目录：`.pi/extensions/`
- 项目级 `pi` agent 目录：`runtime/pi-agent/`
- 用户层 subagent 目录：`runtime/agents-user/`
- HTTP 服务入口：`src/server.ts`
- Agent 服务核心：`src/agent/`
- HTTP 路由：`src/routes/`
- Web playground：`src/ui/playground.ts`
- 测试目录：`test/`

## Fast Onboarding

如果你是刚接手这个仓库的 agent，先按这个顺序建立上下文，别像没头苍蝇一样乱翻：

1. 先读 `AGENTS.md` 当前文件，确认架构、运行方式、技能分层和已知坑
2. 再读 `README.md`，确认对外运行命令、接口和容器口径
3. 看 `src/server.ts`，确认服务装配入口
4. 看 `src/routes/chat.ts` 和 `src/routes/playground.ts`，确认真实接口面
5. 看 `src/agent/agent-service.ts` 和 `src/agent/agent-session-factory.ts`，确认 session、skill 和流式链路
6. 看 `src/ui/playground.ts`，确认 playground 当前交互能力
7. 如果用户问“有哪些技能”，先查 `GET /v1/debug/skills`，不要信模型自述

当前项目最值得优先记住的事实：

- 这是 `pi-coding-agent` 的自定义 HTTP agent 原型，不是完整业务平台
- 当前优先目标是稳定 runtime、会话、技能加载、HTTP 接口和后续 IM 接入形态
- 后续实现新方法时，默认先对照 `references/pi-mono/` 的官方案例与测试，再决定项目内落地方式
- skill 分为两层：
  - 系统技能：`.pi/skills`
  - 用户技能：`runtime/skills-user`
- 用户新增 skill 不需要重启 Docker，下一条消息就应生效
- subagent 定义也分两层：
  - 系统 subagent：`.pi/agents`
  - 用户 subagent：`runtime/agents-user`
- 用户新增或覆盖 subagent 定义后，下一次 `subagent` 调用就应生效
- 开发阶段优先用开发容器；生产容器不是给你边改边玩的

近期功能速记，方便后续 `/init` 快速续上：

- 默认本地验证入口只保留 `http://127.0.0.1:3000/playground`；如果发现 `3000` 和 `3101` 同时监听，先关掉临时 `3101`，别让旧预览进程污染判断
- playground 当前品牌是 `UGK Claw`，顶部是 ASCII 柯基字符画，界面文案已中文化
- playground 已使用 bundled Agave 字体，字体文件在 `public/fonts/`，通过 `GET /assets/fonts/:fileName` 暴露
- playground 支持随消息选择或拖入最多 5 个文件；拖入/选择后会自动给输入框补一段文件意图描述，文本类文件会通过 JSON `attachments` 把内容交给 agent，二进制文件只传文件名、类型和大小
- playground 输入区下方常驻 `drag debug` 调试条，会显示最近的 `dragenter` / `dragover` / `drop` 事件、`dataTransfer.types/files/items` 与 `dropEffect/effectAllowed`，专门用于排查 Chrome 拖放兼容性
- playground 只保留 `发送` 和 `打断` 两个核心控件；运行中继续发送就是追加到当前会话后续队列，语义固定为 `followUp`
- 后端仍保留 `POST /v1/chat/queue` 的 `steer` / `followUp` 两种 mode 作为 API 兼容能力；`POST /v1/chat/interrupt` 会调用底层 `session.abort()`
- agent 回复中的 `ugk-file` fenced block 会被提取为可下载文件，落盘到 `.data/agent/files` 并通过 `GET /v1/files/:fileId` 下载
- `web-access` 用户技能已修宿主机浏览器桥接兜底：IPC 没响应时会走 Chrome/Edge CDP，开发容器内会解析宿主机 IP 并重写 CDP WebSocket 地址

## Execution Boundary

- 当前仓库还没有明确业务领域和正式产品边界
- 已经确认会走“自定义 agent + HTTP API + 后续接 IM”的路线
- 在用户没有给出明确业务能力前，不要擅自初始化业务框架、数据库或前端工程化体系
- 当前阶段的代码应优先服务于：
  - 跑通 agent runtime
  - 稳定会话机制
  - 稳定 HTTP 接口
  - 为飞书/Slack/企业微信等 IM 接入预留形态

## Project Snapshot

- 快照日期：`2026-04-18`
- 当前阶段：`基础设施已跑通，处于最小可用原型阶段`
- playground 聊天视图已固定容器高度，长消息只在消息区内部滚动，输入操作栏固定在底部
- playground 已支持流式展示 agent 执行过程，工具调用和文本增量会实时滚动
- playground 已切换为 bundled Agave 字体，字体文件位于 `public/fonts/` 并通过 `/assets/fonts/:fileName` 暴露
- playground 已命名为 `UGK Claw`，顶部使用 ASCII 柯基字符画作为标识，界面文案已中文化
- playground 控制已简化为 `发送` 和 `打断`，运行中继续发送消息会统一追加到当前会话后续队列
- 默认本地验证入口是 `127.0.0.1:3000`；临时预览端口如 `3101` 不应长期保留
- playground 拖放监听已扩到 `window/document/html/body/chat-stage/composer/drop-zone`，并在 `dragenter/dragover` 显式设置 `dropEffect = "copy"`；当前已知现象是 Edge 正常、部分 Chrome profile 可能仍显示禁止图标
- playground 聊天气泡已支持安全的 Markdown 渲染，当前覆盖标题、列表、粗斜体、引用、链接、行内代码和代码块，代码块带语言标签与复制按钮
- playground Markdown 渲染函数注入浏览器脚本时会剥离 `tsx`/esbuild 的 `__name()` helper，避免页面初始化失败导致 `发送` 按钮无反应
- Windows 下 agent 调用 `bash` 工具时已启用隐藏控制台窗口，避免弹出黑框
- Windows 下的 `bash` 工具不会以 detached 模式启动，否则按 Node 官方行为会创建独立 console window
- agent session 的 skill 加载已切到白名单模式，默认只允许项目内 `.pi/skills`
- 系统预装技能当前除 `superpowers` 外，还包含 `skill-creator`、`frontend-design`、`find-skills`
- 已补齐容器运行工件，Windows 与 macOS 的推荐运行方式为 Linux 容器
- 已补齐生产版 compose、环境变量模板和容器健康检查
- 已加入生产 Nginx 反向代理、日志落盘和健康状态查看脚本
- 已将 `obra/superpowers` 技能库 vend 到项目白名单 skill 目录，`using-superpowers` 作为初始元技能可用
- 技能系统已分成系统技能与用户技能两层，用户安装 skill 后无需重启 Docker 即可在下一条消息生效
- 已提供 `GET /v1/debug/skills` 用于查看运行时真实技能清单
- 用户层 `web-access` 技能在宿主机 IPC 浏览器桥接无 responder 时，已支持本机 Chrome/Edge CDP 兜底并自动启动本机调试浏览器
- 开发容器内的 `web-access` 会在容器无浏览器时解析 `host.docker.internal` 为宿主机 IP，并通过宿主机 Chrome CDP 端口继续工作
- `web-access` 会把 Chrome CDP 返回的 `ws://127.0.0.1:9222/...` 重写成容器可访问的宿主机 IP WebSocket 地址，避免容器连回自己
- 技能相关问答不再走后端文字命中拦截，统一改为依赖真实技能清单接口或正常 agent 回答
- 已补齐新 agent 快速接手说明，`project-planning` 技能与顶层文档会优先引导读取关键入口和真实技能清单
- 已增加项目级 `subagent` 扩展，支持 single / parallel / chain 三种委派模式
- subagent 通过本地 `pi-coding-agent` CLI 子进程运行，默认只显式加载项目认可的 extension 与 skill 路径
- 已提供默认 subagent profiles：`scout`、`planner`、`reviewer`、`worker`
- 已提供 workflow prompts：`/implement`、`/scout-and-plan`、`/implement-and-review`
- 已修复 subagent 在项目子目录执行时丢失根目录默认 `provider/model`，导致 provider 被解析成 `unknown` 的问题
- 已改为使用项目内官方 `runtime/pi-agent/models.json` 托管 `dashscope-coding / glm-5` provider 定义，避免容器依赖宿主机 `%USERPROFILE%\\.pi\\agent\\models.json`
- 主 session 与 subagent 子进程现在共享同一份项目内 provider 定义，子进程通过 `PI_CODING_AGENT_DIR` 显式指向项目 agent 目录
- 已修复 Windows 下 subagent 本地 CLI 入口解析错误，避免 `import.meta.resolve()` 的 file URL 被错误拼成 `\\E:\\...` 导致 scout 等 subagent 无法启动
- 当前入口：
  - `GET /healthz`
  - `GET /assets/fonts/:fileName`
  - `GET /playground`
  - `GET /v1/files/:fileId`
  - `GET /v1/debug/skills`
  - `POST /v1/chat`
  - `POST /v1/chat/stream`
  - `POST /v1/chat/queue`
  - `POST /v1/chat/interrupt`
- 当前默认模型：
  - provider: `dashscope-coding`
  - model: `glm-5`
- 当前运行方式：
  - 开发：`npm run dev`
  - 启动：`npm start`
  - 测试：`npm run test`

## Current Architecture

### High Level

- `HTTP API Layer`
  - 使用 `Fastify` 提供健康检查、静态字体资产、聊天接口和本地测试页
- `Agent Service Layer`
  - `AgentService` 负责对外暴露统一聊天方法
  - 负责会话选择、消息聚合、流式事件转发、错误抛出和结果返回
  - 维护当前进程内的 active run 索引，支持运行中 `queueMessage()` 和 `interruptChat()`
- `Session Runtime Layer`
  - 通过 `@mariozechner/pi-coding-agent` 创建和复用 agent session
  - 复用项目根目录下的 `AGENTS.md`、`.pi/settings.json`、prompts、skills、extensions
  - 项目扩展会在 Windows 下覆盖内置 `bash` 工具，保持行为一致但隐藏控制台窗口
  - Windows 下禁用 detached bash spawn，避免 Node 为子进程创建独立控制台窗口
  - session 工厂会关闭默认 skill discovery，只显式加载允许的 skill 路径
- `Subagent Extension Layer`
  - 通过 `.pi/extensions/subagent/` 注册 `subagent` 工具
  - 工具使用本地 `pi-coding-agent` CLI JSON 模式启动隔离子进程
  - 子进程默认只显式加载 `.pi/extensions/project-guard.ts`、`.pi/skills` 与 `runtime/skills-user`
  - subagent profile 来自 `.pi/agents` 与 `runtime/agents-user`，用户层覆盖系统层
- `Persistence Layer`
  - `ConversationStore` 维护 `conversationId -> sessionFile` 映射
  - `FileArtifactStore` 维护 agent 生成文件的落盘文件与下载索引
  - 持久化路径在 `.data/agent/`
- `Playground UI`
  - 用于本地测试 agent 行为
  - 当前为深色、极客、零圆角、中心聚焦布局
  - 左侧展示对话流，右侧展示实时过程流
  - 消息区和过程区分别内部滚动，输入区固定在底部
  - 支持选择或拖入文件随消息发送，拖入后自动补充文件意图描述，并展示 agent 返回文件的下载卡片
  - 提供常驻 `drag debug` 调试条，显示最近拖放事件和 `dataTransfer` 摘要，方便排查 Chrome / Edge 差异
- `Container Runtime`
  - 仓库提供 `Dockerfile`、`docker-compose.yml`、`.dockerignore`
  - Windows/macOS 推荐通过 Linux 容器运行，Linux 容器优先、裸跑兼容
  - 生产路径使用 `docker-compose.prod.yml` 与 `.env`
  - 生产环境由 Nginx 暴露外部端口，应用容器仅保留在 compose 内部网络

### Request Flow

1. 客户端调用 `POST /v1/chat` 或 `POST /v1/chat/stream`
2. 路由校验 `message`
3. `AgentService` 根据 `conversationId` 查找历史 `sessionFile`
4. `AgentSessionFactory` 用 `pi-coding-agent` 创建或打开 session
5. session 执行 `prompt()`
6. 运行期间同一 `conversationId` 会登记到 `activeRuns`
7. 客户端可调用 `POST /v1/chat/queue` 追加运行中消息；playground 固定使用 `streamingBehavior: "followUp"`，后端保留 `steer` 作为 API 兼容能力
8. 客户端可调用 `POST /v1/chat/interrupt` 触发 `session.abort()`，当前 SSE 会补发 `interrupted`
9. 如果主 agent 调用 `subagent` 工具，则扩展会启动本地 `pi` 子进程执行委派任务，并把过程通过 `tool_execution_update` 回传
10. 同步接口聚合 `text_delta`，流式接口转发 `text_delta`、`tool_execution_*`、`queue_update` 等过程事件
11. 如果没有流式文本，回退读取最终 assistant message
12. 如果最终 assistant message 标记为错误，则抛出明确异常或输出错误事件
13. 更新 `conversationId -> sessionFile` 映射
14. 返回 `{ conversationId, text, sessionFile }` 或 SSE 事件流

## Current File Responsibilities

- `src/server.ts`
  - 组装 Fastify 服务
  - 注册 `healthz` 与各路由模块
  - 默认创建 `AgentService`
- `src/routes/assets.ts`
  - 提供 `GET /assets/fonts/:fileName`
  - 仅允许读取 `public/fonts/` 下的 `.ttf` 字体文件
- `src/routes/files.ts`
  - 提供 `GET /v1/files/:fileId`
  - 只从 `FileArtifactStore` 管理的索引读取 agent 生成文件，不暴露任意本地路径
- `src/config.ts`
  - 提供应用运行配置
  - 负责从 `api.txt` 自动加载 `DASHSCOPE_CODING_API_KEY`
  - 提供 `.data/agent/files` 与 `.data/agent/file-index.json` 路径
- `src/agent/agent-service.ts`
  - 对话主服务
  - 负责 session 选择、响应聚合、流式事件映射、错误处理、结果持久化
  - 负责 active run 管理、运行中消息队列和打断控制
  - 负责把用户 `attachments` 注入 prompt，并把 assistant 的 `ugk-file` 输出转成下载文件
- `src/agent/file-artifacts.ts`
  - 定义聊天附件与 agent 文件产物结构
  - 负责文件响应协议、文件名清洗、文件落盘、索引读写和下载元数据
- `src/agent/agent-session-factory.ts`
  - 基于 `pi-coding-agent` 创建/打开 session
  - 暴露消息更新、队列更新与工具执行相关事件类型
  - 创建 skill 白名单 `ResourceLoader`，默认允许系统技能 `.pi/skills` 与用户技能 `runtime/skills-user`
  - 显式使用 `runtime/pi-agent/models.json` 创建项目级 `ModelRegistry`
- `public/fonts/`
  - 当前包含 bundled `Agave-Regular.ttf` 与 `Agave-Bold.ttf`
  - 字体来源：`https://github.com/blobject/agave`
- `.pi/extensions/subagent/index.ts`
  - 注册项目级 `subagent` 工具
  - 负责 single / parallel / chain 三种委派模式
  - 负责拼装子进程 CLI 参数、解析 JSON 事件并回传过程更新
- `.pi/extensions/subagent/agents.ts`
  - 负责发现 `.pi/agents` 与 `runtime/agents-user` 下的 subagent profiles
  - 负责处理系统层与用户层的覆盖关系
- `.pi/agents/`
  - 内置 subagent profiles
  - 当前包含 `scout`、`planner`、`reviewer`、`worker`
- `.pi/skills/superpowers/`
  - vendored `obra/superpowers` 技能库
  - 包含 `using-superpowers`、`brainstorming`、`test-driven-development` 等工作流技能
- `runtime/skills-user/`
  - 用户后装 skill 的持久目录
  - 生产 compose 已挂载到应用容器内，供运行时热增加 skill
- `runtime/skills-user/web-access/scripts/local-cdp-browser.mjs`
  - `web-access` 的本机浏览器 CDP 兜底实现
  - 在 IPC 宿主机浏览器桥接没有响应时，连接或启动 `127.0.0.1:9222` 上的 Chrome/Edge 调试实例
  - 在 Docker 容器里会解析 `host.docker.internal` 到 IPv4 地址后探测宿主机 `9222`，绕开 Chrome DevTools 对非 IP Host header 的限制
  - 会将 CDP target 内的 loopback WebSocket URL 重写为当前可达的 CDP host
  - 支持目标页创建、列表、导航、JS 执行、点击、滚动、截图和基础下载轮询
- `runtime/agents-user/`
  - 用户后装 subagent profile 的持久目录
  - 当前可为空，存在时会在 `subagent` 调用时按需扫描
- `runtime/pi-agent/models.json`
  - 项目内 checked-in 的官方 `models.json`
  - 当前托管 `dashscope-coding / glm-5` provider 定义
- `src/agent/conversation-store.ts`
  - 管理 conversation 索引文件
- `.pi/extensions/project-guard.ts`
  - 拦截危险 bash 与受保护路径写入
  - 在 Windows 下覆盖内置 `bash` 工具以隐藏控制台弹窗
- `.pi/prompts/implement.md`
  - `scout -> planner -> worker` 的链式 subagent 工作流 prompt
- `.pi/prompts/scout-and-plan.md`
  - 只调研与规划的链式 subagent 工作流 prompt
- `.pi/prompts/implement-and-review.md`
  - `worker -> reviewer` 的链式 subagent 工作流 prompt
- `src/routes/chat.ts`
  - `GET /v1/debug/skills`
  - `POST /v1/chat`
  - `POST /v1/chat/stream`
  - `POST /v1/chat/queue`
  - `POST /v1/chat/interrupt`
- `src/routes/playground.ts`
  - `GET /playground`
- `src/ui/playground.ts`
  - 本地 Web 测试界面
  - 对话流和 agent 过程流的实时展示
  - 使用 Agave 字体、`UGK Claw` 标题和 ASCII 柯基标识，并只提供 `发送` 与 `打断` 两个核心输入控件
  - 提供查看真实技能清单的调试入口
  - 对 transcript 消息执行安全 Markdown 渲染，并为代码块补充语言标签与复制按钮
- `Dockerfile`
  - 容器镜像入口
  - 以 `node:22-bookworm-slim` 运行 HTTP 服务
  - 内置 `/healthz` 容器健康检查
- `docker-compose.yml`
  - 本地开发容器编排
  - 绑定源码目录并以 `npm run dev` 启动
- `docker-compose.prod.yml`
  - 生产容器编排
  - 使用 `.env` 注入配置、`npm start` 启动、`restart: unless-stopped`
  - 包含 `nginx` 反向代理、日志卷和双层健康检查
- `.env.example`
  - 生产容器环境变量模板
- `deploy/nginx/default.conf`
  - 生产版 Nginx 反向代理配置
- `scripts/docker-health.mjs`
  - 输出生产 compose 容器的状态、健康度和端口
- `test/*.test.ts`
  - 覆盖 conversation store、agent service、config、server 路由

## Skill Landscape

当前 skill 相关认知别再靠猜，按这套来：

- 系统技能根目录：`.pi/skills`
- 用户技能根目录：`runtime/skills-user`
- 真实技能清单接口：`GET /v1/debug/skills`

当前系统预装技能至少包括：

- `superpowers` 工作流技能集
- `project-planning`
- `skill-creator`
- `frontend-design`
- `find-skills`

当前已知用户技能至少包括：

- `web-access`

如果运行时技能列表和这些静态描述不一致，以 `/v1/debug/skills` 返回为准。

## Current Progress

### Done

- 已初始化项目基础文件：
  - `README.md`
  - `.gitignore`
  - `.pi/settings.json`
  - `.pi/prompts/feature-bootstrap.md`
  - `.pi/skills/project-planning/SKILL.md`
  - `.pi/extensions/project-guard.ts`
- 已克隆参考镜像：
  - `references/pi-mono`
- 已安装并验证全局 `pi-coding-agent`
- 已完成最小 HTTP API agent 骨架
- 已实现会话持久化映射
- 已实现 `GET /healthz`
- 已实现 `GET /playground`
- 已实现 `POST /v1/chat`
- 已实现 `POST /v1/chat/stream`
- 已实现 `POST /v1/chat/queue`，playground 运行中发送统一使用 `followUp` 追加语义
- 已实现 `POST /v1/chat/interrupt`，支持中止当前 active run 后继续沿用同一会话
- 已接入 `dashscope-coding / glm-5`
- 已完成 API key 模式运行
- 已修复空回复问题：
  - 原因是只依赖 `text_delta`，未读取最终 assistant message
- 已修复 provider 错误透传
- 已支持从 `api.txt` 自动加载 `DASHSCOPE_CODING_API_KEY`
- 已将 playground 调整为中心聚焦聊天布局
- 已将 playground 改为消息区内部滚动，输入区固定底部
- 已修复 playground 长消息把底部输入操作栏挤出视窗的问题
- 已将 playground 改为左侧对话流、右侧 agent 过程流的实时展示
- 已为 Windows 下的 `bash` 工具执行启用 `windowsHide`，避免控制台黑框闪现
- 已为 Windows 下的 `bash` 工具关闭 detached spawn，避免因 Node 默认行为创建独立黑框窗口
- 已将 agent skill 加载改为白名单模式，默认仅允许项目内 `.pi/skills`
- 已加入标准容器运行工件，支持 `docker build` 与 `docker compose up`
- 已加入生产版 compose、`.env.example` 和镜像健康检查
- 已加入生产版 Nginx 反向代理、日志落盘目录和状态/日志查看命令
- 已加入系统预装技能：
  - `anthropics/skill-creator`
  - `anthropics/frontend-design`
  - `vercel-labs/find-skills`
- 已将 `obra/superpowers` 技能库并入 `.pi/skills` 白名单，并暴露 `using-superpowers` 元技能
- 已将 skill 白名单改成系统技能 + 用户技能双层目录，用户 skill 可在不重启 Docker 的情况下于下一条消息生效
- 已重写 `project-planning` 技能，补齐当前项目的快速上手、技能事实源和高频坑说明
- 已增加项目级 `subagent` 扩展，支持 single / parallel / chain 三种委派模式
- 已增加默认 subagent profiles：`scout`、`planner`、`reviewer`、`worker`
- 已增加 workflow prompts：`implement`、`scout-and-plan`、`implement-and-review`
- 已将 subagent 子进程固定为本地 `pi-coding-agent` CLI 入口，避免依赖系统全局 `pi`
- 已将 subagent 资源加载收紧为项目认可的 extension 与 skill 路径
- 已加入 `runtime/agents-user` 作为用户层 subagent 覆盖目录
- 已让 subagent CLI 参数显式继承项目根 `.pi/settings.json` 的默认 `provider/model`
- 已让主 session 显式使用项目内 `runtime/pi-agent/models.json` 创建 `ModelRegistry`
- 已让 subagent 子进程通过 `PI_CODING_AGENT_DIR` 显式指向项目内 agent 目录，和主 session 共用同一份 provider 定义
- 已修复 Windows 下 subagent CLI 入口解析，`resolvePiCliEntry()` 现在会正确把 file URL 转成本地路径
- 已为 playground 聊天气泡补上安全 Markdown 渲染与代码块复制按钮，不再把 agent 的 Markdown 原样当纯文本吐出来
- 已修复 playground Markdown 渲染函数注入时携带 `__name()` helper，导致浏览器端 `ReferenceError` 并让 `发送` 按钮无反应的问题
- 已将 playground 字体切换为 bundled Agave，避免依赖外部 CDN 或用户本机字体
- 已将 playground 标题改为 `UGK Claw`，补充 ASCII 柯基字符画，并将主要界面文案中文化
- 已将 playground 运行中控制收敛为 `发送` 与 `打断`，移除 queue mode 下拉选择
- 已为 `.pi/extensions/project-guard.ts` 与 `.pi/extensions/subagent/index.ts` 补齐 TypeScript spawn 类型，`npx tsc --noEmit` 不再被旧类型债卡住
- 已将字体资产路由从 `src/server.ts` 拆到 `src/routes/assets.ts`，让 server 只负责服务装配
- 已收敛 `src/routes/chat.ts` 的重复 500 错误响应逻辑
- 已将 agent raw event 处理改为类型守卫，避免靠硬转型吞掉未知事件
- 已为 `POST /v1/chat`、`POST /v1/chat/stream` 和 `POST /v1/chat/queue` 增加 JSON `attachments`，让 agent 能收到用户随消息发送的文件意图和文本内容
- 已增加 `FileArtifactStore` 与 `GET /v1/files/:fileId`，支持把 assistant 的 `ugk-file` fenced block 提取为可下载文件
- 已让 playground 支持选择/拖入文件、自动补充文件意图描述、展示待发送附件，并展示 agent 返回文件的下载卡片
- 已把 playground 拖放监听扩到 `window/document/html/body/chat-stage/composer/drop-zone`，并在拖放阶段显式设置 `dropEffect = "copy"`，减少 Chrome 在 Windows 下把外部文件显示成禁止图标的概率
- 已给 playground 增加常驻 `drag debug` 调试条，可直接观察浏览器是否把拖放事件交给页面，以及 `dataTransfer` 里到底带了什么
- 已清理根目录旧 `skills/`、`.tmp/` 与 `.codex/tmp/` 临时残留，并将 `api.txt`、`node_modules/`、`runtime/pi-agent/auth.json` 等写入 `.gitignore`
- 已修复用户层 `web-access` 在宿主机 IPC 浏览器桥接无 responder 时只能超时失败的问题，新增本机 Chrome/Edge CDP 兜底
- 已修复 Docker 容器内 `web-access` 因没有浏览器、且不能直接使用 `host.docker.internal` 作为 Chrome DevTools Host header 而误判“当前环境没有浏览器”的问题
- 已修复容器内读取 Chrome CDP target 后拿到 `ws://127.0.0.1:9222/...` 导致 WebSocket 连回容器自身的问题

### Not Done Yet

- 飞书 webhook 适配
- Slack webhook 适配
- 企业微信 webhook 适配
- 多租户鉴权
- 数据库存储
- 高级 runtime 编排
- 业务域 prompt/tool 设计

### Current Judgement

- 现在这项目已经不是空壳，基础 agent 能跑、能聊、能记会话、能本地测试
- 但它还只是基础设施原型，不是完整产品
- 如果现在就把它吹成“IM agent 平台”，那就是典型自我感动，离正式可交付还差一截

## Model And Provider Notes

- 项目默认模型配置在 `.pi/settings.json`
- 当前默认：
  - `defaultProvider = dashscope-coding`
  - `defaultModel = glm-5`
- 项目级 provider 定义位于：
  - `runtime/pi-agent/models.json`
- 当前认证走 API Key 模式，不是 `/login` OAuth
- `src/config.ts` 会尝试从 `api.txt` 中提取 `api-key:`
- 主 session 会显式用项目内 `models.json` 创建 `ModelRegistry`
- `subagent` 子进程会通过 `PI_CODING_AGENT_DIR` 使用同一份项目内 `models.json`
- 安全注意：
  - `api.txt` 里是明文 key
  - 不要把它提交到远程仓库
  - 如果后续要公开仓库，必须先清理或改成安全注入

## Data Layout

- 会话索引：
  - `.data/agent/conversation-index.json`
- agent session 文件：
  - `.data/agent/sessions/`
- agent 生成文件：
  - `.data/agent/files/`
- 文件下载索引：
  - `.data/agent/file-index.json`
- 这层映射是为 IM 接入准备的
- 不要偷懒改成“只记最近一个 session”，那是给后面挖坑

## Validation Status

- 最近一次完整验证：
  - `npx tsc --noEmit`
  - `npm run test`
  - 结果：类型检查通过，`53 / 53` 测试通过
- 本次拖放兼容性与 `drag debug` 面板更新后已复跑上述两项验证，结果仍为类型检查通过、`53 / 53` 测试通过
- 本次文件发送功能新增后已复跑上述两项验证，结果为类型检查通过、`53 / 53` 测试通过
- 此前 README / AGENTS 接手文档补全后也复跑过上述两项验证，当时结果为类型检查通过、`49 / 49` 测试通过
- 本次 provider 修复：
  - 已新增项目内 `runtime/pi-agent/models.json`
  - 已追加 `test/agent-session-factory.test.ts` 与 `test/subagent.test.ts` 的 provider 回归断言
- 已验证：
  - `GET /healthz`
  - `GET /assets/fonts/Agave-Regular.ttf`
  - `GET /playground`
  - `GET /v1/debug/skills`
  - `POST /v1/chat`
  - `POST /v1/chat/stream`
  - `POST /v1/chat/queue`
  - `POST /v1/chat/interrupt`
  - `GET /v1/files/:fileId`
  - `POST /v1/chat` 可把 JSON `attachments` 透传给 `AgentService`
  - `AgentService.chat()` 会把上传附件注入 session prompt
  - `AgentService.chat()` 会把 assistant 的 `ugk-file` fenced block 转成下载文件并从可见文本移除
  - playground HTML 包含文件选择/拖放、自动文件意图描述、附件列表、文件下载卡片和 `attachments` 请求体逻辑
  - playground HTML 包含 `drag debug` 调试条、`pushDragDebug()`、`summarizeDataTransfer()`、`renderDragDebugLog()` 以及 `clear-drag-debug` 清空按钮
  - playground HTML 包含 `bindDropTarget(pageRoot)`、`bindDropTarget(pageBody)` 与 `setCopyDropEffect()`，说明根节点拖放监听和 `dropEffect = "copy"` 已下发到页面
  - `AgentService.queueMessage()` 对 active run 调用 `session.prompt(message, { streamingBehavior })`
  - `AgentService.interruptChat()` 对 active run 调用 `session.abort()`
  - playground transcript Markdown 渲染、HTML 转义、代码块工具栏与复制按钮注入
  - playground HTML 包含 `UGK Claw`、ASCII 柯基字符画、中文界面文案、Agave 字体、固定 `followUp` 追加请求、`打断` 按钮与新控制接口
  - 默认入口 `127.0.0.1:3000` 验证 `GET /healthz`、`GET /assets/fonts/Agave-Regular.ttf` 与 `GET /playground`
  - skill 白名单 loader 仅加载允许路径中的 skill
  - 系统预装技能 `skill-creator`、`find-skills`、`frontend-design` 已被白名单 loader 识别
  - Windows `bash` 工具隐藏控制台窗口且不以 detached 模式启动
  - `docker compose config` 可解析
  - `docker compose -f docker-compose.prod.yml config` 可解析
  - `docker build` 可成功构建镜像
  - 容器内 `GET /healthz` 返回 `{"ok":true}`
  - `docker:health:prod` 在无运行容器时会给出明确提示
  - 生产 compose 可成功启动双容器
  - Nginx 对外 `GET /healthz` 返回 `200 {"ok":true}`
  - `logs/app/` 与 `logs/nginx/` 会在生产 compose 启动后生成
  - 白名单 loader 可加载 `using-superpowers`、`brainstorming`、`test-driven-development` 等 vendored superpowers 技能
  - 白名单 loader 可同时加载系统技能目录与用户技能目录
  - `DefaultResourceLoader` 可识别 `.pi/extensions/subagent/index.ts`
  - subagent profile 发现支持系统层 `.pi/agents` 与用户层 `runtime/agents-user`，且用户层可覆盖系统层
  - subagent 子进程参数已锁定为项目认可的 extension/skill 路径
  - subagent 子进程参数会显式继承项目根默认 `provider/model`
  - 主 session 会显式使用项目内 `runtime/pi-agent/models.json`
  - subagent 子进程会显式设置 `PI_CODING_AGENT_DIR=runtime/pi-agent`
  - Windows 下 `resolvePiCliEntry()` 可正确解析到本地 `node_modules/@mariozechner/pi-coding-agent/dist/cli.js`
  - Windows 下 subagent 子进程 spawn 启用 `windowsHide`
  - 容器内 `POST /v1/chat` 可成功返回结果，不再报 `No API key found for unknown`
  - 本机 `POST /v1/chat` 可成功触发 `subagent scout` 调研 session 复用链路
- playground 真机发送消息
- playground 真机点击 `发送` 可触发 `POST /v1/chat/stream` 并收到 `OK` 流式回复
- playground HTML 不再包含会让浏览器崩溃的 `__name()` helper
- 用户层 `web-access` 的 `check-deps.mjs` 可在 IPC responder 不存在时回退到本机 Chrome CDP，并启动/复用 `http://127.0.0.1:9222`
- `web-access` 本机代理 `GET /targets` 可返回本机 Chrome page target
- `web-access` 本机代理可通过 `/new` 打开 `https://example.com/`，并通过 `/eval` 读取 `Example Domain` 页面文本
- 已新增 `test/web-access-host-bridge.test.ts` 覆盖 IPC 超时后的本机浏览器 fallback
- 开发容器内执行 `node runtime/skills-user/web-access/scripts/check-deps.mjs` 可返回 `host-browser: ok (http://192.168.65.254:9222)` 与 `proxy: ready`
- 开发容器内 `GET http://127.0.0.1:3456/targets` 可返回重写后的 `ws://192.168.65.254:9222/...` target
- 开发容器内代理可通过 `/new` 打开 `https://example.com/`，并通过 `/eval` 读取 `Example Domain` 页面文本
- 已通过真实 `POST /v1/chat/stream` 验证 agent 可在容器内执行 `web-access` 依赖检查并报告可用
- 已新增 `test/local-cdp-browser.test.ts` 覆盖 Docker host CDP 探测和 WebSocket URL 重写
- 消息区内部滚动行为
  - 长消息场景下输入操作栏固定在底部可见
  - playground 右侧过程面板会实时显示工具调用和完成事件
- 手动验证口径：
  - 打开 `http://127.0.0.1:3000/playground`
  - 发送一条短消息
  - 确认 `sessionFile` 有值
  - 确认左侧消息区内部滚动，而不是整页向下增长
  - 运行中继续点击 `发送`，确认右侧过程面板出现 `队列更新`
  - 点击 `打断`，确认右侧过程面板出现 `任务已打断`
  - 确认右侧过程面板出现 `任务开始`、`工具开始`、`工具完成`、`任务完成`
  - 确认输入区、`发送` 和 `打断` 按钮始终固定在底部可见

## Recovery Notes

- 如果 `GET /playground` 看起来还是旧页面，优先怀疑旧 `node` 进程没重启；开发容器场景先跑 `docker compose restart ugk-pi`，不要立刻另开新端口绕过去
- 如果发现 `3000` 和 `3101` 同时监听，优先关闭临时预览进程，只保留默认 `3000`；多开端口只会把验证结论搅浑
- 如果 Edge 能拖、另一个 Chrome 也能拖，只有某个 Chrome profile 显示禁止图标，优先怀疑该 profile 的扩展、站点权限、缓存或企业策略，而不是立刻回头甩锅给 playground
- 排查 Chrome 拖放时先看输入区下方的 `drag debug` 调试条：如果一条事件都没有，说明浏览器层就把拖放拦了；如果有 `dragenter/dragover` 但没有 `drop`，优先怀疑浏览器或扩展抢占；如果 `types/files/items` 为空，再看浏览器实际传了什么 payload
- 如果 playground 点击 `发送` 没反应，先打开浏览器控制台；若看到 `ReferenceError: __name is not defined`，说明有服务端函数通过 `Function.toString()` 注入浏览器脚本时带进了 `tsx`/esbuild helper，需要在 `src/ui/playground.ts` 的脚本拼装处剥离 helper，而不是继续怀疑按钮坏了
- 如果前端发送后没回复，优先检查：
  - provider 是否可用
  - API key 是否存在
  - `session.messages` 中是否有最终 assistant error
- 如果 agent 看起来“能运行但空回复”，先排查是否只监听了 `text_delta`
- 如果流式面板只有 `任务开始` 或底层 `run started` 没有后续事件，优先检查 provider 延迟、工具是否被阻断、以及浏览器是否连到了旧进程
- 如果运行中追加返回 `not_running`，说明该 `conversationId` 当前没有 active run；先确认 playground 或客户端没有换 conversation
- 如果打断返回 `abort_not_supported`，说明底层 session 实例没有暴露 `abort()`，优先检查 `@mariozechner/pi-coding-agent` 版本和 `AgentSessionLike` 适配
- 如果运行中发送的消息没在当前轮结束后继续执行，先检查 playground 是否调用了 `/v1/chat/queue` 且 `mode` 为 `followUp`，再看流式事件里有没有 `queue_updated`
- 如果上传文件后 agent 像没收到，先看请求体里是否真的有 `attachments`；文本文件应包含 `text` 字段，二进制文件目前只会传元数据，别又怪模型不会读空气
- 如果 agent 说发了文件但页面没有下载卡片，先检查回复里是否用了完整的 ````ugk-file name="..." mime="..."```` fenced block，再看 SSE `done.files`
- 如果 `GET /v1/files/:fileId` 返回 404，先检查 `.data/agent/file-index.json` 是否有该 id，以及 `.data/agent/files/` 里的落盘文件是否还在
- 如果 Agave 字体没生效，先请求 `/assets/fonts/Agave-Regular.ttf`，再检查浏览器是否缓存旧 playground HTML
- 如果 Windows 下调用 `bash` 仍然弹黑框，优先检查是否跑的是旧进程，或当前 session 没有加载项目级 `.pi/extensions/project-guard.ts`
- 如果 Windows 下调用 `bash` 仍然弹黑框，也要检查是否有其他地方重新引入了 `detached: true`
- 如果 agent 没按预期加载 skill，优先检查 `src/agent/agent-session-factory.ts` 里的允许路径列表，而不是只看 `.pi/settings.json`
- 如果用户新装 skill 不生效，先检查它是不是写进了 `runtime/skills-user/`，而不是误塞进了别的目录
- 如果 `subagent` 工具不可用，先检查 `.pi/extensions/subagent/` 是否真实存在并被当前 session 加载
- 如果 `subagent` 能启动但提示找不到 agent，先检查 `.pi/agents/` 或 `runtime/agents-user/` 下的 `.md` frontmatter 是否包含 `name` 和 `description`
- 如果 `subagent` 行为像是吃进了全局用户环境，先检查子进程参数里是否仍带着 `--no-extensions`、`-e .pi/extensions/project-guard.ts`、`--no-skills` 和项目 skill 路径
- 如果主服务或 `subagent` 报 `No API key found for unknown`，先检查 `runtime/pi-agent/models.json` 是否存在，以及 `src/agent/agent-session-factory.ts` / `.pi/extensions/subagent/index.ts` 是否还在显式指向项目内 agent 目录
- 如果 Windows 下 `subagent` 一上来就说调用失败，且日志里像是在检查 `dist` 目录但就是起不来，优先检查 `.pi/extensions/subagent/index.ts` 里是不是又把 file URL 的 `pathname` 当本地路径用了；这里必须走 `fileURLToPath()`
- 如果 Windows 下 `subagent` 一调用就弹新控制台，优先检查 `.pi/extensions/subagent/index.ts` 的 spawn 选项里 `windowsHide` 是否被改没了
- 如果用户层 subagent 覆盖不生效，先检查文件是不是写进了 `runtime/agents-user/`，以及同名系统 agent 是否被误以为还在生效
- 如果用户询问“当前有哪些技能”，优先看 `GET /v1/debug/skills` 的真实结果，不要相信模型自述
- 如果 `web-access` 报 `host_browser_timeout:status`，先跑 `node runtime/skills-user/web-access/scripts/check-deps.mjs`；当前实现会在 IPC responder 不存在时回退到本机 CDP
- 如果 `web-access` 的 `/health` 正常但 `/targets` 卡住或失败，不要只看 HTTP 代理是否活着；继续检查 `127.0.0.1:9222/json/version`、Chrome/Edge 是否可启动、以及 `runtime/skills-user/web-access/scripts/local-cdp-browser.mjs`
- 如果容器里的 `web-access` 仍说没有浏览器，进容器跑 `node runtime/skills-user/web-access/scripts/check-deps.mjs`；正常情况下应显示宿主机 IP 形式的 CDP endpoint，例如 `http://192.168.65.254:9222`
- 如果容器能访问 `host.docker.internal:9222` 但 Chrome 返回 `Host header is specified and is not an IP address or localhost`，不要继续用这个域名；应解析成 IPv4 地址后访问
- 如果容器内 `/targets` 返回的 WebSocket 仍是 `ws://127.0.0.1:9222/...`，说明 `rewriteCdpTargetForBaseUrl()` 没生效，容器会连回自己
- 如果本机没有 Chrome/Edge 或路径非标准，设置 `WEB_ACCESS_CHROME_PATH`；如果 `9222` 端口冲突，设置 `WEB_ACCESS_CDP_PORT`
- 如果容器内无法鉴权，优先检查是否通过环境变量显式传入了 `DASHSCOPE_CODING_API_KEY`，不要假设镜像里会带上 `api.txt`
- 如果生产 compose 起不来，优先检查项目根目录 `.env` 是否存在，且 `DASHSCOPE_CODING_API_KEY` 是否已经填写
- 如果生产入口访问异常，先看 `npm run docker:status:prod`、`npm run docker:health:prod`，再查 `logs/nginx/` 和 `logs/app/app.log`
- 如果开发容器在 Windows 挂载目录下没有及时热更新，优先重启 `docker compose` 开发容器，不要误以为代码没改进去

## Traceability Rule

- 从现在开始，任何影响以下内容的变更，都必须同步更新本文件：
  - 项目架构
  - 运行命令
  - 接口
  - 模型/provider
  - 目录职责
  - 测试状态
  - 当前进度
  - 已知问题
- 如果是小改动，也至少要更新：
  - `Project Snapshot`
  - `Current Progress`
  - `Validation Status`
- 如果是结构性改动，还必须更新：
  - `Current Architecture`
  - `Current File Responsibilities`
  - `Recovery Notes`
- 不要把 `AGENTS.md` 写成空泛口号墙
- 这个文件的职责是让后续接手的人少踩坑，不是装专业

## Change Log

### 2026-04-17

- 初始化项目工作区与 `pi` 项目级资源
- 克隆 `references/pi-mono` 作为参考镜像
- 安装并验证 `pi-coding-agent`
- 建立最小 HTTP API agent
- 接入 `dashscope-coding / glm-5`
- 实现 `GET /healthz`
- 实现 `GET /playground`
- 实现 `POST /v1/chat`
- 实现 conversation 到 session 的持久化映射
- 修复空回复与 provider 错误透传
- 加入 `api.txt` 自动加载 key 的兜底逻辑
- 在 Windows 下覆盖内置 `bash` 工具并启用 `windowsHide`，避免控制台黑框闪现
- 将 agent session 的 skill 加载切换为白名单模式，默认只允许 `.pi/skills`
- 调整 Windows bash spawn 策略，移除 detached 以避免 Node 创建独立控制台窗口
- 增加 `Dockerfile`、`docker-compose.yml`、`.dockerignore`，统一 Windows/macOS 的 Linux 容器运行路径
- 增加 `docker-compose.prod.yml`、`.env.example` 和容器健康检查，补齐生产运行入口
- 增加生产版 Nginx 反代、日志落盘和健康状态查看脚本
- vend `obra/superpowers` 技能库到 `.pi/skills/superpowers/`，将 `using-superpowers` 作为项目可用初始元技能
- 重做 playground 视觉风格为深色极客零圆角
- 将聊天区改为中心聚焦布局
- 将消息区改为内部滚动，输入区固定在底部
- 修复 playground 长消息导致输入操作栏被挤出视窗的问题
- 增加 `POST /v1/chat/stream` 并让 playground 实时展示 agent 执行过程

### 2026-04-18

- 增加项目级 `subagent` 扩展，支持 single / parallel / chain 三种委派模式
- 增加默认 subagent profiles：`scout`、`planner`、`reviewer`、`worker`
- 增加 workflow prompts：`implement`、`scout-and-plan`、`implement-and-review`
- 将 subagent 子进程固定到本地 `pi-coding-agent` CLI 入口，避免依赖全局 `pi`
- 将 subagent 子进程的资源加载收紧到项目认可的 extension 与 skill 路径
- 增加 `runtime/agents-user` 作为用户层 subagent 覆盖目录
- 增加 `test/subagent.test.ts` 覆盖 subagent 发现与子进程参数构造
- 修复用户层 `web-access` 在宿主机 IPC 浏览器桥接无 responder 时只能超时失败的问题
- 增加 `runtime/skills-user/web-access/scripts/local-cdp-browser.mjs`，支持本机 Chrome/Edge CDP 兜底
- 增加 `test/web-access-host-bridge.test.ts` 覆盖 IPC 超时后的本机浏览器 fallback
- 修复开发容器内 `web-access` 无法复用宿主机 Chrome CDP 的问题，改为解析 `host.docker.internal` 的 IPv4 地址并重写 CDP WebSocket URL
- 增加 `test/local-cdp-browser.test.ts` 覆盖 Docker host CDP 探测和 WebSocket URL 重写
- 下载并 bundling `Agave-Regular.ttf`、`Agave-Bold.ttf`，playground 改用 Agave 字体
- 增加 `/assets/fonts/:fileName` 字体资产路由
- 增加 `POST /v1/chat/queue`，playground 运行中发送统一追加为 `followUp`
- 增加 `POST /v1/chat/interrupt`，支持中止 active run 后继续同一会话
- playground 增加运行中追加发送和 `打断` 控件，随后移除 queue mode 下拉以降低 UI 复杂度
- playground 改名为 `UGK Claw`，增加 ASCII 柯基标识，并将可见界面文案中文化
- 增加运行中队列/打断相关 AgentService 与 HTTP 路由测试
- 增加聊天附件输入：`POST /v1/chat`、`POST /v1/chat/stream`、`POST /v1/chat/queue` 支持 JSON `attachments`
- 增加 agent 文件输出协议：assistant 回复 `ugk-file` fenced block 后，后端提取为 `.data/agent/files` 中的下载文件
- 增加 `GET /v1/files/:fileId` 下载路由和 `FileArtifactStore` 文件索引
- playground 增加文件选择/拖放、自动文件意图描述、待发送附件展示和 agent 返回文件下载卡片
- 修复 `.pi` 扩展 TypeScript spawn 类型问题，并补充 `.mjs` 测试声明
- 拆分 `src/routes/assets.ts`，让字体资产路由离开 `src/server.ts`
- 收敛聊天路由错误处理与 agent event 类型守卫
- 清理无用本地残留目录，并强化 `.gitignore` 对敏感/生成文件的排除
- 关闭临时 `3101` 预览口径，默认本地验证入口统一回到 `127.0.0.1:3000`
- 补齐 README 与 AGENTS 的近期功能速记、中文 UI 验证步骤和后续 `/init` 接手说明
