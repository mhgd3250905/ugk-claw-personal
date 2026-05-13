# 架构治理测试矩阵

更新时间：`2026-05-06`

这份文档用于架构治理期间选择测试命令。目标不是把所有测试背下来，而是让每次改动都有清楚的最小验证范围。否则改一行 UI 就全量跑半天，改一条后台链路却只看页面 HTML，那都挺离谱。

## 总体验证层级

| 层级 | 命令 | 何时使用 |
| --- | --- | --- |
| 格式与空白检查 | `git diff --check` | 每次提交前；文档改动也要跑 |
| 类型检查 | `npx tsc --noEmit` | 涉及 `src/`、`test/`、类型、接口响应、构建入口 |
| 定向 Node test | `node --test --import tsx <files>` | 单个业务域改动后先跑 |
| 全量测试 | `npm test` | 合并前、跨域改动后、运行时/API/worker 行为变化后；Windows 本地固定串行运行，避免多个 `buildServer()` 并发初始化默认 SQLite 锁库 |
| 设计规范 | `npm run design:lint` | 改 `DESIGN.md` 或视觉 token / 组件视觉语义 |
| 浏览器 sidecar | `npm run docker:chrome:check` | 改 web-access、browser cleanup、Docker Chrome sidecar、文件预览自动化 |

## Chat / Agent Runtime

### 适用改动

- `src/agent/agent-service.ts`
- `src/agent/agent-session-factory.ts`
- `src/agent/agent-conversation-*`
- `src/agent/agent-run-*`
- `src/agent/agent-session-event-*`
- `src/routes/chat.ts`
- `src/routes/chat-route-parsers.ts`
- `src/routes/chat-sse.ts`
- `src/types/api.ts` 中聊天响应结构

### 最小测试

```bash
node --test --import tsx test/agent-service.test.ts
node --test --import tsx test/chat-route-parsers.test.ts test/chat-sse.test.ts test/chat-agent-routes.test.ts
```

### 扩展测试

```bash
node --test --import tsx test/agent-conversation-catalog.test.ts test/agent-conversation-commands.test.ts test/agent-conversation-context.test.ts test/agent-conversation-history.test.ts test/agent-conversation-session.test.ts test/agent-conversation-state.test.ts
node --test --import tsx test/agent-active-run-view.test.ts test/agent-run-events.test.ts test/agent-run-result.test.ts test/agent-run-scope.test.ts test/agent-terminal-run.test.ts
node --test --import tsx test/agent-session-event-adapter.test.ts test/agent-session-event-guards.test.ts test/agent-prompt-assets.test.ts test/agent-queue-message.test.ts
```

### 必跑全量条件

- 改 `AgentService.runChat()`。
- 改 active run / terminal run 状态。
- 改 SSE event 结构。
- 改会话 current pointer 语义。
- 改本地 artifact / `send_file` 合并逻辑。

## Agent Profile

### 适用改动

- `src/agent/agent-profile.ts`
- `src/agent/agent-profile-bootstrap.ts`
- `src/agent/agent-profile-catalog.ts`
- `src/agent/agent-service-registry.ts`
- `src/routes/agent-profiles.ts`
- `.pi/skills/agent-profile-ops/`
- `/v1/agents*` 路由

### 最小测试

```bash
node --test --import tsx test/agent-profile.test.ts test/agent-profile-bootstrap.test.ts test/agent-profile-catalog.test.ts test/agent-service-registry.test.ts
node --test --import tsx test/agent-profile-ops-skill.test.ts test/playground-agent-switch.test.ts test/search-agent-skills.test.ts
```

### 集成烟测

`test/server.test.ts` 中覆盖：

- `GET /v1/agents`
- `POST /v1/agents`
- scoped agent chat routes
- Playground agent switcher DOM / browser API

如改 agent route，需要额外跑：

```bash
node --test --import tsx test/server.test.ts --test-name-pattern "agent"
```

## Playground Shell / Styles / Controllers

### 适用改动

- `src/ui/playground.ts`
- `src/ui/playground-page-shell.ts`
- `src/ui/playground-styles.ts`
- `src/ui/playground-theme-controller.ts`
- `src/ui/playground-workspace-controller.ts`
- `src/ui/playground-*-controller.ts`
- `src/ui/playground-transcript-renderer.ts`
- `src/ui/playground-markdown.ts`
- `DESIGN.md`
- `docs/playground-current.md`

### 最小测试

```bash
node --test --import tsx test/playground-page-shell.test.ts test/playground-styles.test.ts
node --test --import tsx test/playground-active-run-normalizer.test.ts test/playground-confirm-dialog-controller.test.ts test/playground-context-usage-controller.test.ts test/playground-conversation-api-controller.test.ts test/playground-conversation-history-store.test.ts test/playground-conversation-state-controller.test.ts test/playground-conversation-sync-controller.test.ts test/playground-history-pagination-controller.test.ts test/playground-notification-controller.test.ts test/playground-panel-focus-controller.test.ts test/playground-process-controller.test.ts test/playground-status-controller.test.ts
```

