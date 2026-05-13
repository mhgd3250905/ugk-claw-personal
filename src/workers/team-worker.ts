import { join } from "node:path";
import { getAppConfig } from "../config.js";
import { TeamStore } from "../team/team-store.js";
import { TeamPipeline } from "../team/team-pipeline.js";

const POLL_INTERVAL_MS = 5000;
const FEATURE_FLAG = "TEAM_RUNTIME_ENABLED";

function parseArgs(): { once?: boolean; keyword?: string } {
  const args = process.argv.slice(2);
  let once = false;
  let keyword: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--once") once = true;
    else if (args[i] === "--keyword" && args[i + 1]) keyword = args[++i];
  }
  return { once, keyword };
}

async function main() {
  if (!process.env[FEATURE_FLAG]) {
    console.error(`[team-worker] ${FEATURE_FLAG} not set, exiting`);
    process.exit(0);
  }

  const { once, keyword } = parseArgs();
  const config = getAppConfig();
  const store = new TeamStore(join(config.agentDataDir, "team"));

  // CLI mode: run once with given keyword
  if (keyword) {
    console.log(`[team-worker] running pipeline for keyword: ${keyword}`);
    const pipeline = new TeamPipeline(store);
    const { run } = await pipeline.execute({ keyword, mode: "real" });
    console.log(`[team-worker] completed: ${run.runId}, status: ${run.status}, candidates: ${run.candidates.length}`);
    return;
  }

  // Worker mode: poll for pending runs
  console.log(`[team-worker] polling for pending runs (interval: ${POLL_INTERVAL_MS}ms)`);

  async function tick() {
    const summaries = store.listRuns();
    const pending = summaries.filter((s) => s.status === "pending");

    if (pending.length === 0) return;

    console.log(`[team-worker] found ${pending.length} pending run(s)`);

    for (const summary of pending) {
      try {
        const run = store.readRun(summary.runId);
        console.log(`[team-worker] executing ${run.runId} (keyword: ${run.keyword})`);

        const input = {
          keyword: run.keyword,
          mode: run.mode,
          maxRounds: 2,
          maxCandidates: 10,
        };

        const pipeline = new TeamPipeline(store);
        await pipeline.execute(input);
        console.log(`[team-worker] completed ${run.runId}`);
      } catch (err) {
        console.error(`[team-worker] failed ${summary.runId}: ${(err as Error).message}`);
      }
    }
  }

  if (once) {
    await tick();
    return;
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error("[team-worker] fatal:", err);
  process.exit(1);
});
