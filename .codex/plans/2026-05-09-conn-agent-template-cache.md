# Conn Agent Template Cache 调研与实施计划

日期：2026-05-09

## 背景

当前 `conn` 后台任务通过 `profileId` 选择执行 Agent。每次 run 启动时，`BackgroundAgentRunner` 调用 `BackgroundAgentProfileResolver.resolve()`，现场读取 Agent profile、runtime rules、skill paths、skills、默认模型和默认浏览器，然后生成 `ResolvedBackgroundAgentSnapshot`，再创建独立后台 session 执行任务。

这个模型是正确的：`conn` 绑定的是 Agent 源配置引用，run 启动时冻结实际执行快照，运行中的任务不依赖之后的 profile 变化。

可优化点在于：每次 run 都重复解析同一套 Agent 定义，尤其是扫描 skill 文件和计算 skill version/hash。用户希望前台维护的几个 Agent 可以长期保有“模板”，变更时失效并重建，`conn` 调用时用最快速度创建临时后台 Agent。

本计划只调研与制定方案，不修改源码实现。

## 术语

- `AgentProfile`：用户维护的 Agent 源配置，例如“知乎助手”“小红书助手”。
- `AgentTemplate`：由 `AgentProfile` 构建出的后台可用模板；可缓存、可原子替换，但不是运行态。
- `AgentTemplateRegistry`：负责模板构建、缓存、失效、原子替换和懒加载。
- `AgentTemplateVersion`：模板版本/hash，用于判断过期和追溯。
- `ConnDefinition`：后台任务定义，保存 `profileId`、`browserId`、`prompt`、调度和投递目标。
- `ConnRun`：某次后台任务运行记录。
- `BackgroundAgentSnapshot`：某次 run 启动时从模板冻结出的实际执行快照；当前代码名为 `ResolvedBackgroundAgentSnapshot`。
- `BackgroundAgentInstance`：某次 run 由 snapshot 创建出的临时后台执行实例；代码中不一定需要实体类。
- `BrowserBinding`：配置层浏览器绑定，包括 `AgentProfile.defaultBrowserId` 与 `ConnDefinition.browserId`。
- `EffectiveBrowserId`：某次 run 最终实际使用的浏览器，解析顺序为 conn -> agent template -> browser registry default。

核心模型：

```text
conn 绑定 AgentProfile
AgentProfile 构建 AgentTemplate
ConnRun 启动时从当前 AgentTemplate 冻结 BackgroundAgentSnapshot
BackgroundAgentSnapshot 创建一次性 BackgroundAgentInstance 执行任务
```

## 当前链路

主要入口：

- `src/agent/conn-store.ts`：`ConnDefinition` 类型。
- `src/agent/conn-sqlite-store.ts`：`profileId` / `browserId` 落库和更新。
- `src/routes/conns.ts`：`POST /v1/conns`、`PATCH /v1/conns/:connId`、`POST /v1/conns/:connId/run`。
- `src/workers/conn-worker.ts`：独立 worker 轮询、claim due run、heartbeat、超时、通知。
- `src/agent/background-agent-runner.ts`：创建 workspace、解析 snapshot、设置 browser scope、创建后台 session、执行 prompt、记录 output。
- `src/agent/background-agent-profile.ts`：根据 `profileId` 解析 Playground Agent 或 legacy background registry。
- `src/agent/agent-profile-catalog.ts`：Agent profile 创建、更新、归档、技能增删。
- `src/routes/chat.ts`：`/v1/agents`、`/v1/agents/:agentId`、`/skills`、`/rules` 等 Agent 变更入口。
- `src/agent/agent-session-factory.ts`：已有前台 skill fingerprint 缓存，但不覆盖后台 profile template。

当前测试覆盖：

- `test/background-agent-profile.test.ts`
- `test/background-agent-runner.test.ts`
- `test/conn-worker.test.ts`
- `test/conn-sqlite-store.test.ts`
- `test/chat-agent-routes.test.ts`
- `test/agent-session-factory.test.ts`

## 影响面

### 直接影响

- `BackgroundAgentProfileResolver.resolve()`：应从“每次全量解析”演进为可由模板 registry 提供 snapshot。
- `BackgroundAgentRunner`：应继续只依赖 resolver 接口，不感知缓存细节；避免把模板管理散进 runner。
- `conn-worker`：是独立进程，模板缓存必须在 worker 进程内可用；不能只在前台 server 内存中维护。
- `resolvedSnapshot` 写入：必须继续写入 run，且应增加或保留模板版本信息，方便追溯。

### 间接影响

