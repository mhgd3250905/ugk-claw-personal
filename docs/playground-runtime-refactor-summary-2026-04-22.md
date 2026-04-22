# Playground Runtime Refactor Summary

这份文档记录 `2026-04-22` 这轮 `playground` runtime 拆分与稳定性收口的阶段成果。

目标不是吹牛，而是给下一次 `/init` 或后续接手的人一个靠谱入口，避免又把已经拆开的边界揉回 [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts) 里。

## 这轮到底解决了什么

这轮不是“顺手清理一点前端代码”，而是把 `playground` 从一个持续膨胀的单文件页面，收成了：

1. 一个负责页面组装与共享 state 的 assembler
2. 一组按职责拆开的 controller / renderer
3. 一套更稳定的会话同步、流式续订、刷新恢复与中断收口口径

如果继续把会话、流式、消息渲染、手机壳子、文件资产、conn 活动都塞回主文件，后面任何一个小改动都会重新拖出竞态、滚动错乱和刷新恢复幽灵。这不是夸张，是已经真踩过。

## 当前边界

当前 `playground` 前端边界建议按下面理解：

- [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - 页面 assembler
  - 共享 state
  - 控制器注入
  - 页面级入口与总装配
- [src/ui/playground-assets.ts](/E:/AII/ugk-pi/src/ui/playground-assets.ts)
  - 文件 / 资产相关静态片段
- [src/ui/playground-assets-controller.ts](/E:/AII/ugk-pi/src/ui/playground-assets-controller.ts)
  - 上传、拖拽、资产库复用、附件 chip、下载卡片
- [src/ui/playground-context-usage-controller.ts](/E:/AII/ugk-pi/src/ui/playground-context-usage-controller.ts)
  - context usage 估算、进度环、详情弹层
- [src/ui/playground-conversations-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conversations-controller.ts)
  - 会话目录、新建、切换、激活、移动端历史抽屉列表
- [src/ui/playground-layout-controller.ts](/E:/AII/ugk-pi/src/ui/playground-layout-controller.ts)
  - composer 高度同步、滚动跟随、回到底部、恢复入口
- [src/ui/playground-transcript-renderer.ts](/E:/AII/ugk-pi/src/ui/playground-transcript-renderer.ts)
  - transcript / message renderer、markdown hydration、代码块 copy、复制正文
- [src/ui/playground-stream-controller.ts](/E:/AII/ugk-pi/src/ui/playground-stream-controller.ts)
  - `stream / events / notifications` 生命周期、发送、排队、打断、断线恢复
- [src/ui/playground-mobile-shell-controller.ts](/E:/AII/ugk-pi/src/ui/playground-mobile-shell-controller.ts)
  - 手机端 topbar、历史抽屉壳子、更多菜单、遮罩与开关
- [src/ui/playground-conn-activity.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity.ts)
  - conn / 全局活动静态片段
- [src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)
  - conn 管理器、run 详情、全局活动、相关事件绑定

一句人话：`playground.ts` 现在应该像“总装车间”，不是“所有零件堆在地上硬拧”。

## 本轮关键阶段

### 1. 先把 UI 壳子和外围行为拆掉

先后拆了：

- mobile shell
- conversations controller
- layout controller
- context usage controller
- assets static/runtime controller
- conn activity static/runtime controller

这一步的意义是先把最容易和 DOM、响应式、事件绑定搅在一起的外围行为剥出去，让主文件不再同时兼任视觉层、控制层和数据层。

### 2. 再拆 transcript renderer

这一步把消息渲染链路从主文件移走，包括：

- transcript entry 渲染
- assistant / user / system 气泡拼装
- markdown hydration
- 代码块 copy toolbar
- 正文复制按钮
- streaming assistant message 的衔接壳子

这一步风险高，因为它直接影响刷新恢复后消息会不会裂泡、代码块和复制操作会不会残。

### 3. 再拆 stream lifecycle

高风险的不是“消息怎么画”，而是“消息怎么流过来、断了怎么接、补发和打断谁说了算”。

所以后面单独落了 [src/ui/playground-stream-controller.ts](/E:/AII/ugk-pi/src/ui/playground-stream-controller.ts)，把这些从主文件剥出去：

- `readEventStream()`
- `handleStreamEvent()`
- `send / queue / interrupt`
- `stream / events / notifications` 续订
- 断线恢复与运行态继续跟随

### 4. 最后收口 assembler

当 controller 和 renderer 都拆完后，主文件还留着一堆遗留初始化和死 helper 就很丢人。

所以最后又收了两件事：

- 删除没在用的 `fetchConversationHistory()`
- 明确化 `bindPlaygroundAssemblerEvents()` 与 `initializePlaygroundAssembler()`

到这一步，`playground.ts` 才算真的像 assembler。

## 这轮真修掉的坑

下面这些不是“代码更优雅了”那么轻飘飘，而是用户真实能踩到的坑：

### 旧会话异步回包污染当前页面

问题：

- 新建会话或切会话后，旧的 `/v1/chat/state` 回包慢一点回来
- 当前页面会被旧会话 transcript 覆盖

收口：

- 在 [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts) 建立统一的 conversation sync ownership
- 老请求回来了也没有资格覆盖当前页面

对应提交：

- `2d2877c fix: guard stale playground conversation restores`
- `9ab8898 fix: unify playground conversation sync ownership`

### 中断后刷新出现重复过程壳子 / 重复提问

问题：

- “补充消息 -> 中断 -> 刷新” 后
- history 里已有 partial reply，但 terminal interrupted state 又再返一遍
- 页面像中邪一样重复

收口：

- 在 [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts) 以 canonical conversation state 为准
- history 已覆盖 terminal snapshot 时不再重复返回

对应提交：

- `cafed88 fix: dedupe interrupted terminal state on refresh`

### 历史消息时间全变成 `08:00:00`

问题：

- 刷新后历史消息 `createdAt` 被错误落成 Unix epoch
- 前端一按东八区格式化，全员 `08:00:00`

收口：

- `AgentService` 透传 session message 的真实 `timestamp`

对应提交：

- `c3fc7c3 fix: preserve playground history timestamps`

### 桌面头部结构还是两套

问题：

- `landing-side-right` 漂在 hero 上方
- `topbar` 里又有一套旧字标占位

收口：

- 桌面工具栏并入 `topbar`
- 移除旧的 `topbar-signal`

对应提交：

- `8e5636a refactor: move desktop landing toolbar into topbar`

## 本轮关键提交

建议后续排查 `playground` 时优先看这些提交，不要在一堆零碎 UI 改动里瞎游泳：

1. `dc1d933 refactor: split playground conversations controller`
2. `3577529 refactor: split playground layout controller`
3. `5f2f85c refactor: split playground transcript renderer`
4. `2d2877c fix: guard stale playground conversation restores`
5. `9ab8898 fix: unify playground conversation sync ownership`
6. `dfaa9d9 refactor: split playground stream controller`
7. `cafed88 fix: dedupe interrupted terminal state on refresh`
8. `c3fc7c3 fix: preserve playground history timestamps`
9. `8e5636a refactor: move desktop landing toolbar into topbar`
10. `55cb5ce refactor: trim playground assembler runtime`

## 备份锚点

这轮高风险修改前后留过回滚锚点，别后面谁又假装仓库天生就长这样：

- `backup/playground-pre-sync-ownership-2026-04-22`
- `backup-playground-pre-sync-ownership-2026-04-22`
- `backup/playground-pre-stream-split-2026-04-22`
- `backup-playground-pre-stream-split-2026-04-22`
- `backup/playground-pre-timestamp-fix-2026-04-22`
- `backup-playground-pre-timestamp-fix-2026-04-22`
- `backup/playground-pre-assembler-trim-2026-04-22`
- `backup-playground-pre-assembler-trim-2026-04-22`

## 后续别乱碰的地方

### 1. 不要把 controller 再揉回 `playground.ts`

加新功能时，如果属于现有边界，就往对应 controller / renderer 里加；别图省事往主文件尾巴一塞。那种做法爽一小时，后面两周都在还债。

### 2. 不要绕开 canonical conversation state

刷新恢复、会话切换、运行中断、追加消息这些行为，必须以 `/v1/chat/state` 的 canonical state 为准。前端本地拼一套“我觉得现在应该是这样”的状态，很容易再次把竞态和重复渲染召回来。

### 3. 不要把 `running` 和“浏览器流断了”混为一谈

只要 `/v1/chat/state` 仍显示 running，前端就应该按既定口径续订 `/v1/chat/events`。别又把浏览器生命周期断线误判成 agent 任务失败。

### 4. 不要轻易改复制按钮、消息宽度和底部滚动缓冲

这些看上去只是 UI 细节，实际上都和当前交互口径绑在一起。改之前先看 [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)。

## 接手建议

如果后面有人继续改 `playground`，建议顺序是：

1. 先看 [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
2. 再看这份阶段总结
3. 再按 [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md) 走到具体文件
4. 真要动运行态或恢复链路时，再去看 [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts) 和 [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)

别一上来就全仓乱翻，那是给自己增加工作量，不是认真。

## 回归清单

每次再碰 `playground`，至少回归这些：

1. 新建会话、切会话、刷新恢复，不串线
2. 运行中补充消息、打断、刷新，不重复气泡
3. 历史消息时间戳正常，不再全员 `08:00:00`
4. 用户上滑读历史时，新内容不强拉到底部
5. 桌面 topbar 与手机 topbar 各走各的，不互相串样式
6. markdown、代码块 copy、正文复制、文件卡片都还活着
7. `GET /v1/chat/state`、`GET /v1/chat/events`、`GET /v1/notifications/stream` 的协作链没有被破坏

## 相关文档

- [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
- [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
- [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)
