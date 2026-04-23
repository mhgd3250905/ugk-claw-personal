# 当前交接总览

这份文档给接手 `ugk-pi / UGK CLAW` 的人一个当前态入口。

别再用聊天记录、零散提交和模糊记忆拼项目状态了。那种接手方式看上去努力，实际效率低得感人。

## 当前结论

- 代码主仓库：`https://github.com/mhgd3250905/ugk-claw-personal.git`
- 主分支：`main`
- GitHub 最新提交：以 `origin/main` 当前 `HEAD` 为准；生产发布后可能继续追加纯文档提交
- 生产实际运行代码提交：`4b78f21 feat: consolidate task inbox and asset uploads`
- 生产文档记录已推送 GitHub；服务器工作目录可 `git pull --ff-only origin main` 同步文档，不需要重启容器
- 当前公网入口：`http://43.134.167.179:3000/playground`
- 当前健康检查：`http://43.134.167.179:3000/healthz`
- 当前服务器目录：`~/ugk-claw-repo`
- shared 运行态目录：`~/ugk-claw-shared`
- 当前服务器本地回滚 tag：`server-pre-deploy-20260423-180038`
- 当前 sidecar 登录态备份：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260423-180038.tar.gz`

## 本阶段完成了什么

### 1. 文件上传链路标准化

- 浏览器侧文件上传统一走 `POST /v1/assets/upload`
- 上传协议改为 `multipart/form-data` / `FormData`
- 旧的 base64 JSON 上传链路已经从主前端路径清理掉
- 主 chat 选择 / 拖拽文件后，先注册成可复用资产，再发送 `assetRefs`
- `conn` 创建 / 编辑器里的“上传新文件”也走同一套标准上传入口
- 后端默认单文件上限是 64MiB，一次最多 5 个文件；生产 nginx 已确认 `client_max_body_size 80m`

关键入口：

- [src/routes/files.ts](/E:/AII/ugk-pi/src/routes/files.ts)
- [src/ui/playground-assets-controller.ts](/E:/AII/ugk-pi/src/ui/playground-assets-controller.ts)
- [src/ui/playground-conn-activity-controller.ts](/E:/AII/ugk-pi/src/ui/playground-conn-activity-controller.ts)
- [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

### 2. 后台任务结果改为任务消息页

- 后台 `conn` 结果的主投递面已经是 `agent_activity_items` + `任务消息` 页面
- 默认目标是 `{ "type": "task_inbox" }`
- 不再把后台结果默认硬塞进当前会话 transcript
- 旧的 `conversation` 目标只保留后端兼容读取，不再作为前台主路径
- 任务消息页是独立观察页，视觉像 chat，但语义不是 conversation

关键入口：

- [src/routes/activity.ts](/E:/AII/ugk-pi/src/routes/activity.ts)
- [src/agent/agent-activity-store.ts](/E:/AII/ugk-pi/src/agent/agent-activity-store.ts)
- [src/workers/conn-worker.ts](/E:/AII/ugk-pi/src/workers/conn-worker.ts)
- [src/ui/playground-task-inbox.ts](/E:/AII/ugk-pi/src/ui/playground-task-inbox.ts)

### 3. 任务消息未读策略收口

- 顶部 badge 统计来自 `/v1/activity/summary`
- 打开任务消息页不会自动清空未读
- 有未读时默认进入 `未读` 筛选
- `GET /v1/activity` 支持 `unreadOnly=true`、`before`、`hasMore`、`nextBefore`
- 未读条目点击后按条标记已读
- `全部已读` 是显式按钮，走 `POST /v1/activity/read-all`
- 手机端 `更多` 按钮自己显示未读数字徽标，超过 99 显示 `99+`
- 未读提醒统一使用鲜红色 `#ff1744`

### 4. 生产增量发布已完成

这次不是整目录替换，而是 GitHub 工作目录增量更新：

