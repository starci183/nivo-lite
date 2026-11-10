---
title: Tin tuyển dụng công khai (lỗi tải)
route: /workspaces/<ws>/jobs/<job>
area: public
---
# Tin tuyển dụng và ứng tuyển

Block `HiringApplyForm` (components/blocks/HiringApplyForm/component.tsx) with composite `HiringJobPost`, in `PublicShell`; route `app/[locale]/workspaces/[workspaceId]/jobs/[job]`. The shot is the FAILED read ("Chưa tải được tin tuyển dụng"); the job post and apply form are not shown. Note: the public job page lives under `/workspaces/<ws>/...`, a console-looking URL for a visitor who never signs in (SAI of the route: should be a public path like `/j/...` or `/b/...`). Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Thanh trên cùng
Vì sao: SAI — "NIVO os" logo and the named text pill "Tiếng Việt" instead of the round icon dropdown.
Luật: `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts`; `LocaleSwitch`.

## Thông báo lỗi "Chưa tải được tin tuyển dụng" với nút "Thử lại"
Vì sao: frameless failure notice that names the thing that failed, one neutral retry pill.
Luật: ui-laws "EmptyNotice on a pane is frameless", `suggestion-button-sm.md`.
Grammar: `EmptyNotice frame="frameless"`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.

## Dòng "Vận hành bởi NIVO."
Vì sao: standard public foot line.
Luật: `type-scale-14-12.md`.
Grammar: `Text size="xs" tone="muted"`, `PublicShell foot`.

## Tin tuyển dụng và biểu mẫu ứng tuyển (không có trong shot)
Vì sao: CHƯA RÕ — the job post card, the questions (`HiringApplyQuestion`), the honeypot field and submit have no screenshot.
Luật: `verify-against-visualize.md`.
Grammar: `Form`, `Input`, `Textarea`, `SurfaceCard`, `node_modules/@starci/grammar/dist/core/frame/Form/index.d.ts`.
