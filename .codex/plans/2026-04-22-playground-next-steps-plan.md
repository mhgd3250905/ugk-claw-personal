# Playground Next Steps Plan

> **For the next agent:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. If UI behavior changes, verify against the real `http://127.0.0.1:3000/playground` entry instead of a fake dev-only path.

**Goal:** Finish the remaining high-risk `playground` runtime cleanup without regressing the now-stable conversation switching, transcript rendering, and refresh recovery behavior.

**Architecture:** Keep `src/ui/playground.ts` as the page assembler and shared state owner, but stop letting it remain the dumping ground for stream lifecycle and stale request orchestration. The next stage should first harden request/sync ownership, then extract stream lifecycle into its own controller, and only after that consider any final assembler cleanup.

**Tech Stack:** TypeScript, server-rendered inline classic browser script, Fastify, Node built-in test runner with `tsx`, Docker Compose, SQLite-backed runtime state, real browser smoke validation on port `3000`.

---

## 1. Current Baseline

As of `2026-04-22`, these runtime islands are already split out:

- `src/ui/playground-mobile-shell-controller.ts`
- `src/ui/playground-conversations-controller.ts`
- `src/ui/playground-layout-controller.ts`
- `src/ui/playground-transcript-renderer.ts`
- `src/ui/playground-assets-controller.ts`
- `src/ui/playground-context-usage-controller.ts`
- `src/ui/playground-conn-activity-controller.ts`

The latest stabilization commit is:

- `2d2877c fix: guard stale playground conversation restores`

That fix matters because it changed the safety bar for all follow-up work:

- stale `GET /v1/chat/state` responses must never overwrite the active conversation
- transcript reset must clear both `transcript-current` and `transcript-archive`
- any future extraction touching conversation sync or stream recovery must preserve that guard

So the next work is no longer “keep splitting files because smaller looks cleaner”. The next work is “finish the remaining split without reintroducing race conditions”.

---

## 2. What Still Lives in `playground.ts`

`src/ui/playground.ts` is still about `4387` lines and still owns the riskiest runtime paths:

- notification stream wiring
- active run event stream attach / read / recover
- message send / queue / interrupt orchestration
- canonical conversation state sync
- stale response guards that were just added

Key remaining hotspots:

- `connectNotificationStream()`
- `handleNotificationBroadcastEvent()`
- `attachActiveRunEventStream()`
- `readEventStream()`
- `handleStreamEvent()`
- `recoverRunningStreamAfterDisconnect()`
- `sendMessage()`
- `queueActiveMessage()`
- `interruptRun()`
- `syncConversationRunState()`
- `restoreConversationHistoryFromServer()`

This is the engine room now. If we keep stuffing more behavior into it, the file will get ugly again fast. If we split it carelessly, we will regress the exact refresh / active-run / queued-message paths that were painful to stabilize.

---

## 3. Recommended Order

### Phase A: Harden sync ownership before the next extraction

**Recommendation:** do this first, before the stream controller split.

**Why:**

- we just fixed one stale-response bug
- stream lifecycle extraction will multiply async call sites
- without a unified sync ownership rule, the next refactor will reopen race conditions

**Target:**

- keep implementation inside `src/ui/playground.ts` for now
- do not extract yet
- add one explicit request-generation / sync-token strategy for conversation-bound async flows

**Scope:**

- conversation-bound `fetchConversationState()` callers
- stream recovery re-sync
- notification-triggered refresh
- resume-sync refresh after `visibilitychange/pageshow/online`

**Success criteria:**

- stale state response cannot overwrite active conversation
- older sync requests cannot win over newer ones
- switching conversation or creating a new one can safely invalidate older in-flight state refreshes

**Suggested commit:**

`fix: unify playground conversation sync ownership`

### Phase B: Split stream lifecycle controller

**Recommendation:** this is the main next refactor after Phase A.

**New file:**

- `src/ui/playground-stream-controller.ts`

**Move into it:**

- stream attach / teardown
- `readEventStream()`
- `handleStreamEvent()`
- recovery after disconnect
- active submit / queue / interrupt orchestration
- assistant loading shell updates that are stream-driven

**Keep in `playground.ts`:**

- shared `state`
- DOM refs
- page assembly
- controller injection
- canonical state application entrypoints

**Must preserve:**

