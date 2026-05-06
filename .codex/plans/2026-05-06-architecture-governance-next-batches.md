# UGK CLAW 架构治理后续执行计划

> 适用范围：接续 `docs/architecture-governance-audit-2026-05-06.md`。
> 当前状态：批次 A 已完成，只读审计已落地。
> 执行原则：先增强验证能力，再做低风险治理；没有测试和回滚点，不动核心逻辑。

## 总体策略

下一步不要直接冲进 `src/ui/playground-styles.ts` 或 `AgentService.runChat()` 开拆。当前最应该做的是把“未来每次改动该跑哪些测试、观察哪些风险、哪些边界不能碰”固定下来。

推荐顺序：

1. 批次 B：测试矩阵与风险闸门
2. 批次 C：Playground UI 边界治理方案
3. 批次 D：Conn / Activity / Legacy 观测治理
4. 批次 E：Agent / Chat 重复 wrapper 评估

每批结束都停下来复盘，不连续开火。

## 批次 B：测试矩阵与风险闸门

### 目标

建立一份“架构治理测试矩阵”，让后续每次改动都能快速知道该跑哪些定向测试和最终验证。

### 任务

1. 新增 `docs/architecture-test-matrix.md`。
2. 按业务域分组列出测试：
   - Chat / Agent runtime
   - Agent profile
   - Playground shell / styles / controllers
   - Assets / files / local artifact
   - Conn / activity / output
   - Feishu
   - Runtime debug / deployment
3. 标注每组最小命令、完整命令、适用场景。
4. 标注 `test/server.test.ts` 当前承担的职责：
   - 必须保留的集成烟测
   - 可迁移到更窄测试文件的页面结构断言
   - 不建议迁移的跨模块断言
5. 更新 `docs/change-log.md`。

### 不做

- 不迁移测试。
- 不改源码。
- 不改测试实现。

### 验证

- `git diff --check`
- 确认文档中引用的测试文件存在。

### 完成标准

后续任一改动都能从矩阵中找到对应最小验证命令。

## 批次 C：Playground UI 边界治理方案

### 目标

不改视觉、不拆源码，先把 Playground UI 的边界和潜在重构点列清楚。

### 任务

1. 新增 `docs/playground-ui-governance-map.md`。
2. 建立 UI 模块地图：
   - shell
   - workspace
   - transcript
   - assets
   - task inbox
   - conn manager
   - agent manager
   - theme
   - mobile shell
3. 标记样式来源：
   - design token
   - base layout
   - desktop workspace
   - mobile override
   - light theme override
   - feature module style
4. 列出低风险候选治理点：
   - workspace header 重复 DOM
   - task inbox / asset header 口径
   - light theme 漏网规则
   - `server.test.ts` 中纯 UI 结构断言迁移候选
5. 列出禁区：
   - 手机端布局不能桌面化
   - 不改视觉 identity
   - 不改 externalized runtime 语义

### 不做

- 不拆 `playground-styles.ts`。
- 不迁移 controller。
- 不改 UI 视觉。

### 验证

- `git diff --check`
- 文档引用路径存在。

### 完成标准

后续若要真正治理 UI，可以按文档选择一个小点做 TDD，而不是一头扎进样式泥潭。

## 批次 D：Conn / Activity / Legacy 观测治理

### 目标

把后台任务、activity、output 和 legacy 的观测口径固定下来，防止误删兼容层。

### 任务

1. 更新或补充 `docs/runtime-assets-conn-feishu.md` 的“治理检查表”。
2. 基于现有 `docs/project-cleanup-assessment-2026-05-05.md`，提炼当前 legacy 检查项：
   - `ConnTarget.type = "conversation"`
   - `conversation_notifications`
   - Feishu `mapped` mode
   - legacy subagent
   - Windows host IPC fallback
3. 明确每个 legacy 的：
   - 当前读取路径
   - 当前写入路径
   - 删除条件
   - 观测接口
4. 如需进一步动作，只允许先提出后续计划，不直接删代码。
5. 更新 `docs/change-log.md`。

### 不做

- 不删除 legacy。
- 不改 schema。
- 不改 worker。
- 不改 Feishu 代码。

### 验证

- `git diff --check`
- 文档引用路径存在。

### 完成标准

任何人想删 legacy 前，都必须能在文档中看到删除条件和观测入口。

## 批次 E：Agent / Chat 重复 wrapper 评估

### 目标

评估 `src/routes/chat.ts` 中 main chat 与 scoped agent chat 的重复 wrapper 是否值得收口。

### 任务

1. 新增或补充一份小型评估文档，记录：
   - main `/v1/chat/*`
   - scoped `/v1/agents/:agentId/chat/*`
   - 重复点
   - 不可变 API 语义
   - 可抽取的薄 adapter 方案
   - 不建议抽取的原因
2. 明确如果未来要动，最小实现步骤：
   - 先补路由行为测试
   - 再抽内部 helper
   - 保持所有 URL、请求体、响应体不变
3. 暂不执行代码修改。

### 不做

- 不改 `src/routes/chat.ts`。
- 不改 API。
- 不动 `AgentService.runChat()`。

### 验证

- `git diff --check`
- 文档引用路径存在。

### 完成标准

给出是否值得做代码级收口的明确建议。如果收益不够，就标记为“不做”，别为了好看硬抽象。

## 第一阶段推荐执行批次

建议下一轮只执行：

1. 批次 B：测试矩阵与风险闸门
2. 批次 C：Playground UI 边界治理方案

原因：

- 当前最大风险不是没有拆分，而是后续改动验证成本高。
- Playground 是近期 UI 变更高频区，先把边界讲清楚最划算。
- Conn / legacy 和 Agent / Chat 都更接近运行核心，等 B/C 完成后再碰。

## 停止条件

出现以下情况立刻停下，不继续推进：

- 发现文档事实与代码不一致。
- 发现某个测试文件已经被删除或重命名。
- 发现未跟踪 runtime 文件被误纳入计划。
- 用户要求转入具体代码修改。
- 任意验证失败且原因不明确。

## 回报格式

每批结束只汇报四件事：

1. 完成了什么文档或分析。
2. 得到什么结论。
3. 做了哪些验证。
4. 下一批是否建议继续。
