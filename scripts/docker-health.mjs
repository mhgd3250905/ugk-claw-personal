import { execFileSync } from "node:child_process";

function readComposePsJson() {
	try {
		const raw = execFileSync("docker", ["compose", "-f", "docker-compose.prod.yml", "ps", "--format", "json"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();

		if (!raw) {
			return [];
		}
		if (raw.startsWith("[")) {
			return JSON.parse(raw);
		}

		return raw
			.split(/\r?\n/)
			.filter((line) => line.trim().length > 0)
			.map((line) => JSON.parse(line));
	} catch (error) {
		console.error("Failed to inspect docker compose services.");
		if (error instanceof Error && error.message) {
			console.error(error.message);
		}
		process.exit(1);
	}
}

const services = readComposePsJson();

if (services.length === 0) {
	console.log("No production compose containers are running.");
	process.exit(0);
}

for (const service of services) {
	const name = service.Name ?? service.Service ?? "unknown";
	const state = service.State ?? "unknown";
	const health = service.Health ?? "unknown";
	const ports = service.Publishers
		? service.Publishers.map((item) => `${item.PublishedPort}:${item.TargetPort}/${item.Protocol}`).join(", ")
		: "";

	console.log(`${name}`);
	console.log(`  state : ${state}`);
	console.log(`  health: ${health}`);
	if (ports) {
		console.log(`  ports : ${ports}`);
	}
}
