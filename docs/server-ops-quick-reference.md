# 服务器运维速查

这份文档只做一件事：把腾讯云新加坡服务器上最常用、最容易手滑的操作压成一页速查。

长背景、历史迁移、踩坑记录看 [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)。

## 当前事实

- 服务器：`ubuntu@43.134.167.179`
- SSH 别名：`ssh ugk-claw-prod`
- 代码目录：`~/ugk-claw-repo`
- shared 运行态目录：`~/ugk-claw-shared`
- 生产 compose：`docker-compose.prod.yml`
- 公网入口：`http://43.134.167.179:3000/playground`
- 健康检查：`http://43.134.167.179:3000/healthz`
- 当前推荐稳定 tag：`snapshot-20260422-v4.1.2-stable`
- 当前线上提交：`0a34e81c2b81b93c7e459dfdae90a6e01c5a790f`
- 不要再用：`snapshot-20260422-v4.1.1-stable`；那个 tag 打出来后才发现生产 compose YAML 缩进有病

## 登录

```bash
ssh ugk-claw-prod
```

如果 SSH 别名失效，就老老实实用：

```bash
ssh ubuntu@43.134.167.179
```

## 标准更新

```bash
cd ~/ugk-claw-repo
git pull --ff-only origin main
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d
```

别在 `~/ugk-pi-claw` 里更新。那是旧目录，不是当前主入口。

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

## 运行态位置

- app env：`~/ugk-claw-shared/app.env`
- compose env：`~/ugk-claw-shared/compose.env`
- agent 会话 / 资产 / conn 数据：`~/ugk-claw-shared/.data/agent`
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
