# 任务消息未读交互收口方案（2026-04-23）

## 目标

- 取消“进入任务消息页即自动清空未读”的粗暴行为。
- 改成更符合直觉的未读模型：
  - 顶部 `任务消息` 按钮显示未读总数
  - 列表内每条未读消息显示红点
  - 点击条目本身，或点击 `任务ID / 复制 / 查看过程`，只把当前条目标为已读
  - 提供显式 `全部已读`

## 后端调整

1. 在 `AgentActivityStore` 增加 `markAllRead(now?)`
2. 新增接口 `POST /v1/activity/read-all`
3. 保持原有 `POST /v1/activity/:activityId/read` 不变，继续负责单条已读

## 前端调整

1. 删除任务消息页“打开后自动批量已读”的旧逻辑
2. 在 `src/ui/playground-task-inbox.ts` 增加：
   - 红点样式
   - `全部已读` 按钮
   - 单条已读同步逻辑
   - 显式批量已读逻辑
3. 顶部未读 badge 继续复用 `/v1/activity/summary`

## 影响检查

### 直接影响

- `AgentActivityStore` 新增方法，不破坏现有 `get/list/markRead/getUnreadCount`
- `src/routes/activity.ts` 新增只增不改的路由，不影响旧客户端
- `src/ui/playground-task-inbox.ts` 行为变化集中在任务消息页，不扩散到聊天主链路

### 间接影响

- 实时广播到达后仍只刷新任务消息列表与未读数
- 未读统计继续以后端 `read_at` 为准，避免前端假状态
- `查看过程`、`复制`、`复制任务ID` 会顺手完成单条已读，减少额外操作

### 数据兼容性

- 仍沿用现有 `readAt` / `read_at` 字段，不新增表结构
- 历史未读数据无需迁移，直接可被 `markAllRead` 和单条已读逻辑消费

## 验证

- `test/agent-activity-store.test.ts`
- `test/server.test.ts`
- `npx tsc --noEmit`
- 浏览器验收：未读红点、单条已读、全部已读、顶部未读 badge 联动

## 追加收口：未读筛选与分页

- 根因：顶部红标统计的是全量 `read_at IS NULL`，但任务消息页原先只拉 `GET /v1/activity?limit=50` 的最新一页。只要最新 50 条都是已读，而更早还有未读，页面就会出现“红标有数字但列表没有红点”的错位。
- 后端：`GET /v1/activity` 支持 `unreadOnly=true` 与 `before` 分页游标，响应补充 `hasMore` 和 `nextBefore`；查询层增加 `read_at IS NULL` 筛选能力和 `read_at, created_at` 索引。
- 前端：任务消息页增加 `未读 / 全部` 筛选。打开入口时如果存在未读数，默认进入 `未读` 视图；`未读` 视图按全库未读查询，不再被最新页已读数据挡住。
- 分页：列表根据后端 `hasMore` 显示 `加载更多`，继续用 `before=nextBefore` 拉下一页，并对前端合并做去重。
