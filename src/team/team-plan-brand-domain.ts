import type { CreateBrandDomainDiscoveryPlanInput } from "./types.js";
import { createBrandDomainDiscoveryTemplateRun } from "./templates/brand-domain-discovery.js";

export function createBrandDomainDiscoveryPlan(input: CreateBrandDomainDiscoveryPlanInput) {
	return createBrandDomainDiscoveryTemplateRun(input);
}
