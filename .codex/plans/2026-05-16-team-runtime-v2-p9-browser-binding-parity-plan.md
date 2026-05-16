# Team Runtime v2 P9: Browser Binding Parity Plan

更新时间：2026-05-16

> **For coding agent:** 这是一个纠偏后的 P9 计划。不要实现新的浏览器资源系统；只审计并对齐 Team Runtime 与既有 chat agent / conn worker 的成熟 browser binding 链路。

## 0. 背景

P8-A 到 P8-E 已完成 Team role session 的 profile-aware browser binding groundwork：

- role session 会读取 resolved AgentProfile 的 `defaultBrowserId`
- Team 会构建 role/attempt 级 `browserScope`
- worker/checker/watcher runtime context 写入 attempt metadata
- finalizer runtime context 写入 run state
- Team UI 展示 runtime context
- P8-E 已补齐边界审计测试

但用户指出一个关键问题：chat agent 和 conn worker 中，浏览器绑定已经是成熟功能。P9 不应该重新设计“per-profile browser resource isolation”，而应该确认 Team 是否完整复用同一条成熟链路。

这条纠偏是必要的。否则就会把已有轮子当不存在，开始造“browser resource model / scheduler / pool”这种听起来很高级、实际很容易把项目拖成泥潭的东西。

## 1. 目标

让 Team Runtime 的 browser binding 行为与 chat agent / conn worker 保持一致：

1. Team 继续使用 AgentProfile 的 `defaultBrowserId`，不新增新的 browser 配置来源。
2. Team 继续复用 `ProjectBackgroundSessionFactory -> prepareBrowserBoundBashEnvironment()`。
3. Team 使用与 chat/conn 一致的 scope route 生命周期：
   - session 开始前写入 `setBrowserScopeRoute(scope, browserId)`
   - prompt 运行时使用同一个 scope
   - cleanup 使用同一个 scope
   - 结束后清理 route：`setBrowserScopeRoute(scope, undefined)`
4. Team 的 runtime context 记录真实传入成熟链路的 browser scope，而不是另一个相似但不参与 route 的 scope。
5. 文档明确：P9 是 parity audit + 小修复，不是浏览器资源调度/隔离平台。

## 2. 非目标

本阶段明确不做：

- 不新增 browser provisioning system
- 不新增 browser resource scheduler
- 不新增 worker/browser capacity pool
- 不创建、复制、删除 Chrome profile
- 不修改 Docker sidecar 拓扑
- 不修改 `UGK_BROWSER_INSTANCES_JSON` 语义
- 不修改 chat agent / conn worker 已有行为，除非测试证明已有链路本身有 bug
- 不把 `TEAM_MAX_CONCURRENT_RUNS` 和浏览器容量绑定
- 不提交 `.env`、`.data`、runtime 产物、未知 `.pi/skills/*`、`skills-lock.json`

## 3. 已确认成熟链路

### chat agent

入口：

- `src/agent/agent-service.ts`
- `src/agent/agent-conversation-session.ts`
- `src/agent/agent-session-factory.ts`

关键行为：

- `createBrowserCleanupScope(conversationId, agentId)` 得到 browser cleanup scope
- `setBrowserScopeRoute(browserCleanupScope, input.browserId)` 写 scope -> browserId route
- `openConversationSession()` 把 `browserId` / `browserScope` 传给 session factory
- `runWithScopedAgentEnvironment(browserCleanupScope, ...)` 使用同一个 scope
- finally 中 `closeBrowserTargetsForScope(browserCleanupScope, { browserId })`
- finally 中 `setBrowserScopeRoute(browserCleanupScope, undefined)` 清 route
- `AgentSessionFactory` 通过 `prepareBrowserBoundBashEnvironment()` 注入浏览器环境变量

### conn worker

入口：

- `src/agent/background-agent-runner.ts`
- `src/agent/background-agent-session-factory.ts`

关键行为：

- `resolveBackgroundBrowserId(conn, snapshot, defaultBrowserId)` 优先级：
  1. `conn.browserId`
  2. `snapshot.defaultBrowserId`
  3. `defaultBrowserId`
