# 当前交接快照

更新时间：`2026-05-13`

这份文档给新接手 `ugk-pi / UGK CLAW` 的同事或 coding agent 看。先读这里，再按任务类型展开其他文档。不要靠聊天记录拼现状，聊天记录容易把历史事实和当前事实搅成一锅。

## 给新接手者的第一条消息

可以直接把下面这段发给同事：

```text
请接手 `E:\AII\ugk-pi`。你维护的是 ugk-pi 代码仓库，不是产品运行时 Playground agent。

开始前先读 `AGENTS.md`、`docs/handoff-current.md`、`docs/traceability-map.md`。如果要跑本地，只用 Docker：`docker compose up -d` 或 `docker compose restart ugk-pi`，标准入口是 `http://127.0.0.1:3000/playground`，健康检查是 `http://127.0.0.1:3000/healthz`。不要把宿主机 `npm start` / `npm run dev` 当正规入口。

开始前执行 `git status --short` 和 `git log -1 --oneline`。当前稳定交接点是 `d7bcb4d Show runtime summary and sort conn tasks`，`origin/main` 和 `gitee/main` 均已同步，腾讯云和阿里云均已完成增量部署并通过 verify。

服务器发布默认走增量更新。腾讯云拉 GitHub `origin/main`，阿里云拉 Gitee `gitee/main`。不要整目录覆盖，不要删除 shared 运行态，不要提交 `.env`、`.data/`、Chrome profile、runtime 临时产物或本地截图。
```

## 当前状态

- 当前本地 HEAD：`d7bcb4d Show runtime summary and sort conn tasks`
- 当前 `origin/main`：已同步到 `d7bcb4d`
- 当前 `gitee/main`：已同步到 `d7bcb4d`
- 当前本地工作区：交接前检查为干净
- 当前稳定 tag：已有 `snapshot-20260513-v4.5.0-stable`，但最新交接提交在该 tag 之后
- 本轮最新功能：
  - `/playground/conn` 任务列表按最近完成任务时间倒序
  - Playground 左侧会话列表底部展示当前 API 源 / 模型与 Chrome
  - 独立 Conn / Agents 页面 cockpit UI 与相关测试稳定化
  - Agent profile 路由边界、artifact 路由归属校验和架构治理收口

## 生产部署状态

腾讯云：

- Playground：`http://43.156.19.100:3000/playground`
- Health：`http://43.156.19.100:3000/healthz`
- 主部署目录：`/home/ubuntu/ugk-claw-repo`
- shared 运行态：`/home/ubuntu/ugk-claw-shared`
- 更新方式：`npm run server:ops -- tencent preflight|deploy|verify`
- 当前已增量更新到：`d7bcb4d`
- 最近验收：`npm run server:ops -- tencent verify` 通过，公网 `/playground` 已确认包含运行汇总 UI，`/playground/conn` 已确认包含最近完成时间排序逻辑

阿里云：

- Playground：`http://101.37.209.54:3000/playground`
- Health：`http://101.37.209.54:3000/healthz`
- 主部署目录：`/root/ugk-claw-repo`
- shared 运行态：`/root/ugk-claw-shared`
- 更新方式：`npm run server:ops -- aliyun preflight|deploy|verify`
- 当前已增量更新到：`d7bcb4d`
- 最近验收：`npm run server:ops -- aliyun verify` 通过，公网 `/playground` 已确认包含运行汇总 UI，`/playground/conn` 已确认包含最近完成时间排序逻辑

发布禁区：

- 不要 `git reset --hard`
- 不要整目录覆盖服务器仓库
- 不要删除或重建 shared 运行态
- 不要执行 `docker compose down -v`
- 不要把本地 Chrome profile 复制到服务器
- 不要提交 `.env`、token、cookie、`.data/`、部署包、runtime 临时文件

## 最小阅读顺序

普通 bugfix / 小功能：

1. `AGENTS.md`
2. `docs/handoff-current.md`
3. `docs/traceability-map.md`
4. 按模块读下面对应文档

Playground / UI：

1. `docs/playground-current.md`
2. `DESIGN.md`
3. `src/ui/playground.ts`
4. `src/ui/playground-page-shell.ts`
5. `src/ui/playground-styles.ts`

