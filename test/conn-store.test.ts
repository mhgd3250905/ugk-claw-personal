import test from "node:test";
import assert from "node:assert/strict";
import { computeNextCronOccurrence, computeNextRunAt } from "../src/agent/conn-store.js";

test("computeNextRunAt supports interval schedules", () => {
	const next = computeNextRunAt(
		{
			kind: "interval",
			everyMs: 60_000,
		},
		undefined,
		new Date("2026-04-18T10:00:00.000Z"),
	);

	assert.equal(next?.toISOString(), "2026-04-18T10:01:00.000Z");
});

test("computeNextCronOccurrence supports minute-step cron expressions", () => {
	const next = computeNextCronOccurrence("*/15 * * * *", new Date("2026-04-18T10:07:00.000Z"));
	assert.equal(next?.toISOString(), "2026-04-18T10:15:00.000Z");
});

test("computeNextCronOccurrence respects an explicit IANA timezone", () => {
	const next = computeNextCronOccurrence(
		"0 9 * * *",
		new Date("2026-04-21T00:30:00.000Z"),
		"Asia/Shanghai",
	);

	assert.equal(next?.toISOString(), "2026-04-21T01:00:00.000Z");
});
