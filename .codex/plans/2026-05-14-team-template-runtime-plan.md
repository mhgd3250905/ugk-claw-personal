# Team Template Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current `brand_domain_discovery` Team Runtime from a single hard-coded pipeline into the first registered `TeamTemplate`, while preserving the existing `/v1/team/*` API and current run behavior.

**Architecture:** Introduce a small `TeamTemplate` interface as the seam between generic runtime orchestration and template-specific domain logic. Keep the first implementation conservative: `brand_domain_discovery` remains the only registered template, but roles, streams, validators, task input builders, stop policy and finalizer move behind the template interface instead of being hard-coded inside `TeamOrchestrator`.

**Tech Stack:** TypeScript, Node test runner, Fastify route injection, filesystem JSON/JSONL workspace, existing `TeamRoleTaskRunner` adapters.

---

## Design Intent

This is not a rewrite. The goal is to make one working team instance become a standard rail for future team instances. The current module already has useful concepts: run state, plan, roles, streams, gates, cursors, events and a worker. The problem is that the orchestration implementation still knows too much about domain-specific stream names, batch sizes and report generation. That makes the module look generic while behaving like a domain script in a nicer jacket. Cute, but not architecture.

The first extraction should create a deep module:

- Runtime owns lifecycle: queued/running/completed/blocked, retries, timeouts, cursor commit semantics, event emission, stream append validation.
- Template owns domain rules: role graph, stream validators, role input construction, readiness policy, stop policy and final artifacts.
- Runner owns execution adapter: mock, LLM, composite, later browser/tool adapters.

The first milestone is not “support every possible team topology.” That would be architecture cosplay. The first milestone is “the existing domain investigation runs through a template seam, and the seam is tested well enough that a second template can be added without editing the generic orchestrator.”

## Target Runtime Contract

### Generic runtime responsibilities

- Load `state` and `plan` for a `teamRunId`.
- Start queued runs and emit `team_run_started`.
- Enforce terminal status no-op behavior.
- Enforce `maxMinutes`, role task timeout and retry policy.
- Ask the active template which role tasks are ready.
- Execute one ready role task at a time in the current MVP.
- Validate emitted stream items through template-provided validators.
- Reject stream writes not declared by the template role.
- Commit consumer cursor only after a role task returns `success`.
- Block the run only through template-provided blocked policy.
- Finalize only through template-provided finalizer.

### Template responsibilities

- Define `templateId`.
- Define roles and their allowed input/output streams.
- Define stream validators.
- Build initial `plan` and `state` from API input.
- Build `TeamRoleTaskExecutionInput.inputData` for each role.
- Decide role readiness and input batches.
- Decide stop conditions.
- Decide whether review output blocks the run.
- Generate final artifacts.

### Current non-goals

- No UI.
- No graph scheduler.
- No multi-template public API yet.
- No parallel role execution.
- No migration of existing `.data/team` historical runs.
- No real HTTP/DNS/certificate evidence collection in this step.

## Proposed Files

- Create `src/team/team-template.ts`
  - Generic template interface and helper types.
- Create `src/team/templates/brand-domain-discovery.ts`
  - Move domain-specific roles, stream validators, task builders, finalizer and plan creation into this module.
- Create `src/team/team-template-registry.ts`
  - Register `brand_domain_discovery` and resolve template by `templateId`.
- Modify `src/team/team-orchestrator.ts`
  - Accept a `TeamTemplateRegistry` or active `TeamTemplate`.
  - Replace hard-coded stream validators and role methods with template calls.
- Modify `src/routes/team.ts`
  - Use registry/template for run creation.
- Modify `src/workers/team-worker.ts`
  - Construct orchestrator with template registry.
- Modify `src/team/types.ts`
  - Loosen `templateId`, `TeamRole.roleId`, `TeamStreamName` enough for templates while keeping existing domain payload types.
- Modify `test/team-orchestrator.test.ts`
  - Keep current behavior tests, update setup to pass registry/template.
- Add `test/team-template-registry.test.ts`
  - Registry resolution tests.
- Add `test/team-template-brand-domain.test.ts`
  - Template contract tests.
- Update `docs/team-runtime.md` and `docs/change-log.md`.

## Task 1: Define Template Interface

**Files:**
- Create: `src/team/team-template.ts`
- Modify: `src/team/types.ts`
- Test: `test/team-template-brand-domain.test.ts`

