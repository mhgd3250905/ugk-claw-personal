# 腾讯云新加坡 CVM 部署运行手册

本文记录 `ugk-pi / UGK CLAW` 在腾讯云新加坡 CVM 上的首次部署事实、验证口径、故障记录和后续更新流程。

这不是泛泛而谈的“云服务器教程”，而是本仓库当前这台服务器的可追溯 runbook。后续更新部署时，先看这里，别靠记忆硬莽。

如果你现在只想要高频命令速查，不想先读长文，直接看 [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)。

## 当前部署快照

- 日期：`2026-04-20`
- 云厂商：腾讯云 CVM
- 地域：新加坡二区
- 实例 ID：`ins-0voci0xy`
- 公网 IP：`43.134.167.179`
- SSH 用户：`ubuntu`
- 实例规格：标准型 SA2，`4 核 8G`
- 公网带宽：`5Mbps`
- 系统盘：通用型 SSD 云硬盘，`100G`
- 系统镜像：Ubuntu Server `24.04.4 LTS`，`x86_64`
- 服务公网入口：`http://43.134.167.179:3000/playground`
- 健康检查入口：`http://43.134.167.179:3000/healthz`
- 生产 compose 文件：`docker-compose.prod.yml`
- 当前主部署目录：`/home/ubuntu/ugk-claw-repo`
- 当前 shared 运行态目录：`/home/ubuntu/ugk-claw-shared`
- 回滚保留目录：`/home/ubuntu/ugk-pi-claw`、`/home/ubuntu/ugk-pi-claw-pre-github-20260420-105142`、`/home/ubuntu/ugk-pi-claw-prev-20260419-231530`
- 当前迁移验证结果：`http://127.0.0.1:3000/healthz` 与 `http://127.0.0.1:3000/playground` 均返回 `200`，生产容器挂载已经切到 `~/ugk-claw-shared`
- 当前推荐稳定发布 tag：`snapshot-20260422-v4.1.2-stable`
- 当前线上应用提交：`9d3cb37`
- 当前服务器本地回滚 tag：`server-pre-deploy-20260426-003227`
- 当前 sidecar 备份：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260426-002901.tar.gz`
- 注意：`snapshot-20260422-v4.1.1-stable` 已存在，但因为 `docker-compose.prod.yml` 的 healthcheck 缩进错误，不应再作为交接后的部署基线

服务器初始核验结果：

```bash
whoami
# ubuntu

pwd
# /home/ubuntu

lsb_release -a
# Distributor ID: Ubuntu
# Description:    Ubuntu 24.04.4 LTS
# Release:        24.04
# Codename:       noble

df -h
# /dev/vda2 约 99G，总体空间足够当前部署使用

free -h
# Mem 约 7.5Gi，Swap 约 1.9Gi
```

## 部署拓扑

```text
公网用户
  -> http://43.134.167.179:3000
  -> nginx container :80
  -> ugk-pi container :3000
  -> web-access direct_cdp
  -> ugk-pi-browser-cdp :9223
  -> Docker Chrome sidecar
```

当前 `web-access` 主链路：

```text
WEB_ACCESS_BROWSER_PROVIDER=direct_cdp
  -> http://172.31.250.10:9223
  -> Docker Chrome sidecar
```

sidecar GUI 不暴露公网。需要人工登录 X 等网站时，从本机用 SSH tunnel 访问：

```bash
ssh -L 13901:127.0.0.1:3901 ubuntu@43.134.167.179
```

当前 compose 已经给 `ugk-pi-browser` 加了容器内自举 healthcheck。不要把“GUI 页面能打开”误判成“CDP 已经 ready”；真正算数的是 `9222/9223` 探针和 `check-deps.mjs` 输出。

当前 sidecar GUI 手点打开的浏览器，也已经被收口到同一个 `chrome-profile-sidecar`。后续如果再出现“GUI 里像是没登录、但 agent 还在用另一套 cookie”的现象，先怀疑是不是老容器没更新，而不是先脑补 shared 目录把登录态吃了。

然后在本机打开：

```text
https://127.0.0.1:13901/
```

注意：SSH 窗口保持打开时 tunnel 才有效。不要把 `3901` 加到公网安全组里，那是把浏览器桌面裸奔出去，属于运维自毁式浪漫。

## 安全组与端口

腾讯云安全组至少需要：

- 入站 TCP `22`：SSH 登录服务器。
- 入站 TCP `3000`：当前 playground 公网访问。

不要开放：

- TCP `3901`：Chrome sidecar GUI，只允许 SSH tunnel 本机转发访问。
- TCP `9223`：CDP relay，只给容器网络内部使用。

后续如果接域名和 HTTPS，建议改为标准 `80/443` 入口，并同步更新 `.env` 里的 `PUBLIC_BASE_URL` 和本文档。

## 服务器环境准备

首次安装 Docker 时，手工粘贴长命令踩过一次坑：`docker.gpg` 被终端换行切成了 `doc` 和 `ker.gpg`，导致：

```text
ker.gpg: command not found
chmod: cannot access '/etc/apt/keyrings/docker.gpg': No such file or directory
E: Malformed entry 1 in list file /etc/apt/sources.list.d/docker.list (URI)
usermod: group 'docker' does not exist
```

结论：服务器初始化这种命令不要在网页终端里一坨粘贴，容易断行。应优先保存成脚本后执行。

最终 Docker 安装成功后的验证结果：

```bash
docker --version
# Docker version 29.4.0, build 9d7ad9f

docker compose version
# Docker Compose version v5.1.3

docker run --rm hello-world
# Hello from Docker!
```

当前应用镜像会安装基础运行工具：

```text
git
curl
ca-certificates
python3
```

如果服务器上遇到 `python3: not found`，说明线上镜像还是旧版本，需要在当前主部署目录执行：

```bash
cd ~/ugk-claw-repo
docker compose -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
```

如果刚把 `ubuntu` 加入 `docker` 组，需要执行：

```bash
newgrp docker
```

或重新登录 SSH。

## 当前部署目录与更新入口

当前服务器已经完成一次从 tar 解包目录到 GitHub 工作目录的迁移，并把主要运行态外置到 shared 目录：

- 默认更新目录：`~/ugk-claw-repo`
- 当前目录类型：GitHub clone 出来的 Git 工作目录
- 当前远程仓库：`origin -> https://github.com/mhgd3250905/ugk-claw-personal.git`
- 当前 shared 运行态目录：`~/ugk-claw-shared`
- 旧目录 `~/ugk-pi-claw` 及 `~/ugk-pi-claw-prev-*` 只保留给回滚与比对

后续默认更新时，先进入：

```bash
cd ~/ugk-claw-repo
```

不要再条件反射跑回 `~/ugk-pi-claw`，不然你改了半天也只是对着旧目录自我感动。

## 2026-04-26 Playground `/new` 指令增量发布记录

这次发布仍然不是整目录替换，而是沿用 GitHub 工作目录 `~/ugk-claw-repo` 做增量更新；运行态继续留在 `~/ugk-claw-shared`，没有触碰 `.data/agent`、sidecar 登录态或日志目录。

实际结果：

1. 本地已完成 `/new` 指令基础验证：
   - `npm test`：`281 tests`，`279 pass`，`2 skip`
   - `npm run design:lint`：`0 errors`，`0 warnings`，`1 info`
   - `git diff --check`
   - 本地 `docker compose restart ugk-pi` 后，`/playground` 源码包含 `parsePlaygroundSlashCommand`
   - 浏览器实测 `/new` 只触发 `POST /v1/chat/conversations` 与新会话 hydrate，不进入 `/v1/chat/stream`，不写入 transcript
