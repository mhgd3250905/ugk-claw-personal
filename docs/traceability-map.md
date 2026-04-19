# 追溯地图

这份文档不讲大道理，只回答一个问题：

“我现在碰到某类问题，先看哪几个文件最省命？”

## A 场景：我刚接手项目，想快速建立全貌

建议顺序：

1. [README.md](/E:/AII/ugk-pi/README.md)
2. [src/server.ts](/E:/AII/ugk-pi/src/server.ts)
3. [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
4. [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
5. [src/agent/agent-session-factory.ts](/E:/AII/ugk-pi/src/agent/agent-session-factory.ts)
6. [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)

看完这几处，至少不会再把它误认成一个普通聊天前端。

## B 场景：我要查聊天接口、流式输出、追加消息、打断

先看：

1. [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
2. [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
3. [src/agent/agent-session-factory.ts](/E:/AII/ugk-pi/src/agent/agent-session-factory.ts)
4. [src/types/api.ts](/E:/AII/ugk-pi/src/types/api.ts)

重点问题：

- `GET /v1/chat/status`
- `GET /v1/chat/events`
- `POST /v1/chat`
- `POST /v1/chat/stream`
- `POST /v1/chat/queue`
- `POST /v1/chat/interrupt`
- `steer` / `followUp` 的实际走向
- 刷新后 active run 的真实状态映射、事件缓冲和重新订阅

## C 场景：我要查 playground 的视觉、交互和前端状态

先看：

1. [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
2. [test/server.test.ts](/E:/AII/ugk-pi/test/server.test.ts)
3. [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

这里统一覆盖：

- 品牌字标
- landing 与 transcript 状态切换
- 用户 / 助手 / 系统消息样式
- “思考过程”区域
- 文件 chip
- 选择资产
- “查看技能”按钮链路
- 刷新后恢复“当前正在运行”的 loading 气泡、过程日志和 `/v1/chat/events` 重连

## D 场景：我要查文件上传、资产复用、下载文件

先看：

1. [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
2. [src/agent/asset-store.ts](/E:/AII/ugk-pi/src/agent/asset-store.ts)
3. [src/agent/file-artifacts.ts](/E:/AII/ugk-pi/src/agent/file-artifacts.ts)
4. [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

如果是前端展示问题，再补看：

5. [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)

## E 场景：我要查技能系统、技能清单、用户技能

先看真实事实源：

1. `GET /v1/debug/skills`

再看代码和目录：

2. [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
3. [.pi/skills](/E:/AII/ugk-pi/.pi/skills)
4. [runtime/skills-user](/E:/AII/ugk-pi/runtime/skills-user)
5. [src/agent/agent-session-factory.ts](/E:/AII/ugk-pi/src/agent/agent-session-factory.ts)

## F 场景：我要查 subagent、prompt 工作流、项目防护

先看：

1. [.pi/extensions/subagent/index.ts](/E:/AII/ugk-pi/.pi/extensions/subagent/index.ts)
2. [.pi/extensions/subagent/agents.ts](/E:/AII/ugk-pi/.pi/extensions/subagent/agents.ts)
3. [.pi/extensions/project-guard.ts](/E:/AII/ugk-pi/.pi/extensions/project-guard.ts)
4. [.pi/agents](/E:/AII/ugk-pi/.pi/agents)
5. [runtime/agents-user](/E:/AII/ugk-pi/runtime/agents-user)
6. [.pi/prompts](/E:/AII/ugk-pi/.pi/prompts)

## G 场景：我要查 conn 和飞书接入

先看：

1. [src/routes/conns.ts](/E:/AII/ugk-pi/src/routes/conns.ts)
2. [src/routes/feishu.ts](/E:/AII/ugk-pi/src/routes/feishu.ts)
3. [src/agent/conn-store.ts](/E:/AII/ugk-pi/src/agent/conn-store.ts)
4. [src/agent/conn-scheduler.ts](/E:/AII/ugk-pi/src/agent/conn-scheduler.ts)
5. [src/agent/conn-runner.ts](/E:/AII/ugk-pi/src/agent/conn-runner.ts)
6. [src/integrations/feishu/service.ts](/E:/AII/ugk-pi/src/integrations/feishu/service.ts)
7. [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

## H 场景：我要查容器、部署、健康检查

先看：

1. [Dockerfile](/E:/AII/ugk-pi/Dockerfile)
2. [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
3. [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
4. [deploy/nginx/default.conf](/E:/AII/ugk-pi/deploy/nginx/default.conf)
5. [scripts/docker-health.mjs](/E:/AII/ugk-pi/scripts/docker-health.mjs)

如果碰到容器里 `curl` 不存在这种低级环境锅，先看 [Dockerfile](/E:/AII/ugk-pi/Dockerfile) 里的基础工具安装，不要先怀疑人生。