**Step 1: Write the failing test**

Add a test that imports `brandDomainDiscoveryTemplate` from the future template module and asserts:

```ts
assert.equal(brandDomainDiscoveryTemplate.templateId, "brand_domain_discovery");
assert.deepEqual(brandDomainDiscoveryTemplate.streamNames, [
	"candidate_domains",
	"domain_evidence",
	"domain_classifications",
	"review_findings",
]);
assert.ok(brandDomainDiscoveryTemplate.roles.some((role) => role.roleId === "discovery"));
assert.equal(typeof brandDomainDiscoveryTemplate.createRun, "function");
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test --import tsx test/team-template-brand-domain.test.ts
```

Expected: FAIL because `src/team/templates/brand-domain-discovery.ts` does not exist.

**Step 3: Write minimal interface**

Create `src/team/team-template.ts` with:

```ts
import type {
	CreateBrandDomainDiscoveryPlanInput,
	TeamPlan,
	TeamRole,
	TeamRoleTaskExecutionInput,
	TeamRunState,
	TeamStreamItem,
	TeamStreamName,
} from "./types.js";

export type TeamStreamValidator = (payload: unknown) =>
	| { ok: true; value: unknown }
	| { ok: false; errors: string[] };

export interface TeamRoleTaskCandidate {
	roleId: TeamRole["roleId"];
	consumes?: {
		streamName: TeamStreamName;
		items: TeamStreamItem[];
	};
	task: TeamRoleTaskExecutionInput;
}

export interface TeamFinalizationInput {
	teamRunId: string;
	state: TeamRunState;
	plan: TeamPlan;
	streams: Record<TeamStreamName, TeamStreamItem[]>;
}

export interface TeamTemplate {
	templateId: TeamPlan["templateId"];
	roles: TeamRole[];
	streamNames: TeamStreamName[];
	createRun(input: CreateBrandDomainDiscoveryPlanInput): { plan: TeamPlan; state: TeamRunState };
	getStreamValidator(streamName: TeamStreamName): TeamStreamValidator | undefined;
	getReadyRoleTasks(input: {
		teamRunId: string;
		state: TeamRunState;
		plan: TeamPlan;
		streams: Record<TeamStreamName, TeamStreamItem[]>;
		cursors: Record<string, { lastConsumedItemId?: string } | undefined>;
	}): TeamRoleTaskCandidate[];
	shouldBlock(input: {
		state: TeamRunState;
		streams: Record<TeamStreamName, TeamStreamItem[]>;
	}): { blocked: true; reason: string } | { blocked: false };
	shouldFinalize(input: {
		state: TeamRunState;
		streams: Record<TeamStreamName, TeamStreamItem[]>;
		cursors: Record<string, { lastConsumedItemId?: string } | undefined>;
	}): boolean;
	finalize(input: TeamFinalizationInput): Promise<void>;
}
```

If TypeScript complains about narrow literal types, loosen `TeamPlan["templateId"]`, `TeamRole["roleId"]` and `TeamStreamName` carefully. Keep existing domain payload types unchanged.

**Step 4: Run test to verify it still fails for missing implementation**

Run:

```bash
node --test --import tsx test/team-template-brand-domain.test.ts
```

Expected: FAIL only because template implementation is absent.

## Task 2: Move Brand Domain Template Definition

**Files:**
- Create: `src/team/templates/brand-domain-discovery.ts`
- Modify: `src/team/team-plan-brand-domain.ts`
- Test: `test/team-template-brand-domain.test.ts`

**Step 1: Write failing tests**

Extend the template test:

```ts
const { plan, state } = brandDomainDiscoveryTemplate.createRun({
	keyword: "Medtrum",
	companyNames: ["上海移宇科技"],
	maxRounds: 1,
});

assert.equal(plan.templateId, "brand_domain_discovery");
assert.equal(state.templateId, "brand_domain_discovery");
assert.ok(plan.discoveryPlan.searchQueries.includes("Medtrum official domain"));
assert.ok(plan.discoveryPlan.searchQueries.includes("\"上海移宇科技\" Medtrum domain"));
```

Also assert stream validators:

```ts
const validator = brandDomainDiscoveryTemplate.getStreamValidator("candidate_domains");
assert.ok(validator);
assert.equal(validator({
	domain: "medtrum.com",
	sourceType: "search_query",
	matchReason: "official result",
	confidence: "high",
	discoveredAt: "2026-05-14T00:00:00.000Z",
}).ok, true);
```

