---
name: playground-runtime-ui
description: Use this skill whenever the user asks to modify, tune, debug, or inspect the Playground frontend UI, including chat bubbles, light/dark theme, composer, markdown rendering, logo, layout, mobile UI, runtime CSS/JS, or zero-restart visual changes.
allowed-tools: Bash
---

# Playground Runtime UI

Use this skill before changing the Playground frontend experience.

## Source Of Truth

The authoritative UI source remains in `src/ui/`:

- `src/ui/playground.ts`
- `src/ui/playground-page-shell.ts`
- `src/ui/playground-styles.ts`
- `src/ui/playground-theme-controller.ts`
- the focused `src/ui/playground-*.ts` controllers

Runtime files under `runtime/playground/` are editable overrides for fast iteration. They are not the long-term source of truth and are ignored by Git.

## Runtime Externalized Mode

If the user wants quick visual/frontend iteration without restarting the service, use externalized mode:

```bash
PLAYGROUND_EXTERNALIZED=1
```

In Docker/local deployment, this is normally set in `.env`, then the service is restarted once:

```bash
docker compose restart ugk-pi
```

After that, the server generates/uses:

```text
runtime/playground/index.html
runtime/playground/styles.css
runtime/playground/app.js
runtime/playground/vendor/marked.umd.js
runtime/playground/extensions/custom-styles.css
runtime/playground/extensions/custom-scripts.js
runtime/playground/manifest.json
```

The browser entry stays:

```text
http://127.0.0.1:3000/playground
```

## Fast UI Iteration Workflow

For temporary visual tuning, prefer:

```text
runtime/playground/extensions/custom-styles.css
```

For temporary behavior tuning, use:

```text
runtime/playground/extensions/custom-scripts.js
```

For deeper experiments, edit:

```text
runtime/playground/styles.css
runtime/playground/app.js
```

Then refresh the browser. Do not restart `ugk-pi` unless externalized mode was just enabled or disabled.

## Reset

If runtime UI files are broken, restore the generated factory copy:

```bash
curl -X POST http://127.0.0.1:3000/playground/reset
```

Then refresh `/playground`.

## Shipping A Real Fix

Runtime edits are a draft layer. Once the user approves the visual or behavior change:

1. Move the change back into the matching `src/ui/` file.
2. Update `docs/playground-current.md` and `docs/change-log.md` for behavior or visual contract changes.
3. Run focused checks:

```bash
git diff --check
npx tsc --noEmit
node --test --import tsx test/server.test.ts
```

4. Restart `ugk-pi` and verify the real `/playground` entry.

## Guardrails

- Do not treat `runtime/playground/` as permanent product code.
- Do not remove the default inline renderer unless the user explicitly asks for a full architecture migration.
- Do not edit conversation, SSE, asset, or conn logic for a pure visual request.
- For light theme fixes, check both `src/ui/playground-styles.ts` and `src/ui/playground-theme-controller.ts`.
- For mobile UI, verify the `max-width: 640px` path separately.
