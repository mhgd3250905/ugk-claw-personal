# 更新记录

这份文档用来记录仓库层面的可追溯更新。

规则很简单，别搞花活：

- 任何影响外部行为、运行方式、接口、文档结构或协作约定的改动，都要在同一轮补一条记录
- 每条记录至少写清：日期、主题、影响范围、对应入口
- 如果只是纯局部代码重构且对外无感，可以不记；但只要会影响下一个接手的人，就应该记

---

## 2026-04-19

### Playground 当前运行态事件重连
- 主题：修复刷新后恢复出的当前运行任务只显示旧快照、不会继续更新的问题，并移除“上一轮仍在运行”这类误导文案
- 影响范围：
  - `AgentService` 的 active run 增加内存事件缓冲和 `subscribeRunEvents` 订阅能力，刷新后的 web 观察者可以重新接入同一个真实 agent run
  - 新增 `GET /v1/chat/events` SSE 入口，用于按 `conversationId` 订阅当前正在运行任务的事件回放和后续更新
  - playground 恢复运行态时会继续连接 `/v1/chat/events`，把 `text_delta`、工具事件、完成、打断和错误继续渲染到同一个助手气泡
  - 恢复态文案统一改为“当前任务正在运行 / 当前正在运行 / 当前任务已结束”，不再把真实仍在运行的 agent run 说成“上一轮”
  - 当前缓冲只覆盖同一服务进程内的 active run；跨服务重启的完整回放仍需要持久化 run event log
- 对应入口：
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 刷新断线网络错误过滤
- 主题：修复运行中刷新页面后，历史里出现“网络 / network error”错误气泡的问题
- 影响范围：
  - 页面 `beforeunload` / `pagehide` 会标记当前 web 观察连接正在卸载
  - 卸载期间 `/v1/chat/stream` 断开产生的 `network error` 不再写入 transcript，也不再持久化成会话历史
  - 恢复历史时会过滤旧的“网络 / network error”暂态错误气泡，避免已经写脏的本地历史继续污染界面
  - 真正的运行态仍以 `/v1/chat/status` 映射后端 agent 状态为准，web 刷新不应该自己编造失败结论
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)

### SSE 断线不再杀掉 Agent 运行态
- 主题：修复刷新页面后正在运行的上一轮任务从状态接口消失的问题
- 影响范围：
  - `AgentService` 事件投递改为 best-effort，SSE 客户端断开或事件回调抛错不再中断真实 agent run
  - `/v1/chat/stream` 写入已关闭响应时会安全忽略，避免浏览器刷新把后端运行态误杀
  - 新增回归测试，覆盖事件消费者抛出 `client closed` 时 `streamChat` 仍能完成并持久化会话文件
  - 刷新后 `/v1/chat/status` 才能继续看到同一个 `conversationId` 的 running 状态，前端恢复气泡和过程日志才有真实依据
- 对应入口：
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)

### Playground 运行过程日志刷新恢复
- 主题：让刷新前已经收到的 Agent 过程日志随会话历史恢复，避免运行中刷新后只剩任务摘要和 loading
- 影响范围：
  - 助手消息历史新增 `process` 快照字段，保存思考过程日志、当前动作、状态类型和完成状态
  - 过程日志追加、当前动作变更、过程收口时会同步写入本地会话历史
  - 刷新后如果会话仍在运行，playground 会优先复用最近的助手气泡，并把过程日志卡片恢复为运行态
  - 当前只恢复刷新前浏览器已经收到的过程日志；刷新期间页面断线后新产生的事件仍需要后端事件回放能力，别指望前端通灵
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 刷新运行态与打断反馈收口
- 主题：修复刷新后恢复到“上一轮仍在运行”时缺少上一轮任务正文，以及点击打断后旧 loading 气泡仍显示运行中的问题
- 影响范围：
  - playground 恢复运行中会话时，会从本地历史中提取最近一条用户消息，并写入助手气泡正文，避免只剩一个空的“上一轮仍在运行”
  - `/v1/chat/interrupt` 返回打断成功后，当前助手 loading 气泡会收口为“本轮已中断”，并释放前端 loading 状态
  - 如果打断时后端已无运行任务，前端会将残留 loading 收口为“上一轮已结束”，不再继续误导用户
  - 页面断言同步覆盖恢复态任务摘要与打断后的 loading 收口
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground ?????????????
- ????????????????????????????????? `Conversation ... is already running` ????
- ?????
  - ?? `GET /v1/chat/status`????????????????
  - playground ?????????????????????? loading ????
  - ????????????????????? `/v1/chat/queue`????????? stream
  - ???????????????????????????????
