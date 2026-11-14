---
title: Sandbox / Trang thanh toán giả của link thanh toán sandbox (chỉ dev)
route: /workspaces/<ws>/sandbox/pay/<linkId>
area: sandbox
---
# Sandbox, trang thanh toán giả của một link (chỉ môi trường dev)

Block `SandboxPayPanes` (components/blocks/SandboxPayPanes, container `index.tsx` + pure `component.tsx`), view model `hooks/sandbox/useSandboxPayView.ts`, data `modules/sandbox/sandbox.pay.ts`, route `app/[locale]/workspaces/[workspaceId]/(console)/sandbox/pay/[linkId]`. Viết lại 2026-11-14 (FE-WIRE-B) trên `sandboxPayLink(linkId)`: type-check, lint và test đơn vị, CHƯA xem bằng mắt, chưa có shot (`1440.png`, `390.png` do bước chụp màn hình). Link thật là `<web base>/workspaces/<workspace>/sandbox/pay/<link id>`; link id nói cả tài khoản của nó nên không còn đoán "tài khoản đầu tiên".

## Cổng: dev và production
Vì sao: cùng cổng với trang Sandbox (`useSandboxGate`): trang chỉ thật khi `providerSandbox.enabled`. Production là MỘT thông báo trung tính "Sandbox chỉ có ở môi trường dev", không nút; nhân viên (staff) thấy thông báo trung tính của họ; đọc công tắc hỏng là Alert có "Thử lại".
Luật: `red-budget-links-foreground`, `unhandled-case-tells-customer`.
Grammar: `SurfaceCard` có `ariaLabel`, `EmptyNotice`, `Alert`.

## Đầu trang
Vì sao: tiêu đề "NIVO Sandbox: thanh toán giả" và MỘT câu 12 muted nói không có đồng nào được chuyển. Ở cuối đầu trang là nút chính DUY NHẤT "Thanh toán đủ" (`startGlyph="success"`, đỏ vì là CTA chính, nút duy nhất có icon): gửi ca đầu tiên của `caseIds` qua `sendSandboxCase(account.id, caseIds[0], inputs)`, `inputs` là cái link đưa cho ca (với payOS là mã đơn) nên mã đơn của CHÍNH link này đi theo. Disabled khi chưa đọc xong, khi link bị từ chối, hoặc khi `caseIds` rỗng (link đã thanh toán / hủy / hết hạn). Sau khi gửi trang đọc lại link, nên trạng thái đổi thành "Đã thanh toán".
Luật: `red-budget-links-foreground`, `page-header-left-sublabel-xs`, `type-scale-14-12`.
Grammar: `Page measure="product"` header `actions`, `Button intent="commit" startGlyph`.

## "Yêu cầu thanh toán" (MỘT thẻ danh sách, các sự thật của link)
Vì sao: một lần đọc `sandboxPayLink`: mỗi dòng là giá trị (14) trên tên của nó (12 muted): mã link, tài khoản sandbox (nhãn của tài khoản), số tiền (VND), nội dung chuyển khoản, mã đơn, trạng thái bằng lời ("Đang chờ thanh toán", "Đã thanh toán", "Đã hủy", "Đã hết hạn"; trạng thái lạ nói "Chưa rõ", không bao giờ là mã thô) và, khi đã có tiền về, "Đã nhận (VND)". Dòng trống (nội dung rỗng) bị bỏ. Các ca thử riêng lẻ không còn ở trang này: chúng ở trang Sandbox.
Luật: `row-padding` (p-4 ra mép thẻ, p-3 tới đường kẻ), `type-scale-14-12`.
Grammar: `SurfaceCard kind="list"`, `ListRowData title description`, `Text size="xs" tone="muted"`.

## Link bị từ chối (ba trạng thái trung tính)
Vì sao: ba mã có kiểu của API là ba thông báo trung tính một thẻ (tiêu đề đậm + một câu 12 muted, không nút, không đỏ): link chưa từng được tạo ở đây hoặc thuộc workspace khác (`PROVIDER_SANDBOX_PAY_LINK_UNKNOWN`: "Không tìm thấy link thanh toán này"), link thuộc tài khoản THẬT (`PROVIDER_SANDBOX_LIVE_ACCOUNT`: "Trang giả lập chỉ chơi với tài khoản sandbox. Không có gì được gửi đi") và công tắc sandbox tắt (`PROVIDER_SANDBOX_OFF`: cùng thông báo như trang Sandbox). Một lỗi khác (mạng, 5xx) vẫn là dải lỗi có "Thử lại". Nút chính vẫn hiện nhưng disabled.
Luật: `red-budget-links-foreground`, `unhandled-case-tells-customer`, `no-word-matching-code` (mã lỗi tra bảng khai báo).
Grammar: `SurfaceCard` có `ariaLabel`, `Text isStrong`, `Text size="xs" tone="muted"`.

## Đang tải
Vì sao: loading phản chiếu trang: đầu trang là chữ thật, thẻ vẽ các dòng skeleton cùng hình với dòng thật (`SlotView` placeholder), nút chính disabled.
