import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateArtifactDelivery } from "../src/agent/artifact-validation.js";
import { buildDefaultArtifactContract } from "../src/agent/artifact-contract.js";
import type { RunWorkspace } from "../src/agent/background-workspace.js";

async function createTestWorkspace(): Promise<{
	rootPath: string;
	workspace: RunWorkspace;
	cleanup: () => Promise<void>;
}> {
	const rootPath = await mkdtemp(join(tmpdir(), "ugk-pi-artifact-val-"));
	const workspace: RunWorkspace = {
		rootPath,
		inputDir: join(rootPath, "input"),
		workDir: join(rootPath, "work"),
		outputDir: join(rootPath, "output"),
		logsDir: join(rootPath, "logs"),
		sessionDir: join(rootPath, "session"),
		sharedDir: join(rootPath, "shared"),
		publicDir: join(rootPath, "shared", "public"),
		artifactPublicDir: join(rootPath, "artifact-public"),
		manifestPath: join(rootPath, "manifest.json"),
	};
	await mkdir(workspace.artifactPublicDir, { recursive: true });
	await mkdir(workspace.workDir, { recursive: true });
	await mkdir(workspace.outputDir, { recursive: true });
	return {
		rootPath,
		workspace,
		cleanup: async () => {
			const { rm } = await import("node:fs/promises");
			await rm(rootPath, { recursive: true, force: true });
		},
	};
}

test("empty artifact-public fails", async () => {
	const { workspace, cleanup } = await createTestWorkspace();
	try {
		const contract = buildDefaultArtifactContract({ expectedKind: "auto", repairMaxAttempts: 0 });
		const result = await validateArtifactDelivery({
			workspace,
			contract,
			resultText: "done",
		});
		assert.equal(result.ok, false);
		assert.ok(result.issues.some((i) => i.code === "artifact_public_empty"));
	} finally {
		await cleanup();
	}
});

test("non-empty txt file passes auto validation", async () => {
	const { workspace, cleanup } = await createTestWorkspace();
	try {
		await writeFile(join(workspace.artifactPublicDir, "report.txt"), "hello world");
		const contract = buildDefaultArtifactContract({ expectedKind: "auto", repairMaxAttempts: 0 });
		const result = await validateArtifactDelivery({
			workspace,
			contract,
			resultText: "done",
		});
		assert.equal(result.ok, true);
	} finally {
		await cleanup();
	}
});

test("zero-byte file fails file_not_empty", async () => {
	const { workspace, cleanup } = await createTestWorkspace();
	try {
		await writeFile(join(workspace.artifactPublicDir, "empty.txt"), "");
		const contract = buildDefaultArtifactContract({ expectedKind: "auto", repairMaxAttempts: 0 });
		const result = await validateArtifactDelivery({
			workspace,
			contract,
			resultText: "done",
		});
		assert.equal(result.ok, false);
		assert.ok(result.issues.some((i) => i.code === "file_empty"));
	} finally {
		await cleanup();
	}
});

test("fake xlsx fails xlsx_can_open", async () => {
	const { workspace, cleanup } = await createTestWorkspace();
	try {
		await writeFile(join(workspace.artifactPublicDir, "data.xlsx"), "not an xlsx file");
		const contract = buildDefaultArtifactContract({ expectedKind: "xlsx", repairMaxAttempts: 0 });
		const result = await validateArtifactDelivery({
			workspace,
			contract,
			resultText: "done",
		});
		assert.equal(result.ok, false);
		assert.ok(result.issues.some((i) => i.code === "xlsx_invalid_header"));
	} finally {
		await cleanup();
	}
});

test("valid xlsx (ZIP header) passes", async () => {
	const { workspace, cleanup } = await createTestWorkspace();
	try {
		const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
		const content = Buffer.concat([zipHeader, Buffer.from("fake xlsx content")]);
		await writeFile(join(workspace.artifactPublicDir, "data.xlsx"), content);
		const contract = buildDefaultArtifactContract({ expectedKind: "xlsx", repairMaxAttempts: 0 });
		const result = await validateArtifactDelivery({
			workspace,
			contract,
			resultText: "done",
		});
		assert.equal(result.ok, true);
	} finally {
		await cleanup();
	}
});

test("pdf without %PDF- header fails", async () => {
	const { workspace, cleanup } = await createTestWorkspace();
	try {
		await writeFile(join(workspace.artifactPublicDir, "doc.pdf"), "not a pdf");
		const contract = buildDefaultArtifactContract({ expectedKind: "pdf", repairMaxAttempts: 0 });
		const result = await validateArtifactDelivery({
			workspace,
			contract,
			resultText: "done",
		});
		assert.equal(result.ok, false);
		assert.ok(result.issues.some((i) => i.code === "pdf_invalid_header"));
	} finally {
		await cleanup();
	}
});

