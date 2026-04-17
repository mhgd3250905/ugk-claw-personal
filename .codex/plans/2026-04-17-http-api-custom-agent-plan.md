# 自定义 HTTP API Agent 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task.

**Goal:** 构建一个“属于 ugk-pi 自己”的 HTTP API Agent，底层复用 `pi-coding-agent` 的认证、模型、session、工具和资源加载能力，并为后续接入飞书等 IM 平台预留清晰适配层。

**Architecture:** 采用三层结构：`HTTP API` 负责接收标准请求，`Agent Core` 负责封装 `pi-coding-agent` session 与资源装配，`Conversation Store` 负责把外部 `conversationId` 映射到本地 session 文件。第一版只做同步 JSON 响应，不做流式输出和 IM webhook，避免一开始把简单事情搞成大型返工现场。

**Tech Stack:** Node.js 24、TypeScript、Fastify、`@mariozechner/pi-coding-agent`、`tsx`、Node built-in test (`node:test`)

---

## 方案对比

### 方案 A：薄封装 `createAgentSession()`，HTTP 直接调默认 session

**做法**

- HTTP 路由收到消息后直接创建 `pi` session
- 复用默认资源发现和默认工具
- 不单独设计 conversation 映射

**优点**

- 最快跑起来
- 代码量最少

**缺点**

- 外部 `conversationId` 无法稳定映射到持久 session
- 后续接 IM 时会发现会话边界、恢复逻辑、审计信息全是补丁
- “这是我的 agent” 这一层不够明确，容易退化成“把 pi SDK 硬塞进 HTTP”

### 方案 B：自定义 Agent Core + Conversation Store + HTTP API

**做法**

- 用 `pi-coding-agent` SDK 封装自己的 `AgentService`
- 独立管理 `conversationId -> sessionFile` 映射
- 仍然复用项目 `.pi/`、`AGENTS.md`、skills、prompts、extensions
- HTTP API 只暴露统一接口，不感知 `pi` 内部细节

**优点**

- 最符合“做自己的 agent，但复用 pi 基础设施”
- 后续接飞书/Slack/企业微信时，适配层只需要转换消息格式
- session、工具、资源、鉴权边界清晰

**缺点**

- 比方案 A 多一层封装
- 需要先把会话映射和错误模型设计清楚

### 方案 C：直接上 `AgentSessionRuntime`，一开始就做完整多会话运行时

**做法**

- 第一版直接围绕 `createAgentSessionRuntime()` 搭运行时
- 预留 session 切换、fork、resume 等高级控制

**优点**

- 理论上最完整
- 后面做复杂多会话调度时上限高

**缺点**

- 第一版过度设计
- 当前目标只是“先跑起一个基本自定义 agent”，上来就做 runtime 编排纯属给未来的自己埋地雷

## 推荐方案

推荐采用 **方案 B**。

原因很直接：

1. 用户目标不是“把 pi CLI 换个壳”，而是“做自己的 agent”。
2. 后续明确会接 IM，因此必须尽早把 `conversationId` 和 `pi session` 的映射独立出来。
3. 第一版仍需保持最小可行，不应该一开始就堆完整 runtime 编排。

## 第一版范围

### 要做

- 一个本地可启动的 HTTP 服务
- 一个基础健康检查接口
- 一个同步聊天接口
- 会话映射层：外部 `conversationId` 对应本地 session
- 基于 `pi-coding-agent` 的 agent 封装层
- 项目级资源复用：`AGENTS.md`、`.pi/settings.json`、`.pi/prompts/`、`.pi/skills/`、`.pi/extensions/`
- 可测试的抽象边界，确保测试时不触发真实 LLM API

### 不做

- 飞书 webhook
- Slack / 企业微信适配
- 流式 SSE/WebSocket 输出
- 多租户鉴权
- 数据库持久化
- 高级任务编排、sub-agent、plan mode runtime

## 目标目录建议

