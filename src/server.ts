import Fastify, { type FastifyInstance } from "fastify";
import { pathToFileURL } from "node:url";
import { getAppConfig } from "./config.js";
import { AgentService } from "./agent/agent-service.js";
import { AssetStore, type AssetStoreLike } from "./agent/asset-store.js";
import { ConnRunner } from "./agent/conn-runner.js";
import { ConnScheduler } from "./agent/conn-scheduler.js";
import { ConnStore } from "./agent/conn-store.js";
import { createDefaultAgentSessionFactory } from "./agent/agent-session-factory.js";
import { ConversationStore } from "./agent/conversation-store.js";
import { FeishuClient } from "./integrations/feishu/client.js";
import { FeishuConversationMapStore } from "./integrations/feishu/conversation-map-store.js";
import { FeishuService } from "./integrations/feishu/service.js";
import { registerAssetRoutes } from "./routes/assets.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerConnRoutes } from "./routes/conns.js";
import { registerFeishuRoutes } from "./routes/feishu.js";
import { registerFileRoutes } from "./routes/files.js";
import { registerPlaygroundRoute } from "./routes/playground.js";
import { registerStaticRoutes } from "./routes/static.js";

export interface BuildServerOptions {
	agentService?: AgentService;
	assetStore?: AssetStoreLike;
	connStore?: ConnStore;
	connScheduler?: ConnScheduler;
	feishuService?: FeishuService;
}

function createDefaultAssetStore(): AssetStore {
	const config = getAppConfig();
	return new AssetStore({
		blobsDir: config.agentAssetBlobsDir,
		indexPath: config.assetIndexPath,
	});
}

function createDefaultAgentService(assetStore: AssetStoreLike): AgentService {
	const config = getAppConfig();
	const conversationStore = new ConversationStore(config.conversationIndexPath);
	const sessionFactory = createDefaultAgentSessionFactory({
		projectRoot: config.projectRoot,
		sessionDir: config.agentSessionsDir,
	});

	return new AgentService({
		conversationStore,
		sessionFactory,
		assetStore,
	});
}

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
	const app = Fastify({
		logger: false,
	});
	const assetStore = options.assetStore ?? createDefaultAssetStore();
	const agentService = options.agentService ?? createDefaultAgentService(assetStore);
	const config = getAppConfig();
	const feishuService =
		options.feishuService ??
		new FeishuService({
			agentService,
			conversationMapStore: new FeishuConversationMapStore({
				indexPath: config.feishuConversationMapPath,
			}),
			client: new FeishuClient({
				appId: process.env.FEISHU_APP_ID,
				appSecret: process.env.FEISHU_APP_SECRET,
				apiBase: process.env.FEISHU_API_BASE,
			}),
			publicBaseUrl: config.publicBaseUrl,
		});
	const connStore = options.connStore ?? new ConnStore({ indexPath: config.connIndexPath });
	const connScheduler =
		options.connScheduler ??
		new ConnScheduler({
			store: connStore,
			runner: new ConnRunner({
				agentService,
				delivery: feishuService,
			}),
		});

	app.get("/healthz", async () => {
		return { ok: true };
	});

	connScheduler.start();
	app.addHook("onClose", async () => {
		connScheduler.stop();
	});

	registerAssetRoutes(app, { projectRoot: config.projectRoot });
	registerFileRoutes(app, {
		assetStore,
		projectRoot: config.projectRoot,
	});
	registerPlaygroundRoute(app);
	registerStaticRoutes(app, { projectRoot: config.projectRoot });
	registerChatRoutes(app, { agentService });
	registerConnRoutes(app, { connStore, connScheduler });
	registerFeishuRoutes(app, { feishuService });

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
