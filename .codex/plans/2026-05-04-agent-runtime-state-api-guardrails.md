# Agent 运行态状态操作 API 化治理计划

> **执行前置：** 本计划只做后续集中治理设计。当前先完成手头“后台任务执行 Agent”改动；执行本计划前需要用户明确确认。

**目标：** 先通过规则、技能、文档测试和官方诊断入口，引导 agent 不要自作主张直接编辑运行态底层文件 / SQLite / JSON index；状态变更应优先通过项目已经设计好的 HTTP API、工具或服务层方法完成，避免磁盘状态、内存 registry、索引、通知和前端视图互相分裂。

**问题背景：** 这次阿里云问题暴露出典型隐患：agent 手动写入 `.data/agents/profiles.json`，导致 `POST /v1/agents` 从磁盘 catalog 判断 agent 已存在，但 `GET /v1/agents` 从进程内 `AgentServiceRegistry` 看不到它。根因不是单个接口 bug，而是 agent 绕过了系统事务边界。

---

## 评审后调整结论（2026-05-04）

本计划保留原方向，但执行顺序要收紧：

1. **先只读诊断，后写入修复。** 第一批后端能力只加 diagnostics / explain，不加 repair。运行态 repair API 如果没有权限门槛、维护窗口和测试样例，很容易把“手改 JSON”升级成“HTTP 手改 JSON”，听起来文明一点，本质一样危险。
2. **先修真实写入薄弱点。** `src/agent/agent-profile-catalog.ts` 当前写 `profiles.json` 仍是直接 `writeFile`；后续实现时应优先改成同目录临时文件 + `rename` 原子替换，再谈更大的治理。
3. **diagnostics 不参与业务热路径。** `GET /v1/agents/diagnostics`、`GET /v1/conns/diagnostics` 这类接口只给排障和发布验收使用，不应被前端常规渲染依赖，避免把诊断接口变成新的状态真源。
4. **repair 必须有更强前置条件。** 任何会写 `.data`、SQLite 或 index 的 repair/requeue/reload 入口，都必须在文档中声明适用场景、不可逆影响、验证命令和失败回滚路径；没有这些，宁可先让用户重启服务，也别造一个万能“修复”按钮。

## 核心原则

- **API 是操作入口，底层文件是存储证据。** agent 可以读底层文件排障，但不能把它当创建 / 修复 / 删除入口。
- **凡是会维护多处状态的能力，规范上禁止手写底层状态。** 包括内存 registry、SQLite 表、JSON index、运行目录、通知广播、缓存、会话文件等。当前阶段不宣称能在工具层硬拦截所有文件写入。
- **先规训引导，再考虑治理入口。** 第一轮先补技能 / 文档 / 测试，第二轮再补只读 diagnostics；写入型 reload / repair / reconcile 入口必须更晚、更审慎。
- **不混入当前功能线。** 本计划等后台执行 Agent 改动收口后再集中处理，避免 diff 变成糊锅。

## 高风险清单

### 1. Agent Profile

底层状态：
- `.data/agents/profiles.json`
- `.data/agents/:agentId/`
- `.data/agents-archive/`
- 进程内 `AgentServiceRegistry`

正确入口：
- `GET /v1/agents`
- `POST /v1/agents`
- `PATCH /v1/agents/:agentId`
- `POST /v1/agents/:agentId/archive`
- `POST /v1/agents/:agentId/skills`
- `DELETE /v1/agents/:agentId/skills/:skillName`
- `GET/PATCH /v1/agents/:agentId/rules`

风险：
- 磁盘 catalog 与 registry 分裂。
- 目录存在但运行时不可用。
- 技能目录和 scoped debug skills 不一致。

当前状态：
- 已先补 `agent-profile-ops` 禁令和测试，后续仍需要考虑后端 reload / repair 入口。

### 2. Conn 后台任务

底层状态：
- `conn.sqlite`
- `conns`
- `conn_runs`
- `conn_run_events`
- `conn_run_files`
- lease / heartbeat / activity / notification 相关状态

正确入口：
- `POST /v1/conns`
- `PATCH /v1/conns/:connId`
- `POST /v1/conns/:connId/run`
- `POST /v1/conns/:connId/pause`
- `POST /v1/conns/:connId/resume`
- `DELETE /v1/conns/:connId`
- `GET /v1/conns/:connId/runs*`

