# 阿里云 ECS 部署运行手册

本文记录 `ugk-pi / UGK CLAW` 在阿里云 ECS 上的首次部署事实、验证口径和后续接手注意事项。

这台机器目前是第二套公网部署环境，不是腾讯云新加坡环境的替代品。后续接手时先分清服务器，别把两台机器的目录、账号和公网 IP 混在一起，那种混法很快就会把运维变成猜谜。

## 当前部署快照

- 日期：`2026-04-27`
- 云厂商：阿里云 ECS
- 公网 IP：`101.37.209.54`
- SSH 用户：`root`
- 系统镜像：Ubuntu `22.04.5 LTS`
- 磁盘：系统盘约 `40G`
- 内存：约 `7.2Gi`
- 服务公网入口：`http://101.37.209.54:3000/playground`
- 健康检查入口：`http://101.37.209.54:3000/healthz`
- 生产 compose 文件：`docker-compose.prod.yml`
- 主部署目录：`/root/ugk-claw-repo`
- shared 运行态目录：`/root/ugk-claw-shared`
- 当前部署来源：本地 `git archive HEAD` 上传解包
- 当前部署基线：`4aeb01e Fix playground light theme runtime polish`

注意：阿里云首次部署时，服务器访问 GitHub 超时，`git clone` 未成功。因此 `/root/ugk-claw-repo` 当前是 archive 解包目录，不是 Git 工作目录。后续如果阿里云到 GitHub 网络恢复，可以迁回 git clone / pull；迁移前不要在这台机器上硬跑 `git pull`，它没有 `.git`，跑了也只是在跟空气较劲。

## 部署拓扑

```text
公网用户
  -> http://101.37.209.54:3000
  -> nginx container :80
  -> ugk-pi container :3000
  -> web-access direct_cdp
  -> ugk-pi-browser-cdp :9223
  -> Docker Chrome sidecar
```

Chrome sidecar GUI 只绑定宿主机本地回环：

```text
127.0.0.1:3901 -> ugk-pi-browser:3001
```

不要把 `3901` 或 `9223` 放到公网安全组。`3901` 是浏览器桌面，`9223` 是 CDP relay，公网开放这俩基本等于给陌生人递方向盘。

## 安全组

阿里云安全组入方向至少需要：

- TCP `22`：SSH 登录服务器。
- TCP `3000`：公网访问 playground。

当前公网访问已由用户确认可用：

```text
http://101.37.209.54:3000/playground
```

不要开放：

- TCP `3901`：Chrome sidecar GUI，仅允许 SSH tunnel。
- TCP `9223`：CDP relay，仅给容器网络内部使用。

nginx 入口必须保留 SSE 长连接配置：`proxy_read_timeout 600s`、`proxy_send_timeout 600s`、`proxy_buffering off`。改到 `deploy/nginx/default.conf` 后，不要只重启 app 容器；至少要重建或强制重建 nginx，否则长时间无 token 输出的聊天流仍可能被代理层提前断开。

## 运行态位置

运行态和代码目录分离：

```text
/root/ugk-claw-shared/app.env
/root/ugk-claw-shared/compose.env
/root/ugk-claw-shared/.data/agent
/root/ugk-claw-shared/.data/chrome-sidecar
/root/ugk-claw-shared/logs/app
/root/ugk-claw-shared/logs/nginx
/root/ugk-claw-shared/backups
```

`app.env` 内包含真实 `DASHSCOPE_CODING_API_KEY` 和 `DEEPSEEK_API_KEY`，不要打印、不要复制进文档、不要提交进仓库。

`compose.env` 当前口径：

```dotenv
UGK_APP_ENV_FILE=/root/ugk-claw-shared/app.env
UGK_APP_LOG_DIR=/root/ugk-claw-shared/logs/app
UGK_AGENT_DATA_DIR=/root/ugk-claw-shared/.data/agent
UGK_NGINX_LOG_DIR=/root/ugk-claw-shared/logs/nginx
UGK_BROWSER_CONFIG_DIR=/root/ugk-claw-shared/.data/chrome-sidecar
HOST_PORT=3000
WEB_ACCESS_BROWSER_GUI_PORT=3901
TZ=Asia/Shanghai
```

