# ugk-pi 项目初始化计划

## 目标

在 `E:\AII\ugk-pi` 启动一个基于 `pi-coding-agent` 的新项目工作区，把 `badlogic/pi-mono` 作为长期参考基线，用于后续开发规范、目录约定、技能扩展和本地代理工作流。

## 已确认事实

以下信息已基于 `badlogic/pi-mono` 官方仓库文档核实：

1. `pi-coding-agent` 的安装入口是 `@mariozechner/pi-coding-agent`，官方 Quick Start 使用：

   ```bash
   npm install -g @mariozechner/pi-coding-agent
   pi
   ```

2. `pi` 默认只给模型四个工具：`read`、`write`、`edit`、`bash`。额外能力通过 `skills`、`prompt templates`、`extensions`、`pi packages` 扩展。

3. `pi` 会在启动时自动加载上下文文件，优先参考：
   - `~/.pi/agent/AGENTS.md`
   - 当前工作目录向上递归的父目录 `AGENTS.md`
   - 当前目录 `AGENTS.md`

4. 项目级配置入口是 `.pi/` 目录，常见位置包括：
   - `.pi/settings.json`
   - `.pi/prompts/`
   - `.pi/skills/`
   - `.pi/extensions/`

5. `pi` 官方哲学是“保持最小核心，缺的能力自己扩展”，也就是别指望它替你把一切都内置好；要么自己做，要么装包。这思路很干脆，不像某些一坨配置屎山的软件。

## 本地初始化建议

本次 `/init` 只做项目基线规划，不直接动业务源码。推荐把初始化分成三层：

### 1. 工作区基线

建立项目最小结构：

- `AGENTS.md`
  - 写项目目标、语言要求、代码规范、常用命令
  - 明确 `pi-coding-agent` 是默认协作代理
- `README.md`
  - 记录项目定位、启动方式、参考仓库链接
- `.pi/settings.json`
  - 写项目级 `pi` 配置
- `.pi/prompts/`
  - 放常用提示模板
- `.pi/skills/` 或 `.agents/skills/`
  - 放项目专用技能

### 2. 参考资料基线

把 `pi-mono` 当参考系，而不是直接照抄。优先参考这些内容：

- 仓库根 `README.md`
  - 总览、开发命令、包结构
- `packages/coding-agent/README.md`
  - `pi` 使用方式、目录约定、扩展机制
- 仓库根 `AGENTS.md`
  - 维护者偏好的开发约束

后续如果我们要做：

- 自定义工具：重点看 `Extensions`
- 项目级工作流：重点看 `AGENTS.md`、`skills`
- 自定义交互：重点看 `prompt templates`、`themes`
- 本地包化分发：重点看 `Pi Packages`

### 3. 执行基线

等你批准后，再执行真正初始化：

1. 创建项目基础文件
2. 写入项目级 `AGENTS.md`
3. 建立 `.pi/` 目录及初始配置
4. 记录 `pi-mono` 参考链接和使用约束
5. 如有需要，再决定是否把 `pi-mono` 克隆到本地作为离线参考镜像

## 建议的首版目录

```text
ugk-pi/
├─ .codex/
│  └─ plans/
├─ .pi/
│  ├─ settings.json
│  ├─ prompts/
│  ├─ skills/
│  └─ extensions/
├─ AGENTS.md
└─ README.md
```

## 风险和边界

1. 现在直接把 `pi-mono` 整仓拉进当前目录不一定是好主意。
   - 如果你的目标是“基于它开发自己的项目”，那应该把它当参考，不该把你自己的仓库直接污染成上游镜像。

2. `pi` 的扩展能力很强，但也意味着规范得自己立。
   - 不先写清楚 `AGENTS.md` 和 `.pi/settings.json`，后面多代理协作大概率会开始自由发挥，最后演变成多人联手制造垃圾。

3. 是否需要本地克隆 `pi-mono`，取决于你的后续需求：
   - 只要在线参考：没必要克隆
   - 需要离线查文档、抄目录、看实现：建议单独克隆到 `references/` 或平级目录

## 下一步执行提案

推荐执行路径：

1. 先在当前目录生成 `AGENTS.md`、`README.md`、`.pi/settings.json`
2. 把 `pi-mono` 官方仓库和关键文档链接写进 `README.md`
3. 暂不克隆 `pi-mono`
4. 等项目需要自定义技能或扩展时，再补 `.pi/skills/` 和 `.pi/extensions/`

## 参考来源

- 仓库首页：`https://github.com/badlogic/pi-mono`
- coding agent 文档：`https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md`
- 项目开发规则：`https://github.com/badlogic/pi-mono/blob/main/AGENTS.md`
