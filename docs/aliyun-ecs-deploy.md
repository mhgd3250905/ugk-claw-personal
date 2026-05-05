# 阿里云 ECS 部署运行手册

本文记录 `ugk-pi / UGK CLAW` 在阿里云 ECS 上的首次部署事实、验证口径和后续接手注意事项。

这台机器目前是第二套公网部署环境，不是腾讯云新加坡环境的替代品。后续接手时先分清服务器，别把两台机器的目录、账号和公网 IP 混在一起，那种混法很快就会把运维变成猜谜。

如果你只想做后续发布，不要从历史记录里捞命令。固定流程看 [docs/server-ops.md](./server-ops.md)；阿里云当前固定口径已经切换为 Git 工作目录更新，默认 `git pull --ff-only gitee main`，只有 Gitee 不通且确认 GitHub 可用时才走 `git pull --ff-only origin main`。archive 小包只作为双远端都不可用时的兜底。

## 2026-05-06 文件库桌面 UI 细化发布记录

阿里云从 `538265b` fast-forward 到 `425227e`。浅色主题面板去背景、header 无边框。用户自定义技能（zhihu-helper、card-creator 等）未触碰。

## 2026-05-05 桌面工作区 UI 优化与 Agent 切换悬浮菜单发布记录

本次阿里云从 `b088620 Persist model source selection in runtime state` 通过 `gitee/main` fast-forward 增量更新到 `538265b`。发布走 clean Git 主流程，没有整目录覆盖，没有触碰 `/root/ugk-claw-shared` 运行态，阿里云 agent 区域开发结果（包括 `zhihu-helper`、`card-creator`、`volc-image-vision`、`wechat-helper`、`xhs-helper` 等自定义技能）均未被触碰。

实际结果：
1. 本地 `gitee/main` 已推送到 `538265b`。
2. 执行 `npm run server:ops -- aliyun preflight`，确认 `/root/ugk-claw-repo` 工作区干净、compose 配置和运行态挂载正常。
3. 执行 `npm run server:ops -- aliyun deploy`，服务器 fast-forward 到 `538265b`，重建并重启 `ugk-pi`、`ugk-pi-conn-worker`、`ugk-pi-feishu-worker`，nginx 已重启。
4. verify 通过：公网 `/healthz` 返回 `{"ok":true}`，runtime debug 返回 `ok=true`，skills 数量为 `30`，用户自定义技能全部完整。

本次上线行为：
- 桌面端文件库和任务消息 header 从手机遗留结构改为桌面原生透明工具栏。
- 任务消息列表项改为完整卡片容器，未读项增加左侧渐变亮条。
- topbar "新会话" 按钮在 workspace 面板打开时自动变为"回到会话"，点击返回对话。
- 在 workspace 面板打开时点击左侧会话列表项，自动关闭面板并切换会话。
- topbar agent label 按钮新增悬浮弹出菜单，hover 时展示可切换 agent 列表并直接切换。
- 桌面端 `min-width: 641px` 下强制隐藏所有 `mobile-work-back-button`。

## 2026-05-05 Conn worker 解耦与 HTML output 链接修复发布记录

本次通过固定脚本执行阿里云 Git 增量发布，服务器从 `gitee/main` fast-forward 到 `48db6b8 Fix conn HTML output links`。没有整目录覆盖，没有触碰 `/root/ugk-claw-shared` 运行态。

实际结果：
1. 本地提交 `48db6b8` 已推送到 `gitee/main` 和 `origin/main`。
2. 执行 `npm run server:ops -- aliyun preflight`，确认 `/root/ugk-claw-repo` 工作区干净、compose 配置和运行态挂载正常。
3. 执行 `npm run server:ops -- aliyun deploy`，服务器从 `05c3b59` fast-forward 到 `48db6b8`，重建并重启 `ugk-pi`、`ugk-pi-conn-worker`、`ugk-pi-feishu-worker`，nginx 已重启。
4. 执行 `npm run server:ops -- aliyun verify` 通过：公网 `/healthz` 返回 `{"ok":true}`，runtime debug 返回 `ok=true`，skills 数量为 `30`。

本次上线行为：
- conn 默认投递目标为 `task_inbox`，不再默认绑定前台 `conversationId`；删除聊天会话不应影响后台 conn run 投递。
- conn output HTML 通过 `/v1/conns/:connId/runs/:runId/output/<path>` 和 `/v1/conns/:connId/output/latest/<path>` 直接 inline 打开。
- 后台 runner 会 best-effort 收编结果正文中真实存在的 public 静态文件到本轮 `output/`，任务消息和飞书通知使用平台生成的 `files[]` 链接。

