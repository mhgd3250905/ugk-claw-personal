# 架构治理与收尾交接

日期：2026-05-06

## 当前状态

- 已完成架构治理第一轮整理，并已提交到本地 Git。
- 最新本地提交：`379eb82 chore: document architecture governance handoff`
- 本次提交包含架构治理计划、治理地图、测试矩阵、`AGENTS.md` 收口、`feature-handoff` 开发协作技能，以及 `src/routes/chat.ts` scoped agent service resolver 小重构。
- `feature-handoff` 的正确位置是 `.codex/skills/feature-handoff/SKILL.md`，它服务于维护本仓库的 coding agent，不属于产品运行时 `.pi/skills/`。
- `.gitignore` 已放行 `.codex/skills/**`，避免开发协作技能被 `skills/` 忽略规则吞掉。

## 已完成内容

- 新增 `.codex/plans/2026-05-06-architecture-analysis-and-optimization-plan.md`
- 新增 `.codex/plans/2026-05-06-architecture-governance-next-batches.md`
- 新增 `.codex/skills/feature-handoff/SKILL.md`
- 新增 `docs/architecture-governance-guide.md`
- 新增 `docs/architecture-governance-audit-2026-05-06.md`
- 新增 `docs/architecture-test-matrix.md`
- 新增 `docs/playground-ui-governance-map.md`
- 新增 `docs/conn-activity-legacy-governance-map.md`
- 新增 `docs/agent-chat-governance-map.md`
- 更新 `AGENTS.md`：新增维护规则、架构治理入口、feature-handoff 入口，并把 `8.4 运行事实` 从流水账收口为原则和专题文档入口。
- 更新 `README.md` 与 `docs/traceability-map.md`：挂入架构治理入口。
- 更新 `docs/change-log.md`：记录架构治理、开发协作 skill 和 chat route 收口。
- 更新 `src/routes/chat.ts`：新增 `resolveScopedAgentServiceOrSend()`，减少 scoped agent route 中重复的 unknown-agent 处理。

## 验证记录

已通过：

- `git diff --check`
- `npx tsc --noEmit`
- `node --test --import tsx test/chat-agent-routes.test.ts`
- `node --test --import tsx test/server.test.ts --test-name-pattern "GET /playground labels timed-out conn runs distinctly"`
- `npm test`，结果为 `554 pass / 0 fail`

注意：

- 曾有一次 `npm test` 在 `test/server.test.ts` 的 `/playground` HTML 断言上失败，表现为拿到了 externalized runtime HTML。随后单跑 `server.test.ts` 和复跑全量 `npm test` 均通过，因此当前没有可复现回归。

## 当前工作区边界

当前 `git status --short` 显示 1 个本交接文档和 3 个 runtime 临时文件未跟踪：

```text
?? .codex/plans/2026-05-06-handoff-architecture-governance.md
?? runtime/dangyang-weather-2026-05-01.json
?? runtime/karpathy-guidelines-CLAUDE.md
?? runtime/tab-accumulation-report.md
```

`runtime/` 下 3 个文件不要提交，除非用户明确说明它们属于本次交付。

本交接文件 `.codex/plans/2026-05-06-handoff-architecture-governance.md` 是换 agent 前新增的交接记录；如果用户希望“交接文档也保存进 Git”，可单独提交它。

## 遗留事项

- `.pi/skills/feature-handoff` 曾因误放技能而产生空目录，技能文件已移走并删除，正确文件在 `.codex/skills/feature-handoff/SKILL.md`。空目录不进 Git；如果本地仍存在且碍眼，可由用户或后续 agent 在确认为空后手动删除。
- 后续继续架构治理时，先读 `docs/architecture-governance-guide.md`，再按治理地图选择小步改动。
- 不要继续扩大 `AGENTS.md`，它现在只应作为高层接手索引。

## 下一步建议

1. 新 agent 先读 `AGENTS.md`、`docs/architecture-governance-guide.md` 和本交接文档。
2. 执行任何新改动前先看 `git status --short`，确认只剩上面列出的交接文档改动、3 个 runtime 临时文件或用户新改动。
3. 如果继续治理源码，优先按 `docs/agent-chat-governance-map.md` 中的低风险队列推进，不要强拆 `AgentService.runChat()`。
4. 如果用户只是继续做功能开发，按 `docs/architecture-test-matrix.md` 选择最小验证命令。
5. 功能完成后再次使用 `.codex/skills/feature-handoff/SKILL.md` 收尾。