- `setBrowserScopeRoute(browserCleanupScope, effectiveBrowserId)` 写 route
- `ProjectBackgroundSessionFactory.createSession()` 接收 `browserId` / `browserScope`
- `runWithScopedAgentEnvironment(browserCleanupScope, ...)` 使用同一个 scope
- finally 中 `closeBrowserTargets(browserCleanupScope, { browserId: effectiveBrowserId })`
- finally 中 `setBrowserScopeRoute(browserCleanupScope, undefined)` 清 route
- `ProjectBackgroundSessionFactory` 通过 `prepareBrowserBoundBashEnvironment()` 注入浏览器环境变量

### browser env 注入

入口：

- `src/browser/browser-bound-bash.ts`
- `src/browser/browser-scope-routes.ts`
- `runtime/skills-user/web-access/scripts/local-cdp-browser.mjs`

关键行为：

- `prepareBrowserBoundBashEnvironment()` 设置：
  - `CLAUDE_AGENT_ID`
  - `CLAUDE_HOOK_AGENT_ID`
  - `agent_id`
  - `UGK_REQUIRE_SCOPED_BROWSER_PROXY`
  - `WEB_ACCESS_BROWSER_ID`
  - `UGK_DEFAULT_BROWSER_ID`
  - `WEB_ACCESS_CDP_HOST`
  - `WEB_ACCESS_CDP_PORT`
  - `UGK_BROWSER_INSTANCES_JSON`
- `local-cdp-browser.mjs` 会优先用 scope route 解析 browserId。

## 4. 当前 Team 可疑差异

入口：

- `src/team/agent-profile-role-runner.ts`

当前 Team 已经做对的部分：

- 默认 session factory 是 `ProjectBackgroundSessionFactory`
- browserId 选择为 `snapshot.defaultBrowserId ?? options.defaultBrowserId`
- session factory 收到 `browserId` / `browserScope`
- role/attempt scope 能区分 worker/checker/watcher/finalizer
- runtime context 已记录 profile/browser 解析结果

当前最值得审计的差异：

1. Team 没有显式调用 `setBrowserScopeRoute(scope, browserId)`。
2. Team 的 `runWithScopedAgentEnvironment()` 使用 `createBrowserCleanupScope(browserScope, browserId)` 生成的 scope，但 session factory 收到的是原始 `browserScope`。
3. Team cleanup callback 当前类型是 `(scope: string) => Promise<void>`，无法像 chat/conn 一样传 `{ browserId }`。
4. finally 中没有与 chat/conn 一致的 route clear 步骤。

这不是要新造系统，而是一个很具体的 parity 缺口。

## 5. 推荐设计

在 `AgentProfileRoleRunner.runSession()` 内收口出一个 canonical browser scope。

建议语义：

```ts
const roleBrowserScope = buildTeamBrowserScope({
  runId,
  role: roleContext.role,
  roleKey: roleContext.roleKey,
  profileId: snapshot.profileId,
});

const browserId = snapshot.defaultBrowserId ?? this.options.defaultBrowserId;
const browserCleanupScope = browserId
  ? createBrowserCleanupScope(roleBrowserScope, browserId)
  : roleBrowserScope;
```

然后同一个 `browserCleanupScope` 用于：

- `setBrowserScopeRoute(browserCleanupScope, browserId)`
- `sessionFactory.createSession({ browserId, browserScope: browserCleanupScope })`
- `runWithScopedAgentEnvironment(browserCleanupScope, ...)`
- `closeBrowserTargetsForScope(browserCleanupScope, browserId ? { browserId } : undefined)`
- finally 中 `setBrowserScopeRoute(browserCleanupScope, undefined)`
- `runtimeContext.browserScope`

这样 Team 与 chat/conn 的成熟链路一致：**一个 scope 贯穿 route、session、运行环境、cleanup、runtime context。**

注意：这可能会改变 P8-A 里 runtime context 展示的 scope 字符串形态，例如从：

```text
team:<runId>:worker:<attemptId>:<profileId>
```

变成经过 `createBrowserCleanupScope()` / `sanitizeStateId()` 后的 canonical cleanup scope。只要测试明确“同一 scope 贯穿成熟链路”，这是合理变化。

## 6. 任务拆分

### Task 1: 添加 Team browser route parity 失败测试