## 2026-05-05 Legacy conversation notification 清理发布记录

本次阿里云从 `c05753b Remove legacy conversation notification store` 增量更新到 `4a8c7e5 Drop legacy conversation notifications table`。由于本地向 Gitee 推送被安全策略拒绝，服务器直连 GitHub 又遇到 TLS / HTTP2 网络错误，本次使用经过 `git bundle verify` 的 Git bundle 做 `ff-only` 合并；没有整目录覆盖，没有触碰 `/root/ugk-claw-shared` 运行态。

实际结果：
1. 服务器 `/root/ugk-claw-repo` 工作区发布前干净，基线为 `c05753b`。
2. 上传只包含 `c05753b..4a8c7e5` 的 bundle 到 `/root/ugk-pi-4a8c7e5.bundle`，服务器执行 `git bundle verify`、`git fetch /root/ugk-pi-4a8c7e5.bundle main:refs/remotes/bundle/main` 和 `git merge --ff-only refs/remotes/bundle/main`。
3. 重建并重启 `ugk-pi`、`ugk-pi-conn-worker`、`ugk-pi-feishu-worker`，nginx 已重启。
4. `npm run server:ops -- aliyun verify` 通过，服务器最终 `git rev-parse --short HEAD` 为 `4a8c7e5`。
5. `/v1/debug/cleanup?since=2026-05-05T06:00:00.000Z` 返回 `ok=true`、`connTargets.byType.conversation=0`、`legacyConversationNotifications.total=0`、`risks=[]`。

本次上线行为：
- 新初始化 conn SQLite 不再创建 `conversation_notifications` 表。
- 旧库升级到 `user_version=6` 时执行 `DROP TABLE IF EXISTS conversation_notifications`。
- `ConnSqliteStore` 删除 conn 时只清理当前主链路 `agent_activity_items`，不再访问旧会话通知表。
- cleanup debug 对异常旧库仍保留“有表才统计”的只读兜底。

## 2026-04-30 阿里云 SSH key alias 配置记录

阿里云已经补齐本机无密码 SSH 入口：`C:\Users\29485\.ssh\config` 中新增 `Host ugk-claw-aliyun`，指向 `root@101.37.209.54`，使用本机私钥 `C:\Users\29485\.ssh\id_ed25519_ugk_claw_aliyun`。对应公钥已追加到服务器 `/root/.ssh/authorized_keys`。

后续接手和自动化脚本统一使用：

```bash
ssh ugk-claw-aliyun
```

`scripts/server-ops.mjs` 也已改为使用 `ugk-claw-aliyun`，因此 `npm run server:ops -- aliyun preflight/deploy/verify` 不应再依赖密码文件或交互式密码提示。项目根目录里的 `ssh-key.txt`、`*-config.txt` 这类本地密码文件不要提交，也不要当成长期运维入口；它们只能算临时拐杖，长期靠它就是给自己找麻烦。

## 2026-04-29 小米 MiMo 模型源增量发布记录

这是 Git 工作目录迁移前的历史发布记录，保留用于追溯当时为什么用了 archive。不要把本节当成现在的默认发布流程。

本次发布继续使用 archive 小包 `xiaomi-model-providers-20260429-incremental.tar.gz` 增量覆盖 `/root/ugk-claw-repo`；没有执行整目录替换，没有触碰 `/root/ugk-claw-shared/.data/agent`、sidecar 登录态、资产、conn 或生产日志。阿里云当前目录仍不是 Git 工作目录，不要照抄腾讯云 `git pull`。

