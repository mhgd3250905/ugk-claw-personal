# Team Runtime v0.1 — 交接文档

## 一句话概述

给定一个品牌关键词（如 "Medtrum"），系统自动搜索相关域名，判断每个域名是官方的、第三方的还是可疑的，最终生成调查报告。

## 项目当前状态

- Team Runtime 模块测试 **132 个通过**，0 失败
- Docker 全服务运行正常（main server + 3 Chrome sidecars + conn-worker + feishu-worker + team-worker + SearXNG）
- Team Runtime 已用真实关键词验证通过
- 已有独立 Playground 页面：`/playground/team`，创建 run 时右侧会按当前模板动态渲染角色卡片；每个角色卡片可选择已有 Agent profile，也可在运行前编辑该角色 prompt

## 怎么跑起来

### Docker 一键启动

```bash
docker compose up -d
```

等 Chrome sidecar 健康检查通过后（约 30s），所有服务就绪。访问 `http://127.0.0.1:3000`。

### Playground 页面

访问 `http://127.0.0.1:3000/playground/team` 可以打开 Team Runtime 独立工作台。主 `/playground` 顶部也有 `Team Runtime` 入口，行为和 `/playground/conn`、`/playground/agents` 的独立页面一致。

页面启动时会读取：

- `GET /v1/team/templates`
- `GET /v1/team/runs?scope=all`

`GET /v1/team/templates*` 会返回每个模板声明的 `roles`，Playground 右侧“角色配置”区按 `roles` 动态生成卡片，不再在左侧硬编码五个角色下拉框。创建 run 时会调用 `POST /v1/team/runs`，并把当前选择的 `templateId`、角色 Agent 绑定 `roleProfileIds`、以及用户改过的 `rolePromptOverrides` 一起提交。运行详情继续读取 run detail、events、streams 和 artifacts，不在前端硬编码某一条模板流程。

### 跑测试

```bash
npm test                              # 全量测试
npm run test:team                     # Team Runtime 模块测试（workspace, gate, template, orchestrator, route）
npx tsc --noEmit                      # 类型检查
```

## 怎么测试 Team Runtime

### 创建一个调查

```bash
curl -s -X POST http://127.0.0.1:3000/v1/team/runs \
  -H "Content-Type: application/json" \
  -d '{"keyword":"Medtrum","companyNames":["Medtrum","上海移宇科技"],"maxRounds":1}'
```

返回 `teamRunId`，worker 会自动处理。

### 查看结果

```bash
# 运行状态
curl -s http://127.0.0.1:3000/v1/team/runs/<RUN_ID> | jq .state.status

# 各 stream 数据量
curl -s http://127.0.0.1:3000/v1/team/runs/<RUN_ID>/streams/candidate_domains | jq '.items | length'
curl -s http://127.0.0.1:3000/v1/team/runs/<RUN_ID>/streams/domain_evidence | jq '.items | length'
curl -s http://127.0.0.1:3000/v1/team/runs/<RUN_ID>/streams/domain_classifications | jq '.items | length'
curl -s http://127.0.0.1:3000/v1/team/runs/<RUN_ID>/streams/review_findings | jq '.items | length'

# 最终报告
curl -s http://127.0.0.1:3000/v1/team/runs/<RUN_ID>/artifacts/final_report.md

# 事件日志
curl -s http://127.0.0.1:3000/v1/team/runs/<RUN_ID>/events | jq '.events[].eventType'

# Worker 日志
docker compose logs -f ugk-pi-team-worker
```

`final_report.md` 默认由已有 `finalizer` 角色调用 LLM 生成中文 Markdown。模板里的中文报告生成逻辑只做 fallback：如果 finalizer 返回空内容或失败，系统仍会产出可读报告，不会让 run 卡在没有 artifact 的尴尬状态。

