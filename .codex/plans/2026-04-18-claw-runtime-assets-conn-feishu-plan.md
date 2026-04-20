# ugk-pi Claw Runtime / Assets / Conn / Feishu 实施计划

**目标**

在当前 `ugk-pi` 原型上，一次性补齐 4 条主线能力：

1. 修复运行中追加消息没有真正中途介入的问题。
2. 建立统一文件资产体系，规范管理上传文件与 agent 产出文件，并支持后续复用。
3. 设计并实现 `conn` 机制，让 agent 可以识别、创建、执行、查询、修改定时/周期任务。
4. 接入飞书，让飞书侧具备接近 web playground 的对话、追加、打断、文件与任务能力。

**总原则**

- 不做补丁式修修补补，直接收敛成统一运行时模型。
- 当前处于开发阶段，无历史包袱，优先按更合理的最终能力重构。
- 所有新增能力必须同步沉淀文档，保证后续可回溯。

---

## 已确认事实

- 当前 playground 在运行中发送消息时固定走 `POST /v1/chat/queue` 且 `mode = "followUp"`。
- `pi` 官方语义里：
  - `steer`：在当前 tool batch 结束后中途插入，跳过剩余工具，真正影响当前过程。
  - `followUp`：等待当前 run 完整结束，再执行后续消息。
- 也就是说，当前“追加消息不生效”不是偶发现象，而是产品语义本身被写成了“排队等下轮”。
- 当前文件处理只有两段能力：
  - 上传文件：请求体里的 `attachments`，文本内容直接内联进 prompt。
  - 产出文件：assistant 用 `ugk-file` fenced block，后端落盘并生成下载链接。
- 当前没有统一资产 ID、没有去重、没有跨会话复用机制，也没有“引用已有文件而不重复注入全文”的能力。
- 当前仓库没有飞书接入代码，也没有后台 scheduler / cron 持久层。

---

## 方案决策

### 1. 运行中追加消息

采用“后端真实 steer/followUp 双通道 + 前端默认 steer”的方案。

- 后端不再把运行中消息继续伪装成 `prompt(..., { streamingBehavior })`。
- 优先调用 session 原生 `steer()` / `followUp()`。
- playground 与飞书侧运行中继续发消息时，默认走 `steer`。
- API 仍保留显式 `mode`，方便后续上层按需选 `followUp`。

**原因**

- 这才符合用户对“追加”的直觉。
- 和 `pi` 官方模型一致，不需要自己发明假的队列语义。
- 后端统一后，web 与飞书可以共享同一套行为。

### 2. 文件资产体系

采用“统一资产仓库 + 资产引用 + 按需注入内容”的方案。

- 新建统一 `AssetStore`，覆盖：
  - 用户上传文件
  - agent 产出文件
  - 后续定时任务、飞书消息里引用的文件
- 每个资产使用稳定 `assetId`，并保存：
  - `kind`
  - `owner/source`
  - `conversationId`
  - `sha256`
  - `mimeType`
  - `sizeBytes`
  - `storagePath`
  - `textPreview`
  - `createdAt`
- 文本类资产做内容去重，复用已有 blob。
- 对话请求支持两种输入：
  - `attachments`: 本轮新上传
  - `assetRefs`: 复用既有资产
- prompt 构建改为：
  - 默认只注入资产元数据 + `assetId`
  - 文本短文件或用户明确要求时再内联正文
  - agent 可通过新工具按 `assetId` 读取完整内容

**原因**

- 节省 token，不必每轮重复灌文件全文。
- 用户和 agent 都能稳定引用同一个文件。
- 统一资产层之后，web / 飞书 / 定时任务都能共用。

### 3. conn 机制

采用“项目级 extension 工具 + 持久化任务仓库 + 进程内 scheduler”的方案。

- 新建 `.pi/extensions/conn/`
- 暴露 `conn` 工具，至少支持：
  - `create`
  - `list`
  - `get`
  - `update`
  - `pause`
  - `resume`
  - `delete`
  - `run_now`
- 任务支持：
  - 一次性执行时间
  - cron 表达式
  - interval 周期执行
- 每个任务保存：
  - `connId`
  - `title`
  - `prompt`
  - `target`
  - `schedule`
  - `assetRefs`
  - `status`
  - `lastRunAt`
  - `nextRunAt`
  - `lastResult`
- scheduler 在服务进程启动后常驻轮询，触发时调用统一 agent 执行链路。
- target 设计成通用结构：
  - `conversation`
  - `feishu_chat`
  - `feishu_user`

**原因**

- `conn` 是运行时能力，不该散落成一堆路由私货。
- 让 agent 通过工具直接创建/调整任务，才能做到“主动识别意图后执行”。
- target 通用化后，web 会话和飞书消息都能复用。

### 4. 飞书接入

采用“飞书 Bot webhook + 会话映射 + 复用 AgentService”的方案。

- 新增飞书 webhook 路由。
- 建立飞书 `chatId/userId/thread` 到项目 `conversationId` 的映射。
- 接收到飞书消息后：
  - 普通空闲对话走正常 `streamChat`
  - 如果该会话正在运行，新消息默认走 `steer`
- 回复通过飞书发送消息 API 回发。
- 文件处理：
  - 飞书上传文件先转为统一资产
  - agent 产出文件可上传回飞书，并在消息里附带引用
- `conn` 触发到飞书 target 时，直接主动推送结果到对应 chat / user。

