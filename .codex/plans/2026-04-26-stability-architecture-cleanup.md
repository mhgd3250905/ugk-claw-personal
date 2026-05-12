# UGK CLAW Stability Architecture Cleanup Plan

> 执行前提：本计划只负责把当前稳定项目做“低风险整理优化”，不是推倒重来。执行源码改动前必须先取得用户确认，并创建可回溯点。每个任务按 TDD 执行：先写失败测试，再写最小实现，再补文档与变更记录。

## Goal

在不破坏现有功能的前提下，清理当前项目里最影响长期维护的冗余、耦合和风险实现，让后续 agent 接手时更容易定位模块、验证行为和回滚改动。

## Current Architecture Read

当前项目已经从“原型堆功能”进入稳定维护期。核心边界如下：

- `src/server.ts` 只负责 Fastify 装配，把 `AgentService`、资产库、会话目录、conn/activity/Feishu 等依赖注入到路由层。
- `src/agent/agent-service.ts` 是前台聊天运行态中枢，维护单 agent 多会话模型、active/terminal run、事件缓冲、canonical state、文件交付和浏览器清理。
- `src/agent/conversation-store.ts` 已完成比较稳的文件型索引模式：mtime cache、写队列、同目录临时文件加 `rename` 原子替换。
- `src/agent/asset-store.ts` 统一用户上传和 agent 输出资产，但索引写入仍是普通 read-modify-write，没有写队列和原子替换。
- `src/agent/conn-*` 与 `src/workers/conn-worker.ts` 承担后台任务、SQLite 持久化、lease/heartbeat、activity 投递和通知广播。
- `src/ui/playground.ts` 已经拆出多个 controller，但仍是 5000 行级主装配文件。继续拆分要只沿清晰 ownership 做，不能把刚稳定的流式恢复和会话切换再搅乱。
- 文档体系已经比较完整，后续任何行为、接口、运行方式变更都必须同步 `docs/change-log.md`，必要时同步 `docs/playground-current.md`、`docs/runtime-assets-conn-feishu.md`、`docs/traceability-map.md`。

## Confirmed Baseline Facts

- 本地入口：`http://127.0.0.1:3000/playground`
- 健康检查：`http://127.0.0.1:3000/healthz`
- 标准验证：`npm test`、涉及设计时加 `npm run design:lint`
- 生产入口：`http://43.156.19.100:3000/playground`
- 生产部署目录：`~/ugk-claw-repo`
- 生产运行态目录：`~/ugk-claw-shared`
- 当前工作区已有未跟踪文件：`runtime/commit-playground-asset-detail-hydration.ps1`、`runtime/pudong-weather.md`，不是本计划内容，不能顺手提交或删除。

## Risk Register

### P0-1 AssetStore 索引写入有丢更新风险

证据：

- `src/agent/asset-store.ts` 的 `registerAttachments()`、`saveFiles()`、`saveFileBuffers()` 都是 `readIndex()` 后修改内存对象，再 `writeIndex()`。
- `writeIndex()` 直接 `writeFile(indexPath, ...)`，没有同目录临时文件 + rename，也没有串行队列。
- 同一时间多个上传请求、后台 `send_file` 和 chat 上传并发时，后写入者可能覆盖先写入者的 index 记录。blob 文件因 sha256 + `wx` 相对安全，但元数据 index 不安全。

方向：

- 借鉴 `ConversationStore`：加进程内 cache、写队列、原子写。
- 保持 `AssetStoreLike` 外部接口不变，先不改路由和前端。
- 测试覆盖并发 `registerAttachments()`、`saveFiles()` 不丢记录，写入后 index 是合法 JSON，blob 路径仍受根目录约束。

### P0-2 长会话读取仍有全量 JSONL 尾巴

证据：

- `docs/handoff-current.md` 已明确下一阶段建议是“长会话 JSONL 尾读优化”。
- `src/agent/agent-session-factory.ts` 的 `readSessionMessagesFromJsonl()` 当前读取完整文件并逐行解析。
- `AgentService.getConversationState()` 已做分页响应，但底层仍可能为最近 160 条读完整 session。

方向：

