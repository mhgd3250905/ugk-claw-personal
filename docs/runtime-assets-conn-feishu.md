# Runtime / Assets / Conn / Feishu

更新时间：`2026-04-19`

## 这份文档管什么

这份文档只追踪四类运行能力：

- 文件上传与统一资产库
- `assetRefs`、`ugk-file` 与 `send_file`
- `conn` 定时 / 周期任务
- 飞书 webhook 接入

如果你要查 playground 视觉和交互，不要在这里翻半天，去看 [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)。

## 1. 统一资产体系

当前项目已经不再把“上传文件”和“agent 产出文件”分成两套散装逻辑，而是统一进入 `AssetStore`。

关键事实：

- 上传文件会根据类型和体积进入 `attachments.text`、`attachments.base64` 或仅保留元数据
- agent 回复中的 ````ugk-file```` fenced block 也会被提取进资产库
- agent 主动交付本地生成文件时，应优先调用项目级 `send_file` 工具，不要把 base64 或 ````ugk-file```` 原始块直接刷到聊天正文里
- 最近资产可通过 `GET /v1/assets` 查询
- agent 每轮 prompt 都会由 `src/agent/file-artifacts.ts` 注入文件交付协议：浏览器预览统一回 `http://127.0.0.1:3000/...` 或 `/runtime/...`，直接文件交付优先 `send_file`，不要再把 `file:///app/...` 回给用户
- 资产可通过 `assetId` 在后续请求中复用
- 前端会把“待发送文件 / 复用资产 / 已发送附件 / 已发送引用资产”统一渲染为 chip 风格

关键文件：

- [src/agent/asset-store.ts](/E:/AII/ugk-pi/src/agent/asset-store.ts)
- [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
- [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
- [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
- [.pi/extensions/send-file.ts](/E:/AII/ugk-pi/.pi/extensions/send-file.ts)

## 2. 请求体约定

聊天相关请求支持：

```json
{
  "message": "继续处理",
  "attachments": [
    {
      "fileName": "notes.txt",
      "mimeType": "text/plain",
      "sizeBytes": 11,
      "text": "hello file"
    }
  ],
  "assetRefs": ["asset-id"]
}
```

二进制附件可选：

```json
{
  "fileName": "diagram.png",
  "mimeType": "image/png",
  "sizeBytes": 12345,
  "base64": "...."
}
```

前端当前行为：

- 选择文件后，不会再自动往输入框注入文件清单文本
- 不会再额外显示“文件已载入 / 待发送附件”这类噪音提示
- 如果用户什么字都没写、只发复用资产，消息气泡里只展示资产 chip，不会自动补“请结合我引用的资产一起处理”这种废话

## 3. `ugk-file` 协议

agent 可以通过下面这种 fenced block 输出文件：

````text
```ugk-file name="result.md" mime="text/markdown"
# hello
```
````

后端会：

- 提取正文
- 写入统一资产库
- 生成可下载文件索引
- 暴露 `GET /v1/files/:fileId`

## 4. `send_file` 文件发送工具

`send_file` 是项目级扩展工具，用来把 agent 已经在项目目录内生成好的文件注册进统一资产库，并在最终聊天结果里返回 `files`，让 playground 渲染成下载卡片。

使用场景：

- 用户明确要求“把文件发给我”“给我图片 / 报告 / 附件”
- agent 已经生成了本地文件，例如 `public/report.png`、`runtime/report.md`
- 文件内容不适合塞进聊天正文，尤其是图片、PDF、压缩包或大文本

数据流：

1. agent 调用 `.pi/extensions/send-file.ts` 的 `send_file`
2. 工具校验 `path` 必须位于项目根目录内，拒绝路径穿越和项目外文件
3. 工具读取文件 Buffer，通过 `AssetStore.saveFileBuffers()` 写入 `.data/agent/assets/blobs`
4. 工具返回 `details.file`
5. `AgentService` 从 `tool_execution_end` 中提取 `send_file` 的 `details.file`，合并进最终 `done.files`
6. playground 使用既有文件下载卡片展示 `GET /v1/files/:fileId`

关键约束：

- 不要让 agent 再执行 `cat file | base64` 这类操作，聊天框不是文件传输层。
- `send_file.path` 只允许项目根目录内路径；宿主机任意路径、用户私密目录、容器外路径都不会被发送。
- `ugk-file` 仍保留为文本协议兜底，但正式发送本地文件时优先使用 `send_file`。

关键文件：

- [.pi/extensions/send-file.ts](/E:/AII/ugk-pi/.pi/extensions/send-file.ts)
- [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
- [src/agent/asset-store.ts](/E:/AII/ugk-pi/src/agent/asset-store.ts)
- [test/send-file-extension.test.ts](/E:/AII/ugk-pi/test/send-file-extension.test.ts)
- [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)

## 5. `conn` 调度能力

当前已支持 `once`、`interval`、`cron` 三种调度方式。

关键能力：

- `create`
- `list`
- `get`
- `update`
- `pause`
- `resume`
- `delete`
- `run_now`

服务启动后会常驻 `ConnScheduler` 轮询到期任务，并由 `ConnRunner` 复用 `AgentService` 执行实际任务。

关键文件：

- [src/agent/conn-store.ts](/E:/AII/ugk-pi/src/agent/conn-store.ts)
- [src/agent/conn-scheduler.ts](/E:/AII/ugk-pi/src/agent/conn-scheduler.ts)
- [src/agent/conn-runner.ts](/E:/AII/ugk-pi/src/agent/conn-runner.ts)
- [src/routes/conns.ts](/E:/AII/ugk-pi/src/routes/conns.ts)
- [.pi/extensions/conn/index.ts](/E:/AII/ugk-pi/.pi/extensions/conn/index.ts)

接口：

- `GET /v1/conns`
- `GET /v1/conns/:connId`
- `POST /v1/conns`
- `PATCH /v1/conns/:connId`
- `POST /v1/conns/:connId/pause`
- `POST /v1/conns/:connId/resume`
- `POST /v1/conns/:connId/run`
- `DELETE /v1/conns/:connId`

## 6. 飞书接入

当前飞书入口：

- `POST /v1/integrations/feishu/events`

已支持：

- `url_verification`
- `im.message.receive_v1`
- 飞书会话到本地 `conversationId` 的映射
- 运行中消息默认走 `steer`
- agent 结果通过飞书消息回发

关键文件：

- [src/routes/feishu.ts](/E:/AII/ugk-pi/src/routes/feishu.ts)
- [src/integrations/feishu/client.ts](/E:/AII/ugk-pi/src/integrations/feishu/client.ts)
- [src/integrations/feishu/service.ts](/E:/AII/ugk-pi/src/integrations/feishu/service.ts)
- [src/integrations/feishu/conversation-map-store.ts](/E:/AII/ugk-pi/src/integrations/feishu/conversation-map-store.ts)

环境变量：

- `PUBLIC_BASE_URL`
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_API_BASE`

## 7. 数据布局

```text
.data/agent/
├─ asset-index.json
├─ assets/
│  └─ blobs/
├─ conn/
│  └─ conn-index.json
└─ feishu/
   └─ conversation-map.json
```

## 8. 当前限制

- 飞书侧当前优先处理文本消息；文件 / 图片消息仍以元数据和链接为主
- `conn` 当前是单进程内调度，重启后能恢复索引，但不适合多实例抢占执行
- 资产复用的真相以 `GET /v1/assets` 和实际资产索引为准，不要靠模型脑补