2. 本地 `main` 已推送到 GitHub：`9d3cb37 Add playground slash new command`
3. 服务器进入 `~/ugk-claw-repo`，发布前 `HEAD` 为 `95b32f7`
4. 服务器先备份 sidecar 登录态：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260426-002901.tar.gz`
5. 服务器给旧 `HEAD` 打本地回滚 tag：`server-pre-deploy-20260426-003227`
6. 执行 `git fetch --tags origin` 与 `git pull --ff-only origin main`，从 `95b32f7` fast-forward 到 `9d3cb37`
7. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet`
8. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`，重建 `ugk-pi` 与 `ugk-pi-conn-worker`
9. 发布后验收通过：
   - 服务器 `HEAD` 为 `9d3cb37`
   - 服务器内网 `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - 服务器内网 `/playground` 源码包含 `parsePlaygroundSlashCommand`
   - 公网 `http://43.134.167.179:3000/healthz` 返回 `{"ok":true}`
   - 公网 `/playground` 源码包含 `parsePlaygroundSlashCommand`
   - `check-deps.mjs` 返回 `host-browser: ok (http://172.31.250.10:9223)` 与 `proxy: ready (127.0.0.1:3456)`
   - `ugk-pi-browser` 容器内 `127.0.0.1:9222/json/version` 探针通过
   - `ugk-pi` 容器内 `172.31.250.10:9223/json/version` 探针通过
   - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，`ugk-pi-browser-cdp` 与 `ugk-pi-conn-worker` 正常运行

本次上线内容包括：

- playground 浏览器端 slash command 分发层
- `/new` 指令复用现有新会话创建流程
- `/new` 不进入 agent runtime、不写 transcript、不触发 `/v1/chat/stream`
- 未知 slash command 与“指令 + 附件 / 引用资产”的错误拦截

本次远程发布再次踩到 Windows PowerShell 引号坑：远端 `$(date ...)` 如果放在本机双引号里，会被 PowerShell 当成本机表达式执行；远端 `git tag -m "..."` 也容易被多层引号拆坏。后续远端多步命令优先用单引号包整段 remote script，tag 信息不需要花哨时直接用轻量 tag，别让引号杂技抢了发布主线。

## 2026-04-25 Playground 浅色后台任务编辑器收口增量发布记录

这次发布仍然不是整目录替换，而是沿用 GitHub 工作目录做增量更新；运行态继续留在 `~/ugk-claw-shared`，不碰 `.data/agent`、sidecar 登录态或日志目录。

实际结果：

1. 本地修复并提交 `8e836ea Refine playground light work surfaces`
2. 本地推送 GitHub：`main` 从 `544d667` 更新到 `8e836ea`
3. 服务器进入 `~/ugk-claw-repo`，发布前 `HEAD` 为 `544d667`
4. 服务器先备份 sidecar 登录态：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260425-211919.tar.gz`
5. 服务器给旧 `HEAD` 打本地回滚 tag：`server-pre-deploy-20260425-211919`
6. 执行 `git fetch --tags origin` 与 `git pull --ff-only origin main`，从 `544d667` fast-forward 到 `8e836ea`
7. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet`
8. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`，重建 `ugk-pi` 与 `ugk-pi-conn-worker`
9. 发布后 nginx 一度返回 `502` 且 nginx 容器 unhealthy；app 容器自身为 healthy。已执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx` 只重建 nginx，随后入口恢复。
10. 发布后验收通过：
   - 服务器内网 `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - 服务器内网 `http://127.0.0.1:3000/playground` 返回 `200`
   - 公网 `http://43.134.167.179:3000/healthz` 返回 `{"ok":true}`
   - 公网 `http://43.134.167.179:3000/playground` 返回 `200`
   - 页面源码包含 `conn-time-picker-calendar .flatpickr-month`、`conn-time-picker-calendar .flatpickr-day.selected`、`conn-editor-target-preview` 等本次浅色后台任务编辑器修复标记

本次修复重点：

- 浅色后台任务创建 / 编辑页使用透明结构容器和白色输入承载面，避免白字、黑块和灰块套灰块。
- 浅色 `flatpickr` 时间选择器补齐月份、星期、日期、禁用日期、hover、today、selected、前后月箭头的颜色映射。
- `test/conn-sqlite-store.test.ts` 的 `maxRunMs` 无效值测试补 `now`，避免测试随着真实日期推进先撞到 once schedule 过期错误。

## 2026-04-25 Playground 运行态重复与历史触顶加载增量发布记录

这次发布仍然不是整目录替换，而是沿用 GitHub 工作目录做增量更新；运行态继续留在 `~/ugk-claw-shared`，不碰 `.data/agent`、sidecar 登录态或日志目录。

实际结果：

1. 本地已完成本轮运行态重复与历史加载修复验证：
   - `npm test`：`277 tests`，`275 pass`，`2 skip`
   - `npm run design:lint`：`0 errors`，`0 warnings`，`1 info`
   - `git diff --check`
   - 本地 `docker compose restart ugk-pi` 后，`http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - `docker compose -f docker-compose.prod.yml config --quiet`
   - `npx tsc --noEmit` 仍失败，但失败点是既有 TypeScript 债：`src/agent/agent-service.ts` 的 `import type` 写法、`src/routes/chat.ts` 的 error event union、`test/agent-service.test.ts` 的 union narrowing、`test/background-agent-runner.test.ts` 的 `session.messages` 可空判断；本轮改动没有引入新的对应触点。
2. 本地 `main` 已推送到 GitHub：
   - `6c2669c Fix playground active run transcript duplication`
   - `a9e7d8b Make playground history load on scroll`
3. 服务器进入 `~/ugk-claw-repo`，发布前 `HEAD` 为 `9a9f016`
4. 服务器先备份 sidecar 登录态：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260425-124055.tar.gz`
5. 服务器给旧 `HEAD` 打本地回滚 tag：`server-pre-deploy-20260425-124055`
6. 执行 `git fetch --tags origin` 与 `git pull --ff-only origin main`，从 `9a9f016` fast-forward 到 `a9e7d8b`
7. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet`
8. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`，重建 `ugk-pi` 与 `ugk-pi-conn-worker`
9. 发布后验收通过：
   - 服务器内网 `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - 服务器内网 `http://127.0.0.1:3000/playground` 返回 `200`
   - 服务器内网页面源码包含 `history-auto-load-status` 与 `hasOlderConversationHistory`
   - 公网 `http://43.134.167.179:3000/healthz` 返回 `{"ok":true}`
   - 公网 `http://43.134.167.179:3000/playground` 返回 `200`
   - 公网页面源码包含 `history-auto-load-status`
   - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，`ugk-pi-browser-cdp` 与 `ugk-pi-conn-worker` 正常运行
   - `check-deps.mjs` 返回 `host-browser: ok (http://172.31.250.10:9223)` 与 `proxy: ready (127.0.0.1:3456)`

本次上线内容包括：

- `AgentService` 记录 active run 启动前的 session 消息数量，运行中 canonical state 只取 run 前历史，再由 active run snapshot 合成当前轮，避免 session 过程中持久化片段和 active snapshot 在前端重复渲染成 `user-agent / user-agent`
- playground 不再显示可点击的“加载更多历史”按钮；用户上滑到 transcript 顶部附近时自动补页，只在加载期间显示非交互状态提示
- `DESIGN.md`、`docs/playground-current.md` 与 `docs/change-log.md` 已同步记录这次交互口径

