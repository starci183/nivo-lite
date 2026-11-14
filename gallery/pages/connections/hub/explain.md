---
title: Kết nối / Đã kết nối
route: /workspaces/<ws>/connections
area: connections
---
# Kết nối, tab Đã kết nối (hub)

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `ConnectionsHome` (components/blocks/ConnectionsHome/component.tsx) in `ConnectionsFrame`, with frame `ConnectionProviderTable`, `ConnectionRow`. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Overlays ("N", red dot) are not content. On 390 a nav row and a blank strip precede the band (see the Billing page); the 1440 shots of Connections have no such strip.

## Khung console (thanh trên, thanh bên)
Vì sao: white top bar and sidebar; "Kết nối" is the current item. The sidebar has no group for it besides the "Thiết lập" list. The theme toggle in the top bar has no law behind it (CHƯA RÕ).
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`.

## Dải đầu trang (đường dẫn, "Kết nối", dòng trạng thái, nút "+ Thêm kết nối")
Vì sao: SAI — (partly right, see the flagged part) flush-left breadcrumb and title in the white band; the 12 muted status line "3 đang chạy · 2 chờ sự kiện · 2 cần xử lý" is a meta line joined with dots (allowed); one primary CTA with a plus icon at the right (primary CTA may have an icon); tabs "Đã kết nối 5 | Thư viện 34" use grey 12px chips. SAI: the three numbers of the status line repeat the figures ribbon below ("3 đang chạy", "2 chờ", "2 cần xử lý") and the "Cần bạn xử lý" label: four places for the same counts; "cần xử lý" is work waiting on the owner, so it should be a pink chip, not plain text.
Luật: `page-header-left-sublabel-xs.md`, `table-heroui-native-section-head.md` (tab counts grey; pink for waiting on owner), `type-scale-14-12.md`.
Grammar: `PageHeader tabs`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`; `Button intent="commit"`.

