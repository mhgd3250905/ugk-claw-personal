# 任务消息页实施方案（含旧会话绑定链路拆除）

- 日期：2026-04-23
- 状态：待用户确认后执行
- 适用范围：`playground`、`conn` 后台任务结果投递、全局活动、通知提醒、文档与测试

## 1. 目标

把后台任务结果从“投递到指定会话”的旧模型，收口为“投递到独立任务消息页”的新模型。

新模型要求：

1. `playground` 顶部状态栏新增 `任务消息` 按钮
2. 点击进入独立任务消息页
3. 页面视觉像 chat，但语义不是会话
4. 每条任务结果消息提供：
   - `任务ID`（点击复制 `runId`）
   - `复制`
   - `查看过程`
5. 顶部按钮带未读红点 / 数字
6. 后台任务结果不再依赖 `conversationId` 归属
7. 不提供“打开原会话”

---

## 2. 真实根因与现状

当前“后台任务结果绑会话”的实现不是一个点，而是一整条链：

### 2.1 创建期绑定

- `src/routes/conns.ts`
  - `POST /v1/conns` 未传 `target` 时，会自动绑定当前服务端 `currentConversationId`
- `src/ui/playground-conn-activity-controller.ts`
  - conn 编辑器默认把“当前会话 / 指定会话”作为主要目标类型
  - 文案和目标预览都在强化“结果发到某个会话”

### 2.2 执行期双写

- `src/workers/conn-worker.ts`
  - 终态 run 会先写 `agent_activity_items`
  - 如果目标是 `conversation`，再额外写 `conversation_notifications`
  - 然后通过 `/v1/internal/notifications/broadcast` 发 SSE

### 2.3 展示期混入聊天

- `src/agent/agent-service.ts`
  - `getConversationCatalog()` 会把 notification 合并进会话预览、计数、排序
  - `getConversationState()` 会把 `conversation_notifications` 合并进 transcript
- `src/routes/notifications.ts`
  - 广播事件模型带 `conversationId`
- `src/ui/playground-stream-controller.ts`
  - 常驻订阅 `/v1/notifications/stream`
- `docs/playground-current.md`
  - 当前文档明确写着 notification 会合并进 transcript

所以这玩意不是简单“改个 UI”，而是要把一条错误归属链整体拆掉。

---

## 3. 核心决策

### 3.1 新真源

后台任务结果的新真源统一为：

- `agent_activity_items`

而不是：

- `conversation_notifications`

### 3.2 新入口

用户查看后台任务结果的主入口统一为：

- 顶部状态栏 `任务消息`
- 独立任务消息页

而不是：

- 当前会话 transcript
- 指定会话 transcript

### 3.3 会话职责收敛

会话页只承担：

1. 普通聊天历史
2. 当前运行态
3. 和当前输入直接相关的上下文

会话页不再承担：

1. 后台任务结果归档
2. 跨会话异步结果投递
3. 任务消息未读提醒

---

## 4. 方案总览

## 4.1 保留并复用

直接复用现有能力：

1. `src/agent/agent-activity-store.ts`
2. `GET /v1/activity`
3. `POST /v1/activity/:activityId/read`
4. 现有 conn run detail / events 查询接口
5. 现有消息复制能力

## 4.2 需要新增或调整

1. 独立任务消息页 UI
2. 顶栏未读数字
3. 任务消息页专用渲染壳
4. activity unread 统计口径
5. activity 实时提醒事件与前端同步逻辑

## 4.3 需要移除

1. conn 结果写入 `conversation_notifications`
2. `AgentService` 中 conversation catalog 对 notification 的合并
3. `AgentService.getConversationState()` 对 notification 的合并
4. 前端把 conn 结果显示成会话消息的逻辑
5. conn 创建默认绑定 `currentConversationId` 的产品路径
6. conn 编辑器里以“结果发到当前/指定会话”为中心的交互与文案

---

## 5. 直接影响分析

### 5.1 修改的函数 / 模块会影响谁

#### A. `src/workers/conn-worker.ts`

影响：

1. 所有 conn 终态结果投递
2. activity 写入
3. notification 广播

风险：

- 如果只删 conversation notification，不补 activity 实时事件，顶部红点会变成“只有刷新才更新”

#### B. `src/agent/agent-service.ts`

影响：

1. `GET /v1/chat/conversations`
2. `GET /v1/chat/state`
3. transcript 合并逻辑
4. 会话目录排序与 preview

风险：

- 去掉 notification 合并后，会话列表的 messageCount / preview / updatedAt 都会变化

#### C. `src/routes/conns.ts` + `src/ui/playground-conn-activity-controller.ts`

影响：

1. conn 创建 payload
2. conn 编辑器表单
3. 用户对任务结果投递目标的心智

风险：

- 如果后端还要求 `target`，但前端把 conversation 选项删了，就会出现“根本提交不了”

### 5.2 参数签名兼容性

需要重点控制：

1. `ConnTarget`
   - 当前支持 `conversation / feishu_chat / feishu_user`
   - 本轮不建议粗暴删除 `conversation` 类型，避免直接炸已有历史数据
