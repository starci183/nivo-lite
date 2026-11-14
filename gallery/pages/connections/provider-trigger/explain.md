---
title: Kết nối › tài khoản › Trigger (khuôn trang provider)
route: /workspaces/<ws>/connections/open/<id>/trigger
area: connections
---
# Trang provider › tab Trigger

Ảnh chụp cũ (chưa có mục Trigger) từ dữ liệu mẫu `providerOffer` (SePay) trên route thử tạm đã xoá; không có sidebar console, không gọi back end. Hình mẫu: `lanes/drawings/provider-docs-config.png` phần "Tab Trigger · Lớp 3". Dải đầu và bảng: xem ../provider-api/explain.md.

## Dải đầu trang và 5 tab
Vì sao: như ../provider-api; tab Trigger đang chọn.
Luật: `pink-page-surface-rule`, `surfacecard-zones-api`, `badge-dot-or-not`
Grammar: `Page` `header.tabs`, node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts

## Dòng dẫn "Lớp 3 · chạy ngầm …"
Vì sao: một câu 12 mờ trên nền hồng nói cấp này là gì.
Luật: `type-scale-14-12`
Grammar: `Text size="xs" tone="muted"`, node_modules/@starci/grammar/dist/core/leaf/Text/index.d.ts

## Mục Trigger: công tắc, lần phát cuối, workflow đăng ký (đổi 2026-11-13: chuyển từ tab Cấu hình)
Vì sao: bản vẽ provider-page-three-levels và provider-template-four cho cấp 3 ba thứ: công tắc theo tài khoản, lần phát cuối, các workflow nó đánh thức. Nhãn "Trigger" là đầu mục (`Section`) nên còn nguyên khi provider không có trigger. Dưới nó một thẻ danh sách, mỗi trigger hai hàng: hàng công tắc (tên = câu tóm tắt của registry, dòng 12 mờ "Webhook · Lần cuối … · N lần" hoặc "Chưa phát lần nào", công tắc ở cuối hàng, lưu ngay) và hàng "Workflow đang đăng ký" (mỗi workflow là link thường tới bản đồ workflow, tên agent và vai trò mờ bên cạnh; không có thì "Chưa có workflow nào đăng ký."). Hàng "Khi bật lại" (khi có trigger bắt lại được) và "Agent được quyết định" (khi trigger có agent quyết định) đi cùng thẻ; chủ sở hữu và quản lý bật tắt, người khác thấy công tắc khoá. Trigger chỉ báo việc NIVO tự nhờ (hoàn tất render) mặc định bật: hiện đúng trạng thái API trả. Lời từ chối và nghĩa hai lựa chọn là chú thích 12 mờ dưới thẻ.
Luật: `row-control-clearance`, `type-scale-14-12`, `red-budget-links-foreground`
Grammar: `Section kind="region"`, `SurfaceCard kind="list"` với `control` = `Switch`, `detail` = `Link variant="plain"`

## Thẻ tài liệu một trigger
Vì sao: dưới mục Trigger, chip Webhook/Poll, id, câu tóm tắt song ngữ của registry, bảng "Dữ liệu sự kiện" (tên, kiểu hoặc lựa chọn đóng, nhãn song ngữ; thành viên lọc được ghi "Lọc được theo trường này"). Dòng "Gom lô … Bắt lại sự kiện đã lỡ: có/không" là ghi chú 12 mờ dưới thẻ (`note`).
Luật: `pink-page-surface-rule`, `table-heroui-native-section-head`, `badge-dot-or-not`, `type-scale-14-12`
Grammar: `SurfaceCard kind="table"` `note`; mảnh dùng chung `components/composites/ProviderDocList`

## Trạng thái: rỗng, đang tải, lỗi
Vì sao: provider không có trigger giữ nhãn "Trigger" và nói "Provider này chưa có trigger." ngay dưới (thẻ tài liệu thu lại để câu không lặp; xem ../provider-trigger-chua-co); đang tải giữ chữ thật của nhãn, chỉ dữ liệu là khung xương; lỗi có nút thử lại.
Luật: `page-loading-own-shape`
Grammar: `SlotView` (`empty="collapse"`)

## Còn khác hình vẽ
- Hình đặt dòng Gom lô trong thẻ và có "trong 10 giây" mà hợp đồng không trả (không hiện, không bịa); Grammar đặt `note` dưới thẻ.
- Công tắc bật tô accent, bản vẽ tô màu chữ chính: Grammar `Switch` không có tông trung tính (khoảng hở Grammar).
- "Số lần hôm nay" của bản vẽ: API chỉ có tổng `firedCount`, nên hàng nói "N lần" không nói "hôm nay".
- Workflow trỏ tới bước đăng ký của workflow (`…/workflows/<key>/map?step=`) vì quyền trigger của API đưa bước.

## Ảnh còn thiếu
Tab Trigger của từng provider (SePay, payOS, Zalo OA, Telegram, Google) ở 1440 và 390: công tắc bật / tắt, có / chưa có workflow, chưa từng phát, đang lưu, lời từ chối, thành viên chỉ đọc, provider không có trigger (nhãn còn), đang tải.