`UGK_AGENT_DATA_DIR` 必须挂到容器 `/app/.data/agent`。少了这条，重建容器后历史会话、session、资产和 conn 数据会跟着容器可写层一起蒸发。别问为什么历史没了，答案通常就是这里没挂。

## 首次部署记录

首次部署已完成：

1. 用 `root` SSH 登录 `101.37.209.54`。
2. 安装 Docker：`docker.io`。
3. 安装 Compose v2：`docker-compose-v2`。
4. 因 GitHub 连接超时，改用本地 `git archive` 打包上传到 `/root/ugk-claw-deploy.tar.gz`。
5. 解包到 `/root/ugk-claw-repo`。
6. 创建 `/root/ugk-claw-shared` 下的 env、data、logs、backups 目录。
7. 写入 `app.env` 和 `compose.env`。
8. 配置 Docker registry mirrors，缓解 Docker Hub 拉取超时。
9. 执行生产 compose 构建与启动。
10. 阿里云安全组放行 TCP `3000`。

当前 Docker 镜像拉取曾遇到的问题：

- `docker.io/alpine/socat:latest` 拉取超时。
- `lscr.io/linuxserver/chrome:latest` 体积较大，首次拉取较慢。
- 构建阶段访问 Debian 官方源很慢，`apt-get install` 等待时间很长。
- `ugk-pi` 和 `ugk-pi-conn-worker` 并行构建同名镜像 `ugk-pi:prod` 时出现过 `image already exists`，后续使用 `COMPOSE_PARALLEL_LIMIT=1` 串行构建规避。

这次没有把 Dockerfile 改成阿里云 apt 源；只是等官方源构建完成。后续如果阿里云构建仍然慢，可以正式给 Dockerfile 增加可配置 apt mirror，而不是继续在服务器上手改临时补丁。

## 2026-04-27 浅色用户气泡与 SSE 稳定性增量发布记录

这次发布继续使用 archive 增量更新代码目录；`/root/ugk-claw-shared` 运行态目录保持原样，没有触碰 agent 会话、资产、conn 数据或 sidecar 登录态。

实际结果：
1. 本地提交并推送 `4aeb01e Fix playground light theme runtime polish`。
2. 本地执行 `git archive --format=tar.gz -o $env:TEMP\ugk-claw-aliyun-deploy.tar.gz HEAD`，生成当前提交的部署包。
3. 本机 `ssh/scp` 起初因阿里云没有配置无交互 key 被 `Permission denied (publickey,password)` 拦住；确认 `阿里-config.txt` 中保存的是 root 密码后，改用 `paramiko` 读取密码并通过 SFTP 上传 `/root/ugk-claw-deploy.tar.gz`，没有把密码写入命令行参数或输出日志。
4. 服务器备份 sidecar 登录态到 `/root/ugk-claw-shared/backups/chrome-sidecar-20260427-210929.tar.gz`。
5. 服务器解包到 `/root/ugk-claw-repo-next`，合并旧目录下可能存在的 `runtime/skills-user` 与 `runtime/agents-user` 后，将旧代码目录移动为 `/root/ugk-claw-repo-prev-20260427-210929`，再把 next 目录切到 `/root/ugk-claw-repo`。
6. 执行 `COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet`。
7. 执行 `COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`，重建 `ugk-pi` 与 `ugk-pi-conn-worker`。
8. 因本次包含 `deploy/nginx/default.conf` SSE 长连接配置，额外执行 `docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx`。
9. 发布后验收通过：
   - 服务器内网 `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - 公网 `http://101.37.209.54:3000/healthz` 返回 `{"ok":true}`
   - 服务器内网 `/playground` 源码包含 `message.user` 与 `2454d6`，确认浅色用户气泡样式已上线
   - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，`ugk-pi-browser-cdp` 与 `ugk-pi-conn-worker` 正常运行
   - `check-deps.mjs` 返回 `host-browser: ok (http://172.31.250.10:9223)` 与 `proxy: ready (127.0.0.1:3456)`

这次额外证明：阿里云当前仍不是 Git 工作目录，不能照抄腾讯云 `git pull`；同时本机没有阿里云 SSH key 时，普通 `scp` 会卡在密码交互。后续要么给 `root@101.37.209.54` 配置 SSH key 和本机别名，要么继续走读取本地密码文件的非交互发布脚本，别让交互式密码提示把自动部署卡成沉默超时。

