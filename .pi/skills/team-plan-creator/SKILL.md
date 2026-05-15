---
name: team-plan-creator
description: Use when the user asks to create a Team Runtime plan, set up a team for multi-agent task execution, or mentions Chinese phrases like "创建团队计划", "新建团队", "配置执行团队". This skill guides the Agent through creating TeamUnit presets and Plans via the /v1/team REST API.
---

# Team Plan Creator

Use this skill to create Team Runtime v2 plans and team presets through the REST API. This skill only creates or updates planning resources. It must not create or start Runs.

## Workflow

### 1. Check existing resources

First, list what's already available:

- `GET /v1/team/team-units` — list existing team presets
- `GET /v1/team/plans` — list existing plans

### 2. Create a TeamUnit (if needed)

A TeamUnit binds 4 AgentProfile IDs to the 4 roles. If no suitable team exists, create one:

```
POST /v1/team/team-units
{
  "title": "团队名称",
  "description": "团队用途描述",
  "workerProfileId": "worker",
  "checkerProfileId": "checker",
  "watcherProfileId": "watcher",
  "finalizerProfileId": "finalizer"
}
```

All 4 profile IDs can be the same value if one AgentProfile handles multiple roles.

### 3. Create a Plan

A Plan contains an ordered list of tasks with acceptance criteria:

```
POST /v1/team/plans
{
  "title": "计划名称",
  "defaultTeamUnitId": "<teamUnitId from step 2>",
  "goal": { "text": "计划目标描述" },
  "tasks": [
    {
      "id": "task_1",
      "title": "任务标题",
      "input": { "text": "任务详细描述" },
      "acceptance": { "rules": ["验收标准1", "验收标准2"] }
    }
  ],
  "outputContract": { "text": "最终输出格式要求" }
}
```

Tasks execute sequentially. Each task goes through worker → checker → watcher phases.

### 4. Verify the Plan

- `GET /v1/team/runs` — list all runs
- `GET /v1/team/runs/:runId` — get current state and task progress
- `POST /v1/team/runs/:runId/cancel` — cancel a running run
- `GET /v1/team/runs/:runId/final-report` — get the final summary report

## Guidelines

- Ask the user what they want the team to accomplish before creating tasks.
- Break work into focused tasks with clear acceptance criteria.
- One task = one coherent unit of work. Avoid vague tasks like "research everything".
- Acceptance rules should be specific and verifiable.
- If the user already has a team preset, reuse it rather than creating a new one.
- Plans with existing runs cannot have their tasks edited — create a new plan instead.
- Do not call `POST /v1/team/plans/:planId/runs`; creating or starting a Run is outside this skill.