2. `/v1/activity`
   - 当前支持 `conversationId` 查询参数
   - 第一阶段建议保留接口兼容，但前端不再使用该过滤
3. `/v1/notifications/stream`
   - 事件结构当前带 `conversationId`
   - 新版本应改成“任务消息事件 / activity 事件”语义，但兼容期可以保留字段不再依赖它

### 5.3 返回结构变化

需要发生的真实变化：

1. `GET /v1/chat/state`
   - 不再返回由 `conversation_notifications` 合并出来的 `kind=notification` 消息
2. `GET /v1/chat/conversations`
   - `preview / messageCount / updatedAt` 不再被 notification 污染
3. 任务消息页数据来源改为 `GET /v1/activity`

---

## 6. 间接影响分析

### 6.1 调用链上下游

旧链路：

`conn create -> target conversation -> worker create notification -> SSE broadcast -> AgentService merge into conversation -> chat UI render notification`

新链路：

`conn create -> worker create activity -> activity realtime signal -> task inbox refresh -> task message UI render`

### 6.2 共享状态 / 全局变量

前端状态至少会受影响：

1. `state.agentActivityItems`
2. `state.agentActivityOpen`
3. 通知 toast 状态
4. 会话目录摘要状态
5. transcript 消息归并状态

风险点：

- 如果仍保留旧 notification stream 自动刷新 transcript，就会造成“任务消息页和会话页双显”

### 6.3 事件监听器 / 回调时机

需要调整：

1. 现有 `/v1/notifications/stream` 的监听目的
2. 收到后台结果时前端应优先更新未读数和任务消息列表
3. 不再把后台结果写入当前 transcript

---

## 7. 数据结构兼容性分析

### 7.1 `agent_activity_items`

当前字段：

- `activityId`
- `source`
- `sourceId`
- `runId`
- `conversationId`
- `title`
- `text`
- `files`
- `createdAt`
- `readAt`

结论：

- 足够支撑任务消息页第一版
- `conversationId` 可先保留为兼容字段，但不再作为投递归属真源

### 7.2 `conversation_notifications`

当前用途：

1. 会话 transcript 混入
2. 会话列表 preview / count / updatedAt 混入
3. SSE 广播来源之一

建议：

1. 第一阶段停止新增写入
2. 第二阶段移除读取依赖
3. 历史表数据可保留一段兼容期，不需要立刻删库

原因：

- 先断写、再断读、最后再考虑清库，比一刀砍死更稳

### 7.3 `conns.target`

当前：

- 业务定义强依赖 `target`

建议：

1. 第一阶段先把“会话目标”从产品主路径移除
2. 保留类型层兼容，避免历史 conn 无法读取
3. 新建任务默认改为“任务消息页投递 + 外部目标（如 Feishu）可选”

说明：

- 真要把 `conversation` 从 `ConnTarget` 类型层也删掉，可以做第二期迁移
- 第一阶段直接删类型，会把现有 SQLite 里的历史数据和测试一起炸裂，没必要犯蠢

---

## 8. 推荐实施顺序

## 阶段一：建立新入口，不再新增旧绑定

### 8.1 后端

1. 新增任务消息页所需 unread 统计能力
   - 可选方案 A：扩展 `GET /v1/activity`
   - 可选方案 B：新增 `GET /v1/activity/summary`
   - 推荐 B，更清晰
2. `conn-worker` 停止向 `conversation_notifications` 写新结果
3. `conn-worker` 实时广播改为基于 activity 语义
4. 保留已有 run detail / events 查询接口不变

### 8.2 前端

1. 顶栏增加 `任务消息`
2. 加未读数字
3. 新建独立任务消息页
4. 用 chat 风格渲染 activity
5. 每条消息接入：
   - 复制任务 ID
   - 复制正文
   - 查看过程

### 8.3 conn 创建 / 编辑入口

1. UI 去掉“当前会话 / 指定会话”作为核心投递选项
2. 文案改成“结果会进入任务消息页”
3. Feishu 这类外部投递目标继续保留

---

## 阶段二：移除旧读取链路

### 8.4 后端

1. `AgentService.getConversationCatalog()` 去掉 notification 合并
2. `AgentService.getConversationState()` 去掉 notification 合并
3. 删除或废弃 `conversationStore.deleteConversation()` 时对 notification 的联动清理依赖

### 8.5 前端

1. transcript 不再渲染 `kind=notification` 的后台任务结果
2. 会话目录不再因为后台任务结果改变 preview / count / updatedAt
3. 现有全局活动弹层如果保留，需要重新定位为“任务消息的轻量入口”或并入新页面

---

## 阶段三：清理文档与遗留能力

1. 更新 `docs/playground-current.md`
2. 更新 `docs/runtime-assets-conn-feishu.md`
3. 更新 `docs/change-log.md`
4. 清理不再成立的“结果发到当前/指定会话”文案
5. 视情况决定是否保留 `/v1/notifications/stream` 作为兼容层，或迁移为新的 activity 事件流

---

## 9. 关键文件级改动计划

