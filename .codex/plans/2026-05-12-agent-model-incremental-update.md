# 2026-05-12 Agent 模型设置增量更新准备

## 当前状态

- 本地 HEAD：`ad796d3 Fix agent default model handling`
- 当前未提交的源码 / 文档改动只包含对话页左下角“模型源”入口跟随当前 Agent 的修复。
- 本地已验证用户场景：切换到 `GLM专用` / `medtrum舆情监控员` 后，左下角模型源弹窗显示对应 Agent 的默认 API 源和模型。
- 本地 Docker `ugk-pi` 已重启，`http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`。

## 本次应提交文件

- `src/ui/playground.ts`
- `test/agent-model-ui.test.ts`
- `docs/playground-current.md`
- `docs/change-log.md`
- `.codex/plans/2026-05-12-agent-model-incremental-update.md`

## 本次不要提交

- `public/card*.png`
- `public/ptt-*.html`
- `public/reddit/`
- `public/slide*.png`
- `runtime/*.cjs`
- `runtime/*.jpg`
- `runtime/*.txt`
- `runtime/*.mjs`
- `ui-design/`
- 编码异常的 `E...app...data...agent...sessions...jsonl`

这些都是本地运行产物或临时输出。除非用户明确指定归属，否则不要删除、提交或上传。

## 已通过验证

- `npx tsx test/agent-model-ui.test.ts`
- `npx tsx test/playground-agent-switch.test.ts`
- `npx tsc --noEmit`
- `git diff --check`
- Playground 内联脚本 parser 检查
- 本地容器重启后 `/healthz`

## 增量更新前置动作

1. 提交本地改动，只暂存“本次应提交文件”列表。
2. 推送到 `origin main` 和 `gitee main`，保证腾讯云 / 阿里云能各自从默认远端拉到同一提交。
3. 执行只读预检：
   - `npm run server:ops -- tencent preflight`
   - `npm run server:ops -- aliyun preflight`

## 正式增量更新命令

腾讯云：

```bash
npm run server:ops -- tencent deploy
npm run server:ops -- tencent verify
```

阿里云：

```bash
npm run server:ops -- aliyun deploy
npm run server:ops -- aliyun verify
```

## 发布后人工验收

- 打开生产 `/playground`。
- 切换到一个已配置独立模型的非主 Agent。
- 打开左下角设置菜单的“模型源”。
- 确认弹窗顶部显示当前 Agent 的 provider / model。
- 保存一次同 Agent 模型后确认不会修改 `main` 的全局默认。

## 风险点

- 这次改动只影响 Playground 前端设置入口，不改变后端模型优先级链。
- 非主 Agent 保存模型会走 `PATCH /v1/agents/:agentId`，如果该 Agent 有运行中会话，后端会按既有规则返回 `409`。
- 生产发布必须保护 shared 运行态，不得使用整目录覆盖或 `docker compose down -v`。
