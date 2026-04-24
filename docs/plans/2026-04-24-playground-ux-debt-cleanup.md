# Playground UX Debt Cleanup Plan

> 执行前提：这是一份体验债大扫除计划。当前阶段只读审计和规划，不改源码；执行需要用户确认后再逐项落代码。原定 `.codex/plans/` 被 Windows ACL 拒绝写入，因此本计划落在 `docs/plans/`。

## 目标

把 `playground` 里会让用户感觉“点了没反应、越用越慢、列表一多就卡、旧请求污染当前视图”的设计债系统性清掉。核心原则是：读视图不能启动重 runtime，用户切换不能被后台 hydrate 阻塞，列表页不能靠 N+1 请求硬撑，重复点击不能制造多条服务端动作。

## 审计结论

### P0-1 会话切换仍是“等待服务端 hydrate 后才算完成”

- 证据：
  - `src/ui/playground-conversations-controller.ts:417` 的 `activateConversation()` 会先切本地状态，但随后 `await restoreConversationHistoryFromServer(...)`。
  - `src/ui/playground-conversations-controller.ts:550` 的 `startNewConversation()` 在 `POST /v1/chat/conversations` 后又 `await activateConversation(...)`。
  - `src/ui/playground-conversations-controller.ts:455` 的旧会话选择同样先 `POST /v1/chat/current`，再等待 hydrate。
- 风险：
  - 即使后端 `/v1/chat/state` 已经提速，只要网络抖动、会话巨大、服务端 GC 或 Docker 冷一下，用户仍会觉得“点新会话 / 切旧会话慢”。
  - 当前没有独立的 `creatingConversation` / `switchingConversation` in-flight guard，用户快速连点可能制造多个 `POST /v1/chat/conversations`。
- 方向：
  - 改成两阶段激活：服务端确认 `conversationId` 后立即进入目标会话并释放交互；history/state hydrate 后台完成。
  - 新增 `state.conversationCreatePending` 和 `state.conversationSwitchPendingById`，按钮和列表项只防重入，不阻塞其它安全操作。
  - hydrate 失败只在目标会话内显示轻量状态，不回滚到旧会话。

### P0-2 `/v1/chat/state` 仍返回完整历史，前端才截断 160 条

- 证据：
  - `src/agent/agent-service.ts:417` `getConversationState()` 先构建完整 `sessionMessages`。
  - `src/agent/agent-service.ts:1122` `buildConversationHistoryMessages()` 遍历所有 session messages。
  - `src/agent/agent-service.ts:1558` `buildConversationViewMessages()` 基于完整 messages 复制。
  - `src/ui/playground.ts:3902` 前端才 `.slice(-MAX_STORED_MESSAGES_PER_CONVERSATION)`。
- 风险：
  - 小历史现在很快，但长会话会把 JSONL 读取、消息转换、响应体、前端 markdown hydrate 都拖大。
  - 这和刚修掉的“打开 runtime”不是一回事；那个坑填了，这个坑会在历史变长后冒头。
- 方向：
  - `GET /v1/chat/state` 增加 `viewLimit`，默认只返回最近 N 条可渲染消息。
  - `readSessionMessages()` 增加尾部读取或 `readRecentSessionMessages(sessionFile, limit)`，避免为了最近 160 条解析整份 JSONL。
  - 历史翻页走独立 `GET /v1/chat/history?before=...&limit=...`，不要让 state 扛完整历史。

### P0-3 `查看技能` 每次都 reload skills

- 证据：
  - `src/agent/agent-service.ts:212` `getAvailableSkills()` 直接转发 factory。
  - `src/agent/agent-session-factory.ts:287` `loadSkills()` 每次创建 resource loader。
  - `src/agent/agent-session-factory.ts:293` 每次 `resourceLoader.reload()`。
  - `src/ui/playground.ts:4550` `loadSkills()` 是用户可点击路径。