### `/playground` 集成测试

```bash
node --test --import tsx test/server.test.ts --test-name-pattern "GET /playground"
```

### 设计验证

```bash
npm run design:lint
```

仅在改 `DESIGN.md`、视觉 token、组件语义、颜色、字号、圆角时必跑。

### 必跑全量条件

- 改 `playground.ts` 的 assembler 顺序。
- 改 `playground-styles.ts` 大块样式覆盖顺序。
- 改 mobile / desktop 分流。
- 改 workspace mode。
- 改 conversation sync / stream lifecycle。

## Assets / Files / Local Artifact

### 适用改动

- `src/routes/assets.ts`
- `src/routes/files.ts`
- `src/routes/file-route-utils.ts`
- `src/routes/static.ts`
- `src/agent/asset-store.ts`
- `src/agent/file-artifacts.ts`
- `src/agent/agent-file-history.ts`
- `src/agent/agent-prompt-assets.ts`
- `.pi/extensions/send-file.ts`
- `src/ui/playground-assets.ts`
- `src/ui/playground-assets-controller.ts`

### 最小测试

```bash
node --test --import tsx test/asset-store.test.ts test/file-artifacts.test.ts test/file-route-utils.test.ts test/send-file-extension.test.ts
```

### 集成测试

```bash
node --test --import tsx test/server.test.ts --test-name-pattern "assets|local-file|Agave|upload"
```

### 必跑全量条件

- 改 `/v1/local-file` 安全边界。
- 改文件上传大小限制或 multipart 行为。
- 改 `send_file` 历史挂载。
- 改 HTML inline / download 规则。

## Conn / Activity / Output

### 适用改动

- `src/routes/conns.ts`
- `src/routes/conn-route-parsers.ts`
- `src/routes/conn-route-presenters.ts`
- `src/routes/activity.ts`
- `src/routes/activity-route-utils.ts`
- `src/routes/cleanup-debug.ts`
- `src/server.ts` 中 `connStore` / `connRunStore` / `activityStore` 装配
- `src/agent/conn-db.ts`
- `src/agent/conn-sqlite-store.ts`
- `src/agent/conn-run-store.ts`
- `src/agent/conn-store.ts`
- `src/agent/agent-activity-store.ts`
- `src/agent/background-agent-runner.ts`
- `src/agent/background-workspace.ts`
- `src/workers/conn-worker.ts`
- `src/ui/playground-conn-activity.ts`
- `src/ui/playground-conn-activity-controller.ts`
- `src/ui/playground-task-inbox.ts`

### 最小测试

```bash
node --test --import tsx test/conn-db.test.ts test/conn-sqlite-store.test.ts test/conn-run-store.test.ts test/conn-store.test.ts test/conn-route-presenters.test.ts test/conn-extension.test.ts
node --test --import tsx test/agent-activity-store.test.ts test/activity-route-utils.test.ts test/cleanup-debug.test.ts test/notification-hub.test.ts test/notification-route-utils.test.ts
```

### Worker / background 测试

```bash
node --test --import tsx test/background-agent-profile.test.ts test/background-agent-runner.test.ts test/background-workspace.test.ts test/conn-worker.test.ts
```

### UI / route 集成测试

```bash
node --test --import tsx test/server.test.ts --test-name-pattern "conns|activity|debug/cleanup|task inbox|conn"
node --test --import tsx test/playground-conn-activity-controller.test.ts
```

### Server 注入规则

`buildServer()` 测试里如果注入任一 conn store，优先同时注入 `connStore`、`connRunStore` 和 `activityStore`。三者都注入时不会创建默认 `ConnDatabase`；只注入其中一部分时，未注入的 store 会由默认数据库补齐。这条规则是为了避免测试意外打开共享 SQLite，别又让锁库问题返场。

### 必跑全量条件

- 改 SQLite schema 或 migration。
- 改 conn soft delete。
- 改 run lease / heartbeat / timeout。
- 改 activity 投递。
- 改 output/latest URL。
- 改 Feishu activity notification 镜像。

### 运行态观测

服务启动后检查：

```bash
curl "http://127.0.0.1:3000/v1/debug/cleanup?since=<ISO time>"
```

不要只看 `/healthz`，那东西只能说明服务没死，不能说明后台链路没歪。

## Feishu

### 适用改动

- `src/workers/feishu-worker.ts`
- `src/integrations/feishu/*`
- `src/routes/feishu-settings.ts`
- Feishu settings / delivery / parser / gateway
- `docker-compose*.yml` 中 Feishu worker 配置

### 最小测试

```bash
node --test --import tsx test/feishu-message-parser.test.ts test/feishu-service.test.ts test/feishu-http-agent-gateway.test.ts test/feishu-settings-store.test.ts test/feishu-ws-subscription.test.ts
```

