---
name: team-plan-creator
description: Use when and only when the user message contains the explicit keyword "/team-plan". This skill guides the Agent through creating TeamUnit presets and Plans via the /v1/team REST API. If the user merely mentions "team plan", "团队计划", Team Runtime, or planning without "/team-plan", do not use this skill automatically; ask whether they want to start with "/team-plan".
---

# Team Plan Creator

Use this skill to create Team Runtime v2 plans and team presets through the REST API. This skill only creates or updates planning resources. It must not create or start Runs.

## Activation contract

This skill has a strict activation keyword:

- **MUST activate** when the user message contains `/team-plan`.
- **MUST NOT activate automatically** when the user only mentions `team plan`, `Team Plan`, `团队计划`, `Team Runtime`, "计划", or a vague intention to plan work.
- If the user mentions Team planning without `/team-plan`, reply briefly that Team Plan creation is available through `/team-plan`, and ask them to resend or confirm with that keyword.
- Treat `/team-plan` as an intent boundary, not as normal prose. Once active, this skill must stay in planning-resource mode and must not start implementation work.

Examples:

- `/team-plan 帮我创建一个分步骤计划，目标是优化 Team UI` → activate this skill.
- `我想聊聊 team plan 怎么设计` → do not activate; discuss or ask whether they want to use `/team-plan`.
- `创建一个团队计划` → do not create anything yet; ask the user to use `/team-plan 创建一个团队计划...` if they want the guarded workflow.

## Workflow

### Step 1: Ask the user

Before touching any API, ask the user:

1. **Goal** — What do you want the team to accomplish?
2. **Deliverable** — What should the final output look like?
3. **Existing resources** — Do you have a TeamUnit you want to reuse?
4. **Task granularity** — Roughly how many steps do you want to break this into?

Do not proceed to API calls until the user has answered at least the goal and deliverable questions.

### Step 2: Check existing resources

Before creating anything, list what's already available:

- `GET /v1/team/team-units` — list existing team presets
- `GET /v1/team/plans` — list existing plans

If a suitable TeamUnit already exists, reuse it. Only create a new TeamUnit when no existing one fits the user's needs.

### Step 3: Create or reuse a TeamUnit (if needed)

A TeamUnit binds 4 AgentProfile IDs to the 4 roles. Create one only if no suitable team exists:

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

All 4 profile IDs can be the same value if one AgentProfile handles multiple roles. Before creating, verify all profile IDs exist via `GET /v1/agents`.

### Step 4: Design tasks and preview Plan JSON

Design the task list following the rules below. Before calling the API, show the user the full Plan JSON for review. Do not create the Plan until the user confirms the preview.

### Step 5: Create the Plan

After user confirms the preview:

```
POST /v1/team/plans
{
  "title": "计划名称",
  "defaultTeamUnitId": "<teamUnitId>",
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

## Task splitting rules

- One task = one coherent unit of work with a clear deliverable.
- `task.input.text` must be specific and actionable. Never write vague descriptions like "研究所有东西" or "分析一切".
- `acceptance.rules` must be specific and verifiable. Each rule should be checkable by reading the output. Good: "输出包含至少3个域名候选并标注来源". Bad: "完成分析".
- `outputContract.text` must clearly describe the expected final format and content.
- Avoid tasks that are too broad (one task should not try to do everything) or too narrow (one task per trivial step).
- If a task depends on a previous task's output, state the dependency in `input.text`.

## Prohibitions

This skill MUST NOT:

1. Call `POST /v1/team/plans/:planId/runs` — creating or starting a Run is outside this skill.
2. Automatically start a Run after creating a Plan.
3. Directly edit files under `.data/team/` — all changes must go through the REST API.

If the user asks to start a run, tell them to use the `/playground/team` UI or call the Run API directly outside this skill.

## Verification

After creating resources, the user can verify via:

- `GET /v1/team/team-units` — confirm team presets
- `GET /v1/team/plans` — confirm plans
- `GET /v1/team/plans/:planId` — inspect plan details

This skill does not verify runs, task progress, or reports. Those are outside its scope.
