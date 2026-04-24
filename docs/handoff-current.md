# 当前交接总览

更新时间：`2026-04-24`

这份文档给接手 `ugk-pi / UGK CLAW` 的下一个 agent 一个当前态入口。先读这里，再读其它文档。别拿聊天记录和旧提交拼项目状态，那种接手方式看着勤奋，实际就是给自己挖坑。

## 当前结论

- 代码主仓库：`https://github.com/mhgd3250905/ugk-claw-personal.git`
- 主分支：`main`
- GitHub 当前最新提交：`26031a3 Record production deploy for panel focus fix`
- 生产实际运行代码提交：`45e7efb1dc2643d9e73d4d6288c0a09394091e94`
- 说明：`26031a3` 是生产发布记录文档提交，不改变运行代码；服务器当前运行在 `45e7efb`
- 公网入口：`http://43.134.167.179:3000/playground`
- 健康检查：`http://43.134.167.179:3000/healthz`
- 服务器主部署目录：`~/ugk-claw-repo`
- shared 运行态目录：`~/ugk-claw-shared`
- 当前服务器本地回滚 tag：`server-pre-deploy-20260424-223012`
- 当前 sidecar 登录态备份：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260424-223012.tar.gz`
- 当前本地未跟踪文件：`runtime/commit-playground-asset-detail-hydration.ps1`、`runtime/pudong-weather.md`；它们不是本轮交接主线，不要顺手提交

## 本阶段完成了什么

### 1. Playground 切换慢的大扫除

本轮重点清理的是用户高频感知到的“多次切换会话后变慢 / 新会话变慢 / 旧会话切换慢”。已经完成这些收口：

- 会话 catalog 请求可取消，过期 `/v1/chat/conversations` 不再拖住后续新会话动作
- canonical state 请求可取消，过期 `/v1/chat/state` 不再占浏览器连接池和后端计算
- 新建 / 切换会话改成两阶段激活：先切 shell，后端 state 后台 hydrate
- `GET /v1/chat/state` 默认只返回最近可渲染窗口，并通过 `historyPage` 支持分页补旧消息
- `ConversationStore` 增加 `mtime` cache、串行写队列和同目录临时文件 + `rename` 原子落盘
- 技能列表查询增加短 TTL cache，避免点击“查看技能”就 reload skills
- 后台任务管理器打开时去掉 `1 + N` runs 请求，`GET /v1/conns` 直接带 `latestRun`
- canonical state hydrate 使用 transcript diff / patch，不再每次整段重绘
- `visibilitychange/pageshow/online` 恢复同步按原因分级，不再无差别 catalog + state 回源
- 任务消息未读数随主请求返回，不再固定补打一条 summary
- 资产详情 hydrate 走最多 4 路队列，同一 assetId 的进行中请求复用
- 后台任务过程详情、运行日志和确认弹层关闭前先释放内部焦点，避免 `aria-hidden` 焦点警告

关键提交：

- `2f81ad6 Improve playground conversation switching latency`
- `a4b609d Improve playground conversation activation UX`
- `75277ab Page playground conversation history state`
- `51d42d3 Cache playground skill registry lookup`
- `ee2cb31 Avoid conn manager run history N+1`
- `cccf2f2 Cache conversation store index writes`
- `ae11728 Diff playground transcript state rendering`
- `b2d2cb3 Grade playground resume sync triggers`
- `d981d3c Return task inbox unread summary inline`
- `58c12e9 Throttle playground asset detail hydration`
- `45e7efb Fix playground panel focus release before hide`

### 2. Playground 消息系统收口

- `GET /v1/chat/state` 的 terminal overlap 归并逻辑已经收口到后端 `viewMessages`
- terminal run 是否已被 history 覆盖，按 run 历史基线与真实新增 canonical history message 判断
- 前端运行态收成同一条助手消息上的状态摘要、loading、最终正文和运行日志入口
- `/v1/chat/events` 断流恢复按 `state -> events -> state` 单一链路收口
- 状态摘要固定单行省略，loading 入口不再显示工具执行长文本

关键入口：

- [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
- [src/routes/chat.ts](/E:/AII/ugk-pi/src/routes/chat.ts)
- [src/ui/playground.ts](/E:/AII/ugk-pi/src/ui/playground.ts)
- [src/ui/playground-stream-controller.ts](/E:/AII/ugk-pi/src/ui/playground-stream-controller.ts)
- [src/ui/playground-transcript-renderer.ts](/E:/AII/ugk-pi/src/ui/playground-transcript-renderer.ts)
- [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)

### 3. 文件上传和资产体系

- 浏览器侧文件上传统一走 `POST /v1/assets/upload`
- 上传协议是 `multipart/form-data` / `FormData`
- 旧的 base64 JSON 上传链路已经从主前端路径清理掉
- 主 chat 选择 / 拖拽文件后，先注册成可复用资产，再发送 `assetRefs`
- `conn` 创建 / 编辑器里的“上传新文件”也走同一套标准上传入口
- 后端默认单文件上限 64MiB，一次最多 5 个文件；生产 nginx 上限 80m

关键入口：

- [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
- [src/agent/asset-store.ts](/E:/AII/ugk-pi/src/agent/asset-store.ts)
- [src/ui/playground-assets-controller.ts](/E:/AII/ugk-pi/src/ui/playground-assets-controller.ts)
- [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### 4. 后台任务结果和任务消息页

- 后台 `conn` 结果主投递面是 `agent_activity_items` + `任务消息` 页面
- `POST /v1/conns` 未传 `target` 时，默认目标是 `{ "type": "task_inbox" }`
- 旧的 `conversation` 目标只保留后端兼容读取，不再作为前台默认投递路径
- 任务消息页支持未读、分页、按条已读、全部已读
- 点开 `source=conn` 且带 `sourceId + runId` 的条目，可以查看后台任务过程

关键入口：

- [src/routes/activity.ts](/E:/AII/ugk-pi/src/routes/activity.ts)
- [src/agent/agent-activity-store.ts](/E:/AII/ugk-pi/src/agent/agent-activity-store.ts)
- [src/workers/conn-worker.ts](/E:/AII/ugk-pi/src/workers/conn-worker.ts)
- [src/ui/playground-task-inbox.ts](/E:/AII/ugk-pi/src/ui/playground-task-inbox.ts)
- [src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)

## 生产状态

最近一次生产增量发布：

- 发布前生产 `HEAD`：`58c12e92fa28a93d7373d65a0c387d8f09d6f29b`
- 发布后生产运行代码：`45e7efb1dc2643d9e73d4d6288c0a09394091e94`
- 发布前 sidecar 登录态备份：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260424-223012.tar.gz`
- 发布前回滚 tag：`server-pre-deploy-20260424-223012`
- 发布记录文档提交：`26031a3 Record production deploy for panel focus fix`