文件：

- 修改：`test/team-agent-profile-runner.test.ts`

新增测试覆盖：

1. `runWorker()` 使用 profile browser 时，会在 session 创建前写入 scope route。
2. session factory 收到的 `browserScope` 与 route scope 一致。
3. `runWithScopedAgentEnvironment` / cleanup 使用同一个 scope。
4. cleanup callback 收到 `{ browserId }`。
5. finally 中会清理 route：`setBrowserScopeRoute(scope, undefined)`。

建议测试名：

```ts
test("team role runner writes and clears browser scope route like background runner", async () => {
  // fake profile snapshot defaultBrowserId = "work-01"
  // fake sessionFactory captures createSession input
  // fake setBrowserScopeRoute captures calls
  // fake closeBrowserTargetsForScope captures scope + options
  // runWorker()
  // assert route calls: [{ scope, browserId: "work-01" }, { scope, browserId: undefined }]
  // assert createSession input.browserScope === scope
  // assert cleanup scope === scope
  // assert cleanup options.browserId === "work-01"
});
```

预期：

- 当前代码应该失败，因为 Team 没有调用 `setBrowserScopeRoute()`，cleanup callback 也没有 browserId 参数。

验证命令：

```powershell
node --test --test-concurrency=1 --import tsx test/team-agent-profile-runner.test.ts
```

### Task 2: 对齐 AgentProfileRoleRunner 的 scope route 生命周期

文件：

- 修改：`src/team/agent-profile-role-runner.ts`

实现要求：

1. 引入既有函数：

```ts
import { setBrowserScopeRoute } from "../browser/browser-scope-routes.js";
```

2. 扩展 options，方便测试注入：

```ts
setBrowserScopeRoute?: (scope: string, browserId: string | undefined) => Promise<void>;
closeBrowserTargetsForScope?: (scope: string, options?: { browserId?: string }) => Promise<void>;
```

3. 在 `runSession()` 中计算 canonical browser scope。

4. session 创建前写 route：

```ts
await setRoute(browserCleanupScope, browserId);
```

5. `sessionFactory.createSession()` 传入同一个 scope：

```ts
browserScope: browserCleanupScope,
```

6. prompt 执行使用同一个 scope：

```ts
await runWithScopedAgentEnvironment(browserCleanupScope, async () => { ... });
```

7. finally 中先 cleanup，再清 route；清 route 必须尽力执行，不能因为 cleanup 失败跳过。

建议结构：

```ts
try {
  await setRoute(browserCleanupScope, browserId);
  // create session + prompt
} finally {
  try {
    await closeBrowserTargets(browserCleanupScope, browserId ? { browserId } : undefined).catch(() => {});
  } finally {
    await setRoute(browserCleanupScope, undefined).catch(() => {});
  }
}
```

注意：

- 不要改 prompt。
- 不要改 JSON parsing。
- 不要改 workspace layout。
- 不要引入 browser pool / scheduler。

验证命令：

```powershell
node --test --test-concurrency=1 --import tsx test/team-agent-profile-runner.test.ts
```

### Task 3: 覆盖无 browserId fallback 行为

文件：

- 修改：`test/team-agent-profile-runner.test.ts`

新增或更新测试：

1. profile 无 `defaultBrowserId` 且 options 无 `defaultBrowserId` 时：
   - session 仍收到 browserScope
   - route 写入为 `setBrowserScopeRoute(scope, undefined)` 或不写入，二选一必须与 chat/conn 语义一致
   - cleanup 不传 `{ browserId }`
   - runtimeContext.browserId 为 `null`

推荐语义：

- 与 conn 对齐：仍调用 `setBrowserScopeRoute(scope, undefined)`，确保旧 route 不残留。

验证命令：

```powershell
node --test --test-concurrency=1 --import tsx test/team-agent-profile-runner.test.ts
```

### Task 4: 更新 runtime context / UI 相关测试

文件：

- 修改：`test/team-orchestrator-lifecycle.test.ts`
- 修改：`test/team-page-ui.test.ts`（只有在 scope 字符串断言受影响时）
- 修改：`test/team-types.test.ts`（只有类型签名受影响时）

检查点：

