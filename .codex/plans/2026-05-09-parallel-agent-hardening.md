# 多 Agent 并行加固 Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task.

**Goal:** 修复单进程多 agent / conn run 并行时的共享状态串扰，并补上 agent 忙闲可见性与忙时错误语义。

**Architecture:** 先把运行 scope 从“只靠全局 `process.env`”收口到显式上下文和子进程 env 注入，再让 `AgentService` 知道自己的 `agentId`，用 `agentId + conversationId` 或 `connId + runId` 形成浏览器清理 scope。状态 API 只读 `AgentServiceRegistry` 中已创建的服务，不为了查询状态创建新服务；busy 错误用领域错误表达，HTTP 路由按非流式 / SSE 两种语义分别处理。

**Tech Stack:** TypeScript, Node.js `AsyncLocalStorage`, Fastify, `node:test`, `@mariozechner/pi-coding-agent`, Docker Chrome sidecar/CDP proxy。

---

## 当前评估

### 成立且应修

- `src/agent/agent-run-scope.ts` 的 `runWithScopedAgentEnvironment()` 通过 save/mutate/restore 修改 `process.env.CLAUDE_AGENT_ID`、`process.env.CLAUDE_HOOK_AGENT_ID`、`process.env.agent_id`。并行 agent prompt 或 conn run 会互相覆盖 scope。
- `src/agent/background-agent-runner.ts` 的 `runWithBackgroundWorkspaceEnvironment()` 同样修改全局 `process.env`，字段包括 `OUTPUT_DIR`、`WORK_DIR`、`CONN_SHARED_DIR`、`CONN_PUBLIC_DIR` 等。并行 conn run 时，这比 scope 串扰更危险，可能让任务写错目录。
- `src/agent/agent-service.ts` 当前 `createBrowserCleanupScope(conversationId)` 只用 conversation id。不同 agent 如果复用同一个 conversation id，且共享同一个浏览器实例，cleanup scope 可能撞车。
- 当前忙时错误是普通 `Error("Another conversation is already running")`，非流式 route 会变成 500，流式 route 只会写 SSE error。对用户和前端都不够可判定。
- 当前只有 conversation 级 `GET /v1/chat/status` / `GET /v1/agents/:agentId/chat/status`，没有 agent profile 级 busy/idle 总览。

### 暂不按报告修

- 报告说 `ModelRegistry.create()` 会清空全局 provider registry。当前 `node_modules/@mariozechner/pi-coding-agent/dist/core/model-registry.js` 中 `create()` 只是 `new ModelRegistry(...)`，`resetApiProviders()` 在 `refresh()` 中。普通 session 创建不按报告说法 reset，因此本轮不改 `ModelRegistry.create()`。
- 上游 `AgentSession.reload()` 里确实有 `resetApiProviders()`，但本项目当前风险报告没有给出可复现路径。本轮只加观察项，不改上游库。

### 关键约束

- 不能提交或整理 `.pi/skills/superpowers/*`、`CLAUDE.md`、`.claude/`、`runtime/xhs-extract.mjs`。
- 浏览器绑定边界不能倒退：Agent / Conn 浏览器绑定只能由 Playground UI 手动设置，运行时只消费 `defaultBrowserId` / `browserId`。
- 子进程和 bash/curl wrapper 仍需要真实 env；不能幼稚地把所有 env 改成 `AsyncLocalStorage` 然后忘了外部进程，别搞那种“单测很美，运行一坨”的修法。

---

## Task 1: 加入领域错误和只读 busy 状态模型

**Files:**
- Create: `src/agent/agent-errors.ts`
- Modify: `src/types/api.ts`
- Test: `test/agent-service.test.ts`

**Step 1: 写 failing tests**

在 `test/agent-service.test.ts` 增加测试：