- Agent 创建 / 编辑 / 归档 / 技能增删 / rules 修改后，下一次后台 run 应读取新模板。
- 正在运行的 `ConnRun` 不受模板变更影响。
- 模板构建失败时不能污染旧模板；应保留旧模板给后续 run，或按现有 resolver 降级/失败规则处理。
- `browserId` 解析不能退回旧问题：conn 显式浏览器优先，其次 Agent 默认浏览器，其次 registry 默认浏览器。
- 不应改变前台 Agent conversation、active run、interrupt、session history 机制。

### 数据结构兼容性

- `conns` 表不需要新增字段。
- `conn_runs.resolved_snapshot_json` 可兼容增加字段，例如 `templateVersion`、`templateResolvedAt`、`templateSource`；旧数据没有这些字段时前端必须照常展示。
- 不建议新增持久化模板表。第一阶段使用进程内缓存即可，重启后自动重建。

## 推荐架构

### 新增模块

建议新增：

- `src/agent/agent-template.ts`
- `src/agent/agent-template-registry.ts`

`AgentTemplate` 只保存可复用定义，不保存 session/workspace/history：

```ts
interface AgentTemplate {
  agentId: string;
  agentName?: string;
  defaultBrowserId?: string;
  agentDir?: string;
  rulesPath?: string;
  skillPaths: string[];
  skills: SkillFile[];
  provider: string;
  model: string;
  version: string;
  builtAt: string;
  fallbackUsed?: boolean;
  fallbackReason?: string;
}
```

`AgentTemplateRegistry` 负责：

- `getTemplate(profileId, ref)`：返回当前可用模板。
- `invalidate(agentId)`：标记失效。
- `rebuild(agentId)`：先构建新模板，成功后原子替换旧模板。
- `clear()`：测试和进程关闭辅助。

原子替换规则：

```text
旧模板 v1 可继续被已启动 run 使用
构建新模板 v2
v2 构建成功后替换 map 指针
构建失败则继续保留 v1
新 run 只拿当前 map 指针里的模板
```

### Resolver 改造

保留现有 `BackgroundAgentProfileResolver` 对外接口，内部改为：

```text
resolve(ref)
  -> templateRegistry.getTemplate(ref.profileId, ref)
  -> merge conn-level model override
  -> produce BackgroundAgentSnapshot
```

不要让 `BackgroundAgentRunner` 直接依赖 `AgentTemplateRegistry`。runner 只需要 `profileResolver.resolve()`，这能保持解耦。

### 失效策略

主动失效入口：

- `POST /v1/agents`
- `PATCH /v1/agents/:agentId`
- `POST /v1/agents/:agentId/archive`
- `POST /v1/agents/:agentId/skills`
- `DELETE /v1/agents/:agentId/skills/:skillName`
- `PATCH /v1/agents/:agentId/rules`

但由于 `conn-worker` 是独立进程，主动失效不能只靠 server 内存事件。第一阶段建议采用“版本指纹懒校验”：

- 每次 `getTemplate()` 先计算轻量 profile signature。
- 如果 signature 与缓存一致，直接返回缓存模板。
- 如果 signature 不一致，重建模板并原子替换。

signature 应覆盖：

- profile summary：`agentId/name/description/defaultBrowserId`
- archived 状态
- `runtimeAgentRulesPath` 文件内容或 mtime+size+hash
- `allowedSkillPaths`
- 每个 `SKILL.md` 的相对路径和内容 hash
- 默认模型配置来源：`UGK_MODEL_SETTINGS_PATH` / `.pi/settings.json`
- legacy background registry 文件：`.pi/background-agent/*.json`

注意：为了真正加速，signature 不能和完整模板构建一样重。可以分阶段：

1. 第一版用内容 hash，保证正确性。
2. 后续如果仍慢，再引入 mtime/size 快速路径。

## 分阶段实施

### 阶段 1：重命名语义与测试护栏

目标：不改变行为，先把核心语义固定。

- 保留 `ResolvedBackgroundAgentSnapshot` 类型名，暂不大改全仓命名。
- 在文档和测试名里明确 `BackgroundAgentSnapshot` 语义。
- 补测试确认：
  - running run 使用启动时 snapshot，不受后续 resolver 返回变化影响。
  - conn `browserId` 仍优先于 Agent 默认浏览器。
  - fallback 事件和 task activity 文案不变。

验证：

- `npx tsc --noEmit`
- `node --test --test-isolation=none --import tsx test/background-agent-profile.test.ts test/background-agent-runner.test.ts test/conn-worker.test.ts`

### 阶段 2：引入 AgentTemplate 与 Registry

目标：新增模块，但 runner 外部行为不变。

- 新增 `AgentTemplate` / `AgentTemplateRegistry`。
- 将 `BackgroundAgentProfileResolver` 中的 Playground Agent 解析逻辑抽成模板构建函数。
- `resolve()` 从模板生成 snapshot。
- 保持 legacy background registry 支持。
- 模板构建失败时：
  - 如果存在旧模板，继续使用旧模板并记录 warn。
  - 如果不存在旧模板，沿用现有错误 / fallback 行为。