- 先扩展 session factory 内部读取能力，新增 recent/tail reader，不改变外部 API 响应结构。
- 保留完整读取作为 fallback，避免复杂 JSONL 边界导致历史丢失。
- 测试构造大 JSONL，证明读取最近窗口不会解析整份文件。

### P1-1 路由层错误响应和字段解析重复

证据：

- `src/routes/chat.ts`、`src/routes/conns.ts`、`src/routes/files.ts` 都有自己的 `sendBadRequest()` / `sendInternalError()` / `parseAssetRefs()` / 正数解析等。
- 重复逻辑增加后续接口改动的漏改概率。

方向：

- 提取极小的 `src/routes/http-errors.ts` 和必要的 `src/routes/parse.ts`。
- 先只迁移完全等价的错误响应和基础 parser，不碰业务语义。
- 测试继续以现有 `test/server.test.ts` 行为为准，避免为了“抽象优雅”改坏响应。

### P1-2 AgentService 文件过大，状态机和视图组装耦合

证据：

- `src/agent/agent-service.ts` 约 1800 行，包含 run 生命周期、事件映射、资产准备、history 组装、terminal overlap、process payload 格式化等多类职责。
- 这不是立即 bug，但对后续 agent 维护不友好。

方向：

- 不改行为地提取纯函数模块：`agent-run-events`、`conversation-history-view`、`process-payload-format` 这类无副作用逻辑。
- 每次只提取一簇，并用现有 `agent-service.test.ts` 锁行为。
- 不移动 activeRuns/terminalRuns 所有权，避免状态机裂开。

### P1-3 前端主装配文件仍偏大

证据：

- `src/ui/playground.ts` 约 5138 行，虽然运行态 controller 已拆出，但仍承载大量状态、DOM refs、HTML/CSS 拼装与脚本注入。

方向：

- 不做大规模视觉重构。
- 只沿已经存在的 controller ownership 拆静态片段或纯 helper。
- 每拆一块，用 `test/server.test.ts` 锁定真实 HTML/JS 标记，必要时浏览器验证。

### P2-1 文档和代码口径需要持续对齐

证据：

- 文档已经很全，但部署文档和 handoff 中存在不同日期的“当前提交”记录。它们是时间切片，不一定错误，但接手者容易误读。
- 部分模块真实状态需要在优化后同步回 `traceability-map` 和专题文档。

方向：

- 每个源码任务完成后更新 `docs/change-log.md`。
- 如果任务影响模块边界，同步 `docs/traceability-map.md`。
- 如果影响资产/conn/playground，分别同步对应专题文档。

## Execution Strategy

### Safety First

1. 执行前创建回溯点：
   - 本地分支或 tag：`backup/pre-architecture-cleanup-20260426`
   - 记录 `git status --short`
   - 不处理既有未跟踪 runtime 文件
2. 优先使用隔离工作区；如果本仓库没有已忽略的 `.worktrees/` 或 `worktrees/`，需要用户确认位置后再创建。
3. 每个任务小步提交，提交信息只描述一个行为变化。
4. 禁止“顺手美化”无关代码。这个项目已经基本稳定，乱动就是添乱。

### Verification Matrix

- 通用：`npm test`
- 文档/格式：`git diff --check`
- 涉及设计系统：`npm run design:lint`
- 涉及 playground 行为：启动/重启服务后验证 `http://127.0.0.1:3000/playground` 实际返回新标记。
- 涉及 web-access：`npm run docker:chrome:check`
- 涉及生产部署：先确认增量更新还是整目录替换；默认只做增量。

## Implementation Tasks

### Task 1: Harden AssetStore Index Writes

Files:

- Modify: `src/agent/asset-store.ts`
- Test: `test/asset-store.test.ts`
- Docs: `docs/runtime-assets-conn-feishu.md`, `docs/change-log.md`

Steps:

1. 写失败测试：并发 `registerAttachments()` 向同一个 index 写入多个资产，最终 `listAssets()` 不丢记录。
2. 写失败测试：并发 `saveFiles()` 和 `registerAttachments()` 混合写入，最终 agent output 和 user upload 都存在。
3. 写失败测试：写入过程产出的 index 文件必须保持合法 JSON。
4. 实现 `AssetStore` 内部 `writeQueue`，所有 index mutation 通过串行 `mutateIndex()`。
5. 实现同目录临时文件 + `rename` 原子替换，失败时清理 temp。
6. 可选增加 mtime cache，减少列表/详情重复读盘；只在不扩大风险时做。
7. 运行 `npm test -- test/asset-store.test.ts`，再运行 `npm test`。
8. 更新资产文档和 change log。

### Task 2: Add Recent Session JSONL Reader

Files:

- Modify: `src/agent/agent-session-factory.ts`
- Modify: `src/agent/agent-service.ts`
- Test: `test/agent-session-factory.test.ts`, `test/agent-service.test.ts`
- Docs: `docs/playground-current.md`, `docs/change-log.md`

Steps:

1. 写失败测试：大 JSONL session 中读取最近 N 条消息，返回顺序正确。
2. 写失败测试：文件小、行损坏、末尾无换行时 fallback 不丢可解析消息。
3. 扩展 session factory，提供 recent reader 能力；现有完整 reader 保持兼容。
4. `getConversationState()` 使用最近窗口能力；`getConversationHistory()` 保持 cursor 语义。
5. 运行相关测试和全量 `npm test`。
6. 文档补上“分页响应已经有，底层 recent reader 已收口”的真实口径。

### Task 3: Extract Route Error Helpers Without Behavior Change

Files:

- Create or Modify: `src/routes/http-errors.ts`
- Modify: `src/routes/chat.ts`, `src/routes/conns.ts`, `src/routes/files.ts`
- Test: `test/server.test.ts`
- Docs: `docs/traceability-map.md`, `docs/change-log.md`

Steps:

1. 写/确认测试：现有 400/500 错误 body 格式不变。
2. 提取 `sendBadRequest()`、`sendInternalError()` 等纯响应 helper。
3. 逐个路由替换重复实现，不改业务 parser。
4. 运行 `npm test -- test/server.test.ts` 和 `npm test`。
5. 更新文档入口说明。

### Task 4: Extract Pure AgentService Helpers

Files:

- Modify: `src/agent/agent-service.ts`
- Create or Modify: `src/agent/conversation-history-view.ts`
- Create or Modify: `src/agent/agent-run-events.ts`
- Test: `test/agent-service.test.ts`
- Docs: `docs/traceability-map.md`, `docs/change-log.md`

Steps:

1. 先不改行为，挑纯函数区域提取：history message coalescing、terminal run exposure、process payload formatting。
2. 每提取一组，运行 `test/agent-service.test.ts`。
3. 保持 `activeRuns`、`terminalRuns`、session open/close 仍由 `AgentService` 拥有。
4. 不为了减少行数拆状态机。行数难看不是最可怕的，状态所有权裂开才可怕。
5. 全量 `npm test` 后更新文档。

### Task 5: Frontend Ownership Cleanup

Files:

- Modify: `src/ui/playground.ts`
- Modify existing controller files only when ownership already明确
- Test: `test/server.test.ts`
- Docs: `docs/playground-current.md`, `docs/change-log.md`

Steps:

1. 先列出 `playground.ts` 中仍未归属 controller 的函数簇。
2. 只移动纯 helper 或静态片段，不改变 DOM ID、CSS class、接口路径。
3. 用 `server.test.ts` 锁定页面源码标记。
4. 如涉及视觉/交互，重启服务并浏览器验证桌面和手机入口。
5. 更新 playground 当前文档。

## What Not To Do

- 不把 `references/pi-mono/` 当业务源码改。
- 不把 `.data/`、运行截图、生产日志、sidecar 登录态塞进 Git。
- 不重写 playground 视觉体系。
- 不把 `ConversationStore` 已经稳定的写队列回退成普通读写。
- 不把当前 sidecar 主链路改回 Windows host IPC。
- 不为“模块化”制造抽象工厂套娃。代码不是盖章比赛，抽象没有降低复杂度就别加。

## Approval Gate

计划完成后，执行需要用户确认。建议首个执行切片是 Task 1，因为它收益明确、行为边界窄、测试好写，而且能直接消除真实并发写风险。

