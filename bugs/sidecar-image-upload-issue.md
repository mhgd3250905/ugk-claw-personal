# Sidecar 图片上传技术问题分析

**日期**：2026-04-28
**场景**：小红书创作者平台图片笔记发布
**问题**：无法通过 CDP 或 JavaScript 上传本地图片到小红书

---

## 问题现象

在使用 `web-access` sidecar 浏览器自动化时，尝试上传本地图片到小红书创作者平台，遇到以下问题：

1. **CDP `DOM.setFileInputFiles` 无效**：文件设置成功（返回 `{}`），但页面未显示上传状态，`input.files.length` 仍为 0
2. **JavaScript `fetch` 失败**：sidecar 容器无法访问 compose 内部服务地址（`http://ugk-pi:3000`）
3. **公网地址也无法访问**：`http://43.134.167.179:3000` 和 `http://101.37.209.54:3000` 都 fetch 失败

---

## 根因分析

### 网络隔离

Sidecar 容器 (`ugk-pi-browser`) 与应用容器 (`ugk-pi`) 网络隔离：

```
ugk-pi (app container)
  ├── http://ugk-pi:3000  ← sidecar 无法访问
  ├── http://127.0.0.1:3000  ← sidecar 无法访问
  └── http://172.31.250.10:9223 (CDP)  ← sidecar 自己的 CDP endpoint

ugk-pi-browser (sidecar container)
  ├── http://127.0.0.1:9222  ← 内部 CDP
  └── http://172.31.250.10:9223  ← 对外 CDP
  └── 无法访问 compose 内部任何 HTTP 服务
```

### 文件路径映射

Sidecar 挂载配置：
```yaml
volumes:
  - ./.data/chrome-sidecar:/config
```

这意味着：
- **主机路径**：`.data/chrome-sidecar/upload/memory-black-box-card.png`
- **App 容器路径**：`/app/.data/chrome-sidecar/upload/memory-black-box-card.png`
- **Sidecar 容器路径**：`/config/upload/memory-black-box-card.png`

`DOM.setFileInputFiles` 使用的是 sidecar 容器内路径 `/config/upload/...`，但即使文件存在，上传仍未触发。

---

## 验证日志

### 1. CDP 上传尝试

```bash
node /app/runtime/upload-image-v2.mjs "TARGET_ID" "/config/upload/memory-black-box-card.png"
```

输出：
```
Connecting to: ws://172.31.250.10:9223/devtools/page/TARGET_ID
Image path: /config/upload/memory-black-box-card.png
WebSocket connected
DOM enabled
Root node ID: 1
File input node ID: 55
Setting files...
Set files result: {}
Triggering events...
Event result: {"triggered":true,"filesCount":0,"fileName":"none"}
Status: undefined
```

**问题**：`filesCount: 0` 说明文件未被正确设置到 input。

### 2. JavaScript fetch 测试

```javascript
const tests = [
  "http://ugk-pi:3000",
  "http://127.0.0.1:3000",
  "http://43.134.167.179:3000",
  "http://101.37.209.54:3000"
];
// 全部返回 "Failed to fetch"
```

### 3. 文件系统验证

```bash
ls -la /app/.data/chrome-sidecar/upload/
# 输出：文件存在，547005 bytes
```

---

## 可能原因

1. **CDP 事件未正确触发**：小红书可能使用了 React/Vue 状态管理，单纯 `setFileInputFiles` + `change` 事件不足以触发状态更新

2. **需要特殊的事件序列**：可能需要触发 `input` → `change` → `blur` 或使用 React 的 `nativeInputValueSetter`

3. **小红书前端框架特殊处理**：创作者平台可能使用了特殊的文件上传组件，需要特定的交互方式

---

## 临时解决方案

### 方案 A：手动上传（推荐，保持精美排版）

1. 图片已准备好：`/app/.data/chrome-sidecar/upload/memory-black-box-card.png`
2. 通过 SSH tunnel 打开 sidecar GUI：
   ```bash
   ssh -L 3901:127.0.0.1:3901 user@服务器IP
   ```
   访问 `https://127.0.0.1:3901/`