### API 一览

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/v1/team/healthz` | 健康检查 |
| GET | `/v1/team/templates` | 列出已注册 TeamTemplate |
| GET | `/v1/team/templates/:templateId` | 查看单个模板 metadata / inputSchema |
| POST | `/v1/team/runs` | 创建调查 run |
| GET | `/v1/team/runs` | 列出可运行的 run，供 worker 轮询 |
| GET | `/v1/team/runs?scope=all` | 列出全部可读 run id，供 `/playground/team` 刷新历史 |
| GET | `/v1/team/runs/:id` | 查看状态和计划 |
| GET | `/v1/team/runs/:id/events` | 事件日志 |
| GET | `/v1/team/runs/:id/events/stream` | Server-Sent Events 实时订阅 run 新事件，基于 `events.jsonl` 增量 tail |
| GET | `/v1/team/runs/:id/streams/:name` | 查看某个 stream 的数据 |
| GET | `/v1/team/runs/:id/artifacts/:name` | 下载产物（报告等） |

## 架构

```
POST /v1/team/runs {keyword: "Medtrum"}
         │
         ▼
  ┌─── team-worker (轮询) ───┐
  │                            │
  │  TeamOrchestrator.tick()   │
  │  ┌──────────────────────┐  │
  │  │ Discovery            │──┼──→ candidate_domains stream
  │  │ (SearXNG搜索 + LLM)  │  │     （发现的候选域名）
  │  └──────────────────────┘  │
  │  ┌──────────────────────┐  │
  │  │ Evidence Collector   │──┼──→ domain_evidence stream
  │  │ (LLM 分析域名特征)   │  │     （每个域名的证据）
  │  └──────────────────────┘  │
  │  ┌──────────────────────┐  │
  │  │ Classifier           │──┼──→ domain_classifications stream
  │  │ (LLM 分类)           │  │     （分类结果）
  │  └──────────────────────┘  │
  │  ┌──────────────────────┐  │
  │  │ Reviewer             │──┼──→ review_findings stream
  │  │ (LLM 独立审查)       │  │     （审核意见）
  │  └──────────────────────┘  │
  │  ┌──────────────────────┐  │
  │  │ Finalizer            │──┼──→ final_report.md
  │  │ (生成报告)           │  │     （最终报告）
  │  └──────────────────────┘  │
  └────────────────────────────┘
