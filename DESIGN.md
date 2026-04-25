---
version: "alpha"
name: "UGK Claw"
description: "A compact, work-focused agent playground design system for desktop and mobile chat workflows."
colors:
  primary: "#EEF4FF"
  on-primary: "#01030A"
  secondary: "#8F93AD"
  background: "#01030A"
  surface: "#060711"
  surface-raised: "#0B0C18"
  line: "#1A1B2B"
  accent: "#C9D2FF"
  success: "#8DFFB2"
  warning: "#FFD166"
  danger: "#FF7188"
  danger-container: "#2F1119"
  on-danger-container: "#FFDBE2"
typography:
  body:
    fontFamily: "OpenAI Sans"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "1.6"
  label:
    fontFamily: "OpenAI Sans"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "1.3"
  heading:
    fontFamily: "OpenAI Sans"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: "1.25"
  code:
    fontFamily: "Agave"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "1.5"
rounded:
  sm: "4px"
  md: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  app-background:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.lg}"
  metadata:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.label}"
  divider:
    backgroundColor: "{colors.line}"
    textColor: "{colors.primary}"
    height: "1px"
  message-assistant:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  message-user:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  error-banner:
    backgroundColor: "{colors.danger-container}"
    textColor: "{colors.on-danger-container}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  icon-button:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    size: "36px"
  mobile-conversation-drawer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  mobile-conversation-item:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  mobile-work-page:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    rounded: "0"
    padding: "{spacing.md}"
  mobile-work-page-header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "0"
    padding: "{spacing.md}"
  mobile-work-page-card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  context-usage-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  accent-button:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  success-badge:
    backgroundColor: "{colors.success}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  warning-badge:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  danger-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    typography: "{typography.label}"
---

## Overview

UGK Claw is a utilitarian agent workspace, not a marketing site. The interface should feel dense, quiet, and reliable: a place for repeated work, long-running agent state, files, history, and task results. The first priority is legibility under pressure; decorative effects must never compete with the transcript.

## Colors

The palette starts from a near-black background with cool blue-gray surfaces and a small set of semantic accents. Use `primary` for main text, `secondary` for metadata, `accent` for low-intensity active affordances, and `danger-container` for blocking or corrective error surfaces. Avoid bright blue neon and avoid translucent warning surfaces when the message must be read immediately.

The light theme is a one-to-one operational companion, not a different product mood. It maps the same hierarchy to a cool off-white workspace: `#F5F7FB` background, white raised panels, `#172033` primary text, blue action accents, and muted blue-gray metadata. Preserve the same compact layout, small radii, icon-first controls, status colors, and borderless instrument-panel behavior in both themes.

## Typography

Use compact type throughout operational surfaces. Body text is small but spacious enough for Chinese and English mixed content. Headings inside cards, drawers, dialogs, and chat bubbles should stay modest; reserve larger type only for true empty states or first-screen brand moments. Code and command output use Agave where available.

## Layout & Spacing

Chat content should follow the composer width. On mobile, prioritize the transcript and composer over explanatory chrome. Controls should be icon-first when their meaning is familiar, with accessible labels preserved in markup. Fixed-format controls need stable dimensions so streaming status, hover states, and button labels do not shift the layout.

## Elevation & Depth

Depth should be functional. Prefer layered solid backgrounds over visible borders for panels, drawers, and overlays; use shadows and tone shifts to separate surfaces. Borders are reserved for active states, danger states, or dense tabular content. Avoid glassy translucency for critical information.

## Shapes

Use `4px` radius for rectangular UI elements unless a specific repeated component already has a stronger local convention. Do not nest cards inside cards. Prefer flat toolbars and full-width panels over decorative shells.

## Components

Assistant messages use dark raised surfaces. User messages use a clear opposing treatment but keep text left-aligned for readability. Error banners are opaque, high-contrast, and floating; they must not be rendered as semi-transparent overlays that rely on whatever happens to sit behind them.

Transcript message actions live inside the `.message-body` at the bottom edge of the rendered content. Keep them as compact icon-only affordances with accessible labels, no visible text, no border, no background, and no shadow. The copy action and image export action share the same quiet control rail; PNG exports must omit the action rail itself and add a small `UGK Claw` signature outside the rendered message body.

Assistant active-run status controls are singular per message card. Before attaching a new status summary or run-log trigger, clear any previous `.assistant-status-shell` / `.assistant-run-log-trigger` descendants from the same card so streaming patching cannot stack duplicate loading bubbles.

Mobile conversation selection is a compact index, not a pile of oversized cards. Use the same borderless instrument-panel language as context usage details: a layered dark drawer, a raised sticky header, short `surface-raised` rows, a narrow luminous active indicator, muted metadata pills, and an icon-only delete affordance placed inside the conversation row at the top-right corner. Avoid visible divider borders; use background depth, spacing, and shadow to separate function.

Mobile operational surfaces are pages, not decorative modals. File library, background task manager, background task editor, and task inbox use a full-height `background` workspace with a solid `surface` sticky header and `surface-raised` cards. Keep actions in one reachable toolbar row when possible; use full-width grid buttons when a card has several commands.

Every non-chat mobile work page uses an app-style topbar. The left side starts with a compact back arrow and the page title; the right side keeps the page's primary commands, such as refresh, create, save, filters, and bulk read actions, in one horizontally scrollable action row when space is tight. Do not show the global chat `mobile-topbar` on these work pages, and do not add a visible `回到对话` text button to them.

Non-chat pages and dialogs should follow the same borderless instrument-panel language as context usage details. File library, task inbox, background task manager, background task editor, run logs, confirmation dialogs, and run-detail dialogs use opaque dark layers, small radii, compact headers, and shadow/tonal depth instead of visible divider borders. Keep structural borders out of normal state; reserve them for true focus, warning, or table-like density.

Context usage details are a compact instrument panel tied to the topbar. The panel must be opaque, dark, readable, and borderless: a large percentage readout, a soft progress rail, four small metric surfaces, and a quiet model strip create hierarchy through background depth, type scale, spacing, and shadow. It must release focus before becoming hidden.

## Do's and Don'ts

Do keep mobile controls compact, stable, and reachable.
Do make process state and loading state visible without stealing transcript space.
Do validate contrast when adding new component tokens.
Don't introduce decorative gradients, orbs, or one-note color themes.
Don't hide important operational feedback in low-contrast translucent layers.
