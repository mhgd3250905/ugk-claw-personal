# Team Realtime Submit 专项交接

## 当前状态

- 最新提交：`a2ce455 Align model providers and conn error handling`
- 当前工作区：不为空；本轮 Team Realtime Submit tracer bullet 已实现但尚未 commit
- Team Runtime 已有独立页面：`/playground/team`
- Team Runtime 现在已有统一 stream 提交口：`submitTeamStreamItem()` 是 role 产物进入 Team stream 的正式入口
- 旧 JSON envelope 路径仍保留：runner parse `emits[]` 后仍会经 orchestrator 调用同一提交口写 stream
- Discovery 已接入 submit tool loop tracer bullet：可通过 `submitCandidateDomain` 在任务过程中写入 `candidate_domains`
- Team run events 已有 SSE 观察入口：`GET /v1/team/runs/:teamRunId/events/stream` 通过 tail/poll `events.jsonl` 发 live events
- `/playground/team` 已接入 run event stream；收到 `stream_item_accepted` 后刷新 run detail 和 stream，断线后回退到手动刷新提示
- DeepSeek 配置已从旧分叉收口：当前正式 provider 是 `deepseek`，走 `anthropic-messages`、`https://api.deepseek.com/anthropic`、`DEEPSEEK_API_KEY`
- Team LLM 已复用项目统一 registry/settings，不再读 `deepseek-api.txt`
- Conn provider error 假成功问题已修：assistant `stopReason: "error"` 会让后台 run 进入 failed
- 本轮不是完整 durable 并发 scheduler：Evidence / Classifier / Reviewer 真实 submit tool 接入、role task lease/store、崩溃恢复仍是后续阶段

## 本轮已完成

- 新增 `src/team/team-submit.ts`，统一处理 role/stream 权限、payload validator、`candidate_domains` 去重和 stream 持久化。
- `TeamOrchestrator` 的 JSON envelope emits 和 task 级 submit handler 都走 `submitTeamStreamItem()`，并统一记录 accepted / rejected / duplicate events 与 counters。
- 新增 `src/team/team-submit-tools.ts` 和 `src/team/role-box.ts`，把 role 输出边界、submit tool spec 和 prompt 契约显式化。
- `LLMTeamRoleTaskRunner` 已支持 RoleBox 包装 prompt，并在 Discovery 任务中按 `provider.api` 进入 submit tool loop；无 tool handler 时仍回退旧 `callLLM(prompt)` 路径。
- 新增 `src/team/llm-tool-loop.ts`，第一版支持 `anthropic-messages` 的 `tool_use` / `tool_result` 和 `openai-completions` 的 `tool_calls` / `tool` message，不按厂商名硬编码协议。
- `CompositeTeamRoleTaskRunner` 支持 task 级 submit handler 透传，mock runner 保持兼容。
- 新增 Team run SSE route 与 `/playground/team` 最小订阅逻辑。
- 补充 Team submit / RoleBox / submit tools / LLM tool loop / route / UI / orchestrator 测试。

## 新会话第一句话

```text
请接手 `E:\AII\ugk-pi` 的 Team Realtime Submit 专项。先读 `AGENTS.md`、`docs/handoff-current.md`、`docs/team-runtime.md`、`docs/model-providers.md`、`.codex/plans/2026-05-14-team-realtime-submit-and-incremental-scheduler.md` 和 `.codex/plans/2026-05-14-handoff-team-realtime-submit.md`。当前最新提交仍是 `a2ce455 Align model providers and conn error handling`，但工作区已有未提交实现：统一 submit gate、RoleBox、submit tool specs、run events SSE、LLM submit tool loop、Discovery tracer bullet。开始前先跑 `git status --short`，不要动 `.env`、`.data/`、运行态 key 或临时 api txt 文件。下一步优先 review 并提交本轮改动，之后再扩展 Evidence / Classifier / Reviewer submit tools 或设计 durable role task lease/store。
```

## 必读文件

1. `AGENTS.md`
2. `docs/handoff-current.md`
3. `docs/team-runtime.md`
4. `docs/model-providers.md`
5. `.codex/plans/2026-05-14-team-realtime-submit-and-incremental-scheduler.md`
6. `src/team/team-orchestrator.ts`
7. `src/team/team-workspace.ts`
8. `src/team/team-template.ts`
9. `src/team/templates/brand-domain-discovery.ts`
10. `src/team/team-role-task-runner.ts`
11. `src/team/llm.ts`
12. `src/routes/team.ts`
13. `src/ui/team-page.ts`

## 要继续的主计划

主计划文档：

```text
.codex/plans/2026-05-14-team-realtime-submit-and-incremental-scheduler.md
```

核心目标：

```text
Team Runtime 里任何 role 的阶段成果，必须能作为 stream item 被立即提交、立即校验、立即持久化、立即对外观察，并能触发下游 role 增量消费。
```

这不是 UI 美化任务，也不是再加一个模板。要解决的是当前 team 仍像串行 JSON pipeline：

