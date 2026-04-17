# ugk-pi Subagent 扩展实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task.

**Goal:** 为当前 `ugk-pi` 自定义 HTTP agent 增加可实际使用的 `subagent` 能力，让主 agent 能把侦察、规划、评审、实现等子任务委派给隔离上下文中的子 agent 执行。

**Architecture:** 采用“项目级 extension + 仓库内 agent profiles + 子进程隔离执行”的方案。主 agent 通过 `.pi/extensions/subagent/` 注册一个 `subagent` 工具，工具内部调用本地 `@mariozechner/pi-coding-agent` CLI 的 JSON 模式启动无会话子进程；子进程仅加载当前项目认可的 extensions/skills，并从仓库内 agent 定义目录读取子 agent 配置。这样既复用 `pi` 官方推荐的扩展方向，又避免把当前 HTTP runtime 改成一锅多会话大乱炖。

**Tech Stack:** Node.js 24、TypeScript、`@mariozechner/pi-coding-agent`、Fastify、Node built-in test (`node:test`)

---

## 方案对比

### 方案 A：直接照搬官方 subagent example

**做法**

- 把 `references/pi-mono` 里的 example 基本原样搬进项目
- 继续依赖 `pi` 全局命令与默认资源发现

**优点**

- 上手快
- 和官方 example 最接近

**缺点**

- 强依赖全局 `pi` 命令，部署环境稍微不一致就容易抽风
- 子进程会继承默认资源发现，容易把全局 skills/extensions 污染进来
- Windows 下不处理 `windowsHide` 又得把黑框幽灵请回来，纯属自找不痛快
- example 自带一大坨 TUI 渲染代码，对当前 HTTP API 场景是过度实现

### 方案 B：基于 SDK 在当前 Node 进程内创建多个隔离 session

**做法**

- 在扩展工具内部直接调用 `createAgentSession()` 创建子 session
- 主进程维护多个 in-memory session

**优点**

- 不依赖额外子进程
- 理论上更好测

**缺点**

- 主进程要自己处理更多运行时隔离细节
- extension、工具、资源白名单要自己重建，复杂度并不低
- 一旦实现不严谨，就会退化成“看似多 agent，实则共享一锅上下文和资源状态”

### 方案 C：项目级 extension + 本地 CLI 子进程 + 仓库内 agent profiles

**做法**

- 新增 `.pi/extensions/subagent/` 扩展
- 工具执行时调用本地依赖中的 `pi` CLI JSON 模式
- 子进程仅加载项目白名单 skills 与必要 extension
- 仓库内用 `.pi/agents/` 提供系统 subagent 定义
- 可选叠加 `runtime/agents-user/` 作为用户层定义目录

**优点**

- 真隔离上下文，不污染主对话
- 贴合 `pi` 官方“subagent 用 extension 自己做”的路线
- 和当前 HTTP agent 架构耦合度低，不需要大改 `AgentService`
- 可以通过 `tool_execution_update` 自然把子 agent 过程流推到现有 SSE/playground
- 资源边界可控，便于把项目规则、skills 白名单、Windows 行为统一起来

**缺点**

- 需要处理子进程命令拼装、JSON 事件解析、超时/中断
- 比“只在进程内 new 几个 session”多一层进程管理成本

## 最终决策

采用 **方案 C**。

原因：

1. 这是最符合 `pi` 官方扩展哲学的实现方式，后续理解成本最低。
2. 对当前仓库侵入最小，不需要重写 `AgentService` 或会话层。
3. 子进程级上下文隔离最靠谱，不会让主对话被侦察、规划、评审这些中间过程塞爆。
4. 可以顺手把当前仓库最敏感的几个坑补平：
   - 不依赖全局 `pi`
   - 不放开全局资源发现
   - Windows 下不弹黑框

## 范围界定

### 本次要做

- 新增项目级 `subagent` 工具，支持：
  - 单 agent 执行
  - 并行执行
  - 链式执行（支持 `{previous}` 占位）
- 新增仓库内默认 agent profiles：
  - `scout`
  - `planner`
  - `reviewer`
  - `worker`
- 新增若干 workflow prompt templates，方便直接触发常用链路
- 补齐测试，至少覆盖 agent 发现与子进程参数构造
- 更新 `README.md` 与 `AGENTS.md`

### 本次不做

- 新增独立数据库或任务队列
- 新增专门的 subagent HTTP 管理接口
- 真正意义上的分布式 worker 池
- 自动重试、排队优先级、资源配额系统

## 目录与职责

```text
.pi/
├─ agents/
│  ├─ scout.md
│  ├─ planner.md
│  ├─ reviewer.md
│  └─ worker.md
├─ extensions/
│  ├─ project-guard.ts
│  └─ subagent/
│     ├─ index.ts
│     └─ agents.ts
└─ prompts/
   ├─ implement.md
   ├─ scout-and-plan.md
   └─ implement-and-review.md

runtime/
└─ agents-user/   # 可选的用户层 subagent 定义目录，缺失时允许为空
```

## 关键设计

### 1. 子进程调用策略

子 agent 不依赖全局 `pi` 命令，而是优先解析本地依赖里的 CLI 入口，再用 `process.execPath` 启动：

```text
node <local pi cli> --mode json -p --no-session ...
```

这样开发容器、生产容器、`npm start` 与本地裸跑的行为更一致，不会出现“你电脑能跑，容器里直接死”的低级笑话。

### 2. 资源白名单策略

子 agent 只加载我们认可的资源：

- extensions：
  - 仅显式加载 `.pi/extensions/project-guard.ts`
- skills：
  - `.pi/skills`
  - `runtime/skills-user`
- context files：
  - 允许默认 `AGENTS.md` 加载

