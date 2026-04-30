# Stability Ops Runtime Optimization Implementation Plan

> **For Codex:** 执行本计划前必须等待用户明确批准；批准后按任务顺序执行，不要跳过测试和影响分析。

**Goal:** 把当前项目最容易炸的双云运维、运行态诊断、playground 恢复链路和文档入口收口成可验证、可重复、可交接的工程流程。

**Architecture:** 先强化现有 `scripts/server-ops.mjs`，让发布前后检查更像硬闸门；再新增只读运行诊断能力，补齐 `/healthz` 无法覆盖的 runtime 状态；随后用 focused tests 锁住 playground 的刷新恢复、历史分页和滚动行为；最后把文档从百科式说明压成决策树入口。

**Tech Stack:** Node.js 22、TypeScript、Fastify、node:test、Docker Compose、PowerShell/SSH 运维脚本。

---

## 边界与禁区

- 本计划阶段只允许修改计划文档；源码执行必须等用户确认后通过 `$do-plan` 或明确执行指令开始。
- 不执行 `git reset --hard`，不清理当前未提交文件，不删除 `runtime/`、`bugs/`、`.data/` 或 shared 运行态。
- 云服务器相关执行默认是增量更新；任何整目录替换都必须另行确认。
- 涉及生产发布时，必须先运行 `npm run server:ops -- <target> preflight`，远端 dirty 直接停止。

## 当前已确认事实

- `package.json` 已有 `npm run server:ops`，入口为 `scripts/server-ops.mjs`。
- `scripts/server-ops.mjs` 当前支持 `tencent|aliyun` 与 `preflight|deploy|verify`，已检查 Git 状态、compose config、内外网 `/healthz`、skills 目录和 `/v1/debug/skills`。
- `src/server.ts` 当前 `/healthz` 只返回 `{ ok: true }`，不能证明 agent data、skills、CDP、conn sqlite 或 public URL 正常。
- `test/server-ops-script.test.ts`、`test/server.test.ts`、`test/playground-*.test.ts` 已存在，适合继续补 focused regression tests。
- 工作区已有用户未提交内容，执行时必须只改本计划涉及文件，不能顺手整理。

---

## Task 1: Server Ops 脚本硬闸门升级

**Files:**
- Modify: `scripts/server-ops.mjs`
- Test: `test/server-ops-script.test.ts`
- Docs: `docs/server-ops.md`
- Docs: `docs/server-ops-quick-reference.md`
- Changelog: `docs/change-log.md`

**Step 1: 补 server ops 单测，先失败**

在 `test/server-ops-script.test.ts` 增加断言，要求生成的 remote script 包含：

- `UGK_AGENT_DATA_DIR` compose env 检查
- shared agent data 目录存在性检查
- sidecar CDP `127.0.0.1:9222/json/version` 检查
- app 容器访问 `172.31.250.10:9223/json/version` 检查
- `WEB_ACCESS_BROWSER_PROVIDER=direct_cdp` 或等价运行口径检查
- deploy 后固定 `restart nginx`
- dirty worktree 时必须 exit 非 0，且错误文案明确

Run:

```bash
npm run test -- test/server-ops-script.test.ts
```

Expected: FAIL，因为当前脚本尚未覆盖全部硬闸门。

**Step 2: 最小实现脚本检查**

在 `scripts/server-ops.mjs` 的 `verify` 和 `preflight` 片段中补齐：

- `UGK_AGENT_DATA_DIR` 指向 shared agent data 的 guard。
- `test -d ${target.sharedDir}/.data/agent` 与容器内 `/app/.data/agent` 挂载可见性检查。
- `docker compose exec -T ugk-pi-browser sh -lc "curl -fsS http://127.0.0.1:9222/json/version"`。
- `docker compose exec -T ugk-pi sh -lc "curl -fsS http://172.31.250.10:9223/json/version"`。
- 输出 section 名统一为 `== xxx ==`，失败时保留明确 stderr。

避免把 shell 拼接搞成一坨难读字符串；优先抽小 helper，例如 `composeExec(service, command)` 和 `guardEnvEquals(name, value)`。

**Step 3: 运行脚本单测**

Run:

```bash
npm run test -- test/server-ops-script.test.ts
```

Expected: PASS。

**Step 4: 更新文档和 change log**

同步更新：

- `docs/server-ops.md`：只写当前推荐入口和新增检查项，不复制长命令墙。
- `docs/server-ops-quick-reference.md`：更新“脚本会检查什么”和“失败时怎么停”。
- `docs/change-log.md`：新增 `2026-04-30` 条目。

**Step 5: 全量验证**

