# Playground Frontend Externalization Implementation Plan

**Goal:** Make the playground frontend optionally serve from editable runtime files so UI changes can refresh without restarting the service.

**Assessment:** The proposal is implementable, but not safely as a direct replacement. Removing the existing inline `renderPlaygroundPage()` path immediately would break the current test surface and make every UI regression harder to diagnose. The safer implementation is an opt-in externalized runtime layer with the current TypeScript UI as the factory source.

**Architecture:** Keep `src/ui/` as the authoritative factory renderer. Add an externalized bundle generator that writes `runtime/playground-factory/` and initializes `runtime/playground/` only when needed. Enable runtime serving with `PLAYGROUND_EXTERNALIZED=1`; otherwise `/playground` keeps the existing inline HTML path.

**Tech Stack:** Fastify, Node filesystem APIs, TypeScript, existing playground renderer fragments.

---

## Tasks

### Task 1: Expose Playground Bundle Parts

**Files:**
- Modify: `src/ui/playground.ts`

**Steps:**
1. Export a helper that returns the current `styles`, `markedBrowserScript`, `playgroundScript`, `taskInboxView`, `connActivityDialogs`, and `assetDialogs`.
2. Keep `renderPlaygroundPage()` behavior unchanged by making it call the helper.
3. Verify existing inline route still works.

### Task 2: Add Externalized Runtime Generator

**Files:**
- Modify: `src/ui/playground-page-shell.ts`
- Create: `src/ui/playground-externalized.ts`
- Modify: `.gitignore`

**Steps:**
1. Let the page shell render either inline CSS/JS or external asset links.
2. Generate `index.html`, `styles.css`, `app.js`, `vendor/marked.umd.js`, and `manifest.json` under `runtime/playground-factory/`.
3. Initialize `runtime/playground/` from the factory only when required files are missing.
4. Keep generated runtime files ignored by Git.

### Task 3: Add Routes and Reset API

**Files:**
- Modify: `src/routes/playground.ts`
- Modify: `src/server.ts`

**Steps:**
1. Add `PLAYGROUND_EXTERNALIZED=1` switch.
2. Serve `/playground`, `/playground/styles.css`, `/playground/app.js`, `/playground/vendor/:fileName`, and `/playground/extensions/:fileName`.
3. Add `POST /playground/reset` to copy factory files back to runtime.
4. Preserve inline `/playground` as default.

### Task 4: Tests and Docs

**Files:**
- Modify: `test/server.test.ts`
- Modify: `docs/playground-current.md`
- Modify: `docs/change-log.md`

**Steps:**
1. Add server tests for externalized mode, runtime asset serving, and reset behavior.
2. Document the opt-in runtime mode and reset API.
3. Run `git diff --check`, `npx tsc --noEmit`, and targeted server tests.

## Impact Analysis

- Direct impact: `/playground` route gains an opt-in mode; default behavior remains backward compatible.
- Indirect impact: generated runtime files may be edited outside Git, so factory reset and docs must clearly explain source of truth.
- Data compatibility: no API payload or stored conversation data changes.
- Operational risk: production must set `PLAYGROUND_EXTERNALIZED=1` deliberately; otherwise current inline mode remains active.