**原因**

- 最大限度复用现有 `AgentService`、会话映射和资产体系。
- 飞书只是新的入口与投递端，不应该再复制一套 agent 逻辑。

---

## 范围边界

### 本次要做

- 修复运行中追加消息真实生效
- 统一资产仓库与引用能力
- `conn` 工具、任务持久化、scheduler
- 飞书 webhook 与消息收发
- playground 侧最少必要 UI 更新
- 文档、测试、回归验证

### 本次不做

- 多租户权限系统
- 数据库存储
- WebSocket 实时推送到浏览器
- 飞书之外的 Slack / 企业微信
- 复杂审批流与组织级权限模型

---

## 数据布局

计划新增或扩展：

```text
.data/
└─ agent/
   ├─ sessions/
   ├─ conversation-index.json
   ├─ assets/
   │  ├─ blobs/
   │  └─ derived/
   ├─ asset-index.json
   ├─ conn/
   │  ├─ conn-index.json
   │  └─ runs/
   └─ feishu/
      └─ conversation-map.json
```

---

## 实施任务

### Task 1: 修复真实运行中追加语义

**文件**

- `src/agent/agent-session-factory.ts`
- `src/agent/agent-service.ts`
- `src/routes/chat.ts`
- `src/ui/playground.ts`
- `test/agent-service.test.ts`
- `test/server.test.ts`

**动作**

1. 给 session 抽象补上 `steer()` / `followUp()` 能力。
2. `queueMessage()` 改为真实分发到 `steer/followUp`。
3. playground 运行中发送默认改为 `steer`。
4. 保留 `followUp` API 能力，供 `conn` 等场景使用。
5. 补充回归测试，验证 `steer` 真正中途介入。

### Task 2: 重构为统一资产体系

**文件**

- `src/agent/file-artifacts.ts` 拆/升级为资产模块
- 新增 `src/agent/asset-store.ts`
- 新增资产路由与类型定义
- 更新 `src/types/api.ts`
- 更新 `src/routes/chat.ts`
- 更新 `src/ui/playground.ts`
- 新增测试文件

**动作**

1. 抽象统一资产模型。
2. 支持新上传与已有资产引用。
3. 对文本内容做去重与预览。
4. 新增资产读取/列表/复用接口。
5. 调整 prompt 注入与 agent 文件输出落地逻辑。

### Task 3: 实现 conn 机制

**文件**

- 新增 `.pi/extensions/conn/index.ts`
- 新增 `src/agent/conn-store.ts`
- 新增 `src/agent/conn-runner.ts`
- 新增必要配置与测试

**动作**

1. 定义 `conn` 数据模型。
2. 实现工具接口与持久层。
3. 实现服务启动后的 scheduler。
4. 将任务执行接入统一 agent/资产链路。
5. 在系统 prompt / skill 入口里补足 agent 使用约定。

### Task 4: 接入飞书

**文件**

- 新增 `src/integrations/feishu/*`
- 新增 `src/routes/feishu.ts`
- 更新 `src/server.ts`
- 新增配置项与测试/文档

**动作**

1. 实现飞书 webhook 验签与事件接收。
2. 建立飞书会话映射。
3. 复用统一 agent 执行链路。
4. 接入飞书消息发送与文件上传。
5. 接入 `conn` 主动推送。

### Task 5: 文档与回归

**文件**

- `README.md`
- `AGENTS.md`
- 如有需要补 `.env.example`

**动作**

1. 记录架构、接口、配置与验证口径。
2. 写清资产模型、conn 语义、飞书接入口径。
3. 复跑类型检查和测试。
4. 整理手动验证步骤，方便用户回来验收。

---

## Fix Impact Analysis

### 1. 直接影响

- `queueMessage()` 行为将改变：
  - `steer` 会真正中途介入
  - `followUp` 保持等待当前 run 结束
- 聊天请求体会新增资产引用能力。
- 文件相关返回结构会从“下载链接”扩展为“资产 + 下载”的统一模型。

### 2. 间接影响

- SSE 过程事件里会出现更明确的队列/插队状态变化。
- scheduler 会引入后台执行链路，需要处理进程内资源竞争。
- 飞书接入会共享现有会话与资产层，任何会话/资产 bug 都会外溢到飞书。

### 3. 数据结构兼容性

- 旧 `.data/agent/file-index.json` 将迁移或兼容读取到新资产索引。
- 新增 `asset-index.json`、`conn-index.json`、飞书会话映射文件。
- API 尽量向后兼容保留旧字段，同时补新字段。

---

## 验证口径

至少执行：

```bash
npx tsc --noEmit
npm run test
```

手动验证至少覆盖：

1. playground 发起长任务，运行中再次发送，确认当前过程被真实 steer。
2. 上传文本文件，复用同一资产再次提问，确认不会重复重新上传。
3. agent 产出文件后，在下一轮通过资产引用再次使用。
4. 创建一次性 conn 任务并手动触发。
5. 创建周期 conn 任务并确认 scheduler 执行。
6. 飞书里发送消息、运行中追加、接收文件、接收 conn 推送。

---

## 最终交付标准

- web playground 运行中追加消息真正生效
- 文件资产统一建模并可复用
- conn 任务可创建、可执行、可修改、可暂停恢复
- 飞书侧具备基础可用能力
- README / AGENTS / 配置说明完整
- 类型检查通过，测试通过
