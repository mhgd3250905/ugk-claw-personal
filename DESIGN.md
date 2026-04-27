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

The light theme is a one-to-one operational companion, not a different product mood. It maps the same hierarchy to a cool off-white workspace: `#E8EDF6` background, white raised panels, `#142033` primary text, blue action accents, and muted blue-gray metadata. Preserve the same compact layout, small radii, icon-first controls, status colors, and borderless instrument-panel behavior in both themes. Light mode must explicitly remap every dark-mode-only foreground and surface, especially markdown heading / strong / code colors, markdown table shells and cell borders, active-run status hints, file metadata, task inbox metadata, conn status badges, context usage metrics, conn time picker text, and mobile history drawer chrome; white text leaking onto light surfaces or black panels surviving inside light work pages counts as a broken theme, not a stylistic choice. In light work pages, containers that only group fields should usually be transparent; reserve filled white surfaces for inputs, repeated list items, result bubbles, and true status panels. Text labels, hints, model metadata, and toolbar copy should not get decorative dark pills just because the dark theme used them for depth.

## Typography

Use compact type throughout operational surfaces. Body text is small but spacious enough for Chinese and English mixed content. Headings inside cards, drawers, dialogs, and chat bubbles should stay modest; reserve larger type only for true empty states or first-screen brand moments. Code and command output use Agave where available.

## Layout & Spacing

Chat content should follow the composer width. On desktop, use a two-column cockpit layout: a compact left conversation rail, a transparent top command lane with the `UGK CLAW` brand signal, and a large right work stage that contains the landing canvas, transcript, and composer. The desktop command lane should feel like a geek control panel, not a centered form toolbar; keep actions tight, aligned to the right, and visually subordinate to the work stage. On mobile, prioritize the transcript and composer over explanatory chrome. The global mobile topbar is navigation, not a panel: keep the topbar, brand trigger, context slot, new-chat button, and overflow trigger transparent with no shadows; let the page background and actual drawers / menus provide depth. Controls should be icon-first when their meaning is familiar, with accessible labels preserved in markup. Fixed-format controls need stable dimensions so streaming status, hover states, and button labels do not shift the layout.

## Elevation & Depth

Depth should be functional and shadow-free. Prefer layered solid backgrounds, tone shifts, spacing, type scale, and small status accents over visible borders for panels, drawers, and overlays. Do not use `box-shadow`, `drop-shadow`, or `text-shadow` for hierarchy. Borders are reserved for active states, danger states, focus states, or dense tabular content. Avoid glassy translucency for critical information.

## Shapes

Use `4px` radius for rectangular UI elements unless a specific repeated component already has a stronger local convention. Do not nest cards inside cards. Prefer flat toolbars and full-width panels over decorative shells.

## Components

The desktop shell uses cockpit surfaces rather than marketing hero composition: the left rail is a narrow index surface with a small active accent, the right `chat-stage` is the primary work canvas, and the landing composer is a compact command deck pinned near the lower center of the stage. Empty landing mode may keep generous space for the wordmark, but active chat mode must tighten the transcript top inset so the first visible message starts close to the work canvas edge instead of floating under a hero-sized gap. Dark mode uses near-black solid layers with faint cool accents; light mode maps the same hierarchy to cool white and blue-gray layers, including a light-specific page atmosphere layer so dark edge fades never leak into the light theme.

Assistant messages use dark raised surfaces. User messages use a clear opposing treatment but keep text left-aligned for readability. In light mode, user messages should read as compact right-aligned input echoes: white or cool-white surface, dark body text, and a narrow blue edge accent, not a recycled assistant reading card or a dark gray bubble left over from the dark theme. Error banners are opaque, high-contrast, and floating; they must not be rendered as semi-transparent overlays that rely on whatever happens to sit behind them.

The composer is one control surface, not a textarea floating inside a form. When the message input or any composer control receives focus, put the active outline on `#composer-drop-target.composer:focus-within`; the inner textarea should keep `outline: none` and must not change to the accent border. This keeps focus visible without making the input feel like a generic backend form field.

