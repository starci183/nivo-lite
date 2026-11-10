# NIVO gallery

One folder per page, with its screenshots and an `explain.md` that justifies every visible region.
Owner rule (2026-11-09): a region that cannot be explained with an owner law and a Grammar reference is a BUG.

## Layout

```
gallery/pages/<area>/<screen>/
  1440.png  1920.png  390.png      ONLY widths (desktop, wide, phone)
  explain.md
  links.json                       optional (flow map)
```

- One folder = one screen = one `explain.md`. No `before/`, no variant file names (`1440-open.png`, `sales-1440.png` are rejected).
- A different STATE (open drawer, pressed step, selected order) is its own folder: `agent-workbench/sales-wb-don-hang` and
  `agent-workbench/sales-wb-don-hang-mo-chi-tiet`. A different AGENT is its own folder: `sales-…`, `chatbot-…`, `accounting-…`.
  A scrolled view is not a separate screen. Its `explain.md` says exactly what that screen shows; regions not checked yet are `CHƯA RÕ`.
- Areas follow the app: `agent-workbench`, `agent-work`, `agent-graph`, `agent-workflows`, `agent-setup`, `agent-chat`,
  `agent-connections`, `agent-knowledge`, `flowgraph`, `chat`, `overview`, ...
- `shots/` is the old flat layout, kept until the owner says otherwise. `scripts/migrate-shots.mjs` was the one-off copy (needs `--force`).
- PNGs are git-ignored; `explain.md` files are source.

## explain.md

```md
---
title: Cài đặt / Chung
route: /workspaces/<ws>/agents/<module>/<installation>/setup/general
area: agent-setup
---
## Dải đầu trang (đường dẫn, tên agent, tab)
Vì sao: <the reason, naming the owner law>. If the code is wrong write `SAI — <why> -> should be <fix>`.
Luật: `page-header-left-sublabel-xs` (memory file name, several allowed)
Grammar: `Page` `header` `tabs`, `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`; story `Frame/Page`
```

One `## <Region>` per visible region (header, each pane, each card, each control group, empty/loading states).
`Vì sao`, `Luật`, `Grammar` are single paragraphs (continuation lines are joined).

Verdicts, all machine-visible:
- OK: `Vì sao` and `Grammar` present and honest.
- `Vì sao: SAI — ...`: the code hand-rolls what Grammar provides, or contradicts a law. Write what it should be.
- `Vì sao: CHƯA RÕ`: nobody can justify it yet. Counts as a bug.
- Missing `Vì sao` or `Grammar` (or no `explain.md`) is a bug; the app shows a red "LỖI: thiếu giải thích" badge.

## Running

- `npx vite --port 3150 --strictPort --host 127.0.0.1` (or `npm run dev`). The watcher ignores PNGs (bulk copies crashed it with
  EBUSY); reload the page after adding images. `.md` and source hot-reload.
- `node scripts/check-explain.mjs --list` prints every bug and exits 1 if any (usable as a gate).
- The app shows ONLY screens that have an `explain.md`: areas on the left (bugs/pages), a card grid, then a width switcher beside the
  rendered explanation. Screens without `explain.md` are not displayed; the top bar counts them ("Chưa có giải thích: N trang", expandable list).
  Screens with `SAI` / `CHƯA RÕ` / missing-field regions carry the red badge.

## For fixers

Every UI fix: put the after shots into the page folder, update `explain.md`, run the checker. Do not report with bugs open.

## Scope (2026-11-09)

Focus is AGENTS only: `shell` (the shared frame, explained once in `shell/khung-chung`; per-screen explains cover page content only), `agents-catalog`, `agent-workbench`, `agent-work`, `agent-graph`, `agent-workflows`, `agent-setup`, `agent-chat`,
`agent-connections`, `agent-knowledge`, `flowgraph`. The viewer lists them first; every other area sits in a collapsed "Khác (chưa rà)"
group and is excluded from the top counts. Do not write or curate `explain.md` outside the agent areas for now.

## Shots: no loading, no error states

A screen is the settled design, never a skeleton, spinner or error notice. Every shot script MUST use the shared helper:

```js
const { shoot, refuseAndExit } = require('D:/starci-lanes/nivo-auth-ux/gallery/scripts/wait-ready.cjs')
try { await shoot(page, 'gallery/pages/<area>/<screen>/1440.png') } catch (e) { refuseAndExit(e) }   // exit 1 if it never settles
```

`wait-ready.cjs` (`waitReady`, `shoot`) waits until the network is idle AND nothing visible matches `[aria-busy="true"]`,
`[data-loading="true"]` (Grammar writes `data-loading="false"` when loaded, so only "true" counts), `[data-grammar-skeleton]`,
`[data-grammar-loading-region]`, the `starci-core-*skeleton*` parts, progress bars or spinners, for 600 ms in a row.
It also refuses AT ONCE (no waiting) any fatal page: the Next.js error overlay (`nextjs-portal` dialog, `[data-nextjs-dialog]`, "Build Error" / "Unhandled Runtime Error" / "Failed to compile" / "Can't resolve" text), the 500 page (`__NEXT_DATA__` statusCode 500 or `/_error`, "Internal Server Error"), and an app with nothing rendered (empty body or empty `<main>`). The dev "N / Issues" badge alone is not fatal.
If it never settles within 20 s it refuses the shot (nothing is written) and the script exits non-zero.
Pass `{ allowError: true }` only for a screen whose design IS an error state. Self-test (ready page, skeleton, aria-busy, Next overlay, 500, empty page): `node scripts/wait-ready.cjs --selftest`.
Never overwrite an existing gallery image from a script run that did not pass the helper.
Screens that are loading or error shots are deleted from the gallery, not explained.

## Bản đồ luồng (flow map) — `/flow.html`

Figma-like canvas (`@xyflow/react`): every page thumbnail (`1440.png`) with a blue box on each control that navigates, and an edge from
the box to the page it opens (solid = another page, dashed = overlay/state folder). Pills on top pick one flow (`flows.json`, ids use
`{agent}` for the per-agent folders; a step may be `{default, accounting?, chatbot?, sales?}` when an agent's equivalent page has another name) and the agent. Click a node: only its in/out edges stay. The right panel lists the problems:
`to: null` hotspots (grouped), pages with no incoming edge, two hotspots leading to the same page, explained pages without `links.json`.

Links are never drawn by hand:

```
node scripts/capture-links.cjs <sales|accounting|chatbot> [maxPages]   # live app :3900 -> capture/<agent>.json (raw)
node scripts/build-links.mjs                                           # raw + explain routes -> pages/<area>/<page>/links.json
```

- `capture-links.cjs` signs in with the sealed dev test owner (seed files, never printed), crawls the agent's pages with the app's own
  router, and records every `a[href]`, `data-gallery-to`, and every control whose click changes the route or opens a dialog/drawer
  (box at 1440). GraphQL mutations are aborted, mutation-looking buttons (delete, send, pay, save, retry ...) and submit buttons are never
  clicked. `MERGE=1 SEEDS=<sub-paths>` adds pages to an earlier capture.
- `build-links.mjs` maps a route to a folder through the `route:` of `explain.md` (or, when absent, the folder name), and an overlay to the
  state folder `<page>-<state>` beside its page. `links.json` is `[{ label, box, to, kind: "page"|"overlay", note?, route? }]`.
- A control marked `data-gallery-to="<area>/<page>"` is taken as a link even when the DOM has no `href`.
