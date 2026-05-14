# Team Realtime Submit And Incremental Scheduler Implementation Plan

> **For coding agent:** 本计划是执行前计划文档。未获得用户确认前，只允许读代码和改计划文档，不要改 `src/` 实现。

**Goal:** 让 Team Runtime 中的 role agent 能在工作过程中提交阶段成果，让外部页面/API 能实时观察，并让下游 role 能基于新增 stream item 增量接力，而不是等上游整段任务结束。

**Architecture:** 先把 Team LLM 调用收口到项目统一模型配置，再把 stream 写入口统一成 `submitTeamStreamItem`，再把 role 外壳正规化为 `RoleBox`，随后加入 team event SSE 和 provider-api-type-aware submit tool spec。最后用一个最小 tracer bullet 实现 `discovery -> candidate_domains -> evidence_collector` 的增量接力，避免一口气重写成复杂分布式调度器。

**Tech Stack:** TypeScript, Fastify, Node test runner, existing `TeamWorkspace`, existing `TeamTemplate`, existing project model registry/settings (`runtime/pi-agent/models.json`, `UGK_MODEL_SETTINGS_PATH` / `.pi/settings.json`), Docker Compose runtime.

---

## 0. 设计立场

这不是为了“少重构”。Team 模块还处在开发期，必要的结构调整可以做，而且应该做。真正的约束是：每一处调整都必须服务于最终功能。

最终功能定义：

```text
Team Runtime 里任何 role 的阶段成果，必须能作为 stream item 被立即提交、立即校验、立即持久化、立即对外观察，并能触发下游 role 增量消费。
```

当前系统问题：

```text
role task 调 LLM
  -> LLM 返回完整 JSON envelope
  -> runner parse 后一次性返回 emits[]
  -> orchestrator 批量写 stream
  -> 下游 role 才开始
```

这仍然是串行 pipeline，不是真正 team。目标状态：

```text
discovery 工作中 submitCandidateDomain
  -> candidate_domains 立即落 stream
  -> events/SSE 立即可见
  -> evidence_collector 可消费新增 candidate
  -> classifier / reviewer 后续同理
```

---

## 1. 范围边界

### 本轮要做

- 建立统一 stream 提交入口。
- 建立 RoleBox，明确 role 的输入、输出、禁区、提交工具规格和 JSON envelope 兼容模式。
- 建立 submit tool spec 和 tool call 到 stream 的映射。
- 建立 Team run 事件实时观察入口。
- 做一个最小增量调度 tracer bullet：至少让 `candidate_domains` 的新增可以不等整条 run 完全结束就被观察，并为下游消费留下明确接口。
- 保留现有 JSON envelope 路径，避免一下子把当前可运行链路炸掉。

### 本轮不要做

- 不修改 `/v1/chat` 行为。
- 不修改 `conn-worker` 的业务语义。
- 不把 Team role task 写进 `conn_runs`。
- 不接 AssetStore。
- 不新增新的业务模板。
- 不把 UI 做成复杂流程编排器。
- 不实现全角色全并发的最终形态。先跑通一条上游到下游的 tracer bullet。

---

## 2. 总体分阶段

### Phase 0: Team 模型配置先收口到项目统一模型源

目标：Team Runtime 不再拥有一套独立的 DeepSeek 临时配置。项目主 Agent / Conn / Playground 用什么模型源，Team 就用什么模型源。

当前事实：

```text
项目有效默认模型:
  .pi/settings.json -> defaultProvider = deepseek, defaultModel = deepseek-v4-pro

项目模型注册:
  runtime/pi-agent/models.json -> provider deepseek 已调整为 api = anthropic-messages

用户确认后的正式目标:
  provider deepseek -> anthropic-messages
  baseUrl -> https://api.deepseek.com/anthropic
  models -> deepseek-v4-pro, deepseek-v4-flash
```

此前仓库模型注册和用户确认的目标存在分叉，本轮已把 DeepSeek registry 调整到 Anthropic-compatible。后续不要在 Team 模块里继续硬编码“DeepSeek 走 OpenAI-compatible”，也不要把 `deepseek-api.txt`、`deepseek.txt` 或任何 `*-api.txt` 临时文件当成正式配置源。正确原则是：

```text
provider vendor 不能决定调用协议。
provider.api / api type 才能决定调用协议。
Team 只消费项目已经生效的 provider/model/api/baseUrl/auth 配置。
```

修改：