```ts
test("streamChat rejects a second conversation with AgentBusyError", async () => {
	const store = await createStore();
	const activeSession = new DeferredSession("E:/sessions/busy.jsonl");
	const factory = new FakeAgentSessionFactory(() => activeSession);
	const service = new AgentService({
		agentId: "main",
		conversationStore: store,
		sessionFactory: factory,
	});

	const run = service.streamChat({ conversationId: "manual:one", message: "start" }, () => undefined);
	await activeSession.promptStarted;

	await assert.rejects(
		() => service.chat({ conversationId: "manual:two", message: "second" }),
		(error: unknown) =>
			error instanceof AgentBusyError &&
			error.agentId === "main" &&
			error.activeConversationId === "manual:one",
	);

	activeSession.finish();
	await run;
});

test("getAgentRunStatus reports idle and busy without reading conversation history", async () => {
	const store = await createStore();
	const activeSession = new DeferredSession("E:/sessions/status.jsonl");
	const factory = new FakeAgentSessionFactory(() => activeSession);
	const service = new AgentService({
		agentId: "search",
		conversationStore: store,
		sessionFactory: factory,
	});

	assert.deepEqual(service.getAgentRunStatus(), { status: "idle" });

	const run = service.streamChat({ conversationId: "manual:status", message: "start" }, () => undefined);
	await activeSession.promptStarted;
	const status = service.getAgentRunStatus();
	assert.equal(status.status, "busy");
	assert.equal(status.agentId, "search");
	assert.equal(status.activeConversationId, "manual:status");

	activeSession.finish();
	await run;
});
```

Expected: fails because `AgentBusyError`, `agentId` option, and `getAgentRunStatus()` do not exist.

**Step 2: 最小实现**

创建 `src/agent/agent-errors.ts`：

```ts
export class AgentBusyError extends Error {
	constructor(
		public readonly agentId: string,
		public readonly activeConversationId?: string,
	) {
		super(`Agent ${agentId} is currently busy`);
		this.name = "AgentBusyError";
	}
}
```

在 `AgentServiceOptions` 增加：

```ts
agentId?: string;
```

在 `AgentService` 增加私有 helper：

```ts
private get agentId(): string {
	return this.options.agentId ?? "main";
}
```

新增类型和方法：

```ts
export type AgentRunStatusResult =
	| { agentId: string; status: "idle" }
	| { agentId: string; status: "busy"; activeConversationId: string; activeSince: string };

getAgentRunStatus(): AgentRunStatusResult {
	const first = this.activeRuns.entries().next().value as [string, ActiveRunState] | undefined;
	if (!first) return { agentId: this.agentId, status: "idle" };
	const [activeConversationId, activeRun] = first;
	return {
		agentId: this.agentId,
		status: "busy",
		activeConversationId,
		activeSince: activeRun.view.startedAt,
	};
}
```

把 `runChat()` 中：

```ts
throw new Error("Another conversation is already running");
```

改为：

```ts
const activeConversationId = this.activeRuns.keys().next().value;
throw new AgentBusyError(this.agentId, activeConversationId);
```

**Step 3: 运行窄测**

Run:

```powershell
node --test --import tsx test\agent-service.test.ts --test-name-pattern "busy|AgentRunStatus"
```

Expected: PASS。

---

## Task 2: AgentService 传入 agentId 并隔离 browser cleanup scope

**Files:**
- Modify: `src/server.ts`
- Modify: `src/agent/agent-run-scope.ts`
- Modify: `src/agent/agent-service.ts`
- Modify: `test/agent-run-scope.test.ts`
- Modify: `test/agent-service.test.ts`
- Test: `test/chat-agent-browser-routes.test.ts`

**Step 1: 写 failing tests**

在 `test/agent-run-scope.test.ts` 增加：

```ts
test("createBrowserCleanupScope includes owner id when provided", () => {
	assert.equal(createBrowserCleanupScope("manual:hello/world", "search"), "search-manual-hello-world");
	assert.equal(createBrowserCleanupScope("manual:hello/world", "main"), "main-manual-hello-world");
});
```

在 `test/agent-service.test.ts` 的 browser cleanup 测试新增一个 `agentId: "search"` service，期望 cleanup URL 包含 `search-manual-browser-cleanup`。

**Step 2: 实现 scope API**

把 `createBrowserCleanupScope(conversationId: string)` 改为：

