# Playground 当前状态

更新时间：`2026-04-19`

这份文档只记录当前 `playground` 的真实前端约束，避免下一个人又拿旧截图和过时口径瞎猜。

核心实现文件：

- [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)

回归入口：

- `http://127.0.0.1:3000/playground`
- [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)

## 1. 品牌与页面骨架

- 当前品牌文案为 `UGK CLAW`
- 顶部 `topbar-signal` 与首页 `hero-wordmark` 都是文字字标
- 当前不显示图片 logo
- 页面仍是单一 `landing` 壳子，通过 `data-transcript-state=idle|active` 切空态和会话态
- 当前整体视觉基调已从偏冷蓝电子夜景收口为“深空黑 + 暗紫星云 + 冷白星尘”，蓝色只保留极弱余光，不再主导页面气质

## 2. 消息区约束

- 消息宽度跟随 composer 实际宽度，不依赖写死常量
- 当前会按 `conversationId` 在本地持久化最近对话消息；刷新页面后，优先恢复当前会话的最近一段 transcript，而不是每次都假装失忆
- 历史消息默认先渲染最近一段；向上滚动到 transcript 顶部时，会自动继续补更多旧消息，顶部同时保留“加载更多历史”按钮作为兜底入口
- `landing` 模式下，对话区底部避让按“`chat-stage` 底部到 `command-deck` 顶部的真实距离”动态计算，不再偷懒拿固定值或只拿 `command-deck` 高度瞎猜
- `landing` 模式下 transcript 容器会被锁进可用高度内，多选文件 / 资产后应表现为对话区收缩并滚动，而不是继续向下顶进 `command-deck`
- 用户消息固定靠右
- 用户消息正文保持标准左对齐，避免右侧大段文字影响阅读
- 用户消息 `message-meta` 只显示时间，并贴右展示
- 每个消息气泡底部统一带“复制正文”按钮，只复制当前消息正文，不复制时间、角色标签和文件按钮
- `not_running`、`abort_not_supported` 这类运行态控制错误统一从顶部悬浮横幅提示，不再占用主内容流，也不再写进底部过程流
- 顶部错误横幅去掉边框，统一 `4px` 圆角，右侧提供 `x` 关闭按钮
- 顶部错误横幅默认带 `hidden`，只有真正出现错误时才解除隐藏；刷新页面后不该再残留一个空壳横幅
- 同时使用 `.error-banner[hidden] { display: none !important; }` 兜底，不把显隐安全性全压在单条普通样式规则上
- 系统反馈在视觉上跟助手消息保持一致，不再单独走一套“提示条”布局
- 所有矩形统一使用 `4px` 圆角

## 3. 助手“思考过程”区域

- 思考过程嵌在助手回复气泡内，只保留单个壳子
- 默认展开，按钮显示 `收起`
- 上半区显示过程叙述，自动滚到最新内容，最多展示 5 行
- 下半区显示“当前动作”，固定展示 2 行
- 点击 `收起` 后：
  - 隐藏上半区叙述
  - 隐藏“思考过程”标题
  - 只保留下半区当前动作
- 外层为深色底、无边框
- “当前动作”不再使用独立小卡片背景，只靠上下分割线区分

## 4. 文件与资产展示

- 待发送附件和已选资产统一用 chip 风格展示
- chip 包含：
  - 类型 badge
  - 文件名
  - 可选删除按钮
- 选择区里的 chip 可删除
- 历史消息里的 chip 不显示删除按钮
- 已发送附件 / 引用资产会直接显示为 chip，不再自动补“引用资产:”文案
- 选择文件后，输入框不会自动注入文件清单文本
- 选择文件后，也不会再出现“文件已载入 / 待发送附件”这类额外提示

## 5. “查看技能”按钮行为

- 点击后会生成一条像助手回复的消息
- 先展示简化过程：
  - 接收到指令
  - 请求 `/v1/debug/skills`
  - 接口返回
  - 整理结果
