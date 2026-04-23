# Feishu Modular Integration Implementation Plan

> **For next agent:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task.  
> **Scope rule:** This plan is local handoff material under `.codex/plans/`. Do not push this plan unless the user explicitly asks.

**Goal:** Turn the current Feishu webhook prototype into a production-ready, modular Feishu plugin integration that supports single-window Feishu chat UX, durable inbound queueing, file receive/send, conn result delivery, and safe deployment without disturbing the stable agent/playground runtime.

**Architecture:** Keep Feishu isolated under `src/integrations/feishu/` plus a thin route in `src/routes/feishu.ts`. The route should authenticate and persist incoming events quickly, then a Feishu queue processor coordinates with `AgentService`, `AssetStore`, and `FeishuDeliveryService`. Conn worker delivery to Feishu should use a narrow delivery adapter, not import webhook internals.

**Tech Stack:** TypeScript, Fastify, existing `AgentService`, existing `AssetStore`, existing SQLite/conn database patterns, Node `fetch`, Feishu Open Platform IM v1 APIs, `node:test`.

---

## 0. Current Facts To Preserve

Do not redesign from a blank page. Current code already has these pieces:

- Route: `src/routes/feishu.ts`
- Modules:
  - `src/integrations/feishu/service.ts`
  - `src/integrations/feishu/client.ts`
  - `src/integrations/feishu/message-parser.ts`
  - `src/integrations/feishu/attachment-bridge.ts`
  - `src/integrations/feishu/queue-policy.ts`
  - `src/integrations/feishu/delivery.ts`
  - `src/integrations/feishu/conversation-map-store.ts`
  - `src/integrations/feishu/types.ts`
- Tests: `test/feishu-service.test.ts`
- Existing behavior:
  - Handles `url_verification`
  - Handles `im.message.receive_v1`
  - Maps Feishu `chat_id` to local `conversationId`
  - Downloads incoming file/image resources when configured
  - Sends result text and attempts to upload result files back to Feishu
  - Uses `queue-policy` for running conversation behavior: text -> `steer`, attachments -> `followUp`

The plan below strengthens this into a durable plugin. Do not collapse these modules into one giant `service.ts`; that would be regression dressed up as productivity.

## 1. Design Principles

- **Modular isolation:** Feishu-specific config, security, event parsing, queueing, attachment bridge, and delivery stay inside `src/integrations/feishu/`.
- **Thin route:** `src/routes/feishu.ts` should only verify/normalize/ack; no agent orchestration inside the route.
- **Durable ack path:** Feishu webhook must return quickly after persisting an inbound event. Do not run a full agent task before responding to Feishu.
- **Single-window UX:** One Feishu chat maps to one local conversation by default. If a task is running, new text should be acknowledged immediately and steered or queued according to policy.
- **No low-grade intent matching:** Do not implement a pile of Chinese keyword if/else branches. Structural policy is OK: running vs idle, text vs attachment, explicit command vs normal message.
- **Files are first-class:** Incoming Feishu resources must become agent-readable attachments or assets. Outgoing agent files must upload to Feishu when possible, with URL fallback only on failure.
- **Idempotent and safe:** Duplicate Feishu events must not start duplicate agent runs. Secrets must not be logged. Invalid callbacks must fail closed after URL verification is handled correctly.
- **No runtime disruption:** Do not rewrite `AgentService`, `conn`, or playground for Feishu. Add narrow interfaces where needed.

## 2. Official Docs To Verify Before Coding

Feishu APIs change enough that guessing is amateur hour. Before implementation, verify exact request/response fields from official docs:

- Receive message event: `https://open.feishu.cn/document/server-docs/im-v1/message/events/receive`
- Send message: `https://open.feishu.cn/document/server-docs/im-v1/message/create`
- Upload file: `https://open.feishu.cn/document/server-docs/im-v1/file/create`
- Download message resource: `https://open.feishu.cn/document/server-docs/im-v1/message/get-2`
- Event subscription request URL / security / encryption: `https://open.feishu.cn/document/server-docs/event-subscription-guide/event-subscription-configure-/request-url-configuration-cases`

Record any verified nuance in `docs/runtime-assets-conn-feishu.md`.

## 3. Target User Experience

### 3.1 User Sends Text While Idle