3. 在 GUI 中手动操作小红书上传

### 方案 B：文字配图（自动发布，但排版可能丢失）

使用小红书内置的"文字配图"功能，可以自动发布，但换行排版会丢失，文字堆在一起。

---

## 待修复项

1. **网络配置**：让 sidecar 容器能访问 compose 内部服务（修改 docker-compose.yml 网络）
2. **CDP 上传增强**：研究小红书前端框架的事件触发机制
3. **备选上传方式**：考虑通过拖拽模拟或粘贴板上传

---

## 相关文件

- `src/agent/browser-cleanup.ts` - 浏览器清理
- `runtime/skills-user/web-access/SKILL.md` - web-access 技能文档
- `runtime/skills-user/xhs-helper/SKILL.md` - 小红书发布技能文档
- `runtime/screenshot-cdp.mjs` - 截图脚本（已验证可用）
- `runtime/upload-image-v2.mjs` - 图片上传脚本（待修复）

---

## 附：完整诊断日志

```bash
# 1. 检查浏览器代理健康
curl -s http://127.0.0.1:3456/health
# {"status": "ok", "port": 3456}

# 2. 检查 sidecar CDP
curl -s http://172.31.250.10:9223/json/version
# 正常返回 Chrome 版本信息

# 3. 打开小红书发布页面
curl -s "http://127.0.0.1:3456/new?url=https://creator.xiaohongshu.com/publish/publish?target=image"

# 4. 切换到图文上传
# 点击 "上传图文" tab → 成功

# 5. 点击 "上传图片" 按钮
# file input 出现，accept=".jpg,.jpeg,.png,.webp"

# 6. CDP setFileInputFiles
# 返回 {} 但 filesCount 为 0

# 7. JavaScript fetch 测试
# 全部失败

# 8. 文件存在验证
# ls 显示文件存在，大小正确
```

---

**结论**：当前 sidecar 网络配置导致无法从容器内访问本地 HTTP 服务，`setFileInputFiles` 方式也未能触发小红书前端上传流程。需要进一步研究小红书前端框架的文件上传机制，或调整 sidecar 网络配置。

---

## 2026-04-28 修复结论

本轮确认原报告里的“sidecar 容器无法访问 compose 内部服务”判断不够严谨：页面内 `fetch("http://ugk-pi:3000")` 失败可能来自第三方页面 origin、CORS 或 Private Network Access，不等价于 Docker 网络断裂。真正需要先修的是文件上传路径视角不统一。

已落地的修复：

- `docker-compose.yml` / `docker-compose.prod.yml` 新增 sidecar upload bridge。
- app / worker 容器使用 `/app/.data/browser-upload`。
- sidecar Chrome 容器使用 `/config/upload`。
- 两边实际绑定同一个宿主目录 `${UGK_BROWSER_UPLOAD_DIR:-./.data/chrome-sidecar/upload}`。
- agent prompt 与 `web-access` skill 已写入规则：生成待上传图片时写 app 侧路径，CDP `DOM.setFileInputFiles` 或 GUI 文件选择时使用 browser 侧路径。
- 云服务器文档补充 `UGK_BROWSER_UPLOAD_DIR`，推荐生产设置为 shared 下独立目录，例如 `/root/ugk-claw-shared/.data/browser-upload` 或 `/home/ubuntu/ugk-claw-shared/.data/browser-upload`。

修复后的标准用法：

```text
agent writes:
  /app/.data/browser-upload/memory-black-box-card.png

sidecar Chrome selects:
  /config/upload/memory-black-box-card.png
```

剩余风险：

- 这次修复解决的是“浏览器容器拿不到文件 / agent 不知道该给哪个路径”的根因。
- 如果小红书前端仍然拒绝 `DOM.setFileInputFiles`，下一步再针对该站点做 CDP 事件序列、drag/drop 或 clipboard fallback；不要再用页面 JS `fetch` 当上传通道。
