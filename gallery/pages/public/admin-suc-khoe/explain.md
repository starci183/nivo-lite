---
title: Không tìm thấy trang (admin sức khoẻ, trùng)
route: /admin/health (old name)
area: public
---
# Trùng với `admin`

Same not-found screen as `public/admin`; the folder name is an old route (`admin-suc-khoe`) that now falls through to not-found. Superseded by `admin`. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Toàn trang (dải tiêu đề + thông báo + nút "Về tổng quan →")
Vì sao: SAI — identical to `admin`: pink header band repeating the notice title, no logo or language switch; plus the route itself is a stale admin URL that should not exist as a gallery page.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md`.
Grammar: `EmptyNotice frame="frameless"`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.