本次也再次证明一件事：Windows 发远端 SSH 命令时，别把带 `|` 的 grep 正则随手塞进一层引号里，远端 shell 会给你表演拆管道。验收标记优先用 `grep -F` 拆成多条固定字符串检查，少玩引号套娃。

## 2026-04-25 Playground 手机端 UI 与图片导出修复增量发布记录

这次发布仍然不是整目录替换，而是沿用 GitHub 工作目录做增量更新；运行态继续留在 `~/ugk-claw-shared`，不碰 `.data/agent`、sidecar 登录态或日志目录。

实际结果：

1. 本地已完成本轮 playground UI / 导出修复验证：
   - `npm test`：`276 tests`，`274 pass`，`2 skip`
   - `npm run design:lint`：`0 errors`，`0 warnings`
   - `git diff --check`
   - 本地浏览器点击 chat 消息底部“保存为图片”，当前页控制台不再出现 `SecurityError` 或 `showErrorBanner is not defined`
2. 本地 `main` 已推送到 GitHub：`9a9f0165845e7a7063b8786a57b964073ec49430`
3. 服务器进入 `~/ugk-claw-repo`，发布前 `HEAD` 为 `45e7efb1dc2643d9e73d4d6288c0a09394091e94`
4. 服务器先备份 sidecar 登录态：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260425-084932.tar.gz`
5. 服务器给旧 `HEAD` 打本地回滚 tag：`server-pre-deploy-20260425-085105`
6. 执行 `git fetch --tags origin` 与 `git pull --ff-only origin main`，从 `45e7efb` fast-forward 到 `9a9f016`
7. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet`
8. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`，重建 `ugk-pi` 与 `ugk-pi-conn-worker`
9. 发布后验收通过：
   - 服务器内网 `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - 服务器内网 `http://127.0.0.1:3000/playground` 返回 `200`
   - 公网 `http://43.134.167.179:3000/healthz` 返回 `{"ok":true}`
   - 公网 `http://43.134.167.179:3000/playground` 返回 `200`
   - 公网页面源码包含 `sanitizeExportStyles`、`data:image/svg` 与 `task-inbox-view.open`
   - `check-deps.mjs` 返回 `host-browser: ok (http://172.31.250.10:9223)` 与 `proxy: ready (127.0.0.1:3456)`
   - `ugk-pi-browser` 容器内 `http://127.0.0.1:9222/json/version` 返回 Chrome CDP JSON
   - `ugk-pi` 容器内 `http://172.31.250.10:9223/json/version` 返回 Chrome CDP JSON
   - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，`ugk-pi-browser-cdp` 与 `ugk-pi-conn-worker` 正常运行

本次上线内容包括：

- 手机端非 chat 页面继续收口到无边框深色仪表盘语言，并新增浅色主题一一对应版本
- 任务消息页改成和文件库同层级的独立 fixed 工作页，不再挂在聊天主壳里切 `data-primary-view`
- 消息操作栏位于 `.message-body` 内底部，包含复制正文和保存图片
- 保存图片导出链路改成 origin-clean：清理外部样式资源、替换媒体节点、使用 `data:image/svg+xml` 中间图，避免 canvas taint

本次仍然踩到一个远程命令细节：`grep` 固定字符串里包含 `;` 时，如果没有正确整体引用，远端 shell 会把它拆成命令分隔符；后续验收标记优先用不含 shell 控制字符的短标记，别让发布验证变成引号杂技。

## 2026-04-24 Playground 弹层焦点释放增量发布记录

这次发布仍然不是整目录替换，而是沿用 GitHub 工作目录做增量更新；运行态继续留在 `~/ugk-claw-shared`，不碰 `.data/agent`、sidecar 登录态或日志目录。

实际结果：
1. 本地已完成后台任务过程详情弹层焦点修复验证：
   - 新增回归测试先红后绿：`GET /playground releases panel focus before hiding conn run details`
   - `npm test`：275 tests，273 pass，2 skip，0 fail
   - `git diff --check`
   - 本地 `http://127.0.0.1:3000/playground` 页面源码包含 `releasePanelFocusBeforeHide` 和 `activeElement.blur`
2. 本地 `main` 已推送到 GitHub：`45e7efb1dc2643d9e73d4d6288c0a09394091e94`
3. 服务器进入 `~/ugk-claw-repo`，发布前 `HEAD` 为 `58c12e92fa28a93d7373d65a0c387d8f09d6f29b`
4. 服务器先备份 sidecar 登录态：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260424-223012.tar.gz`
5. 服务器给旧 `HEAD` 打本地回滚 tag：`server-pre-deploy-20260424-223012`
6. 执行 `git fetch --tags origin` 与 `git pull --ff-only origin main`，从 `58c12e9` fast-forward 到 `45e7efb`
7. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config`，输出到 `/tmp/ugk-compose-config-20260424-223012.txt`
8. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`
9. `ugk-pi` 重建后 nginx 曾短暂返回 `502` 且 nginx 容器 unhealthy；根因是 nginx 老容器在 app 容器重建后没有跟上 upstream 状态。已执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx`，随后 nginx 恢复 healthy。后续只要重建 app 后入口出现 `502`，先查 nginx healthy 和 upstream 状态，别上来就怀疑 app 改挂了。
10. 发布后验收通过：
    - 服务器内网 `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
    - 服务器内网 `http://127.0.0.1:3000/playground` 返回 `200`
    - 公网 `http://43.134.167.179:3000/healthz` 返回 `{"ok":true}`
    - 公网 `http://43.134.167.179:3000/playground` 返回 `200`
    - 公网页面源码包含 `releasePanelFocusBeforeHide` 和 `activeElement.blur`
    - `check-deps.mjs` 返回 `host-browser: ok (http://172.31.250.10:9223)` 与 `proxy: ready (127.0.0.1:3456)`
    - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，`ugk-pi-browser-cdp` 与 `ugk-pi-conn-worker` 正常运行
11. 本次上线的行为收口：
    - 后台任务过程详情、运行日志和确认弹层在设置 `hidden / aria-hidden=true` 前会先释放内部焦点
    - 焦点优先回到可见触发入口或底部输入框；如果浏览器拒绝聚焦且 active element 仍在弹层内，则执行 `blur()` 兜底
    - 避免关闭后台任务过程详情时出现 `Blocked aria-hidden on an element because its descendant retained focus`

本次额外踩到一个 SSH 引号坑：

- 第一次远程发布命令在 `git tag -m "server pre deploy backup"` 处被远程 shell 拆词，只生成了 `/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260424-222839.tar.gz`，没有拉代码，也没有重建容器。后续改成无空格 message `server-pre-deploy-backup` 后成功。远程一行命令里别塞需要保留空格的嵌套引号，尤其是在 Windows PowerShell 发 SSH 命令时，能少演一层戏就少演一层。

## 2026-04-24 Playground UX 性能债清扫增量发布记录

这次发布仍然不是整目录替换，而是沿用 GitHub 工作目录做增量更新；运行态继续留在 `~/ugk-claw-shared`，不碰 `.data/agent`、sidecar 登录态或日志目录。

实际结果：