- 风险：
  - 技能目录多、磁盘慢、容器挂载慢时，“查看技能”会像一次小型启动。
  - 这类按钮用户预期是瞬时信息面板，不该触发重扫描。
- 方向：
  - 在 `AgentSessionFactory` 内做短 TTL 缓存和 fingerprint invalidation。
  - `GET /v1/debug/skills` 返回 `cachedAt` / `source`，前端显示结果但不制造一条长助手过程。
  - 增加测试：连续两次 `getAvailableSkills()` 只 reload 一次；skill path 变化后刷新。

### P0-4 后台任务管理器 N+1 拉取 runs

- 证据：
  - `src/ui/playground-conn-activity-controller.ts:798` 先 `fetchConnList()`。
  - `src/ui/playground-conn-activity-controller.ts:800` 对所有 conns `Promise.all(...)`。
  - `src/ui/playground-conn-activity-controller.ts:803` 每个 conn 调 `fetchConnRunsForConn()`。
- 风险：
  - 10 个 conn 就 11 个请求，50 个 conn 就 51 个请求，而且并发无限制。
  - 用户打开后台任务管理器时最容易看到“整页忙碌”，这是列表页经典翻车姿势。
- 方向：
  - `GET /v1/conns` 返回每个 conn 的 `latestRun` 摘要和必要计数。
  - 完整 runs 只在展开某个 conn 或打开详情时按需加载。
  - 如果短期不改后端，前端至少加 4 路并发池和可取消 controller。

### P0-5 `ConversationStore` 每次操作读写整份 JSON

- 证据：
  - `src/agent/conversation-store.ts:28` `get()` 读整个 state。
  - `src/agent/conversation-store.ts:75` `list()` 读整个 state。
  - `src/agent/conversation-store.ts:85` `setCurrentConversationId()` 读后写整个 state。
  - `src/agent/conversation-store.ts:99` / `src/agent/conversation-store.ts:135` 是完整 JSON read/write。
- 风险：
  - 当前会话少时没事，会话数上来后 `POST current`、`GET conversations`、`GET state` 串起来就是重复文件 I/O。
  - 多请求并发时没有显式写队列，体验上会表现成偶发等待。
- 方向：
  - 做进程内 cache，按 mtime 或写操作更新。
  - 写操作串行化，避免两个写互相覆盖。
  - 中长期把 conversation index 放进 SQLite，和 conn/activity 的方向统一。

### P1-1 `renderConversationState()` 总是清空 transcript 再重绘

- 证据：
  - `src/ui/playground.ts:3875` `renderConversationState()`。
  - `src/ui/playground.ts:3905` 每次 `clearRenderedTranscript()`。
  - `src/ui/playground.ts:4330` 本地恢复也清空 transcript。
- 风险：
  - state 同步频繁时，长消息 markdown 和代码块会反复 hydrate。
  - 用户正在读历史时虽然保留 scrollTop，但 DOM 全量替换仍可能造成视觉跳动和焦点丢失。
- 方向：
  - 先加 `conversationStateSignature`，同签名直接跳过 DOM 重绘。
  - 同一 conversation 内只 append / patch 末尾 active run。
  - 只有 conversationId 改变或历史页边界改变才全量清空。

### P1-2 恢复同步触发链偏重

- 证据：
  - `src/ui/playground-layout-controller.ts:162` `scheduleResumeConversationSync()`。
  - `src/ui/playground-layout-controller.ts:176` resume 时先 `ensureCurrentConversation()`。
  - `src/ui/playground-layout-controller.ts:180` 再 `restoreConversationHistoryFromServer()`。
  - `visibilitychange` / `pageshow` / `online` 都会触发。
- 风险：
  - 手机前后台切换、网络恢复、BFCache 返回会反复打 catalog + state。
  - 已有 cooldown，但仍是“恢复即查两次”的模型。
- 方向：
  - resume 分级：online 查 status/events，pageshow 查 state，visibilitychange 仅当 active run 或 stale 超时才查。
  - catalog 只在 current pointer 可能变化时查；单设备普通恢复不查 catalog。

