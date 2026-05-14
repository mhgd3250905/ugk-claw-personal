import type { TeamTemplate, TeamTemplateMetadata } from "./team-template.js";
import { brandDomainDiscoveryTemplate } from "./templates/brand-domain-discovery.js";
import { competitorDomainDiscoveryTemplate } from "./templates/competitor-domain-discovery.js";

export class TeamTemplateRegistry {
	private templates = new Map<string, TeamTemplate>();

	constructor(templates: TeamTemplate[]) {
		for (const template of templates) {
			this.templates.set(template.templateId, template);
		}
	}

	get(templateId: string): TeamTemplate {
		const template = this.templates.get(templateId);
		if (!template) {
			throw new Error(`Unknown team template: ${templateId}`);
		}
		return template;
	}

	list(): TeamTemplateMetadata[] {
		return Array.from(this.templates.values()).map((template) => template.metadata);
	}
}

export function createDefaultTeamTemplateRegistry(): TeamTemplateRegistry {
	return new TeamTemplateRegistry([
		brandDomainDiscoveryTemplate,
		competitorDomainDiscoveryTemplate,
	]);
}