```text
ugk-pi/
├─ src/
│  ├─ server.ts
│  ├─ config.ts
│  ├─ routes/
│  │  └─ chat.ts
│  ├─ agent/
│  │  ├─ agent-service.ts
│  │  ├─ agent-session-factory.ts
│  │  └─ conversation-store.ts
│  └─ types/
│     └─ api.ts
├─ test/
│  ├─ conversation-store.test.ts
│  ├─ agent-service.test.ts
│  └─ server.test.ts
├─ .data/
│  └─ agent/
│     ├─ sessions/
│     └─ conversation-index.json
├─ package.json
└─ tsconfig.json
```

## 关键设计

### 1. Agent Core

`AgentService` 对外提供统一方法，例如：

```ts
chat(input: {
  conversationId?: string;
  message: string;
  userId?: string;
}): Promise<{
  conversationId: string;
  text: string;
  sessionFile?: string;
}>
```

内部职责：

- 根据 `conversationId` 找到或创建 session
- 调用 `createAgentSession()`
- 订阅 `message_update` 聚合文本输出
- 将 session 文件信息回写到 conversation store

### 2. Conversation Store

单独保存外部会话映射，例如：

```json
{
  "feishu:chat-123": {
    "sessionFile": ".data/agent/sessions/2026-04-17_xxx.jsonl",
    "updatedAt": "2026-04-17T10:00:00.000Z"
  }
}
```

这样以后接不同 IM 时，可以使用统一的外部 ID 规范：

- `feishu:<chat_id>`
- `slack:<channel_or_thread_id>`
- `manual:<conversation_id>`

### 3. Session 策略

第一版采用“外部 conversation 映射到本地 session 文件”的方式：

- 新会话：创建新的 persistent session
- 已有会话：`SessionManager.open(sessionFile)`
- 不依赖 `continueRecent()` 这种对 CLI 友好、对服务端不够稳定的方式

### 4. 资源装配策略

第一版优先使用项目现有资源发现机制：

- `cwd` 指向项目根目录
- 保留 `AGENTS.md` 自动加载
- 复用 `.pi/settings.json`
- 复用 `.pi/prompts/`、`.pi/skills/`、`.pi/extensions/`

这能保证：

- 你自己的 agent 和 `pi` 交互模式共享同一套项目规则
- 后续调 prompt/skill/extension 不需要改 HTTP 服务代码

### 5. API 设计

第一版接口建议：

#### `GET /healthz`

返回：

```json
{ "ok": true }
```

#### `POST /v1/chat`

请求：

```json
{
  "conversationId": "manual:test-1",
  "message": "你好，介绍一下当前项目",
  "userId": "u-001"
}
```

响应：

```json
{
  "conversationId": "manual:test-1",
  "text": "……agent 回复……",
  "sessionFile": "E:\\AII\\ugk-pi\\.data\\agent\\sessions\\xxx.jsonl"
}
```

## 错误处理

至少区分这几类错误：

1. 请求参数错误
2. agent 初始化错误
3. 模型/认证错误
4. session 文件损坏或映射失效
5. 内部未捕获异常

HTTP 层不要把 `pi` 内部对象原样甩给客户端，否则后面日志、调试和错误恢复都会恶心。

## 测试策略

测试时不调用真实模型。

关键原则：

- `AgentService` 依赖一个可替换的 session factory
- 测试里用 fake session / stub 输出模拟 `pi` 回答
- HTTP 层用 `fastify.inject()` 做接口测试

至少覆盖：

1. 新会话创建
2. 已有会话恢复
3. 输出文本正确聚合
4. `conversationId` 映射持久化
5. 参数错误和内部错误返回码

## Fix Impact Analysis

### 1. 直接影响分析

- 新增的是独立 HTTP 服务和 agent 封装，不改现有业务逻辑
- 项目当前尚无业务源码，因此签名兼容风险极低
- 唯一共享边界是项目级 `.pi/` 资源，会影响 HTTP agent 和 `pi` CLI 的共同表现

### 2. 间接影响分析

- `.pi/extensions/` 中的扩展会被 HTTP agent 复用
- 若扩展含交互式 UI 假设，可能在服务端环境下表现异常
- 因此第一版应验证现有 `project-guard.ts` 在无 UI 场景下不会阻塞正常请求

### 3. 数据结构兼容性

