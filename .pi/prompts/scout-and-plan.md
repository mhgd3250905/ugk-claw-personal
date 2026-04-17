---
description: 用 scout -> planner 的链式 subagent 流程完成调研和计划
---

请使用 `subagent` 工具的 `chain` 模式处理：`$@`

1. `scout` 先调研与 `$@` 相关的代码、调用链、测试和风险。
2. `planner` 基于原始需求和 `{previous}` 产出一份可执行计划。

要求：

- 不要修改代码。
- 重点输出真实文件路径、实施步骤、测试验证和回归风险。
