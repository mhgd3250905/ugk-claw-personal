import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConversationStore } from "../src/agent/conversation-store.js";

async function createTempPath(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "ugk-pi-conversation-store-"));
	return join(dir, "conversation-index.json");
}

test("creates a new store file when setting a conversation mapping", async () => {
	const indexPath = await createTempPath();
	const store = new ConversationStore(indexPath);

	await store.set("manual:test-1", "E:/sessions/session-1.jsonl", {
		skillFingerprint: "skills-v1",
	});

	const entry = await store.get("manual:test-1");
	assert.deepEqual(entry, {
		sessionFile: "E:/sessions/session-1.jsonl",
		updatedAt: entry?.updatedAt,
		skillFingerprint: "skills-v1",
	});
	assert.ok(entry?.updatedAt);
});

test("returns undefined for unknown conversations", async () => {
	const indexPath = await createTempPath();
	const store = new ConversationStore(indexPath);

	const entry = await store.get("manual:missing");

	assert.equal(entry, undefined);
});

test("loads existing mappings from disk", async () => {
	const indexPath = await createTempPath();
	await writeFile(
		indexPath,
		JSON.stringify(
			{
				"manual:test-2": {
					sessionFile: "E:/sessions/session-2.jsonl",
					updatedAt: "2026-04-17T10:00:00.000Z",
					skillFingerprint: "skills-v2",
				},
			},
			null,
			2,
		),
		"utf8",
	);

	const store = new ConversationStore(indexPath);
	const entry = await store.get("manual:test-2");

	assert.deepEqual(entry, {
		sessionFile: "E:/sessions/session-2.jsonl",
		updatedAt: "2026-04-17T10:00:00.000Z",
		skillFingerprint: "skills-v2",
	});
});

test("treats empty and invalid files as empty stores", async () => {
	const emptyPath = await createTempPath();
	await writeFile(emptyPath, "", "utf8");
	const emptyStore = new ConversationStore(emptyPath);
	assert.equal(await emptyStore.get("manual:any"), undefined);

	const invalidPath = await createTempPath();
	await writeFile(invalidPath, "{invalid-json", "utf8");
	const invalidStore = new ConversationStore(invalidPath);
	assert.equal(await invalidStore.get("manual:any"), undefined);
});

test("persists updates and overwrites previous session files", async () => {
	const indexPath = await createTempPath();
	const store = new ConversationStore(indexPath);

	await store.set("manual:test-3", "E:/sessions/old.jsonl", {
		skillFingerprint: "skills-v1",
	});
	await store.set("manual:test-3", "E:/sessions/new.jsonl", {
		skillFingerprint: "skills-v2",
	});

	const persisted = JSON.parse(await readFile(indexPath, "utf8")) as Record<
		string,
		{ sessionFile: string; updatedAt: string; skillFingerprint?: string }
	>;
	assert.equal(persisted["manual:test-3"]?.sessionFile, "E:/sessions/new.jsonl");
	assert.ok(persisted["manual:test-3"]?.updatedAt);
	assert.equal(persisted["manual:test-3"]?.skillFingerprint, "skills-v2");
});
