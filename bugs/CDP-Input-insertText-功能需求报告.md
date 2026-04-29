# CDP Input.insertText 功能需求报告

**提交时间**: 2026-04-29  
**提交人**: Agent (zhihu-helper skill 使用者)  
**目标**: 为浏览器代理添加 `/type` 端点，支持 CDP 级别的文本输入

---

## 1. 问题背景

### 1.1 当前状况

在测试知乎回答发布功能时，发现 `document.execCommand('insertText')` 无法正确触发 Draft.js 编辑器的 React 状态更新：

| 方法 | DOM 显示 | Draft.js 状态 | 发布按钮 |
|------|----------|---------------|----------|
| `execCommand('insertText')` | ✅ 内容可见 | ❌ 未识别 | ❌ disabled 或字数显示为 0 |
| 手动键盘输入 | ✅ 正常 | ✅ 正常 | ✅ enabled |
| Clipboard API + paste event | ❌ 失败 | - | - |

### 1.2 根本原因

Draft.js 是 React 生态的富文本编辑器，其内部状态由 React 管理。`execCommand` 只修改了 DOM，没有触发 React 的状态同步机制。

CDP 的 `Input.insertText` 是专门设计用来解决这个问题的 —— 它模拟真实的键盘输入管道，能正确触发所有框架的状态更新。

---

## 2. 技术方案

### 2.1 需要添加的功能

**新端点**: `POST /type`

**用途**: 使用 CDP `Input.insertText` 命令向当前聚焦的输入元素插入文本

**请求格式**:
```
POST /type?target=<targetId>&metaAgentScope=<scope>
Content-Type: text/plain

<文本内容>
```

**响应格式**:
```json
{
  "ok": true,
  "textLength": 1234
}
```

### 2.2 底层 CDP 调用

```javascript
// 1. 确保页面有焦点
await session.send('Target.activateTarget', { targetId });

// 2. 执行 JavaScript 聚焦到编辑器（可选，由调用方处理）
// 已通过 /eval 执行 editor.focus()

// 3. 使用 Input.insertText 插入文本
await session.send('Input.insertText', { text: content });
```

### 2.3 实现位置

需要修改两个文件：

| 文件 | 改动 |
|------|------|
| `runtime/skills-user/web-access/scripts/cdp-proxy.mjs` | 添加 `/type` 路由处理 |
| `runtime/skills-user/web-access/scripts/local-cdp-browser.mjs` | 添加 `type` action 和 `typeText()` 方法 |

---

## 3. 详细实现方案

### 3.1 cdp-proxy.mjs 新增路由

在 `createProxyServer()` 函数中添加：

```javascript
if (pathname === '/type') {
  const text = await readBody(req);
  const result = await requestHostBrowser(
    {
      action: 'type',
      targetId: requireTargetId(targetId),
      text,
    },
    {
      meta: buildRequestMeta(parsed, req, {
        operation: 'type',
      }),
    },
  );
  sendJson(res, result.ok ? 200 : 500, result.ok ? { ok: true, textLength: text.length } : result);
  return;
}
```

### 3.2 local-cdp-browser.mjs 新增方法

在 `LocalCdpBrowser` 类中添加：

**handleCommand 新增 case**:
```javascript
case 'type':
  return await this.typeText(command.targetId, command.text);
```

**typeText 方法**:
```javascript
async typeText(targetId, text) {
  const session = await this.connectToTarget(targetId);
  
  // 激活目标页面
  await session.send('Target.activateTarget', { targetId });
  
  // 使用 CDP Input.insertText 插入文本
  await session.send('Input.insertText', { text: String(text || '') });
  
  return { ok: true };
}

async connectToTarget(targetId) {
  const targets = await this.listTargets();
  const target = targets.find(t => t.id === targetId);
  if (!target || !target.webSocketDebuggerUrl) {
    throw new Error('target_not_found_or_no_ws');
  }
  
  const connection = new CdpConnection(target.webSocketDebuggerUrl);
  await connection.connect();
  return connection;
}
```

---

## 4. 使用示例

修改后的知乎发布回答流程：