```text
src/team/llm.ts
src/agent/model-config.ts 或新增 src/agent/model-runtime-config.ts
test/team-llm-config.test.ts
docs/model-providers.md
```

设计要求：

- Team LLM 配置必须从项目统一模型 registry/settings 派生：
  - registry: `runtime/pi-agent/models.json`
  - default selection: `UGK_MODEL_SETTINGS_PATH` 优先，其次 `.pi/settings.json`
  - auth env var: registry provider 的 `apiKey`
- Team 不再直接固定 `model: "deepseek-chat"`。
- Team 不再通过 `baseUrl.includes("/anthropic")` 推断协议。
- Team 调用协议必须来自 provider `api` 字段，例如：
  - `anthropic-messages`
  - `openai-completions`
- DeepSeek 在项目里走 Anthropic-compatible endpoint，`runtime/pi-agent/models.json` 的 `deepseek` provider 应保持为：

```json
{
  "baseUrl": "https://api.deepseek.com/anthropic",
  "api": "anthropic-messages",
  "apiKey": "DEEPSEEK_API_KEY"
}
```

也可以保留两个 provider id，但必须清楚命名，例如：

```text
deepseek-openai      -> openai-completions
deepseek-anthropic   -> anthropic-messages
```

当前用户明确要求“项目里面用什么，Team 也用什么”，所以推荐不要让 Team 自己选择 DeepSeek 分支，而是直接复用项目默认 provider/model。

验收测试：

- 当 settings 默认是 `deepseek/deepseek-v4-pro` 时，Team LLM config 解析到同一个 provider/model。
- 当 registry 的 `deepseek.api = anthropic-messages` 时，Team 调用 Anthropic messages 路径。
- 当 registry 的 `deepseek.api = openai-completions` 时，Team 调用 OpenAI-compatible chat completions 路径。
- 缺少 API key 时，错误信息包含 provider/model/env var，不再只说 `DEEPSEEK_API_KEY not found`。
- `src/team/llm.ts` 不再读取 `deepseek.txt`、`deepseek-api.txt` 或任何 `*-api.txt` 作为 Team 配置源。

---

### Phase 1: 统一提交口

目标：从 `TeamOrchestrator.processEmit()` 抽出唯一 stream 写入口。

新增：

```text
src/team/team-submit.ts
test/team-submit.test.ts
```

修改：

```text
src/team/team-orchestrator.ts
package.json
```

核心函数：

```ts
export async function submitTeamStreamItem(input: {
  workspace: TeamWorkspace;
  template: TeamTemplate;
  teamRunId: string;
  roleId: TeamRole["roleId"];
  producerTaskId: string;
  streamName: TeamStreamName;
  payload: unknown;
  seenCandidateDomains?: Set<string>;
}): Promise<SubmitTeamStreamItemResult>;
```

职责：

- 检查 role 是否允许写目标 stream。必须基于 `template.roles[].outputStreams`，不要退回硬编码权限表。
- 调用 `template.getStreamValidator(streamName)`。
- 校验 payload。
- 对 `candidate_domains` 做 normalizedDomain 去重。
- 生成 `TeamStreamItem`。
- 调用 `workspace.appendStreamItem()`。
- 返回 accepted/rejected 结果。

不负责：

- 不 emit event。
- 不 increment counter。
- 不 retry。
- 不决定 role task 成败。
- 不写 artifact。

`TeamOrchestrator` 仍负责：

- 根据 submit result 写 `stream_item_accepted` / `stream_item_rejected` / `stream_item_duplicate_skipped` event。
- 增加 state counters。
- cursor 推进。
- finalizer 判断。

验收测试：

- discovery 写合法 `candidate_domains` 被 accepted，并进入 workspace stream。
- reviewer 写 `candidate_domains` 被 rejected。
- discovery 写 `review_findings` 被 rejected。
- 非法 candidate payload 被 rejected。
- duplicate candidate 被 rejected 或 skipped，不进入 stream。
- 同一批 emits 内重复 candidate 也只能接受一次。
- rejected item 不进入 workspace。
- 现有 `npm run test:team` 行为不变。

---

## 3. Phase 2: RoleBox 模块

目标：把 role agent 外层壳子模块化，RoleBox 是角色运行契约，不是漂亮包装。

新增：

```text
src/team/role-box.ts
test/team-role-box.test.ts
```

RoleBox 第一版：