实际结果：
1. 本地增量包只包含模型源相关配置、代码、测试与文档，不包含 `.pi/settings.json`、`小米api.txt` 或无关 bug / runtime 报告。
2. 通过 Paramiko/SFTP 上传小包到 `/root/xiaomi-model-providers-20260429-incremental.tar.gz`，服务器先备份目标文件到 `/root/ugk-claw-shared/backups/xiaomi-model-providers-pre-20260429-191844.tar.gz`，再解包覆盖 `/root/ugk-claw-repo`。
3. 小包解包后把小米 key 写入 `/root/ugk-claw-shared/app.env` 的 `XIAOMI_MIMO_API_KEY`，临时上传文件已删除，key 未写进仓库或部署包。
4. 执行 `COMPOSE_ANSI=never COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet` 通过。
5. 执行 `COMPOSE_ANSI=never COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d` 重建并启动应用相关容器；因第一次绕中文文件名时误选本地通用 `api.txt`，随后已重新按内容精确选择 `小米api.txt`，修正 `/root/ugk-claw-shared/app.env` 并强制重建 `ugk-pi`、`ugk-pi-conn-worker`、`ugk-pi-feishu-worker`。
6. 最终验收通过：内网 `/healthz`、公网 `http://101.37.209.54:3000/healthz` 均返回 `{"ok":true}`；`/v1/model-config` 显示 `xiaomi-mimo-cn`、`xiaomi-mimo-sgp`、`xiaomi-mimo-ams` 均为 `configured=true`，上下文窗口均为 `1048576`；`POST /v1/model-config/validate` 验证 `xiaomi-mimo-cn / mimo-v2.5-pro` 返回 `ok=true`。

注意：如果后续继续用本地脚本给阿里云注入 key，不能再用宽泛 `*api.txt` glob；本地同时存在阿里、DeepSeek、小米多个 key 文件，必须按文件名或内容精确选中小米 key，否则就是把生产 env 写坏，没什么技术含量但很烦。

## 2026-04-30 阿里云 apt mirror 构建修复记录

本次发布 `3ac0d12 fix(playground): isolate desktop UI from mobile layout` 后，服务器 Git 已快进到新提交，但生产镜像重建卡在 Dockerfile 第一层 `apt-get update`，进程树显示 buildkit 内部仍在执行默认 Debian 源访问。旧 `ugk-pi` 容器保持 healthy，因此线上入口没有中断，但新 UI 未进入镜像，不能把“健康”误判成“已上线”。

修复口径：`Dockerfile` 新增 `APT_MIRROR_HOST` build arg，传入后会把 `deb.debian.org` / `security.debian.org` 替换为指定 mirror；`docker-compose.prod.yml` 三个 `ugk-pi:prod` 构建目标统一透传 `${APT_MIRROR_HOST:-}`。同时 `cryptography` / `pyyaml` 改为 Debian 包 `python3-cryptography` / `python3-yaml`，避免 apt 修完后又卡在 PyPI，别从一个坑跳进另一个坑。阿里云 `/root/ugk-claw-shared/compose.env` 应设置：

```bash
APT_MIRROR_HOST=mirrors.aliyun.com
```

后续阿里云生产构建仍走 Git 增量和 `docker compose ... up --build -d`，但不要再让 apt 访问默认 Debian 官方源。这个坑已经在 2026-04-27 首次部署记录里预告过，现在正式源码化收口，别再靠“多等会儿”解决网络问题。

## 2026-04-29 阿里云 Git 工作目录迁移记录

本次将阿里云 `/root/ugk-claw-repo` 从 archive 解包目录迁移为 Git 工作目录，目标提交为 `e446ec2 chore: consolidate aliyun deployed updates`。迁移前已把本地提交同时推送到 GitHub 和 Gitee，服务器优先从 GitHub 克隆，Gitee 作为备用 remote 保留。

实际结果：
1. 迁移前备份当前代码目录到 `/root/ugk-claw-shared/backups/git-migration-20260429-221609/repo-before-git.tar.gz`。
2. 迁移前备份 `app.env`、`compose.env`、`.data/agent` 和 `.data/chrome-sidecar` 到同一个备份目录；其中 agent 数据和 Chrome 登录态仍位于 `/root/ugk-claw-shared`，没有并入 Git 仓库。
3. 原 archive 目录移动到 `/root/ugk-claw-repo-pre-git-20260429-221609`，并通过 `/root/ugk-claw-repo-pre-git-latest` 保留最近一次迁移前目录指针。
4. 新 `/root/ugk-claw-repo` 是 Git 工作目录，`origin` 指向 `https://github.com/mhgd3250905/ugk-claw-personal.git`，`gitee` 指向 `https://gitee.com/ksheng3250905/ugk-pi-claw.git`。
5. 迁移后执行生产 compose config、`up --build -d` 和 nginx 强制重建；内网与公网 `/healthz` 均返回 `{"ok":true}`，核心容器保持 healthy。

后续阿里云更新主流程：本地提交并推送 GitHub/Gitee，服务器执行 `git pull --ff-only gitee main`；只有 Gitee 不通且确认 GitHub 可用时才执行 `git pull --ff-only origin main`。只有 GitHub/Gitee 都不可用时才考虑 archive 小包兜底。

