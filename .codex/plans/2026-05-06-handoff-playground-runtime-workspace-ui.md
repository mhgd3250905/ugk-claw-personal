# Playground 运行中 workspace 与桌面 header 交接

## 当前状态

- 已完成：会话运行中继续禁止“新会话”切线，但文件库入口保持可点击，用户可以选择文件后回到 composer 补充下一条消息。
- 已完成：桌面 workspace 内 topbar 左侧显示“回到会话”时保持可点击，返回 chat 后恢复“新会话”的运行中禁用规则。
- 已完成：桌面上下文用量按钮点击不再把 hover tooltip 常驻；移动端点击仍打开上下文详情 dialog。
- 已完成：桌面文件库 / 任务消息 workspace header 美化为紧凑 command bar；左侧只保留竖向强调线和页面标题，已移除 `工作区 /` breadcrumb 与桌面空数量胶囊。
- 未完成：未做 git commit、未 push、未部署到服务器。
- 阻塞点：无代码阻塞；需要用户决定是提交本地 commit、生成 patch，还是继续本地观察。

## 关键文件

- `src/ui/playground-status-controller.ts`
- `src/ui/playground-workspace-controller.ts`
- `src/ui/playground-assets-controller.ts`
- `src/ui/playground-context-usage-controller.ts`
- `src/ui/playground-assets.ts`
- `src/ui/playground-styles.ts`
- `src/ui/playground-task-inbox.ts`
- `src/ui/playground-theme-controller.ts`
- `test/playground-status-controller.test.ts`
- `test/playground-assets-controller.test.ts`
- `test/playground-workspace-controller.test.ts`
- `test/playground-context-usage-controller.test.ts`
- `test/playground-styles.test.ts`
- `test/server.test.ts`
- `docs/playground-current.md`
- `docs/change-log.md`
- `docs/handoff-current.md`

## 验证记录

已通过：

- `git diff --check`
- `npx tsc --noEmit`
- `node --test --import tsx test/playground-status-controller.test.ts test/playground-assets-controller.test.ts`
- `node --test --import tsx test/playground-workspace-controller.test.ts test/playground-status-controller.test.ts`
- `node --test --import tsx test/playground-context-usage-controller.test.ts`
- `node --test --import tsx test/playground-styles.test.ts`
- `node --test --import tsx test/server.test.ts --test-name-pattern "GET /playground returns the test UI html"`，实际跑完 `110 pass / 0 fail`
- `docker compose restart ugk-pi`
- `GET http://127.0.0.1:3000/healthz`
- 真实浏览器验证文件库 header：`text = "可复用资产"`、`countDisplay = "none"`、`hasBreadcrumb = false`

未运行及原因：

- `npm test` 全量未跑；本轮影响集中在 Playground 前端控制器和页面拼装，已跑相关 controller / styles / server HTML 验证。若准备正式 commit 后推送生产，建议再跑一次 `npm test`。

## 工作区边界

建议提交：

- `docs/change-log.md`
- `docs/playground-current.md`
- `docs/handoff-current.md`
- `.codex/plans/2026-05-06-handoff-playground-runtime-workspace-ui.md`
- `src/ui/playground-assets-controller.ts`
- `src/ui/playground-assets.ts`
- `src/ui/playground-context-usage-controller.ts`
- `src/ui/playground-status-controller.ts`
- `src/ui/playground-styles.ts`
- `src/ui/playground-task-inbox.ts`
- `src/ui/playground-theme-controller.ts`
- `src/ui/playground-workspace-controller.ts`
- `test/playground-assets-controller.test.ts`
- `test/playground-workspace-controller.test.ts`
- `test/playground-context-usage-controller.test.ts`
- `test/playground-status-controller.test.ts`
- `test/playground-styles.test.ts`
- `test/server.test.ts`

不要提交：

- `runtime/dangyang-weather-2026-05-01.json`
- `runtime/dev-server.log`
- `runtime/karpathy-guidelines-CLAUDE.md`
- `runtime/tab-accumulation-report.md`

需要用户确认：

- 是否现在提交 commit。
- 是否提交前补跑 `npm test` 全量。
- 是否需要同步到 GitHub / 服务器。当前只是本地 Docker 已验证，不是生产发布。

## 下一步

1. 如果用户要保存备份，先跑 `npm test` 或至少确认当前验证组合已足够。
2. 只 stage “建议提交”清单里的文件，不要把 `runtime/` 临时文件混进去。
3. commit 后可按服务器 runbook 做增量发布；不做整目录覆盖。