```

`POST /v1/team/runs` 兼容两种创建方式：

```json
{"keyword":"Medtrum"}
```

默认创建 `brand_domain_discovery`。需要指定模板时传 `templateId`：

```json
{"templateId":"competitor_domain_discovery","keyword":"Medtrum","companyNames":["Dexcom","Abbott"]}
```

未知模板返回 `400`，不会静默回退到默认模板。

Team run 创建请求可预先绑定角色到已有 Agent profile：

```json
{
  "keyword": "Medtrum",
  "roleProfileIds": {
    "discovery": "TeamAgent",
    "evidence_collector": "TeamAgent"
  }
}
```

也可以在创建 run 时为某个角色覆盖默认 prompt：

```json
{
  "keyword": "Medtrum",
  "rolePromptOverrides": {
    "discovery": "优先使用浏览器搜索、官网页脚、第三方目录和公司资料交叉找候选域名。",
    "evidence_collector": "每查完一个域名立刻提交 evidence，不要等批量完成。"
  }
}
```

`rolePromptOverrides` 只接受模板已声明的 roleId，空字符串和未知 role 会被忽略。执行时系统会把用户 prompt 放在默认角色契约前面，同时保留 RoleBox、submit tool、allowed streams 和最终输出格式约束；所以它是“改角色做事风格”，不是绕过 Team 边界。

所有 Team 角色都支持 Agent profile 执行化：当 `roleProfileIds.<roleId>` 绑定到已有 Agent profile 时，team-worker 会像 conn 后台任务一样 resolve profile snapshot，并按该 profile 的模型源、模型、skills、规则文件和默认 Chrome 创建 AgentSession。Discovery / Evidence / Classifier / Reviewer 会额外挂载各自的 Team submit tool，分别写入 `candidate_domains`、`domain_evidence`、`domain_classifications`、`review_findings`；Finalizer 使用绑定 profile 生成 `final_report.md`。

在 `/playground/team` 页面里，右侧角色卡片的 Agent profile 下拉框都来自 `GET /v1/agents`。选择某个 Agent 后会写入对应的 `roleProfileIds.<roleId>`；选择“默认 Team runner”则该角色保持原来的 Team LLM runner。用户没有改动 prompt 时不会提交 override；一旦编辑，完整文本会写入 `rolePromptOverrides.<roleId>`。

客户端接入前先查模板发现接口：

```bash
curl http://127.0.0.1:3000/v1/team/templates
curl http://127.0.0.1:3000/v1/team/templates/brand_domain_discovery
```

返回的模板 metadata 包含 `templateId`、`title`、`description`、默认预算、`inputSchema` 和 `roles`。当前 `inputSchema` 是运行时自己的轻量 UI/schema 描述，不是完整 JSON Schema；它用于客户端生成表单和校验必填字段。`roles` 用于客户端生成角色卡片、展示角色职责、绑定 Agent profile 和编辑 prompt；真正的运行约束仍由 route、template、RoleBox 和 stream validator 共同兜底。

### 文件清单

| 文件 | 职责 |
|------|------|
| `src/team/types.ts` | 所有类型定义 |
| `src/team/team-template.ts` | 通用 TeamTemplate seam，定义模板对 runtime 暴露的接口 |
| `src/team/team-template-registry.ts` | 模板注册表；当前默认注册 `brand_domain_discovery` 和 `competitor_domain_discovery` |
| `src/team/templates/brand-domain-discovery.ts` | 第一条样板模板：roles、streams、validators、readiness、block policy、finalizer |
| `src/team/templates/competitor-domain-discovery.ts` | 第二条最小模板：复用域名调查执行链路，验证多模板注册和 API 选择 |
| `src/team/team-orchestrator.ts` | 通用运行编排：生命周期、role task 执行、timeout/retry、cursor 提交、事件写入 |
| `src/team/team-submit.ts` | Team stream 统一提交口：角色输出权限、payload 校验、候选域名去重和持久化写入 |
| `src/team/team-workspace.ts` | 文件系统持久化（JSON + JSONL） |
| `src/team/team-gate.ts` | payload 验证、角色权限、去重 |
| `src/team/role-box.ts` | RoleBox 契约：角色输入输出边界、must-not-do、JSON envelope 兼容模式和 submit tool 声明 |
| `src/team/team-submit-tools.ts` | submit tool 静态规格和 role/tool 到 stream 的映射 |
| `src/team/team-role-task-runner.ts` | 三种 runner：mock / LLM / composite；LLM runner 会调用 finalizer 生成中文 Markdown 报告 |
| `src/team/team-role-prompts.ts` | Discovery / Evidence Collector / Classifier / Reviewer / Finalizer 的 prompt 模板 |
| `src/team/team-plan-brand-domain.ts` | 兼容旧入口，转调 `brand_domain_discovery` template |
| `src/team/team-search.ts` | 正式 runtime 的 SearXNG 搜索 adapter |
| `src/team/json-output.ts` | 正式 runtime 的 LLM JSON 输出清洗 / 修复 helper |
| `src/team/team-config.ts` | 从环境变量读取配置 |
| `src/team/team-events.ts` | 事件类型定义 |
| `src/team/team-id.ts` | ID 生成器 |
| `src/team/llm.ts` | Team LLM 客户端；读取项目统一模型 registry/settings，按 provider `api` 字段选择调用协议 |
| `src/team/llm-tool-loop.ts` | provider-api-aware submit tool loop 底座；支持 Anthropic `tool_use` 与 OpenAI-compatible `tool_calls`，通过外部 handler 提交结果 |
| `src/routes/team.ts` | HTTP API 路由 |
| `src/ui/team-page.ts` | `/playground/team` 独立工作台页面 |
| `src/workers/team-worker.ts` | 后台 worker 进程 |
| `src/team-lab/` | **不要修改** — spike 实验代码 |

### 当前运行契约

- `plan.json` 是执行契约的一部分，不只是展示文档。Discovery 阶段必须消费 `plan.discoveryPlan.searchQueries`，不能在 runner 内部偷偷重建另一套查询。
- stream cursor 只代表“上游 item 已被对应角色成功消费”。角色任务失败、超时或返回非 `success` 时，不允许推进 cursor；否则会吞掉待处理输入，最终报告会假完整。
- 普通短角色 task 仍受 `TEAM_ROLE_TASK_TIMEOUT_MS` 约束；绑定 Agent profile 的 Discovery 作为持续生产者运行时不再按启动后的固定墙钟时间直接判失败，而是记录到 `state.activeRoleTasks`，用 `lastHeartbeatAt` / `lastOutputAt` 和该 role task 的 session JSONL 更新时间判断是否长时间无响应。`submitCandidateDomain` 被接受、或 session 持续写入模型 / 工具事件，都算活跃信号；watchdog 只有在超过 `TEAM_ROLE_TASK_TIMEOUT_MS` 没有这些信号时才标记 `role_task_watchdog`。
- 当前 `TeamOrchestrator` 已不再直接持有 `brand_domain_discovery` 的 validators、readiness、block policy 或 final report 生成逻辑；这些属于 `src/team/templates/brand-domain-discovery.ts`。
- `submitTeamStreamItem()` 是 Team stream 的统一提交口。它只负责基于 `TeamTemplate.roles[].outputStreams` 判定角色写权限、调用模板 stream validator、对 `candidate_domains` 做 normalized domain 去重、生成 `TeamStreamItem` 并写入 `TeamWorkspace`；事件、counter、cursor、retry 和 task 成败仍由 `TeamOrchestrator` 负责。
- `TeamOrchestrator` 在 run 从 `queued` 进入 `running`、round 递增、以及 submit tool 接受 stream item 时会立即写回 `state.json`。页面收到 `stream_item_accepted` 后刷新 run detail 时，状态和 counters 不应再停留在旧快照。
- `roleProfileIds` 是 Team role 绑定 Agent profile 的契约。创建 run 时传入后会写入 `state.json`，并在对应 `role_task_started` 事件和 role task input 中携带 `profileId` / `roleProfileId`。任意角色绑定 profile 后都会通过共享的 `ProjectBackgroundSessionFactory` 创建 AgentSession，继承该 profile 的 skills、规则、模型源、模型和默认 Chrome；未绑定时仍走原有 LLM runner。
- `rolePromptOverrides` 是用户运行前编辑角色 prompt 的契约。创建 run 时传入后会写入 `state.json`，并在对应 role task input 中携带 `rolePromptOverride`。LLM runner 和 Agent profile runner 都会把 override 包到默认 prompt 前面，但不会移除默认角色边界、submit tool 或输出 stream 约束。
- 绑定 Agent profile 的 Discovery 不会阻塞整个 tick：它启动后以 `mode: "background"` 记录在 `activeRoleTasks`，后续 tick 可以继续把已经提交的 `candidate_domains` 派给 Evidence Collector。这样页面能看到一边发现候选、一边取证；Finalizer 会等 active role task 清空后再收尾。
- Discovery 的运行口径是“专业调查员自己规划方法，结果结构化提交”：用户不需要知道 `crt.sh`、证书透明日志、DNS、区域 TLD、登录入口、应用商店或文档引用这些具体找法，Discovery 需要自己判断哪些公开线索值得查。它可以自由使用绑定 Agent profile 拥有的搜索、浏览器、web-access、shell、文档或其他技能来找候选域名；Team Runtime 不硬编码它必须走哪条找法，但默认 prompt 会提醒它不要只做普通搜索摘要，应按需考虑官网链接 / hreflang / footer、`crt.sh` / certificate transparency、DNS / subdomain clues、regional TLD、login / portal / app / support、public docs、partner / reseller pages、social profiles、app stores、code/doc references 等线索。
- 每个 `candidate_domains` payload 必须填好 `sourceType`、`sourceUrl` / `query` / `snippet`、`matchReason`、`confidence` 和 `discoveredAt`。`sourceType` 是来源标签，不是固定步骤；使用 `crt.sh` 或其他证书透明日志时应标为 `certificate_transparency`，并写明具体 `sourceUrl` 或查询模式。
- 当前 JSON envelope 兼容路径仍保留：role task 可以继续返回 `emits[]`，但每个 emit 必须经过 `submitTeamStreamItem()` 后才会进入 stream。
- `RoleBox` 只定义角色运行契约，不准备业务上下文。Discovery 搜索、Evidence 输入整理、Classifier / Reviewer 的上游数据选择仍由 runner/template 负责；RoleBox 只包装最终 prompt，声明 allowed input streams、output streams、must-not-do、submit tools 和 JSON envelope 兼容要求。
- 为了便于观察运行状态，`brand_domain_discovery` 不再等待凑够一批上游 item 才推进下游。只要出现至少 1 条新 `candidate_domains` / `domain_evidence` / `domain_classifications`，就可以触发对应下游角色；下游每个 role task 只消费 1 条上游 item，并在 `role_task_started` 事件里写入 `consumes.streamName`、`consumes.itemCount`、`consumes.itemIds` 和 `consumes.domains`。
- `team-submit-tools.ts` 是 submit tool 规格与映射表，`llm-tool-loop.ts` 是 provider-api-aware tool loop 底座。`TeamOrchestrator` 会在执行支持 submit tool 的 runner 时注入 task 级 handler；Discovery / Evidence Collector / Classifier / Reviewer 的 submit tool call 都会经 `submitTeamStreamItem()` 立即写入对应 stream。没有真实 role 或模型未触发 tool call 时仍保留 JSON envelope 兼容路径。
- submit tool spec 必须携带真实参数 schema。空 schema 会让真实模型自由发挥并提交无效 payload，别再把“测试里手写 payload 能过”当作 provider tool calling 可用。
- 如果模型已经通过 submit tool 成功提交阶段成果，但最后的 JSON envelope 损坏，runner 会把本次 role task 视为 `success` 且最终 `emits` 为空；否则模型一边把结果写进 stream，一边因为收尾 JSON 烂掉触发 retry，纯属自己给自己制造重复劳动。
- submit tool loop 必须按 provider `api` 字段分流：`anthropic-messages` 走 Anthropic `tool_use` / `tool_result`，`openai-completions` 走 OpenAI-compatible `tool_calls` / `tool` message。不要按 DeepSeek、智谱、小米这类厂商名硬编码协议。
- `finalizer` 是模板里已有的角色，不是为了报告额外新增的旁路角色。`TeamOrchestrator` 在 finalization 阶段会把四类 stream、计数、轮次、停止信号和公司 hints 传给 finalizer；finalizer 成功时由 `finalReportMarkdown` 写入 `final_report.md`，失败时才使用模板中文 fallback。
- `GET /v1/team/runs/:id/events/stream` 是观察层，不是持久真源。它按 `events.jsonl` 增量 tail/poll 并写出 SSE，解决 worker 与 main service 分进程导致内存 hub 无法跨进程广播的问题。冷启动历史仍读 `GET /events`。
- `TeamTemplate` 是后续新增 team 实例的内部扩展 seam；`POST /v1/team/runs` 仍兼容旧请求，并可通过 `templateId` 显式选择已注册模板。
- 每个 `TeamTemplate` 必须声明 metadata 和 `inputSchema`，`GET /v1/team/templates*` 只读返回这些声明，供 Playground、IM 或外部客户端发现能力。

### 关键配置

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `TEAM_RUNTIME_ENABLED` | 无（false） | 必须设为 `"true"` 才启用 |
| `TEAM_REAL_ROLES` | 无（全 mock） | 逗号分隔，如 `discovery,evidence_collector,classifier,reviewer,finalizer` |
| `TEAM_ROLE_TASK_TIMEOUT_MS` | 180000 | 普通短角色的 task 超时；对后台 Discovery 用作无 heartbeat 的 idle watchdog 阈值 |
| `TEAM_ROLE_TASK_MAX_RETRIES` | 1 | 失败重试次数 |
| `DEEPSEEK_API_KEY` | — | 当前默认 DeepSeek provider 的 API key；具体 provider/model/api 以项目统一模型配置为准 |

Team Runtime 不拥有自己的模型源配置。`src/team/llm.ts` 会读取项目统一 settings 和 `runtime/pi-agent/models.json`，按 provider 的 `api` 字段决定调用协议。当前 DeepSeek 正式走 `deepseek` provider、`https://api.deepseek.com/anthropic` 和 `anthropic-messages`；不要在 Team 里恢复 `deepseek-anthropic`、OpenAI-compatible 分支或 `deepseek-api.txt` 读取逻辑。后续新增模型源也应先进入统一 registry/settings，Team 只消费结果。

