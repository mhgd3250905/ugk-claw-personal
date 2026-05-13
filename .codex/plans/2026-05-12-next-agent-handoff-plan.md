# 2026-05-12 新 Agent 接手行动计划

## 目标

让下一位从头接手 `E:\AII\ugk-pi` 的 coding agent 在 10 分钟内知道：该先读什么、当前稳定版本是什么、哪些文件不能碰、如何本地验证、如何安全做双云增量更新。

## 接手前准备

1. 先发给新 agent：

   ```text
   请先读 `AGENTS.md`、`docs/handoff-current.md`、`docs/traceability-map.md`。开始前执行 `git status --short` 和 `git log -1 --oneline`。不要提交 `.env`、`.data/`、runtime 临时文件、public 临时产物、ui-design/ 或奇怪的 `E...jsonl` 运行产物。普通开发先用本地 Docker；生产发布先读 `docs/server-ops.md`，默认增量更新，禁止整目录覆盖 shared 运行态。
   ```

2. 确认当前仓库事实：
   - 本地 HEAD：`6af83ac Confirm agent browser binding edits`
   - `origin/main`：已同步到 `6af83ac`
   - `gitee/main`：已同步到 `6af83ac`
   - 腾讯云生产：已部署并验证 `6af83ac`
   - 阿里云生产：已部署并验证 `6af83ac`

3. 确认最近三次关键提交：
   - `ca2e272 Align model settings with active agent`
   - `42f7d4b Update Tencent cloud public IP`
   - `6af83ac Confirm agent browser binding edits`

## 新 Agent 第一轮阅读顺序

1. `AGENTS.md`
2. `docs/handoff-current.md`
3. `docs/traceability-map.md`
4. 按任务类型继续读：
   - Playground / Agent UI：`docs/playground-current.md`
   - Conn / Feishu / output：`docs/runtime-assets-conn-feishu.md`
   - 本地 Docker：`docs/docker-local-ops.md`
   - 生产发布：`docs/server-ops.md`、`docs/server-ops-quick-reference.md`

## 当前工作区边界

### 可以作为交接文档提交

- `docs/handoff-current.md`
- `.codex/plans/2026-05-12-next-agent-handoff-plan.md`

### 不要提交

- 编码异常的 `E...app...data...agent...sessions...jsonl`
- `public/card*.png`
- `public/ptt-*.html`
- `public/reddit/`
- `public/slide*.png`
- `runtime/*.cjs`
- `runtime/*.jpg`
- `runtime/*.txt`
- `runtime/*.mjs`
- `ui-design/`

这些是运行产物、临时输出或本地现场。别把它们塞进 Git，除非用户明确说明归属。这个坑很低级，但很常见。

## 本地验证路线

普通文档交接只需要：

```powershell
git diff --check
```

如果新 agent 继续改 TypeScript 或前端逻辑，至少执行：

```powershell
npx tsc --noEmit
git diff --check
```

如果改到 Playground Agent 模型或浏览器绑定，优先跑：

```powershell
npx tsx test/agent-model-ui.test.ts
npx tsx test/playground-agent-switch.test.ts
npx tsc --noEmit
git diff --check
```

## 生产发布路线

只做增量更新，不做整目录覆盖。

1. 本地提交并推送两个远端：

   ```powershell
   git push origin main
   git push gitee main
   ```

2. 预检：

   ```powershell
   npm run server:ops -- tencent preflight
   npm run server:ops -- aliyun preflight
   ```

3. 发布与验证：

   ```powershell
   npm run server:ops -- tencent deploy
   npm run server:ops -- tencent verify
   npm run server:ops -- aliyun deploy
   npm run server:ops -- aliyun verify
   ```

## 关键风险

- 不要洗 shared 运行态。生产用户数据在 shared 目录，不在 Git。
- 不要直接手写 `.data/agents/profiles.json`。Agent 创建、归档、技能、模型和浏览器绑定都走 API / UI。
- 不要把腾讯云旧 IP 当事实。当前腾讯云公网入口是 `http://43.156.19.100:3000/playground`。
- 独立 Agents 页编辑默认浏览器会弹确认框，这是安全保护，不是故障。
- Conn 里已有模型选择，优先级可以高于 Agent 默认模型；不要把这件事改回全局默认。

## 下一步建议

1. 如果只是换 agent 接手：先提交这份交接文档即可，不需要重启服务或部署。
2. 如果新 agent 要继续开发：先让它基于本计划复述当前边界，再开始读具体模块。
3. 如果要做生产更新：必须先确认本地只包含应提交文件，再按双远端、双云 verify 流程走。
