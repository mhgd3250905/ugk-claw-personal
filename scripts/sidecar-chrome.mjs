#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const action = (process.argv[2] || "restart").trim().toLowerCase();
const browserService = process.env.WEB_ACCESS_BROWSER_SERVICE || "ugk-pi-browser";
const relayService = process.env.WEB_ACCESS_BROWSER_RELAY_SERVICE || "ugk-pi-browser-cdp";
const appService = process.env.WEB_ACCESS_APP_SERVICE || "ugk-pi";
const profileDir =
	process.env.WEB_ACCESS_BROWSER_PROFILE_DIR || "/config/chrome-profile-sidecar";
const guiUrl = `https://127.0.0.1:${process.env.WEB_ACCESS_BROWSER_GUI_PORT || "3901"}/`;
const appSidecarCdpUrl = "http://172.31.250.10:9223";
const browserLocalCdpUrl = "http://127.0.0.1:9222";
const composeBaseArgs = ["compose"];
const allowedActions = new Set(["start", "restart", "check", "status", "open"]);

function fail(message) {
	console.error(message);
	process.exit(1);
}

function shQuote(value) {
	return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function runDocker(args, options = {}) {
	const result = spawnSync("docker", [...composeBaseArgs, ...args], {
		stdio: "pipe",
		encoding: "utf8",
		...options,
	});

	if (result.error) {
		fail(`docker failed: ${result.error.message}`);
	}

	return result;
}

function formatCommandFailure(result) {
	return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}

function runDockerOrThrow(args, stepName) {
	const result = runDocker(args);
	if (result.status !== 0) {
		const detail = formatCommandFailure(result);
		fail(`${stepName} failed (exit ${result.status})\n${detail}`);
	}
	return result.stdout;
}

function runDockerOrThrowWithInput(args, input, stepName) {
	const result = runDocker(args, { input });
	if (result.status !== 0) {
		const detail = formatCommandFailure(result);
		fail(`${stepName} failed (exit ${result.status})\n${detail}`);
	}
	return result.stdout;
}

function execInService(service, script, stepName) {
	return runDockerOrThrow(["exec", "-T", service, "sh", "-lc", script], stepName);
}

function probeInService(service, script) {
	const result = runDocker(["exec", "-T", service, "sh", "-lc", script]);
	return {
		ok: result.status === 0,
		output: formatCommandFailure(result),
	};
}

function ensureServicesUp() {
	process.stdout.write("sidecar: ensuring services are up...\n");
	runDockerOrThrow(["up", "-d", browserService, relayService], "start sidecar services");
}

function clearChromeLocks() {
	const script = [
		`PROFILE_DIR=${shQuote(profileDir)}`,
		`rm -f "$PROFILE_DIR/SingletonCookie"`,
		`rm -f "$PROFILE_DIR/SingletonLock"`,
		`rm -f "$PROFILE_DIR/SingletonSocket"`,
	].join("\n");
	execInService(browserService, script, "clear Chrome profile locks");
}

function clearChromeRestorePromptState() {
	for (const relativePath of ["Default/Preferences", "Local State"]) {
		const containerPath = `${profileDir}/${relativePath}`;
		const content = runDockerOrThrow(
			[
				"exec",
				"-T",
				browserService,
				"sh",
				"-lc",
				`if [ -f ${shQuote(containerPath)} ]; then cat ${shQuote(containerPath)}; fi`,
			],
			`read Chrome state file ${relativePath}`,
		);

		if (!content.trim()) {
			continue;
		}

		let data;
		try {
			data = JSON.parse(content);
		} catch {
			continue;
		}

		const profile = data.profile && typeof data.profile === "object" ? data.profile : {};
		profile.exited_cleanly = true;
		profile.exit_type = "Normal";
		data.profile = profile;
		if (Object.hasOwn(data, "exit_type")) {
			data.exit_type = "Normal";
		}

		runDockerOrThrowWithInput(
			[
				"exec",
				"-T",
				browserService,
				"sh",
				"-lc",
				`mkdir -p "$(dirname ${shQuote(containerPath)})" && cat > ${shQuote(containerPath)}`,
			],
			JSON.stringify(data),
			`write Chrome state file ${relativePath}`,
		);
	}

	execInService(
		browserService,
		`PROFILE_DIR=${shQuote(profileDir)}
chown -R abc:abc "$PROFILE_DIR/Default" "$PROFILE_DIR/Local State" 2>/dev/null || true`,
		"fix Chrome Restore Pages state ownership",
	);
}

function stopChrome() {
	const script = [
		"for name in google-chrome chrome; do",
		"  pids=$(pgrep -x \"$name\" || true)",
		"  if [ -n \"$pids\" ]; then",
		"    kill $pids || true",
		"  fi",
		"done",
		"sleep 1",
	].join("\n");
	execInService(browserService, script, "stop existing Chrome process");
}

function startChrome() {
	const script = [
		"cat > /tmp/start-sidecar-chrome.sh <<'EOF'",
		"#!/bin/sh",
		"export HOME=/config",
		"export DISPLAY=:0",
		`export WEB_ACCESS_BROWSER_PROFILE_DIR=${shQuote(profileDir)}`,
		"exec /usr/bin/google-chrome \\",
		"  --no-first-run \\",
		"  --no-sandbox \\",
		"  --password-store=basic \\",
		"  --hide-crash-restore-bubble \\",
		"  --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' \\",
		"  --start-maximized \\",
		"  --test-type \\",
		"  --ozone-platform=x11 \\",
		"  --remote-debugging-address=0.0.0.0 \\",
		"  --remote-debugging-port=9222 \\",
		"  --user-data-dir=\"$WEB_ACCESS_BROWSER_PROFILE_DIR\" \\",
		"  about:blank",
		"EOF",
		"chmod +x /tmp/start-sidecar-chrome.sh",
		"su -s /bin/sh abc -c '/tmp/start-sidecar-chrome.sh >/config/chrome-manual.log 2>&1 &'",
	].join("\n");
	execInService(browserService, script, "start Chrome");
}

function waitForChrome() {
	const script = [
		"for attempt in $(seq 1 40); do",
		`  if curl -fsS ${browserLocalCdpUrl}/json/version >/tmp/chrome-ready.json 2>/dev/null; then`,
		"    cat /tmp/chrome-ready.json",
		"    exit 0",
		"  fi",
		"  sleep 1",
		"done",
		"echo 'Chrome CDP did not become ready. Try: npm run docker:chrome:restart' >&2",
		"exit 1",
	].join("\n");
	const output = execInService(browserService, script, "wait for Chrome CDP");
	process.stdout.write(output.trim() ? `${output.trim()}\n` : "");
}

function restartRelay() {
	process.stdout.write("sidecar: restarting CDP relay...\n");
	runDockerOrThrow(["restart", relayService], "restart CDP relay");
}

function verifyFromApp() {
	const script = [
		"for attempt in $(seq 1 20); do",
		`  if curl -fsS ${appSidecarCdpUrl}/json/version >/tmp/sidecar-version.json 2>/dev/null; then`,
		"    cat /tmp/sidecar-version.json",
		"    exit 0",
		"  fi",
		"  sleep 1",
		"done",
		"echo 'app container cannot reach sidecar CDP. Try: npm run docker:chrome:restart' >&2",
		"exit 1",
	].join("\n");
	const output = execInService(appService, script, "verify app to sidecar CDP link");
	process.stdout.write(output.trim() ? `${output.trim()}\n` : "");
}

function runWebAccessCheckDeps() {
	const output = execInService(
		appService,
		"node /app/runtime/skills-user/web-access/scripts/check-deps.mjs",
		"run web-access check-deps.mjs",
	);
	process.stdout.write(output.trim() ? `${output.trim()}\n` : "");
}

function printReady() {
	process.stdout.write(`sidecar: ready\nGUI: ${guiUrl}\nprofile: ${profileDir}\n`);
}

function printOpenInstructions() {
	process.stdout.write(
		[
			"sidecar GUI:",
			`  ${guiUrl}`,
			"",
			"Use this URL to log in manually or visit websites in the Docker Chrome sidecar.",
			"If it is not reachable, run:",
			"  npm run docker:chrome:start",
			"",
			"For a remote Linux server, expose this through an SSH tunnel or a protected reverse proxy.",
			"Do not publish this GUI openly on the internet.",
			"",
		].join("\n"),
	);
}

function printProbe(label, probe) {
	process.stdout.write(`\n${label}: ${probe.ok ? "ok" : "failed"}\n`);
	if (probe.output) {
		process.stdout.write(`${probe.output.trim()}\n`);
	}
}

function printStatus() {
	const ps = runDockerOrThrow(
		["ps", appService, browserService, relayService],
		"show compose service status",
	);
	process.stdout.write(ps.trim() ? `${ps.trim()}\n` : "");

	printProbe(
		"browser local CDP",
		probeInService(browserService, `curl -fsS ${browserLocalCdpUrl}/json/version`),
	);
	printProbe(
		"app sidecar CDP",
		probeInService(appService, `curl -fsS ${appSidecarCdpUrl}/json/version`),
	);

	process.stdout.write(`\nGUI: ${guiUrl}\nprofile: ${profileDir}\n`);
}

function printUsage() {
	process.stdout.write(
		[
			"Usage:",
			"  node scripts/sidecar-chrome.mjs start",
			"  node scripts/sidecar-chrome.mjs restart",
			"  node scripts/sidecar-chrome.mjs check",
			"  node scripts/sidecar-chrome.mjs status",
			"  node scripts/sidecar-chrome.mjs open",
			"",
			"Default action is restart.",
			"",
		].join("\n"),
	);
}

if (!allowedActions.has(action)) {
	printUsage();
	process.exit(1);
}

if (action === "open") {
	printOpenInstructions();
	process.exit(0);
}

if (action === "status") {
	printStatus();
	process.exit(0);
}

ensureServicesUp();

if (action === "check") {
	process.stdout.write("sidecar: checking Chrome and web-access...\n");
	waitForChrome();
	verifyFromApp();
	runWebAccessCheckDeps();
	printReady();
	process.exit(0);
}

if (action === "restart") {
	process.stdout.write("sidecar: restarting Chrome...\n");
	stopChrome();
	clearChromeLocks();
	clearChromeRestorePromptState();
} else {
	process.stdout.write("sidecar: starting Chrome...\n");
	clearChromeLocks();
	clearChromeRestorePromptState();
}

startChrome();
waitForChrome();
restartRelay();
verifyFromApp();
printReady();
