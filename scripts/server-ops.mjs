#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const TARGETS = {
  tencent: {
    ssh: "ubuntu@43.134.167.179",
    repoDir: "~/ugk-claw-repo",
    sharedDir: "~/ugk-claw-shared",
    publicHealthz: "http://43.134.167.179:3000/healthz",
    skillsDir: "/home/ubuntu/ugk-claw-shared/runtime/skills-user",
    ansi: "",
  },
  aliyun: {
    ssh: "root@101.37.209.54",
    repoDir: "/root/ugk-claw-repo",
    sharedDir: "/root/ugk-claw-shared",
    publicHealthz: "http://101.37.209.54:3000/healthz",
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
  const envVarCheck = `grep -qx 'UGK_RUNTIME_SKILLS_USER_DIR=${target.skillsDir}' ${target.sharedDir}/compose.env`;
  const listSkills = `find /app/runtime/skills-user -maxdepth 2 -name SKILL.md -printf '%h\\\\n' | sort`;
  const verify = [
    "printf '== compose env guard ==\\n'",
    `${envVarCheck} || { echo 'UGK_RUNTIME_SKILLS_USER_DIR is missing or wrong' >&2; exit 12; }`,
    "printf '== compose ps ==\\n'",
    `${compose} ps`,
    "printf '== local health ==\\n'",
    "curl -fsS http://127.0.0.1:3000/healthz",
    "printf '\\n== public health ==\\n'",
    `curl -fsS ${target.publicHealthz}`,
    "printf '\\n== runtime skills ==\\n'",
    `${compose} exec -T ugk-pi sh -lc "${listSkills}"`,
    "printf '== debug skills source ==\\n'",
    "curl -fsS http://127.0.0.1:3000/v1/debug/skills | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get(\"source\", \"unknown\")); print(\"skills=\" + str(len(d.get(\"skills\", []))))'",
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
    "printf '== fetch/pull ==\\n'",
    "git fetch origin main",
    "git pull --ff-only origin main",
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
