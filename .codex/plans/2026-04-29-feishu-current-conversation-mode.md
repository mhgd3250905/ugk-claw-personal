# Feishu Current Conversation Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让飞书成为 Web 当前会话的收发中转窗口，所有飞书入站消息默认进入当前全局 conversation，不再按飞书 chat 自动创建独立会话世界线。

**Architecture:** 复用现有 Feishu 模块，只在会话解析、幂等和安全边界上补窄切片。`FeishuService` 继续负责编排 webhook；新增/抽出 conversation resolver，让 `current` 模式调用 `AgentService` 当前会话；运行中消息继续复用 `queueMessage()` 的 `steer / followUp`。

**Tech Stack:** TypeScript, Fastify, node:test, existing `AgentService`, existing Feishu integration modules.

---

## 当前确认口径

- 飞书消息永远进入 Web 当前会话。
- Web playground 和飞书只是同一个 agent 的两个窗口。
- 同时运行仍然只有一个 agent，继续由 `AgentService.activeRuns.size > 0` 兜住。
- 不重写 Feishu client / delivery / attachment bridge / queue policy。

## Task 1: 锁定 current conversation 行为

**Files:**
- Modify: `test/feishu-service.test.ts`
- Read: `src/integrations/feishu/service.ts`
- Read: `src/agent/agent-service.ts`

**Step 1: Write the failing test**

新增测试：当 FeishuService 配置为 `current` 模式时，收到飞书文本消息应调用 `agentService.getCurrentConversationId()` 或等价 gateway 方法，并把消息投递到该 conversation，而不是 `feishu:chat:<chatId>`。

测试结构示例：

```ts
test("FeishuService routes incoming messages to the current web conversation in current mode", async () => {
  const chatCalls: Array<Record<string, unknown>> = [];
  const service = new FeishuService({
    conversationMode: "current",
    agentService: {
      async getCurrentConversationId() {
        return "web-current-conversation";
      },
      async getRunStatus(conversationId) {
        return makeIdleStatus(conversationId);
      },
      async queueMessage() {
        throw new Error("queueMessage should not run while idle");
      },
      async chat(input) {
        chatCalls.push(input as Record<string, unknown>);
        return { conversationId: input.conversationId, text: "ok" };
      },
    },
    conversationMapStore: mapStore,
    client: fakeConfiguredClient(),
    deliveryService: fakeDelivery(),
  });

  await service.handleWebhook(makeFeishuTextWebhook("chat-1", "msg-1", "hello"));
  await waitForAsyncWebhookSideEffects(() => chatCalls.length === 1);

  assert.equal(chatCalls[0]?.conversationId, "web-current-conversation");
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- test/feishu-service.test.ts
```

Expected: FAIL because `FeishuService` currently builds `feishu:chat:<chatId>` through `conversationMapStore.getOrCreate()`.

**Step 3: Implement minimal gateway support**

Modify `src/integrations/feishu/service.ts`:

- Extend `FeishuAgentGateway` with:

```ts
getCurrentConversationId?(): Promise<string>;
```

- Add `conversationMode?: "current" | "mapped"` to `FeishuServiceOptions`.
- Default to `"current"` for the new product decision.
- Add a private resolver:

```ts
private async resolveConversationId(incoming: FeishuInboundMessage): Promise<string> {
  if ((this.options.conversationMode ?? "current") === "current") {
    const currentConversationId = await this.options.agentService.getCurrentConversationId?.();
    if (!currentConversationId) {
      throw new Error("Feishu current conversation mode requires getCurrentConversationId");
    }
    return currentConversationId;
  }

  return await this.options.conversationMapStore.getOrCreate(
    `chat:${incoming.chatId}`,
    () => `feishu:chat:${incoming.chatId}`,
  );
}
```

Then replace the inline `conversationMapStore.getOrCreate(...)` call in `processIncomingEvent()`.

**Step 4: Add AgentService method**

Modify `src/agent/agent-service.ts`:

```ts
async getCurrentConversationId(): Promise<string> {
  return await this.ensureCurrentConversationId();
}
```

This uses the existing current conversation source; do not expose or mutate internals.

**Step 5: Run test to verify it passes**

Run:

```bash
npm run test -- test/feishu-service.test.ts
```

Expected: PASS.

---

## Task 2: 保留 mapped 兼容测试

**Files:**
- Modify: `test/feishu-service.test.ts`
- Modify: `src/integrations/feishu/service.ts`

**Step 1: Write compatibility test**

新增测试：当 `conversationMode: "mapped"` 时，现有 `chat:<chatId>` 映射仍然可用。

Expected behavior:

- First message from `chat-legacy` creates `feishu:chat:chat-legacy`
- Subsequent message uses same mapped conversation

**Step 2: Run test**

```bash
npm run test -- test/feishu-service.test.ts
```

Expected: PASS after Task 1 implementation.

**Step 3: Keep mapped path isolated**

Do not let mapped mode become default. It is compatibility only.

---

## Task 3: 运行中飞书消息进入当前 active run 队列

**Files:**
- Modify: `test/feishu-service.test.ts`
- Read: `src/integrations/feishu/queue-policy.ts`
- Read: `src/agent/agent-queue-message.ts`

**Step 1: Extend existing queue test**

现有测试已覆盖 running + text -> `steer`，但它使用旧 mapped conversation。更新或新增 current mode 版本：

- `getCurrentConversationId()` returns `web-current-conversation`
- `getRunStatus("web-current-conversation")` returns running
- Incoming text queues with `mode: "steer"`

**Step 2: Add attachment running test**

新增测试：

- Feishu incoming file/image
- Current conversation is running
- `queueMessage()` receives `mode: "followUp"` and attachment payload

