# Runtime / Conn / Feishu Execution Plan

> **For the next agent:** REQUIRED SUB-SKILL: Use `executing-plans` when implementation starts. This document is a planning artifact only. Do not touch source code until the user explicitly approves execution.

**Goal:** In one controlled sequence, stabilize the existing runtime and `playground` experience, close the known `web-access` cleanup and file-delivery regressions, improve `conn` usability without breaking its current data model, and only after that introduce a genuinely decoupled Feishu integration architecture.

**Architecture:** Treat the current runtime as the production baseline and optimize around its real boundaries instead of rewriting stable chains. Keep `AgentService`, `conn`, and `playground` as the three primary cores; add thin, well-scoped modules around them rather than pushing more logic back into `src/ui/playground.ts` or hard-wiring Feishu into unrelated code paths.

**Tech Stack:** TypeScript, Fastify, inline server-rendered browser script, SQLite-backed runtime stores, Docker Compose, Node built-in test runner with `tsx`, GitHub `main` branch, Tencent Cloud Singapore production deployment.

---

## 1. Current Baseline And Real Findings

This plan is based on the repository state as of `2026-04-23` and the currently observed code paths, not on guesswork.

### 1.1 Runtime and browser cleanup baseline

- `src/agent/agent-service.ts` already calls `closeBrowserTargetsForScope(undefined)` in `runChat()` `finally`.
- `src/agent/browser-cleanup.ts` already posts cleanup requests to the browser proxy `POST /session/close-all?metaAgentScope=...`.
- That means the right direction is **tightening and verifying cleanup coverage**, not inventing a second cleanup mechanism.

### 1.2 File delivery baseline

- `.pi/extensions/send-file.ts` already registers `send_file` and persists artifacts through `AssetStore`.
- `AgentService` already extracts file artifacts from tool results and run output.
- The user-visible symptom "file chip appears and then disappears" is therefore more likely a **conversation state / transcript re-render regression** than a missing backend send step.

### 1.3 Conversation switching baseline

- `POST /v1/chat/current` in `src/routes/chat.ts` is thin and delegates to `agentService.switchConversation`.
- `switchConversation()` in `src/agent/agent-service.ts` is also lightweight.
- A more likely bottleneck is the catalog refresh path, especially `getConversationCatalog()` which currently derives notification counts with per-conversation store reads.
- So the fix target should be the real slow chain, not fake front-end delay cosmetics.

### 1.4 Conn baseline

- `conn` persistence and execution are already mature:
  - `src/agent/conn-store.ts`
  - `src/agent/conn-db.ts`
  - `src/agent/conn-sqlite-store.ts`
  - `src/workers/conn-worker.ts`
- The current usability problem is the editor UI in `src/ui/playground-conn-activity-controller.ts`, which still expects manual `assetRefs` text input.
- That is a UX debt, not a reason to redesign the `conn` storage model.

### 1.5 Existing conn skill baseline

- The project already has `.pi/skills/conn-orchestrator/SKILL.md`.
- The correct next step is to **upgrade and operationalize this system skill**, not create a duplicate parallel skill that will later fight with it.

### 1.6 Feishu baseline

- `src/integrations/feishu/service.ts` currently handles webhook traffic directly.
- The existing implementation still contains simplistic interrupt intent recognition and only shallow file handling.
- `src/server.ts` wires Feishu directly into the main server assembly.
- Therefore Feishu should be treated as a **modular architecture task first**, not as "just add more handlers".

---

## 2. Guardrails

These are non-negotiable during execution.

1. Do not destabilize the current `web-access`, multi-session, stream recovery, and `playground` runtime baseline.
2. Do not re-stuff extracted controller logic back into `src/ui/playground.ts`.
3. Do not replace `conn` internal `assetRefs` with a brand-new persistence model just because the UI is awkward.
4. Do not introduce keyword-matching theater for agent-driven `conn` control.
5. Do not ship Feishu as another hard-coded branch tangled into existing chat flow.
6. Every behavior change must update docs in the same round:
   - `docs/change-log.md`
   - `docs/playground-current.md`
   - `docs/runtime-assets-conn-feishu.md`
   - any other touched canonical doc when facts change
7. Every major phase must leave a rollback point:
   - Git commit
   - verification evidence
   - final backup tag before Feishu implementation

---

## 3. Recommended Execution Order

The work should be split into **two execution stages**.

### Stage A: Stabilization and UX closure

