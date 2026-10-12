---
title: Bảng câu hỏi thiết lập Kế toán
kind: setup_checklist
version: 1
---
# Bảng câu hỏi thiết lập Kế toán

Kế toán chỉ nên chạy thật khi sáu mục dưới đây đã có thông tin được chủ xác nhận. Trước khi hỏi, đối chiếu với Tri thức doanh nghiệp (chính sách thanh toán, bảng giá, thông tin pháp lý) và tóm tắt lại thay vì hỏi lại điều đã có.

## scope — Phạm vi công việc
Cần có: Kế toán AI làm những việc nào (soạn nháp hóa đơn, đối soát thanh toán, nhắc công nợ, báo cáo), việc nào để người làm.
Đủ khi: có danh sách việc được giao và việc để lại cho người.

## currency_tax — Tiền tệ và thuế
Cần có: đơn vị tiền (thường là VND), thuế GTGT áp dụng và cách ghi (giá đã gồm hay chưa gồm thuế), quy tắc làm tròn, doanh nghiệp có xuất hóa đơn điện tử không.
Đủ khi: có thuế suất hoặc tình trạng không áp dụng, và quy tắc làm tròn. Không tự đoán thuế suất.

## source_evidence — Nguồn chứng từ
Cần có: số liệu lấy từ đâu (đơn hàng từ Bán hàng, sao kê hoặc thông báo ngân hàng, tệp đính kèm), nguồn nào là chính, cập nhật bao lâu một lần.
Đủ khi: có ít nhất một nguồn thanh toán và cách đối chiếu (mã đơn trong nội dung chuyển khoản).

## approval_policy — Chính sách duyệt và ngưỡng
Cần có: số tiền nào Kế toán tự xử lý, số nào cần chủ duyệt, ai duyệt, trường hợp ngoại lệ.
Đủ khi: có ngưỡng bằng VND và người duyệt.

## evidence_requirements — Yêu cầu chứng từ
Cần có: cần chứng từ nào trước khi xuất hóa đơn (tên, mã số thuế, địa chỉ, mục hàng) và trước khi ghi nhận thanh toán.
Đủ khi: có danh sách chứng từ bắt buộc cho từng bước.

## prohibited_actions — Việc không được làm
Cần có: những thao tác tuyệt đối không tự làm (hoàn tiền, hủy hóa đơn, điều chỉnh công nợ, trả tiền ra ngoài).
Đủ khi: chủ đã liệt kê hoặc xác nhận bộ giới hạn mặc định của NIVO.

## Mục không áp dụng

Ví dụ doanh nghiệp chưa xuất hóa đơn điện tử, hoặc không thu tiền qua ngân hàng: ghi nhận là "không áp dụng" cùng lý do, coi mục đã đủ và không hỏi lại. Với thuế, "chưa rõ" không phải là "không áp dụng": phải ghi là cần kế toán viên xác nhận.

## Cách hỏi trong chat thiết lập

- Một mục chưa đủ mỗi lượt; ưu tiên source_evidence và approval_policy vì ảnh hưởng trực tiếp đến tiền.
- Hỏi bằng ngôn ngữ kinh doanh: "Khách thường trả bằng cách nào và nội dung chuyển khoản ghi gì?", không dùng thuật ngữ kế toán nặng.
- Nếu chủ không rõ về thuế, ghi lại "cần kế toán viên xác nhận" và đánh dấu mục là chưa đủ thay vì điền đại.
- Khi hoàn tất, nhắc rà lại các mục và bấm "Áp dụng".
