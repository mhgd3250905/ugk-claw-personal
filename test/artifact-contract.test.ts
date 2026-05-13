import test from "node:test";
import assert from "node:assert/strict";
import {
	buildDefaultArtifactContract,
	validateArtifactContract,
	normalizeArtifactRelativePath,
	normalizeArtifactDeliveryInput,
} from "../src/agent/artifact-contract.js";

test("buildDefaultArtifactContract auto includes expected checks", () => {
	const contract = buildDefaultArtifactContract({
		expectedKind: "auto",
		repairMaxAttempts: 2,
	});
	assert.equal(contract.version, 1);
	assert.equal(contract.expectedKind, "auto");
	assert.equal(contract.requiredOutputs.length, 1);
	assert.equal(contract.requiredOutputs[0].format, "any");
	assert.deepEqual(
		contract.checks.map((c) => c.type),
		[
			"artifact_public_not_empty",
			"file_not_empty",
			"no_sensitive_files",
			"no_container_paths",
			"no_file_url",
		],
	);
	assert.equal(contract.repairPolicy.maxAttempts, 2);
});

test("buildDefaultArtifactContract web includes web_entry_exists", () => {
	const contract = buildDefaultArtifactContract({
		expectedKind: "web",
		repairMaxAttempts: 1,
	});
	assert.equal(contract.expectedKind, "web");
	assert.ok(contract.checks.some((c) => c.type === "web_entry_exists"));
	assert.ok(contract.checks.some((c) => c.type === "html_local_assets_exist"));
	assert.equal(contract.requiredOutputs[0].entryPath, "index.html");
});

test("buildDefaultArtifactContract xlsx includes xlsx_can_open", () => {
	const contract = buildDefaultArtifactContract({
		expectedKind: "xlsx",
		repairMaxAttempts: 0,
	});
	assert.equal(contract.expectedKind, "xlsx");
	assert.ok(contract.checks.some((c) => c.type === "xlsx_can_open"));
	assert.ok(contract.checks.some((c) => c.type === "format_matches"));
});

test("buildDefaultArtifactContract pdf includes pdf_header_valid", () => {
	const contract = buildDefaultArtifactContract({
		expectedKind: "pdf",
		repairMaxAttempts: 2,
	});
	assert.ok(contract.checks.some((c) => c.type === "pdf_header_valid"));
});

test("buildDefaultArtifactContract csv includes format_matches", () => {
	const contract = buildDefaultArtifactContract({
		expectedKind: "csv",
		repairMaxAttempts: 2,
	});
	assert.ok(contract.checks.some((c) => c.type === "format_matches"));
});

test("buildDefaultArtifactContract markdown includes format_matches", () => {
	const contract = buildDefaultArtifactContract({
		expectedKind: "markdown",
		repairMaxAttempts: 2,
	});
	assert.ok(contract.checks.some((c) => c.type === "format_matches"));
});

test("buildDefaultArtifactContract file includes basic checks", () => {
	const contract = buildDefaultArtifactContract({
		expectedKind: "file",
		repairMaxAttempts: 3,
	});
	assert.equal(contract.expectedKind, "file");
	assert.equal(contract.checks.length, 3);
	assert.equal(contract.repairPolicy.maxAttempts, 3);
});

test("validateArtifactContract accepts valid auto contract", () => {
	const contract = buildDefaultArtifactContract({
		expectedKind: "auto",
		repairMaxAttempts: 2,
	});
	const result = validateArtifactContract(contract);
	assert.equal(result.ok, true);
	if (result.ok) {
		assert.deepEqual(result.contract, contract);
	}
});

test("validateArtifactContract accepts valid web contract", () => {
	const contract = buildDefaultArtifactContract({
		expectedKind: "web",
		repairMaxAttempts: 1,
	});
	const result = validateArtifactContract(contract);
	assert.equal(result.ok, true);
});

test("validateArtifactContract rejects non-object", () => {
	const result = validateArtifactContract("not an object");
	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.ok(result.errors.some((e) => e.includes("must be an object")));
	}
});

test("validateArtifactContract rejects wrong version", () => {
	const contract = buildDefaultArtifactContract({
		expectedKind: "auto",
		repairMaxAttempts: 2,
	});
	const result = validateArtifactContract({ ...contract, version: 2 });
	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.ok(result.errors.some((e) => e.includes("version")));
	}
});

test("validateArtifactContract rejects unknown expectedKind", () => {
	const contract = buildDefaultArtifactContract({
		expectedKind: "auto",
		repairMaxAttempts: 2,
	});
	const result = validateArtifactContract({
		...contract,
		expectedKind: "unknown",
	});
	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.ok(result.errors.some((e) => e.includes("expectedKind")));
	}
});

test("validateArtifactContract rejects unknown check type", () => {
	const result = validateArtifactContract({
		version: 1,
		expectedKind: "auto",
		requiredOutputs: [
			{ kind: "file", target: "artifact_public", format: "any" },
		],
		checks: [{ type: "run_shell_command" }],
		repairPolicy: { maxAttempts: 2 },
	});
	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.ok(result.errors.some((e) => e.includes("Unknown check type")));
	}
});

test("validateArtifactContract rejects target != artifact_public", () => {
	const result = validateArtifactContract({
		version: 1,
		expectedKind: "auto",
		requiredOutputs: [
			{ kind: "file", target: "/tmp", format: "any" },
		],
		checks: [{ type: "artifact_public_not_empty" }],
		repairPolicy: { maxAttempts: 2 },
	});
	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.ok(result.errors.some((e) => e.includes("artifact_public")));
	}
});