This stage covers user items `0` through `10` except the Feishu implementation itself.

Why first:

- It removes current runtime regressions before new integration load is added.
- It gives us a clean backup tag on a known-good baseline.
- It prevents Feishu work from being blamed for pre-existing chat, file, or browser cleanup bugs.

### Stage B: Feishu architecture and implementation

This stage covers user item `11`.

Why second:

- Feishu is effectively a new channel module and deserves separate architectural treatment.
- It will benefit from the stabilized runtime, custom confirmation primitives, file-picker UX patterns, and better asset/file handling from Stage A.

---

## 4. Stage A Detailed Plan

## 4.1 Phase A0: Baseline backup and fact capture

**Goal:** Create a safe rollback point before touching runtime behavior.

**Files / areas to inspect only before coding:**

- `src/agent/agent-service.ts`
- `src/agent/browser-cleanup.ts`
- `src/ui/playground.ts`
- `src/ui/playground-transcript-renderer.ts`
- `src/ui/playground-conversations-controller.ts`
- `src/ui/playground-conn-activity-controller.ts`
- `src/routes/chat.ts`
- `src/routes/conns.ts`

**Execution tasks:**

1. Record current `git status`, `git log -1`, and the current production-oriented baseline in docs/work notes.
2. Run baseline checks before any source change.
3. Confirm no uncommitted unrelated work is about to be trampled.

**Verification:**

```powershell
git status --short
git log -1 --oneline
npx tsc --noEmit
node --test --import tsx test/server.test.ts
npm test
```

**Suggested commit boundary:** no code commit yet; this is the starting checkpoint.

---

## 4.2 Phase A1: Fix `web-access` browser target cleanup without destabilizing the skill

**User problem:** `web-access` opens pages that remain alive after task completion, interruption, or manual close, gradually wasting resources.

**Real constraint source:** cleanup already exists in `AgentService` and `browser-cleanup.ts`, so the work is to close coverage gaps rather than reinvent the flow.

**Likely root-cause directions to verify:**

- cleanup only closes the current known scope but misses retained targets opened under adjacent metadata
- interruption / abort paths do not always feed the same cleanup metadata
- browser proxy cleanup may succeed partially while the runtime assumes full success
- cleanup may happen too early or only at one lifecycle exit point

**Implementation shape:**

1. Audit the exact scope metadata written by `web-access` sessions.
2. Normalize cleanup invocation so completion, interruption, and terminal failure all converge through the same cleanup policy.
3. Make cleanup idempotent and warning-only on failure so it never hides the original task result.
4. Add focused logging that is useful for diagnosis but not noisy.

**Files likely involved:**

- `src/agent/agent-service.ts`
- `src/agent/browser-cleanup.ts`
- possibly `runtime/skills-user/web-access/...` only if scope metadata proves inconsistent
- related tests covering cleanup invocation boundaries

**Verification focus:**

- normal completion closes retained targets
- interrupt closes retained targets
- failed run still attempts cleanup
- no regression to stable `web-access` usage

**Suggested commit:**

`fix: harden web-access browser target cleanup`

---

## 4.3 Phase A2: Fix sent-file chips disappearing after initial display

**User problem:** agent-delivered files briefly appear in chat and then disappear.

**Real constraint source:** `send_file` backend flow already exists; the likely regression is transcript/state merge or canonical history restore.

**Investigation targets:**

- `src/ui/playground-transcript-renderer.ts`
- `src/ui/playground.ts`
- `src/agent/agent-service.ts`
- `src/types/api.ts`
- tests covering canonical conversation state and file entries

**Likely failure modes to verify:**

- stream-time file payload is rendered, but later `GET /v1/chat/state` restore drops `files`
- history merge rewrites assistant entries and loses attachment metadata
- normalization code treats file-bearing assistant messages as incomplete transient state

**Implementation shape:**

1. Reproduce with a deterministic test flow using `send_file`.
2. Ensure the canonical stored conversation entry preserves file metadata.
3. Ensure renderer/state restore paths preserve and re-render the same metadata.
4. Verify refresh and conversation switch do not drop delivered files.

**Suggested commit:**

`fix: preserve delivered files across transcript sync`

---

## 4.4 Phase A3: Make conn file selection user-facing instead of raw `assetRefs` text entry

**User problem:** `conn` create/edit requires users to know resource IDs in advance.

**Real constraint source:** `assetRefs` should remain the internal contract; the UX should provide file selection and reuse, then write the resulting IDs for the user.