## 当前部署快照

- 日期：`2026-05-05`
- 云厂商：阿里云 ECS
- 公网 IP：`101.37.209.54`
- SSH 用户：`root`
- SSH 别名：`ugk-claw-aliyun`
- 系统镜像：Ubuntu `22.04.5 LTS`
- 磁盘：系统盘约 `40G`
- 内存：约 `7.2Gi`
- 服务公网入口：`http://101.37.209.54:3000/playground`
- 健康检查入口：`http://101.37.209.54:3000/healthz`
- 生产 compose 文件：`docker-compose.prod.yml`
- 主部署目录：`/root/ugk-claw-repo`
- shared 运行态目录：`/root/ugk-claw-shared`
- 当前部署来源：Git 工作目录，`gitee` 为默认发布 remote，`origin` 为 GitHub 备用 remote
- 当前部署基线：`4a8c7e5 Drop legacy conversation notifications table`

注意：阿里云首次部署时，服务器访问 GitHub 超时，`git clone` 未成功，因此曾经使用 archive 解包目录。截至 `2026-04-29`，`/root/ugk-claw-repo` 已迁移为 Git 工作目录。后续不要再默认打包上传，也不要把 `/root/ugk-claw-shared` 塞回代码目录。

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
UGK_BROWSER_UPLOAD_DIR=/root/ugk-claw-shared/.data/browser-upload
HOST_PORT=3000
WEB_ACCESS_BROWSER_GUI_PORT=3901
TZ=Asia/Shanghai
```

`UGK_AGENT_DATA_DIR` 必须挂到容器 `/app/.data/agent`。少了这条，重建容器后历史会话、session、资产和 conn 数据会跟着容器可写层一起蒸发。别问为什么历史没了，答案通常就是这里没挂。

`UGK_BROWSER_UPLOAD_DIR` 是 sidecar 文件选择桥，不是 Chrome 登录态目录。compose 会把它挂到 app / worker 的 `/app/.data/browser-upload`，同时挂到 sidecar 的 `/config/upload`；agent 生成要上传到小红书等站点的图片时写 app 侧路径，CDP 或 GUI 文件选择器使用 browser 侧路径。

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
ssh ugk-claw-aliyun
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
ssh -L 13902:127.0.0.1:3901 ugk-claw-aliyun
```

本机浏览器打开：

```text
https://127.0.0.1:13902/
```

如果本机 `13902` 被占用，换一个本地端口即可。远端仍然是 `127.0.0.1:3901`。

## 后续更新方式

当前 `/root/ugk-claw-repo` 已是 Git 工作目录，阿里云后续更新优先使用 Git 拉取。

本地先提交并推送两个远端：

```bash
git push origin main
git push gitee main
```

服务器主流程：

```bash
cd /root/ugk-claw-repo
git fetch gitee main
git status --short
git pull --ff-only gitee main
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet
COMPOSE_ANSI=never COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
```

如果 Gitee 不通，确认 GitHub 可用后再改走 origin：

```bash
cd /root/ugk-claw-repo
git fetch origin main
git pull --ff-only origin main
```

`/root/ugk-claw-shared` 仍然是运行态目录，不参与 Git 更新，不要删除、覆盖或移动。archive 小包只作为 GitHub/Gitee 都不可用时的紧急兜底。
## 不要做的事

- 不要提交 `阿里-config.txt`。
- 不要把 `app.env` 里的真实 key 写进文档或聊天。
- 不要删除 `/root/ugk-claw-shared`。
- 不要开放公网 `3901` 或 `9223`。
- 不要在阿里云上把 `/root/ugk-claw-shared` 并入 Git 仓库；代码用 Git 更新，运行态留在 shared 目录。
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

## 2026-04-29 UI 与后台浏览器清理增量发布记录

本次发布继续使用 archive 小包增量覆盖 `/root/ugk-claw-repo`，没有执行整目录替换，也没有触碰 `/root/ugk-claw-shared` 下的 `.data/agent`、sidecar 登录态、资产、conn 或日志。阿里云当前目录仍不是 Git 工作目录，不要照抄腾讯云 `git pull`。