```ts
export function createBrowserCleanupScope(conversationId: string, ownerId?: string): string {
	const rawScope = ownerId?.trim() ? `${ownerId}:${conversationId}` : conversationId;
	return sanitizeStateId(rawScope);
}
```

在 `AgentService.runChat()` 中改为：

```ts
const browserCleanupScope = createBrowserCleanupScope(conversationId, this.agentId);
```

在 `src/server.ts`：

```ts
function createDefaultAgentService(assetStore: AssetStoreLike, profile?: AgentProfile): AgentService {
	...
	return new AgentService({
		agentId: profile?.agentId ?? DEFAULT_AGENT_ID,
		conversationStore,
		sessionFactory,
		assetStore,
	});
}
```

**Step 3: 运行窄测**

Run:

```powershell
node --test --import tsx test\agent-run-scope.test.ts test\agent-service.test.ts test\chat-agent-browser-routes.test.ts
```

Expected: PASS。

---

## Task 3: 消除主 agent scope 的全局 process.env 竞态

**Files:**
- Create: `src/agent/agent-scope-context.ts`
- Modify: `src/agent/agent-run-scope.ts`
- Modify: `src/agent/browser-cleanup.ts`
- Modify: `test/agent-run-scope.test.ts`
- Modify: `test/browser-cleanup.test.ts`

**Step 1: 写 failing tests**

在 `test/agent-run-scope.test.ts` 增加并发测试：

```ts
test("runWithScopedAgentEnvironment keeps async-local scopes isolated", async () => {
	const previous = snapshotScopeEnv();
	for (const key of SCOPE_ENV_KEYS) delete process.env[key];

	try {
		let releaseA!: () => void;
		const waitA = new Promise<void>((resolve) => {
			releaseA = resolve;
		});

		const a = runWithScopedAgentEnvironment("scope-a", async () => {
			await waitA;
			return getCurrentAgentScope();
		});
		const b = runWithScopedAgentEnvironment("scope-b", async () => getCurrentAgentScope());

		assert.equal((await b)?.scope, "scope-b");
		releaseA();
		assert.equal((await a)?.scope, "scope-a");
	} finally {
		restoreScopeEnv(previous);
	}
});
```

Expected: fails because `getCurrentAgentScope()` does not exist.

**Step 2: 创建 AsyncLocalStorage context**

`src/agent/agent-scope-context.ts`：

```ts
import { AsyncLocalStorage } from "node:async_hooks";

export interface AgentScopeContext {
	scope: string;
}

const agentScopeStorage = new AsyncLocalStorage<AgentScopeContext>();

export function runWithAgentScope<T>(scope: string, operation: () => Promise<T>): Promise<T> {
	return agentScopeStorage.run({ scope }, operation);
}

export function getCurrentAgentScope(): AgentScopeContext | undefined {
	return agentScopeStorage.getStore();
}
```

**Step 3: 改 runWithScopedAgentEnvironment**

保留函数名以减少改动面，但实现上只提供 async-local scope，不再写全局 `process.env`。子进程需要的 scope 继续由 `prepareBrowserBoundBashEnvironment()` 注入到 Bash spawn env。

```ts
export async function runWithScopedAgentEnvironment<T>(scope: string, operation: () => Promise<T>): Promise<T> {
	return await runWithAgentScope(scope, operation);
}
```

**Step 4: browser-cleanup 优先读取 async-local**

在 `resolveBrowserCleanupAgentScope()` 中：

```ts
const currentScope = getCurrentAgentScope()?.scope?.trim();
if (currentScope) return currentScope;
```

注意：这一步不能删除 `browser-cleanup` 的 `process.env` fallback，因为外部脚本和测试可能显式传 `env`。但主 Agent run 自身不再写全局 env。

**Step 5: 运行窄测**

Run:

```powershell
node --test --import tsx test\agent-run-scope.test.ts test\browser-cleanup.test.ts test\agent-service.test.ts
```

Expected: PASS。

---

## Task 4: 消除 background workspace env 的全局 process.env 竞态