**Implementation shape:**

1. Keep `conn` payload contract unchanged: `assetRefs: string[]`.
2. Replace raw free-text-only editing with a user-facing selection flow:
   - choose from existing reusable files/assets
   - upload new file and capture the returned asset reference
   - show selected results as chips/cards
3. Keep advanced/manual editing only if truly necessary, and hide it behind an expert affordance instead of making it the default.

**Files likely involved:**

- `src/ui/playground-conn-activity-controller.ts`
- `src/routes/files.ts`
- `src/agent/asset-store.ts`
- `docs/runtime-assets-conn-feishu.md`
- `docs/playground-current.md`

**Verification focus:**

- create `conn` with reused asset
- create `conn` with newly uploaded file
- edit existing `conn` and retain prior asset refs
- confirm no persistence or worker regression

**Suggested commit:**

`feat: add conn asset picker and upload flow`

---

## 4.5 Phase A4: Upgrade the existing `conn` system skill for natural-language task orchestration

**User problem:** users should be able to ask the agent in natural language to manage `conn` tasks.

**Real constraint source:** the repository already has `.pi/skills/conn-orchestrator/SKILL.md`. The right move is to strengthen it into the official system skill instead of duplicating behavior elsewhere.

**Architecture direction:**

1. Keep orchestration intelligence in the skill and tool contract, not brittle keyword matching.
2. Teach the agent how to:
   - inspect existing tasks
   - create/update/pause/resume/run/delete tasks
   - handle assets/files in the right order
   - ask for missing structured data only when necessary
3. Ensure the skill references actual `conn` capabilities and limitations, not imagined behavior.

**Files likely involved:**

- `.pi/skills/conn-orchestrator/SKILL.md`
- `.pi/settings.json` or project skill registration entrypoints if required
- `docs/runtime-assets-conn-feishu.md`
- maybe prompt wiring if system skill exposure needs explicit inclusion

**Verification focus:**

- skill is visible/loaded in runtime
- agent can create and edit `conn` via tool use rather than ad-hoc text hacks
- no low-grade keyword intent router is introduced

**Suggested commit:**

`feat: promote conn orchestration as system skill`

---

## 4.6 Phase A5: Add conversation delete entry and unified custom confirmation modal

**User problems:**

- conversation sidebar needs a delete entry
- delete confirmations should not use browser/system dialogs

**Real constraint source:**

- server-side conversation delete capability already exists at the store layer
- UI still uses `window.confirm` in the `conn` controller
- the delete experience should follow project style and be reusable

**Implementation shape:**

1. Add a proper chat conversation delete API route instead of overloading unrelated reset semantics.
2. Add delete affordance in sidebar items:
   - desktop: explicit action button on hover/focus
   - mobile: action menu or long-press with visible fallback
3. Build a reusable custom confirmation dialog controller/component aligned with current theme.
4. Migrate existing destructive actions in `conn` UI and new conversation delete flow to this custom dialog.

**Files likely involved:**

- `src/routes/chat.ts`
- `src/agent/agent-service.ts`
- `src/ui/playground-conversations-controller.ts`
- `src/ui/playground-conn-activity-controller.ts`
- `src/ui/playground.ts`
- tests and docs

**Verification focus:**

- delete conversation from sidebar
- delete `conn` task using custom modal
- keyboard and mobile usability
- no system `confirm` remains in these flows

**Suggested commit:**

`feat: add custom confirm modal and conversation delete flow`

---

## 4.7 Phase A6: Polish composer alignment and move context popup into the top area

**User problems:**

- textarea placeholder and input text are not vertically centered
- context usage dialog should appear in the top area now that the trigger moved there

**Implementation shape:**

1. Fix textarea line-height, padding, and autosize alignment so both placeholder and typed text look vertically centered.
2. Re-anchor the context usage popup/dialog to the upper status/top area rather than the old lower region.
3. Ensure desktop and mobile behavior remain coherent with the current `UGK CLAW` theme.

**Files likely involved:**

- `src/ui/playground.ts`
- `src/ui/playground-context-usage-controller.ts`
- `docs/playground-current.md`
- test assertions if page markup changes

**Suggested commit:**

`fix: align composer text and top-anchor context panel`

---

## 4.8 Phase A7: Remove the real bottleneck behind slow conversation switching

**User problem:** after many switches, `/v1/chat/current` feels slow and the whole switch becomes laggy.