- `runtimeContext.browserScope` 应等于实际传给 session/route/cleanup 的 canonical scope。
- worker/checker/watcher/finalizer 仍然有不同 scope。
- 两个 worker attempts 仍然有不同 scope。
- UI 只展示字段，不依赖具体 scope 形态。

验证命令：

```powershell
npm run test:team
```

### Task 5: 文档和 change-log

文件：

- 修改：`docs/team-runtime.md`
- 修改：`docs/change-log.md`

文档必须写清：

1. P9 不是新浏览器隔离平台。
2. Team 复用 chat/conn 的成熟 browser binding 链路。
3. Team role runtime context 中的 `browserScope` 是 canonical scope，和 route/session/cleanup 一致。
4. 已知限制仍然存在：
   - browserId 指向哪个真实 CDP/Chrome profile，由既有 browser registry / env 配置决定。
   - Team 不负责创建或调度浏览器实例。

change-log 条目建议：

```markdown
## 2026-05-16 — P9: Team Browser Binding Parity

- **主题**: 对齐 Team role runner 与 chat/conn 的 browser scope route 生命周期
- **影响范围**: `src/team/agent-profile-role-runner.ts`, Team 测试, `docs/team-runtime.md`
- **变更**:
  - Team role session 使用同一个 canonical scope 贯穿 route、session、agent scope、cleanup、runtime context
  - 复用既有 `setBrowserScopeRoute()` / `ProjectBackgroundSessionFactory` / `prepareBrowserBoundBashEnvironment()` 链路
  - 不新增 browser provisioning、resource scheduler 或 sidecar 拓扑
- **测试**: `<真实结果>`
```

## 7. 验收命令

完成后至少运行：

```powershell
npm run test:team
npx tsc --noEmit
git diff --check
git status --short
```

如果只完成 Task 1/2 的中间提交，可先跑：

```powershell
node --test --test-concurrency=1 --import tsx test/team-agent-profile-runner.test.ts
```

## 8. 提交建议

建议 1 个或 2 个 commit，不要拆成花活：

```text
test(team): cover browser binding parity
fix(team): align browser scope route lifecycle
```

如果实现很小，也可以合并为：

```text
fix(team): align browser binding parity
```

提交边界：

- 应提交：
  - `src/team/agent-profile-role-runner.ts`
  - `test/team-agent-profile-runner.test.ts`
  - 受影响的 Team 测试
  - `docs/team-runtime.md`
  - `docs/change-log.md`
- 不应提交：
  - `.env`
  - `.data/`
  - `runtime/` 临时产物
  - 未确认来源的 `.pi/skills/*`
  - `skills-lock.json`
  - 无关 `.codex/plans/*`

## 9. 给执行 agent 的短消息

```text
请接手 `E:\AII\ugk-pi` 的 Team Runtime v2 P9：Team Browser Binding Parity。

先读：
1. `AGENTS.md`
2. `docs/team-runtime.md`
3. `docs/change-log.md`
4. `.codex/plans/2026-05-16-team-runtime-v2-p9-browser-binding-parity-plan.md`
5. `src/agent/agent-service.ts`
6. `src/agent/background-agent-runner.ts`
7. `src/agent/background-agent-session-factory.ts`
8. `src/browser/browser-bound-bash.ts`
9. `src/browser/browser-scope-routes.ts`
10. `src/team/agent-profile-role-runner.ts`

目标不是造新的浏览器隔离系统，而是让 Team role runner 与 chat agent / conn worker 复用同一条成熟 browser binding 链路。重点检查 `setBrowserScopeRoute()`、canonical browser scope、session `browserScope`、`runWithScopedAgentEnvironment()`、cleanup 和 runtime context 是否使用同一个 scope。

按 TDD 做：先补 `test/team-agent-profile-runner.test.ts` 的失败测试，再最小修改 `src/team/agent-profile-role-runner.ts`。不要改 prompt、JSON parsing、workspace layout、Docker sidecar、browser registry，也不要新增 browser scheduler / pool。

完成后运行：
- `npm run test:team`
- `npx tsc --noEmit`
- `git diff --check`

不要提交 `.env`、`.data/`、runtime 产物、未知 `.pi/skills/*`、`skills-lock.json`。
```