Transcript message actions live inside the `.message-body` at the bottom edge of the rendered content, but only after that message has real content such as text, attachments, referenced assets, or files. Empty assistant active-run placeholders must not render the action rail, because the rail itself creates a visible empty body. Keep actions as compact icon-only affordances with accessible labels, no visible text, no border, no background, and no shadow. The copy action and image export action share the same quiet control rail; PNG exports must omit the action rail itself and add a small `UGK Claw` signature outside the rendered message body. Message-image export clones must stay origin-clean: strip external style resources, replace embedded media with a compact placeholder, and load the `foreignObject` SVG intermediate as a `data:image/svg+xml` URL before drawing to canvas.

Assistant active-run status controls are singular per message card. Before attaching a new status summary or run-log trigger, clear any previous `.assistant-status-shell` / `.assistant-run-log-trigger` descendants from the same card so streaming patching cannot stack duplicate loading bubbles.

Canonical transcript state must keep stable history and in-flight run state separated. While an agent run is still loading, any user / assistant records that the underlying session has already appended for the current run are treated as an in-flight run tail, not as durable transcript history. `viewMessages` should render the current turn from the active run snapshot exactly once; frontend DOM or text-equality cleanup is not an acceptable substitute.

Older transcript history loads by scroll intent, not by a visible pagination button. When the user reaches the top edge of the transcript, the page should fetch and prepend older messages while preserving scroll position. A small non-interactive status may announce that older history is loading, but normal state should not show a "load more" control in the chat surface.

Mobile conversation selection is a compact index, not a pile of oversized cards. Use the same borderless instrument-panel language as context usage details: a layered dark drawer, a transparent sticky header, short `surface-raised` rows, a narrow active indicator, muted metadata pills, and an icon-only delete affordance placed inside the conversation row at the top-right corner. The mobile brand trigger and drawer header should stay transparent with no shadow in both themes; the drawer shell and conversation rows carry the depth through background tone and spacing. Avoid visible divider borders; use background depth, spacing, and status color to separate function.

Mobile operational surfaces are pages, not decorative modals. File library, background task manager, background task editor, and task inbox use a full-height `background` workspace with a solid `surface` sticky header and `surface-raised` cards. Keep actions in one reachable toolbar row when possible; use full-width grid buttons when a card has several commands.

Every non-chat mobile work page uses an app-style topbar. The left side starts with a compact back arrow and the page title; the right side keeps the page's primary commands, such as refresh, create, save, filters, and bulk read actions, in one horizontally scrollable action row when space is tight. Pages such as file library and task inbox should live in their own fixed full-page shell instead of swapping content inside the chat transcript shell. Do not show the global chat `mobile-topbar` inside these work pages, and do not add a visible `回到对话` text button to them.

Non-chat pages and dialogs should follow the same borderless instrument-panel language as context usage details. File library, task inbox, background task manager, background task editor, run logs, confirmation dialogs, and run-detail dialogs use opaque dark layers, small radii, compact headers, and tonal depth instead of visible divider borders or shadows. Keep structural borders out of normal state; reserve them for true focus, warning, or table-like density.

Context usage details are a compact instrument panel tied to the topbar. The small topbar battery must leave enough right padding for the percentage text so the readout does not feel clipped. The hover tooltip opens below the trigger, stays within the viewport, and renders above the chat work surface; do not position it above the topbar where it can run out of the browser or let it sit under message cards. The hover tooltip should be a mini dashboard, not raw debug copy: status, percentage, token metrics, and model metadata need distinct typographic and tonal hierarchy. The full panel must be opaque, dark, readable, borderless, and shadow-free: a large percentage readout, a soft progress rail, four small metric surfaces, and a quiet model strip create hierarchy through background depth, type scale, spacing, and status color. It must release focus before becoming hidden.

## Do's and Don'ts

Do keep mobile controls compact, stable, and reachable.
Do make process state and loading state visible without stealing transcript space.
Do validate contrast when adding new component tokens.
Don't introduce decorative gradients, orbs, or one-note color themes.
Don't hide important operational feedback in low-contrast translucent layers.