```ts
export type TeamRoleOutputMode = "json_envelope" | "submit_tool";

export interface TeamRoleBox {
  roleId: TeamRole["roleId"];
  prompt: string;
  allowedInputStreams: TeamStreamName[];
  outputStreams: TeamStreamName[];
  mustNotDo: string[];
  outputMode: TeamRoleOutputMode;
  submitTools: TeamSubmitToolSpec[];
  expectedEnvelope: {
    required: boolean;
    naturalLanguageCountsAsResult: false;
    checkpointRequired: boolean;
  };
}
```

关键设计调整：

不要让 RoleBox 接管 discovery 搜索、evidence 输入整理等业务流程。RoleBox 负责角色边界和输出契约；runner 仍负责准备 role-specific context。

推荐函数拆分：

```ts
export function buildRoleBox(input: {
  role: TeamRole;
  task: TeamRoleTaskExecutionInput;
  prompt: string;
}): TeamRoleBox;
```

而不是让 `buildRoleBox()` 自己根据 `roleId` 去搜集所有 prompt 所需上下文。原因很简单：Discovery prompt 需要 `searchContext`，这必须由 runner 在搜索完成后注入。

修改 `LLMTeamRoleTaskRunner`：

当前：

```text
runDiscovery -> buildDiscoveryPrompt -> callLLM
runEvidence -> buildEvidenceCollectorPrompt -> callLLM
...
```

改为：

```text
runDiscovery -> prepare searchContext -> buildDiscoveryPrompt -> buildRoleBox -> callLLM(roleBox.prompt)
runEvidence -> prepare candidates -> buildEvidenceCollectorPrompt -> buildRoleBox -> callLLM(roleBox.prompt)
...
```

这样不会伪装成“RoleBox 已经接管所有业务”，但 runner 不再绕过 RoleBox 契约。

验收测试：

- Discovery RoleBox:
  - `outputStreams = ["candidate_domains"]`
  - `submitTools = ["submitCandidateDomain"]`
  - prompt 包含自然语言不算结果的约束。
  - prompt 包含不能分类、不能判断归属、不能写报告。
- Reviewer RoleBox:
  - `outputStreams = ["review_findings"]`
  - `submitTools = ["submitReviewFinding"]`
  - prompt 包含不能新增事实 / 新域名的约束。
- Finalizer RoleBox:
  - `outputStreams = []`
  - `submitTools = []`
  - `mustNotDo` 包含不得新增事实。
- 所有 RoleBox:
  - `outputMode = "json_envelope"`。
  - `expectedEnvelope.required = true`。
  - `expectedEnvelope.naturalLanguageCountsAsResult = false`。

---

## 4. Phase 3: Submit Tool 规格预留

目标：定义未来真实 tool calling 要用的工具规格和映射，不接真实工具调用。

新增：

```text
src/team/team-submit-tools.ts
test/team-submit-tools.test.ts
```

定义：

```ts
export const TEAM_SUBMIT_TOOLS_BY_ROLE: Record<TeamRole["roleId"], TeamSubmitToolSpec[]>;

export function getSubmitToolsForRole(roleId: TeamRole["roleId"]): TeamSubmitToolSpec[];

export function mapSubmitToolToStream(input: {
  roleId: TeamRole["roleId"];
  toolName: TeamSubmitToolSpec["name"];
  arguments: unknown;
}): { ok: true; streamName: TeamStreamName; payload: unknown } | { ok: false; errors: string[] };
```

工具映射：

```text
discovery -> submitCandidateDomain -> candidate_domains
evidence_collector -> submitDomainEvidence -> domain_evidence
classifier -> submitClassification -> domain_classifications
reviewer -> submitReviewFinding -> review_findings
finalizer -> no submit tools
```

验收测试：

- discovery 只有 `submitCandidateDomain`。
- reviewer 只有 `submitReviewFinding`。
- finalizer 没有 submit tools。
- discovery 调 `submitReviewFinding` 被拒绝。
- reviewer 调 `submitCandidateDomain` 被拒绝。
- `mapSubmitToolToStream()` 返回正确 streamName 和 payload。

---

## 5. Phase 4: Team Event 实时观察

目标：让阶段成果不仅能被轮询读到，还能被外部页面/API 实时观察。

新增：

```text
src/team/team-event-hub.ts
test/team-event-hub.test.ts
```

修改：

```text
src/routes/team.ts
src/team/team-orchestrator.ts
src/ui/team-page.ts
test/team-routes.test.ts
test/team-page-ui.test.ts
```

新增接口：

```text
GET /v1/team/runs/:teamRunId/events/stream
```

语义：

