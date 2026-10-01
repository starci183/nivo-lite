# Polish wave — make NIVO OS look like a finished, feature-rich product

Read first: `AGENTS-BRIEF.md` (rules still apply: own files only, no git, no npm install, English copy, grammar + @nivo/ui only,
semantic tokens, no invented metrics) and `UI-RULEBOOK.md`.

## Target look (study these images with the Read tool before coding)
- `D:/Repositories/nivo-backend/.starciwork/brand/assets/direction/list-desktop.png`
- `D:/Repositories/nivo-backend/.starciwork/brand/assets/direction/detail-desktop.png`
- `D:/Repositories/nivo-backend/.starciwork/brand/assets/direction/form-desktop.png`
(and the `.html` sources beside them for structure). Patterns to reproduce:
- Page header: small uppercase muted **eyebrow** (section name) → large page title → muted description with a
  freshness note ("Updated 10:00, 29 Sep"), and the page's single filled primary action on the right.
- Filters as white rounded cards (label + value select) in a row, with a "Clear filters" text action.
- A **decision banner** (white card, accent "!" + accent title "1 action needs your decision" + "Review →" link) when
  anything is pending approval.
- List rows as white rounded cards: neutral tile icon on the left, bold title + status badge with a dot,
  a muted one-line description, a meta line ("Requested by **X** · Owner **Y** · 09:58, 29 Sep"), and an outline
  "Open →" button on the right. Section header "List name  3" with a right-aligned muted "Verified 10:00".
- Generous whitespace, 24px between regions, cards with the surface radius and soft shadow, canvas grey.

## Richness — "many buttons and functions", but every control must really work
Add real, working controls that fit each screen: search, filters, sorting, tabs with counts, quick actions,
dropdown "…" menus (DropdownMenu) whose items call existing server actions or navigate, copy-to-clipboard,
keyboard hints, inline edit, refresh buttons, "Open in Office" / "Open lead" cross-links, empty states with actions.
**No dead buttons.** Nothing may pretend to work. The only allowed disabled items are Sales/Accounting "Coming soon".
You may add small server-only query files inside YOUR folders (use `supabaseServer()` + `getSession()` like
`src/features/office/queries.ts`) when you need real counts.

## Verify visually — mandatory, at least 2 rounds
The dev server is already running at http://localhost:3090 with hot reload (do NOT start/restart it, do NOT reset the DB).
Screenshot your routes as the demo user:
```
cd D:/starci-lanes/prototype/apps/prototype
MSYS_NO_PATHCONV=1 node scripts/shot.mjs ../../.shots/<your-id> /route1 /route2
MSYS_NO_PATHCONV=1 SHOT_FULL=1 node scripts/shot.mjs ../../.shots/<your-id>-full /route1
MSYS_NO_PATHCONV=1 SHOT_WIDTH=390 SHOT_HEIGHT=844 node scripts/shot.mjs ../../.shots/<your-id>-mobile /route1
```
Then open the PNGs with the Read tool, critique against the reference images (hierarchy, spacing, alignment,
one focal point, no clutter, no overflow), fix, and re-shoot. Also run `npx tsc --noEmit` (fix your own errors).
Finish with a short report and the paths of your final screenshots.