实际结果：
1. 本地生成增量包 `runtime/aliyun-ui-browser-cleanup-20260429-incremental.tar.gz`，包含后台 conn browser cleanup scope、web-access scoped target、知乎工具 target 兜底关闭、playground UI 源码化修复、SVG logo、测试与文档。
2. 通过本地 `*config.txt` 中的 root 密码用 `paramiko` SFTP 上传到 `/root/aliyun-ui-browser-cleanup-20260429-incremental.tar.gz`，密码没有写入命令行参数或输出日志。
3. 服务器在 `/root/ugk-claw-repo` 内备份本次目标文件到 `/root/ugk-claw-shared/backups/aliyun-ui-browser-cleanup-pre-20260429-180503.tar.gz`，再执行 `tar -xzf /root/aliyun-ui-browser-cleanup-20260429-incremental.tar.gz -C /root/ugk-claw-repo` 增量覆盖对应文件。
4. 执行 `COMPOSE_ANSI=never COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet` 通过。
5. 执行 `COMPOSE_ANSI=never COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d` 重建并启动 `ugk-pi`、`ugk-pi-conn-worker`、`ugk-pi-feishu-worker`。
6. 首次验收 `127.0.0.1:3000/healthz` 返回 nginx `502`；应用容器自身为 healthy。随后按既有 runbook 执行 `docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx` 强制重建 nginx。
7. 最终验收通过：
   - 服务器内网 `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - 公网 `curl -fsS http://101.37.209.54:3000/healthz` 返回 `{"ok":true}`
   - `/playground` HTML 包含 `ugk-svg-logo`、`ugk-claw-logo.svg`、`ugk-claw-logo-light.svg`
   - `public/ugk-claw-logo.svg` 返回 HTTP `200`
   - `src/agent/background-agent-runner.ts` 包含 `runWithScopedAgentEnvironment` 与前后 `closeBrowserTargets`
   - `runtime/skills-user/web-access/scripts/local-cdp-browser.mjs` 包含 `scopedTargets` / `registerScopedTarget` / `closeScopeTargets`
   - `runtime/skills-user/zhihu-tools/scripts/zhihu-api.mjs` 的目标页创建路径均有 `finally closeTarget`
   - `check-deps.mjs` 返回 `host-browser: ok (http://172.31.250.10:9223)` 与 `proxy: ready (127.0.0.1:3456)`
   - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，CDP relay、`ugk-pi-conn-worker`、`ugk-pi-feishu-worker` 正常运行

## 2026-04-29 Web-access /type 增量发布记录

本次发布继续使用 archive 小包增量覆盖 `/root/ugk-claw-repo`，没有执行整目录替换，也没有触碰 `/root/ugk-claw-shared` 下的 `.data/agent`、sidecar 登录态、资产、conn 或日志。

实际结果：
1. 本地生成增量包 `runtime/web-access-type-20260429-incremental.tar.gz`，只包含 web-access `/type` 端点相关脚本、skill、测试、文档和 bug 落地记录。
2. 通过本地 `*config.txt` 中的 root 密码用 `paramiko` SFTP 上传到 `/root/web-access-type-20260429-incremental.tar.gz`，密码没有写入命令行参数或输出日志。
3. 服务器在 `/root/ugk-claw-repo` 内执行 `tar -xzf /root/web-access-type-20260429-incremental.tar.gz -C /root/ugk-claw-repo` 增量覆盖对应文件。
4. 执行 `docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet` 通过。
5. 执行 `docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml restart ugk-pi ugk-pi-conn-worker`，重启应用与 worker 以重新加载 web-access proxy 脚本。
6. 验收确认：内网 `/healthz`、公网 `/healthz`、`check-deps.mjs`、`POST /type` 真实 CDP 插入文本和 compose 状态均通过。

补充确认：实际发布已完成。`ugk-pi` 容器内部 `/healthz` 返回 `200 {"ok":true}`；重启 app 后 nginx 曾短暂 unhealthy 并返回 502，按既有 runbook 强制重建 nginx 后恢复；最终服务器内网 `/healthz`、本机公网 `http://101.37.209.54:3000/healthz`、`check-deps.mjs`、真实 `/type` CDP 文本插入（`{"typed":{"ok":true,"textLength":10},"value":"aliyun-cdp"}`）和 compose 状态均通过。

## 2026-04-29 飞书动态接入增量发布记录

本次发布继续使用 archive 小包增量覆盖 `/root/ugk-claw-repo`，没有执行整目录替换，也没有触碰 `/root/ugk-claw-shared` 下的 `.data/agent`、sidecar 登录态、资产、conn 或日志。阿里云当前目录仍不是 Git 工作目录，不要照抄腾讯云 `git pull`。

