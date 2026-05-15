import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TeamUnitStore } from "../src/team/team-unit-store.js";

test("TeamUnitStore create writes file and returns TeamUnit", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-store-"));
	try {
		const store = new TeamUnitStore(root);
		const unit = await store.create({
			title: "调研团队",
			description: "适合公开网页调研",
			watcherProfileId: "pw",
			workerProfileId: "pwo",
			checkerProfileId: "pc",
			finalizerProfileId: "pf",
		});
		assert.ok(unit.teamUnitId.startsWith("team_"));
		assert.equal(unit.schemaVersion, "team/team-unit-1");
		assert.equal(unit.archived, false);
		assert.equal(unit.title, "调研团队");

		const got = await store.get(unit.teamUnitId);
		assert.deepEqual(got, unit);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("same AgentProfile can fill multiple slots", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-store-"));
	try {
		const store = new TeamUnitStore(root);
		const unit = await store.create({
			title: "单人团队",
			description: "同一 Agent 多角色",
			watcherProfileId: "same",
			workerProfileId: "same",
			checkerProfileId: "same",
			finalizerProfileId: "same",
		});
		assert.equal(unit.watcherProfileId, "same");
		assert.equal(unit.workerProfileId, "same");
		assert.equal(unit.checkerProfileId, "same");
		assert.equal(unit.finalizerProfileId, "same");
	} finally {
		await rm(root, { recursive: true });
	}
});

test("archived TeamUnit cannot be edited", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-store-"));
	try {
		const store = new TeamUnitStore(root);
		const unit = await store.create({
			title: "t", description: "d",
			watcherProfileId: "w", workerProfileId: "w",
			checkerProfileId: "c", finalizerProfileId: "f",
		});
		await store.archive(unit.teamUnitId);
		await assert.rejects(
			() => store.update(unit.teamUnitId, { title: "new" }),
			{ message: /archived team unit cannot be edited/ },
		);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("list returns units sorted by updatedAt desc", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-store-"));
	try {
		const store = new TeamUnitStore(root);
		await store.create({ title: "first", description: "d", watcherProfileId: "w", workerProfileId: "w", checkerProfileId: "c", finalizerProfileId: "f" });
		await store.create({ title: "second", description: "d", watcherProfileId: "w", workerProfileId: "w", checkerProfileId: "c", finalizerProfileId: "f" });
		const list = await store.list();
		assert.equal(list.length, 2);
		assert.equal(list.length, 2);
	} finally {
		await rm(root, { recursive: true });
	}
});

test("delete removes file", async () => {
	const root = await mkdtemp(join(tmpdir(), "team-store-"));
	try {
		const store = new TeamUnitStore(root);
		const unit = await store.create({ title: "t", description: "d", watcherProfileId: "w", workerProfileId: "w", checkerProfileId: "c", finalizerProfileId: "f" });
		await store.delete(unit.teamUnitId);
		const got = await store.get(unit.teamUnitId);
		assert.equal(got, null);
	} finally {
		await rm(root, { recursive: true });
	}
});
