import test from "node:test";
import assert from "node:assert/strict";
import { renderTeamPage } from "../src/ui/team-page.js";

test("standalone team page follows the home cockpit visual system", () => {
	const page = renderTeamPage();

	assert.match(page, /data-standalone-theme="cockpit"/);
	assert.match(page, /sp-cockpit-drift/);
	assert.match(page, /body\[data-standalone-theme="cockpit"\] \.team-stat-card/);
});

test("standalone team page discovers templates and creates runs", () => {
	const page = renderTeamPage();

	assert.match(page, /apiFetchTemplates\(\)/);
	assert.match(page, /fetchJson\("\/v1\/team\/templates"\)/);
	assert.match(page, /fetchJson\("\/v1\/team\/runs\?scope=all"\)/);
	assert.match(page, /apiCreateRun\(payload\)/);
	assert.match(page, /fetchJson\("\/v1\/team\/runs", \{/);
	assert.match(page, /templateId: state\.selectedTemplateId/);
	assert.match(page, /id="team-template-select"/);
	assert.match(page, /id="team-run-keyword"/);
});

test("standalone team page renders run detail surfaces", () => {
	const page = renderTeamPage();

	assert.match(page, /apiFetchRunDetail\(teamRunId\)/);
	assert.match(page, /apiFetchRunEvents\(teamRunId\)/);
	assert.match(page, /apiFetchStream\(teamRunId, streamName\)/);
	assert.match(page, /renderRunDetail\(\)/);
	assert.match(page, /candidate_domains/);
	assert.match(page, /domain_evidence/);
	assert.match(page, /final_report\.md/);
	assert.match(page, /competitor_domain_report\.md/);
});