- 最终结果会直接列出完整技能清单
- 不再把旧的 system 调试噪音塞进 transcript

## 6. 新会话行为

- 点击“全新的记忆”后，会先切到新的 `conversationId`
- transcript 会立即追加一条助手样式气泡，明确提示“当前启用新会话”以及新的会话 ID
- 新会话提示本身也会进入本地历史，刷新后仍可见，不再是点了按钮但界面像没响应一样装死

## 7. 已知关联文件

- 页面结构、样式、脚本： [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
- 页面返回断言： [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
- 资产与文件下载： [src/agent/asset-store.ts](/E:/AII/ugk-pi/src/agent/asset-store.ts)、[src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
- 技能真实来源： [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts) 的 `GET /v1/debug/skills`

## 8. 运行态与 loading 约束

- 任务进行中必须在助手气泡下显示 loading 等待气泡，不能让用户猜 Agent 是运行、等待还是结束。
- loading 气泡会跟随 Agent 事件切换文案：接手任务、调用工具、等待工具返回、生成回复、完成、打断或失败。
- `done`、`interrupted`、`error` 都必须收口当前 loading 和过程日志，并同步释放前端 loading 状态。
- 刷新恢复运行态时，页面文案统一使用“当前任务正在运行 / 当前正在运行”，不要再写“上一轮仍在运行”。

## 9. 排查顺序建议

如果 playground 又出现“明明改了但页面看着没变”的情况，按这个顺序查：

1. `src/ui/playground.ts` 真源是否已改
2. `test/server.test.ts` 是否覆盖到真实行为
3. `docker compose restart ugk-pi`
4. `http://127.0.0.1:3000/healthz`
5. 强刷 `http://127.0.0.1:3000/playground`

别再靠开新端口和肉眼猜缓存来制造额外脏状态了。

## Refresh Run Recovery

- 刷新页面后，如果当前 `conversationId` 仍有后端任务运行，playground 会请求 `/v1/chat/status` 并恢复运行态。
- 恢复态不再把任务称为“上一轮”；页面统一渲染为“当前任务正在运行 / 当前正在运行”，因为真实 agent run 并不会因为 web 刷新变成历史任务。
- 恢复运行态后，playground 会继续请求 `/v1/chat/events`，重新订阅当前 active run 的 SSE 事件流，后续 `text_delta`、工具事件、`done`、`interrupted`、`error` 会继续更新同一个助手气泡。
- 如果当前助手气泡还没有正文，页面会写入最近一条用户任务摘要；如果刷新前已经有助手正文，则优先保留已有正文，避免把真实回复内容覆盖成状态说明。
- 刷新前浏览器已经收到的 Agent 过程日志会随助手消息的 `process` 快照一起恢复，包括“思考过程”列表、当前动作和运行 / 完成样式。
- 恢复运行态时会优先复用最近的助手气泡并重新激活过程日志卡片，不再重新创建一个没有过程上下文的空助手气泡。
- 恢复运行态下继续发送普通消息会进入 `/v1/chat/queue`，不会重新打开 `/v1/chat/stream` 去撞出 `Conversation ... is already running`。
- 恢复运行态下点击打断，如果后端确认中断，原 loading 气泡会收口为“本轮已中断”，前端按钮也会退出 loading 状态。
- 如果打断时后端已经没有运行任务，页面会把残留 loading 收口为“当前任务已结束”，不再把一个过期状态挂在对话底部装神弄鬼。
- 注意边界：`AgentService` 目前为内存中的 active run 保留最近一段事件缓冲，足够支持同一进程内刷新重连；如果服务进程重启，仍需要持久化 run event log 才能跨进程完整回放。
- 刷新导致的 `/v1/chat/stream` 暂态断线不算任务失败，不会再写入“网络 / network error”气泡；恢复历史时也会过滤旧的同类脏记录。
