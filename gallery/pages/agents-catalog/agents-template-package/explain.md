---
title: Agent / Đóng gói quy trình
route: /workspaces/<ws>/agents/templates/package/<installation>
area: agents-catalog
---
Route: `/workspaces/<ws>/agents/templates/package/<installation>`. Packaging one agent's process as a template (form column of measure "form"). The shot is the top of the form; the version, preview and save regions are below the fold and described from code.

Grammar paths are under `node_modules/@starci/grammar/dist/core/`. Screens are the console shell (`ConsoleLayout`, a `WorkspaceShell`) around one route page. Shots are taken in the Next dev server (the round "N" button, "Compiling" and "1 Issue" pills are Next dev overlays, not app UI; retake with `devIndicators: false`).

## Header band (trail "Agent / Đóng gói quy trình", title, description)
Vì sao: the band has the trail, the title "Đóng gói quy trình" (18) and a 14 muted description; no tabs and no actions (the save command is at the foot of the form). The trail "Agent / Đóng gói quy trình" skips "Mẫu của tôi", the tab this page belongs to.
Luật: `page-header-left-sublabel-xs.md` (band flush left), `type-scale-14-12.md`.
Grammar: `Page header={{ breadcrumbs, title, description }}` (`frame/Page/index.d.ts`). Code: `features/pages/AgentTemplatesPage/index.tsx`.

## Notice ("Gói chỉ có quy trình: không có Brain nội bộ…")
Vì sao: CHƯA RÕ — the notice is `Alert tone="informative"`, but it is drawn in the pink/red soft pair with dark red text, so it reads as an error ("Phiên bản đã chốt sẽ được đóng gói: 8" is neutral information). The accent soft pair is the brand colour, not an info colour; the owner has not said which tone "informative" should be (Core must take HeroUI tokens; Nivo may add an info tone) and the colour must not be swapped without asking.
Luật: `grammar-core-heroui.md` (tones from HeroUI, apps may add tones), `owner-colors-exact.md` (never swap a colour without asking).
Grammar: `Alert tone="informative" title description` (`composite/Alert/index.d.ts`). Code: `blocks/AgentTemplatePackage/component.tsx`.

## "Thông tin mẫu" form card (Mã của mẫu, Tên VI/EN, Tóm tắt VI/EN, Nhóm, Giọng của agent)
Vì sao: a form card in a 480px column centred in the well: label on the pink, nine text inputs with 14/500 labels on the surface-secondary fill, no descriptions. The code lays the text fields in `Grid kind="form" columns={2}` but the narrow column shows them in one, so the form is long (each field ~90px). "Nhóm" is prefilled with the raw key "operations" (English enum), which is the only unlocalised value. The ids are plain inputs: no help on the format ("a-z, 0-9, gạch nối" is in the label).
Luật: `surfacecard-select-subtitle.md` (flat fields: label 14/500 + optional description), `table-heroui-native-section-head.md` (ONE CONTENT PER CARD: an input group is allowed with its footer), `page-header-left-sublabel-xs.md` (content capped and centred).
Grammar: `SurfaceCard label` + `Grid kind="form"` + `Input`, `Textarea` (`frame/SurfaceCard`, `frame/Grid`, `branch/Input`, `branch/Textarea`); `Stack measure="form"` (`frame/Stack`). Code: `blocks/AgentTemplatePackage/component.tsx` (`TemplateCard`).

## "Phiên bản này" card (changelog, breaking switch) — below the fold
Vì sao: SAI — a changelog `Textarea` and a `Switch` with a separate hand-rolled 12 muted hint under it (`Text size="sm" tone="muted"`). A switch setting is ONE row with title+description on the left and the switch on the right edge; Grammar `Switch label description` does exactly that, so the hint must be the Switch `description`, and the title a noun ("Không tương thích"), not the verb-led sentence.
Luật: `surfacecard-select-subtitle.md` (switch rows; row titles are nouns; no loose explanatory lines).
Grammar: `Switch label description` (`leaf/Switch/index.d.ts`). Code: `blocks/AgentTemplatePackage/component.tsx` (`VersionCard`).

## "Gói sẽ có gì" preview card — below the fold
Vì sao: SAI — the preview is a stack of loose `Text` lines (what is kept, left out, needed), then a negative `Alert` for problems and suggestions as 12 muted lines; a card of lone sentences breaks one-content-per-card. It should be a list or `DescriptionList` card (Giữ lại / Bỏ ra / Cần), with problems as `Alert` rows; the retry button on a failed preview is a neutral `sm` pill with no icon (correct).
Luật: `table-heroui-native-section-head.md` (ONE CONTENT PER CARD; lone sentences become rows), `page-header-left-sublabel-xs.md` (sm buttons no icon).
Grammar: `SurfaceCard kind="list"` / `DescriptionList`, `Alert tone="negative"`. Code: `blocks/AgentTemplatePackage/component.tsx` (`PreviewCard`).

## Save button ("Đóng gói") — below the fold
Vì sao: the one `commit` button at the foot of the column; disabled until the package can be saved and pending while it saves.
Luật: `surfacecard-zones-api.md` (form footer carries the action).
Grammar: `Button intent="commit" isDisabled isPending` (`leaf/Button/index.d.ts`). Code: `blocks/AgentTemplatePackage/component.tsx`.

## Phone layout (390)
Vì sao: the column fills the width with the 16px gutter; the notice wraps to five lines; fields stack; the floating button covers the "Tóm tắt" label.
Luật: `pink-page-surface-rule.md`.
Grammar: `Stack measure="form"` (`frame/Stack`). Code: `blocks/AgentTemplatePackage/component.tsx`.