- 使用 Server-Sent Events。
- 新订阅者先不强制回放全部历史，第一版可以只发 live events。
- 页面继续保留 `GET /events` 作为冷启动历史读取。
- 运行中有 `stream_item_accepted` 时，页面能立即收到并刷新对应 stream tab 或统计。

注意：

- `TeamWorkspace.appendEvent()` 仍是持久真源。
- `TeamEventHub` 只是在线广播层，不替代落盘。
- worker 和 main service 是不同容器/进程。第一版如果只在 main service 内存 hub 广播不到 worker 事件，就不能骗人说“实时”。因此要二选一：
  - 方案 A：worker 写入 event 后调用主服务内部 broadcast API。
  - 方案 B：SSE endpoint 做轻量 tailing/poll `events.jsonl`。

推荐第一版用方案 B：SSE endpoint 按 `events.jsonl` 增量 tail/poll。原因：不需要给 worker 新增反向 HTTP 配置，和当前 `.data/team` 文件真源一致，简单可靠。别为了“实时”两个字又搞一个会丢消息的内存 hub。

验收测试：

- `GET /v1/team/runs/:id/events/stream` 返回 SSE headers。
- 追加 event 后 SSE 客户端能收到新 event。
- 不存在 run 返回 404 或明确 error event。
- 页面包含事件流订阅逻辑。
- 页面断线后可以重新订阅，冷启动仍从 `GET /events` 恢复。

---

## 6. Phase 5: 真实 Submit Tool Calling 第一版

目标：让至少 Discovery role 能在 LLM 工作过程中调用 `submitCandidateDomain`，而不是只在最终 JSON 里批量 emits。

前提：

当前 `src/team/llm.ts` 只有：

```text
callLLM(config, prompt): Promise<string>
```

没有 tools 参数，没有 tool call loop。

前置要求：

```text
必须先完成 Phase 0。
真实 tool calling 的实现路径由 provider.api 决定，不能由 vendor 名称决定。
```

新增：

```text
src/team/llm-tool-loop.ts
test/team-llm-tool-loop.test.ts
```

第一版不要再写死“DeepSeek 走 OpenAI-compatible”。如果当前项目有效 provider 的 `api` 是 `anthropic-messages`，那 DeepSeek 就必须走 Anthropic messages tool use；如果当前项目有效 provider 的 `api` 是 `openai-completions`，才走 OpenAI-compatible `tool_calls`。

建议执行策略：

```text
先按当前有效 provider.api 实现一条真实路径。
如果本地/生产默认 DeepSeek 已调整为 anthropic-messages，第一版就先实现 Anthropic tool use。
OpenAI-compatible tool_calls 后续作为第二条 provider adapter 补齐。
```

如果为了降低风险，也可以先不接真实 provider tool calling，而先完成：

```text
submitTeamStreamItem + RoleBox + submit tool spec + SSE + JSON envelope fallback
```

但不能把这种状态宣传成“DeepSeek 已支持 tool calling”。那叫预留，不叫打通。别把架构图画得比代码诚实度高，丢人。

建议接口：

```ts
export async function callLLMWithTeamSubmitTools(input: {
  config: LLMConfig;
  roleBox: TeamRoleBox;
  submitToolHandler: (call: TeamSubmitToolCall) => Promise<TeamSubmitToolResult>;
}): Promise<{
  finalText: string;
  submitCallCount: number;
  rawMessages: unknown[];
}>;
```

工具调用处理流程：

```text
1. 发送 prompt + tools。
2. 如果模型返回 tool_calls：
   - 对每个 tool_call 调 mapSubmitToolToStream。
   - 调 submitTeamStreamItem。
   - 写 event。
   - 返回 tool result 给模型。
3. 继续请求模型。
4. 直到模型返回最终文本或达到 maxToolRounds。
```

安全限制：

- `maxToolRounds` 必须有上限，例如 12。
- 每次 tool call 必须走 `submitTeamStreamItem`。
- tool rejected 的结果也要返回给模型，让模型知道提交失败原因。
- 不允许 tool handler 直接写文件。
- 不允许 role 调不属于自己的 tool。

先接 Discovery：

```text
discovery LLM -> submitCandidateDomain -> candidate_domains stream
```

Evidence / Classifier / Reviewer 可以先保留 JSON envelope，等 Discovery tracer bullet 稳定后再扩展。

验收测试：

- 模拟 OpenAI-compatible `tool_calls` 响应，Discovery tool call 被提交到 stream。
- role/tool 不匹配被拒绝。
- invalid payload 被拒绝并作为 tool result 返回。
- maxToolRounds 超限后 role task failed。
- 没有 tool_calls 时回退到普通 final text / JSON envelope 解析。