1. Feishu sends `im.message.receive_v1`.
2. Server verifies callback, dedupes event, persists inbound queue item.
3. Server immediately returns `{ ok: true }`.
4. Processor starts `AgentService.chat({ conversationId, message })`.
5. Feishu receives a short acknowledgement, for example: `收到，我开始处理。`
6. When agent completes, Feishu receives final text and files.

### 3.2 User Sends Text While Agent Is Running

1. Server persists the new message.
2. Processor sees the mapped local conversation is running.
3. Queue policy selects `steer` for pure text.
4. Agent receives the text as live steering through `AgentService.queueMessage`.
5. Feishu immediately receives: `已收到你的补充消息，我会把它接到当前处理流程里。`

### 3.3 User Sends File While Agent Is Running

1. Server persists message resource metadata.
2. Processor downloads file resource when processing.
3. Queue policy selects `followUp` for attachments.
4. Feishu immediately receives: `已收到你刚发的文件，当前步骤收尾后会继续处理。`
5. The file is passed to the follow-up turn after the current run.

### 3.4 Agent Returns Files

1. Agent result includes `files`.
2. `FeishuDeliveryService` sends text first.
3. For each file, fetch `downloadUrl` via `PUBLIC_BASE_URL`, upload via Feishu file API, then send Feishu file message.
4. If upload fails, send a fallback text block with download URLs.

### 3.5 Conn Sends Result To Feishu

1. `conn.target.type` is `feishu_chat` or `feishu_user`.
2. `conn-worker` writes global activity as it does today.
3. Worker calls a delivery adapter to send result text/files to Feishu.
4. Conversation notification is only written for `conversation` targets; Feishu targets should not pollute unrelated playground transcripts.

## 4. Proposed Module Shape

Keep existing files and add only where there is a real boundary.

### Existing Files To Keep

- `src/routes/feishu.ts`: route registration only.
- `src/integrations/feishu/service.ts`: orchestration facade.
- `src/integrations/feishu/client.ts`: Feishu Open API client.
- `src/integrations/feishu/message-parser.ts`: event/body parsing.
- `src/integrations/feishu/attachment-bridge.ts`: incoming resources -> agent attachment/assets.
- `src/integrations/feishu/queue-policy.ts`: single-window policy.
- `src/integrations/feishu/delivery.ts`: outbound delivery.
- `src/integrations/feishu/conversation-map-store.ts`: replace or migrate to durable DB-backed store.
- `src/integrations/feishu/types.ts`: shared types.

### New Files Recommended

- `src/integrations/feishu/config.ts`
  - Parse env/config.
  - Expose `enabled`, `appId`, `appSecret`, `verificationToken`, `encryptKey`, `apiBase`, delivery limits.
- `src/integrations/feishu/security.ts`
  - Verify callback token/signature.
  - Decrypt encrypted payload if Feishu app enables encryption.
  - Handle URL verification without accidentally blocking legitimate challenge requests.
- `src/integrations/feishu/store.ts`
  - Durable bindings, dedupe, queue, delivery attempts.
  - Prefer existing SQLite database style over ad-hoc JSON.
- `src/integrations/feishu/processor.ts`
  - Poll/claim queued inbound messages.
  - Call `AgentService.chat` / `AgentService.queueMessage`.
  - Call delivery service for acknowledgement and final output.
- `src/integrations/feishu/command.ts`
  - Optional explicit commands only: `/status`, `/cancel`, `/new`.
  - Do not build natural-language keyword matching here.
- `src/integrations/feishu/limits.ts`
  - Text length splitting, file size constraints, attachment count constraints.
- `src/integrations/feishu/index.ts`
  - Factory that wires config/store/client/service/processor.

## 5. Data Model Plan

Use SQLite because conn/activity already depend on durable state. Avoid keeping important webhook state only in memory or JSON.

Recommended tables:

### `feishu_conversation_bindings`

