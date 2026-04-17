import Fastify, { type FastifyInstance } from "fastify";
import { pathToFileURL } from "node:url";
import { getAppConfig } from "./config.js";
import { AgentService } from "./agent/agent-service.js";
import { createDefaultAgentSessionFactory } from "./agent/agent-session-factory.js";
import { ConversationStore } from "./agent/conversation-store.js";
import { registerAssetRoutes } from "./routes/assets.js";
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

	registerAssetRoutes(app, { projectRoot: config.projectRoot });
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