验收已通过：

- 服务器内网 `/healthz` 返回 `{"ok":true}`
- 服务器内网 `/playground` 返回 `200`
- 公网 `/healthz` 返回 `{"ok":true}`
- 公网 `/playground` 返回 `200`
- 公网页面源码包含 `releasePanelFocusBeforeHide` 和 `activeElement.blur`
- `check-deps.mjs` 返回 `host-browser: ok` 和 `proxy: ready`
- compose 状态显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，`ugk-pi-browser-cdp` 和 `ugk-pi-conn-worker` 正常运行

本次踩坑：

- 第一次远程发布命令在 `git tag -m "server pre deploy backup"` 处被远程 shell 拆词，只生成了 `chrome-sidecar-20260424-222839.tar.gz`，没有拉代码，也没有重建容器。后续改成无空格 tag message 后成功。Windows PowerShell 发 SSH 单行命令时，别塞需要保留空格的嵌套引号。
- `ugk-pi` 重建后 nginx 一度 unhealthy 并返回 `502`。原因是 nginx 老容器没有跟上 app 重建后的 upstream 状态。已通过 `up -d --force-recreate nginx` 恢复，并写入 [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)。

## 接手阅读顺序

建议按这个顺序读，别一上来全仓乱翻：

1. [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
2. [README.md](/E:/AII/ugk-pi/README.md)
3. 这份文档
4. [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
5. [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
6. [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
7. playground 当前交互看 [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
8. 上传、资产、任务消息、conn、Feishu 看 [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

## 当前交付与回滚锚点

### Git 发布点

- 当前 GitHub 最新提交：`26031a3 Record production deploy for panel focus fix`
- 当前生产运行代码：`45e7efb Fix playground panel focus release before hide`
- 本轮 UX 大扫除主发布点：`58c12e9 Throttle playground asset detail hydration`
- 旧推荐稳定 tag：`snapshot-20260422-v4.1.2-stable`
- 不要使用：`snapshot-20260422-v4.1.1-stable`

### 服务器发布前回滚 tag

- `server-pre-deploy-20260424-223012`
- `server-pre-deploy-20260424-180357`
- `server-pre-deploy-20260424-121817`
- `server-pre-deploy-20260423-180038`
- `server-pre-deploy-20260423-113909`

### sidecar 登录态备份

- `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260424-223012.tar.gz`
- `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260424-180357.tar.gz`
- `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260424-121817.tar.gz`
- `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260423-180038.tar.gz`
- `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260423-113909.tar.gz`

## 发版口径

生产更新默认是增量更新，不是整目录替换。不要洗掉：

- `~/ugk-claw-shared/.data/agent`
- `~/ugk-claw-shared/.data/chrome-sidecar`
- `~/ugk-claw-shared/app.env`
- `~/ugk-claw-shared/compose.env`
- 生产日志目录

标准发布顺序：

1. 本地确认工作区，运行态临时文件不要乱提交
2. 本地跑 `npm test` 和 `git diff --check`
3. 推送 `main` 到 `origin`
4. 服务器进入 `~/ugk-claw-repo`
5. 备份 sidecar 登录态
6. 给当前 `HEAD` 打 `server-pre-deploy-*` 本地 tag
7. `git fetch --tags origin`
8. `git pull --ff-only origin main`
9. `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config`
10. `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`
11. 如果 nginx unhealthy 或公网入口 `502`，执行 `up -d --force-recreate nginx`
12. 验收 `/healthz`、`/playground`、`docker compose ... ps`、`check-deps.mjs`

## 下一个阶段建议

当前 Playground 体验大扫除主线已经完成。继续做的话，优先级建议如下：

1. **长会话 JSONL 尾读优化**
   - 现在 state/history 已分页返回，但底层仍可能存在“读完整 JSONL 再截取窗口”的尾巴。
   - 长会话继续增长后，这会再次成为慢路径。

2. **Feishu / 外部 IM 闭环**
   - 验证真实用户在飞书里创建任务、补充资料、查看结果、拿到文件的完整链路。
   - 任务消息页和资产体系已经给这条路打了底。

3. **任务消息页产品化**
   - 搜索、按来源筛选、按任务 / run 分组、失败重试入口。

4. **后台任务稳定性**
   - run event log 跨进程持久化。
   - 梳理超时、失败、取消、重试、输出文件保留策略。

5. **生产发布自动化**
   - 把 sidecar 备份、回滚 tag、compose config、up build、nginx force recreate 和验收清单脚本化。

## 相关文档

- [README.md](/E:/AII/ugk-pi/README.md)
- [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
- [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
- [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
- [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
- [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
- [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)
- [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)
