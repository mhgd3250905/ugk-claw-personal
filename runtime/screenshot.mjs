#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";
import {
	requestHostBrowser,
} from "./skills-user/web-access/scripts/host-bridge.mjs";
import {
	resolveBrowserInputUrl,
} from "./skills-user/web-access/scripts/local-cdp-browser.mjs";

export function resolveBrowserTargetUrl(inputPathOrUrl, options = {}) {
	return resolveBrowserInputUrl(inputPathOrUrl, {
		projectRoot: options.projectRoot || "/app",
		publicBaseUrl: options.baseUrl,
	});
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
