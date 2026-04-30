import Fastify, { type FastifyInstance } from "fastify";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getAppConfig } from "./config.js";
import { AgentService } from "./agent/agent-service.js";
import { AgentActivityStore } from "./agent/agent-activity-store.js";
import { AssetStore, type AssetStoreLike } from "./agent/asset-store.js";
import { createDefaultAgentSessionFactory } from "./agent/agent-session-factory.js";
import { ConversationStore } from "./agent/conversation-store.js";
import { ConnDatabase } from "./agent/conn-db.js";
import { ConnRunStore } from "./agent/conn-run-store.js";
import { ConnSqliteStore } from "./agent/conn-sqlite-store.js";
import type { ModelConfigStore, ModelSelectionValidator } from "./agent/model-config.js";
import { NotificationHub } from "./agent/notification-hub.js";
import { registerAssetRoutes } from "./routes/assets.js";
import { registerActivityRoutes } from "./routes/activity.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerConnRoutes } from "./routes/conns.js";
import { registerFileRoutes } from "./routes/files.js";
import { registerFeishuSettingsRoutes } from "./routes/feishu-settings.js";
import { registerModelConfigRoutes } from "./routes/model-config.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerPlaygroundRoute } from "./routes/playground.js";
import { registerRuntimeDebugRoutes } from "./routes/runtime-debug.js";
import { registerStaticRoutes } from "./routes/static.js";
import { FeishuSettingsStore } from "./integrations/feishu/settings-store.js";

export interface BuildServerOptions {
	agentService?: AgentService;
	assetStore?: AssetStoreLike;
	connStore?: ConnSqliteStore;
	connRunStore?: ConnRunStore;
	activityStore?: AgentActivityStore;
	notificationHub?: NotificationHub;
	backgroundDataDir?: string;
	modelConfigStore?: ModelConfigStore;
	modelSelectionValidator?: ModelSelectionValidator;
	feishuSettingsStore?: FeishuSettingsStore;
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
	const config = getAppConfig();
	const connDatabase =
		options.connStore && options.connRunStore && options.activityStore
			? undefined
			: createDefaultConnDatabase(config.connDatabasePath);
	const notificationHub = options.notificationHub ?? new NotificationHub();
	const agentService = options.agentService ?? createDefaultAgentService(assetStore);
	const connStore = options.connStore ?? new ConnSqliteStore({ database: connDatabase! });
	const connRunStore = options.connRunStore ?? new ConnRunStore({ database: connDatabase! });
	const activityStore = options.activityStore ?? new AgentActivityStore({ database: connDatabase! });

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
	registerPlaygroundRoute(app, { projectRoot: config.projectRoot });
	registerStaticRoutes(app, { projectRoot: config.projectRoot });
	registerActivityRoutes(app, { activityStore });
	registerChatRoutes(app, { agentService });
	registerRuntimeDebugRoutes(app, { projectRoot: config.projectRoot });
	registerModelConfigRoutes(app, {
		projectRoot: config.projectRoot,
		store: options.modelConfigStore,
		validator: options.modelSelectionValidator,
	});
	registerNotificationRoutes(app, { notificationHub });
	registerFeishuSettingsRoutes(app, {
		settingsStore: options.feishuSettingsStore ?? new FeishuSettingsStore({ settingsPath: config.feishuSettingsPath }),
	});
	registerConnRoutes(app, {
		connStore,
		connRunStore,
		backgroundDataDir: options.backgroundDataDir ?? config.backgroundDataDir,
	});

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
