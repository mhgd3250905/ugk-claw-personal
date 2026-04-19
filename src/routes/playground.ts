import type { FastifyInstance } from "fastify";
import { renderPlaygroundPage } from "../ui/playground.js";

export function registerPlaygroundRoute(app: FastifyInstance): void {
	app.get("/playground", async (_request, reply) => {
		reply.type("text/html; charset=utf-8");
		reply.header("cache-control", "no-store, no-cache, must-revalidate");
		reply.header("pragma", "no-cache");
		reply.header("expires", "0");
		return renderPlaygroundPage();
	});
}