1. 本地已完成本轮 Playground UX 性能债清扫的验证：
   - `node --test --import tsx test/server.test.ts --test-name-pattern "GET /playground renders immersive landing home shell"`：90 pass / 0 fail
   - `npm test`：274 tests，272 pass，2 skip，0 fail
   - `git diff --check`
2. 本地 `main` 已推送到 GitHub：`58c12e92fa28a93d7373d65a0c387d8f09d6f29b`
3. 服务器进入 `~/ugk-claw-repo`，发布前 `HEAD` 为 `0fdcef7e29c9843d6cb4c4ac3adbbf4607675e52`
4. 服务器先备份 sidecar 登录态：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260424-180357.tar.gz`
5. 服务器给旧 `HEAD` 打本地回滚 tag：`server-pre-deploy-20260424-180357`
6. 执行 `git fetch --tags origin` 与 `git pull --ff-only origin main`，从 `0fdcef7` fast-forward 到 `58c12e9`
7. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config`
8. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`
9. 发布后验收通过：
   - 服务器内网 `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - 服务器内网 `http://127.0.0.1:3000/playground` 返回 `200`
   - 公网 `http://43.134.167.179:3000/healthz` 返回 `{"ok":true}`
   - 公网 `http://43.134.167.179:3000/playground` 返回 `200`
   - 公网页面源码包含 `ASSET_DETAIL_CONCURRENCY_LIMIT`
   - `check-deps.mjs` 返回 `host-browser: ok (http://172.31.250.10:9223)` 与 `proxy: ready (127.0.0.1:3456)`
   - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，`ugk-pi-browser-cdp` 与 `ugk-pi-conn-worker` 正常运行
10. 本次上线的行为收口：
    - 会话切换 / 新会话不再被后台 state hydrate 卡住，过期 catalog/state 请求会取消或失效
    - `GET /v1/chat/state` 默认只返回最近可渲染历史，并通过 history 分页按需补旧消息
    - 技能列表查询走短 TTL 缓存，后台任务管理器打开时不再对所有 conn 做 `1 + N` runs 请求
    - `ConversationStore` 使用 mtime cache、串行写队列和原子 rename 落盘
    - canonical state hydrate 使用 transcript diff / patch，恢复同步按生命周期原因分级
    - 任务消息未读数随主请求返回，不再固定补打一条 summary
    - 资产详情 hydrate 最多 4 路并发，同一 assetId 的进行中请求复用同一 Promise

## 2026-04-24 Agent 时间锚点与过期 once 调度增量发布记录

这次发布仍然不是整目录替换，而是沿用 GitHub 工作目录做增量更新；运行态继续留在 `~/ugk-claw-shared`，不碰 `.data/agent`、sidecar 登录态或日志目录。

实际结果：

1. 本地已完成针对本次改动的定向验证：
   - `node --test --test-concurrency=1 --import tsx test/agent-service.test.ts`
   - `node --test --test-concurrency=1 --import tsx test/background-agent-runner.test.ts`
   - `node --test --test-concurrency=1 --import tsx test/conn-sqlite-store.test.ts`
   - `node --test --test-concurrency=1 --test-name-pattern "POST /v1/conns returns 400 when the once schedule is already in the past" --import tsx test/server.test.ts`
2. 本地 `main` 已推送到 GitHub：`d0c88a510fb54310aaab9a741fb2f30476625062`
3. 服务器进入 `~/ugk-claw-repo`，发布前 `HEAD` 为 `b4f7ffc`
4. 服务器先备份 sidecar 登录态：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260424-093739.tar.gz`
5. 服务器给旧 `HEAD` 打本地回滚 tag：`server-pre-deploy-20260424-093739`
6. 执行 `git fetch --tags origin` 与 `git pull --ff-only origin main`，从 `b4f7ffc` fast-forward 到 `d0c88a5`
7. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config`
8. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`
9. 发布后验收通过：
   - `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/playground` 返回 `200`
   - 公网 `http://43.134.167.179:3000/healthz` 返回 `{"ok":true}`
   - 公网 `http://43.134.167.179:3000/playground` 返回 `200`
   - `check-deps.mjs` 返回 `host-browser: ok (http://172.31.250.10:9223)` 与 `proxy: ready (127.0.0.1:3456)`
   - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，`ugk-pi-browser-cdp` 与 `ugk-pi-conn-worker` 正常运行
10. 本次上线的行为收口：
   - 前台 chat 与后台 `conn` runner 发给 agent 的用户消息，都会自动补一行 `[当前时间：时区 时间]`
   - 一次性 `once` 调度如果落到过去时间，后端会直接拒绝并返回 `400 BAD_REQUEST`
   - 用户可见 transcript 不会回显这段内部时间前缀

本次额外踩到一个 Windows 侧小坑：

- 用 PowerShell here-string 通过 `ssh ... bash -s` 喂远端脚本时，stdin 开头会混进 UTF-8 BOM，导致远端把第一条命令识别成 `﻿set`、`﻿cd`、`﻿curl` 这种鬼东西。主发布流程已经实际跑通，但补验收脚本一度被这破字节污染。后续远端执行优先走单行 `ssh "cd ... && ..."`，别再拿 stdin BOM 给自己挖坑。

## 2026-04-24 Playground 消息系统收口增量发布记录

这次发布仍然不是整目录替换，而是沿用 GitHub 工作目录做增量更新；运行态继续留在 `~/ugk-claw-shared`，不碰 `.data/agent`、sidecar 登录态或日志目录。

实际结果：

1. 本地已完成本次消息系统收口改动的核心验证：
   - `node --test --test-concurrency=1 --import tsx test/server.test.ts`
   - `node --test --test-concurrency=1 --import tsx test/agent-service.test.ts`
2. 本地 `main` 已推送到 GitHub：`0b63cd745d610ff9b6035bbe38c9dab5adf4ce2e`
3. 服务器进入 `~/ugk-claw-repo`，发布前 `HEAD` 为 `0847852917d6b7de409888e57cb9c27eeb073967`
4. 服务器先备份 sidecar 登录态：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260424-121817.tar.gz`
5. 服务器给旧 `HEAD` 打本地回滚 tag：`server-pre-deploy-20260424-121817`
6. 执行 `git fetch --tags origin` 与 `git pull --ff-only origin main`，从 `0847852` fast-forward 到 `0b63cd7`
7. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config`
8. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`
9. 发布后验收通过：
   - `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/playground` 返回 `200`
   - 公网 `http://43.134.167.179:3000/healthz` 返回 `{"ok":true}`
   - 公网 `http://43.134.167.179:3000/playground` 返回 `200`
   - `check-deps.mjs` 返回 `host-browser: ok (http://172.31.250.10:9223)` 与 `proxy: ready (127.0.0.1:3456)`
   - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，`ugk-pi-browser-cdp` 与 `ugk-pi-conn-worker` 正常运行
   - `GET /playground` 页面源码包含 `assistant-run-log-trigger` 与 `assistant-status-summary`，且不再包含可见的 `assistant-loading-label`
10. 本次上线的行为收口：
   - `GET /v1/chat/state` 的 terminal overlap 判定改成按 run 历史基线与真实落盘覆盖关系收口，不再靠正文字符串猜当前轮是否已被 history 覆盖
   - 运行态 UI 改成单一助手消息上的“状态摘要 + loading + 最终正文 + 运行日志”模型，去掉旧的过程壳层
   - `/v1/chat/events` 的断流恢复改成 `state -> events -> state` 单一收口，不再出现“显示已恢复但实际卡死、刷新后结果蒸发”的假恢复
   - 运行态摘要固定为单行省略，loading 入口不再显示工具长文本，运行日志入口文案恢复正常中文