## Khối "Cần bạn xử lý 2" (Telegram chưa xong, payOS chưa xong, nút "Tiếp tục")
Vì sao: SAI/OK split. OK: a label + count at the left of the block, and a list card of rows with brand icon, noun title, a 12 muted line "Bước 2/4 · Làm tiếp từ chỗ đang dừng." and a neutral sm "Tiếp tục" pill (every row action here is neutral, also the fix of a failed connection: the page's one red command is "Thêm kết nối" in the band, red budget); the card is one list. SAI: the count chip "2" is grey while the law says pink for work waiting on the owner (this is exactly that); on 390 the sentence truncates.
Luật: `table-heroui-native-section-head.md` (pink only for work waiting on the owner; section head label + chip), `suggestion-button-sm.md`.
Grammar: `Section`, `SurfaceCard` + `ListRow`, `Badge tone`, `Button size="sm"`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`.

## Hàng "Gắn <provider> · <tài khoản> cho <agent> theo mẫu?" (trong "Cần bạn xử lý")
Vì sao: a connected ACCOUNT that agents of a template could use but do not hold is not usable until attached; the page asks in the owner's "Cần bạn xử lý" list, one row per account: the provider mark, the question naming the account and the agents that could get it (joined by the reader's language), the sub line "Tài khoản vừa nối. Chưa agent nào được dùng cho tới khi bạn gắn.", and two neutral small pills "Để sau" (remembered by the page) and "Gắn theo mẫu" (`attachProviderByTemplate` with that `connectionId`). The section count includes these rows. Data: `providerTemplateCandidates({ connectionId })` per connected account; on the dev shop the back end lists the test agents "Test quyền UI" and "Test tài khoản UI", both already removed ("Gỡ agent"), so the two rows shown here are a BACKEND defect (removed agents must not be candidates), reported to F10; the row layout itself is as approved.
Luật: `provider-rights-abilities` (per-account "gắn theo mẫu?" row), `table-heroui-native-section-head.md` (section head label + chip), `suggestion-button-sm.md` (neutral sm pills, no icon).
Grammar: `Section kind="list"` rows `ListRowData` with `detail` holding two `Button size="sm" intent="neutral"` (`surfaceCardData.d.ts`; the row `action` takes only one command). Code: `blocks/ConnectionsHome/attention.tsx`, `blocks/ConnectionsHome/pendingView.ts`, `hooks/providerRights/useProviderTemplateCandidates.ts`.

## Dải số liệu (Đang chạy 3, Chờ sự kiện 2, Cần xử lý 2, Agent dùng 3)
Vì sao: one figures ribbon in one card (four cells with a 14 muted label, a figure, and a 12 muted note), the figures-ribbon content type of the one-content-per-card law; the figures wrap 2x2 on the phone rather than break a number.
Luật: `surfacecard-zones-api.md` (header kind `figures`; figures wrap 2x2 or one column), `table-heroui-native-section-head.md`.
Grammar: `SurfaceCard headers=[{ kind: "figures" }]`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Đầu khối "Tất cả kết nối" + số 5
Vì sao: SAI — the count "5" is a grey chip at the far RIGHT; the law places the count chip next to the label on the left and keeps the right for one → link.
Luật: `table-heroui-native-section-head.md`.
Grammar: `PaneHeader title count`, `node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts`.

## Bảng kết nối: tab lọc (Tất cả 5, Cần xử lý 2, Kênh chat 2, Tiền về 2, Google 1) và ô tìm
Vì sao: the native table's header zones: underline filter tabs with chips and a search field inside the grey frame, per the zones law. "Cần xử lý 2" has a pink chip (correct: waiting on owner) while the others are grey.
Luật: `surfacecard-zones-api.md` (filter + search zones), `table-heroui-native-section-head.md`.
Grammar: `SurfaceCard kind="table" headers=[filter, search]`, `Tabs`, `SearchField`, `node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/SearchField/index.d.ts`.

## Dòng của bảng (Kết nối, Sự kiện cuối, Agent): chip trạng thái, id thô, agent
Vì sao: SAI — columned data is correctly a table in the grey frame with labels, but the status chip ("Đang thiết lập 2/4", "Đang chạy") is placed INSIDE the name cell right after the title at a different x per row instead of in a Trạng thái column (the provider pages have that column); the subtitle shows raw ids ("OA 2128053712141851033 · App 11497188...", "MBBANK · •••• 9999 · CONG TY TNHH ...") which the law moves to a collapsed "Chi tiết kỹ thuật" list; the table has no pagination footer.
Luật: `table-heroui-native-section-head.md` (native table; column API; raw ids in "Chi tiết kỹ thuật"), `type-scale-14-12.md`.
Grammar: `DataTable`, `Pagination`, `Badge`, `node_modules/@starci/grammar/dist/core/branch/DataTable/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/Pagination/index.d.ts`; frame `ConnectionProviderTable`.

## Khối "Website" + "Gắn vào website" (dưới bảng kết nối; cài đặt của kênh website)
Vì sao: NEW (owner order 2026-11-13: the /inbox page is deleted, the website intake stays). The website is a channel that needs no account, so it has no connection page and no provider entry (the trigger `nivo.trigger.website.message.received` is the engine's own); its settings live here, on the page where the shop's channels are managed, under the list of connections, and the block shows on the "Đã kết nối" tab even when there is no connection yet. Two cards in one `Grid kind="pair"`. Left, `SurfaceCard kind="list"` labelled "Website": one row per setting, text at the start and a control at the end (no row action, no chevron): "Nhận khách từ website" (switch, the intake on/off), "Nút chat", "Form đặt hàng", "Bảng giá" (three switches) and "Ai nhận khách" (a compact select: "Agent mặc định" or one of the workspace's agents); the card note is the 12 muted line that chat and price list show when the embed is ready, and a refused save replaces it with the back end's own message. Each change saves at once (like the Trigger card of a provider page), so there is no save button and no CTA in the block: red budget kept at zero. Right, `SurfaceCard` labelled "Gắn vào website": a 12 muted note under it, then a form-grid of two read-only copyable inputs: "Địa chỉ nhận form" (the hosted form link `w/<siteKey>`) and "Mã nhúng" (the iframe snippet), each with its 12 help line. The block is part of an owner / manager page: a member who may not manage connections sees the page's forbidden notice and no Website block (the read issues the site key, so it is not even asked for them). The site key is issued by the first read. Loading mirrors the page: the route's loading slot draws the block under the connections' own skeletons, so the page keeps its two regions; both card labels, row titles and help lines are real words, only the switch / select / input values are skeletons; a failed read is the slot's error with "Thử lại". There is no empty state (the read always answers a site). The old webhook tab of the deleted drawer is not carried: Connections already holds the signed Webhook connector.
Luật: `table-heroui-native-section-head.md` (card label head, no description under it), `surfacecard-select-subtitle.md` (every choice is one control; subtitle only under a title), `type-scale-14-12.md` (14 titles, 12 notes and help), `row-control-clearance.md` (row padding p-4 to the card edge, p-3 to the separator, controls included), `red-budget-links-foreground.md`, `page-loading-own-shape.md`; harness `ui/situations.md` rows "A form" and "A row that opens its record" (not this: the rows carry a control), `ui/loading.md`.
Grammar: `Grid kind="pair"`, `SurfaceCard kind="list"` with `ListRowData` (`control` = `Switch isLabelHidden` / `Select appearance="compact"`), `SurfaceCard` + `Grid kind="form" columns={1}` + `Input isReadOnly isCopyable` (as the identity fields of the "Kết nối" card). Code: `components/blocks/WebsiteChannel/`, `hooks/websiteChannel/` (reads `websiteSite`, saves `saveWebsiteSite` per change, lists agents with `agents`), wired in `features/pages/ConnectionsPage/component.tsx`.
Shots missing: nothing was rendered when this section was written (no stack). Needed: `1440.png` and `390.png` of the tab with the block (ready, owner); a member (no block); loading; failed read; refused save (note replaced); copied state of an input.

## Bố cục điện thoại 390
Vì sao: SAI — the "⋯" nav row and a blank strip precede the band; the title row holds the primary button beside a wrapped status line; the figures ribbon is 2x2 (correct); the table becomes a list of rows. The blank strip is the same defect as Billing.
Luật: `nivo-surface-layering.md`, `surfacecard-zones-api.md` (figures wrap 2x2).
Grammar: `PaneGrid`, `SurfaceCard`.
