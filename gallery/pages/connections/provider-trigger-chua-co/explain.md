---
title: Kết nối › tài khoản › Trigger (provider chưa có)
route: /workspaces/<ws>/connections/open/<id>/trigger
area: connections
---
# Trang provider › tab Trigger khi provider không có trigger

Ảnh dựng từ `ProviderTriggerTabBase` với một câu trả lời `providerOffer` rỗng trên route thử tạm (đã xoá). Hình mẫu: dòng "Provider này chưa có …" trong ghi chú cuối của `lanes/drawings/provider-docs-config.png`.

## Dải đầu trang và 5 tab
Vì sao: như ../provider-api; tab Trigger đang chọn.
Luật: `pink-page-surface-rule`, `surfacecard-zones-api`
Grammar: `Page` `header.tabs`, node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts

## Dòng dẫn, nhãn "Trigger" và câu "Provider này chưa có trigger."
Vì sao: đổi 2026-11-13: một cấp rỗng vẫn giữ đầu mục "Trigger" (`Section`), câu nằm dưới nó qua thông báo rỗng của SlotView; không có thẻ giả, thẻ tài liệu thu lại nên câu chỉ hiện một lần. Ảnh hiện có (không còn nhãn) lỗi thời: cần chụp lại.
Luật: `pink-page-surface-rule`, `type-scale-14-12`
Grammar: `Section kind="region"`, `EmptyNotice` qua `SlotView`