## 2026-04-23 Playground 任务面板体验增量发布记录

这次发布仍然不是整目录替换，而是沿用 GitHub 工作目录做增量更新；运行态继续留在 `~/ugk-claw-shared`，不碰 `.data/agent`、sidecar 登录态或日志目录。

实际结果：

1. 本地已验证 `npx tsc --noEmit`、`npm test`、`git diff --check`、`docker compose -f docker-compose.prod.yml config` 和 `npm run docker:chrome:check`
2. 本地 `main` 已推送到 GitHub：`42ef655f80ab7089c844a81a7bf896e78b6963d7`
3. 服务器进入 `~/ugk-claw-repo`，发布前 `HEAD` 为 `59b7e95`
4. 服务器先备份 sidecar 登录态：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260423-200708.tar.gz`
5. 服务器给旧 `HEAD` 打本地回滚 tag：`server-pre-deploy-20260423-200708`
6. 执行 `git pull --ff-only origin main`，从 `59b7e95` fast-forward 到 `42ef655`
7. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config` 验证生产 compose
8. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`
9. 发布后额外删除一次失败命令误生成的 `~/ugk-claw-repo/-C` 大文件，并重新执行 `up --build -d`，确认 Docker build context 从约 `1.4GB` 恢复到几十 KB
10. 发布后验收通过：
    - `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
    - `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/playground` 返回 `200`
    - 公网 `http://43.134.167.179:3000/healthz` 返回 `{"ok":true}`
    - 公网 `http://43.134.167.179:3000/playground` 返回 `200`
    - 页面源码包含 `rows="1"`、`task-inbox-result-bubble` 和三类面板透明头部样式；不再包含任务消息、文件库、后台任务管理器的旧说明句
    - `check-deps.mjs` 返回 `host-browser: ok (http://172.31.250.10:9223)` 与 `proxy: ready (127.0.0.1:3456)`
    - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，`ugk-pi-browser-cdp` 与 `ugk-pi-conn-worker` 正常运行

本次额外踩到一个老坑的新皮肤：

- 第一次远程发布命令被 Windows PowerShell 抢先解析 `$(date ...)`，导致远端 `tar` 参数错位，在仓库根目录生成了一个 `-C` 大文件。该文件已删除，并已在删除后重新构建镜像。后续远程发布脚本继续用单引号包住整段 SSH 命令，别再让本机 shell 替远端 shell 表演。
- 删除 `-C` 并重新构建前，nginx 曾短暂返回 `502`；直接容器健康和重新构建后验收均已恢复。这不是 nginx 配置变更，本次没有改 `deploy/nginx/default.conf`，无需额外 `--force-recreate nginx`。

## 2026-04-23 任务消息与标准上传增量发布记录

这次发布仍然不是整目录替换，而是沿用 GitHub 工作目录做增量更新；运行态继续留在 `~/ugk-claw-shared`，不要把 `.data`、sidecar 登录态或日志拖回仓库目录里。

实际结果：

1. 本地已验证 `npx tsc --noEmit`、`git diff --check`、`npm test`
2. 本地 `main` 已推送到 GitHub：`4b78f21f514dc81c7e93b7be5b105ff34320afdc`
3. 服务器进入 `~/ugk-claw-repo`，发布前 `HEAD` 为 `bbd8735`
4. 服务器先备份 sidecar 登录态：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260423-180038.tar.gz`
5. 服务器给旧 `HEAD` 打本地回滚 tag：`server-pre-deploy-20260423-180038`
6. 执行 `git pull --ff-only origin main`，从 `bbd8735` fast-forward 到 `4b78f21`
7. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config` 验证生产 compose
8. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`
9. 发布后发现 nginx 容器仍持有旧单文件 bind mount inode，容器内 `client_max_body_size` 仍是 `4m`；已执行 `docker compose ... up -d --force-recreate nginx` 只重建 nginx，确认容器内配置变为 `client_max_body_size 80m`
10. 发布后验收通过：
    - `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
    - `curl -I http://127.0.0.1:3000/playground` 返回 `HTTP/1.1 200 OK`
    - 公网 `http://43.134.167.179:3000/healthz` 返回 `{"ok":true}`
    - 公网 `http://43.134.167.179:3000/playground` 返回 `200`
    - `check-deps.mjs` 返回 `host-browser: ok (http://172.31.250.10:9223)` 与 `proxy: ready (127.0.0.1:3456)`
    - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，`ugk-pi-browser-cdp` 与 `ugk-pi-conn-worker` 正常运行
    - `GET /v1/activity/summary` 返回任务消息未读数，`GET /playground` 页面源码包含 `mobile-overflow-task-inbox-badge`、`task-inbox-filter-unread-button` 和 `/v1/assets/upload`
    - 空 multipart 上传探针返回 `400 BAD_REQUEST` / `the request is not multipart`，说明新上传入口在线且由应用层接管错误

本次额外踩到两个小坑：

- 远端 `git tag -m "..."` 的 message 引号被 shell 拆词，第一次在打 tag 阶段报 `fatal: too many arguments`；当时尚未执行 `git pull` 和 `compose up`，没有进入部署阶段。后续改用无空格 tag message 继续。
- nginx 单文件 bind mount 在 `git pull` 后可能继续挂着旧 inode，宿主文件已经是 `80m`，容器内仍可能是旧 `4m`。以后凡是改 `deploy/nginx/default.conf`，发布后必须 `--force-recreate nginx` 并用 `nginx -T | grep client_max_body_size` 验证，别以为 `up --build -d` 一定会替你重建 nginx。

## 2026-04-23 viewMessages 会话状态增量发布记录

这次发布仍然不是整目录替换，而是沿用 GitHub 工作目录做增量更新；运行态继续留在 `~/ugk-claw-shared`，不要把 `.data`、sidecar 登录态或日志拖回仓库目录里。

实际结果：

