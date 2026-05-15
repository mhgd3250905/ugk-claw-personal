import type { FastifyReply } from "fastify";
import type { AgentService } from "../agent/agent-service.js";
import type { AgentServiceRegistry } from "../agent/agent-service-registry.js";
import type { BrowserRegistry } from "../browser/browser-registry.js";
import { sendBadRequest, sendNotFound } from "./http-errors.js";

export function resolveScopedAgentService(
	registry: AgentServiceRegistry<AgentService> | undefined,
	agentId: string | undefined,
): AgentService | undefined {
	return registry?.get(agentId);
}

export function sendUnknownAgent(reply: FastifyReply, agentId: string | undefined): FastifyReply {
	return sendNotFound(reply, `Unknown agentId: ${agentId ?? ""}`);
}

export function resolveScopedAgentServiceOrSend(
	registry: AgentServiceRegistry<AgentService> | undefined,
	reply: FastifyReply,
	agentId: string | undefined,
): AgentService | undefined {
	const service = resolveScopedAgentService(registry, agentId);
	if (!service) {
		sendUnknownAgent(reply, agentId);
		return undefined;
	}
	return service;
}

export function validateBrowserId(
	browserRegistry: BrowserRegistry | undefined,
	reply: FastifyReply,
	browserId: string | undefined | null,
): FastifyReply | undefined {
	const normalized = String(browserId ?? "").trim();
	if (!normalized) {
		return undefined;
	}
	if (browserRegistry && !browserRegistry.get(normalized)) {
		return sendBadRequest(reply, `Unknown browserId: ${normalized}`);
	}
	return undefined;
}
