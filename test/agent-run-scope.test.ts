import assert from "node:assert/strict";
import test from "node:test";
import {
	createBrowserCleanupScope,
	runWithScopedAgentEnvironment,
} from "../src/agent/agent-run-scope.js";

const SCOPE_ENV_KEYS = ["CLAUDE_AGENT_ID", "CLAUDE_HOOK_AGENT_ID", "agent_id"] as const;

test("createBrowserCleanupScope sanitizes conversation ids for browser cleanup", () => {
	assert.equal(createBrowserCleanupScope("manual:hello/world"), "manual-hello-world");
	assert.equal(createBrowserCleanupScope("!!!"), "conversation");
});

test("runWithScopedAgentEnvironment sets and restores agent scope environment", async () => {
	const previous = snapshotScopeEnv();
	process.env.CLAUDE_AGENT_ID = "old-agent";
	delete process.env.CLAUDE_HOOK_AGENT_ID;
	process.env.agent_id = "old-lower";

	try {
		const observed = await runWithScopedAgentEnvironment("manual-scope", async () => ({
			CLAUDE_AGENT_ID: process.env.CLAUDE_AGENT_ID,
			CLAUDE_HOOK_AGENT_ID: process.env.CLAUDE_HOOK_AGENT_ID,
			agent_id: process.env.agent_id,
		}));

		assert.deepEqual(observed, {
			CLAUDE_AGENT_ID: "manual-scope",
			CLAUDE_HOOK_AGENT_ID: "manual-scope",
			agent_id: "manual-scope",
		});
		assert.equal(process.env.CLAUDE_AGENT_ID, "old-agent");
		assert.equal(process.env.CLAUDE_HOOK_AGENT_ID, undefined);
		assert.equal(process.env.agent_id, "old-lower");
	} finally {
		restoreScopeEnv(previous);
	}
});

test("runWithScopedAgentEnvironment restores scope environment after errors", async () => {
	const previous = snapshotScopeEnv();
	for (const key of SCOPE_ENV_KEYS) {
		delete process.env[key];
	}

	try {
		await assert.rejects(
			runWithScopedAgentEnvironment("manual-error", async () => {
				assert.equal(process.env.CLAUDE_AGENT_ID, "manual-error");
				throw new Error("boom");
			}),
			/boom/,
		);
		for (const key of SCOPE_ENV_KEYS) {
			assert.equal(process.env[key], undefined);
		}
	} finally {
		restoreScopeEnv(previous);
	}
});

function snapshotScopeEnv(): Record<(typeof SCOPE_ENV_KEYS)[number], string | undefined> {
	return {
		CLAUDE_AGENT_ID: process.env.CLAUDE_AGENT_ID,
		CLAUDE_HOOK_AGENT_ID: process.env.CLAUDE_HOOK_AGENT_ID,
		agent_id: process.env.agent_id,
	};
}

function restoreScopeEnv(snapshot: Record<(typeof SCOPE_ENV_KEYS)[number], string | undefined>): void {
	for (const key of SCOPE_ENV_KEYS) {
		const value = snapshot[key];
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}