**Step 2: Run red**

Run:

```bash
node --test --import tsx test/team-template-brand-domain.test.ts
```

Expected: FAIL because template implementation does not exist.

**Step 3: Implement minimal template**

Move or re-export existing `createBrandDomainDiscoveryPlan()` through `brandDomainDiscoveryTemplate.createRun`. Move `BRAND_DOMAIN_ROLES`, `ALL_STREAMS`, and validator mapping behind the template. Keep `src/team/team-plan-brand-domain.ts` as a compatibility wrapper:

```ts
export function createBrandDomainDiscoveryPlan(input: CreateBrandDomainDiscoveryPlanInput) {
	return brandDomainDiscoveryTemplate.createRun(input);
}
```

**Step 4: Run green**

Run:

```bash
node --test --import tsx test/team-template-brand-domain.test.ts
npm run test:team
```

Expected: PASS.

## Task 3: Add Template Registry

**Files:**
- Create: `src/team/team-template-registry.ts`
- Test: `test/team-template-registry.test.ts`

**Step 1: Write failing tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultTeamTemplateRegistry } from "../src/team/team-template-registry.js";

describe("TeamTemplateRegistry", () => {
	it("resolves brand_domain_discovery", () => {
		const registry = createDefaultTeamTemplateRegistry();
		const template = registry.get("brand_domain_discovery");
		assert.equal(template.templateId, "brand_domain_discovery");
	});

	it("throws a clear error for unknown templates", () => {
		const registry = createDefaultTeamTemplateRegistry();
		assert.throws(() => registry.get("unknown"), /Unknown team template/);
	});
});
```

**Step 2: Run red**

Run:

```bash
node --test --import tsx test/team-template-registry.test.ts
```

Expected: FAIL because registry is absent.

**Step 3: Implement registry**

```ts
import type { TeamTemplate } from "./team-template.js";
import { brandDomainDiscoveryTemplate } from "./templates/brand-domain-discovery.js";

export class TeamTemplateRegistry {
	private templates = new Map<string, TeamTemplate>();

	constructor(templates: TeamTemplate[]) {
		for (const template of templates) {
			this.templates.set(template.templateId, template);
		}
	}

	get(templateId: string): TeamTemplate {
		const template = this.templates.get(templateId);
		if (!template) throw new Error(`Unknown team template: ${templateId}`);
		return template;
	}
}

