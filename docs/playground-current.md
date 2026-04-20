# Playground 当前状态

更新时间：`2026-04-20`

这份文档只记录当前 `playground` 的真实前端约束，避免下一个人又拿旧截图和过时口径瞎猜。

核心实现文件：

- [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)

回归入口：

- `http://127.0.0.1:3000/playground`
- [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)

## 1. 品牌与页面骨架

- 当前品牌文案为 `UGK CLAW`
- 桌面端顶部 `topbar-signal` 与首页 `hero-wordmark` 继续使用文字字标
- 手机端顶部状态栏显示品牌 logo，并在右侧配套 `UGK Claw` 字标
- 页面仍是单一 `landing` 壳子，通过 `data-transcript-state=idle|active` 切空态和会话态
- 当前整体视觉基调已从偏冷蓝电子夜景收口为“深空黑 + 暗紫星云 + 冷白星尘”，蓝色只保留极弱余光，不再主导页面气质

## 2. 消息区约束

- 消息宽度跟随 composer 实际宽度，不依赖写死常量
- transcript 只有在用户停留在底部附近时才自动跟随最新输出；用户明显上滑阅读历史时，`text_delta`、loading 和过程日志更新都不能强制滚到底部
- 用户离开底部阅读历史时，页面显示“回到底部”按钮；点击后立即回到底部，并恢复后续自动跟随
- 当前 Web 入口采用“一个 agent、多个历史会话、一个全局当前会话”的模型；服务端维护 `currentConversationId`，不同浏览器 / 设备打开后都跟随这个当前会话
- 页面会先通过 `GET /v1/chat/conversations` 获取服务端会话目录和当前会话，再按当前 `conversationId` 请求 `GET /v1/chat/state` 同步真实历史与 active run
- 本地 `localStorage` 只作为当前设备的冷启动缓存和渲染快照，不再作为会话身份、当前会话指针或运行态事实源
- 从后端 session 恢复用户历史时，只展示用户原始消息；`<user_assets>`、`<asset_reference_protocol>`、`<file_response_protocol>` 这类运行时注入给模型的内部 prompt 协议不得出现在 transcript 里
- 历史消息默认先渲染最近一段；向上滚动到 transcript 顶部时，会自动继续补更多旧消息，顶部同时保留“加载更多历史”按钮作为兜底入口
- `landing` 模式下，对话区底部避让按“`chat-stage` 底部到 `command-deck` 顶部的真实距离”动态计算，不再偷懒拿固定值或只拿 `command-deck` 高度瞎猜
- `landing` 模式下 transcript 容器会被锁进可用高度内，多选文件 / 资产后应表现为对话区收缩并滚动，而不是继续向下顶进 `command-deck`
- 用户消息固定靠右
- 用户消息正文保持标准左对齐，避免右侧大段文字影响阅读
- 用户消息 `message-meta` 只显示时间，并贴右展示
- 每个消息气泡底部统一带“复制正文”按钮，只复制当前消息正文，不复制时间、角色标签和文件按钮
- markdown 正文渲染使用 `marked`，不是项目内手写解析器；后续补 Markdown 能力时优先配置/升级渲染库，不要继续追加临时正则
- markdown 正文里的“普通段落 + 紧跟 fenced code block”必须能正常渲染，不能再把 `CODEBLOCK0` 之类占位符漏到用户界面上
- markdown 正文里的 pipe table 与 `---` 分割线必须渲染为真正的 HTML 结构，不能继续把 `|------|` 或 `---` 当普通字符显示
- markdown 表格由外层滚动容器控制最大宽度，`table` 本体按内容宽度展示，不强制撑满消息气泡；宽表最多占满气泡并横向滚动
- `not_running`、`abort_not_supported` 这类运行态控制错误统一从顶部悬浮横幅提示，不再占用主内容流，也不再写进底部过程流
- 顶部错误横幅去掉边框，统一 `4px` 圆角，右侧提供 `x` 关闭按钮
- 顶部错误横幅默认带 `hidden`，只有真正出现错误时才解除隐藏；刷新页面后不该再残留一个空壳横幅
- 同时使用 `.error-banner[hidden] { display: none !important; }` 兜底，不把显隐安全性全压在单条普通样式规则上
- 系统反馈在视觉上跟助手消息保持一致，不再单独走一套“提示条”布局
- transcript 里的消息视觉类型只保留两类：`user` 走用户气泡，其余 `assistant` / `system` / `error` 等语义都走助手气泡；真实语义继续保存在 `data-message-kind`
- `/v1/chat/stream` 请求被拒绝、网络失败和缺少 `done` 的异常收口到顶部错误横幅与当前助手气泡过程区，不再额外追加 `message error` 主内容气泡
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
- 助手返回的文件下载卡片现在区分“打开”和“下载”两个动作：
  - 安全可预览文件（如 `png`、`jpg`、`gif`、`webp`、`pdf`、`txt`、`md`、`json`、`csv`）会显示“打开”按钮
  - “下载”按钮会显式走 `?download=1`，不再跟预览复用同一条附件响应
