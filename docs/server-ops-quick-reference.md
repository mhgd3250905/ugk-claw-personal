# 服务器运维速查

这份文档只做一件事：把生产服务器上最常用、最容易手滑的操作压成一页速查。

长背景、历史迁移、踩坑记录看 [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md) 和 [docs/aliyun-ecs-deploy.md](/E:/AII/ugk-pi/docs/aliyun-ecs-deploy.md)。

## 当前事实

### 腾讯云新加坡

- 服务器：`ubuntu@43.134.167.179`
- SSH 别名：`ssh ugk-claw-prod`
- 代码目录：`~/ugk-claw-repo`
- shared 运行态目录：`~/ugk-claw-shared`
- 生产 compose：`docker-compose.prod.yml`
- 公网入口：`http://43.134.167.179:3000/playground`
- 健康检查：`http://43.134.167.179:3000/healthz`
- 当前推荐稳定 tag：`snapshot-20260422-v4.1.2-stable`
- 当前线上应用提交：`e446ec2`
- 不要再用：`snapshot-20260422-v4.1.1-stable`；那个 tag 打出来后才发现生产 compose YAML 缩进有病

### 阿里云 ECS

- 服务器：`root@101.37.209.54`
- 代码目录：`/root/ugk-claw-repo`
- shared 运行态目录：`/root/ugk-claw-shared`
- 生产 compose：`docker-compose.prod.yml`
- 公网入口：`http://101.37.209.54:3000/playground`
- 健康检查：`http://101.37.209.54:3000/healthz`
- 当前线上应用提交：`e446ec2`
- 注意：当前阿里云目录已经迁移为 Git 工作目录，`origin` 指向 GitHub，`gitee` 作为备用 remote；后续更新优先 `git pull --ff-only origin main`，GitHub 不通时再从 Gitee 拉取。

## 登录

```bash
ssh ugk-claw-prod
```

如果 SSH 别名失效，就老老实实用：

```bash
ssh ubuntu@43.134.167.179
```

阿里云：

```bash
ssh root@101.37.209.54
```

## 固定增量发布流程（先选目标云）

先判断目标云，别上来复制上一轮命令。腾讯云和阿里云当前都是 Git 工作目录，但账号、路径、shared 目录和公网入口不同；把两套命令混用，还是自己给自己挖坑。

### 发布前本地固定检查

```bash
git status --short
npm test
git diff --check
```

如果本次要发布的是已提交版本，先确保本地提交已经推到 GitHub：

```bash
git push origin main
```

### 腾讯云：Git 增量发布

适用目标：`ubuntu@43.134.167.179`，目录：`~/ugk-claw-repo`。

```bash
ssh ugk-claw-prod
cd ~/ugk-claw-repo
git fetch origin main
git status --short
git pull --ff-only origin main
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet
COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml ps
```

如果本次改过 `deploy/nginx/default.conf`，固定补一条 nginx 重建，别赌 bind mount 会自动换 inode：

```bash
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx
```

### 阿里云：Git 增量发布（当前主流程）

适用目标：`root@101.37.209.54`，目录：`/root/ugk-claw-repo`。这里已经是 Git 工作目录，后续不要再默认打包上传；archive 小包只作为 GitHub/Gitee 都不可用时的兜底。

```bash
ssh root@101.37.209.54
cd /root/ugk-claw-repo
git fetch origin main
git status --short
git pull --ff-only origin main
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet
COMPOSE_ANSI=never COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml ps
```

如果 GitHub 不通，确认本地提交已经推到 Gitee 后在服务器上改走备用 remote：

```bash
cd /root/ugk-claw-repo
git fetch gitee main
git pull --ff-only gitee main
```

如果阿里云 app 容器内部健康但公网 / nginx 返回 `502`，固定重建 nginx：

```bash
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx
```

### 阿里云：archive 增量发布（仅兜底）

适用场景：GitHub 和 Gitee 都不可用、但必须紧急发布时的兜底方案。正常情况不要走这条路；它能救火，但不该当正餐。

本地只打本次需要发布的文件，包放 `runtime/`，不要提交 tar 包：

```bash
tar -czf runtime/ugk-claw-incremental-YYYYMMDD-HHMMSS.tar.gz <file-or-dir> [more-files...]
```

上传固定使用 SFTP / `paramiko` 读取本机 `阿里-config.txt`，不要把 root 密码写到命令行或日志里。远端包路径统一放 `/root/<pkg>.tar.gz`。

上传到阿里云后固定执行：

```bash
cd /root/ugk-claw-repo
tar -xzf /root/ugk-claw-incremental-YYYYMMDD-HHMMSS.tar.gz -C /root/ugk-claw-repo
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet
```

重启策略按改动类型选，不要临场猜：

```bash
# 只改 runtime/skills-user、文档或挂载脚本，且镜像内容不变：
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml restart ugk-pi ugk-pi-conn-worker
```

