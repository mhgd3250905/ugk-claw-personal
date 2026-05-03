---
name: agent-profile-ops
description: Use when the user asks to view, list, create, configure, switch, verify, archive, delete, or reason about independent agent profiles / operation windows in ugk-pi, including Chinese requests like “我有哪些agent”, “有哪些 agent”, “创建 agent”, “切换 agent”, “删除 agent”, “给 search agent 安装技能”, “给其他 agent 安装技能”, or “搜索 Agent 有哪些技能”. Do not use for legacy .pi/agents subagent files unless the user explicitly says subagent.
---

# agent-profile-ops

管理 ugk-pi 的独立 agent profile。你的目标是维护多个独立操作视窗，而不是把主 Agent 改造成调度中心。

## 核心原则

- 只把主 Agent 当作 agent profile 元操作入口；不要让它继承或假装拥有其他 agent profile 的技能。
- 新 agent 默认是“幼年版”：独立 `AGENTS.md`、独立 `pi/skills`、独立 `user-skills`、独立 workspace / sessions / conversations。
- 创建和配置时只从明确白名单选择技能；不要默认复制主 Agent 的全部用户技能。
- 主 Agent 给其他 agent profile 安装技能时，唯一允许的方式是复制主 Agent 当前已经存在且可确认来源的技能副本。
- 如果主 Agent 当前没有该技能，必须停止并告诉用户“主 Agent 没有这个技能，不能代装”；不要联网搜索、不要从外部安装、不要替其他 agent profile 创建新技能。用户需要该能力时，应切换到目标 agent 后由目标 agent 自己操作。
- 删除默认做归档；永久删除需要用户明确二次确认和项目代码支持。
- 禁止归档或删除 `main`。
- 运行中 agent 不允许归档。
- 涉及 agent profile 创建、配置、安装技能、归档、删除或可能改变用户当前操作视窗的动作时，缺少用户明确确认就只能解释影响并询问下一步；不要自作主张继续执行。

## 快速接口

| 目的 | 接口 |
| --- | --- |
| 列出 agent | `GET /v1/agents` |
| 创建 agent | `POST /v1/agents` |
| 归档 agent | `POST /v1/agents/:agentId/archive` |
| 查看技能 | `GET /v1/agents/:agentId/debug/skills` |
| 复制安装技能 | `POST /v1/agents/:agentId/skills` |
| 删除技能 | `DELETE /v1/agents/:agentId/skills/:skillName` |
| 会话接口 | `/v1/agents/:agentId/chat/*` |

创建请求示例：

```json
{
  "agentId": "research",
  "name": "研究 Agent",
  "description": "用于资料研究、查证和整理。",
  "initialSystemSkillNames": ["web-access"]
}
```

`initialSystemSkillNames` 只能填写主 Agent 当前已有且可确认来源的技能名；创建时会复制到目标 agent 的 `.data/agents/:agentId/pi/skills`。`agent-skill-ops`、`agent-runtime-ops`、`agent-filesystem-ops` 三件套默认内置，不需要也不应该重复指定。

## 工作流

1. 查看现有 agent：调用 `GET /v1/agents`，确认目标 `agentId` 不冲突。
2. 创建 agent：如果用户只是讨论或询问方案，先解释影响并询问是否创建；只有用户明确要求创建时，才调用 `POST /v1/agents`。
3. 验证目录和技能：调用 `GET /v1/agents/:agentId/debug/skills`，确认只看到该 agent 自己的系统技能和用户技能。
4. 切换 agent：不要声称能替用户切换；提示用户在 Playground 左侧会话 rail 底部“设置”菜单切换，除非后续已有明确的 UI 激活接口和用户要求自动切换。
5. 配置技能：创建时的 `initialSystemSkillNames` 会把主 Agent 当前已有且来源明确的技能复制到该 agent 的 `.data/agents/:agentId/pi/skills`；创建后追加安装调用 `POST /v1/agents/:agentId/skills`，只允许把主 Agent 当前已有且来源明确的技能复制到该 agent 自己的 `user-skills` 目录。如果主 Agent 没有目标技能，停止、说明原因，并询问用户是否要切换到目标 agent 自己处理。
6. 归档 agent：先说明影响范围并询问确认；确认不是 `main`、确认没有 running conversation 后，才调用 `POST /v1/agents/:agentId/archive`。

## 其他 Agent 技能安装边界

主 Agent 帮其他 agent profile 安装技能时只能做复制安装：

1. 先查主 Agent 真实技能清单或本地技能目录，确认目标技能已经存在。
2. 找到该技能的真实来源目录。
3. 如果用户请求不够明确，先列出将复制的技能和目标目录，询问是否继续。
4. 用户确认后，复制到目标 agent 自己的 `user-skills` 目录，除非这是项目定义的系统级元技能。
5. 调 `GET /v1/agents/:agentId/debug/skills` 验证目标 agent 只从自己的目录看到该技能。

删除其他 agent profile 的技能时，必须先确认影响，再调用 `DELETE /v1/agents/:agentId/skills/:skillName`。`main` 不能通过这组接口管理技能，`agent-skill-ops`、`agent-runtime-ops`、`agent-filesystem-ops` 三件套不能删除。

禁止主 Agent 为其他 agent profile 执行这些事：

- 安装主 Agent 当前没有的技能。
- 从 GitHub、网页、包管理器或外部路径下载技能。
- 为其他 agent profile 新建业务技能。
- 把主 Agent 的 `.pi/skills` 或 `runtime/skills-user` 加入其他 agent profile 的 `allowedSkillPaths`。
- 用 symlink / junction 让其他 agent profile 共享主 Agent 技能目录。

## 文件边界

非主 agent 的标准目录：

```text
.data/agents/:agentId/
  AGENTS.md
  pi-agent/
  pi/skills/
  user-skills/
  workspace/
  sessions/
  conversation-index.json
```

运行态 profile 清单保存在：

```text
.data/agents/profiles.json
```

归档目录：

```text
.data/agents-archive/:agentId-<timestamp>/
```

## 常见错误

- 不要把 `.pi/skills` 或 `runtime/skills-user` 说成其他 agent profile 的技能目录。
- 不要从项目文档猜测某个 agent 已安装技能；查 scoped debug skills。
- 不要说“我可以帮其他 agent 安装任何技能”；主 Agent 只能复制自己已有的技能。
- 不要在主 Agent 没有技能时替其他 agent 外部安装；切换到目标 agent 后再处理。
- 不要把“要不要继续”替用户决定；涉及创建、修改、安装、归档、删除时，先问清楚。
- 不要说“要我帮你切换过去看看”；应提示用户在 Playground 设置菜单切换到目标 agent。
- 不要直接删除 agent 目录；第一版只归档。
- 不要在 agent 正在运行时归档。
- 不要把创建 agent profile / 操作视窗和“派发 subagent 执行任务”混为一谈。
