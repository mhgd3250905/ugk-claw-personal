import Fastify, { type FastifyInstance } from "fastify";
import { pathToFileURL } from "node:url";
import { getAppConfig } from "./config.js";
import { AgentService } from "./agent/agent-service.js";
import { createDefaultAgentSessionFactory } from "./agent/agent-session-factory.js";
import { ConversationStore } from "./agent/conversation-store.js";
import { FileArtifactStore, type FileArtifactStoreLike } from "./agent/file-artifacts.js";
import { registerAssetRoutes } from "./routes/assets.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerFileRoutes } from "./routes/files.js";
import { registerPlaygroundRoute } from "./routes/playground.js";

export interface BuildServerOptions {
	agentService?: AgentService;
	fileArtifactStore?: FileArtifactStoreLike;
}

function createDefaultFileArtifactStore(): FileArtifactStore {
	const config = getAppConfig();
	return new FileArtifactStore({
		filesDir: config.agentFilesDir,
		indexPath: config.fileIndexPath,
	});
}

function createDefaultAgentService(fileArtifactStore: FileArtifactStoreLike): AgentService {
	const config = getAppConfig();
	const conversationStore = new ConversationStore(config.conversationIndexPath);
	const sessionFactory = createDefaultAgentSessionFactory({
		projectRoot: config.projectRoot,
		sessionDir: config.agentSessionsDir,
	});

	return new AgentService({
		conversationStore,
		sessionFactory,
		fileArtifactStore,
	});
}

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
	const app = Fastify({
		logger: false,
	});
	const fileArtifactStore = options.fileArtifactStore ?? createDefaultFileArtifactStore();
	const agentService = options.agentService ?? createDefaultAgentService(fileArtifactStore);
	const config = getAppConfig();

	app.get("/healthz", async () => {
		return { ok: true };
	});

	registerAssetRoutes(app, { projectRoot: config.projectRoot });
	registerFileRoutes(app, { fileArtifactStore });
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