- 新增 `conversation-index.json` 时，必须允许空文件或不存在文件自动初始化
- 若未来为映射结构新增字段，读取端必须提供默认值
- `conversationId` 一律按 string 处理，不做 number 自动转换，避免 IM 平台 ID 精度翻车

## 实施任务

### Task 1: 初始化 Node/TypeScript 服务骨架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/server.ts`
- Create: `src/config.ts`

**Steps:**

1. 创建 `package.json`，定义 `dev`、`start`、`test` 脚本
2. 安装运行时依赖：`fastify`、`@mariozechner/pi-coding-agent`
3. 安装开发依赖：`typescript`、`tsx`、`@types/node`
4. 编写最小 `tsconfig.json`
5. 启动一个空 Fastify 服务并暴露 `/healthz`

**Verification:**

- Run: `npm run test`
- Run: `npx tsx src/server.ts`
- Expected: 服务正常启动，`GET /healthz` 返回 200

### Task 2: 实现 Conversation Store

**Files:**
- Create: `src/agent/conversation-store.ts`
- Test: `test/conversation-store.test.ts`

**Steps:**

1. 先写 failing test，覆盖创建、读取、更新 conversation 映射
2. 实现 JSON 文件读写与目录初始化
3. 处理空文件、文件不存在、非法 JSON 的兜底逻辑
4. 跑测试直到通过

**Verification:**

- Run: `node --test --import tsx test/conversation-store.test.ts`
- Expected: PASS

### Task 3: 实现 Agent Session Factory 与 Agent Service

**Files:**
- Create: `src/agent/agent-session-factory.ts`
- Create: `src/agent/agent-service.ts`
- Test: `test/agent-service.test.ts`

**Steps:**

1. 先写 failing test，验证：
   - 新会话会创建 session
   - 已有 conversation 会复用 session
   - agent 文本能被聚合返回
2. 为 `AgentService` 定义可替换的 session factory 接口
3. 在生产实现中接入 `createAgentSession()` + `SessionManager.create/open()`
4. 让服务复用项目级 `.pi` 和 `AGENTS.md`
5. 跑测试直到通过

**Verification:**

- Run: `node --test --import tsx test/agent-service.test.ts`
- Expected: PASS

### Task 4: 实现 HTTP API 路由

**Files:**
- Create: `src/routes/chat.ts`
- Create: `src/types/api.ts`
- Modify: `src/server.ts`
- Test: `test/server.test.ts`

**Steps:**

1. 先写 failing test，覆盖：
   - `GET /healthz`
   - `POST /v1/chat` 成功响应
   - 缺少 message 的 400
   - 内部异常的 500
2. 使用 `fastify.inject()` 写接口测试
3. 实现路由与统一错误返回
4. 跑测试直到通过

**Verification:**

- Run: `node --test --import tsx test/server.test.ts`
- Expected: PASS

### Task 5: 文档与手动验证

**Files:**
- Modify: `README.md`

**Steps:**

1. 记录安装、启动、调用示例
2. 说明环境变量与认证方式
3. 说明 `conversationId` 的意义及 IM 适配建议
4. 手动调用一次本地接口验证完整链路

**Verification:**

- Run: `npx tsx src/server.ts`
- Run: `curl http://127.0.0.1:3000/healthz`
- Run: `curl -X POST http://127.0.0.1:3000/v1/chat -H "content-type: application/json" -d "{\"conversationId\":\"manual:test-1\",\"message\":\"你好\"}"`
- Expected: 返回健康状态和 agent 文本响应

## 关键假设

1. 第一版只需要单实例本地运行，不考虑多进程共享锁竞争。
2. 第一版可以接受同步响应，不要求流式输出。
3. 模型认证先使用环境变量或已有 `pi` 认证方式，不引入新的鉴权后台。
4. 当前项目接受使用 Node.js + TypeScript 作为服务端技术栈。

## 执行建议

执行顺序建议严格按上面 5 个任务推进，不要跳步。

尤其不要一上来就：

- 直接接飞书
- 直接做 WebSocket/SSE
- 直接做多会话 runtime 编排

这些操作都很“看起来很专业”，但对当前目标只会制造额外复杂度。
