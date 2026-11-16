---
name: Patchlane
description: Security check-up for APIs and the AI agents that call them.
colors:
  accent: "#a08672"
  accent-ink: "#111111"
  accent-hi: "#b9a08b"
  accent-wash: "rgba(160, 134, 114, 0.14)"
  sev-critical: "#f07070"
  sev-high: "#ec9055"
  sev-medium: "#d8b763"
  sev-low: "#93b2d2"
  sev-info: "#a0a0a0"
  bg: "#111111"
  pane: "#141414"
  well: "#0c0c0c"
  surface: "#1c1c1c"
  selected: "#212121"
  window: "#151515"
  ink: "#f2f2f2"
  ink-2: "#cfcfcf"
  muted: "#8f8f8f"
  faint: "#7d7d7d"
  line: "rgba(242, 242, 242, 0.08)"
  line-2: "rgba(242, 242, 242, 0.14)"
  inverse-bg: "#f2f2f2"
  inverse-ink: "#111111"
  inverse-muted: "#5c5c5c"
  ground-sand: "#d9ccb7"
  syntax-keyword: "#d1ad8f"
  syntax-string: "#a9c39f"
  syntax-number: "#dcbc72"
  syntax-comment: "#8c8c8c"
  syntax-decorator: "#93b2d2"
  syntax-property: "#e6e6e6"
typography:
  display:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "clamp(41.6px, 2.377vw + 32.33px, 66.56px)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.036em"
    fontVariation: "'wdth' 96"
  headline:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "clamp(30px, 1.72vw + 23.3px, 48px)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.028em"
    fontVariation: "'wdth' 96"
  title:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.022em"
  stat:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "clamp(28px, 0.952vw + 24.29px, 38px)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.028em"
    fontFeature: "'tnum' 1"
  lead:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  body-app:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'ss01' 1"
    fontVariation: "'wdth' 96"
  body-reading:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "DM Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  dot: "2px"
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "64px"
  s-9: "96px"
  s-10: "128px"
  gutter: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.sm}"
    height: "44px"
    padding: "0 24px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hi}"
    textColor: "{colors.accent-ink}"
  button-primary-compact:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.sm}"
    height: "38px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "44px"
    padding: "0 24px"
  button-secondary-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    height: "34px"
    padding: "0 10px"
  button-ghost-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    size: "32px"
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "38px"
    padding: "0 12px"
  code-input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  check-box-checked:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    size: "18px"
  desk-tab:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    height: "40px"
    padding: "0 8px"
  desk-tab-selected:
    textColor: "{colors.ink}"
  section-tab:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 16px"
  section-tab-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
  chip-severity:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "0 11px"
  chip-severity-pressed:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.ink}"
  severity-dot:
    backgroundColor: "{colors.sev-info}"
    rounded: "{rounded.dot}"
    size: "8px"
  severity-pill:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: "26px"
    padding: "0 10px"
  finding-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "13px 12px"
  finding-row-hover:
    backgroundColor: "{colors.surface}"
  finding-row-selected:
    backgroundColor: "{colors.selected}"
  grade-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    size: "78px"
  segmented:
    backgroundColor: "transparent"
    rounded: "{rounded.md}"
    padding: "3px"
  segmented-item:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: "30px"
    padding: "0 12px"
  segmented-item-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
  code-block:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink-2}"
    typography: "{typography.mono}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  evidence:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  menu:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "6px"
  menu-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    height: "38px"
    padding: "0 10px"
  menu-item-hover:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
  empty-mark:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
    rounded: "{rounded.lg}"
    size: "48px"
  brand-mark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.sm}"
    size: "26px"
  top-bar:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    height: "56px"
    padding: "0 20px"
  nav:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    height: "72px"
---

# Design System: Patchlane

## Overview

**Creative North Star: "The Quiet Inspection Desk"**

Patchlane is an inspection desk at night: a graphite ground, chalk-white text, and one bronze lamp that lights only what you can act on. Everything else on screen is evidence (operations, headers, claims, tool names) set in a monospaced face and ranked by severity colours that never appear without their word. The mood is calm and exact. Nothing shouts or glows; the interface earns trust by showing what it matched rather than by decorating it.

