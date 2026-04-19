# 追溯地图

这份文档只回答一个问题：

“我现在碰到某类问题，先看哪几个文件最省命？”

## A. 快速接手项目

先看：

1. [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
2. [README.md](/E:/AII/ugk-pi/README.md)
3. [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)
4. [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
5. [src/server.ts](/E:/AII/ugk-pi/src/server.ts)
6. [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
7. [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
8. [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)

当前阶段先记住这句话：`web-access` 默认是 Docker Chrome sidecar，不是 Windows 宿主 IPC。后续看到 `requestHostBrowser()` 这个名字别被它骗了，它在 `direct_cdp` 模式下会直接连 sidecar。

如果是云端 `/init`，再记一句：

- 服务器 `~/ugk-pi-claw` 不是 Git 仓库，是 tar 解包目录；本机打包，服务器部署。

## B. 聊天、流式、追加消息、打断

先看：

1. [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
2. [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
3. [src/agent/agent-session-factory.ts](/E:/AII/ugk-pi/src/agent/agent-session-factory.ts)
4. [src/types/api.ts](/E:/AII/ugk-pi/src/types/api.ts)

重点接口：

- `GET /v1/chat/status`
- `GET /v1/chat/events`
- `POST /v1/chat`
- `POST /v1/chat/stream`
- `POST /v1/chat/queue`
- `POST /v1/chat/interrupt`

## C. Playground 页面、消息气泡、过程区

先看：

1. [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
2. [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
3. [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

适用问题：

- 助手/用户消息样式
- 过程区与 loading 气泡
- 文件卡片“打开 / 下载”
- 刷新后运行态恢复

## D. 文件上传、资产复用、send_file、本地报告访问

先看：

1. [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
2. [src/routes/static.ts](/E:/AII/ugk-pi/src/routes/static.ts)
3. [src/agent/asset-store.ts](/E:/AII/ugk-pi/src/agent/asset-store.ts)
4. [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
5. [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
6. [.pi/extensions/send-file.ts](/E:/AII/ugk-pi/.pi/extensions/send-file.ts)
7. [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

适用问题：

- `send_file` 没出现在文件卡片里
- 图片/报告下载 0B
- 用户拿到的是容器 `file:///app/...`
- HTML / 图片已经生成，但浏览器打不开
- `/v1/local-file?path=...` 返回异常

如果问题是“agent 内部想继续用 `file:///app/...`，但用户看到的地址必须能打开”，重点看：

- [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
- [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)

## E. 技能加载、真实技能清单、web-access

先看：

1. `GET /v1/debug/skills`
2. [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
3. [.pi/skills](/E:/AII/ugk-pi/.pi/skills)
4. [runtime/skills-user](/E:/AII/ugk-pi/runtime/skills-user)
5. [docs/web-access-browser-bridge.md](/E:/AII/ugk-pi/docs/web-access-browser-bridge.md)

如果问题跟以下内容有关，直接进 web-access 专题文档，不要在别的地方绕：

- host browser bridge
- Docker Chrome sidecar
- `WEB_ACCESS_BROWSER_PROVIDER=direct_cdp`
- `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL`
- Chrome 持久 profile
- `local_browser_executable_not_found`
- `chrome_cdp_unreachable`
- `/x-search-latest:*`
- X 登录态

## F. Subagent、项目级 prompt、防护

先看：

1. [.pi/extensions/subagent/index.ts](/E:/AII/ugk-pi/.pi/extensions/subagent/index.ts)
2. [.pi/extensions/subagent/agents.ts](/E:/AII/ugk-pi/.pi/extensions/subagent/agents.ts)
3. [.pi/extensions/project-guard.ts](/E:/AII/ugk-pi/.pi/extensions/project-guard.ts)
4. [.pi/agents](/E:/AII/ugk-pi/.pi/agents)
5. [runtime/agents-user](/E:/AII/ugk-pi/runtime/agents-user)
6. [.pi/prompts](/E:/AII/ugk-pi/.pi/prompts)

## G. Conn / Feishu 集成

先看：

1. [src/routes/conns.ts](/E:/AII/ugk-pi/src/routes/conns.ts)
2. [src/routes/feishu.ts](/E:/AII/ugk-pi/src/routes/feishu.ts)
3. [src/agent/conn-store.ts](/E:/AII/ugk-pi/src/agent/conn-store.ts)
4. [src/agent/conn-scheduler.ts](/E:/AII/ugk-pi/src/agent/conn-scheduler.ts)
5. [src/agent/conn-runner.ts](/E:/AII/ugk-pi/src/agent/conn-runner.ts)
6. [src/integrations/feishu/service.ts](/E:/AII/ugk-pi/src/integrations/feishu/service.ts)
7. [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

## H. 容器、部署、健康检查、截图

先看：

1. [Dockerfile](/E:/AII/ugk-pi/Dockerfile)
2. [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
3. [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
4. [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
5. [src/server.ts](/E:/AII/ugk-pi/src/server.ts)
6. [src/routes/static.ts](/E:/AII/ugk-pi/src/routes/static.ts)
7. [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
8. [runtime/screenshot.mjs](/E:/AII/ugk-pi/runtime/screenshot.mjs)
9. [runtime/screenshot-mobile.mjs](/E:/AII/ugk-pi/runtime/screenshot-mobile.mjs)

适用问题：

- `healthz` 不通
- 腾讯云新加坡服务器更新部署、回滚或 SSH tunnel 不通
- 静态 HTML / PNG 路由不通
- 截图脚本又回退到 `file://`
- `PUBLIC_BASE_URL` 不对
- sidecar Chrome 打开本地 HTML 时访问到 `127.0.0.1:3000` 造成 404
- `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL` 没有指向 `http://ugk-pi:3000`