```text
role task 调 LLM
  -> LLM 返回完整 JSON envelope
  -> runner parse 后一次性返回 emits[]
  -> orchestrator 批量写 stream
  -> 下游 role 才开始
```

目标方向：

```text
discovery 工作中 submitCandidateDomain
  -> candidate_domains 立即落 stream
  -> events/SSE 或轮询立即可见
  -> evidence_collector 可消费新增 candidate
  -> classifier / reviewer 后续同理
```

## 已完成的前置事项

- DeepSeek 已按当前项目规范走 `anthropic-messages`，不要再按旧计划里“DeepSeek 先走 OpenAI-compatible tool_calls”执行。
- `src/team/llm.ts` 已读取项目统一模型配置。
- `test/team-llm-config.test.ts` 已覆盖 Team LLM 配置解析。
- `docs/model-providers.md` 已明确旧 `deepseek-anthropic`、OpenAI-compatible DeepSeek、`ANTHROPIC_AUTH_TOKEN` 多源复用、`*-api.txt` 都不是当前规范。
- `/playground/team` 已经能发现模板、创建 run、查看 run detail / events / streams / artifacts。

## 下一步建议

1. 先 review 并提交本轮改动，建议提交标题：`team: add realtime submit tracer bullet`。
2. 如继续功能推进，优先二选一：
   - 扩展 Evidence / Classifier / Reviewer 的真实 submit tool 接入；
   - 或先设计 durable role task lease/store，再碰真正并发 scheduler。
3. 若准备上线或给用户演示，补跑 Docker / Playground 真实链路验证：启动服务、创建 Brand Domain Discovery run、确认运行中 events/streams 可刷新、重启后历史 run 仍可读取。
4. 不要把当前状态宣传成“完整并发 Team scheduler”。这轮只是把“阶段成果可即时 submit、持久化、观察，并支撑同 tick 下游消费”的 tracer bullet 打通。

## 验证基线

本轮收尾已通过：

```text
git diff --check
npx tsc --noEmit
npm run test:team
npm test
```

本轮测试结果：

```text
npm run test:team -> 112 pass / 0 fail
npm test -> 892 pass / 0 fail
```

注意：`npm test` 输出中仍可能出现既有 `[browser-cleanup] Error closing browser targets ... fetch failed` 日志；本轮验证中测试最终全绿。

继续改 Team submit 后，最少跑：

```bash
npm run test:team
npx tsc --noEmit
```

涉及路由或页面时再跑：

```bash
node --test --import tsx test/team-routes.test.ts test/team-page-ui.test.ts test/server.test.ts
```

行为收口后跑：

```bash
npm test
```

## 重要边界

- 不要修改 `/v1/chat` 行为。
- 不要修改 conn-worker 业务语义。
- 不要把 Team role task 写进 `conn_runs`。
- 不要接 AssetStore。
- 不要新增业务模板来伪装架构推进。
- 不要把 `/playground/team` 做成复杂流程编排器。
- 不要恢复 `deepseek-api.txt`、`deepseek-anthropic`、DeepSeek OpenAI-compatible 作为当前正式路径。
- 不要提交 `.env`、`.data/`、真实 key、运行态文件或临时报告。

## 判断是否走偏

如果下一步改动主要在 UI 上，而不是 stream submit / validation / persistence / scheduling，那么走偏了。

如果下一步把 DeepSeek 又写成厂商名判断协议，而不是读 provider `api` 字段，也走偏了。

如果下一步为了“实时”直接绕过 `TeamWorkspace` 写临时内存状态，更是走偏。Team stream 的事实源必须还是 workspace 持久化。

## 建议提交边界

本轮建议作为一个提交：

```text
team: add realtime submit tracer bullet
```

包含：

- `.codex/plans/2026-05-14-handoff-team-realtime-submit.md`
- `package.json`
- `src/team/team-submit.ts`
- `src/team/team-submit-tools.ts`
- `src/team/role-box.ts`
- `src/team/llm-tool-loop.ts`
- `src/team/team-orchestrator.ts`
- `src/team/team-role-task-runner.ts`
- `src/routes/team.ts`
- `src/ui/team-page.ts`
- `test/team-submit.test.ts`
- `test/team-submit-tools.test.ts`
- `test/team-role-box.test.ts`
- `test/team-role-task-runner.test.ts`
- `test/team-llm-tool-loop.test.ts`
- `test/team-orchestrator.test.ts`
- `test/team-routes.test.ts`
- `test/team-page-ui.test.ts`
- `docs/team-runtime.md`
- `docs/change-log.md`

不要提交：

- `.env`
- `.data/`
- `runtime/` 临时产物
- 真实 key / token / cookie
- 本地截图、临时报表、部署包

如果想继续按原计划拆 commit，也可以拆成 submit gate / RoleBox / tool specs / SSE / tool loop / docs 多个提交；但当前工作区已经是一个完整 tracer bullet，单提交也说得通。别为了“显得细”硬拆到丢上下文，那也挺折腾 review 的。
