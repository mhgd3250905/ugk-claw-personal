---
name: conn-orchestrator
description: 用于提醒、定时任务、周期总结、后台自动执行和一次性延迟执行。通过 `conn` 工具直接管理任务，而不是发明关键字匹配器或表单式追问。
---

# Conn Orchestrator

## 何时使用

当用户表达下面这些意图时，优先使用这个技能：

- “明天提醒我……”
- “每天 / 每周 / 每月帮我……”
- “隔一段时间自动跑一次……”
- “到点后把结果发给我……”
- “查一下我的后台任务 / 定时任务 / conn”
- “暂停 / 恢复 / 删除某个后台任务”
- “这个任务最近跑过没有”
- “看一下上一次执行结果”

## 核心原则

1. 直接依赖 agent 的正常语言理解能力和 `conn` 工具，不要搞关键字命中、正则路由、意图枚举这种低级活。
2. 默认把结果投递到任务消息 / 全局通知。只有当用户明确指定了飞书目标，才改成别的 `target`。
3. 如果用户刚上传或复用了文件，并且希望任务后续继续使用这些资料，要把当前回合可见的 `assetRefs` 一起传给 `conn`，不要要求用户手填资源 ID。
4. 如果时间表达不清楚，只追问一个最小必要问题，不要把用户拖进配置地狱。
5. 每次创建、更新、暂停、恢复、删除或立即执行后，都给用户一个简洁结果摘要。

## 调度映射

- 一次性任务：`schedule.kind = "once"`
- 固定间隔任务：`schedule.kind = "interval"`，用 `everyMs`
- 每天固定时间：使用 `schedule.kind = "cron"`，表达式形如 `0 7 * * *`
- 如果用户明确提到时区，必须传对应 IANA `timezone`
- 如果用户没有单独指定时区，默认按用户当前口径使用 `Asia/Shanghai`，不要沿用容器 / 宿主机时区
- `once.at` 和 `interval.startAt` 如果来自用户的本地时间表达，优先传不带 `Z` 的本地 wall-clock 字符串，并同时传 `timezone: "Asia/Shanghai"`；例如北京时间下午 1 点应传 `at: "2026-04-23T13:00:00", timezone: "Asia/Shanghai"`，由后端归一化成 UTC `05:00`
- 如果你已经明确算出了 UTC 时间，可以传带 `Z` 的 ISO 字符串；但不要把用户说的北京时间 13:00 直接写成 `13:00Z`

## 目标映射

- 默认目标：任务消息 `target = { type: "task_inbox" }`；也可以省略 `target`，由工具默认补齐。
- 飞书群：`target = { type: "feishu_chat", chatId }`
- 飞书用户：`target = { type: "feishu_user", openId }`
- Legacy 会话目标仅用于读取或维护旧任务；不要为新任务编造 `conversationId`。

除非用户明确要求发到飞书，否则不要擅自改成飞书目标。

## 文件与资料

如果用户在当前回合附带了文件、复用文件或明确说“用我刚选的资料”，要这样处理：

- 从当前输入上下文里读取这些资料对应的 `assetRefs`
- 创建或更新 `conn` 时把 `assetRefs` 一起传给 `conn` 工具
- 不要让用户手填内部资源 ID
- 不要把文件内容硬塞回 prompt 正文里冒充“已保存”

## 推荐工具动作

- 创建任务：`conn(action="create", ...)`
- 查看列表：`conn(action="list")`
- 查看单个任务：`conn(action="get", connId=...)`
- 更新任务：`conn(action="update", connId=..., ...)`
- 暂停任务：`conn(action="pause", connId=...)`
- 恢复任务：`conn(action="resume", connId=...)`
- 删除任务：`conn(action="delete", connId=...)`
- 立即执行：`conn(action="run_now", connId=...)`
- 查看最近运行：`conn(action="list_runs", connId=...)`
- 查看单次运行详情：`conn(action="get_run", connId=..., runId=...)`

## 创建任务时最少要确认的事

创建 `conn` 前，至少明确这四件事：

- 任务要做什么
- 什么时间执行
- 执行一次还是周期执行
- 结果发到哪里

如果用户没给标题：

- 自动生成一个短标题，要求清楚、可识别
- 不要写成废话，比如“任务 1”“新的后台任务”

## 对用户的回报格式

每次操作后至少回报这些信息：

- `connId`
- 标题
- schedule
- target
- 当前状态
- `nextRunAt`，如果有

如果用户问“上次跑得怎么样”：

- 先查 `list_runs`
- 必要时再查 `get_run`
- 不要靠猜

## 禁止事项

- 不要发明独立的“conn 文本命令系统”
- 不要让用户手输内部 `assetId`
- 不要把飞书当默认目标
- 不要猜测、编造或依赖当前 `conversationId` 来创建后台任务
- 不要把内部执行过程中的瞬时报错夸大成最终失败
