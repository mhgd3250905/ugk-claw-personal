# 当前交接总览

这份文档给接手 `ugk-pi / UGK CLAW` 的人一个当前态入口。

别再用聊天记录、零散提交和模糊记忆拼项目状态了。那种接手方式看上去努力，实际效率低得感人。

## 当前结论

- 代码主仓库：`https://github.com/mhgd3250905/ugk-claw-personal.git`
- 主分支：`main`
- 当前本地最新提交：以 GitHub `main` 最新 `HEAD` 为准；服务器运行代码当前对应 `b896f05 fix: consolidate playground conversation view state`
- 版本关系：GitHub `main` 可能包含部署后的文档记录提交；不要把“文档记录提交晚于服务器运行代码”误判成线上漏发
- 当前推荐稳定发布 tag：`snapshot-20260422-v4.1.2-stable`
- 当前服务器已增量更新到：`b896f05b303bdb210073743e83ee1c74a14c19b4`
- 当前公网入口：`http://43.134.167.179:3000/playground`
- 当前健康检查：`http://43.134.167.179:3000/healthz`

## 交接时直接复制这一段

接手 `ugk-pi / UGK CLAW` 时，先按这个口径理解项目：

- 这是基于 `pi-coding-agent` 的自定义 HTTP agent 原型，当前重点是稳定 agent runtime、多会话、流式、playground、conn / activity、web-access Docker Chrome sidecar，以及飞书 / Slack / 企业微信这类 IM 接入预留；不要把它当完整业务平台乱扩。
- 当前生产入口是 `http://43.134.167.179:3000/playground`，健康检查是 `http://43.134.167.179:3000/healthz`。
- 服务器代码目录是 `~/ugk-claw-repo`，shared 运行态目录是 `~/ugk-claw-shared`；不要去旧目录 `~/ugk-pi-claw` 更新。
- 当前线上运行代码是 `b896f05b303bdb210073743e83ee1c74a14c19b4`；GitHub `main` 后面可能还有文档提交，属于交接记录，不代表线上运行代码缺失。
- 当前推荐稳定发布 tag 是 `snapshot-20260422-v4.1.2-stable`；不要再拿 `snapshot-20260422-v4.1.1-stable` 当部署基线。
- 最近一次服务器发布前回滚 tag 是 `server-pre-deploy-20260423-113909`。
- 最近一次 sidecar 登录态备份是 `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260423-113909.tar.gz`。

接手后第一小时不要上来就全仓乱翻，按顺序看：

