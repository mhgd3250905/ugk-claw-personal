---
name: subagent-usage
description: 用于使用项目 subagent 工具、并行分派任务、链式委托、后台 conn 任务拆分、多平台检索或遇到 Unknown subagent/default 子代理错误时。
---

# Subagent Usage

## 核心原则

`subagent` 工具只能使用项目里真实存在的子代理名称。当前内置子代理只有：

| 名称 | 用途 |
| --- | --- |
| `worker` | 通用执行、写代码、生成文件、跑明确步骤 |
| `scout` | 只读侦察代码、接口、数据、外部页面或检索结果 |
| `planner` | 基于需求和侦察结果制定计划，不做实现 |
| `reviewer` | 审查代码、结果、风险和遗漏测试，不做修改 |

没有 `default` 子代理。不要猜 `default`、`general`、`executor` 这类不存在的名字。

## 选择模式

- 单个明确任务：用 `agent` + `task`
- 多个互不依赖的任务：用 `tasks` 并行执行
- 前一步输出会影响后一步：用 `chain`，后续任务可引用 `{previous}`

并行任务最多 8 个；内部实际最多 4 路并发。不要把相互依赖的步骤硬塞进 parallel。

## 推荐映射

- 多平台搜索、资料收集、代码入口侦察：`scout`
- 已有计划下的实现、文件生成、机械执行：`worker`
- 大任务拆解、执行顺序设计、风险排序：`planner`
- 结果验收、回归风险、代码评审：`reviewer`

后台 conn 任务如果包含多个平台检索、多个关键词搜索、多个独立页面读取，应优先用 `subagent` 的 `tasks` 并行模式，避免主 agent 串行跑完整条链路。

## 调用示例

并行检索：

```json
{
  "tasks": [
    { "agent": "scout", "task": "检索 X 平台关键词 A，输出来源、摘要和链接。" },
    { "agent": "scout", "task": "检索 Reddit 关键词 A，输出来源、摘要和链接。" },
    { "agent": "scout", "task": "检索 LinkedIn 关键词 A，输出来源、摘要和链接。" }
  ]
}
```

实现后评审：

```json
{
  "chain": [
    { "agent": "worker", "task": "按需求实现修复，并列出改动和验证结果。" },
    { "agent": "reviewer", "task": "基于上一轮输出审查实现是否有缺陷、回归风险或缺失测试：{previous}" }
  ]
}
```

单次执行：

```json
{
  "agent": "worker",
  "task": "在 output 目录写入最终摘要文件，并回报文件路径。"
}
```

## 常见错误

- 不要使用 `default`。报错里列出的 `Available: planner, reviewer, scout, worker` 就是可用菜单。
- 不要把需要共享同一个编辑状态的任务并行给多个 `worker`，容易互相踩文件。
- 不要让 `reviewer` 修改文件；它只负责指出问题。
- 不要让 `planner` 或 `scout` 做实现；需要落地时交给 `worker`。
- 子代理失败后先读 `toolResult.details.results`，看是未知 agent、权限问题、模型失败，还是任务本身写得太含糊。
