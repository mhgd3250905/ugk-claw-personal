# ugk-pi

基于 `pi-coding-agent` 的项目工作区。

当前目录先完成了最小初始化，目标是把 `pi` 的项目级配置、代理协作约束和参考资料基线先立住，后续再按具体业务需求继续扩展。

## 新 Agent 快速接手

如果是新 agent 第一次进仓库，别上来就全盘扫描，那是典型无效勤奋。推荐最短上手顺序：

1. 读 `AGENTS.md`
2. 读本文件 `README.md`
3. 看 `src/server.ts`
4. 看 `src/routes/chat.ts`
5. 看 `src/agent/agent-service.ts`
6. 看 `src/agent/agent-session-factory.ts`
7. 看 `src/ui/playground.ts`

先记住这几个结论：

- 这不是完整产品，而是基于 `pi-coding-agent` 的自定义 HTTP agent 原型
- 当前重点是 runtime、会话、技能系统、HTTP 接口和 playground
- skill 分成两层：
  - 系统技能：`.pi/skills`
  - 用户技能：`runtime/skills-user`
- 判断“当前到底加载了哪些技能”，以 `GET /v1/debug/skills` 为准，不要信模型自己编的名单
- 开发阶段优先使用开发容器，生产容器只用于部署验证

## 参考基线

- 官方仓库：`https://github.com/badlogic/pi-mono`
- 本地参考镜像：`references/pi-mono`
- 当前参考提交：`32a305c`
- 项目约定：后续所有方法实现，优先参考 `references/pi-mono/` 里的官方案例、官方文档和官方测试，再决定项目内实现方式
- 重点文档：
  - `references/pi-mono/packages/coding-agent/README.md`
  - `references/pi-mono/packages/coding-agent/docs/settings.md`
  - `references/pi-mono/AGENTS.md`

## 当前目录结构

```text
ugk-pi/
├─ .codex/plans/
├─ .data/
├─ .pi/
│  ├─ agents/
│  ├─ settings.json
│  ├─ prompts/
│  ├─ skills/
│  └─ extensions/
├─ public/
│  └─ fonts/
├─ runtime/
│  ├─ pi-agent/
│  ├─ skills-user/
│  └─ agents-user/
├─ references/pi-mono/
├─ AGENTS.md
└─ README.md
```

## 使用 `pi`

官方安装方式：

```bash
npm install -g @mariozechner/pi-coding-agent
```

当前机器已完成安装，验证版本：

```bash
pi --version
# 0.67.6
```

启动方式：

```bash
pi
```

认证方式二选一：

1. 设置 API Key 后直接启动
2. 启动后执行 `/login`

## 约束

- `references/pi-mono/` 是参考镜像，不是业务源码目录。
- 如果后续要补项目专用能力，优先放到：
  - `.pi/prompts/`
  - `.pi/skills/`
  - `.pi/extensions/`
- 真正业务代码目录和技术栈还没定，不要现在就乱塞模板文件。

## 已初始化的项目资源

- Prompt Template:
  - `.pi/prompts/feature-bootstrap.md`
  - `.pi/prompts/implement.md`
  - `.pi/prompts/scout-and-plan.md`
  - `.pi/prompts/implement-and-review.md`
- Skill:
  - `.pi/skills/project-planning/SKILL.md`
- Vendored Skills Bundle:
  - `.pi/skills/superpowers/`
  - 来源：`https://github.com/obra/superpowers`
  - 初始元技能：`using-superpowers`
- Subagent Profiles:
  - `.pi/agents/`
  - 当前内置：`scout`、`planner`、`reviewer`、`worker`
- User Skills Directory:
  - `runtime/skills-user/`
  - 这里是用户后装 skill 的持久目录
- Project Agent Directory:
  - `runtime/pi-agent/`
  - 项目内官方 `pi` agent 配置目录
  - 当前托管 checked-in 的 `models.json`
- User Subagent Directory:
  - `runtime/agents-user/`
  - 这里是用户后装或覆盖 subagent profile 的持久目录