## 2026-04-27 Playground 运行日志分页增量发布记录

这次发布继续使用小包 archive 增量更新代码目录，只覆盖运行日志分页相关源码、测试和文档文件；`/root/ugk-claw-shared` 运行态目录保持原样，没有触碰 agent 会话、资产、conn 数据或 sidecar 登录态。

实际结果：
1. 本地提交主题为 `Tighten playground light UI spacing`，本次功能内容为当前任务运行日志 / 后台任务过程日志倒序分页、滚动增量加载、正文增量过滤、单条详情截断与浅色主题可读样式；发布后继续 amend 追加部署记录，最终本地 `HEAD` 以 `git log` 为准。
2. 本地执行 `git archive --format=tar.gz -o runtime/playground-log-pagination-incremental.tar.gz HEAD ...`，只打包本轮相关文件，避免把本地未推送的 `bugs/` 捕获报告带上生产。
3. 通过 `paramiko` 读取本地密码文件并 SFTP 上传 `/root/playground-log-pagination-incremental.tar.gz`，没有把密码写入命令行参数或输出日志。
4. 服务器在 `/root/ugk-claw-repo` 内执行 `tar -xzf /root/playground-log-pagination-incremental.tar.gz -C /root/ugk-claw-repo` 增量覆盖源码。
5. 执行 `COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet`。
6. 执行 `COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`，重建 `ugk-pi` 与 `ugk-pi-conn-worker`。
7. 首次验收 `http://127.0.0.1:3000/healthz` 持续返回 `502`，排查确认 `ugk-pi` 容器为 healthy、nginx 容器为 unhealthy；按既有口径执行 `docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx`，恢复入口。
8. 发布后验收通过：
   - 服务器内网 `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - 服务器内网 `/playground` 源码包含 `const RUN_LOG_PAGE_SIZE = 2;`
   - 服务器内网 `/playground` 源码包含 `loadMoreChatRunLog`
   - 服务器内网 `/playground` 源码包含 `const CONN_RUN_LOG_PAGE_SIZE = 2;`
   - 服务器内网 `/playground` 源码包含 `loadMoreConnRunEvents`
   - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，`ugk-pi-browser-cdp` 与 `ugk-pi-conn-worker` 正常运行

## 常用命令

登录：

```bash
ssh root@101.37.209.54
```

查看状态：

```bash
cd /root/ugk-claw-repo
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml ps
```

启动 / 重建：

```bash
cd /root/ugk-claw-repo
COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
```

看 app 日志：

```bash
cd /root/ugk-claw-repo
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml logs --tail=120 ugk-pi
```

看 browser sidecar 日志：

```bash
cd /root/ugk-claw-repo
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml logs --tail=120 ugk-pi-browser ugk-pi-browser-cdp
```

## 验收清单

服务器内网健康检查：

```bash
curl -fsS http://127.0.0.1:3000/healthz
```

预期：

```json
{"ok":true}
```

服务器内网页面入口：

```bash
curl -I http://127.0.0.1:3000/playground
```

预期：

```text
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
```

公网入口：

```text
http://101.37.209.54:3000/playground
```

用户已确认公网 playground 可访问。

compose 成功状态样例：

```text
ugk-pi-claw-nginx-1                Up ... healthy   0.0.0.0:3000->80/tcp
ugk-pi-claw-ugk-pi-1               Up ... healthy   3000/tcp
ugk-pi-claw-ugk-pi-browser-1       Up ... healthy   127.0.0.1:3901->3001/tcp
ugk-pi-claw-ugk-pi-browser-cdp-1   Up
ugk-pi-claw-ugk-pi-conn-worker-1   Up
```

web-access / Chrome sidecar 验收：

```bash
cd /root/ugk-claw-repo
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi node /app/runtime/skills-user/web-access/scripts/check-deps.mjs
```

## sidecar GUI

通过 SSH tunnel 打开：

```bash
ssh -L 13902:127.0.0.1:3901 root@101.37.209.54
```

本机浏览器打开：

```text
https://127.0.0.1:13902/
```

如果本机 `13902` 被占用，换一个本地端口即可。远端仍然是 `127.0.0.1:3901`。

## 后续更新方式

因为当前 `/root/ugk-claw-repo` 不是 Git 工作目录，阿里云后续更新暂时使用 archive 上传：

本地：

```powershell
git archive --format=tar.gz -o $env:TEMP\ugk-claw-aliyun-deploy.tar.gz HEAD
```

上传并解包时要保留 shared 运行态，不要删除 `/root/ugk-claw-shared`。
如果后续在阿里云机器上安装过 `runtime/skills-user` 或 `runtime/agents-user` 这类运行时扩展，也要在替换代码目录前单独备份并合回。当前首次部署是干净环境，但以后别把“现在没有”当成“永远没有”。

服务器：

```bash
cd /root
mkdir -p ugk-claw-repo-next
tar -xzf /root/ugk-claw-deploy.tar.gz -C /root/ugk-claw-repo-next
if [ -d /root/ugk-claw-repo/runtime/skills-user ]; then mkdir -p /root/ugk-claw-repo-next/runtime && cp -a /root/ugk-claw-repo/runtime/skills-user /root/ugk-claw-repo-next/runtime/; fi
if [ -d /root/ugk-claw-repo/runtime/agents-user ]; then mkdir -p /root/ugk-claw-repo-next/runtime && cp -a /root/ugk-claw-repo/runtime/agents-user /root/ugk-claw-repo-next/runtime/; fi
mv /root/ugk-claw-repo /root/ugk-claw-repo-prev-$(date +%Y%m%d-%H%M%S)
mv /root/ugk-claw-repo-next /root/ugk-claw-repo
cd /root/ugk-claw-repo
COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
```

这看起来像整目录替换，但替换的是代码解包目录，不是 shared 运行态目录。真正不能碰的是 `/root/ugk-claw-shared`，以及后续可能由用户安装在 `runtime/` 下的扩展。后续如果迁移成 Git 工作目录，再把更新流程改为 `git pull --ff-only origin main`。

## 不要做的事

- 不要提交 `阿里-config.txt`。
- 不要把 `app.env` 里的真实 key 写进文档或聊天。
- 不要删除 `/root/ugk-claw-shared`。
- 不要开放公网 `3901` 或 `9223`。
- 不要在当前阿里云目录里直接跑 `git pull`，除非已经确认 `.git` 存在。
- 不要把腾讯云的 `ubuntu@43.134.167.179` 命令原样粘到阿里云机器上；阿里云是 `root@101.37.209.54`。
## 2026-04-27 Playground ASCII 品牌增量发布记录

本次发布继续使用 archive 小包增量覆盖 `/root/ugk-claw-repo`，没有执行整目录替换，也没有触碰 `/root/ugk-claw-shared` 下的 `.data/agent`、sidecar 登录态、资产、conn 或日志。阿里云当前目录仍不是 Git 工作目录，不要照抄腾讯云 `git pull`。

实际结果：
1. 本地提交：`66dcae1 Unify playground ASCII branding`。
2. 本地生成增量包：`runtime/playground-ascii-branding-incremental.tar.gz`，只包含 playground ASCII 品牌相关源码、测试和文档。
3. 通过本地 `*config.txt` 中的 root 密码用 `paramiko` SFTP 上传到 `/root/playground-ascii-branding-incremental.tar.gz`，密码没有写入命令行参数或输出日志。
4. 服务器在 `/root/ugk-claw-repo` 内执行 `tar -xzf /root/playground-ascii-branding-incremental.tar.gz -C /root/ugk-claw-repo` 增量覆盖对应文件。
5. 执行 `COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet` 通过。
6. 执行 `COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d` 重建 `ugk-pi` 和 `ugk-pi-conn-worker`。
7. 最终验收通过：
   - 服务器内网 `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - 公网 `curl -fsS http://101.37.209.54:3000/healthz` 返回 `{"ok":true}`
   - `/playground` 源码包含 `mobile-brand-logo desktop-brand`、`ugk-ascii-logo-topbar`、`chat-stage-watermark`
   - `/playground` 源码不再包含 `ugk-ascii-logo-mobile` 或 `ugk-claw-mobile-logo.png`
   - `docker compose ... ps` 显示 nginx、ugk-pi、ugk-pi-browser healthy，CDP relay 与 conn-worker 正常运行