test("validateArtifactContract rejects absolute entryPath", () => {
	const result = validateArtifactContract({
		version: 1,
		expectedKind: "web",
		requiredOutputs: [
			{
				kind: "web",
				target: "artifact_public",
				entryPath: "/etc/passwd",
			},
		],
		checks: [{ type: "web_entry_exists" }],
		repairPolicy: { maxAttempts: 1 },
	});
	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.ok(result.errors.some((e) => e.includes("entryPath")));
	}
});

test("validateArtifactContract rejects entryPath with ..", () => {
	const result = validateArtifactContract({
		version: 1,
		expectedKind: "web",
		requiredOutputs: [
			{
				kind: "web",
				target: "artifact_public",
				entryPath: "../../etc/passwd",
			},
		],
		checks: [{ type: "web_entry_exists" }],
		repairPolicy: { maxAttempts: 1 },
	});
	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.ok(result.errors.some((e) => e.includes("entryPath")));
	}
});

test("validateArtifactContract rejects hidden entryPath", () => {
	const result = validateArtifactContract({
		version: 1,
		expectedKind: "web",
		requiredOutputs: [
			{
				kind: "web",
				target: "artifact_public",
				entryPath: ".env",
			},
		],
		checks: [{ type: "web_entry_exists" }],
		repairPolicy: { maxAttempts: 1 },
	});
	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.ok(result.errors.some((e) => e.includes("entryPath")));
	}
});

test("validateArtifactContract rejects maxAttempts > 3", () => {
	const result = validateArtifactContract({
		version: 1,
		expectedKind: "auto",
		requiredOutputs: [],
		checks: [],
		repairPolicy: { maxAttempts: 5 },
	});
	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.ok(result.errors.some((e) => e.includes("maxAttempts")));
	}
});

test("validateArtifactContract rejects maxAttempts < 0", () => {
	const result = validateArtifactContract({
		version: 1,
		expectedKind: "auto",
		requiredOutputs: [],
		checks: [],
		repairPolicy: { maxAttempts: -1 },
	});
	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.ok(result.errors.some((e) => e.includes("maxAttempts")));
	}
});

test("validateArtifactContract rejects forbidden field names", () => {
	for (const field of ["command", "bash", "script", "shell"]) {
		const result = validateArtifactContract({
			version: 1,
			expectedKind: "auto",
			requiredOutputs: [],
			checks: [],
			repairPolicy: { maxAttempts: 0 },
			[field]: "evil",
		});
		assert.equal(result.ok, false, `should reject field "${field}"`);
		if (!result.ok) {
			assert.ok(
				result.errors.some((e) => e.includes(field)),
				`error should mention "${field}"`,
			);
		}
	}
});

test("validateArtifactContract rejects too many requiredOutputs", () => {
	const result = validateArtifactContract({
		version: 1,
		expectedKind: "auto",
		requiredOutputs: Array(6)
			.fill(null)
			.map(() => ({ kind: "file", target: "artifact_public" })),
		checks: [],
		repairPolicy: { maxAttempts: 0 },
	});
	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.ok(
			result.errors.some((e) => e.includes("requiredOutputs")),
		);
	}
});

test("validateArtifactContract rejects too many checks", () => {
	const result = validateArtifactContract({
		version: 1,
		expectedKind: "auto",
		requiredOutputs: [],
		checks: Array(21)
			.fill(null)
			.map(() => ({ type: "file_not_empty" })),
		repairPolicy: { maxAttempts: 0 },
	});
	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.ok(result.errors.some((e) => e.includes("checks")));
	}
});

test("normalizeArtifactRelativePath accepts valid paths", () => {
	assert.equal(normalizeArtifactRelativePath("index.html"), "index.html");
	assert.equal(
		normalizeArtifactRelativePath("report/index.html"),
		"report/index.html",
	);
	assert.equal(
		normalizeArtifactRelativePath("a\\b\\c"),
		"a/b/c",
	);
	assert.equal(
		normalizeArtifactRelativePath("  foo/bar  "),
		"foo/bar",
	);
});

test("normalizeArtifactRelativePath rejects invalid paths", () => {
	assert.equal(normalizeArtifactRelativePath(""), undefined);
	assert.equal(normalizeArtifactRelativePath(".."), undefined);
	assert.equal(normalizeArtifactRelativePath("../etc/passwd"), undefined);
	assert.equal(normalizeArtifactRelativePath(".env"), undefined);
	assert.equal(normalizeArtifactRelativePath("/absolute/path"), undefined);
	assert.equal(normalizeArtifactRelativePath("./hidden"), undefined);
});

test("normalizeArtifactDeliveryInput defaults", () => {
	const result = normalizeArtifactDeliveryInput(undefined);
	assert.deepEqual(result, {
		enabled: false,
		expectedKind: "auto",
		repairMaxAttempts: 2,
	});
});

test("normalizeArtifactDeliveryInput accepts valid input", () => {
	const result = normalizeArtifactDeliveryInput({
		enabled: true,
		expectedKind: "web",
		repairMaxAttempts: 3,
	});
	assert.deepEqual(result, {
		enabled: true,
		expectedKind: "web",
		repairMaxAttempts: 3,
	});
});

test("normalizeArtifactDeliveryInput clamps invalid values", () => {
	const result = normalizeArtifactDeliveryInput({
		enabled: true,
		expectedKind: "invalid",
		repairMaxAttempts: 10,
	});
	assert.equal(result.expectedKind, "auto");
	assert.equal(result.repairMaxAttempts, 2);
});
