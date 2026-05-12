# 服务器运维速查

这份文档只做一件事：把生产服务器上最常用、最容易手滑的操作压成一页速查。
日常更新优先走 [docs/server-ops.md](./server-ops.md) 里的 `npm run server:ops -- <target> <action>`，不要再从这里手工复制整段命令当默认流程。

长背景、历史迁移、踩坑记录看 [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md) 和 [docs/aliyun-ecs-deploy.md](/E:/AII/ugk-pi/docs/aliyun-ecs-deploy.md)。

## 当前事实

### 腾讯云新加坡

- 服务器：`ubuntu@43.156.19.100`
- SSH 别名：`ssh ugk-claw-prod`
- 代码目录：`~/ugk-claw-repo`
- shared 运行态目录：`~/ugk-claw-shared`
- 生产 compose：`docker-compose.prod.yml`
- 公网入口：`http://43.156.19.100:3000/playground`
- 健康检查：`http://43.156.19.100:3000/healthz`
- 当前推荐稳定 tag：`snapshot-20260422-v4.1.2-stable`
- 当前线上应用提交：以服务器 `git log -1 --oneline` 为准，当前跟随远端 `main`
- 备用远端：`gitee -> https://gitee.com/ksheng3250905/ugk-pi-claw.git`
- 不要再用：`snapshot-20260422-v4.1.1-stable`；那个 tag 打出来后才发现生产 compose YAML 缩进有病

### 阿里云 ECS

- 服务器：`root@101.37.209.54`
- SSH 别名：`ssh ugk-claw-aliyun`
- 代码目录：`/root/ugk-claw-repo`
- shared 运行态目录：`/root/ugk-claw-shared`
- 生产 compose：`docker-compose.prod.yml`
- 公网入口：`http://101.37.209.54:3000/playground`
- 健康检查：`http://101.37.209.54:3000/healthz`
- 当前线上应用提交：以服务器 `git log -1 --oneline` 为准，当前跟随远端 `main`
- 注意：当前阿里云目录已经迁移为 Git 工作目录，`origin` 指向 GitHub，`gitee` 指向 Gitee；后续更新默认 `git pull --ff-only gitee main`，不要先连 GitHub 浪费时间。

## Agent 渐进式披露：双云增量更新

给 agent 的阅读顺序就三层，别一上来全仓乱翻，更别靠上一轮记忆复制命令：

1. 先读 `AGENTS.md` 云服务器段，只确认目标服务器、路径、shared 目录和禁区。
2. 再读本节和下面的“固定增量发布流程”，按目标云执行对应命令。
3. 只有遇到迁移、回滚、服务器脏工作区、GitHub/Gitee 都不通、shared 数据异常或 nginx/sidecar 深度排障时，才展开 `docs/tencent-cloud-singapore-deploy.md` 或 `docs/aliyun-ecs-deploy.md`。

默认发布方式是 Git fast-forward：本地提交后同时推送 `origin main` 和 `gitee main`。`server:ops` 按目标云选择拉取远端：腾讯云默认 `origin`，阿里云默认 `gitee`。archive 小包只允许当 GitHub 和 Gitee 都不可用、且用户明确要紧急发布时使用。别拿 tar 包当日常流程，方便一时，后面排障就开始考古，太蠢。

### 腾讯云增量更新规范

- 目标：`ubuntu@43.156.19.100`
- 登录：`ssh ugk-claw-prod`
- 代码目录：`~/ugk-claw-repo`
- shared 目录：`~/ugk-claw-shared`
- 公网健康检查：`http://43.156.19.100:3000/healthz`
- 默认远端：`origin -> https://github.com/mhgd3250905/ugk-claw-personal.git`
- 备用远端：`gitee -> https://gitee.com/ksheng3250905/ugk-pi-claw.git`

执行前先在服务器确认：

```bash
cd ~/ugk-claw-repo
git status --short
git remote -v
git log -1 --oneline
```

`git status --short` 必须为空。非空就停，不要 `reset --hard`，先把差异保存到 `~/ugk-claw-shared/backups/` 或独立保留目录，再判断是不是运行态误进仓库。

常规发布：

```bash
cd ~/ugk-claw-repo
git fetch origin main
git pull --ff-only origin main
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet
COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml restart nginx
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml ps
```

GitHub 不通时：

```bash
cd ~/ugk-claw-repo
git fetch gitee main
git pull --ff-only gitee main
```

### 阿里云增量更新规范

- 目标：`root@101.37.209.54`
- 登录：`ssh ugk-claw-aliyun`
- 代码目录：`/root/ugk-claw-repo`
- shared 目录：`/root/ugk-claw-shared`
- 公网健康检查：`http://101.37.209.54:3000/healthz`
- 默认远端：`gitee -> https://gitee.com/ksheng3250905/ugk-pi-claw.git`
- 备用远端：`origin -> https://github.com/mhgd3250905/ugk-claw-personal.git`

