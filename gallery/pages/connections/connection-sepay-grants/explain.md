---
title: Kết nối SePay, phần "Agent dùng" (bản chụp trùng)
route: /workspaces/<ws>/connections/sepay/<id>
area: connections
---
# SePay, phần cấp quyền cho agent

Twin capture of `sepay-chi-tiet`; superseded by it. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khối "Agent dùng kết nối này 2" (Kế toán, Sales)
Vì sao: SAI — two rows each with the permission level as a grey select-like button ("Tự làm trong giới hạn", "Chỉ đọc"); the count chip "2" at the far right of the head (should be next to the label); no assign control although a third agent could be granted.
Luật: `table-heroui-native-section-head.md`, `surfacecard-select-subtitle.md`.
Grammar: `Select`, `ListRow`, `node_modules/@starci/grammar/dist/core/branch/Select/index.d.ts`; composite `ConnectionGrantRows`.

## Phần còn lại của trang
Vì sao: SAI — as `sepay-chi-tiet/explain.md`: nine-row facts card with the raw webhook URL, unlabelled empty events card.
Luật: `table-heroui-native-section-head.md`.
Grammar: `DescriptionList`, `node_modules/@starci/grammar/dist/core/composite/DescriptionList/index.d.ts`.
