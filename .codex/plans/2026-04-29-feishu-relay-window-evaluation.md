# Feishu Relay Window Evaluation

日期：2026-04-29

## 用户目标

飞书只作为收发中转窗口。Web playground 也是一个视窗。系统同时只运行一个 agent，不把飞书接入做成第二套聊天系统，也不为每个飞书群聊重新造一套 agent 编排。

## 当前现状

已有 Feishu 模块不是空白：

- `src/routes/feishu.ts` 已提供 `POST /v1/integrations/feishu/events`
- `src/integrations/feishu/message-parser.ts` 已解析 `im.message.receive_v1`
- `src/integrations/feishu/attachment-bridge.ts` 已把飞书文件 / 图片下载成 `ChatAttachment`
- `src/integrations/feishu/conversation-map-store.ts` 已有串行写入与原子替换
- `src/integrations/feishu/queue-policy.ts` 已按纯文本 / 附件决定 `steer` 或 `followUp`
- `src/integrations/feishu/delivery.ts` 已支持文本回传、文件上传回飞书、失败降级为 URL
- `test/feishu-service.test.ts` 与 `test/feishu-message-parser.test.ts` 已覆盖部分主链路

Agent 层已经强制单运行：

- `AgentService.runChat()` 如果 `activeRuns.size > 0` 会拒绝新 run
- `queueMessage()` 只能对当前 active conversation 追加 `steer / followUp`
- Web playground 当前是“一个 agent、多条历史会话、一个全局当前会话”的模型

## 关键冲突

现有 Feishu 逻辑仍按 `chat:<feishuChatId>` 映射到 `feishu:chat:<feishuChatId>`。这适合“每个飞书群一条本地会话”的模型，但不完全符合“飞书只是同一个 agent 的另一个窗口”。

如果继续沿用 per-chat conversation：

- 好处：隔离不同飞书群上下文，历史清楚。
- 问题：飞书会像一个独立会话入口，不再天然跟随 Web 当前会话；用户在 Web 看到的当前视窗和飞书视窗可能不是同一个上下文。

如果强制飞书永远投递到服务端 `currentConversationId`：

- 好处：最符合“同一个 agent，一个当前窗口”的直觉。
- 问题：多个飞书群同时发消息时会抢同一条当前会话；缺少权限与来源标记时，很容易把不同人的消息混进同一上下文。这个坑不小，别装看不见。

## 推荐方案

推荐做“单 agent 当前会话中转”模式，但保留现有飞书模块作为底座。

核心规则：

1. 飞书入站消息默认投递到 `AgentService` 当前会话，而不是为每个飞书 chat 自动创建独立业务世界线。
2. 如果 agent 当前正在运行，飞书消息走现有 `queueMessage()`：
   - 纯文本走 `steer`
   - 带附件走 `followUp`
3. 如果 agent 空闲，飞书消息走 `chat()` 启动同一个全局 agent run，并把当前会话设置成 active。
4. Web playground 继续通过 `GET /v1/chat/state` / `GET /v1/chat/events` 观察同一条 run，不新增一套飞书专用运行态。
5. 飞书出站继续复用 `FeishuDeliveryService`，先发文本，再上传 `send_file` 产物，上传失败才回退 URL。
6. 飞书来源信息应作为轻量上下文前缀进入 prompt，例如 `[来自飞书 chat_id=... message_id=...]`，但不要污染用户可见 transcript 文案。

## 难度评估

整体难度：中等偏低，约 2-3 个小迭代。

不是难在飞书 API，而是难在边界收口：

- 入站要复用现有 `FeishuService`，不要重写 webhook / client / delivery。
- 会话选择策略要改清楚，否则 Web 和飞书会看到两套上下文。
- 运行中队列策略已经有轮子，直接用，别重新发明“打断关键词”这种土办法。
- 文件入站和出站已有桥接，但需要补真实错误兜底和测试。
- 需要补飞书事件幂等，否则飞书 webhook 重试可能导致同一条消息重复喂给 agent。

## 实施切片建议

### P0：明确飞书窗口绑定策略

增加一个小的 resolver，而不是把逻辑塞进 `FeishuService.processIncomingEvent()`。

可选策略：

- `current`：飞书始终投递到当前服务端会话，推荐作为本阶段默认
- `mapped`：继续按飞书 chat 映射到本地 conversation，保留兼容

建议用环境变量或配置开关控制，例如 `FEISHU_CONVERSATION_MODE=current|mapped`。默认可以先用 `current`，但测试里保留 `mapped` 兼容，避免把旧轮子一脚踢碎。

### P1：补入站幂等

飞书消息有 `message_id`。应记录已处理或处理中 message id，至少在进程内 + 可持久化文件/SQLite 中做去重。否则 webhook 重试会重复运行 agent，这种问题线上看起来像“模型疯了”，其实是自己没挡重试。

最小可行版本：

- 新增 `FeishuMessageDeduper`
- 按 `message_id` 判断是否已接受
- 已处理消息直接返回 accepted，不再 queue/chat
- 先用文件或现有 feishu data dir 存储，后续再考虑 SQLite

### P2：Web 与飞书双窗口一致性

飞书触发 agent 后，Web 端应自然看到：

- 当前会话变更
- active run
- assistant 流式或完成态

如果走当前会话模式，大概率现有 `/v1/chat/state` 与 `/v1/chat/events` 已够用；只需要补测试确认 `FeishuService` 调用 `chat()` 后 `ConversationStore.currentConversationId` 与 active run 行为符合预期。

### P3：出站目标策略

当前飞书入站回到同一个 `chatId`，这符合“收发窗口”。后续如果要让 Web agent 主动发飞书消息，应优先复用 `FeishuDeliveryService.deliverText()`，不要新增一套发送 HTTP client。

后台 `conn` 的 `feishu_chat / feishu_user` target 已经存在，别和前台飞书窗口混成一个概念：

- 前台飞书窗口：用户消息进入当前 agent
- 后台 conn 飞书投递：任务结果发到指定飞书目标

## 主要风险

1. 权限边界：如果多个飞书群都能写当前会话，消息会混流。至少要允许白名单 chat id。
2. 幂等边界：飞书 webhook 重试必须去重。
3. 当前会话抢占：Web 用户正在某会话编辑/观察时，飞书入站可能切 current conversation。需要确认这是产品预期。
4. 附件大小：当前桥接仍把下载内容转成 base64 `ChatAttachment`，大文件会有内存压力。先保留现状，但要限制大小或失败降级。
5. 回传文件 URL：生产 `PUBLIC_BASE_URL` 必须正确，否则飞书上传失败后的 URL 降级会给出打不开的链接。

## 验证建议

最小验证集：

- `npm run test -- test/feishu-message-parser.test.ts`
- `npm run test -- test/feishu-service.test.ts`
- 新增 current conversation mode 的 FeishuService 单测
- 新增 webhook 重复 `message_id` 不重复调用 agent 的单测
- 手工验证：
  - 飞书发文本，Web 当前会话能看到同一轮结果
  - agent 运行中飞书补充文本，进入 `steer`
  - agent 运行中飞书发文件，进入 `followUp`
  - agent 产出文件后，飞书收到文本和文件

## 结论

这不是重做飞书接入，而是把现有 Feishu 模块从“按飞书 chat 派生本地会话”收口成“同一个 agent 的飞书窗口”。推荐先做 current conversation mode、幂等、白名单和测试。不要重写 client、delivery、attachment bridge、queue policy；那些轮子已经在了，乱造新轮子就是没事找事。
