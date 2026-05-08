# Multi Chrome Browser Routing Implementation Plan

> **执行前置要求：** 这是计划文档，不是执行许可。开始改源码前必须由用户明确确认，并按仓库约定使用 `$do-plan` 或等价执行流程。

**Goal:** 支持多个独立 Chrome 实例，并允许全局、Agent profile、单次任务按用户自定义 `browserId` 选择目标 Chrome，避免并发任务争抢同一个 Chrome 前台窗口。

**Architecture:** 引入独立的 Browser Registry 作为浏览器实例配置与解析边界；Agent / task 只处理 `browserId`，不直接感知 CDP host/port/profile 细节。每个 `browserId` 对应一个独立 Chrome 实例和独立 profile，登录态由用户自己通过该实例 GUI 管理，系统不自动复制、同步或覆盖登录态。

**Tech Stack:** TypeScript, Fastify, Docker Compose, linuxserver/chrome sidecar, CDP, existing `web-access` skill, Node test runner.

---

## 0. 已确认需求

- 当前系统主要通过 `WEB_ACCESS_BROWSER_PROVIDER=direct_cdp` 连接固定 CDP：`172.31.250.10:9223`。
- 单 Chrome 实例会导致多个任务同时抢前台 target、焦点、标签页和登录态上下文。
- 用户希望有多个 Chrome 窗口 / 实例，每个实例有自己的登录态。
- 用户有自己的命名习惯，所以 `browserId` 必须用户自定义，系统不预设 `x`、`feishu`、`research` 这类业务名。
- 现有 Chrome 中有大量重要登录态，必须保护；默认实例和现有 profile 不能被迁移脚本、初始化逻辑或配置更新破坏。
- 架构要求优雅、低耦合，不能把 CDP 端口选择散落到 chat route、worker、agent profile、web-access 调用点里。

## 1. 核心结论

该功能可行，但必须做成：

```text
browserId -> BrowserInstance -> CDP endpoint / GUI URL / profile metadata
```

而不是：

```text
任务运行时到处改 WEB_ACCESS_CDP_HOST / WEB_ACCESS_CDP_PORT
```

更不能做成：

```text
多个 Chrome 进程共用同一个 user-data-dir
```

Chrome profile 不是并发共享数据库。同一个 profile 同时被多个 Chrome 进程打开，会触发 `SingletonLock`、Cookie DB、Local State、扩展状态和会话恢复状态的并发写入风险。这里不能赌，赌输了用户登录态就可能变事故现场。

## 2. 不做什么

本功能第一版明确不做：

- 不自动复制现有 `.data/chrome-sidecar`。
- 不自动同步 Cookie、Local Storage、扩展状态或登录态。
- 不让多个 Chrome 实例挂载同一个 profile 目录。
- 不根据业务用途内置浏览器命名。
- 不让 scoped agent 找不到 browser 时默默 fallback 到别的用户自定义 browser。
- 不在同一 Node 进程并发任务中通过临时修改 `process.env.WEB_ACCESS_CDP_HOST` / `WEB_ACCESS_CDP_PORT` 路由浏览器。

## 3. 目标用户模型

用户看到和使用的是 `browserId`：

```json
{
  "browserId": "default",
  "name": "Default",
  "cdpHost": "172.31.250.10",
  "cdpPort": 9223,
  "guiUrl": "https://127.0.0.1:3901/",
  "profileLabel": "chrome-sidecar"
}
```

除 `default` 外，其他 `browserId` 由用户配置，例如 `work-01`、`account-a`、`my-login-2`。系统只校验合法性和唯一性，不解释用途。

推荐 `browserId` 规则：

```text
^[a-z][a-z0-9-]{0,62}$
```

这样可以复用现有 agent id 的命名习惯，避免 URL、文件名和 JSON key 出现奇怪字符。展示名 `name` 可选，允许中文，但路由只使用稳定 `browserId`。

## 4. 配置模型

新增浏览器配置模块：