---

## 7. Phase 6: 增量接力 Tracer Bullet

目标：证明“一个 agent 工作时其他 agent 不必傻等”这件事在架构上成立。

不要一口气做全并发 graph scheduler。先做最小闭环：

```text
Discovery submitCandidateDomain(candidate A)
  -> candidate_domains stream accepted
  -> evidence_collector 能消费 candidate A
  -> domain_evidence stream accepted
```

建议改造方向：

### 方案 A：保守增量 tick

每次 worker tick 仍是同步流程，但 Discovery tool call 提交后，当前 tick 可以重新评估 ready tasks。

流程：

```text
run discovery role with submit handler
  -> each accepted candidate updates stream
after discovery tool loop returns or reaches checkpoint
  -> same tick 读取 streams/cursors
  -> evidence_collector 消费新 candidate
```

优点：改动小，风险低。

缺点：Evidence 仍要等 Discovery 当前 tool loop 返回，不能做到真正同时运行。

### 方案 B：cooperative incremental runner

让 role runner 支持 async iterable：

```ts
runTaskStream(task): AsyncIterable<TeamRoleTaskDelta>
```

Discovery 每个 tool call 产出一个 delta，orchestrator 每接受一个 delta 后可立即调度下游。

优点：更接近真正协作。

缺点：改动更大，测试复杂。

### 方案 C：进程内并发 role tasks

worker 内维护 active role task promises，stream item 到达后触发下游 role task。使用 `TEAM_MAX_CONCURRENT_ROLE_TASKS` 控制并发。

优点：最终形态最像 team。

缺点：需要 role task 状态持久化、lease、崩溃恢复，否则 worker 重启会丢正在执行的任务。

推荐执行顺序：

```text
先做 A，验明真实功能闭环。
再评估是否上 B。
C 暂不做，除非我们准备设计 durable role task store。
```

验收：

- 创建 run 后，Discovery 通过 submit tool 写入 candidate。
- 页面 `/playground/team` 在 run 未完成时能看到 candidate stream 更新。
- 同一 run 后续能生成 evidence stream。
- cursor 不吞 item。
- 重复 candidate 不触发重复 evidence。

---

## 8. Phase 7: UI 最小支持

目标：让用户看见“边工作边出阶段结果”，但 UI 不做复杂流程编辑器。

修改：

```text
src/ui/team-page.ts
test/team-page-ui.test.ts
```

功能：

- 页面加载 run detail 后订阅 `events/stream`。
- 收到 `stream_item_accepted`：
  - 刷新当前 active stream。
  - 刷新 counters。
  - 在 Events tab 加一条新事件。
- run 未完成时展示 `实时接收中` 状态。
- 断线时展示 `事件流已断开，正在使用手动刷新`。

不做：

- 不做甘特图。
- 不做可视化 graph 编辑。
- 不做复杂 diff。
- 不把每个 stream item 做成大型卡片墙。

---

## 9. Phase 8: 文档和运行口径

修改：

```text
docs/team-runtime.md
docs/playground-current.md
docs/traceability-map.md
docs/change-log.md
```

必须写清：

- JSON envelope 是 submit tool 前的兼容提交方式。
- `submitTeamStreamItem` 是 Team stream 唯一正式提交口。
- 实时事件是观察层，不是持久真源。
- 第一版增量接力只覆盖 tracer bullet，不等于完整并发 scheduler。
- 未来要做 durable scheduler 时，需要 role task lease/store，不要用内存 promise 冒充生产级调度。

---

## 10. 验证命令

每个 phase 局部验证：

```powershell
npx tsc --noEmit
node --test --import tsx test/team-submit.test.ts
node --test --import tsx test/team-role-box.test.ts
node --test --import tsx test/team-submit-tools.test.ts
node --test --import tsx test/team-routes.test.ts test/team-page-ui.test.ts
npm run test:team
```

最终全量验证：

```powershell
git diff --check
npx tsc --noEmit
npm run test:team
npm run test:team-lab
npm test
npm run design:lint
```

Docker 验证：

```powershell
docker compose up -d
docker compose restart ugk-pi ugk-pi-team-worker
docker compose ps
Invoke-WebRequest -Uri http://127.0.0.1:3000/healthz -UseBasicParsing
Invoke-WebRequest -Uri http://127.0.0.1:3000/playground/team -UseBasicParsing
Invoke-WebRequest -Uri http://127.0.0.1:3000/v1/team/templates -UseBasicParsing
```