风险：
- 手改 SQLite 绕过 schedule 校验、lease 续租、stale recovery、activity 写入和实时广播。
- pending/running run 状态被改坏，worker 重领或永远不领。
- run detail / 任务消息追溯断链。

### 3. 资产库 / 文件库

底层状态：
- `.data/agent/assets/asset-index.json`
- `.data/agent/assets/blobs/`
- `send_file` 生成物和文件卡片历史

正确入口：
- `POST /v1/assets/upload`
- `GET /v1/assets`
- `GET /v1/assets/:assetId`
- agent 内部 `send_file`

风险：
- index 有记录但 blob 不存在，前端展示文件但下载 404。
- blob 存在但 index 没记录，文件变孤儿。
- 绕过 asset index 串行队列和原子写，导致并发覆盖。

### 4. Conversation / Session / Chat State

底层状态：
- conversation index
- session files
- active run buffer
- browser local history cache

正确入口：
- `/v1/chat/*`
- `/v1/agents/:agentId/chat/*`
- `ConversationStore` / `AgentService` 服务层方法

风险：
- 当前会话、历史目录、session 文件不一致。
- 刷新后消息丢失、重复、串 agent。
- active run 被前端误判为完成或不存在。

### 5. 技能安装与隔离

底层状态：
- `.pi/skills`
- `runtime/skills-user`
- `.data/agents/:agentId/pi/skills`
- `.data/agents/:agentId/user-skills`

正确入口：
- `GET /v1/debug/skills`
- `GET /v1/agents/:agentId/debug/skills`
- `POST /v1/agents/:agentId/skills`
- `DELETE /v1/agents/:agentId/skills/:skillName`

风险：
- 非主 agent 看见主 Agent 技能，隔离被打穿。
- symlink / junction 共享技能目录，scoped skill 口径失效。
- 主 Agent 代装自己没有的技能。

### 6. 模型配置

底层状态：
- `.pi/settings.json`
- `runtime/pi-agent/models.json`

正确入口：
- `GET /v1/model-config`
- `PUT /v1/model-config/default`

风险：
- UI 显示一个模型，真实 session 用另一个模型。
- 注释 / JSONC 解析链路不同导致默认模型漂移。
- 后台任务和前台会话模型口径分裂。

### 7. 飞书设置

底层状态：
- 运行态 Feishu settings 文件
- worker 内部订阅状态

正确入口：
- `GET /v1/integrations/feishu/settings`
- `PUT /v1/integrations/feishu/settings`
- `POST /v1/integrations/feishu/test-message`

风险：
- 绕过凭据校验和脱敏。
- worker 不重连或拿旧配置。
- 白名单 / 投递目标和 UI 状态不一致。

### 8. 任务消息 / Activity

底层状态：
- `agent_activity_items`
- unread count
- source / sourceId / runId 追溯字段

正确入口：
- 后台 runner 写入
- `GET /v1/activity`
- `POST /v1/activity/:activityId/read`
- `POST /v1/activity/read-all`

风险：
- 未读数错乱。
- source/runId 丢失，无法跳回 run detail。
- 分页游标不稳定。

---

## 实施阶段

### Phase 1: 软护栏收口

**目标：** 先让 agent “知道哪些运行态底层状态不该手写”，并用测试防止规则被删松。

任务：
1. 为每个高风险场景补对应 skill / 文档禁令。
2. 在 `AGENTS.md` 和 `docs/traceability-map.md` 加统一规则：底层状态只能只读排障，变更必须走 API。
3. 新增文档测试，检查关键禁令存在。测试不要只查一个模糊词，要锁住具体对象和正确入口：
   - agent profile 禁止改 `profiles.json`
   - conn 禁止直写 SQLite
   - asset 禁止直写 `asset-index.json`
   - conversation 禁止手写 session/index
   - model config 禁止手改默认模型绕 API
   - Feishu 禁止手写 settings 绕过脱敏和 worker 重连
   - activity 禁止直写未读数和追溯字段
4. 更新 `docs/change-log.md`。

验证：
- `node --test --import tsx test/*skill*.test.ts` 或新增定向测试。
- `npx tsc --noEmit`。