- Create: `src/browser/browser-instance.ts`
- Create: `src/browser/browser-registry.ts`
- Test: `test/browser-registry.test.ts`

建议类型：

```ts
export interface BrowserInstance {
  browserId: string;
  name: string;
  cdpHost: string;
  cdpPort: number;
  guiUrl?: string;
  profileLabel?: string;
  isDefault?: boolean;
}
```

解析来源第一版采用环境变量 JSON，避免一开始就做 UI 和持久化编辑器：

```text
UGK_BROWSER_INSTANCES_JSON=[{"browserId":"default","name":"Default","cdpHost":"172.31.250.10","cdpPort":9223,"guiUrl":"https://127.0.0.1:3901/","profileLabel":"chrome-sidecar"}]
UGK_DEFAULT_BROWSER_ID=default
```

如果未配置，自动生成和当前完全一致的 `default`：

```text
default -> WEB_ACCESS_CDP_HOST or 172.31.250.10
default -> WEB_ACCESS_CDP_PORT or 9223
default -> WEB_ACCESS_BROWSER_GUI_PORT or 3901
```

这样老部署零配置继续可用。

## 5. Docker 多实例策略

第一版不做动态创建容器。多 Chrome 实例通过 compose 预定义或运维添加 service：

```yaml
ugk-pi-browser:
  # existing default
  volumes:
    - ${UGK_BROWSER_CONFIG_DIR:-./.data/chrome-sidecar}:/config
  ports:
    - "127.0.0.1:${WEB_ACCESS_BROWSER_GUI_PORT:-3901}:3001"
  networks:
    ugk-pi-net:
      ipv4_address: 172.31.250.10

ugk-pi-browser-extra-1:
  image: lscr.io/linuxserver/chrome:latest
  volumes:
    - ${UGK_BROWSER_EXTRA_1_CONFIG_DIR:-./.data/chrome-sidecar-extra-1}:/config
    - ${UGK_BROWSER_EXTRA_1_UPLOAD_DIR:-./.data/chrome-sidecar-extra-1/upload}:/config/upload
  ports:
    - "127.0.0.1:${UGK_BROWSER_EXTRA_1_GUI_PORT:-3902}:3001"
  networks:
    ugk-pi-net:
      ipv4_address: 172.31.250.11
```

每个实例内部仍使用 Chrome `9222`，每个实例自己的 socat relay 暴露 `9223`。app 看到的是不同容器 IP 的 `:9223`。

注意：`/config/upload` 当前是 sidecar 文件上传桥。多浏览器实例后要决定上传目录是否也实例隔离。推荐第一版保持每个 browser 实例独立 upload dir，避免任务 A 给 browser A 准备文件却被 browser B 误选。

## 6. Browser Registry API

新增只读调试接口，先不做在线编辑：

- Modify: `src/server.ts`
- Create: `src/routes/browsers.ts`
- Test: `test/browser-routes.test.ts`

接口：

```text
GET /v1/browsers
GET /v1/browsers/default
```

响应：

```json
{
  "defaultBrowserId": "default",
  "browsers": [
    {
      "browserId": "default",
      "name": "Default",
      "cdpHost": "172.31.250.10",
      "cdpPort": 9223,
      "guiUrl": "https://127.0.0.1:3901/",
      "profileLabel": "chrome-sidecar",
      "isDefault": true
    }
  ]
}
```

该接口不返回敏感 profile 绝对宿主路径。`profileLabel` 只做用户识别提示。绝对路径留在部署文档和服务器运维中，不塞到普通 API 响应里。

## 7. Agent 默认浏览器绑定

扩展 `AgentProfile`：

- Modify: `src/agent/agent-profile.ts`
- Modify: `src/agent/agent-profile-catalog.ts`
- Modify: `src/routes/chat.ts`
- Test: `test/agent-profile-catalog.test.ts`
- Test: `test/chat-agent-routes.test.ts`

新增字段：

```ts
defaultBrowserId?: string;
```

规则：

