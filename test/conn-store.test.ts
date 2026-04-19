import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { computeNextCronOccurrence, ConnStore } from "../src/agent/conn-store.js";

async function createConnStore(): Promise<ConnStore> {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-conn-store-"));
	return new ConnStore({
		indexPath: join(dir, "conn-index.json"),
	});
}

test("ConnStore creates, pauses, resumes, and triggers conn tasks", async () => {
	const store = await createConnStore();
	const created = await store.create({
		title: "daily digest",
		prompt: "Summarize the latest notes",
		target: {
			type: "conversation",
			conversationId: "manual:conn",
		},
		schedule: {
			kind: "interval",
			everyMs: 60_000,
		},
		now: new Date("2026-04-18T10:00:00.000Z"),
	});

	assert.equal(created.status, "active");
	assert.equal(created.nextRunAt, "2026-04-18T10:01:00.000Z");

	const paused = await store.pause(created.connId, new Date("2026-04-18T10:00:10.000Z"));
	assert.equal(paused?.status, "paused");
	assert.equal(paused?.nextRunAt, undefined);

	const resumed = await store.resume(created.connId, new Date("2026-04-18T10:05:00.000Z"));
	assert.equal(resumed?.status, "active");
	assert.equal(resumed?.nextRunAt, "2026-04-18T10:06:00.000Z");

	const triggered = await store.triggerNow(created.connId, new Date("2026-04-18T10:05:30.000Z"));
	assert.equal(triggered?.nextRunAt, "2026-04-18T10:05:30.000Z");
});

test("computeNextCronOccurrence supports minute-step cron expressions", () => {
	const next = computeNextCronOccurrence("*/15 * * * *", new Date("2026-04-18T10:07:00.000Z"));
	assert.equal(next?.toISOString(), "2026-04-18T10:15:00.000Z");
});