1. 本地已验证 `npx tsc --noEmit`、`npm test`、`docker compose -f docker-compose.prod.yml config`
2. 本地 `main` 已推送到 GitHub：`b896f05b303bdb210073743e83ee1c74a14c19b4`
3. 服务器进入 `~/ugk-claw-repo`，发布前 `HEAD` 为 `0a34e81c2b81b93c7e459dfdae90a6e01c5a790f`
4. 服务器先备份 sidecar 登录态：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260423-113909.tar.gz`
5. 服务器给旧 `HEAD` 打本地回滚 tag：`server-pre-deploy-20260423-113909`
6. 执行 `git pull --ff-only origin main`，从 `0a34e81` fast-forward 到 `b896f05`
7. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config` 验证生产 compose
8. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`
9. 发布后验收通过：
   - `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - `curl -I http://127.0.0.1:3000/playground` 返回 `HTTP/1.1 200 OK`
   - 公网 `http://43.134.167.179:3000/healthz` 返回 `{"ok":true}`
   - 公网 `http://43.134.167.179:3000/playground` 返回 `HTTP/1.1 200 OK`
   - `check-deps.mjs` 返回 `host-browser: ok (http://172.31.250.10:9223)` 与 `proxy: ready (127.0.0.1:3456)`
   - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` 健康，`ugk-pi-browser-cdp` 与 `ugk-pi-conn-worker` 正常运行
   - `GET /v1/chat/state` 已返回 `viewMessages` 字段，当前会话状态接口结构与本次会话渲染收口一致

发布过程额外踩到一个 Windows 小坑：PowerShell here-string 会把 CRLF 带进远程脚本，导致 `docker compose` 收到异常参数并报 `unknown shorthand flag: '\r' in -`。处理方式是把远程发布动作改成单行 SSH 命令后重跑；第一次失败发生在 `git pull` 已成功、compose 部署尚未开始之后，最终重跑 `config` 与 `up --build -d` 已通过。别把这个报错当成 Docker 玄学，锅在本机命令封装。

## 2026-04-23 桌面与移动体验增量发布记录

这次发布仍然不是整目录替换，而是沿用 GitHub 工作目录做增量更新。

实际结果：
1. 本地已验证 `npx tsc --noEmit`、`npm test`、`docker compose -f docker-compose.prod.yml config`
2. 本地 `main` 已推送到 GitHub：`0a34e81c2b81b93c7e459dfdae90a6e01c5a790f`
3. 服务器进入 `~/ugk-claw-repo`
4. 服务器先备份 sidecar 登录态：`/home/ubuntu/ugk-claw-shared/backups/chrome-sidecar-20260423-014636.tar.gz`
5. 服务器给旧 `HEAD` 打本地回滚 tag：`server-pre-deploy-20260423-014636`
6. 执行 `git pull --ff-only origin main`，从 `21f1a5a` fast-forward 到 `0a34e81`
7. 执行 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`
8. 发布后验收通过：
   - `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - `curl -I http://127.0.0.1:3000/playground` 返回 `HTTP/1.1 200 OK`
   - 公网 `http://43.134.167.179:3000/healthz` 返回 `{"ok":true}`
   - 公网 `http://43.134.167.179:3000/playground` 返回 `HTTP/1.1 200 OK`
   - `check-deps.mjs` 返回 `host-browser: ok (http://172.31.250.10:9223)` 与 `proxy: ready (127.0.0.1:3456)`
   - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` 健康，`ugk-pi-browser-cdp` 与 `ugk-pi-conn-worker` 正常运行

发布过程踩到两个小坑：
- Windows PowerShell 会抢先解析双引号里的 `$(date ...)`，远程 SSH 发布脚本要用单引号包住整段远程命令，别把本机 shell 和远端 shell 混成一锅粥。
- live sidecar profile 正在写入时，普通 `tar` 可能因为 `file changed as we read it` 返回失败；在线备份可使用 `tar --ignore-failed-read --warning=no-file-changed --warning=no-file-ignored ...`，不要为了备份登录态反手停掉浏览器。

## 2026-04-22 最新增量发布记录

这次发布不是整目录替换，而是沿用 GitHub 工作目录做的增量更新。

实际顺序：

1. 本地先跑 `npx tsc --noEmit`、`npm test`
2. 本地额外跑 `docker compose -f docker-compose.prod.yml config`
3. 打 tag：
   - `snapshot-20260422-v4.1.1-stable`
   - 后来发现生产 compose 语法问题后，补发 `snapshot-20260422-v4.1.2-stable`
4. 服务器先备份 sidecar 登录态
5. 服务器给旧 `HEAD` 打 `server-pre-deploy-*` 本地 tag
6. `git pull --ff-only origin main`
7. `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`
8. 发布后验证：
   - `curl -fsS http://127.0.0.1:3000/healthz`
   - `curl -I http://127.0.0.1:3000/playground`
   - `check-deps.mjs`
   - `docker compose ... ps`

这次真正卡住发布的根因不是服务器，也不是 Docker 版本，而是仓库里的 [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml) 写坏了：

```text
yaml: line 38, column 16: mapping values are not allowed in this context
```

所以后面别再跳过本地的 `docker compose -f docker-compose.prod.yml config`。这种坑不值得在线上现学现卖。

## 历史代码传输方式

当前代码主仓库地址：

```text
https://github.com/mhgd3250905/ugk-claw-personal.git
```

历史上这台新加坡 CVM 直接访问 Gitee 很慢，曾出现：

```text
Receiving objects: 37% ..., 9.00 KiB/s
```

Gitee archive zip 也曾下载到半截，解压时报：

```text
End-of-central-directory signature not found
```

所以在服务器仍是 tar 解包目录的阶段，更稳的方式一直是：本地打包 `git archive`，再上传到服务器。

本地打包：

```bash
git archive --format=tar.gz -o ugk-pi-deploy.tar.gz HEAD
```

上传到服务器：

```bash
scp E:\AII\ugk-pi\ugk-pi-deploy.tar.gz ubuntu@43.134.167.179:/home/ubuntu/
```

服务器解包：

```bash
cd ~
rm -rf ugk-pi-claw ugk-pi-claw.zip
mkdir ugk-pi-claw
tar -xzf ugk-pi-deploy.tar.gz -C ugk-pi-claw
cd ugk-pi-claw
ls
```

本次解包后确认包含：

```text
AGENTS.md
Dockerfile
README.md
deploy/
docker-compose.yml
docker-compose.prod.yml
docs/
package.json
package-lock.json
public/
runtime/
scripts/
src/
test/
tsconfig.json
```

## shared 运行态目录

当前服务器把生产运行态统一收进：

```text
/home/ubuntu/ugk-claw-shared
```

当前建议结构：

```text
~/ugk-claw-shared/
├─ app.env
├─ compose.env
├─ .data/
│  ├─ agent/
│  └─ chrome-sidecar/
└─ logs/
   ├─ app/
   └─ nginx/
```

其中：

- `app.env` 保存应用真实环境变量和密钥
- `compose.env` 保存 compose 级路径和端口变量
- `.data/agent` 保存 playground 历史会话、session、资产索引、conn 与飞书映射等 app 运行态
- `.data/chrome-sidecar` 保存 sidecar Chrome 登录态
- `logs/` 保存 app 与 nginx 日志
- 历史上 repo 目录里 root-owned 的旧 `logs/` 已归档到 `~/ugk-claw-shared/backups/repo-logs-from-repo-20260420-112034`，不要再回头在 `~/ugk-claw-repo/logs` 找生产日志

## 服务器 app.env

服务器应用环境文件放在：

```text
/home/ubuntu/ugk-claw-shared/app.env
```

模板如下，真实 key 不要写进仓库和文档：

```dotenv
DASHSCOPE_CODING_API_KEY=<填真实 DashScope Key>

HOST=0.0.0.0
PORT=3000
HOST_PORT=3000
PUBLIC_BASE_URL=http://43.134.167.179:3000

WEB_ACCESS_BROWSER_GUI_PORT=3901
WEB_ACCESS_BROWSER_PROFILE_DIR=/config/chrome-profile-sidecar
WEB_ACCESS_BROWSER_PUBLIC_BASE_URL=http://ugk-pi:3000
WEB_ACCESS_BROWSER_PROVIDER=direct_cdp
WEB_ACCESS_CDP_HOST=172.31.250.10
WEB_ACCESS_CDP_PORT=9223

FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_API_BASE=https://open.feishu.cn/open-apis
```

建议权限：

```bash
chmod 600 ~/ugk-claw-shared/app.env
```

关键点：

