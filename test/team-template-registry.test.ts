import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDefaultTeamTemplateRegistry } from "../src/team/team-template-registry.js";

describe("TeamTemplateRegistry", () => {
	it("resolves brand_domain_discovery", () => {
		const registry = createDefaultTeamTemplateRegistry();
		const template = registry.get("brand_domain_discovery");

		assert.equal(template.templateId, "brand_domain_discovery");
	});

	it("resolves competitor_domain_discovery", () => {
		const registry = createDefaultTeamTemplateRegistry();
		const template = registry.get("competitor_domain_discovery");

		assert.equal(template.templateId, "competitor_domain_discovery");
	});

	it("throws a clear error for unknown templates", () => {
		const registry = createDefaultTeamTemplateRegistry();

		assert.throws(() => registry.get("unknown"), /Unknown team template/);
	});

	it("lists template summaries for client discovery", () => {
		const registry = createDefaultTeamTemplateRegistry();
		const templates = registry.list();

		assert.deepEqual(templates.map((template) => template.templateId), [
			"brand_domain_discovery",
			"competitor_domain_discovery",
		]);
		assert.equal(templates[0].inputSchema.required.includes("keyword"), true);
		assert.equal(templates[1].inputSchema.properties.companyNames?.itemLabel, "Competitor name");
	});
});
