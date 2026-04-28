# Playground 前端热重载问题反馈

**报告日期**: 2026-04-28
**报告人**: 前端评估
**优先级**: 中
**状态**: 已评估（现象成立，预期边界需修正）

---

## 问题描述

当前 Playground 前端 UI 修改后，**无法在不重启服务的情况下看到效果**，即使调用了 `/playground/reset` 接口也无法更新页面。

这与 `AGENTS.md` 中描述的"零重启可视化修改"看起来不符，影响前端开发效率。

> 评估结论（2026-04-28）：报告中的现象和模块缓存根因成立，但原预期把 `runtime/playground/` 运行时文件零重启刷新，与 `src/ui/` TypeScript 源码热加载混在了一起。当前机制只承诺运行时外部化文件刷新生效；修改 `src/ui/` 源码后必须重启 `ugk-pi`，或使用 `npm run dev` 的 watch 进程重新加载模块。`/playground/reset` 只恢复当前进程已加载 factory 到 runtime，不负责重新加载 TypeScript 源码。

---

## 预期行为

原报告预期：修改 `src/ui/playground-styles.ts`、`src/ui/playground.ts`、`src/ui/playground-page-shell.ts` 等前端源文件后：

1. 刷新页面或调用重置接口后，应能看到新的样式/结构
2. 不需要重启整个服务进程

---

## 实际行为

### 测试步骤

1. 修改 `src/ui/playground-page-shell.ts` 中的发送按钮图标
2. 修改 `src/ui/playground-styles.ts` 中的 `#send-button::before` 样式
3. 调用 `POST /playground/reset`
4. 刷新页面 `GET /playground`

### 测试结果

```bash
# factory manifest 未更新
$ cat /app/runtime/playground-factory/manifest.json
{
  "generatedAt": "2026-04-27T23:41:38.357Z",  # 时间戳未变
  "sourceHash": "1bc94641de092dda62cb35dc16eaacf49128023dbaa0c1bc1ca5440b58fc8714"
}

# 页面仍然返回旧内容
$ curl -s http://127.0.0.1:3000/playground | grep 'send-button'
<button id="send-button" type="button">发送</button>  # 旧版本，无 SVG 图标
```

**结论：必须重启服务才能看到修改效果。**

这个结论对 `src/ui/` 源码修改是正确的；对 `runtime/playground/` 运行时文件修改不适用，后者刷新浏览器即可生效。

---

## 根因分析

### 1. 运行模式

当前环境变量：

```
PLAYGROUND_EXTERNALIZED=1
```

此模式下，页面从预编译的静态文件读取：

```typescript
// src/routes/playground.ts
if (isPlaygroundExternalizedEnabled()) {
    return await readPlaygroundRuntimeIndex(options.projectRoot);
}
```

### 2. Hash 比对机制

`writePlaygroundFactory()` 会计算源文件 hash，与现有 manifest 对比：

```typescript
// src/ui/playground-externalized.ts
const nextHash = hashFactoryFiles(files);
const currentManifest = await readJsonFile<{ sourceHash?: string }>(manifestPath);
if (currentManifest?.sourceHash === nextHash && ...) {
    return;  // hash 相同，跳过更新
}
```

### 3. 核心问题：模块缓存

`hashFactoryFiles()` 调用的是 `buildPlaygroundFactoryFiles()`，后者调用：

```typescript
function buildPlaygroundFactoryFiles(): Record<string, string> {
    const bundle = getPlaygroundRenderBundle();  // 从内存中获取
    // ...
}
```

**问题**：`getPlaygroundRenderBundle()` → `getPlaygroundStyles()` 都是从 Node.js 模块缓存中读取的函数。

当 TypeScript 源文件被修改后：
- `tsx` 进程没有重新加载模块
- 内存中的 `getPlaygroundStyles()` 仍返回旧内容
- `hashFactoryFiles()` 计算出的 hash 与 manifest 相同
- 跳过重新生成，页面内容不变

### 4. 调用链路

```
源文件修改 (playground-styles.ts)
    ↓
tsx 进程未重启，模块缓存未更新
    ↓
POST /playground/reset
    ↓
writePlaygroundFactory()
    ↓
getPlaygroundRenderBundle() → getPlaygroundStyles() [内存中的旧函数]
    ↓
hashFactoryFiles() 计算 hash = 旧内容 hash
    ↓
hash 与 manifest 相同，跳过更新
    ↓
页面内容不变
```

---

## 可能的解决方案

### 方案 A：添加开发模式热重载（推荐）

