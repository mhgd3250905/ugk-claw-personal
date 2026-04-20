# Runtime / Assets / Conn / Feishu

更新时间：`2026-04-19`

这份文档只讲四类运行能力：

- 文件上传与统一资产库
- `assetRefs`、`ugk-file`、`send_file`
- `conn` 定时 / 周期任务
- Feishu webhook 接入

如果你要查 playground 视觉和交互，去看 [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)。

## 1. 统一资产体系

当前项目不再把“用户上传文件”和“agent 产出文件”拆成两套逻辑，而是统一进入 `AssetStore`。

关键事实：

- 用户上传文件会注册为资产，可被后续 `assetRefs` 复用
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
- 强制下载使用 `?download=1`
- 中文文件名通过 `filename` + `filename*` 处理

playground 卡片当前规则：

- 图片 / PDF / txt / md / json / csv 这类有“打开”
- 所有文件都有“下载”

## 6. `conn`

当前支持：

- `once`
- `interval`
- `cron`

关键入口：

- [src/agent/conn-store.ts](/E:/AII/ugk-pi/src/agent/conn-store.ts)
- [src/agent/conn-scheduler.ts](/E:/AII/ugk-pi/src/agent/conn-scheduler.ts)
- [src/agent/conn-runner.ts](/E:/AII/ugk-pi/src/agent/conn-runner.ts)
- [src/routes/conns.ts](/E:/AII/ugk-pi/src/routes/conns.ts)

## 7. Feishu

当前入口：

- `POST /v1/integrations/feishu/events`

已接通：

- `url_verification`
- `im.message.receive_v1`
- Feishu 会话与本地 `conversationId` 映射

关键入口：

- [src/routes/feishu.ts](/E:/AII/ugk-pi/src/routes/feishu.ts)
- [src/integrations/feishu/service.ts](/E:/AII/ugk-pi/src/integrations/feishu/service.ts)
- [src/integrations/feishu/client.ts](/E:/AII/ugk-pi/src/integrations/feishu/client.ts)

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
