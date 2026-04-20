# 2026-04-20 GitHub 迁移前仓库边界收口计划

## 背景

当前主仓库已经切到 GitHub，但本地工作区仍混有大量未跟踪文件。它们横跨计划文档、部署临时包、运行时截图、调试 HTML、临时目录和手工脚本。如果现在不先收口仓库边界，后续把服务器迁到 Git 工作目录时，部署流程还是会继续被本地产物污染。

## 目标

1. 明确哪些内容属于代码仓库，哪些内容属于运行时状态或本地临时产物。
2. 更新 `.gitignore`，阻止明显不该入库的本地产物继续外溢。
3. 把这条边界写进项目文档和 `/init` 接手口径，避免后续继续把运行产物当源码管理。

## 当前观察

### 明显不该入库的本地产物

- `.gh-cli-config/`
- `output/`
- `tmp/`
- `ugk-pi-deploy.tar.gz`
- `server-install-docker.sh`
- 根目录临时文件：`hello.txt`、`pixel.png`

### 应归类为运行时/调试产物的文件

- `runtime/*.png`
- `runtime/*.html`
- `public/zhihu-hot-*.html`
- `public/zhihu-hot-*.png`
- `public/thumb-up.html`

### 需要保守处理、先不自动忽略的文件

- `.codex/plans/`
  - 这是本仓库流程里用于落地计划的目录；是否提交需要单独定规则，不能为了眼前干净就一刀切没了。
- `logo.png`
- `desgin/`
  - 名字很野，但在没确认前不能假设它纯属垃圾。

## 决策

### 这轮直接执行

1. 更新 `.gitignore`，覆盖确认无争议的临时目录、部署包、运行时截图/HTML 和根目录临时文件。
2. 更新 `README.md`、`AGENTS.md`、`docs/traceability-map.md`、`docs/tencent-cloud-singapore-deploy.md`、`docs/change-log.md`，明确：
   - GitHub 已是主仓库事实源
   - 代码仓库与运行态目录必须分离
   - 服务器迁移前先收口本地忽略规则

### 这轮不做

1. 不自动删除任何本地未跟踪文件。
2. 不擅自忽略 `.codex/plans/`、`desgin/`、`logo.png`。
3. 不直接执行服务器迁移；那是下一阶段。

## 验证

完成后至少检查：

1. `git status --short` 中这轮新增 ignore 的产物是否消失。
2. `git diff --check` 是否通过。
3. 文档是否明确写清 GitHub 主仓库与运行态外置口径。