这样可以保持主 agent 与子 agent 的行为边界一致，避免子 agent 神不知鬼不觉把用户全局环境里的奇怪资源吞进来。

### 3. agent profile 发现策略

默认发现目录：

- 系统层：`.pi/agents`
- 用户层：`runtime/agents-user`

命名冲突时用户层覆盖系统层。原因很简单：项目给默认档，用户需要时可在 runtime 层热补充或覆盖，和当前 skill 分层逻辑保持一致。

### 4. 单/并行/链式模式

工具参数统一支持 3 种模式：

- 单次：
  - `{ agent, task, cwd? }`
- 并行：
  - `{ tasks: [{ agent, task, cwd? }, ...] }`
- 链式：
  - `{ chain: [{ agent, task, cwd? }, ...] }`

链式模式支持用 `{previous}` 注入上一步最终文本结果。

### 5. 输出与流式更新

子进程 stdout 走 JSONL 事件流，扩展解析：

- `message_end`
- `tool_result_end`

并把中间进度通过 `onUpdate()` 回传给主 agent。主仓库现有 `/v1/chat/stream` 已经会转发 `tool_execution_update`，所以 playground 无需大改就能看到 subagent 过程。

### 6. 默认 agent profiles

- `scout`
  - 只负责快速摸清文件、类型、入口和调用关系
- `planner`
  - 只负责出计划，不允许修改
- `reviewer`
  - 只读审查，bash 限制为只读命令
- `worker`
  - 泛用执行

默认不强绑具体模型 ID，优先复用项目当前默认 provider/model，避免把示例里的 Claude 型号硬塞进一个实际跑 `glm-5` 的仓库里。

## Fix Impact Analysis

### 1. 直接影响分析

- 不修改现有 `/v1/chat` 与 `/v1/chat/stream` 协议
- 不改 `AgentService` 的参数签名
- 主要新增扩展资源与 prompt/agent 定义，对主服务入口侵入极小

### 2. 间接影响分析

- 主 agent 将新增一个扩展工具 `subagent`
- 子 agent 会额外消耗模型请求配额与运行时成本
- 现有 SSE 过程流会出现更多 `tool_started/tool_updated/tool_finished` 事件，但事件结构无需修改

### 3. 数据结构兼容性

- 新增 `.pi/agents` 与可选 `runtime/agents-user` 目录，不影响旧逻辑
- 若后续 agent frontmatter 扩展字段，读取端必须允许缺省
- 冲突覆盖按“用户层优先”处理，避免系统默认把用户自定义吞掉

## 实施任务

### Task 1: 先补测试，锁定发现逻辑和 CLI 参数

**Files:**
- Create: `test/subagent.test.ts`
- Read: `.pi/extensions/project-guard.ts`
- Read: `src/agent/agent-session-factory.ts`

**Steps:**

1. 写 failing test，验证 agent 目录发现、frontmatter 解析和覆盖顺序。
2. 写 failing test，验证子进程参数里包含：
   - `--mode json`
   - `-p`
   - `--no-session`
   - `--no-extensions`
   - `-e .pi/extensions/project-guard.ts`
   - `--no-skills`
   - 两个 skill 目录
3. 跑测试确认先红。

### Task 2: 实现 subagent 发现与命令构造辅助模块

**Files:**
- Create: `.pi/extensions/subagent/agents.ts`
- Create: `.pi/extensions/subagent/index.ts`

**Steps:**

1. 实现 agent 定义发现和 frontmatter 解析。
2. 实现本地 CLI 解析与 spawn 参数构造。
3. 实现 JSONL 事件解析与结果聚合。
4. 跑测试直到转绿。

### Task 3: 注册 subagent 工具并支持三种执行模式

**Files:**
- Modify: `.pi/extensions/subagent/index.ts`

**Steps:**

1. 注册 `subagent` 工具 schema。
2. 实现 single / parallel / chain 三种模式。
3. 接好 `AbortSignal` 与 `onUpdate()`。
4. 保持返回结果可读，失败时抛出明确错误。

### Task 4: 加默认 agent profiles 与 workflow prompts

**Files:**
- Create: `.pi/agents/scout.md`
- Create: `.pi/agents/planner.md`
- Create: `.pi/agents/reviewer.md`
- Create: `.pi/agents/worker.md`
- Create: `.pi/prompts/implement.md`
- Create: `.pi/prompts/scout-and-plan.md`
- Create: `.pi/prompts/implement-and-review.md`

**Steps:**

1. 写默认 agent 定义，明确各自职责与输出格式。
2. 写工作流 prompt，方便直接触发链式 subagent。
3. 保持语言与当前项目约束一致，不要照搬官方示例里的模型硬编码。

### Task 5: 文档、追踪与验证

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

**Steps:**

1. 更新 README，说明 subagent 的能力、目录和使用方式。
2. 更新 AGENTS.md 的 snapshot / progress / architecture / responsibilities / validation / recovery。
3. 运行相关测试，必要时补充一次本地验证。

## 验证口径

至少执行：

```bash
npm run test
```

如果需要定点回归：

```bash
node --test --import tsx test/subagent.test.ts
```

手动验证建议：

1. 启动服务：`npm run dev`
2. 打开 `http://127.0.0.1:3000/playground`
3. 发送类似：
   - `请用 subagent 的 scout 找出当前项目里和 session 复用相关的核心文件`
4. 确认右侧过程面板能看到 `subagent` 工具的开始、更新与完成事件

## 关键假设

1. 当前依赖中的 `@mariozechner/pi-coding-agent` CLI 可通过本地包入口启动。
2. 子 agent 继续复用当前项目 provider/model 配置即可，无需另建 provider 层。
3. 当前阶段不需要把 subagent 结果单独持久化成数据库记录。
