---
title: Agent / Đóng gói quy trình
route: /workspaces/<ws>/agents/templates/package/<installation>
area: agents-catalog
---
Route: `/workspaces/<ws>/agents/templates/package/<installation>`. Packaging one agent's process as a template: one centred column of measure `reading` (about 544px, the next measure above `form`). The shots are tall so the regions below the fold (version, preview, save) are visible.

Grammar paths are under `node_modules/@starci/grammar/dist/core/`. Screens are the console shell (`ConsoleLayout`, a `WorkspaceShell`) around one route page. Shots are taken in the Next dev server (the round "N" button is the Next dev overlay, not app UI). The notice is drawn in the accent pair until Grammar 0.37.17 makes `informative` neutral; the app does not hand-colour it.

## Header band (trail "Tổng quan / Agent / Mẫu của tôi / Đóng gói quy trình", title, description)
Vì sao: the trail ends in the tab this page belongs to ("Mẫu của tôi", a link back to the templates tab) before the page itself; title "Đóng gói quy trình" (18) and a short 14 muted description; no tabs and no actions (the one command is at the foot of the form).
Luật: `page-header-left-sublabel-xs.md` (band flush left), `type-scale-14-12.md`.
Grammar: `Page header={{ breadcrumbs, title, description }}` (`frame/Page/index.d.ts`). Code: `features/pages/AgentTemplatesPage/index.tsx`, `modules/page-header` (`agentsSubpageCrumbsOf` with `parent`).

## Notice ("Gói chỉ có quy trình")
Vì sao: `Alert tone="informative"` with a short title and one line of what the package leaves out plus the frozen version that will be packaged. The tone is informative, so it turns neutral with Grammar 0.37.17; the app passes no colour.
Luật: `red-budget-links-foreground.md` (informative alerts are neutral, never the accent pair), `owner-colors-exact.md`.
Grammar: `Alert tone="informative" title description` (`composite/Alert/index.d.ts`). Code: `blocks/AgentTemplatePackage/component.tsx`.

## "Thông tin mẫu" form card (Mã của mẫu | Nhóm, Tên Việt | Tên Anh, Tóm tắt, Giọng của agent)
Vì sao: one `Grid kind="form" columns={2}`: key and group on one row, the two names on one row, the two summaries and the voice at the full width (`span="full"`). "Nhóm" is a Grammar `Select` with localized labels (Bán hàng và khách, Tài chính, Vận hành, Tiếp thị, Nhân sự), never the raw key. The column uses `Stack measure="reading"` (the next width above `form`) so the grid can reach its two-column breakpoint (Grammar 0.37.18: a 31rem container), as in the approved drawing (about 520px); at 390 the grid stacks to one column.
Luật: `surfacecard-select-subtitle.md` (flat fields: label 14/500 + optional description), `table-heroui-native-section-head.md` (ONE CONTENT PER CARD: one form), `page-header-left-sublabel-xs.md` (column capped and centred).
Grammar: `SurfaceCard label` + `Grid kind="form"` + `Input`, `Select`, `Textarea` (`frame/SurfaceCard`, `frame/Grid`, `branch/Input`, `branch/Select`, `branch/Textarea`); `Stack measure` (`frame/Stack`). Code: `blocks/AgentTemplatePackage/component.tsx` (`TemplateCard`).

## "Phiên bản này" card (Có gì mới, Không tương thích)
Vì sao: a changelog `Textarea` labelled "Có gì mới" and ONE `Switch` row through `label` and `description` ("Không tương thích", "Bật khi người đã cài phải thiết lập lại."): title and line at the start, the switch at the end, no loose hint text.
Luật: `surfacecard-select-subtitle.md` (switch rows; row titles are nouns; no loose explanatory lines).
Grammar: `Switch label description` (`leaf/Switch/index.d.ts`). Code: `blocks/AgentTemplatePackage/component.tsx` (`VersionCard`).

## "Gói sẽ có gì" card (Giữ lại / Bỏ ra / Cần)
Vì sao: a details card of three term/value rows taken from the preview (steps and branches kept; Brain references, sources, people and rights left out; providers and rules needed). Before a preview exists the rows show a dash and the note under the card says what to fill in. Problems that refuse the package are `Alert tone="negative"` rows above the card, the numbers that could become settings one `informative` alert below it. The retry on a failed preview is a neutral `sm` pill with no icon in the card head.
Luật: `table-heroui-native-section-head.md` (ONE CONTENT PER CARD; lone sentences become rows), `page-header-left-sublabel-xs.md` (sm buttons no icon).
Grammar: `SurfaceCard kind="details" items labelEnd note` (`frame/SurfaceCard/index.d.ts`), `Alert` (`composite/Alert/index.d.ts`). Code: `blocks/AgentTemplatePackage/component.tsx` (`PreviewCard`).

## Save button ("Đóng gói")
Vì sao: the one primary red call to action of the page, at the foot and at the END of the column (`Cluster justify="end"`); disabled until the package can be saved and pending while it saves. No other red element and no standalone link on the page.
Luật: `red-budget-links-foreground.md` (one red CTA per view), `surfacecard-zones-api.md` (form footer carries the action).
Grammar: `Button intent="commit" isDisabled isPending` (`leaf/Button/index.d.ts`) in `Cluster gap="inline" justify="end"` (`frame/Cluster/index.d.ts`). Code: `blocks/AgentTemplatePackage/component.tsx`.

## Phone layout (390)
Vì sao: the column fills the width with the 16px gutter; the form grid stacks to one column; the notice wraps; the switch row keeps its switch at the end.
Luật: `pink-page-surface-rule.md`.
Grammar: `Stack measure` (`frame/Stack`), `Grid kind="form"` (`frame/Grid`). Code: `blocks/AgentTemplatePackage/component.tsx`.
