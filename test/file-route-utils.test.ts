import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import {
	buildContentDispositionHeader,
	resolveFileResponseContentType,
	resolveLocalArtifactPath,
	shouldForceDownload,
	toMultipartAttachment,
} from "../src/routes/file-route-utils.js";

test("toMultipartAttachment keeps small text uploads as text and binary uploads as base64", () => {
	assert.deepEqual(toMultipartAttachment("note.md", "text/markdown", Buffer.from("hello")), {
		fileName: "note.md",
		mimeType: "text/markdown",
		sizeBytes: 5,
		text: "hello",
	});

	assert.deepEqual(toMultipartAttachment("image.bin", "application/octet-stream", Buffer.from([1, 2, 3])), {
		fileName: "image.bin",
		mimeType: "application/octet-stream",
		sizeBytes: 3,
		base64: "AQID",
	});
});

test("buildContentDispositionHeader emits ascii fallback and utf8 filename", () => {
	assert.equal(
		buildContentDispositionHeader("attachment", "报告 \"Q1\".md"),
		`attachment; filename="__ _Q1_.md"; filename*=UTF-8''%E6%8A%A5%E5%91%8A%20_Q1_.md`,
	);
});

test("resolveLocalArtifactPath allows only public and runtime artifacts", () => {
	const projectRoot = "E:/AII/ugk-pi";

	assert.equal(
		resolveLocalArtifactPath("/app/runtime/report.html", projectRoot),
		resolve(projectRoot, "runtime/report.html"),
	);
	assert.equal(
		resolveLocalArtifactPath("http://127.0.0.1:3000/v1/local-file?path=%2Fapp%2Fpublic%2Fx.png", projectRoot),
		resolve(projectRoot, "public/x.png"),
	);
	assert.equal(resolveLocalArtifactPath("/app/.data/agent/asset-index.json", projectRoot), undefined);
});

test("download and content-type helpers preserve current response semantics", () => {
	assert.equal(shouldForceDownload("1"), true);
	assert.equal(shouldForceDownload("false"), false);
	assert.equal(resolveFileResponseContentType("text/markdown"), "text/markdown; charset=utf-8");
	assert.equal(resolveFileResponseContentType("image/png"), "image/png");
});
