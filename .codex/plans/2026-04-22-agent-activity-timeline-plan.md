# Agent Activity Timeline Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task after explicit user approval.

**Goal:** Build an Agent-level global activity timeline so background `conn` results remain visible even when the user switches conversations, without corrupting conversation transcript semantics.

**Architecture:** Keep `conversation` as the canonical chat context and add a persisted Agent Activity read model for cross-conversation visibility. Background `conn` completion will continue writing conversation notifications for backward compatibility, and will also write an activity item that the playground can show in a global "activity / inbox" surface.

**Tech Stack:** TypeScript ESM, Fastify, Node test runner, SQLite via `ConnDatabase`, existing playground single-file UI in `src/ui/playground.ts`.

---

## Current Facts

- `conn` currently targets a specific conversation through `ConnTarget.type === "conversation"` in `src/agent/conn-store.ts`.
- `ConnWorker.deliverConversationNotification()` writes results to `conversation_notifications` using `conn.target.conversationId`.
- `AgentService.getConversationState(conversationId)` only merges notifications for the requested conversation.
- `playground` subscribes to `/v1/notifications/stream`, but that is only an online toast layer; persisted visibility still follows the target conversation.
- Therefore switching conversations can hide completed `conn` results from the active transcript, even though the result exists in SQLite and may have been toasted online.

## Design Decision

Do not turn the main transcript into a global pseudo-conversation.

Instead:

- `Conversation Transcript` remains scoped to one `conversationId`.
- `Agent Activity Timeline` becomes a separate global feed of things that happened in this agent instance.
- A `conn` result can appear in both places:
  - In the bound conversation transcript as today's compatible notification behavior.
  - In the global activity timeline so the user can find it regardless of the current conversation.

This avoids the nasty UX where the user sees a global item but replies into the wrong conversation context. That kind of ambiguity is how software starts gaslighting its own operator.

## Proposed Data Model

Add a new persisted read model table:

```sql
CREATE TABLE IF NOT EXISTS agent_activity_items (
  activity_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  run_id TEXT,
  conversation_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  files_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_activity_created_at
  ON agent_activity_items(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_activity_conversation_id
  ON agent_activity_items(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_activity_source_run
  ON agent_activity_items(source, source_id, run_id);
```

Initial item shape:

```ts
interface AgentActivityItem {
	activityId: string;
	scope: "agent";
	source: "conn" | "chat" | "feishu" | string;
	sourceId: string;
	runId?: string;
	conversationId?: string;
	kind: string;
	title: string;
	text: string;
	files: ConversationNotificationFile[];
	createdAt: string;
	readAt?: string;
}
```

For the first implementation, only `conn` terminal results need to write activity items. Foreground chat run items can be added later if useful; do not boil the ocean just because the pot is nearby.

---

### Task 1: Add Agent Activity Store and SQLite Schema

**Files:**
- Modify: `src/agent/conn-db.ts`
- Create: `src/agent/agent-activity-store.ts`
- Test: `test/agent-activity-store.test.ts`
- Test: `test/conn-db.test.ts`

**Step 1: Write failing schema tests**

Add tests that initialize `ConnDatabase` and assert:

- `agent_activity_items` table exists.
- Indexes for `created_at`, `conversation_id`, and source/run lookup exist.
- Existing `conversation_notifications` table still exists.

Run:

```bash
npm test -- test/conn-db.test.ts
```

Expected: FAIL because the new table/indexes do not exist.

**Step 2: Write failing store tests**

Create `test/agent-activity-store.test.ts` covering:

- `create()` inserts a `conn` activity item with optional `conversationId` and `runId`.
- Creating the same `source/sourceId/runId` twice deduplicates and returns the existing item.
- `list({ limit })` returns newest-first global items.
- `list({ conversationId })` filters to a conversation when needed.
- `markRead(activityId)` sets `readAt`.

Run:

```bash
npm test -- test/agent-activity-store.test.ts
```

Expected: FAIL because `AgentActivityStore` does not exist.

**Step 3: Implement schema**

Update `src/agent/conn-db.ts`:

- Add `agent_activity_items` to the known table list.
- Add the `CREATE TABLE IF NOT EXISTS agent_activity_items` block.
- Add the three indexes listed above.
- If `user_version` migration is already meaningful, bump carefully; otherwise keep the existing idempotent table creation style.

**Step 4: Implement store**

Create `src/agent/agent-activity-store.ts` with:

- `AgentActivityItem`
- `CreateAgentActivityInput`
- `AgentActivityStore.create(input)`
- `AgentActivityStore.list(options?: { limit?: number; before?: string; conversationId?: string })`
- `AgentActivityStore.markRead(activityId)`