- `/v1/files/:fileId` 对安全可预览文件默认使用 `inline`；不安全或不可预览类型仍保持 `attachment`
- `html`、`svg`、`js` 这类可执行或脚本风险较高的文件不会直接作为同源预览打开，别为了省事把安全边界拆了

## 5. “查看技能”按钮行为

- 点击后会生成一条像助手回复的消息
- 先展示简化过程：
  - 接收到指令
  - 请求 `/v1/debug/skills`
  - 接口返回
  - 整理结果
- 最终结果会直接列出完整技能清单
- 不再把旧的 system 调试噪音塞进 transcript

## 6. 单工人多会话行为

- 当前项目按“一个 agent 工人，多条历史产线，但同一时刻只有一条全局当前产线”收口
- 服务端 `ConversationStore` 维护 `currentConversationId` 和会话目录；所有平台打开页面后都以服务端当前会话为准，不再固定写死 `agent:global`
- 点击 `新会话` 会调用 `POST /v1/chat/conversations` 创建新的 `conversationId`，并把它设置成全局当前会话；旧会话不会被 reset 或删除
- 手机端点击左侧品牌区会打开历史会话抽屉；点击历史项会调用 `POST /v1/chat/current`，成功后全平台下一次同步都会跟随新的当前会话
- agent 正在运行时，后端拒绝新建或切换会话；前端显示“当前任务未结束，不能切换产线 / 开启新产线”
- 如果未来真的要支持多用户同时操作，不能把这个单工人模型当成权限系统继续堆，必须重新设计认证、控制权和会话隔离

## 7. 已知关联文件

