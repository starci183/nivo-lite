---
title: Second Brain / Kiến thức / Bài học
route: /workspaces/<ws>/brain (tab Kiến thức, view Bài học)
area: brain-billing
---
# Second Brain, Kiến thức, Bài học (trống)

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `BrainLessons` (components/blocks/BrainLessons/component.tsx). The shot is the EMPTY state. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console, dải đầu trang và hai tầng tab
Vì sao: SAI — same band as the other Brain views, same blank 64px strip above it, and the band content is at x 268 / 1428 like Hồ sơ (vs 288 / 1408 on Tài liệu, Sự thật): inconsistent horizontal padding between views of one page.
Luật: `nivo-surface-layering.md`, `page-header-left-sublabel-xs.md`.
Grammar: `PageHeader`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Nút "Thêm bài học" trong dải và trong thông báo trống
Vì sao: ĐÃ SỬA (phase 2) — một chỗ duy nhất cho lệnh: khi trống nút nằm trong thẻ thông báo (thẻ trắng nổi trên nền hồng, như mọi trang), dải đầu không vẽ nó; có bài học thì nút ở dải. Trước đây hai chỗ cùng lúc và thông báo che cả trang bằng nền trắng.
Luật: `suggestion-button-sm.md`, `page-header-left-sublabel-xs.md`.
Grammar: `Button`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.

## Trạng thái trống ("Chưa có bài học nào" + mô tả)
Vì sao: frameless centred EmptyNotice with icon tile, message, sentence and a primary commit; the description says what NIVO will suggest and that the owner may add one, good. The icon is the brain glyph reused from Hồ sơ.
Luật: ui-laws "EmptyNotice on a pane is frameless".
Grammar: `EmptyNotice frame="frameless"`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.

## Danh sách bài học và bộ lọc agent (không có trong shot)
Vì sao: CHƯA RÕ — the block has a `Select` of agents and a lesson list/detail (`LessonDetail`), none shown here.
Luật: `verify-against-visualize.md`.
Grammar: `Select`, `node_modules/@starci/grammar/dist/core/branch/Select/index.d.ts`.