test("pdf with %PDF- header passes", async () => {
	const { workspace, cleanup } = await createTestWorkspace();
	try {
		await writeFile(join(workspace.artifactPublicDir, "doc.pdf"), "%PDF-1.4 fake content");
		const contract = buildDefaultArtifactContract({ expectedKind: "pdf", repairMaxAttempts: 0 });
		const result = await validateArtifactDelivery({
			workspace,
			contract,
			resultText: "done",
		});
		assert.equal(result.ok, true);
	} finally {
		await cleanup();
	}
});

test("web with index.html and CSS passes", async () => {
	const { workspace, cleanup } = await createTestWorkspace();
	try {
		await mkdir(join(workspace.artifactPublicDir, "report"), { recursive: true });
		await writeFile(
			join(workspace.artifactPublicDir, "report", "index.html"),
			'<html><head><link href="style.css"></head><body>hello</body></html>',
		);
		await writeFile(join(workspace.artifactPublicDir, "report", "style.css"), "body{color:red}");
		const contract = buildDefaultArtifactContract({ expectedKind: "web", repairMaxAttempts: 0 });
		const result = await validateArtifactDelivery({
			workspace,
			contract,
			resultText: "done",
		});
		assert.equal(result.ok, true);
	} finally {
		await cleanup();
	}
});

test("web missing CSS fails", async () => {
	const { workspace, cleanup } = await createTestWorkspace();
	try {
		await mkdir(join(workspace.artifactPublicDir, "report"), { recursive: true });
		await writeFile(
			join(workspace.artifactPublicDir, "report", "index.html"),
			'<html><head><link href="missing.css"></head><body>hello</body></html>',
		);
		const contract = buildDefaultArtifactContract({ expectedKind: "web", repairMaxAttempts: 0 });
		const result = await validateArtifactDelivery({
			workspace,
			contract,
			resultText: "done",
		});
		assert.equal(result.ok, false);
		assert.ok(result.issues.some((i) => i.code === "html_asset_missing"));
	} finally {
		await cleanup();
	}
});

test("resultText with /app/ fails no_container_paths", async () => {
	const { workspace, cleanup } = await createTestWorkspace();
	try {
		await writeFile(join(workspace.artifactPublicDir, "report.txt"), "content");
		const contract = buildDefaultArtifactContract({ expectedKind: "auto", repairMaxAttempts: 0 });
		const result = await validateArtifactDelivery({
			workspace,
			contract,
			resultText: "See results at /app/output/report.txt",
		});
		assert.equal(result.ok, false);
		assert.ok(result.issues.some((i) => i.code === "container_path_in_result"));
	} finally {
		await cleanup();
	}
});

test("encoded local-file container path fails no_container_paths", async () => {
	const { workspace, cleanup } = await createTestWorkspace();
	try {
		await writeFile(join(workspace.artifactPublicDir, "report.txt"), "content");
		const contract = buildDefaultArtifactContract({ expectedKind: "auto", repairMaxAttempts: 0 });
		const result = await validateArtifactDelivery({
			workspace,
			contract,
			resultText:
				"See http://example.test/v1/local-file?path=%2Fapp%2Fpublic%2Freport%2Findex.html",
		});
		assert.equal(result.ok, false);
		assert.ok(result.issues.some((i) => i.code === "container_path_in_result"));
	} finally {
		await cleanup();
	}
});

test("resultText with file:// fails", async () => {
	const { workspace, cleanup } = await createTestWorkspace();
	try {
		await writeFile(join(workspace.artifactPublicDir, "report.txt"), "content");
		const contract = buildDefaultArtifactContract({ expectedKind: "auto", repairMaxAttempts: 0 });
		const result = await validateArtifactDelivery({
			workspace,
			contract,
			resultText: "See file:///tmp/report.txt",
		});
		assert.equal(result.ok, false);
		assert.ok(result.issues.some((i) => i.code === "file_url_in_result"));
	} finally {
		await cleanup();
	}
});

test("sensitive .env file fails", async () => {
	const { workspace, cleanup } = await createTestWorkspace();
	try {
		await writeFile(join(workspace.artifactPublicDir, ".env"), "SECRET=value");
		const contract = buildDefaultArtifactContract({ expectedKind: "auto", repairMaxAttempts: 0 });
		const result = await validateArtifactDelivery({
			workspace,
			contract,
			resultText: "done",
		});
		assert.equal(result.ok, false);
		assert.ok(result.issues.some((i) => i.code === "sensitive_file"));
	} finally {
		await cleanup();
	}
});

test("empty artifact-public discovers candidates from workDir", async () => {
	const { workspace, cleanup } = await createTestWorkspace();
	try {
		await mkdir(join(workspace.workDir, "report"), { recursive: true });
		await writeFile(
			join(workspace.workDir, "report", "index.html"),
			"<html><body>hello</body></html>",
		);
		const contract = buildDefaultArtifactContract({ expectedKind: "web", repairMaxAttempts: 0 });
		const result = await validateArtifactDelivery({
			workspace,
			contract,
			resultText: "done",
		});
		assert.equal(result.ok, false);
		assert.ok(result.candidates.length > 0);
		assert.ok(result.candidates.some((c) => c.kind === "web"));
	} finally {
		await cleanup();
	}
});
