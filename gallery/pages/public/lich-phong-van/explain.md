---
title: Thư mời phỏng vấn (lỗi tải)
route: /j/lich/<token>
area: public
---
# Phản hồi lịch phỏng vấn (/j/lich/<token>)

Block `HiringInterviewReply` (components/blocks/HiringInterviewReply/component.tsx) in `PublicShell`. The shot is the FAILED read ("Chưa tải được lời mời"); the candidate's real reply screen is not shown. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Thanh trên cùng
Vì sao: SAI — "NIVO os" logo and the named text pill "Tiếng Việt" instead of the round icon language dropdown.
Luật: `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts`; `LocaleSwitch`.

## Thông báo lỗi "Chưa tải được lời mời" + "Kiểm tra kết nối rồi thử lại." + nút "Thử lại"
Vì sao: frameless empty notice with a warning tile, the thing that failed, a sentence and a neutral retry pill, centred on the pink; the correct failure pattern for a public page whose token cannot be read.
Luật: ui-laws "EmptyNotice on a pane is frameless", `suggestion-button-sm.md`.
Grammar: `EmptyNotice frame="frameless"`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.

## Dòng "Vận hành bởi NIVO."
Vì sao: standard public foot line.
Luật: `type-scale-14-12.md`.
Grammar: `Text size="xs" tone="muted"`, `PublicShell foot`.

## Màn chọn khung giờ / xác nhận (không có trong shot)
Vì sao: CHƯA RÕ — the loaded reply screen (a `SurfaceCard` with the interview details and the accept/decline commands) has no screenshot; cannot be judged.
Luật: `verify-against-visualize.md`.
Grammar: `SurfaceCard`, `Button`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.
