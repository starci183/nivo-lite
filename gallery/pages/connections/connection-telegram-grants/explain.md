---
title: Kết nối Telegram, phần "Agent dùng" (bản chụp trùng)
route: /workspaces/<ws>/connections/telegram/<id>
area: connections
---
# Telegram, phần cấp quyền cho agent

Twin capture of `telegram-chi-tiet` focusing on the grants block (`ConnectionGrantsBand`, `ConnectionGrantRows`); superseded by `telegram-chi-tiet`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khối "Agent dùng kết nối này 1" (ô chọn "Giao cho agent", dòng Chatbot với nút "Gỡ")
Vì sao: the agents bound to this connection, one list card: agent avatar + name, and at the row end one neutral sm "Gỡ" (owner only) that unbinds the agent; the card's header zone holds the "Giao cho agent" Select that binds another agent (owner only, when one is left). There is no per-connection level any more (K-BLK 2026-11-10, "one rights model"): what each agent may do through the account is ticked on the agent's Quyền tab, so the row carries no "Tự làm / Hỏi trước / Chỉ đọc" picker. Still open from the old audit: the head's count chip placement and the three forms of the bind command (header Select here, none on payOS overview while no agent is bound).
Luật: `provider-rights-abilities.md` (one rights model, rights per connected account on the Quyền tab), `verify-against-visualize.md` (sm button, no icon), `row-control-clearance.md` (control keeps p-3/p-4), `table-heroui-native-section-head.md`.
Grammar: `SurfaceCard kind="list" headers`, `Select`, `Button intent="neutral" size="sm"`, `node_modules/@starci/grammar/dist/core/composite/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`; composite `ConnectionGrantRows`, frame `ConnectionGrantsBand`.

## Phần còn lại của trang
Vì sao: SAI — as `telegram-chi-tiet/explain.md` (setup card with two contents and a duplicated primary; checks column floating).
Luật: `table-heroui-native-section-head.md`.
Grammar: `Stepper`, `SurfaceCard`, `node_modules/@starci/grammar/dist/core/composite/Stepper/index.d.ts`.
