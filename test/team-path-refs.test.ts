import test from "node:test";
import assert from "node:assert/strict";
import { validateRunRef, resolveRunRef } from "../src/team/path-refs.js";

test("accepts safe run-relative refs", () => {
	assert.equal(validateRunRef("tasks/task-001/attempts/attempt-001/accepted-result.md"), true);
	assert.equal(validateRunRef("state.json"), true);
	assert.equal(validateRunRef("final-report.md"), true);
});

test("rejects traversal, absolute paths, URLs, and empty refs", () => {
	const bad = ["", " ", "../state.json", "foo/../../etc/passwd", "/etc/passwd", "C:\\Users\\x", "file:///tmp/x", "https://example.com/x"];
	for (const ref of bad) {
		assert.throws(() => validateRunRef(ref), { message: /invalid run ref/ }, `expected ${JSON.stringify(ref)} to throw`);
	}
});

test("rejects refs with backslashes", () => {
	assert.throws(() => validateRunRef("tasks\\task-001\\result.md"), { message: /invalid run ref/ });
});

test("resolves refs inside run root", () => {
	const resolved = resolveRunRef("/data/team/runs/run_001", "tasks/task-001/result.md");
	assert.ok(resolved.includes("tasks") && resolved.includes("task-001") && resolved.includes("result.md"));
});

test("resolve rejects traversal that escapes run root", () => {
	assert.throws(() => resolveRunRef("/data/team/runs/run_001", "../../etc/passwd"), { message: /invalid run ref/ });
});
