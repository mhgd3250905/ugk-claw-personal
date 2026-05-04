# 后台任务选择专项 Agent 执行计划

> **执行前置：** 本计划只描述实现步骤。执行前需要用户明确确认，建议使用 `$do-plan` 按任务逐步落地。

**目标：** 让后台任务 `conn` 可以选择已创建的 Playground agent profile 作为执行 Agent，后台 run 只借用该 agent 的规则和技能能力，不写入该 agent 的前台会话历史。

**架构：** 复用现有 `ConnDefinition.profileId` 字段，将新任务的 `profileId` 明确解释为 Playground agent profile id。`conn-worker` 执行时优先解析该 agent profile，生成 run 级能力快照；如果 agent 不存在或已归档，则降级到默认 main-like 后台能力并记录可见 fallback 事件。

**技术栈：** TypeScript、Fastify、`pi-coding-agent`、SQLite-backed conn runtime、Playground 内联前端。

---

## 当前事实

- `ConnDefinition` 已包含 `profileId / agentSpecId / skillSetId / modelPolicyId / modelProvider / modelId / upgradePolicy`。
- `conn-worker` 当前通过 `BackgroundAgentProfileResolver` 解析 `.pi/background-agent` registry；缺省时使用 `background.default / agent.default / skills.default / model.default`。
- 缺省 `skills.default` 最终落到 `.pi/skills` 和 `runtime/skills-user`，效果上接近 `main`，但不是读取 Playground `main` agent profile 的能力快照。
- Playground agent profile 由 `src/agent/agent-profile.ts` 定义；`main`、`search` 和用户自定义 agent 都可通过 `GET /v1/agents` 暴露。
- 自定义 agent 的规则和技能在 `.data/agents/<agentId>/AGENTS.md`、`.data/agents/<agentId>/pi/skills`、`.data/agents/<agentId>/user-skills`。
- 后台 run 已有 `resolvedSnapshot` 存储口径，适合扩展记录请求 agent、实际 agent、fallback 原因和技能快照信息。

## 产品口径

- 后台任务选择“执行 Agent”，默认是 `main`。
- 后台任务只借用执行 Agent 的能力，不占用该 agent 的前台聊天会话。
- 后台 run 仍属于 `conn`，结果仍进入 run history、任务消息页和配置的飞书投递目标。
- 如果配置的 agent 不存在或已归档，run 不失败，降级到默认 `main` / main-like 能力执行。
- 降级必须可见：run event、run detail、任务消息摘要至少有一处提示“原执行 Agent 不可用，已用默认 Agent 执行”。

## 影响分析

### 直接影响

- `conn` 创建 / 编辑请求继续接受 `profileId`，但新语义变为执行 Agent id。
- `conn-worker` 的后台 session 创建不能再固定使用项目默认 agent dir 和默认 skills，需要根据 run snapshot 注入 `agentDir / runtimeAgentRulesPath / allowedSkillPaths`。
- `BackgroundAgentProfileResolver` 或新增 resolver 需要能读取 Playground agent profile 列表。
- `resolvedSnapshot` 类型需要扩展，但旧 run 读取必须兼容旧结构。

### 间接影响

- 任务消息页和 run detail 的展示需要识别 fallback 信息。
- agent 归档后，已绑定该 agent 的后台任务仍继续运行，但需要提示降级。
- `main` 与旧 `background.default` 的关系需要清楚：旧任务缺少 `profileId` 时保持 legacy default；新建任务默认写 `profileId: "main"`。

### 数据兼容

- 新增 snapshot 字段必须全部可选，避免旧 run 详情解析失败。
- 旧 `profileId: "background.default"` 任务不强制迁移。
- 现有 `profileId` 非 Playground agent id 时，先走兼容逻辑或 fallback，不能直接让任务失败。
- 前端打开旧任务时，无 `profileId` 显示为“主 Agent（默认）”。

## 实现任务

### Task 1: 补后台 agent profile 解析测试

**文件：**
- 修改：`test/conn-worker.test.ts` 或新增最接近现有 conn worker 测试的测试文件
- 修改：`src/agent/background-agent-profile.ts`

**步骤：**

1. 写失败测试：给定 `profileId: "search"`，resolver 能解析 Playground agent profile 的规则路径和 skill paths。
2. 写失败测试：给定不存在的 `profileId`，resolver 返回 fallback snapshot，而不是抛错中断 run。
3. 运行相关测试确认失败：`npm test -- test/conn-worker.test.ts` 或项目现有对应测试命令。
4. 最小实现 resolver 扩展：读取 `loadAgentProfilesSync(projectRoot)`，优先匹配 Playground agent profile。
5. fallback snapshot 记录：
   - `requestedAgentId`
   - `agentId`
   - `fallbackUsed`
   - `fallbackReason`
6. 运行相关测试确认通过。

### Task 2: 扩展后台能力快照结构

**文件：**
- 修改：`src/agent/background-agent-profile.ts`
- 修改：`src/agent/conn-run-store.ts`
- 修改：`src/types/api.ts`
- 修改：`src/routes/conn-route-presenters.ts`

**步骤：**

1. 给 `ResolvedBackgroundAgentSnapshot` 增加可选字段：
   - `requestedAgentId?: string`
   - `agentId?: string`
   - `agentName?: string`
   - `rulesPath?: string`
   - `skillPaths?: string[]`
   - `fallbackUsed?: boolean`
   - `fallbackReason?: "profile_not_found" | "profile_archived" | "legacy_profile"`