- `main` 默认没有显式字段，解析时使用 registry default。
- 创建 / 更新 agent profile 时允许设置 `defaultBrowserId`。
- 如果传入未知 `browserId`，HTTP 返回 `400 BAD_REQUEST`，不写入 catalog。
- 如果已有 profile 指向一个后来被配置移除的 browser，运行时不能悄悄改 profile；启动和接口可给出 warning / validation result，任务执行时返回明确错误。

这里不能让 unknown browser 自动 fallback 到 `default`。Agent 明确绑定的 browser 消失时，应该暴露配置错误。否则本来想用独立账号，结果悄悄用了 default 登录态，隐私和行为都不对。

## 8. 单次任务 override

扩展聊天请求体：

- Modify: `src/types/api.ts`
- Modify: `src/routes/chat-route-parsers.ts`
- Modify: `src/routes/chat.ts`
- Modify: `src/agent/agent-service.ts`
- Test: `test/server.test.ts`
- Test: `test/agent-service.test.ts`

字段：

```ts
browserId?: string;
```

优先级：

```text
request.browserId > agentProfile.defaultBrowserId > registry.defaultBrowserId
```

前台 chat、stream、queue 的语义：

- 新 run 接受 `browserId` override。
- active run 期间 queue message 不允许改变 browserId；如果 queue 请求携带不同 `browserId`，返回 `409 CONFLICT` 或忽略并提示。推荐 `409`，别让用户以为中途换浏览器生效。
- interrupt/reset 不需要 browserId。

后台 conn：

- Modify: `src/agent/conn-store.ts`
- Modify: `src/workers/conn-worker.ts`
- Modify: `src/routes/conns.ts`
- Test: `test/conn-worker.test.ts`

conn run 创建时可指定 `browserId`；如果未指定，使用执行 Agent 的默认 browser。

## 9. 避免全局 env 串并发

这是架构重点。当前 `web-access` 的 `requestHostBrowser()` 通过 env 进入 `direct_cdp`，最容易想到的是运行前临时设置：

```ts
process.env.WEB_ACCESS_CDP_HOST = browser.cdpHost;
process.env.WEB_ACCESS_CDP_PORT = String(browser.cdpPort);
```

不要这么做。`conn-worker` 有并发，前台和后台也可能同进程交错，`process.env` 是进程全局状态，不是 async-local 上下文。靠它做 per-run 路由会串。

推荐第一版实现一个本地 CDP routing proxy：

- Create: `src/browser/browser-cdp-proxy.ts`
- Create: `src/browser/browser-run-context.ts`
- Test: `test/browser-cdp-proxy.test.ts`

思路：

```text
web-access -> http://127.0.0.1:3456?browserId=<resolved>
proxy -> BrowserRegistry.resolve(browserId)
proxy -> requestHostBrowser with explicit localBrowser endpoint
```

如果现有 `runtime/skills-user/web-access/scripts/host-bridge.mjs` 支持 options 注入 `localBrowser`，优先封装这一层，避免改上游包。如果运行态 skill 只看 env，则给每个 browserId 启动独立 proxy base URL，再由 run context 注入 `WEB_ACCESS_CDP_PROXY_BASE_URL`。注入也不能用全局 env，需要确认 `pi-coding-agent` 是否支持 session-level env；如果不支持，退而求其次采用每个 browserId 独立 worker 进程。

执行前必须先做一个探针任务：确认 `pi-coding-agent` 的 tool execution 是否能接收 per-session env / resource loader context。不能确认前，不要进入实现。

## 10. Cleanup 路由

当前 `src/agent/browser-cleanup.ts` 调用：

```text
POST /session/close-all?metaAgentScope=<scope>
```

多 browser 后 cleanup 必须按本轮 resolved browser 清理：

```text
POST /session/close-all?metaAgentScope=<scope>&browserId=<resolved>
```

或：

```text
POST {browser proxy for resolved browser}/session/close-all?metaAgentScope=<scope>
```

推荐把 `browserId` 作为 `closeBrowserTargetsForScope()` 的显式参数，而不是让 cleanup 再猜一次：

