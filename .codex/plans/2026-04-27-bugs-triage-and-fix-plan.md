# Bugs 目录问题评估与修复计划

日期：2026-04-27

## 目标

评估 `bugs/` 目录三份使用中收集的问题材料，区分真实代码缺陷、部署配置缺口和任务定义优化项，并制定可执行修复计划。计划阶段只读源码与问题材料，不修改功能代码。

## 评估结论

### 1. 后台任务模型选择异常

来源：历史 `bugs/background-agent-model-selection-issue-report.md` 评估材料；源报告已在 2026-05-04 文档清理中从主仓库移除，保留 Git 历史追溯。

结论：问题存在，优先级 P0。

已确认事实：

- `BackgroundAgentProfileResolver` 会从项目根 `.pi/settings.json` 解析默认模型，并把 `provider/model` 写入 `ResolvedBackgroundAgentSnapshot`。
- `BackgroundAgentRunner` 会把这个 `snapshot` 传给 `BackgroundAgentSessionFactory.createSession()`。
- `src/workers/conn-worker.ts` 的 `ProjectBackgroundSessionFactory.createSession()` 创建 `createAgentSession()` 时只传了 `cwd`、`agentDir`、`authStorage`、`modelRegistry`、`sessionManager`、`resourceLoader`，没有显式传 `model` 或 `thinkingLevel`。
- `createAgentSession()` 的 SDK 类型声明显示 `model` 是可传入选项；不传时会从 settings 或第一个可用模型 fallback。

判断：

报告里“完全因为 cwd 是 run workspace，读不到项目 `.pi/settings.json`”这个根因不够严谨，因为当前 `resourceLoader` 与 `agentDir` 是按项目根构造的；但“后台任务没有强制使用 resolved snapshot 里的模型策略”是明确风险。只要 `createAgentSession()` 的内部 settings 解析没有命中项目默认值，就可能 fallback 到模型 registry 的第一个可用模型。

修复方向：

- 以 `snapshot.provider/model` 为唯一后台任务模型策略入口，在 `ProjectBackgroundSessionFactory` 内通过 `modelRegistry.find(snapshot.provider, snapshot.model)` 解析模型并传给 `createAgentSession({ model })`。
- 未找到模型时直接失败并记录明确错误，不允许静默 fallback 到第一个模型。
- 同步保留 isolated workspace 作为任务工作目录，不把后台任务 cwd 粗暴改回 `/app`，否则会污染任务输出和文件边界。

### 2. Medtrum 舆情监控任务耗时与邮件步骤问题

来源：历史 `bugs/medtrum舆情监控任务优化记录.md` 评估材料；源报告已在 2026-05-04 文档清理中从主仓库移除，保留 Git 历史追溯。

结论：问题存在，但核心是任务定义与运行策略问题，优先级 P1/P2，不应混成 runtime P0 bug。

已确认事实：

- 项目存在 `.pi/extensions/subagent/index.ts`，支持 single / parallel / chain 三种 subagent 执行模式。
- subagent CLI 参数会通过项目根 `SettingsManager.create(projectRoot)` 继承默认 provider/model。
- 系统 subagent 定义存在于 `.pi/agents/`，包括 `planner`、`worker`、`scout`、`reviewer`。

判断：

这份报告主要说明旧任务定义让主模型手动生成大量 prompt 文件、再用 CLI 串行拉子代理，导致额外开销；邮件发送步骤还出现了命令管道截断和 timeout 行为不清的问题。它更像 conn 任务资产和作业规范需要升级，而不是当前必须立刻改 runtime 的 bug。

修复方向：

- 先验证当前 Medtrum conn 是否已经引用报告中提到的 v2 asset。
- 如未生效，先修 conn 定义或任务资产，而不是改核心 runner。
- 后续可补一个后台任务运行规范：禁止邮件发送命令使用 `tee | tail` 这类会截断真实输出的管道；邮件发送必须由最终执行者直接完成并产生可审计日志。
- 如需要产品化，再考虑把邮件发送封装成专用工具或 conn action，避免每次由模型自由写 shell。

### 3. 会话中断、长时间无输出、空回复

来源：历史 `bugs/会话中断问题排查分析报告-ISR-2026-04-27-001.md` 评估材料；源报告已在 2026-05-04 文档清理中从主仓库移除，保留 Git 历史追溯。

结论：问题部分确认，优先级 P0/P1。

已确认事实：