验证：

- 新增 `test/agent-template-registry.test.ts`
- 覆盖缓存命中、失效重建、构建失败保留旧模板、缺失 Agent fallback。
- 跑阶段 1 测试。

### 阶段 3：Worker 侧懒刷新与版本追溯

目标：让独立 `conn-worker` 进程自己获得缓存收益。

- `conn-worker` 创建 `BackgroundAgentProfileResolver` 时注入 registry。
- 每次 run 启动时按 signature 懒刷新。
- snapshot 增加可选字段：
  - `templateVersion`
  - `templateBuiltAt`
  - `templateSource`
- run detail 前端不必第一阶段展示；先保证 API 兼容。

验证：

- `test/background-agent-runner.test.ts` 增加 snapshot version 断言。
- `test/conn-worker.test.ts` 增加连续 run 复用模板 / Agent 变更后新 run 用新模板。

### 阶段 4：接入主动失效提示

目标：server 变更 Agent 后，当前 server 进程内缓存立即失效；worker 仍靠 signature 兜底。

- 在 `/v1/agents...` route 成功变更后调用 `agentTemplateRegistry.invalidate(agentId)`。
- 由于 worker 不在同一进程，不依赖这个通知保证正确性。
- 可选：后续通过 SQLite / 文件事件做跨进程主动通知，但第一阶段不做，避免复杂化。

验证：

- `test/chat-agent-routes.test.ts` 增加 fake registry invalidate 断言。
- 保证 Agent 创建/编辑/归档/技能增删/rules 修改原行为不变。

### 阶段 5：文档与观测

- 更新 `docs/runtime-assets-conn-feishu.md`，说明模板、快照、实例的关系。
- 更新 `docs/change-log.md`。
- 可选在 run event `snapshot_resolved` 中加入 `templateVersion`，方便排查。

## 风险与控制

### 风险 1：缓存过期导致 conn 没有使用新 Agent 配置

控制：

- 第一版 signature 用内容 hash，宁愿慢一点也不要错。
- Agent 变更 route 主动 invalidate。
- worker 侧不依赖 server 通知，独立懒校验。

### 风险 2：运行中任务被模板变化影响

控制：

- run 启动后只使用 `BackgroundAgentSnapshot`。
- 不缓存 session / workspace / resourceLoader 实例。
- 测试覆盖 resolver 后续变化不影响已启动 run。

### 风险 3：模板构建失败把旧模板替换成坏模板

控制：

- 新模板构建成功后才替换 map 指针。
- 构建失败保留旧模板。
- 首次构建失败才按现有 fallback/失败语义处理。

### 风险 4：前台 Agent 和后台 worker 失效状态不一致

控制：

- 主动 invalidate 只作为优化。
- worker 每次 run 按 signature 懒刷新，保证最终正确。

### 风险 5：代码耦合变重

控制：

- `BackgroundAgentRunner` 只依赖 resolver interface。
- `AgentTemplateRegistry` 不依赖 conn、run、worker。
- `ConnDefinition` 不引用模板对象，只保存 `profileId`。

## 不做的事

- 不缓存活的 Agent session。
- 不复用 workspace/history/conversation。
- 不改变 conn 数据表结构。
- 不改变现有浏览器路由顺序。
- 不把 worker 依赖前台 server 的内存事件。
- 不引入 Docker / Chrome 生命周期管理变更。

## 建议验证矩阵

最小验证：

```bash
npx tsc --noEmit
node --test --test-isolation=none --import tsx test/agent-template-registry.test.ts test/background-agent-profile.test.ts test/background-agent-runner.test.ts test/conn-worker.test.ts test/chat-agent-routes.test.ts
```

完整验证：

```bash
npm test
git diff --check
```

行为验收：

1. 创建 conn，选择“知乎助手”，浏览器跟随 Agent，手动运行，确认 run detail 的执行 Agent / 浏览器正确。
2. 修改“知乎助手”的默认浏览器，重新运行同一 conn，确认新 run 使用新默认浏览器。
3. 在一个长 run 执行中修改 Agent rules，确认当前 run 不受影响，下一次 run 使用新 rules。
4. 删除或归档执行 Agent，确认下一次 run fallback 到 main 并记录 `agent_profile_fallback`。
5. 连续触发同一 Agent 的多个 conn，确认模板缓存命中且输出、workspace、activity 仍彼此隔离。

## MCP 同步状态

本轮调用 MCP 资源列表返回空，没有可写 MCP 资源可同步。计划已落地到本地 `.codex/plans/2026-05-09-conn-agent-template-cache.md`。