Conn / 后台任务 / artifact：

1. `docs/runtime-assets-conn-feishu.md`
2. `src/routes/conns.ts`
3. `src/routes/conn-route-presenters.ts`
4. `src/agent/conn-run-store.ts`
5. `src/workers/conn-worker.ts`

Agent profile / Agents 页面：

1. `src/routes/agent-profiles.ts`
2. `src/agent/agent-profile-catalog.ts`
3. `src/ui/agents-page.ts`
4. `src/ui/playground-agent-manager.ts`

本地 Docker / 端口 / 运行态：

1. `docs/docker-local-ops.md`
2. `docker-compose.yml`
3. `src/routes/runtime-debug.ts`

服务器发布：

1. `docs/server-ops.md`
2. `docs/server-ops-quick-reference.md`
3. `docs/tencent-cloud-singapore-deploy.md`
4. `docs/aliyun-ecs-deploy.md`

## 当前关键事实

- 本地固定入口：`http://127.0.0.1:3000/playground`
- 本地健康检查：`http://127.0.0.1:3000/healthz`
- 默认本地启动：`docker compose up -d`
- 常规代码改动后优先：`docker compose restart ugk-pi`
- 涉及 Dockerfile、系统依赖或 compose 结构时才 `up --build -d`
- 双云默认发布方式是增量更新，腾讯云拉 `origin/main`，阿里云拉 `gitee/main`
- Agent profile 运行时列表以 `GET /v1/agents` 为准
- 不要手写 `.data/agents/profiles.json` 来创建、归档或修复 Agent
- `conn` 后台任务产物标准出口是 workspace 的 `output/` 与 `artifact-public/`
- Chrome sidecar 登录态在 shared 运行态目录，不能被部署流程洗掉

## 最近验证记录

本轮本地与发布过程中已执行或确认：

- `git status --short`：交接前干净
- `git diff --check`：通过
- `npx tsc --noEmit`：通过
- `npm test`：近期全量测试通过
- `npm run server:ops -- tencent preflight`
- `npm run server:ops -- tencent deploy`
- `npm run server:ops -- tencent verify`
- `npm run server:ops -- aliyun preflight`
- `npm run server:ops -- aliyun deploy`
- `npm run server:ops -- aliyun verify`
- 腾讯云 / 阿里云公网 `/playground` 页面均确认包含 `runtime-summary`
- 腾讯云 / 阿里云公网 `/playground/conn` 页面均确认包含最近完成时间排序逻辑

如果新同事继续开发，不要只看字符串就宣称修复完成。改接口跑接口，改 UI 看真实页面，改部署跑 `preflight/deploy/verify`，这点别省，省了后面就会用线上事故补课。

## 交接给人的操作清单

需要给同事准备：

- GitHub 仓库权限：`https://github.com/mhgd3250905/ugk-claw-personal.git`
- Gitee 仓库权限：用于阿里云默认拉取 `gitee/main`
- 腾讯云 SSH 权限：`ugk-claw-prod` 或 `ubuntu@43.156.19.100`
- 阿里云 SSH 权限：`root@101.37.209.54`
- 服务器 shared 运行态说明：只能保护，不能覆盖
- 本地 `.env` 获取渠道：不要通过 Git 传
- Chrome sidecar 登录态维护方式：通过 sidecar GUI / SSH tunnel，不开放公网 `3901`

## 暂时不要做

- 不要继续无目标拆 `AgentService`；当前结构已经按可测边界拆过一轮，继续硬拆只会制造维护成本
- 不要把手机端 Playground 当桌面端压缩版改
- 不要把 Feishu 当当前主线推进，除非用户重新明确要求
- 不要动 `references/pi-mono/`，那是参考镜像，不是业务源码
- 不要把 `.data/`、`.env`、runtime 临时产物、截图报告、部署包提交进仓库

## 推荐下一步

新同事接手后的第一步不是写代码，而是做三件小事：

1. `git status --short`
2. `git log -1 --oneline`
3. 打开本地或服务器 `/healthz` 和 `/playground` 确认环境是真活的

确认完再动代码。先把地基摸清楚，别一上来就“优化一下”，这个项目已经吃过这种亏。