- `GET /v1/chat/state` remains the canonical source after refresh
- `/v1/chat/events` is only the incremental continuation channel for the current active run
- queueing while active still goes through `/v1/chat/queue`
- interrupt still goes through `/v1/chat/interrupt`
- missing `done` or network short disconnect still attempts recover, not instant failure theater

**Suggested commit:**

`refactor: split playground stream controller`

### Phase C: Final assembler cleanup pass

Only do this after Phase B is stable.

**Target:**

- reduce `playground.ts` to assembler + shared state + injection wiring
- delete dead helpers exposed by earlier splits
- normalize naming around controller hooks

**Do not do in the same commit as Phase B.**

That kind of “while I’m here” cleanup is exactly how a decent refactor turns into archaeology with a body count.

**Suggested commit:**

`refactor: trim playground assembler after stream split`

---

## 4. Detailed Execution Tasks

### Task 1: Lock the async ownership model

**Files:**

- Modify: `src/ui/playground.ts`
- Test: `test/server.test.ts`
- Docs: `docs/playground-current.md`, `docs/change-log.md`

**Work:**

1. Add failing page-level assertions for unified stale-sync protection.
2. Ensure conversation-bound sync paths share one invalidation rule.
3. Keep behavior identical for successful current-conversation responses.
4. Update docs to state the rule clearly.

**Verification:**

```powershell
node --test --import tsx test/server.test.ts --test-name-pattern "playground"
```

Expected:

- new assertions fail first
- then pass after implementation

### Task 2: Extract the stream controller

**Files:**

- Create: `src/ui/playground-stream-controller.ts`
- Modify: `src/ui/playground.ts`
- Test: `test/server.test.ts`
- Docs: `docs/playground-current.md`, `docs/change-log.md`

**Work:**

1. Write focused failing assertions that the page still embeds the stream controller hooks.
2. Move stream lifecycle helpers into the new controller fragment.
3. Keep `playground.ts` as owner of shared state and shared DOM references.
4. Wire the controller into the existing inline classic script model.

**Verification focus:**

- refresh while run is active
- network short disconnect recovery
- queue message while active
- interrupt active run
- done/error/interrupted all converge to stable final UI

### Task 3: Smoke test the real entry

**Required real entry:**

- `http://127.0.0.1:3000/playground`

**Desktop must verify:**

- create conversation
- switch conversation
- send a message
- queue while active
- interrupt while active
- refresh during active run
- no old conversation bleed-through

**Mobile must verify:**

- history drawer still works
- overflow menu still works
- composer stays usable
- refresh recovery still follows server current conversation

### Task 4: Trim the assembler only after stream extraction is stable

**Files:**

- Modify: `src/ui/playground.ts`
- Test: `test/server.test.ts`
- Docs: `docs/playground-current.md`, `docs/change-log.md`

**Work:**

1. Remove dead helpers or duplicate wrappers left by earlier splits.
2. Keep function names and injection boundaries obvious.
3. Do not change user-facing behavior here.

---

## 5. Non-Negotiable Verification

Run these serially, not in parallel:

```powershell
git diff --check
npx tsc --noEmit
node --test --import tsx test/server.test.ts
npm test
docker compose restart ugk-pi
curl.exe -s http://127.0.0.1:3000/healthz
```

Expected:

- `git diff --check`: no output
- `npx tsc --noEmit`: exit code 0
- `test/server.test.ts`: all pass
- `npm test`: all pass
- `/healthz`: `{"ok":true}`

Then verify the live page served on `3000`, not a side port.

---

## 6. Risks To Watch

- Reopening stale conversation overwrite bugs
- Breaking refresh recovery while a run is active
- Accidentally duplicating assistant bubbles after reconnect
- Mixing notification refresh with active stream state application
- Turning controller extraction into a fake move where the same chaos just lives in a new file

If two patches in a row miss the real cause, stop and re-evaluate the state ownership model before continuing.

---

## 7. Recommendation Summary

If we want the highest-value next step, do this:

1. Phase A: unify sync ownership and request invalidation
2. Phase B: split `playground-stream-controller.ts`
3. Phase C: small cleanup pass on `playground.ts`

Do **not** jump to new product features first.

Right now the best leverage is finishing the runtime boundary cleanup while the current behavior is freshly verified and the stale-response bug is still in our heads. Waiting longer just means the next person gets to rediscover the same landmines the fun way.
