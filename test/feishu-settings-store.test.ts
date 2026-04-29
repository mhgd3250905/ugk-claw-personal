import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FeishuSettingsStore } from "../src/integrations/feishu/settings-store.js";

test("FeishuSettingsStore stores runtime credentials but redacts app secret from public settings", async () => {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-feishu-settings-"));
	const store = new FeishuSettingsStore({
		settingsPath: join(root, "settings.json"),
		env: {},
	});

	const publicSettings = await store.update({
		enabled: true,
		appId: "cli_app",
		appSecret: "secret",
		apiBase: "https://open.feishu.cn/open-apis",
		allowedChatIds: ["oc_chat"],
		activityTargets: [{ type: "feishu_user", openId: "ou_user" }],
	});

	assert.equal(publicSettings.enabled, true);
	assert.equal(publicSettings.appId, "cli_app");
	assert.equal(publicSettings.hasAppSecret, true);
	assert.deepEqual(publicSettings.allowedChatIds, ["oc_chat"]);
	assert.deepEqual(publicSettings.activityTargets, [{ type: "feishu_user", openId: "ou_user" }]);
	assert.equal("appSecret" in publicSettings, false);

	const runtimeSettings = await store.getRuntimeSettings();
	assert.equal(runtimeSettings.appSecret, "secret");
});

test("FeishuSettingsStore falls back to env when settings file has not been configured", async () => {
	const root = await mkdtemp(join(tmpdir(), "ugk-pi-feishu-settings-env-"));
	const store = new FeishuSettingsStore({
		settingsPath: join(root, "settings.json"),
		env: {
			FEISHU_ENABLED: "true",
			FEISHU_APP_ID: "env-app",
			FEISHU_APP_SECRET: "env-secret",
			FEISHU_ALLOWED_CHAT_IDS: "oc_a, oc_b",
			FEISHU_ACTIVITY_OPEN_IDS: "ou_a",
		},
	});

	const settings = await store.getRuntimeSettings();

	assert.equal(settings.enabled, true);
	assert.equal(settings.appId, "env-app");
	assert.equal(settings.appSecret, "env-secret");
	assert.deepEqual(settings.allowedChatIds, ["oc_a", "oc_b"]);
	assert.deepEqual(settings.activityTargets, [{ type: "feishu_user", openId: "ou_a" }]);
});