- Extension:
  - `.pi/extensions/project-guard.ts`
  - `.pi/extensions/subagent/`
    - 项目级 `subagent` 工具
    - 通过本地 `pi-coding-agent` CLI 子进程执行隔离上下文的子 agent

进入 `pi` 后建议先用：

```bash
/reload
```

然后可直接使用：

```bash
/feature-bootstrap <功能目标>
/skill:project-planning <任务或目标>
/skill:using-superpowers
/implement <实现目标>
/scout-and-plan <调研或方案目标>
/implement-and-review <实现并审查目标>
```

## Subagent 能力

当前仓库已经补上了 `pi` 核心默认没有内建的 `subagent` 能力，但不是靠魔改内核，而是按 `pi` 官方推荐路线，用项目级 extension 做的。

核心特点：

- 主 agent 可以调用 `subagent` 工具，把任务委派给隔离上下文里的子 agent
- 子 agent 通过本地依赖里的 `pi` CLI JSON 模式启动，不依赖系统全局 `pi`
- 子 agent 默认只加载项目认可的资源：
  - `.pi/extensions/project-guard.ts`
  - `.pi/skills`
  - `runtime/skills-user`
- 默认 subagent 定义目录：
  - 系统层：`.pi/agents`
  - 用户层：`runtime/agents-user`
  - 同名时用户层覆盖系统层
- 支持三种模式：
  - 单次：一个 agent 执行一个任务
  - 并行：多个 agent 并行处理多个任务
  - 链式：多个 agent 顺序执行，后一步可用 `{previous}` 接上一步输出

默认 agent：

- `scout`：侦察代码、调用链、测试和风险
- `planner`：只读出计划
- `reviewer`：只读评审，优先找 bug 和回归
- `worker`：执行实现

如果你直接用 `pi` 终端，也可以通过 prompt templates 触发：

```bash
/implement 给当前 HTTP agent 增加一个新的 debug 接口
/scout-and-plan 梳理 subagent 的调用链和风险点
/implement-and-review 优化 playground 的流式过程展示
```

## 自定义 HTTP API Agent

当前项目已经有一个最小可运行的 HTTP API agent 骨架，底层复用 `pi-coding-agent` 的 session、资源加载和项目级 `.pi/` 资源。

现在除了同步聊天接口，还提供了一个流式过程接口，`playground` 会把 agent 的工具调用、文本增量和完成事件实时滚动展示出来。运行中的任务支持两种插入消息方式：`steer` 会打断/转向当前执行，`followUp` 会排到当前轮次之后继续执行。也支持显式 `interrupt`，用于像 Codex 一样中止当前 run，随后继续沿用同一 `conversationId` 发消息。

`playground` 的聊天气泡已经支持安全 Markdown 渲染，覆盖标题、列表、引用、粗斜体、链接、行内代码和代码块。代码块会显示语言标签并提供复制按钮；HTML 会先转义，避免把 agent 输出当成页面脚本执行。

`playground` 当前使用 bundled Agave 字体，字体文件来自 `https://github.com/blobject/agave` 的 `dist` 产物，并通过 `/assets/fonts/:fileName` 对外提供。字体资产放在 `public/fonts/`，别又把它塞进 CDN 或运行时下载，离线本地测试会直接翻车。

最近一次前端修复也记录在这里：Markdown 渲染函数会被服务端注入到浏览器脚本里，注入前会剥离 `tsx`/esbuild 生成的 `__name()` helper。否则浏览器会报 `ReferenceError: __name is not defined`，页面初始化失败后 `Send` 按钮看起来就像没反应。这个坑很隐蔽，属于“按钮背锅，脚本先死”的经典冤案。

### 启动

安装依赖：

```bash
npm install
```

启动服务：

```bash
npm start
```

默认监听：

```text
http://127.0.0.1:3000
```

### 推荐运行方式

建议把运行口径统一成下面这样：

- Windows：使用 Docker Desktop 跑 Linux 容器
- macOS：使用 Docker Desktop 跑 Linux 容器
- Linux：优先跑容器，直接 `npm start` 只作为兼容调试方式

原因很现实：

- 可以统一成 Linux runtime，避免 Windows 壳子和编码差异反复作妖
- `bash` 行为更稳定，不容易再踩 `C:\\Windows\\System32\\bash.exe` 这种坑
- 本地和部署环境更接近，排障不至于三套口径互相甩锅

