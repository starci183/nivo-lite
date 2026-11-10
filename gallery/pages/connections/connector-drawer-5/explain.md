---
title: Ngăn kéo kết nối, bản cũ 5
route: /workspaces/<ws>/connections (Thư viện, ngăn kéo)
area: connections
---
# Ngăn kéo kết nối, lần lặp cũ 5

Only `before/` shots exist: an earlier iteration of the library drawer (title, "Mang về: ..." as bold run-in labels, "Kết nối của bạn" with a plain "0 kết nối" text at the right and a faint empty card). Superseded by `drawer-zalo`, `drawer-sepay`, `drawer-facebook`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Nhãn chạy liền "Mang về: ... Dành cho: ... Cần chuẩn bị: ..."
Vì sao: SAI — three facts drawn as bold run-in labels inside paragraphs; fixed in the after shots by a list card of noun titles with subtitles (row title + subtitle law).
Luật: `surfacecard-select-subtitle.md`.
Grammar: `SurfaceCard` + `ListRow`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`.

## Đầu khối "Kết nối của bạn" với chữ "N kết nối" ở bên phải
Vì sao: SAI — the count is plain text at the far right ("0 kết nối" / "1 kết nối") instead of a grey count chip beside the label; fixed in the after shots.
Luật: `table-heroui-native-section-head.md`.
Grammar: `Badge`, `node_modules/@starci/grammar/dist/core/leaf/Badge/index.d.ts`.