- 页面结构、样式、脚本： [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
- 页面返回断言： [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
- 资产与文件下载： [src/agent/asset-store.ts](/E:/AII/ugk-pi/src/agent/asset-store.ts)、[src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
- 技能真实来源： [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts) 的 `GET /v1/debug/skills`
- 会话目录与当前会话来源： [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts) 的 `GET /v1/chat/conversations`
- 当前会话状态来源： [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts) 的 `GET /v1/chat/state`
- 新建 / 切换会话入口： [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts) 的 `POST /v1/chat/conversations` 与 `POST /v1/chat/current`

## 8. 运行态与 loading 约束

- 任务进行中必须在助手气泡下显示 loading 等待气泡，不能让用户猜 Agent 是运行、等待还是结束。
- loading 气泡会跟随 Agent 事件切换文案：接手任务、调用工具、等待工具返回、生成回复、完成、打断或失败。
- `done`、`interrupted`、`error` 都必须收口当前 loading 和过程日志，并同步释放前端 loading 状态。
- `error` 与 `interrupted` 不再只是当前流页面里的临时视觉效果；它们也会以 terminal snapshot 形式进入 `GET /v1/chat/state` 的 canonical state，刷新页和观察页必须能看到同一份终态。
- `interrupted` 的状态文案单独显示为“已打断”，不要再偷懒混成“已结束”；失败态继续明确显示“错误”。
- 刷新恢复运行态时，页面文案统一使用“当前任务正在运行 / 当前正在运行”，不要再写“上一轮仍在运行”。
- 手机浏览器前后台切换、页面 `visibilitychange`、`pageshow`、`online` 后都会先重新核对服务端 `currentConversationId`，再同步当前会话的运行态和历史。
- 如果 `/v1/chat/stream` 主连接因为前后台切换或网络短断结束，但 `GET /v1/chat/state` 仍显示后端任务运行中，页面会切到 `/v1/chat/events` 继续接收事件，不再提示“网络错误”并停止更新。
- 如果 `/v1/chat/stream` 断开时任务其实已经刚好完成或失败，前端要先信 `GET /v1/chat/state` 的收口结果；只要 canonical state 已经推进到终态，就不应继续报“流被中断 / network error”。
- 用户点击发送或把消息追加进运行中的会话后，composer 要立即清空，明确表示消息已经发出；如果请求在真正进入后端前失败，再把草稿恢复回输入区，不能让用户白丢内容

## 9. 排查顺序建议

如果 playground 又出现“明明改了但页面看着没变”的情况，按这个顺序查：

1. `src/ui/playground.ts` 真源是否已改
2. `test/server.test.ts` 是否覆盖到真实行为
3. `docker compose restart ugk-pi`
4. `http://127.0.0.1:3000/healthz`
5. 用 `Invoke-WebRequest` 或浏览器源码确认 `http://127.0.0.1:3000/playground` 实际返回了本轮新增的标记，例如 `scroll-to-bottom-button` 或对应函数名
6. 强刷 `http://127.0.0.1:3000/playground`

如果源码和测试都已经更新，但第 5 步看不到新标记，说明运行中的 `ugk-pi` 仍在端旧 HTML；先重启服务，不要让用户继续测旧页面。别再靠开新端口和肉眼猜缓存来制造额外脏状态了。

## 10. 手机 Web 重写口径

- 这一节覆盖并取代之前“只是做适配”的旧说法；当前手机端不是压缩版桌面，而是保留现有逻辑后单独重写的移动展示层
- 手机端继续沿用桌面端的深空黑 / 暗紫星云 / 冷白星尘视觉语言，但页面组织改成更接近原生聊天页的结构
- 手机端当前统一视觉收口规则是：所有可见圆角一律压到 `4px`，不再混用 `12px / 14px / 16px`
- 顶部只保留紧凑品牌状态栏：左侧是可点击的 logo + `UGK Claw` 历史会话入口，右侧只保留 `新会话` icon 与 `更多` icon；`技能 / 文件 / 文件库` 三项收进右上角溢出菜单，每项统一是 `icon + 标题` 风格
- 手机端品牌区点击后展开左侧历史会话抽屉，列表项展示标题、摘要、更新时间和消息数；运行中禁止切换，避免一个 agent 工人被硬拽到另一条产线
- `新会话` 按钮现在走 `POST /v1/chat/conversations` 创建新的服务端会话并激活为 `currentConversationId`；不再 reset 旧会话，也不再只清本地 transcript
- `landing-screen` 在手机端直接隐藏，不再让 hero、大标题和装饰块继续吞掉首屏高度
- 中间主区收口成全高 transcript 区域，去掉额外边框和背景壳层，优先把有限空间让给对话内容；空态时会在 transcript 内直接给出起聊提示，而不是另起一块首页
- 拖拽上传区在手机端隐藏；已选文件与资产改成横向滚动条带，避免把竖向空间浪费在触屏上几乎不好用的拖拽壳子上
- Landing 空态底部 `#composer-drop-target.composer` 不再使用大输入框口径；桌面 landing composer 使用 `6px 8px 6px 10px` padding，textarea 固定 `40px` 高，发送 / 打断按钮最小高度为 `40px`，并通过 `align-self: end`、`height: fit-content`、`max-height: 64px` 防止外层 section 被手机 grid 拉伸成大块面板
- 底部 composer 改成手机优先结构：输入区单列铺满，右侧只保留紧凑 icon 控制；发送按钮使用居中的向上箭头 icon，打断按钮使用白色方形中断 icon，不再显示文字，也不再沿用桌面端按钮背景、边框和阴影；当前手机端这两个 icon 调整为 `28px`，避免把按钮本体撑大；中断按钮在未运行时也保留占位，只是禁用态变淡，不会直接消失；发送后的输入框立即清空，失败才回填草稿
- Active 对话态的 `#composer-drop-target.composer` 基础高度已经收口：普通对话中的 textarea 默认最小高度为 `72px`、最大高度为 `18vh`，并禁用手动竖向 resize；`max-width: 960px` 下右侧发送 / 打断按钮横排，避免按钮掉到输入框下方继续撑高底部区域
- 手机端 active 对话态继续走更紧凑输入区约束，不只在 landing 空态生效；普通对话中的 textarea 最小高度收口为 `44px`、最大高度收口为 `96px`，避免底部输入区吃掉约四分之一屏幕高度
- 手机端消息气泡、字号、留白、按钮尺寸都按小屏重新收口，用户消息宽度放宽到更适合单手阅读的比例
- 手机端富文本里的代码块继续沿用原有 markdown 逻辑，但展示层会额外收口：外层 `.code-block` 退成透明壳子，代码区域本身不再叠半透明背景，边框也收成全透明，只保留排版层次；工具条不再整条展示，只保留右上角一个透明背景的纯图标复制按钮，不显示文字 label；助手消息里的 `code` 背景也强制透明，同时限制最大宽度并让超长代码行在块内换行，避免把消息气泡横向撑爆
- 除 active 输入区基础高度收口外，手机端结构、顶部状态栏、icon-only 控制、代码块展示等移动重写仍只在 `max-width: 640px` 内生效

## Refresh Run Recovery

- 刷新页面后，playground 先请求 `GET /v1/chat/conversations` 获取服务端当前会话，再按该 `conversationId` 请求 `GET /v1/chat/state`，把历史消息、当前 running 状态、active assistant 正文、过程区、队列和上下文占用作为 canonical state 渲染。
- `GET /v1/chat/history` 与 `GET /v1/chat/status` 继续保留兼容，但刷新恢复不再靠前端把 history、status、events、localStorage 和 DOM 指针拼成一份“猜出来的状态”。
- 点击 `新会话` 后，页面会请求 `POST /v1/chat/conversations` 创建并激活一条新会话，然后以新会话的 `GET /v1/chat/state` 作为真源恢复 UI；旧会话保留在历史列表里。
- `localStorage` 只作为当前设备的冷启动缓存；一旦 `/v1/chat/state` 返回，页面必须以服务端 state 覆盖本地缓存。
- `activeRun` 存在时，前端只渲染一个 active assistant 气泡；同一 run 不允许拆出多条“助手 / 思考过程”消息。
- `activeRun.input.message` 用来补齐刷新观察者看到的当前用户任务；如果 session history 已经包含同一条用户消息，前端会避免重复渲染。
- 这个“避免重复渲染”不能再只按文本相等拍脑袋；像连续两轮都发“继续”这种高频场景，后端会先把尾部重复的 active user message 从 `messages` 视图里剔掉，再由 `activeRun.input.message` 统一补当前输入。
- `activeRun.process` 是后端维护的过程快照；前端不再把过程日志写回本地历史里的 `process` 字段，也不再从本地 process snapshot 恢复运行态。
- 恢复运行态后，playground 会继续请求 `/v1/chat/events`，重新订阅当前 active run 的 SSE 事件流；后续 `text_delta`、工具事件、`done`、`interrupted`、`error` 继续更新同一个 active assistant 气泡。
- 恢复态不再把任务称为“上一轮”；页面统一渲染为“当前任务正在运行 / 当前正在运行”，因为真实 agent run 并不会因为 web 刷新变成历史任务。
- 恢复运行态下继续发送普通消息会进入 `/v1/chat/queue`，不会重新打开 `/v1/chat/stream` 去撞出 `Conversation ... is already running`。
- 刷新、前后台切换或手机浏览器挂起导致的 `/v1/chat/stream` 暂态断线不算任务失败；只要 `GET /v1/chat/state` 仍显示 running，就切到 `/v1/chat/events` 继续追，不会再写入“网络 / network error”气泡。
- `/v1/chat/events` 只负责续订同一 active run 的后续增量；如果回源时已经不在 running，不要把 `not_running` 当成失败广播给页面，真正的终态应由 `/v1/chat/state` 提供。
- provider 真失败时，canonical `error` 事件会和 terminal snapshot 一起落到统一状态里；主流页面、观察页和刷新后的页面都应该看到同一份失败结果，而不是一个看见报错、另一个只看见任务蒸发。
- 注意边界：本轮解决的是同一服务进程内 active run 的统一状态渲染；如果服务进程重启，实时过程日志仍需要持久化 run event log 才能跨进程完整回放。

## Context Usage Bar

- 桌面 Web 和手机端都在对话区与输入框之间显示一个小圆环进度提示，圆环位于输入框外部，右边缘与输入区域右侧对齐。
- 圆环中央只显示百分比；只要输入区里还有草稿、待发附件或已选资产，就按“预计发送后”口径计算。
- 基线数据来自后端状态接口返回的 `contextUsage`；草稿实时估算仍可通过 `GET /v1/chat/status` 刷新，前端只负责把草稿 / 附件 / 资产的估算 token 叠加上去，所以文案必须明确是估算。
- 风险态统一按 `safe / caution / warning / danger` 四档收口，圆环颜色会随风险变化。
- 桌面端 hover 或键盘 focus 时展示浮层详情；点击可临时固定展开，别再要求用户盯着一个完整状态条。
- 手机端点击圆环后打开底部弹窗展示详情，内容包括：会话占用、待发占用、预留回复预算、provider / model、估算口径与剩余可用空间。
