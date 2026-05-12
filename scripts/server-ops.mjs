#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const TARGETS = {
  tencent: {
    ssh: "ugk-claw-prod",
    repoDir: "~/ugk-claw-repo",
    sharedDir: "~/ugk-claw-shared",
    deployRemote: "origin",
    publicHealthz: "http://43.156.19.100:3000/healthz",
    agentDataDir: "/home/ubuntu/ugk-claw-shared/.data/agent",
    agentsDataDir: "/home/ubuntu/ugk-claw-shared/.data/agents",
    skillsDir: "/home/ubuntu/ugk-claw-shared/runtime/skills-user",
    ansi: "",
  },
  aliyun: {
    ssh: "ugk-claw-aliyun",
    repoDir: "/root/ugk-claw-repo",
    sharedDir: "/root/ugk-claw-shared",
    deployRemote: "gitee",
    publicHealthz: "http://101.37.209.54:3000/healthz",
    agentDataDir: "/root/ugk-claw-shared/.data/agent",
    agentsDataDir: "/root/ugk-claw-shared/.data/agents",
    skillsDir: "/root/ugk-claw-shared/runtime/skills-user",
    ansi: "COMPOSE_ANSI=never ",
  },
};

const ACTIONS = new Set(["preflight", "deploy", "verify"]);

function usage(exitCode = 1) {
  console.log(`Usage:
  node scripts/server-ops.mjs <tencent|aliyun> <preflight|deploy|verify>

Examples:
  node scripts/server-ops.mjs tencent preflight
  node scripts/server-ops.mjs aliyun deploy
`);
  process.exit(exitCode);
}

const [targetName, action] = process.argv.slice(2);
if (!targetName || targetName === "--help" || targetName === "-h") usage(0);
if (!TARGETS[targetName]) {
  console.error(`Unknown target: ${targetName}`);
  usage();
}
if (!ACTIONS.has(action)) {
  console.error(`Unknown action: ${action ?? ""}`);
  usage();
}

const target = TARGETS[targetName];

