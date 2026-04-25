# Slash Command `/new` Implementation Plan

> **For Codex:** implement with TDD. Do not add production code before a failing test proves the command path. Keep this as a small foundation for future slash commands, not a one-off textarea hack.

**Goal:** Add a `/new` command in playground so sending exactly `/new` creates and activates a new conversation instead of sending text to the agent.

**Architecture:** Introduce a small browser-side slash command layer between composer submission and chat streaming. The first command, `/new`, reuses the existing `startNewConversation()` flow and does not touch agent runtime, `/v1/chat/stream`, `/v1/chat/queue`, transcript rendering, or backend conversation semantics. The command layer is intentionally registry-based so later commands can be added without growing `sendMessage()` into a pile of `if` branches.

**Tech Stack:** TypeScript string templates for playground scripts, Fastify chat routes already present, Node test runner with `tsx`, existing `test/server.test.ts` HTML/script assertions.

---

## Current Facts

- User message submission enters `sendMessage()` in `src/ui/playground-stream-controller.ts`.
- New conversation creation already exists in `src/ui/playground-conversations-controller.ts` as `startNewConversation()`.
- `startNewConversation()` already handles:
  - active run blocking
  - blank current conversation no-op
  - `POST /v1/chat/conversations`
  - optimistic catalog insertion
  - clearing selected files / assets
  - activation and server hydration
- Backend route `POST /v1/chat/conversations` already maps to `AgentService.createConversation()`.
- Therefore `/new` should not add a backend endpoint in phase 1.

## Design Decision

Use a browser-side command registry:

```js
const PLAYGROUND_SLASH_COMMANDS = {
  "/new": {
    name: "new",
    description: "开启新会话",
    async run(context) {
      return await context.startNewConversationFromCommand();
    },
  },
};
```

The actual implementation can be lighter than this literal shape, but it must preserve the same separation:

- parser: identify slash commands
- dispatcher: map command name to handler
- handler: call existing feature function
- sender: `sendMessage()` asks dispatcher first, then falls through to normal chat send

## Command Semantics

First version supports only exact `/new` after trim:

- `"/new"` triggers command
- `" /new "` triggers command
- `"/NEW"` should also trigger command by lowercasing command token
- `"/new hello"` is unknown for phase 1 unless explicitly designed later
- messages not starting with `/` are normal chat messages
- unknown slash commands should show a friendly error and keep the draft, not send to agent

Command execution rules:

- `/new` must not call `/v1/chat/stream`
- `/new` must not call `/v1/chat/queue`
- `/new` must not append a user transcript message
- `/new` should clear the composer only when command execution succeeds
- if an agent run is active, `/new` should reuse the existing `startNewConversation()` blocking behavior and keep draft text
- if current conversation is already blank, `/new` can no-op successfully and clear the composer

## Proposed Files

- Modify: `src/ui/playground-stream-controller.ts`
  - Add command parsing / dispatch before `outboundMessage` normal send path.
  - Keep `sendMessage()` readable by delegating command work to helper functions.

- Modify: `src/ui/playground-conversations-controller.ts`
  - Optionally expose a small wrapper such as `startNewConversationFromCommand()` if we need command-specific composer clearing / feedback.
  - Prefer reusing `startNewConversation()` directly if no special behavior is needed.

- Modify: `test/server.test.ts`
  - Add script assertions proving command dispatcher exists.
  - Add assertions that `sendMessage()` checks slash command before normal `/v1/chat/stream`.
  - Add assertions that `/new` handler calls `startNewConversation()` and does not mention `/v1/chat/stream` inside the command handler block.

- Modify docs after implementation:
  - `docs/playground-current.md`
  - `docs/change-log.md`

## Task 1: Red Test For Slash Command Foundation

**Files:**

- Test: `test/server.test.ts`

**Step 1: Add failing assertions**

Add a new test near existing playground send / conversation tests:

```ts
test("GET /playground routes /new through the slash command dispatcher", async () => {
  const app = buildServer({
    agentService: createAgentServiceStub(),
  });

  const response = await app.inject({
    method: "GET",
    url: "/playground",
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /function parsePlaygroundSlashCommand\(/);
  assert.match(response.body, /async function runPlaygroundSlashCommand\(/);
  assert.match(response.body, /case "new":/);
  assert.match(response.body, /await startNewConversation\(\)/);
  assert.match(
    response.body,
    /async function sendMessage\(\)\s*\{[\s\S]*const slashCommand = parsePlaygroundSlashCommand\(message\);[\s\S]*if \(slashCommand\) \{[\s\S]*const handled = await runPlaygroundSlashCommand\(slashCommand, composerDraft\);[\s\S]*if \(handled\) \{[\s\S]*return;[\s\S]*\}/,
  );
  assert.doesNotMatch(
    response.body,
    /case "new":[\s\S]*fetch\("\/v1\/chat\/stream"/,
  );
  await app.close();
});
```