### Docker 运行

当前仓库已经自带下面这些容器工件：

- `Dockerfile`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `.dockerignore`
- `.env.example`
- `deploy/nginx/default.conf`

先确认本机已安装 Docker：

```bash
docker --version
docker compose version
```

#### Windows / macOS 本地开发

推荐直接用 compose：

```bash
npm run docker:up
```

等价命令：

```bash
docker compose up --build
```

启动后访问：

```text
http://127.0.0.1:3000
http://127.0.0.1:3000/playground
```

停止：

```bash
npm run docker:down
```

compose 当前走的是开发模式：

- 端口映射：`3000:3000`
- 容器内监听：`HOST=0.0.0.0`
- 挂载当前目录到 `/app`
- 启动命令：`npm run dev`

#### 单独构建镜像

```bash
npm run docker:build
```

等价命令：

```bash
docker build -t ugk-pi:local .
```

#### 生产版 compose

先准备环境变量文件：

```bash
cp .env.example .env
```

然后至少填写：

```text
DASHSCOPE_CODING_API_KEY=你的真实 key
```

启动生产版 compose：

```bash
npm run docker:up:prod
```

停止：

```bash
npm run docker:down:prod
```

生产版 compose 当前特征：

- Nginx 作为外层反向代理，转发到应用容器
- 启动命令：`npm start`
- 不挂载源码目录
- 应用日志落盘到 `logs/app/app.log`
- Nginx 日志落盘到 `logs/nginx/`
- `restart: unless-stopped`
- 自带容器健康检查
- 通过 `.env` 注入运行参数

也可以直接验证最终配置：

```bash
docker compose -f docker-compose.prod.yml config
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

#### 直接运行容器

```bash
docker run --rm -p 3000:3000 -e HOST=0.0.0.0 -e PORT=3000 ugk-pi:local
```

### Linux 兼容运行

Linux 上仍然可以直接运行：

```bash
npm install
npm start
```

但推荐口径依然是容器优先，裸跑只作为临时调试或受控环境下的兼容方式。

测试界面：

```text
http://127.0.0.1:3000/playground
```

也可以通过环境变量覆盖：

```bash
HOST=127.0.0.1
PORT=3000
```

容器场景要改成：

```bash
HOST=0.0.0.0
PORT=3000
```

### 容器里的认证说明

`.dockerignore` 当前不会把 `api.txt` 打进镜像，所以生产式容器运行不要指望镜像内自带明文 key。

建议方式：

1. 本地开发时通过 bind mount 使用当前工作区文件
2. 正式运行时通过环境变量注入 `DASHSCOPE_CODING_API_KEY`

推荐做法：

- 开发：`docker-compose.yml`
- 生产或准生产：`docker-compose.prod.yml` + `.env`
- 对外入口：Nginx
- 应用容器只暴露给 compose 内部网络
- 系统技能：`.pi/skills`
- 用户技能：`runtime/skills-user`

例如：

```bash
docker run --rm -p 3000:3000 ^
  -e HOST=0.0.0.0 ^
  -e PORT=3000 ^
  -e DASHSCOPE_CODING_API_KEY=your-key ^
  ugk-pi:local
```

`.env.example` 当前包含这些基础变量：

```text
DASHSCOPE_CODING_API_KEY=replace-me
HOST=0.0.0.0
PORT=3000
HOST_PORT=3000
```

### 健康检查

镜像已经内置 `HEALTHCHECK`，会定期请求：

```text
http://127.0.0.1:3000/healthz
```

返回 `{"ok":true}` 视为健康。

生产 compose 还有两层健康状态：

- 应用容器：检查 `http://127.0.0.1:3000/healthz`
- Nginx 容器：检查 `http://127.0.0.1/healthz`

### 日志落盘

生产版 compose 默认会把日志写到宿主机：

```text
logs/app/app.log
logs/nginx/access.log
logs/nginx/error.log
```

如果日志目录还不存在，compose 在首次启动时会自动创建。

### 技能目录分层

当前项目的 skill 现在分成两层：