- `PUBLIC_BASE_URL` 是用户浏览器可访问地址。
- `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL` 是 sidecar Chrome 在容器网络里访问 app 的地址。
- sidecar Chrome 里的 `127.0.0.1` 指向浏览器容器自己，不是 `ugk-pi` 容器，所以这里必须是 `http://ugk-pi:3000`。
- `WEB_ACCESS_CDP_HOST=172.31.250.10` 是当前 compose 下 CDP relay 的固定口径；改 compose 网络时要重新验证。

## 服务器 compose.env

服务器 compose 级变量放在：

```text
/home/ubuntu/ugk-claw-shared/compose.env
```

模板如下：

```dotenv
UGK_APP_ENV_FILE=/home/ubuntu/ugk-claw-shared/app.env
UGK_APP_LOG_DIR=/home/ubuntu/ugk-claw-shared/logs/app
UGK_AGENT_DATA_DIR=/home/ubuntu/ugk-claw-shared/.data/agent
UGK_NGINX_LOG_DIR=/home/ubuntu/ugk-claw-shared/logs/nginx
UGK_BROWSER_CONFIG_DIR=/home/ubuntu/ugk-claw-shared/.data/chrome-sidecar
HOST_PORT=3000
WEB_ACCESS_BROWSER_GUI_PORT=3901
```

`UGK_AGENT_DATA_DIR` 必须存在并挂到容器 `/app/.data/agent`。这里保存的是 `conversation-index.json`、`sessions/`、`asset-index.json`、`conn/` 等真正的 agent 状态；如果漏掉它，`up --build -d` 重建 app 容器后历史会话会直接消失，这不是前端没显示，是状态被放在容器可写层里了。

建议权限：

```bash
chmod 600 ~/ugk-claw-shared/compose.env
```

## 首次启动

服务器执行：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
```

查看容器：

```bash
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml ps
```

本次成功状态包含：

```text
ugk-pi-claw-nginx-1                Up ... healthy   0.0.0.0:3000->80/tcp
ugk-pi-claw-ugk-pi-1               Up ... healthy   3000/tcp
ugk-pi-claw-ugk-pi-browser-1       Up               127.0.0.1:3901->3001/tcp
ugk-pi-claw-ugk-pi-browser-cdp-1   Up
```

## 验证清单

服务健康检查：

```bash
curl -i http://127.0.0.1:3000/healthz
```

预期：

```text
HTTP/1.1 200 OK