2. 保留旧字段 `profileId / agentSpecId / skillSetId / modelPolicyId`，避免旧 run 和旧测试崩。
3. 确认 `resolvedSnapshot` JSON 写入和读取不依赖固定字段集合。
4. 补 presenter/API 类型测试或断言，确保旧 snapshot 和新 snapshot 都能返回。
5. 运行：`npm test`。

### Task 3: 让后台 session factory 使用 snapshot 的 agent 配置

**文件：**
- 修改：`src/workers/conn-worker.ts`
- 修改：`src/agent/background-agent-runner.ts`
- 修改：`src/agent/agent-session-factory.ts`（如需要）

**步骤：**

1. 写失败测试：custom agent snapshot 的 `allowedSkillPaths` 会传入 `createSkillRestrictedResourceLoader()`。
2. 写失败测试：custom agent snapshot 的 `runtimeAgentRulesPath` 会作为 `agentsFilesOverride` 来源。
3. 修改 `ProjectBackgroundSessionFactory.createSession()`，从 snapshot 读取：
   - `agentDir`
   - `runtimeAgentRulesPath`
   - `skillPaths`
   - `provider`
   - `model`
4. 默认 fallback 仍使用现有项目默认配置。
5. 确认后台 run sessionFile 仍属于 run，不进入被选 agent 的 conversation index。
6. 运行：`npm test`。

### Task 4: 记录 fallback run event

**文件：**
- 修改：`src/agent/background-agent-runner.ts`
- 修改：`src/agent/conn-run-store.ts`（如事件类型测试需要）
- 修改：`test/conn-worker.test.ts` 或现有 runner 测试

**步骤：**

1. 写失败测试：当 snapshot `fallbackUsed=true` 时，run events 包含 `agent_profile_fallback`。
2. 事件内容包含：
   - `requestedProfileId`
   - `fallbackProfileId`
   - `reason`
3. 实现 runner 在 `snapshot_resolved` 后追加 fallback event。
4. 确保 fallback 不改变 run 成功 / 失败判断。
5. 运行相关测试。

### Task 5: 后端接口和任务列表展示执行 Agent 信息

**文件：**
- 修改：`src/routes/conns.ts`
- 修改：`src/routes/conn-route-presenters.ts`
- 修改：`src/types/api.ts`
- 修改：`test/server.test.ts`

**步骤：**

1. 写失败测试：`GET /v1/conns` 返回每个任务的 `profileId`，旧任务缺省仍正常。
2. 写失败测试：`GET /v1/conns/:connId/runs/:runId` 返回 `resolvedSnapshot` 中的实际执行 agent 和 fallback 信息。
3. 确认 `parseConnMutationBody()` 已接受 `profileId`，必要时只补语义测试，不做多余解析重构。
4. 运行：`npm test`。

### Task 6: Playground 创建 / 编辑后台任务增加执行 Agent 选择

**文件：**
- 修改：`src/ui/playground-conn-activity.ts`
- 修改：`src/ui/playground-conn-activity-controller.ts`
- 修改：`src/ui/playground.ts`（如装配入口需要）
- 修改：`docs/playground-current.md`
- 修改：`test/server.test.ts`

**步骤：**

1. 写失败断言：Playground HTML 包含执行 Agent 选择器的稳定标记。
2. 前端加载后台任务编辑器时请求或复用 `GET /v1/agents`。
3. 新建任务默认选择 `main`，提交时写 `profileId: "main"`。
4. 编辑旧任务无 `profileId` 时显示“主 Agent（默认）”。
5. 任务列表摘要显示“执行 Agent：<name>”。
6. run detail 正常显示“执行 Agent：<name>”；fallback 显示“原执行 Agent 不可用，已由主 Agent 完成”。
7. 更新 `docs/playground-current.md` 的后台任务当前口径。
8. 运行：`npm test`；涉及视觉 token 时再运行 `npm run design:lint`。

### Task 7: 文档和变更记录

**文件：**
- 修改：`docs/runtime-assets-conn-feishu.md`
- 修改：`docs/playground-current.md`
- 修改：`docs/change-log.md`

**步骤：**

1. 在 runtime 文档中补充 `conn.profileId` 新语义：执行 Agent id。
2. 写清楚后台任务不会写入被选 agent 的前台会话。
3. 写清楚 fallback 策略：不中断、降级执行、可见提示。
4. 在 change log 增加 `2026-05-04` 条目，列影响范围和源码入口。
5. 检查旧文档中“任务身份 / 执行模板 / 能力包”描述是否和新口径冲突；只改冲突处，不顺手重写整篇。

## 验证清单

- `npm test`
- 修改 UI 后检查 `test/server.test.ts` 中的 Playground HTML 断言。
- 修改视觉 token 后运行 `npm run design:lint`。
- 手动验证本地入口：
  - `GET http://127.0.0.1:3000/v1/agents`
  - `GET http://127.0.0.1:3000/v1/conns`
  - 创建选择 `search` 的后台任务，手动触发 run。
  - 临时让 `profileId` 指向不存在 agent，确认 run 继续执行且 run detail 有 fallback 提示。

## 成功标准

- 新建后台任务可以选择执行 Agent。
- 后台 run 使用被选 Agent 的规则文件和 scoped skills。
- 后台 run 不进入被选 Agent 的聊天历史。
- agent 不存在或归档时 run 降级到默认 Agent 执行，不失败。
- 降级行为在 run event、run detail 或任务消息中可见。
- 旧任务继续可读、可运行。

## 非目标

- 不做强隔离容器。
- 不把后台 run 写进 agent 前台 conversation。
- 不重构整个 `.pi/background-agent` registry。
- 不新增 `agentId` 与 `profileId` 双字段，避免语义打架。
- 不改变文件资产、飞书投递和任务消息的主流程。