### 相关测试

```bash
node --test --import tsx test/conn-worker.test.ts
```

当改后台 activity 镜像到 Feishu 时必须加上。

## Runtime Debug / Deployment / Browser

### 适用改动

- `src/routes/runtime-debug.ts`
- `src/routes/model-config.ts`
- `src/agent/model-config.ts`
- `src/agent/browser-cleanup.ts`
- Dockerfile / compose
- scripts / server ops
- web-access / sidecar bridge

### 最小测试

```bash
node --test --import tsx test/runtime-debug.test.ts test/model-config.test.ts test/config.test.ts
node --test --import tsx test/containerization.test.ts test/server-ops-script.test.ts
node --test --import tsx test/browser-cleanup.test.ts test/local-cdp-browser.test.ts test/web-access-host-bridge.test.ts test/web-access-proxy.test.ts
```

### 浏览器链路验证

```bash
npm run docker:chrome:check
```

### 必跑全量条件

- 改 Dockerfile、compose、server ops。
- 改 `PUBLIC_BASE_URL` / `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL` 相关逻辑。
- 改 browser cleanup scope。
- 改 model settings 运行态持久化。

## Skills / Extensions / Project Guard

### 适用改动

- `.pi/skills/*`
- `.pi/extensions/*`
- `.pi/agents/*`
- `runtime/skills-user/*`
- `runtime/agents-user/*`

### 最小测试

```bash
node --test --import tsx test/project-guard.test.ts test/subagent.test.ts test/search-agent-skills.test.ts
node --test --import tsx test/searxng-search-skill.test.ts test/site-search-skill-designer.test.ts test/x-search-latest-skill.test.ts
```

涉及 `send_file` 时加：

```bash
node --test --import tsx test/send-file-extension.test.ts
```

## `test/server.test.ts` 职责拆分建议

### 必须保留在 `server.test.ts`

这些断言属于跨模块集成烟测，不建议拆空：

- `GET /playground` 是否能注册并返回完整页面。
- externalized runtime assets 是否能通过 `/playground/styles.css`、`/playground/app.js`、vendor 路由访问。
- `/v1/chat/*` 通过 Fastify server 实际路由调用到 agent service。
- `/v1/conns/*` output 文件路由真实读取 indexed 文件。
- `/v1/activity` 通过真实 route presenter 返回 unread / pagination。
- `/v1/debug/*` 是否注册在主 server。
- assets upload / local-file 路由实际 HTTP 行为。

### 可评估迁移到更窄测试

这些断言主要检查静态 HTML / CSS 字符串，后续可以逐步迁移，但不要一次性大搬家：

- 大量 `GET /playground` CSS 颜色、圆角、移动端样式片段。
- Playground controller 注入函数名断言。
- workspace DOM 局部结构断言。
- task inbox / asset modal header 纯结构断言。
- theme light mode 局部 CSS 覆盖断言。

迁移目标优先：

- `test/playground-page-shell.test.ts`
- `test/playground-styles.test.ts`
- 对应 `test/playground-*-controller.test.ts`

### 不建议迁移

- 同时依赖 route 注册、HTML 拼装和多个 controller 注入顺序的断言。
- 需要真实 Fastify inject 的 API 行为断言。
- 跨 assets / files / UI 文件卡片行为的集成烟测。

## 架构治理批次的默认验证组合

### 纯文档批次

```bash
git diff --check
```

再手工确认文档引用路径存在。

### UI 文档或 UI 结构批次

```bash
git diff --check
node --test --import tsx test/playground-page-shell.test.ts test/playground-styles.test.ts
node --test --import tsx test/server.test.ts --test-name-pattern "GET /playground"
```

### Chat / Agent 批次

```bash
git diff --check
npx tsc --noEmit
node --test --import tsx test/agent-service.test.ts test/chat-agent-routes.test.ts test/chat-sse.test.ts test/chat-route-parsers.test.ts
```

### Conn / Activity 批次

```bash
git diff --check
npx tsc --noEmit
node --test --import tsx test/conn-db.test.ts test/conn-sqlite-store.test.ts test/conn-run-store.test.ts test/conn-worker.test.ts test/cleanup-debug.test.ts
```

### 发布候选

```bash
git diff --check
npx tsc --noEmit
npm test
```

如果涉及 Docker / sidecar：

```bash
npm run docker:chrome:check
```

## 结论

架构治理下一步的重点是降低验证成本，而不是先降低文件行数。`test/server.test.ts` 现在是巨石，但也是很多跨模块行为的最后防线；后续可以迁移纯 UI 字符串断言，但必须保留 `/playground`、chat、conn、activity、assets 和 debug 的集成烟测。拆测试也要像拆代码一样，有收益、有边界、有回滚，不要把一个大麻烦拆成一堆小麻烦。
