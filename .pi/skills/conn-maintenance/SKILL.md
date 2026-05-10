---
name: conn-maintenance
description: Use when the user asks to diagnose slow conn/background tasks, inspect conn run logs, estimate or clean old conn SQLite event logs, run conn database maintenance, or handle Chinese requests like “清理后台任务日志”, “conn 变慢”, “清理一周前日志”, “SQLite 太大”, “后台任务运行慢”, or “帮我瘦身 conn 数据库”. Always start with read-only inspection and dry-run before any cleanup.
---

# Conn Maintenance

Use this skill to diagnose and safely maintain ugk-pi background task (`conn`) runtime data.

The goal is not to delete tasks. The goal is to keep the conn event log usable by trimming old, noisy process events while preserving task records, summaries, output files, and recent run evidence.

## Safety Model

Treat conn database maintenance as a production data operation.

- Start with read-only facts.
- Run dry-run before any cleanup.
- Show the user the exact impact numbers.
- Wait for explicit user confirmation before applying cleanup.
- Back up the host shared conn directory, or at least `conn.sqlite*`, before applying cleanup.
- Prefer a maintenance window where `ugk-pi` and `ugk-pi-conn-worker` are stopped before applying cleanup and `VACUUM`.
- Never delete `conn.sqlite`.
- Never delete `conn_runs`.
- Never delete `conn_run_files`.
- Never edit SQLite tables manually.
- Never clean browser profiles, agent sessions, assets, custom agent profiles, or skills as part of conn log cleanup.

If you cannot stop the app and worker from your environment, do not pretend you performed safe production maintenance. Give the user the exact host commands or ask them to run the maintenance from an ops-capable session.

## What Is Safe To Clean

The maintenance script only removes old rows from `conn_run_events`.

It preserves:

- conn definitions
- run records
- run status
- `result_text`
- `result_summary`
- error text
- indexed output files
- each conn's latest runs, according to the retention setting

Default retention:

- Keep detailed events from the last 7 days.
- Always keep detailed events for the latest 3 runs per conn.

## Read-Only Inspection

First gather facts. Prefer API/tool reads for user-facing state:

- `GET /v1/conns`
- `GET /v1/conns/:connId/runs`
- `GET /v1/conns/:connId/runs/:runId`
- `GET /v1/conns/:connId/runs/:runId/events`
- `GET /v1/debug/runtime`

If a `conn` tool is available, use:

- `conn(action="list")`
- `conn(action="list_runs", connId=...)`
- `conn(action="get_run", connId=..., runId=...)`

For database-size symptoms, inspect the runtime DB path from `/v1/debug/runtime` or use the standard container path:

```bash
/app/.data/agent/conn/conn.sqlite
```

Useful read-only checks from an ops shell:

```bash
ls -lh /app/.data/agent/conn/conn.sqlite*
node scripts/maintain-conn-db.mjs --db /app/.data/agent/conn/conn.sqlite --keep-days 7 --keep-latest-runs-per-conn 3 --dry-run --json
```

## Dry-Run First

Always run dry-run before cleanup:

```bash
node scripts/maintain-conn-db.mjs \
  --db /app/.data/agent/conn/conn.sqlite \
  --keep-days 7 \
  --keep-latest-runs-per-conn 3 \
  --dry-run \
  --json
```

Explain the result:

- `expiredRunCount`: how many old runs would lose detailed event rows.
- `deletedEventCount`: how many `conn_run_events` rows would be deleted.
- `cutoff`: events older than this cutoff are eligible, except each conn's latest kept runs.
- `dryRun: true`: confirms nothing was changed.

If `deletedEventCount` is `0`, do not apply cleanup. Tell the user cleanup is unnecessary and continue diagnosing other causes.

## Confirmation Gate

Before applying cleanup, use this format:

```text
我先做了 dry-run，没有改数据库：

- 数据库：/app/.data/agent/conn/conn.sqlite
- 保留策略：最近 7 天 + 每个 conn 最近 3 次 run
- 会清理的旧 run 数：<expiredRunCount>
- 会删除的事件行数：<deletedEventCount>
- 不会删除：conn 任务、run 记录、结果摘要、输出文件

正式清理需要维护窗口，建议先停止 ugk-pi 和 ugk-pi-conn-worker，再执行清理和 VACUUM。
请确认是否执行正式清理。
```

Do not apply cleanup until the user explicitly confirms.

## Apply Cleanup

Preferred production flow from the host deployment directory. This backs up the shared conn directory first; adapt the backup path for the target cloud.

```bash
COMPOSE="docker compose --env-file /root/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml"
mkdir -p /root/ugk-claw-shared/backups
$COMPOSE stop ugk-pi ugk-pi-conn-worker
cp -a /root/ugk-claw-shared/.data/agent/conn /root/ugk-claw-shared/backups/conn-pre-maintenance-$(date +%Y%m%d-%H%M%S)
$COMPOSE run --rm --no-deps ugk-pi node scripts/maintain-conn-db.mjs \
  --db /app/.data/agent/conn/conn.sqlite \
  --keep-days 7 \
  --keep-latest-runs-per-conn 3
$COMPOSE up -d ugk-pi ugk-pi-conn-worker
npm run server:ops -- aliyun verify
```

The maintenance script runs `VACUUM` and `PRAGMA wal_checkpoint(TRUNCATE)` by default after deleting rows. Only say it skipped vacuum when the command explicitly used `--no-vacuum` or the result reports `vacuumed=false`.

For Tencent Cloud, use the shared path `/home/ubuntu/ugk-claw-shared` and verify with:

```bash
npm run server:ops -- tencent verify
```

For local Docker development, adapt the compose command to the local project:

```bash
docker compose stop ugk-pi ugk-pi-conn-worker
docker compose run --rm --no-deps ugk-pi node scripts/maintain-conn-db.mjs \
  --db /app/.data/agent/conn/conn.sqlite \
  --keep-days 7 \
  --keep-latest-runs-per-conn 3
docker compose up -d ugk-pi ugk-pi-conn-worker
```

## After Cleanup

Verify:

- App health: `GET /healthz`
- Runtime health: `GET /v1/debug/runtime`
- Conn list loads: `GET /v1/conns`
- Recent run details still load: `GET /v1/conns/:connId/runs`
- Output files for recent runs still open.

Report:

- whether cleanup was dry-run or applied
- retention settings
- deleted event rows
- whether `VACUUM` ran
- verification result

## If The System Is Still Slow

If cleanup does not explain the slowness, continue diagnosis instead of running more deletes.

Check:

- active conn run backlog
- app and conn-worker logs
- browser sidecar memory and Chrome target count
- model provider latency
- `/v1/debug/runtime`
- server CPU, memory, disk I/O

Do not broaden cleanup to unrelated runtime data unless the user explicitly asks and you have a separate, evidence-based plan.