真实链路验证：

```text
1. 打开 /playground/team。
2. 创建 Brand Domain Discovery run。
3. 确认 run 运行中时 stream / events 能刷新。
4. 确认 completed 后 final_report.md 正常。
5. 重启 ugk-pi 后，GET /v1/team/runs?scope=all 仍能看到历史 run。
```

---

## 11. 建议提交切片

### Commit 1: team: add unified stream submit gate

- 新增 `team-submit.ts`
- 新增 `team-submit.test.ts`
- orchestrator 改为调用 submit gate
- 不改 LLM 行为

### Commit 2: team: add role box contract

- 新增 `role-box.ts`
- 新增 `team-role-box.test.ts`
- runner 通过 RoleBox 获取 prompt 契约

### Commit 3: team: define submit tool specs

- 新增 `team-submit-tools.ts`
- 新增 `team-submit-tools.test.ts`
- RoleBox 从 submit tool registry 取工具规格

### Commit 4: team: expose live run events

- 新增 event stream/tail 机制
- 新增 route 测试
- Team page 订阅 events stream

### Commit 5: team: support discovery submit tool loop

- 新增 `llm-tool-loop.ts`
- Discovery role 接入 `submitCandidateDomain`
- 保留 JSON envelope fallback

### Commit 6: team: add incremental discovery-to-evidence tracer

- 当前 tick 内基于新增 candidate 触发 evidence 消费
- 不实现完整 durable scheduler

### Commit 7: docs: document realtime submit boundary

- 更新 Team Runtime 文档、Playground 当前状态、追溯地图、change-log

---

## 12. 执行前需要用户确认的决策

### 决策 1：Team 模型配置来源

推荐：

```text
Team 必须复用项目统一模型配置。
项目默认 provider/model/api 是什么，Team 就用什么。
不要在 Team 里单独读 `deepseek-api.txt`、`deepseek.txt` 或固定 `deepseek-chat`。
```

原因：用户已经明确要求“项目里面用什么，Team 也用什么”。这也是正确架构。否则主 Agent、Conn、Team 三套模型配置迟早互相打架。

### 决策 2：DeepSeek 在项目里的 API type

推荐：

```text
按用户确认的正式目标调整项目 registry：
deepseek -> anthropic-messages
baseUrl -> https://api.deepseek.com/anthropic
models -> deepseek-v4-pro / deepseek-v4-flash
```

原因：用户提供的本地 DeepSeek 配置就是 Anthropic-compatible endpoint；本轮已把 `runtime/pi-agent/models.json` 调整为 `anthropic-messages`，后续不要回退成按厂商名硬编码。

### 决策 3：第一版 tool calling 支持范围

推荐：

```text
以当前项目有效 provider.api 为准。
如果 DeepSeek 调整为 anthropic-messages，第一版优先实现 Anthropic messages tool use。
OpenAI-compatible tool_calls 后补。
```

原因：tool calling 是协议能力，不是厂商能力。按厂商硬编码会让 Team 的模型层继续烂下去。

### 决策 4：第一版增量接力强度

推荐：

```text
先做保守增量 tick，不做 durable 并发 scheduler。
```

原因：我们现在要证明能力闭环，不要先建一个半吊子的任务调度平台。真正并发需要 role-task store / lease / recovery，那是下一阶段。

### 决策 5：实时观察实现方式

推荐：

```text
SSE endpoint tail/poll events.jsonl。
```

原因：worker 和 app 是不同进程/容器，内存 event hub 收不到 worker 事件。tail/poll 文件虽然朴素，但不骗人，和当前 workspace 真源一致。

---

## 13. 成功标准

这轮完成后，必须能真实证明：

```text
1. role 的阶段产物不再只能靠最终 JSON envelope 批量进入 stream。
2. submitTeamStreamItem 是唯一正式 stream 提交口。
3. 页面/API 能在 run 运行中看到 stream_item_accepted 事件。
4. Discovery 的 submitCandidateDomain 能把候选域名写入 stream。
5. Evidence Collector 能基于 candidate stream 增量消费。
6. 旧 JSON envelope 路径仍可用。
7. 现有 /v1/chat、conn-worker、agent profile 行为不变。
```

如果只做完 RoleBox 和 submit tool spec，但没有第 3-5 条，就不能宣称“支持边工作边对外发阶段结果”。那只是打了地基，还没盖门。