### Phase 2: 只读 diagnostics 补齐

**目标：** 让 agent 遇到不一致时能准确报告“哪里分裂”，而不是继续手补底层状态。

第一批只做只读接口：

1. Agent Profile:
   - `GET /v1/agents/diagnostics`
   - 返回 catalog agents、archivedAgentIds、registry agents、runtimeDirExists、rulesFileExists、skillRootsExists。
   - 标出 `catalogOnly`、`registryOnly`、`archivedButRuntimeDirExists` 这类问题。
2. Conn:
   - `GET /v1/conns/diagnostics`
   - 返回 SQLite 可访问性、pending/running/stale run 计数、最近 worker lease 概况。
3. Asset:
   - `GET /v1/assets/diagnostics`
   - 返回 index 可读性、blob 缺失计数、孤儿 blob 计数。第一版只报告，不删除。

验证：
- 为每个新增 API 写 route test。
- 手动制造轻量不一致样例，确认 diagnostics 能暴露而不是默默吞掉。
- 确认 diagnostics 响应不泄露 API key、App Secret、绝对敏感路径以外的凭据内容。

### Phase 3: 官方写入口补齐

**目标：** 避免 agent 找不到官方入口时又退回手改文件。

候选补齐：
1. Agent Profile:
   - `POST /v1/agents/reload` 或内部 `agentServiceRegistry.reload()`。
   - 仅重新加载 catalog -> registry，不创建新目录，不删除旧目录。
   - 错误文案必须提示先查看 diagnostics。
2. Conn:
   - 必要时提供 “stale run recovery / requeue” 官方接口，而不是手改 DB。
   - 第一版只允许把明确 stale 的 running run 释放回 pending，不允许任意改状态。
3. Asset:
   - `POST /v1/assets/repair-index` 只在明确维护操作下使用。
   - repair 前必须 dry-run，默认不删除 blob。
4. Model:
   - 保持 `PUT /v1/model-config/default` 为唯一默认模型变更入口。

验证：
- 为每个新增 API 写 route test。
- route error message test。
- 对写接口补并发 / 幂等测试，避免两个维护请求互相覆盖。

### Phase 4: Runtime 防呆和只读建议

**目标：** 降低 agent 误操作底层状态的机会。

候选措施：
1. 把运行态关键文件的“可编辑”说明从技能里移除，改为“只读排障”。
2. 对 `.data/agents/profiles.json` 这类文件增加注释不可行，因为 JSON 不支持注释；改在邻近文档和 debug API 中说明。
3. 在 API 错误信息里给出正确入口，例如重复创建时提示：
   - `Agent exists in catalog. If GET /v1/agents does not list it, restart ugk-pi or use registry reload.`
4. 对生产运维文档补“不要手改 shared runtime 状态”的专门段落。

验证：
- route error message test。
- 文档测试。

### Phase 5: 集中回归与上线手册

**目标：** 保证治理不破坏现有运行态。

验证清单：
- `npm test`
- `npx tsc --noEmit`
- 如涉及 UI：`test/server.test.ts`
- 如涉及生产部署口径：更新 `docs/server-ops.md` 或对应云手册

上线检查：
1. 本地确认 `GET /v1/agents`、`GET /v1/conns`、`GET /v1/assets` 正常。
2. 云端只做增量更新，不覆盖 shared runtime。
3. 如新增 reload/diagnostics API，先在本地验证，再上阿里云 / 腾讯云。

---

## 成功标准

- agent profile、conn、asset、conversation、skill、model、Feishu、activity 这几类状态都有明确“不要绕 API 直接改底层”的规范。
- 每类规范至少有文档或 skill 测试锁住。
- agent 遇到不一致时会优先报告“运行态分裂”，而不是继续手补底层文件。
- 后端逐步提供 diagnostics / reload / repair 入口，让线上问题有官方收口路径。

## 非目标

- 不在当前后台执行 Agent diff 中混入大范围治理。
- 不一次性重构所有存储层。
- 不禁止只读排障；当前阶段规训的是绕过 API 的写操作，不做全局文件写入拦截。
- 不把所有运行态文件改成只读文件系统；当前先通过规范、测试和官方接口引导治理。
