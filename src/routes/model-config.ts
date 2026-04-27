import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
	createFileModelConfigStore,
	createLiveModelSelectionValidator,
	saveDefaultModelConfig,
	type ModelConfigBody,
	type ModelConfigSaveResult,
	type ModelConfigSelection,
	type ModelConfigStore,
	type ModelSelectionValidator,
} from "../agent/model-config.js";
import { sendBadRequest, sendInternalError } from "./http-errors.js";

export interface ModelConfigRouteOptions {
	projectRoot: string;
	store?: ModelConfigStore;
	validator?: ModelSelectionValidator;
}

export function registerModelConfigRoutes(app: FastifyInstance, options: ModelConfigRouteOptions): void {
	const store = options.store ?? createFileModelConfigStore(options.projectRoot);
	const validator = options.validator ?? createLiveModelSelectionValidator(options.projectRoot);

	app.get("/v1/model-config", async (): Promise<ModelConfigBody> => {
		return await store.getConfig();
	});

	app.post(
		"/v1/model-config/validate",
		async (
			request: FastifyRequest<{ Body: Partial<ModelConfigSelection> }>,
			reply,
		): Promise<{ ok: true } | FastifyReply> => {
			const selection = parseModelSelection(request.body ?? {});
			if (selection.error) {
				return sendBadRequest(reply, selection.error);
			}
			if (!(await store.hasModel(selection.value!))) {
				return sendModelConfigError(reply, "MODEL_NOT_FOUND", `Model not found: ${selection.value!.provider}/${selection.value!.model}`);
			}
			const result = await validator(selection.value!);
			if (!result.ok) {
				return sendModelConfigError(reply, toHttpErrorCode(result.code), result.message);
			}
			return { ok: true };
		},
	);

	app.put(
		"/v1/model-config/default",
		async (
			request: FastifyRequest<{ Body: Partial<ModelConfigSelection> }>,
			reply,
		): Promise<ModelConfigSaveResult | FastifyReply> => {
			const selection = parseModelSelection(request.body ?? {});
			if (selection.error) {
				return sendBadRequest(reply, selection.error);
			}
			try {
				const result = await saveDefaultModelConfig(store, validator, selection.value!);
				if (!result.ok) {
					return sendModelConfigError(reply, toHttpErrorCode(result.code), result.message);
				}
				return result;
			} catch (error) {
				return sendInternalError(reply, error);
			}
		},
	);
}

function parseModelSelection(body: Partial<ModelConfigSelection>): { value?: ModelConfigSelection; error?: string } {
	const provider = typeof body.provider === "string" ? body.provider.trim() : "";
	const model = typeof body.model === "string" ? body.model.trim() : "";
	if (!provider) {
		return { error: 'Field "provider" must be a non-empty string' };
	}
	if (!model) {
		return { error: 'Field "model" must be a non-empty string' };
	}
	return {
		value: {
			provider,
			model,
		},
	};
}

function sendModelConfigError(reply: FastifyReply, code: string, message: string): FastifyReply {
	return reply.status(400).send({
		error: {
			code,
			message,
		},
	});
}

function toHttpErrorCode(code: string): string {
	return code.toUpperCase();
}