Run:

```bash
npm test
git diff --check
```

Expected: PASS。

---

## Task 2: 新增只读 Runtime 诊断接口

**Files:**
- Create: `src/routes/runtime-debug.ts`
- Modify: `src/server.ts`
- Modify: `src/types/api.ts`
- Test: `test/server.test.ts`
- Test: `test/runtime-debug.test.ts`
- Docs: `README.md`
- Docs: `docs/traceability-map.md`
- Changelog: `docs/change-log.md`

**Step 1: 写失败测试**

新增 `test/runtime-debug.test.ts`，用 `buildServer()` 或轻量 stub 验证：

- `GET /v1/debug/runtime` 返回 `ok`、`checks`、`config`。
- 不泄露 API key、`.env` 原文、cookie、token。
- 当某项检查失败时 HTTP 仍返回 `200`，但对应 check 为 `{ ok: false, message }`。
- `checks` 至少包含：agent data dir、skills dir、conn sqlite path、browser provider、public base URL、web access browser public base URL。

Run:

```bash
npm run test -- test/runtime-debug.test.ts
```

Expected: FAIL，路由不存在。

**Step 2: 实现只读诊断路由**

新增 `src/routes/runtime-debug.ts`：

- 只读 `getAppConfig()` 和必要 `process.env` 键名。
- 使用 `fs.access` 检查目录可访问，不创建目录。
- 返回结构固定，便于脚本消费：

```ts
{
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; message?: string }>;
  config: {
    publicBaseUrl?: string;
    browserProvider?: string;
    webAccessBrowserPublicBaseUrl?: string;
  };
}
```

在 `src/server.ts` 注册 `registerRuntimeDebugRoutes(app)`。

**Step 3: 补 server ops 使用该接口**

把 `scripts/server-ops.mjs` 的 verify 增加：

```bash
curl -fsS http://127.0.0.1:3000/v1/debug/runtime
```

并用 `python3` 输出 failed check 名称；有 failed check 时退出非 0。

**Step 4: 文档同步**

更新：

- `README.md` API 速览加入 `GET /v1/debug/runtime`。
- `docs/traceability-map.md` 的容器/部署/健康检查场景加入该接口。
- `docs/server-ops.md` 说明 `/healthz` 只证明进程活着，`/v1/debug/runtime` 才看运行态边界。
- `docs/change-log.md` 记录行为变更。

**Step 5: 验证**

Run:

```bash
npm run test -- test/runtime-debug.test.ts test/server-ops-script.test.ts test/server.test.ts
npm test
git diff --check
```

Expected: PASS。

---

## Task 3: Playground 恢复链路回归测试补强

**Files:**
- Modify: `test/playground-conversation-state-controller.test.ts`
- Modify: `test/playground-history-pagination-controller.test.ts`
- Modify: `test/playground-conversation-sync-controller.test.ts`
- Modify: `test/server.test.ts`
- Modify as needed: `src/ui/playground-conversation-state-controller.ts`
- Modify as needed: `src/ui/playground-history-pagination-controller.ts`
- Modify as needed: `src/ui/playground-conversation-sync-controller.ts`
- Docs: `docs/playground-current.md`
- Changelog: `docs/change-log.md`

**Step 1: 补失败测试锁定恢复语义**

新增或加强断言：

- 同会话同 `buildConversationStateSignature()` 时不重建 transcript。
- active run hydrate 时使用“当前正在运行”，不出现“上一轮仍在运行”。
- 用户离底部阅读历史时，state hydrate 不强制滚到底部。
- `historyPage.hasMore / nextBefore / limit` 变化时只 patch 或 prepend，不清空现有消息。
- 会话切换或 active run 中禁止新建/切换的 UI 文案与 API ownership 保持一致。

Run:

```bash
npm run test -- test/playground-conversation-state-controller.test.ts test/playground-history-pagination-controller.test.ts test/playground-conversation-sync-controller.test.ts
```

Expected: 如果现有实现已正确则 PASS；如果暴露退化则 FAIL 并进入 Step 2。

**Step 2: 最小修复**

只改对应 controller，不动大块 UI：

- 保留 `state.renderedConversationStateSignature` 判断。
- 保留 `preservedTranscriptScrollTop` 逻辑。
- 确保 `syncHistoryAutoLoadStatus()` 在 active run 与 idle 分支都被调用。
- 确保 active run 状态不重置 `state.conversationHistory`。

**Step 3: 验证**

Run:

```bash
npm run test -- test/playground-conversation-state-controller.test.ts test/playground-history-pagination-controller.test.ts test/playground-conversation-sync-controller.test.ts test/server.test.ts
npm test
```