### 数据目录

```
.data/team/
  runs/<teamRunId>/
    plan.json          # 调查计划
    state.json         # 运行状态（含 counters, budgets, stopSignals, activeRoleTasks）
    events.jsonl       # 事件日志（每行一个 JSON）
    streams/
      candidate_domains.jsonl
      domain_evidence.jsonl
      domain_classifications.jsonl
      review_findings.jsonl
    cursors/
      evidence_collector_candidate_domains.json
      classifier_domain_evidence.json
      reviewer_domain_classifications.json
    artifacts/
      final_report.md
      candidate_domains.json
      domain_evidence.json
      domain_classifications.json
      review_report.json
```

## 已知局限（MVP）

1. **Evidence Collector 不做真实 HTTP/DNS/证书检查** — 只做域名分析，全部标记 `checked: false`。容器内已具备 `dig`、`nslookup`、`host` 等 DNS 工具（通过 Dockerfile 安装 `dnsutils`），Evidence Agent 可直接调用查询 MX、NS、TXT、CAA、SOA 等记录，不再仅依赖 `getent hosts` / Python socket 做基础解析
2. **单轮 Discovery 搜索覆盖率有限** — `maxRounds=1` 只跑当前 plan 分配给 Discovery 的查询集合
3. **UI 仍是运维工作台，不是业务产品页** — `/playground/team` 已能发现模板、创建 run、查看 streams / events / artifacts，但还没有可视化 graph scheduler、批量对比或报告编辑能力
4. **真实 submit tool loop 已覆盖四个产物流角色** — Discovery / Evidence Collector / Classifier / Reviewer 都能在 LLM tool-calling 模式下即时提交对应 stream item；绑定 Agent profile 的 Discovery 可以作为后台活跃任务持续产出，下游角色会在至少 1 条新上游 item 出现后尽快推进，并且每个 task 只处理 1 条，便于页面观察；finalizer 会读取这些 stream 生成中文 Markdown 报告；但调度仍不是 durable 并发 scheduler
5. **JSON 输出可能损坏** — DeepSeek 偶尔输出未转义的引号，`repairJson()` 做字符级修复
6. **模板 schema 仍是轻量描述** — `/v1/team/templates*` 已暴露模板发现和输入字段，但还不是完整 JSON Schema；`/playground/team` 只按当前轻量 schema 和已知预算字段生成表单
7. **调度仍是 MVP 顺序执行** — 当前每 tick 最多按模板 roles 顺序各执行一次 ready task，绑定 profile 的 Discovery 已能后台持续运行并释放下游 tick，但尚未做完整 graph scheduler；如果 worker 在下游角色完成前被重启，缺少 durable role task lease/store 仍可能导致下游阶段重放
8. **模板报告仍保留为兜底** — 主路径是 finalizer agent 写中文报告；模板只在 finalizer 失败时产出 fallback，避免没有最终 artifact
9. **角色可按 Agent profile 隔离能力** — Discovery / Evidence / Classifier / Reviewer / Finalizer 都能通过 `roleProfileIds` 选择不同 Agent profile，从而隔离模型源、skills、规则文件和默认 Chrome；但调度仍是 MVP 顺序 tick，不是 durable 并发 scheduler

## 数据流示例（Medtrum 测试结果）

```
关键词: Medtrum, 公司: 上海移宇科技
                    │
Discovery ──────────┤ SearXNG 搜索 68 条结果
                    │ LLM 提取出 10 个候选域名
                    ▼
  medtrum.com (官方, 高置信度)
  medtrum.nl, medtrum.co.uk, medtrum.eu (各国站点)
  easyview.medtrum.eu, easyview.medtrum.fr (患者门户)
  onetrum.com (不明关联)
  medtrum.redycare.ch (合作伙伴)
  medtrum.ec, cz.medtrum.com
                    │
Evidence → Classifier → Reviewer → final_report.md
                    │
最终: 10 域名, 0 失败, 全部审核通过
```