1. [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
2. [README.md](/E:/AII/ugk-pi/README.md)
3. 本文档
4. [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
5. [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
6. [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
7. 如果改 `playground`，再看 [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md) 和 [docs/playground-runtime-refactor-summary-2026-04-22.md](/E:/AII/ugk-pi/docs/playground-runtime-refactor-summary-2026-04-22.md)

## 接手当天核验清单

先确认事实，再动代码。别凭感觉，凭感觉交接是事故的温床。

本地至少看：

```bash
git status --short
git rev-parse HEAD
npm test
docker compose -f docker-compose.prod.yml config
```

服务器至少看：

```bash
ssh ugk-claw-prod
cd ~/ugk-claw-repo
git status --short
git rev-parse HEAD
curl -fsS http://127.0.0.1:3000/healthz
curl -I http://127.0.0.1:3000/playground
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml ps
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi node /app/runtime/skills-user/web-access/scripts/check-deps.mjs
```

如果要核验本轮会话修复，再打开 playground 实测：

- 旧会话继续对话时，agent 不应失忆，上下文统计不应从零开始。
- 刷新恢复已结束任务时，不应出现“问题 / 回答 / 问题 / 回答”重复块。
- 连续发送相同文本，例如“继续”，当前输入不应被上一轮同文本吞掉。
- `GET /v1/chat/state` 应带 `viewMessages`，前端只负责渲染，不要再把 `messages + activeRun` 的合并逻辑塞回浏览器。

## 绝对不要踩的坑

- 不要去 `~/ugk-pi-claw` 更新；它是旧目录，只给回滚和比对用。
- 不要把 `.data`、sidecar 登录态、日志、运行态截图、临时 HTML 报告当成仓库内容。
- 不要跳过 `docker compose -f docker-compose.prod.yml config`；上一次生产 YAML 缩进坑就是这么抓出来的。
- 不要把 `playground` controller 再揉回 `src/ui/playground.ts`；这轮刚拆干净，别又把厨房倒回客厅。
- 不要让前端继续猜会话视图怎么合并；`viewMessages` 是后端 canonical view，前端只渲染。
- 不要只看接口 `200` 就宣布没问题；会话恢复、滚动行为、sidecar 登录态和旧会话记忆必须做真实行为验证。

## 这一轮到底做了什么

### 1. `playground` runtime 做完了一轮系统性收口

本轮已经不是零碎修 UI，而是把 `playground` 的主要运行时边界拆开并稳定下来，包括：

- mobile shell
- conversations controller
- layout controller
- transcript renderer
- stream controller
- assets / context usage / conn activity controller
- assembler cleanup

配套修掉的真实问题包括：

- 旧会话异步回包污染当前页面
- 中断后刷新重复过程壳子 / 重复提问
- 历史时间戳全变成 `08:00:00`
- 桌面 topbar 结构仍然两套并存

详细拆分与边界说明看：

- [docs/playground-runtime-refactor-summary-2026-04-22.md](/E:/AII/ugk-pi/docs/playground-runtime-refactor-summary-2026-04-22.md)
- [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### 2. 线上已经完成一轮增量发布

这次不是整目录替换，而是按 Git 工作目录做的增量更新：

- 服务器目录：`~/ugk-claw-repo`
- shared 运行态目录：`~/ugk-claw-shared`
- sidecar 登录态、agent 会话、资产和日志都没有被洗掉
- 2026-04-23 已完成最新一次增量发布：`git pull --ff-only origin main` 后执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`，发布后 `/healthz`、`/playground`、`check-deps.mjs`、`docker compose ps` 和 `/v1/chat/state` 的 `viewMessages` 均已验收通过

### 3. 发布过程中真抓到一个生产配置坑

第一次准备发 `snapshot-20260422-v4.1.1-stable` 时，服务器 `docker compose` 直接报错：

```text
yaml: line 38, column 16: mapping values are not allowed in this context
```

根因是 [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml) 里 healthcheck 的 `retries` 缩进写坏了。

所以要记住：

- `snapshot-20260422-v4.1.1-stable` 已经存在，但**不是最终可用发布点**
- 真正应该交接和继续部署的是 `snapshot-20260422-v4.1.2-stable`

### 4. 2026-04-23 已增量发布：会话状态 `viewMessages` 收口

本地已完成并验证一轮会话状态根因治理，并已增量发布到腾讯云新加坡生产环境：`GET /v1/chat/state` 现在由后端返回已归并好的 `viewMessages`，前端只负责渲染，不再自己猜 `messages + activeRun` 怎么合并。

这次主要解决两类体验坑：

- 同一轮刚结束时，历史已落盘但 terminal `activeRun` 还短暂存在，页面不应显示成“问题 / 回答 / 问题 / 回答”。
- 连续两轮发送相同文本（例如“继续”）时，后端不能把上一轮同文本误判成当前轮，导致当前输入被吞。

这次更新走的是服务器 GitHub 工作目录增量更新，不是整目录替换；上线后已验收 `/healthz`、`/playground`、`check-deps.mjs`、`docker compose ps` 和 `/v1/chat/state` 的 `viewMessages` 字段。后续如果继续改会话恢复，仍建议额外打开浏览器实测旧会话继续对话、刷新恢复和连续发送“继续”。

## 当前推荐阅读顺序

如果你现在接手项目，建议顺序别乱：

1. [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
2. [README.md](/E:/AII/ugk-pi/README.md)
3. 这份文档
4. [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
5. [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
6. [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
7. `playground` 相关时再看：
   - [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
   - [docs/playground-runtime-refactor-summary-2026-04-22.md](/E:/AII/ugk-pi/docs/playground-runtime-refactor-summary-2026-04-22.md)

## 当前交付与回滚锚点

### Git 发布点

- 当前推荐稳定 tag：`snapshot-20260422-v4.1.2-stable`
- 上一个错误发布 tag：`snapshot-20260422-v4.1.1-stable`

### 服务器发布前回滚 tag

- `server-pre-deploy-20260423-113909`
- `server-pre-deploy-20260423-014636`
- `server-pre-deploy-20260422-231020`
- `server-pre-deploy-20260422-230750`

### sidecar 登录态备份

- `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260423-113909.tar.gz`
- `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260423-014636.tar.gz`
- `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260422-231020.tar.gz`
- `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260422-230750.tar.gz`

### `playground` 高风险修改前锚点

- `backup/playground-pre-sync-ownership-2026-04-22`
- `backup/playground-pre-stream-split-2026-04-22`
- `backup/playground-pre-timestamp-fix-2026-04-22`
- `backup/playground-pre-assembler-trim-2026-04-22`

## 现在怎么发版才算稳

以后继续增量发布，建议最少按这个顺序：

1. 本地确认工作区干净
2. 本地先跑：
   - `npx tsc --noEmit`
   - `npm test`
   - `docker compose -f docker-compose.prod.yml config`
3. 打新的 snapshot tag
4. 推送 `main` 和 tag 到 `origin`
5. 服务器上先备份 sidecar 登录态
6. 服务器上给当前 `HEAD` 打 `server-pre-deploy-*` 本地 tag
7. 再执行：

```bash
cd ~/ugk-claw-repo
git pull --ff-only origin main
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
```

8. 发布后至少验：
   - `curl -fsS http://127.0.0.1:3000/healthz`
   - `curl -I http://127.0.0.1:3000/playground`
   - `check-deps.mjs`
   - `docker compose ... ps`

## 还没做、但值得继续的方向

到目前为止，`playground` 这条线已经该收就收了。继续死抠主文件边角，收益开始变低。

后续更值得投时间的方向：

1. `conn / activity / Feishu` 继续做业务闭环
2. 后台任务与通知流的真实用户工作流回归
3. 生产部署与回滚流程再做一轮自动化收口

## 相关文档

- [README.md](/E:/AII/ugk-pi/README.md)
- [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
- [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
- [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
- [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
- [docs/playground-runtime-refactor-summary-2026-04-22.md](/E:/AII/ugk-pi/docs/playground-runtime-refactor-summary-2026-04-22.md)
- [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)