function remoteScriptFor(selectedAction) {
  const compose = `docker compose --env-file ${target.sharedDir}/compose.env -p ugk-pi-claw -f docker-compose.prod.yml`;
  const shellQuote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
  const composeExec = (service, command) => `${compose} exec -T ${service} sh -lc ${shellQuote(command)} < /dev/null`;
  const guardEnvEquals = (name, value) => `grep -qx '${name}=${value}' ${target.sharedDir}/compose.env`;
  const skillsEnvCheck = guardEnvEquals("UGK_RUNTIME_SKILLS_USER_DIR", target.skillsDir);
  const agentDataEnvCheck = guardEnvEquals("UGK_AGENT_DATA_DIR", target.agentDataDir);
  const agentsDataEnvCheck = guardEnvEquals("UGK_AGENTS_DATA_DIR", target.agentsDataDir);
  const listSkills = `find /app/runtime/skills-user -maxdepth 2 -name SKILL.md -printf '%h\\\\n' | sort`;
  const preserveModelSettings = [
    "printf '== preserve model settings ==\\n'",
    `mkdir -p ${target.agentDataDir}`,
    `if [ ! -f ${target.agentDataDir}/model-settings.json ]; then APP_CID=$(${compose} ps -q ugk-pi || true); if [ -n "$APP_CID" ] && docker exec "$APP_CID" test -f /app/.pi/settings.json; then docker cp "$APP_CID":/app/.pi/settings.json ${target.agentDataDir}/model-settings.json; fi; fi`,
  ];
  const verify = [
    "printf '== compose env guard ==\\n'",
    `${skillsEnvCheck} || { echo 'UGK_RUNTIME_SKILLS_USER_DIR is missing or wrong' >&2; exit 12; }`,
    `${agentDataEnvCheck} || { echo 'UGK_AGENT_DATA_DIR is missing or wrong' >&2; exit 13; }`,
    `${agentsDataEnvCheck} || { echo 'UGK_AGENTS_DATA_DIR is missing or wrong' >&2; exit 14; }`,
    "printf '== compose ps ==\\n'",
    `${compose} ps`,
    "printf '== app data mount ==\\n'",
    `${composeExec("ugk-pi", "test -d /app/.data/agent && test -w /app/.data/agent")}`,
    "printf '== agents data mount ==\\n'",
    `${composeExec("ugk-pi", "test -d /app/.data/agents && test -w /app/.data/agents")}`,
    "printf '== model settings path ==\\n'",
    `${composeExec("ugk-pi", "printenv UGK_MODEL_SETTINGS_PATH | grep -qx /app/.data/agent/model-settings.json")}`,
    `${composeExec("ugk-pi-conn-worker", "printenv UGK_MODEL_SETTINGS_PATH | grep -qx /app/.data/agent/model-settings.json")}`,
    "printf '== browser provider ==\\n'",
    `${composeExec("ugk-pi", "printenv WEB_ACCESS_BROWSER_PROVIDER | grep -qx direct_cdp")}`,
    "printf '== browser memory limit ==\\n'",
    `BROWSER_CID=$(${compose} ps -q ugk-pi-browser); test -n "$BROWSER_CID"; docker inspect "$BROWSER_CID" --format '{{.HostConfig.Memory}}' | awk '$1 > 0 { exit 0 } { exit 1 }'`,
    "printf '== Chrome V8 old space limit ==\\n'",
    `${composeExec("ugk-pi-browser", "CHROME_PID=$(pgrep -n -x google-chrome || pgrep -n -x chrome); tr '\\0' ' ' < /proc/$CHROME_PID/cmdline | grep -q -- 'max-old-space-size=1536'")}`,
    "printf '== sidecar cdp local ==\\n'",
    `${composeExec("ugk-pi-browser", "curl -fsS http://127.0.0.1:9222/json/version >/dev/null")}`,
    "printf '== sidecar cdp from app ==\\n'",
    `${composeExec("ugk-pi", "curl -fsS http://172.31.250.10:9223/json/version >/dev/null")}`,
    "printf '== local health ==\\n'",
    "curl -fsS http://127.0.0.1:3000/healthz",
    "printf '\\n== public health ==\\n'",
    `curl -fsS ${target.publicHealthz}`,
    "printf '\\n== runtime skills ==\\n'",
    `${composeExec("ugk-pi", listSkills)}`,
    "printf '== debug skills source ==\\n'",
    "curl -fsS http://127.0.0.1:3000/v1/debug/skills | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get(\"source\", \"unknown\")); print(\"skills=\" + str(len(d.get(\"skills\", []))))'",
    "printf '== runtime debug ==\\n'",
    "curl -fsS http://127.0.0.1:3000/v1/debug/runtime >/tmp/ugk-runtime-debug.json",
    "python3 - /tmp/ugk-runtime-debug.json <<'PY'",
    "import json",
    "import sys",
    "with open(sys.argv[1], encoding='utf-8') as handle:",
    "    data = json.load(handle)",
    "failed = [check.get('name', 'unknown') for check in data.get('checks', []) if not check.get('ok')]",
    "print('ok=' + str(bool(data.get('ok'))).lower())",
    "print('failed=' + ','.join(failed))",
    "sys.exit(1 if failed or not data.get('ok') else 0)",
    "PY",
  ];

  const preflight = [
    "set -eu",
    `cd ${target.repoDir}`,
    "printf '== repo ==\\n'",
    "pwd",
    "git log -1 --oneline",
    "printf '== git status ==\\n'",
    "STATUS=$(git status --short)",
    "printf '%s\\n' \"$STATUS\"",
    "if [ -n \"$STATUS\" ]; then echo 'Remote worktree is dirty; stop before deploying.' >&2; exit 10; fi",
    "printf '== remotes ==\\n'",
    "git remote -v",
    "printf '== shared dirs ==\\n'",
    `test -d ${target.sharedDir}/.data/agent`,
    `test -d ${target.sharedDir}/.data/chrome-sidecar`,
    `test -d ${target.skillsDir}`,
    `test -d ${target.agentDataDir}`,
    `test -d ${target.agentsDataDir}`,
    "printf '== compose config ==\\n'",
    `${compose} config --quiet`,
    ...verify,
  ];

  if (selectedAction === "preflight") return preflight.join("\n");
  if (selectedAction === "verify") {
    return ["set -eu", `cd ${target.repoDir}`, ...verify].join("\n");
  }

  return [
    "set -eu",
    `cd ${target.repoDir}`,
    "printf '== pre-deploy status ==\\n'",
    "STATUS=$(git status --short)",
    "printf '%s\\n' \"$STATUS\"",
    "if [ -n \"$STATUS\" ]; then echo 'Remote worktree is dirty; stop before deploying.' >&2; exit 10; fi",
    `printf '== fetch/pull (%s) ==\\n' ${target.deployRemote}`,
    `git fetch ${target.deployRemote} main`,
    `git pull --ff-only ${target.deployRemote} main`,
    ...preserveModelSettings,
    "printf '== post-pull status ==\\n'",
    "STATUS=$(git status --short)",
    "printf '%s\\n' \"$STATUS\"",
    "if [ -n \"$STATUS\" ]; then echo 'Remote worktree became dirty after pull.' >&2; exit 11; fi",
    "printf '== compose config ==\\n'",
    `${compose} config --quiet`,
    "printf '== build/up ==\\n'",
    `${target.ansi}COMPOSE_PARALLEL_LIMIT=1 ${compose} up --build -d`,
    "printf '== restart nginx ==\\n'",
    `${compose} restart nginx`,
    ...verify,
  ].join("\n");
}

const command = remoteScriptFor(action);
const result = spawnSync("ssh", [target.ssh, "sh", "-s"], {
  input: command,
  stdio: ["pipe", "inherit", "inherit"],
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