Keep JSON parsing tolerant for `files_json`, matching `ConversationNotificationStore`.

**Step 5: Verify**

Run:

```bash
npm test -- test/conn-db.test.ts test/agent-activity-store.test.ts
```

Expected: PASS.

---

### Task 2: Write Conn Results Into Agent Activity

**Files:**
- Modify: `src/workers/conn-worker.ts`
- Modify: `src/server.ts`
- Test: `test/conn-worker.test.ts`
- Test: `test/server.test.ts`

**Step 1: Write failing worker tests**

Extend `test/conn-worker.test.ts` so a successful `conn` run asserts:

- A conversation notification is still created for `manual:conn`.
- A global activity item is also created with:
  - `source = "conn"`
  - `sourceId = conn.connId`
  - `runId = run.runId`
  - `conversationId = "manual:conn"`
  - title and text matching the delivered notification.

Add equivalent coverage for failed / timed-out `conn` runs, because those were recently fixed and should not regress.

Run:

```bash
npm test -- test/conn-worker.test.ts
```

Expected: FAIL because `ConnWorker` does not accept or write to an activity store.

**Step 2: Add dependency to worker**

Update `ConnWorkerOptions` in `src/workers/conn-worker.ts`:

```ts
activityStore?: {
	create(input: CreateAgentActivityInput): Promise<AgentActivityItem>;
};
```

After `notificationStore.create(...)`, also call `activityStore?.create(...)`.

Important compatibility rule:

- If activity write fails, it should be logged and should not prevent the existing conversation notification from being delivered.
- Do not make the old notification chain depend on the new read model. That's how you turn a visibility feature into a production outage.

**Step 3: Wire default worker**

In `main()` in `src/workers/conn-worker.ts`:

- Instantiate `AgentActivityStore` with the same `ConnDatabase`.
- Pass it into `ConnWorker`.

In `src/server.ts`:

- Instantiate `AgentActivityStore` for the foreground server.
- Pass it to new activity routes in Task 3.

**Step 4: Verify**

Run:

```bash
npm test -- test/conn-worker.test.ts
```

Expected: PASS.

---

### Task 3: Add Activity API Routes

**Files:**
- Create: `src/routes/activity.ts`
- Modify: `src/server.ts`
- Modify: `src/types/api.ts`
- Test: `test/server.test.ts`

**Step 1: Write failing API tests**

Add tests in `test/server.test.ts` for:

- `GET /v1/activity` returns persisted activity items newest-first.
- `GET /v1/activity?conversationId=manual%3Aone` filters by conversation.
- `GET /v1/activity?limit=2` limits results.
- `POST /v1/activity/:activityId/read` marks an activity item read.
- Invalid `limit` returns `400`.

Run:

```bash
npm test -- test/server.test.ts
```

Expected: FAIL because routes do not exist.

**Step 2: Add response types**

Update `src/types/api.ts`:

```ts
export interface AgentActivityFileBody {
	fileName: string;
	downloadUrl: string;
	mimeType?: string;
	sizeBytes?: number;
}

export interface AgentActivityItemBody {
	activityId: string;
	scope: "agent";
	source: string;
	sourceId: string;
	runId?: string;
	conversationId?: string;
	kind: string;
	title: string;
	text: string;
	files: AgentActivityFileBody[];
	createdAt: string;
	readAt?: string;
}

export interface AgentActivityListResponseBody {
	activities: AgentActivityItemBody[];
}

export interface AgentActivityReadResponseBody {
	activity: AgentActivityItemBody;
}
```

**Step 3: Implement route**

Create `src/routes/activity.ts`:

- `GET /v1/activity`
- `POST /v1/activity/:activityId/read`

Use the same defensive parsing style as `src/routes/conns.ts` and `src/routes/chat.ts`.

**Step 4: Register route**

In `src/server.ts`:

- Import `AgentActivityStore`.
- Create default store from `connDatabase`.
- Register `registerActivityRoutes(app, { activityStore })`.

**Step 5: Verify**

Run:

```bash
npm test -- test/server.test.ts
```

Expected: PASS.

---

### Task 4: Add Playground Global Activity Surface

**Files:**
- Modify: `src/ui/playground.ts`
- Test: `test/server.test.ts`

**Step 1: Write failing playground markup tests**

Add tests asserting `/playground` contains:

- `agent-activity-dialog`
- `agent-activity-list`
- `open-agent-activity-button`
- `function loadAgentActivity(`
- `fetch("/v1/activity`
- Activity entries can open existing conn run detail when `source=conn` and `runId` exists.

Run:

```bash
npm test -- test/server.test.ts
```

Expected: FAIL because the UI surface does not exist.