- `deploy/nginx/default.conf` 的 `location /` 当前没有显式配置 `proxy_read_timeout`、`proxy_send_timeout`、`proxy_buffering off`。
- 后端 SSE 工具 `src/routes/chat-sse.ts` 已设置 `Content-Type: text/event-stream`、`Cache-Control: no-cache, no-transform`、`Connection: keep-alive`、`X-Accel-Buffering: no`。
- `/v1/chat/stream` 和 `/v1/chat/events` 当前没有服务端 heartbeat；如果模型或工具长时间不产出任何事件，代理层和中间网络确实可能认为连接空闲。
- 前端 `readEventStream()` 没有 idle 检测，但已有 `recoverRunningStreamAfterDisconnect()`，可在主流断开后尝试通过 canonical state 或 `/v1/chat/events` 恢复。

判断：

nginx 60 秒默认读超时导致 SSE 断开的推断符合当前配置风险。是否一定是这次 ISR 的唯一根因，还需要生产日志和代理日志佐证；但 nginx 长连接配置缺失本身已经足够进入 P0 修复。

修复方向：

- 在 nginx 代理层显式设置长连接 timeout 与关闭 buffering。
- 服务端 SSE 增加 heartbeat，避免长时间 LLM 无输出时链路空闲。
- 前端 `readEventStream()` 增加 idle 监测和恢复路径，不能直接把空流结束渲染成空回复。

## 实施步骤

### 阶段 A：后台任务模型策略收口

涉及文件：

- `src/workers/conn-worker.ts`
- `src/agent/background-agent-profile.ts`
- `test/background-agent-runner.test.ts` 或新增后台 session factory 测试
- `test/conn-worker.test.ts`

步骤：

1. 先补失败测试：构造一个包含 `snapshot.provider/model` 的后台 session 创建输入，断言 `ProjectBackgroundSessionFactory` 会把对应 `ModelRegistry.find()` 结果传给 `createAgentSession({ model })`。
2. 如果现有类不方便测试，先做最小解耦：提取 `resolveBackgroundSessionModel(modelRegistry, snapshot)` 纯函数并测试。
3. 实现显式模型传递：`modelRegistry.find(snapshot.provider, snapshot.model)` 命中后传入 `createAgentSession({ model })`。
4. 未命中时抛出包含 provider/model 的错误，并让 `BackgroundAgentRunner` 按现有失败路径记录 `run_failed`。
5. 确认 `resolvedSnapshot.provider/model` 与实际 session 创建模型一致，避免后台 run event 记录和真实模型分裂。

### 阶段 B：生产 nginx SSE 长连接配置

涉及文件：

- `deploy/nginx/default.conf`
- `test/containerization.test.ts`
- `docs/tencent-cloud-singapore-deploy.md`
- `docs/aliyun-ecs-deploy.md`
- `docs/change-log.md`

步骤：

1. 在 `location /` 增加 `proxy_read_timeout 600s;`、`proxy_send_timeout 600s;`、`proxy_buffering off;`。
2. 评估是否也给 `/healthz` 以外的 SSE 路由单独拆 `location /v1/chat/stream` 和 `/v1/chat/events`；如果只做全局 `/` 配置，测试必须覆盖。
3. 在 `test/containerization.test.ts` 增加断言，避免后续改 nginx 时把 SSE 关键配置删掉。
4. 同步生产部署文档，明确 nginx 配置改动需要 `docker compose -f docker-compose.prod.yml up --build -d` 或至少重启 nginx 服务。

### 阶段 C：服务端 SSE heartbeat

涉及文件：

- `src/routes/chat-sse.ts`
- `src/routes/chat.ts`
- `src/agent/agent-run-events.ts`
- `src/types/api.ts`
- `test/chat-sse.test.ts`
- `test/server.test.ts`

步骤：

1. 明确 heartbeat 协议：优先使用 SSE comment frame `: ping\n\n`，这样不污染现有 `ChatStreamEvent` 类型和前端 `handleStreamEvent()` 分支。
2. 在 `chat-sse.ts` 提供 `startSseHeartbeat(raw, intervalMs)`，默认 25-30 秒。
3. `/v1/chat/stream` 和 `/v1/chat/events` 都启动 heartbeat，并在 terminal event、异常和 close 时清理 timer。
4. 测试 heartbeat 对已关闭 response 不写入、不抛错，并确保 `endSseResponse()` 后不会留下 timer。

### 阶段 D：前端流式读取空闲保护

涉及文件：

- `src/ui/playground-stream-controller.ts`
- `test/server.test.ts`
- `docs/playground-current.md`

步骤：