使用 `tsx watch` 监控 UI 源文件变化：

```json
// package.json
{
  "scripts": {
    "dev:hot": "tsx watch src/server.ts --include 'src/ui/**'"
  }
}
```

优点：
- 开发体验最佳
- 文件修改自动重启服务

缺点：
- 需要修改启动方式
- 服务重启有一定延迟

### 方案 B：清除模块缓存

在 `/playground/reset` 中强制清除 require 缓存：

```typescript
// 重置前清除 UI 模块缓存
Object.keys(require.cache).forEach(key => {
    if (key.includes('/src/ui/')) {
        delete require.cache[key];
    }
});
```

优点：
- 不需要重启服务

缺点：
- ESM 模块缓存清除复杂
- 可能有副作用
- 不适用于 `tsx` 环境

### 方案 C：禁用 externalized 开发模式

开发时设置 `PLAYGROUND_EXTERNALIZED=0`：

```typescript
// 每次请求都调用 renderPlaygroundPage()
return renderPlaygroundPage();  // 直接渲染
```

优点：
- 简单直接

缺点：
- 模块缓存问题仍然存在
- 每次请求都重新渲染，性能略差

### 方案 D：基于文件 mtime 的强制更新

修改 `writePlaygroundFactory()`，检查源文件 mtime 而非 hash：

```typescript
// 检查源文件修改时间
const sourceMtime = await getSourceFilesMtime();
if (currentManifest?.sourceMtime === sourceMtime) {
    return;  // 时间相同才跳过
}
```

优点：
- 可检测到源文件变化

缺点：
- 模块缓存问题仍存在（文件变了但内存未变）

---

## 推荐方案

**方案 A（开发模式热重载）** 是 `src/ui/` 源码开发时最可靠的解决方案。

建议在 `package.json` 添加专门的开发命令：

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "dev:ui": "tsx watch src/server.ts --include 'src/ui/**/*.ts'"
  }
}
```

并在文档中更新说明：

> 前端 UI 开发时，使用 `npm run dev:ui` 启动服务。修改 `src/ui/` 下的文件后，服务会自动重启，刷新页面即可看到效果。

当前仓库已有 `npm run dev`：

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts"
  }
}
```

因此本次处理优先修正文档和项目级 skill 口径，不新增未验证的 watch 参数，也不做 ESM 模块缓存清理。快速 UI 试样继续走 `runtime/playground/`；正式产品修改落回 `src/ui/` 后必须重启或由 watch 重启。

---

## 相关文件

- `src/ui/playground-externalized.ts` - externalized 模式实现
- `src/ui/playground.ts` - `getPlaygroundRenderBundle()` 入口
- `src/ui/playground-styles.ts` - 样式生成
- `src/ui/playground-page-shell.ts` - HTML 结构
- `src/routes/playground.ts` - 路由和重置接口

---

## 验证环境

- Node.js: v20+
- 运行方式: `tsx src/server.ts`
- 环境变量: `PLAYGROUND_EXTERNALIZED=1`
- 操作系统: Docker 容器 (Linux)

---

## 附录：相关代码位置

### playground-externalized.ts 关键函数

```typescript:src/ui/playground-externalized.ts
// 第 104-114 行
export function isPlaygroundExternalizedEnabled(): boolean {
    const value = String(process.env.PLAYGROUND_EXTERNALIZED || "").trim().toLowerCase();
    return value === "1" || value === "true" || value === "yes" || value === "runtime";
}

// 第 155-175 行
async function writePlaygroundFactory(factoryDir: string): Promise<void> {
    const files = buildPlaygroundFactoryFiles();
    const manifestPath = join(factoryDir, "manifest.json");
    const nextHash = hashFactoryFiles(files);
    const currentManifest = await readJsonFile<{ sourceHash?: string }>(manifestPath);
    if (currentManifest?.sourceHash === nextHash && (await factoryFilesComplete(factoryDir, files))) {
        return;  // hash 相同跳过
    }
    // ...
}

// 第 185-194 行
function buildPlaygroundFactoryFiles(): Record<string, string> {
    const bundle = getPlaygroundRenderBundle();  // 内存中的旧函数
    // ...
}
```

### 路由处理

```typescript:src/routes/playground.ts
app.get("/playground", async (_request, reply) => {
    // ...
    if (isPlaygroundExternalizedEnabled()) {
        return await readPlaygroundRuntimeIndex(options.projectRoot);  // 读静态文件
    }
    return renderPlaygroundPage();  // 动态渲染
});
```