- 系统技能：`.pi/skills`
  - 这里放出厂固定技能，例如 `superpowers`
- 用户技能：`runtime/skills-user`
  - 这里放用户后续安装的新 skill

服务每次处理消息时都会重新创建 session 包装并重新扫描这两个 skill 目录，所以：

- 装进 `runtime/skills-user` 的 skill
- 不需要重启 Docker
- 下一条消息或新对话就能用

这点和“重新构建镜像才有的新系统技能”不一样，别混了。

如果想确认运行时真实结果，直接请求：

```bash
curl http://127.0.0.1:3000/v1/debug/skills
```

不要再问模型“你有哪些技能”然后把它胡诌的内容当真，那是给自己找罪受。

### Subagent 目录分层

当前项目的 subagent 定义也分成两层：

- 系统 subagent：`.pi/agents`
- 用户 subagent：`runtime/agents-user`

`subagent` 工具每次执行时都会重新扫描这两个目录，所以：

- 新增或覆盖 `runtime/agents-user` 下的 agent 定义
- 不需要重启 Docker
- 下一次调用 `subagent` 就应生效

别把 subagent 定义塞进全局用户目录后再骂项目“怎么没反应”，那不是项目失灵，是你自己把东西放错了。

### 接口

健康检查：

```bash
curl http://127.0.0.1:3000/healthz
```

返回：

```json
{"ok":true}
```

测试页面：

```bash
curl http://127.0.0.1:3000/playground
```

浏览器手动验证：

1. 打开 `http://127.0.0.1:3000/playground`
2. 输入一条短消息，例如 `测试 Send 是否正常，请只回复 OK。`
3. 点击 `send`
4. 运行中可选择 `interrupt / steer` 或 `wait / follow-up` 后继续输入消息，按钮会显示 `queue`
5. 点击 `interrupt` 可中止当前 run，随后继续用同一 conversation 发新消息
6. 确认右侧出现 `REQUEST QUEUED`、`RUN STARTED`、`QUEUE UPDATED`、`RUN COMPLETE` 或 `RUN INTERRUPTED`
7. 确认字体为 Agave，网络里可看到 `/assets/fonts/Agave-Regular.ttf`
8. 确认网络里 `POST /v1/chat/stream` 返回 `200`
9. 确认左侧 agent 回复出现 `OK`

聊天接口：

```bash
curl -X POST http://127.0.0.1:3000/v1/chat ^
  -H "content-type: application/json" ^
  -d "{\"conversationId\":\"manual:test-1\",\"message\":\"你好，介绍一下当前项目\",\"userId\":\"u-001\"}"
```

返回示例：

```json
{
  "conversationId": "manual:test-1",
  "text": "……agent 回复……",
  "sessionFile": "E:\\AII\\ugk-pi\\.data\\agent\\sessions\\xxxx.jsonl"
}
```

流式聊天接口：

```bash
curl -N -X POST http://127.0.0.1:3000/v1/chat/stream ^
  -H "content-type: application/json" ^
  -d "{\"conversationId\":\"manual:test-stream-1\",\"message\":\"请先读 README 再简短回答\",\"userId\":\"u-002\"}"
```

返回示例：

```text
data: {"type":"run_started","conversationId":"manual:test-stream-1"}

data: {"type":"tool_started","toolCallId":"...","toolName":"read","args":"{\"path\":\"README.md\"}"}

data: {"type":"text_delta","textDelta":"stream ok"}

data: {"type":"done","conversationId":"manual:test-stream-1","text":"stream ok","sessionFile":"E:\\AII\\ugk-pi\\.data\\agent\\sessions\\xxxx.jsonl"}
```

运行中插入消息：

```bash
curl -X POST http://127.0.0.1:3000/v1/chat/queue ^
  -H "content-type: application/json" ^
  -d "{\"conversationId\":\"manual:test-stream-1\",\"message\":\"补充：先停止当前方向，改查 README\",\"mode\":\"steer\",\"userId\":\"u-002\"}"
```

`mode` 可选：

- `steer`：打断/转向当前运行中的 agent，相当于运行中插嘴纠偏
- `followUp`：排队到当前轮次之后，相当于“等你说完再接着做”