{"ok":true}
```

playground 页面：

```bash
curl -I http://127.0.0.1:3000/playground
```

预期：

```text
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
cache-control: no-store, no-cache, must-revalidate
```

web-access / Chrome sidecar 链路：

```bash
docker compose --env-file ~/ugk-claw-shared/compose.env -f docker-compose.prod.yml exec -T ugk-pi node /app/runtime/skills-user/web-access/scripts/check-deps.mjs
```

预期：

```text
host-browser: ok (http://172.31.250.10:9223)
proxy: starting
proxy: ready (127.0.0.1:3456)
```

如果你怀疑 sidecar 只是 GUI 活着、CDP 其实没起来，直接核：

```bash
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml ps
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi-browser sh -lc "curl -fsS http://127.0.0.1:9222/json/version"
```

期望是 `ugk-pi-browser` 进入 `healthy`，并且容器内 `9222` 能返回 JSON。只会看 GUI，不看 CDP，本质上就是在闭眼运维。

公网验证：

```text
http://43.134.167.179:3000/playground
```

本次用户已确认：公网 playground 可以正常对话。

## Chrome sidecar 登录态

sidecar GUI 入口只通过 SSH tunnel 访问：

```bash
ssh -L 13901:127.0.0.1:3901 ubuntu@43.134.167.179
```

本机打开：

```text
https://127.0.0.1:13901/
```

本次曾尝试：

```bash
ssh -L 3901:127.0.0.1:3901 ubuntu@43.134.167.179
```

本机报错：

```text
bind [127.0.0.1]:3901: Permission denied
```

处理方式：换本地端口，例如 `13901`。远端仍然是 `127.0.0.1:3901`。

登录态持久化目录：

```text
/home/ubuntu/ugk-claw-shared/.data/chrome-sidecar
```

正常 `git pull --ff-only origin main` 再 `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`，不应该把登录态洗掉。原因不是玄学，是这两条约束同时成立：

- sidecar profile 真正挂在 `~/ugk-claw-shared/.data/chrome-sidecar`，而不是 repo 目录。
- sidecar GUI 桌面启动器和 agent/CDP 控制的 Chrome 已经统一走 `WEB_ACCESS_BROWSER_PROFILE_DIR=/config/chrome-profile-sidecar`。

所以如果更新后看起来像“浏览器全失忆”，先怀疑浏览器容器没吃到新 launcher，或者你看的 GUI 还是旧窗口，不要第一时间把锅甩给 shared 目录。

建议在改动浏览器链路前先备份一份 sidecar profile：

```bash
cd ~/ugk-claw-repo
mkdir -p ~/ugk-claw-shared/backups
tar --ignore-failed-read --warning=no-file-changed --warning=no-file-ignored -czf ~/ugk-claw-shared/backups/chrome-sidecar-$(date +%Y%m%d-%H%M%S).tar.gz -C ~/ugk-claw-shared/.data chrome-sidecar
```

如果后续 X 搜索、网页登录态异常，先确认：

- SSH tunnel 是否还开着。
- sidecar GUI 里是否仍然登录。
- `~/ugk-claw-shared/.data/chrome-sidecar` 是否被误删。
- compose 是否仍然使用同一个 `WEB_ACCESS_BROWSER_PROFILE_DIR`。

如果 GUI 和 agent 看起来像两套登录态，再补 3 个硬检查：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi-browser sh -lc "curl -fsS http://127.0.0.1:9222/json/version"
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi-browser sh -lc "grep -n '^Exec=' /usr/share/applications/google-chrome.desktop /usr/share/applications/com.google.Chrome.desktop"
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi-browser sh -lc "ps -ef | grep '[c]hrome-profile-sidecar'"
```

期望是：

- `9222` 返回 JSON；
- 两个 launcher 都指向 `/usr/local/bin/ugk-sidecar-chrome`；
- 进程里能看到 `chrome-profile-sidecar`。

如果这里不对，就别继续自欺欺人刷新 GUI 了，先重建浏览器栈：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate ugk-pi-browser ugk-pi-browser-cdp ugk-pi
```

## 本次线上故障记录

### `crypto.randomUUID is not a function`

首次公网访问 playground 时报：

```text
playground:3958 Uncaught TypeError: crypto.randomUUID is not a function
    at resetConversation (playground:3958:53)
```

根因：

- 当前公网入口是 `http://43.134.167.179:3000`，不是 HTTPS。
- `crypto.randomUUID()` 在部分浏览器 / 非安全上下文里不可用。
- 页面初始化时直接调用，导致 playground 无法正常发送消息。

修复：

- Commit：`01c0796 fix: support playground ids over http`
- `src/ui/playground.ts` 新增 `createBrowserId()` / `createConversationId()`
- 优先 `crypto.randomUUID()`
- fallback 到 `crypto.getRandomValues()`
- 最后 fallback 到 `Date.now()` + `Math.random()`
- `test/server.test.ts` 增加回归断言

本地验证：

```bash
npm test
# 120 pass / 0 fail
```

服务器当时是 tar 解包目录，没有 `.git`，所以采用单文件应急覆盖：

```bash
cd ~/ugk-pi-claw
cp src/ui/playground.ts /tmp/playground.ts.bak
curl -fL --retry 5 --retry-delay 2 \
  -o src/ui/playground.ts \
  https://gitee.com/ksheng3250905/ugk-pi-claw/raw/main/src/ui/playground.ts
docker compose -f docker-compose.prod.yml up --build -d
```

这只是应急修法。长期更新不要靠单文件热修，否则很快变成“线上到底是什么代码”的灵魂拷问。

## 后续更新部署流程

先定一条硬规则：

- 后续 agent 或人工代操作服务器更新时，必须先确认本次是“增量更新”还是“整目录替换”。
- 默认优先选择“增量更新”。
- 没有得到明确确认前，不要默认走“整目录替换”。

原因很简单：这台服务器上除了仓库代码，还有用户后来安装的 skills、agents、本地登录态和 `.data`。整目录替换如果只记得带 `.env`，大概率就会把这些本地状态一起抹掉。

### 历史方式：本地打包上传

这是迁移前的旧方式，保留在这里仅用于解释历史背景。迁移前云服务器上的 `~/ugk-pi-claw` 是 tar 解包目录，不是 Git 仓库。也就是说：

- 本机负责 `git archive` 打包。
- 服务器负责接收 tar 包、替换目录、重建容器。
- 不要在服务器 `~/ugk-pi-claw` 里执行 `git archive` 或 `git pull`，它没有 `.git`，执行了也只会报 `fatal: not a git repository`。别跟它较劲，它确实不是仓库。

本地：

```bash
cd E:\AII\ugk-pi
git archive --format=tar.gz -o ugk-pi-deploy.tar.gz HEAD
scp E:\AII\ugk-pi\ugk-pi-deploy.tar.gz ubuntu@43.134.167.179:/home/ubuntu/
```

服务器：

```bash
cd ~
rm -rf ugk-pi-claw-next
mkdir ugk-pi-claw-next
tar -xzf ugk-pi-deploy.tar.gz -C ugk-pi-claw-next
cp ugk-pi-claw/.env ugk-pi-claw-next/.env
mv ugk-pi-claw ugk-pi-claw-prev-$(date +%Y%m%d-%H%M%S)
mv ugk-pi-claw-next ugk-pi-claw
cd ugk-pi-claw
docker compose -f docker-compose.prod.yml up --build -d
```

这里必须使用 `up --build -d`。只 `restart` 只会重启旧镜像里的旧容器，像 `python3` 这种写进 `Dockerfile` 的环境变更不会凭空出现。

更新后必须跑：

```bash
docker compose -f docker-compose.prod.yml ps
curl -i http://127.0.0.1:3000/healthz
curl -I http://127.0.0.1:3000/playground
docker compose -f docker-compose.prod.yml exec -T ugk-pi python3 --version
docker compose -f docker-compose.prod.yml exec -T ugk-pi node /app/runtime/skills-user/web-access/scripts/check-deps.mjs
```

本次 `python3` 运行环境更新的服务器实测结果：

```text
Image ugk-pi:prod                          Built
Container ugk-pi-claw-ugk-pi-1             Healthy

docker compose -f docker-compose.prod.yml exec -T ugk-pi python3 --version
Python 3.11.2

curl -i http://127.0.0.1:3000/healthz
HTTP/1.1 200 OK

docker compose -f docker-compose.prod.yml exec -T ugk-pi node /app/runtime/skills-user/web-access/scripts/check-deps.mjs
host-browser: ok (http://172.31.250.10:9223)
proxy: starting
proxy: ready (127.0.0.1:3456)
```

以后判断一次更新是否真的部署成功，至少要同时满足：

- `ugk-pi` 容器是 `healthy`。
- `/healthz` 返回 `HTTP/1.1 200 OK`。
- 如果改过 `Dockerfile` 或运行环境，必须验证对应命令，例如 `python3 --version`。
- 如果涉及 `web-access` / X 搜索 / Chrome sidecar，必须跑 `check-deps.mjs`。

### 当前推荐方式：GitHub git 更新

当前服务器目录已经迁成 Git 工作目录，默认更新方式就是：

```bash
cd ~/ugk-claw-repo
git pull --ff-only origin main
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
```

如果只是确认当前目录状态：

```bash
cd ~/ugk-claw-repo
git remote -v
git status --short
git rev-parse HEAD
```

迁移完成后的服务器实测结果：

```text
/home/ubuntu/ugk-claw-repo/.git 存在
docker inspect 显示 ugk-pi 与浏览器容器的 bind source 已指向 /home/ubuntu/ugk-claw-repo 与 /home/ubuntu/ugk-claw-shared
curl http://127.0.0.1:3000/healthz -> {"ok":true}
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi python3 --version -> Python 3.11.2
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi node /app/runtime/skills-user/web-access/scripts/check-deps.mjs -> host-browser ok
```

### 应急方式：单文件热修

仅用于线上小修复和确认问题，示例：

```bash
cd ~/ugk-pi-claw
cp src/ui/playground.ts /tmp/playground.ts.bak
curl -fL --retry 5 --retry-delay 2 \
  -o src/ui/playground.ts \
  https://gitee.com/ksheng3250905/ugk-pi-claw/raw/main/src/ui/playground.ts
docker compose -f docker-compose.prod.yml up --build -d
```

应急热修后，要尽快回到“本地提交 -> 推远程 -> 打包上传”的正式流程。

## 回滚

当前可用的回滚目录包括：

```text
/home/ubuntu/ugk-pi-claw
/home/ubuntu/ugk-pi-claw-pre-github-20260420-105142
/home/ubuntu/ugk-pi-claw-prev-20260419-231530
```

回滚示例：

```bash
cd ~
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml down
cd ~/ugk-pi-claw
docker compose -p ugk-pi-claw -f docker-compose.prod.yml up -d
```

回滚后同样必须执行验证清单。

## 常用运维命令

查看容器：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml ps
```

查看 app 日志：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml logs --tail=120 ugk-pi
```

查看 nginx 日志：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml logs --tail=120 nginx
```

重启 app：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml restart ugk-pi
```

重新构建并启动：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
```

检查磁盘：

```bash
df -h
docker system df
```

检查内存：

```bash
free -h
```

清理 Docker 构建缓存前先看占用，不要一上来 `prune -a`。这台机器只有一个核心服务，误删镜像最多只是重新拉，但线上排障时浪费时间也挺烦。

## 不要做的事

- 不要把真实 `DASHSCOPE_CODING_API_KEY` 写进仓库。
- 不要开放公网 `3901`。
- 不要开放公网 `9223`。
- 不要把 `.env`、`.data/`、`node_modules/`、临时 tar 包提交到 git。
- 不要把运行时截图、调试 HTML、`output/`、`tmp/` 这类本地产物继续塞进主仓库；GitHub 是代码事实源，不是垃圾回收站。
- 不要在服务器上长期依赖单文件热修。
- 不要把 `PUBLIC_BASE_URL` 和 `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL` 混用。
- 不要看到 Gitee clone 慢就反复 Ctrl+Z，停掉的 job 和半截目录会让下一次 clone 更乱。

## 本地临时文件说明

本次部署过程中出现过这些本地临时文件或目录，不应默认提交：

- `.gh-cli-config/`
- `output/`
- `tmp/`
- `server-install-docker.sh`
- `ugk-pi-deploy.tar.gz`

如果后续要把安装脚本产品化，应放到 `deploy/` 下并重新审查命名、参数和幂等性；不要把临时脚本直接当正式资产塞进去。