**Step 2: Run the focused test**

Run:

```powershell
npm test
```

Expected: fail because parser / dispatcher functions do not exist yet.

## Task 2: Implement Parser And Dispatcher

**Files:**

- Modify: `src/ui/playground-stream-controller.ts`

**Step 1: Add parser helper**

Add helpers above `sendMessage()`:

```js
function parsePlaygroundSlashCommand(rawMessage) {
  const text = String(rawMessage || "").trim();
  if (!text.startsWith("/")) {
    return null;
  }
  const [name, ...args] = text.split(/\s+/);
  return {
    name: name.toLowerCase(),
    args,
    raw: text,
  };
}
```

**Step 2: Add dispatcher helper**

```js
async function runPlaygroundSlashCommand(command, composerDraft) {
  switch (command?.name) {
    case "/new": {
      const created = await startNewConversation();
      if (!created) {
        restoreComposerDraft(composerDraft);
        return true;
      }
      clearComposerDraft();
      messageInput.focus();
      return true;
    }
    default:
      showError("未知指令：" + command.raw);
      restoreComposerDraft(composerDraft);
      return true;
  }
}
```

Important note: if `startNewConversation()` returns `true` for blank current conversation no-op, `/new` should still be considered handled and should clear the composer. This matches command semantics: user asked for a new/blank surface and already has one.

**Step 3: Intercept inside `sendMessage()`**

Place after empty message validation and before `outboundMessage` / conversation ensure:

```js
const slashCommand = parsePlaygroundSlashCommand(message);
if (slashCommand && attachments.length === 0 && assetRefs.length === 0) {
  const handled = await runPlaygroundSlashCommand(slashCommand, composerDraft);
  if (handled) {
    return;
  }
}
```

For phase 1, slash commands with attachments / selected assets should show an error:

```js
if (slashCommand && (attachments.length > 0 || assetRefs.length > 0)) {
  showError("指令不能和附件或引用文件一起发送");
  restoreComposerDraft(composerDraft);
  return;
}
```

This prevents ambiguous behavior like `/new` while files are selected.

## Task 3: Verification

**Files:**

- Test: `test/server.test.ts`
- Runtime: `http://127.0.0.1:3000/playground`

**Step 1: Run tests**

```powershell
npm test
```

Expected: `pass`, with existing skipped tests unchanged.

**Step 2: Run design lint**

```powershell
npm run design:lint
```

Expected: 0 errors, 0 warnings.

**Step 3: Check whitespace**

```powershell
git diff --check
```

Expected: no output.

**Step 4: Restart local service**

```powershell
docker compose restart ugk-pi
```

Expected: container restarts successfully.

**Step 5: Browser behavior**

At `http://127.0.0.1:3000/playground`:

1. Type `/new`.
2. Press send or Enter.
3. Verify a new blank conversation is active.
4. Verify `/new` is not shown as a user message.
5. Verify no assistant loading bubble appears.
6. Verify selected files / assets are cleared if command succeeds.
7. While an agent run is active, type `/new`; verify it is blocked with the existing “当前任务未结束，不能开启新产线” error and draft remains available.

## Task 4: Docs And Commit

**Files:**

- Modify: `docs/playground-current.md`
- Modify: `docs/change-log.md`

**Docs update:**

- Add a “Slash Commands” section to `docs/playground-current.md`:
  - current supported command: `/new`
  - handled before agent streaming
  - does not enter transcript
  - reuses existing conversation creation flow
  - command + attachments is rejected

- Add a `2026-04-25` entry to `docs/change-log.md`.

**Final verification before commit:**

```powershell
npm test
npm run design:lint
git diff --check
```

**Commit:**

```powershell
git add src/ui/playground-stream-controller.ts test/server.test.ts docs/playground-current.md docs/change-log.md
git commit -m "Add playground slash command foundation"
git push origin main
```

## Future Extension Path

When this foundation is stable, future commands should use the same parser / dispatcher:

- `/help`: list command help without calling agent
- `/clear`: reset or clear current conversation, if product decision allows it
- `/model`: inspect or switch model, if backend capability exists
- `/files`: open file library
- `/tasks`: open task inbox

If commands need to work from Feishu / Slack / HTTP API later, move the parser into a shared TypeScript module under `src/commands/` and let both playground and integration routes call the same command service. Do not prematurely move it now; first command is browser-only and should stay small.
