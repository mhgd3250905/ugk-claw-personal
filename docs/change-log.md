# 更新记录

这份文档用来记录仓库层面的可追溯更新。

规则很简单，别搞花活：

- 任何影响外部行为、运行方式、接口、文档结构或协作约定的改动，都要在同一轮补一条记录
- 每条记录至少写清：日期、主题、影响范围、对应入口
- 如果只是纯局部代码重构且对外无感，可以不记；但只要会影响下一个接手的人，就应该记

---

## 2026-04-23

### Runtime / Conn / Feishu 稳定性与交互收口
- 日期：2026-04-23
- 主题：收口一轮真正会影响运行与交互体验的改动：`web-access` 任务结束后按本轮 scope 清理遗留页面，`send_file` 产物不再在会话恢复后消失，`playground` 历史会话支持删除与自定义确认弹窗，输入框纵向居中，上下文详情弹层上移，`/v1/chat/current` 周边的会话目录同步去重降噪，`conn` 编辑器不再逼用户手填 `assetId`，并把 `conn` 系统技能与 Feishu 单窗口接入链路按模块拆开。继续让稳定链路带着重复请求、消失文件和系统弹窗满街跑，那不叫迭代，叫放任脏活长期驻场。
- 影响范围：`src/agent/agent-service.ts` 为每轮 chat 注入 browser cleanup scope、清理 `web-access` 页面并把 `send_file` 文件回挂到 canonical history，同时补 `deleteConversation()` 与会话目录 notification summary；`src/routes/chat.ts`、`src/types/api.ts` 暴露 `DELETE /v1/chat/conversations/:conversationId`；`src/routes/files.ts` 增加 `POST /v1/assets`；`src/ui/playground.ts`、`src/ui/playground-conversations-controller.ts`、`src/ui/playground-assets-controller.ts`、`src/ui/playground-conn-activity-controller.ts` 收口确认弹窗、输入框纵向居中、上下文详情位置、catalog freshness 与 conn 文件选择入口；`.pi/extensions/conn/index.ts` 与 `.pi/skills/conn-orchestrator/SKILL.md` 对齐真实 `conn` 能力、`assetRefs` 与 run 查询；`src/integrations/feishu/` 新增 `message-parser`、`attachment-bridge`、`queue-policy`、`delivery`、`types` 等模块，把文件收发和单窗口消息排队从 service 主文件里拆出来。
- 对应入口：[src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)、[src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)、[src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)、[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[src/ui/playground-conversations-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conversations-controller.ts)、[src/ui/playground-assets-controller.ts](/E:/AII/ugk-pi/src/ui/playground-assets-controller.ts)、[src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)、[.pi/extensions/conn/index.ts](/E:/AII/ugk-pi/.pi/extensions/conn/index.ts)、[.pi/skills/conn-orchestrator/SKILL.md](/E:/AII/ugk-pi/.pi/skills/conn-orchestrator/SKILL.md)、[src/integrations/feishu/service.ts](/E:/AII/ugk-pi/src/integrations/feishu/service.ts)、[src/integrations/feishu/message-parser.ts](/E:/AII/ugk-pi/src/integrations/feishu/message-parser.ts)、[src/integrations/feishu/attachment-bridge.ts](/E:/AII/ugk-pi/src/integrations/feishu/attachment-bridge.ts)、[src/integrations/feishu/queue-policy.ts](/E:/AII/ugk-pi/src/integrations/feishu/queue-policy.ts)、[src/integrations/feishu/delivery.ts](/E:/AII/ugk-pi/src/integrations/feishu/delivery.ts)、[test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[test/conn-extension.test.ts](/E:/AII/ugk-pi/test/conn-extension.test.ts)、[test/feishu-service.test.ts](/E:/AII/ugk-pi/test/feishu-service.test.ts)

### 腾讯云生产环境增量更新到 0a34e81
- 日期：2026-04-23
- 主题：按用户确认的“增量更新”方式把腾讯云新加坡生产环境从 `21f1a5a` 更新到 `0a34e81 feat: refine playground desktop and mobile UX`，并同步记录最新线上 commit、发布前回滚 tag、sidecar 登录态备份和验收结果。生产事实不写文档，下一次接手就会继续拿旧 commit 当真相，这种坑属于自己挖给未来的自己跳。
- 影响范围：`docs/handoff-current.md` 更新当前本地最新提交、服务器已部署提交、最新回滚 tag 与 sidecar 备份；`docs/server-ops-quick-reference.md` 更新当前线上提交；`docs/tencent-cloud-singapore-deploy.md` 更新部署快照并追加 2026-04-23 增量发布记录，包含 `git pull --ff-only`、`up --build -d`、`healthz`、`playground`、`check-deps.mjs` 和 `docker compose ps` 验收结果。
- 对应入口：[docs/handoff-current.md](/E:/AII/ugk-pi/docs/handoff-current.md)、[docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)、[docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

## 2026-04-22

### Playground 桌面与文件预览体验再收口
- 日期：2026-04-23
- 主题：按用户最新反馈继续收口桌面与移动细节：桌面 topbar 工具按钮居中、桌面常驻左侧历史会话栏、桌面上下文电池条放进 `landing-side-right` 内部最右侧、手机历史抽屉头部透明、文件 / 资产 chip 多选后可换行可读、超过 5 个文件改成系统对话提示、上下文入口从 composer 底部移到顶部并改成电池式分段进度条。底部再挂一个小圆环和一行莫名文字，确实很像 UI 自己在碎碎念。
- 影响范围：`src/ui/playground.ts` 调整 shell 双栏布局、桌面历史会话栏、顶部上下文电池条和 composer 底部结构；`src/ui/playground-conversations-controller.ts` 让桌面常驻栏与手机抽屉共用同一份会话目录渲染；`src/ui/playground-mobile-shell-controller.ts` 增加桌面会话列表 DOM 引用；`src/ui/playground-context-usage-controller.ts` 改为驱动 CSS 分段电池进度；`src/ui/playground-assets.ts` 收口文件 chip 换行、4px 圆角、列表内部滚动和手机抽屉头部透明；`src/ui/playground-assets-controller.ts` 把超过 5 个文件的提醒转为 transcript 系统提示，并拦截对应 process-note；`test/server.test.ts` 和 `docs/playground-current.md` 同步新口径。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[src/ui/playground-conversations-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conversations-controller.ts)、[src/ui/playground-mobile-shell-controller.ts](/E:/AII/ugk-pi/src/ui/playground-mobile-shell-controller.ts)、[src/ui/playground-context-usage-controller.ts](/E:/AII/ugk-pi/src/ui/playground-context-usage-controller.ts)、[src/ui/playground-assets.ts](/E:/AII/ugk-pi/src/ui/playground-assets.ts)、[src/ui/playground-assets-controller.ts](/E:/AII/ugk-pi/src/ui/playground-assets-controller.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 手机端操作面板体验收口
- 日期：2026-04-22
- 主题：把手机端 `文件库`、`后台任务`、`全局活动`、后台 run 详情和历史会话侧边栏，从“桌面弹窗压缩版”收口成统一的移动端抽屉 / 卡片交互。继续让用户在窄屏上点一排小按钮，那不是高级，是折磨拇指。
- 影响范围：`src/ui/playground-assets.ts` 在 `max-width: 640px` 内新增贴底抽屉、sticky 标题区、safe-area 底部留白、触摸网格按钮、文件库 / 后台任务 / 全局活动的 64px 列表卡片、后台任务单列工具栏、run 详情贴底面板，以及历史会话抽屉的宽屏卡片化外观、sticky 头部和 active 左侧亮条；`src/ui/playground.ts` 新增面板关闭后的焦点归还 helper，`src/ui/playground-assets-controller.ts`、`src/ui/playground-mobile-shell-controller.ts`、`src/ui/playground-conn-activity-controller.ts` 在打开 / 关闭文件库、后台任务、全局活动、run 详情和编辑器时记录并归还焦点，避免关闭弹层后焦点还卡在 `aria-hidden` 容器里；`test/server.test.ts` 新增页面断言锁住这些手机端 UI 与焦点约束；`docs/playground-current.md` 同步移动端真实交互口径。
- 对应入口：[src/ui/playground-assets.ts](/E:/AII/ugk-pi/src/ui/playground-assets.ts)、[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[src/ui/playground-assets-controller.ts](/E:/AII/ugk-pi/src/ui/playground-assets-controller.ts)、[src/ui/playground-mobile-shell-controller.ts](/E:/AII/ugk-pi/src/ui/playground-mobile-shell-controller.ts)、[src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 手机历史会话抽屉文字可读性修复
- 日期：2026-04-23
- 主题：修复手机端会话选择侧边栏里标题、摘要和时间文字被压扁到几乎看不见的问题。根因是历史项作为 `button` 继承了全局按钮排版和 disabled 压暗，上轮只改了卡片外观，没有把移动列表文字自己的 `line-height / opacity / letter-spacing` 收回来，这种半截字 UI 看着就像被门夹过。
- 影响范围：`src/ui/playground-assets.ts` 仅调整移动历史会话抽屉：宽度改为 `min(94vw, 380px)`，右侧遮罩加深，历史项最小高度改为 `78px`，标题 / 摘要 / meta 显式设置移动行高，active 当前项不再因 disabled 整体压暗，active 左侧亮条退到文字层下方；`test/server.test.ts` 更新页面断言锁住这些真实视觉约束；`docs/playground-current.md` 同步最新手机历史抽屉口径。
- 对应入口：[src/ui/playground-assets.ts](/E:/AII/ugk-pi/src/ui/playground-assets.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 手机历史会话抽屉 4px 与去色块二次收口
- 日期：2026-04-23
- 主题：按实机截图继续修手机会话选择侧边栏：第一条 active 会话仍然横向挤压，蓝色选中块过重，圆角也没有遵守用户要求的 `4px`。上一轮能读了，但还丑，这种“能用但碍眼”的状态不能当完成。
- 影响范围：`src/ui/playground-assets.ts` 在移动历史抽屉内把关闭按钮、空态、会话项和 active 亮条统一收成 `4px` 圆角；历史项最小高度提高到 `108px`，采用三行网格排版，摘要显式允许两行换行；active 当前项取消大面积蓝色填充，仅保留细边框和左侧亮条；`test/server.test.ts` 增加断言锁住 `108px`、两行摘要、`4px` 和去色块约束；`docs/playground-current.md` 同步最新口径。
- 对应入口：[src/ui/playground-assets.ts](/E:/AII/ugk-pi/src/ui/playground-assets.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground Conn 编辑器时间选择改为点选控件
- 日期：2026-04-23
- 主题：把后台任务编辑器里的 `定时执行`、`间隔执行`、`每日执行` 时间输入从系统原生控件改成点选式时间选择。用户填 `07:00` 还提示“请填写每日执行时间”，这就不是用户问题，是控件和校验在给人添堵。
- 影响范围：新增 `flatpickr` 本地依赖，`src/routes/static.ts` 只暴露 `/vendor/flatpickr/` 下的 JS/CSS 与中文 locale；`src/ui/playground.ts` 加载本地 flatpickr 资源；`src/ui/playground-conn-activity.ts` 把 once / interval start / daily time 输入改为 flatpickr 文本入口并补齐深色主题样式；`src/ui/playground-conn-activity-controller.ts` 初始化 `enableTime / time_24hr / disableMobile` 点选控件，并让每日时间解析兼容 `7:00`、`07:00`、`HH:mm:ss`；`test/server.test.ts` 增加页面和静态资源断言；`docs/playground-current.md` 同步当前交互口径。
- 对应入口：[package.json](/E:/AII/ugk-pi/package.json)、[src/routes/static.ts](/E:/AII/ugk-pi/src/routes/static.ts)、[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[src/ui/playground-conn-activity.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity.ts)、[src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 手机后台面板 4px 圆角统一
- 日期：2026-04-23
- 主题：按用户明确偏好，把 `新建后台任务`、`后台任务`、`全局活动` 和后台 run 详情这些手机面板的大圆角全部收成 `4px`。继续保留 22px / 16px 这种“移动端默认圆润感”，就是跟用户主题对着干，没必要。
- 影响范围：`src/ui/playground-assets.ts` 在移动端覆写里把 `asset-modal`、面板 handle、操作按钮、后台任务 / 全局活动列表卡片、后台任务工具栏、筛选器、run 条目和 run 详情面板统一改为 `4px`；`src/ui/playground-conn-activity.ts` 同步基础 run detail 圆角；顺手修正 `src/ui/playground-conn-activity-controller.ts` 的每日时间正则多转义问题，避免 `07:00` 被误判为空；`test/server.test.ts` 更新断言锁住 `4px` 与正则不再多转义；`docs/playground-current.md` 同步当前视觉规则。
- 对应入口：[src/ui/playground-assets.ts](/E:/AII/ugk-pi/src/ui/playground-assets.ts)、[src/ui/playground-conn-activity.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity.ts)、[src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 同会话异步回包保住阅读位置
- 日期：2026-04-22
- 主题：修复用户点击一个历史较长的会话后，先看到本地恢复内容并上滑阅读，结果晚到的 `GET /v1/chat/state` 回包又把 transcript 甩回底部的问题。根因不只是一句 `scrollTranscriptToBottom()`，而是同一会话的 canonical state 重绘会整段清空再重画，同时旧的自动滚底 timer 还可能排队补刀，双管齐下把用户阅读位置当不存在。
- 影响范围：`src/ui/playground-layout-controller.ts` 新增取消排队自动滚底的逻辑，用户离开底部后会立即清掉尚未执行的 transcript auto-scroll；`src/ui/playground.ts` 在同一会话的 canonical state 重绘前记录当前 `scrollTop`，重绘后恢复阅读位置并维持 `autoFollowTranscript = false`；`test/server.test.ts` 新增页面断言锁住“用户上滑后取消排队滚底”和“同会话 async state 重绘保住 scrollTop”这两条行为；`docs/playground-current.md` 同步补齐当前交互口径。
- 对应入口：[src/ui/playground-layout-controller.ts](/E:/AII/ugk-pi/src/ui/playground-layout-controller.ts)、[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 会话切换与新会话交互减重
- 日期：2026-04-22
- 主题：收口 `playground` 在切换会话、新会话、恢复同步和广播补同步时的重复请求与强制滚底。之前那套“点一下先等一串 catalog/state round-trip，再顺手把 transcript 拽回底部”的交互，体验烂得很稳定，属于自己给自己找骂。
- 影响范围：`src/ui/playground-conversations-controller.ts` 现在在切换会话时只做一次 canonical `GET /v1/chat/state` 收口，不再先 restore 再 sync run；手机历史抽屉点击后会先立即关闭，再等待 `POST /v1/chat/current` 回包；点击 `新会话` 后会先乐观插入新目录项，再直接激活新会话，不再额外立刻同步 `GET /v1/chat/conversations`。`src/ui/playground-layout-controller.ts` 与 `src/ui/playground-stream-controller.ts` 的恢复 / 广播补同步也改为单次 state 收口；`src/ui/playground.ts` 的历史恢复与状态渲染不再默认 `force` 滚到底部；`test/server.test.ts` 补了回归断言锁住这些行为；`docs/playground-current.md` 同步当前交互口径。
- 对应入口：[src/ui/playground-conversations-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conversations-controller.ts)、[src/ui/playground-layout-controller.ts](/E:/AII/ugk-pi/src/ui/playground-layout-controller.ts)、[src/ui/playground-stream-controller.ts](/E:/AII/ugk-pi/src/ui/playground-stream-controller.ts)、[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### 交接文档与发布口径补齐
- 日期：2026-04-22
- 主题：把当前交接所需的发布事实、线上提交、稳定 tag、回滚锚点和推荐阅读顺序补成显式文档入口，免得后续接手继续在 `README`、部署手册、change-log 和聊天记录之间来回抽搐。文档系统如果没有一个交接总览页，表面上看资料不少，实际上还是靠运气找真相。
- 影响范围：新增 [docs/handoff-current.md](/E:/AII/ugk-pi/docs/handoff-current.md) 作为当前交接总览；[README.md](/E:/AII/ugk-pi/README.md) 的稳定事实与文档导航补齐最新稳定 tag 和 handoff 入口；[docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md) 在快速接手与部署场景补 handoff 入口；[docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md) 增加当前线上提交与稳妥增量更新步骤；[docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md) 记录 2026-04-22 最新增量发布结果与 `v4.1.1 -> v4.1.2` 的修正口径。
- 对应入口：[docs/handoff-current.md](/E:/AII/ugk-pi/docs/handoff-current.md)、[README.md](/E:/AII/ugk-pi/README.md)、[docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)、[docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)、[docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

### 生产 compose YAML 缩进修正
- 日期：2026-04-22
- 主题：在服务器做增量更新时，`docker-compose.prod.yml` 因为 healthcheck 下的 `retries` 缩进错误直接解析失败，导致 `up --build -d` 根本起不来。这个坑不修，前面 tag 打得再漂亮也只是给自己做纪念册。
- 影响范围：修正 [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml) 中 `ugk-pi` 服务 healthcheck 的 YAML 缩进，使生产 compose 能重新通过解析并执行标准增量发布；本条记录补进 [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md) 方便后续追溯这次线上发布阻塞点。
- 对应入口：[docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)、[docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)

### Playground runtime 阶段总结文档补齐
- 日期：2026-04-22
- 主题：把这轮 `playground` runtime 拆分、竞态修复和 assembler 收口补成一份独立阶段总结文档，免得后续 `/init` 或继续改前端的人只能翻 `change-log` 和提交记录拼拼图。只靠零散记录追溯 controller 边界、sync ownership、stream lifecycle 和已修过的坑，效率低得像在拿牙签挖地基。
- 影响范围：新增 [docs/playground-runtime-refactor-summary-2026-04-22.md](/E:/AII/ugk-pi/docs/playground-runtime-refactor-summary-2026-04-22.md)，集中记录本轮 `playground` 拆分阶段、当前边界、关键提交、备份锚点、已修真实问题和后续接手建议；[README.md](/E:/AII/ugk-pi/README.md) 的文档导航新增该文档入口；[docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md) 在快速接手与 playground 场景里补了这份阶段总结入口。
- 对应入口：[docs/playground-runtime-refactor-summary-2026-04-22.md](/E:/AII/ugk-pi/docs/playground-runtime-refactor-summary-2026-04-22.md)、[README.md](/E:/AII/ugk-pi/README.md)、[docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### Playground assembler cleanup 收口
- 日期：2026-04-22
- 主题：继续做 `playground.ts` 的最后一层 assembler cleanup，删掉 stream split 之后遗留的死 helper，并把页面尾部那串散装初始化 / 事件绑定收成明确入口。继续把这些零散语句摊在脚本尾巴上，文件虽然名义上叫 assembler，读起来还是像把 TODO 倒进去了。
- 影响范围：`src/ui/playground.ts` 删除未使用的 `fetchConversationHistory()`，新增 `bindPlaygroundAssemblerEvents()` 与 `initializePlaygroundAssembler()` 收口页面初始化和事件绑定；`test/server.test.ts` 增加页面断言，锁住死 helper 已移除且 assembler 入口存在；`docs/playground-current.md` 同步当前页面装配口径。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 桌面 topbar 合并 landing 工具栏
- 日期：2026-04-22
- 主题：按当前桌面 Web 交互收口，把原本悬浮在 landing hero 上方的 `landing-side-right` 菜单栏直接并入 `<header class="topbar">`，替换掉旧的 `topbar-signal` 字标占位。继续让右侧工具栏飘在首屏上面，结构上就还是两套头部，后面谁改桌面导航谁倒霉。
- 影响范围：`src/ui/playground.ts` 调整桌面 topbar DOM 结构与 `landing-side-right` 布局，移除 `topbar-signal` 标记和对应旧样式；`test/server.test.ts` 改为断言桌面工具栏已经进入 `topbar` 且不再渲染旧字标；`docs/playground-current.md` 同步桌面头部当前事实。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 历史消息时间戳透传修复
- 日期：2026-04-22
- 主题：修复刷新后历史消息气泡时间统一显示 `08:00:00` 的问题。根因不是前端时间格式化，而是 `AgentService` 在把 session message 转成 canonical history 时把 `createdAt` 硬写成了 Unix epoch，东八区一格式化就整排早八。
- 影响范围：`src/agent/agent-service.ts` 现在会优先读取 session message 的 `timestamp`（支持 number / ISO string）并透传成 `createdAt`；只有源消息确实没有时间时才继续回退到 epoch。`src/agent/context-usage.ts` 与 `src/agent/agent-session-factory.ts` 同步补了 `timestamp` 类型；`test/agent-service.test.ts` 新增回归断言，锁死 history 时间戳透传。
- 对应入口：[src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)、[src/agent/context-usage.ts](/E:/AII/ugk-pi/src/agent/context-usage.ts)、[src/agent/agent-session-factory.ts](/E:/AII/ugk-pi/src/agent/agent-session-factory.ts)、[test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground interrupted refresh duplicate 收口
- 日期：2026-04-22
- 主题：修复 `playground` 在“运行中补充消息 -> 中断 -> 刷新”之后，把已经写进 canonical history 的 interrupted partial reply 又作为 terminal `activeRun` 重新返回一遍，导致刷新页同时看到旧助手正文、补充消息和一份重复的中断过程壳子。
- 影响范围：`src/agent/agent-service.ts` 现在会在 `getConversationState()` 内先看 session history 是否已经覆盖 terminal snapshot；如果 interrupted / error 的 terminal run 正文已经存在于 canonical history 里，就不再重复把它塞回 `activeRun`。对于仍需保留的 terminal snapshot，如果 history 末尾已经带上当前轮 user 输入，也会把 `activeRun.input.message` 清空，避免刷新页再把原提问补画第二遍。`test/agent-service.test.ts` 新增两条回归断言，分别锁死“部分回复 + steer + interrupt”的重复 terminal snapshot，以及“无正文即中断”时的输入重复回显。
- 对应入口：[src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)、[test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 会话恢复竞态收口
- 日期：2026-04-22
- 主题：修复 `playground` 在新会话、刷新恢复和异步状态同步时偶发混入旧会话消息的问题。根因不是后端 current conversation 指针错了，而是前端对异步 `GET /v1/chat/state` 回包缺少“当前仍是这条会话”的校验，旧请求慢回时会覆盖当前页面；同时 transcript 清空时没有同步清掉 `transcript-archive`，给旧 DOM 残留留了口子。
- 影响范围：`src/ui/playground.ts` 现在会在 `syncConversationRunState()`、`restoreConversationHistoryFromServer()` 和 `renderConversationState()` 内忽略 stale conversation response；`src/ui/playground-transcript-renderer.ts` 的 `clearRenderedTranscript()` 会同时清空 `transcript-current` 与 `transcript-archive`；`test/server.test.ts` 新增对应回归断言，锁死旧会话异步回包覆盖当前 transcript 的竞态。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[src/ui/playground-transcript-renderer.ts](/E:/AII/ugk-pi/src/ui/playground-transcript-renderer.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground transcript renderer 拆分
- 日期：2026-04-22
- 主题：继续执行 playground runtime split，把 transcript 条目渲染、assistant loading / process shell、正文复制按钮、markdown hydration、代码块 copy toolbar 和 `bindPlaygroundTranscriptRenderer()` 初始化入口拆到独立 renderer。主文件继续一边拼页面一边手搓消息渲染，迟早又会把 stream 生命周期和消息展示搅成一锅。
- 影响范围：新增 `src/ui/playground-transcript-renderer.ts`，导出浏览器端 markdown renderer 和 transcript renderer inline classic script；`src/ui/playground.ts` 继续持有主 state、会话恢复、流式事件和页面组装，只保留对 transcript 渲染函数的调用点。消息 DOM 结构、复制按钮样式、markdown / code block 展示、历史恢复合并口径和现有 DOM id 保持不变。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[src/ui/playground-transcript-renderer.ts](/E:/AII/ugk-pi/src/ui/playground-transcript-renderer.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### Playground 布局滚动控制器拆分
- 日期：2026-04-22
- 主题：继续执行 playground runtime split，把 composer 高度同步、会话宽度同步、transcript 自动跟随、回到底部按钮、顶部加载更多触发、以及前后台/联网恢复同步入口拆到独立布局控制器。主文件继续吃这些滚动细节，下一次改消息渲染就又要在泥潭里摸电线，没必要。
- 影响范围：新增 `src/ui/playground-layout-controller.ts`，导出布局常量、布局/滚动/恢复控制函数和事件绑定入口；`src/ui/playground.ts` 继续持有主 state、DOM refs、transcript 渲染、stream 生命周期和页面组装。`--conversation-width`、`--command-deck-offset`、`--transcript-bottom-scroll-buffer`、用户上滑不强制滚底、`visibilitychange/pageshow/online` 恢复同步、以及现有 DOM id 保持不变。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[src/ui/playground-layout-controller.ts](/E:/AII/ugk-pi/src/ui/playground-layout-controller.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### Playground 会话目录控制器拆分
- 日期：2026-04-22
- 主题：继续执行 playground runtime split，把会话目录加载、新建会话、切换当前会话、运行中禁切和手机历史抽屉列表渲染拆到独立控制器。主文件再继续包办这堆会话入口，就不是页面组装器了，是前端杂物间。
- 影响范围：新增 `src/ui/playground-conversations-controller.ts`，导出会话目录、创建、切换、激活和抽屉列表渲染相关的 inline classic script 片段；`src/ui/playground.ts` 继续持有主 state、transcript 恢复、stream 生命周期、布局滚动和页面组装。`GET /v1/chat/conversations`、`POST /v1/chat/conversations`、`POST /v1/chat/current` 的外部行为、运行中禁止新建/切换、手机历史抽屉展示和现有 DOM id 保持不变。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[src/ui/playground-conversations-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conversations-controller.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### Playground 手机外壳控制器拆分
- 日期：2026-04-22
- 主题：继续给 `src/ui/playground.ts` 减负，把手机端 topbar、更多菜单、历史抽屉开关、遮罩关闭、外部点击关闭和移动端入口绑定拆到独立控制器。注意，这一刀只拆移动外壳，不把 conversation catalog 渲染、切换和服务端同步一起硬搬；那是下一阶段的活，混着拆只会把边界拆成一锅粥。
- 影响范围：新增 `src/ui/playground-mobile-shell-controller.ts`，导出移动端 DOM 引用、shell 控制函数和事件绑定脚本片段；`src/ui/playground.ts` 继续持有主 state、conversation drawer 列表渲染、会话创建/切换和 inline classic script 组装入口。页面 DOM id、移动端视觉、`新会话`、`更多`、`技能 / 文件 / 文件库 / 后台任务 / 全局活动` 入口行为保持不变。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[src/ui/playground-mobile-shell-controller.ts](/E:/AII/ugk-pi/src/ui/playground-mobile-shell-controller.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### Playground 上下文用量控制器拆分
- 日期：2026-04-22
- 主题：继续拆 `src/ui/playground.ts`，把上下文 token 估算、进度环渲染、详情弹层、状态同步和输入实时重算逻辑拆成独立控制器。这个东西继续挂在主脚本里，后面谁改 composer、文件上传或会话恢复都要顺手绕过一堆 token 计算，纯属给自己找罪受。
- 影响范围：新增 `src/ui/playground-context-usage-controller.ts`，导出上下文用量常量、DOM 引用、控制器函数和事件绑定脚本片段；`src/ui/playground.ts` 保留 `state.contextUsage*` 状态字段和会话主流程里的调用点。进度环 DOM id、详情弹层、估算规则、`GET /v1/chat/status` 同步口径和用户交互不变。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[src/ui/playground-context-usage-controller.ts](/E:/AII/ugk-pi/src/ui/playground-context-usage-controller.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### Playground 文件/资产运行时控制器拆分
- 日期：2026-04-22
- 主题：继续拆 `src/ui/playground.ts`，把文件上传、拖拽投放、附件 chip、资产库刷新 / 复用、已选资产和输出文件下载这组浏览器运行时逻辑拆到独立控制器。主文件继续包办这些细枝末节，那就不是入口文件，是前端垃圾压缩包。
- 影响范围：新增 `src/ui/playground-assets-controller.ts`，导出文件 / 资产 DOM 引用、运行时 helper 和事件绑定脚本片段；`src/ui/playground.ts` 只保留主页面拼装、会话 / transcript 主流程和对资产控制器函数的调用。顺手移除未使用的 `formatMessageWithContext()` 内联函数。DOM id、HTTP 接口、上传限制、资产复用和下载行为不变。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[src/ui/playground-assets.ts](/E:/AII/ugk-pi/src/ui/playground-assets.ts)、[src/ui/playground-assets-controller.ts](/E:/AII/ugk-pi/src/ui/playground-assets-controller.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### Playground 文件/资产静态片段拆分
- 日期：2026-04-22
- 主题：继续给 `src/ui/playground.ts` 减负，把文件上传、文件 chip、已选资产和资产库弹窗这组静态 UI 片段拆到独立文件。之前主文件已经开始像前端杂物间了，再不分区，后面每改一次 conn 或消息区都要顺手撞到资产库逻辑。
- 影响范围：新增 `src/ui/playground-assets.ts`，承接 drop zone、file chip、selected assets、asset modal 的静态样式片段和资产弹窗 HTML；conn / 全局活动列表样式继续归在 `src/ui/playground-conn-activity.ts`，避免资产模块反向持有后台任务选择器；`src/ui/playground.ts` 保留主页面拼装入口、共享响应式约束和现有运行时逻辑。DOM id、接口路径、事件绑定和用户交互不变。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[src/ui/playground-assets.ts](/E:/AII/ugk-pi/src/ui/playground-assets.ts)、[src/ui/playground-conn-activity.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### Conn 后台结果摘要与输出文件索引收口
- 日期：2026-04-22
- 主题：修复同一个 conn 两次运行时通知正文一会儿展示真实答案、一会儿只展示“输出文件已写入”的不稳定体验。根因是后台 runner 只取最后一条 assistant 可见文本，而模型在写完 `output/result.txt` 后可能用一句低信息量的文件提示收尾。
- 影响范围：`src/agent/background-agent-runner.ts` 现在会避开“仅说明输出文件已写入”的尾句，优先保留前面更有用的答案；同时在 run 成功后扫描 workspace 的 `output/` 目录，把实际产物写入 `conn_run_files`，让 run 详情里的输出文件索引和后台生成物对齐。`test/background-agent-runner.test.ts` 增加结果抽取和 output 文件索引回归。
- 对应入口：[src/agent/background-agent-runner.ts](/E:/AII/ugk-pi/src/agent/background-agent-runner.ts)、[test/background-agent-runner.test.ts](/E:/AII/ugk-pi/test/background-agent-runner.test.ts)、[docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground conn/activity 运行时控制器拆分
- 日期：2026-04-22
- 主题：继续把 `src/ui/playground.ts` 里的 conn / 全局活动前端运行时代码拆出去，把创建 / 编辑、管理器、全局活动、run 详情、API 拉取和事件绑定集中到独立控制器片段里。之前这个文件已经涨到离谱，再继续硬塞，后面每改一次 UI 都像在拆炸弹。
- 影响范围：新增 `src/ui/playground-conn-activity-controller.ts`，承接浏览器内联脚本里的 conn/activity 常量、DOM 引用、编辑器逻辑、API helper、渲染函数和事件绑定；`src/ui/playground.ts` 只保留主页面拼装入口并通过模板片段注入这些脚本。外部 DOM id、接口路径、弹层结构和用户交互不变。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)、[src/ui/playground-conn-activity.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### Playground conn/activity 静态片段拆分
- 日期：2026-04-22
- 主题：把 `playground` 里继续膨胀的 conn / 全局活动静态 UI 片段先拆出主文件，避免 `src/ui/playground.ts` 继续把样式、弹窗 HTML、运行时脚本和业务状态全搅在一起。
- 影响范围：新增 `src/ui/playground-conn-activity.ts`，承接后台任务过程弹层样式、后台任务管理 / 编辑 / 全局活动样式，以及对应弹窗 HTML；`src/ui/playground.ts` 保留运行时脚本、共享文件 / 资产样式和模块调用入口。外部页面结构、DOM id、接口调用和用户交互不变。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[src/ui/playground-conn-activity.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### Conn 路由解析收口与编辑校验补齐
- 日期：2026-04-22
- 主题：把 `POST /v1/conns` 与 `PATCH /v1/conns/:connId` 里重复的 payload 解析收成一套，并补上编辑接口对空白 `title / prompt` 的显式校验，避免传了空白值却被路由悄悄当成“没改”吞掉。
- 影响范围：`src/routes/conns.ts` 新增统一的 conn mutation 解析逻辑，创建与编辑共享 `title / prompt / target / schedule / assetRefs / runtime policy / maxRunMs` 校验；创建继续支持按当前服务端会话补默认目标；编辑在显式传入空白 `title` 或 `prompt` 时返回 `400`；`test/server.test.ts` 新增 PATCH 回归用例；`docs/runtime-assets-conn-feishu.md` 同步接口口径。
- 对应入口：[src/routes/conns.ts](/E:/AII/ugk-pi/src/routes/conns.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### Conn 列表与活动口径收口
- 日期：2026-04-22
- 主题：继续给 conn 管理界面减负，把后台任务列表和全局活动里的机器口径收成用户能直接读懂的人话，同时顺手清理 `playground` 里 conn 渲染辅助函数的职责边界。
- 影响范围：`src/ui/playground.ts` 为 conn 状态、run 状态、执行方式、结果目标和运行节奏补统一的说明函数；后台任务列表改成 `结果发到 / 执行方式 / 运行节奏` 三行摘要；最近 run 与全局活动里的 `source / conversation / files` 也改成中文口径；`test/server.test.ts` 锁定新 helper 和页面文案；`docs/playground-current.md` 同步当前交互事实。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Conn 每日执行时间校验修复
- 日期：2026-04-22
- 主题：修复 conn 创建 / 编辑里 `每日执行` 明明填了 `09:00` 仍然报“请填写每日执行时间”的问题；根因不是用户没填，而是 `playground` 内联脚本模板把正则里的 `\d`、`\s` 转义吃掉了，浏览器实际执行到的是失效正则。
- 影响范围：`src/ui/playground.ts` 修正 `parseConnCronExpression()`、`parseConnTimeOfDay()` 以及相关脚本里的正则转义，`每日执行时间` 现在兼容 `HH:mm` 和 `HH:mm:ss`；`test/server.test.ts` 与类型检查继续通过；文档同步补齐当前口径。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Conn 创建表单降噪
- 日期：2026-04-22
- 主题：这是当天早些时候的一版中间探索，目标是先把 conn 创建 / 编辑界面从“工程控制台”收成常用优先的产品表单。
- 影响范围：当时尝试过 `conn-editor-schedule-preset`、`conn-editor-schedule-details`、`applyConnSchedulePreset()` 和 `updateConnEditorComplexity()` 这套快捷调度入口；这套口径后来没有保留，已在同日被更晚的“三种调度模式”实现替代。保留这条记录只是为了追溯当天演进路径，不代表当前界面事实。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### Conn 表单字段人话化
- 日期：2026-04-22
- 主题：把 conn 创建 / 编辑表单里过于工程化的字段改成用户意图文案，避免 `profileId / agentSpecId / skillSetId / modelPolicyId / assetRefs` 这类内部术语直接砸到使用者脸上。
- 影响范围：`src/ui/playground.ts` 把 `任务提示词` 改成 `让它做什么`、把 `目标` 改成 `结果发到哪里`，并把高级区改成 `高级设置`；其中 `profileId / agentSpecId / skillSetId / modelPolicyId / upgradePolicy / maxRunMs / assetRefs` 在前台分别显示为 `任务身份 / 执行模板 / 能力包 / 模型策略 / 版本跟随方式 / 最长等待时长（秒） / 附加资料`，同时补充简短解释；`test/server.test.ts` 增加文案与辅助函数断言；文档同步更新。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### Conn 触发时间配置收口成人话调度器
- 日期：2026-04-22
- 主题：这是当天早些时候的一版时间配置探索，曾尝试把调度规则扩成六种人话模式。
- 影响范围：当时前端短暂出现过 `一次 / 每隔一段时间 / 每天固定时间 / 工作日固定时间 / 每周固定时间 / Conn 定时表达式` 六种规则；这套交互后来没有保留，已在同日被更晚的 `定时执行 / 间隔执行 / 每日执行` 三种模式替代。保留这条记录用于追溯，不代表当前界面事实。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### Conn 管理器批量清理与硬删除收口
- 日期：2026-04-22
- 主题：把后台任务管理器从单条删除补齐到可筛选、可多选、可批量删除，并让硬删除同步清理对应 notification / activity，避免测试 conn 删了但全局活动里还残留点不开的旧引用。
- 影响范围：`src/routes/conns.ts` 新增 `POST /v1/conns/bulk-delete`；`src/agent/conn-sqlite-store.ts` 新增 `deleteMany()`，单条 / 批量删除都会清理 `conversation_notifications` 与 `agent_activity_items` 中 `source=conn` 的对应记录；`src/ui/playground.ts` 新增状态筛选、选择当前、清空选择、删除所选和选择计数；`test/server.test.ts`、`test/conn-sqlite-store.test.ts` 补齐回归；文档同步当前硬删除口径。
- 对应入口：[src/routes/conns.ts](/E:/AII/ugk-pi/src/routes/conns.ts)、[src/agent/conn-sqlite-store.ts](/E:/AII/ugk-pi/src/agent/conn-sqlite-store.ts)、[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[test/conn-sqlite-store.test.ts](/E:/AII/ugk-pi/test/conn-sqlite-store.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### Conn 管理器补删除入口
- 日期：2026-04-22
- 主题：给 playground 后台任务管理器补 `删除` 操作，用二次确认调用已有 `DELETE /v1/conns/:connId`，方便清理测试创建的 conn。
- 影响范围：`src/ui/playground.ts` 新增 `deleteConn(conn)`、危险按钮样式和删除后列表移除 / notice 反馈；`test/server.test.ts` 增加页面断言和 `DELETE /v1/conns/:connId` 路由断言；文档明确当前删除是硬删除，会级联清理该 conn 的 run / event / file 记录。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[src/routes/conns.ts](/E:/AII/ugk-pi/src/routes/conns.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### Conn 目标归属可视化与管理器减负
- 日期：2026-04-22
- 主题：在 conn 创建 / 编辑链路里直接展示投递目标、目标 ID 和跨会话观察口径；保存成功后高亮对应 conn，并把最近 run 历史默认折叠，避免后台任务管理面继续堆成日志墙。
- 影响范围：`src/ui/playground.ts` 新增 `conn-editor-target-preview`、`conn-manager-notice`、目标描述辅助函数、保存后高亮反馈和折叠 run 摘要；`test/server.test.ts` 增加页面断言；`docs/playground-current.md` 与 `docs/runtime-assets-conn-feishu.md` 同步口径。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### Conn 创建 / 编辑 UI 与 playground 前端减负
- 日期：2026-04-22
- 主题：把后台任务管理从“只能看和手动执行”推进到可在 playground 里创建 / 编辑 conn，同时按前端性能报告收口首屏工具堆叠、发送前串行预检、输入重算、页面恢复重复请求、滚动和本地缓存写入等问题。
- 影响范围：`src/ui/playground.ts` 新增 `conn-editor-dialog` / `conn-editor-form`、`POST /v1/conns` / `PATCH /v1/conns/:connId` 提交流程、桌面 landing 顶部紧凑工具栏、layout / resume / scroll / localStorage 调度合并；`test/server.test.ts` 增加 conn editor 与性能减负断言；`docs/playground-current.md` 与 `docs/runtime-assets-conn-feishu.md` 同步当前口径。
- 对应入口：[src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)、[test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)、[docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)、[docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### Conn 失败终态也回投 notification
- 日期：2026-04-22
- 主题：让后台 conn run 在 `failed` / `cancelled` 等终态也向目标 conversation 写入 notification，避免超时或模型失败时前台只看到 run 记录、收不到正文反馈。
- 影响范围：`src/workers/conn-worker.ts` 的通知出口从“仅 succeeded”收口为“所有可交付终态”；失败通知标题为 `<conn title> failed`，正文优先使用 `errorText`；stale run 回收失败也会按目标 conversation 回投；`test/conn-worker.test.ts` 覆盖普通失败与 `maxRunMs` 超时失败的持久化通知和实时广播。
- 对应入口：`src/workers/conn-worker.ts`、`test/conn-worker.test.ts`、`docs/runtime-assets-conn-feishu.md`

## 2026-04-21

### Conn 默认投递目标跟随当前会话
- 主题：把 `POST /v1/conns` 从“必须手填 `target.conversationId` 才知道结果发到哪”收口为“未传 `target` 时自动绑定服务端当前会话”，避免后台任务继续把结果投到历史示例里的固定会话上。
- 影响范围：
  - `src/routes/conns.ts` 新增创建时的默认目标解析；当请求未传 `target` 时，路由会向上游取 `currentConversationId` 并写成 `{ type: "conversation", conversationId }`，显式传入 `conversation` / `feishu_chat` / `feishu_user` 目标时保持原有行为不变。
  - `src/server.ts` 把 `AgentService.getConversationCatalog()` 暴露出来给 conn 路由读取当前会话，避免 conn 路由自己重复碰会话索引。
  - `test/server.test.ts` 新增回归测试，锁定“未传 `target` 默认跟随当前会话”的行为，并保留显式 `target` 与 `cron.timezone` / runtime id 的既有兼容性。
  - `src/config.ts`、`src/agent/conn-db.ts` 与 `docker-compose.yml` 给本地 Docker 新增 `CONN_DATABASE_PATH` + named volume `ugk-pi-conn-db` 口径，并在首次切换路径时自动从 legacy `.data/agent/conn/conn.sqlite` 迁移旧库，绕开 Docker Desktop bind mount 下多进程 SQLite 打开失败的问题。
  - `docker-compose.yml` 与 `docker-compose.prod.yml` 为 `ugk-pi-conn-worker` 显式关闭继承自镜像层的 HTTP `HEALTHCHECK`，避免后台 worker 因没有 `/healthz` 入口被误判成 `unhealthy`。
  - `README.md`、`docs/runtime-assets-conn-feishu.md` 同步更新接口口径，明确 `POST /v1/conns` 的默认目标规则。
- 对应入口：
  - [src/routes/conns.ts](/E:/AII/ugk-pi/src/routes/conns.ts)
  - [src/server.ts](/E:/AII/ugk-pi/src/server.ts)
  - [src/config.ts](/E:/AII/ugk-pi/src/config.ts)
  - [src/agent/conn-db.ts](/E:/AII/ugk-pi/src/agent/conn-db.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [test/conn-db.test.ts](/E:/AII/ugk-pi/test/conn-db.test.ts)
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### Conn SQLite 并发写锁收口
- 主题：修复独立 `conn-worker` 执行后台任务时，写入 `conn_run_events` 偶发触发 `database is locked`，导致 run 卡在 `running` 的问题。
- 影响范围：
  - `src/agent/conn-db.ts` 在 SQLite 连接初始化时统一启用 `PRAGMA journal_mode = WAL`、`PRAGMA synchronous = NORMAL`、`PRAGMA foreign_keys = ON` 与 `PRAGMA busy_timeout = 5000`，把前台 API 和后台 worker 的多进程并发写入口径收成适合 Docker / Windows / macOS / Linux 共用的默认配置。
  - `test/conn-db.test.ts` 新增回归测试，锁定 `journal_mode=wal` 与 `busy_timeout=5000`，避免后续有人把数据库重新改回单写者心态。
- 对应入口：
  - [src/agent/conn-db.ts](/E:/AII/ugk-pi/src/agent/conn-db.ts)
  - [test/conn-db.test.ts](/E:/AII/ugk-pi/test/conn-db.test.ts)

### Conn Notification 正文只保留可见内容
- 主题：修复后台 conn 完成通知把 assistant `thinking` / `toolCall` 结构一并塞进 `resultText`，导致前台 notification 开头出现 JSON 垃圾的问题。
- 影响范围：
  - `src/agent/background-agent-runner.ts` 的结果提取逻辑改为只保留 assistant 的可见 `text` 内容；`thinking`、`toolCall` 等内部结构不再进入 `resultSummary` / `resultText`。
  - `test/background-agent-runner.test.ts` 新增结构化 assistant 内容回归测试，锁定后台 run 结果只能持久化用户可见正文。
- 对应入口：
  - [src/agent/background-agent-runner.ts](/E:/AII/ugk-pi/src/agent/background-agent-runner.ts)
  - [test/background-agent-runner.test.ts](/E:/AII/ugk-pi/test/background-agent-runner.test.ts)

### Conn Notification Playground 闭环
- 主题：把后台 conn notification 在 playground 里真正做成可追溯闭环，而不是只弹一条“任务完成”就算完事。
- 影响范围：
  - `src/ui/playground.ts` 新增 conn run 详情弹层、消息底部“查看后台任务过程”入口，以及 run 详情 / 事件接口拉取逻辑。
  - 前端历史快照现在会保留 notification 的 `source`、`sourceId`、`runId`，刷新后仍能继续打开 conn run 详情，不再出现“刚看到能点，刷新就失忆”的半残状态。
  - `src/agent/agent-service.ts` / `src/types/api.ts` 已把 notification 元数据透到 `GET /v1/chat/state` 的消息体里。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/types/api.ts](/E:/AII/ugk-pi/src/types/api.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)

### Conn Cron 时区与运行时索引入口
- 主题：补齐 conn 创建链路里真正影响生产行为的两个缺口：`cron.timezone` 和 runtime profile/spec/skill/model policy 索引字段。
- 影响范围：
  - `src/agent/conn-store.ts` / `src/agent/conn-sqlite-store.ts` 现在支持 `cron.timezone`，并在落库时校验 IANA 时区；未显式传入时会固化当前运行环境的时区，避免“每天早上 9 点”跟着容器时区漂移。
  - `src/routes/conns.ts` 现已支持 `profileId`、`agentSpecId`、`skillSetId`、`modelPolicyId`、`upgradePolicy` 的创建 / 更新入参。
  - `README.md`、`docs/runtime-assets-conn-feishu.md`、`docs/traceability-map.md` 同步更新排查与接口口径。
- 对应入口：
  - [src/agent/conn-store.ts](/E:/AII/ugk-pi/src/agent/conn-store.ts)
  - [src/agent/conn-sqlite-store.ts](/E:/AII/ugk-pi/src/agent/conn-sqlite-store.ts)
  - [src/routes/conns.ts](/E:/AII/ugk-pi/src/routes/conns.ts)
  - [src/types/api.ts](/E:/AII/ugk-pi/src/types/api.ts)
  - [test/conn-store.test.ts](/E:/AII/ugk-pi/test/conn-store.test.ts)
  - [test/conn-sqlite-store.test.ts](/E:/AII/ugk-pi/test/conn-sqlite-store.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)

### Conn Run 查询 API
- 主题：补齐后台 conn run 的可观测 HTTP 接口，让前台和排障流程能读取 run 历史、单次详情、输出文件索引和过程事件。
- 影响范围：
  - `src/routes/conns.ts` 新增 `GET /v1/conns/:connId/runs`、`GET /v1/conns/:connId/runs/:runId`、`GET /v1/conns/:connId/runs/:runId/events`。
  - `src/types/api.ts` 新增 conn run list/detail/events/files 响应体类型。
  - run 详情和事件查询会校验 `run.connId`，run 不属于路径中的 conn 时返回 `404`。
  - `README.md` 与 `docs/runtime-assets-conn-feishu.md` 同步记录新接口。
- 对应入口：
  - [src/routes/conns.ts](/E:/AII/ugk-pi/src/routes/conns.ts)
  - [src/types/api.ts](/E:/AII/ugk-pi/src/types/api.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### Conn 旧前台调度链路退场
- 主题：把旧的进程内 `ConnScheduler` / `ConnRunner` / JSON `ConnStore` 运行链路移除，正式切到“前台写 run，后台 worker 执行”的 conn 架构。
- 影响范围：
  - `src/server.ts` 不再创建或启动前台 `ConnScheduler`，默认使用 `ConnDatabase`、`ConnSqliteStore`、`ConnRunStore` 和 `ConversationNotificationStore`。
  - `src/routes/conns.ts` 的 `POST /v1/conns/:connId/run` 改为创建 `pending` run 并返回 `202`，不再同步调用前台 agent。
  - `src/workers/conn-worker.ts` 增加独立 CLI 入口；`package.json` 新增 `npm run worker:conn`；compose 新增无公网端口的 `ugk-pi-conn-worker` 服务，共用 `/app/.data/agent` 持久化目录。
  - 删除 `src/agent/conn-scheduler.ts` 与 `src/agent/conn-runner.ts`，`src/agent/conn-store.ts` 只保留 conn 类型和调度时间计算函数。
  - `docs/runtime-assets-conn-feishu.md`、`docs/traceability-map.md` 与 `AGENTS.md` 同步改为新的 SQLite / worker 排查入口。
- 对应入口：
  - [src/server.ts](/E:/AII/ugk-pi/src/server.ts)
  - [src/routes/conns.ts](/E:/AII/ugk-pi/src/routes/conns.ts)
  - [src/workers/conn-worker.ts](/E:/AII/ugk-pi/src/workers/conn-worker.ts)
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)

### Conn 后台 agent 持久化地基
- 主题：为新的独立 `conn-worker` 架构落下第一批跨平台持久化地基；当前先新增基础设施，不切换现有前台 `/v1/conns` 运行链路。
- 影响范围：
  - 新增 `node:sqlite` 版 `ConnDatabase`，初始化 `conns`、`conn_runs`、`conn_run_events`、`conn_run_files`、`conversation_notifications` 等表；不引入 `better-sqlite3` / `sqlite3` 这类 native npm 依赖，降低 Windows / macOS / Linux 经 Docker 部署时的编译适配风险。
  - 新增 `ConnSqliteStore`，conn definition 开始具备 `profileId`、`agentSpecId`、`skillSetId`、`modelPolicyId`、`upgradePolicy` 等运行时索引字段，为后台 agent 按 ID 解析当前规范和 skills 做准备。
  - 新增 `ConnRunStore`，支持 pending/running/succeeded/failed run 记录、worker lease claim、lease 过期恢复领取、事件日志、输出文件索引，并在 run 完成后回写 conn 的 `lastRunAt` / `nextRunAt` / `lastRunId`。
  - 新增 `BackgroundWorkspaceManager`，每次 run 创建独立 `input/`、`work/`、`output/`、`logs/`、`session/` 和 `manifest.json`，并把 `assetRefs` 快照到 `input/`，避免复杂任务互相覆盖中间文件。
  - 新增 `BackgroundAgentProfileResolver`，按 `profileId / agentSpecId / skillSetId / modelPolicyId` 解析运行时 snapshot；默认 skill set version 由实际 skill 内容 hash 得出，便于追溯后台 run 当时用的是哪套能力。
  - 新增 `BackgroundAgentRunner`，后台 run 使用独立 session factory、独立 workspace 和 run event log；成功/失败都写回 `conn_runs`，不调用前台 `AgentService.chat()`。
  - 新增 `ConversationNotificationStore` 和 `ConnWorker`，worker tick 会把 due conn 变成 run、通过 lease 领取执行，成功后向目标 conversation 写入幂等 notification。
  - `AgentService.getConversationState()` 支持合并后台 notification 为 `kind=notification` 的前台消息，但 `getConversationHistory()` 仍只返回真实 pi session history，避免后台结果污染前台 LLM 上下文。
- 对应入口：
  - [src/agent/conn-db.ts](/E:/AII/ugk-pi/src/agent/conn-db.ts)
  - [src/agent/conn-sqlite-store.ts](/E:/AII/ugk-pi/src/agent/conn-sqlite-store.ts)
  - [src/agent/conn-run-store.ts](/E:/AII/ugk-pi/src/agent/conn-run-store.ts)
  - [src/agent/background-workspace.ts](/E:/AII/ugk-pi/src/agent/background-workspace.ts)
  - [src/agent/background-agent-profile.ts](/E:/AII/ugk-pi/src/agent/background-agent-profile.ts)
  - [src/agent/background-agent-runner.ts](/E:/AII/ugk-pi/src/agent/background-agent-runner.ts)
  - [src/agent/conversation-notification-store.ts](/E:/AII/ugk-pi/src/agent/conversation-notification-store.ts)
  - [src/workers/conn-worker.ts](/E:/AII/ugk-pi/src/workers/conn-worker.ts)
  - [test/conn-db.test.ts](/E:/AII/ugk-pi/test/conn-db.test.ts)
  - [test/conn-sqlite-store.test.ts](/E:/AII/ugk-pi/test/conn-sqlite-store.test.ts)
  - [test/conn-run-store.test.ts](/E:/AII/ugk-pi/test/conn-run-store.test.ts)
  - [test/background-workspace.test.ts](/E:/AII/ugk-pi/test/background-workspace.test.ts)
  - [test/background-agent-profile.test.ts](/E:/AII/ugk-pi/test/background-agent-profile.test.ts)
  - [test/background-agent-runner.test.ts](/E:/AII/ugk-pi/test/background-agent-runner.test.ts)
  - [test/conversation-notification-store.test.ts](/E:/AII/ugk-pi/test/conversation-notification-store.test.ts)
  - [test/conn-worker.test.ts](/E:/AII/ugk-pi/test/conn-worker.test.ts)

### 生产 agent 数据持久化挂载
- 主题：修复生产增量更新重建 `ugk-pi` 容器后，playground 历史会话、session 与资产索引不持久的问题。
- 影响范围：
  - `docker-compose.prod.yml` 为 app 容器新增 `${UGK_AGENT_DATA_DIR:-./.data/agent}:/app/.data/agent` bind mount，避免 `conversation-index.json`、`sessions/`、`asset-index.json`、`conn/` 等状态继续落在容器可写层。
  - `.env.example`、`docs/tencent-cloud-singapore-deploy.md` 与 `docs/server-ops-quick-reference.md` 补充 `UGK_AGENT_DATA_DIR` 口径，服务器应指向 `~/ugk-claw-shared/.data/agent`。
  - `AGENTS.md` 更新稳定事实：生产运行态外置不只包括 Chrome 登录态，还包括 agent 会话数据；更新后历史消失时先查 mount 和 compose env。
  - `test/containerization.test.ts` 增加回归断言，防止生产 compose 再丢 agent 数据挂载。
- 对应入口：
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [.env.example](/E:/AII/ugk-pi/.env.example)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

### 近期改动文档补全
- 主题：把最近几轮 UI 与 runtime 修复补进接手文档，避免后续 agent 只看旧索引又走回头路。
- 影响范围：
  - `AGENTS.md` 补充 active transcript 底部滚动缓冲的稳定事实，明确不要把 `--transcript-bottom-scroll-buffer` 当成多余 padding 删除。
  - `docs/traceability-map.md` 在 playground 前端排查索引中补充“底部 composer 遮挡最后一条消息 / active transcript 滚动缓冲”场景。
  - `docs/web-access-browser-bridge.md` 更新时间改为 `2026-04-21`，并在关键文件里补充 `src/agent/browser-cleanup.ts` 与 `src/agent/agent-service.ts`。
- 对应入口：
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)

### Playground 对话底部滚动缓冲
- 主题：修复手机端对话最后一屏被底部 composer 遮挡、无法继续上拖查看的问题。
- 影响范围：
  - `src/ui/playground.ts` 新增 `--transcript-bottom-scroll-buffer`，并在 active 对话态给 `.transcript-current` 增加底部 padding；手机端按 `safe-area-inset-bottom` 放大缓冲。
  - `test/server.test.ts` 增加 `/playground` 回归断言，锁住滚动容器底部缓冲、`scroll-padding-bottom` 与手机端覆盖值。
  - `docs/playground-current.md` 同步记录 active transcript 底部滚动余量约束。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 刷新后连续助手消息合并
- 主题：修复已完成任务刷新后，同一轮 assistant 处理过程从一个回复气泡散成多条“助手”气泡的问题。
- 影响范围：
  - `src/agent/agent-service.ts` 将连续的 assistant session messages 合并为一条 canonical history message，并让 `GET /v1/chat/state` 与 `GET /v1/chat/history` 使用同一套合并规则。
  - `test/agent-service.test.ts` 增加回归测试，覆盖一轮用户请求后连续多条 assistant 消息恢复为一条助手回复的场景。
  - `AGENTS.md` 与 `docs/playground-current.md` 同步记录刷新恢复口径：同一轮完成后的浏览器处理叙述和最终回答不能拆成多条气泡。
- 对应入口：
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Agent 任务结束自动清理 web-access 浏览器页面
- 主题：把服务器运行容器里的临时热改正式落回主仓库，修复 `web-access` 在 agent scope 下保留的浏览器页面不会随任务结束自动关闭的问题。
- 影响范围：
  - 新增 `src/agent/browser-cleanup.ts`，按 `CLAUDE_AGENT_ID` / `CLAUDE_HOOK_AGENT_ID` / `agent_id` 解析 agent scope，并调用 `POST /session/close-all?metaAgentScope=...` 清理该 scope 下的浏览器 target。
  - `src/agent/agent-service.ts` 在 `runChat` 的 `finally` 中 best-effort 调用 `closeBrowserTargetsForScope(undefined)`，正常完成、错误和中断都会进入清理；清理失败只 warn，不覆盖原任务结果。
  - `test/browser-cleanup.test.ts` 覆盖 scope 解析、无 scope 跳过、代理请求、代理失败和 proxy 配置错误不抛错；`test/agent-service.test.ts` 覆盖 chat 结束后触发 scoped cleanup。
  - `AGENTS.md`、`docs/web-access-browser-bridge.md`、`docs/traceability-map.md` 同步记录任务结束清理口径，并明确不要只在运行容器 `/app` 热改。
- 对应入口：
  - [src/agent/browser-cleanup.ts](/E:/AII/ugk-pi/src/agent/browser-cleanup.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [test/browser-cleanup.test.ts](/E:/AII/ugk-pi/test/browser-cleanup.test.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)

### Playground 手机历史抽屉右侧遮罩去模糊
- 主题：手机历史会话侧边栏展开后，右侧不再显示暗色毛玻璃背景，只保留透明点击遮罩用于关闭抽屉。
- 影响范围：
  - `src/ui/playground.ts` 将 `.mobile-drawer-backdrop` 改为 `background: transparent` 与 `backdrop-filter: none`，移除右侧区域的暗色和模糊效果。
  - `test/server.test.ts` 增加移动抽屉 backdrop 透明、无 blur 的回归断言。
  - `docs/playground-current.md` 同步更新手机历史会话抽屉遮罩口径。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 手机侧边栏与输入框视觉收口
- 主题：把手机历史会话侧边栏条目圆角收为 `4px`，隐藏列表侧边滚动条，并让 composer 输入框 placeholder / 正文在单行状态下视觉居中。
- 影响范围：
  - `src/ui/playground.ts` 将 `.mobile-conversation-item` 从 `14px` 圆角改为 `4px`，与手机端统一矩形圆角口径一致。
  - `src/ui/playground.ts` 为 `.mobile-conversation-list` 增加 `scrollbar-width: none`、`-ms-overflow-style: none` 和 WebKit scrollbar 隐藏规则，保留纵向滚动但不显示侧边滑动条。
  - `src/ui/playground.ts` 将手机 active textarea 调整为 `44px` 高度下的 `12px 0` 对称 padding，landing textarea 调整为 `40px` 高度下的 `10px 0` padding，并同步 max-height 计算，避免 placeholder 和正文偏上。
  - `test/server.test.ts` 增加历史会话列表圆角、滚动条隐藏、textarea 对称 padding 与最大高度计算的回归断言。
  - `docs/playground-current.md` 同步更新手机侧边栏和输入框视觉口径。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 消息复制 icon 视觉降噪
- 主题：把消息气泡底部的小型复制 icon 改成灰色裸 icon，不再显示按钮背景、边框或阴影。
- 影响范围：
  - `src/ui/playground.ts` 将 `.message-copy-button` 改为透明背景、`border: 0`、`box-shadow: none`，基础色收为灰色，并覆盖 hover / focus 状态，避免全局按钮样式重新冒出底色和边框。
  - `src/ui/playground.ts` 将复制 icon 伪元素的前景纸张背景改为透明，只保留灰色线条图形。
  - `test/server.test.ts` 增加复制按钮透明背景、无边框、无阴影、灰色 icon 和 hover / focus 覆盖的回归断言。
  - `docs/playground-current.md` 同步更新消息复制操作的真实 UI 口径。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

## 2026-04-20

### Playground 消息复制按钮改为小型 icon
- 主题：把消息气泡底部的“复制正文”文字按钮收口成小型复制 icon，并让操作区纵向更贴近消息气泡。
- 影响范围：
  - `src/ui/playground.ts` 将 `.message-actions` 的顶部间距从 `10px` 收到 `4px`，减少消息气泡和复制操作之间的空档。
  - `src/ui/playground.ts` 将 `.message-copy-button` 改为 `26px` icon-only 按钮，手机端收为 `24px`；复制图形由 CSS 伪元素绘制。
  - `src/ui/playground.ts` 保留 `aria-label`、`title` 和 `.visually-hidden` 文本，复制成功 / 失败时更新无障碍提示，不再用可见文字撑开按钮。
  - `test/server.test.ts` 增加 icon-only 复制按钮、尺寸、间距和无障碍文本的回归断言。
  - `docs/playground-current.md` 同步更新消息复制操作的真实 UI 口径。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 输入框 placeholder 中文化
- 主题：把 composer 输入框运行时覆盖的英文占位符 `Enter terminal command or query neural core...` 改为中文“和我聊聊吧”。
- 影响范围：
  - `src/ui/playground.ts` 同步更新 textarea HTML placeholder 和脚本初始化 placeholder，避免加载前后文案不一致。
  - `test/server.test.ts` 增加回归断言，防止英文调试口吻再次回流。
  - `docs/playground-current.md` 同步记录当前 placeholder 口径。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 空态方块 UGK 与移动输入框纯色背景
- 主题：把手机空态中间的 `UGK` 标识从普通字母字符改成方块字符拼出的像素标识，并把移动端底部 composer 背景从渐变收成单层纯色。
- 影响范围：
  - `src/ui/playground.ts` 更新 idle transcript 伪元素内容，使用 `■` 方块字符组成 `UGK`。
  - `src/ui/playground.ts` 将 `max-width: 640px` 下普通 `.composer` 与 landing `.composer` 背景改为 `rgba(8, 10, 19, 0.98)`，移除这两处 `linear-gradient`。
  - `test/server.test.ts` 增加方块字符标识与移动端 composer 背景纯色的回归断言。
  - `docs/playground-current.md` 同步更新手机空态和底部 composer 背景口径。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 输入框十行自适应与空态 UGK 标识
- 主题：把底部输入框从“最多两行且不好查看超出内容”的旧表现，改为随输入行数自适应增长，最多显示 10 行；超过 10 行后在 textarea 内部纵向滚动。同时移除手机空态中间的中文提示方块，改为像素字符 `UGK` 标识。
- 影响范围：
  - `src/ui/playground.ts` 为 composer textarea 增加 `--composer-textarea-max-lines: 10`，桌面、landing 与手机断点统一按行高 + padding 计算最大高度，并保留紧凑初始高度。
  - `src/ui/playground.ts` 新增 `syncComposerTextareaHeight()`，在输入、清空、草稿恢复和初始化时同步 textarea 实际高度；超过 10 行后切换为 `overflow-y: auto`，未超过时隐藏内部滚动条。
  - `src/ui/playground.ts` 将手机 idle transcript 的旧中文提示替换为 `UGK` 像素字符伪元素，使用等宽字体和 `white-space: pre` 保持字符图形。
  - `test/server.test.ts` 增加输入框 10 行自适应、内部滚动、landing/mobile 最大高度与空态 `UGK` 标识的回归断言。
  - `docs/playground-current.md` 同步更新当前输入框高度与手机空态展示口径。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground active 输入区高度收口
- 主题：修复进入对话后 `#composer-drop-target.composer` 仍沿用偏高 textarea 高度，导致底部输入区在手机、窄屏和普通对话态下占据过多屏幕的问题。
- 影响范围：
  - `src/ui/playground.ts` 进一步收口 landing 空态的 `.shell[data-stage-mode="landing"] .composer`：padding 改为 `6px 8px 6px 10px`，textarea 固定 `40px`，发送 / 打断按钮最小高度改为 `40px`，避免底部输入面板继续按大块卡片展示。
  - Landing composer 外壳新增 `align-self: end`、`height: fit-content`、`max-height: 64px`，并让 `command-deck` 使用 `grid-auto-rows: max-content` / `align-content: end`，防止手机 grid 把 `section#composer-drop-target` 拉伸成接近半屏高度。
  - Landing 空态的 `command-deck` 间距、底部 margin 和 context usage 行高度同步压缩，减少输入框外围空间继续制造“底部很高”的视觉问题。
  - `src/ui/playground.ts` 将 active 对话态基础 `.composer` padding、间距和 textarea 高度整体收口；普通对话 textarea 从 `min-height: 128px` / `max-height: 28vh` 改为 `72px` / `18vh`，并禁用手动竖向 resize。
  - `max-width: 960px` 下 `.composer-side` 改为两列横排，避免发送 / 打断按钮掉到输入框下方继续撑高底部区域。
  - `max-width: 640px` 下为普通 `.composer`、`.composer-main`、`.composer-header`、`.composer textarea` 和 `.composer-side` 增加更紧凑约束；active 对话态不再只吃桌面基础高度。
  - 手机端 active 对话态 textarea 最小高度收口为 `44px`、最大高度收口为 `96px`，并禁用手动竖向 resize，避免输入区继续挤压 transcript。
  - `test/server.test.ts` 增加回归断言，固定默认和手机端 active composer 的紧凑 CSS 入口，防止后续只修 landing 空态或只修单一断点。
  - `docs/playground-current.md` 同步记录当前 active 输入区高度口径。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 切换为单工人多会话模型
- 主题：把 `playground` 从固定 `agent:global` + reset 旧会话，切到“一个 agent、多条历史会话、一个全局当前会话”的模型；新会话是真正新建会话，旧会话保留为历史。
- 影响范围：
  - `src/agent/conversation-store.ts` 的会话索引升级为 `{ currentConversationId, conversations }`，并兼容旧的平铺索引格式。
  - `src/agent/agent-service.ts` 新增会话目录、新建会话、切换当前会话能力；运行中拒绝新建和切换，确保一个 agent 同时只在一条产线上工作。
  - `src/routes/chat.ts` 新增 `GET /v1/chat/conversations`、`POST /v1/chat/conversations`、`POST /v1/chat/current`，`src/types/api.ts` 同步新增响应体类型。
  - `src/ui/playground.ts` 启动时先同步服务端当前会话；`新会话` 改为创建并激活新会话；手机端品牌区新增历史会话抽屉，点击历史项后切换全局当前会话；前端创建会话的 JSON POST 明确发送 `{}` body，避免 Fastify 把空 JSON 请求拦成 `FST_ERR_CTP_EMPTY_JSON_BODY`。
  - `test/conversation-store.test.ts`、`test/agent-service.test.ts`、`test/server.test.ts` 覆盖新索引结构、单工人运行约束、会话目录接口和前端入口脚本。
  - `AGENTS.md`、`README.md`、`docs/playground-current.md`、`docs/traceability-map.md` 同步移除固定 `agent:global` 与 `POST /v1/chat/reset` 作为新会话主路径的旧口径。
- 对应入口：
  - [src/agent/conversation-store.ts](/E:/AII/ugk-pi/src/agent/conversation-store.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/conversation-store.test.ts](/E:/AII/ugk-pi/test/conversation-store.test.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 手机端顶部收口为品牌状态栏 + 溢出菜单
- 主题：把手机端顶部从常驻四按钮条收口成更薄的品牌状态栏，避免继续拿操作按钮堆满首屏高度；左侧恢复品牌识别，右侧只保留新会话和更多操作。
- 影响范围：
  - `src/ui/playground.ts` 的手机端顶部结构改为 `logo + UGK Claw + 新会话按钮 + 更多按钮`，并新增右上角溢出菜单承载 `技能 / 文件 / 文件库`
  - 手机端样式从旧的 `mobile-action-strip` 收口到 `mobile-topbar` / `mobile-overflow-menu`，把交互高度压回约 `48px` 的紧凑状态栏
  - `test/server.test.ts` 更新 `/playground` 页面断言，明确手机端真实结构是紧凑状态栏 + overflow actions，不再是四按钮常驻条
  - `public/ugk-claw-mobile-logo.png` 新增手机端品牌 logo 静态资源，避免把图片路径继续塞进内联代码里乱飞
  - `AGENTS.md`、`docs/playground-current.md`、`docs/traceability-map.md` 同步移除旧的“四按钮条”口径，改成当前真实约束
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [public/ugk-claw-mobile-logo.png](/E:/AII/ugk-pi/public/ugk-claw-mobile-logo.png)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### Playground 新会话改为服务端真重置
- 主题：修复点击 `新会话` 后只在前端清 DOM、插入本地提示气泡，结果刷新又被 `/v1/chat/state` 的真实历史打回去的问题。
- 影响范围：
  - `src/routes/chat.ts` 新增 `POST /v1/chat/reset`，由后端负责清空指定会话的 canonical state。
  - `src/agent/agent-service.ts` 新增 `resetConversation()`；空闲时删除会话映射，运行中则返回 `reason: "running"`，避免把还在执行的 active run 硬抹掉。
  - `src/agent/conversation-store.ts` 新增删除会话索引能力，让 `agent:global` 的新会话真正落到服务端状态，而不是仅靠前端本地假动作。
  - `src/ui/playground.ts` 的 `新会话` 按钮改为调用 `/v1/chat/reset` 后再按清空后的 `/v1/chat/state` 重绘；移除刷新后会消失的本地“当前启用新会话”提示气泡。
  - `test/agent-service.test.ts`、`test/server.test.ts` 增加回归断言，覆盖服务端 reset 和前端入口脚本。
  - `AGENTS.md`、`README.md`、`docs/traceability-map.md`、`docs/playground-current.md` 同步更新新会话语义与接口口径。
- 对应入口：
  - [src/agent/conversation-store.ts](/E:/AII/ugk-pi/src/agent/conversation-store.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)

### Playground 统一 agent 状态渲染
- 主题：把刷新、多浏览器和运行中任务展示收口到后端 canonical conversation state，避免前端继续把 history、status、events、localStorage 和 DOM 指针拼成多套状态。
- 影响范围：
  - `src/types/api.ts` 新增 `ConversationStateResponseBody`、`ChatActiveRunBody`、`ChatProcessBody` 等状态协议，明确 `messages + activeRun` 的统一渲染结构。
  - `src/agent/agent-service.ts` 在 active run 内维护可渲染 `view` 快照，随 `run_started`、`text_delta`、工具事件、队列、`done`、`interrupted`、`error` 更新同一份状态。
  - `src/routes/chat.ts` 新增 `GET /v1/chat/state`，返回全局会话历史、当前运行态、active assistant 正文、过程区、队列和上下文占用；旧 `/history`、`/status`、`/events` 保留兼容。
  - `src/ui/playground.ts` 刷新恢复改为优先消费 `/v1/chat/state` 并通过 `renderConversationState()` 渲染；本地 `process` 快照恢复和写回逻辑移除，SSE 只继续更新同一个 active assistant 气泡。
  - `test/agent-service.test.ts` 与 `test/server.test.ts` 增加 canonical state、路由和前端入口断言，防止同一 run 再被拆成多条助手过程消息。
  - `AGENTS.md`、`README.md`、`docs/traceability-map.md`、`docs/playground-current.md` 同步更新刷新恢复、运行态和 context usage 口径。
- 对应入口：
  - [src/types/api.ts](/E:/AII/ugk-pi/src/types/api.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 多前端终态一致性收口
- 主题：把 `error` / `interrupted` 也收进 canonical conversation state，顺手修掉断流恢复误报失败和重复 prompt 被观察页吞掉的边界问题，别再让不同前端各看各的平行宇宙。
- 影响范围：
  - `src/agent/agent-service.ts` 新增 terminal run snapshot；active run 结束后会把 `error` / `interrupted` 终态短期保留给刷新页和观察页，不再随着 `activeRuns` 清理一起蒸发。
  - `src/agent/agent-service.ts` 在 provider 失败时会先发 canonical `error` 事件，再抛给主流路由；主 `/v1/chat/stream` 和 `/v1/chat/events` 终于看到的是同一份失败语义，不再靠路由层偷偷补一条只有当前页能看到的 SSE。
  - `src/routes/chat.ts` 的 `/v1/chat/events` 不再把“当前已经不在运行”硬翻译成 `error` 事件；这类情况直接收流，让前端优先信 `/v1/chat/state` 的最终状态。
  - `src/ui/playground.ts` 断流恢复会先比较 canonical state 是否已经推进到终态；如果任务其实已经正常收口，就不再误报“流被中断 / 网络错误”。
  - `src/agent/agent-service.ts` 在生成 `messages + activeRun` 视图时会剔除尾部那条与 `activeRun.input.message` 重复的历史 user message，避免连续两轮都发“继续”时观察页把当前输入吞掉。
  - `src/types/api.ts` 给 `error` 事件补上 `conversationId`，让前端在失败收口时也能回源同步上下文占用和历史。
  - `test/agent-service.test.ts`、`test/server.test.ts` 增加回归断言，覆盖 canonical error 终态、interrupt 终态语义、重复 prompt 观察页渲染，以及刷新恢复时不误报失败的页面脚本入口。
- 对应入口：
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [src/types/api.ts](/E:/AII/ugk-pi/src/types/api.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 历史恢复过滤内部 prompt 协议
- 主题：修复刷新或重新打开 playground 后，从后端 session 恢复的用户历史消息会暴露 `<asset_reference_protocol>`、`<file_response_protocol>` 等内部 prompt 注入段的问题。
- 影响范围：
  - `src/agent/file-artifacts.ts` 新增内部 prompt 上下文剥离逻辑，统一移除 `<user_assets>`、`<asset_reference_protocol>`、`<file_response_protocol>` 这些只应给模型看的协议段。
  - `src/agent/agent-service.ts` 在 `GET /v1/chat/history` 还原用户消息时应用剥离逻辑，保留真实用户原文，不影响助手回复、工具过程和实际发送给模型的增强 prompt。
  - `test/agent-service.test.ts` 增加回归测试，覆盖“session 里存的是增强 prompt，但历史接口只返回用户原文”的场景。
  - `docs/playground-current.md` 同步记录历史恢复口径，避免后续把内部协议泄漏误认为正常历史内容。
- 对应入口：
  - [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 历史阅读时不强制滚底
- 主题：修复 playground 在最新对话流式更新时无条件自动滚到底部，导致用户上滑查阅历史被打断的问题。
- 影响范围：
  - `src/ui/playground.ts` 新增 transcript 跟随状态，只有用户停留在底部附近时才自动跟随 `text_delta`、loading 和过程日志更新。
  - 用户离开底部阅读历史时显示“回到底部”按钮，点击后强制回到底部并恢复自动跟随。
  - 初次恢复本地 / 服务端历史仍会强制定位到底部，避免打开页面时停在旧消息中段。
  - 补强前端验收口径：改完 `playground` 后不仅要跑测试，还要重启 `ugk-pi` 并确认 `3000/playground` 实际返回了新 HTML / JS 标记，避免拿旧页面误测。
  - `test/server.test.ts` 增加页面断言，固定滚动跟随阈值、按钮入口和事件绑定。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 全局 agent 会话与断线续订
- 主题：把 playground 从“每个浏览器各自持有本地 conversationId / 本地历史”收口为固定全局 agent 会话 `agent:global`，并修复手机前后台切换导致 `/v1/chat/stream` 断线后页面停止更新的问题。
- 影响范围：
  - `src/ui/playground.ts` 固定使用 `agent:global`，`conversation-id` 只展示全局 ID，不再从浏览器 `localStorage` 读取设备私有会话身份。
  - 新增 `GET /v1/chat/history`，由 `AgentService` 从 pi session messages 还原全局会话历史；新浏览器 / 新设备打开 playground 会先用本地缓存快速渲染，再从后端同步真实 agent 历史。
  - 当前任务运行中如果主 `/v1/chat/stream` 因手机后台、页面恢复或网络短断提前结束，前端会重新查询 `/v1/chat/status`；只要后端仍在 running，就切到 `/v1/chat/events` 继续订阅，不再把这种浏览器生命周期断线显示成任务失败。
  - `visibilitychange`、`pageshow` 和 `online` 会触发运行态 / 历史重查，让页面重新回到真实 agent 状态。
  - `test/server.test.ts` 增加全局会话、history 接口和 stream 断线续订的回归断言。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/types/api.ts](/E:/AII/ugk-pi/src/types/api.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### 本地 artifact 链接避免二次包裹
- 主题：修复 agent 回复里的 `/v1/local-file?path=...` 链接被用户可见文本重写器再次包裹，生成 `path=http://.../v1/local-file?path=...` 后打不开的问题。
- 影响范围：
  - `src/agent/file-artifacts.ts` 在重写 `/app/public/...`、`/app/runtime/...` 和 `file:///app/...` 时，会识别当前匹配是否已经位于 `/v1/local-file` 的 `path` 查询参数里，避免二次重写。
  - `src/routes/files.ts` 对历史上已经生成的双层 `/v1/local-file` URL 做兼容拆包，拆出内层真实 artifact 路径后仍按 `public/`、`runtime/` 白名单校验和服务。
  - `test/file-artifacts.test.ts` 增加“已翻译 local-file URL 不再二次包裹”的回归用例；`test/server.test.ts` 增加“双层 local-file URL 仍能打开”的回归用例。
  - `docs/runtime-assets-conn-feishu.md` 同步记录本地 artifact 链接重写与双层链接兜底口径。
- 对应入口：
  - [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
  - [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
  - [test/file-artifacts.test.ts](/E:/AII/ugk-pi/test/file-artifacts.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### Playground Markdown 渲染库化
- 主题：把 agent 回复 Markdown 从项目内手写解析器迁到 `marked`，避免表格、分割线等标准 Markdown 继续靠临时正则补洞。
- 影响范围：
  - `package.json` 新增 `marked` 依赖，`src/ui/playground.ts` 的 `renderPlaygroundMarkdown()` 改为使用 `marked` 的 GFM 渲染能力。
  - playground 浏览器端内联 `marked` 的 UMD 版本，避免单文件 HTML 前端在运行时依赖外部 CDN 或 Node import。
  - 仍然覆盖安全边界：原始 HTML 会被转义，链接只允许 `http/https`，并继续加 `target="_blank"` 与 `rel="noreferrer noopener"`。
  - playground 消息内容新增表格样式，表头、单元格、横向滚动和边框层次跟当前深色消息气泡保持一致；表格由外层滚动容器控制最大宽度，窄表按内容宽度展示，不再强制撑满消息气泡。
  - `test/server.test.ts` 增加“段落 + pipe table + `---`”回归断言，固定表格必须输出 `<table>` / `<thead>` / `<tbody>`，分割线必须输出 `<hr>`，并防止分隔行裸露。
  - `docs/playground-current.md` 同步记录当前 Markdown 渲染口径。
- 对应入口：
  - [package.json](/E:/AII/ugk-pi/package.json)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### 生产运行态外置到 shared 目录
- 主题：把腾讯云服务器上的 `.env`、`.data/chrome-sidecar` 和生产日志从代码目录继续剥离到 `~/ugk-claw-shared/`，让 Git 工作目录和运行态彻底分家。
- 影响范围：
  - `docker-compose.prod.yml` 改为支持通过 `UGK_APP_ENV_FILE`、`UGK_APP_LOG_DIR`、`UGK_NGINX_LOG_DIR`、`UGK_BROWSER_CONFIG_DIR` 从 shared 目录注入生产运行态路径
  - `.env.example` 补齐这些路径变量的默认值，避免后续只会盯着仓库内相对路径发呆
  - `README.md`、`AGENTS.md`、`docs/traceability-map.md`、`docs/tencent-cloud-singapore-deploy.md` 同步更新 shared 目录口径和生产命令
  - 腾讯云服务器已实际完成迁移验证：`healthz` 与 `playground` 均返回 `200`，`ugk-pi` / `nginx` / `chrome-sidecar` 的生产挂载已切到 `~/ugk-claw-shared/`
  - 旧 repo 内遗留的 `logs/` 已归档到 `~/ugk-claw-shared/backups/repo-logs-from-repo-20260420-112034`
- 对应入口：
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [.env.example](/E:/AII/ugk-pi/.env.example)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

### Chrome sidecar 自举收口
- 主题：修复 `ugk-pi-browser` 容器启动后只有 GUI 壳子、却不会自动拉起带 `--remote-debugging-port=9222` 的 Chrome 进程，导致 direct CDP 默认链路空转的问题。
- 影响范围：
  - 新增 `scripts/ensure-sidecar-chrome.sh`，让浏览器容器在 healthcheck 中自检并按需拉起 Chrome CDP
  - `docker-compose.yml` 与 `docker-compose.prod.yml` 把该脚本挂进 `ugk-pi-browser`，并要求 `ugk-pi-browser-cdp`、`ugk-pi` 等到浏览器健康后再继续启动
  - `test/containerization.test.ts` 增加对 sidecar 自举脚本、挂载路径和 `service_healthy` 依赖条件的回归断言
- 对应入口：
  - [scripts/ensure-sidecar-chrome.sh](/E:/AII/ugk-pi/scripts/ensure-sidecar-chrome.sh)
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)

### 服务器运维速查页
- 主题：把腾讯云新加坡服务器最常用的更新、验收、日志、SSH tunnel、运行态位置与回滚命令压成一页速查，避免每次都在长 runbook 里考古。
- 影响范围：
  - 新增 `docs/server-ops-quick-reference.md`，只保留高频操作，不重复铺陈历史背景
  - `README.md`、`AGENTS.md`、`docs/traceability-map.md`、`docs/tencent-cloud-singapore-deploy.md` 同步挂出速查页入口，形成“速查页 -> 长 runbook”的文档梯度
- 对应入口：
  - [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

### Sidecar GUI 与 CDP 统一 profile
- 主题：修复 sidecar GUI 手点打开的浏览器仍走默认 desktop launcher，导致它和 agent/CDP 控制的 Chrome 分别落到不同 profile、看起来像“登录态全没了”的问题。
- 影响范围：
  - `scripts/ensure-sidecar-chrome.sh` 现在会在容器内生成 `ugk-sidecar-chrome` launcher，并把 `google-chrome.desktop` 与 `com.google.Chrome.desktop` 的 `Exec=` 改写到同一个 `chrome-profile-sidecar`
  - GUI 手点浏览器与 direct CDP 启动的 Chrome 现在共用 `WEB_ACCESS_BROWSER_PROFILE_DIR=/config/chrome-profile-sidecar`
  - `test/containerization.test.ts` 增加对 launcher 名称、desktop patch 和统一 `--user-data-dir` 的回归断言
- 对应入口：
  - [scripts/ensure-sidecar-chrome.sh](/E:/AII/ugk-pi/scripts/ensure-sidecar-chrome.sh)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)

### Sidecar 登录态持久化口径补强
- 主题：把“为什么正常更新不该把 sidecar 登录态洗掉”写成明确 runbook，而不是继续靠口头传说维持秩序。
- 影响范围：
  - `AGENTS.md` 明确：生产 sidecar 登录态挂在 `~/ugk-claw-shared/.data/chrome-sidecar`，且 GUI 与 direct CDP 共用同一套 `chrome-profile-sidecar`；更新后如果又像两套登录态，先查 launcher 与浏览器容器版本。
  - `docs/server-ops-quick-reference.md` 新增 sidecar 登录态备份命令，以及更新后针对 `9222`、desktop launcher、`chrome-profile-sidecar` 进程的三段式验收。
  - `docs/tencent-cloud-singapore-deploy.md` 同步补上登录态备份、验收和浏览器栈强制重建口径，避免后续 `/init` 又把“刷新 GUI 看起来没登录”误判成 shared 目录被清空。
  - `docs/traceability-map.md` 在 web-access 场景下补了 sidecar 登录态异常的追溯入口，后续 `/init` 不用再在多份文档里瞎游泳。
- 对应入口：
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### 腾讯云服务器迁移到 GitHub 工作目录
- 主题：把腾讯云新加坡服务器的主部署目录从 tar 解包目录迁到 GitHub 工作目录，结束“本地打包 tar -> 服务器解包”作为默认主流程的阶段。
- 影响范围：
  - 服务器当前主部署目录改为 `~/ugk-claw-repo`，`origin` 指向 `https://github.com/mhgd3250905/ugk-claw-personal.git`
  - 生产容器实际 bind source 已切到 `~/ugk-claw-repo`：`runtime/skills-user` 与 `.data/chrome-sidecar`
  - 原 `~/ugk-pi-claw` 与两个历史目录保留为回滚兜底，不再是默认更新入口
  - 服务器实测通过：`/healthz` 返回 `200`、`playground` 返回 `200`、`python3 --version` 正常、`check-deps.mjs` 返回 `host-browser: ok`
  - `README.md`、`AGENTS.md`、`docs/traceability-map.md`、`docs/tencent-cloud-singapore-deploy.md` 同步更新接手和部署口径，避免后续 `/init` 继续按旧 tar 目录理解
- 对应入口：
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

### GitHub 主仓库切换与仓库边界收口
- 主题：把代码主仓库切到 GitHub，并先收紧 `.gitignore` 与部署文档口径，避免后续服务器迁移还没开始，主仓库已经被本地运行产物污染。
- 影响范围：
  - `.gitignore` 新增本地调试目录、部署 tar 包、运行时截图 / 调试 HTML、临时输出目录等低争议 ignore 规则，先把明显不该入库的产物挡在 Git 之外
  - `README.md`、`AGENTS.md`、`docs/traceability-map.md` 同步声明 GitHub 已是代码事实源，并明确 `.env`、`.data/`、运行时报告、部署包不属于主仓库
  - `docs/tencent-cloud-singapore-deploy.md` 从“Gitee / tar 为主”调整为“GitHub 为主、tar 为服务器过渡方案”，为后续把服务器迁成 Git 工作目录铺路
- 对应入口：
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
  - [.gitignore](/E:/AII/ugk-pi/.gitignore)

### Playground 手机端展示层重写
- 主题：不再继续拿桌面端布局硬压手机，而是在保留现有会话、文件、技能、发送等逻辑的前提下，把手机端展示层整体重写成真正可用的移动聊天页。
- 影响范围：
  - `src/ui/playground.ts` 的手机断点样式整体收口为“顶部紧凑头部 + 四按钮操作条 + 全高 transcript + 底部 composer”三段式，不再让桌面 `landing` hero 占掉首屏空间；手机端 `transcript-pane` 额外去掉边框并收成全透明
  - 手机端当前可见界面的圆角统一压到 `4px`，不再混用 `12px / 14px / 16px`
  - 手机端底部发送区的 `send` / `interrupt` 控制改成纯 icon：发送使用居中的向上箭头 icon，打断使用白色方形中断 icon，不再显示“发 / 停”文字，同时彻底切断桌面端按钮背景、边框、阴影和默认外观在手机端的继承；当前两个 icon 调整为 `28px`，避免把按钮本体撑大；`interrupt` 在禁用态仍保留占位，只做变淡处理，不再直接隐藏
  - 手机端直接隐藏 `landing-screen` 与拖拽上传壳子，已选文件 / 资产改成横向滚动 strip，把有限高度还给对话内容
  - 手机端 `composer`、发送 / 打断按钮、消息气泡、字号、留白全部按触屏阅读与单手点击重新收口；桌面端现有布局不改
  - 手机端额外收紧富文本代码块：让外层 `.code-block` 退成透明壳子，代码区域本身取消叠加半透明背景，只保留排版层次；工具条不再整条展示，只保留右上角透明背景的纯图标复制按钮，不显示文字 label；助手消息里的 `code` 背景也强制透明，并让长代码行在块内换行，避免把消息气泡横向撑爆
  - `docs/playground-current.md` 更新为新的手机端真实口径，明确这次是“移动展示层重写”，不是继续缝补适配
  - `README.md`、`AGENTS.md`、`docs/traceability-map.md` 同步补齐后续 `/init` 接手提醒，明确手机端已经独立收口，不要再按桌面端缩略版理解
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

## 2026-04-19

### Playground 新会话历史保留、代码块渲染与手机端菜单收口
- 主题：把 `playground` 里最影响真实使用的三个交互问题一次收口，并单独给手机 Web 做不污染桌面端的适配。
- 影响范围：
  - `src/ui/playground.ts` 修复 markdown 在“普通文本 + fenced code block”场景下把 `CODEBLOCK0` 占位符漏到页面的问题，保证技能结构这类回复能正常显示代码块
  - 点击“新会话”前，会先把当前页 transcript 归档到滚动区顶部的“历史会话”区块，不再一键把当前可见历史直接清空
  - 发送消息或向运行中会话追加消息后，composer 会立即清空；如果请求在真正进入后端前失败，会把草稿恢复回来，避免用户误以为已发出却又丢内容
  - 手机端新增顶部菜单，接管 `新会话 / 查看技能 / 选择文件 / 项目文件库` 四个操作；桌面端原有侧边操作保持不动
  - `test/server.test.ts` 增加回归断言，覆盖代码块渲染、新会话归档、立即清空输入框以及手机端菜单入口
  - `docs/playground-current.md` 同步补齐当前口径，避免后续再按旧版“点新会话就清空页面历史”来理解
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Playground 手机端从折叠菜单改回常驻四按钮条
- 主题：撤掉手机端顶部菜单方案，改成更直接的四按钮常驻操作条，把空间还给对话区。
- 影响范围：
  - `src/ui/playground.ts` 删除手机端 `menu button + panel` 逻辑，改成顶部常驻 `新会话 / 技能 / 文件 / 文件库` 四按钮条
  - 手机端布局重新收口为“顶部快捷操作 / 中间 transcript / 底部 composer”，不再为了展开菜单额外占用交互成本
  - `test/server.test.ts` 更新断言，明确手机端是 action strip，不是折叠菜单
  - `docs/playground-current.md` 更新当前手机端真实口径
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### 云服务器更新方式确认规则
- 主题：把“服务器更新前必须先确认增量更新还是整目录替换”上升到项目最高规则和部署 runbook，避免后续 agent 默认整目录替换把服务器本地状态一起覆盖。
- 影响范围：
  - `AGENTS.md` 的最高准则新增部署确认规则：云服务器更新前必须先问清是增量更新还是整目录替换，默认倾向增量更新。
  - `docs/tencent-cloud-singapore-deploy.md` 的更新部署流程前置这条硬规则，明确在未获确认前不要默认执行整目录替换。
  - 这条规则的直接目标是保护服务器上的 `runtime/skills-user/`、`runtime/agents-user/`、`.data/` 以及其他不在仓库里的本地状态。
- 对应入口：
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

### `/init` 接手入口补强
- 主题：把后续 agent `/init` 最容易踩的云端接手前提前置到主入口文档，避免每次重新考古“服务器是不是 Git 仓库”和“什么时候该 build 镜像”。
- 影响范围：
  - `AGENTS.md` 的快速接手场景前置 `docs/web-access-browser-bridge.md` 与 `docs/tencent-cloud-singapore-deploy.md`，并明确云端入口、tar 解包目录属性和运行环境变更必须 `up --build -d`。
  - `README.md` 的快速开始补充“什么时候只 `restart`、什么时候必须 `up --build -d`”的判断口径，减少后续把环境层变更误当成普通热重启。
  - `docs/traceability-map.md` 的快速接手场景追加云端目录不是 Git 仓库的提醒，防止 `/init` 之后又在服务器里直接跑 `git archive` / `git pull`。
- 对应入口：
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### 云服务器更新部署流程补强
- 主题：把本次 `python3` 环境修复上线后的真实云端更新操作补进部署 runbook，明确本机打包、服务器替换、必须重建镜像和验证顺序。
- 影响范围：
  - `docs/tencent-cloud-singapore-deploy.md` 的“后续更新部署流程”补充说明：服务器 `~/ugk-pi-claw` 是 tar 解包目录，不是 Git 仓库，不能在服务器里执行 `git archive` / `git pull`。
  - 明确运行环境变更必须执行 `docker compose -f docker-compose.prod.yml up --build -d`，只 `restart` 不会让旧镜像获得新依赖。
  - 记录本次云端实测结果：`ugk-pi` healthy、`python3 --version -> Python 3.11.2`、`/healthz -> HTTP/1.1 200 OK`、`check-deps.mjs -> host-browser ok + proxy ready`。
  - 固化后续更新验收口径：容器健康、健康检查、运行环境命令、以及 web-access sidecar readiness 必须按变更范围逐项验证。
- 对应入口：
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

### 容器 Python3 运行环境补齐
- 主题：修复容器内缺少 `python3`，以及 sidecar Chrome 重启 helper 依赖浏览器容器 Python 导致 `python is required to clear Chrome restore state` 的问题。
- 影响范围：
  - `Dockerfile` 的基础工具安装列表新增 `python3`，让 app / agent 容器可以直接运行用户技能里的 Python 脚本。
  - `scripts/sidecar-chrome.mjs` 不再进入 `ugk-pi-browser` 容器查找 `python3` / `python`；改为由 Node helper 读取并写回 Chrome profile JSON，避免第三方 Chrome sidecar 镜像缺 Python 时重启失败。
  - `test/containerization.test.ts` 增加回归断言，固定 app 镜像必须包含 `python3`，并防止 sidecar helper 再次依赖浏览器容器内 Python。
  - `AGENTS.md`、`README.md`、`docs/web-access-browser-bridge.md`、`docs/tencent-cloud-singapore-deploy.md` 同步更新运行口径和线上验证命令。
- 对应入口：
  - [Dockerfile](/E:/AII/ugk-pi/Dockerfile)
  - [scripts/sidecar-chrome.mjs](/E:/AII/ugk-pi/scripts/sidecar-chrome.mjs)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

### 腾讯云新加坡部署 Runbook 落地
- 主题：把本次腾讯云新加坡 CVM 从选型、初始化、Docker 安装、代码传输、`.env`、生产 compose 启动、Chrome sidecar 登录、线上故障修复到后续更新发布的全过程沉淀为可追溯部署文档。
- 影响范围：
  - 新增 `docs/tencent-cloud-singapore-deploy.md`，记录当前云端实例 `43.134.167.179`、`4 核 8G`、`5Mbps`、Ubuntu `24.04.4 LTS`、`docker-compose.prod.yml`、公网 `3000`、SSH tunnel 访问 sidecar GUI 等事实。
  - `AGENTS.md` 增加云端部署 runbook 线索，明确后续接手时不要开放公网 `3901`，域名或 HTTPS 变更必须同步服务器 `.env` 与部署文档。
  - `README.md` 的文档导航补充部署 runbook 入口，避免只有 agent 接手文档知道这件事，普通入口却找不到。
  - `docs/traceability-map.md` 在快速接手和容器部署场景中加入部署 runbook，后续排查云端更新、回滚、SSH tunnel 时可以直接定位。
  - 文档记录本次 Gitee 新加坡访问慢、zip 半截下载、`crypto.randomUUID()` 在公网 HTTP 下不可用等真实踩坑，以及推荐的本地 `git archive` 打包上传更新流程。
- 对应入口：
  - [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)

### Playground HTTP 部署 ID 生成兼容
- 主题：修复公网 `http://IP:3000/playground` 下浏览器缺少 `crypto.randomUUID()` 导致页面初始化失败、无法发送消息的问题。
- 影响范围：
  - `src/ui/playground.ts` 新增 `createBrowserId()` / `createConversationId()`，优先使用 `crypto.randomUUID()`，再退回 `crypto.getRandomValues()`，最后退回时间戳加随机数。
  - 替换 playground 内会话 ID、历史消息 ID、文件展示 ID 的裸 `crypto.randomUUID()` 调用，避免非 HTTPS 部署直接炸前端。
  - `test/server.test.ts` 增加回归断言，防止后续又直接依赖 secure-context-only API。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)

### 阶段版本文档收口
- 主题：把 Docker Chrome sidecar 阶段成果补进 `/init` 最容易读取的入口文档，避免新会话继续从旧宿主 IPC 口径出发。
- 影响范围：
  - `README.md` 新增阶段快照，明确 `web-access` 主链路已经切到 `direct_cdp -> Docker Chrome sidecar`。
  - `AGENTS.md` 新增当前阶段快照，固定 sidecar GUI、登录态目录、URL 变量分工和标准验证命令。
  - `docs/traceability-map.md` 的快速接手场景前置 `docs/web-access-browser-bridge.md`，并强调 `requestHostBrowser()` 是历史命名。
  - 清理 README 中残留的“web-access 宿主浏览器桥接”说法，避免后续 `/init` 又把默认路径理解成 Windows IPC。
- 对应入口：
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)

### Docker Chrome sidecar Restore Pages 清理
- 主题：修复 sidecar Chrome 非正常退出后左上角反复出现 `Restore Pages?` 气泡，遮挡手动登录和页面操作的问题。
- 影响范围：
  - `scripts/sidecar-chrome.mjs` 的 `start` / `restart` 流程现在会在启动前清理 `Singleton*` 锁文件，并把 Chrome profile 中的 `exited_cleanly` / `exit_type` 写回正常退出状态。
  - sidecar Chrome 启动参数增加 `--hide-crash-restore-bubble`，避免残留崩溃恢复气泡继续挡住 GUI。
  - `README.md`、`docs/web-access-browser-bridge.md`、`runtime/skills-user/web-access/SKILL.md` 同步说明：遇到该弹窗时使用 `npm run docker:chrome:restart`，不会清理登录 cookies。
  - `docker-compose.yml` 和 `docker-compose.prod.yml` 固定 `SELKIES_USE_BROWSER_CURSORS=true`，让手动 GUI 操作用浏览器本地光标，避免远程桌面 cursor theme 变成问号。
  - sidecar Chrome 统一通过 `DISPLAY=:0` 和 `--ozone-platform=x11` 启动，避免 Chrome 菜单、权限气泡、账号弹窗等顶层 UI 落到 Wayland popup surface 后无法点击。
  - `test/containerization.test.ts` 增加回归断言，防止 helper 后续移除 Restore Pages 清理逻辑。
- 对应入口：
  - [scripts/sidecar-chrome.mjs](/E:/AII/ugk-pi/scripts/sidecar-chrome.mjs)
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)

### Agent Web-Access Sidecar Operationalization

- 主题：把已经验证可用的 `web-access -> direct_cdp -> Docker Chrome sidecar` 链路收口成正式运行口径，而不是继续靠手工临场命令。
- 影响范围：
  - `package.json` 新增 `npm run docker:chrome:check`、`npm run docker:chrome:status`、`npm run docker:chrome:open`。
  - `scripts/sidecar-chrome.mjs` 支持 `check`、`status`、`open`，其中 `check` 会验证 Chrome CDP、app 到 sidecar CDP、以及 `check-deps.mjs` 代理 readiness。
  - `open` 只打印 GUI URL，不擅自启动宿主 GUI app；Linux 云服务器上应通过 SSH tunnel 或受保护反向代理访问。
  - `README.md`、`docs/web-access-browser-bridge.md`、`runtime/skills-user/web-access/SKILL.md` 同步写明 Docker 场景优先走 sidecar direct_cdp。
  - `test/containerization.test.ts` 增加脚本入口与 helper action 断言，防止后续回退成“能手动跑一次，但没有标准检查入口”的半成品。
- 对应入口：
  - [scripts/sidecar-chrome.mjs](/E:/AII/ugk-pi/scripts/sidecar-chrome.mjs)
  - [package.json](/E:/AII/ugk-pi/package.json)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)

### Web-Access Legacy IPC Cleanup And Documentation Pass

- 主题：对 sidecar 接入后的 `web-access` 技能、旧宿主 IPC 残留和文档口径做一次系统性收口，避免 agent 后续又被旧说明带回 Windows IPC。
- 影响范围：
  - `runtime/skills-user/web-access/SKILL.md` 重写为 sidecar-first 运行说明，明确 `Docker Chrome sidecar` 是 primary path，`Windows host IPC` 只是 legacy fallback。
  - `runtime/skills-user/x-search-latest/SKILL.md`、`ins-search-latest`、`linkedin-search-latest`、`tiktok-search-latest` 同步说明 `check-deps.mjs` 的 `host-browser: ok` 在 sidecar 模式下代表 direct CDP backend 可用，不再引导 Docker 用户启动 Windows IPC。
  - `runtime/skills-user/web-access/scripts/x-search-runner.mjs` 与 `linkedin-search-runner.mjs` 移除未使用的 IPC 常量，减少误导性旧代码痕迹。
  - `docs/web-access-browser-bridge.md` 重写为正式运行手册，覆盖主链路、legacy fallback、URL 视角、local artifact、登录态、截图流、云服务器安全暴露和排障顺序。
  - `AGENTS.md`、`README.md`、`docs/runtime-assets-conn-feishu.md`、`docs/traceability-map.md` 同步更新当前稳定事实。
  - `test/web-access-host-bridge.test.ts` 和 `test/x-search-latest-skill.test.ts` 增加回归断言，防止 direct CDP 模式再次先碰 IPC，或技能文档再次把 Docker 用户引向旧 IPC bridge。
- 对应入口：
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [test/web-access-host-bridge.test.ts](/E:/AII/ugk-pi/test/web-access-host-bridge.test.ts)
  - [test/x-search-latest-skill.test.ts](/E:/AII/ugk-pi/test/x-search-latest-skill.test.ts)

### Sidecar Local Artifact URL Split

- 主题：修复 sidecar Chrome 打开 `http://127.0.0.1:3000/v1/local-file?...` 时打到浏览器容器自身 nginx、返回 404 的问题。
- 影响范围：
  - `runtime/skills-user/web-access/scripts/local-cdp-browser.mjs` 将本地 artifact 解析为浏览器可访问的 `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL`，而不是复用用户可见的 `PUBLIC_BASE_URL`。
  - 对已经生成的宿主可见同源 URL，例如 `http://127.0.0.1:3000/v1/local-file?...`，浏览器自动化会在打开前改写成 sidecar 可访问的 `http://ugk-pi:3000/...`。
  - `runtime/screenshot.mjs` 支持传入 `browserBaseUrl`，截图脚本和 web-access 共用同一套 URL 解析规则。
  - `docker-compose.yml`、`docker-compose.prod.yml`、`.env.example` 新增 `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL=http://ugk-pi:3000`。
  - `README.md`、`docs/web-access-browser-bridge.md`、`runtime/skills-user/web-access/SKILL.md` 同步说明：`PUBLIC_BASE_URL` 给用户，`WEB_ACCESS_BROWSER_PUBLIC_BASE_URL` 给 CDP 控制的 sidecar Chrome。
- 对应入口：
  - [runtime/skills-user/web-access/scripts/local-cdp-browser.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/local-cdp-browser.mjs)
  - [runtime/screenshot.mjs](/E:/AII/ugk-pi/runtime/screenshot.mjs)
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [.env.example](/E:/AII/ugk-pi/.env.example)
  - [test/local-cdp-browser.test.ts](/E:/AII/ugk-pi/test/local-cdp-browser.test.ts)
  - [test/runtime-screenshot.test.ts](/E:/AII/ugk-pi/test/runtime-screenshot.test.ts)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)

### Docker Chrome sidecar 直连模式
- 主题：为 Docker / Linux 场景补一条不依赖 Windows 宿主 IPC 的浏览器路径，让 `web-access` 可以直接连可视化 Chrome sidecar 并复用持久登录态。
- 影响范围：
  - `docker-compose.yml` 与 `docker-compose.prod.yml` 新增 `ugk-pi-browser` 服务，默认提供 `https://127.0.0.1:3901/` 登录入口；同时补一个 `ugk-pi-browser-cdp` relay，把 sidecar 内部回环地址上的 `9222` 暴露给 compose 服务网络，宿主 GUI 端口可通过 `WEB_ACCESS_BROWSER_GUI_PORT` 覆盖
  - `ugk-pi` 容器默认注入 `WEB_ACCESS_BROWSER_PROVIDER=direct_cdp`、`WEB_ACCESS_CDP_HOST=172.31.250.10`、`WEB_ACCESS_CDP_PORT=9223`，避免 Chrome DevTools HTTP 接口拒绝服务名 Host 头
  - `host-bridge.mjs` 新增直连模式，sidecar 场景下不再先写 IPC 请求再等超时
  - `check-deps.mjs`、`README.md`、`docs/web-access-browser-bridge.md`、`runtime/skills-user/web-access/SKILL.md` 同步补齐 sidecar 登录与排障口径
  - 新增回归断言，防止 compose 配置和直连逻辑回退
- 对应入口：
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [runtime/skills-user/web-access/scripts/host-bridge.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/host-bridge.mjs)
  - [runtime/skills-user/web-access/scripts/check-deps.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/check-deps.mjs)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [test/web-access-host-bridge.test.ts](/E:/AII/ugk-pi/test/web-access-host-bridge.test.ts)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)

### Docker 开发镜像补齐 Git
- 主题：把容器内缺失 `git` 的环境短板收口到镜像层，避免每次需要查看仓库状态或执行只读 git 命令时都靠宿主机兜底或临时手工安装。
- 影响范围：
  - `Dockerfile` 现在会在构建阶段通过 `apt-get` 正式安装 `git`
  - `README.md` 同步补充当前开发镜像内置 `git`、`curl` 和 `ca-certificates` 的运行口径
  - `AGENTS.md` 的稳定事实改为明确说明镜像已内置 `git`，避免后续接手的人继续把容器缺 git 当成既定事实
  - `test/containerization.test.ts` 的基础镜像断言同步更新为新的安装清单，避免测试继续固化旧口径
- 对应入口：
  - [Dockerfile](/E:/AII/ugk-pi/Dockerfile)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)

### Web-access 本地报告出口统一
- 主题：修复同一条浏览器链路里仍有脚本偷偷回退到 `file://`，导致“第一次成功、第二次又把容器路径塞给宿主浏览器”的反复故障。
- 影响范围：
  - `runtime/screenshot-mobile.mjs` 改为直接复用 `runtime/screenshot.mjs` 的统一 URL 解析与截图逻辑，不再单独拼接 `file://`
  - `docker-compose.yml` 固定注入 `PUBLIC_BASE_URL=http://127.0.0.1:3000`，让运行时脚本和文档出口使用同一宿主地址
  - `runtime/skills-user/web-access/SKILL.md` 明确规定：凡是给用户打开的本地报告，一律输出 HTTP URL 或 `send_file`，禁止再吐 `file:///app/...`
  - 新增回归断言，防止移动截图脚本和 web-access 技能说明再次回退
- 对应入口：
  - [runtime/screenshot-mobile.mjs](/E:/AII/ugk-pi/runtime/screenshot-mobile.mjs)
  - [runtime/screenshot.mjs](/E:/AII/ugk-pi/runtime/screenshot.mjs)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [test/runtime-screenshot.test.ts](/E:/AII/ugk-pi/test/runtime-screenshot.test.ts)
  - [test/x-search-latest-skill.test.ts](/E:/AII/ugk-pi/test/x-search-latest-skill.test.ts)

### Agent 文件交付提示协议收口
- 主题：把“报告生成后该给什么地址、什么时候该发文件”收口到全局 prompt 协议，避免 agent 继续靠上下文运气输出错误交付方式。
- 影响范围：
  - `buildPromptWithAssetContext()` 追加的 `<file_response_protocol>` 现在明确要求：浏览器预览一律返回宿主可访问的 HTTP URL，禁止返回 `file:///app/...`
  - 对项目内已生成的真实文件，优先要求 agent 使用 `send_file`
  - `ugk-file` 降级为小型文本文件的兜底协议，不再当成默认文件交付方式
  - 新增回归测试，防止后续把这层全局约束删回去
- 对应入口：
  - [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
  - [test/file-artifacts.test.ts](/E:/AII/ugk-pi/test/file-artifacts.test.ts)

### Runtime 报告 HTTP 发布收口
- 主题：修复 `runtime/` 报告仍被当成 `file:///app/...` 容器路径交给用户打开，导致宿主浏览器报 `ERR_FILE_NOT_FOUND` 的问题。
- 影响范围：
  - 新增 `GET /runtime/:fileName`，专门服务 `runtime/` 根目录下的安全报告文件，和 `public/` 根文件服务分开收口。
  - `runtime/screenshot.mjs` 不再把本地 HTML 报告强行拼成 `file://`，而是自动把 `public/` / `runtime/` 本地路径转换成可访问的本地 HTTP URL。
  - 对外口径同步固定：宿主浏览器不能直接打开容器内 `file:///app/...`；要么给 HTTP URL，要么走 `send_file`。
  - 新增回归断言，覆盖 `runtime/report-medtrum-v2.html` 的 HTTP 访问和截图脚本 URL 解析。
- 对应入口：
  - [src/routes/static.ts](/E:/AII/ugk-pi/src/routes/static.ts)
  - [runtime/screenshot.mjs](/E:/AII/ugk-pi/runtime/screenshot.mjs)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [test/runtime-screenshot.test.ts](/E:/AII/ugk-pi/test/runtime-screenshot.test.ts)
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [README.md](/E:/AII/ugk-pi/README.md)

### 文件卡片预览与下载分流
- 主题：修复截图等文件点击后容易落入“无法访问您的文件”提示的问题，把预览和下载链路拆开处理。
- 影响范围：
  - `/v1/files/:fileId` 新增 `download=1` 强制下载参数；安全可预览文件默认走 `inline`，显式下载才走 `attachment`。
  - playground 文件卡片新增“打开”入口，图片/PDF/纯文本等安全类型可直接新标签预览；“下载”继续保留，但改走强制下载 URL。
  - 预览白名单只覆盖相对安全的静态类型；`html`、`svg`、`js` 等可能执行脚本的内容不做同源直接预览，避免把文件预览改成 XSS 入口。
  - 新增回归断言，覆盖图片默认 inline 和 `?download=1` 强制 attachment 两条行为。
- 对应入口：
  - [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)

### Agent `send_file` 文件发送工具
- 主题：新增正式的 agent 发文件通道，避免继续把图片、报告等文件用 base64 或 ````ugk-file```` 原始块塞进聊天正文。
- 影响范围：
  - 新增项目级 `send_file` extension：agent 可把项目根目录内已生成的本地文件注册成统一资产，并返回可下载文件元数据。
  - `send_file` 会校验文件必须位于项目根目录内，拒绝路径穿越和项目外路径；文件名会做安全化处理，MIME 会按常见扩展名推断。
  - `AssetStore` 新增 Buffer 文件保存能力，图片、PDF、压缩包等二进制产物不再需要先转成文本协议。
  - `AgentService` 会从 `tool_execution_end` 的 `send_file` 工具结果中提取 `details.file`，合并进最终 `ChatResult.files` 和流式 `done.files`。
  - playground 不需要新增 UI 分支，继续复用现有文件下载卡片；这才像个文件交付系统，不是把聊天框当垃圾桶。
  - 文档同步记录 `send_file` 的设计、数据流、限制和排查入口。
- 对应入口：
  - [.pi/extensions/send-file.ts](/E:/AII/ugk-pi/.pi/extensions/send-file.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/agent/asset-store.ts](/E:/AII/ugk-pi/src/agent/asset-store.ts)
  - [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)
  - [test/send-file-extension.test.ts](/E:/AII/ugk-pi/test/send-file-extension.test.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)

### Playground 文件型回复正文收口
- 主题：修复 agent 只返回 `ugk-file` 文件块时，playground 仍把流式阶段收到的 base64 / fenced block 留在助手正文里的问题。
- 影响范围：
  - `done` 事件现在会在 `event.text` 是空字符串时也覆盖当前流式正文，确保后端已经抽离为 `files` 的内容不会继续显示在消息气泡里。
  - 文件型回复仍通过 `files` 渲染为下载卡片；正文为空时只显示文件发送结果，不再泄漏 `ugk-file` 原始协议块。
  - 新增回归断言，防止以后把判断写回 `event.text && ...` 这种会漏掉空字符串的形式。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)

### Web-access 本地浏览器自动拉起
- 主题：修复宿主浏览器关闭后，IPC 仍返回 `chrome_cdp_unreachable` 导致 web-access 不再尝试拉起 Chrome 的问题
- 影响范围：
  - `requestHostBrowser` 在 IPC 有响应但报告 Chrome/CDP 不可达时，会改走 `LocalCdpBrowser` fallback
  - 默认 IPC 目录从容器不可共享的 `/workspace/ipc` 收口到项目共享的 `.data/browser-ipc`；容器内对应 `/app/.data/browser-ipc`
  - 新增宿主 IPC bridge daemon，负责消费容器写入的 browser IPC request，并在收到请求时用宿主侧指定 Chrome/profile 自动拉起 CDP 浏览器
  - 当共享 IPC 目录中存在 host bridge ready 文件时，`status` 检查会把 IPC 等待时间从 1 秒放宽到 30 秒，避免把“宿主正在自动启动 Chrome”误判成浏览器不可用
  - `LocalCdpBrowser` 既有的 `ensureBrowser -> startBrowser` 逻辑会负责启动带 `--remote-debugging-port` 的托管 Chrome profile；Windows 下不再默认尝试 Edge，除非显式设置 `WEB_ACCESS_ALLOW_EDGE=1`
  - 宿主侧启动脚本 `scripts/start-web-access-browser.ps1` 改为启动 host bridge daemon，并默认使用 `.data/web-access-chrome-profile` 作为持久登录态目录
  - `check-deps.mjs` 遇到容器内 `local_browser_executable_not_found` 或 CDP 启动超时时，会输出可执行的宿主启动命令，不再直接甩一段 Node stack
  - 普通浏览器命令如 `new_target`、`list_targets` 等收到 `chrome_cdp_unreachable` / CDP 超时类错误时，也会重试 local fallback，而不只是在 IPC 完全无响应时 fallback
  - `web-access` 技能说明同步更新：只有 fallback 也失败时才报告浏览器不可用，并且脚本命令改为容器内 `/app/runtime/skills-user/...` 路径
  - `x-search-latest` 技能说明同样改为在容器内直接使用 `/app/runtime/skills-user/...` 脚本路径，避免 `$CLAUDE_SKILL_DIR` 为空时拼出 `/web-access/...` 这类无效路径
  - 新增专题文档记录完整设计、根因、验证命令、常见故障和排障顺序，避免后续继续把 profile、IPC、CDP、X 登录态混成一锅粥
- 对应入口：
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [runtime/skills-user/web-access/scripts/host-bridge.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/host-bridge.mjs)
  - [runtime/skills-user/web-access/scripts/host-browser-bridge-daemon.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/host-browser-bridge-daemon.mjs)
  - [runtime/skills-user/web-access/scripts/check-deps.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/check-deps.mjs)
  - [runtime/skills-user/web-access/scripts/local-cdp-browser.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/local-cdp-browser.mjs)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
  - [runtime/skills-user/x-search-latest/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/x-search-latest/SKILL.md)
  - [scripts/start-web-access-browser.ps1](/E:/AII/ugk-pi/scripts/start-web-access-browser.ps1)
  - [test/web-access-host-bridge.test.ts](/E:/AII/ugk-pi/test/web-access-host-bridge.test.ts)
  - [test/x-search-latest-skill.test.ts](/E:/AII/ugk-pi/test/x-search-latest-skill.test.ts)

### Public 根静态文件路由正规化
- 主题：把临时硬编码的 X API 报告静态路由收口为安全的 `public/` 根文件服务
- 影响范围：
  - 新增 `GET /:fileName` 静态文件入口，仅服务 `public/` 根目录下的普通文件，不递归目录、不允许隐藏文件或路径穿越
  - `x-api-report-card.html`、`x-api-report.html`、`x-api-report.png`、`x-api-report-full.png` 等报告产物可以通过 HTTP URL 访问，宿主浏览器不需要再尝试容器内 `file://` 路径
  - 静态响应按扩展名设置基础 `content-type`，并使用 `no-store` 避免截图调试时看到旧页面
  - 页面级截图仍应使用 HTTP 地址，例如 `http://127.0.0.1:3000/x-api-report-card.html`；CDP 截图超时属于浏览器自动化链路问题，不应靠 `file:///app/...` 绕路
- 对应入口：
  - [src/routes/static.ts](/E:/AII/ugk-pi/src/routes/static.ts)
  - [src/server.ts](/E:/AII/ugk-pi/src/server.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)

### Playground 错误消息样式收口
- 主题：修复网络 / 服务端错误仍生成旧 `message error` 气泡、没有使用 agent 回复样式的问题
- 影响范围：
  - transcript 消息视觉类型收敛为用户气泡和助手气泡两类，`system` / `error` 等非用户语义统一渲染为助手视觉样式，并继续通过 `data-message-kind` 保留真实语义
  - 移除旧 `.message.error` 居中布局和移动端选择器，避免错误消息绕过当前 agent 回复样式
  - `/v1/chat/stream` 请求拒绝和网络异常不再追加 `appendTranscriptMessage("error", ...)`，统一收口到顶部错误横幅与当前助手气泡的过程区
  - 页面回归断言新增对旧错误气泡入口和旧 `.message.error` 样式的反向检查，同时修正一个依赖旧错误样式误命中的 transcript 对齐断言
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
  - [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)

### Init 接手文档同步运行态重连口径
- 主题：把当前运行态重连能力同步到下次 `/init` 最容易读取的入口文档，避免新会话只看到旧的“流式 / 打断”口径
- 影响范围：
  - `AGENTS.md` 的聊天场景索引新增 `GET /v1/chat/status` 与 `GET /v1/chat/events`，稳定事实补充“当前正在运行”文案和 active run 事件缓冲边界
  - `README.md` 的能力概览、接口速查和验证结果补齐运行态查询、事件重连以及 `76 / 76` 测试口径
  - `docs/traceability-map.md` 增加刷新后 active run 状态映射、事件缓冲和 `/v1/chat/events` 重连追溯点
  - `docs/playground-current.md` 清理旧乱码小节，补成明确的运行态与 loading 约束
- 对应入口：
  - [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
  - [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)

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
# 2026-04-19 Addendum

## Local Artifact Bridge And Download Header Fix

- 主题：把“内部 file 路径可用、外部浏览器自动桥接”做成运行时能力，而不是继续靠提示词限制 agent；同时修复中文文件名触发 `content-disposition` 非法头，导致打开/下载 0B 的硬 bug。
- 影响范围：
  - `runtime/skills-user/web-access/scripts/local-cdp-browser.mjs` 现在会把 `/app/...`、`file:///app/...`、`public/...`、`runtime/...` 这类本地 artifact 输入自动桥接到 `GET /v1/local-file?path=...`
  - `runtime/screenshot.mjs` 复用同一套本地 artifact URL 解析，不再单独维护一份路径转换逻辑
  - `src/routes/files.ts` 新增 `GET /v1/local-file`，统一服务 `public/` / `runtime/` 本地 artifact 的浏览器打开场景
  - `src/routes/files.ts` 的 `content-disposition` 改为 `filename` + `filename*` 双写法，中文文件名下载恢复正常
  - `src/agent/file-artifacts.ts` 与 `runtime/skills-user/web-access/SKILL.md` 更新为：内部允许 file 路径，用户交付再走 HTTP URL 或 `send_file`
- 对应入口：
  - [runtime/skills-user/web-access/scripts/local-cdp-browser.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/local-cdp-browser.mjs)
  - [runtime/screenshot.mjs](/E:/AII/ugk-pi/runtime/screenshot.mjs)
  - [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
  - [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
  - [test/local-cdp-browser.test.ts](/E:/AII/ugk-pi/test/local-cdp-browser.test.ts)
  - [test/runtime-screenshot.test.ts](/E:/AII/ugk-pi/test/runtime-screenshot.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [test/file-artifacts.test.ts](/E:/AII/ugk-pi/test/file-artifacts.test.ts)
  - [test/x-search-latest-skill.test.ts](/E:/AII/ugk-pi/test/x-search-latest-skill.test.ts)

## Assistant Text Local Artifact Rewrite

- 主题：把“内部本地 file 路径可以继续用”和“用户可见文本不能把宿主浏览器带进沟里”彻底拆开；运行时现在负责重写用户可见消息里的容器本地 artifact 路径。
- 影响范围：
  - `src/agent/file-artifacts.ts` 新增用户可见文本重写逻辑，会把 `/app/public/...`、`/app/runtime/...`、`file:///app/...` 改写为 `GET /v1/local-file?path=...`
  - `src/agent/agent-service.ts` 在最终正文、流式 `text_delta`、以及工具过程输出里统一应用这层重写，不再依赖 agent 自己记住什么地址能给宿主打开
  - 保持内部工具链不变：浏览器自动化和本地 artifact 处理仍然可以继续使用原始 `/app/...` / `file:///app/...`
- 对应入口：
  - [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [test/file-artifacts.test.ts](/E:/AII/ugk-pi/test/file-artifacts.test.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
## 2026-04-19 Documentation Consolidation

### 文档口径整理：本地文件桥接与用户交付

- 主题：把最近围绕本地 artifact、`send_file`、`/v1/local-file`、web-access 浏览器桥接的口径重新收成主文档，清理 README 和专题文档里残留的旧说法。
- 影响范围：
  - `README.md` 重写为当前稳定入口文档，明确区分“agent 内部允许 file 路径”和“用户可见地址必须可打开”
  - `docs/traceability-map.md` 重写为按场景追溯入口，补齐文件交付、`/v1/local-file`、web-access 与截图链路
  - `docs/runtime-assets-conn-feishu.md` 重写资产/附件/`send_file`/本地 artifact 桥接口径
  - `docs/web-access-browser-bridge.md` 重写浏览器桥接、专用 profile、本地文件桥接与排障顺序
  - `docs/change-log.md` 追加本条记录，避免后续 `/init` 还被旧口径误导
- 对应入口：
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
  - [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)

## 2026-04-19 Sidecar Profile Consolidation

- 主题：把 Docker Chrome sidecar 的 profile 路径收口成唯一配置，避免人工登录和自动启动分别落到不同目录，搞出一次能登、重启失忆的假稳定。
- 影响范围：
  - `docker-compose.yml` 与 `docker-compose.prod.yml` 统一使用 `WEB_ACCESS_BROWSER_PROFILE_DIR`
  - 默认 sidecar profile 路径固定为 `${WEB_ACCESS_BROWSER_PROFILE_DIR:-/config/chrome-profile-sidecar}`
  - `.env.example`、`README.md`、`docs/web-access-browser-bridge.md`、`runtime/skills-user/web-access/SKILL.md` 同步说明 sidecar 只应保留一份正式持久 profile
  - `test/containerization.test.ts` 增加对 profile 配置键的断言，防止后续回退到多路径
- 对应入口：
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [.env.example](/E:/AII/ugk-pi/.env.example)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)

## 2026-04-19 Sidecar Chrome Start And Restart Helper

- 主题：补一个明确的 sidecar Chrome 启动/重启入口，别再靠现场手搓 `docker compose exec` 长命令救火。
- 影响范围：
  - 新增 `scripts/sidecar-chrome.mjs`，统一负责清理残留锁、用正确 Wayland 环境拉起 Chrome、重启 relay，并验证 app 到 sidecar 的 CDP 链路
  - `package.json` 新增 `npm run docker:chrome:start` 与 `npm run docker:chrome:restart`
  - `check-deps.mjs` 在 direct sidecar 模式失败时会直接提示使用新命令
  - `README.md`、`docs/web-access-browser-bridge.md`、`runtime/skills-user/web-access/SKILL.md` 同步记录新入口
- 对应入口：
  - [scripts/sidecar-chrome.mjs](/E:/AII/ugk-pi/scripts/sidecar-chrome.mjs)
  - [package.json](/E:/AII/ugk-pi/package.json)
  - [runtime/skills-user/web-access/scripts/check-deps.mjs](/E:/AII/ugk-pi/runtime/skills-user/web-access/scripts/check-deps.mjs)
  - [README.md](/E:/AII/ugk-pi/README.md)
  - [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
  - [runtime/skills-user/web-access/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/web-access/SKILL.md)
## 2026-04-20 Playground Context Usage Indicator

- 主题：为 `playground` 增加位于对话区和输入框之间、右侧对齐的小圆环上下文提示，并把当前会话的上下文估算结果暴露到 `GET /v1/chat/status`
- 影响范围：
  - `src/agent/context-usage.ts` 新增会话上下文估算逻辑，优先复用最近一次 assistant `usage`，并补上 trailing messages / 输入附件 / 资产的粗估 token
  - `src/agent/agent-session-factory.ts` 暴露项目默认 provider / model / context window / reserve budget，避免前端凭空脑补上下文上限
  - `src/agent/agent-service.ts` 的 `getRunStatus` 现在会返回 `contextUsage`，即使当前没有 active run，也会基于已存 session 估算会话占用
  - `src/types/api.ts`、`src/routes/chat.ts` 同步把 `ChatStatusResponseBody` 收口为 `conversationId + running + contextUsage`
  - `src/ui/playground.ts` 在对话区和输入框之间新增独立的小圆环进度提示，圆环只显示百分比，风险色跟随 `safe / caution / warning / danger`
  - 桌面 Web 和手机端都使用同一位置规则：在输入框外部、右侧与输入区域对齐
  - 桌面端 hover / focus 展示详情浮层，手机端点击圆环打开底部详情弹窗
  - `playground` 前端会把本地草稿、待发附件、已选资产叠加到后端基线，占用文案明确标成估算，不再装成 provider 精确统计
- 对应入口：
  - [src/agent/context-usage.ts](/E:/AII/ugk-pi/src/agent/context-usage.ts)
  - [src/agent/agent-session-factory.ts](/E:/AII/ugk-pi/src/agent/agent-session-factory.ts)
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
  - [src/types/api.ts](/E:/AII/ugk-pi/src/types/api.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/agent-session-factory.test.ts](/E:/AII/ugk-pi/test/agent-session-factory.test.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### Conn 实时广播与 Playground 在线提示
- 主题：把后台 conn 结果从“只能靠刷新或查库发现”收口为“先持久化，再向在线页面实时广播”，补齐前后台之间的在线提醒层。
- 影响范围：
  - `src/routes/notifications.ts` 新增 `GET /v1/notifications/stream` SSE 订阅入口，以及 `POST /v1/internal/notifications/broadcast` 内部广播入口。
  - `src/agent/notification-hub.ts` 新增前台 server 进程内的轻量广播中心，用来把 worker 发来的 notification 扇出给所有在线页面。
  - `src/workers/conn-worker.ts` 在写入 `conversation_notifications` 之后，会 best-effort 调用内部广播接口；广播失败只记 warning，不影响 run 最终状态。
  - `src/ui/playground.ts` 新增实时 SSE 订阅、右上角轻提示、断线重连，以及“当前会话收到广播后静默刷新历史与 run 状态”的前端逻辑。
  - `docker-compose.yml` 与 `docker-compose.prod.yml` 给 `ugk-pi-conn-worker` 显式注入 `NOTIFICATION_BROADCAST_URL=http://ugk-pi:3000/v1/internal/notifications/broadcast`，避免容器内 `127.0.0.1` 指回 worker 自己。
  - `test/server.test.ts`、`test/conn-worker.test.ts`、`test/notification-hub.test.ts`、`test/containerization.test.ts` 补齐回归断言，锁住广播接口、worker 广播行为、前台订阅脚本和 compose 环境变量。
- 对应入口：
  - [src/routes/notifications.ts](/E:/AII/ugk-pi/src/routes/notifications.ts)
  - [src/agent/notification-hub.ts](/E:/AII/ugk-pi/src/agent/notification-hub.ts)
  - [src/workers/conn-worker.ts](/E:/AII/ugk-pi/src/workers/conn-worker.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [test/conn-worker.test.ts](/E:/AII/ugk-pi/test/conn-worker.test.ts)
  - [test/notification-hub.test.ts](/E:/AII/ugk-pi/test/notification-hub.test.ts)
  - [test/containerization.test.ts](/E:/AII/ugk-pi/test/containerization.test.ts)
### Playground 实时广播提示层级修复
- 日期：2026-04-21
- 主题：修复 `/playground` 右上角实时广播 toast 被固定层遮挡的问题。
- 影响范围：将 `src/ui/playground.ts` 中 `.notification-live-region` 的层级提升到所有现有 fixed overlay 之上，确保 SSE 已送达且 toast 已插入 DOM 时用户能实际看见提示。
- 对应入口：`src/ui/playground.ts`、`docs/playground-current.md`

### Conn Worker 真并发收口
- 日期：2026-04-21
- 主题：把 `ConnWorker` 的 `maxConcurrency` 从串行假并发修成真正的单进程内并发执行，并给 compose 默认注入 3 路并发。
- 影响范围：`src/workers/conn-worker.ts` 现在会先 claim 多条 due run 再并行执行；`docker-compose.yml`、`docker-compose.prod.yml` 与 `.env.example` 新增 `CONN_WORKER_MAX_CONCURRENCY` 口径；`test/conn-worker.test.ts`、`test/containerization.test.ts` 补齐回归。
- 对应入口：`src/workers/conn-worker.ts`、`docker-compose.yml`、`docker-compose.prod.yml`、`.env.example`、`test/conn-worker.test.ts`、`test/containerization.test.ts`

### Conn run heartbeat 收口
- 日期：2026-04-21
- 主题：为运行中的 conn run 增加 heartbeat，周期性刷新 `updatedAt` 与 `leaseUntil`，避免长任务在详情页里看起来像卡死。
- 影响范围：`src/agent/conn-run-store.ts` 新增 `heartbeatRun()`；`src/workers/conn-worker.ts` 在执行期间启动/停止 lease heartbeat；`test/conn-run-store.test.ts` 与 `test/conn-worker.test.ts` 补齐回归。
- 对应入口：`src/agent/conn-run-store.ts`、`src/workers/conn-worker.ts`、`test/conn-run-store.test.ts`、`test/conn-worker.test.ts`

### Conn stale run 回收收口
- 日期：2026-04-21
- 主题：worker 在 claim 新任务前先回收 lease 已过期的 `running` run，把它们标记为失败并补 `run_stale` 事件，不再静默重领旧 run。
- 影响范围：`src/workers/conn-worker.ts` 新增 stale sweep；`src/agent/conn-run-store.ts` 新增 `listStaleRuns()`；`test/conn-worker.test.ts` 补齐 stale 回收回归。
- 对应入口：`src/workers/conn-worker.ts`、`src/agent/conn-run-store.ts`、`test/conn-worker.test.ts`

### Playground 展示 conn run lease / stale 信息
- 日期：2026-04-21
- 主题：把 conn run 的 lease 生命周期状态从“后端自己知道”收口到前台弹层可见，避免用户只看到结果摘要却不知道任务是不是还活着。
- 影响范围：`src/types/api.ts` 与 `src/routes/conns.ts` 现在对外返回 `leaseOwner`、`leaseUntil`；`src/ui/playground.ts` 的后台任务过程弹层新增 `claimed / started / updated / lease owner / lease until` 与 health 文案展示；`test/server.test.ts` 锁定新字段回归。
- 对应入口：`src/types/api.ts`、`src/routes/conns.ts`、`src/ui/playground.ts`、`test/server.test.ts`、`docs/runtime-assets-conn-feishu.md`、`docs/playground-current.md`

### 会话目录合并后台通知摘要
- 日期：2026-04-21
- 主题：修复 `GET /v1/chat/conversations` 只看旧会话快照、忽略后台 notification 的问题，避免正文已经有结果但左侧列表仍显示空摘要和旧排序。
- 影响范围：`src/agent/agent-service.ts` 在生成 conversation catalog 时会合并 notification 的 `preview / messageCount / updatedAt` 并重新排序；`test/agent-service.test.ts` 补齐目录摘要、计数与排序回归；`docs/playground-current.md` 同步更新前台口径。
- 对应入口：`src/agent/agent-service.ts`、`test/agent-service.test.ts`、`docs/playground-current.md`

### Conn maxRunMs 超时闸门
- 日期：2026-04-22
- 主题：为后台 `conn` 增加可配置的 `maxRunMs`，让超长任务在 worker 侧被真实中止并失败留痕，而不是无限挂着占坑。
- 影响范围：`src/agent/conn-store.ts`、`src/agent/conn-sqlite-store.ts`、`src/agent/conn-db.ts` 为 `conn` 定义、SQLite 存储与 schema 迁移新增 `maxRunMs`；`src/routes/conns.ts` 与 `src/types/api.ts` 开放读写接口字段；`src/workers/conn-worker.ts` 与 `src/agent/background-agent-runner.ts` 打通超时中止、`run_timed_out` 事件与失败收口；测试覆盖落在 `test/conn-db.test.ts`、`test/conn-sqlite-store.test.ts`、`test/background-agent-runner.test.ts`、`test/conn-worker.test.ts`、`test/server.test.ts`。
- 对应入口：`src/agent/conn-store.ts`、`src/agent/conn-sqlite-store.ts`、`src/agent/conn-db.ts`、`src/routes/conns.ts`、`src/types/api.ts`、`src/workers/conn-worker.ts`、`src/agent/background-agent-runner.ts`、`docs/runtime-assets-conn-feishu.md`

### Playground 标识 conn 超时失败
- 日期：2026-04-22
- 主题：让后台任务过程弹层把 `maxRunMs` 超时失败显示为 `failed / timed out`，不要和普通失败混成一类。
- 影响范围：`src/ui/playground.ts` 新增超时识别逻辑，优先读取 `run_timed_out` 事件，兜底匹配 `errorText` 中的 `exceeded maxRunMs`；`test/server.test.ts` 锁定 `/playground` 脚本标记；`docs/playground-current.md` 同步说明展示口径。
- 对应入口：`src/ui/playground.ts`、`test/server.test.ts`、`docs/playground-current.md`
 
### Playground Conn 管理面
- 日期：2026-04-22
- 主题：在 `playground` 增加后台任务管理入口，让用户不用离开页面就能查看 conn 列表、暂停/恢复调度、手动入队一次运行，并打开最近 run 详情。
- 影响范围：
  - `src/ui/playground.ts` 新增桌面端 `后台任务` 入口、手机端溢出菜单入口、`conn-manager-dialog` 弹层、`GET /v1/conns` 列表读取、`GET /v1/conns/:connId/runs` 最近 run 读取、`POST /v1/conns/:connId/run` 手动执行、`POST /v1/conns/:connId/pause|resume` 状态切换。
  - 前台 agent 运行中不禁用 conn 管理入口，保持后台调度和前台对话解耦。
  - `test/server.test.ts` 锁定页面 HTML / 嵌入脚本中必须存在 conn 管理入口和真实 API 调用链。
  - `docs/playground-current.md` 与 `docs/runtime-assets-conn-feishu.md` 同步记录新入口和排障口径。
- 对应入口：
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
  - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
  - [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### Agent Activity 全局活动时间线
- 日期：2026-04-22
- 主题：新增跨会话的 Agent Activity 时间线，让后台 conn 结果不再只藏在目标 conversation 里；当前会话 transcript 继续作为上下文真源，全局活动只做观察和追溯。
- 影响范围：
  - `src/agent/conn-db.ts` 新增 `agent_activity_items` schema、索引和表初始化。
  - `src/agent/agent-activity-store.ts` 新增全局活动 store，支持创建、去重、列表、读取和已读标记。
  - `src/workers/conn-worker.ts` 对所有终态 conn run best-effort 写入全局 activity；conversation 目标继续写 `conversation_notifications`，成功、失败、超时结果都会留痕。
  - `src/routes/activity.ts` 新增 `GET /v1/activity` 与 `POST /v1/activity/:activityId/read`。
  - `src/server.ts` 注册 activity store 和路由，`src/types/api.ts` 补齐 API 类型。
  - `src/ui/playground.ts` 新增桌面端与手机端 `全局活动` 入口、activity 弹层、`/v1/activity?limit=50` 拉取、广播后刷新，以及从 activity 条目跳转既有 conn run 详情弹层。
  - `test/agent-activity-store.test.ts`、`test/conn-db.test.ts`、`test/conn-worker.test.ts`、`test/server.test.ts` 补齐回归。
  - `docs/runtime-assets-conn-feishu.md`、`docs/playground-current.md`、`docs/traceability-map.md` 同步新的读模型、API 和前端入口。
- 对应入口：
  - [src/agent/agent-activity-store.ts](/E:/AII/ugk-pi/src/agent/agent-activity-store.ts)
  - [src/routes/activity.ts](/E:/AII/ugk-pi/src/routes/activity.ts)
  - [src/workers/conn-worker.ts](/E:/AII/ugk-pi/src/workers/conn-worker.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [test/agent-activity-store.test.ts](/E:/AII/ugk-pi/test/agent-activity-store.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
### Conn 固定时间规则补齐具体时间入口
- 日期：2026-04-22
- 主题：这是当天中途那版“固定时间规则”交互的补丁记录；它解决的是当时 `每天固定时间 / 工作日固定时间 / 每周固定时间` 那套设计里的联动显示问题。
- 影响范围：这套固定时间规则后来已整体退场，被更晚的三种调度模式替代，所以这条记录只保留历史背景，不再代表当前页面结构。
- 对应入口：`src/ui/playground.ts`、`test/server.test.ts`、`docs/playground-current.md`
### Conn 调度表单收口成三种模式
- 日期：2026-04-22
- 主题：按最新产品口径把后台任务调度区简化成 `定时执行 / 间隔执行 / 每日执行` 三种，删除原先那堆 `每天早上 / 每小时 / 工作日 / 每周 / Conn 定时表达式` 的前台选择分支。
- 影响范围：`src/ui/playground.ts` 只保留三种调度模式及对应字段，并继续映射到后端 `once / interval / cron`；`test/server.test.ts` 更新页面断言；`docs/playground-current.md` 与 `docs/runtime-assets-conn-feishu.md` 同步新的用户口径。
- 对应入口：`src/ui/playground.ts`、`test/server.test.ts`、`docs/playground-current.md`、`docs/runtime-assets-conn-feishu.md`

### Playground 统一会话同步 ownership
- 日期：2026-04-22
- 主题：把 `playground` 会话历史恢复和运行态同步统一收口到 request generation ownership，避免旧会话回包或同会话旧请求晚回时把当前 transcript 冲脏。
- 影响范围：
  - `src/ui/playground.ts` 新增 `conversationSyncGeneration / conversationSyncRequestId / conversationAppliedSyncRequestId`，并统一通过 `invalidateConversationSyncOwnership()`、`issueConversationSyncToken()`、`isConversationSyncTokenCurrent()`、`shouldApplyConversationState()` 管住 `/v1/chat/state` 的落地资格。
  - `src/ui/playground-conversations-controller.ts` 在切换会话前先停止当前 run event stream，再失效旧会话 sync ownership，避免新旧会话并发同步互相污染。
  - `test/server.test.ts` 更新 `/playground` 页面断言，锁定新的 sync token 契约和 `renderConversationState(conversationState, syncToken)` 入口。
  - `docs/playground-current.md` 同步当前前端对会话同步 ownership 的真实口径。
- 对应入口：`src/ui/playground.ts`、`src/ui/playground-conversations-controller.ts`、`test/server.test.ts`、`docs/playground-current.md`

### Playground 拆分 stream lifecycle controller
- 日期：2026-04-22
- 主题：把 `playground` 的通知广播 SSE、active run 事件流、断线恢复，以及 `send / queue / interrupt` 主链路从 `src/ui/playground.ts` 拆到独立 `playground-stream-controller.ts`，避免主文件继续兼任事件泵站。
- 影响范围：
  - `src/ui/playground-stream-controller.ts` 新增 `bindPlaygroundStreamController()`，承接 `connectNotificationStream()`、`attachActiveRunEventStream()`、`recoverRunningStreamAfterDisconnect()`、`readEventStream()`、`handleStreamEvent()`、`sendMessage()`、`queueActiveMessage()`、`interruptRun()` 等流式运行时入口。
  - `src/ui/playground.ts` 只保留 canonical state、会话恢复、DOM refs 和页面组装；旧的 stream lifecycle 函数从主文件移除，改为注入新 controller。
  - `test/server.test.ts` 新增 `/playground` 页面断言，锁定 `bindPlaygroundStreamController()` 注入和关键 stream runtime 入口。
  - `docs/playground-current.md`、`docs/traceability-map.md` 同步新的前端边界和排查入口。
- 对应入口：`src/ui/playground-stream-controller.ts`、`src/ui/playground.ts`、`test/server.test.ts`、`docs/playground-current.md`、`docs/traceability-map.md`