- `binding_key TEXT PRIMARY KEY`
- `conversation_id TEXT NOT NULL`
- `chat_id TEXT`
- `open_id TEXT`
- `tenant_key TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `last_message_at TEXT`

Purpose: map Feishu chat/user identity to local conversation ID.

### `feishu_inbound_events`

- `event_id TEXT PRIMARY KEY`
- `message_id TEXT`
- `chat_id TEXT`
- `event_type TEXT NOT NULL`
- `received_at TEXT NOT NULL`
- `status TEXT NOT NULL`
- `payload_json TEXT NOT NULL`
- `error_text TEXT`

Purpose: idempotency and traceability. Prefer Feishu `event_id` if present; fall back to `message_id` for message events.

### `feishu_inbound_queue`

- `queue_id TEXT PRIMARY KEY`
- `event_id TEXT NOT NULL`
- `binding_key TEXT NOT NULL`
- `conversation_id TEXT NOT NULL`
- `chat_id TEXT NOT NULL`
- `open_id TEXT`
- `message_id TEXT NOT NULL`
- `message_type TEXT NOT NULL`
- `text TEXT`
- `resources_json TEXT NOT NULL`
- `status TEXT NOT NULL`
- `attempts INTEGER NOT NULL DEFAULT 0`
- `lease_owner TEXT`
- `lease_until TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `processed_at TEXT`
- `error_text TEXT`

Purpose: durable queue so ack does not lose work if processing crashes.

### `feishu_delivery_attempts`

- `delivery_id TEXT PRIMARY KEY`
- `target_json TEXT NOT NULL`
- `source_type TEXT NOT NULL`
- `source_id TEXT`
- `status TEXT NOT NULL`
- `attempts INTEGER NOT NULL DEFAULT 0`
- `text_preview TEXT`
- `files_json TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `error_text TEXT`

Purpose: trace delivery failures and support retries later.

## 6. Queue Policy

Keep the first version deterministic and explainable:

- If no active run: start a new `chat`.
- If active run + pure text: call `queueMessage(... mode="steer")`.
- If active run + attachments: call `queueMessage(... mode="followUp")`.
- If explicit `/new`: create or bind a new local conversation for this Feishu chat, then start a new `chat`.
- If explicit `/status`: return current local run status without starting a new agent run.
- If explicit `/cancel`: call existing interrupt API only if safe; otherwise return unsupported until interrupt is wired cleanly.

Avoid fuzzy rules like “if message contains 停止 / 新任务 / 别做了”. That is exactly the kind of text-matching sludge the user does not want.

## 7. Implementation Tasks

### Task 1: Freeze Baseline And Add Failing Tests For Security

**Files:**

- Test: `test/feishu-security.test.ts`
- Read only first: `src/routes/feishu.ts`, `src/integrations/feishu/service.ts`

**Steps:**

1. Write tests for URL verification success.
2. Write tests for invalid verification token rejection.
3. Write tests for duplicate event ID not creating duplicate queue item.
4. Write tests for encrypted payload if Feishu encryption is configured.
5. Run: `npm test -- test/feishu-security.test.ts`
6. Expected before implementation: FAIL for missing security module/store behavior.

**Commit after pass:** `test: cover feishu webhook security`

### Task 2: Add Feishu Config Parser

**Files:**

- Create: `src/integrations/feishu/config.ts`
- Modify: `src/server.ts`
- Test: `test/feishu-config.test.ts`
- Docs later: `docs/runtime-assets-conn-feishu.md`

**Required env fields:**

- `FEISHU_ENABLED`
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_API_BASE`
- `FEISHU_VERIFICATION_TOKEN`
- `FEISHU_ENCRYPT_KEY`
- `FEISHU_MAX_FILE_BYTES`
- `FEISHU_MAX_ATTACHMENTS_PER_MESSAGE`
- `FEISHU_DELIVERY_TEXT_CHUNK_SIZE`

**Steps:**

1. Write tests for disabled-by-default behavior when app credentials are missing.
2. Write tests that secrets are not included in JSON/debug output.
3. Implement config parser.
4. Wire `src/server.ts` to create Feishu modules from config, not raw `process.env` scattered across constructors.
5. Run: `npm test -- test/feishu-config.test.ts`

**Commit after pass:** `feat: add feishu integration config`

### Task 3: Add Security Verification And Optional Decryption

**Files:**

- Create: `src/integrations/feishu/security.ts`
- Modify: `src/routes/feishu.ts`
- Test: `test/feishu-security.test.ts`

**Important notes:**

