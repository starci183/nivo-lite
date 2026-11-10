# NIVO UI law-audit

A Playwright script that opens every console page at 1440 and 390 and runs DOM probes for the owner's UI laws, so a machine
catches the violations before the owner sees a page.

    cd scripts/ui-audit && npm run audit

| env | default | meaning |
|---|---|---|
| `BASE_URL` | `http://localhost:3900` | the dev web server |
| `FILTER` | all | comma list of page-name substrings, e.g. `FILTER=overview,agent-accounting-work` |
| `WIDTHS` | `1440,390` | widths to run |
| `CONCURRENCY` | `3` | pages open at once (one shared login) |
| `PLAYWRIGHT_PATH` | `D:/.claude/packages/grammar/node_modules/playwright` | where Playwright is loaded from when it is not installed here |

Output: `report.json` (here, git-ignored), `gallery/shots/audit/<page>__<w>__audit.png` with every finding outlined in red and
labelled by rule (the gallery shows an "audit" area by itself, it globs `shots/**`), and a summary on stdout (totals by rule, then
page x rule counts).

## Login
The first run signs in with the dev stack's sealed owner secret files (read in memory, typed into the form, never printed) and saves
its own state to `.auth/state.json` (git-ignored). Refresh tokens rotate, so the state is written back after every run. When the
state is stale the script signs in again once (after a 61 s wait because of the login rate limit). Never share this file.

## Routes
All workspace pages, the three agents (`agents/<module>/<id>/...`) x every tab (workbench, work, work?view=runs, chat, connections,
knowledge, performance, settings, setup, setup/general, setup/workflows), plus whatever the header tabs reveal at run time: tab links
become pages of their own and tab buttons are clicked and audited as `<page>~<tab>`. Agents the catalog lists beyond the three known
ones are added.

## Method
Two passes per page. The *view* pass runs at the real viewport at scroll 0 (band, scrolling, scrollbars, panes, overflow, buttons).
The *content* pass runs on a viewport tall enough to show the whole scrolled well, so nothing below the fold is missed. Chromium is
launched without `--hide-scrollbars`, so scrollbars render as the owner sees them.

## Rules
| rule | what it flags |
|---|---|
| `font-size` | visible text (and input values / placeholders) whose computed size is not 12, 14, 18 or 20 px |
| `filled-icon` | an svg with `fill="currentColor"` and no stroke, evenodd paths without stroke, or a shape with a real fill and no stroke |
| `well-border+shadow` | a surface sitting on the pink well (the colour of `.grammar-common-root`) that has both a border and a shadow |
| `card-in-card` | a raised surface (shadow or border, opaque) inside another raised surface |
| `description-under-label` | a sentence inside a section / surface / pane head next to its label, or a paragraph / caption sitting between the head and the body |
| `tab-count-text` | a tab label matching `· N` or `(N)` |
| `band-gap` | the header band's top is more than 2 px off the bottom of the app bar |
| `hidden-under-band` | content under the sticky band at scroll 0 |
| `band-scrolls` | the band moves when a scroll container is scrolled to the bottom |
| `aside-not-flush` | in a pane layout, the right pane ends more than 2 px short of the viewport edge (or the left pane starts late) |
| `raw-key` | camelCase words, UUIDs, snake_case, SCREAMING_CASE and repeated words ("AI AI") in visible text |
| `typed-arrow` | a typed `→`, `->` or `=>` in text (the Link component's own arrow is allowed) |
| `scrollbar` | a visible scrollbar on the page or on an element (offset size minus client size above 1 px) |
| `overflow-x` | the page is wider than the viewport (plus the elements that stick out) |
| `btn-sm-icon` | a `size="sm"` button with text and an svg icon |
| `btn-sm-icon-only` | a `size="sm"` icon-only button; reported apart because the law is about icons next to a label, so judge these case by case |
| `multi-primary` | more than one primary button inside the viewport (every one of them is outlined) |

## Exclusions (false-positive control)
- Code blocks (`pre`, `code`, `kbd`, `samp`): code legitimately uses mono sizes, snake_case and arrows.
- The brand logo (`.starci-core-top-bar-brand`): a brand lockup, not UI text.
- Avatars: a photo avatar has no text; sprout / initials avatars are illustration, so their svgs are skipped for `filled-icon`.
  Initials still count for `font-size`.
- The Grammar link anchor glyph (svg inside `.starci-core-link`): owned by the Link component, not by pages.
- Chrome that is styled primary but is not a call to action: the top bar, the sidebar, the floating assistant button. They do
  not count towards `multi-primary`.
- A surface on a white pane or aside (`.starci-core-pane*`) may carry a border: the laws say so, so it is not `card-in-card`.
  Tables (`.starci-core-data-table`) are not nested cards either; popups (dialog, listbox, menu, tooltip) are skipped.
- The flow graph (`.starci-core-flow-graph*`, owned by another lane) and chat message bubbles (white lifted bubbles are the law) never count as nested or bordered cards; the graph background svg is not an icon. The tabs overflow button `+N` is not a primary.
- Hidden things: `hidden`, `inert`, `aria-hidden` (except svgs, so decorative icons are still checked), zero size, `display:none`,
  `visibility:hidden`, opacity 0, and elements clipped away by an overflow ancestor.
- Raw keys: URL / e-mail fragments (a letter run preceded by `/ @ . : # -`) and a short allow-list of brand spellings
  (iPhone, iPad, iOS, eBay, macOS, iMessage, iCloud, reCAPTCHA, oAuth).
- The Next.js dev overlay (`nextjs-portal`).
- Findings from the dev server only: run it against a server that is up and built; a page that answers 404 or sends the session to
  `/login` is recorded as an `error` in the report instead of being audited.
