#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import { takeReportScreenshot } from "./screenshot.mjs";

async function main() {
	const htmlPath = process.argv[2] || "/app/runtime/report-medtrum-mobile.html";
	const outputPath = process.argv[3] || "/app/runtime/report-medtrum-mobile.png";
	await takeReportScreenshot(htmlPath, outputPath);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entrypoint && import.meta.url === entrypoint) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
}
