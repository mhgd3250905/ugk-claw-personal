# Runtime / Assets / Conn / Feishu

更新时间：`2026-04-23`

这份文档只讲四类运行能力：

- 文件上传与统一资产库
- `assetRefs`、`ugk-file`、`send_file`
- `conn` 定时 / 周期任务
- Agent Activity 全局活动时间线
- Feishu webhook 接入

如果你要查 playground 视觉和交互，去看 [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)。

## 1. 统一资产体系

当前项目不再把“用户上传文件”和“agent 产出文件”拆成两套逻辑，而是统一进入 `AssetStore`。

关键事实：

- 用户上传文件会注册为资产，可被后续 `assetRefs` 复用
- `POST /v1/assets` 可直接把当前上传的附件注册成可复用资产，供 `conn` 编辑器或后续会话继续选用
- agent 回复中的 `ugk-file` 会被提取并写入资产库
- agent 生成了真实文件时，优先通过 `send_file` 交付
- `/v1/files/:fileId` 负责文件内容返回
- `/v1/assets` 与 `/v1/assets/:assetId` 提供资产元数据

关键入口：

- [src/agent/asset-store.ts](/E:/AII/ugk-pi/src/agent/asset-store.ts)
- [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
- [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
- [.pi/extensions/send-file.ts](/E:/AII/ugk-pi/.pi/extensions/send-file.ts)

## 2. 文件交付协议

`src/agent/file-artifacts.ts` 会给每轮 prompt 注入统一协议。

当前口径：

- agent 内部允许使用 `/app/...` 和 `file:///app/...` 做本地 artifact 引用
- 如果用户要在浏览器里打开产物，运行时负责把受支持的本地路径桥接成 HTTP
- 如果用户要拿到真实文件，优先使用 `send_file`
- `ugk-file` 只作为小文本文件兜底

这层协议不只是“告诉 agent 怎么说”，还对应真实实现：

- [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts) 负责协议与用户可见文本重写
- [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts) 负责在正文、流式增量、工具输出里应用重写
- [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts) 提供 `GET /v1/local-file?path=...`

## 3. `send_file`

`send_file` 是正式文件交付通道，不是聊天框 base64 搬运工。

适用场景：

- 图片、PDF、压缩包、报告等真实文件
- agent 已经在项目目录生成了目标文件
- 用户明确说“把文件发给我”

数据流：

1. agent 调用 `send_file`
2. 工具校验路径必须位于项目根目录内
3. 文件以 Buffer 形式写入资产库
4. `AgentService` 从 `tool_execution_end` 中提取文件元数据
5. `done.files` 返回给前端
6. playground 渲染文件卡片
7. canonical conversation history 也会把这些 `send_file` 结果挂回对应 assistant 消息；如果这一轮只有 `toolResult(send_file)`、没有可挂载的 assistant 正文，后端会补一条 synthetic assistant history entry 承载文件，避免文件卡片在刷新或晚到的 state 回包后凭空消失

关键约束：

- 只允许项目目录内文件
- 不允许路径穿越
- 不要再让 agent 手动 `cat | base64`

关键入口：

- [.pi/extensions/send-file.ts](/E:/AII/ugk-pi/.pi/extensions/send-file.ts)
- [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
- [src/agent/asset-store.ts](/E:/AII/ugk-pi/src/agent/asset-store.ts)

## 4. 本地 artifact 浏览器桥接

宿主浏览器打不开容器里的 `file:///app/...`，这不是用户的错，也不该靠 agent 临时记忆规避。

现在的正式出口是：

```text
GET /v1/local-file?path=...
```

支持的本地路径语义：

- `/app/public/...`
- `/app/runtime/...`
- `file:///app/public/...`
- `file:///app/runtime/...`
- `public/...`
- `runtime/...`

注意区别：

- agent 内部：允许继续用本地路径
- 用户可见文本：运行时会自动改写成宿主可访问的 `/v1/local-file?path=...`
- 已经是 `/v1/local-file?path=...` 的用户可见链接不能再次被路径重写器包一层；如果历史消息里出现 `path=http://.../v1/local-file?path=...` 这类双层链接，`/v1/local-file` 会拆出内层真实 artifact 路径后再按白名单服务
- 用户拿真实文件：优先 `send_file`

## 5. 文件预览与下载

`/v1/files/:fileId` 现在分开处理预览和下载：

- 默认按 MIME 决定 `inline` 或 `attachment`
- `.md`、`.txt`、`.csv`、`.json`、`.xml`、`.yaml`、`.js`、`.svg` 这类文本型资产通过 `/v1/files/:fileId` 预览时必须带 `charset=utf-8`；否则中文 Markdown 在浏览器里打开时可能被当成错误编码解读，乱码别甩锅给 agent
- 强制下载使用 `?download=1`
- 中文文件名通过 `filename` + `filename*` 处理

playground 卡片当前规则：

- 图片 / PDF / txt / md / json / csv 这类有“打开”
- 所有文件都有“下载”

## 5.1 web-access 生命周期清理

- browser cleanup scope 现在收口为“稳定的会话级 scope”，不再给每轮 run 拼随机后缀；否则一旦某轮 finally 没跑干净，后续谁也不知道该去清哪批残页
- `AgentService` 会在真正 `session.prompt(...)` 前先对当前会话 scope 做一次预清理，把之前漏掉的旧页面先扫掉
- 正常完成、报错或中断后，`AgentService` 仍会在 `finally` 里 best-effort 调用 `closeBrowserTargetsForScope(scope)`，收尾清理本轮页面
- 这层清理是“补强现有稳定链路”，不是重写技能；清理失败只记 warn，不覆盖原始任务结果
- 关键入口：
  - [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
  - [src/agent/browser-cleanup.ts](/E:/AII/ugk-pi/src/agent/browser-cleanup.ts)
  - [test/browser-cleanup.test.ts](/E:/AII/ugk-pi/test/browser-cleanup.test.ts)
  - [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)

## 6. `conn`

创建 / 更新 `conn` 时，当前也支持这几类运行时索引字段：
- `profileId`
- `agentSpecId`
- `skillSetId`
- `modelPolicyId`
- `upgradePolicy`

这些字段的作用是让后台 worker 在真正执行时，按 ID 解析当前 agent 规范、skill 集和模型策略，而不是把整套运行时定义硬编码进 conn 本身。

playground 现在可以直接创建和编辑 `conn`，表单字段会映射到同一套后端定义：
- `title` / `prompt`：后台任务名称和执行输入。
- `prompt` 继续由用户直接填写，作为后台任务的真实执行说明。
- `target`：支持当前服务端会话、指定 `conversationId`、`feishu_chat` 和 `feishu_user`；目标在创建 / 编辑时固化，后续切换当前会话不会改变历史 conn 的投递归属。
- 目标预览：playground 会在编辑器里展示目标摘要和目标编号。conversation 目标会提示“结果气泡只进入这个会话”；飞书目标会提示“通过飞书 adapter 发送，全局活动仍保留追溯记录”。
- 默认表单只展示常用字段，目标编号、调度细节和高级设置按需展开；不要再把 profile / skill / model policy 一上来甩给用户，界面不是飞控面板。
- 时间配置收口成三种：`定时执行`、`间隔执行`、`每日执行`。playground 仍会映射成后端真正使用的 `once / interval / cron`，但界面不再暴露 cron、工作日或每周这些额外分支。
- 三种模式的表单固定为：`定时执行` -> `执行时间`；`间隔执行` -> `首次执行时间 + 间隔（分钟）`；`每日执行` -> `每日执行时间`。
- 后台任务列表的主要摘要已经收口为 `结果发到 / 执行方式 / 运行节奏` 三行口径，不再直接把 `target / schedule / next / last / maxRunMs` 这类字段名扔给使用者。
- 全局活动里的来源、会话和文件摘要也统一成人话：来源显示为 `后台任务 / 飞书 / 助手 / 通知`，会话显示为“来自 当前会话 / 指定会话”，文件显示为“附 N 个文件”。
- `schedule`：支持 `once`、`interval`、`cron`；`interval` 表单按分钟输入，落库仍是毫秒。
- `maxRunMs`：表单按秒输入，提交时转换成毫秒；空值表示不设置单次运行上限。
- `assetRefs`：用户侧文案叫“附加资料”，前端通过“选择复用文件 / 上传新文件”两条入口维护，提交时仍落成内部 `assetRefs` 数组，供后台 workspace 快照输入文件；不要再要求用户手填内部 `assetId`。
- `conn` 编辑器加载最近资产列表时，不会再因为 `/v1/assets?limit=40` 没带上某个旧资料，就把已经选中的 `assetRefs` 静默洗掉；缺失的已选资产会按需补请求 `/v1/assets/:assetId` 拉回详情
- `profileId` / `agentSpecId` / `skillSetId` / `modelPolicyId` / `upgradePolicy`：在界面上分别叫“任务身份 / 执行模板 / 能力包 / 模型策略 / 版本跟随方式”，底层仍作为运行时索引字段传给 worker 解析快照。

`cron` 调度当前支持显式 `timezone`：

```json
{
  "kind": "cron",
  "expression": "0 9 * * *",
  "timezone": "Asia/Shanghai"
}
```

如果创建时没有传 `timezone`，存储层会在落库时补成当前运行环境解析出的 IANA 时区，避免“每天早上 9 点”跟着容器或宿主机时区漂移。

当前支持：

- `once`
- `interval`
- `cron`

Run 查询接口：
- `GET /v1/conns/:connId/runs`：查看某个 conn 的历史 run。
- `GET /v1/conns/:connId/runs/:runId`：查看单次 run 的状态、结果摘要和输出文件索引。
- `GET /v1/conns/:connId/runs/:runId/events`：查看单次 run 的过程事件；如果 run 不属于该 conn，返回 `404`。

当前运行口径：
- 前台 `ugk-pi` 进程只负责创建 / 查询 / 暂停 / 恢复 conn，以及把 `POST /v1/conns/:connId/run` 写成一条 `pending` run。
- `POST /v1/conns` 在未传 `target` 时，会自动绑定创建当下的服务端当前会话 `currentConversationId`；如果显式传了 `target`，仍以请求里的目标类型和值为准。
- `conn` 系统技能当前以 [.pi/skills/conn-orchestrator/SKILL.md](/E:/AII/ugk-pi/.pi/skills/conn-orchestrator/SKILL.md) 为准：agent 直接依赖语言理解与 `conn` 工具，不搞低级文字匹配；默认投递到当前会话，当前回合如果已有上传或复用文件，应把可见 `assetRefs` 一起带入 `conn`。
- 本地 `docker compose` 会把 `conn.sqlite` 放到 named volume `ugk-pi-conn-db`，避开 Docker Desktop bind mount 上的多进程 SQLite 打开问题；如果 volume 里还是空库，而 legacy `.data/agent/conn/conn.sqlite` 已存在，初始化时会自动迁移这份旧库。
- 后台执行由独立 `ugk-pi-conn-worker` 进程轮询 SQLite，领取 due run 后在 `.data/agent/background/runs/<runId>/` 创建独立 workspace。
- 后台 runner 生成 `resultText` 时会优先保留用户真正要的可见答案；如果最后一条 assistant 文本只是“输出文件已写入”这类低信息量收尾，会回退到前面更有用的回答。别再让通知正文只剩一个文件路径，用户不是来猜谜的。
- run 成功后会扫描该 workspace 的 `output/` 目录，并把真实输出文件写入 `conn_run_files`；因此 run 详情里的“输出文件索引”应与后台生成物对齐。
- conn 终态结果写入 `conversation_notifications`，再由 `AgentService.getConversationState()` 合并进前台对话；成功、失败和超时失败都会留下 notification，不会写入前台 pi session history。
- playground 收到 `kind=notification` 且 `source=conn` 的消息后，会在消息底部显示“查看后台任务过程”入口；点开后分别请求 run 详情和 run 事件，展示状态、workspace、结果摘要、输出文件和过程日志
- 这类 notification 在前端本地历史缓存里也会保留 `source / sourceId / runId`，刷新页面后仍然能继续点开 run 详情
- 旧的进程内 `conn-scheduler` / `conn-runner` 已移除，别再按前台同步执行链路排查。

关键入口：

- [src/agent/conn-store.ts](/E:/AII/ugk-pi/src/agent/conn-store.ts)
- [src/agent/conn-db.ts](/E:/AII/ugk-pi/src/agent/conn-db.ts)
- [src/agent/conn-sqlite-store.ts](/E:/AII/ugk-pi/src/agent/conn-sqlite-store.ts)
- [src/agent/conn-run-store.ts](/E:/AII/ugk-pi/src/agent/conn-run-store.ts)
- [src/agent/agent-activity-store.ts](/E:/AII/ugk-pi/src/agent/agent-activity-store.ts)
- [src/agent/background-agent-runner.ts](/E:/AII/ugk-pi/src/agent/background-agent-runner.ts)
- [src/workers/conn-worker.ts](/E:/AII/ugk-pi/src/workers/conn-worker.ts)
- [src/routes/conns.ts](/E:/AII/ugk-pi/src/routes/conns.ts)
- [src/routes/activity.ts](/E:/AII/ugk-pi/src/routes/activity.ts)

## 7. Feishu

当前入口：

- `POST /v1/integrations/feishu/events`

已接通：

- `url_verification`
- `im.message.receive_v1`
- Feishu 会话与本地 `conversationId` 映射
- 入站文件 / 图片不再只传文件名元数据；服务层会先下载飞书资源，再桥接成可直接喂给 agent 的 `ChatAttachment`
- 出站结果现在先发文本，再尝试把 agent 返回的文件上传回飞书并发送 file message；上传失败时才退回文件 URL 文本，避免把“应该给文件”退化成一串链接
- 单窗口消息队列不再靠中断关键字硬匹配瞎猜。当前策略由 `queue-policy` 根据消息内容决定：
  - 纯文本补充：优先 `steer`
  - 带附件补充：优先 `followUp`
- 当前 Feishu 模块已经按职责拆开，避免把 webhook、下载、队列和回传又揉成一锅：
  - `message-parser`：解析 webhook / inbound message
  - `attachment-bridge`：下载飞书附件并转成 agent 可消费的附件结构
  - `queue-policy`：在单窗口约束下决定追加消息的排队策略
  - `delivery`：发送文本、上传回传文件、失败时降级到链接
  - `client`：tenant access token、消息发送、文件上传、资源下载
  - `service`：把这些模块编排进统一 Feishu 接入流程

关键入口：

- [src/routes/feishu.ts](/E:/AII/ugk-pi/src/routes/feishu.ts)
- [src/integrations/feishu/message-parser.ts](/E:/AII/ugk-pi/src/integrations/feishu/message-parser.ts)
- [src/integrations/feishu/attachment-bridge.ts](/E:/AII/ugk-pi/src/integrations/feishu/attachment-bridge.ts)
- [src/integrations/feishu/queue-policy.ts](/E:/AII/ugk-pi/src/integrations/feishu/queue-policy.ts)
- [src/integrations/feishu/delivery.ts](/E:/AII/ugk-pi/src/integrations/feishu/delivery.ts)
- [src/integrations/feishu/service.ts](/E:/AII/ugk-pi/src/integrations/feishu/service.ts)
- [src/integrations/feishu/client.ts](/E:/AII/ugk-pi/src/integrations/feishu/client.ts)
- [test/feishu-service.test.ts](/E:/AII/ugk-pi/test/feishu-service.test.ts)

## 8. 当前最容易踩坑的点

- 不要再把聊天框当文件传输层
- 不要把容器 `file:///app/...` 直接给宿主浏览器
- 不要把 “agent 内部允许 file” 和 “用户可见地址必须可打开” 混成一锅
- 查文件问题时，先区分：
  - 是内部工作路径问题
  - 还是用户交付出口问题

## 9. Docker sidecar 与本地 artifact

`web-access` 现在默认通过 Docker Chrome sidecar 打开真实浏览器页面。这里有一个非常容易踩的网络视角问题：

- 用户可见链接使用 `PUBLIC_BASE_URL`，本地通常是 `http://127.0.0.1:3000`
- sidecar Chrome 自动化使用 `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL`，compose 内默认是 `http://ugk-pi:3000`
- sidecar Chrome 不能直接打开 `file:///app/...`，也不能把 `127.0.0.1:3000` 当成 app 容器

因此 agent 内部可以继续写 `/app/runtime/report.html`，但浏览器预览和截图必须经由：

```text
GET /v1/local-file?path=...
```

如果是给用户拿真实文件，仍然优先使用 `send_file`，不要把浏览器预览链路当文件交付链路。

## Conn Realtime Broadcast

- `conn-worker` 在把结果写入 `conversation_notifications` 之后，会再 best-effort 调用 `POST /v1/internal/notifications/broadcast`，把实时事件扔给前台 server 进程内的 `NotificationHub`。
- `NotificationHub` 负责把事件扇出到 `GET /v1/notifications/stream` 的所有在线 SSE 订阅者；断线或无人在线时不会影响持久化结果。
- 本地和生产 compose 都显式给 `ugk-pi-conn-worker` 注入 `NOTIFICATION_BROADCAST_URL=http://ugk-pi:3000/v1/internal/notifications/broadcast`，避免 worker 在容器里误把 `127.0.0.1` 打回自己。
- 这条链路只负责“在线提醒”，不改变 notification 的真实归属；真实归属仍然以 conn 创建时固化的 `target` 为准。
- 关键入口：
  - [src/workers/conn-worker.ts](/E:/AII/ugk-pi/src/workers/conn-worker.ts)
  - [src/routes/notifications.ts](/E:/AII/ugk-pi/src/routes/notifications.ts)
  - [src/agent/notification-hub.ts](/E:/AII/ugk-pi/src/agent/notification-hub.ts)
  - [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
  - [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)

## Conn Worker Parallelism

- `ConnWorker.tick()` 现在会先 claim 多条 due run，再并行执行，`maxConcurrency` 不再是名义参数。
- 本地与生产 compose 默认给 `ugk-pi-conn-worker` 注入 `CONN_WORKER_MAX_CONCURRENCY=${CONN_WORKER_MAX_CONCURRENCY:-3}`，单个 worker 容器默认可同时处理 3 条后台任务。
- 这条并发能力依然是“单 worker 进程内并发”；如果后续要扩成多 worker 副本，还需要补 lease heartbeat / 超时回收策略，避免超长任务被别的 worker 重领。

## Conn Run Heartbeat

- 运行中的 conn run 现在会由 worker 周期性刷新 `updatedAt` 和 `leaseUntil`，不再长时间停在 claim 那一刻的时间戳上装死。
- heartbeat 只允许当前 `leaseOwner` 续租，避免别的 worker 抢跑后把 lease 写乱。
- 默认 heartbeat 间隔会按 lease 自动推导；显式传入的 heartbeat 间隔会被原样尊重，便于测试和后续调参。

## Stale Run Recovery

- worker 每次 tick 开头都会先扫描 `lease_until <= now` 的 `running` run，并将它们标记为失败，而不是静默重领继续跑。
- stale run 会追加 `run_stale` 事件，保留原 lease 信息和回收时间，方便之后排查为什么被判死。
- 这样做的取舍是：宁可把可疑 run 清晰标错，也不把同一份后台任务在不确定状态下偷偷重跑成“双份结果”。

## Conn Run Detail Lease Visibility

- `GET /v1/conns/:connId/runs/:runId` 现在会把 `leaseOwner` 和 `leaseUntil` 一起返回给前台，不再只暴露结果摘要。
- `playground` 的“查看后台任务过程”弹层会额外展示 `claimed / started / updated / lease owner / lease until`，并给 `running` run 计算一个人能看懂的 health 文案：
  - `running / lease active`
  - `running / stale suspected`
  - 以及非运行态直接回显真实 `status`
- 这层展示的目标不是替代事件日志，而是让用户第一眼就知道后台任务到底还活着、已经结束，还是 lease 看起来已经悬了。

## Conn Max Runtime

- `conn` 现在支持可选字段 `maxRunMs`，用于限制单次后台 run 的最长执行时间。
- 创建或更新 `conn` 时可以通过 `POST /v1/conns` / `PATCH /v1/conns/:connId` 传入正数毫秒值；未设置时保持原先不设上限的行为。
- worker 会在执行期为设置了 `maxRunMs` 的任务挂一条真实超时闸门；一旦超时：
  - 先写入 `run_timed_out` 事件
  - 再中止后台 session
  - 最终把 run 标记为 `failed`
- 超时失败也会写入目标 conversation 的 notification，并通过实时广播推给在线 playground；通知标题使用 `<conn title> failed`，正文优先展示 `errorText`。
- 这条超时约束是运行期硬约束，不只是前端显示字段；对应 run detail / events 可以直接看到超时留痕。
 
## Conn Playground 管理入口

- `playground` 现在有可视化后台任务管理面：桌面端首页右侧 `后台任务`，手机端右上角更多菜单里的 `后台任务`。
- 管理面只复用现有后端 API，不改变调度模型：
  - `GET /v1/conns` 读取 conn 列表
  - `POST /v1/conns` 创建 conn
  - `PATCH /v1/conns/:connId` 更新 conn
  - `GET /v1/conns/:connId/runs` 读取最近 run
  - `POST /v1/conns/:connId/run` 手动入队一次 run
  - `POST /v1/conns/:connId/pause` 暂停调度
  - `POST /v1/conns/:connId/resume` 恢复调度
  - `DELETE /v1/conns/:connId` 删除 conn
  - `POST /v1/conns/bulk-delete` 批量删除 conn，入参是去重后的 `connIds`
- `POST /v1/conns` 与 `PATCH /v1/conns/:connId` 现在共用同一套 payload 解析逻辑：创建时统一 trim 文本并按当前服务端会话补默认 `target`；编辑时如果显式传入 `title` 或 `prompt`，则必须是去空白后仍非空的字符串，不再把空白值默默吞掉。
- 当前删除是硬删除：`conns` 删除后会通过外键级联删除该 conn 的 run / event / file 记录；`ConnSqliteStore` 也会主动清理 `source=conn` 且 `source_id=<connId>` 的 conversation notification 和全局 activity，避免测试任务删掉后还在活动流里留下点不开的脏引用。这个入口主要用于清测试任务，正式任务要归档时别拿它冒充软删除。
- 保存成功后，管理面会保留一条状态提示并高亮对应 conn；最近 run 历史默认折叠，只展示最新状态摘要，需要排障时再展开。
- 管理面现在有状态筛选、选择当前、清空选择和删除所选，用来批量清掉测试 conn；单个正式任务仍建议先暂停确认，再决定是否硬删。
- 前台 agent 正在运行时，管理面仍可打开和操作；这是刻意保留的解耦行为。conn worker 是否执行、执行到哪里，仍以 SQLite run 状态和 worker 日志为准。
- 从管理面点 `查看` 会复用 `conn` run 详情弹层，请求 `GET /v1/conns/:connId/runs/:runId` 和 `/events`，用于追溯 workspace、结果、文件和事件。

## Agent Activity Timeline

- `agent_activity_items` 是跨会话的全局活动读模型，不替代 conversation transcript。别把主聊天流硬改成“全局伪对话”，那是把上下文和观察层搅成一锅，后面一定会炸。
- `conn-worker` 对所有终态 conn run 都会 best-effort 写入一条 `agent_activity_items`；如果目标是 conversation，才额外写入目标 `conversation_notifications`。成功、失败和超时结果都会进入全局活动。
- activity item 保留 `source / sourceId / runId / conversationId / title / text / files / createdAt / readAt`。其中 `source=conn` 且带有 `sourceId + runId` 的条目可以继续打开原有 conn run detail。
- API：
  - `GET /v1/activity?limit=50`：按时间倒序读取全局活动，支持 `limit`、`conversationId`、`before`。
  - `POST /v1/activity/:activityId/read`：标记活动已读。
- `playground` 桌面端首页右侧新增 `全局活动`，手机端更多菜单新增 `全局活动`。打开后读取 `/v1/activity?limit=50`，并从条目跳转到已有的后台任务过程弹层。
- 实时广播到达时，页面会刷新 activity 列表；即便当前会话不是 conn 的目标会话，也能在全局活动里看到结果。在线 toast 仍只是提醒层，真实记录以 SQLite activity 表为准。
- 关键入口：
  - [src/agent/agent-activity-store.ts](/E:/AII/ugk-pi/src/agent/agent-activity-store.ts)
  - [src/agent/background-agent-runner.ts](/E:/AII/ugk-pi/src/agent/background-agent-runner.ts)
  - [src/routes/activity.ts](/E:/AII/ugk-pi/src/routes/activity.ts)
  - [src/workers/conn-worker.ts](/E:/AII/ugk-pi/src/workers/conn-worker.ts)
  - [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
  - [src/ui/playground-conn-activity.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity.ts)
  - [src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)
  - [test/agent-activity-store.test.ts](/E:/AII/ugk-pi/test/agent-activity-store.test.ts)
  - [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