### 9.1 后端

#### [src/workers/conn-worker.ts](/E:/AII/ugk-pi/src/workers/conn-worker.ts)

改动目标：

1. 保留 activity 写入
2. 删除 conversation notification 写入
3. 广播从 notification 语义改成 task/activity 语义

#### [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)

改动目标：

1. 删除会话目录对 notification summary 的混入
2. 删除 conversation state 对 notification 的混入
3. 删除 `mergeConversationNotifications()` 相关链路

#### [src/routes/activity.ts](/E:/AII/ugk-pi/src/routes/activity.ts)

改动目标：

1. 补 unread 统计或摘要接口
2. 视需要补“全部已读”

#### [src/routes/notifications.ts](/E:/AII/ugk-pi/src/routes/notifications.ts)

改动目标：

1. 重定义实时事件用途
2. 避免前端继续把它当 conversation result stream

#### [src/routes/conns.ts](/E:/AII/ugk-pi/src/routes/conns.ts)

改动目标：

1. 停止“未传 target 时默认绑定 currentConversationId”
2. 新建 conn 的默认结果归属改成任务消息页
3. 保留外部投递目标能力

### 9.2 前端

#### [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)

改动目标：

1. 顶栏增加 `任务消息`
2. 增加独立任务消息页 DOM / 视图容器
3. 增加 unread badge

#### [src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)

改动目标：

1. 复用 `查看过程`
2. 从“活动弹层”升级为“任务消息页”数据控制器
3. conn 编辑器移除 conversation target 主路径

#### [src/ui/playground-stream-controller.ts](/E:/AII/ugk-pi/src/ui/playground-stream-controller.ts)

改动目标：

1. 停止把实时后台结果并入当前会话
2. 收到事件时只更新任务消息与未读状态

#### [src/ui/playground-transcript-renderer.ts](/E:/AII/ugk-pi/src/ui/playground-transcript-renderer.ts)

改动目标：

1. 把“复制”按钮能力抽成可复用
2. 供任务消息页复用消息壳

### 9.3 数据 / 存储

#### [src/agent/conversation-notification-store.ts](/E:/AII/ugk-pi/src/agent/conversation-notification-store.ts)

改动目标：

1. 第一阶段不一定立刻删除文件
2. 但应从主链路移除调用
3. 后续若无其他用途，再考虑彻底退役

---

## 10. 测试计划

## 10.1 后端测试

需要新增或调整：

1. conn run 完成后只写 activity，不再写 conversation notification
2. `GET /v1/chat/state` 不再混入后台结果 notification
3. `GET /v1/chat/conversations` 不再被后台结果改变 preview / count
4. `GET /v1/activity` / summary / read 接口正确
5. conn 删除时 activity 清理策略仍正确

## 10.2 前端行为测试

需要覆盖：

1. 顶栏 `任务消息` 按钮出现
2. 未读数字显示与清除
3. 任务消息页渲染成功 / 失败 / 超时结果
4. `任务ID` 复制成功
5. `复制` 复制正文成功
6. `查看过程` 仍能打开 run detail
7. 切换会话时任务消息不丢、不乱入 transcript

## 10.3 回归验证

必须确认：

1. 正常聊天没被破坏
2. 会话切换没被破坏
3. conn 创建 / 编辑 / 删除没被破坏
4. Feishu 目标不受影响
5. 本地与 Docker 重启后状态一致

---

## 11. 风险与对应策略

### 风险 1：删 conversation notification 后，老页面提示全没了

策略：

1. 先做任务消息页
2. 再断旧读链路
3. 期间保持 activity 实时提醒先跑通

### 风险 2：旧 conn 历史数据仍带 conversation target

策略：

1. 第一阶段兼容读取
2. 但不再让新建 / 编辑继续走这个路径

### 风险 3：未读统计做成前端缓存，跨端不一致

策略：

1. 未读必须以后端 `readAt` 为准
2. 不接受纯前端本地角标

### 风险 4：活动页和任务消息页并存，入口重复

策略：

1. 要么把现有活动面板升级为任务消息页数据源
2. 要么明确把旧活动弹层退役
3. 不要长期双轨

---

## 12. 建议的落地口径

第一版建议这样收口：

1. 顶栏按钮名称：`任务消息`
2. 独立页面：在 `playground` 内部切换主视图即可，不必先拆成新应用
3. 每条消息展示：
   - 标题
   - 正文摘要 / 正文
   - 时间
   - 文件
   - 状态语义
4. 底部操作固定：
   - `任务ID`
   - `复制`
   - `查看过程`
5. 已读策略：
   - 进入页面不自动全已读
   - 用户看到 / 打开后标记
   - 后续可补“全部已读”

---

## 13. 本轮计划结论

这次不是简单加个页面，而是把“后台结果属于会话”这个错误建模彻底废掉。

推荐执行原则：

1. **先立新入口**
2. **再断旧写入**
3. **再断旧读取**
4. **最后清理遗留文档与兼容层**

如果用户批准执行，实现时应严格按这个顺序推进，别一上来就删库拔线，搞得一地鸡毛。
