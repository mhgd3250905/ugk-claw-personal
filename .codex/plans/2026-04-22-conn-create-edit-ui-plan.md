# Conn Create/Edit UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在现有 playground 后台任务管理器中补齐 conn 创建 / 编辑能力，让用户不再需要手写 `POST /v1/conns`，并且在 UI 层明确 conn 绑定的目标会话 / 飞书目标 / 调度策略 / runtime 快照字段。

**Architecture:** 复用现有后端 conn API 与 SQLite store，不重新设计后台 runner。前端在 `src/ui/playground.ts` 的 `conn-manager-dialog` 基础上增加编辑状态、表单弹层、payload 归一化和保存流程；后端只在发现 PATCH 语义无法支撑合理编辑时做最小兼容补丁。

**Tech Stack:** TypeScript, Fastify routes, inline playground HTML/CSS/JS, Node test runner, SQLite conn store.

---

## 1. 当前事实

- conn 后端主入口已经存在于 `src/routes/conns.ts`：
  - `GET /v1/conns`
  - `GET /v1/conns/:connId`
  - `POST /v1/conns`
  - `PATCH /v1/conns/:connId`
  - `POST /v1/conns/:connId/pause`
  - `POST /v1/conns/:connId/resume`
  - `POST /v1/conns/:connId/run`
  - `DELETE /v1/conns/:connId`
- `POST /v1/conns` 当前支持：
  - `title`
  - `prompt`
  - `target`
  - `schedule`
  - `assetRefs`
  - `profileId`
  - `agentSpecId`
  - `skillSetId`
  - `modelPolicyId`
  - `upgradePolicy`
  - `maxRunMs`
- `target` 省略时，后端默认绑定服务端当前会话 `getCurrentConversationId()`。
- `src/ui/playground.ts` 里已有后台任务管理器，但目前只支持列表、最近 run、立即执行、暂停 / 恢复、查看 run 详情。
- `docs/playground-current.md` 已明确：全局活动是观察列表，不改变当前 conversation transcript 归属；conn notification 只进入目标会话。

## 2. 真实需求判定

这次不是要让“新会话也收到旧 conn 的气泡”。那样会污染会话真源，等于把前面刚收口的 conversation 模型拆了重盖，蠢得很扎实。

真正要做的是：

- 用户可以在 UI 中创建 conn。
- 用户可以编辑已有 conn 的标题、prompt、目标、调度和运行参数。
- UI 必须明确告诉用户这个 conn 绑定到哪里，尤其是 conversation target。
- 创建后可以立刻在后台任务列表中看到新 conn，并继续复用现有 `立即执行` / `暂停` / `恢复` / `查看 run` 能力。
- 后台 conn 的执行结果继续进入全局活动；只有目标会话收到对话气泡。

## 3. 非目标

- 不做多会话同时写入同一条 conn notification。
- 不把全局活动改造成聊天真源。
- 不重写 worker / resolver / SQLite 架构。
- 不在第一版加入 destructive delete UI；删除接口虽然存在，但创建 / 编辑不是删库按钮展览会。
- 不引入新前端框架。

## 4. 交互设计

### 4.1 后台任务管理器入口

文件：`src/ui/playground.ts`

- 在 `conn-manager-dialog` 顶部动作区加入 `新建` 按钮。
- 每个 conn item 的 action 区加入 `编辑` 按钮。
- 空状态文案从“先用 POST /v1/conns 创建一个 conn”改为引导点击 `新建`。
- 保留现有：
  - `刷新`
  - `立即执行`
  - `暂停` / `恢复`
  - 最近 run `查看`

### 4.2 新建 / 编辑表单

优先使用一个独立的 `conn-editor-dialog`，不要把表单塞成 manager item 内联巨物，避免移动端爆版。

字段分组：

- 基础：
  - `title`
  - `prompt`
- 目标：
  - segmented/select: `当前会话` / `指定会话` / `飞书群` / `飞书用户`
  - 当前会话模式默认使用当前 `conversationId`
  - 指定会话模式填写 `conversationId`
  - 飞书群填写 `chatId`
  - 飞书用户填写 `openId`
- 调度：
  - `once`: `datetime-local`
  - `interval`: 每隔多少分钟，后端 payload 转为 `everyMs`
  - `cron`: `expression` + `timezone`
- 高级：
  - `profileId`
  - `agentSpecId`
  - `skillSetId`
  - `modelPolicyId`
  - `upgradePolicy`: `latest` / `pinned` / `manual`
  - `maxRunMs`: UI 用秒，payload 转毫秒
  - `assetRefs`: 一行一个 asset ref，payload 转数组

表单状态：

- `create` 模式：
  - 默认 target = 当前会话。
  - 默认 schedule = `once`，时间默认当前时间后 5 分钟。
  - runtime 字段留空时由后端默认值接管。