- Verify exact Feishu signature/decryption algorithm from official docs before coding.
- If Feishu URL verification challenge does not include the same signature headers as normal callbacks, handle that documented exception intentionally. Do not fail open for normal events.
- If `FEISHU_VERIFICATION_TOKEN` is configured, reject mismatches.
- If `FEISHU_ENCRYPT_KEY` is configured and payload is encrypted, decrypt before parsing.
- Log only reason codes, never secrets or full encrypted payloads.

**Steps:**

1. Write failing tests around route behavior.
2. Implement `verifyFeishuRequest`.
3. Ensure route returns correct status for invalid events, not `{ ok: true }`.
4. Run: `npm test -- test/feishu-security.test.ts test/server.test.ts`

**Commit after pass:** `feat: secure feishu webhook callbacks`

### Task 4: Replace JSON Conversation Map With Durable Store

**Files:**

- Create: `src/integrations/feishu/store.ts`
- Modify: `src/integrations/feishu/conversation-map-store.ts` or deprecate it behind the same interface
- Modify: `src/agent/conn-db.ts` if migrations are centralized there
- Test: `test/feishu-store.test.ts`

**Steps:**

1. Write tests for `getOrCreateBinding`.
2. Write tests for concurrent get-or-create returning one conversation ID.
3. Write tests for event dedupe.
4. Write tests for queue claim/release/mark processed/mark failed.
5. Implement DB migration/table creation following existing conn DB style.
6. Run: `npm test -- test/feishu-store.test.ts`

**Commit after pass:** `feat: add durable feishu store`

### Task 5: Make Webhook Route Ack After Durable Enqueue

**Files:**

- Modify: `src/routes/feishu.ts`
- Modify: `src/integrations/feishu/service.ts`
- Modify: `src/integrations/feishu/message-parser.ts`
- Test: `test/feishu-service.test.ts`, `test/server.test.ts`

**Steps:**

1. Write test that `handleWebhook` persists queue item and returns accepted without calling `agentService.chat`.
2. Write test that duplicate event returns accepted but does not enqueue twice.
3. Write test that unsupported message types can still be acknowledged with a user-facing delivery later, not by blocking webhook.
4. Refactor service into `acceptWebhook` / `processQueueItem`.
5. Run: `npm test -- test/feishu-service.test.ts test/server.test.ts`

**Commit after pass:** `feat: enqueue feishu inbound events`

### Task 6: Add Feishu Queue Processor

**Files:**

- Create: `src/integrations/feishu/processor.ts`
- Modify: `src/server.ts`
- Test: `test/feishu-processor.test.ts`

**Processor behavior:**

- Poll pending queue items.
- Claim with lease to avoid double processing.
- Resolve binding to local conversation.
- Download attachments only when processing, not in route.
- Check `AgentService.getRunStatus`.
- Apply queue policy.
- Send immediate acknowledgement.
- Run agent when idle.
- Send final delivery.
- Mark queue item processed or failed.

**Steps:**

1. Write idle text test -> starts `chat`, sends ack and final result.
2. Write running text test -> calls `queueMessage` with `steer`, sends steer ack.
3. Write running file test -> calls `queueMessage` with `followUp`, sends follow-up ack.
4. Write failure test -> records error and sends graceful Feishu failure text if possible.
5. Implement processor.
6. Add lifecycle start/stop in `src/server.ts`.
7. Run: `npm test -- test/feishu-processor.test.ts test/feishu-service.test.ts`

**Commit after pass:** `feat: process feishu inbound queue`

### Task 7: Harden Attachment Bridge

**Files:**

- Modify: `src/integrations/feishu/attachment-bridge.ts`
- Modify: `src/integrations/feishu/client.ts`
- Modify: `src/integrations/feishu/types.ts`
- Test: `test/feishu-attachment-bridge.test.ts`

**Required behavior:**

- Enforce max file size.
- Enforce max attachment count.
- Preserve filename and MIME.
- Download `file` and `image`.
- For unsupported resource types, include a readable warning message.
- If download fails, degrade to metadata only and tell user clearly, not silently.

**Steps:**

1. Write tests for successful file download.
2. Write tests for image download.
3. Write tests for size limit rejection.
4. Write tests for configured client missing credentials.
5. Implement changes.
6. Run: `npm test -- test/feishu-attachment-bridge.test.ts test/feishu-service.test.ts`

**Commit after pass:** `feat: harden feishu attachment bridge`

### Task 8: Harden Delivery Service

**Files:**