执行前先在服务器确认：

```bash
cd /root/ugk-claw-repo
git status --short
git remote -v
git log -1 --oneline
```

`git status --short` 必须为空。非空就停，不要覆盖 `/root/ugk-claw-repo`，不要删 `/root/ugk-claw-shared`，先备份脏差异和 shared 关键目录。

常规发布：

```bash
cd /root/ugk-claw-repo
git fetch gitee main
git pull --ff-only gitee main
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet
COMPOSE_ANSI=never COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml restart nginx
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml ps
```

Gitee 不通且确认 GitHub 可用时：

```bash
cd /root/ugk-claw-repo
git fetch origin main
git pull --ff-only origin main
```

### 双云共同避坑

- 本地没提交、没推送，就不要让服务器 pull。服务器不是你的草稿箱。
- `.env`、API key、`.data/agent`、`.data/chrome-sidecar`、日志、tar 包和临时报告都不属于 Git 仓库。
- 本次 Chrome 工作台 / 多浏览器更新只需要增量更新代码并重建 `ugk-pi` / worker / nginx；不要删除、覆盖或迁移 shared 里的 Chrome profile。腾讯云重点保护 `~/ugk-claw-shared/.data/chrome-sidecar*`，阿里云重点保护 `/root/ugk-claw-shared/.data/chrome-sidecar*`。别用 `docker compose down -v`、别删 shared、别把本地 `.data/chrome-*` 传上去覆盖生产，登录态不是可再生耗材。
- 生产用户技能不要再依赖 clean Git 工作目录里的 `runtime/skills-user`。`docker-compose.prod.yml` 支持 `UGK_RUNTIME_SKILLS_USER_DIR`，腾讯云固定指向 `~/ugk-claw-shared/runtime/skills-user`，阿里云固定指向 `/root/ugk-claw-shared/runtime/skills-user`；把用户态技能继续放 repo 目录里，就是等下一次 clean checkout 把它们请走。
- agent 会话、session、资产和 conn 数据必须通过 `UGK_AGENT_DATA_DIR` 指到 shared agent data：腾讯云固定是 `~/ugk-claw-shared/.data/agent`，阿里云固定是 `/root/ugk-claw-shared/.data/agent`。少了这条，重建容器就等于把用户历史押在容器可写层上，听起来就已经够离谱。
- 改到 `Dockerfile`、`package*.json`、`docker-compose.prod.yml`、`deploy/nginx/default.conf`、`src/`、`runtime/skills-user/` 这类运行路径，默认重建容器；纯文档改动可以只 pull，不必重建。
- `up --build -d` 重建 `ugk-pi` 后固定 `restart nginx`。nginx 会在启动时解析 `proxy_pass http://ugk-pi:3000`，app 容器重建后 IP 可能变化；如果 nginx 不重启，公网会 502，但 nginx 容器里直接访问 `http://ugk-pi:3000/healthz` 仍然是好的，这个现象非常会骗人。
- 改过 nginx 配置或公网 `502` 但 app 容器内部健康时，优先 `restart nginx`；如果配置文件也改了，再 `up -d --force-recreate nginx`，别绕一圈怀疑模型、网络和玄学。
- 发布后至少确认：`git log -1 --oneline`、`git status --short` 为空、内网 `/healthz`、公网 `/healthz`、`docker compose ps`、`UGK_AGENT_DATA_DIR`、`UGK_RUNTIME_SKILLS_USER_DIR`、`/app/.data/agent` 可写、`WEB_ACCESS_BROWSER_PROVIDER=direct_cdp`、`GET /v1/browsers` 至少返回 `default`、sidecar `9222/9223` CDP 探针。

## server:ops 当前硬闸门

日常不要手工拼这些检查，优先跑：

```bash
npm run server:ops -- tencent preflight
npm run server:ops -- aliyun preflight
```

脚本现在会检查：

- 远端 Git 工作树必须干净，dirty 直接停止。
- `UGK_RUNTIME_SKILLS_USER_DIR` 必须指向 shared skills。
- `UGK_AGENT_DATA_DIR` 必须指向 shared agent data。
- `/app/.data/agent` 在 app 容器内必须存在且可写。
- `WEB_ACCESS_BROWSER_PROVIDER` 必须是 `direct_cdp`。
- 多 Chrome 扩展只登记 `browserId -> CDP/GUI`，不复制登录态；新增实例必须独立 config/profile 目录，不能复用 `default` 的 `.data/chrome-sidecar`。
- Chrome 工作台的 `/v1/browsers/:browserId/status` 只读取 CDP 状态和页面级负载估算，不需要 Docker socket；`/start` 当前是受控启动扩展点，默认 501。生产验收时看到 501 不是故障，别为了让按钮“真启动”给主 app 挂 Docker 管理权限。
- `ugk-pi-browser` 内部 `127.0.0.1:9222/json/version` 必须可达。
- `ugk-pi` 到 `172.31.250.10:9223/json/version` 必须可达。
- 内网 / 公网 `/healthz`、`/v1/debug/skills`、`/v1/debug/runtime` 和容器内 skills 清单必须通过。