**Real finding:** the route itself is lightweight; likely follow-up catalog/state synchronization is doing the damage.

**Investigation priority:**

1. `AgentService.getConversationCatalog()`
2. notification count/preview derivation
3. front-end switch flow sequencing in `playground-conversations-controller.ts`
4. repeated catalog sync after every switch

**Implementation direction:**

1. Measure the actual slow path instead of blaming the route name.
2. Reduce or batch catalog-side expensive per-conversation reads.
3. Make conversation switching optimistic in UI only if backend correctness remains guaranteed.
4. Ensure no switch action blocks on unrelated sidebar metadata work when the transcript itself can already update.

**Files likely involved:**

- `src/agent/agent-service.ts`
- `src/ui/playground-conversations-controller.ts`
- notification store access points
- tests for switching and state sync behavior

**Suggested commit:**

`perf: reduce conversation switch latency`

---

## 4.9 Phase A8: Stage A wrap-up, docs, backup tag

**Required deliverables before touching Feishu implementation:**

1. Source and tests green.
2. Docs updated.
3. Git history split into sane commits.
4. One explicit backup tag cut from the stable post-fix baseline.

**Docs to update at minimum:**

- `docs/change-log.md`
- `docs/playground-current.md`
- `docs/runtime-assets-conn-feishu.md`
- `docs/traceability-map.md` if lookup paths change materially
- `docs/handoff-current.md` if current operational facts change

**Tag recommendation:**

- keep the existing naming style and create a clearly documented backup tag, for example:
  - `snapshot-20260423-v4.2.0-stable`

**Suggested commit for docs if separated:**

`docs: record runtime, conn, and playground stabilization`

---

## 5. Stage B Feishu Architecture Plan

This stage starts **only after Stage A is complete and tagged**.

## 5.1 Feishu design goals

1. Feishu must be a modular integration boundary, not another set of special cases spliced into core chat code.
2. The design must support Feishu's "single visible conversation window" user experience without losing task isolation or message order.
3. File ingestion and file delivery must be first-class, not text-link hacks pretending to be attachments.
4. The architecture should be extensible toward Slack / WeCom later.

---

## 5.2 Proposed Feishu module split

### Core abstraction layers

1. **Channel Adapter Layer**
   - receive webhook/event payloads
   - normalize inbound message, file, and sender metadata
   - send outbound messages/files/cards

2. **Channel Session Orchestrator**
   - map channel thread/chat identity to local runtime conversation identity
   - manage queueing strategy and ordering
   - decide whether a new inbound message should:
     - append to current active run queue
     - start a fresh run
     - interrupt or control an active run

3. **Channel Attachment Bridge**
   - download inbound files/images into the runtime asset system
   - translate outbound runtime file artifacts into Feishu-native uploads/messages

4. **Channel Policy Module**
   - channel-specific UX rules
   - retry/delivery policy
   - queue compaction / summarization policy if needed

### Initial file/module direction

- `src/integrations/channel/` for reusable channel abstractions
- `src/integrations/feishu/adapter/`
- `src/integrations/feishu/orchestrator/`
- `src/integrations/feishu/attachments/`
- `src/integrations/feishu/policy/`

This avoids turning `src/integrations/feishu/service.ts` into a god file.

---

## 5.3 Feishu queue and UX strategy

Feishu only gives the user one conversational surface, so queue behavior is the real product design problem.

### Recommended rule set

1. One Feishu chat maps to one active runtime conversation binding by default.
2. If the agent is already running and a new user message arrives:
   - default to queueing it behind the active run
   - acknowledge receipt immediately in Feishu
   - surface queue position / status in a concise channel-native way
3. Support explicit user control messages for interrupt/cancel, but do not rely on dumb keyword spaghetti as the main orchestration engine.
4. Preserve message ordering and avoid interleaving output from multiple overlapping runs back into one Feishu window.
5. If queue depth grows, policy can summarize state rather than spamming the chat with repetitive notices.

### Why this direction

- It matches the existing runtime queue model.
- It minimizes user confusion in a single-window IM environment.
- It avoids the fake convenience of parallel replies that become unreadable garbage in Feishu.

---

## 5.4 Feishu file handling requirements

### Inbound files

1. Download Feishu file/image payloads through the official API.
2. Persist them into the existing asset system.
3. Inject resulting asset references into the run / queued message context.
4. Preserve original file names and useful metadata.

