import Fastify, { type FastifyInstance } from "fastify";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getAppConfig } from "./config.js";
import { AgentService } from "./agent/agent-service.js";
import { AssetStore, type AssetStoreLike } from "./agent/asset-store.js";
import { createDefaultAgentSessionFactory } from "./agent/agent-session-factory.js";
import { ConversationStore } from "./agent/conversation-store.js";
import { ConnDatabase } from "./agent/conn-db.js";
import { ConnRunStore } from "./agent/conn-run-store.js";
import { ConnSqliteStore } from "./agent/conn-sqlite-store.js";
import { ConversationNotificationStore } from "./agent/conversation-notification-store.js";
import { NotificationHub } from "./agent/notification-hub.js";
import { FeishuClient } from "./integrations/feishu/client.js";
import { FeishuConversationMapStore } from "./integrations/feishu/conversation-map-store.js";
import { FeishuService } from "./integrations/feishu/service.js";
import { registerAssetRoutes } from "./routes/assets.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerConnRoutes } from "./routes/conns.js";
import { registerFeishuRoutes } from "./routes/feishu.js";
import { registerFileRoutes } from "./routes/files.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerPlaygroundRoute } from "./routes/playground.js";
import { registerStaticRoutes } from "./routes/static.js";

export interface BuildServerOptions {
	agentService?: AgentService;
	assetStore?: AssetStoreLike;
	connStore?: ConnSqliteStore;
	connRunStore?: ConnRunStore;
	notificationStore?: ConversationNotificationStore;
	notificationHub?: NotificationHub;
	backgroundDataDir?: string;
	feishuService?: FeishuService;
}

function createDefaultAssetStore(): AssetStore {
	const config = getAppConfig();
	return new AssetStore({
		blobsDir: config.agentAssetBlobsDir,
		indexPath: config.assetIndexPath,
	});
}

function createDefaultConnDatabase(dbPath: string): ConnDatabase {
	const config = getAppConfig();
	const legacyDbPath = join(config.connDataDir, "conn.sqlite");
	const normalizedDbPath = dbPath.replace(/\\/g, "/");
	const normalizedLegacyDbPath = legacyDbPath.replace(/\\/g, "/");
	const database = new ConnDatabase({
		dbPath,
		legacyDbPath: normalizedLegacyDbPath !== normalizedDbPath ? legacyDbPath : undefined,
	});
	database.initializeSync();
	return database;
}

function createDefaultAgentService(assetStore: AssetStoreLike, notificationStore?: ConversationNotificationStore): AgentService {
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
		notificationStore,
	});
}

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
	const app = Fastify({
		logger: false,
	});
	const assetStore = options.assetStore ?? createDefaultAssetStore();
	const config = getAppConfig();
	const connDatabase =
		options.connStore && options.connRunStore && options.notificationStore
			? undefined
			: createDefaultConnDatabase(config.connDatabasePath);
	const notificationStore = options.notificationStore ?? new ConversationNotificationStore({ database: connDatabase! });
	const notificationHub = options.notificationHub ?? new NotificationHub();
	const agentService = options.agentService ?? createDefaultAgentService(assetStore, notificationStore);
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
	const connStore = options.connStore ?? new ConnSqliteStore({ database: connDatabase! });
	const connRunStore = options.connRunStore ?? new ConnRunStore({ database: connDatabase! });

	app.get("/healthz", async () => {
		return { ok: true };
	});

	app.addHook("onClose", async () => {
		connDatabase?.close();
	});

	registerAssetRoutes(app, { projectRoot: config.projectRoot });
	registerFileRoutes(app, {
		assetStore,
		projectRoot: config.projectRoot,
	});
	registerPlaygroundRoute(app);
	registerStaticRoutes(app, { projectRoot: config.projectRoot });
	registerChatRoutes(app, { agentService });
	registerNotificationRoutes(app, { notificationHub });
	registerConnRoutes(app, {
		connStore,
		connRunStore,
		backgroundDataDir: options.backgroundDataDir ?? config.backgroundDataDir,
		getCurrentConversationId: async () => (await agentService.getConversationCatalog()).currentConversationId,
	});
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
