# 腾讯云新加坡 CVM 部署运行手册

本文记录 `ugk-pi / UGK CLAW` 在腾讯云新加坡 CVM 上的首次部署事实、验证口径、故障记录和后续更新流程。

这不是泛泛而谈的“云服务器教程”，而是本仓库当前这台服务器的可追溯 runbook。后续更新部署时，先看这里，别靠记忆硬莽。

## 当前部署快照

- 日期：`2026-04-19`
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

如果刚把 `ubuntu` 加入 `docker` 组，需要执行：

```bash
newgrp docker
```

或重新登录 SSH。

## 代码传输方式

本仓库远程地址：

```text
https://gitee.com/ksheng3250905/ugk-pi-claw.git
```

本次从新加坡 CVM 直接访问 Gitee 很慢，曾出现：

```text
Receiving objects: 37% ..., 9.00 KiB/s
```

Gitee archive zip 也曾下载到半截，解压时报：

```text
End-of-central-directory signature not found
```

所以当前更稳的方式是：本地打包 `git archive`，再上传到服务器。

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

## 服务器 .env

服务器 `.env` 放在：

```text
/home/ubuntu/ugk-pi-claw/.env
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
chmod 600 .env
```

关键点：

- `PUBLIC_BASE_URL` 是用户浏览器可访问地址。
- `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL` 是 sidecar Chrome 在容器网络里访问 app 的地址。
- sidecar Chrome 里的 `127.0.0.1` 指向浏览器容器自己，不是 `ugk-pi` 容器，所以这里必须是 `http://ugk-pi:3000`。
- `WEB_ACCESS_CDP_HOST=172.31.250.10` 是当前 compose 下 CDP relay 的固定口径；改 compose 网络时要重新验证。

## 首次启动

服务器执行：

```bash
cd ~/ugk-pi-claw
docker compose -f docker-compose.prod.yml up --build -d
```

查看容器：

```bash
docker compose -f docker-compose.prod.yml ps
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
docker compose -f docker-compose.prod.yml exec -T ugk-pi node /app/runtime/skills-user/web-access/scripts/check-deps.mjs
```

预期：

```text
host-browser: ok (http://172.31.250.10:9223)
proxy: starting
proxy: ready (127.0.0.1:3456)
```

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
.data/chrome-sidecar
```

如果后续 X 搜索、网页登录态异常，先确认：

- SSH tunnel 是否还开着。
- sidecar GUI 里是否仍然登录。
- `.data/chrome-sidecar` 是否被误删。
- compose 是否仍然使用同一个 `WEB_ACCESS_BROWSER_PROFILE_DIR`。

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

### 推荐方式：本地打包上传

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

更新后必须跑：

```bash
docker compose -f docker-compose.prod.yml ps
curl -i http://127.0.0.1:3000/healthz
curl -I http://127.0.0.1:3000/playground
docker compose -f docker-compose.prod.yml exec -T ugk-pi node /app/runtime/skills-user/web-access/scripts/check-deps.mjs
```

### 可选方式：Gitee git 更新

如果新加坡服务器访问 Gitee 恢复正常，可以改用：

```bash
git clone --depth 1 https://gitee.com/ksheng3250905/ugk-pi-claw.git
```

或在已有 git 目录中：

```bash
git pull
```

但当前服务器目录是 tar 解包目录，没有 `.git`，而且本次 Gitee 网络明显偏慢，所以不作为推荐方式。

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

如果按推荐流程更新，旧目录会保留为：

```text
ugk-pi-claw-prev-YYYYMMDD-HHMMSS
```

回滚示例：

```bash
cd ~
docker compose -f ugk-pi-claw/docker-compose.prod.yml down
mv ugk-pi-claw ugk-pi-claw-bad-$(date +%Y%m%d-%H%M%S)
mv ugk-pi-claw-prev-YYYYMMDD-HHMMSS ugk-pi-claw
cd ugk-pi-claw
docker compose -f docker-compose.prod.yml up -d
```

回滚后同样必须执行验证清单。

## 常用运维命令

查看容器：

```bash
docker compose -f docker-compose.prod.yml ps
```

查看 app 日志：

```bash
docker compose -f docker-compose.prod.yml logs --tail=120 ugk-pi
```

查看 nginx 日志：

```bash
docker compose -f docker-compose.prod.yml logs --tail=120 nginx
```

重启 app：

```bash
docker compose -f docker-compose.prod.yml restart ugk-pi
```

重新构建并启动：

```bash
docker compose -f docker-compose.prod.yml up --build -d
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
- 不要在服务器上长期依赖单文件热修。
- 不要把 `PUBLIC_BASE_URL` 和 `WEB_ACCESS_BROWSER_PUBLIC_BASE_URL` 混用。
- 不要看到 Gitee clone 慢就反复 Ctrl+Z，停掉的 job 和半截目录会让下一次 clone 更乱。

## 本地临时文件说明

本次部署过程中出现过这些本地临时文件或目录，不应默认提交：

- `.gh-cli-config/`
- `server-install-docker.sh`
- `ugk-pi-deploy.tar.gz`

如果后续要把安装脚本产品化，应放到 `deploy/` 下并重新审查命名、参数和幂等性；不要把临时脚本直接当正式资产塞进去。
