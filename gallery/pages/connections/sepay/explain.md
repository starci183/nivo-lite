---
title: Kết nối / Nguồn tiền về (SePay)
route: /workspaces/<ws>/connections/sepay
area: connections
---
# Nguồn tiền về (SePay) (trang nhà cung cấp)

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `ConnectionProvider` (components/blocks/ConnectionProvider/component.tsx) with frames `ConnectionProviderTable`, `ConnectionBand` and composite `FiguresStrip`; this layout is shared by every provider (Zalo, Telegram, SePay, payOS). Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Overlays ("N", "Compiling", red dot) are not content.

## Khung console (thanh trên, thanh bên)
Vì sao: white console chrome, "Kết nối" current in the sidebar; the theme toggle in the top bar has no law behind it (CHƯA RÕ).
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`.

## Dải đầu trang (đường dẫn Kết nối / Nguồn tiền về (SePay), logo, tiêu đề, "Tiền về · 1 tài khoản", nút "+ Thêm tài khoản")
Vì sao: flush-left breadcrumb, brand tile + title and a 12 muted sub-line in the white band with a bottom border and one primary CTA (with a plus icon, allowed on a primary CTA) at the right; the band has no tabs because a provider page has one view.
Luật: `page-header-left-sublabel-xs.md`, `nivo-surface-layering.md`.
Grammar: `PageHeader`, `Button intent="commit"`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Dải số liệu
Vì sao: three figures: Đang chạy 1 (trên 1 tài khoản), Sự kiện cuối "2 ngày trước", Agent dùng 2 (Kế toán, Sales), in one card of cells with a 14 muted label, a figure and a 12 muted note: the figures-ribbon content type. The third figure repeats information the table below shows (which agents use the connection).
Luật: `surfacecard-zones-api.md` (header kind `figures`), `table-heroui-native-section-head.md` (one content per card).
Grammar: `SurfaceCard headers=[{ kind: "figures" }]`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`; composite `FiguresStrip`.

## Đầu khối "Kết nối của bạn 1"
Vì sao: a block label 14/500 on the pink with a grey count chip directly to its right and nothing at the right: exactly the section-head law (compare the hub, where the count is wrongly at the right).
Luật: `table-heroui-native-section-head.md` (section head: label + count chip left).
Grammar: `Section title count`, `Badge`, `node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts`.

## Bảng kết nối (Tài khoản, Trạng thái, Agent dùng, Thao tác)
Vì sao: SAI — columned data in the native grey frame with the white body and header labels (correct, and unlike the hub it has a real Trạng thái column), but: the row shows the SePay logo, "SePay" with "MBBANK · •••• 9999 · CONG TY TNHH CONG NGHE NIVO", a status chip "Đang chạy", two stacked agents (Kế toán "Tự làm", Sales "Chỉ đọc") and "Mở →" centred on the double row; the "Tự làm"/"Chỉ đọc" chips are tinted pink or grey although they are a normal permission mode (pink is reserved for work waiting on the owner); the row subtitle holds ids that belong in a collapsed "Chi tiết kỹ thuật" list; "Mở →" is a red link in a column titled "Thao tác" while the primary row action elsewhere is a neutral button.
Luật: `table-heroui-native-section-head.md` (native table; raw ids in "Chi tiết kỹ thuật"; links: → for navigation), `type-scale-14-12.md`.
Grammar: `DataTable`, `Badge`, `Link`, `node_modules/@starci/grammar/dist/core/branch/DataTable/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Link/index.d.ts`; frame `ConnectionProviderTable`.

## Dòng "Cùng cách ghi với tab Kết nối của agent: agent · dùng để · mức quyền." dưới bảng
Vì sao: SAI — a 12px caption that explains how to read the table in developer language ("agent · dùng để · mức quyền"); it is not a legend of the data and should be the table's head subtitle in plain words or removed.
Luật: `surfacecard-select-subtitle.md` (captions only for legends), `table-heroui-native-section-head.md`.
Grammar: `Text size="xs" tone="muted"`, `node_modules/@starci/grammar/dist/core/leaf/Text/index.d.ts`.

## Khối "Về Nguồn tiền về (SePay)" (Mang về, Cần chuẩn bị, Dành cho, tên nhà cung cấp)
Vì sao: SAI — a block label over a white details card: four rows (the provider's own name as first term, then Mang về, Cần chuẩn bị, Dành cho) in a two-column DescriptionList. The first row repeats the page title as a term, the list is static documentation that the Thư viện drawer shows too, and it is a white card without the grey native frame; it belongs in the library drawer (and in a collapsed "Về ..." disclosure here), not as a permanent block of the provider page.
Luật: `table-heroui-native-section-head.md` (one content per card; no card in card), `surfacecard-select-subtitle.md` (row title noun + subtitle).
Grammar: `DescriptionList`, `SurfaceCard`, `node_modules/@starci/grammar/dist/core/composite/DescriptionList/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`; or `Disclosure`.

## Bố cục điện thoại 390
Vì sao: SAI — the "⋯" nav row and a blank strip precede the band, the sticky band overlays the figures ribbon (its first row is clipped), and the table does NOT become a list of rows: it keeps all columns squeezed into 390px, the status column disappears, the agent name "Chatbot" breaks letter by letter vertically, "Thao tác" wraps and the ids wrap to six lines. The law says a phone table is a list of rows (column API hideBelow / phone list) and short columns never wrap.
Luật: `table-heroui-native-section-head.md` (column API width/hideBelow, phone = list of rows, short columns never wrap), `nivo-surface-layering.md`.
Grammar: `DataTable` with `hideBelow`, `node_modules/@starci/grammar/dist/core/branch/DataTable/index.d.ts`; `PaneGrid`, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`.
