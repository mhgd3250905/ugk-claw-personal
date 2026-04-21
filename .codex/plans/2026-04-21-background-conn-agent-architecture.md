# Background Conn Agent Architecture Implementation Plan

> **For Codex:** 执行本计划前必须先获得用户明确批准。实现时逐任务推进，先写测试，再写最小实现，再跑对应验证。不要顺手改 `references/pi-mono/`。

**Goal:** 将现有 `conn` 从前台 `AgentService` 附属定时器，重构为独立后台 agent 调度系统；前台只负责创建/管理任务和接收完成通知。

**Architecture:** 新架构拆出独立 `conn-worker` 进程，后台任务到点后通过持久化 lease claim，创建独立 `conn_run`、独立 run workspace、独立 pi `AgentSession`，写入运行日志和输出文件，最后通过 `conversation_notifications` 投递到前台。后台 agent 不复用前台 `AgentService.chat()`，不共享前台 active run、session、cwd 或 conversation context。

**Tech Stack:** Node.js/TypeScript, Fastify, `@mariozechner/pi-coding-agent` SDK, Node built-in `node:sqlite`, Docker Compose, existing `AssetStore`, existing playground state API.

---

## 0. 核心边界

新 `conn` 的原则先定死：

- 前台 Web 服务和后台 `conn-worker` 是两个运行进程。
- 前台启动、聊天、刷新、文件展示不依赖后台 worker 存活。
- 后台 worker 崩溃、卡死、重启，只影响后台任务状态，不影响 `/healthz`、`/playground`、`/v1/chat/state`。
- 前台和后台主链路只在两个点相交：
  - 用户创建/修改/暂停/删除 conn 任务。
  - 后台任务完成后写入 notification，由前台展示。
- 后台运行过程只通过只读状态/日志接口暴露给前台，不进入前台 agent session。
- 后台结果默认不进入前台 LLM 上下文；用户需要继续基于结果聊时，必须显式引用。
- 每一次后台执行都有独立 run workspace，隔离输入快照、中间文件、输出文件、日志和 pi session。
- `conn` definition 存 profile/spec/skill set 的 ID 和升级策略；`conn_run` 存本次运行解析后的 resolved snapshot。

---

## 1. 现状与替换目标

### 当前入口

- `src/server.ts`
  - 当前在 Web 服务进程里创建 `ConnStore`、`ConnScheduler`、`ConnRunner`。
  - 当前 `connScheduler.start()` 跟前台服务一起启动。
- `src/agent/conn-store.ts`
  - JSON 文件存储 conn definition。
  - 内含简化 schedule 计算。
- `src/agent/conn-scheduler.ts`
  - `setInterval` 轮询 due conn。
  - 只有进程内 `running` Set。
- `src/agent/conn-runner.ts`
  - 直接调用前台 `AgentService.chat()`。
- `src/routes/conns.ts`
  - 暴露 `/v1/conns` CRUD 和手动 run。

### 替换目标

- `src/server.ts` 不再启动后台调度循环。
- 新增独立 worker 入口，例如 `src/workers/conn-worker.ts`。
- 新增 SQLite-backed store，替代 JSON-only `ConnStore` 的生产路径。
- 保留 `/v1/conns` 控制面，但它只读写 SQLite，不直接执行后台 agent。
- 新增 notification 读写能力，让前台像系统消息一样看到后台结果。
- 后台 agent 使用独立 runtime/profile，不继承前台业务上下文。

---

## 2. 数据模型

第一版使用 SQLite。具体驱动选择 Node 内置 `node:sqlite`，不引入 `better-sqlite3` / `sqlite3` 这类原生 npm 依赖；当前本机 Node `v24.14.0` 与 Docker 基础镜像 `node:22-bookworm-slim` 均已确认支持 `node:sqlite`。这样 Windows / macOS / Linux 通过 Docker 部署时不需要额外编译 SQLite native addon。代价是 Node 当前会打印 `ExperimentalWarning`，后续若 Node 将 API 稳定化或项目明确需要更成熟驱动，再单独评估迁移。

不要把全部中间文件塞进数据库，数据库只保存索引、状态和摘要；文件本体留在 run workspace。

### `conns`