**Files:**
- Create: `src/agent/background-workspace-context.ts`
- Modify: `src/agent/background-agent-runner.ts`
- Modify: `test/background-agent-runner.test.ts`

**Step 1: 写 failing tests**

在 `test/background-agent-runner.test.ts` 增加并发或 helper 级测试，目标是两个 run 的 `OUTPUT_DIR` 不互串。不要只断言 restore，restore 已经不够了，重点是 overlap 时读到自己的值。

测试建议结构：

```ts
test("background workspace environment is isolated across overlapping runs", async () => {
	// 构造两个 fake sessions，prompt 内读取 getCurrentBackgroundWorkspaceEnvironment()
	// A 卡住，B 完成，分别断言 OUTPUT_DIR 是自己的 workspace.outputDir。
});
```

Expected: fails because context helper does not exist.

**Step 2: 创建 context**

`src/agent/background-workspace-context.ts`：

```ts
import { AsyncLocalStorage } from "node:async_hooks";

export type BackgroundWorkspaceEnvironment = Record<string, string | undefined>;

const backgroundWorkspaceStorage = new AsyncLocalStorage<BackgroundWorkspaceEnvironment>();

export function runWithBackgroundWorkspaceContext<T>(
	values: BackgroundWorkspaceEnvironment,
	operation: () => Promise<T>,
): Promise<T> {
	return backgroundWorkspaceStorage.run({ ...values }, operation);
}

export function getCurrentBackgroundWorkspaceEnvironment(): BackgroundWorkspaceEnvironment {
	return { ...(backgroundWorkspaceStorage.getStore() ?? {}) };
}
```

**Step 3: 修改 runner**

把 `runWithBackgroundWorkspaceEnvironment()` 的内部实现改为：

```ts
return await runWithBackgroundWorkspaceContext(values, operation);
```

不要再写全局 `process.env`。如果后续发现 pi bash tool 需要这些 env，应在 background session factory 的 bash spawnHook 里显式合并 `getCurrentBackgroundWorkspaceEnvironment()`，不要在 runner 里污染全局。

**Step 4: 影响分析**

全仓搜：

```powershell
rg -n "OUTPUT_DIR|WORK_DIR|CONN_SHARED_DIR|CONN_PUBLIC_DIR|CONN_OUTPUT_BASE_URL|ZHIHU_REPORT_BASE_URL" -S src test runtime .pi
```

确认这些字段在哪里被消费。若只有 prompt 文本消费，删除全局 env 写入是安全的；若 bash spawnHook 消费，则同步补 env 合并。

**Step 5: 运行窄测**

Run:

```powershell
node --test --import tsx test\background-agent-runner.test.ts
```

Expected: PASS。

---

## Task 5: 增加 agent 忙闲状态 API

**Files:**
- Modify: `src/agent/agent-service-registry.ts`
- Modify: `src/routes/chat.ts`
- Modify: `src/types/api.ts`
- Modify: `test/agent-service-registry.test.ts`
- Modify: `test/chat-agent-routes.test.ts`
- Modify: `test/server.test.ts`

**Step 1: 写 failing tests**

在 `test/agent-service-registry.test.ts` 增加：

```ts
test("getAllRunStatus lists profiles without creating missing services", () => {
	let createCalls = 0;
	const registry = new AgentServiceRegistry({
		profiles: [...],
		createService: () => {
			createCalls += 1;
			return { getAgentRunStatus: () => ({ agentId: "main", status: "idle" }) } as never;
		},
	});

	registry.get("main");
	const statuses = registry.getAllRunStatus();
	assert.equal(createCalls, 1);
	assert.equal(statuses.length, 2);
});
```

在 `test/chat-agent-routes.test.ts` 增加：

```ts
test("GET /v1/agents/status returns all agent run statuses", async () => {
	const app = buildServer({ ... });
	const response = await app.inject({ method: "GET", url: "/v1/agents/status" });
	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json().agents.map((a) => a.agentId), ["main", "search"]);
});
```

**Step 2: 实现 registry 方法**

不要为了查状态创建 service。未创建过的 service 直接 idle：

