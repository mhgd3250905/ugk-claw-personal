#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { requestHostBrowser } from "./skills-user/web-access/scripts/host-bridge.mjs";

export function resolveBrowserTargetUrl(inputPathOrUrl, options = {}) {
	const normalizedInput = String(inputPathOrUrl || "").trim();
	if (!normalizedInput) {
		throw new Error("report path is required");
	}
	if (/^https?:\/\//i.test(normalizedInput)) {
		return normalizedInput;
	}

	const projectRoot = path.resolve(options.projectRoot || "/app");
	const baseUrl = String(options.baseUrl || process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${process.env.PORT || "3000"}`).replace(/\/+$/, "");
	const decodedInput = normalizedInput.startsWith("file://") ? decodeFileUrlPath(normalizedInput) : normalizedInput;
	const absolutePath = path.isAbsolute(decodedInput) ? path.normalize(decodedInput) : path.resolve(projectRoot, decodedInput);
	const publicDir = path.join(projectRoot, "public");
	const runtimeDir = path.join(projectRoot, "runtime");

	if (isPathInside(absolutePath, publicDir)) {
		return `${baseUrl}/${encodeURIComponent(path.basename(absolutePath))}`;
	}
	if (isPathInside(absolutePath, runtimeDir)) {
		return `${baseUrl}/runtime/${encodeURIComponent(path.basename(absolutePath))}`;
	}

	throw new Error(`report path must be under runtime or public: ${normalizedInput}`);
}

function decodeFileUrlPath(fileUrl) {
	const url = new URL(fileUrl);
	return decodeURIComponent(url.pathname);
}

function isPathInside(filePath, parentDir) {
	const normalizedFilePath = path.resolve(filePath);
	const normalizedParentDir = path.resolve(parentDir);
	const relativePath = path.relative(normalizedParentDir, normalizedFilePath);
	return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

export async function takeReportScreenshot(htmlPathOrUrl, outputPath, options = {}) {
	const targetUrl = resolveBrowserTargetUrl(htmlPathOrUrl, options);

	console.log("Creating new target...");
	const newTarget = await requestHostBrowser({
		action: "new_target",
		url: targetUrl,
	});

	if (!newTarget.ok) {
		throw new Error(`Failed to create target: ${newTarget.error || "unknown_error"}`);
	}

	const targetId = newTarget.target.id;
	console.log("Target created:", targetId);

	try {
		await new Promise((resolve) => setTimeout(resolve, 1000));

		console.log("Setting viewport...");
		await requestHostBrowser({
			action: "evaluate",
			targetId,
			expression: `
	      (() => {
	        return document.readyState === 'complete';
	      })()
	    `,
		});

		await new Promise((resolve) => setTimeout(resolve, 500));

		console.log("Taking screenshot...");
		const screenshot = await requestHostBrowser({
			action: "screenshot",
			targetId,
		});

		if (!screenshot.ok) {
			throw new Error(`Failed to take screenshot: ${screenshot.error || "unknown_error"}`);
		}

		const buffer = Buffer.from(screenshot.screenshotBase64, "base64");
		fs.writeFileSync(outputPath, buffer);
		console.log("Screenshot saved to:", outputPath);
		return { targetUrl, outputPath };
	} finally {
		await requestHostBrowser({ action: "close_target", targetId }).catch(() => undefined);
		console.log("Target closed");
	}
}

async function main() {
	const htmlPath = process.argv[2] || "/app/runtime/report-medtrum.html";
	const outputPath = process.argv[3] || "/app/runtime/report-medtrum.png";
	await takeReportScreenshot(htmlPath, outputPath);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entrypoint && import.meta.url === entrypoint) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
}