- `edit` 模式：
  - 从已有 conn 反填 title / prompt / target / schedule / runtime 字段。
  - 保存时调用 `PATCH /v1/conns/:connId`。
  - 空字段不要发送空字符串给后端；否则现在的 route 会按非法 id 处理。

## 5. 数据转换规则

文件：`src/ui/playground.ts`

新增或扩展 helper：

- `openConnEditor(mode, conn)`
- `closeConnEditor()`
- `buildConnEditorDraft(conn)`
- `renderConnEditor()`
- `readConnEditorPayload()`
- `submitConnEditor()`
- `formatConnDateTimeLocal(value)`
- `parseConnDateTimeLocal(value)`
- `normalizeConnAssetRefsText(value)`
- `renderConnEditorError(message)`

payload 规则：

- `title` trim 后不能为空。
- `prompt` trim 后不能为空。
- `target.type=conversation` 时 `conversationId` 不能为空。
- `target.type=feishu_chat` 时 `chatId` 不能为空。
- `target.type=feishu_user` 时 `openId` 不能为空。
- `schedule.kind=once` 时必须有合法时间。
- `schedule.kind=interval` 时分钟数必须为正整数，payload 转为 `everyMs = minutes * 60 * 1000`。
- `schedule.kind=cron` 时 expression 不能为空。
- `maxRunMs` UI 以秒输入，payload 转毫秒；空值 create 时省略，edit 时暂时省略表示不改。
- advanced id 字段 trim 后：
  - create 空值省略。
  - edit 空值省略，避免触发当前 API 的空字符串校验。

## 6. API 兼容检查

文件：

- `src/routes/conns.ts`
- `src/agent/conn-sqlite-store.ts`
- `src/agent/conn-store.ts`

执行前先确认 `PATCH /v1/conns/:connId` 是否满足编辑 UI：

- 能否修改 target。
- 能否修改 schedule 并重新计算 `nextRunAt`。
- 能否修改 runtime profile ids。
- 能否修改 `assetRefs`。
- 能否修改 `maxRunMs`。

如果发现 “清空可选字段” 是必须能力，再做最小后端补丁：

- 明确 `null` 的语义，例如：
  - `maxRunMs: null` 表示 unset。
  - runtime id 字段是否允许恢复默认值，需要先看 store 默认值边界，不能拍脑袋把 `null` 塞进 required 列。
- 同步补测试。

第一版可以接受“不支持清空已有 runtime id / maxRunMs，只支持改成新值或保持不变”，但必须在实现中保证 UI 不会提交非法空字符串。

## 7. 测试计划

文件：`test/server.test.ts`

### 7.1 Playground HTML / Script 断言

在现有 playground 页面断言中加入：

- `open-conn-editor-button`
- `conn-editor-dialog`
- `conn-editor-title`
- `conn-editor-form`
- `function openConnEditor(`
- `function submitConnEditor(`
- `POST /v1/conns`
- `PATCH /v1/conns/`
- `conn-editor-target-type`
- `conn-editor-schedule-kind`

预期：

- `npm test` 能捕获前端入口误删。
- 现有 browser script syntax 测试继续通过，证明 inline script 没写炸。

### 7.2 API 行为测试

现有测试已经覆盖：

- `POST /v1/conns accepts cron timezone and runtime profile ids`
- `POST /v1/conns defaults target to the current conversation when target is omitted`
- `POST /v1/conns/:connId/run enqueues a background run without invoking the foreground agent`

如实现中触碰 route，需要补：

- `PATCH /v1/conns/:connId updates target and schedule`
- `PATCH /v1/conns/:connId rejects invalid empty runtime ids`
- 如果支持 `null` reset，再补对应测试。

## 8. 文档更新

必须同步更新：

- `docs/playground-current.md`
  - `Conn Manager` 章节加入创建 / 编辑能力。
  - 明确 conn target conversation 与全局活动的关系。
- `docs/runtime-assets-conn-feishu.md`
  - 记录 UI 可创建的 target / schedule / runtime 字段。
- `docs/change-log.md`
  - 追加日期为 `2026-04-22` 的更新记录。

如果新增 / 改动 API 语义，还要更新：

- `README.md` 或现有 API 导航中对应 conn 说明。

## 9. 影响分析

### 9.1 直接影响

- `src/ui/playground.ts`
  - 增加 conn editor DOM、CSS、state、事件绑定。
  - 改动 `renderConnManager()` 的 action 区。
  - 不改变现有聊天发送、会话切换、agent stream 逻辑。
- `test/server.test.ts`
  - 增加页面 marker 和可能的 PATCH API 测试。

### 9.2 间接影响

- 后台任务运行逻辑仍由 worker 驱动，不应因为 UI 新增表单而改变 run 创建链路。
- notification 仍只写入 target conversation；全局活动仍跨会话观察。
- 创建 conn 默认绑定当前会话，这会让“新建后切换会话”时结果气泡仍回到原会话，这是正确行为，不是 bug。

### 9.3 数据结构兼容