export function createDefaultTeamTemplateRegistry(): TeamTemplateRegistry {
	return new TeamTemplateRegistry([brandDomainDiscoveryTemplate]);
}
```

**Step 4: Run green**

Run:

```bash
node --test --import tsx test/team-template-registry.test.ts
```

Expected: PASS.

## Task 4: Move Orchestrator Stream Validation Behind Template

**Files:**
- Modify: `src/team/team-orchestrator.ts`
- Modify: `test/team-orchestrator.test.ts`

**Step 1: Write failing test**

Update orchestrator setup to pass the default registry/template. Add a targeted test that makes discovery emit a stream not declared by the template and assert `stream_item_rejected`.

Use a custom runner:

```ts
class BadStreamRunner extends DeterministicMockTeamRoleTaskRunner {
	async runTask(task: TeamRoleTaskExecutionInput): Promise<TeamRoleTaskExecutionResult> {
		if (task.roleId === "discovery") {
			return {
				status: "success",
				emits: [{ streamName: "not_allowed" as any, payload: {} }],
			};
		}
		return super.runTask(task);
	}
}
```

Expected event:

```ts
assert.ok(events.some((event) => event.eventType === "stream_item_rejected"));
```

**Step 2: Run red**

Run:

```bash
node --test --import tsx test/team-orchestrator.test.ts
```

Expected: fail until orchestrator uses template-declared validators/streams.

**Step 3: Refactor minimally**

Change `TeamOrchestratorConfig` to accept `templateRegistry`. In `tick()`, read plan, resolve template by `plan.templateId`, and pass it into helper methods. Replace module-level `STREAM_VALIDATORS` and `canRoleWriteStream()` direct use with template methods:

- `template.getStreamValidator(streamName)`
- `role.outputStreams.includes(streamName)`

Do not yet change scheduling.

**Step 4: Run green**

Run:

```bash
node --test --import tsx test/team-orchestrator.test.ts
npm run test:team
```

Expected: PASS.

## Task 5: Move Role Readiness Into Template

**Files:**
- Modify: `src/team/team-orchestrator.ts`
- Modify: `src/team/templates/brand-domain-discovery.ts`
- Test: `test/team-template-brand-domain.test.ts`
- Test: `test/team-orchestrator.test.ts`

**Step 1: Write failing template tests**

Test that the template returns the discovery task when state has room:

```ts
const taskCandidates = brandDomainDiscoveryTemplate.getReadyRoleTasks({
	teamRunId: state.teamRunId,
	state,
	plan,
	streams: emptyStreams,
	cursors: {},
});
assert.equal(taskCandidates[0].roleId, "discovery");
assert.deepEqual(taskCandidates[0].task.inputData.queries, plan.discoveryPlan.searchQueries);
```

Test that evidence collector returns no task before discovery is stopped if fewer than 10 candidates exist and max rounds remain.

**Step 2: Run red**

Run:

```bash
node --test --import tsx test/team-template-brand-domain.test.ts
```

Expected: FAIL until readiness moves into template.

**Step 3: Implement template readiness**

Move the logic from:

- `maybeRunDiscovery`
- `maybeRunEvidenceCollector`
- `maybeRunClassifier`
- `maybeRunReviewer`

into `brandDomainDiscoveryTemplate.getReadyRoleTasks()`. Keep batch sizes unchanged: candidates/evidence 10, reviewer 20.

Each returned `TeamRoleTaskCandidate` should optionally include:

```ts
consumes: {
	streamName: "candidate_domains",
	items: batch,
}
```

Discovery increments `currentRound` today inside orchestrator. Preserve behavior by having orchestrator apply a template hook or by returning metadata:

```ts
statePatch?: { incrementRound?: true }
```

Prefer the simpler explicit field:

```ts
updates?: { incrementCurrentRound?: boolean }
```

**Step 4: Update orchestrator**

Inside `tick()`, after start/maxMinutes:

1. Load all template streams and relevant cursors.
2. Ask `template.getReadyRoleTasks(...)`.
3. Execute candidates in order until none remain for this tick, or execute one candidate per tick if that is simpler.
4. Commit candidate cursor only if result status is `success`.
5. Apply `updates.incrementCurrentRound` before task execution for discovery, preserving existing behavior.

Keep current one-tick behavior if possible: discovery, evidence, classifier, reviewer can all run in one tick for `maxRounds=1`.

**Step 5: Run green**

Run:

```bash
npm run test:team
```

Expected: all existing orchestrator behavior remains green.

## Task 6: Move Block and Finalize Policy Into Template

**Files:**
- Modify: `src/team/team-orchestrator.ts`
- Modify: `src/team/templates/brand-domain-discovery.ts`
- Test: `test/team-template-brand-domain.test.ts`
- Test: `test/team-orchestrator.test.ts`

**Step 1: Write failing tests**

Template test:

```ts
const result = brandDomainDiscoveryTemplate.shouldBlock({
	state,
	streams: {
		...emptyStreams,
		review_findings: [{
			itemId: "si_1",
			teamRunId: state.teamRunId,
			streamName: "review_findings",
			producerRoleId: "reviewer",
			producerTaskId: "rt_1",
			payload: {
				verdict: "needs_user_input",
				issueType: "missing_evidence",
				message: "Need official whitelist",
				createdAt: "2026-05-14T00:00:00.000Z",
			},
			createdAt: "2026-05-14T00:00:00.000Z",
		}],
	},
});
assert.deepEqual(result, { blocked: true, reason: "Need official whitelist" });
```

Finalizer test should assert final artifacts are generated through template finalizer, not `TeamOrchestrator.generateReport`.

**Step 2: Run red**

Run:

```bash
node --test --import tsx test/team-template-brand-domain.test.ts
```

Expected: FAIL.

**Step 3: Implement policy/finalizer**

Move `generateReport()` implementation from orchestrator into template. Orchestrator should call:

```ts
await template.finalize({ teamRunId, state, plan, streams });
```

Remove domain-specific classification count logic from orchestrator.

**Step 4: Run green**

Run:

```bash
npm run test:team
```

Expected: PASS.

## Task 7: Route and Worker Use Registry

**Files:**
- Modify: `src/routes/team.ts`
- Modify: `src/workers/team-worker.ts`
- Modify: `src/server.ts` only if dependency injection is needed for tests.
- Test: existing `test/server.test.ts` if team routes are covered; otherwise add focused route test.

**Step 1: Write failing route test**

If no route test exists, add a small server injection test that enables team runtime and creates a run. If env-driven config is awkward, instantiate `registerTeamRoutes()` with a temp workspace and default registry in a focused test.

Expected:

```ts
assert.equal(response.statusCode, 201);
assert.equal(body.plan.templateId, "brand_domain_discovery");
```

**Step 2: Run red**

Run focused route test.

**Step 3: Implement registry use**

`registerTeamRoutes()` should resolve the template through registry instead of directly calling `createBrandDomainDiscoveryPlan()`. For now, `POST /v1/team/runs` still always creates `brand_domain_discovery`; do not add a public `templateId` request field yet.

Worker should pass `createDefaultTeamTemplateRegistry()` into `TeamOrchestrator`.

**Step 4: Run green**

Run:

```bash
npm run test:team
npx tsc --noEmit
```

Expected: PASS.

## Task 8: Remove Spike Leakage From Runtime Imports

**Files:**
- Create: `src/team/team-search.ts`
- Create: `src/team/json-output.ts`
- Modify: `src/team/team-role-task-runner.ts`
- Test: `test/team-search.test.ts` or new focused tests.

**Step 1: Write failing tests**

Add tests around `stripMarkdownFence`, `repairJson` wrapper, and SearXNG formatting in formal `src/team` modules.

**Step 2: Run red**

Run:

```bash
node --test --import tsx test/team-search.test.ts
```

Expected: FAIL for missing formal modules.

**Step 3: Move wrappers**

Move or wrap `team-lab` helpers under formal `src/team` modules. Then update `team-role-task-runner.ts` to import only from `src/team/*`.

Keep `src/team-lab/` untouched unless a later cleanup explicitly archives it.

**Step 4: Run green**

Run:

```bash
npm run test:team
npm run test:team-lab
npx tsc --noEmit
```

Expected: PASS.

## Task 9: Documentation and Change Log

**Files:**
- Modify: `docs/team-runtime.md`
- Modify: `docs/change-log.md`
- Optionally modify: `docs/traceability-map.md` if new template files become primary entry points.

**Step 1: Update docs**

Document:

- `TeamTemplate` is now the runtime seam.
- `brand_domain_discovery` is the first template.
- Generic runtime vs template-owned responsibilities.
- Current non-goals remain: no UI, no parallel graph scheduler, no real ownership verification.

**Step 2: Update change log**

Add a `2026-05-14` entry with:

- topic
- impact scope
- verification commands
- entry files

**Step 3: Verify**

Run:

```bash
git diff --check
npm run test:team
npx tsc --noEmit
```

Expected: PASS.

## Acceptance Criteria

- Existing `/v1/team/runs` API behavior is preserved.
- `npm run test:team` passes.
- `npx tsc --noEmit` passes.
- `TeamOrchestrator` no longer imports domain payload validators directly.
- `TeamOrchestrator` no longer contains brand-domain report generation.
- `brand_domain_discovery` behavior remains covered by template tests and orchestrator integration tests.
- Adding a second template should require a new template module and registry entry, not edits to generic orchestrator scheduling, validation, or finalization logic.

## Risks and Guardrails

- **Risk:** Over-generalizing into a graph engine too early.  
  **Guardrail:** Keep one ready-task loop and one registered template. Extract only seams proven by the existing chain.

- **Risk:** Weakening type safety by turning every stream into `string`.  
  **Guardrail:** Use template-owned validator maps and keep domain payload types. Generic runtime may use strings, but templates validate payloads.

- **Risk:** Breaking existing `.data/team` runs.  
  **Guardrail:** Do not change serialized `plan.json`, `state.json`, stream names, cursor filenames or artifact names in this phase.

- **Risk:** Hiding failures again through cursor commits.  
  **Guardrail:** Preserve and expand tests proving cursor commits only after `success`.

- **Risk:** Making `TeamTemplate` shallow.  
  **Guardrail:** Runtime should call a small number of template methods that hide meaningful domain behavior: readiness, validation, block policy and finalization.

