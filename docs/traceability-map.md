# 追溯地图

这份文档只回答一个问题：

“我现在碰到某类问题，先看哪几个文件最省命？”

## A. 快速接手项目

先看：

1. [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
2. [README.md](/E:/AII/ugk-pi/README.md)
3. [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
4. [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
5. [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
6. [docs/handoff-current.md](/E:/AII/ugk-pi/docs/handoff-current.md)
6. [src/server.ts](/E:/AII/ugk-pi/src/server.ts)
7. [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
8. [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
9. [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
10. [src/ui/playground-page-shell.ts](/E:/AII/ugk-pi/src/ui/playground-page-shell.ts)
11. [src/ui/playground-styles.ts](/E:/AII/ugk-pi/src/ui/playground-styles.ts)
12. [src/ui/playground-assets.ts](/E:/AII/ugk-pi/src/ui/playground-assets.ts)
13. [src/ui/playground-assets-controller.ts](/E:/AII/ugk-pi/src/ui/playground-assets-controller.ts)
14. [src/ui/playground-context-usage-controller.ts](/E:/AII/ugk-pi/src/ui/playground-context-usage-controller.ts)
15. [src/ui/playground-conversations-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conversations-controller.ts)
16. [src/ui/playground-layout-controller.ts](/E:/AII/ugk-pi/src/ui/playground-layout-controller.ts)
17. [src/ui/playground-transcript-renderer.ts](/E:/AII/ugk-pi/src/ui/playground-transcript-renderer.ts)
18. [src/ui/playground-markdown.ts](/E:/AII/ugk-pi/src/ui/playground-markdown.ts)
19. [src/ui/playground-stream-controller.ts](/E:/AII/ugk-pi/src/ui/playground-stream-controller.ts)
20. [src/ui/playground-mobile-shell-controller.ts](/E:/AII/ugk-pi/src/ui/playground-mobile-shell-controller.ts)
21. [src/ui/playground-panel-focus-controller.ts](/E:/AII/ugk-pi/src/ui/playground-panel-focus-controller.ts)
22. [src/ui/playground-conn-activity.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity.ts)
23. [src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)

当前阶段先记住这句话：`web-access` 默认是 Docker Chrome sidecar，不是 Windows 宿主 IPC。后续看到 `requestHostBrowser()` 这个名字别被它骗了，它在 `direct_cdp` 模式下会直接连 sidecar。

再记一句：当前代码主仓库已经切到 GitHub，服务器默认部署目录也已经迁到 `~/ugk-claw-repo`；旧的 `~/ugk-pi-claw` 只留给回滚和比对，别再把它当默认更新入口。

如果是云端 `/init`，再记一句：

- 服务器当前默认工作目录是 `~/ugk-claw-repo`，已经能直接 `git pull`；但旧的 `~/ugk-pi-claw` 还在，别在错误目录里更新完了还以为自己部署成功。
- 服务器当前 shared 运行态目录是 `~/ugk-claw-shared`；如果你在仓库目录里找 `.env`、`.data/chrome-sidecar` 或生产日志，先想想自己是不是又走回头路了。
- 如果这次 `/init` 还要接手 `playground` 前端，先读 [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)；当前手机端是单独重写的移动展示层，不要按桌面端缩略版理解
- 如果这次还要接着改 `playground` runtime，而不是只看当前 UI 口径，再补读 [docs/playground-runtime-refactor-summary-2026-04-22.md](/E:/AII/ugk-pi/docs/playground-runtime-refactor-summary-2026-04-22.md)；这轮 controller / renderer / sync ownership / stream lifecycle 是怎么收口的，都在那里，别重复考古
- 如果这次目标是直接交接、发布或接线上盘，优先读 [docs/handoff-current.md](/E:/AII/ugk-pi/docs/handoff-current.md)；当前稳定 tag、线上已部署提交、回滚点和推荐阅读顺序都在那里，别再拿旧 tag 当新基线

## B. 聊天、流式、追加消息、打断

先看：

1. [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
2. [src/routes/chat-route-parsers.ts](/E:/AII/ugk-pi/src/routes/chat-route-parsers.ts)
3. [src/routes/http-errors.ts](/E:/AII/ugk-pi/src/routes/http-errors.ts)
4. [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
5. [src/agent/agent-conversation-history.ts](/E:/AII/ugk-pi/src/agent/agent-conversation-history.ts)
6. [src/agent/agent-process-text.ts](/E:/AII/ugk-pi/src/agent/agent-process-text.ts)
7. [src/agent/agent-active-run-view.ts](/E:/AII/ugk-pi/src/agent/agent-active-run-view.ts)
8. [src/agent/agent-session-event-guards.ts](/E:/AII/ugk-pi/src/agent/agent-session-event-guards.ts)
9. [src/agent/agent-run-events.ts](/E:/AII/ugk-pi/src/agent/agent-run-events.ts)
10. [src/agent/agent-session-factory.ts](/E:/AII/ugk-pi/src/agent/agent-session-factory.ts)
11. [src/types/api.ts](/E:/AII/ugk-pi/src/types/api.ts)

重点接口：

- `GET /v1/chat/status`
- `GET /v1/chat/state`
- `GET /v1/chat/events`
- `GET /v1/chat/conversations`
- `POST /v1/chat/conversations`
- `POST /v1/chat/current`
- `POST /v1/chat/reset`
- `POST /v1/chat`
- `POST /v1/chat/stream`
- `POST /v1/chat/queue`
- `POST /v1/chat/interrupt`

## C. Playground 页面、消息气泡、过程区

先看：

1. [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
2. [src/ui/playground-page-shell.ts](/E:/AII/ugk-pi/src/ui/playground-page-shell.ts)
3. [src/ui/playground-styles.ts](/E:/AII/ugk-pi/src/ui/playground-styles.ts)
4. [src/ui/playground-assets.ts](/E:/AII/ugk-pi/src/ui/playground-assets.ts)
5. [src/ui/playground-assets-controller.ts](/E:/AII/ugk-pi/src/ui/playground-assets-controller.ts)
6. [src/ui/playground-context-usage-controller.ts](/E:/AII/ugk-pi/src/ui/playground-context-usage-controller.ts)
7. [src/ui/playground-conversations-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conversations-controller.ts)
8. [src/ui/playground-layout-controller.ts](/E:/AII/ugk-pi/src/ui/playground-layout-controller.ts)
9. [src/ui/playground-transcript-renderer.ts](/E:/AII/ugk-pi/src/ui/playground-transcript-renderer.ts)
10. [src/ui/playground-markdown.ts](/E:/AII/ugk-pi/src/ui/playground-markdown.ts)
11. [src/ui/playground-stream-controller.ts](/E:/AII/ugk-pi/src/ui/playground-stream-controller.ts)
12. [src/ui/playground-mobile-shell-controller.ts](/E:/AII/ugk-pi/src/ui/playground-mobile-shell-controller.ts)
13. [src/ui/playground-panel-focus-controller.ts](/E:/AII/ugk-pi/src/ui/playground-panel-focus-controller.ts)
14. [src/ui/playground-conn-activity.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity.ts)
15. [src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)
16. [src/ui/playground-task-inbox.ts](/E:/AII/ugk-pi/src/ui/playground-task-inbox.ts)
17. [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
18. [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
19. [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
20. [docs/playground-runtime-refactor-summary-2026-04-22.md](/E:/AII/ugk-pi/docs/playground-runtime-refactor-summary-2026-04-22.md)

适用问题：

- 助手/用户消息样式
- 过程区与 loading 气泡
- markdown hydration、代码块 copy toolbar、复制正文按钮、历史恢复后的消息拼装；服务器端 markdown HTML 渲染看 `src/ui/playground-markdown.ts`，浏览器端 hydration 看 `src/ui/playground-transcript-renderer.ts`
- 上下文用量进度环、token 估算、详情弹层和输入实时重算；运行时逻辑看 `src/ui/playground-context-usage-controller.ts`
- 文件卡片“打开 / 下载”；文件上传区、文件 chip、资产库弹窗静态片段先看 `src/ui/playground-assets.ts`，运行时上传、拖拽、复用和下载卡片逻辑看 `src/ui/playground-assets-controller.ts`
- 后台 conn 结果的“查看任务过程”入口；静态样式 / 弹窗 HTML 先看 `src/ui/playground-conn-activity.ts`，浏览器运行时逻辑看 `src/ui/playground-conn-activity-controller.ts`
- 任务消息页、跨会话 conn 结果观察、`/v1/activity` 读取；任务消息主体在 `src/ui/playground-task-inbox.ts`，后台 run 详情弹层仍复用 `src/ui/playground-conn-activity.ts` 和 `src/ui/playground-conn-activity-controller.ts`
- 文件库、任务消息、后台任务、确认框等弹层的关闭前焦点释放和返回焦点恢复；共享 helper 看 `src/ui/playground-panel-focus-controller.ts`
- 刷新后运行态恢复
- 新会话创建、当前会话切换、刷新后跟随服务端当前会话
- 发送后立即清空输入框
- 手机端紧凑品牌状态栏、左侧历史会话抽屉、右上角溢出菜单、底部 icon 发送区
- 手机端代码块宽度、复制 icon 与透明壳层
- 底部 composer 遮挡最后一条消息、active transcript 滚动缓冲、最后一屏无法继续上拖
- composer 高度同步、回到底部按钮、用户上滑读历史时不抢滚动、`visibilitychange/pageshow/online` 恢复入口
- `/v1/chat/stream`、`/v1/chat/events`、`/v1/notifications/stream`、断线恢复、`send / queue / interrupt`

## D. 文件上传、资产复用、send_file、本地报告访问

先看：

1. [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
2. [src/routes/file-route-utils.ts](/E:/AII/ugk-pi/src/routes/file-route-utils.ts)
3. [src/routes/static.ts](/E:/AII/ugk-pi/src/routes/static.ts)
4. [src/agent/asset-store.ts](/E:/AII/ugk-pi/src/agent/asset-store.ts)
5. [src/ui/playground-assets.ts](/E:/AII/ugk-pi/src/ui/playground-assets.ts)
6. [src/ui/playground-assets-controller.ts](/E:/AII/ugk-pi/src/ui/playground-assets-controller.ts)
7. [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
8. [src/agent/agent-file-history.ts](/E:/AII/ugk-pi/src/agent/agent-file-history.ts)
9. [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
10. [.pi/extensions/send-file.ts](/E:/AII/ugk-pi/.pi/extensions/send-file.ts)
11. [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

适用问题：
- 浏览器选择文件后没反应、上传接口返回 `413` 或 `400`
- 大文件不应该再被 base64 塞进 JSON body
- `conn` 编辑器上传新文件失败，或者上传后没有进入“附加资料”
- `send_file` 没出现在文件卡片里
- `send_file` 工具结果在流式 done、刷新恢复或历史消息里没有挂回文件卡片；解析和合并逻辑看 `src/agent/agent-file-history.ts`
- 图片/报告下载 0B
- 用户拿到的是容器 `file:///app/...`
- HTML / 图片已经生成，但浏览器打不开
- `/v1/local-file?path=...` 返回异常

如果问题是“agent 内部想继续用 `file:///app/...`，但用户看到的地址必须能打开”，重点看：

- [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
- [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)

## E. 技能加载、真实技能清单、web-access

先看：

1. `GET /v1/debug/skills`
2. [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
3. [.pi/skills](/E:/AII/ugk-pi/.pi/skills)
4. [runtime/skills-user](/E:/AII/ugk-pi/runtime/skills-user)
5. [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
6. [src/agent/browser-cleanup.ts](/E:/AII/ugk-pi/src/agent/browser-cleanup.ts)

如果问题跟以下内容有关，直接进 web-access 专题文档，不要在别的地方绕：

- host browser bridge
- Docker Chrome sidecar
- `WEB_ACCESS_BROWSER_PROVIDER=direct_cdp`
- `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL`
- `POST /session/close-all?metaAgentScope=...`
- Chrome 持久 profile
- `local_browser_executable_not_found`
- `chrome_cdp_unreachable`
- `/x-search-latest:*`
- X 登录态

如果现象是“sidecar GUI 像没登录，但 agent 还能跑”或“更新后看起来像丢登录”，先看：

- [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
- [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

重点核对 `9222/9223`、desktop launcher 是否指向 `ugk-sidecar-chrome`，以及进程是否仍然挂在 `chrome-profile-sidecar`；别一上来就脑补 shared 目录被清空。

## F. Subagent、项目级 prompt、防护

先看：

1. [.pi/extensions/subagent/index.ts](/E:/AII/ugk-pi/.pi/extensions/subagent/index.ts)
2. [.pi/extensions/subagent/agents.ts](/E:/AII/ugk-pi/.pi/extensions/subagent/agents.ts)
3. [.pi/extensions/project-guard.ts](/E:/AII/ugk-pi/.pi/extensions/project-guard.ts)
4. [.pi/agents](/E:/AII/ugk-pi/.pi/agents)
5. [runtime/agents-user](/E:/AII/ugk-pi/runtime/agents-user)
6. [.pi/prompts](/E:/AII/ugk-pi/.pi/prompts)

## G. Conn / Feishu 集成

先看：

1. [src/routes/conns.ts](/E:/AII/ugk-pi/src/routes/conns.ts)
2. [src/routes/conn-route-parsers.ts](/E:/AII/ugk-pi/src/routes/conn-route-parsers.ts)
3. [src/routes/conn-route-presenters.ts](/E:/AII/ugk-pi/src/routes/conn-route-presenters.ts)
4. [src/routes/activity.ts](/E:/AII/ugk-pi/src/routes/activity.ts)
5. [src/routes/activity-route-utils.ts](/E:/AII/ugk-pi/src/routes/activity-route-utils.ts)
6. [src/routes/feishu.ts](/E:/AII/ugk-pi/src/routes/feishu.ts)
6. [src/agent/conn-store.ts](/E:/AII/ugk-pi/src/agent/conn-store.ts)
7. [src/agent/conn-db.ts](/E:/AII/ugk-pi/src/agent/conn-db.ts)
8. [src/agent/conn-sqlite-store.ts](/E:/AII/ugk-pi/src/agent/conn-sqlite-store.ts)
9. [src/agent/conn-run-store.ts](/E:/AII/ugk-pi/src/agent/conn-run-store.ts)
10. [src/agent/agent-activity-store.ts](/E:/AII/ugk-pi/src/agent/agent-activity-store.ts)
11. [src/agent/background-agent-runner.ts](/E:/AII/ugk-pi/src/agent/background-agent-runner.ts)
12. [src/workers/conn-worker.ts](/E:/AII/ugk-pi/src/workers/conn-worker.ts)
13. [src/integrations/feishu/service.ts](/E:/AII/ugk-pi/src/integrations/feishu/service.ts)
14. [src/integrations/feishu/conversation-map-store.ts](/E:/AII/ugk-pi/src/integrations/feishu/conversation-map-store.ts)
15. [src/integrations/feishu/message-parser.ts](/E:/AII/ugk-pi/src/integrations/feishu/message-parser.ts)
16. [test/feishu-message-parser.test.ts](/E:/AII/ugk-pi/test/feishu-message-parser.test.ts)
17. [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)
18. [src/ui/playground-conn-activity.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity.ts)
19. [src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)
20. [src/ui/playground-task-inbox.ts](/E:/AII/ugk-pi/src/ui/playground-task-inbox.ts)

## H. 容器、部署、健康检查、截图

先看：

1. [Dockerfile](/E:/AII/ugk-pi/Dockerfile)
2. [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
3. [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
4. [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
5. [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
6. [docs/handoff-current.md](/E:/AII/ugk-pi/docs/handoff-current.md)
7. [src/server.ts](/E:/AII/ugk-pi/src/server.ts)
8. [src/routes/static.ts](/E:/AII/ugk-pi/src/routes/static.ts)
9. [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
10. [runtime/screenshot.mjs](/E:/AII/ugk-pi/runtime/screenshot.mjs)
11. [runtime/screenshot-mobile.mjs](/E:/AII/ugk-pi/runtime/screenshot-mobile.mjs)

适用问题：

- `healthz` 不通
- 腾讯云新加坡服务器更新部署、回滚或 SSH tunnel 不通
- 静态 HTML / PNG 路由不通
- 截图脚本又回退到 `file://`
- `PUBLIC_BASE_URL` 不对
- sidecar Chrome 打开本地 HTML 时访问到 `127.0.0.1:3000` 造成 404
- `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL` 没有指向 `http://ugk-pi:3000`

## I. Realtime Notification Broadcast

先看：
1. [src/routes/notifications.ts](/E:/AII/ugk-pi/src/routes/notifications.ts)
2. [src/routes/notification-route-utils.ts](/E:/AII/ugk-pi/src/routes/notification-route-utils.ts)
3. [src/routes/activity.ts](/E:/AII/ugk-pi/src/routes/activity.ts)
4. [src/routes/activity-route-utils.ts](/E:/AII/ugk-pi/src/routes/activity-route-utils.ts)
5. [src/agent/notification-hub.ts](/E:/AII/ugk-pi/src/agent/notification-hub.ts)
6. [src/agent/agent-activity-store.ts](/E:/AII/ugk-pi/src/agent/agent-activity-store.ts)
7. [src/workers/conn-worker.ts](/E:/AII/ugk-pi/src/workers/conn-worker.ts)
8. [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
9. [src/ui/playground-stream-controller.ts](/E:/AII/ugk-pi/src/ui/playground-stream-controller.ts)
10. [src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)
11. [src/ui/playground-task-inbox.ts](/E:/AII/ugk-pi/src/ui/playground-task-inbox.ts)
12. [test/notification-hub.test.ts](/E:/AII/ugk-pi/test/notification-hub.test.ts)
13. [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)

适用问题：
- conn 任务明明跑完了，但在线页面不弹实时提示
- worker 广播地址在 Docker 里打到了自己
- SSE 断线后页面不重连
- 当前会话和非当前会话的提示表现不一致
- conn 结果已经完成，但切换会话后只能靠任务消息页找到