- 新 UI 只消费现有 `ConnDefinition` 字段。
- create 时省略 runtime advanced 字段，沿用 store 默认值。
- edit 时避免提交空字符串，防止破坏已有 route 校验。
- `assetRefs` 使用数组，空 textarea 转为空数组或省略要按 create/edit 语义明确：
  - create 空值省略。
  - edit 若用户清空 textarea，可发送 `assetRefs: []`，因为当前 API 支持数组清空。

## 10. 实施步骤

### Task 1: 补测试断言

文件：`test/server.test.ts`

步骤：

1. 在 playground HTML marker 测试里加入 conn editor 相关断言。
2. 确保现有 `extractInlineScripts` / syntax 测试仍覆盖新增脚本。

验证：

```powershell
npm test
```

预期：先失败，指出缺少 conn editor marker。

### Task 2: 增加 conn editor DOM 与样式

文件：`src/ui/playground.ts`

步骤：

1. 在 `conn-manager-dialog` header actions 加 `新建` 按钮。
2. 新增 `conn-editor-dialog` DOM。
3. 增加表单字段、错误区、保存 / 取消按钮。
4. 补移动端样式，避免表单控件溢出。

验证：

```powershell
npm test
```

预期：marker 测试推进，script 可能仍失败，继续 Task 3。

### Task 3: 实现前端表单状态和 payload 构建

文件：`src/ui/playground.ts`

步骤：

1. 增加 `connEditorOpen`、`connEditorMode`、`connEditorConnId`、`connEditorDraft`、`connEditorSaving`、`connEditorError`。
2. 实现日期、target、schedule、assetRefs、advanced runtime 字段转换。
3. 给 target type / schedule kind 切换绑定渲染逻辑。
4. 确保 title / prompt / target / schedule 的校验错误能显示在表单顶部。

验证：

```powershell
npm test
```

预期：inline script syntax 测试通过。

### Task 4: 接通 create / patch 保存流程

文件：`src/ui/playground.ts`

步骤：

1. `create` 模式调用 `POST /v1/conns`。
2. `edit` 模式调用 `PATCH /v1/conns/:connId`。
3. 保存成功后关闭 editor，刷新 `loadConnManager()`。
4. 保存失败时显示后端错误，不关闭弹层。
5. 在 conn item action 区加入 `编辑` 按钮并绑定对应 conn。

验证：

```powershell
npm test
```

预期：所有单测通过。

### Task 5: 必要时补后端 PATCH 兼容

文件：

- `src/routes/conns.ts`
- `src/agent/conn-sqlite-store.ts`
- `test/server.test.ts`

触发条件：

- UI 需要支持清空 `maxRunMs` 或恢复 runtime id 默认值，而当前 API 无法表达。

步骤：

1. 先写 PATCH 行为测试。
2. 定义 `null` reset 语义。
3. 修改 route parse 与 store update。
4. 保证旧 payload 兼容。

验证：

```powershell
npm test
```

预期：新增 PATCH 行为测试通过，旧测试不回归。

### Task 6: 更新文档

文件：

- `docs/playground-current.md`
- `docs/runtime-assets-conn-feishu.md`
- `docs/change-log.md`

步骤：

1. 更新 Conn Manager 当前能力。
2. 写清 target conversation 与全局活动的关系。
3. 追加 `2026-04-22` change-log。

验证：

```powershell
npm test
```

预期：文档更新不影响测试。

### Task 7: 运行最终验证

命令：

```powershell
npm test
npm run docker:chrome:check
```

如本地服务已启动，额外验证：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/playground
```

页面返回中应包含：

- `conn-editor-dialog`
- `open-conn-editor-button`
- `function submitConnEditor(`

手工验收：

1. 打开 `http://127.0.0.1:3000/playground`。
2. 打开 `后台任务`。
3. 点击 `新建`。
4. 创建一个绑定当前会话的 once conn。
5. 在列表中确认新 conn 出现。
6. 点击 `立即执行`。
7. 切到新会话后确认 toast / 全局活动可见。
8. 回到目标会话后确认 conversation notification 气泡存在。

## 11. 风险与回滚

- 风险：inline playground 脚本已经很大，新增 editor 容易引入括号 / template literal 语法错误。
  - 控制：依赖现有 script syntax 测试和 marker 测试。
- 风险：表单把空字符串提交给 PATCH，触发后端校验失败。
  - 控制：payload builder 统一 trim + omit。
- 风险：用户误以为切换新会话后应该收到旧 conn 气泡。
  - 控制：UI 显示目标会话字段；文档明确 notification 归属。
- 风险：移动端弹层溢出。
  - 控制：editor 使用独立 dialog，表单控件固定宽度约束，移动端滚动。

回滚：

- 只要不触碰后端 schema，前端变更可以从 `src/ui/playground.ts` 回滚 editor DOM/state/action。
- 若 Task 5 修改后端 PATCH 语义，回滚时必须同步回滚对应测试和文档。