### P1-3 任务消息读取后额外刷新 summary

- 证据：
  - `src/ui/playground-task-inbox.ts:706` `loadTaskInbox()`。
  - `src/ui/playground-task-inbox.ts:746` 读取 page 后 `void syncTaskInboxSummary(...)`。
  - `src/ui/playground-task-inbox.ts:534` summary 是独立请求。
- 风险：
  - 打开任务消息至少两次请求，标记已读后也再次请求 summary。
  - 数据量上来后不是最大瓶颈，但会增加移动端弱网等待。
- 方向：
  - `/v1/activity` 返回 `unreadCount`，列表页一次请求完成。
  - mark read / mark all read 返回新的 unread summary，前端本地同步。

### P1-4 资产详情按 id 无限制并发

- 证据：
  - `src/ui/playground-assets-controller.ts:133` `loadAssetDetails()`。
  - `src/ui/playground-assets-controller.ts:148` 对缺失 asset id `Promise.all(...)`。
- 风险：
  - 选中很多历史资产或 conn 编辑器恢复很多引用时会打请求风暴。
- 方向：
  - 增加 `GET /v1/assets?ids=...` 批量查询。
  - 前端维护 in-flight asset detail map，重复 id 共享同一个 Promise。

## 执行计划

### Task 1：会话动作改成两阶段提交

- 状态：已完成（2026-04-24）。`activateConversation()` 已改为后台 hydrate；`startNewConversation()` 增加 create pending guard，并让当前空白会话下的重复 `新会话` 点击保持幂等；历史列表切换请求 in-flight 时会冻结切换 / 删除动作，避免慢回包覆盖用户最新目标。
- 修改：`src/ui/playground-conversations-controller.ts`、`src/ui/playground.ts`、`test/server.test.ts`
- 步骤：
  1. 写测试锁定 `startNewConversation()` 有 create pending guard，连续点击只发一次 `POST /v1/chat/conversations`。
  2. 写测试锁定 `activateConversation()` 不再 `await restoreConversationHistoryFromServer()` 才返回。
  3. 实现 pending state、按钮状态和后台 hydrate。
  4. 手动验证：旧 state 接口人为延迟时，新会话 shell 仍立即切换。

### Task 2：state/history 读模型分页

- 状态：已完成（2026-04-24）。`GET /v1/chat/state` 已支持 `viewLimit`，默认返回最近 160 条可渲染历史并带 `historyPage` 元信息；`GET /v1/chat/history` 已支持 `limit` / `before` 游标分页，前端顶部加载更多历史改为服务端分页补页。当前实现先保持整文件读取再分页的绿测路径，尾部 JSONL 读取优化留到后续性能专项。
- 修改：`src/agent/agent-service.ts`、`src/routes/chat.ts`、`src/types/api.ts`、`src/ui/playground.ts`、`test/agent-service.test.ts`、`test/server.test.ts`
- 步骤：
  1. 写测试：1000 条 session JSONL，`getConversationState()` 默认只转换最近 160 条。
  2. 写测试：`GET /v1/chat/history?limit=...&before=...` 返回分页历史。
  3. 实现 recent/tail message reader；先可用整文件解析 + slice 绿测，再优化尾读。
  4. 前端 “加载更多历史” 改为服务端分页，不再只吃本地 160 条缓存。

### Task 3：技能列表缓存

- 状态：已完成（2026-04-24）。`DefaultAgentSessionFactory.getAvailableSkills()` 已增加 30 秒 TTL 缓存，并用 skill fingerprint 变化主动失效；`GET /v1/debug/skills` 响应现在返回 `source` 与 `cachedAt`，可直接看出本次是 fresh reload 还是 cache 命中。
- 修改：`src/agent/agent-session-factory.ts`、`src/agent/agent-service.ts`、`src/routes/chat.ts`、`src/types/api.ts`、`test/agent-session-factory.test.ts`、`test/agent-service.test.ts`、`test/server.test.ts`
- 步骤：
  1. 写测试：连续两次 `getAvailableSkills()` 只触发一次 `resourceLoader.reload()`。
  2. 增加 TTL 和 fingerprint invalidation。
  3. API 返回缓存元信息，前端保持现有展示即可。