```sql
CREATE TABLE conns (
  conn_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  target_json TEXT NOT NULL,
  schedule_json TEXT NOT NULL,
  asset_refs_json TEXT NOT NULL DEFAULT '[]',
  profile_id TEXT NOT NULL,
  agent_spec_id TEXT NOT NULL,
  skill_set_id TEXT NOT NULL,
  model_policy_id TEXT NOT NULL,
  upgrade_policy TEXT NOT NULL DEFAULT 'latest',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_run_at TEXT,
  next_run_at TEXT,
  last_run_id TEXT
);
```

### `conn_runs`

```sql
CREATE TABLE conn_runs (
  run_id TEXT PRIMARY KEY,
  conn_id TEXT NOT NULL,
  status TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  claimed_at TEXT,
  started_at TEXT,
  finished_at TEXT,
  lease_owner TEXT,
  lease_until TEXT,
  workspace_path TEXT NOT NULL,
  session_file TEXT,
  resolved_snapshot_json TEXT,
  result_summary TEXT,
  result_text TEXT,
  error_text TEXT,
  delivered_at TEXT,
  retry_of_run_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Status 第一版限定：

```text
queued | claimed | running | succeeded | failed | stale | cancelled
```

### `conn_run_events`

```sql
CREATE TABLE conn_run_events (
  event_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### `conn_run_files`

```sql
CREATE TABLE conn_run_files (
  file_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
```

`kind` 限定：

```text
input | work | output | log | session
```

### `conversation_notifications`

```sql
CREATE TABLE conversation_notifications (
  notification_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  run_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  files_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  read_at TEXT
);
```

---

## 3. 目录布局

本地开发第一版可放在项目 `.data/agent/background` 下；生产可通过环境变量外置到 shared 目录。后续如果要完全隔离项目 `AGENTS.md` 上溯影响，应将 worker cwd 放到 `/var/lib/ugk-background/...` 或使用自定义 resource loader 屏蔽项目上下文。

```text
.data/agent/background/
  conn.sqlite
  profiles/
    default/
      AGENTS.md
      settings.json
  runs/
    <runId>/
      input/
      work/
      output/
      logs/
        events.jsonl
        tools.jsonl
      session/
      manifest.json
```

每次 run 独立目录，不复用昨天目录，也不在失败重跑时覆盖旧目录。

---

## 4. Runtime Profile 与技能解析

### 定义

新增后台 profile 概念：

```ts
interface BackgroundAgentProfileRef {
  profileId: string;
  agentSpecId: string;
  skillSetId: string;
  modelPolicyId: string;
  upgradePolicy: "latest" | "pinned" | "manual";
}
```

### 运行时解析

`conn` definition 只存 ID。每次 run 开始时解析成完整快照：

```ts
interface ResolvedBackgroundAgentSnapshot {
  profileId: string;
  profileVersion: string;
  agentSpecId: string;
  agentSpecVersion: string;
  skillSetId: string;
  skillSetVersion: string;
  skills: Array<{ id: string; name: string; path: string; version: string }>;
  modelPolicyId: string;
  provider: string;
  model: string;
  resolvedAt: string;
}
```

快照写入 `conn_runs.resolved_snapshot_json`。这样后台能力可以随平台升级，但每次运行都能回溯到底用了哪套 agent 规范和 skill。

### 升级策略

- `latest`: 每次运行解析最新 profile/spec/skill set。
- `pinned`: 使用创建 conn 时记录的版本。
- `manual`: 有新版本时标记可升级，但不自动切换。

默认建议：

- 普通日报/资讯类：`latest`
- 外部投递或强格式任务：`manual`
- 合规/财务/客户通知：`pinned`

---

## 5. 任务拆分

### Task 1: 引入 SQLite 基础层

**Files:**

- Create: `src/agent/conn-db.ts`
- Create: `test/conn-db.test.ts`

**Step 1: 写失败测试**

覆盖：

- 初始化数据库会创建必要表。
- 重复初始化幂等。
- 数据库路径目录不存在时自动创建。

**Step 2: 最小实现**

新增 `ConnDatabase`，负责：

- 打开 SQLite。
- 执行 schema migration。
- 关闭连接。

**Step 3: 验证**

Run:

```bash
npm test -- test/conn-db.test.ts
```

Expected:

```text
PASS conn-db
```

**影响检查:**

- 只新增基础设施，不改变现有 `/v1/conns` 行为。
- 使用 Node 内置 `node:sqlite`，不新增 npm 依赖；需要确认本机与 Docker Node 版本均支持该模块。

---

### Task 2: 新增 SQLite-backed Conn Store

**Files:**

- Create: `src/agent/conn-sqlite-store.ts`
- Modify: `src/agent/conn-store.ts`
- Create: `test/conn-sqlite-store.test.ts`

**Step 1: 写失败测试**

覆盖：

- 创建 conn 后能 list/get。
- pause/resume/update/delete 行为与现有 JSON store 兼容。
- `assetRefs` 去重。
- schedule 无效输入返回明确错误，不把用户输入错误变 500。
- `nextRunAt` 计算保留现有语义。

**Step 2: 抽接口**

从现有 `ConnStore` 抽出 `ConnStoreLike`：

```ts
export interface ConnStoreLike {
  list(): Promise<ConnDefinition[]>;
  get(connId: string): Promise<ConnDefinition | undefined>;
  create(input: CreateConnInput): Promise<ConnDefinition>;
  update(connId: string, patch: UpdateConnInput): Promise<ConnDefinition | undefined>;
  delete(connId: string): Promise<boolean>;
  pause(connId: string, now?: Date): Promise<ConnDefinition | undefined>;
  resume(connId: string, now?: Date): Promise<ConnDefinition | undefined>;
}
```

**Step 3: 实现 SQLite store**

保持 API 兼容，先不删除 JSON store。JSON store 可继续用于旧测试或迁移兜底。

**Step 4: 验证**

Run:

```bash
npm test -- test/conn-store.test.ts test/conn-sqlite-store.test.ts
```

Expected:

```text
PASS conn-store
PASS conn-sqlite-store
```

---

### Task 3: Run Store、Lease 与 Claim

**Files:**

- Create: `src/agent/conn-run-store.ts`
- Create: `test/conn-run-store.test.ts`

**Step 1: 写失败测试**

覆盖：

- 到点 conn 会创建 queued run。
- worker claim run 时写 `leaseOwner`、`leaseUntil`、`status=claimed`。
- 同一个 run 只能被一个 worker claim。
- lease 过期后可被回收为 stale 或重新 claim。
- finished run 不会被重复 claim。

**Step 2: 实现 run store**

关键 API：

```ts
interface ConnRunStore {
  enqueueDueRuns(now: Date): Promise<ConnRun[]>;
  claimNextRun(owner: string, now: Date, leaseMs: number): Promise<ConnRun | undefined>;
  heartbeat(runId: string, owner: string, now: Date, leaseMs: number): Promise<boolean>;
  markRunning(runId: string, owner: string, now: Date): Promise<void>;
  markSucceeded(runId: string, result: ConnRunResultPatch): Promise<void>;
  markFailed(runId: string, error: ConnRunErrorPatch): Promise<void>;
}
```

**Step 3: 验证**

Run:

```bash
npm test -- test/conn-run-store.test.ts
```

Expected:

```text
PASS conn-run-store
```

---

### Task 4: Run Workspace 管理

**Files:**

- Create: `src/agent/background-workspace.ts`
- Create: `test/background-workspace.test.ts`

**Step 1: 写失败测试**

覆盖：

- 创建 run workspace。
- 自动创建 `input/work/output/logs/session`。
- 写 `manifest.json`。
- 输入 asset snapshot 写入 `input/`。
- 同名文件安全去重或覆盖策略明确。

**Step 2: 实现 workspace manager**

输入：

```ts
interface CreateRunWorkspaceInput {
  runId: string;
  connId: string;
  title: string;
  assetRefs: string[];
}
```

输出：

```ts
interface RunWorkspace {
  rootPath: string;
  inputDir: string;
  workDir: string;
  outputDir: string;
  logsDir: string;
  sessionDir: string;
  manifestPath: string;
}
```

**Step 3: 验证**

Run:

```bash
npm test -- test/background-workspace.test.ts
```

Expected:

```text
PASS background-workspace
```

---

### Task 5: Background Agent Profile Resolver

**Files:**

- Create: `src/agent/background-agent-profile.ts`
- Create: `test/background-agent-profile.test.ts`

**Step 1: 写失败测试**

覆盖：

- 通过 `profileId / agentSpecId / skillSetId / modelPolicyId` 解析当前版本。
- `latest` 返回最新版本。
- `pinned` 返回指定版本。
- 解析结果包含 skill 路径、版本、模型信息。
- 缺失 ID 返回明确错误。

**Step 2: 最小实现**

第一版可以使用文件/JSON registry，不必上复杂管理 UI。

建议路径：

```text
.pi/background-agent/
  profiles.json
  agent-specs.json
  skill-sets.json
  model-policies.json
```

注意：如果这些文件不存在，提供内置 default profile，使用现有通用 skill 路径，但不得加载当前项目业务 AGENTS.md 作为后台任务默认上下文。

**Step 3: 验证**

Run:

```bash
npm test -- test/background-agent-profile.test.ts
```

Expected:

```text
PASS background-agent-profile
```

---

### Task 6: Background Agent Runner

**Files:**

- Create: `src/agent/background-agent-runner.ts`
- Create: `test/background-agent-runner.test.ts`

**Step 1: 写失败测试**

覆盖：

- runner 不调用前台 `AgentService.chat()`。
- runner 使用独立 `createAgentSession` 或可注入 session factory。
- 订阅事件后写 `conn_run_events`。
- 成功时写 result summary/text。
- 失败时写 error，不抛到前台服务。
- 产物路径默认进入 run workspace `output/`。

**Step 2: 实现 Runner**

关键依赖：

```ts
interface BackgroundAgentRunnerOptions {
  profileResolver: BackgroundAgentProfileResolver;
  workspaceManager: BackgroundWorkspaceManager;
  runStore: ConnRunStore;
  assetStore: AssetStoreLike;
  sessionFactory: BackgroundAgentSessionFactory;
}
```

**Step 3: 输出协议**

后台 prompt 注入：

- 本次 conn title。
- 用户原始 prompt。
- assetRefs。
- run workspace 目录说明。
- 所有中间文件写入 `work/`。
- 所有最终文件写入 `output/`。
- 最终回复只总结结果和输出文件。

**Step 4: 验证**

Run:

```bash
npm test -- test/background-agent-runner.test.ts
```

Expected:

```text
PASS background-agent-runner
```

---

### Task 7: Notification Store

**Files:**

- Create: `src/agent/conversation-notification-store.ts`
- Create: `test/conversation-notification-store.test.ts`

**Step 1: 写失败测试**

覆盖：

- 创建 notification。
- 按 conversationId list。
- 同一 `runId` 幂等投递，不重复创建。
- 支持标记 read。

**Step 2: 实现 store**

API：

```ts
interface ConversationNotificationStore {
  create(input: CreateConversationNotificationInput): Promise<ConversationNotification>;
  list(conversationId: string): Promise<ConversationNotification[]>;
  markRead(notificationId: string): Promise<boolean>;
}
```

**Step 3: 验证**

Run:

```bash
npm test -- test/conversation-notification-store.test.ts
```

Expected:

```text
PASS conversation-notification-store
```

---

### Task 8: 前台 State 合并 Notification

**Files:**

- Modify: `src/agent/agent-service.ts`
- Modify: `src/routes/chat.ts`
- Modify: `src/types/api.ts`
- Modify: `test/agent-service.test.ts`
- Modify: `test/server.test.ts`

**Step 1: 写失败测试**

覆盖：

- `GET /v1/chat/state` 返回普通 session messages 加 notification。
- notification 展示为 `kind=system` 或新增 `kind=notification`。
- notification 不进入 pi session messages。
- 相同 notification 不重复出现在 state。

**Step 2: 实现**

给 `AgentService` 注入 optional `notificationStore`。

合并规则：

- 按 `createdAt` 排序。
- notification 转为前台消息体。
- `data-message-kind` 保留真实类型。
- 不改变 `ConversationStore` session file。

**Step 3: 验证**

Run:

```bash
npm test -- test/agent-service.test.ts test/server.test.ts
```

Expected:

```text
PASS agent-service
PASS server
```

---

### Task 9: 独立 Conn Worker 入口

**Files:**

- Create: `src/workers/conn-worker.ts`
- Modify: `package.json`
- Create: `test/conn-worker.test.ts`

**Step 1: 写失败测试**

覆盖：

- worker tick 会 enqueue due runs。
- worker claim 后执行 runner。
- runner 成功后创建 notification。
- runner 失败后记录 failed，不影响下一次 tick。
- `maxConcurrency=1` 时三个 due run 只 claim 一个。

**Step 2: 实现 worker**

脚本：

```json
{
  "scripts": {
    "worker:conn": "tsx src/workers/conn-worker.ts"
  }
}
```

配置：

```text
CONN_WORKER_ID
CONN_WORKER_POLL_INTERVAL_MS
CONN_WORKER_LEASE_MS
CONN_WORKER_MAX_CONCURRENCY
CONN_DB_PATH
BACKGROUND_AGENT_DATA_DIR
```

第一版建议：

```text
CONN_WORKER_MAX_CONCURRENCY=1
```

**Step 3: 验证**

Run:

```bash
npm test -- test/conn-worker.test.ts
```

Expected:

```text
PASS conn-worker
```

---

### Task 10: Server 不再内嵌启动 Scheduler

**Files:**

- Modify: `src/server.ts`
- Modify: `test/server.test.ts`

**Step 1: 写失败测试**

覆盖：

- `buildServer()` 不再默认调用 `connScheduler.start()`。
- Web 服务启动不依赖 worker。
- `/v1/conns/:connId/run` 不直接同步执行 agent，而是 enqueue/trigger run。

**Step 2: 实现**

- 移除 `connScheduler.start()`。
- 删除或替换 `ConnScheduler` 在 Web 进程中的使用。
- `/run` 改为创建 queued run，返回 run metadata。

**Step 3: 验证**

Run:

```bash
npm test -- test/server.test.ts
```

Expected:

```text
PASS server
```

---

### Task 11: Docker Compose 拆分 Worker

**Files:**

- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `Dockerfile` if needed
- Modify: `test/containerization.test.ts`

**Step 1: 写失败测试**

覆盖 compose 文本：

- 有 `ugk-pi` 服务。
- 有 `ugk-pi-conn-worker` 服务。
- 两者共享必要 data mount。
- worker 崩溃不影响 app healthcheck。
- worker 不暴露公网端口。

**Step 2: 实现 compose**

开发：

```yaml
ugk-pi:
  command: npm run dev

ugk-pi-conn-worker:
  command: npm run worker:conn
  restart: unless-stopped
```

生产：

```yaml
ugk-pi:
  command: npm start

ugk-pi-conn-worker:
  command: npm run worker:conn
  restart: unless-stopped
```

**Step 3: 验证**

Run:

```bash
npm test -- test/containerization.test.ts
```

Expected:

```text
PASS containerization
```

---

### Task 12: Conn API 扩展

**Files:**

- Modify: `src/routes/conns.ts`
- Modify: `src/types/api.ts`
- Modify: `test/server.test.ts`

**Step 1: 写失败测试**

覆盖：

- `GET /v1/conns/:connId/runs` 返回 run 列表。
- `GET /v1/conns/:connId/runs/:runId` 返回 run detail。
- `GET /v1/conns/:connId/runs/:runId/events` 返回过程日志。
- `POST /v1/conns/:connId/run` 只 enqueue，不同步跑 agent。

**Step 2: 实现 API**

新增响应体：

```ts
export interface ConnRunBody {
  runId: string;
  connId: string;
  status: string;
  scheduledAt: string;
  startedAt?: string;
  finishedAt?: string;
  resultSummary?: string;
  errorText?: string;
  workspacePath?: string;
}
```

**Step 3: 验证**

Run:

```bash
npm test -- test/server.test.ts
```

Expected:

```text
PASS server
```

---

### Task 13: Playground 展示 Notification 与 Run 链接

**Files:**

- Modify: `src/ui/playground.ts`
- Modify: `test/server.test.ts`
- Modify: `docs/playground-current.md`

**Step 1: 写失败测试**

覆盖 HTML/JS 标记：

- notification 消息按系统/助手视觉展示。
- 后台任务完成显示标题、摘要、输出文件链接。
- 有“查看过程”入口。
- 不出现“后台结果已加入上下文”这类误导文案。

**Step 2: 实现前端**

- 在 existing message render path 支持 notification。
- 文件链接复用现有 file card 逻辑。
- “查看过程”第一版可打开 modal 或跳转到 run detail JSON。

**Step 3: 验证**

Run:

```bash
npm test -- test/server.test.ts
```

Expected:

```text
PASS server
```

如改动 UI 行为，最终还需通过本地 `http://127.0.0.1:3000/playground` 做真实页面验证。

---

### Task 14: 文件资产型 Conn 创建流程

**Files:**

- Modify: `src/routes/conns.ts`
- Modify: `src/types/api.ts`
- Modify: `src/ui/playground.ts`
- Modify: `test/server.test.ts`

**Step 1: 写失败测试**

覆盖用户场景：

```text
上传 xxxx.md
每天早上9点按照这个文件执行任务
```

系统行为：

- 文件先进入 `AssetStore`。
- conn 存 `assetRefs`，不存临时文件路径。
- schedule 存 cron + timezone。
- 创建后返回确认摘要。

**Step 2: 实现**

API 支持：

```ts
schedule: {
  kind: "cron";
  expression: "0 9 * * *";
  timezone: "Asia/Shanghai";
}
```

**Step 3: 验证**

Run:

```bash
npm test -- test/server.test.ts test/conn-sqlite-store.test.ts
```

Expected:

```text
PASS server
PASS conn-sqlite-store
```

---

### Task 15: 文档与变更记录

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/runtime-assets-conn-feishu.md`
- Modify: `docs/traceability-map.md`
- Modify: `docs/server-ops-quick-reference.md`
- Modify: `docs/tencent-cloud-singapore-deploy.md`
- Modify: `docs/change-log.md`

**Step 1: 更新文档**

必须写清：

- `conn` 是独立后台 agent 调度系统。
- 前台和后台只通过任务定义、run 记录、notification 交互。
- `ugk-pi-conn-worker` 是独立服务。
- worker 挂了不影响前台。
- shared 运行态目录必须包含 SQLite 和 run workspace。
- 生产更新不能删 background run workspace。

**Step 2: 更新 change log**

在 `docs/change-log.md` 追加：

- 日期
- 改动主题
- 影响范围
- 对应源码/文档入口

**Step 3: 验证**

Run:

```bash
npm test
```

Expected:

```text
all tests pass
```

---

## 6. 风险与回滚

### 主要风险

- SQLite npm 包可能引入原生构建问题。
- 后台 cwd 隔离不彻底，误读项目 `AGENTS.md`。
- notification 合并进前台 state 时重复展示。
- worker 和 app 共享 data mount 配错，生产重建后历史 run 丢失。
- 后台 agent 并发抢浏览器 sidecar 或 API 配额。

### 降风险策略

- 第一版 `CONN_WORKER_MAX_CONCURRENCY=1`。
- 第一版保留旧 JSON `ConnStore`，不立即删。
- 后台 result 只作为 notification，不进入前台 LLM 上下文。
- `conn_run` 存 resolved snapshot，保证排障可追溯。
- 每个 run 独立 workspace，失败重跑创建新 workspace。

### 回滚策略

- Docker compose 可临时停掉 `ugk-pi-conn-worker`，前台继续可用。
- `/v1/conns` 控制面保留，但不执行后台任务。
- 若 SQLite store 出问题，短期切回旧 JSON store 只读展示。
- 不删除旧 `src/agent/conn-store.ts`、`conn-scheduler.ts`、`conn-runner.ts`，直到新链路稳定。

---

## 7. 最终验收标准

- 前台 `npm test` 全量通过。
- `docker compose up -d` 后同时存在 `ugk-pi` 与 `ugk-pi-conn-worker`。
- 停掉 `ugk-pi-conn-worker` 后：
  - `http://127.0.0.1:3000/healthz` 正常。
  - `http://127.0.0.1:3000/playground` 正常。
  - 前台聊天正常。
- 创建“每天 9 点按上传文件执行”的 conn 后：
  - conn 存 asset ID，不存临时路径。
  - 到点生成独立 `conn_run`。
  - run 有独立 workspace。
  - run events 可查。
  - 最终结果以 notification 展示到目标 conversation。
- 三个 9 点任务同时 due 时：
  - 不共享 workspace。
  - 不覆盖中间文件。
  - 按并发限制执行。
  - 每个 run 都可独立回溯。
- conn agent 使用 runtime ID 解析 profile/spec/skills。
- 每个 conn run 保存 resolved snapshot。