Expected: PASS。

**Step 4: 文档同步**

如果实现有行为修复，更新 `docs/playground-current.md` 和 `docs/change-log.md`；如果只是补测试，也在 change log 记录“回归测试补强”，让下一位别以为是闲着没事写测试。

---

## Task 4: 文档入口决策树收口

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/traceability-map.md`
- Modify: `docs/server-ops.md`
- Modify: `docs/server-ops-quick-reference.md`
- Changelog: `docs/change-log.md`

**Step 1: 先做文档差异审计**

只读检查以下事实是否一致：

- 腾讯云入口、目录、shared 路径。
- 阿里云入口、目录、shared 路径。
- `server:ops` 是否是默认发布入口。
- archive 是否只作为双远端不可用兜底。
- `/v1/debug/runtime` 是否已被列入部署排障入口。

Run:

```bash
rg -n "ugk-claw-repo|ugk-claw-shared|server:ops|archive|debug/runtime|debug/skills" AGENTS.md README.md docs/server-ops.md docs/server-ops-quick-reference.md docs/traceability-map.md
```

Expected: 输出无互相矛盾口径。

**Step 2: 改成“问题 -> 入口 -> 禁区”结构**

`docs/traceability-map.md` 优化重点：

- 顶部加“先判断任务类型”。
- 每个场景保留最小入口文件列表。
- 每个高危场景加 `禁止动作`。
- 云部署场景明确：先 `server-ops.md`，再速查，最后才看长手册。

`docs/server-ops.md` 优化重点：

- 保留脚本入口。
- 保留失败时处理策略。
- 不复制长命令墙。
- 明确 `/healthz` 与 `/v1/debug/runtime` 的区别。

**Step 3: 文档验证**

Run:

```bash
rg -n "snapshot-20260422-v4.1.1-stable|/root/ugk-claw-repo-pre-git|~/ugk-pi-claw" README.md docs/server-ops.md docs/traceability-map.md
git diff --check
```

Expected: 旧路径只出现在明确的历史/回滚语境，不作为默认入口。

---

## Task 5: 影响分析与收口验证

**Files:**
- Review: `scripts/server-ops.mjs`
- Review: `src/routes/runtime-debug.ts`
- Review: `src/server.ts`
- Review: `src/ui/playground-*.ts`
- Review: docs touched in previous tasks

**Step 1: 直接影响分析**

检查：

- `buildServer()` 新增路由是否影响现有 route 注册顺序。
- `/v1/debug/runtime` 是否只读、无敏感信息。
- `server-ops.mjs` 是否仍支持 `tencent|aliyun` 和 `preflight|deploy|verify`。
- playground controller 的函数签名是否保持兼容。

**Step 2: 间接影响分析**

检查：

- deploy 脚本新增检查是否会误伤生产：缺目录时是否应该 hard fail。
- sidecar CDP 检查失败时是否明确定位到 `ugk-pi-browser` 或 `ugk-pi`。
- runtime debug 是否会触发 DB 初始化、文件创建或网络访问；不允许。
- 文档是否把当前入口和历史手册混成一锅。

**Step 3: 数据结构兼容性**

检查：

- 新增 `RuntimeDebugResponseBody` 类型是否只新增 API，不改变旧响应。
- `/healthz` 仍返回 `{ ok: true }`，不改变现有健康探针。
- `server-ops` 输出增强不破坏现有命令参数。

**Step 4: 最终验证命令**

Run:

```bash
npm test
npx tsc --noEmit
npm run design:lint
git diff --check
```

如果涉及 Docker 或部署脚本逻辑，再运行：

```bash
docker compose -f docker-compose.prod.yml config --quiet
```

Expected: 全部 PASS。

**Step 5: 交付说明**

最终回报只说：

- 真实解决的问题。
- 生效入口改在哪里。
- 验证命令和结果。
- 未执行的云端动作，必须明确说明未执行。

---

## 推荐执行顺序

1. Task 1：先加硬运维脚本，降低生产误操作风险。
2. Task 2：补只读 runtime 诊断，把 `/healthz` 盲区补上。
3. Task 3：锁住 playground 恢复链路，避免状态机暗退化。
4. Task 4：文档决策树收口，让后续 agent 不靠考古工作。
5. Task 5：影响分析和全量验证，别用“感觉差不多”收工。

## 需要用户确认

执行前请确认：

- 是否先只做本地代码和文档，不发布到云服务器。
- 是否同意新增 `GET /v1/debug/runtime` 作为只读诊断接口。
- 是否按推荐顺序执行，还是先集中做 `server-ops`。
