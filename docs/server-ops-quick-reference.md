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
- browser 登录态：`~/ugk-claw-shared/.data/chrome-sidecar`
- app 日志：`~/ugk-claw-shared/logs/app`
- nginx 日志：`~/ugk-claw-shared/logs/nginx`

不要再去 repo 目录里找这些运行态文件。

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
