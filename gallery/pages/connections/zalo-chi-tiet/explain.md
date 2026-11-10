---
title: Kết nối / Zalo OA / chi tiết một kết nối
route: /workspaces/<ws>/connections/zalo/<id>
area: connections
---
# Chi tiết một kết nối Zalo OA

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Blocks `ZaloConnectionHead`, `ZaloConnectionFacts`, `ZaloConnectionSteps`, `ZaloConnectionNotices`, `ZaloConnectionEvents`, `ZaloConnectionZns`, `ConnectionAgents`; this layout (head, tabs Tổng quan / Sự kiện / Agent / Cài đặt, facts card, agents card, check list) is shared by Telegram and SePay details. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console (thanh trên, thanh bên)
Vì sao: white console chrome; "Kết nối" current. Theme toggle: CHƯA RÕ.
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`.

## Dải đầu trang (đường dẫn 3 cấp, logo, "Zalo OA", chip "Đang chạy", dòng id, "Gửi tin thử", ⋯)
Vì sao: SAI — flush-left breadcrumb, brand tile and title in the white band, commands at the right (a neutral pill "Gửi tin thử" and a ⋯ menu) and tab layer one below; but the 12 muted line under the title is "Zalo OA · OA ID 2128053712141851033 · App ID 1149718821626934740": raw ids as the page sublabel; they belong in "Chi tiết kỹ thuật". The breadcrumb ends "Zalo OA / Zalo OA" (parent and page have the same name).
Luật: `page-header-left-sublabel-xs.md`, `table-heroui-native-section-head.md` (raw ids in a collapsed list).
Grammar: `PageHeader tabs`, `Button`, `DropdownMenu`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/DropdownMenu/index.d.ts`.

## Tab (Tổng quan, Sự kiện, Agent 1, Cài đặt)
Vì sao: tab layer one in the band: selected primary red with underline on the full-width separator; the grey count chip on Agent is a plain quantity.
Luật: `surfacecard-zones-api.md`, `table-heroui-native-section-head.md` (tab counts grey).
Grammar: `PageHeader tabs`, `Tabs`, `node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`.

## Khối "Thông tin kết nối" (Token, Khách nhắn trong 48 giờ, Agent đang dùng, App ID, App Secret)
Vì sao: SAI — a details card (two columns, hairlines), correct as a fact list, but "App ID" repeats the raw id already in the sublabel, "App Secret" shows "••••QvLS" (a masked secret at the end of the facts instead of a collapsed technical list), and values mix a number and a sentence ("1 · Chỉ trả lời được những người này").
Luật: `table-heroui-native-section-head.md` (raw ids in "Chi tiết kỹ thuật", collapsed).
Grammar: `DescriptionList`, `SurfaceCard kind="details"`, `node_modules/@starci/grammar/dist/core/composite/DescriptionList/index.d.ts`.

## Cột phải "Kiểm tra từng phần" với chip "Trực tiếp" (Ứng dụng Zalo, Token Official Account, Webhook và OA Secret Key)
Vì sao: SAI — a list card of three checks (title + 12 muted result, a coloured left bar for state) in the right column; the "Trực tiếp" chip next to the label is a live-state chip in the head (right side holds one thing: acceptable). The card is a floating block where the aside law wants a white pane; the left accent bars are an extra state encoding not used elsewhere; the Webhook line truncates ("chữ ký hợp lệ ở sự kiện g...").
Luật: `nivo-surface-layering.md` (aside pane), `table-heroui-native-section-head.md`, `owner-colors-exact.md`.
Grammar: `SurfaceCard` + `ListRow`, `Badge`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`; composite `ConnectionNoticeList`.

## Khối "Agent dùng kết nối này 1" (ô chọn "Giao cho agent", dòng Chatbot với nút "Gỡ")
Vì sao: the agents bound to this connection, one list card: agent avatar + name, and at the row end one neutral sm "Gỡ" (owner only) that unbinds the agent; the card's header zone holds the "Giao cho agent" Select that binds another agent (owner only, when one is left). There is no per-connection level any more (K-BLK 2026-11-10, "one rights model"): what each agent may do through the account is ticked on the agent's Quyền tab, so the row carries no "Tự làm / Hỏi trước / Chỉ đọc" picker. Still open from the old audit: the head's count chip placement and the three forms of the bind command (header Select here, none on payOS overview while no agent is bound).
Luật: `provider-rights-abilities.md` (one rights model, rights per connected account on the Quyền tab), `verify-against-visualize.md` (sm button, no icon), `row-control-clearance.md` (control keeps p-3/p-4), `table-heroui-native-section-head.md`.
Grammar: `SurfaceCard kind="list" headers`, `Select`, `Button intent="neutral" size="sm"`, `node_modules/@starci/grammar/dist/core/composite/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`; composite `ConnectionGrantRows`, frame `ConnectionGrantsBand`.

## Bố cục điện thoại 390
Vì sao: CHƯA RÕ — `390.png` exists but the detail layout at phone width is not judged beyond the nav row and blank strip common to all 390 shots.
Luật: `verify-against-visualize.md`.
Grammar: `PaneGrid`.
