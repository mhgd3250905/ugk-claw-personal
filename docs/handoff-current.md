# 当前交接总览

这份文档给接手 `ugk-pi / UGK CLAW` 的人一个当前态入口。

别再用聊天记录、零散提交和模糊记忆拼项目状态了。那种接手方式看上去努力，实际效率低得感人。

## 当前结论

- 代码主仓库：`https://github.com/mhgd3250905/ugk-claw-personal.git`
- 主分支：`main`
- 当前本地最新提交：`21f1a5a fix: repair prod compose healthcheck indentation`
- 当前推荐稳定发布 tag：`snapshot-20260422-v4.1.2-stable`
- 当前服务器已增量更新到：`21f1a5ac131e2638f7806126c7d322d77edaece0`
- 当前公网入口：`http://43.134.167.179:3000/playground`
- 当前健康检查：`http://43.134.167.179:3000/healthz`

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

### 3. 发布过程中真抓到一个生产配置坑

第一次准备发 `snapshot-20260422-v4.1.1-stable` 时，服务器 `docker compose` 直接报错：

```text
yaml: line 38, column 16: mapping values are not allowed in this context
```

根因是 [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml) 里 healthcheck 的 `retries` 缩进写坏了。

所以要记住：

- `snapshot-20260422-v4.1.1-stable` 已经存在，但**不是最终可用发布点**
- 真正应该交接和继续部署的是 `snapshot-20260422-v4.1.2-stable`

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

- `server-pre-deploy-20260422-231020`
- `server-pre-deploy-20260422-230750`

### sidecar 登录态备份

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
