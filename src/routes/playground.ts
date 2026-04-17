import type { FastifyInstance } from "fastify";
import { renderPlaygroundPage } from "../ui/playground.js";

export function registerPlaygroundRoute(app: FastifyInstance): void {
	app.get("/playground", async (_request, reply) => {
		reply.type("text/html; charset=utf-8");
		return renderPlaygroundPage();
	});
}
