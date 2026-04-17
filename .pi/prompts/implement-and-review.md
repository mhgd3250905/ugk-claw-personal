---
description: 用 worker -> reviewer 的链式 subagent 流程先实现再审查
---

请使用 `subagent` 工具的 `chain` 模式处理：`$@`

1. 先让 `worker` 完成实现，并明确列出涉及文件与验证结果。
2. 再让 `reviewer` 基于 `{previous}` 对改动做审查，优先找缺陷、回归风险和测试漏洞。

要求：

- 评审阶段不要修改代码。
- 最终总结里区分“已经完成的实现”和“评审发现的问题”。