- Modify: `src/integrations/feishu/delivery.ts`
- Modify: `src/integrations/feishu/client.ts`
- Create if needed: `src/integrations/feishu/limits.ts`
- Test: `test/feishu-delivery.test.ts`

**Required behavior:**

- Split long text into chunks before sending.
- Send text before files.
- Upload result files via Feishu file API.
- Fallback to public URL text when upload fails.
- Record delivery attempts through store.
- Do not throw all the way into agent runtime for delivery-only failures.

**Steps:**

1. Write long-text chunking test.
2. Write text + file upload ordering test.
3. Write upload failure fallback test.
4. Write unconfigured client graceful behavior test.
5. Implement changes.
6. Run: `npm test -- test/feishu-delivery.test.ts test/feishu-service.test.ts`

**Commit after pass:** `feat: harden feishu delivery`

### Task 9: Connect Conn Worker To Feishu Delivery

**Files:**

- Modify: `src/workers/conn-worker.ts`
- Modify: worker bootstrap/config wiring
- Possibly create: `src/integrations/feishu/conn-delivery.ts`
- Test: `test/conn-worker.test.ts`, new focused `test/feishu-conn-delivery.test.ts`

**Required behavior:**

- `conversation` target: current behavior remains unchanged.
- `feishu_chat` target: send conn result to chat ID.
- `feishu_user` target: send conn result to open ID.
- Global activity is still written for all final conn runs.
- Feishu delivery failure should mark delivery failure in logs/store, but must not corrupt the persisted conn run result.

**Steps:**

1. Write test for successful `feishu_chat` delivery.
2. Write test for successful `feishu_user` delivery.
3. Write test that conversation notification is not written for Feishu target.
4. Write test that activity is still written.
5. Implement narrow delivery adapter and inject into worker.
6. Run: `npm test -- test/conn-worker.test.ts test/feishu-conn-delivery.test.ts`

**Commit after pass:** `feat: deliver conn results to feishu`

### Task 10: Add Minimal Feishu Admin/Debug Visibility

**Files:**

- Modify or create route under `src/routes/feishu.ts`
- Test: `test/server.test.ts`
- Docs: `docs/runtime-assets-conn-feishu.md`

**Suggested endpoints:**

- `GET /v1/integrations/feishu/status`
  - configured: boolean
  - queue pending/running/failed counts
  - last received event time
  - last delivery failure time

Do not expose secrets, raw payloads, or file bytes.

**Steps:**

1. Write server test that status route does not leak `FEISHU_APP_SECRET`.
2. Implement status using store counters.
3. Run: `npm test -- test/server.test.ts`

**Commit after pass:** `feat: expose feishu integration status`

### Task 11: Documentation And Deployment Runbook

**Files:**

- Modify: `docs/runtime-assets-conn-feishu.md`
- Modify: `docs/server-ops-quick-reference.md` only if deployment commands change
- Modify: `docs/tencent-cloud-singapore-deploy.md` only if production env/runbook changes
- Do not modify unrelated playground docs.

**Docs must include:**

- Required Feishu app permissions/scopes.
- Event subscription URL.
- Required env vars.
- Whether production callback needs HTTPS/domain. Verify from official Feishu docs before writing.
- How to test URL verification.
- How to send a test text message.
- How to send a test file.
- How to verify queue status.
- How to troubleshoot common errors:
  - invalid token/signature
  - missing app credentials
  - file download denied
  - file upload denied
  - PUBLIC_BASE_URL missing/wrong
  - duplicate event ignored

**Steps:**

1. Update docs after implementation behavior is real.
2. Run link/path sanity by reading the modified docs.
3. Run: `git diff --check`

**Commit after pass:** `docs: document feishu integration operations`

## 8. Verification Plan

### Automated Verification

Run the full baseline:

```bash
npx tsc --noEmit
npm test
docker compose -f docker-compose.prod.yml config
```

Run focused tests while developing:

```bash
npm test -- test/feishu-config.test.ts
npm test -- test/feishu-security.test.ts
npm test -- test/feishu-store.test.ts
npm test -- test/feishu-processor.test.ts
npm test -- test/feishu-attachment-bridge.test.ts
npm test -- test/feishu-delivery.test.ts
npm test -- test/feishu-service.test.ts
npm test -- test/conn-worker.test.ts
npm test -- test/server.test.ts
```