```bash
# 改过 src、package、Dockerfile、compose、nginx 或生产构建相关文件：
COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
```

如果阿里云 app 容器内部健康但公网 / nginx 返回 `502`，不要绕圈试错，固定重建 nginx：

```bash
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx
```

### 发布后固定验收

腾讯云：

```bash
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS http://43.134.167.179:3000/healthz
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi node /app/runtime/skills-user/web-access/scripts/check-deps.mjs
```

阿里云：

```bash
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS http://101.37.209.54:3000/healthz
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi node /app/runtime/skills-user/web-access/scripts/check-deps.mjs
```

验收失败时先看 `ps` 和对应服务日志；不要删除 shared 目录，不要替换 `.data`，不要把整目录覆盖当“增量更新”。

## 旧版命令备查

下面保留旧命令是为了查历史口径；实际发布优先使用上面的“固定增量发布流程”。

腾讯云当前是 Git 工作目录：

```bash
cd ~/ugk-claw-repo
git pull --ff-only origin main
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
```

阿里云旧版是 archive 上传流程，现在已迁移为 Git 工作目录。下面仅作历史备查，平时看上面的“阿里云：Git 增量发布（当前主流程）”。

```bash
cd /root/ugk-claw-repo
COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
```

如果 `ugk-pi` 重建后自己是 healthy，但公网 / nginx 入口返回 `502`，先重建 nginx，让它重新解析 upstream：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx
```

别在 `~/ugk-pi-claw` 里更新。那是旧目录，不是当前主入口。
也别在阿里云 `/root/ugk-claw-repo` 里跑 `git pull`，除非已经确认那里有 `.git`。现在它只是解包目录，别跟它演 Git 魔术。

## 稳妥增量更新

如果这次是正式发布，不是你自己图省事的热更新，建议按这个顺序来：

```bash
# 本地先做
npx tsc --noEmit
npm test
docker compose -f docker-compose.prod.yml config
```

```bash
# 服务器先做备份
cd ~/ugk-claw-repo
mkdir -p ~/ugk-claw-shared/backups
tar --ignore-failed-read --warning=no-file-changed --warning=no-file-ignored -czf ~/ugk-claw-shared/backups/chrome-sidecar-$(date +%Y%m%d-%H%M%S).tar.gz -C ~/ugk-claw-shared/.data chrome-sidecar
git tag -a server-pre-deploy-$(date +%Y%m%d-%H%M%S) -m "server pre deploy backup" HEAD
git fetch --tags origin
git pull --ff-only origin main
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
```

如果本次改过 `deploy/nginx/default.conf`，不要以为 nginx 会自动吃到新配置。生产 nginx 是单文件 bind mount，`git pull` 后可能还挂着旧 inode。继续补这两步：

```bash
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T nginx nginx -T 2>/dev/null | grep client_max_body_size
```

别嫌麻烦。你真等到 sidecar 登录态和线上回滚点都没留，再开始后悔，就已经晚了。

## 只重启 app

只适用于纯源码改动，没有改 `Dockerfile`、依赖、compose 环境变量、sidecar 链路。

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml restart ugk-pi
```

如果你心里还在犹豫能不能只 `restart`，答案通常就是不能，直接 `up --build -d`。

## 看状态

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml ps
```

阿里云：

```bash
cd /root/ugk-claw-repo
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml ps
```

期望至少看到：

```text
ugk-pi-claw-nginx-1                healthy
ugk-pi-claw-ugk-pi-1               healthy
ugk-pi-claw-ugk-pi-browser-1       healthy
ugk-pi-claw-ugk-pi-browser-cdp-1   Up
```

## 看日志

app：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml logs --tail=120 ugk-pi
```

nginx：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml logs --tail=120 nginx
```

browser sidecar：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml logs --tail=120 ugk-pi-browser ugk-pi-browser-cdp
```

## OOM 与运行态膨胀排查

如果公网突然不可用，但重启后又恢复，先别把锅甩给 sidecar。先查 app 日志里有没有 Node heap OOM：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml logs --tail=220 ugk-pi | grep -E "heap out of memory|FATAL ERROR"
```

再查运行态是否膨胀：

```bash
find ~/ugk-claw-shared/.data/agent/conn ~/ugk-claw-shared/.data/agent/sessions -type f -size +20M -printf '%s %TY-%Tm-%Td %TH:%TM %p\n' | sort -nr | head -30
```

`conn.sqlite` 或 session jsonl 到几百 MB / GB 级时，不要在线硬删。固定流程是：停 `ugk-pi` 与 `ugk-pi-conn-worker`，备份数据库和超大 session，清理 `conn_run_events` 旧事件，`VACUUM` 后再启动。`src/agent/conn-run-store.ts` 已有写入侧上限，生产清理只是处理历史债。

## 发布后验收

健康检查：

```bash
curl -i http://127.0.0.1:3000/healthz
```

页面入口：

```bash
curl -I http://127.0.0.1:3000/playground
```

sidecar 链路：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi node /app/runtime/skills-user/web-access/scripts/check-deps.mjs
```