```ts
closeBrowserTargetsForScope(scope, { browserId, browserRegistry })
```

测试必须覆盖：

- 有 browserId 时请求目标 browser 的 proxy。
- 无 browserId 时保持 default 行为。
- unknown browser cleanup 只 warning，不覆盖原任务结果。

## 11. Playground UI 第一版

第一阶段 UI 可以极简：

- 浏览器实例列表先只在 Agent 操作台 / debug 面板展示。
- Agent 编辑页新增“默认浏览器”选择器。
- 发送单次任务 override 可以先不放主 composer，避免把主输入区搞复杂。

第二阶段再考虑：

- composer 更多菜单里选择本轮 browser。
- conn 编辑器里选择 browser。
- 浏览器实例管理页展示 GUI URL 和状态探针。

用户已明确有自己的命名习惯，所以 UI 文案只说“浏览器实例”，不说“X 浏览器”“飞书浏览器”。

## 12. 状态探针

新增 browser status 检查：

```text
GET /v1/browsers/:browserId/status
```

第一版只做按需探针，不在 `/v1/browsers` 列表里自动探所有实例，避免页面刷新就打爆多个 Chrome。

返回：

```json
{
  "browserId": "default",
  "ok": true,
  "endpoint": "http://172.31.250.10:9223",
  "browser": "Chrome/..."
}
```

## 13. 部署与运维文档

必须同步更新：

- Modify: `docs/web-access-browser-bridge.md`
- Modify: `docs/server-ops.md`
- Modify: `docs/server-ops-quick-reference.md`
- Modify: `docs/traceability-map.md`
- Modify: `docs/change-log.md`
- Modify: `.env.example`

文档必须强调：

- `default` 是现有 Chrome，不自动迁移。
- 新实例需要独立 config/profile 目录。
- 新实例登录态由用户自己打开对应 GUI 登录维护。
- 不要复制正在运行的 Chrome profile。
- 不要让两个 service 指向同一个 `UGK_BROWSER_CONFIG_DIR`。

## 14. 测试计划

最小测试：

```bash
node --test --import tsx test/browser-registry.test.ts
node --test --import tsx test/browser-routes.test.ts
node --test --import tsx test/browser-cleanup.test.ts
node --test --import tsx test/agent-profile-catalog.test.ts
node --test --import tsx test/chat-agent-routes.test.ts
```

容器配置测试：

```bash
node --test --import tsx test/containerization.test.ts
```

全量：

```bash
npm test
```

涉及真实 Chrome：

```bash
npm run docker:chrome:check
```

新增多实例后，应补一个手工验收清单：

```text
1. default GUI 仍为 3901，现有登录态仍在。
2. 新实例 GUI 可通过 3902 打开。
3. 新实例登录后，default 不出现该登录态。
4. default 跑 web-access 任务时只操作 default 窗口。
5. 指定新 browserId 跑任务时只操作新窗口。
6. 两个任务并发时，各自 Chrome 前台不互抢。
7. 任务结束 cleanup 只清理对应 browserId 下的对应 scope target。
```

## 15. 分阶段实施

### Phase 1: Registry 和只读 API

只实现 Browser Registry、默认兼容和 `/v1/browsers`。不改 agent run，不改 compose 多实例。

成功标准：

- 未配置时 `/v1/browsers` 返回当前 default。
- 配置 JSON 后返回用户自定义 browserId。
- unknown / duplicate / invalid browserId 有明确错误。

### Phase 2: Docker 多实例样板

提供 compose 样板和 `.env.example` 示例，但不强制启用额外实例。默认部署仍只有现有 Chrome。

成功标准：

- 现有 `docker compose up -d` 不改变 default 行为。
- 用户按文档启用额外实例后，可通过独立 GUI 维护登录态。

### Phase 3: Agent 默认 browserId

把 `defaultBrowserId` 接入 AgentProfile 创建 / 编辑 / 展示，先只影响后续 run 的解析结果。

