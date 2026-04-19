# Runtime / Assets / Conn / Feishu

更新时间：`2026-04-19`

## 这份文档管什么

这份文档只追踪四类运行能力：

- 文件上传与统一资产库
- `assetRefs` 与 `ugk-file`
- `conn` 定时 / 周期任务
- 飞书 webhook 接入

如果你要查 playground 视觉和交互，不要在这里翻半天，去看 [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)。

## 1. 统一资产体系

当前项目已经不再把“上传文件”和“agent 产出文件”分成两套散装逻辑，而是统一进入 `AssetStore`。

关键事实：

- 上传文件会根据类型和体积进入 `attachments.text`、`attachments.base64` 或仅保留元数据
- agent 回复中的 ````ugk-file```` fenced block 也会被提取进资产库
- 最近资产可通过 `GET /v1/assets` 查询
- 资产可通过 `assetId` 在后续请求中复用
- 前端会把“待发送文件 / 复用资产 / 已发送附件 / 已发送引用资产”统一渲染为 chip 风格

关键文件：

- [src/agent/asset-store.ts](/E:/AII/ugk-pi/src/agent/asset-store.ts)
- [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
- [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
- [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)

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

## 4. `conn` 调度能力

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

## 5. 飞书接入

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

## 6. 数据布局

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

## 7. 当前限制

- 飞书侧当前优先处理文本消息；文件 / 图片消息仍以元数据和链接为主
- `conn` 当前是单进程内调度，重启后能恢复索引，但不适合多实例抢占执行
- 资产复用的真相以 `GET /v1/assets` 和实际资产索引为准，不要靠模型脑补