如果这里失败，先按失败 section 排查，不要绕回旧手工命令。脚本都告诉你哪根线断了，还去历史聊天里翻命令，属于自找麻烦。

## 登录

```bash
ssh ugk-claw-prod
```

如果 SSH 别名失效，就老老实实用：

```bash
ssh ubuntu@43.156.19.100
```

阿里云：

```bash
ssh ugk-claw-aliyun
```

## 固定增量发布流程（先选目标云）

先判断目标云，别上来复制上一轮命令。腾讯云和阿里云当前都是 Git 工作目录，但账号、路径、shared 目录和公网入口不同；把两套命令混用，还是自己给自己挖坑。

### 发布前本地固定检查

```bash
git status --short
npm test
git diff --check
```

如果本次要发布的是已提交版本，先确保本地提交已经推到对应服务器会拉取的远端。双云发布时两个远端都推：

```bash
git push origin main
git push gitee main
```

### 腾讯云：Git 增量发布

适用目标：`ubuntu@43.156.19.100`，目录：`~/ugk-claw-repo`。

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

如果 GitHub 不通，确认本地提交已经推到 Gitee 后在服务器上改走备用 remote：

```bash
cd ~/ugk-claw-repo
git fetch gitee main
git pull --ff-only gitee main
```

如果本次改过 `deploy/nginx/default.conf`，固定补一条 nginx 重建，别赌 bind mount 会自动换 inode：

```bash
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up -d --force-recreate nginx
```

### 阿里云：Git 增量发布（当前主流程）

适用目标：`root@101.37.209.54`，目录：`/root/ugk-claw-repo`。这里已经是 Git 工作目录，后续不要再默认打包上传；archive 小包只作为 GitHub/Gitee 都不可用时的兜底。

阿里云构建必须在 `/root/ugk-claw-shared/compose.env` 中保留 `APT_MIRROR_HOST=mirrors.aliyun.com`。`Dockerfile` 会把 Debian apt 源切到该 mirror；不要再让生产 build 卡在默认 `deb.debian.org` 上干等，等它恢复不叫运维，叫许愿。

```bash
ssh ugk-claw-aliyun
cd /root/ugk-claw-repo
git fetch gitee main
git status --short
git pull --ff-only gitee main
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet
COMPOSE_ANSI=never COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml ps
```

如果 Gitee 不通，确认本地提交已经推到 GitHub 后再改走备用 remote：

```bash
cd /root/ugk-claw-repo
git fetch origin main
git pull --ff-only origin main
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
curl -fsS http://43.156.19.100:3000/healthz
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi node /app/runtime/skills-user/web-access/scripts/check-deps.mjs
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi sh -lc "find /app/runtime/skills-user -maxdepth 2 -name SKILL.md -printf '%h\n' | sort"
```

阿里云：

```bash
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS http://101.37.209.54:3000/healthz
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi node /app/runtime/skills-user/web-access/scripts/check-deps.mjs
docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi sh -lc "find /app/runtime/skills-user -maxdepth 2 -name SKILL.md -printf '%h\n' | sort"
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
阿里云 `/root/ugk-claw-repo` 现在已经是 Git 工作目录；旧 archive 目录只做回滚和比对，不是默认更新入口。再把“打包上传”当主流程，就是自己把刚收好的线又拆开。

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
ssh -L 13901:127.0.0.1:3901 ubuntu@43.156.19.100
```

本机打开：

```text
https://127.0.0.1:13901/
```

不要开放公网 `3901`。那不是勇敢，是犯病。

阿里云 sidecar GUI：

```bash
ssh -L 13902:127.0.0.1:3901 ugk-claw-aliyun
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
- Playground 主 Agent 运行规则：`~/ugk-claw-shared/.data/agent/AGENTS.md`，容器内路径是 `/app/.data/agent/AGENTS.md`；旧 `AGENTS.local.md` 只作为迁移来源兼容，不再作为当前写入口。
- 用户 skills：腾讯云 `~/ugk-claw-shared/runtime/skills-user`，阿里云 `/root/ugk-claw-shared/runtime/skills-user`，通过 `UGK_RUNTIME_SKILLS_USER_DIR` 挂到容器 `/app/runtime/skills-user`
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