成功标准：

- Agent profile 可绑定用户自定义 browserId。
- unknown browserId 不写入。
- `GET /v1/agents` 或 Agent 详情能展示绑定关系。

### Phase 4: Run-level browser context

把 resolved browserId 贯穿 `AgentService.runChat()`、active run、terminal run、cleanup。

成功标准：

- 新 run 解析 browserId 优先级正确。
- queue 期间不能切 browser。
- cleanup 清理正确 browser。

### Phase 5: web-access 路由解耦

实现 CDP routing proxy 或 per-session browser injection。此阶段是最危险的，必须先写探针测试和并发测试。

成功标准：

- 并发两个 run 使用不同 browserId 时不会串 CDP endpoint。
- 不通过全局 `process.env` 做 per-run 路由。
- 旧 `WEB_ACCESS_BROWSER_PROVIDER=direct_cdp` 默认链路继续可用。

### Phase 6: UI 接入

Agent 操作台和 conn 编辑器展示 / 选择 browserId。Composer 单次 override 放到后续版本，除非用户明确需要。

成功标准：

- UI 不内置业务命名。
- 选择器只展示 registry 中存在的 browserId。
- 保存 unknown browserId 不可能从 UI 发出；服务端仍兜底校验。

## 16. 影响分析

### 直接影响

- `AgentProfile` 增加可选字段，旧数据读取必须有默认值。
- Chat request body 增加可选 `browserId`，不破坏旧客户端。
- Cleanup 参数增加 browser 维度，默认仍走旧 proxy。
- Compose 文档增加多实例样板，但默认服务名和 `172.31.250.10:9223` 不变。

### 间接影响

- `conn-worker` 并发执行时不能共享浏览器路由状态。
- `web-access` skill 如果只能从 env 读 CDP endpoint，需要额外 proxy 或 worker 隔离，不能硬改全局 env。
- Server ops 现有检查写死 `172.31.250.10:9223`，多实例后应保留 default 检查，并可扩展为遍历 registry。
- 上传桥从单目录变多目录后，生成文件的 app path 和 browser path 映射必须和 browserId 对齐。

### 数据兼容

- 旧 `profiles.json` 没有 `defaultBrowserId`：读取时使用 registry default。
- 旧 chat 请求没有 `browserId`：使用 agent default / global default。
- 旧环境没有 `UGK_BROWSER_INSTANCES_JSON`：自动合成 default。
- 旧 server ops 文档仍以 default 为主，新增多实例只作为扩展。

## 17. 回滚策略

- Browser Registry 配置为空或移除后，系统回到合成 default。
- Agent profile 的 `defaultBrowserId` 是可选字段；回滚代码后旧版本应忽略未知字段。
- 多实例 compose 样板不影响 default service；回滚时停止额外 browser service 即可。
- 不触碰 `.data/chrome-sidecar`，所以 default 登录态不需要恢复。

## 18. 执行禁区

- 禁止在实现中自动移动、删除、复制 `.data/chrome-sidecar`。
- 禁止把 profile 目录清锁逻辑扩展到用户未指定的其他实例。
- 禁止新增任何会覆盖用户 profile 的初始化脚本。
- 禁止把 `browserId` 和业务用途绑定。
- 禁止任务运行时通过全局 env 临时改 CDP endpoint。
- 禁止 unknown browser fallback 到 default 后继续跑。

## 19. 建议先做的探针

正式实现 Phase 5 前，先写一个只读技术探针：

1. 查 `runtime/skills-user/web-access/scripts/host-bridge.mjs` 是否支持按 call 传入 explicit CDP endpoint。
2. 查 `@mariozechner/pi-coding-agent` 是否支持 session-level env 或 tool execution context。
3. 如果都不支持，设计本地 proxy，使 web-access 只连 proxy，proxy 按 request context 转发到目标 CDP。

这个探针决定最终实现复杂度。别跳过，跳过就是“先写，写完发现架构不支持”，这种活儿很有观赏性，但不适合保护登录态。