```ts
getAllRunStatus(): AgentRunStatusSummary[] {
	return Array.from(this.profiles.values()).map((profile) => {
		const service = this.services.get(profile.agentId) as MaybeStatusService | undefined;
		const runStatus = service?.getAgentRunStatus?.() ?? { agentId: profile.agentId, status: "idle" as const };
		return {
			agentId: profile.agentId,
			name: profile.name,
			...runStatus,
		};
	});
}
```

**Step 3: 增加 route**

在 `registerChatRoutes()` 的 `/v1/agents` 附近新增：

```ts
app.get("/v1/agents/status", async () => ({
	agents: deps.agentServiceRegistry?.getAllRunStatus() ?? [
		{ agentId: "main", name: "主 Agent", status: "idle" },
	],
}));
```

**Step 4: 类型补充**

在 `src/types/api.ts` 增加：

```ts
export interface AgentRunStatusBody {
	agentId: string;
	name: string;
	status: "idle" | "busy";
	activeConversationId?: string;
	activeSince?: string;
}

export interface AgentRunStatusListResponseBody {
	agents: AgentRunStatusBody[];
}
```

**Step 5: 运行窄测**

Run:

```powershell
node --test --import tsx test\agent-service-registry.test.ts test\chat-agent-routes.test.ts test\server.test.ts --test-name-pattern "agents/status|AgentServiceRegistry"
```

Expected: PASS。

---

## Task 6: 非流式 busy 返回 409，流式 hijack 前预检

**Files:**
- Modify: `src/routes/http-errors.ts`
- Modify: `src/routes/chat.ts`
- Modify: `src/types/api.ts`
- Modify: `test/chat-agent-routes.test.ts`
- Modify: `test/server.test.ts`

**Step 1: 写 failing tests**

非流式：

```ts
test("POST /v1/agents/:agentId/chat returns 409 when agent is busy", async () => {
	// fake service chat throws AgentBusyError
	// expect status 409 and error.code === "AGENT_BUSY"
});
```

流式：

```ts
test("POST /v1/agents/:agentId/chat/stream returns 409 before hijack when agent is busy", async () => {
	// fake service getAgentRunStatus returns busy
	// expect normal JSON 409, not SSE
});
```

**Step 2: 增加错误响应 helper**

`src/types/api.ts` 的 `ErrorResponseBody["error"]["code"]` 加 `"AGENT_BUSY"`。

`src/routes/http-errors.ts`：

```ts
export function sendConflict(reply: FastifyReply, code: "AGENT_BUSY", message: string, extra?: Record<string, unknown>): FastifyReply {
	return reply.status(409).send({
		error: {
			code,
			message,
			...extra,
		},
	});
}
```

如果类型不想放开 `extra`，单独定义 `AgentBusyResponseBody`，别把错误体类型搞成一坨 `any`。

**Step 3: route 层处理 AgentBusyError**

增加 helper：

```ts
function sendAgentBusy(reply: FastifyReply, error: AgentBusyError): FastifyReply {
	const allStatus = deps.agentServiceRegistry?.getAllRunStatus() ?? [];
	const suggestedAgents = allStatus.filter((agent) => agent.status === "idle").map((agent) => agent.agentId);
	return reply.status(409).send({
		error: {
			code: "AGENT_BUSY",
			message: error.message,
			agentId: error.agentId,
			activeConversationId: error.activeConversationId,
			suggestedAgents,
		},
	});
}
```

所有非流式 chat route catch 中：

```ts
if (error instanceof AgentBusyError) return sendAgentBusy(reply, error);
```

**Step 4: 流式 route hijack 前预检**

在 `/v1/agents/:agentId/chat/stream` 和 `/v1/chat/stream`，完成 body/browser 校验后、`reply.hijack()` 前：

```ts
const runStatus = service.getAgentRunStatus();
if (runStatus.status === "busy") {
	return sendAgentBusy(reply, new AgentBusyError(runStatus.agentId, runStatus.activeConversationId));
}
```

legacy `/v1/chat/stream` 使用 `deps.agentService`，默认 agentId 为 main。

**Step 5: 运行窄测**