```bash
AGENT_SCOPE="zhihu-publish"
QUESTION_ID="1996481608203649538"

# 1. 打开问题页面
TARGET_ID=$(curl -s "http://127.0.0.1:3456/new?url=https://www.zhihu.com/question/${QUESTION_ID}&metaAgentScope=${AGENT_SCOPE}" | jq -r '.targetId')
sleep 3

# 2. 点击写回答按钮
curl -s -X POST "http://127.0.0.1:3456/eval?target=${TARGET_ID}&metaAgentScope=${AGENT_SCOPE}" \
  -H "Content-Type: application/json" \
  -d '(() => { const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("写回答")); if (btn) { btn.click(); return "clicked"; } return "not found"; })()'
sleep 2

# 3. 聚焦编辑器
curl -s -X POST "http://127.0.0.1:3456/eval?target=${TARGET_ID}&metaAgentScope=${AGENT_SCOPE}" \
  -H "Content-Type: application/json" \
  -d '(() => { const editor = document.querySelector(".public-DraftEditor-content"); if (editor) { editor.focus(); return "focused"; } return "not found"; })()'
sleep 1

# 4. 使用新的 /type 端点输入文本（关键！）
curl -s -X POST "http://127.0.0.1:3456/type?target=${TARGET_ID}&metaAgentScope=${AGENT_SCOPE}" \
  -H "Content-Type: text/plain" \
  -d "你的回答内容..."

# 5. 点击发布
curl -s -X POST "http://127.0.0.1:3456/eval?target=${TARGET_ID}&metaAgentScope=${AGENT_SCOPE}" \
  -H "Content-Type: application/json" \
  -d '(() => { const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "发布回答"); if (btn) { btn.click(); return "clicked"; } return "not found"; })()'
```

---

## 5. 预期效果

| 测试项 | 使用 execCommand | 使用 /type (Input.insertText) |
|--------|------------------|------------------------------|
| DOM 显示内容 | ✅ | ✅ |
| Draft.js 状态同步 | ❌ | ✅ |
| 字数统计正确 | ❌ (显示 0 或截断) | ✅ |
| 发布按钮启用 | ❌ | ✅ |
| 内容可编辑 | ❌ (无法修改) | ✅ |

---

## 6. 风险评估

### 6.1 低风险

- `Input.insertText` 是 CDP 标准 API，稳定可靠
- 不涉及知乎私有 API，无封号风险
- 与现有 `/eval` 端点设计风格一致

### 6.2 注意事项

- 调用 `/type` 前必须先通过 `/eval` 执行 `editor.focus()`，确保目标元素已聚焦
- 文本会插入到当前光标位置，不是替换整个编辑器内容
- 如果编辑器已有内容，需要先清空（可用 `selectAll` + `delete` execCommand）

---

## 7. 扩展建议（可选）

如果未来需要更精细的键盘控制，可以考虑添加：

**`/key` 端点**: 用于发送特殊按键（Enter、Backspace、Tab 等）

```javascript
await session.send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'Enter',
  code: 'Enter'
});
await session.send('Input.dispatchKeyEvent', {
  type: 'keyUp',
  key: 'Enter',
  code: 'Enter'
});
```

但当前 `/type` 已覆盖 99% 的文本输入场景，`/key` 可作为后续扩展。

---

## 8. 总结

**核心需求**: 添加 `POST /type` 端点，使用 CDP `Input.insertText` 命令

**改动范围**: 
- `cdp-proxy.mjs`: 新增一个路由 (~15 行)
- `local-cdp-browser.mjs`: 新增一个 action case + 一个方法 (~20 行)

**预期收益**: 解决 Draft.js / React 编辑器的状态同步问题，使知乎回答发布功能正常工作

**优先级**: 高（直接影响知乎技能的核心功能）

---

**报告结束**
---

## 9. 复核与落地记录（2026-04-29）

结论：需求成立。`document.execCommand('insertText')` 对 Draft.js / React 富文本编辑器不可靠，新增代理级 `/type` 端点是合理解法。

本次实际落地做了三点收口：

- `runtime/skills-user/web-access/scripts/cdp-proxy.mjs` 新增 `POST /type?target=<targetId>&metaAgentScope=<scope>`，读取 `text/plain` body，并向浏览器桥传递 `action: "type"`。
- `runtime/skills-user/web-access/scripts/local-cdp-browser.mjs` 新增 `type` action 与 `typeText()`，复用现有 `withTarget()`，先 best-effort `Page.bringToFront`，再执行 CDP `Input.insertText`。
- `runtime/skills-user/web-access/SKILL.md` 与 `docs/web-access-browser-bridge.md` 已写明使用规则：先 focus 编辑器，再调用 `/type`；它只在当前光标位置插入，不负责清空旧内容。

验证覆盖：

- `test/local-cdp-browser.test.ts` 锁定 `type` action 会发送 `Page.bringToFront` 与 `Input.insertText`。
- `test/web-access-proxy.test.ts` 锁定 `/type` 路由、`targetId`、文本 body 与 `metaAgentScope` 透传。
- `test/x-search-latest-skill.test.ts` 锁定 web-access skill 会教 agent 使用 `/type` / `Input.insertText` / `editor.focus()`。