### Task 4：conn 管理器去 N+1

- 状态：已完成（2026-04-24）。`GET /v1/conns` 现在会通过 `ConnRunStore.listLatestRunsForConns()` 批量带回每个 conn 的 `latestRun` 摘要；没有运行记录时返回 `latestRun: null`，前端据此区分“新协议但确实无 run”和“旧后端没有 latestRun 字段”。后台任务管理器打开时只请求一次 `/v1/conns`，展开单个 conn 时才按需请求 `/v1/conns/:connId/runs` 补完整 run 列表；旧后端 fallback 保留 4 路并发池，避免退回无限 N+1。
- 修改：`src/routes/conns.ts`、`src/agent/conn-run-store.ts`、`src/ui/playground-conn-activity-controller.ts`、`src/ui/playground.ts`、`src/types/api.ts`、`test/server.test.ts`、`test/conn-run-store.test.ts`
- 步骤：
  1. 写测试：`GET /v1/conns` 返回 `latestRun`。
  2. 前端打开管理器只请求 `/v1/conns` 一次。
  3. 展开单个 conn 或打开详情时再拉 runs/events。
  4. 保留短期 fallback：后端没 `latestRun` 时最多 4 路并发拉 runs。

### Task 5：ConversationStore cache 和写队列

- 状态：已完成（2026-04-24）。`ConversationStore` 现在按 index 文件 `mtime` 复用进程内 state，写操作统一进入串行队列，并用同目录临时文件 `rename` 原子替换落盘；连续 `get/list/getCurrent` 不再重复解析同一份 JSON，并发 `set()` / `setCurrentConversationId()` 不再互相覆盖字段。
- 修改：`src/agent/conversation-store.ts`、`test/conversation-store.test.ts`
- 步骤：
  1. 写测试：多次 `get/list/getCurrent` 在未变更时复用内存 state。
  2. 写测试：并发 `setCurrentConversationId()` 和 `set()` 不丢字段。
  3. 实现 cache、dirty 写队列和原子写临时文件替换。

### Task 6：transcript diff 渲染

- 状态：已完成（2026-04-24）。`renderConversationState()` 现在会计算 canonical state 签名；同会话同签名时跳过 transcript DOM 重绘，只更新 context usage / active run 状态。消息窗口变化时优先用 `syncRenderedConversationHistory()` patch 已渲染节点或 append 新节点，只有会话切换或当前消息序列无法对齐时才重建当前 transcript。
- 修改：`src/ui/playground.ts`、`src/ui/playground-transcript-renderer.ts`、`test/server.test.ts`
- 步骤：
  1. 写测试锁定 `buildConversationStateSignature()` 被用于跳过同签名重绘。
  2. 同 conversationId、同 messages 签名时只更新 context usage / active process。
  3. active run delta 只 patch 最后一条 assistant，不清空整个 transcript。

### Task 7：恢复同步触发链减重

- 状态：已完成（2026-04-24）。`scheduleResumeConversationSync()` 现在会合并同一冷却窗口 / in-flight 期间的恢复选项，并按生命周期原因决定是否真的读取 catalog 或 canonical state：`pageshow` 强制校准当前会话 state；`visibilitychange` 只在 active run 或 state 超过恢复阈值时回源；`online` 优先用 active run 提示查状态并续订 `/v1/chat/events`，没有运行迹象时不再顺手拉完整历史。
- 修改：`src/ui/playground-layout-controller.ts`、`src/ui/playground.ts`、`test/server.test.ts`
- 步骤：
  1. 写测试锁定恢复同步存在 `mergeResumeSyncOptions()`、`shouldResumeCatalogSync()`、`shouldResumeStateSync()` 与 active run 重连入口。
  2. 为 `renderConversationState()` 记录 `lastConversationStateSyncAt`，让 visibility 恢复可以判断 state 是否过期。
  3. 把 `visibilitychange` / `pageshow` / `online` 的恢复选项拆开，避免三个入口都串成 catalog + state 的慢路径。

