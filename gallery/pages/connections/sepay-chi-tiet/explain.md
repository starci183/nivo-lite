---
title: Kết nối / SePay / chi tiết
route: /workspaces/<ws>/connections/sepay/<id>
area: connections
---
# Chi tiết kết nối SePay

Blocks `SepayConnectionHead`, `SepayConnectionSteps`, `SepayHealth`, `SepayNotices`, `SepayRail`. Shots `1440.png`, `390.png`; folder `connection-sepay-grants` is a twin capture of the same page, superseded by this folder. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console (thanh trên, thanh bên)
Vì sao: white console chrome, "Kết nối" current in the sidebar; theme toggle has no law behind it (CHƯA RÕ).
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`.

## Dải đầu trang (đường dẫn 3 cấp, logo, "SePay", chip "Đang chạy", dòng "SePay · •••• 9999", ⋯, tab Tổng quan / Sự kiện / Agent 2 / Cài đặt)
Vì sao: flush-left breadcrumb, brand tile, title with a success chip, sub-line with the masked account and tabs, with only a ⋯ menu as command (no primary because the connection is running); correct. The breadcrumb "Nguồn tiền về (SePay) / SePay" repeats the name twice.
Luật: `page-header-left-sublabel-xs.md`, `table-heroui-native-section-head.md` (tab counts grey; raw ids in a collapsed list).
Grammar: `PageHeader tabs`, `Button`, `DropdownMenu`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Khối "Thông tin kết nối" (Ngân hàng, Tài khoản, Chủ tài khoản, Môi trường, URL nhận webhook, API Key, Webhook gần nhất, Xác thực hợp lệ, Đã chặn trùng lặp)
Vì sao: SAI — a nine-row details card; the useful facts (bank, account, owner, environment) are mixed with technical items: a 90-character webhook URL wrapped over two lines (`https://nivo-local.starci.org/api/connections/sepay/44c471c0-...`), a masked API key, counters "0/0" and "0" with no unit; the law moves raw ids and keys to a collapsed "Chi tiết kỹ thuật" list card and keeps the facts card to what the owner needs; the webhook URL needs the copy field (`ConnectionCopyInput`), not text.
Luật: `table-heroui-native-section-head.md` (raw ids in "Chi tiết kỹ thuật"), `type-scale-14-12.md`.
Grammar: `DescriptionList`, `CopyField`, `Disclosure`, `node_modules/@starci/grammar/dist/core/composite/DescriptionList/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/CopyField/index.d.ts`.

## Cột phải "Sự kiện webhook" + chip "Trực tiếp" (danh sách tiền vào, mỗi dòng chip 200)
Vì sao: this capture (2026-11-10, after the K-BLK re-shoot) has events, so the rail is a labelled list card: "+2.000 ₫ · Tiền vào" over "20:05 · xác thực OK" with a 200 status chip at the row end; the earlier empty-card flag belonged to the old capture with no events. The green left bar on the rows is the same state encoding flagged on the Telegram and Zalo checks columns; the verdict lives there, not repeated here.
Luật: `table-heroui-native-section-head.md` (head = label left, one chip), `nivo-surface-layering.md`.
Grammar: `SurfaceCard kind="list"`, `Badge`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`; block `SepayRail`.

## Khối "Agent dùng kết nối này 2" (Kế toán, Sales, mỗi dòng nút "Gỡ")
Vì sao: the agents bound to this connection, one list card: agent avatar + name, and at the row end one neutral sm "Gỡ" (owner only) that unbinds the agent; the card's header zone holds the "Giao cho agent" Select that binds another agent (owner only, when one is left). There is no per-connection level any more (K-BLK 2026-11-10, "one rights model"): what each agent may do through the account is ticked on the agent's Quyền tab, so the row carries no "Tự làm / Hỏi trước / Chỉ đọc" picker. Still open from the old audit: the head's count chip placement and the three forms of the bind command (header Select here, none on payOS overview while no agent is bound).
Luật: `provider-rights-abilities.md` (one rights model, rights per connected account on the Quyền tab), `verify-against-visualize.md` (sm button, no icon), `row-control-clearance.md` (control keeps p-3/p-4), `table-heroui-native-section-head.md`.
Grammar: `SurfaceCard kind="list" headers`, `Select`, `Button intent="neutral" size="sm"`, `node_modules/@starci/grammar/dist/core/composite/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`; composite `ConnectionGrantRows`, frame `ConnectionGrantsBand`.