- 发布前生产 `HEAD`：`bbd8735`
- 发布后生产运行代码：`4b78f21`
- 发布记录文档提交：`47e6e16`
- 发布前 sidecar 登录态备份：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260423-180038.tar.gz`
- 发布前回滚 tag：`server-pre-deploy-20260423-180038`

验收已经通过：

- 内网 `/healthz` 返回 `{"ok":true}`
- 内网 `/playground` 返回 `HTTP/1.1 200 OK`
- 公网 `/healthz` 返回 `{"ok":true}`
- 公网 `/playground` 返回 `200`
- `check-deps.mjs` 返回 `host-browser: ok` 和 `proxy: ready`
- compose 状态显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，`ugk-pi-browser-cdp` 与 `ugk-pi-conn-worker` 正常运行
- 页面源码包含 `mobile-overflow-task-inbox-badge`、`task-inbox-filter-unread-button`、`/v1/assets/upload`
- nginx 容器内已确认 `client_max_body_size 80m`

本次生产踩坑也要记住：改 `deploy/nginx/default.conf` 后，nginx 单文件 bind mount 可能继续挂旧 inode。以后改 nginx 配置，发布后必须：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T nginx nginx -T 2>/dev/null | grep client_max_body_size
```

## 当前推荐阅读顺序

如果你现在接手项目，建议顺序别乱：

1. [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
2. [README.md](/E:/AII/ugk-pi/README.md)
3. 这份文档
4. [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
5. [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
6. [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
7. `playground` 当前交互看 [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
8. 上传、资产、任务消息、conn、Feishu 看 [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)

## 当前交付与回滚锚点

### Git 发布点

- 功能版本：`4b78f21 feat: consolidate task inbox and asset uploads`
- 部署记录版本：`47e6e16 docs: record task inbox production deploy`
- 旧推荐稳定 tag：`snapshot-20260422-v4.1.2-stable`
- 不要使用：`snapshot-20260422-v4.1.1-stable`

### 服务器发布前回滚 tag

- `server-pre-deploy-20260423-180038`
- `server-pre-deploy-20260423-113909`
- `server-pre-deploy-20260423-014636`
- `server-pre-deploy-20260422-231020`
- `server-pre-deploy-20260422-230750`

### sidecar 登录态备份

- `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260423-180038.tar.gz`
- `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260423-113909.tar.gz`
- `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260423-014636.tar.gz`
- `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260422-231020.tar.gz`
- `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260422-230750.tar.gz`

## 现在怎么发版才算稳

以后继续增量发布，建议最少按这个顺序：

1. 本地确认工作区干净，运行态临时文件不要乱提交
2. 本地先跑：
   - `npx tsc --noEmit`
   - `npm test`
   - `docker compose -f docker-compose.prod.yml config`
3. 推送 `main` 到 `origin`
4. 服务器上先备份 sidecar 登录态
5. 服务器上给当前 `HEAD` 打 `server-pre-deploy-*` 本地 tag
6. 再执行：

```bash
cd ~/ugk-claw-repo
git pull --ff-only origin main
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
```

7. 如果改过 `deploy/nginx/default.conf`，额外强制重建 nginx：

```bash
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx
```

8. 发布后至少验：
   - `curl -fsS http://127.0.0.1:3000/healthz`
   - `curl -I http://127.0.0.1:3000/playground`
   - `docker compose ... ps`
   - `check-deps.mjs`
   - 如果涉及上传：`nginx -T | grep client_max_body_size`
   - 如果涉及任务消息：`GET /v1/activity/summary` 和页面源码标记

## 下一个阶段建议

现在 `playground`、上传和任务消息主链路已经能作为下一阶段基础。继续死抠“当前会话接收后台结果”这条旧路，收益很低，还容易把系统拉回混乱状态。

更值得进入下一阶段的方向：

1. **Feishu / 外部 IM 闭环**
   - 让飞书入站文件、文本、后台任务结果和文件回传形成稳定用户路径。
   - 优先验证真实用户在飞书里创建任务、补充资料、查看结果、拿到文件的闭环。

2. **任务消息页产品化**
   - 增加搜索、按来源筛选、按任务 / run 分组、失败重试入口。
   - 当前页已经有未读、分页和过程查看，可以继续加管理能力。

3. **后台任务稳定性**
   - 补 run event log 跨进程持久化，避免服务重启后过程回放断层。
   - 梳理超时、失败、取消、重试、输出文件保留策略。

4. **生产发布自动化**
   - 把当前手工增量发布流程脚本化。
   - 特别是 sidecar 备份、回滚 tag、compose config、nginx force recreate、验收清单，别再靠人工临场发挥。

## 相关文档

- [README.md](/E:/AII/ugk-pi/README.md)
- [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
- [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
- [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
- [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
- [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)
- [docs/playground-runtime-refactor-summary-2026-04-22.md](/E:/AII/ugk-pi/docs/playground-runtime-refactor-summary-2026-04-22.md)
- [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)