返回示例：

```json
{
  "conversationId": "manual:test-stream-1",
  "mode": "steer",
  "queued": true
}
```

打断当前运行：

```bash
curl -X POST http://127.0.0.1:3000/v1/chat/interrupt ^
  -H "content-type: application/json" ^
  -d "{\"conversationId\":\"manual:test-stream-1\"}"
```

返回示例：

```json
{
  "conversationId": "manual:test-stream-1",
  "interrupted": true
}
```

### 会话模型

- 外部 `conversationId` 会映射到本地 `pi` session 文件
- 映射文件位于：`.data/agent/conversation-index.json`
- session 文件位于：`.data/agent/sessions/`
- 这层映射是为后续接飞书、Slack、企业微信等 IM 预留的，不要直接拿“最近一次 session”这种偷懒逻辑糊弄

### 认证方式

服务端 agent 复用 `pi-coding-agent` 的认证机制，常见方式有两种：

1. 提前配置 API Key，例如 `ANTHROPIC_API_KEY`、`OPENAI_API_KEY`
2. 使用已有的 `pi` 认证信息

如果没有可用认证，`/v1/chat` 会在 agent 初始化阶段报错。

同理，`/v1/chat/stream` 也会在流里输出错误事件，而不是凭空成功。

### 当前 provider 配置

当前已经按 `pi` 官方支持方式把自定义 provider 固定进项目内 `models.json`：

- provider: `dashscope-coding`
- model: `glm-5`
- base URL: `https://coding.dashscope.aliyuncs.com/v1`

项目内 provider 定义位于：

- `runtime/pi-agent/models.json`

项目默认配置位于：

- `.pi/settings.json`

注意：

- 这套配置走的是 API Key 模式，不是 `/login` 的 OAuth 流程
- 主服务会显式用项目内 `runtime/pi-agent/models.json` 创建 `ModelRegistry`
- `subagent` 子进程会通过 `PI_CODING_AGENT_DIR=runtime/pi-agent` 继承同一份官方配置
- API key 仍然通过环境变量 `DASHSCOPE_CODING_API_KEY` 或 `api.txt` 注入，不会写进仓库

直接验证 `pi`：

```bash
pi --list-models glm-5
pi -p "Reply with exactly PROJECT_DEFAULT_OK"
```

### 当前实现边界

已完成：

- `GET /healthz`
- `GET /assets/fonts/:fileName`
- `POST /v1/chat`
- `POST /v1/chat/stream`
- `POST /v1/chat/queue`
- `POST /v1/chat/interrupt`
- `GET /playground` 实时展示 agent 过程流
- playground 使用 bundled Agave 字体
- playground 运行中支持 `steer` 插嘴、`followUp` 排队和 `interrupt` 打断
- playground transcript 安全 Markdown 渲染
- playground 代码块语言标签与复制按钮
- playground `Send` 无响应的 `__name()` helper 回归修复
- 字体资产路由已拆到 `src/routes/assets.ts`，`src/server.ts` 只负责服务装配
- 聊天路由错误响应已收敛，agent 运行时事件处理改为类型守卫
- conversation 到 session 的持久化映射
- 复用项目级 `AGENTS.md`、`.pi/settings.json`、prompts、skills、extensions
- 项目级 `subagent` 工具
- 默认 subagent profiles：`scout`、`planner`、`reviewer`、`worker`
- workflow prompts：`/implement`、`/scout-and-plan`、`/implement-and-review`

当前回归测试：

```bash
npx tsc --noEmit
npm run test
```

最近验证结果：`npx tsc --noEmit` 通过，`npm run test` 为 `49 / 49` 通过；临时服务 `127.0.0.1:3101` 已验证 `/healthz`、Agave 字体资产和 playground HTML。

暂未完成：

- 飞书 / Slack / 企业微信 webhook 适配
- 多租户鉴权
- 数据库存储
- 分布式或队列化的高级 runtime 编排

## 下一步

推荐顺序：

1. 明确这个项目要做什么业务
2. 确认技术栈和源码目录
3. 再补具体的脚手架、依赖和开发命令