Expected final result: all tests pass, no TypeScript errors, production compose config validates.

### Local Manual Verification Without Real Feishu

Use synthetic webhook payloads:

1. Send `url_verification` payload to `/v1/integrations/feishu/events`.
2. Send text `im.message.receive_v1` payload.
3. Verify queue item is persisted and processed.
4. Send duplicate event ID and verify no duplicate agent run.
5. Send file message payload with mocked client in tests.
6. Verify status endpoint counters.

### Real Feishu Sandbox Verification

Do this only after automated tests pass:

1. Configure Feishu app credentials in shared env or local `.env`.
2. Configure event subscription callback URL:
   - Local tunnel if testing locally.
   - Production public URL only after user approves deployment.
3. Subscribe to `im.message.receive_v1`.
4. Send a plain text message to bot.
5. Confirm immediate ack.
6. Confirm final answer.
7. Send a file.
8. Confirm agent receives file content or at least a clear limitation message.
9. Ask agent to generate a file.
10. Confirm Feishu receives uploaded file message, not just a URL.
11. While a run is active, send another text message and confirm it is steered.
12. While a run is active, send a file and confirm it is queued as follow-up.
13. Trigger duplicate event replay if possible and confirm no duplicate run.

### Conn Verification

1. Create conn target `feishu_chat`.
2. Manually run it.
3. Confirm result appears in Feishu.
4. Confirm global activity records it.
5. Confirm no unrelated playground conversation notification is created.
6. Repeat for failure/timeout path.

### Production Deployment Verification

Before production update:

```bash
npx tsc --noEmit
npm test
docker compose -f docker-compose.prod.yml config
```

Server:

```bash
cd ~/ugk-claw-repo
git status --short
git tag -a server-pre-deploy-$(date +%Y%m%d-%H%M%S) -m "server pre deploy backup" HEAD
git pull --ff-only origin main
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
curl -fsS http://127.0.0.1:3000/healthz
curl -I http://127.0.0.1:3000/playground
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml ps
```

Feishu-specific:

```bash
curl -fsS http://127.0.0.1:3000/v1/integrations/feishu/status
```

Then do real Feishu bot text + file smoke test.

## 9. Rollback Plan

- If code deploy breaks app health: use server pre-deploy tag and current server rollback docs.
- If only Feishu breaks but app is healthy:
  - Disable Feishu with `FEISHU_ENABLED=false` or remove credentials from shared env.
  - Restart/rebuild app.
  - Keep playground/agent runtime online.
- If queue has bad stuck items:
  - Mark failed through a safe store method or SQL migration script added by implementation.
  - Do not delete whole `.data/agent`.
- If Feishu file upload breaks:
  - Delivery should already fallback to URLs.
  - Do not block agent completion because Feishu upload failed.

## 10. Definition Of Done

The Feishu integration is done only when all of these are true:

- Webhook URL verification works.
- Invalid callback token/signature is rejected.
- Duplicate Feishu events do not create duplicate runs.
- Inbound text while idle starts an agent run.
- Inbound text while running steers current run.
- Inbound file while running queues follow-up.
- Inbound file is downloaded and visible to agent as attachment/asset.
- Agent result text is delivered to Feishu.
- Agent result files are uploaded to Feishu; URL fallback works on upload failure.
- Conn result can target `feishu_chat` / `feishu_user`.
- Global activity still records conn final states.
- Feishu failure cannot corrupt playground conversation state.
- `npx tsc --noEmit`, `npm test`, and production compose config all pass.
- Docs explain env, permissions, callback URL, verification, test flow, and troubleshooting.

## 11. Suggested Commit Sequence

1. `test: cover feishu webhook security`
2. `feat: add feishu integration config`
3. `feat: secure feishu webhook callbacks`
4. `feat: add durable feishu store`
5. `feat: enqueue feishu inbound events`
6. `feat: process feishu inbound queue`
7. `feat: harden feishu attachment bridge`
8. `feat: harden feishu delivery`
9. `feat: deliver conn results to feishu`
10. `feat: expose feishu integration status`
11. `docs: document feishu integration operations`

Keep commits small. If a task starts touching unrelated playground rendering or agent session internals, stop and reassess. Feishu is an integration module, not an excuse to rearrange the whole house.