实际结果：
1. 本地代码已提交并推送到 GitHub：`6a1cbc9 fix: harden feishu worker reload`。
2. 本地生成增量包 `runtime/feishu-dynamic-6a1cbc9-incremental.tar.gz`，包含飞书 WebSocket worker、动态设置入口、测试与文档相关文件。
3. 通过本地 `*config.txt` 中的 root 密码用 `paramiko` SFTP 上传到 `/root/feishu-dynamic-6a1cbc9-incremental.tar.gz`，密码没有写入命令行参数或输出日志。
4. 服务器在 `/root/ugk-claw-repo` 内执行 `tar -xzf /root/feishu-dynamic-6a1cbc9-incremental.tar.gz -C /root/ugk-claw-repo` 增量覆盖对应文件。
5. 执行 `docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet` 通过。
6. 执行 `COMPOSE_ANSI=never COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d` 重建并启动 `ugk-pi`、`ugk-pi-conn-worker`、`ugk-pi-feishu-worker`。
7. 发布过程中本地 PowerShell 因 GBK 无法打印 Docker Compose 的勾选字符导致客户端退出；远端重建随后用 `COMPOSE_ANSI=never` 补跑完成。别把这个当服务端失败，罪魁祸首是本地输出编码，够土但很真实。
8. 首次验收 `127.0.0.1:3000/healthz` 返回 nginx `502`；应用容器内 `curl -fsS http://127.0.0.1:3000/healthz` 正常返回 `{"ok":true}`，确认是旧 nginx upstream。随后执行 `docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx` 强制重建 nginx。
9. 最终验收通过：
   - 服务器内网 `curl -fsS http://127.0.0.1:3000/healthz` 返回 `{"ok":true}`
   - 公网 `curl -fsS http://101.37.209.54:3000/healthz` 返回 `{"ok":true}`
   - `/playground` HTML 包含 `feishu-settings-dialog`
   - `docker compose ... ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` healthy，CDP relay、`ugk-pi-conn-worker`、`ugk-pi-feishu-worker` 正常运行
   - `ugk-pi-feishu-worker` 日志显示 `[feishu-worker] disabled by settings`，表示当前生产配置未启用飞书，而不是 worker 启动失败

## 2026-04-29 运行态 AGENTS 规则持久化增量发布记录

本次发布继续使用 archive 小包 `agent-rules-persistence-20260429-incremental.tar.gz` 增量覆盖 `/root/ugk-claw-repo`；没有触碰 `/root/ugk-claw-shared/.data/agent`、sidecar 登录态、资产、conn 或生产日志。阿里云当时仍不是 Git 工作目录，不要照抄腾讯云 `git pull`。

实际结果：
1. 本地小包只包含 `AGENTS.md`、`docs/change-log.md`、`docs/server-ops-quick-reference.md`、`src/agent/agent-session-factory.ts` 和对应测试，不包含 `.data`、密钥或无关 dirty 文件。
2. 通过 Paramiko/SFTP 上传到 `/root/agent-rules-persistence-20260429-incremental.tar.gz`，服务器先把目标文件备份到 `/root/ugk-claw-shared/backups/agent-rules-persistence-pre-*.tar.gz`，再解包覆盖 `/root/ugk-claw-repo`。
3. 执行 `docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet` 通过。
4. 执行 `COMPOSE_ANSI=never COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d` 重建 `ugk-pi`、`ugk-pi-conn-worker`、`ugk-pi-feishu-worker`。
5. 首次验收遇到 nginx `502`，随后按 runbook 执行 `docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx` 恢复入口。
6. 最终验收通过：内网 `http://127.0.0.1:3000/healthz` 与公网 `http://101.37.209.54:3000/healthz` 均返回 `{"ok":true}`，`docker compose ps` 显示 `nginx`、`ugk-pi`、`ugk-pi-browser` 为 healthy，容器内 `/app/src/agent/agent-session-factory.ts` 与 `/app/AGENTS.md` 均包含 `AGENTS.local.md` 相关逻辑。

后续沉淀本机或服务器长期规则时，应写入 `/app/.data/agent/AGENTS.local.md`，宿主机对应路径是 `/root/ugk-claw-shared/.data/agent/AGENTS.local.md`。该文件位于 shared 运行态目录，不随代码发布被覆盖，会被 agent session 作为额外 AGENTS 上下文注入。
