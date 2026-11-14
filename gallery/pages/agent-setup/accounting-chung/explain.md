# Agent › Thiết lập › Chung (Kế toán)

Route: `/agents/accounting/<installation>/setup/general`. Shots: `1440.png`, `1920.png`, `390.png` (page top) and `*-end.png` (scrolled to the last fields).
Code: `fe/apps/web/src/features/pages/AgentGeneralPage`, `components/blocks/AgentGeneralForm`.

## Header band, tabs and the sub-tab "Chung"
Vì sao: the band is chrome, flush left, never scrolls; Setup has three sections (Hướng dẫn, Quy trình, Chung), so layer 2 lives in the band under layer 1.
Luật: page-header-left-sublabel-xs.md, pink-page-surface-rule.md, ui-laws.md (Tabs: at most 2 layers, layer 2 in the header band).
Grammar: `Page header.subTabs` (`core/frame/PageHeader`), items in `components/blocks/AgentInstanceFrame/parts.ts`.

## Pink well, fields spaced 24
Vì sao: single fields sit directly on the pink well with spacing only; no card, no divider around one field.
Luật: surfacecard-select-subtitle.md (Flat fields), pink-page-surface-rule.md.
Grammar: `Pane content="cards"` + `Stack gap="region"` (`dist/core/frame/PaneGrid/index.d.ts`, `Stack/index.d.ts`).

## Ảnh đại diện
Vì sao: a field = title + content. Only the Sprout default plus "Tải ảnh lên"; "Dùng Sprout" (sm neutral) appears only after a custom upload. No picker.
Luật: surfacecard-select-subtitle.md (Avatar), type-scale-14-12.md.
Grammar: `Avatar` (Sprout default, `AgentMark`), `FileButton`, `Button intent="neutral" size="sm"` (`dist/core/leaf/Button/index.d.ts`); app composite `FieldBlock` (tiêu đề dùng `Text isStrong` vì Label 14/500 chưa export từ `common`), `AvatarEditor`.

## Tên agent + Tên gọi (@handle)
Vì sao: two simple inputs side by side, flat on the well. The handle is read-only: no BE field edits it.
Luật: surfacecard-select-subtitle.md (Flat fields), ui-laws.md (Field 8/4/24).
Grammar: `Grid kind="form" columns={2}` + `Input` (`dist/core/frame/Grid/index.d.ts`, `core/branch/Input`).

## Giờ làm việc (key-value list)
Vì sao: the hours are a collection (one row per day), so ONE card on the well; its title is the card's section head with no description above it. Consecutive days with the same ranges merge into one row ("Thứ 2 - Thứ 6"); key = day (muted, start), value = range chips (end), "+ khung" adds a range, no range reads "Nghỉ". Pressing a chip opens two 30-minute time choices with "Xoá khung"; on a merged row the edit applies to all its days and "Chỉnh riêng từng ngày" splits them so one day can be edited alone. Phone: the same list.
Luật: surfacecard-select-subtitle.md (cards only for a collection; no description above a card), type-scale-14-12.md.
Grammar: `SurfaceCard kind="list" layout="keyValue" label=...` with `items[].title` / `value` (`dist/core/surfaceCardData.d.ts`, ListData), `Popover`, `Select`, `Button size="sm"`. App: `components/composites/WorkingHoursList`, hook `useHoursEditor`.

## Trả lời ngoài giờ
Vì sao: a switch setting is ONE row: noun title + description on the left, switch at the right edge.
Luật: surfacecard-select-subtitle.md (Switch rows, Row titles are nouns).
Grammar: `Switch isLabelHidden` (`dist/core/leaf/Switch/index.d.ts`) in `FieldBlock trailing`.

## Khi agent trả lời chậm (chatbot only)
Vì sao: one input, the holding message the customer gets while the agent has not answered; the description sits under the title only. The reply-wait field is gone with the old engine.
Luật: surfacecard-select-subtitle.md (subtitle only under a title), ui-laws.md (no description under labels elsewhere), openclaw-removed.md.
Grammar: `Grid kind="form"`, `Input`.

## Footer Huỷ / Lưu
Vì sao: ONE form footer; one primary (Lưu), enabled only when something changed; hours and fields save together.
Luật: ui-laws.md (Buttons: one primary per view), agent-pages-brief.md.
Grammar: `PinnedActionBar visibility="always"` with `dismiss` / `commit` (`dist/core/frame/PinnedActionBar/index.d.ts`), `Form`.

## Người phụ trách
Vì sao: who answers for the agent: a flat field with the person row.
Luật: surfacecard-select-subtitle.md (Flat fields).
Grammar: `Avatar`, `Text`, `Badge` inside app `FieldBlock`.

## Hoạt động, Trả lời khách
Vì sao: noun titles, description under the title, switch at the right; each acts at once. Trả lời khách shows only for agents that talk to customers.
Luật: surfacecard-select-subtitle.md (Switch rows, nouns).
Grammar: `Switch` in `FieldBlock trailing`.

## Gỡ agent
Vì sao: noun title + description, danger button (verb) at the right, flat; the confirmation is a dialog.
Dialog body (read BEFORE `removeAgent`, query `agentDeletionImpact`): the plain confirmation when the agent wrote no record; otherwise one line per record type with its count (the product's own words per type id, the back end's English title only when the catalogue has none), the files that leave the store, "cannot be undone". Neutral text, no red inside the dialog: the one danger button is the confirm. Workflows, runs and conversation history are not counted (the contract excludes them), and the history is said to stay.
Luật: ui-laws.md (Buttons keep verbs), surfacecard-select-subtitle.md.
Grammar: `AlertDialog`, `Button intent="destructive" step="entry" size="sm"` (`dist/core/frame/AlertDialog`).

Retired 2026-11-13: the "Chế độ vận hành" card (assist / autopilot) is gone from this page; the engine reads a node's own mode alone (rights rule 9) and the back end refuses the old switch.