### Task 8：任务消息未读 summary 随主请求返回

- 状态：已完成（2026-04-24）。`GET /v1/activity` 现在会随列表返回 `unreadCount`；`POST /v1/activity/:activityId/read` 和 `POST /v1/activity/read-all` 也会返回新的未读数。前端加载任务消息、单条标记已读、全部已读和通知广播刷新列表时直接应用主响应里的未读数，不再额外补 `GET /v1/activity/summary`。
- 修改：`src/routes/activity.ts`、`src/types/api.ts`、`src/ui/playground-task-inbox.ts`、`src/ui/playground-stream-controller.ts`、`test/server.test.ts`
- 步骤：
  1. 写测试锁定 `/v1/activity`、单条已读和全部已读响应都包含 `unreadCount`。
  2. 写页面脚本断言，禁止 `loadTaskInbox()` / `markTaskInboxItemReadAndSync()` / `markAllTaskInboxItemsRead()` 在主请求后再补 summary 请求。
  3. 前端新增 `applyTaskInboxUnreadCount()`，把列表响应和已读动作响应统一落到 badge、筛选按钮和全部已读按钮状态。

### Task 9：资产详情 hydrate 并发收口

- 状态：已完成（2026-04-24）。`loadAssetDetails()` 现在不再对缺失 asset id 做无限制 `Promise.all(async fetch)`；前端通过 `assetDetailQueue` 将 `/v1/assets/:assetId` 详情补拉限制为最多 4 路并发，并用 `assetDetailInFlightById` 复用同一 assetId 的进行中 Promise。大量历史附件或 conn 附加资料恢复时，不会因为一串 id 同时 hydrate 把浏览器连接池和后端接口一起打满。
- 修改：`src/ui/playground-assets-controller.ts`、`src/ui/playground.ts`、`test/server.test.ts`
- 步骤：
  1. 写页面脚本断言锁定 `ASSET_DETAIL_CONCURRENCY_LIMIT`、`assetDetailQueue`、`assetDetailInFlightById` 和 `pumpAssetDetailQueue()`。
  2. 提取 `fetchAssetDetail()`，把详情请求放进队列泵，完成后立即合并进 `recentAssets`。
  3. `loadAssetDetails()` 保留 id 去重和 recent cache 命中，未命中 id 改走 `enqueueAssetDetailLoad()`，同 id 并发复用同一 Promise。

## 验收标准

- 旧会话 `/v1/chat/state` 小历史响应保持百毫秒级；长历史不会随完整 JSONL 线性劣化到秒级。
- 新会话创建成功后，UI 在 `POST /v1/chat/conversations` 返回后立即可输入，不等待 state hydrate。
- 快速双击新会话只创建一条服务端会话。
- 打开后台任务管理器的请求数从 `1 + N` 降为 `1`。
- 连续点击查看技能第二次走缓存。
- 页面恢复 / 网络恢复不会无差别串行读取 `/v1/chat/conversations` 与 `/v1/chat/state`。
- 打开任务消息、标记单条已读和全部已读不会在主请求后再固定补打一条 `/v1/activity/summary`。
- 资产详情 hydrate 最多 4 路并发；重复 asset id 在进行中请求未完成前复用同一 Promise，不会恢复成无限制 `/v1/assets/:assetId` 请求风暴。
- `npm test` 通过；新增回归测试覆盖每个体验债。
- `docs/playground-current.md` 和 `docs/change-log.md` 在执行对应任务时同步更新。