### Outbound files

1. When runtime returns file artifacts, upload them through Feishu APIs.
2. Send real file/media messages when possible, not only plain-text URLs.
3. Keep link fallback only as a degraded path, not the primary UX.

### Required implementation areas

- `src/integrations/feishu/client.ts`
- new upload/download helpers
- asset bridge into `src/agent/asset-store.ts`
- docs and tests covering both directions

---

## 5.5 Feishu execution phases

### Phase B1: Architecture refactor without behavior expansion

**Goal:** split the existing Feishu service into modular boundaries while preserving current behavior.

**Suggested commit:**

`refactor: modularize feishu integration boundaries`

### Phase B2: Queue orchestration and control model

**Goal:** formalize how inbound messages interact with active runs and queued work.

**Suggested commit:**

`feat: add feishu channel queue orchestration`

### Phase B3: File ingress and egress

**Goal:** support real inbound and outbound attachments.

**Suggested commit:**

`feat: add feishu file bridge`

### Phase B4: Runtime and docs verification

**Goal:** validate webhook handling, queue behavior, file round-trips, and failure modes.

**Suggested commit:**

`docs: record feishu modular integration architecture`

---

## 6. Verification Matrix

Run verification after each meaningful phase, not only at the very end.

### 6.1 Required automated checks

```powershell
git diff --check
npx tsc --noEmit
node --test --import tsx test/server.test.ts
npm test
```

### 6.2 Required runtime checks for Stage A

```powershell
docker compose restart ugk-pi
curl.exe -s http://127.0.0.1:3000/healthz
curl.exe -I http://127.0.0.1:3000/playground
```

**Manual behavior checklist:**

1. `web-access` run completes and pages are cleaned up.
2. interrupted `web-access` run also cleans up.
3. sent files remain visible after stream completion, refresh, and conversation switching.
4. `conn` create/edit supports file picking without requiring users to know IDs.
5. agent can manage `conn` via the upgraded system skill.
6. conversation delete works from sidebar.
7. destructive confirmations use custom modal, not system dialogs.
8. composer placeholder and text are vertically aligned.
9. context popup opens in the top area.
10. repeated conversation switching remains fast.

### 6.3 Required runtime checks for Stage B

At minimum validate:

1. Feishu webhook verification
2. inbound text message -> runtime run
3. inbound message during active run -> queue behavior
4. interrupt/control path
5. inbound file -> asset bridge
6. outbound file artifact -> Feishu-native delivery
7. no message ordering corruption in one chat window

---

## 7. Fix Impact Analysis Requirements

Each implementation phase must explicitly inspect:

### 7.1 Direct impact

- Which functions call the modified function?
- Are route payloads backward compatible?
- Do returned structures change for existing UI consumers?

### 7.2 Indirect impact

- Does a chat state sync change affect stream recovery?
- Does a `conn` UI update alter background worker payloads?
- Does a Feishu queue policy interact with the existing runtime queue unexpectedly?

### 7.3 Data compatibility

- If new fields are introduced, default values must exist for old records.
- If any field semantics change, stale persisted data must still load safely.
- Asset/file metadata paths must remain readable for existing stored conversations and `conn` records.

---

## 8. Suggested Commit Sequence

Recommended commit granularity:

1. `fix: harden web-access browser target cleanup`
2. `fix: preserve delivered files across transcript sync`
3. `feat: add conn asset picker and upload flow`
4. `feat: promote conn orchestration as system skill`
5. `feat: add custom confirm modal and conversation delete flow`
6. `fix: align composer text and top-anchor context panel`
7. `perf: reduce conversation switch latency`
8. `docs: record runtime, conn, and playground stabilization`
9. `tag: snapshot-20260423-v4.2.0-stable` or final approved tag name
10. `refactor: modularize feishu integration boundaries`
11. `feat: add feishu channel queue orchestration`
12. `feat: add feishu file bridge`
13. `docs: record feishu modular integration architecture`

Do not squash all of this into one monster commit. That would be a rollback nightmare dressed up as efficiency.

---

## 9. Recommendation Summary

The smart path is:

1. Finish Stage A first and verify it thoroughly.
2. Cut a stable backup tag from that verified baseline.
3. Only then start Stage B Feishu modularization and delivery.

Trying to do all of this in one undifferentiated coding sprint would be exactly how a stable system gets "optimized" into a crime scene. The baseline is good enough to protect; the plan should respect that.
