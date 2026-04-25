# Playground 当前状态

更新时间：`2026-04-25`

这份文档只记录当前 `playground` 的真实前端约束，避免下一个人又拿旧截图和过时口径瞎猜。

核心实现文件：

- [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
- [src/ui/playground-assets.ts](/E:/AII/ugk-pi/src/ui/playground-assets.ts)
- [src/ui/playground-assets-controller.ts](/E:/AII/ugk-pi/src/ui/playground-assets-controller.ts)
- [src/ui/playground-context-usage-controller.ts](/E:/AII/ugk-pi/src/ui/playground-context-usage-controller.ts)
- [src/ui/playground-conversations-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conversations-controller.ts)
- [src/ui/playground-layout-controller.ts](/E:/AII/ugk-pi/src/ui/playground-layout-controller.ts)
- [src/ui/playground-transcript-renderer.ts](/E:/AII/ugk-pi/src/ui/playground-transcript-renderer.ts)
- [src/ui/playground-mobile-shell-controller.ts](/E:/AII/ugk-pi/src/ui/playground-mobile-shell-controller.ts)
- [src/ui/playground-conn-activity.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity.ts)
- [src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)

回归入口：

- `http://127.0.0.1:3000/playground`
- [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)

## 1. 品牌与页面骨架

- 当前品牌文案为 `UGK CLAW`
- 桌面端首页仍保留 `hero-wordmark` 作为 landing 主视觉；原 `topbar-signal` 已移除，桌面工具栏直接占用 `topbar` 主位
- 手机端顶部状态栏显示品牌 logo，并在右侧配套 `UGK Claw` 字标
- 页面仍是单一 `landing` 壳子，通过 `data-transcript-state=idle|active` 切空态和会话态
- 当前整体视觉基调已从偏冷蓝电子夜景收口为“深空黑 + 暗紫星云 + 冷白星尘”，蓝色只保留极弱余光，不再主导页面气质
- 桌面端 landing 的工具入口现在直接挂在 `topbar` 内，替换掉旧的 `UGK CLAW` 顶部字标；按钮只保留关键命令，减少首屏视觉负担。
- 页面背景层数和 `backdrop-filter` 已收口，避免用多层半透明玻璃效果把每次滚动和重绘都变成性能税。

## 2. 消息区约束

- 消息宽度跟随 composer 实际宽度，不依赖写死常量
- transcript 只有在用户停留在底部附近时才自动跟随最新输出；用户明显上滑阅读历史时，`text_delta`、loading 和过程日志更新都不能强制滚到底部
- 除了用户主动点击“回到底部”、或页面本来就停留在底部附近的自然跟随外，会话切换、新会话恢复、后台静默同步、广播补同步这类接口回包都不能强制打断当前滚动位置，更不能一有 `GET /v1/chat/state` 回来就把 transcript 硬拽到底部
- 如果用户是在同一条会话里先看到本地恢复内容、随后又上滑阅读历史，晚到的 canonical `GET /v1/chat/state` 回包也必须保住当前阅读位置；不能因为整段 transcript 重绘或排队中的自动滚底 timer 继续执行，就把页面重新甩回底部
- 非强制滚底现在会做冷却合并；顶部加载历史的触发阈值也收窄到真正接近顶部，避免滚动过程中反复打断阅读。
- 浏览器端布局同步、composer textarea 自适应高度、`--conversation-width` / `--command-deck-offset` 更新、transcript 自动跟随、回到底部按钮、顶部加载更多触发、以及 `visibilitychange/pageshow/online` 恢复同步入口集中在 `src/ui/playground-layout-controller.ts`；`src/ui/playground.ts` 只保留主 state、DOM refs 和页面装配
- 浏览器端 transcript 条目拼装、assistant 状态壳层、运行日志入口、正文复制按钮、markdown hydration、代码块 copy toolbar、历史恢复后的消息渲染，以及 `bindPlaygroundTranscriptRenderer()` 初始化入口集中在 `src/ui/playground-transcript-renderer.ts`；`src/ui/playground.ts` 只保留会话恢复、流式事件和这些渲染函数的调用点
- 浏览器端通知广播 SSE、active run 事件流 attach / teardown、断线恢复、`send / queue / interrupt` 主链路，以及 `bindPlaygroundStreamController()` 初始化入口集中在 `src/ui/playground-stream-controller.ts`；`src/ui/playground.ts` 不再兼任 stream lifecycle 泵站
- 深色 / 浅色主题切换集中在 `src/ui/playground-theme-controller.ts`：该文件输出 light theme 覆盖样式与浏览器端持久化脚本，`src/ui/playground.ts` 只注入桌面和手机入口。主题值存入 `localStorage` 的 `ugk-pi:playground-theme`，并通过 `<html data-theme="dark|light">` 生效。
- 浅色主题现在按“冷白工作台”完整覆盖 chat、文件库、后台任务、任务消息、上下文详情弹窗、历史抽屉和移动更多菜单：根背景是 `#e8edf6` 冷白网格，主文字是 `#142033`，metadata 使用蓝灰，状态色继续区分成功 / 警告 / 危险。不能让深色主题的透明白文字漏到浅色卡片上，也不能在浅色工作页里保留整块黑色面板；markdown 标题 / strong / code、文件 metadata、任务消息 metadata、conn 状态徽标、上下文指标块和历史抽屉头部都必须有浅色专用映射。
- `src/ui/playground.ts` 当前尾部初始化已经收口为 `bindPlaygroundAssemblerEvents()` 与 `initializePlaygroundAssembler()`；旧的 `fetchConversationHistory()` 死 helper 已移除，页面入口不再继续堆散装初始化语句
- 用户离开底部阅读历史时，页面显示“回到底部”按钮；点击后立即回到底部，并恢复后续自动跟随
- active 对话态的 `transcript-current` 底部必须保留额外可滚动余量，让最后一条消息能被用户继续上拖到 composer 上方，不被底部输入框压住
- 当前 Web 入口采用“一个 agent、多个历史会话、一个全局当前会话”的模型；服务端维护 `currentConversationId`，不同浏览器 / 设备打开后都跟随这个当前会话
- 页面冷启动或刷新时，会先通过 `GET /v1/chat/conversations` 获取服务端会话目录和当前会话，再按当前 `conversationId` 请求一次 `GET /v1/chat/state` 同步真实历史与 active run
- 空闲旧会话的 `GET /v1/chat/state` / `GET /v1/chat/history` / `GET /v1/chat/status` 必须走轻量 session JSONL 消息读取；查看历史或切换旧会话不应该初始化完整 agent session、reload skills 或创建 runtime resource loader。只有发送新消息、续跑 active run、队列 steer/follow-up 这类真正需要 agent runtime 的动作才打开完整 session。
- 服务端 `ConversationStore` 对会话目录 index 使用进程内 `mtime` cache 和串行写队列；`GET /v1/chat/conversations`、`POST /v1/chat/current`、`POST /v1/chat/conversations` 这类高频路径不能再恢复成每次读写整份 JSON 且无队列保护的模型。写入必须保留同目录临时文件 + `rename` 的原子替换，避免高频切换时出现目录等待或并发覆盖。
- 会话激活现在是两阶段提交：`POST /v1/chat/current` 或 `POST /v1/chat/conversations` 确认目标 `conversationId` 后，前端立即切到目标会话 shell 并释放交互；canonical `GET /v1/chat/state` 只作为后台 hydrate 收口真实历史与 active run，不能再卡住切换 / 新建手感。
- 前端对会话历史恢复和运行态同步的异步 `GET /v1/chat/state` 回包现在统一走会话 sync ownership：会话切换会使旧 generation 失效，同一会话内较新的同步请求也会压过较早请求；如果旧会话请求慢回、或同会话旧请求晚于新请求返回，这个 stale response 都必须被直接丢弃，不能再把旧消息覆盖回当前 transcript
- 会话 sync ownership 不只负责丢弃旧回包，也会通过 `AbortController` 取消上一条未完成的 `/v1/chat/state` 请求；多次快速切换会话后再点 `新会话`，不应被一串已经过期的 state 请求排队拖慢。
- 会话目录同步现在带 `conversationCatalogSyncPromise` 复用与短时 freshness 冷却；切换 / 新建 / 删除会话后优先复用当前 catalog 结果并按需失效，避免把 `/v1/chat/current` 的切换手感拖成重复目录 round-trip
- 会话目录同步失效或强制刷新时，会通过 `AbortController` 取消上一条未完成的 `/v1/chat/conversations`；旧 catalog 请求不能继续占住后续 `新会话` / 恢复同步动作的等待链，也不能在 abort 后弹出错误提示。
- canonical `GET /v1/chat/state` 回包不再默认清空并重绘整段 transcript；前端会用 `buildConversationStateSignature()` 判断同会话同签名状态，命中时跳过 DOM 重绘，只同步 context usage 和 active run 壳层。消息窗口变化时先 patch 已渲染节点或 append 新节点，只有会话切换或当前消息序列无法对齐时才重建当前 transcript。
- 本地 `localStorage` 只作为当前设备的冷启动缓存和渲染快照，不再作为会话身份、当前会话指针或运行态事实源
- `GET /v1/chat/state` 必须返回后端已经归并好的 `viewMessages`：服务端负责把 canonical `messages` 与 active / terminal run 合成最终可渲染视图；前端优先渲染 `viewMessages`，不再保留自己补画 active input / active assistant 的兼容分支，否则同一轮刚结束就会显示成“问题 / 回答 / 问题 / 回答”
- 运行中的 active run 必须把“稳定历史”和“本轮进行中尾巴”分开：底层 `session.messages` 可能已经提前写入当前 run 的 user / assistant 片段，但这些片段在 `activeRun.loading=true` 时不能进入 canonical `messages`；`viewMessages` 只能由 run 开始前的稳定历史 + activeRun snapshot 合成，避免页面运行中偶发 `user-agent / user-agent` 双轮显示。刷新后正常不代表运行中正常，别又拿前端文本去重当创可贴。
- `GET /v1/chat/state` 支持 `viewLimit`，默认只返回最近 160 条可渲染历史，并通过 `historyPage.hasMore / nextBefore / limit` 告诉前端是否还有更早历史；别再让 state 为了切换会话把完整 JSONL 和完整 transcript 一口气塞给浏览器。
- `GET /v1/chat/history` 支持 `limit` 和 `before` 游标分页，响应带 `hasMore / nextBefore / limit`；聊天区不再显示“加载更多历史”分页按钮，用户向上滑到 transcript 顶部附近时自动补页，不能只吃 `localStorage` 里最近 160 条缓存。
- 当前 active run 在 transcript 里只保留一个助手气泡：正文上方是一条会持续改写的人话状态摘要，下面是一枚可点击的动态 loading 气泡；旧的独立“过程展开区”已经下线，不再额外制造第二层消息结构
- 手机端 active run 的状态摘要不再塞进助手气泡内部，而是作为气泡上方的浅灰色单行状态文本展示；运行日志 loading 按钮移动到 `助手` 标签右侧，只保留动态点，减少空正文气泡里的视觉噪音。
- active run 刚开始、助手正文还没吐出任何文字时，空 `.message-body` 不应显示成一块空白气泡；等真正有正文、文件或附件内容后再展示气泡主体。
- 空助手占位阶段也不能提前渲染 `.message-actions`；复制 / 导图按钮只有在该条消息已经有正文、附件、引用资产或文件结果时才挂到 `.message-body` 底部。否则操作栏本身会把空 body 撑开，老问题又回来，属于自找麻烦。
- 新一轮助手状态从无到有第一次出现时，会强制把 transcript 拉到底部，让用户看到 agent 已经开始响应；后续流式过程更新仍遵守“用户上滑阅读历史时不抢滚动”的规则。
- 状态摘要 `assistant-status-summary` 现在固定为单行省略；它负责给人一个稳定的人话进度感，不再允许换行把整条消息高度顶来顶去
- 运行日志按钮不再显示工具执行结果、bash 输出或 JSON 长文本；页面可见层只保留动态点和“查看运行日志”入口，过程细节只留在运行日志弹层与按钮的辅助文案里
- 动态 loading 气泡点击后会打开运行日志弹层，并按 `conversationId + runId` 请求 `GET /v1/chat/runs/:runId/events`；任务过程追溯从对话正文里解耦，不再把工具过程当成正文的一部分硬塞进气泡
- active run 的状态摘要和运行日志入口在同一条助手消息内必须保持单例；前端每次挂载新的 `.assistant-status-shell` / `.assistant-run-log-trigger` 前都会清掉同卡片旧控件，避免流式 patch 或状态恢复把多个 loading 气泡堆在同一条消息里。刷新后才正常这种“薛定谔 UI”不算正常，必须在运行中就稳定。
- `done / error / interrupted` 终态 run 也会保留 `runId` 和 buffered events；刷新页面后，如果这轮仍是当前 terminal snapshot，用户应该还能从同一条助手气泡继续查看运行日志
- 从后端 session 恢复用户历史时，只展示用户原始消息；`<user_assets>`、`<asset_reference_protocol>`、`<file_response_protocol>` 这类运行时注入给模型的内部 prompt 协议不得出现在 transcript 里
- 用户切回旧会话继续发送消息时，后端必须继续复用这条会话原来的 `sessionFile` 上下文；不能因为项目技能目录更新、`skillFingerprint` 变化，就偷偷新开一条空 session 让 agent 当场失忆
- 从后端 session 恢复已完成任务时，连续的 assistant 消息片段必须在 `AgentService` 的 canonical history 中合并为同一条助手回复；不要让刷新后的页面把同一轮浏览器处理过程拆成多条“助手”气泡
- 历史消息默认先渲染最近一段；向上滚动到 transcript 顶部附近时，会自动继续向服务端补更多旧消息，并保持当前阅读位置。顶部只允许出现非交互的加载状态提示，不再放可点击分页按钮；聊天界面不是后台列表页，别把分页按钮硬塞进消息流。
- `landing` 模式下，对话区底部避让按“`chat-stage` 底部到 `command-deck` 顶部的真实距离”动态计算，不再偷懒拿固定值或只拿 `command-deck` 高度瞎猜
- `landing` 模式下 transcript 容器会被锁进可用高度内，多选文件 / 资产后应表现为对话区收缩并滚动，而不是继续向下顶进 `command-deck`
- 用户消息固定靠右
- 用户消息正文保持标准左对齐，避免右侧大段文字影响阅读
- 用户消息 `message-meta` 只显示时间，并贴右展示
- 历史消息时间优先使用 session message 自带的 `timestamp` 透传成 `createdAt`；不要再把所有恢复消息默认写成 Unix epoch，否则前端会整排显示 `08:00:00`
- 每个消息气泡的操作栏固定放在 `.message-body` 内部底部，不再挂在气泡外层；操作栏只保留紧凑 icon-only 控件，贴近正文但不挤压 meta。
- 消息操作栏当前包含复制正文和保存图片两个按钮：复制只复制当前消息正文，不复制时间、角色标签和文件按钮；保存图片会把 `.message-body` 的渲染效果导出为 PNG，导出图排除操作栏自身，并在图片外层加 `UGK Claw 导出` 签名 label。导出副本必须是自包含内容：外部 `@import`、`@font-face`、非片段 `url(...)` 和消息内媒体节点都不能进入 canvas 绘制路径，媒体内容使用紧凑占位块替代；包含 `foreignObject` 的 SVG 中间图必须使用 `data:image/svg+xml`，不要回退成 `blob:` URL，避免 `toBlob()` 因 tainted canvas 失败。
- 消息操作栏按钮统一使用透明背景、无边框、无阴影，文字只保留在 `aria-label` / 隐藏文本里，不再占用纵向空间。
- composer textarea 默认使用 `rows="1"`，不要让浏览器按 textarea 默认 2 行去算空内容高度；默认最小高度已收口到 `52px`，桌面端使用 `14px` 上下内边距；自适应高度脚本在空内容和单行内容时必须保留 CSS `min-height`，让 placeholder 与正文按同一行高纵向居中，多行内容才按 `scrollHeight` 扩展。不要再让浏览器 `scrollHeight` 把单行输入框算歪。
- markdown 正文渲染使用 `marked`，不是项目内手写解析器；后续补 Markdown 能力时优先配置/升级渲染库，不要继续追加临时正则
- markdown 正文里的“普通段落 + 紧跟 fenced code block”必须能正常渲染，不能再把 `CODEBLOCK0` 之类占位符漏到用户界面上
- markdown 正文里的 pipe table 与 `---` 分割线必须渲染为真正的 HTML 结构，不能继续把 `|------|` 或 `---` 当普通字符显示
- 助手气泡里的 Markdown 正文使用更紧凑的阅读规格：正文 `12px`，`h1 / h2 / h3` 分别为 `18px / 16px / 14px`，链接、inline code、blockquote 和表格头使用轻量颜色区分；用户气泡不套这组助手正文色彩规则。
- markdown 表格由外层滚动容器控制最大宽度，`table` 本体按内容宽度展示，不强制撑满消息气泡；宽表最多占满气泡并横向滚动
- `not_running`、`abort_not_supported` 这类运行态控制错误统一从顶部悬浮横幅提示，不再占用主内容流，也不再写进底部过程流
- 顶部错误横幅去掉边框，统一 `4px` 圆角，右侧提供 `x` 关闭按钮
- 顶部错误横幅使用不透明高对比背景，不能再用半透明红色叠在页面背景上糊成一片；手机端提示文案必须能直接读清楚
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

- 文件上传区、文件 chip、已选资产区和资产库弹窗的静态样式 / HTML 现在集中在 `src/ui/playground-assets.ts`
- 文件上传、拖拽投放、附件 chip 渲染、资产库刷新 / 复用、已选资产和文件下载卡片运行时逻辑集中在 `src/ui/playground-assets-controller.ts`
- `src/ui/playground.ts` 只负责把文件 / 资产控制器片段注入到主浏览器脚本，并在发送、恢复、上下文估算等主流程里调用这些函数
- 手机端文件库不再按桌面居中弹窗或底部抽屉压缩显示，而是全屏工作页：`asset-modal-shell.open` 使用不透明 `#01030a` 背景，`asset-modal` 占满 `100dvh`，顶部是带 `topbar asset-modal-head mobile-work-topbar` 的统一状态栏；左侧是返回箭头和 `可复用资产` 标题，右侧直接放 `刷新文件库`，不再显示占位很蠢的 `回到对话` 文字按钮。顶部和列表都沿用无边框仪表盘语言：`#101421` raised header、`#0b0e19` 实心条目、阴影和留白负责分区，不再靠浅色边框把每块内容圈起来。
- 待发送附件和已选资产统一用 chip 风格展示
- 待发送附件和已选资产的 chip 列表必须允许多行换行，文件名最多两行展示，列表自身最多占一小段高度后内部滚动；不要再把多个 PNG / TXT chip 挤成一条横向小火车，标题看不清就是失败。
- 一次最多只发送 5 个文件；用户选择超过 5 个时，提示要作为 transcript 里的“系统提示”消息出现，不再渲染成孤零零的 `process-note-text`。
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
- agent 通过 `send_file` 交付的文件必须保留在 canonical conversation history 里；刷新会话或晚到的 `GET /v1/chat/state` 不能把已经出现过的文件卡片洗掉
- 如果某一轮只有 `toolResult(send_file)`、没有自然语言 assistant 正文，后端也必须补一条可见的 assistant history entry 承接文件卡片；别再让用户看着文件先出来、过一会儿又被 state 回包洗没
- 与 `web-access` 相关的页面清理现在走“会话级稳定 scope + 运行前预清理 + finally 收尾清理”；这层收口不改用户交互，但会直接影响长时间使用后的浏览器残页数量
- `/v1/files/:fileId` 对安全可预览文件默认使用 `inline`；不安全或不可预览类型仍保持 `attachment`
- `/v1/files/:fileId` 对 Markdown / 纯文本 / JSON / CSV 等文本型文件会补 `charset=utf-8`，避免中文 `.md` 预览被浏览器按错误编码打开成乱码
- `html`、`svg`、`js` 这类可执行或脚本风险较高的文件不会直接作为同源预览打开，别为了省事把安全边界拆了
- `conn` 创建 / 编辑器里的“附加资料”不再让用户硬填 `assetId`；界面提供“选择复用文件”和“上传新文件”两个入口，最终仍映射为内部 `assetRefs`
- `conn` 编辑器上传新文件时，前端会进入 `connEditorUploadingAssets` 忙态，把上传按钮显示为“上传中”，并临时禁用保存和再次上传；失败时会在编辑器错误区显示 `上传失败（HTTP xxx）` 这类带状态码的反馈，不允许再表现成“选择文件后没反应”
- 主 chat 输入区与 `conn` 附加资料上传都走 `POST /v1/assets/upload` 的 `FormData` / `multipart/form-data` 标准文件上传，不再把浏览器文件读成 base64 JSON；`POST /v1/assets` 不再接受 JSON 上传
- 主 chat 选择或拖拽文件后，前端会先把文件注册成资产并自动加入已选资产区；真正发送消息时只携带 `assetRefs`，不再向 `/v1/chat/stream` 或 `/v1/chat/queue` 塞文件内容
- 当前上传限制为单文件 64MiB、一次最多 5 个文件，生产 nginx 总请求上限 80m；前端和后端都要让失败有明确反馈，别再把限制做成沉默失败。
- 顶部“上下文使用”按钮对已选资产的估算要贴近后端真实 prompt 行为：大文本资产按后端 `readText()` 的截断上限估算，二进制资产按元数据引用估算；不要再因为选了个大文件就假装上下文瞬间爆满，吓唬人不算能力。
- 已选“附加资料”不再依赖最近 40 条资产列表死活；如果某个已选资产不在当前 recent 列表里，前端会按需补拉 `/v1/assets/:assetId`，而不是偷偷把它从表单里抹掉
- 资产详情按 id hydrate 时前端必须走 `assetDetailQueue` + `assetDetailInFlightById`：同一 assetId 的并发请求复用同一个 Promise，最多 4 路同时请求 `/v1/assets/:assetId`。不要把它改回裸 `Promise.all(assetIds.map(async ...))`，那是在附件多的时候主动制造请求风暴。

### 非 chat 工作页与弹窗视觉口径

- 除主聊天 transcript / composer 外，文件库、后台任务管理器、后台任务编辑页、任务消息页、运行日志弹窗、确认弹窗和后台任务过程弹窗都按“无边框深色仪表盘”处理。
- 普通状态下不要用浅灰边框划分结构；优先用 `#01030a` 页面背景、`#101421` header、`#0b0e19` 内容卡片、`#080a13` 次级条目、阴影、字号和留白制造层次。
- 圆角保持克制：页面外壳为 `0`，常规卡片和按钮以 `4px` 为主，独立信息面板最多 `8px`。别再把工作页做成一堆大圆角卡片，后台味和玩具味都会冒出来。

## 5. “查看技能”按钮行为

- 点击后会生成一条像助手回复的消息
- 先展示简化过程：
  - 接收到指令
  - 请求 `/v1/debug/skills`
  - 接口返回
  - 整理结果
- 最终结果会直接列出完整技能清单
- `GET /v1/debug/skills` 响应包含 `source: "fresh" | "cache"` 与 `cachedAt`；`DefaultAgentSessionFactory` 会在 skill fingerprint 未变化且 30 秒 TTL 内复用缓存，避免每次点“查看技能”都重建 resource loader 和 reload skills。技能文件变化会让 fingerprint 失效并刷新。
- 不再把旧的 system 调试噪音塞进 transcript

## 5.1 后台任务过程查看

- `playground` 里与 `conn` 相关的结果查看已经收口成统一的 run detail 入口，不再要求用户先切回某个会话才能追任务结果。
- 当任务消息或后台任务列表条目同时满足 `source=conn`、`sourceId`、`runId` 时，消息底部会出现一个小型“查看后台任务过程”入口。
- 点开后前端会分别请求：
  - `GET /v1/conns/:connId/runs/:runId`
  - `GET /v1/conns/:connId/runs/:runId/events`
- 弹层里当前展示 run 状态、时间戳、workspace、sessionFile、结果摘要、输出文件索引和过程事件列表
- 后台 conn 通知正文来自 `conn_runs.resultText`。runner 会避免把“输出文件已写入”这种低信息量尾句当成唯一结果；如果模型先回答了问题、后面只是补一句文件写入提示，通知应优先展示真正回答。
- 后台 run 成功后会扫描该次 workspace 的 `output/` 目录并写入 `conn_run_files`；所以弹层里的输出文件索引应该能看到真实产物，而不是只在正文里出现一个打不开的路径。
- run 详情入口既服务任务消息页，也服务后台任务管理器；别再把“结果展示”和“当前聊天 transcript”捆成一坨，后面只会越来越乱。

## 5.2 任务消息页

- `playground` 现在提供独立的 `任务消息` 入口：桌面端顶部按钮是 `open-task-inbox-button`，手机端入口在更多菜单里的 `mobile-menu-task-inbox-button`。
- 任务消息读取 `GET /v1/activity?limit=50`，展示跨会话的 `agent_activity_items`；它是后台结果的独立收件箱，不再把结果硬塞进当前 conversation transcript。
- 这层是观察与追溯页面，不是新的聊天真源。当前会话仍然由 `GET /v1/chat/state` 驱动；后台结果页面只负责展示完成后的异步结果。
- 手机端任务消息页是全屏工作页，不再按贴底抽屉处理：顶部左侧是返回箭头和 `任务消息` 标题，右侧直接放 `未读 / 全部 / 全部已读 / 刷新`；任务结果正文按对话气泡规格渲染，卡片结构是“消息元信息 / 结果气泡 / 底部动作”，正文走与 transcript 相同的 markdown hydration，文件结果复用下载卡片；点开“查看过程”后的 run detail `Result` 也按同一套消息正文规格渲染完整 `resultText`；任务结果 Markdown 正文字号收口为 `12px`，标题按 `18px / 16px / 14px` 分级，链接、代码、引用和表格头使用轻量颜色区分；列表卡片最小触摸高度为 `64px`。
- 活动条目里的来源和文件信息走人话口径：来源显示为 `后台任务 / 飞书 / 助手 / 通知`，文件显示为“附 N 个文件”。
- `source=conn` 且带有 `sourceId + runId` 的 activity 条目会复用后台任务过程弹层，继续请求：
  - `GET /v1/conns/:connId/runs/:runId`
  - `GET /v1/conns/:connId/runs/:runId/events`
- 收到 `/v1/notifications/stream` 广播后，页面会静默刷新任务消息列表与未读数；即使用户已经切到另一个会话，也能在任务消息页里看到刚完成的 conn 结果。
- 页面断言入口在 [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)，运行时拼装入口在 [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)，任务消息 / conn 弹层静态片段在 [src/ui/playground-conn-activity.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity.ts) 与 [src/ui/playground-task-inbox.ts](/E:/AII/ugk-pi/src/ui/playground-task-inbox.ts)，前端运行时控制器片段在 [src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)，后端读模型入口是 [src/routes/activity.ts](/E:/AII/ugk-pi/src/routes/activity.ts) 和 [src/agent/agent-activity-store.ts](/E:/AII/ugk-pi/src/agent/agent-activity-store.ts)。

## 6. 单工人多会话行为

- 当前项目按“一个 agent 工人，多条历史产线，但同一时刻只有一条全局当前产线”收口
- 服务端 `ConversationStore` 维护 `currentConversationId` 和会话目录；所有平台打开页面后都以服务端当前会话为准，不再固定写死 `agent:global`
- 浏览器端会话目录、新建会话、切换当前会话、运行中禁切、以及手机历史抽屉列表渲染集中在 `src/ui/playground-conversations-controller.ts`；`src/ui/playground.ts` 仍持有主 state，布局滚动与恢复入口已交给 `src/ui/playground-layout-controller.ts`，transcript 渲染入口已交给 `src/ui/playground-transcript-renderer.ts`，stream lifecycle 已交给 `src/ui/playground-stream-controller.ts`
- 桌面 Web 现在常驻左侧历史会话栏，和手机历史抽屉共用同一份 conversation catalog 渲染与切换逻辑；不能再让桌面端完全没有历史入口。移动端仍走左侧抽屉，避免小屏再塞一条常驻侧栏。
- 手机端历史会话抽屉按“会话索引”而不是“大卡片列表”设计：抽屉沿用上下文详情的无边框仪表盘语言，外层是深色渐变面板，头部是 `#101421` raised surface，列表项用 `#0b0e19` 背景层和约 `92px` 稳定高度，当前会话用 `#151a2b` 高亮与左侧冷白蓝亮条，时间 / 条数做成小型信息胶囊，删除入口退成条目内部右上角的 icon-only 小按钮。
- 点击 `新会话` 会调用 `POST /v1/chat/conversations` 创建新的 `conversationId`，并把它设置成全局当前会话；旧会话不会被 reset 或删除
- 点击 `新会话` 时，前端用 `conversationCreatePending` 防止请求飞行中的重复创建；如果当前会话已经是无正文、无附件、无 active run 的空白会话，则再次点击直接 no-op，不再继续创建一串空白会话。创建成功后先本地插入会话目录并进入新会话，再让新会话的一次 canonical `GET /v1/chat/state` 在后台收口 UI，不再把用户挡在 hydrate 前面，也不再先额外 round-trip 一轮 `GET /v1/chat/conversations`。
- 手机端点击左侧品牌区会打开历史会话抽屉；点击历史项时前端应先立即关闭抽屉，再调用 `POST /v1/chat/current`，不能傻等服务端回包后才把侧边栏收起来
- 如果用户点的是当前已经选中的会话，也要立即关闭手机历史抽屉；当前项只允许在 `state.loading` 时禁用，不能因为 active 状态禁用点击事件，否则用户会以为界面卡死
- 会话切换成功后，前端会直接进入目标会话，并以目标会话的一次后台 canonical `GET /v1/chat/state` 收口真实历史与 active run；不再对同一条会话先拉 history restore、再补拉 run state，制造重复请求和重复滚底。任意会话切换请求未回包时，历史列表会临时冻结切换和删除动作，避免慢回包把用户刚点的目标会话覆盖回去。
- 历史会话项现在提供显式删除入口，调用 `DELETE /v1/chat/conversations/:conversationId`；删除后服务端会重算 `currentConversationId`，前端再按新的当前会话收口 UI
- 所有删除类动作都统一走自定义 `confirm-dialog`，不再调用系统 `confirm()`。风格、圆角、按钮语气都跟页面保持同一套，不再把原生弹窗硬插进来破坏节奏
- agent 正在运行时，后端拒绝新建或切换会话；前端显示“当前任务未结束，不能切换产线 / 开启新产线”
- 浏览器端当前通过 `conversationSyncGeneration + requestId` 管住 `/v1/chat/state` 的落地资格：会话切换时先失效旧 generation，再给新的同步请求发 token；只有仍属于当前 generation、且没被更新请求压过的响应，才允许写进当前页面
- 如果未来真的要支持多用户同时操作，不能把这个单工人模型当成权限系统继续堆，必须重新设计认证、控制权和会话隔离

## 7. 已知关联文件

- 页面结构、共享样式、脚本： [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
- 文件 / 资产静态样式与资产库弹窗 HTML： [src/ui/playground-assets.ts](/E:/AII/ugk-pi/src/ui/playground-assets.ts)
- 文件 / 资产前端运行时控制器： [src/ui/playground-assets-controller.ts](/E:/AII/ugk-pi/src/ui/playground-assets-controller.ts)
- 上下文用量进度环、估算和详情弹层控制器： [src/ui/playground-context-usage-controller.ts](/E:/AII/ugk-pi/src/ui/playground-context-usage-controller.ts)
- 会话目录、新建、切换和手机历史抽屉列表控制器： [src/ui/playground-conversations-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conversations-controller.ts)
- 布局同步、滚动跟随、回到底部和前后台恢复控制器： [src/ui/playground-layout-controller.ts](/E:/AII/ugk-pi/src/ui/playground-layout-controller.ts)
- transcript 渲染、markdown hydration、复制正文、状态壳层和运行日志弹层控制器： [src/ui/playground-transcript-renderer.ts](/E:/AII/ugk-pi/src/ui/playground-transcript-renderer.ts)
- stream lifecycle、通知 SSE、send / queue / interrupt 控制器： [src/ui/playground-stream-controller.ts](/E:/AII/ugk-pi/src/ui/playground-stream-controller.ts)
- transcript 清空必须同时清理 `transcript-current` 和 `transcript-archive`，不要给旧会话 DOM 残留留活口
- 手机端 topbar、更多菜单和历史抽屉外壳控制器： [src/ui/playground-mobile-shell-controller.ts](/E:/AII/ugk-pi/src/ui/playground-mobile-shell-controller.ts)
- Conn / 任务过程静态样式与弹窗 HTML： [src/ui/playground-conn-activity.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity.ts)
- Conn / 任务过程前端运行时控制器： [src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)
- 页面返回断言： [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
- 资产与文件下载： [src/ui/playground-assets.ts](/E:/AII/ugk-pi/src/ui/playground-assets.ts)、[src/ui/playground-assets-controller.ts](/E:/AII/ugk-pi/src/ui/playground-assets-controller.ts)、[src/agent/asset-store.ts](/E:/AII/ugk-pi/src/agent/asset-store.ts)、[src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
- 技能真实来源： [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts) 的 `GET /v1/debug/skills`
- 会话目录与当前会话来源： [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts) 的 `GET /v1/chat/conversations`
- 当前会话状态来源： [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts) 的 `GET /v1/chat/state`
- 新建 / 切换会话入口： [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts) 的 `POST /v1/chat/conversations` 与 `POST /v1/chat/current`

## 8. 运行态与 loading 约束

- 任务进行中必须在助手气泡下显示 loading 等待气泡，不能让用户猜 Agent 是运行、等待还是结束。
- loading 气泡会跟随 Agent 事件切换文案：接手任务、调用工具、等待工具返回、生成回复、完成、打断或失败。
- `done`、`interrupted`、`error` 都必须收口当前 loading 和过程日志，并同步释放前端 loading 状态。
- `error` 与 `interrupted` 不再只是当前流页面里的临时视觉效果；它们仍会进入 `GET /v1/chat/state` 的 canonical state，但 terminal snapshot 只在 session history 还没覆盖到同一终态时才继续暴露，别再把同一轮已写入 history 的部分回复和过程壳子重复画两遍。
- `interrupted` 的状态文案单独显示为“已打断”，不要再偷懒混成“已结束”；失败态继续明确显示“错误”。
- 刷新恢复运行态时，页面文案统一使用“当前任务正在运行 / 当前正在运行”，不要再写“上一轮仍在运行”。
- 手机浏览器前后台切换、页面 `visibilitychange`、`pageshow`、`online` 后不再一律核对 catalog + 拉取完整会话 state：`pageshow` 会强制做一次当前会话 state 校准；`visibilitychange` 只在 active run 或本地 state 超过恢复阈值时回源；`online` 优先用当前 active run 提示查状态并续订 `/v1/chat/events`。
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
- 手机端面板继续保持贴底抽屉和深色卡片结构，但圆角统一服从用户偏好：文件库 / 后台任务 / 新建后台任务 / 任务消息 / 后台 run 详情里的面板、卡片、工具栏和操作按钮都只使用 `4px` 圆角，不再回到 `22px` 或 `16px` 的大圆角语言。
- 顶部只保留紧凑品牌状态栏：左侧是可点击的 logo + `UGK Claw` 历史会话入口，右侧保留上下文电池条、`新会话` icon 与 `更多` icon；`技能 / 文件 / 文件库 / 后台任务 / 任务消息 / 主题切换` 收进右上角溢出菜单，每项统一是 `icon + 标题` 风格
- 主题切换不会触发会话同步、transcript 重绘或 agent 请求，只更新 `<html data-theme>`、按钮状态和 `localStorage` 持久化值；桌面端对应入口是 `theme-toggle-button`，手机端对应入口是 `mobile-menu-theme-button`。
- 手机端 topbar、更多菜单、历史抽屉开关、遮罩关闭、外部点击关闭和移动端入口绑定集中在 `src/ui/playground-mobile-shell-controller.ts`；历史列表渲染和会话切换由 `src/ui/playground-conversations-controller.ts` 负责，移动外壳控制器不反向持有 conversation catalog 逻辑
- 手机端品牌区点击后展开左侧历史会话抽屉，宽度收口为 `min(88vw, 360px)`，右侧保留透明点击遮罩用于关闭；抽屉头部 sticky，列表项展示标题、两行摘要、更新时间和消息数，最小触摸高度 `92px`，标题 / 摘要 / meta 必须显式设置移动端行高，不能继续继承全局 button 的紧缩排版；当前会话只用左侧冷白蓝亮条和深色层级标记，不再铺大面积蓝色块，也不再靠细边框分区；删除按钮位于条目内部右上角，不再作为条目外侧独立列挤压内容；侧边栏内关闭按钮、空态和会话项使用 `6px` / `8px` 的小圆角并保持无边框；历史列表保留纵向滚动但隐藏侧边滚动条；运行中禁止切换，避免一个 agent 工人被硬拽到另一条产线
- 手机端历史抽屉头部不再透明裸放，改成与上下文详情同一套 raised surface；注意这里不是回到边框卡片，而是靠背景层级和阴影形成信息分组。
- `新会话` 按钮现在走 `POST /v1/chat/conversations` 创建新的服务端会话并激活为 `currentConversationId`；不再 reset 旧会话，也不再只清本地 transcript
- 手机端 `文件库`、`后台任务`、`新建后台任务`、`任务消息` 和后台 run 详情统一走全屏工作页：点击入口后先立刻打开对应页面，页面内部再刷新数据；用户点按钮切界面不能等接口回完才出现反馈，这种体验慢得像在拨号上网。
- 这些手机工作页的共同约束是：顶部 `topbar` sticky，左侧固定返回箭头 + 标题，右侧放当前页面的关键动作；动作较多时允许横向滚动，但不要再把 `回到对话` 做成右侧文字按钮。内容区独立滚动并 `overscroll-behavior: contain`，主操作按钮最小高度约 `40px`，列表项最小高度 `64px`，底部 padding 包含 `env(safe-area-inset-bottom)`。
- 这些手机面板的视觉约束是硬朗、低圆角、少装饰；如果后续新增类似管理面板，默认按 `4px` 收口，别又把大圆角当移动端高级感，真的会很像套模板。
- 所有这类面板关闭前都要先把焦点归还给可见触发入口或底部输入框；如果归还目标不可见或浏览器拒绝聚焦，必须先 `blur()` 掉仍在面板里的 active element，再设置 `aria-hidden=true` / `hidden`。不能让焦点继续留在即将隐藏的关闭按钮、列表按钮或编辑器字段里；不然浏览器会直接给无障碍警告，用户用键盘 / 读屏时也会被塞进隐藏层。
- `landing-screen` 在手机端直接隐藏，不再让 hero、大标题和装饰块继续吞掉首屏高度
- 中间主区收口成全高 transcript 区域，去掉额外边框和背景壳层，优先把有限空间让给对话内容；空态时 transcript 中央展示方块字符组成的 `UGK` 标识，不再显示“开始一轮对话...”提示方块
- 手机端 active transcript 底部使用安全区感知的滚动缓冲，最后一条回复在滚到底后仍能被继续上拖一点，避免被底部 composer 遮挡
- 拖拽上传区在手机端隐藏；已选文件与资产改成可换行 chip 列表，超过可用高度后列表内部纵向滚动，避免多文件预览挤在同一行导致标题完全看不清。
- Landing 空态底部 `#composer-drop-target.composer` 不再使用大输入框口径；桌面 landing composer 使用 `6px 8px 6px 10px` padding，textarea 初始最小高度为 `40px`，发送 / 打断按钮最小高度为 `40px`，并通过 `align-self: end`、`height: fit-content`、`max-height: none` 防止外层 section 被旧高度规则卡死
- 底部 composer 改成手机优先结构：输入区单列铺满，右侧只保留紧凑 icon 控制；移动端 composer 背景使用单层纯色，不再叠加渐变；发送按钮使用居中的向上箭头 icon，打断按钮使用白色方形中断 icon，不再显示文字，也不再沿用桌面端按钮背景、边框和阴影；当前手机端这两个 icon 调整为 `28px`，避免把按钮本体撑大；中断按钮在未运行时也保留占位，只是禁用态变淡，不会直接消失；发送后的输入框立即清空，失败才回填草稿
- composer 输入框 placeholder 统一为“和我聊聊吧”；不要再让脚本初始化把 HTML 里的中文占位符覆盖成英文调试口吻；手机端单行空态按 line-height + 对称 padding 计算，让 placeholder 和正文视觉居中
- Active 对话态的 `#composer-drop-target.composer` 基础高度已经收口：普通对话中的 textarea 默认最小高度为 `52px`，空内容和单行内容保留最小高度以保证 placeholder / 正文纵向居中；多行输入时高度随输入行数自动增长，最多显示 10 行；超过 10 行后只在 textarea 内部纵向滚动，并禁用手动竖向 resize；`max-width: 960px` 下右侧发送 / 打断按钮横排，避免按钮掉到输入框下方继续撑高底部区域
- 手机端 active 对话态继续走更紧凑输入区约束，不只在 landing 空态生效；普通对话中的 textarea 最小高度收口为 `44px`，单行时使用 `12px 0` 对称 padding，landing 使用 `40px` 高度与 `10px 0` padding，同样按内容自适应到最多 10 行，超过后内部滚动，避免底部输入区吃掉约四分之一屏幕高度
- 手机端消息气泡、字号、留白、按钮尺寸都按小屏重新收口，用户消息宽度放宽到更适合单手阅读的比例
- 手机端富文本里的代码块继续沿用原有 markdown 逻辑，但展示层会额外收口：外层 `.code-block` 退成透明壳子，代码区域本身不再叠半透明背景，边框也收成全透明，只保留排版层次；工具条不再整条展示，只保留右上角一个透明背景的纯图标复制按钮，不显示文字 label；助手消息里的 `code` 背景也强制透明，同时限制最大宽度并让超长代码行在块内换行，避免把消息气泡横向撑爆
- 除 active 输入区基础高度收口外，手机端结构、顶部状态栏、icon-only 控制、代码块展示等移动重写仍只在 `max-width: 640px` 内生效

## Refresh Run Recovery

- `GET /v1/chat/state` 返回的 `viewMessages` 是唯一可信的 transcript 视图；后端必须在 canonical state 里自己处理 terminal run 与 session history 的重叠关系，前端不再负责“看起来像重复就删掉一条”这种补丁式去重。
- 对 still-loading active run，后端记录 run 开始时的 raw `session.messages.length`，构造 `GET /v1/chat/state` / `GET /v1/chat/history` 的稳定历史时只读取这条基线之前的 raw messages；上下文占用估算仍按完整 raw context 计算，避免 UI 去重顺手把 token 估算也砍掉。
- 对 `done / error / interrupted` 这类 terminal run，后端现在按“run 开始前的历史基线 + 本轮实际新增的 canonical history message”判断当前 turn 是否已经落盘，而不是继续拿 assistant 正文文本做模糊比对；这样可以同时避免“正文只差空格/换行却被重复渲染”和“连续两轮都发同一句话时误把当前轮吞掉”这两类相反问题。

- 刷新页面后，playground 先请求 `GET /v1/chat/conversations` 获取服务端当前会话，再按该 `conversationId` 请求 `GET /v1/chat/state`，把历史消息、当前 running 状态、active assistant 正文、状态壳层、队列和上下文占用作为 canonical state 渲染。
- `GET /v1/chat/history` 与 `GET /v1/chat/status` 继续保留兼容，但刷新恢复不再靠前端把 history、status、events、localStorage 和 DOM 指针拼成一份“猜出来的状态”。
- `/v1/chat/state` 与 `/v1/chat/history` 都会合并连续 assistant 历史消息，保证同一轮完成后的浏览器处理叙述和最终回答恢复为一个助手气泡，而不是刷新后散成多条独立消息。
- `/v1/chat/state` 的恢复响应现在是最近窗口，不是全量历史；需要更早消息时，前端用 `/v1/chat/history?before=...&limit=...` 按页补齐。`localStorage` 仍只保存最近快照，不能被当成完整历史源。
- 点击 `新会话` 后，如果当前不是空白会话，页面会请求 `POST /v1/chat/conversations` 创建并激活一条新会话，然后立即进入新会话 shell；新会话的一次 `GET /v1/chat/state` 作为后台真源恢复 UI。旧会话保留在历史列表里，不再先额外同步一轮 `GET /v1/chat/conversations`，也不再等待 hydrate 完成才给用户切过去。当前已经是空白会话时，重复点击 `新会话` 不再产生新的空会话。
- `localStorage` 只作为当前设备的冷启动缓存；一旦 `/v1/chat/state` 返回，页面必须以服务端 state 覆盖本地缓存。
- `activeRun` 存在时，前端仍只维护一个 active assistant 气泡；但气泡是否出现在 transcript、对应用户输入是否补齐，都以 `viewMessages` 为准，同一 run 不允许拆出多条“助手 / 过程区 / 结果区”消息。
- `activeRun.input.message` 仍可作为后端构造 `viewMessages` 的输入；前端收到 `viewMessages` 后只负责渲染，不再根据文本相等关系自行判断“当前用户任务是否已出现”。
- 对 `done / error / interrupted` 这类 terminal activeRun，如果 canonical history 尾部已经同时包含同一条用户输入和同一条助手结果，后端 `viewMessages` 会直接复用 history，不再额外带一组 active input / active assistant。这是为了处理“历史刚落盘但 activeRun 还没从 state 消失”的短窗口，不能用前端本地历史去重这种补丁糊过去。
- 对 `interrupted / error` 这类 terminal snapshot，如果 session history 已经带上当前轮的用户输入，后端会把 `activeRun.input.message` 清空，避免刷新页再凭 terminal snapshot 把原始提问补画第二遍。
- 这个“避免重复渲染”不能再只按前端文本相等拍脑袋；像连续两轮都发“继续”这种高频场景，后端必须在构造 `viewMessages` 时结合 active run 状态、assistant 覆盖位置和 canonical history 尾部的当前 turn 判断，前端不要再擅自按 DOM / localStorage 去重。
- `activeRun.process` 是后端维护的状态快照；前端只把它映射成当前助手气泡上的状态摘要和 loading 状态，不再把过程日志写回本地历史里的 `process` 字段，也不再从本地 process snapshot 恢复运行态。
- 恢复运行态后，playground 会继续请求 `/v1/chat/events`，重新订阅当前 active run 的 SSE 事件流；后续 `text_delta`、工具事件、`done`、`interrupted`、`error` 继续更新同一个 active assistant 气泡。
- 如果 `/v1/chat/events` 接上后又无 terminal event 就直接 EOF，前端不能装死停在“已恢复”假象里；必须立刻回源 `GET /v1/chat/state` 再收口一次：后端若仍在 running 就继续续订，已终态就按 canonical state 落稳结果。
- 如果刷新时当前会话仍带着 terminal snapshot 但 `viewMessages` 里还没带出对应助手条目，前端会按 `assistantMessageId` 补建同一条助手气泡，再挂上状态壳层；别再让“有运行态、没载体消息”这种半截状态把 UI 弄成隐身人。
- 恢复态不再把任务称为“上一轮”；页面统一渲染为“当前任务正在运行 / 当前正在运行”，因为真实 agent run 并不会因为 web 刷新变成历史任务。
- 恢复运行态下继续发送普通消息会进入 `/v1/chat/queue`，不会重新打开 `/v1/chat/stream` 去撞出 `Conversation ... is already running`。
- 刷新、前后台切换或手机浏览器挂起导致的 `/v1/chat/stream` 暂态断线不算任务失败；只要 `GET /v1/chat/state` 仍显示 running，就切到 `/v1/chat/events` 继续追，不会再写入“网络 / network error”气泡。
- `/v1/chat/events` 只负责续订同一 active run 的后续增量；如果回源时已经不在 running，不要把 `not_running` 当成失败广播给页面，真正的终态应由 `/v1/chat/state` 提供。
- provider 真失败时，canonical `error` 事件会和 terminal snapshot 一起落到统一状态里；主流页面、观察页和刷新后的页面都应该看到同一份失败结果，而不是一个看见报错、另一个只看见任务蒸发。若 session history 已经包含同一轮 interrupted assistant 正文，`GET /v1/chat/state` 不应再额外返回重复的 terminal interrupted snapshot。
- 注意边界：本轮解决的是同一服务进程内 active run 的统一状态渲染；如果服务进程重启，实时过程日志仍需要持久化 run event log 才能跨进程完整回放。

## Context Usage Bar

- 上下文用量常量、DOM 引用、token 估算、电池式分段进度条渲染、详情弹层和输入实时重算逻辑集中在 `src/ui/playground-context-usage-controller.ts`
- `src/ui/playground.ts` 仍保留 `state.contextUsage` / `contextUsageExpanded` / `contextUsageSyncToken`，因为这些状态会被会话恢复、流式事件和发送流程共同更新
- 桌面 Web 把上下文入口放进 `landing-side-right` 工具栏内部最右侧，手机端仍显示在顶部状态栏右侧；二者都不再占用 composer 底部区域。视觉上使用 `4px` 圆角的水平电池式分段进度条，颜色随 safe / caution / warning / danger 状态变化。
- 圆环中央只显示百分比；只要输入区里还有草稿、待发附件或已选资产，就按“预计发送后”口径计算。
- 基线数据来自后端状态接口返回的 `contextUsage`；草稿实时估算仍可通过 `GET /v1/chat/status` 刷新，前端只负责把草稿 / 附件 / 资产的估算 token 叠加上去，所以文案必须明确是估算。
- 风险态统一按 `safe / caution / warning / danger` 四档收口，圆环颜色会随风险变化。
- 桌面端 hover 或键盘 focus 时展示浮层详情；点击可临时固定展开，别再要求用户盯着一个完整状态条。
- 上下文详情弹层统一显示在页面上半区，和顶部入口保持同一视觉重心；不要把按钮放顶部、详情却从底部冒出来，像两个设计师隔空打架。
- 手机端点击上下文电池条后也在上半区展开详情，详情面板改为无边框仪表盘：外层深底、顶部大百分比、柔和进度条、四个指标块和底部模型信息条，通过背景深浅、字号、留白与阴影建立层次，不再把一整段文本塞进弹窗。关闭时必须先通过 `releasePanelFocusBeforeHide(contextUsageDialog, contextUsageShell)` 释放焦点，再设置 `hidden` / `aria-hidden=true` / `inert`，避免关闭按钮仍持焦时触发 `Blocked aria-hidden` 警告。内容包括：会话占用、待发占用、预留回复预算、provider / model、估算口径与剩余可用空间。

## Realtime Notification Broadcast

- `playground` 现在会常驻订阅 `GET /v1/notifications/stream`，专门接收后台 `conn` 完成后的实时广播。
- 广播事件先走持久化，再走实时推送；页面右上角轻提示只是在线提醒层，不替代 `GET /v1/chat/state`。
- 所有在线页面都会各自收到并展示提示；当前版本明确不做多页去重。
- 如果广播属于当前会话，前端会静默用一次 canonical `GET /v1/chat/state` 刷新当前会话的 run 状态和历史消息；如果不属于当前会话，也会同步刷新会话目录。两种情况都不应强制把用户当前的 transcript 滚到底部。
- 页面关闭、`pagehide`、断网或 SSE 断开后会自动断开连接；回到前台、`pageshow` 或重新联网后会自动重连。
- 关键入口：
  - [src/routes/notifications.ts](/E:/AII/ugk-pi/src/routes/notifications.ts)
  - [src/agent/notification-hub.ts](/E:/AII/ugk-pi/src/agent/notification-hub.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/notification-hub.test.ts](/E:/AII/ugk-pi/test/notification-hub.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)

- 实时广播提示层必须保持高于页面其余 fixed overlay 的层级；否则 toast 已进入 DOM，用户视觉上仍会误以为没有收到通知。

## Conn Run Detail Dialog

- `conn` notification 右下角的过程入口除了结果、文件和事件，现在还要展示 run 生命周期关键信息：`claimed`、`started`、`updated`、`lease owner`、`lease until`。
- 对 `running` run，弹层会在前端直接计算一条 health 文案，优先告诉用户它是：
  - `running / lease active`
  - 还是 `running / stale suspected`
- 对已经失败的超时 run，弹层会根据 `run_timed_out` 事件或 `errorText` 中的 `maxRunMs` 失败信息显示 `failed / timed out`，避免和普通模型失败混在一起。
- 这层文案只是可视化摘要，不替代真实 run status 和事件日志；真正排障仍以 `/v1/conns/:connId/runs/:runId` 与 `/events` 为准。

## Conversation Catalog Notifications

- `GET /v1/chat/conversations` 现在会把后台 `notification` 合并进会话目录的 `preview`、`messageCount` 与 `updatedAt`，不再只依赖 `conversationStore` 里那份旧快照。
- 当最新的 `conn` notification 比目录里的旧消息更新时，左侧会话列表摘要会优先显示通知正文摘要，并把这条会话顶到更靠前的位置。
- 这层目录合并只影响列表展示口径，不会把 notification 反写进 session history；真正正文仍以 `GET /v1/chat/state` 的 canonical conversation state 为准。

## Frontend Performance Budget

- 会话切换 / 新建会话的交互预算按“服务端确认目标会话即可切屏”计算，`GET /v1/chat/state` hydrate 必须后台化；否则历史会话越大，用户越会把真实数据恢复误读成按钮卡死。
- 新建会话必须对“已经在空白会话里”保持幂等；只靠按钮 disabled 防连点挡不住本机快请求，最后还是会把历史列表灌满空会话，这种体验债不要再放回去。
- 发送消息时，如果前端已经持有 `conversationId`，不再每次串行等待 `GET /v1/chat/conversations` 和 `GET /v1/chat/state` 预检完成；消息先进入 `/v1/chat/stream`，会话目录改为后台静默刷新。
- 会话目录 index 读写属于用户可感知延迟预算的一部分；高频切换、新建和恢复同步只能命中 `ConversationStore` 的 mtime cache 或排队写入，不能让多个请求并发读旧快照再各自覆盖落盘。
- state hydrate 属于渲染预算，不只是接口预算；同签名回包必须跳过 transcript DOM 重绘，active assistant 文本和运行状态优先 patch 已有节点，别再把长 markdown 和代码块每次都重新 hydrate 一遍。
- composer 输入仍即时调整高度，但 context usage 估算改成 debounce，避免每个按键都触发完整占用量重算。
- `visibilitychange`、`pageshow`、`online` 现在统一走 `scheduleResumeConversationSync()` 做去重、冷却和选项合并，但会按触发原因分级：`online` 只在有 active run 迹象时查状态并重连事件流，`visibilitychange` 只在 active run 或 state 过期时回源，`pageshow` 才强制同步当前会话 state；catalog 只在当前会话缺失、列表为空或显式要求时读取，避免恢复链路把 `GET /v1/chat/conversations` 与 `GET /v1/chat/state` 又串成慢路径。
- 用户离开底部后，前端会取消尚未执行的自动滚底计划；同一会话的 async state 重绘也会恢复当前 scrollTop，而不是拿“重新渲染了一遍”当借口把阅读位置洗掉。
- layout 同步集中到 `scheduleConversationLayoutSync()`；`ResizeObserver` 只观察 composer 容器，不再盯住大面积页面节点。
- 本地历史快照写入 `localStorage` 改为 debounce，并在 `pagehide` / `beforeunload` 前 flush；这层缓存只服务冷启动，不是运行真源。
- 背景和玻璃效果已减负：删除重型 `backdrop-filter: blur(...)`，背景从多层径向堆叠收口为少量层次。
 
## Conn Manager

- `playground` 现在提供后台任务管理入口：桌面端 landing 右侧 `后台任务`，手机端右上角更多菜单里的 `后台任务`。
- 管理弹层使用 `conn-manager-dialog` / `conn-manager-list`，打开时只读取一次 `GET /v1/conns`；该列表响应已经带每个 conn 的 `latestRun` 摘要，不再为每个 conn 立即补一发 `GET /v1/conns/:connId/runs`。
- conn 的 run 历史默认折叠，只用 `latestRun` 展示最新状态摘要；用户展开某个 conn 时，前端才按需请求 `GET /v1/conns/:connId/runs` 补完整 run 列表。旧后端没有 `latestRun` 字段时，前端最多 4 路并发 fallback 拉取 runs，不能再退回无限制 N+1。
- 手机端后台任务管理器不再是贴底抽屉，而是全屏独立工作页：`conn-manager-dialog.open` 与 `conn-manager-panel` 占满 `100dvh`，顶部统一使用 `topbar asset-modal-head mobile-work-topbar`；左侧是返回箭头和 `后台任务` 标题，右侧直接放 `新建任务 / 刷新列表`，状态筛选和批量操作保留在内容区。conn 条目改成 `#0b0c18` 单列卡片，`立即执行 / 编辑 / 暂停 / 恢复 / 删除 / 查看` 这类操作以整宽网格按钮呈现，避免横向挤成一排小字按钮。
- 手机端后台任务创建 / 编辑同样不再是弹窗，而是全屏编辑页：`conn-editor-dialog.open` 与 `conn-editor-panel` 占满 `100dvh`，顶部统一状态栏左侧是返回箭头和页面标题，右侧直接放 `保存 / 取消`；表单按 `标题 / 让它做什么 / 投递目标 / 调度 / 高级设置` 分块滚动，常用字段使用 `#0b0c18` 实心输入卡片。
- 管理弹层提供 `新建` 入口，每条 conn 提供 `编辑` 入口；编辑器使用 `conn-editor-dialog` / `conn-editor-form`，调用 `POST /v1/conns` 或 `PATCH /v1/conns/:connId`。
- conn 创建 / 编辑器默认只露出常用字段：标题、`让它做什么`、`结果发到哪里`、调度和保存。编号输入只在选择“指定会话 / 飞书”时出现。
- 调度入口只保留三种：`定时执行`、`间隔执行`、`每日执行`。前端负责把这三种映射回后端 `once / interval / cron` payload，创建时不再让用户接触 cron 细节。
- conn 编辑器覆盖标题、prompt、投递目标、调度策略和高级运行字段：
  - 目标支持当前会话、指定 conversation、`feishu_chat`、`feishu_user`。
- 调度区只保留三种模式：`定时执行`、`间隔执行`、`每日执行`。前端仍然映射回后端 `once / interval / cron`，但不再把 cron、工作日、每周这些复杂概念直接甩给用户。
- 三种模式对应的输入也固定下来：`定时执行` 只点选 `执行时间`；`间隔执行` 只点选 `首次执行时间` 并填写 `间隔（分钟）`；`每日执行` 只点选 `每日执行时间`。时间选择统一使用本地打包的 `flatpickr`，配置 `enableTime / time_24hr / disableMobile`，不再依赖系统原生 `datetime-local` / `time` 控件。
- `每日执行时间` 解析现在兼容 `07:00`、`7:00` 与 `HH:mm:ss`，保存时不会再因为用户输入或浏览器差异误报“请填写每日执行时间”。
- “附加资料”区域现在提供显式文件入口：可从文件库复用已有资产，也可直接上传新文件；用户看到的是文件名与选中状态，内部才映射成 `assetRefs`
  - 高级字段默认收进 `高级设置`，用户可见名称分别是 `任务身份`、`执行模板`、`能力包`、`模型策略`、`版本跟随方式`、`最长等待时长（秒）` 和 `附加资料`；底层仍映射到 `profileId`、`agentSpecId`、`skillSetId`、`modelPolicyId`、`upgradePolicy`、`maxRunMs` 和 `assetRefs`。
- 目标选择区现在会显示 `conn-editor-target-preview`：把将要投递到 `任务消息` 还是飞书目标、目标编号和实际投递口径用中文展示出来；这里不能出现 `????` 这类乱码占位。
- 保存成功后，管理器会显示 `conn-manager-notice`，说明已创建 / 已更新的 conn 会投递到哪里，并高亮对应条目。
- conn 列表里的最近 run 默认折叠为一行 `conn-manager-run-summary`；需要查证据时再展开最近 3 条 run，避免管理面变成一堵日志墙。
- 后台任务列表现在按三行人话信息展示：`结果发到`、`执行方式`、`运行节奏`。不再直接向用户暴露 `target / schedule / next / last / maxRunMs` 这类后台字段名。
- 列表状态与最近 run 结果统一显示为中文口径：`运行中 / 已暂停 / 已完成`、`待执行 / 执行中 / 成功 / 失败 / 已取消`，避免用户自己翻译状态码。
- 目标归属不要再脑补成“当前打开哪个会话就往哪个会话冒泡”。后台结果的主落点已经是任务消息页；飞书目标按各自 adapter 投递，聊天 transcript 不再承担这层异步收件箱职责。
- 管理器顶部提供状态筛选和批量工具：`conn-manager-filter` 按全部 / 运行中 / 已暂停 / 已完成过滤；`选择当前` 会选择当前筛选结果；`删除所选` 调用 `POST /v1/conns/bulk-delete`，用于一次清理多条测试 conn。
- 每个 conn 支持：
  - `立即执行`：调用 `POST /v1/conns/:connId/run`，只创建 pending run，不调用前台 agent。
  - `暂停` / `恢复`：按当前 `conn.status` 调用 `POST /v1/conns/:connId/pause` 或 `POST /v1/conns/:connId/resume`。
  - `删除`：二次确认后调用 `DELETE /v1/conns/:connId`。当前后端是硬删除，SQLite 外键会级联删除该 conn 的 run / event / file 记录，并主动清理该 conn 对应的任务消息 / activity 脏引用；这是用来清测试任务的，不要误当成归档。
  - 最近 run 的 `查看`：复用后台任务过程弹层，继续请求 run detail 和 events。
- 前台 agent 正在运行时不会禁用后台任务管理入口；conn 是独立 worker 处理的后台产线，不该被前台聊天 loading 卡住。真要把它绑死，那前面架构白做，属于自己给自己挖坑。
- 页面断言入口在 [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)，运行时拼装入口在 [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)，conn 管理 / 任务过程弹层的静态样式与 HTML 在 [src/ui/playground-conn-activity.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity.ts)，任务消息主体在 [src/ui/playground-task-inbox.ts](/E:/AII/ugk-pi/src/ui/playground-task-inbox.ts)，创建 / 编辑、管理器和 run 详情的前端控制器在 [src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)。
## 任务消息页（2026-04-23）

- `playground` 顶部状态栏现在有独立的 `任务消息` 入口，桌面端按钮是 `open-task-inbox-button`，手机端入口收在更多菜单里的 `mobile-menu-task-inbox-button`。
- 手机端如果存在未读任务消息，右上角 `mobile-overflow-menu-button` 本身也会显示未读数字徽标；用户不需要先打开更多菜单才知道任务消息里有几条未读。
- 任务消息相关红点和数字 badge 统一使用鲜红色 `#ff1744`，带浅色描边和红色 glow，不能再退回半透明粉色那种没精神的提醒色；更多按钮上的数字超过 99 时显示 `99+`。
- 任务消息不是 conversation，也不再把后台结果硬塞回当前会话；任务消息页现在像文件库一样是独立 fixed 工作页，不再通过 `data-primary-view=chat|tasks` 把聊天主壳内容替换掉。
- 任务消息页的主体结构在 [src/ui/playground-task-inbox.ts](/E:/AII/ugk-pi/src/ui/playground-task-inbox.ts)，`src/ui/playground.ts` 只负责拼装入口和把页面挂在 `#shell` 外层，不再继续把任务消息逻辑堆进主文件。
- 列表数据来自 `GET /v1/activity?limit=50`，该响应会同时返回 `unreadCount`；`GET /v1/activity/summary` 只保留给页面初始化和极轻量兜底，不再作为打开任务消息后的固定第二跳。页面打开后不再偷偷清未读。
- 如果顶部 `任务消息` badge 有未读数，打开任务消息页会默认进入 `未读` 筛选，并请求 `GET /v1/activity?limit=50&unreadOnly=true`。这不是装饰，是防止“最新 50 条已读、旧数据还有未读”时红标和列表打架。
- 任务消息页提供 `未读 / 全部` 两个筛选；`未读` 只展示 `readAt` 为空的条目，`全部` 按时间倒序展示完整任务消息。
- 任务消息页头部只保留 `任务消息` 标题，不再显示“后台任务跑完……”说明句；顶部使用 `topbar pane-head task-inbox-head mobile-work-topbar`，左侧是返回箭头和标题，右侧直接放 `未读 / 全部 / 全部已读 / 刷新`。任务消息页外层是独立的 `task-inbox-view.open` fixed 页面壳，内层是 `task-inbox-pane`；手机端占满 `100dvh`，全局聊天用的 `<section id="mobile-topbar" class="mobile-topbar">` 不参与该页面。手机端任务消息页现在按全屏工作页处理：外层是 `#01030a`，sticky 头部是 `#060711`，任务结果卡片是 `#0b0c18` 实心面板，不再沿用透明头部和松散气泡。
- `GET /v1/activity` 响应包含 `hasMore` / `nextBefore` / `unreadCount`，前端据此显示 `加载更多` 并直接刷新 badge，继续用 `before=nextBefore` 分页拉取。不要再把一个固定 `limit=50` 当成全量收件箱，那个坑已经踩过了。
- 任务消息页现在按条处理未读：未读条目会显示红点；点击条目本身，或点击 `任务ID / 复制 / 查看过程`，才会调用 `POST /v1/activity/:activityId/read` 把当前条目标记已读；该响应会返回新的 `unreadCount`，前端本地同步，不再补打一条 summary 请求。
- 任务消息页头部提供显式 `全部已读`，走 `POST /v1/activity/read-all`；该响应会返回 `markedCount` 与新的 `unreadCount`。这才是批量清空未读的正式入口，不再把“打开页面”伪装成“看过全部消息”。
- 每条任务消息的结果正文按对话气泡规格渲染：正文使用 `.message-content` 和 `renderMessageMarkdown()`，代码块、表格、链接和文件下载卡片与聊天 transcript 保持同一套视觉与交互；任务结果区域会覆盖全局 Markdown 标题字号，正文为 `12px`，`h1 / h2 / h3` 分别为 `18px / 16px / 14px`，并给链接、inline code、blockquote、表格头做颜色区分；底部固定提供复制任务 ID、复制正文、查看过程三类动作。其中 `source=conn` 且带 `sourceId + runId` 的条目会继续复用后台 run detail 弹层，弹层里的 `Result` 优先渲染完整 `resultText`，再兜底 `resultSummary`。
- 实时广播到达后，前端只刷新任务消息列表和未读数，不再因为后台结果广播去刷新当前 conversation transcript。