阿里云把路径换成 `/root/...`：

```bash
cd /root/ugk-claw-repo
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi node /app/runtime/skills-user/web-access/scripts/check-deps.mjs
```

期望输出：

```text
host-browser: ok (http://172.31.250.10:9223)
proxy: ready (127.0.0.1:3456)
```

如果你怀疑 sidecar 只是 GUI 活着、CDP 没起来，再补两刀：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi-browser sh -lc "curl -fsS http://127.0.0.1:9222/json/version"
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi sh -lc "curl -fsS http://172.31.250.10:9223/json/version"
```

本次 `viewMessages` 会话状态收口上线后，额外做一次浏览器实测：旧会话继续对话、刷新恢复、连续发送“继续”，都不应出现重复问答或当前输入被吞。别只看接口 200，200 只能证明它活着，不能证明它没犯蠢。

## SSH tunnel 打开 sidecar GUI

```bash
ssh -L 13901:127.0.0.1:3901 ubuntu@43.134.167.179
```

本机打开：

```text
https://127.0.0.1:13901/
```

不要开放公网 `3901`。那不是勇敢，是犯病。

阿里云 sidecar GUI：

```bash
ssh -L 13902:127.0.0.1:3901 root@101.37.209.54
```

本机打开：

```text
https://127.0.0.1:13902/
```

同样不要开放公网 `3901`。

## 运行态位置

- app env：`~/ugk-claw-shared/app.env`
- compose env：`~/ugk-claw-shared/compose.env`
- agent 会话 / 资产 / conn 数据：`~/ugk-claw-shared/.data/agent`
- agent 运行中沉淀的本地长期规则：`~/ugk-claw-shared/.data/agent/AGENTS.local.md`，容器内路径是 `/app/.data/agent/AGENTS.local.md`
- browser 登录态：`~/ugk-claw-shared/.data/chrome-sidecar`
- app 日志：`~/ugk-claw-shared/logs/app`
- nginx 日志：`~/ugk-claw-shared/logs/nginx`

不要再去 repo 目录里找这些运行态文件。

`docker-compose.prod.yml` 必须把 `${UGK_AGENT_DATA_DIR}` 挂到 `/app/.data/agent`。少了这条，重建 `ugk-pi` 容器时历史会话、session 文件和资产索引会跟着容器可写层一起没，别把这锅甩给浏览器刷新。

## sidecar 登录态备份

正常 `git pull` + `up --build -d` 不应该把 sidecar 登录态洗掉，因为它挂在 shared 目录里，不在 repo 里。但“理论上不会”不是备份，别把运气当流程。

```bash
cd ~/ugk-claw-repo
mkdir -p ~/ugk-claw-shared/backups
tar --ignore-failed-read --warning=no-file-changed --warning=no-file-ignored -czf ~/ugk-claw-shared/backups/chrome-sidecar-$(date +%Y%m%d-%H%M%S).tar.gz -C ~/ugk-claw-shared/.data chrome-sidecar
```

## sidecar 登录态验收

如果更新后 GUI 看起来像没登录，先别急着骂 shared 目录。先查这 3 件事：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi-browser sh -lc "curl -fsS http://127.0.0.1:9222/json/version"
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi-browser sh -lc "grep -n '^Exec=' /usr/share/applications/google-chrome.desktop /usr/share/applications/com.google.Chrome.desktop"
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi-browser sh -lc "ps -ef | grep '[c]hrome-profile-sidecar'"
```

期望结果：
- `9222/json/version` 能返回 JSON，说明 sidecar 里的真实 Chrome 进程已经起来。
- 两个 desktop launcher 的 `Exec=` 都指向 `/usr/local/bin/ugk-sidecar-chrome`，说明 GUI 手点和 agent/CDP 走的是同一个入口。
- 进程列表里能看到 `chrome-profile-sidecar`，说明 GUI 与 direct CDP 共用同一套 profile。

如果这三条都对，GUI 里某个站点还是掉登录，那大概率是站点自己的 session 过期，不是部署把 cookie 洗了。

## 回滚

旧目录还保留着，只用于回滚和比对：

```text
~/ugk-pi-claw
~/ugk-pi-claw-pre-github-20260420-105142
~/ugk-pi-claw-prev-20260419-231530
```

最保守的回滚方式：

```bash
cd ~/ugk-claw-repo
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml down
cd ~/ugk-pi-claw
docker compose -p ugk-pi-claw -f docker-compose.prod.yml up -d
```

回滚完一样要跑健康检查和 sidecar 验收，别回滚完就自我催眠。
