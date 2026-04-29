import type { FastifyInstance } from "fastify";
import { FeishuClient } from "../integrations/feishu/client.js";
import { FeishuDeliveryService } from "../integrations/feishu/delivery.js";
import {
	FeishuSettingsStore,
	type UpdateFeishuSettingsInput,
} from "../integrations/feishu/settings-store.js";
import type { FeishuDeliveryTarget } from "../integrations/feishu/types.js";
import { sendBadRequest, sendInternalError } from "./http-errors.js";

export function registerFeishuSettingsRoutes(
	app: FastifyInstance,
	options: { settingsStore: FeishuSettingsStore },
): void {
	app.get("/v1/integrations/feishu/settings", async () => {
		return await options.settingsStore.getPublicSettings();
	});

	app.put("/v1/integrations/feishu/settings", async (request, reply) => {
		const parsed = parseUpdateFeishuSettingsBody(request.body);
		if ("error" in parsed) {
			return sendBadRequest(reply, parsed.error);
		}
		try {
			return await options.settingsStore.update(parsed.value);
		} catch (error) {
			return sendInternalError(reply, error);
		}
	});

	app.post("/v1/integrations/feishu/test-message", async (request, reply) => {
		const parsed = parseFeishuTestMessageBody(request.body);
		if ("error" in parsed) {
			return sendBadRequest(reply, parsed.error);
		}
		const settings = await options.settingsStore.getRuntimeSettings();
		const target = parsed.value.target ?? settings.activityTargets[0];
		if (!target) {
			return sendBadRequest(reply, "target is required when no Feishu activity target is configured");
		}
		try {
			await new FeishuDeliveryService({
				client: new FeishuClient({
					appId: settings.appId,
					appSecret: settings.appSecret,
					apiBase: settings.apiBase,
				}),
			}).deliverText(target, parsed.value.text ?? `UGK Feishu test ${new Date().toISOString()}`);
			return { delivered: true };
		} catch (error) {
			return sendInternalError(reply, error);
		}
	});
}

function parseUpdateFeishuSettingsBody(body: unknown): { value: UpdateFeishuSettingsInput } | { error: string } {
	if (!body || typeof body !== "object") {
		return { error: "request body must be an object" };
	}
	const record = body as Record<string, unknown>;
	const activityTargets = parseTargets(record.activityTargets);
	if ("error" in activityTargets) {
		return { error: activityTargets.error };
	}
	const allowedChatIds = parseStringArray(record.allowedChatIds, "allowedChatIds");
	if ("error" in allowedChatIds) {
		return { error: allowedChatIds.error };
	}
	return {
		value: {
			...(typeof record.enabled === "boolean" ? { enabled: record.enabled } : {}),
			...(typeof record.appId === "string" ? { appId: record.appId } : {}),
			...(typeof record.appSecret === "string" ? { appSecret: record.appSecret } : {}),
			...(record.clearAppSecret === true ? { clearAppSecret: true } : {}),
			...(typeof record.apiBase === "string" ? { apiBase: record.apiBase } : {}),
			...(allowedChatIds.value ? { allowedChatIds: allowedChatIds.value } : {}),
			...(activityTargets.value ? { activityTargets: activityTargets.value } : {}),
		},
	};
}

function parseFeishuTestMessageBody(body: unknown): { value: { target?: FeishuDeliveryTarget; text?: string } } | { error: string } {
	if (!body || typeof body !== "object") {
		return { value: {} };
	}
	const record = body as Record<string, unknown>;
	const targets = parseTargets(record.target ? [record.target] : undefined);
	if ("error" in targets) {
		return { error: targets.error };
	}
	return {
		value: {
			...(targets.value?.[0] ? { target: targets.value[0] } : {}),
			...(typeof record.text === "string" && record.text.trim() ? { text: record.text.trim() } : {}),
		},
	};
}

function parseStringArray(value: unknown, name: string): { value?: string[] } | { error: string } {
	if (value === undefined) {
		return {};
	}
	if (!Array.isArray(value)) {
		return { error: `${name} must be an array` };
	}
	return {
		value: value
			.map((item) => typeof item === "string" ? item.trim() : "")
			.filter(Boolean),
	};
}

function parseTargets(value: unknown): { value?: FeishuDeliveryTarget[] } | { error: string } {
	if (value === undefined) {
		return {};
	}
	if (!Array.isArray(value)) {
		return { error: "activityTargets must be an array" };
	}
	const targets: FeishuDeliveryTarget[] = [];
	for (const item of value) {
		if (!item || typeof item !== "object") {
			return { error: "Feishu target must be an object" };
		}
		const record = item as Record<string, unknown>;
		if (record.type === "feishu_chat" && typeof record.chatId === "string" && record.chatId.trim()) {
			targets.push({ type: "feishu_chat", chatId: record.chatId.trim() });
			continue;
		}
		if (record.type === "feishu_user" && typeof record.openId === "string" && record.openId.trim()) {
			targets.push({ type: "feishu_user", openId: record.openId.trim() });
			continue;
		}
		return { error: "Feishu target must include type=feishu_chat/chatId or type=feishu_user/openId" };
	}
	return { value: targets };
}
