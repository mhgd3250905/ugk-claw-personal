# 2026-04-20 服务器从 tar 目录迁移到 GitHub 工作目录 Runbook

## 目标

把腾讯云新加坡服务器当前的 `~/ugk-pi-claw` 从“tar 解包目录”迁成“真正的 GitHub 工作目录”，同时保住现有运行态数据：

- `.env`
- `.data/chrome-sidecar`
- 用户本地 runtime 状态
- 当前公网入口与容器链路

## 当前已确认事实

- 代码主仓库：`https://github.com/mhgd3250905/ugk-claw-personal.git`
- 当前公网入口：`http://43.134.167.179:3000/playground`
- 当前服务器目录：`~/ugk-pi-claw`
- 当前服务器目录性质：tar 解包目录，不是 Git 仓库
- 生产 compose：`docker-compose.prod.yml`
- 当前浏览器链路：`WEB_ACCESS_BROWSER_PROVIDER=direct_cdp` -> `http://172.31.250.10:9223` -> Docker Chrome sidecar
- 当前关键运行态目录：`.env`、`.data/chrome-sidecar`

## 当前最大阻塞

当前本机没有可用 SSH 私钥，直接执行：

```bash
ssh ubuntu@43.134.167.179
```

返回：

```text
Permission denied (publickey,password).
```

所以这份 runbook 现在是“可执行方案”，不是“已开始执行”。真正开始迁移前，必须先拿到能登录服务器的 SSH 凭据。

## 迁移原则

1. 不在现有 `~/ugk-pi-claw` 目录里原地硬改 Git。
2. 先建新目录并行验证，再切换，不赌单目录热改。
3. `.env` 和 `.data` 继续外置或原样迁移，不进入 GitHub 仓库。
4. 切换前保留旧目录和运行态备份，回滚路径必须先想好。

## 目录设计

建议迁移后的服务器目录如下：

```text
~/ugk-claw-repo/            # GitHub clone 出来的代码目录
~/ugk-claw-shared/.env      # 外置环境变量
~/ugk-claw-shared/.data/    # 外置运行态与 sidecar 登录态
~/ugk-pi-claw-prev-*/       # 旧 tar 目录备份
```

如果暂时不改 compose volume，也可以先保守一点，保留：

```text
~/ugk-claw-repo/.env
~/ugk-claw-repo/.data
```

但这只是迁移过渡态，不是最终推荐形态。

## 执行步骤

### 阶段 1：登录与现状备份

1. 登录服务器

```bash
ssh ubuntu@43.134.167.179
```

2. 记录当前目录与容器状态

```bash
whoami
pwd
cd ~/ugk-pi-claw
docker compose -f docker-compose.prod.yml ps
curl -i http://127.0.0.1:3000/healthz
```

3. 备份现有运行态和目录

```bash
cd ~
cp -r ugk-pi-claw ugk-pi-claw-backup-$(date +%Y%m%d-%H%M%S)
```

如果磁盘吃紧，至少单独备份：

```bash
cp ~/ugk-pi-claw/.env ~/
cp -r ~/ugk-pi-claw/.data ~/
```

### 阶段 2：建立新的 Git 工作目录

1. 克隆 GitHub 仓库到新目录

```bash
cd ~
git clone --depth 1 https://github.com/mhgd3250905/ugk-claw-personal.git ugk-claw-repo
cd ~/ugk-claw-repo
git branch --show-current
git rev-parse HEAD
```

2. 把现有 `.env` 复制进新目录

```bash
cp ~/ugk-pi-claw/.env ~/ugk-claw-repo/.env
chmod 600 ~/ugk-claw-repo/.env
```

3. 把现有 `.data` 迁进新目录

```bash
cp -r ~/ugk-pi-claw/.data ~/ugk-claw-repo/
```

4. 如服务器上有用户运行时 skills / agents，也一并核对

```bash
ls -la ~/ugk-pi-claw/runtime
ls -la ~/ugk-claw-repo/runtime
```

如果旧目录里存在不在 Git 仓库中的用户态内容，需要单独复制：

```bash
cp -r ~/ugk-pi-claw/runtime/skills-user ~/ugk-claw-repo/runtime/
cp -r ~/ugk-pi-claw/runtime/agents-user ~/ugk-claw-repo/runtime/
```

复制前先核对，别把本地实验垃圾顺手带过去。

### 阶段 3：在新目录构建并启动

1. 进入新目录启动生产 compose

```bash
cd ~/ugk-claw-repo
docker compose -f docker-compose.prod.yml up --build -d
```

2. 检查容器状态

```bash
docker compose -f docker-compose.prod.yml ps
```

3. 检查健康状态

```bash
curl -i http://127.0.0.1:3000/healthz
curl -I http://127.0.0.1:3000/playground
```

4. 检查运行环境

```bash
docker compose -f docker-compose.prod.yml exec -T ugk-pi python3 --version
docker compose -f docker-compose.prod.yml exec -T ugk-pi node /app/runtime/skills-user/web-access/scripts/check-deps.mjs
```

### 阶段 4：验证 Git 工作目录可持续更新

1. 查看 Git 状态

```bash
cd ~/ugk-claw-repo
git remote -v
git status --short
```

2. 测试后续增量更新入口

```bash
git fetch origin
git log --oneline --decorate -n 5
```

注意：这里先不要随便 `git pull` 做实验，确认线上当前已稳定后再用真实新提交验证。

### 阶段 5：切换部署口径

迁移验证通过后，把后续服务器默认工作目录从：

```text
~/ugk-pi-claw
```

切换为：

```text
~/ugk-claw-repo
```

并在文档里同步：

- `README.md`
- `AGENTS.md`
- `docs/tencent-cloud-singapore-deploy.md`

## 回滚方案

如果新目录启动失败或运行态异常：

1. 停掉新目录容器

```bash
cd ~/ugk-claw-repo
docker compose -f docker-compose.prod.yml down
```

2. 回到旧目录启动

```bash
cd ~/ugk-pi-claw
docker compose -f docker-compose.prod.yml up -d
```

3. 再跑验证

```bash
docker compose -f docker-compose.prod.yml ps
curl -i http://127.0.0.1:3000/healthz
```

## 迁移完成后的新更新流程

### 代码更新

本地：

```bash
git push origin main
```

服务器：

```bash
cd ~/ugk-claw-repo
git pull --ff-only origin main
docker compose -f docker-compose.prod.yml up --build -d
```

### 仅前端或普通源码小改

如果确认不涉及镜像层变化，可评估：

```bash
docker compose -f docker-compose.prod.yml restart ugk-pi
```

但项目当前更稳的口径仍然是：

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

因为这能避免“以为只是小改，结果其实改到了依赖或环境”的低级事故。

## 真正执行前的检查清单

执行迁移前必须先满足：

1. 已拿到可用 SSH 凭据。
2. 已确认服务器磁盘空间足够复制一份目录。
3. 已确认当前 `.env`、`.data`、用户 runtime 状态需要保留。
4. 已确认本地 GitHub `origin/main` 就是要部署的提交。
5. 已准备好回滚命令，不在服务器上边想边改。