Run:

```powershell
node --test --import tsx test\chat-agent-routes.test.ts test\server.test.ts --test-name-pattern "busy|409|stream"
```

Expected: PASS。

---

## Task 7: 回归验证、文档和提交边界

**Files:**
- Modify: `docs/change-log.md`
- Modify: `docs/handoff-current.md`
- Optional Modify: `docs/traceability-map.md`

**Step 1: 全仓残留检查**

Run:

```powershell
rg -n "Another conversation is already running|process\.env\.(CLAUDE_AGENT_ID|CLAUDE_HOOK_AGENT_ID|agent_id|OUTPUT_DIR|WORK_DIR|CONN_SHARED_DIR|CONN_PUBLIC_DIR)" -S src test
```

Expected:
- `Another conversation is already running` 不再作为 route-facing 普通错误出现。
- `process.env.CLAUDE_*` 只保留在兼容 fallback、测试 env snapshot、或显式子进程 env 注入里；`runWithScopedAgentEnvironment()` 不再写全局 env。
- background workspace env 不再由 runner 全局写入。

**Step 2: 类型检查和测试**

Run:

```powershell
npx tsc --noEmit
```

Expected: PASS。

Run:

```powershell
node --test --import tsx test\agent-run-scope.test.ts test\browser-cleanup.test.ts test\agent-service.test.ts test\agent-service-registry.test.ts test\chat-agent-routes.test.ts test\background-agent-runner.test.ts
```

Expected: PASS。

Run:

```powershell
npm test
```

Expected: PASS。

Run:

```powershell
git diff --check
```

Expected: no output。

**Step 3: 文档更新**

`docs/change-log.md` 增加 `2026-05-09` 条目：

- 多 agent 并行加固：agent scope / browser cleanup scope / busy status / 409 busy response。
- 明确普通 `ModelRegistry.create()` 未按报告改动，原因是当前上游 create 不 reset provider registry。

`docs/handoff-current.md` 增加当前本地变更摘要：

- 新增 `/v1/agents/status`。
- busy agent 非流式返回 409，流式在 hijack 前预检。
- 浏览器 cleanup scope 带 agentId，conn/background scope 带 conn/run 或上下文隔离。
- 全局 env 只作为兼容 fallback，不作为并行隔离主机制。

如果 `docs/traceability-map.md` 的 agent profile / web-access 排查段落需要补状态 API，再加一句 `GET /v1/agents/status`。

**Step 4: 提交边界**

Run:

```powershell
git status --short
```

确认只 stage 本轮文件，继续避开：

- `.pi/skills/superpowers/*`
- `CLAUDE.md`
- `.claude/`
- `runtime/xhs-extract.mjs`

Commit:

```powershell
git add src test docs .codex/plans/2026-05-09-parallel-agent-hardening.md
git commit -m "fix: harden parallel agent runs"
```

---

## 风险和回滚

- `AsyncLocalStorage` 只覆盖同一 Node async 调用链，不会自动进入子进程。子进程必须继续靠 spawn env 注入。
- `reply.hijack()` 后不能再返回 HTTP 409；因此 busy 预检必须发生在 hijack 前。这点别忘，不然就是写了个看起来很专业的摆设。
- `/v1/agents/status` 不应创建尚未初始化的 `AgentService`，否则一个状态查询就可能触发 session/runtime 初始化副作用。
- `ModelRegistry.refresh()` / `AgentSession.reload()` 的上游全局 reset 仍是观察项。若后续发现 reload 能在运行中触发，再单独开窄修，不和本轮混在一起。

## 最终验收标准

- 两个不同 agent 同时运行时，browser cleanup scope 不相同。
- 两个 background conn run 同时运行时，workspace env / output dir 不互串。
- `GET /v1/agents/status` 能返回 main/search/custom agent 的 idle/busy。
- 同一 agent 忙时，非流式 chat 返回 HTTP 409 + `AGENT_BUSY`；流式 chat 在 hijack 前也返回 409。
- 全量 `npm test`、`npx tsc --noEmit`、`git diff --check` 通过。