1. 给 `readEventStream(response, onEvent, options)` 增加可选 idle timeout，主流与 active run 重连流均可复用。
2. 收到任意 SSE frame 后刷新最后活动时间；heartbeat comment frame不进入 `JSON.parse`。
3. idle 超时后不直接失败，先调用现有 `recoverRunningStreamAfterDisconnect("network_error")` 或 canonical state 恢复路径。
4. 如果后端显示 idle，则清理 loading 状态并从 `GET /v1/chat/state` 恢复最终内容，避免空助手气泡残留。

### 阶段 E：Medtrum conn 任务定义验证与收口

涉及文件或入口：

- `GET /v1/conns`
- `GET /v1/assets/:assetId`
- `.pi/extensions/subagent/index.ts`
- `.pi/agents/`
- `docs/runtime-assets-conn-feishu.md`
- `docs/change-log.md`

步骤：

1. 读取当前 conn 列表，确认 Medtrum 任务是否已经引用 v2 asset `6d82261f-afb5-433c-a3c0-f11db172fb2a`。
2. 如果 v2 已生效，本阶段只记录为运行配置已修正，并补文档约束。
3. 如果 v2 未生效，优先更新 conn 的 `assetRefs` 或任务 prompt 资产，不改 runtime。
4. 追加任务定义规范：平台检索使用 subagent parallel，汇总使用 single，邮件发送由主流程直接执行且禁止输出截断管道。
5. 后续如仍频繁超时，再单独规划邮件工具化，不在本轮混入。

## 修复影响分析

### 直接影响

- 后台任务模型策略变更会影响所有 conn worker run；如果模型 id 配置错误，任务会从“静默 fallback”变成“明确失败”。这是故意的，宁可报错也不要偷偷换模型。
- nginx timeout 会影响所有经 nginx 进入的 HTTP 请求；600 秒适合长 SSE，但普通请求不会因此变慢，只是允许长连接存在更久。
- SSE heartbeat 会改变流式连接上的字节输出频率；前端和代理需要忽略 comment frame。
- 前端 idle 恢复会影响 `/v1/chat/stream` 断线后的显示逻辑，必须避免和现有 `pageshow/visibilitychange/online` 恢复策略打架。

### 间接影响

- 显式模型传递可能暴露 `.pi/settings.json`、`.pi/background-agent/model-policies.json`、`runtime/pi-agent/models.json` 三者不一致的问题。
- heartbeat timer 如果清理不完整，会造成长会话 timer 泄漏；必须在 close、done、error、interrupted、catch/finally 全路径清理。
- 前端恢复逻辑如果处理不当，可能再次触发会话列表 loading 状态残留；执行时要复查 `setLoading(false)` 与 `renderConversationDrawer()`。
- Medtrum 任务改资产可能影响下一次定时执行结果，需要保留旧资产 id 和更新记录，便于回滚。

### 数据结构兼容性

- 阶段 A 不新增 conn 存储字段，优先使用已有 `profileId/agentSpecId/skillSetId/modelPolicyId/upgradePolicy` 和 `resolvedSnapshot`。
- 阶段 B 不改 API schema。
- 阶段 C 如果采用 SSE comment heartbeat，不需要修改 `ChatStreamEvent` union；若改成 `{ type: "heartbeat" }`，必须同步 `src/types/api.ts`、前端 switch 和测试。
- 阶段 D 只改前端脚本行为，不改后端持久化。
- 阶段 E 如只更新 conn assetRefs，需要确认旧数据读取默认值仍兼容。

## 验证计划

必须运行：

- `npm test`
- `npx tsc --noEmit`

涉及 nginx / compose 后追加：

- `docker compose -f docker-compose.prod.yml config --quiet`

涉及浏览器恢复后追加：

- 本地访问 `http://127.0.0.1:3000/playground`，制造长时间无 text delta 的 mock 或手动任务，确认不会空回复。
- 若 Docker 权限可用，重启服务后复测；否则明确提示用户手动重启容器。

涉及 Medtrum conn 后追加：

- 查询 `GET /v1/conns`，确认目标 conn 的 `assetRefs`。
- 展开最近一次 run events，确认 subagent 执行方式和邮件步骤日志不再被截断。

## 执行顺序建议

1. 先做阶段 A 和阶段 B，这是当前证据最硬、风险最高的两项。
2. 再做阶段 C，用 heartbeat 解决长时间无事件的链路保活。
3. 接着做阶段 D，让前端在异常断流时更稳。
4. 最后处理阶段 E，把 Medtrum 作为任务定义治理，不要和 runtime 修复混在一个补丁里。

## 执行门槛

本计划仅完成评估与拆解。执行前需要用户确认。

建议执行命令：

`$do-plan .codex/plans/2026-04-27-bugs-triage-and-fix-plan.md`
