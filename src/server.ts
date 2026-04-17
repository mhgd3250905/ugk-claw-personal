import Fastify, { type FastifyInstance } from "fastify";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import { getAppConfig } from "./config.js";
import { AgentService } from "./agent/agent-service.js";
import { createDefaultAgentSessionFactory } from "./agent/agent-session-factory.js";
import { ConversationStore } from "./agent/conversation-store.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerPlaygroundRoute } from "./routes/playground.js";

export interface BuildServerOptions {
	agentService?: AgentService;
}

function createDefaultAgentService(): AgentService {
	const config = getAppConfig();
	const conversationStore = new ConversationStore(config.conversationIndexPath);
	const sessionFactory = createDefaultAgentSessionFactory({
		projectRoot: config.projectRoot,
		sessionDir: config.agentSessionsDir,
	});

	return new AgentService({
		conversationStore,
		sessionFactory,
	});
}

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
	const app = Fastify({
		logger: false,
	});
	const agentService = options.agentService ?? createDefaultAgentService();
	const config = getAppConfig();

	app.get("/healthz", async () => {
		return { ok: true };
	});

	app.get("/assets/fonts/:fileName", async (request, reply) => {
		const { fileName } = request.params as { fileName: string };
		const safeFileName = basename(fileName);
		if (safeFileName !== fileName || !safeFileName.endsWith(".ttf")) {
			return reply.status(404).send();
		}

		const fontPath = normalize(join(config.projectRoot, "public", "fonts", safeFileName));
		try {
			const fileStat = await stat(fontPath);
			reply.type("font/ttf");
			reply.header("content-length", fileStat.size);
			return reply.send(createReadStream(fontPath));
		} catch {
			return reply.status(404).send();
		}
	});

	registerPlaygroundRoute(app);
	registerChatRoutes(app, { agentService });

	return app;
}

async function main(): Promise<void> {
	const config = getAppConfig();
	const app = buildServer();

	try {
		await app.listen({
			host: config.host,
			port: config.port,
		});
	} catch (error) {
		app.log.error(error);
		process.exitCode = 1;
	}
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entrypoint && import.meta.url === entrypoint) {
	await main();
}