- ?????
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
### Playground ??? loading ????
- ??????????????????? loading ?????????????????????
- ?????
  - ??????????????? loading ?????? `text_delta` ??????
  - loading ????? `run_started`????????????? / ?? / ????????
  - ????????????????????? loading ????
  - ????????? loading ???????????
- ?????
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
### Playground 深空主题收口
- 主题：将 playground 的整体氛围从偏蓝电子夜景收口为更深的宇宙深空主题
- 影响范围：
  - 全局背景改为近黑深空底色，并加入暗紫星云与冷白星尘层次，页面纵深更明显
  - 主强调色从亮蓝改为偏冷白的星光色，避免操作按钮、高亮边框和装饰线条整体发蓝
  - landing 区域的输入面板、悬浮控制、引用按钮和拖拽态一起同步降蓝，避免背景改深了但组件还在泛蓝
  - 补充页面断言，覆盖新的深空配色与旧蓝色退场
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 会话历史恢复与正文复制
- 主题：为 playground 补上当前会话的本地历史恢复、上滚加载更多、新会话提示气泡，以及消息正文复制按钮
- 影响范围：
  - transcript 现在会按 `conversationId` 持久化最近消息，刷新页面后优先恢复当前会话最近历史，不再每次刷新都变成白板
  - 对话区顶部新增“加载更多历史”兜底入口，同时在滚动到顶部时自动继续加载更早消息
  - 点击“全新的记忆”后，会立即插入一条助手样式气泡，明确提示当前已启用的新会话和对应会话 ID
  - 所有消息气泡底部统一增加“复制正文”按钮，复制范围只包含该条消息正文
  - 同步补齐页面断言，覆盖历史恢复脚本、新会话提示和复制按钮
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 对话区底部动态避让
- 主题：将 `landing` 模式下 transcript 区域的底部留白从固定值改为跟随 `command-deck` 实际高度动态同步
- 影响范围：
  - 解决待发送文件 / 已选资产过多时，`command-deck` 变高并与对话区底部重叠的问题
  - `stream-layout` 的底部避让改为按 `chat-stage` 底部到 `command-deck` 顶部的真实距离计算，避免遗漏 padding / margin 带来的视觉重叠
  - `landing` 模式下 transcript 容器高度被约束在可用空间内，内容过多时应转为滚动而不是继续压到 `command-deck` 上
  - 页面缩放、文件增删、资产增删后，对话区底部避让会一起更新
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 控制类错误提示收口

- 主题：将 `not_running`、`abort_not_supported` 等运行态控制错误统一收口到顶部横幅提示
- 影响范围：
  - `/v1/chat/queue` 与 `/v1/chat/interrupt` 的拒绝信息不再写进底部过程流，避免和对话气泡重叠
  - 错误横幅改为顶部悬浮通知层，不再作为主内容流中的普通块级元素跟随 landing 会话布局下沉到底部
  - 错误横幅视觉收口为无边框 `4px` 圆角通知条，并新增右侧关闭按钮
  - 修正错误横幅默认显隐逻辑，避免刷新页面后空的横幅壳子常驻顶部
  - 错误横幅默认增加 `hidden` 语义开关，不再只依赖 CSS 显隐，降低旧样式或缓存导致空壳可见的风险
  - 增加 `.error-banner[hidden] { display: none !important; }` 兜底规则，防止显隐逻辑再次被普通样式覆盖
  - 运行态 reason 码转为可读文案，减少原始错误码直接暴露
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 用户消息可读性修正

- 主题：保留用户消息气泡靠右，但将正文文本恢复为标准左对齐
- 影响范围：
  - 修正 playground 中用户长文本消息全部右对齐导致的阅读负担
  - 同步更新页面断言与当前 UI 文档口径，避免后续把错误表现继续当成设计
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### 文档系统重构

- 主题：压缩 `AGENTS.md`，建立渐进式披露文档结构
- 影响范围：
  - `AGENTS.md` 只保留最高准则、全局规则、固定运行口径和场景索引
  - 新增追溯与专题文档承接细节
- 对应入口：
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
  - [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### README 收敛

- 主题：README 改为入口说明文档，移除重复和过时描述
- 影响范围：
  - 保留项目定位、运行方式、接口速查、文档导航
  - 移除冗长历史碎片和重复说明
- 对应入口：
  - [README.md](/E:/AII/ugk-pi/README.md)

### 文档同步纪律固化

- 主题：将“改动后必须同步文档并留痕”提升为全局规则
- 影响范围：
  - 后续 agent 在实现行为变更、运行口径变更、接口变更、文档结构变更后，必须同步更新文档并写入本文件
- 对应入口：
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)