## 2026-04-28 Playground 外部化增量发布记录

本次发布继续使用 archive 小包增量覆盖 `/root/ugk-claw-repo`，没有执行整目录替换，也没有触碰 `/root/ugk-claw-shared` 下的 `.data/agent`、sidecar 登录态、资产、conn 或日志。阿里云当前目录仍不是 Git 工作目录，不要照抄腾讯云 `git pull`。

实际结果：
1. GitHub 已推送到 `b288853 Pass playground externalized flag to containers`。
2. 本地生成增量包 `runtime/playground-externalized-b288853-incremental.tar.gz`，包含 playground 外部化源码、项目级 skill、测试、文档与 `docker-compose.prod.yml`。
3. 通过本地 `*config.txt` 中的 root 密码用 `paramiko` SFTP 上传到 `/root/playground-externalized-b288853-incremental.tar.gz`，密码没有写入命令行参数或输出日志。
4. 服务器在 `/root/ugk-claw-repo` 内执行 `tar -xzf /root/playground-externalized-b288853-incremental.tar.gz -C /root/ugk-claw-repo` 增量覆盖对应文件。
5. 在 `/root/ugk-claw-shared/compose.env` 中设置 `PLAYGROUND_EXTERNALIZED=1`；`docker-compose.prod.yml` 已显式把该变量透传进 `ugk-pi` 与 `ugk-pi-conn-worker` 容器。
6. 执行 `docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet` 通过。
7. 执行 `COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d` 重建 `ugk-pi` 与 `ugk-pi-conn-worker`。
8. 首次验收公网入口返回 nginx `502`，应用容器内 `curl -fsS http://127.0.0.1:3000/healthz` 正常，随后执行 `docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx` 强制重建 nginx。
9. 最终验收通过：
   - 服务器内网 `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - 公网 `curl -fsS http://101.37.209.54:3000/healthz` 返回 `{"ok":true}`
   - `/playground` HTML 包含 `/playground/styles.css` 与 `/playground/app.js`
   - `/playground/styles.css` 包含 `.chat-stage`
   - 容器内 `PLAYGROUND_EXTERNALIZED=1`
   - 容器内存在 `.pi/skills/playground-runtime-ui/SKILL.md` 与 `runtime/playground/app.js`
   - `docker compose ... ps` 显示 nginx、ugk-pi、ugk-pi-browser healthy，CDP relay 与 conn-worker 正常运行