Two densities share one world. The landing page is a software site built on the taste-skill kit: one section per screen, 120px section tops, a collage hero whose product window floats on a painterly landscape drawn in WebGL, one chalk inverse band, and the product name set across the closing screen. The check-up app and the rules catalogue are operate-and-read surfaces: 14px chrome, three independently scrolling desks, every state drawn, and hairlines doing the work that shadows do elsewhere.

Depth is tonal and linear, not atmospheric. Corners are sharp (4, 6, 8px). Motion only answers the pointer, the keyboard or a selection; the hero settles once on load and one row of figures rolls once. Fonts and assets are self-hosted and every page runs under a strict content security policy, so no surface depends on a third party.

**Key Characteristics:**
- Graphite ground (#111111) with chalk ink (#f2f2f2) and one bronze accent (#a08672) for action, selection and focus.
- Instrument Sans at weight 500 with tight negative tracking for display; DM Mono for everything a machine wrote.
- Five fixed severity hues, always beside their label.
- Flat surfaces separated by 1px chalk hairlines at 8% and 14%; shadows only on things that float.
- Sharp radius scale: 4px controls, 6px blocks, 8px tiles and frames.
- Landing: one section per screen on a 12-column, 1280px grid. App: three desks that collapse to two, then one.
- WCAG 2.2 AA, 44px touch targets, reduced motion honoured on every surface.

## Colors

Lunar graphite and chalk, warmed by a single patina bronze; the only other hues are severity and code syntax, and both carry meaning.

### Primary
- **Patina Bronze** (#a08672): the one action colour. Primary buttons (Graphite text on it reads 5.5:1), the 2px focus ring, the selected desk tab's 2px underline, the pressed filter chip's border, checked check boxes, the documentation meter, the text caret, the lock icon in "Runs in this tab", and the empty-state mark. On the chalk band it stays the action colour (3:1 as a focus ring there, the minimum).
- **Lit Bronze** (#b9a08b): bronze lifted for dark ground. The primary button's hover, and every use of bronze as text: rule ids, JWT claim names, Gherkin keywords, the "Copied" confirmation, a good grade (A or B), the findings count in the phone switch. Graphite text on it reads 7.6:1. Landing illustrations use a lighter #c9b29f for the same job; Lit Bronze is the system value.
- **Bronze Wash** (rgba(160, 134, 114, 0.14)): the pressed filter chip's fill and the highlight on a linked rule in the catalogue.

### Severity
- **Signal Coral** (#f07070): critical. Its dot carries a 3px halo at 16%. Also the error tone: field errors, a failed CI check, D and F grades, and the input notice (35% border, 6% fill).
- **Ember** (#ec9055): high.
- **Brass** (#d8b763): medium; also the warning tone in the release grid and a C grade.
- **Steel Blue** (#93b2d2): low.
- **Neutral Grey** (#a0a0a0): info.

The live app always prints the word beside the hue. Some landing illustrations (the hero window's rows, the spec check's operation counts) still show bare dots inside a labelled image; new illustrations carry the word too.

### Neutral
- **Graphite Ground** (#111111): page, findings desk and bars; also the ink on bronze and on the chalk band.
- **Pane Graphite** (#141414): the app's inputs and detail desks, so the findings desk reads as the centre.
- **Inkwell** (#0c0c0c): wells that hold user or machine text: code inputs, text inputs, code blocks, the evidence box.
- **Raised Graphite** (#1c1c1c): the surface tier: hovered rows, the grade tile, menus, the empty-state mark, inline code chips, secondary-button hover, landing frames. app.css currently carries #1a1a1a for this role; converge on #1c1c1c.
- **Selected Graphite** (#212121): the selected finding row, the selected segment, tab count badges, the meter track.
- **Product Window** (#151515): the landing's illustrated app windows (their code wells use #0d0d0d).
- **Chalk** (#f2f2f2): primary text.
- **Soft Chalk** (#cfcfcf): secondary text that is still content: detail paragraphs, field labels, code-block text, chip labels.
- **Ash** (#8f8f8f): meta text: locations, counts, hints, captions; 5.8:1 on Graphite. app.css uses #949494 for the same role.
- **Faint** (#7d7d7d): placeholders and code-gutter line numbers, the lowest tone any text may take; 4.7:1 on Inkwell. The app's gutter currently sits at #4c4c4c (2.3:1), under this floor.
- **Hairline** (rgba(242, 242, 242, 0.08)) between regions and rows, **Strong Hairline** (rgba(242, 242, 242, 0.14)) around controls. Hover strengthens a control border to 22–30% chalk.
- **Chalk Band** (#f2f2f2 ground, #111111 ink, #5c5c5c muted): the landing's one inverse section (agents).
- **Sand Ground** (#d9ccb7): the kit's lit ground (`data-ground="sand"`) behind the agents illustration; the hero's painterly landscape is drawn in the same warm family.

### Syntax
Keyword (#d1ad8f), string (#a9c39f), number (#dcbc72), comment (#8c8c8c), decorator (#93b2d2), property (#e6e6e6): a warm, muted set that sits under the bronze and never competes with severity. Comments are content (they explain the fix), so they keep #8c8c8c (5.7:1 on Inkwell); app.css still has #6b6b6b (3.7:1). HTTP methods in illustrations reuse it: GET steel blue, POST sage, PATCH brass, PUT bronze.

### Named Rules
**The One Lamp Rule.** Bronze is the only accent and it means "act here" or "this is selected". One filled bronze button per view; no bronze headings, decorative borders, gradients or fills wider than a control.

**The Word Beside the Dot Rule.** A severity colour never carries meaning alone: every dot, chip, pill and row shows the word (Critical, High, Medium, Low, Info). Severity hues are used for risk, failure and the grade, never for categories or decoration.

**The Graphite Ground Rule.** Every surface is dark. The chalk band is the only light ground in the product and it stays one section long.

## Typography

**Display Font:** Instrument Sans, variable 400–700, 75–100% width, self-hosted (with system-ui, sans-serif)
**Body Font:** Instrument Sans (with ui-sans-serif, system-ui, sans-serif)
**Label/Mono Font:** DM Mono 400 and 500, self-hosted (with ui-monospace, SFMono-Regular, Menlo, Consolas)

**Character:** A slightly narrowed grotesk (96% width) with tight tracking at display sizes, paired with a soft, round-shouldered mono. The sans speaks; the mono quotes.

### Hierarchy
- **Display** (500, 41.6px to 66.6px fluid, 1.02, -0.036em): the landing hero h1 only.
- **Headline** (500, 30px to 48px fluid, 1.1, -0.028em): landing section h2s. The rules catalogue title uses clamp(32px, 2.4vw + 18px, 48px) at 1.08 and -0.03em.
- **Title** (500, 26px, 1.2, -0.022em; 22px on phones): the open finding. Smaller app heads step down at weight 500: empty-state title 24px (-0.02em), rule group 22px, findings summary 20px, panel title 19px, rule title 18px, idle title 17px, block h3 15px.
- **Statistic** (500, 28px to 38px fluid, 1, tabular figures): the four figures that roll; always a step under the h2.
- **Lead** (400, 18px, 20px from 1024px, 1.5): section intros. The hero lead runs 17px to 20px at max 42ch; the catalogue lead is 17px at 1.6.
- **Body** (400, 16px, 1.55): landing paragraphs and FAQ answers (max 64ch).
- **Body (app)** (400, 14px, 1.5, stylistic set ss01, 96% width): app and catalogue chrome.
- **Reading** (400, 15px, 1.65, Soft Chalk): explanations in the detail pane (max 68ch) and rule text (max 70ch).
- **Label** (500, 13px, 1.4): field labels, chips, pills, segmented items, footer and menu headings.
- **Mono** (DM Mono 400, 12.5px, 1.65): code blocks; 12.5px on a 20px line in the code input. Finding locations 13px at 1.45; rule ids 12.5–13.5px at 500 in Lit Bronze; counts and scores 12.5–13px.
- **Closing wordmark:** "Patchlane" across the closing screen in the display face at 500, -0.045em, line-height 0.86, sized to the wrap's width divided by 4.4.

### Named Rules
**The Mono Means Machine Rule.** DM Mono is for anything a machine wrote or will read: code, paths, operations, header and claim names, rule ids, evidence, versions, counts and scores. Sentences, labels and headings are never mono.

**The Two Weights Rule.** 400 to read, 500 to label or head. Nothing in the interface is set at 600 or 700; the one exception is the "P" inside the app's brand tile.

**The Tight Display Rule.** Display, headline and title sizes track negative (-0.022em to -0.036em) at weight 500; text sizes track at 0.

## Layout

### Landing
- Fixed header 72px tall (56px on phones), opaque Graphite with one hairline; never blurred, never hidden on scroll.
- Every main section is exactly one screen (100svh), padded 120px at the top and 72px at the bottom (96px and 48px on phones). From 640px to 1279px a section may grow past its screen but never shrinks under it.
- One container: max 1280px with side gutters of 80px (1024px and up), 48px (640–1023px) and 24px (under 640px). Twelve columns, 24px column gap (12px on phones).
- Splits put words on 5 columns and the visual on 6 starting at column 7, top-aligned, words always left. The heading-to-content gap is 48px (32px on phones).
- Hero (collage): h1, lead, two buttons and one proof line on 5 columns. On the right, the painterly frame holds the product window 64px in from its top-left, cut 28px past the right edge, with a chalk note card docked bottom-left. Under 1024px the words stack above the art; under 640px only the main window shows.
- Ground sequence: Graphite hero and product frame, the soft mist ground (checks), the chalk band (agents), Graphite (CI diagram and figures), the band ground (questions), then the closing screen with the name across it and the footer columns.
- Spacing scale (4/8): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128px. Stacks use 16px or 24px between siblings.
- Breakpoints: 640, 1024, 1280px.

### App
- Sticky top bar 56px: brand, the local-only note (hidden under 1200px), framework select, Export menu, primary "Load the sample".
- 1200px and up: three desks under the bar, each scrolling on its own and split by hairlines: Inputs (400–468px, Pane Graphite), Findings (1fr, Graphite), Detail (1.08fr, Pane Graphite).
- 760–1199px: Inputs (340–400px) beside Findings; Detail becomes a sheet sliding in from the right, min(680px, 100vw − 340px) wide, with a back button.
- Under 760px: one column with a sticky Inputs/Findings switch under the top bar; Detail covers the screen. Under 380px the wordmark hides and only the tile remains.
- Internal rhythm: input panels padded 22/20/28px with 20px between fields; findings desk padded 24px; detail body 26–28px with 22px between blocks; rows 13px vertical.
- Measures: panel intros 46ch, detail paragraphs 68ch.

### Rules catalogue
One centred 880px column, padded 64px at the top and 120px at the bottom (40/16/80px on phones). Groups sit 48px apart; each rule is a hairline-separated block with 22px vertical padding.

### Named Rules
**The One Screen Rule.** On the landing a section is one screen with its h2 first; content that does not fit is cut or moved, never allowed to spill into the next screen.

**The Three Desks Rule.** The app always reads inputs, findings, detail from left to right, and collapses in that order: detail to a sheet, then everything to one column with a switch.

## Elevation & Depth

Flat by default. Depth comes from three tools used in order: a 1px chalk hairline (8% between regions, 14% around controls), then a tonal step (Inkwell below the ground for wells, Raised and Selected Graphite above it for hover and selection), and only then a shadow, kept for elements that float over other content.

### Shadow Vocabulary
- **Menu** (`box-shadow: 0 16px 40px -12px rgba(0,0,0,0.7), 0 2px 6px rgba(0,0,0,0.4)`): the Export menu.
- **Sheet** (`box-shadow: -24px 0 48px -16px rgba(0,0,0,0.7)`): the detail sheet sliding over the findings (760–1199px).
- **Segment** (`box-shadow: 0 1px 2px rgba(0,0,0,0.4)`): the selected framework segment.
- **Product window** (`box-shadow: 0 0 0 1px rgba(255,255,255,0.07), 0 40px 80px -36px rgba(0,0,0,0.85), 0 12px 24px -12px rgba(0,0,0,0.5)`): illustrated app windows on the landing.
- **Floating note** (`box-shadow: 0 24px 48px -20px rgba(0,0,0,0.7), 0 2px 6px rgba(0,0,0,0.25)`): chalk note cards laid over a window.
- **Critical halo** (`box-shadow: 0 0 0 3px rgba(240,112,112,0.16)`): the critical severity dot only.

The detail pane's sticky head is the one blurred layer: Pane Graphite at 80% with a 10px backdrop blur (solid at 94% where blur is unsupported).

### Named Rules
**The Flat Desk Rule.** UI surfaces at rest carry no shadow. Separate with a hairline; lift only what actually floats (a menu, the sheet, an illustration over its ground).

## Shapes

Sharp and engineered, from one scale: 4px for controls (buttons, inputs, chips, section tabs, menu items, the brand tile), 6px for blocks (code inputs, code blocks, evidence, menus, rows, the segmented track, product windows), 8px for tiles and frames (grade tile, empty-state mark, landing frames, the app frame on the landing). Severity dots are 8px squares with 2px corners, not circles: they read as marks on a list, not status lights. Circles are kept for 6px status dots (the ok status, the "Ready" chip) and window-chrome dots in illustrations; full rounding only for tab count badges and scrollbar thumbs. Keyboard keys are 22px with a 2px bottom border. Borders are always 1px.

## Components

### Buttons
- **Shape:** squared with a slight ease (4px).
- **Primary:** Patina Bronze fill, Graphite text, weight 500. Landing: 44px tall, 24px side padding, 16px text. App and catalogue: 38px, 16px padding, 14px text, 44px on coarse pointers. A landing primary may end in the drawn 12px arrow, whose stem grows and head moves 3px on hover.
- **Hover / Press / Focus:** the fill lifts to Lit Bronze; on the landing the button also rises 1px (fine pointers only). Press moves it 1px down (and 1.5% smaller on the landing). Focus is the 2px bronze outline at 2px offset. Disabled at 45% opacity.
- **Secondary:** transparent with a Strong Hairline border and Chalk text; hover takes the border to 30% chalk and fills Raised Graphite. In a phone button row the landing secondary becomes an underlined text link under the full-width primary.
- **Ghost (app):** 34px, Strong Hairline border, Soft Chalk text at 13px/500, a 14px line icon before the label ("Open a file", "Clear", "Copy code", "Download"). The small ghost (30px) shows no border until hover. After a copy it reads "Copied" in Lit Bronze for 1.6s.
- **Icon (app):** 32px square with a Strong Hairline border, for previous and next finding; 35% opacity when disabled.

### Links
Chalk text with an underline in a muted line (Strong Hairline in the app, 4px offset on the landing) that turns to full ink on hover; app links shift their underline to bronze. Landing section links carry a trailing arrow that nudges 3px on hover; draw it as the SVG arrow on new links (see Don'ts).

### Inputs / Fields
- **Text input and select:** 38px (34px small), Inkwell fill, Strong Hairline border, 4px corners, 14px text, 12px side padding; placeholder in Faint. Hover takes the border to 24% chalk; focus turns it Patina Bronze. Selects carry a 14px drawn chevron in Ash.
- **Field:** a 13px/500 Soft Chalk label, an optional 13px Ash hint (inline code chips on Raised Graphite), the control, then a status line.
- **Status line:** DM Mono 13px in Ash, announced politely. OK: Soft Chalk after a 6px bronze dot ("Larkspur Lending API 2.4.0 · 9 operations · OpenAPI 3.0.3"). Error: Signal Coral in the sans face.
- **Check box:** 18px with 3px corners and a 30% chalk border (50% on hover); checked fills Patina Bronze with a Graphite tick; the focus ring sits on the box.

### Code Input (signature)
An Inkwell box (6px, Strong Hairline) split into a line-number gutter and a textarea. The gutter is DM Mono 12.5px on a 20px line, right-aligned, not selectable, scroll-synced, with a hairline on its right. The textarea is DM Mono 12.5px on 20px, unwrapped, tab size 2, with a bronze caret and vertical resize. Hover takes the border to 22% chalk; focus-within turns it bronze. Dragging a file over it turns the border bronze and lays an 86% Graphite veil reading "Drop the file to read it here" in Lit Bronze. The label and ghost tools sit above it, the status line below.

### Desk Tabs (app navigation)
A sticky row on Pane Graphite with a hairline under it: Spec, Server, Token, Release, Agents, CI. Each tab is 40px, 14px/500 in Ash; hover Soft Chalk; selected Chalk with a 2px bronze underline that scales in from the centre over 280ms. A fully round mono count badge (12px on Selected Graphite) shows the desk's findings and disappears at zero. Arrow keys, Home and End move between tabs.

### Section Tabs (landing)
The kit's tabs: 36px, 4px corners, hairline border, 14px/500 Ash; selected fills Chalk with Graphite text, and the ink indicator slides between tabs over 240ms. Landing only.

### Severity Chips (filters)
- **Style:** 32px, 4px corners, Strong Hairline border, transparent; the severity dot, the word, and a mono count (12.5px Ash).
- **State:** pressed fills Bronze Wash with a bronze border and Chalk text; hover takes the border to 30% chalk; a severity with no findings is disabled at 40%. Chips combine. Beside them sit a search field (14px search icon inside) and an area select.

### Severity Dot and Pill
The dot is an 8px square with 2px corners in its severity hue (critical with its halo), always next to its word. The pill in the detail head is 26px, Strong Hairline border, 4px corners, the dot and the word at 13px/500.

### Findings List Rows
A listbox of rows: dot, then title over location, then severity word over rule id on the right. Padding 13px by 12px, 6px corners, a hairline between rows drawn as an inset line. Title 14.5px/500 Chalk; location DM Mono 13px Ash, with invisible characters revealed; severity word 13px Soft Chalk over a 12.5px mono rule id in Ash. Hover fills Raised Graphite. Selected fills Selected Graphite and the hairlines either side disappear. Keyboard: arrows, Home and End in the list, J and K anywhere, Escape clears. On phones the meta drops under the title.

### Grade Tile
A 78px square (66px on phones) in Raised Graphite with a Strong Hairline border and 8px corners. The letter is 40px/500 at -0.03em (34px on phones), coloured by tone: A and B Lit Bronze, C Brass, D and F Signal Coral; under it the score ("40/100") in mono 12.5px Ash. Beside it: the API title (20px/500), a meta line (14px Ash), and the documentation score with an 84 by 4px meter (bronze on Selected Graphite).

### Detail Pane
A sticky 56px blurred head: back button (sheet mode only), then previous, "N of M" in mono 13px, next. The body runs with 22px gaps: meta row (severity pill, rule id in Lit Bronze mono 13px/500, area in Ash), title (26px), "Where" (mono 14px), the "What matched" evidence well (label plus mono 13px/1.6 Chalk), "Why it matters" and "The fix" (15px heads, Reading text), the framework fix, the Gherkin test with its copy button, and "Where this rule comes from" with 6px bronze square bullets naming the OWASP standard (14px Chalk) and the APIsec University course (13px Ash).

### Framework Segmented Control
A track padded 3px, Strong Hairline border, 6px corners, holding Express, FastAPI, Django, Laravel, Spring. Items are 30px with 12px padding, 13px/500 in Ash; hover Chalk; selected Selected Graphite with Chalk text and the segment shadow. It is a tablist (arrow keys), stays in sync with the top bar's framework select, and the choice persists.

### Code Blocks
Inkwell, hairline border, 6px corners, 14px by 16px padding, DM Mono 12.5px/1.65 in Soft Chalk, unwrapped, scrolling past 440px, focusable. Syntax colours as listed; Gherkin keywords in Lit Bronze at 500. A bar above holds the framework name (13px Ash) and a ghost copy button.

### Empty States
- **Nothing checked yet** (findings desk): a 48px Raised Graphite tile with a 22px bronze lock icon, a 24px title, one 15px/1.6 Soft Chalk sentence saying what to paste and that it runs in this tab, the primary "Load the sample" button, and a 13px Ash note describing the sample. Left-aligned, max 440px, vertically centred.
- **Unreadable input:** the same frame titled "Patchlane could not read that input", pointing to the message under the field, with no button.
- **Detail idle:** a 17px Chalk title ("Pick a finding to see its fix", or "Fixes appear here" before any finding), one muted sentence, and J/K key hints.
- **No match:** one muted line in the list ("No finding matches these filters.").

### Menu
Raised Graphite, Strong Hairline border, 6px corners, 6px padding, the Menu shadow. Items are 38px with 4px corners, 14px Soft Chalk after a download icon; hover and focus fill Selected Graphite with Chalk text. Arrow keys move; Escape closes and returns focus to the button.

### Top Bar and Brand Mark
App and catalogue bar: 56px, sticky, Graphite, hairline under. Brand: a 26px Chalk tile with a Graphite "P" (4px corners), then "Patchlane" at 17px/500. The favicon matches. The landing nav uses the kit's 22px initial mark in Patina Bronze instead; the two have drifted, and the Chalk tile is the one that leaves bronze to the button beside it.

### Landing Nav
Fixed 72px, opaque Graphite, hairline under. Logo left, five words centred (15px/500 Chalk, 36px tall) with a 2px underline drawn from the left on hover and focus, the GitHub link and the primary button right. "Checks" opens a full-width menu after 150ms of hover intent: three columns, each a 13px Ash label over links with a 14px Ash subline. Under 1024px a toggle opens a full-screen list.

### Phone Switch
Under 760px, a sticky row under the top bar with two equal 40px buttons, Inputs and Findings (with a Lit Bronze mono count). Pressed: Selected Graphite, Chalk text, 24% chalk border. Unpressed: transparent with Ash text.

### Motion
Landing (kit): hover in 150ms, out 120ms, press 90ms, menus 200ms, tab indicator 240ms, on cubic-bezier(.2, .8, .2, 1). App: 160–180ms colour changes, 120ms press, 280ms tab underline, 380ms detail sheet, on cubic-bezier(0.22, 1, 0.36, 1). Once on load the hero h1 enters word by word and its art settles from 98% scale (about 1.1s). The four figures roll once like an odometer (1400ms, 90ms stagger) when their row first appears. The painterly ground drifts slowly and has a pause control. Under reduced motion transitions collapse, nothing moves or scales, the WebGL ground draws one still frame, and the figures stand as written.

### UI Copy
- Sentence case everywhere: buttons, tabs, headings, menu items.
- Buttons are a verb and its object: "Start a check-up", "Load the sample", "Open a file", "Copy code", "Copy test", "Download".
- Finding titles state what the artifact shows, in plain words: "The caller picks which object to act on", "An API key travels in the query string". The rule id carries the code name.
- Status lines are facts in mono separated by " · ": "alg RS256 · 7 claims", "3 tools read".
- Errors say what happened and what to do next: "That file is larger than 5 MB. Split it or remove unused parts."
- Empty states say what to do and where it runs: "Paste a spec, a server response, a token or a tool list on the left. The check runs as you type, in this tab."
- Privacy is stated as a fact of construction, never as a badge: "Runs in this tab. Nothing is uploaded."
- Calm and exact: no exclamation marks, no fear words, no hype, no prices, no invented numbers.

## Do's and Don'ts

### Do:
- **Do** keep Patina Bronze (#a08672) for the one primary action per view, the selection marker and the focus ring, with Graphite (#111111) text on it.
- **Do** lift bronze to Lit Bronze (#b9a08b) for hover and for bronze text on dark ground.
- **Do** pair every severity colour with its word, and keep the five severity hues for risk, failure and the grade.
- **Do** set code, paths, rule ids, evidence, versions, counts and scores in DM Mono at 12.5–13px, and everything else in Instrument Sans.
- **Do** separate with a 1px hairline (8% between regions, 14% around controls) before a tonal step, and a tonal step before a shadow.
- **Do** use 4px corners for controls, 6px for blocks and code, 8px for tiles and frames.
- **Do** draw every state: hover, the 2px bronze focus outline at 2px offset, selected, pressed, disabled (45%), empty and error.
- **Do** make touch targets 44px on coarse pointers and keep every analyzer action reachable by keyboard (tabs, listbox, J and K, Escape).
- **Do** keep text at 4.5:1 or better: Ash (#8f8f8f) is the lowest text tone on Graphite, and Faint (#7d7d7d) is for placeholders and line numbers on Inkwell only.
- **Do** self-host every font and asset so each page runs under the strict CSP (self only, two hashed inline scripts).
- **Do** honour reduced motion: no transforms, a still WebGL frame, figures that stand.

### Don't:
- **Don't** introduce a second accent hue, bronze gradients, or bronze fills wider than a control.
- **Don't** show a severity colour without its label, or use severity hues for categories or decoration.
- **Don't** darken bronze on hover on dark ground: the kit's 84% mix toward Graphite drops the button text to about 4.2:1.
- **Don't** round past 8px or make buttons pill-shaped; full rounding is only for count badges, status dots and scrollbar thumbs.
- **Don't** shadow resting UI surfaces or add glows; the critical dot's halo is the only one, and the detail head is the only blurred layer.
- **Don't** add scroll-triggered reveals or parallax; the counter roll is the one moment that starts on scroll, and the hero entrance plays once on load.
- **Don't** set any heading or label at 600 or 700; display is 500 with negative tracking.
- **Don't** put prose in DM Mono or code in Instrument Sans.
- **Don't** load fonts, scripts, images or analytics from another origin.
- **Don't** use text glyphs (→, ✓) as icons; arrows and ticks are drawn SVG, like the button arrow and the check box tick.
- **Don't** bring the landing's filled section tabs into the app; the app uses underline desk tabs and the segmented control.