**Step 3: Run tests**

```bash
npm run test -- test/feishu-service.test.ts
```

Expected: PASS.

---

## Task 4: 增加飞书消息幂等

**Files:**
- Create: `src/integrations/feishu/message-deduper.ts`
- Modify: `src/integrations/feishu/service.ts`
- Modify: `test/feishu-service.test.ts`

**Step 1: Write failing duplicate test**

测试同一个 `message_id` webhook 调两次，只允许一次 `chat()` 或 `queueMessage()`。

```ts
await service.handleWebhook(makeFeishuTextWebhook("chat-1", "msg-dup", "hello"));
await service.handleWebhook(makeFeishuTextWebhook("chat-1", "msg-dup", "hello"));
await waitForAsyncWebhookSideEffects(() => chatCalls.length === 1);
assert.equal(chatCalls.length, 1);
```

Expected: FAIL before deduper.

**Step 2: Implement minimal deduper**

Start with injected interface to keep tests simple:

```ts
export interface FeishuMessageDeduperLike {
  accept(messageId: string): Promise<boolean>;
}
```

Default implementation can be in-memory first:

```ts
export class InMemoryFeishuMessageDeduper implements FeishuMessageDeduperLike {
  private readonly seen = new Set<string>();

  async accept(messageId: string): Promise<boolean> {
    if (this.seen.has(messageId)) {
      return false;
    }
    this.seen.add(messageId);
    return true;
  }
}
```

Then wire into `FeishuServiceOptions` as `messageDeduper?: FeishuMessageDeduperLike`.

**Step 3: Use deduper before attachment download**

Inside `processIncomingEvent()` after parsing `incoming`:

```ts
if (!(await this.messageDeduper.accept(incoming.messageId))) {
  return;
}
```

Do this before downloading attachments and before calling agent.

**Step 4: Run tests**

```bash
npm run test -- test/feishu-service.test.ts
```

Expected: PASS.

**Step 5: Decide persistence**

For production, in-memory dedupe only protects current process. If Feishu retry happens after restart, it can still duplicate.

Recommended next step after minimum pass:

- Add file-backed deduper under `.data/agent/feishu/message-dedupe.json`
- Keep recent N ids or recent time window
- Use serial write queue + temp file + rename, same style as `FeishuConversationMapStore`

Do not block P0 on persistence unless production webhook retries after restart are already observed.

---

## Task 5: 增加飞书 chat 白名单

**Files:**
- Modify: `src/integrations/feishu/service.ts`
- Modify: `src/server.ts`
- Modify: `test/feishu-service.test.ts`
- Modify: `.env.example`

**Step 1: Write rejection test**

Given allowed chat ids are `["chat-allowed"]`, incoming from `chat-denied` should:

- return accepted webhook response
- not call `chat()`
- not call `queueMessage()`
- optionally deliver a short rejection text, or silently ignore

建议先静默 ignore，减少误触发输出。

**Step 2: Implement allowlist**

Add option:

```ts
allowedChatIds?: string[];
```

Inside `processIncomingEvent()` after parse:

```ts
if (this.options.allowedChatIds?.length && !this.options.allowedChatIds.includes(incoming.chatId)) {
  return;
}
```

**Step 3: Wire env in `src/server.ts`**

Parse:

```ts
const allowedChatIds = process.env.FEISHU_ALLOWED_CHAT_IDS
  ?.split(",")
  .map((value) => value.trim())
  .filter(Boolean);
```

Pass into `new FeishuService(...)`.

**Step 4: Update `.env.example`**

Add:

```env
FEISHU_ALLOWED_CHAT_IDS=
```

**Step 5: Run tests**

```bash
npm run test -- test/feishu-service.test.ts
```

Expected: PASS.

---

## Task 6: 文档同步

**Files:**
- Modify: `docs/runtime-assets-conn-feishu.md`
- Modify: `docs/change-log.md`
- Optional Modify: `AGENTS.md` if this becomes a stable operating rule

**Step 1: Update Feishu section**

Document:

- Feishu is a relay window for the current Web conversation
- Default mode is current conversation mode
- Running agent messages use `queueMessage()`
- Text -> `steer`
- Attachment -> `followUp`
- `mapped` mode is compatibility only if retained
- `FEISHU_ALLOWED_CHAT_IDS` controls accepted chat ids
- Message id dedupe behavior

**Step 2: Update change log**

Add `2026-04-29` entry:

- Date
- Theme: Feishu current conversation relay mode
- Impact scope
- Source/test/doc entries

---

## Task 7: 全量验证

**Files:**
- Test: `test/feishu-service.test.ts`
- Test: `test/feishu-message-parser.test.ts`
- Test: `test/server.test.ts`

**Step 1: Run focused tests**

```bash
npm run test -- test/feishu-service.test.ts
npm run test -- test/feishu-message-parser.test.ts
```

Expected: PASS.

**Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: PASS.

**Step 3: Run full test suite**

```bash
npm test
```

Expected: PASS.

**Step 4: Optional runtime smoke**

If local service is running:

```bash
curl -sS http://127.0.0.1:3000/healthz
```

Expected:

```json
{"ok":true}
```

Then post a simulated Feishu webhook to `/v1/integrations/feishu/events` and confirm accepted response.

---

## Execution Notes

- Do not rewrite Feishu client, delivery, attachment bridge, or queue policy.
- Do not create a second agent runtime for Feishu.
- Do not write Feishu messages directly into playground DOM or task inbox; the source of truth is still `AgentService` conversation state.
- Be careful with async webhook processing: `handleWebhook()` returns accepted before `processIncomingEvent()` finishes. Tests must wait for side effects.
- Keep all user-facing explanations in Chinese; code identifiers remain English.