## 2026-04-28 Playground 外部化热加载边界增量发布记录

本次发布继续使用 archive 小包增量覆盖 `/root/ugk-claw-repo`，没有执行整目录替换，也没有触碰 `/root/ugk-claw-shared` 下的 `.data/agent`、sidecar 登录态、资产、conn 或日志。阿里云当前目录仍不是 Git 工作目录，不要照抄腾讯云 `git pull`。

实际结果：
1. 本地提交并推送 `52f51fd Clarify playground runtime UI hot reload boundary`。
2. 本地生成增量包 `runtime/playground-hot-reload-boundary-52f51fd-incremental.tar.gz`，只包含项目级 skill、playground 当前状态文档、change-log 和 bug 评估记录。
3. 通过本地 `*config.txt` 中的 root 密码用 `paramiko` SFTP 上传到 `/root/playground-hot-reload-boundary-52f51fd-incremental.tar.gz`，密码没有写入命令行参数或输出日志。
4. 服务器在 `/root/ugk-claw-repo` 内执行 `tar -xzf /root/playground-hot-reload-boundary-52f51fd-incremental.tar.gz -C /root/ugk-claw-repo` 增量覆盖对应文件。
5. 执行 `docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet` 通过。
6. 执行 `docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml restart ugk-pi`，只重启应用容器以重新加载项目级 skill。
7. 最终验收通过：
   - 服务器内网 `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - 公网 `curl -fsS http://101.37.209.54:3000/healthz` 返回 `{"ok":true}`
   - `.pi/skills/playground-runtime-ui/SKILL.md` 包含 `Do not claim \`src/ui/\` edits are zero-restart changes`
   - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，`ugk-pi-browser-cdp` 与 `ugk-pi-conn-worker` 正常运行