**Step 2: Add UI entry points**

In `src/ui/playground.ts`:

- Desktop: add an `活动` / `全局活动` icon button near the existing `后台任务` entry.
- Mobile: add `全局活动` to the right-top overflow menu.
- Keep it visually separate from the conversation drawer. This is not another conversation list.

Do not add a big marketing explanation block. The UI should behave, not lecture.

**Step 3: Add state and data loading**

Add state fields:

```js
activityOpen: false,
activityItems: [],
activityLoading: false,
activityError: "",
```

Implement:

- `openAgentActivity()`
- `closeAgentActivity()`
- `fetchAgentActivity()`
- `loadAgentActivity({ silent })`
- `renderAgentActivity()`

Each item should display:

- title
- text preview
- source label
- created time
- target conversation, if present
- `查看后台任务过程` when it is a `conn` item with `sourceId` and `runId`

**Step 4: Connect live broadcast**

Update `handleNotificationBroadcastEvent(rawEvent)`:

- Keep showing the existing toast.
- Keep syncing conversation catalog and state.
- Also call `loadAgentActivity({ silent: true })` so online pages update the global activity list.

This is deliberately simple. Do not try to synthesize a full activity item client-side from the minimal notification event; fetch persisted truth from `/v1/activity`.

**Step 5: Verify**

Run:

```bash
npm test -- test/server.test.ts
```

Expected: PASS.

---

### Task 5: Document New Runtime Semantics

**Files:**
- Modify: `docs/runtime-assets-conn-feishu.md`
- Modify: `docs/playground-current.md`
- Modify: `docs/traceability-map.md`
- Modify: `docs/change-log.md`
- Test: `test/server.test.ts` if any docs-linked route assumptions change

**Step 1: Update runtime docs**

In `docs/runtime-assets-conn-feishu.md`, add a section:

```md
## Agent Activity Timeline

- `conn` terminal results now write both:
  - the original target conversation notification
  - a global Agent Activity item
- `GET /v1/activity` is the persisted global feed.
- `/v1/notifications/stream` remains the live online hint layer and does not replace persisted activity.
- Conversation transcript remains scoped to `conversationId`; global activity does not enter pi session history.
```

**Step 2: Update playground docs**

In `docs/playground-current.md`, add:

- Desktop and mobile entry points for global activity.
- Difference between conversation transcript and Agent Activity Timeline.
- Live broadcast refresh behavior.
- Conn run detail reuse from activity items.

**Step 3: Update traceability map**

In `docs/traceability-map.md`, add a scenario for:

- "conn 跑完了，但当前会话看不到结果"
- First files to inspect:
  - `src/agent/agent-activity-store.ts`
  - `src/routes/activity.ts`
  - `src/workers/conn-worker.ts`
  - `src/ui/playground.ts`
  - `docs/runtime-assets-conn-feishu.md`

**Step 4: Add change log**

Append a `2026-04-22` entry explaining:

- Added global Agent Activity Timeline.
- Preserved conversation notification behavior.
- Added `/v1/activity`.
- Added playground global activity surface.

**Step 5: Verify**

Run:

```bash
npm test
```

Expected: PASS.

---

## Fix Impact Analysis

### Direct Impact

- `ConnWorker.deliverConversationNotification()` gains a second write target. Existing conversation notification behavior must remain unchanged.
- `src/server.ts` gains one new store and one new route registration.
- `src/types/api.ts` gains additive response types only; no existing response shape should change.
- `src/ui/playground.ts` gains a new panel and live refresh hook; current transcript rendering must remain scoped to `conversationId`.

### Indirect Impact

- SQLite write volume increases by one row per deliverable `conn` terminal result.
- `/v1/notifications/stream` remains process-local and best-effort; persisted `/v1/activity` becomes the reload-safe truth.
- Conversation catalog ordering should continue to use conversation notifications. Global activity should not unexpectedly reorder conversations unless a later task explicitly chooses that.

### Data Compatibility

- New table is additive and should not require migration of old rows.
- Old `conversation_notifications` rows remain readable.
- Old `conn` records do not need backfill.
- If backfill is later desired, it should be a separate explicit task, not hidden in startup.

---

## Acceptance Criteria

- A `conn` result remains visible in its target conversation as before.
- The same `conn` result appears in `GET /v1/activity`.
- Switching to another conversation does not hide the result from the global activity surface.
- The global activity item can open the existing conn run detail dialog.
- `npm test` passes.
- Docs and `docs/change-log.md` reflect the new behavior.

## Execution Gate

This plan is documentation only. Do not implement it until the user explicitly approves execution, for example with `$do-plan .codex/plans/2026-04-22-agent-activity-timeline-plan.md`.
